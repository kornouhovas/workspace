import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { BackendController } from "../dist/desktop/backend-controller.mjs";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.ts";
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

test("real service IPC removes only configurations and rejects malformed and stale removal without false success", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-remove-ipc-"));
  const root = join(directory, "root");
  const otherRoot = join(directory, "other");
  await mkdir(root);
  await mkdir(otherRoot);
  await writeFile(join(root, "keep.txt"), "shared bytes");
  await writeFile(join(otherRoot, "keep.txt"), "other bytes");
  const parent = new EventEmitter();
  parent.postMessage = () => {};
  const port = new FakePort();
  startServiceProcess(parent);
  try {
    parent.emit("message", { data: { type: "connect", databasePath: join(directory, "workspace.sqlite") }, ports: [port] });
    let id = 0;
    const request = (input) => {
      port.receive({ id: ++id, input });
      assert.equal(port.sent.at(-1).id, id);
      return port.sent.at(-1).result;
    };
    const one = request({ type: "workspace.create", name: "One", rootPath: root }).value;
    const sibling = request({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const other = request({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
    const before = request({ type: "workspace.load" });
    for (const input of [{ type: "workspace.remove" },
      { type: "workspace.remove", workspaceId: one.workspaceId, extra: true },
      { type: "workspace.remove", workspaceId: 42 },
      { type: "workspace.remove", workspaceId: "bad-id" },
      { type: "workspace.remove", workspaceId: "00000000-0000-4000-8000-000000000000" },
    ]) {
      assert.equal(request(input).error.code, "invalid_input");
      assert.deepEqual(request({ type: "workspace.load" }), before);
    }
    const inactive = request({ type: "workspace.remove", workspaceId: one.workspaceId });
    assert.equal(inactive.ok, true);
    assert.equal(inactive.value.activeWorkspace.workspaceId, other.workspaceId);
    assert.deepEqual(inactive.value.workspaces.map((row) => row.workspaceId), [sibling.workspaceId, other.workspaceId]);
    assert.equal(request({ type: "workspace.remove", workspaceId: one.workspaceId }).error.code, "invalid_input");
    assert.deepEqual(request({ type: "workspace.load" }), inactive);
    const active = request({ type: "workspace.remove", workspaceId: other.workspaceId });
    assert.equal(active.ok, true);
    assert.equal(active.value.activeWorkspace.workspaceId, sibling.workspaceId);
    assert.equal(active.value.activeWorkspace.viewId, sibling.viewId);
    assert.deepEqual(request({ type: "workspace.remove", workspaceId: sibling.workspaceId }), { ok: true, value: { workspaces: [], activeWorkspace: null } });
    const recreated = request({ type: "workspace.create", name: "Recreated", rootPath: root }).value;
    assert.equal(recreated.sourceId, one.sourceId);
    assert.notEqual(recreated.viewId, one.viewId);
    assert.equal(await readFile(join(root, "keep.txt"), "utf8"), "shared bytes");
    assert.equal(await readFile(join(otherRoot, "keep.txt"), "utf8"), "other bytes");
  } finally {
    parent.emit("message", { data: { type: "shutdown" }, ports: [] });
    await rm(directory, { recursive: true, force: true });
  }
});

test("service connects over its transferred port, routes settings requests, and closes cleanly", async () => {
  const parent = new EventEmitter();
  parent.sent = [];
  parent.postMessage = (message) => parent.sent.push(message);
  const port = new FakePort();
  let closed = false;
  const exitCodes = [];
  startServiceProcess(parent, () => ({
    workspaces: { subscribe: () => () => {} },
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

test("service routes typed workspace requests and rejects malformed workspace payloads", () => {
  const parent = new EventEmitter();
  parent.sent = [];
  parent.postMessage = (message) => parent.sent.push(message);
  const port = new FakePort();
  const routed = [];
  startServiceProcess(parent, () => ({
    workspaces: { subscribe: () => () => {} },
    handleQuery: (input) => {
      routed.push(["query", input]);
      return { ok: true, value: { workspaces: [], activeWorkspace: null } };
    },
    handleCommand: (input) => {
      routed.push(["command", input]);
      return { ok: true, value: { workspaceId: "workspace-id" } };
    },
    close() {},
  }));
  parent.emit("message", { data: { type: "connect", databasePath: "/tmp/settings.sqlite" }, ports: [port] });
  port.receive({ id: 1, input: { type: "workspace.load" } });
  port.receive({ id: 2, input: { type: "workspace.create", name: "A", rootPath: "/tmp/a" } });
  port.receive({ id: 3, input: { type: "workspace.activate", workspaceId: 42 } });
  port.receive({ id: 4, input: { type: "workspace.unknown" } });
  assert.deepEqual(routed, [
    ["query", { type: "workspace.load" }],
    ["command", { type: "workspace.create", name: "A", rootPath: "/tmp/a" }],
  ]);
  assert.deepEqual(port.sent[2].result, {
    ok: false,
    error: { code: "invalid_input", message: "The workspace request is invalid." },
  });
  assert.deepEqual(port.sent[3].result, {
    ok: false,
    error: { code: "invalid_input", message: "The workspace request is invalid." },
  });
});

test("malformed request discriminators leave the service connection usable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const parent = new EventEmitter();
  parent.postMessage = () => {};
  const port = new FakePort();
  startServiceProcess(parent);
  try {
    parent.emit("message", { data: { type: "connect", databasePath: join(directory, "workspace.sqlite") }, ports: [port] });
    const malformed = structuredClone({ id: 1, input: { type: { toString: null, valueOf: null } } });
    assert.doesNotThrow(() => port.receive(malformed));
    assert.equal(port.sent[0].id, 1);
    assert.equal(port.sent[0].result.ok, false);
    assert.equal(port.sent[0].result.error.code, "invalid_input");

    port.receive({ id: 2, input: { type: "workspace.load" } });
    assert.deepEqual(port.sent[1], {
      id: 2, result: { ok: true, value: { workspaces: [], activeWorkspace: null } },
    });
    port.receive({ id: 3, input: { type: "settings.load" } });
    assert.deepEqual(port.sent[2], { id: 3, result: { ok: true, value: { language: "en" } } });
  } finally {
    parent.emit("message", { data: { type: "shutdown" }, ports: [] });
    await rm(directory, { recursive: true, force: true });
  }
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
    child.exit(1);
    assert.match(controller.currentStatus.message, /could not start/);
    child.send({ type: "ready" });
    assert.equal(controller.currentStatus.state, "unavailable");
  }
});

test("synchronous backend launch failures produce a visible unavailable state", () => {
  const controller = new BackendController();
  controller.markStartupFailure();
  assert.equal(controller.currentStatus.state, "unavailable");
  assert.match(controller.currentStatus.message, /could not start/);
});

test("malformed service payloads are rejected by the settings boundary", () => {
  const parent = new EventEmitter();
  parent.sent = [];
  parent.postMessage = (message) => parent.sent.push(message);
  const port = new FakePort();
  const routed = [];
  startServiceProcess(parent, () => ({
    workspaces: { subscribe: () => () => {} },
    handleQuery: (input) => { routed.push(["query", input]); return { ok: false, error: { code: "invalid_input", message: "Bad query" } }; },
    handleCommand: (input) => { routed.push(["command", input]); return { ok: false, error: { code: "invalid_input", message: "Bad command" } }; },
    close() {},
  }));
  parent.emit("message", { data: { type: "connect", databasePath: "/tmp/settings.sqlite" }, ports: [port] });
  port.receive({ id: 1, input: null });
  port.receive({ id: 2, input: { type: "settings.setLanguage", language: "fr" } });
  port.receive({ id: "invalid", input: { type: "settings.load" } });
  assert.deepEqual(routed, [
    ["command", null],
    ["command", { type: "settings.setLanguage", language: "fr" }],
  ]);
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
  assert.match(preload, /workspace:command/);
  assert.match(preload, /workspace:pick-root/);
  assert.doesNotMatch(renderer, /node:|better-sqlite3|from ["']electron["']/);
  assert.doesNotMatch(backend, /node:http|node:net|createServer|listen\(/);
});


test("real service IPC renames shared and separate roots and rejects malformed or stale requests", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-rename-ipc-"));
  const root = join(directory, "root");
  const otherRoot = join(directory, "other");
  await mkdir(root);
  await mkdir(otherRoot);
  const parent = new EventEmitter();
  parent.postMessage = () => {};
  const port = new FakePort();
  startServiceProcess(parent);
  try {
    parent.emit("message", { data: { type: "connect", databasePath: join(directory, "data", "workspace.sqlite") }, ports: [port] });
    let id = 0;
    const request = (input) => {
      port.receive({ id: ++id, input });
      assert.equal(port.sent.at(-1).id, id);
      return port.sent.at(-1).result;
    };
    const one = request({ type: "workspace.create", name: "One", rootPath: root }).value;
    const sibling = request({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const other = request({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
    assert.equal(one.sourceId, sibling.sourceId);
    assert.notEqual(one.sourceId, other.sourceId);
    assert.equal(request({ type: "workspace.rename", workspaceId: one.workspaceId, name: "  Inactive  " }).ok, true);
    const renamed = request({ type: "workspace.rename", workspaceId: other.workspaceId, name: "Active" });
    assert.equal(renamed.ok, true);
    assert.equal(renamed.value.activeWorkspace.name, "Active");
    assert.equal(renamed.value.activeWorkspace.viewId, other.viewId);
    assert.deepEqual(renamed.value.workspaces.map(({ name }) => name), ["  Inactive  ", "Sibling", "Active"]);
    for (const input of [
      { type: "workspace.rename", workspaceId: one.workspaceId, name: "Wrong", extra: true },
      { type: "workspace.rename", workspaceId: one.workspaceId },
      { type: "workspace.rename", workspaceId: 42, name: "Wrong" },
      { type: "workspace.rename", workspaceId: one.workspaceId, name: null },
      { type: "workspace.rename", workspaceId: "bad-id", name: "Wrong" },
      { type: "workspace.rename", workspaceId: "00000000-0000-4000-8000-000000000000", name: "Wrong" },
      { type: "workspace.rename", workspaceId: one.workspaceId, name: "   " },
    ]) {
      const result = request(input);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "invalid_input");
      assert.deepEqual(request({ type: "workspace.load" }), renamed);
    }
  } finally {
    parent.emit("message", { data: { type: "shutdown" }, ports: [] });
    await rm(directory, { recursive: true, force: true });
  }
});

test("real service IPC reorders saved configurations and rejects invalid permutations without changing selection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-reorder-ipc-"));
  const root = join(directory, "root");
  await mkdir(root);
  const parent = new EventEmitter();
  parent.postMessage = () => {};
  const port = new FakePort();
  startServiceProcess(parent);
  try {
    parent.emit("message", { data: { type: "connect", databasePath: join(directory, "workspace.sqlite") }, ports: [port] });
    let id = 0;
    const request = (input) => {
      port.receive({ id: ++id, input });
      assert.equal(port.sent.at(-1).id, id);
      return port.sent.at(-1).result;
    };
    const one = request({ type: "workspace.create", name: "One", rootPath: root }).value;
    const two = request({ type: "workspace.create", name: "Two", rootPath: root }).value;
    const valid = { type: "workspace.reorder", workspaceIds: [two.workspaceId, one.workspaceId] };
    const reordered = request(valid);
    assert.equal(reordered.ok, true);
    assert.deepEqual(reordered.value.workspaces.map((row) => row.workspaceId), valid.workspaceIds);
    assert.equal(reordered.value.activeWorkspace.workspaceId, two.workspaceId);
    assert.equal(reordered.value.activeWorkspace.viewId, two.viewId);
    for (const input of [{ ...valid, extra: true }, { type: valid.type },
      { ...valid, workspaceIds: null }, { ...valid, workspaceIds: [42] },
      { ...valid, workspaceIds: ["bad-id", one.workspaceId] },
      { ...valid, workspaceIds: [one.workspaceId, one.workspaceId] },
      { ...valid, workspaceIds: [one.workspaceId] },
      { ...valid, workspaceIds: [one.workspaceId, "00000000-0000-4000-8000-000000000000"] },
    ]) {
      assert.equal(request(input).error.code, "invalid_input");
      assert.deepEqual(request({ type: "workspace.load" }), reordered);
    }
  } finally {
    parent.emit("message", { data: { type: "shutdown" }, ports: [] });
    await rm(directory, { recursive: true, force: true });
  }
});

test("real service ports interleave committed source events with requests, fan out and shut down subscriptions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-events-ipc-"));
  const root = join(directory, "root");
  const otherRoot = join(directory, "other");
  await mkdir(root);
  await mkdir(otherRoot);
  const parent = new EventEmitter();
  const child = new FakeChild();
  const servicePort = new FakePort();
  const desktopPort = new FakePort();
  servicePort.postMessage = (message) => { servicePort.sent.push(message); desktopPort.receive(message); };
  desktopPort.postMessage = (message) => { desktopPort.sent.push(message); servicePort.receive(message); };
  parent.postMessage = (message) => child.send(message);
  child.postMessage = (data) => parent.emit("message", { data, ports: [servicePort] });
  startServiceProcess(parent, undefined, () => child.exit());
  const controller = new BackendController();
  const changes = [];
  const unsubscribe = controller.onWorkspaceChange((change) => changes.push(change));
  try {
    assert.equal(await controller.start(child, desktopPort, join(directory, "workspace.sqlite"), {}, 100), true);
    const one = (await controller.request({ type: "workspace.create", name: "One", rootPath: root })).value;
    const two = (await controller.request({ type: "workspace.create", name: "Two", rootPath: root })).value;
    const other = (await controller.request({ type: "workspace.create", name: "Other", rootPath: otherRoot })).value;
    assert.equal(changes.filter((event) => event.type === "workspace.listChanged").length, 3);
    changes.length = 0;
    await rm(root, { recursive: true });
    const refresh = { type: "workspace.refreshSource", workspaceId: one.workspaceId };
    const unavailable = await controller.request(refresh);
    assert.equal(unavailable.ok, true);
    assert.deepEqual(changes, [{ type: "workspace.sourceChanged", source: unavailable.value }]);
    assert.deepEqual(unavailable.value.workspaceIds, [one.workspaceId, two.workspaceId]);
    assert.equal(unavailable.value.workspaceIds.includes(other.workspaceId), false);
    await controller.request(refresh);
    assert.equal(changes.length, 1);
    const before = changes.length;
    for (const input of [{ ...refresh, extra: true }, { type: "workspace.refreshSource" }, { ...refresh, workspaceId: "bad" }]) {
      assert.equal((await controller.request(input)).error.code, "invalid_input");
    }
    assert.equal(changes.length, before);
    await mkdir(root);
    assert.equal((await controller.request(refresh)).value.sourceAvailable, true);
    assert.equal(changes.at(-1).source.sourceAvailable, true);

    // An event must never resolve a pending request, even with an injected request ID.
    const pending = controller.request({ type: "settings.load" });
    desktopPort.receive({ type: "workspace.change", id: 999, change: changes.at(-1) });
    desktopPort.receive({ type: "workspace.change", change: { type: "workspace.sourceChanged", source: { sourceId: 42 } } });
    assert.equal(changes.length, 2);
    assert.deepEqual(await pending, { ok: true, value: { language: "en" } });
    unsubscribe();
    await rm(root, { recursive: true });
    await controller.request(refresh);
    assert.equal(changes.length, 2);
    await controller.stop(100);
    assert.equal(servicePort.closed && desktopPort.closed, true);
    const count = servicePort.sent.length;
    servicePort.receive({ id: 900, input: refresh });
    assert.equal(servicePort.sent.length, count);
  } finally {
    parent.emit("message", { data: { type: "shutdown" }, ports: [] });
    await rm(directory, { recursive: true, force: true });
  }
});

test("controller treats valid events separately from pending responses and removes subscriptions on exit", async () => {
  const controller = new BackendController();
  const child = new FakeChild();
  const port = new FakePort();
  const events = [];
  controller.onWorkspaceChange((event) => events.push(event));
  const ready = controller.start(child, port, "/tmp/events.sqlite", {}, 100);
  child.send({ type: "ready" });
  await ready;
  let completed = false;
  const response = controller.request({ type: "workspace.load" }).then((result) => { completed = true; return result; });
  const envelope = { type: "workspace.change", change: {
    type: "workspace.listChanged", snapshot: { workspaces: [], activeWorkspace: null },
  } };
  port.receive(envelope);
  port.receive({ ...envelope, id: 1 });
  port.receive({ type: "workspace.change", id: 1, result: { ok: true, value: {} } });
  port.receive({ type: "workspace.change", change: { type: "workspace.listChanged", snapshot: { workspaces: [], activeWorkspace: {} } } });
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(events.length, 1);
  port.receive({ id: 1, result: { ok: true, value: { workspaces: [], activeWorkspace: null } } });
  assert.equal((await response).ok, true);
  child.exit();
  port.receive(envelope);
  assert.equal(events.length, 1);
});

test("compiled preload validates project/source/list events, exposes no IPC objects and tears subscriptions down", async () => {
  const preload = await readFile(new URL("../dist/desktop/preload.cjs", import.meta.url), "utf8");
  const ipc = new EventEmitter();
  ipc.invoke = async () => ({ ok: true });
  const unload = new EventTarget();
  let api;
  runInNewContext(preload, {
    require: (name) => {
      assert.equal(name, "electron");
      return { ipcRenderer: ipc, contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } } };
    },
    window: unload,
  });
  const events = [];
  const unsubscribe = api.onWorkspaceChange((event) => events.push(event));
  const event = { type: "workspace.listChanged", snapshot: { workspaces: [], activeWorkspace: null } };
  ipc.emit("workspace:change", { sender: "privileged" }, event);
  ipc.emit("workspace:change", {}, { ...event, extra: true });
  ipc.emit("workspace:change", {}, { type: "workspace.sourceChanged", source: { sourceId: 42 } });
  const projectEvent = { type: "workspace.projectsChanged", sourceId: "00000000-0000-4000-8000-000000000001",
    workspaceIds: ["00000000-0000-4000-8000-000000000002"], revision: 3 };
  ipc.emit("workspace:change", {}, projectEvent);
  for (const malformed of [{ ...projectEvent, extra: true }, { ...projectEvent, revision: -1 },
    { ...projectEvent, revision: 1.5 }, { ...projectEvent, revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...projectEvent, workspaceIds: [] }, { ...projectEvent, workspaceIds: [...projectEvent.workspaceIds, ...projectEvent.workspaceIds] },
    { ...projectEvent, sourceId: "foreign" }]) ipc.emit("workspace:change", {}, malformed);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], event);
  assert.deepEqual(events[1], projectEvent);
  assert.equal(ipc.listenerCount("workspace:change"), 1);
  unsubscribe();
  assert.equal(ipc.listenerCount("workspace:change"), 0);
  api.onWorkspaceChange(() => {});
  api.onWorkspaceChange(() => {});
  assert.equal(ipc.listenerCount("workspace:change"), 2);
  unload.dispatchEvent(new Event("unload"));
  assert.equal(ipc.listenerCount("workspace:change"), 0);
});

test("real service IPC routes read-only discovery previews and rejects unsafe/foreign payloads", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-preview-ipc-"));
  const root = join(directory, "root");
  await mkdir(join(root, "Project", "Nested"), { recursive: true });
  await writeFile(join(root, "Project", "keep.txt"), "unchanged");
  const parent = new EventEmitter();
  parent.postMessage = () => {};
  const port = new FakePort();
  startServiceProcess(parent);
  try {
    parent.emit("message", { data: { type: "connect", databasePath: join(directory, "workspace.sqlite") }, ports: [port] });
    let id = 0;
    const request = (input) => {
      port.receive({ id: ++id, input });
      assert.equal(port.sent.at(-1).id, id);
      return port.sent.at(-1).result;
    };
    const workspace = request({ type: "workspace.create", name: "Test", rootPath: root }).value;
    const query = { type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId };
    const before = request({ type: "workspace.load" });
    const eventsBefore = port.sent.filter((message) => message.type === "workspace.change").length;
    const preview = request(query);
    assert.equal(preview.ok, true);
    assert.deepEqual(preview.value.entries, [{ kind: "project", categoryPath: null, relativePath: "Project", name: "Project", reason: null }]);
    assert.equal(request({ ...query, excludedRelativePaths: ["Project"] }).value.entries[0].reason, "manual");
    const grouped = request({ ...query, mode: "grouped" });
    assert.equal(grouped.ok, true);
    assert.equal(grouped.value.mode, "grouped");
    assert.deepEqual(grouped.value.entries, [
      { kind: "category", relativePath: "Project", name: "Project", reason: null, empty: false },
      { kind: "project", relativePath: "Project/Nested", name: "Nested", reason: null, categoryPath: "Project" },
    ]);
    assert.equal(request({ ...query, mode: "grouped", excludedRelativePaths: ["Project/Nested"] }).value.entries[1].reason, "manual");
    for (const mode of ["recursive", null, 1]) assert.equal(request({ ...query, mode }).error.code, "invalid_input");
    for (const input of [{ ...query, extra: true }, { type: query.type }, { ...query, workspaceId: "bad" },
      { ...query, workspaceId: "00000000-0000-4000-8000-000000000000" },
      { ...query, excludedRelativePaths: null }, { ...query, excludedRelativePaths: ["../escape"] },
      { ...query, excludedRelativePaths: ["invented"] }]) assert.equal(request(input).error.code, "invalid_input");
    assert.deepEqual(request({ type: "workspace.load" }), before);
    assert.equal(port.sent.filter((message) => message.type === "workspace.change").length, eventsBefore);
    assert.equal(await readFile(join(root, "Project", "keep.txt"), "utf8"), "unchanged");
  } finally {
    parent.emit("message", { data: { type: "shutdown" }, ports: [] });
    await rm(directory, { recursive: true, force: true });
  }
});

