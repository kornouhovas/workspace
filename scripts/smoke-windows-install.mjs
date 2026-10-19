import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir, release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { createInstalledWorkspace } from "./workspace-install-driver.mjs";
import { checkArtifact } from "./check-artifact.mjs";
import { cleanupOwnedFixture, closeElectron, ownedProcessesStopped, withDeadline } from "./runtime-lifecycle.mjs";

assert.equal(process.platform, "win32", "Installation acceptance requires actual Windows");
assert.equal(process.arch, "x64", "This distribution targets x64");
// NSIS modifies current-user install registration. Never run this acceptance
// against an ordinary user's existing installation or database.
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted", "Use a disposable GitHub-hosted Windows runner");
const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const installer = join(root, "release", `Workspace-${version}-windows-x64-setup.exe`);
const evidence = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? join(root, "work/issue-40-install"));
await mkdir(evidence, { recursive: true });
const fixture = await realpath(await mkdtemp(join(tmpdir(), "workspace-installed Windows-")));
const installed = join(fixture, "Приложение Workspace");
const executable = join(installed, "Workspace.exe");
const data = join(fixture, "Данные приложения"), source = join(fixture, "Проекты source");
const defaultData = join(process.env.APPDATA, "workspace");
const parents = new Set(), backends = new Set();
const report = { version, platform: process.platform, arch: process.arch, kernel: release(),
  sha: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, stages: [] };
let electron, page, launchUnverified = false, defaultDataOwned = false, installAttempted = false, failure;

