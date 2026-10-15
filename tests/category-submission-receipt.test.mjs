import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { installCategorySubmissionReceipt } from "../scripts/category-submission-receipt.mjs";

const binding = { workspaceId: "workspace", projectId: "project", destinationCategoryId: "category", expectedRevision: 2 };
const id = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const sent = [], received = [], app = new EventEmitter();
  class Port extends EventEmitter {
    postMessage(value) { sent.push(value); return "forwarded"; }
    close() {}
  }
  class MessageChannelMain { port1 = new Port(); port2 = new Port(); }
  const port = new Port(), other = new Port(); port.on("message", value => received.push(value));
  const postMessage = Port.prototype.postMessage, emit = Port.prototype.emit;
  installCategorySubmissionReceipt({ MessageChannelMain, app }, binding);
  return { port, other, sent, received, app, postMessage, emit,
    request: (input = {}) => ({ id: 7, input: { type: "workspace.moveProjectCategory", ...binding, operationId: id, ...input } }),
    response: (value = {}) => ({ data: { id: 7, result: { ok: true, value: { outcome: "rejected", operation: null, problem: "category_unavailable", ...value } } } }),
    receipt: () => globalThis.categorySubmissionReceipt.snapshot(), dispose: () => globalThis.categorySubmissionReceipt.dispose() };
}

test("category observer retains the exact forwarded request/reply and keeps counting after its first reply", () => {
  const f = fixture();
  try {
    const request = f.request(), response = f.response();
    assert.equal(f.port.postMessage(request), "forwarded"); assert.equal(f.sent[0], request);
    f.other.emit("message", response); assert.equal(f.receipt().responses, 0);
    f.port.emit("message", { data: { ...response.data, id: 8 } }); assert.equal(f.receipt().responses, 0);
    f.port.emit("message", response); assert.equal(f.received.at(-1), response);
    assert.deepEqual(f.receipt(), { requests: 1, requestBindingMatches: true, operationId: id, responses: 1,
      serviceOk: true, responseShapeMatches: true, outcome: "rejected", problem: "category_unavailable", operationAbsent: true,
      observerFailed: false, expired: false });
    f.port.emit("message", f.response({ problem: "source_unavailable" })); assert.equal(f.receipt().problem, "source_unavailable");
    f.port.postMessage(request); assert.equal(f.receipt().requests, 2);
    f.port.emit("message", response); assert.equal(f.receipt().responses, 2);
    assert.notEqual(f.port.postMessage, f.postMessage);
  } finally { f.dispose(); }
  assert.equal(f.port.postMessage, f.postMessage); assert.equal(f.port.emit, f.emit);
  assert.equal(f.app.listenerCount("will-quit"), 0);
});

for (const field of ["workspaceId", "projectId", "destinationCategoryId", "expectedRevision", "extra"]) test(`category observer refuses a different request ${field}`, () => {
  const f = fixture();
  try { f.port.postMessage(f.request({ [field]: "private mismatch" })); assert.equal(f.receipt().requestBindingMatches, false); }
  finally { f.dispose(); }
});

test("category observer retains only finite malformed/error evidence and never changes forwarding", () => {
  const f = fixture();
  try {
    const malformed = { get input() { throw new Error("private diagnostic failure"); } };
    assert.equal(f.port.postMessage(malformed), "forwarded"); assert.equal(f.sent[0], malformed);
    assert.equal(f.receipt().observerFailed, true);
    f.port.postMessage(f.request({ operationId: "private invalid operation" })); assert.equal(f.receipt().operationId, null);
    f.port.emit("message", f.response({ outcome: "private outcome", problem: "private problem", operation: {} }));
    assert.equal(f.receipt().outcome, "unknown"); assert.equal(f.receipt().problem, "unknown"); assert.equal(f.receipt().operationAbsent, false);
    f.port.emit("message", f.response({ extra: "private payload" })); assert.equal(f.receipt().responseShapeMatches, false);
    assert.doesNotMatch(JSON.stringify(f.receipt()), /private/);
  } finally { f.dispose(); }
});

test("category observer expires conservatively and preserves a later wrapper on disposal", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(), prototype = Object.getPrototypeOf(f.port);
  try {
    t.mock.timers.tick(15000); assert.equal(f.receipt().expired, true);
    assert.equal(f.port.postMessage, f.postMessage); assert.equal(f.app.listenerCount("will-quit"), 0);
  } finally { f.dispose(); }
  const later = fixture(), laterPrototype = Object.getPrototypeOf(later.port);
  try {
    const previous = laterPrototype.postMessage;
    const wrapper = function (...args) { return Reflect.apply(previous, this, args); }; laterPrototype.postMessage = wrapper;
    later.app.emit("will-quit"); const completed = later.dispose(); assert.equal(laterPrototype.postMessage, wrapper);
    assert.equal(later.port.postMessage(later.request()), "forwarded");
    assert.deepEqual(later.receipt(), completed, "A later forwarding owner cannot reactivate a disposed observer");
  } finally { laterPrototype.postMessage = later.postMessage; later.dispose(); }
  assert.equal(prototype.postMessage, f.postMessage);
});