test("real service IPC applies reviewed projects, lists shared source state and rejects stale/invalid Apply", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-apply-ipc-"));
  const root = join(directory, "root");
  await mkdir(join(root, "Project", "Nested"), { recursive: true });
  await mkdir(join(root, "Excluded"));
  await writeFile(join(root, "Project", "keep"), "unchanged");
  const parent = new EventEmitter(); parent.postMessage = () => {};
  const port = new FakePort(); startServiceProcess(parent);
  try {
    parent.emit("message", { data: { type: "connect", databasePath: join(directory, "workspace.sqlite") }, ports: [port] });
    let id = 0;
    const request = (input) => { port.receive({ id: ++id, input }); assert.equal(port.sent.at(-1).id, id); return port.sent.at(-1).result; };
    const one = request({ type: "workspace.create", name: "One", rootPath: root }).value;
    const sibling = request({ type: "workspace.create", name: "Two", rootPath: root }).value;
    const listQuery = { type: "workspace.listProjects", workspaceId: one.workspaceId };
    assert.equal(request(listQuery).value.configured, false);
    const preview = request({ type: "workspace.previewDiscovery", workspaceId: one.workspaceId, excludedRelativePaths: ["Excluded"] }).value;
    const command = { type: "workspace.applyDiscovery", workspaceId: one.workspaceId, previewToken: preview.previewToken };
    for (const malformed of [{ ...command, extra: true }, { ...command, previewToken: null },
      { ...listQuery, extra: true }, { ...listQuery, workspaceId: 0 }]) assert.equal(request(malformed).error.code, "invalid_input");
    const applied = request(command);
    assert.equal(applied.ok, true);
    assert.deepEqual(applied.value.projects.map((row) => row.name), ["Project"]);
    assert.deepEqual(request(listQuery), applied);
    assert.deepEqual(request({ ...listQuery, workspaceId: sibling.workspaceId }).value.projects, applied.value.projects);
    assert.equal(request(command).error.code, "stale_preview");
    const next = request({ type: "workspace.previewDiscovery", workspaceId: one.workspaceId }).value;
    await mkdir(join(root, "Late"));
    assert.equal(request({ ...command, previewToken: next.previewToken }).error.code, "stale_preview");
    assert.deepEqual(request(listQuery).value.projects, applied.value.projects);
    assert.equal(await readFile(join(root, "Project", "keep"), "utf8"), "unchanged");
  } finally { parent.emit("message", { data: { type: "shutdown" }, ports: [] }); await rm(directory, { recursive: true, force: true }); }
});