async function runInstaller(file, args) {
  // NSIS requires /D and _? to be last and unquoted, including paths with spaces.
  // execFile does not invoke a shell; verbatim arguments avoid Node quoting /D.
  const pending = exec(file, args, { cwd: fixture, timeout: 120000, windowsHide: true, windowsVerbatimArguments: true });
  parents.add(pending.child);
  await pending;
}
async function install() {
  installAttempted = true;
  await runInstaller(installer, ["/S", "/currentuser", `/D=${installed}`]);
  assert.equal((await checkArtifact(installed)).version, version);
  const bytes = await readFile(executable);
  assert.equal(bytes.toString("ascii", 0, 2), "MZ");
  const pe = bytes.readUInt32LE(0x3c);
  assert.equal(bytes.readUInt32LE(pe), 0x4550);
  assert.equal(bytes.readUInt16LE(pe + 4), 0x8664, "Installed executable must be AMD64");
  const metadata = JSON.parse((await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    '$f=Get-Item -LiteralPath $env:WORKSPACE_INSTALLED_EXE; $s=Get-AuthenticodeSignature -LiteralPath $f.FullName; @{product=$f.VersionInfo.ProductVersion;file=$f.VersionInfo.FileVersion;name=$f.VersionInfo.ProductName;signature=[string]$s.Status} | ConvertTo-Json -Compress'],
  { env: { ...process.env, WORKSPACE_INSTALLED_EXE: executable }, timeout: 30000 })).stdout);
  assert.equal(metadata.product, version);
  assert.equal(metadata.file, `${version}.0`);
  assert.equal(metadata.name, "Workspace");
  assert.equal(metadata.signature, "NotSigned", "No validated signing identity is claimed");
  report.executable = metadata;
  for (const name of ["LICENSE.electron.txt", "LICENSES.chromium.html"]) await stat(join(installed, name));
  for (const name of ["THIRD_PARTY_NOTICES.txt", "Drizzle-Apache-2.0.txt"]) {
    const original = name === "THIRD_PARTY_NOTICES.txt" ? join(root, name) : join(root, "licenses", name);
    assert.deepEqual(await readFile(join(installed, "resources/licenses", name)), await readFile(original));
  }
}
async function launch({ useDefaultData = false } = {}) {
  launchUnverified = true;
  const env = { ...process.env, WORKSPACE_TEST_ROOT_PICKER_PATH: source };
  delete env.WORKSPACE_USER_DATA_DIR;
  if (!useDefaultData) env.WORKSPACE_USER_DATA_DIR = data;
  electron = await _electron.launch({ executablePath: executable, cwd: fixture, env, timeout: 30000 });
  parents.add(electron.process());
  page = await electron.firstWindow({ timeout: 30000 });
  page.setDefaultTimeout(30000);
  await page.locator("#interface-language").waitFor();
  const runtime = await electron.evaluate(({ app, BrowserWindow }) => {
    const prefs = BrowserWindow.getAllWindows()[0]?.webContents.getLastWebPreferences();
    return { version: app.getVersion(), packaged: app.isPackaged, path: app.getAppPath(),
      data: app.getPath("userData"), session: app.getPath("sessionData"),
      isolation: prefs && [prefs.contextIsolation, prefs.nodeIntegration, prefs.sandbox],
      pids: app.getAppMetrics().filter(m => m.type === "Utility" && m.serviceName?.includes("Node")).map(m => m.pid) };
  });
  runtime.pids.forEach(pid => backends.add(pid));
  assert.ok(runtime.pids.length, "Installed app must launch its own backend");
  launchUnverified = false;
  assert.equal(runtime.packaged, true); assert.equal(runtime.version, version);
  assert.equal(runtime.path, join(installed, "resources/app.asar"));
  assert.equal(runtime.data, useDefaultData ? defaultData : data);
  assert.equal(runtime.session, runtime.data);
  assert.deepEqual(runtime.isolation, [true, false, true]);
  assert.deepEqual(await page.evaluate(() => ({ node: typeof globalThis.process, require: typeof globalThis.require })),
    { node: "undefined", require: "undefined" });
}
async function stop() {
  await closeElectron(electron);
  electron = undefined;
  for (let attempt = 0; attempt < 50 && !ownedProcessesStopped(parents, backends); attempt++) await new Promise(done => setTimeout(done, 100));
  assert.equal(ownedProcessesStopped(parents, backends), true, "App/backend must exit before installer replacement");
}
async function load() {
  const result = await page.evaluate(() => globalThis.window.workspace.workspace({ type: "workspace.load" }));
  assert.equal(result.ok, true); return result.value;
}
try {
  report.installerSha256 = createHash("sha256").update(await readFile(installer)).digest("hex");
  report.windows = (await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", '(Get-CimInstance Win32_OperatingSystem).Caption'], { timeout: 30000 })).stdout.trim();
  // Exclusive ownership of the normal data directory is required before launch.
  await mkdir(defaultData); defaultDataOwned = true;
  await mkdir(source);
  await writeFile(join(source, "preserved.txt"), "Installation never modifies project files.\n");
  await install(); report.stages.push("offline NSIS installed in Unicode/space path; x64, version, unsigned status and notices verified");
  await launch();
  await createInstalledWorkspace(page, { name: "Installed workspace", source });
  const saved = await load();
  assert.equal(saved.workspaces.length, 1);
  assert.equal(saved.activeWorkspace.name, "Installed workspace");
  assert.equal(saved.activeWorkspace.canonicalRoot, await realpath(source));
  for (const language of ["en", "ru"]) {
    await page.locator("#interface-language").selectOption(language);
    await page.waitForFunction(lang => globalThis.document.documentElement.lang === lang && !globalThis.document.querySelector("#interface-language")?.disabled, language);
    await page.setViewportSize({ width: language === "en" ? 1440 : 720, height: 900 });
    await page.screenshot({ path: join(evidence, `installed-${language}.png`), fullPage: true });
  }
  await stop(); await stat(join(data, "workspace.sqlite"));
  report.stages.push("bundled backend/SQLite create, keyboard EN/RU, isolation and normal quit");
  await launch(); assert.deepEqual(await load(), saved);
  assert.equal(await page.locator("#interface-language").inputValue(), "ru");
  await stop(); report.stages.push("same installation reopens persisted workspace/source/view identities and language");
  await install(); await launch(); assert.deepEqual(await load(), saved);
  assert.equal(await page.locator("#interface-language").inputValue(), "ru");
  await stop(); report.stages.push("same-candidate manual reinstall preserves external application data");
  await launch({ useDefaultData: true });
  assert.equal((await load()).workspaces.length, 0, "Fixture override must not leak into normal app data");
  await createInstalledWorkspace(page, { name: "Default data workspace", source });
  const normalSaved = await load();
  await stop(); await stat(join(defaultData, "workspace.sqlite"));
  await launch({ useDefaultData: true }); assert.deepEqual(await load(), normalSaved);
  await stop(); report.stages.push("normal APPDATA location creates/reopens independently of Unicode fixture data and development");
  assert.equal(await readFile(join(source, "preserved.txt"), "utf8"), "Installation never modifies project files.\n");
  report.status = "passed";
} catch (error) {
  failure = error; report.status = "failed"; report.error = error.message;
  if (page && !page.isClosed()) {
    try {
      report.failureUi = await withDeadline(page.evaluate(() => ({
        buttons: [...globalThis.document.querySelectorAll("button")].map(button => ({ text: button.textContent, disabled: button.disabled })),
        alerts: [...globalThis.document.querySelectorAll('[role="alert"]')].map(alert => alert.textContent),
      })), 5000, "Installation failure UI receipt");
      await withDeadline(page.screenshot({ path: join(evidence, "failed-install.png"), fullPage: true }), 5000, "Installation failure screenshot");
    } catch { report.failureUiUnavailable = true; }
  }
} finally {
  if (electron) { try { await stop(); } catch (error) { failure ??= error; report.shutdownError = error.message; } }
  if (installAttempted && ownedProcessesStopped(parents, backends, { launchUnverified })) {
    try {
      await runInstaller(join(installed, "Uninstall Workspace.exe"), ["/S", "/currentuser", `_?=${installed}`]);
      // NSIS must preserve both the default and overridden database on uninstall.
      if (report.status === "passed") { await stat(join(defaultData, "workspace.sqlite")); await stat(join(data, "workspace.sqlite")); }
      report.uninstall = "passed";
    } catch (error) { failure ??= error; report.uninstallError = error.message; }
  }
  const stopped = ownedProcessesStopped(parents, backends, { launchUnverified });
  if (defaultDataOwned && stopped) {
    try { await rm(defaultData, { recursive: true }); } catch (error) { failure ??= error; }
  }
  await cleanupOwnedFixture(fixture, { processesStopped: stopped, primaryFailure: failure,
    record: async cleanup => { report.cleanup = cleanup; if (failure || cleanup.status !== "passed") report.status = "failed";
      await writeFile(join(evidence, "install-report.json"), JSON.stringify(report, null, 2) + "\n"); } });
}
console.info("Windows NSIS install/create/quit/reopen/reinstall/default-data/uninstall passed");
