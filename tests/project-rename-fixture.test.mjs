import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, readFile, writeFile, mkdir, rename, readdir, cp } from "node:fs/promises";
import { SCENARIOS } from "./fixtures/project-rename-service-electron.cjs";
import { superviseRenameService, inputDigest } from "../scripts/smoke-project-rename.mjs";

const require = createRequire(import.meta.url);
const { publishCommand, readCommand, startControlReceiver, MAX_COMMAND_BYTES } = require("./fixtures/project-rename-service-control.cjs");

const controlEvidence = name => process.env.WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR
  ? join(process.env.WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR, name) : undefined;

const supported = ["darwin", "win32"].includes(process.platform);
test("real Electron service checkpoint requires every scenario, handshake, shutdown and cleanup", { skip: !supported }, async () => {
  const result = await superviseRenameService({ evidenceDirectory: controlEvidence("success") });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.cleanup, "removed");
  assert.equal(result.shutdownConfirmed, true);
  assert.deepEqual(Object.keys(result.scenarios), SCENARIOS);
  assert.equal(SCENARIOS.length, 16);
  assert.ok(Object.values(result.scenarios).every(value => value.status === "passed"));
  assert.deepEqual(result.events.filter(stage => ["result", "ack_sent", "ack_received", "exit_sent", "main_exit"].includes(stage)),
    ["result", "ack_sent", "ack_received", "exit_sent", "main_exit"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.signaled, false);
  assert.equal(result.timedOut ?? false, false);
  assert.equal(result.protocolError, false);
  assert.equal(result.protocol.failed, false);
  assert.equal(result.protocol.pendingBytes, 0);
  assert.ok(result.utilityCount >= 5);
  assert.equal(result.utilityExitCount, result.utilityCount);
  assert.equal(result.utilityExitFailure, false);
  assert.equal(result.events.filter(stage => stage === "utility_started").length, result.utilityCount);
  assert.equal(result.events.filter(stage => stage === "utility_exit").length, result.utilityCount);
  assert.deepEqual(Object.keys(result.mountedCase), ["direct", "grouped"]);
  for (const behavior of Object.values(result.mountedCase)) assert.ok(["self_alias_staged", "distinct_direct"].includes(behavior));
});
for (const fault of ["failure", "timeout", "malformed", "missing-assertion", "skipped", "missing-ack", "cleanup"]) {
  test(`service fixture rejects ${fault} and reports finite failure/cleanup evidence`, { skip: !supported }, async () => {
    const result = await superviseRenameService({ fault, evidenceDirectory: controlEvidence(fault) });
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.shutdownConfirmed, true, JSON.stringify(result));
    assert.equal(result.cleanup, fault === "cleanup" ? "failed" : "removed");
    if (fault === "failure") assert.ok(Object.values(result.scenarios).some(value => value.status === "failed"));
    if (fault === "skipped") assert.ok(Object.values(result.scenarios).some(value => value.status === "skipped"));
    if (fault === "missing-assertion") assert.ok(Object.values(result.scenarios).some(value => value.status === "unreached"));
    if (fault === "malformed") assert.equal(result.protocol.failed, true);
    if (["timeout", "missing-ack"].includes(fault)) {
      assert.equal(result.timedOut, true); assert.ok(result.utilityCount > 0);
    }
    const encoded = JSON.stringify(result);
    for (const secret of ["Original", "Category", "sentinel", "nativeIdentity", "birthtimeNs", "workspace.sqlite", "stack", "private injected"]) assert.equal(encoded.includes(secret), false, secret);
  });
}