test("production IPC exposes insufficient root identity as non-applyable on repeated previews", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-root-evidence-ipc-"));
  const root = join(directory, "root"); await mkdir(join(root, "Project"), { recursive: true });
  const parent = new EventEmitter(); parent.postMessage = () => {};
  const port = new FakePort(); startServiceProcess(parent);
  const originalLstat = fs.lstatSync;
  try {
    parent.emit("message", { data: { type: "connect", databasePath: join(directory, "data.sqlite") }, ports: [port] });
    let id = 0;
    const request = (input) => { port.receive({ id: ++id, input }); const response = port.sent.at(-1); assert.equal(response.id, id); return response.result; };
    const workspace = request({ type: "workspace.create", name: "Root evidence", rootPath: root }).value;
    const before = request({ type: "workspace.listProjects", workspaceId: workspace.workspaceId }).value;
    fs.lstatSync = (path, options) => {
      const info = originalLstat(path, options);
      if (path === workspace.canonicalRoot && options?.bigint) info.birthtimeNs = 0n;
      return info;
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const preview = request({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId });
      assert.equal(preview.ok, true);
      assert.equal(preview.value.state, "root_identity_conflict");
      assert.equal(preview.value.previewToken, null);
      assert.deepEqual(preview.value.entries, []);
    }
    fs.lstatSync = originalLstat;
    assert.deepEqual(request({ type: "workspace.listProjects", workspaceId: workspace.workspaceId }).value, before);
    assert.equal(port.sent.filter((message) => message.change?.type === "workspace.projectsChanged").length, 0);
  } finally {
    fs.lstatSync = originalLstat;
    parent.emit("message", { data: { type: "shutdown" }, ports: [] });
    await rm(directory, { recursive: true, force: true });
  }
});

