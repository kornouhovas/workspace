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
