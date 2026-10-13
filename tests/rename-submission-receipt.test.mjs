import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { installRenameSubmissionReceipt } from "../scripts/rename-submission-receipt.mjs";

function fixture() {
  const sent = [], received = [], app = new EventEmitter();
  class Port extends EventEmitter {
    postMessage(value) { sent.push(value); return "forwarded"; }
    close() {}
  }
  class MessageChannelMain { port1 = new Port(); port2 = new Port(); }
  const port = new Port(); port.on("message", value => received.push(value));
  const postMessage = Port.prototype.postMessage, emit = Port.prototype.emit;
  installRenameSubmissionReceipt({ MessageChannelMain, app }, { draft: "private draft" });
  return { port, sent, received, app, postMessage, emit,
    receipt: () => globalThis.renameSubmissionReceipt.snapshot(), dispose: () => globalThis.renameSubmissionReceipt.dispose() };
}

test("rename submission observer correlates the actual forwarded request and response without retaining names or paths", () => {
  const f = fixture();
  try {
    const request = { id: 7, input: { type: "workspace.renameProject", name: "private draft" } };
    assert.equal(f.port.postMessage(request), "forwarded"); assert.equal(f.sent[0], request);
    f.port.emit("message", { data: { id: 8, result: { ok: true, value: { outcome: "completed" } } } });
    assert.equal(f.receipt().responseSeen, false);
    const response = { data: { id: 7, result: { ok: true, value: { outcome: "unchanged", operation: {
      originalName: "private draft", name: "private draft", originalRelativePath: "/private/source" } } } } };
    f.port.emit("message", response);
    assert.equal(f.received.at(-1), response);
    assert.deepEqual(f.receipt(), { requests: 1, requestMatchesDraft: true, responseSeen: true, serviceOk: true,
      outcome: "unchanged", originalMatchesRequested: true, responseMatchesDraft: true, observerFailed: false });
    assert.equal(JSON.stringify(f.receipt()).includes("private"), false);
    assert.equal(f.port.postMessage, f.postMessage); assert.equal(f.port.emit, f.emit);
    assert.equal(Object.hasOwn(Object.getPrototypeOf(f.port), "emit"), false);
    assert.equal(f.app.listenerCount("will-quit"), 0);
  } finally { f.dispose(); }
});

test("rename submission observer distinguishes a different submitted name and preserves forwarding on observation failure", () => {
  const f = fixture();
  try {
    f.port.postMessage({ id: 1, input: { type: "workspace.renameProject", name: "other" } });
    assert.equal(f.receipt().requestMatchesDraft, false);
    const malformed = { get input() { throw new Error("private diagnostic failure"); } };
    assert.equal(f.port.postMessage(malformed), "forwarded"); assert.equal(f.sent.at(-1), malformed);
    assert.equal(f.receipt().observerFailed, true);
    f.port.emit("message", { data: { id: 1, result: { ok: false, error: { code: "storage" } } } });
    assert.equal(f.receipt().serviceOk, false); assert.equal(f.receipt().outcome, "unknown");
    assert.equal(f.receipt().responseMatchesDraft, null);
  } finally { f.dispose(); }
});

test("rename submission observer disposal preserves a later wrapper and is safe when repeated or quitting", () => {
  const f = fixture(); const prototype = Object.getPrototypeOf(f.port);
  try {
    const later = () => "later owner"; prototype.postMessage = later;
    f.app.emit("will-quit"); f.dispose();
    assert.equal(prototype.postMessage, later); assert.equal(f.port.emit, f.emit);
  } finally { prototype.postMessage = f.postMessage; f.dispose(); }
});