test("production IPC keeps applied IDs/exclusions through unavailable roots, final removal and service restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-retention-ipc-"));
  const root = join(directory, "root"), disconnected = join(directory, "disconnected");
  await mkdir(join(root, "Project"), { recursive: true }); await mkdir(join(root, "Excluded"));
  await writeFile(join(root, "Excluded", "keep"), "retained excluded bytes");
  const databasePath = join(directory, "workspace.sqlite");
  const connect = () => {
    const parent = new EventEmitter(); parent.postMessage = () => {};
    const port = new FakePort(); startServiceProcess(parent);
    parent.emit("message", { data: { type: "connect", databasePath }, ports: [port] });
    let id = 0;
    return {
      request(input) { port.receive({ id: ++id, input }); const reply = port.sent.at(-1); assert.equal(reply.id, id); return reply.result; },
      close() { parent.emit("message", { data: { type: "shutdown" }, ports: [] }); assert.equal(port.closed, true); },
    };
  };
  let connection = connect();
  try {
    const first = connection.request({ type: "workspace.create", name: "First", rootPath: root }).value;
    const apply = (workspaceId, excludedRelativePaths) => {
      const preview = connection.request({ type: "workspace.previewDiscovery", workspaceId, excludedRelativePaths }).value;
      const applied = connection.request({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
      assert.equal(applied.ok, true); return applied.value;
    };
    apply(first.workspaceId, []);
    const saved = apply(first.workspaceId, ["Excluded"]);
    assert.equal(saved.retainedCount, 1);
    await rename(root, disconnected);
    const unavailable = connection.request({ type: "workspace.listProjects", workspaceId: first.workspaceId }).value;
    assert.deepEqual(unavailable, { ...saved, state: "unavailable", projects: saved.projects.map((row) => ({ ...row, resolution: null })), retainedProjects: saved.retainedProjects.map((row) => ({ ...row, resolution: null })) });
    assert.equal(connection.request({ type: "workspace.previewDiscovery", workspaceId: first.workspaceId }).value.previewToken, null);
    await rename(disconnected, root);
    assert.deepEqual(connection.request({ type: "workspace.listProjects", workspaceId: first.workspaceId }).value, saved);
    assert.equal(connection.request({ type: "workspace.remove", workspaceId: first.workspaceId }).ok, true);
    connection.close(); connection = connect();
    assert.deepEqual(connection.request({ type: "workspace.load" }).value, { workspaces: [], activeWorkspace: null });
    const recreated = connection.request({ type: "workspace.create", name: "Recreated", rootPath: root }).value;
    assert.equal(recreated.sourceId, first.sourceId); assert.notEqual(recreated.viewId, first.viewId);
    assert.deepEqual(connection.request({ type: "workspace.listProjects", workspaceId: recreated.workspaceId }).value,
      { ...saved, workspaceId: recreated.workspaceId });
    const reviewed = connection.request({ type: "workspace.previewDiscovery", workspaceId: recreated.workspaceId }).value;
    assert.deepEqual(reviewed.excludedRelativePaths, ["Excluded"]);
    assert.deepEqual(apply(recreated.workspaceId, reviewed.excludedRelativePaths), { ...saved, workspaceId: recreated.workspaceId });
    assert.equal(await readFile(join(root, "Excluded", "keep"), "utf8"), "retained excluded bytes");
  } finally { connection.close(); await rm(directory, { recursive: true, force: true }); }
});

test("BackendController accepts normalized stale-preview errors from the actual response envelope", async () => {
  const child = new FakeChild(); const port = new FakePort();
  const controller = new BackendController();
  const ready = controller.start(child, port, "/tmp/discovery.sqlite", {}, 1000);
  child.send({ type: "ready" }); await ready;
  const pending = controller.request({ type: "workspace.applyDiscovery", workspaceId: "test", previewToken: "old" });
  const sent = port.sent.at(-1);
  const result = { ok: false, error: { code: "stale_preview", message: "Review again" } };
  port.receive({ id: sent.id, result });
  assert.deepEqual(await pending, result);
  child.exit();
});

test("two typed clients receive committed project revisions through real ports/controller and clean up", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-project-events-"));
  const root = join(directory, "root"), otherRoot = join(directory, "other");
  await mkdir(join(root, "Project"), { recursive: true }); await mkdir(otherRoot);
  const parent = new EventEmitter(), child = new FakeChild();
  const servicePort = new FakePort(), desktopPort = new FakePort();
  servicePort.postMessage = (message) => { servicePort.sent.push(message); desktopPort.receive(message); };
  desktopPort.postMessage = (message) => servicePort.receive(message);
  parent.postMessage = (message) => child.send(message);
  child.postMessage = (data) => parent.emit("message", { data, ports: [servicePort] });
  startServiceProcess(parent, undefined, () => child.exit());
  const controller = new BackendController();
  const api = { workspace: (input) => controller.request(input), onWorkspaceChange: (listener) => controller.onWorkspaceChange(listener) };
  const oneClient = new WorkspaceServiceClient(api), twoClient = new WorkspaceServiceClient(api);
  const oneEvents = [], twoEvents = [];
  const offOne = oneClient.onWorkspaceChange((event) => oneEvents.push(event));
  const offTwo = twoClient.onWorkspaceChange((event) => twoEvents.push(event));
  try {
    assert.equal(await controller.start(child, desktopPort, join(directory, "data.sqlite"), {}, 100), true);
    const one = (await oneClient.createWorkspace("One", root)).value;
    const two = (await twoClient.createWorkspace("Two", root)).value;
    const other = (await oneClient.createWorkspace("Other", otherRoot)).value;
    oneEvents.length = twoEvents.length = 0;
    const sibling = (await twoClient.previewDiscovery(two.workspaceId)).value;
    const reviewed = (await oneClient.previewDiscovery(one.workspaceId)).value;
    const applied = await oneClient.applyDiscovery(one.workspaceId, reviewed.previewToken);
    const event = { type: "workspace.projectsChanged", sourceId: one.sourceId,
      workspaceIds: [one.workspaceId, two.workspaceId], revision: applied.value.revision };
    const observation = { type: "workspace.sourceObserved", sourceId: one.sourceId, workspaceIds: event.workspaceIds,
      observationRevision: 1, state: "ready", automaticUpdates: "active" };
    assert.deepEqual(oneEvents, [event, observation]); assert.deepEqual(twoEvents, oneEvents);
    assert.equal(servicePort.sent.at(-2).type, "workspace.change");
    assert.equal((await twoClient.applyDiscovery(two.workspaceId, sibling.previewToken)).error.code, "stale_preview");
    assert.deepEqual((await twoClient.listProjects(two.workspaceId)).value.projects, applied.value.projects);
    assert.deepEqual((await oneClient.listProjects(other.workspaceId)).value.projects, []);
    const pending = oneClient.listProjects(one.workspaceId);
    desktopPort.receive({ type: "workspace.change", id: 777, change: event });
    desktopPort.receive({ type: "workspace.change", change: { ...event, revision: "3" } });
    assert.deepEqual((await pending).value.projects, applied.value.projects);
    assert.equal(oneEvents.length, 2);
    offTwo();
    const excluded = (await oneClient.previewDiscovery(one.workspaceId, ["Project"])).value;
    await oneClient.applyDiscovery(one.workspaceId, excluded.previewToken);
    assert.equal(oneEvents.length, 3); assert.equal(twoEvents.length, 2);
    offOne(); await controller.stop(100);
    const before = servicePort.sent.length;
    servicePort.receive({ id: 999, input: { type: "workspace.listProjects", workspaceId: one.workspaceId } });
    assert.equal(servicePort.sent.length, before);
  } finally { offOne(); offTwo(); parent.emit("message", { data: { type: "shutdown" }, ports: [] }); await rm(directory, { recursive: true, force: true }); }
});

