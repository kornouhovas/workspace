import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "dev";
assert.ok(mode === "dev" || mode === "release", "Expected dev or release mode");

const require = createRequire(import.meta.url);
const executablePath = mode === "dev"
  ? require("electron")
  : process.platform === "darwin"
    ? join(root, "release", `mac-${process.arch}`, "Workspace.app", "Contents", "MacOS", "Workspace")
    : join(root, "release", "win-unpacked", "Workspace.exe");

await stat(executablePath);
const fixture = await mkdtemp(join(tmpdir(), "workspace-runtime-"));

async function launch(dataDirectory) {
  await mkdir(dataDirectory, { recursive: true });
  const electron = await _electron.launch({
    executablePath,
    args: mode === "dev" ? [root] : [],
    cwd: root,
    env: { ...process.env, WORKSPACE_USER_DATA_DIR: dataDirectory },
    timeout: 30000,
  });
  const page = await electron.firstWindow({ timeout: 30000 });
  const paths = await electron.evaluate(({ app }) => ({
    userData: app.getPath("userData"),
    sessionData: app.getPath("sessionData"),
  }));
  assert.deepEqual(paths, { userData: dataDirectory, sessionData: dataDirectory });
  return { electron, page };
}

async function backendPids(electron) {
  return electron.evaluate(({ app }) => app.getAppMetrics()
    .filter((metric) => metric.type === "Utility" && metric.serviceName?.includes("Node"))
    .map((metric) => metric.pid));
}

async function assertStopped(pids) {
  for (const pid of pids) {
    let running = true;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try { process.kill(pid, 0); } catch (error) {
        if (error.code === "ESRCH") { running = false; break; }
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(running, false, `Backend process ${pid} survived application shutdown`);
  }
}

let current;
try {
  const dataDirectory = join(fixture, "normal");
  current = await launch(dataDirectory);
  const { page } = current;
  await page.getByRole("combobox", { name: "Interface language" }).waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(await page.evaluate(() => typeof process), "undefined");
  assert.equal(await page.evaluate(() => typeof require), "undefined");
  assert.deepEqual(await page.evaluate(() => globalThis.window.workspace.getBackendStatus()), { state: "ready" });
  const firstPids = await backendPids(current.electron);
  assert.ok(firstPids.length > 0, "No owned Node utility process is running");
  await page.getByRole("combobox", { name: "Interface language" }).selectOption("ru");
  await page.getByRole("combobox", { name: "Язык интерфейса" }).waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "ru");
  await current.electron.close();
  current = undefined;
  await assertStopped(firstPids);
  await stat(join(dataDirectory, "workspace.sqlite"));

  current = await launch(dataDirectory);
  await current.page.getByRole("combobox", { name: "Язык интерфейса" }).waitFor();
  assert.equal(await current.page.locator("html").getAttribute("lang"), "ru");
  const secondPids = await backendPids(current.electron);
  assert.ok(secondPids.length > 0, "No owned Node utility process is running after restart");
  await current.electron.close();
  current = undefined;
  await assertStopped(secondPids);

  const failureDirectory = join(fixture, "failed-startup");
  await mkdir(join(failureDirectory, "workspace.sqlite"), { recursive: true });
  current = await launch(failureDirectory);
  await current.page.getByRole("heading", { name: "Local service unavailable" }).waitFor();
  assert.deepEqual(await current.page.evaluate(() => globalThis.window.workspace.getBackendStatus()), {
    state: "unavailable",
    message: "Workspace could not start its local service. Close and reopen the app to try again.",
  });
  await current.electron.close();
  current = undefined;
  console.info(`Electron ${mode} runtime verified: isolation, language restart, backend exit, startup failure`);
} finally {
  if (current) await current.electron.close();
  await rm(fixture, { recursive: true, force: true });
}
