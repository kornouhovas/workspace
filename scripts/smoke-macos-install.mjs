import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, readlink, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir, release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { checkArtifact } from "./check-artifact.mjs";
import { checkMacosBundle } from "./check-macos-bundle.mjs";
import { cleanupOwnedFixture, closeElectron, ownedProcessesStopped } from "./runtime-lifecycle.mjs";

assert.equal(process.platform, "darwin", "Installation acceptance requires actual macOS");
assert.equal(process.arch, "arm64", "This local distribution targets Apple Silicon");
const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const dmg = resolve(process.argv[2] ?? join(root, "release", `Workspace-${version}-mac-arm64.dmg`));
const evidence = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? join(root, "work/issue-39-install"));
await mkdir(evidence, { recursive: true });
const fixture = await realpath(await mkdtemp(join(tmpdir(), "workspace-installed app-")));
const mount = join(fixture, "mounted"), applications = join(fixture, "Applications");
const installed = join(applications, "Workspace.app");
const data = join(fixture, "application-data"), source = join(fixture, "project-source");
const parents = new Set(), backends = new Set();
const report = { version, platform: process.platform, arch: process.arch, kernel: release(),
  sha: process.env.GITHUB_SHA ?? (await exec("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim(),
  run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, stages: [] };
let mounted = false, electron, launchUnverified = false, failure;

async function install() {
  await exec("/usr/bin/ditto", [join(mount, "Workspace.app"), installed], { timeout: 120000 });
  const artifact = await checkArtifact(installed);
  checkMacosBundle(installed, version);
  const executable = join(installed, "Contents/MacOS/Workspace");
  assert.equal((await exec("/usr/bin/lipo", ["-archs", executable])).stdout.trim(), "arm64");
  await stat(join(installed, "Contents/Resources/LICENSE.electron.txt"));
  await stat(join(installed, "Contents/Resources/LICENSES.chromium.html"));
  assert.equal(await readFile(join(installed, "Contents/Resources/licenses/THIRD_PARTY_NOTICES.txt"), "utf8"), await readFile(join(root, "THIRD_PARTY_NOTICES.txt"), "utf8"));
  assert.equal(await readFile(join(installed, "Contents/Resources/licenses/Drizzle-Apache-2.0.txt"), "utf8"), await readFile(join(root, "licenses/Drizzle-Apache-2.0.txt"), "utf8"));
  assert.equal(artifact.version, version);
}

async function launch() {
  launchUnverified = true;
  // HOME, cwd and PATH do not supply the backend or database runtime. Only the
  // established disposable data override is used; no real user database opens.
  electron = await _electron.launch({ executablePath: join(installed, "Contents/MacOS/Workspace"),
    cwd: fixture, env: { ...process.env, WORKSPACE_USER_DATA_DIR: data, WORKSPACE_TEST_ROOT_PICKER_PATH: source }, timeout: 30000 });
  parents.add(electron.process());
  const page = await electron.firstWindow({ timeout: 30000 });
  page.setDefaultTimeout(30000);
  await page.locator("#interface-language").waitFor();
  const runtime = await electron.evaluate(({ app, Menu, BrowserWindow }) => {
    const menu = Menu.getApplicationMenu();
    const roles = items => items.flatMap(item => [item.role, ...roles(item.submenu?.items ?? [])]);
    const prefs = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { version: app.getVersion(), name: app.getName(), packaged: app.isPackaged, path: app.getAppPath(),
      data: app.getPath("userData"), session: app.getPath("sessionData"), about: roles(menu?.items ?? []).includes("about"),
      isolation: [prefs.contextIsolation, prefs.nodeIntegration, prefs.sandbox],
      pids: app.getAppMetrics().filter(m => m.type === "Utility" && m.serviceName?.includes("Node")).map(m => m.pid) };
  });
  runtime.pids.forEach(pid => backends.add(pid));
  assert.ok(runtime.pids.length, "Installed app must launch its own backend");
  launchUnverified = false;
  assert.equal(runtime.packaged, true);
  assert.equal(runtime.version, version);
  assert.equal(runtime.name, "workspace");
  assert.equal(runtime.path, join(installed, "Contents/Resources/app.asar"));
  assert.equal(runtime.data, data); assert.equal(runtime.session, data);
  assert.equal(runtime.about, true, "Standard macOS About menu must expose the version panel");
  assert.deepEqual(runtime.isolation, [true, false, true]);
  const renderer = await page.evaluate(() => ({ node: typeof globalThis.process, require: typeof globalThis.require }));
  assert.deepEqual(renderer, { node: "undefined", require: "undefined" });
  return page;
}
async function stop() {
  await closeElectron(electron);
  electron = undefined;
  for (let attempt = 0; attempt < 50 && !ownedProcessesStopped(parents, backends); attempt++) await new Promise(done => setTimeout(done, 100));
  assert.equal(ownedProcessesStopped(parents, backends), true, "App/backend must exit before replacement");
}
async function load(page) {
  const result = await page.evaluate(() => globalThis.window.workspace.workspace({ type: "workspace.load" }));
  assert.equal(result.ok, true); return result.value;
}
try {
  await exec("/usr/bin/hdiutil", ["verify", dmg], { timeout: 120000 });
  report.dmgSha256 = createHash("sha256").update(await readFile(dmg)).digest("hex");
  report.macos = (await exec("/usr/bin/sw_vers", ["-productVersion"])).stdout.trim();
  await mkdir(mount); await mkdir(applications); await mkdir(source);
  await exec("/usr/bin/hdiutil", ["attach", dmg, "-readonly", "-nobrowse", "-mountpoint", mount], { timeout: 30000 });
  mounted = true;
  assert.equal(await readlink(join(mount, "Applications")), "/Applications");
  await install(); report.stages.push("verified DMG installed outside build directory");
  let page = await launch();
  await page.getByRole("textbox", { name: "Workspace name", exact: true }).fill("Installed workspace");
  await page.getByRole("button", { name: "Choose project folder", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Create workspace", exact: true }).press("Enter");
  await page.getByRole("heading", { name: "Installed workspace", exact: true }).waitFor();
  const saved = await load(page);
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
  report.stages.push("installed bundled backend create/quit, EN/RU keyboard and isolation");
  page = await launch();
  assert.deepEqual(await load(page), saved);
  assert.equal(await page.locator("#interface-language").inputValue(), "ru");
  await stop(); report.stages.push("same installation reopens saved identities, views and language");
  // Replacement uses the same verified candidate, not a claimed schema upgrade.
  await rm(installed, { recursive: true });
  await install(); page = await launch();
  assert.deepEqual(await load(page), saved);
  assert.equal(await page.locator("#interface-language").inputValue(), "ru");
  await stop(); report.stages.push("app replacement preserves application data");
  report.status = "passed";
} catch (error) { failure = error; report.status = "failed"; report.error = error.message; }
finally {
  if (electron) { try { await stop(); } catch (error) { failure ??= error; report.shutdownError = error.message; } }
  if (mounted) { try { await exec("/usr/bin/hdiutil", ["detach", mount], { timeout: 30000 }); } catch (error) { failure ??= error; report.detachError = error.message; } }
  await cleanupOwnedFixture(fixture, { processesStopped: ownedProcessesStopped(parents, backends, { launchUnverified }), primaryFailure: failure,
    record: async cleanup => { report.cleanup = cleanup; if (failure || cleanup.status !== "passed") report.status = "failed"; await writeFile(join(evidence, "install-report.json"), JSON.stringify(report, null, 2) + "\n"); } });
}
console.info("macOS DMG install/create/quit/reopen/replacement passed");