test("evidence persists sanitized failure outcomes and cleanup, and write failures cannot prevent cleanup", { skip: !supported }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "rename-evidence-test-"));
  try {
    const result = await superviseRenameService({ fault: "failure", evidenceDirectory: directory });
    const stored = JSON.parse(await readFile(join(directory, "service-checkpoint.json"), "utf8"));
    assert.deepEqual(stored, result);
    assert.equal(stored.scenarios["direct.rename"].status, "failed");
    assert.equal(stored.scenarios["grouped.recovery"].status, "unreached");
    const file = join(directory, "occupied"); await writeFile(file, "Keep");
    const unavailable = await superviseRenameService({ fault: "failure", evidenceDirectory: file });
    assert.equal(unavailable.evidenceWriteFailed, true);
    assert.equal(unavailable.ok, false); assert.equal(unavailable.cleanup, "removed");
    assert.equal(await readFile(file, "utf8"), "Keep");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function withControlRoot(action) {
  const root = await mkdtemp(join(tmpdir(), "rename-control-test-"));
  try { await action(root); } finally { await rm(root, { recursive: true, force: true }); }
}
function receive(root, milliseconds = 1000) {
  const events = [];
  let end, acknowledge;
  const ended = new Promise(resolve => { end = resolve; });
  const ack = new Promise(resolve => { acknowledge = resolve; });
  const receiver = startControlReceiver(root, {
    deadline: Date.now() + milliseconds,
    onAck: () => { events.push("ack"); acknowledge(); },
    onExit: () => { events.push("exit"); end(); },
    onError: () => { events.push("error"); end(); },
    onTimeout: () => { events.push("timeout"); end(); },
  });
  return { events, receiver, ended, ack };
}
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test("control ignores incomplete publication until atomic rename and consumes ack then exit once", async () => {
  await withControlRoot(async root => {
    const pending = join(root, "ack.control.pending");
    await writeFile(pending, "ac");
    assert.equal(await readCommand(root, "ack"), false);
    const control = receive(root);
    try {
      control.receiver.resultPublished();
      await pause(30);
      assert.deepEqual(control.events, []);
      await writeFile(pending, "ack\n");
      await rename(pending, join(root, "ack.control"));
      await control.ack;
      await publishCommand(root, "exit", Date.now() + 1000);
      await control.ended;
      assert.deepEqual(control.events, ["ack", "exit"]);
      assert.deepEqual(await readdir(root), []);
      await pause(30);
      assert.deepEqual(control.events, ["ack", "exit"]);
    } finally { control.receiver.dispose(); }
  });
});

test("control accepts only exact fixed records and bounded sizes", async () => {
  await withControlRoot(async root => {
    assert.equal(MAX_COMMAND_BYTES, 5);
    for (const command of ["ack", "exit"]) {
      await publishCommand(root, command, Date.now() + 1000);
      assert.equal(await readCommand(root, command), true);
      await assert.rejects(publishCommand(root, command, Date.now() + 1000));
      assert.equal(await readFile(join(root, `${command}.control`), "utf8"), `${command}\n`);
    }
    for (const invalid of ["", "ack", "ack\r\n", "ack\n ", "exit\n", "ack\0", "ack\n" + "x".repeat(10000)]) {
      await writeFile(join(root, "ack.control"), invalid);
      await assert.rejects(readCommand(root, "ack"));
    }
    for (const invalid of ["", "../ack", "ACK", "__proto__"]) {
      await assert.rejects(publishCommand(root, invalid, Date.now() + 1000));
      await assert.rejects(readCommand(root, invalid));
    }
  });
});

test("control rejects early, out-of-order, simultaneous and duplicate commands", async () => {
  for (const kind of ["early", "exit-first", "simultaneous", "duplicate", "invalid"]) {
    await withControlRoot(async root => {
      const control = receive(root);
      try {
        if (kind !== "early") control.receiver.resultPublished();
        if (kind === "exit-first") await publishCommand(root, "exit", Date.now() + 1000);
        else if (kind === "simultaneous") {
          // Both commands exist before polling starts: exit was never authorized.
          control.receiver.dispose();
          await publishCommand(root, "ack", Date.now() + 1000);
          await publishCommand(root, "exit", Date.now() + 1000);
          const simultaneous = receive(root);
          try {
            simultaneous.receiver.resultPublished(); await simultaneous.ended;
            assert.deepEqual(simultaneous.events, ["error"]);
          } finally { simultaneous.receiver.dispose(); }
          return;
        } else if (kind === "invalid") await writeFile(join(root, "ack.control"), "bad\n");
        else {
          await publishCommand(root, "ack", Date.now() + 1000);
          if (kind === "duplicate") { await control.ack; await publishCommand(root, "ack", Date.now() + 1000); }
        }
        await control.ended;
        assert.deepEqual(control.events, kind === "duplicate" ? ["ack", "error"] : ["error"], kind);
        await pause(20);
        assert.equal(control.events.filter(event => event === "error").length, 1);
      } finally { control.receiver.dispose(); }
    });
  }
});

test("control publication and read failures are caught and stop receiver polling", async () => {
  await withControlRoot(async root => {
    await assert.rejects(publishCommand(join(root, "missing"), "ack", Date.now() + 1000));
    await mkdir(join(root, "ack.control.pending"));
    await assert.rejects(publishCommand(root, "ack", Date.now() + 1000));
    assert.equal(await readCommand(root, "ack"), false);
    await rm(join(root, "ack.control.pending"), { recursive: true });
    await mkdir(join(root, "ack.control"));
    await assert.rejects(readCommand(root, "ack"));
    const control = receive(root);
    try {
      control.receiver.resultPublished(); await control.ended;
      assert.deepEqual(control.events, ["error"]);
      await pause(30); assert.deepEqual(control.events, ["error"]);
    } finally { control.receiver.dispose(); }
  });
});

test("control deadlines bound missing commands and disposal prevents callbacks or consumption", async t => {
  await withControlRoot(async root => {
    await assert.rejects(publishCommand(root, "ack", Date.now() - 1));
    assert.deepEqual(await readdir(root), []);
    let now = 0;
    const clock = t.mock.method(Date, "now", () => now++);
    try { await assert.rejects(publishCommand(root, "ack", 1)); }
    finally { clock.mock.restore(); }
    assert.deepEqual(await readdir(root), []); // Expiry during preparation leaves no command or temporary record.
    const expired = receive(root, 30);
    try {
      expired.receiver.resultPublished(); await expired.ended;
      await pause(30); assert.deepEqual(expired.events, ["timeout"]);
    } finally { expired.receiver.dispose(); }
    const disposed = receive(root, 30);
    disposed.receiver.resultPublished(); disposed.receiver.dispose();
    await publishCommand(root, "ack", Date.now() + 1000);
    await pause(60);
    assert.deepEqual(disposed.events, []);
    assert.equal(await readCommand(root, "ack"), true);
  });
});

test("input digest includes the executable control helper using disposable input copies", async () => {
  await withControlRoot(async root => {
    const repository = fileURLToPath(new URL("../", import.meta.url));
    // Copy the supervisor's finite input set; never edit running or live inputs.
    for (const relative of ["package-lock.json", "package.json", "src/service", "src/contracts", "native/project-rename/project_rename.c", "native/project-rename/binding.gyp",
      "src/desktop/backend-controller.ts", "dist/service", "dist/desktop/backend-controller.mjs",
      `node_modules/better-sqlite3/prebuilds/${process.platform}-${process.arch}.node`,
      "scripts/smoke-project-rename.mjs", "tests/fixtures/project-rename-service-electron.cjs",
      "tests/fixtures/project-rename-native-protocol.cjs", "tests/fixtures/project-rename-service-control.cjs"]) {
      await cp(join(repository, relative), join(root, relative), { recursive: true });
    }
    const initial = await inputDigest(root);
    assert.equal(initial, await inputDigest());
    const helper = join(root, "tests/fixtures/project-rename-service-control.cjs"), bytes = await readFile(helper);
    await writeFile(helper, Buffer.concat([bytes, Buffer.from("\n// Disposable digest regression.\n")]));
    assert.notEqual(await inputDigest(root), initial);
    await writeFile(helper, bytes);
    assert.equal(await inputDigest(root), initial);
    await rm(helper);
    await assert.rejects(inputDigest(root));
  });
});

test("control publication deadline rejects a stalled callback and late completion cannot publish", async t => {
  await withControlRoot(async root => {
    const filesystem = require("node:fs/promises"), original = filesystem.lstat;
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    const pending = t.mock.method(filesystem, "lstat", async path => {
      if (path === join(root, "ack.control")) await blocked;
      return original(path);
    });
    try {
      await assert.rejects(publishCommand(root, "ack", Date.now() + 30), /deadline/);
      release();
      await pause(30);
      assert.deepEqual(await readdir(root), []);
    } finally { release(); pending.mock.restore(); }
  });
});
