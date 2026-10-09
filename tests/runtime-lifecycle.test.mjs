import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { closeElectron, withDeadline } from "../scripts/runtime-lifecycle.mjs";

test("runtime deadlines preserve results and errors and reject stalled operations", async () => {
  assert.equal(await withDeadline(Promise.resolve("ready"), 100, "load"), "ready");
  const failure = new Error("load failed");
  await assert.rejects(withDeadline(Promise.reject(failure), 100, "load"), (error) => error === failure);
  await assert.rejects(withDeadline(new Promise(() => {}), 20, "load"), /load timed out/);
});

async function launchFixture() {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000); console.log('ready');"], {
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  await once(child.stdout, "data");
  return child;
}

test("normal runtime shutdown waits for the owned process to exit", async () => {
  const child = await launchFixture();
  const exited = once(child, "exit");
  try {
    await closeElectron({
      process: () => child,
      evaluate: async () => { child.kill(); },
      close: () => exited,
    }, 1000);
    assert.ok(child.exitCode !== null || child.signalCode !== null);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
});

test("stalled runtime shutdown kills the owned process and reports failure within a deadline", async () => {
  const child = await launchFixture();
  try {
    await assert.rejects(closeElectron({
      process: () => child,
      evaluate: () => new Promise(() => {}),
      close: () => new Promise(() => {}),
    }, 20), /Electron shutdown timed out/);
    assert.ok(child.exitCode !== null || child.signalCode !== null);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
});

test("a real configured backend with native root/category watches does not keep its Node process alive", async () => {
  const { mkdtemp, mkdir, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { openSettingsService } = await import("../dist/service/settings.mjs");
  const directory = await mkdtemp(join(tmpdir(), "observer-exit-"));
  const root = join(directory, "root"), database = join(directory, "workspace.sqlite");
  let child;
  try {
    await mkdir(join(root, "Category/Project"), { recursive: true });
    const service = openSettingsService(database);
    try {
      const workspace = service.workspaces.create({ type: "workspace.create", name: "Exit", rootPath: root }).value;
      const preview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode: "grouped" }).value;
      assert.equal(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken }).ok, true);
    } finally { service.close(); }
    child = spawn(process.execPath, ["--input-type=module", "-e", `
      import { openSettingsService } from ${JSON.stringify(new URL("../dist/service/settings.mjs", import.meta.url).href)};
      const service = openSettingsService(process.argv[1]);
      if (service.workspaces.load().value.workspaces.length !== 1) process.exitCode = 1;
      // Deliberately leave service/watchers open: unreferenced resources must not
      // prevent a normal process exit. This is separate from native Electron #44.
    `, database], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (bytes) => { stderr += bytes; });
    const [code, signal] = await withDeadline(once(child, "exit"), 5000, "Backend observer process exit");
    assert.equal(signal, null); assert.equal(code, 0, stderr);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill("SIGKILL"); await exited; }
    await rm(directory, { recursive: true, force: true });
  }
});
