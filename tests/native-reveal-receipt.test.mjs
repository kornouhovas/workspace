import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installNativeRevealReceipt, retainNativeRevealReceipt } from "../scripts/native-reveal-receipt.mjs";
import { cleanupOwnedFixture, closeElectron } from "../scripts/runtime-lifecycle.mjs";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const dispatchId = "33333333-3333-4333-8333-333333333333";
const identity = JSON.stringify({ dev: "1", ino: "2", birthtimeNs: "3" });
const target = { canonicalRoot: "PRIVATE_PATH_SENTINEL", parentRelativePath: "", relativePath: "PRIVATE_RELATIVE_SENTINEL", rootIdentity: identity, parentIdentity: identity, nativeIdentity: identity };
const request = { id: 17, input: { type: "workspace.revealProject", workspaceId, projectId } };
const response = (value = { outcome: "dispatched", workspaceId, projectId }) => ({ id: 17, result: { ok: true, value } });
const native = (type, extra = {}) => ({ type: `project.reveal.${type}`, requestId: 17, dispatchId, ...extra });

function fixture({ unsupported = false } = {}) {
  let time = 100, scheduled, closed = 0;
  const calls = [], app = new EventEmitter();
  class Port extends EventEmitter {
    postMessage(...args) { calls.push({ receiver: this, args }); if (this.failure) throw this.failure; return this.result; }
    close() { closed++; }
  }
  class MessageChannelMain { constructor() { this.port1 = new Port(); this.port2 = new Port(); } }
  const prototype = Port.prototype, post = prototype.postMessage;
  if (unsupported) Object.defineProperty(prototype, "postMessage", { value: post, writable: false, configurable: false });
  const context = { performance: { now: () => time }, setTimeout: (callback) => { scheduled = callback; return { unref() {} }; }, clearTimeout: () => { scheduled = undefined; } };
  // This is the exact callback serialized by ElectronApplication.evaluate.
  const sandbox = { ...context, electron: { MessageChannelMain, app }, options: { workspaceId } };
  runInNewContext(`(${installNativeRevealReceipt.toString()})(electron, options)`, sandbox);
  const collector = sandbox.creationRevealReceipt;
  return { collector, port: new Port(), other: new Port(), calls, app, prototype, post,
    closed: () => closed, advance: (ms) => { time += ms; }, expire: () => scheduled(), timerActive: () => scheduled !== undefined, context: sandbox };
}
const snapshot = (f) => JSON.parse(JSON.stringify(f.collector.snapshot()));

test("serializable observer preserves receiver, arguments, transfers, result and one forwarding call", () => {
  const f = fixture(), transfer = [], result = {};
  f.port.result = result;
  assert.equal(f.port.postMessage(request, transfer), result);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].receiver, f.port);
  assert.equal(f.calls[0].args[0], request);
  assert.equal(f.calls[0].args[1], transfer);
  const event = { data: response(), ports: transfer };
  let delivered = 0;
  f.port.on("message", function (actual) { assert.equal(this, f.port); assert.equal(actual, event); delivered++; });
  assert.equal(f.port.emit("message", event), true);
  assert.equal(delivered, 1);
  assert.equal(snapshot(f).receipt.classification, "valid");
  f.collector.dispose();
  assert.equal(f.prototype.postMessage, f.post);
});

test("observer exceptions and malformed values never consume original exceptions or delivery", () => {
  const f = fixture(), exception = new Error("private transport sentinel");
  f.port.failure = exception;
  const hostile = new Proxy({}, { get() { throw new Error("private observer sentinel"); } });
  assert.throws(() => f.port.postMessage(hostile, []), (error) => error === exception);
  assert.equal(f.calls.length, 1);
  let delivered = 0;
  f.port.on("message", () => { delivered++; throw exception; });
  assert.throws(() => f.port.emit("message", { data: hostile }), (error) => error === exception);
  assert.equal(delivered, 1);
  assert.equal(JSON.stringify(snapshot(f)).includes("sentinel"), false);
  f.collector.dispose();
});