test("Text definitions and values traverse typed client and real service entry with committed events before responses", async () => {
  const directory = await mkdtemp(join(tmpdir(), "text-property-ipc-"));
  const root = join(directory, "root"), otherRoot = join(directory, "other");
  await mkdir(root); await mkdir(otherRoot); await mkdir(join(root, "Project"));
  const parent = new EventEmitter(); parent.postMessage = () => {};
  const port = new FakePort(); startServiceProcess(parent);
  try {
    parent.emit("message", { data: { type: "connect", databasePath: join(directory, "workspace.sqlite") }, ports: [port] });
    let id = 0;
    const workspace = async (input) => { port.receive({ id: ++id, input }); return port.sent.at(-1).result; };
    const client = new WorkspaceServiceClient({ workspace });
    const one = (await client.createWorkspace("One", root)).value;
    const sibling = (await client.createWorkspace("Sibling", root)).value;
    const other = (await client.createWorkspace("Other", otherRoot)).value;
    port.sent.length = 0;
    const created = await client.createProperty(one.workspaceId, "  日本語 Text  ");
    assert.equal(created.ok, true);
    assert.equal(port.sent[0].type, "workspace.change");
    assert.deepEqual(port.sent[0].change, { type: "workspace.propertiesChanged", sourceId: one.sourceId, workspaceIds: [one.workspaceId, sibling.workspaceId], revision: 1 });
    assert.equal(port.sent[1].id, id);
    assert.deepEqual((await client.listTextProperties(sibling.workspaceId)).value.definitions, created.value.snapshot.definitions);
    assert.deepEqual((await client.listTextProperties(other.workspaceId)).value.definitions, []);
    const renamed = await client.renameProperty(sibling.workspaceId, created.value.propertyId, "Renamed");
    assert.equal(renamed.value.snapshot.revision, 2);
    const preview = (await client.previewDiscovery(one.workspaceId)).value;
    const projectId = (await client.applyDiscovery(one.workspaceId, preview.previewToken)).value.projects[0].projectId;
    const propertyId = created.value.propertyId;
    for (const [value, revision] of [["  日本語\nСтрока  ", 3], ["", 4], [null, 5]]) {
      port.sent.length = 0;
      const saved = await client.setTextValue(sibling.workspaceId, projectId, propertyId, value);
      assert.equal(saved.ok, true); assert.equal(saved.value.snapshot.revision, revision);
      assert.equal(saved.value.projectId, projectId);
      assert.deepEqual(saved.value.snapshot.values, value === null ? [] : [{ projectId, propertyId, value }]);
      assert.deepEqual(port.sent[0].change, { type: "workspace.propertiesChanged", sourceId: one.sourceId, workspaceIds: [one.workspaceId, sibling.workspaceId], revision });
      assert.equal(port.sent[1].id, id);
      assert.deepEqual((await client.listTextProperties(one.workspaceId)).value.values, saved.value.snapshot.values);
      assert.deepEqual((await client.listTextProperties(other.workspaceId)).value.values, []);
      port.sent.length = 0;
      assert.equal((await client.setTextValue(one.workspaceId, projectId, propertyId, value)).value.snapshot.revision, revision);
      assert.equal(port.sent.length, 1);
    }
    port.sent.length = 0;
    assert.equal((await client.setTextValue(other.workspaceId, projectId, propertyId, "foreign")).error.code, "invalid_input");
    assert.equal(port.sent.length, 1);
    for (const input of [
      { type: "workspace.setTextValue", workspaceId: one.workspaceId, projectId, propertyId, value: "bad", propertyType: "number" },
      { type: "workspace.setTextValue", workspaceId: one.workspaceId, projectId, propertyId, value: 4 },
      { type: "workspace.setTextValue", workspaceId: one.workspaceId, projectId, propertyId },
      { type: "workspace.renameProperty", workspaceId: one.workspaceId, propertyId: created.value.propertyId, name: "Bad", propertyType: "number" },
      { type: "workspace.createProperty", workspaceId: one.workspaceId, name: "Bad", propertyType: "number" },
      { type: "workspace.listTextProperties", workspaceId: one.workspaceId, extra: true },
    ]) {
      port.sent.length = 0; assert.equal((await workspace(input)).error.code, "invalid_input");
      assert.equal(port.sent.length, 1);
    }
    port.sent.length = 0;
    assert.equal((await client.renameProperty(other.workspaceId, created.value.propertyId, "Foreign")).error.code, "invalid_input");
    assert.equal(port.sent.length, 1);
    port.sent.length = 0;
    assert.equal((await client.renameProperty(one.workspaceId, created.value.propertyId, "Renamed")).ok, true);
    assert.equal(port.sent.length, 1);
  } finally { parent.emit("message", { data: { type: "shutdown" }, ports: [] }); await rm(directory, { recursive: true, force: true }); }
});

test("Text events traverse real SQLite entry/controller/preload/clients in commit order and clean up on unsubscribe/unload", async () => {
  const directory = await mkdtemp(join(tmpdir(), "text-events-transport-"));
  const root = join(directory, "root"), otherRoot = join(directory, "other"), databasePath = join(directory, "data.sqlite");
  await mkdir(join(root, "Project"), { recursive: true }); await mkdir(otherRoot);
  await writeFile(join(root, "Project", "keep"), "unchanged transport bytes");
  const parent = new EventEmitter(), child = new FakeChild(), servicePort = new FakePort(), desktopPort = new FakePort();
  servicePort.postMessage = (message) => { servicePort.sent.push(message); desktopPort.receive(message); };
  desktopPort.postMessage = (message) => servicePort.receive(message);
  parent.postMessage = (message) => child.send(message);
  child.postMessage = (data) => parent.emit("message", { data, ports: [servicePort] });
  startServiceProcess(parent, undefined, () => child.exit());
  const controller = new BackendController();
  const ipc = new EventEmitter();
  ipc.invoke = async (channel, input) => { assert.equal(channel, "workspace:command"); return controller.request(input); };
  const offBroken = controller.onWorkspaceChange(() => { throw new Error("broken desktop subscriber"); });
  const offRelay = controller.onWorkspaceChange((event) => ipc.emit("workspace:change", {}, event));
  const preload = await readFile(new URL("../dist/desktop/preload.cjs", import.meta.url), "utf8");
  const createSurface = () => {
    const unload = new EventTarget(); let api;
    runInNewContext(preload, { window: unload, require: (name) => {
      assert.equal(name, "electron");
      return { ipcRenderer: ipc, contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } } };
    } });
    return { api, unload, client: new WorkspaceServiceClient(api) };
  };
  const oneSurface = createSurface(), siblingSurface = createSurface();
  const events = [], siblingEvents = [];
  const offOne = oneSurface.client.onWorkspaceChange((event) => events.push(event));
  const offSibling = siblingSurface.client.onWorkspaceChange((event) => siblingEvents.push(event));
  let sql;
  try {
    assert.equal(await controller.start(child, desktopPort, databasePath, {}, 100), true);
    const one = (await oneSurface.client.createWorkspace("One", root)).value;
    const sibling = (await siblingSurface.client.createWorkspace("Sibling", root)).value;
    const other = (await oneSurface.client.createWorkspace("Other", otherRoot)).value;
    const preview = (await oneSurface.client.previewDiscovery(one.workspaceId)).value;
    const projectId = (await oneSurface.client.applyDiscovery(one.workspaceId, preview.previewToken)).value.projects[0].projectId;
    events.length = siblingEvents.length = 0; servicePort.sent.length = 0;
    const created = await oneSurface.client.createProperty(one.workspaceId, "Notes");
    const propertyId = created.value.propertyId;
    const expected = (revision) => ({ type: "workspace.propertiesChanged", sourceId: one.sourceId, workspaceIds: [one.workspaceId, sibling.workspaceId], revision });
    assert.deepEqual(events, [expected(1)]); assert.deepEqual(siblingEvents, events);
    assert.equal(servicePort.sent[0].type, "workspace.change"); assert.equal(servicePort.sent[1].result.ok, true);
    servicePort.sent.length = 0;
    const value = await siblingSurface.client.setTextValue(sibling.workspaceId, projectId, propertyId, "  Exact 📝\n  ");
    assert.equal(value.ok, true); assert.equal(servicePort.sent[0].change.revision, 2);
    assert.equal(servicePort.sent[1].result.value.snapshot.revision, 2);
    assert.deepEqual((await oneSurface.client.listTextProperties(one.workspaceId)).value.values, value.value.snapshot.values);
    assert.deepEqual((await oneSurface.client.listTextProperties(other.workspaceId)).value, {
      workspaceId: other.workspaceId, sourceId: other.sourceId, revision: 0, definitions: [], values: [],
    });
    await oneSurface.client.renameProperty(one.workspaceId, propertyId, "Renamed");
    assert.deepEqual(events, [expected(1), expected(2), expected(3)]); assert.deepEqual(siblingEvents, events);
    assert.deepEqual((await siblingSurface.client.listTextProperties(sibling.workspaceId)).value.values, value.value.snapshot.values);
    assert.notEqual(one.viewId, sibling.viewId);
    const count = events.length;
    await oneSurface.client.renameProperty(one.workspaceId, propertyId, "Renamed");
    await oneSurface.client.setTextValue(one.workspaceId, projectId, propertyId, "  Exact 📝\n  ");
    assert.equal((await oneSurface.client.setTextValue(other.workspaceId, projectId, propertyId, "foreign")).ok, false);
    const Database = (await import("better-sqlite3")).default; sql = new Database(databasePath);
    sql.exec("CREATE TRIGGER fail_value BEFORE UPDATE ON text_property_values BEGIN SELECT RAISE(ABORT, 'transport rollback'); END");
    assert.equal((await oneSurface.client.setTextValue(one.workspaceId, projectId, propertyId, "failure")).error.code, "storage");
    sql.exec("DROP TRIGGER fail_value");
    assert.equal(events.length, count); assert.equal(siblingEvents.length, count);
    assert.equal((await oneSurface.client.listTextProperties(one.workspaceId)).value.revision, 3);
    const valid = expected(4);
    for (const change of [{ ...valid, extra: true }, { ...valid, revision: -1 }, { ...valid, revision: 1.5 },
      { ...valid, revision: "4" }, { ...valid, revision: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, workspaceIds: [] }, { ...valid, workspaceIds: [one.workspaceId, one.workspaceId] },
      { ...valid, sourceId: "bad" }]) {
      desktopPort.receive({ type: "workspace.change", change });
      ipc.emit("workspace:change", {}, change);
    }
    desktopPort.receive({ type: "workspace.change", id: 999, change: valid });
    // Bypass preload too, to assert the typed client independently validates events.
    let directListener;
    const direct = new WorkspaceServiceClient({ onWorkspaceChange: (listener) => { directListener = listener; return () => {}; } });
    const directEvents = []; const offDirect = direct.onWorkspaceChange((event) => directEvents.push(event));
    directListener({ ...valid, revision: null }); directListener(valid); offDirect(); directListener(valid);
    assert.deepEqual(directEvents, [valid]);
    assert.equal(events.length, count); assert.equal(siblingEvents.length, count);
    offSibling(); assert.equal(ipc.listenerCount("workspace:change"), 1);
    await oneSurface.client.setTextValue(one.workspaceId, projectId, propertyId, null);
    assert.equal(events.length, count + 1); assert.equal(siblingEvents.length, count);
    oneSurface.unload.dispatchEvent(new Event("unload")); assert.equal(ipc.listenerCount("workspace:change"), 0);
    await oneSurface.client.renameProperty(one.workspaceId, propertyId, "After unload");
    assert.equal(events.length, count + 1);
    assert.equal(await readFile(join(root, "Project", "keep"), "utf8"), "unchanged transport bytes");
    const before = servicePort.sent.length;
    parent.emit("message", { data: { type: "shutdown" }, ports: [] });
    desktopPort.receive({ type: "workspace.change", change: expected(6) });
    servicePort.receive({ id: 999, input: { type: "workspace.listTextProperties", workspaceId: one.workspaceId } });
    assert.equal(servicePort.sent.length, before); assert.equal(events.length, count + 1);
  } finally {
    offOne(); offSibling(); offBroken(); offRelay(); sql?.close();
    parent.emit("message", { data: { type: "shutdown" }, ports: [] });
    await rm(directory, { recursive: true, force: true });
  }
});

