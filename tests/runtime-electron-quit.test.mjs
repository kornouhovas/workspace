import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { _electron } from "playwright-core";
import { closeElectron } from "../scripts/runtime-lifecycle.mjs";

test("runtime normal quit waits for deferred application cleanup without a concurrent quit", async () => {
  const profile = await mkdtemp(join(tmpdir(), "workspace-quit-control-"));
  const fixture = fileURLToPath(new URL("./fixtures/runtime-quit-electron.cjs", import.meta.url));
  const app = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"), args: [fixture],
    env: { ...process.env, WORKSPACE_QUIT_CONTROL_PROFILE: profile }, timeout: 10000 });
  const child = app.process();
  let output = "", primary;
  child.stdout.on("data", bytes => { if (output.length < 8192) output += String(bytes); });
  try {
    await app.firstWindow();
    await closeElectron(app);
    assert.ok(child.exitCode !== null || child.signalCode !== null, "Normal quit must confirm parent exit");
    const lines = output.split(/\r?\n/).filter(line => line.startsWith("WORKSPACE_QUIT_CONTROL "));
    assert.equal(lines.length, 1, "Normal quit must retain the owned cleanup result");
    assert.deepEqual(JSON.parse(lines[0].slice("WORKSPACE_QUIT_CONTROL ".length)), { cleanupComplete: true },
      "A competing quit must not bypass deferred application cleanup");
  } catch (error) { primary = error; }
  try {
    if (child.exitCode === null && child.signalCode === null) await closeElectron(app, 20);
    assert.ok(child.exitCode !== null || child.signalCode !== null, "Fixture must exit before profile removal");
    await rm(profile, { recursive: true, force: true });
  } catch (error) {
    if (primary) console.error("Additional quit control cleanup failure:", error);
    else primary = error;
  }
  if (primary) throw primary;
});