test("dispatched native protocol and service receipt retain only bounded classifications", () => {
  const f = fixture();
  f.port.postMessage(request);
  f.port.emit("message", { data: native("native", { target }) });
  f.port.postMessage(native("verify"));
  f.port.emit("message", { data: native("verified", { result: { outcome: "verified" } }) });
  f.advance(12);
  f.port.postMessage(native("reply", { result: { outcome: "dispatched" } }));
  f.port.emit("message", { data: response() });
  const captured = snapshot(f);
  assert.equal(captured.nativeBoundaryLatencyMs, 12);
  assert.equal(captured.receipt.workspaceMatched, true);
  assert.equal(captured.receipt.projectMatched, true);
  assert.equal(captured.pending, false);
  for (const privateValue of [workspaceId, projectId, dispatchId, "PRIVATE_PATH_SENTINEL", "PRIVATE_IDENTITY_SENTINEL"]) assert.equal(JSON.stringify(captured).includes(privateValue), false);
  f.collector.dispose();
});

test("foreign ports, wrong request/dispatch IDs, duplicate and stale responses cannot classify a receipt", () => {
  const f = fixture();
  f.port.postMessage(request);
  f.other.emit("message", { data: response() });
  f.port.emit("message", { data: { ...response(), id: 18 } });
  f.port.emit("message", { data: native("native", { target }) });
  f.other.postMessage(native("reply", { result: { outcome: "dispatched" } }));
  f.port.postMessage(native("reply", { dispatchId: workspaceId, result: { outcome: "dispatched" } }));
  assert.equal(snapshot(f).receipt.classification, "missing");
  assert.equal(snapshot(f).nativeBoundaryLatencyMs, "unknown");
  f.port.emit("message", { data: response() });
  const settled = snapshot(f);
  f.port.emit("message", { data: response({ outcome: "rejected", problem: "native_error", workspaceId, projectId }) });
  assert.deepEqual(snapshot(f), settled);
  f.collector.dispose();
});

test("bounded snapshot and persistence failures preserve primary failure and permit cleanup", async () => {
  for (const kind of ["timeout", "unavailable", "persistence"]) {
    const primary = new Error("strict acknowledgment failure"), observations = [];
    let cleanup = 0, thrown;
    try {
      try { throw primary; }
      catch (error) {
        await retainNativeRevealReceipt({
          electron: kind === "unavailable" ? undefined : { evaluate: () => kind === "timeout" ? new Promise(() => {}) : Promise.resolve({ supported: true, state: "settled" }) },
          retain: (value) => observations.push(value),
          persist: async () => { if (kind === "persistence") throw new Error("PRIVATE_WRITE_SENTINEL"); },
          primaryFailure: error, timeoutMs: 5,
        });
        throw error;
      }
    } catch (error) { thrown = error; }
    finally { cleanup++; }
    assert.equal(thrown, primary);
    assert.equal(cleanup, 1);
    assert.equal(observations.length, 1);
    assert.equal(JSON.stringify(observations).includes("PRIVATE_WRITE_SENTINEL"), false);
  }
});

test("a stalled evidence write is bounded, preserves primary failure and reaches cleanup", async () => {
  for (const primaryFailure of [new Error("original acknowledgment failure"), undefined]) {
    let cleanup = false, accepted = false, failure, watchdog;
    const observations = [];
    const attempt = (async () => {
      try {
        await retainNativeRevealReceipt({
          electron: { evaluate: async () => ({ supported: true, state: "settled" }) },
          retain: (value) => observations.push(value), persist: () => new Promise(() => {}), primaryFailure, timeoutMs: 5,
        });
        if (primaryFailure) throw primaryFailure;
        accepted = true;
      } catch (error) { failure = error; }
      finally { cleanup = true; }
    })();
    try {
      const result = await Promise.race([attempt.then(() => "finished"), new Promise((resolve) => { watchdog = setTimeout(() => resolve("stalled"), 200); })]);
      assert.equal(result, "finished");
      assert.equal(cleanup, true);
      assert.equal(accepted, false);
      assert.equal(observations.length, 1);
      if (primaryFailure) assert.equal(failure, primaryFailure);
      else assert.match(failure.message, /Native receipt persistence timed out/);
    } finally { clearTimeout(watchdog); }
  }
});

