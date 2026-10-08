import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BackendController } from "../dist/desktop/backend-controller.mjs";
import { startServiceProcess } from "../dist/service/entry.cjs";

class FakePort extends EventEmitter {
  sent = [];
  closed = false;
  postMessage(message) { this.sent.push(message); }
  close() { this.closed = true; }
  receive(data) { this.emit("message", { data }); }
}

class FakeChild extends EventEmitter {
  sent = [];
  killed = false;
  postMessage(message, transfer) { this.sent.push({ message, transfer }); }
  kill() { this.killed = true; return true; }
  send(message) { this.emit("message", message); }
  exit(code = 0) { this.emit("exit", code); }
}

test("service connects over its transferred port, routes settings requests, and closes cleanly", async () => {
  const parent = new EventEmitter();
  parent.sent = [];
  parent.postMessage = (message) => parent.sent.push(message);
  const port = new FakePort();
  let closed = false;
  const exitCodes = [];
  startServiceProcess(parent, () => ({
    handleQuery: (input) => input?.type === "settings.load"
      ? { ok: true, value: { language: "en" } }
      : { ok: false, error: { code: "invalid_input", message: "Bad query" } },
    handleCommand: (input) => input?.language === "ru"
      ? { ok: true, value: { language: "ru" } }
      : { ok: false, error: { code: "invalid_input", message: "Bad command" } },
    close: () => { closed = true; },
  }), (code) => exitCodes.push(code));

  parent.emit("message", { data: { type: "connect", databasePath: "/tmp/settings.sqlite" }, ports: [port] });
  assert.deepEqual(parent.sent, [{ type: "ready" }]);
  port.receive({ id: 1, input: { type: "settings.load" } });
  port.receive({ id: 2, input: { type: "settings.setLanguage", language: "ru" } });
  port.receive({ id: 3, input: { type: "unexpected" } });
  assert.deepEqual(port.sent.map((message) => message.result), [
    { ok: true, value: { language: "en" } },
    { ok: true, value: { language: "ru" } },
    { ok: false, error: { code: "invalid_input", message: "Bad command" } },
  ]);
  parent.emit("message", { data: { type: "shutdown" }, ports: [] });
  assert.equal(closed, true);
  assert.deepEqual(exitCodes, [0]);
  assert.deepEqual(parent.sent.at(-1), { type: "stopped" });
  assert.equal(port.closed, true);
});

test("desktop controller waits for readiness and routes request responses", async () => {
  const statuses = [];
  const controller = new BackendController((status) => statuses.push(status));
  const child = new FakeChild();
  const port = new FakePort();
  const ready = controller.start(child, port, "/machine-local/settings.sqlite", {}, 100);
  assert.deepEqual(child.sent[0].message, { type: "connect", databasePath: "/machine-local/settings.sqlite" });
  child.send({ type: "ready" });
  assert.equal(await ready, true);
  assert.equal(controller.currentStatus.state, "ready");

  const pending = controller.request({ type: "settings.load" });
  assert.deepEqual(port.sent[0], { id: 1, input: { type: "settings.load" } });
  port.receive({ id: 1, result: { ok: true, value: { language: "en" } } });
  assert.deepEqual(await pending, { ok: true, value: { language: "en" } });
  assert.deepEqual(statuses.map(({ state }) => state), ["starting", "ready"]);
});

test("startup errors and timeout resolve into a bounded unavailable state", async () => {
  for (const cause of ["reported", "timeout"]) {
    const controller = new BackendController();
    const child = new FakeChild();
    const ready = controller.start(child, new FakePort(), "/tmp/settings.sqlite", {}, cause === "timeout" ? 5 : 100);
    if (cause === "reported") child.send({ type: "startup-error" });
    assert.equal(await ready, false);
    assert.equal(controller.currentStatus.state, "unavailable");
    assert.match(controller.currentStatus.message, /could not start/);
  }
});

test("malformed service payloads are rejected by the settings boundary", () => {
  const parent = new EventEmitter();
  parent.sent = [];
  parent.postMessage = (message) => parent.sent.push(message);
  const port = new FakePort();
  startServiceProcess(parent, () => ({
    handleQuery: () => ({ ok: false, error: { code: "invalid_input", message: "Bad query" } }),
    handleCommand: () => ({ ok: false, error: { code: "invalid_input", message: "Bad command" } }),
    close() {},
  }));
  parent.emit("message", { data: { type: "connect", databasePath: "/tmp/settings.sqlite" }, ports: [port] });
  port.receive({ id: 1, input: null });
  port.receive({ id: 2, input: { type: "settings.setLanguage", language: "fr" } });
  assert.deepEqual(port.sent.map(({ result }) => result), [
    { ok: false, error: { code: "invalid_input", message: "Bad command" } },
    { ok: false, error: { code: "invalid_input", message: "Bad command" } },
  ]);
});

test("desktop request errors and startup process errors settle instead of hanging", async () => {
  const controller = new BackendController();
  const child = new FakeChild();
  const port = new FakePort();
  const ready = controller.start(child, port, "/tmp/settings.sqlite", {}, 100);
  child.emit("error", new Error("failed to spawn"));
  assert.equal(await ready, false);

  const readyController = new BackendController();
  const readyChild = new FakeChild();
  const readyPort = new FakePort();
  const secondReady = readyController.start(readyChild, readyPort, "/tmp/settings.sqlite", {}, 100);
  readyChild.send({ type: "ready" });
  await secondReady;
  readyPort.postMessage = () => { throw new Error("channel closed"); };
  assert.deepEqual(await readyController.request({ type: "settings.load" }), {
    ok: false,
    error: { code: "service_unavailable", message: "The local service request failed." },
  });
});

test("backend exit rejects in-flight requests and shutdown reaps the child", async () => {
  const controller = new BackendController();
  const child = new FakeChild();
  const port = new FakePort();
  const ready = controller.start(child, port, "/tmp/settings.sqlite", {}, 100);
  child.send({ type: "ready" });
  await ready;
  const request = controller.request({ type: "settings.load" });
  child.exit(1);
  assert.deepEqual(await request, {
    ok: false,
    error: { code: "service_unavailable", message: "The local service exited." },
  });
  assert.equal(controller.currentStatus.state, "unavailable");

  const stopController = new BackendController();
  const stopChild = new FakeChild();
  const stopPort = new FakePort();
  const stopReady = stopController.start(stopChild, stopPort, "/tmp/settings.sqlite", {}, 100);
  stopChild.send({ type: "ready" });
  await stopReady;
  const stopped = stopController.stop(100);
  assert.deepEqual(stopChild.sent.at(-1).message, { type: "shutdown" });
  stopChild.exit(0);
  await stopped;
  assert.equal(stopPort.closed, true);
  assert.equal(stopChild.killed, false);
});

test("renderer security settings are strict and service has no network server dependency", async () => {
  const main = await readFile(new URL("../src/desktop/main.ts", import.meta.url), "utf8");
  const backend = await readFile(new URL("../src/service/entry.ts", import.meta.url), "utf8");
  const preload = await readFile(new URL("../src/desktop/preload.ts", import.meta.url), "utf8");
  const renderer = await readFile(new URL("../src/renderer/main.tsx", import.meta.url), "utf8");
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(preload, /exposeInMainWorld\("workspace", api\)/);
  assert.doesNotMatch(preload, /require\(|process\.|node:fs|better-sqlite3/);
  assert.match(preload, /WorkspaceDesktopApi/);
  assert.doesNotMatch(renderer, /node:|better-sqlite3|from ["']electron["']/);
  assert.doesNotMatch(backend, /node:http|node:net|createServer|listen\(/);
});