test("grouped Apply uses production ports and typed clients with categories, no-op fanout and token ownership", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-grouped-events-"));
  const root = join(directory, "root"), otherRoot = join(directory, "other");
  await mkdir(join(root, "Category/Project"), { recursive: true }); await mkdir(join(root, "Empty")); await mkdir(otherRoot);
  const parent = new EventEmitter(), child = new FakeChild();
  const servicePort = new FakePort(), desktopPort = new FakePort();
  servicePort.postMessage = (message) => { servicePort.sent.push(message); desktopPort.receive(message); };
  desktopPort.postMessage = (message) => servicePort.receive(message);
  parent.postMessage = (message) => child.send(message);
  child.postMessage = (data) => parent.emit("message", { data, ports: [servicePort] });
  startServiceProcess(parent, undefined, () => child.exit());
  const controller = new BackendController();
  const api = { workspace: (input) => controller.request(input), onWorkspaceChange: (listener) => controller.onWorkspaceChange(listener) };
  const oneClient = new WorkspaceServiceClient(api), siblingClient = new WorkspaceServiceClient(api);
  const events = []; const unsubscribe = siblingClient.onWorkspaceChange((event) => events.push(event));
  try {
    assert.equal(await controller.start(child, desktopPort, join(directory, "data.sqlite"), {}, 100), true);
    const one = (await oneClient.createWorkspace("One", root)).value, sibling = (await siblingClient.createWorkspace("Sibling", root)).value;
    const other = (await oneClient.createWorkspace("Other", otherRoot)).value; events.length = 0;
    const staleReview = (await siblingClient.previewDiscovery(sibling.workspaceId, undefined, "grouped")).value;
    const reviewed = (await oneClient.previewDiscovery(one.workspaceId, undefined, "grouped")).value;
    const applied = await oneClient.applyDiscovery(one.workspaceId, reviewed.previewToken); assert.equal(applied.ok, true);
    assert.equal(applied.value.mode, "grouped"); assert.equal(applied.value.projects[0].name, "Project");
    assert.equal(applied.value.projects[0].categoryId, applied.value.categories.find((category) => category.name === "Category").categoryId);
    assert.ok(applied.value.categories.some((category) => category.name === "Empty"));
    assert.deepEqual(events[1], { type: "workspace.sourceObserved", sourceId: one.sourceId, workspaceIds: [one.workspaceId, sibling.workspaceId],
      observationRevision: 1, state: "ready", automaticUpdates: "active" });
    assert.equal(events.length, 2); assert.deepEqual(events[0].workspaceIds, [one.workspaceId, sibling.workspaceId]);
    assert.equal(servicePort.sent.at(-2).type, "workspace.change");
    assert.equal((await siblingClient.applyDiscovery(sibling.workspaceId, staleReview.previewToken)).error.code, "stale_preview");
    assert.deepEqual((await siblingClient.listProjects(sibling.workspaceId)).value, { ...applied.value, workspaceId: sibling.workspaceId });
    assert.equal((await oneClient.listProjects(other.workspaceId)).value.categoryProperty, null);
    const unchanged = (await oneClient.previewDiscovery(one.workspaceId)).value;
    assert.equal(unchanged.mode, "grouped"); assert.equal((await oneClient.applyDiscovery(one.workspaceId, unchanged.previewToken)).ok, true);
    assert.equal(events.length, 2);
    assert.equal((await siblingClient.previewDiscovery(sibling.workspaceId, undefined, "direct")).error.code, "invalid_input");
    unsubscribe(); await controller.stop(100);
  } finally { unsubscribe(); parent.emit("message", { data: { type: "shutdown" }, ports: [] }); await rm(directory, { recursive: true, force: true }); }
});

test("category labels traverse entry/controller/preload/clients with validated ordered events and listener cleanup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "category-label-transport-"));
  const root = join(directory, "root"), otherRoot = join(directory, "other");
  await mkdir(join(root, "Category/Project"), { recursive: true }); await mkdir(otherRoot);
  const parent = new EventEmitter(), child = new FakeChild(), servicePort = new FakePort(), desktopPort = new FakePort();
  servicePort.postMessage = (message) => { servicePort.sent.push(message); desktopPort.receive(message); };
  desktopPort.postMessage = (message) => servicePort.receive(message);
  parent.postMessage = (message) => child.send(message);
  child.postMessage = (data) => parent.emit("message", { data, ports: [servicePort] });
  startServiceProcess(parent, undefined, () => child.exit());
  const controller = new BackendController(), ipc = new EventEmitter();
  ipc.invoke = async (channel, input) => { assert.equal(channel, "workspace:command"); return controller.request(input); };
  const relay = controller.onWorkspaceChange((event) => ipc.emit("workspace:change", {}, event));
  const preload = await readFile(new URL("../dist/desktop/preload.cjs", import.meta.url), "utf8");
  function surface() {
    const unload = new EventTarget(); let api;
    runInNewContext(preload, { window: unload, require: () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld: (_key, value) => { api = value; } } }) });
    return { client: new WorkspaceServiceClient(api), unload };
  }
  const oneSurface = surface(), siblingSurface = surface();
  const events = [], siblingEvents = [];
  const off = oneSurface.client.onWorkspaceChange((event) => events.push(event));
  const offSibling = siblingSurface.client.onWorkspaceChange((event) => siblingEvents.push(event));
  try {
    assert.equal(await controller.start(child, desktopPort, join(directory, "data.sqlite"), {}, 100), true);
    const one = (await oneSurface.client.createWorkspace("One", root)).value, sibling = (await siblingSurface.client.createWorkspace("Sibling", root)).value;
    const other = (await oneSurface.client.createWorkspace("Other", otherRoot)).value;
    const review = (await oneSurface.client.previewDiscovery(one.workspaceId, undefined, "grouped")).value;
    const applied = (await oneSurface.client.applyDiscovery(one.workspaceId, review.previewToken)).value, propertyId = applied.categoryProperty.propertyId;
    events.length = siblingEvents.length = servicePort.sent.length = 0;
    const rename = await oneSurface.client.renameCategoryProperty(one.workspaceId, propertyId, "  Label 日本語  ");
    assert.equal(rename.ok, true); assert.equal(rename.value.revision, 1);
    const expected = { type: "workspace.categoryPropertyChanged", sourceId: one.sourceId, workspaceIds: [one.workspaceId, sibling.workspaceId], revision: 1 };
    assert.deepEqual(events, [expected]); assert.deepEqual(siblingEvents, events);
    assert.deepEqual(servicePort.sent[0].change, expected); assert.deepEqual(servicePort.sent[1].result, rename);
    assert.equal((await siblingSurface.client.listProjects(sibling.workspaceId)).value.categoryProperty.name, "  Label 日本語  ");
    for (const change of [{ ...expected, revision: -1 }, { ...expected, revision: 0.5 }, { ...expected, sourceId: "bad" },
      { ...expected, workspaceIds: [] }, { ...expected, workspaceIds: [one.workspaceId, one.workspaceId] }, { ...expected, propertyId },
      { ...expected, workspaceIds: ["bad"] }]) {
      desktopPort.receive({ type: "workspace.change", change }); ipc.emit("workspace:change", {}, change);
    }
    assert.equal(events.length, 1); assert.equal(siblingEvents.length, 1);
    for (const input of [
      { type: "workspace.renameCategoryProperty", workspaceId: one.workspaceId, propertyId, name: "bad", sourceId: one.sourceId },
      { type: "workspace.renameCategoryProperty", workspaceId: one.workspaceId, propertyId },
      { type: "workspace.renameCategoryProperty", workspaceId: one.workspaceId, propertyId, name: 4 },
      { type: "workspace.renameCategoryProperty", workspaceId: other.workspaceId, propertyId, name: "Foreign" },
    ]) assert.equal((await controller.request(input)).error.code, "invalid_input");
    assert.equal((await siblingSurface.client.renameCategoryProperty(sibling.workspaceId, propertyId, "  Label 日本語  ")).value.revision, 1);
    assert.equal(events.length, 1);
    off(); siblingSurface.unload.dispatchEvent(new Event("unload"));
    assert.equal(ipc.listenerCount("workspace:change"), 0);
    assert.equal((await oneSurface.client.renameCategoryProperty(one.workspaceId, propertyId, "Next")).value.revision, 2);
    assert.equal(events.length, 1); assert.equal(siblingEvents.length, 1);
    assert.equal((await oneSurface.client.listProjects(other.workspaceId)).value.categoryProperty, null);
    await controller.stop(100);
    const sent = servicePort.sent.length;
    servicePort.receive({ id: 1000, input: { type: "workspace.renameCategoryProperty", workspaceId: one.workspaceId, propertyId, name: "After shutdown" } });
    assert.equal(servicePort.sent.length, sent);
  } finally { off(); offSibling(); relay(); parent.emit("message", { data: { type: "shutdown" }, ports: [] }); await rm(directory, { recursive: true, force: true }); }
});