const problems = ["unconfigured", "mode_retained", "excluded", "missing", "replaced", "unresolved", "root_unavailable", "root_replaced", "category_unavailable", "unavailable", "native_unavailable", "native_error", "request_expired"];
for (const problem of problems) test(`original rejected receipt retains ${problem} without private fields`, () => {
  const f = fixture();
  f.port.postMessage(request);
  f.port.emit("message", { data: native("native", { target }) });
  f.port.postMessage(native("reply", { result: { outcome: "rejected", problem } }));
  f.port.emit("message", { data: response({ workspaceId, projectId, outcome: "rejected", problem }) });
  assert.equal(snapshot(f).receipt.classification, "valid");
  assert.equal(snapshot(f).receipt.problem, problem);
  assert.equal(snapshot(f).records.find((entry) => entry.boundary === "project.reveal.reply").problem, problem);
  assert.equal(f.timerActive(), false);
  f.collector.dispose();
});

for (const code of ["invalid_input", "filesystem", "storage", "service_unavailable", "stale_preview"]) test(`ok:false records only allowlisted ${code}`, () => {
  const f = fixture();
  f.port.postMessage(request);
  f.port.emit("message", { data: { id: 17, result: { ok: false, error: { code, message: "PRIVATE_ERROR_SENTINEL" } } } });
  const captured = snapshot(f);
  assert.equal(captured.receipt.serviceOk, false);
  assert.equal(captured.receipt.errorCode, code);
  assert.equal(captured.receipt.classification, "valid");
  assert.equal(captured.receipt.workspaceMatched, "unknown");
  assert.equal(JSON.stringify(captured).includes("PRIVATE_ERROR_SENTINEL"), false);
  f.collector.dispose();
});

for (const [name, message, classification, serviceOk] of [
  ["missing result", { id: 17 }, "malformed", "unknown"],
  ["missing ok", { id: 17, result: {} }, "unknown", "unknown"],
  ["unknown ok", { id: 17, result: { ok: "PRIVATE_OK_SENTINEL" } }, "unknown", "unknown"],
  ["unknown outcome", response({ workspaceId, projectId, outcome: "PRIVATE_OUTCOME_SENTINEL" }), "unknown", true],
  ["unknown problem", response({ workspaceId, projectId, outcome: "rejected", problem: "PRIVATE_PROBLEM_SENTINEL" }), "unknown", true],
  ["unknown error code", { id: 17, result: { ok: false, error: { code: "PRIVATE_CODE_SENTINEL", message: "PRIVATE_MESSAGE_SENTINEL" } } }, "unknown", false],
  ["missing error", { id: 17, result: { ok: false } }, "unknown", false],
  ["missing value", { id: 17, result: { ok: true } }, "malformed", true],
  ["missing binding", response({ outcome: "dispatched" }), "invalid_binding", true],
  ["wrong workspace", response({ outcome: "dispatched", workspaceId: dispatchId, projectId }), "invalid_binding", true],
  ["wrong project", response({ outcome: "dispatched", workspaceId, projectId: dispatchId }), "invalid_binding", true],
  ["extra envelope", { ...response(), privateField: "PRIVATE_EXTRA_SENTINEL" }, "malformed", true],
  ["extra result", { id: 17, result: { ...response().result, privateField: "PRIVATE_EXTRA_SENTINEL" } }, "malformed", true],
  ["extra value", response({ workspaceId, projectId, outcome: "dispatched", privateField: "PRIVATE_EXTRA_SENTINEL" }), "malformed", true],
]) test(`${name} is explicit and never a valid receipt`, () => {
  const f = fixture();
  f.port.postMessage(request);
  f.port.emit("message", { data: message });
  const captured = snapshot(f);
  assert.equal(captured.receipt.classification, classification);
  assert.equal(captured.receipt.serviceOk, serviceOk);
  assert.equal(JSON.stringify(captured).includes("PRIVATE_"), false);
  f.collector.dispose();
});

