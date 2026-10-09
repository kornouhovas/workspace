import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    assert.deepEqual(preview.value.entries, [{ relativePath: "Project", name: "Project", reason: null }]);
    assert.equal(request({ ...query, excludedRelativePaths: ["Project"] }).value.entries[0].reason, "manual");
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
    assert.deepEqual(oneEvents, [event]); assert.deepEqual(twoEvents, [event]);
    assert.equal(servicePort.sent.at(-2).type, "workspace.change");
    assert.equal((await twoClient.applyDiscovery(two.workspaceId, sibling.previewToken)).error.code, "stale_preview");
    assert.deepEqual((await twoClient.listProjects(two.workspaceId)).value.projects, applied.value.projects);
    assert.deepEqual((await oneClient.listProjects(other.workspaceId)).value.projects, []);
    const pending = oneClient.listProjects(one.workspaceId);
    desktopPort.receive({ type: "workspace.change", id: 777, change: event });
    desktopPort.receive({ type: "workspace.change", change: { ...event, revision: "3" } });
    assert.deepEqual((await pending).value.projects, applied.value.projects);
    assert.equal(oneEvents.length, 1);
    offTwo();
    const excluded = (await oneClient.previewDiscovery(one.workspaceId, ["Project"])).value;
    await oneClient.applyDiscovery(one.workspaceId, excluded.previewToken);
    assert.equal(oneEvents.length, 2); assert.equal(twoEvents.length, 1);
    offOne(); await controller.stop(100);
    const before = servicePort.sent.length;
    servicePort.receive({ id: 999, input: { type: "workspace.listProjects", workspaceId: one.workspaceId } });
    assert.equal(servicePort.sent.length, before);
  } finally { offOne(); offTwo(); parent.emit("message", { data: { type: "shutdown" }, ports: [] }); await rm(directory, { recursive: true, force: true }); }
});