test("direct recovery traverses production service ports/controller/client and rejects malformed requests without metadata transfer", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-recovery-ipc-"));
  const root = join(directory, "root");
  await mkdir(join(root, "Original"), { recursive: true });
  await writeFile(join(root, "Original/sentinel"), "original bytes");
  const parent = new EventEmitter(), child = new FakeChild(), servicePort = new FakePort(), desktopPort = new FakePort();
  servicePort.postMessage = (message) => { servicePort.sent.push(message); desktopPort.receive(message); };
  desktopPort.postMessage = (message) => { desktopPort.sent.push(message); servicePort.receive(message); };
  parent.postMessage = (message) => child.send(message);
  child.postMessage = (data) => parent.emit("message", { data, ports: [servicePort] });
  startServiceProcess(parent, undefined, () => child.exit());
  const controller = new BackendController();
  const client = new WorkspaceServiceClient({ workspace: (input) => controller.request(input), onWorkspaceChange: (listener) => controller.onWorkspaceChange(listener) });
  try {
    assert.equal(await controller.start(child, desktopPort, join(directory, "workspace.sqlite"), {}, 100), true);
    const workspace = (await client.createWorkspace("Recovery", root)).value;
    const initial = await client.previewDiscovery(workspace.workspaceId);
    const project = (await client.applyDiscovery(workspace.workspaceId, initial.value.previewToken)).value.projects[0];
    const property = (await client.createProperty(workspace.workspaceId, "Notes")).value;
    await client.setTextValue(workspace.workspaceId, project.projectId, property.propertyId, "  Exact\nТекст  ");
    await rename(join(root, "Original"), join(root, "Target"));
    for (const input of [
      { type: "workspace.previewProjectRecovery", workspaceId: workspace.workspaceId },
      { type: "workspace.previewProjectRecovery", workspaceId: workspace.workspaceId, projectId: project.projectId, extra: true },
      { type: "workspace.reassociateProject", workspaceId: workspace.workspaceId, projectId: project.projectId, previewToken: "bad", relativePath: 42 },
    ]) assert.equal((await controller.request(input)).error.code, "invalid_input");
    const review = await client.previewProjectRecovery(workspace.workspaceId, project.projectId);
    assert.equal(review.ok, true); assert.equal(review.value.entries[0].relativePath, "Target");
    const messagesBefore = servicePort.sent.length;
    const result = await client.reassociateProject(workspace.workspaceId, project.projectId, review.value.previewToken, "Target");
    assert.equal(result.ok, true); assert.equal(result.value.projects[0].projectId, project.projectId);
    assert.equal(servicePort.sent[messagesBefore].type, "workspace.change");
    assert.equal(servicePort.sent[messagesBefore].change.type, "workspace.projectsChanged");
    assert.ok(servicePort.sent[messagesBefore + 1].id);
    assert.equal((await client.listTextProperties(workspace.workspaceId)).value.values[0].value, "  Exact\nТекст  ");
    assert.equal(await readFile(join(root, "Target/sentinel"), "utf8"), "original bytes");
    assert.deepEqual(fs.readdirSync(root), ["Target"]); assert.deepEqual(fs.readdirSync(join(root, "Target")), ["sentinel"]);
    await controller.stop(100);
  } finally { parent.emit("message", { data: { type: "shutdown" }, ports: [] }); await rm(directory, { recursive: true, force: true }); }
});

test("recovery fanout traverses production preload clients in commit order and clears listeners", async () => {
  const directory = await mkdtemp(join(tmpdir(), "recovery-events-transport-"));
  const root = join(directory, "root"), otherRoot = join(directory, "other");
  await mkdir(join(root, "Original"), { recursive: true }); await mkdir(otherRoot);
  await writeFile(join(root, "Original/keep"), "unchanged event bytes");
  const parent = new EventEmitter(), child = new FakeChild(), servicePort = new FakePort(), desktopPort = new FakePort();
  servicePort.postMessage = (message) => { servicePort.sent.push(message); desktopPort.receive(message); };
  desktopPort.postMessage = (message) => servicePort.receive(message);
  parent.postMessage = (message) => child.send(message);
  child.postMessage = (data) => parent.emit("message", { data, ports: [servicePort] });
  startServiceProcess(parent, undefined, () => child.exit());
  const controller = new BackendController(), ipc = new EventEmitter();
  ipc.invoke = async (channel, input) => { assert.equal(channel, "workspace:command"); return controller.request(input); };
  const relay = controller.onWorkspaceChange((event) => ipc.emit("workspace:change", {}, event));
  const preload = await readFile(new URL("../dist/desktop/preload.cjs", import.meta.url), "utf8");
  const surface = () => {
    const unload = new EventTarget(); let api;
    runInNewContext(preload, { window: unload, require: () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } } }) });
    return { unload, client: new WorkspaceServiceClient(api) };
  };
  const one = surface(), sibling = surface(), unrelated = surface();
  const events = [], siblingEvents = [], otherEvents = [];
  let otherWorkspace;
  const offOne = one.client.onWorkspaceChange((event) => events.push(event));
  const offSibling = sibling.client.onWorkspaceChange((event) => siblingEvents.push(event));
  const offOther = unrelated.client.onWorkspaceChange((event) => {
    if (event.type === "workspace.projectsChanged" && event.workspaceIds.includes(otherWorkspace?.workspaceId)) otherEvents.push(event);
  });
  try {
    assert.equal(await controller.start(child, desktopPort, join(directory, "data.sqlite"), {}, 100), true);
    const workspace = (await one.client.createWorkspace("One", root)).value;
    const siblingWorkspace = (await sibling.client.createWorkspace("Sibling", root)).value;
    otherWorkspace = (await unrelated.client.createWorkspace("Other", otherRoot)).value;
    const discovery = (await one.client.previewDiscovery(workspace.workspaceId)).value;
    const original = (await one.client.applyDiscovery(workspace.workspaceId, discovery.previewToken)).value.projects[0];
    await rename(join(root, "Original"), join(root, "Target"));
    const review = (await one.client.previewProjectRecovery(workspace.workspaceId, original.projectId)).value;
    const siblingReview = (await sibling.client.previewProjectRecovery(siblingWorkspace.workspaceId, original.projectId)).value;
    events.length = siblingEvents.length = servicePort.sent.length = 0;
    const saved = await one.client.reassociateProject(workspace.workspaceId, original.projectId, review.previewToken, "Target");
    assert.equal(saved.ok, true);
    const expected = { type: "workspace.projectsChanged", sourceId: workspace.sourceId, revision: saved.value.revision,
      workspaceIds: [workspace.workspaceId, siblingWorkspace.workspaceId] };
    assert.deepEqual(events, [expected]); assert.deepEqual(siblingEvents, events); assert.deepEqual(otherEvents, []);
    assert.equal(servicePort.sent[0].type, "workspace.change"); assert.equal(servicePort.sent[1].result.ok, true);
    assert.equal((await sibling.client.reassociateProject(siblingWorkspace.workspaceId, original.projectId, siblingReview.previewToken, "Target")).error.code, "stale_preview");
    assert.equal((await sibling.client.listProjects(siblingWorkspace.workspaceId)).value.projects[0].projectId, original.projectId);
    await rename(join(root, "Target"), join(root, "Next"));
    const nextReview = (await sibling.client.previewProjectRecovery(siblingWorkspace.workspaceId, original.projectId)).value;
    const next = await sibling.client.reassociateProject(siblingWorkspace.workspaceId, original.projectId, nextReview.previewToken, "Next");
    assert.equal(next.ok, true); assert.equal(next.value.revision, saved.value.revision + 1);
    await mkdir(join(root, "Additional"));
    const newerDiscovery = (await sibling.client.previewDiscovery(siblingWorkspace.workspaceId)).value;
    const discovered = await sibling.client.applyDiscovery(siblingWorkspace.workspaceId, newerDiscovery.previewToken);
    assert.equal(discovered.ok, true); assert.equal(discovered.value.revision, next.value.revision + 1);
    assert.deepEqual(events.map((event) => event.revision), [saved.value.revision, next.value.revision, discovered.value.revision]);
    assert.deepEqual(siblingEvents, events); assert.deepEqual(otherEvents, []);
    offOne(); sibling.unload.dispatchEvent(new Event("unload"));
    assert.equal(ipc.listenerCount("workspace:change"), 1);
    await mkdir(join(root, "After cleanup"));
    const finalReview = (await unrelated.client.previewDiscovery(workspace.workspaceId)).value;
    assert.equal((await unrelated.client.applyDiscovery(workspace.workspaceId, finalReview.previewToken)).ok, true);
    assert.equal(events.length, 3); assert.equal(siblingEvents.length, 3); assert.deepEqual(otherEvents, []);
    assert.equal(await readFile(join(root, "Next/keep"), "utf8"), "unchanged event bytes");
    await controller.stop(100);
  } finally {
    offOne(); offSibling(); offOther(); relay();
    one.unload.dispatchEvent(new Event("unload")); sibling.unload.dispatchEvent(new Event("unload")); unrelated.unload.dispatchEvent(new Event("unload"));
    parent.emit("message", { data: { type: "shutdown" }, ports: [] });
    await rm(directory, { recursive: true, force: true });
  }
});