test("malformed service envelopes keep correlation until an accepted original response", () => {
  const f = fixture();
  f.port.postMessage(request);
  f.port.emit("message", { data: { ...response(), extra: true } });
  assert.equal(snapshot(f).pending, true);
  f.port.emit("message", { data: response() });
  assert.equal(snapshot(f).receipt.classification, "valid");
  assert.equal(snapshot(f).pending, false);
});

test("accepted receipts never inherit classifications from ignored malformed responses", () => {
  const rejected = { id: 17, result: { ok: false, error: { code: "filesystem", message: "PRIVATE_ERROR_SENTINEL" } } };
  for (const [ignored, accepted, expected] of [
    [{ ...response({ workspaceId, projectId, outcome: "rejected", problem: "native_error" }), extra: true }, rejected,
      { classification: "valid", serviceOk: false, outcome: "unknown", problem: "unknown", errorCode: "filesystem", workspaceMatched: "unknown", projectMatched: "unknown" }],
    [{ ...rejected, extra: true }, response(),
      { classification: "valid", serviceOk: true, outcome: "dispatched", problem: "unknown", errorCode: "unknown", workspaceMatched: true, projectMatched: true }],
  ]) {
    const f = fixture(); f.port.postMessage(request);
    f.port.emit("message", { data: ignored });
    assert.equal(snapshot(f).pending, true);
    f.port.emit("message", { data: accepted });
    const captured = snapshot(f);
    assert.deepEqual(captured.receipt, expected);
    assert.equal(captured.pending, false);
    assert.deepEqual(captured.records.at(-1), { boundary: "service_response", atMs: 0, ...expected });
    assert.equal(JSON.stringify(captured).includes("PRIVATE_ERROR_SENTINEL"), false);
  }
});

test("one pending request and 64 records; duplicates never rebind or create a second intent", () => {
  const f = fixture();
  assert.equal(f.collector.arm(workspaceId), false);
  f.port.postMessage(request);
  for (let n = 0; n < 100; n++) f.other.postMessage({ ...request, id: n + 18 });
  const captured = snapshot(f);
  assert.equal(captured.records.length, 64);
  assert.equal(captured.truncated, true);
  assert.equal(captured.pending, true);
  assert.equal(captured.records.filter((entry) => entry.boundary === "request").length, 1);
  f.port.emit("message", { data: response() });
  assert.equal(snapshot(f).receipt.classification, "valid");
  assert.equal(snapshot(f).pending, false);
});

test("monotonic bounded relative timing and expiry restore wrappers and discard private correlation", () => {
  const f = fixture();
  assert.equal(f.closed(), 2);
  f.port.postMessage(request);
  f.advance(20);
  f.port.emit("message", { data: native("native", { target }) });
  f.advance(-10);
  f.port.postMessage(native("verify"));
  f.advance(59990);
  const expired = snapshot(f);
  assert.equal(expired.state, "expired");
  assert.equal(expired.receipt.classification, "missing");
  assert.equal(expired.pending, false);
  assert.equal(expired.records.at(-1).atMs, 60000);
  assert.equal(expired.records.every((entry, index, rows) => entry.atMs >= 0 && entry.atMs <= 60000 && (index === 0 || entry.atMs >= rows[index - 1].atMs)), true);
  assert.equal(f.prototype.postMessage, f.post);
  assert.equal(f.timerActive(), false);
  f.port.emit("message", { data: response() });
  assert.deepEqual(snapshot(f), expired);
  assert.equal(f.collector.arm(workspaceId), false);
});

test("timer expiry, port close, disposal and app termination release bindings and listeners", () => {
  for (const end of ["timer", "port", "dispose", "quit"]) {
    const f = fixture(); f.port.postMessage(request);
    if (end === "timer") { f.advance(60000); f.expire(); }
    if (end === "port") f.port.emit("close");
    if (end === "dispose") f.collector.dispose();
    if (end === "quit") f.app.emit("will-quit");
    assert.equal(snapshot(f).pending, false);
    assert.equal(f.timerActive(), false);
    assert.equal(f.app.listenerCount("will-quit"), 0);
    assert.equal(f.prototype.postMessage, f.post);
    assert.equal(Object.hasOwn(f.prototype, "emit"), false);
  }
});

test("unsupported methods are explicit, inspection ports close and forwarding remains original", () => {
  const f = fixture({ unsupported: true });
  assert.equal(snapshot(f).supported, false);
  assert.equal(snapshot(f).state, "unsupported");
  assert.equal(f.closed(), 2);
  f.port.postMessage(request);
  assert.equal(f.calls.length, 1);
  assert.equal(f.prototype.postMessage, f.post);
});

test("safe restoration preserves later owned wrappers and installer refuses a second collector", () => {
  const f = fixture(), later = function () {};
  f.prototype.postMessage = later;
  f.collector.dispose();
  assert.equal(f.prototype.postMessage, later);
  runInNewContext(`(${installNativeRevealReceipt.toString()})(electron, options)`, f.context);
  assert.equal(f.context.creationRevealReceipt, f.collector);
  assert.equal(f.closed(), 2);
});

test("collection/persistence failure cannot produce normal successful acknowledgment evidence", async () => {
  for (const [electron, persist] of [
    [undefined, async () => {}],
    [{ evaluate: async () => ({ supported: false, state: "unsupported" }) }, async () => {}],
    [{ evaluate: () => new Promise(() => {}) }, async () => {}],
    [{ evaluate: async () => ({ supported: true, state: "settled" }) }, async () => { throw new Error("write failure"); }],
  ]) {
    let acknowledgment = false, cleanup = false;
    try {
      await retainNativeRevealReceipt({ electron, retain: () => {}, persist, timeoutMs: 5 });
      acknowledgment = true;
    } catch { /* Controlled failure. */ }
    finally { cleanup = true; }
    assert.equal(acknowledgment, false);
    assert.equal(cleanup, true);
  }
});

test("failed receipt evidence preserves the primary error through strict app and owned fixture cleanup", async () => {
  for (const kind of ["collection", "persistence"]) {
    const primary = new Error("original strict acknowledgment failure"), folder = await mkdtemp(join(tmpdir(), "native-receipt-control-"));
    const calls = [];
    const electron = {
      evaluate: async () => { calls.push("collection"); if (kind === "collection") throw new Error("private inspector text"); return { supported: true, state: "settled" }; },
      process: () => ({ exitCode: 0, signalCode: null }),
      close: async () => { calls.push("normal_close"); },
    };
    await retainNativeRevealReceipt({ electron, retain: () => {}, persist: async () => { if (kind === "persistence") throw new Error("private write text"); }, primaryFailure: primary });
    // Exercise the unchanged strict cleanup helpers used by the driver, including
    // a failed final evidence write after the disposable tree was removed.
    await closeElectron(electron);
    await assert.rejects(cleanupOwnedFixture(folder, { processesStopped: true, primaryFailure: primary, record: async () => { calls.push("cleanup_evidence"); throw new Error("private cleanup write text"); } }), (error) => error === primary);
    assert.ok(calls.includes("normal_close"));
    assert.ok(calls.includes("cleanup_evidence"));
    await assert.rejects(stat(folder), { code: "ENOENT" });
  }
});