test("source observation traverses production entry/controller/preload/clients before Refresh responses and rejects malformed envelopes", async () => {
  const { openSettingsService } = await import("../dist/service/settings.mjs");
  const { nativeObserverDependencies } = await import("../src/service/source-observer.ts");
  const directory = await mkdtemp(join(tmpdir(), "source-observed-transport-"));
  const root = join(directory, "root"), otherRoot = join(directory, "other");
  await mkdir(join(root, "Project"), { recursive: true }); await mkdir(otherRoot);
  const timers = new Set(), watchers = [];
  const dependencies = { ...nativeObserverDependencies,
    schedule(callback, delay) { const timer = { callback, delay }; timers.add(timer); return { cancel: () => timers.delete(timer) }; },
    watch(path, hint, failed) { const watcher = { path, hint, failed, closed: false }; watchers.push(watcher); return { close: () => { watcher.closed = true; } }; },
  };
  const flush = () => {
    for (const timer of [...timers].filter((timer) => timer.delay === 100)) { timers.delete(timer); timer.callback(); }
  };
  const parent = new EventEmitter(), child = new FakeChild(), servicePort = new FakePort(), desktopPort = new FakePort();
  servicePort.postMessage = (message) => { servicePort.sent.push(message); desktopPort.receive(message); };
  desktopPort.postMessage = (message) => servicePort.receive(message);
  parent.postMessage = (message) => child.send(message);
  child.postMessage = (data) => parent.emit("message", { data, ports: [servicePort] });
  startServiceProcess(parent, (path, migrations) => openSettingsService(path, migrations, undefined, dependencies), () => child.exit());
  const controller = new BackendController(), ipc = new EventEmitter();
  ipc.invoke = async (channel, input) => { assert.equal(channel, "workspace:command"); return controller.request(input); };
  const relay = controller.onWorkspaceChange((event) => ipc.emit("workspace:change", {}, event));
  const preload = await readFile(new URL("../dist/desktop/preload.cjs", import.meta.url), "utf8");
  function surface() {
    const unload = new EventTarget(); let api;
    runInNewContext(preload, { window: unload, require: () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld: (_key, value) => { api = value; } } }) });
    return { client: new WorkspaceServiceClient(api), unload };
  }
  const oneSurface = surface(), twoSurface = surface(), otherSurface = surface();
  const events = [], siblingEvents = [], unrelatedEvents = [];
  const off = oneSurface.client.onWorkspaceChange((event) => events.push(event));
  const offTwo = twoSurface.client.onWorkspaceChange((event) => siblingEvents.push(event));
  let other;
  const offOther = otherSurface.client.onWorkspaceChange((event) => { if (event.workspaceIds?.includes(other?.workspaceId)) unrelatedEvents.push(event); });
  try {
    assert.equal(await controller.start(child, desktopPort, join(directory, "data.sqlite"), {}, 100), true);
    const one = (await oneSurface.client.createWorkspace("One", root)).value;
    const two = (await twoSurface.client.createWorkspace("Two", root)).value;
    other = (await otherSurface.client.createWorkspace("Other", otherRoot)).value;
    const preview = (await oneSurface.client.previewDiscovery(one.workspaceId)).value;
    const applied = (await oneSurface.client.applyDiscovery(one.workspaceId, preview.previewToken)).value;
    flush(); events.length = siblingEvents.length = servicePort.sent.length = 0;
    assert.equal(watchers.filter((watcher) => !watcher.closed).length, 1);
    await rename(join(root, "Project"), join(directory, "away"));
    const result = await oneSurface.client.refreshSource(one.workspaceId);
    assert.equal(result.ok, true);
    const observation = { type: "workspace.sourceObserved", sourceId: one.sourceId, workspaceIds: [one.workspaceId, two.workspaceId],
      observationRevision: 2, state: "empty", automaticUpdates: "active" };
    assert.deepEqual(events, [observation]); assert.deepEqual(siblingEvents, events); assert.deepEqual(unrelatedEvents, []);
    assert.deepEqual(servicePort.sent[0].change, observation); assert.deepEqual(servicePort.sent[1].result, result);
    const list = (await twoSurface.client.listProjects(two.workspaceId)).value;
    assert.equal(list.revision, applied.revision); assert.equal(list.retainedProjects[0].resolution, "missing");
    for (const malformed of [{ ...observation, extra: true }, { ...observation, revision: 2 }, { ...observation, observationRevision: 0 },
      { ...observation, observationRevision: -1 }, { ...observation, observationRevision: 0.5 },
      { ...observation, observationRevision: Number.MAX_SAFE_INTEGER + 1 }, { ...observation, observationRevision: "3" },
      { ...observation, automaticUpdates: "unknown" }, { ...observation, state: "unknown" }, { ...observation, sourceId: "bad" },
      { ...observation, workspaceIds: [] }, { ...observation, workspaceIds: [one.workspaceId, one.workspaceId] }]) {
      desktopPort.receive({ type: "workspace.change", change: malformed });
      ipc.emit("workspace:change", {}, malformed);
    }
    assert.deepEqual(events, [observation]);
    events.length = siblingEvents.length = 0;
    await rename(join(directory, "away"), join(root, "Renamed"));
    watchers[0].hint("rename", null); flush();
    assert.deepEqual(events.map((event) => event.type), ["workspace.projectsChanged", "workspace.sourceObserved"]);
    assert.equal(events[0].revision, applied.revision + 1); assert.equal(events[1].observationRevision, 3);
    assert.deepEqual(siblingEvents, events); assert.deepEqual(unrelatedEvents, []);
    offTwo(); twoSurface.unload.dispatchEvent(new Event("unload"));
    const count = siblingEvents.length;
    watchers[0].failed(); assert.equal(events.at(-1).automaticUpdates, "degraded"); assert.equal(siblingEvents.length, count);
    off(); offOther(); relay(); await controller.stop(100);
    assert.equal(timers.size, 0); assert.ok(watchers.every((watcher) => watcher.closed));
    const sent = servicePort.sent.length; watchers[0].hint(); watchers[0].failed(); flush(); assert.equal(servicePort.sent.length, sent);
  } finally { off(); offTwo(); offOther(); relay(); parent.emit("message", { data: { type: "shutdown" }, ports: [] }); await rm(directory, { recursive: true, force: true }); }
});