test("malformed native messages, duplicate native dispatches and opposite directions cannot supply latency", () => {
  const f = fixture(); f.port.postMessage(request);
  f.port.emit("message", { data: native("native", { target: {} }) });
  f.port.postMessage(native("native", { target }));
  f.port.postMessage(native("reply", { result: { outcome: "dispatched" } }));
  assert.equal(snapshot(f).nativeBoundaryLatencyMs, "unknown");
  f.port.emit("message", { data: native("native", { target }) });
  f.port.emit("message", { data: native("native", { target, dispatchId: workspaceId }) });
  f.port.emit("message", { data: native("reply", { result: { outcome: "dispatched" } }) });
  assert.equal(snapshot(f).nativeBoundaryLatencyMs, "unknown");
  f.advance(7);
  f.port.postMessage(native("reply", { result: { outcome: "PRIVATE_OUTCOME_SENTINEL" } }));
  f.advance(9);
  f.port.postMessage(native("reply", { result: { outcome: "dispatched" } }));
  assert.equal(snapshot(f).nativeBoundaryLatencyMs, 7);
  assert.equal(snapshot(f).records.find((entry) => entry.boundary === "project.reveal.reply").classification, "unknown");
  assert.equal(JSON.stringify(snapshot(f)).includes("PRIVATE_OUTCOME_SENTINEL"), false);
  f.collector.dispose();
});

test("invalid requests never consume the armed intent and observer clock failure still permits forwarding and disposal", () => {
  const f = fixture();
  for (const message of [null, [], { ...request, id: -1 }, { ...request, id: Number.MAX_SAFE_INTEGER + 1 }, { id: 17, input: { ...request.input, projectId: "private-invalid-id" } }, { id: 17, input: { ...request.input, workspaceId: dispatchId } }]) f.port.postMessage(message);
  assert.equal(snapshot(f).pending, false);
  f.port.postMessage(request);
  assert.equal(snapshot(f).pending, true);
  f.context.performance.now = () => { throw new Error("private clock text"); };
  f.port.result = "original result";
  assert.equal(f.port.postMessage({ unrelated: true }), "original result");
  f.collector.dispose();
  assert.equal(snapshot(f).pending, false);
  assert.equal(snapshot(f).observerFailed, true);
  assert.equal(f.prototype.postMessage, f.post);
  assert.equal(f.timerActive(), false);
});

for(const provider of ['apfs','ntfs'])test(`${provider}: serializable receipt recognizes private durable folder authorization without retaining its values`,()=>{
 const f=fixture(),evidence={version:1,provider,scope:'PRIVATE_SCOPE_SENTINEL',volume:provider==='apfs'?'11111111111111111111111111111111':'\\\\?\\Volume{11111111-1111-4111-8111-111111111111}\\',serial:provider==='apfs'?'':'123',fileId:provider==='apfs'?'2':'11111111111111111111111111111111',created:'3'};
 const authorization={version:1,generation:4,folders:[{relativePath:'',evidence,mount:JSON.parse(identity)},{relativePath:target.relativePath,evidence:{...evidence,fileId:provider==='apfs'?'4':'22222222222222222222222222222222'},mount:JSON.parse(identity)}]};
 f.port.postMessage(request);f.port.emit('message',{data:native('native',{target:{...target,authorization}})});f.advance(8);f.port.postMessage(native('reply',{result:{outcome:'dispatched'}}));f.port.emit('message',{data:response()});
 const captured=snapshot(f);assert.equal(captured.nativeBoundaryLatencyMs,8);assert.equal(captured.records.some(record=>record.boundary==='native_malformed'),false);assert.equal(JSON.stringify(captured).includes('PRIVATE_SCOPE_SENTINEL'),false);f.collector.dispose();
});
