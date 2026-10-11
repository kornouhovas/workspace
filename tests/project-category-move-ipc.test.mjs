import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { build } from "esbuild";
import { BackendController } from "../dist/desktop/backend-controller.mjs";
import { startServiceProcess } from "../dist/service/entry.cjs";
import { openSettingsService } from "../dist/service/settings.mjs";
import { renameNoReplace } from "../dist/service/project-rename-filesystem.mjs";
import { createNativeProjectReveal } from "../src/desktop/project-reveal.ts";

// Exercise the emitted client too, without adding a renderer build artifact.
const compiled = await build({ entryPoints: ["src/renderer/workspace-service-client.ts"], bundle: true, write: false, format: "esm", platform: "browser" });
const { WorkspaceServiceClient } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const preload = fs.readFileSync(new URL("../dist/desktop/preload.cjs", import.meta.url), "utf8");
const observers = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
class Port extends EventEmitter {
  sent = [];
  closed = false;
  receive(data) { if (!this.closed) this.emit("message", { data: structuredClone(data) }); }
  close() { this.closed = true; }
}
class Child extends EventEmitter {
  kill() { this.emit("exit", 1); return true; }
}
async function fixture(run, options = {}) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "category-move-ipc-")));
  const root = join(directory, "root"), otherRoot = join(directory, "unrelated"), database = join(directory, "workspace.sqlite");
  const relative = (name, category = "Category") => `${category}/${name}`;
  fs.mkdirSync(root); fs.mkdirSync(otherRoot); fs.mkdirSync(join(root, "Category")); fs.mkdirSync(join(root, "Destination"));
  for (const name of ["Original", "Other"]) {
    fs.mkdirSync(join(root, relative(name))); fs.writeFileSync(join(root, relative(name), "sentinel"), `  ${name}\n`);
  }
  fs.mkdirSync(join(otherRoot, "Unrelated"));
  let generation;
  const f = { directory, root, database, relative, calls: [], dropRequest: false, dropResponse: false, dropType: "workspace.moveProjectCategory", interrupt: null,
    nativeReveal: null, nativeTargets: [], dispatchedPaths: [], events: [], requests: [] };
  const reveal = createNativeProjectReveal((path) => { f.dispatchedPaths.push(path); });
  const controller = new BackendController(undefined, async (target, current, authorize, signal) => {
    f.nativeTargets.push(target);
    if (f.nativeReveal) return f.nativeReveal(target, current, authorize);
    return reveal(target, current, authorize, signal);
  });
  const ipc = new EventEmitter();
  ipc.invoke = async (channel, input) => {
    if (channel === "workspace:backend-status") return controller.currentStatus;
    assert.equal(channel, "workspace:command"); return controller.request(input, 2000);
  };
  const offRelay = controller.onWorkspaceChange((event) => ipc.emit("workspace:change", {}, event));
  const unload = new EventTarget(); let api;
  runInNewContext(preload, { window: unload, require: () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld: (_key, value) => { api = value; } } }) });
  const client = new WorkspaceServiceClient(api);
  const off = client.onWorkspaceChange((event) => f.events.push(event));
  async function connect() {
    const parent = new EventEmitter(), child = new Child(), servicePort = new Port(), desktopPort = new Port();
    servicePort.postMessage = (message) => {
      servicePort.sent.push(structuredClone(message));
      if (message.id && f.dropResponse && desktopPort.sent.some((row) => row.id === message.id && row.input.type === f.dropType)) {
        f.droppedResponse = structuredClone(message); return;
      }
      desktopPort.receive(message);
    };
    desktopPort.postMessage = (message) => {
      desktopPort.sent.push(structuredClone(message));
      if (message.input) f.requests.push(structuredClone(message.input));
      if (f.dropRequest && message.input?.type === f.dropType) return;
      servicePort.receive(message);
    };
    parent.postMessage = (message) => child.emit("message", structuredClone(message));
    child.postMessage = (data) => parent.emit("message", { data: structuredClone(data), ports: [servicePort] });
    const native = (from, to) => {
      f.calls.push([from, to]);
      if (f.interrupt === "before") throw new Error("private failure before native effect");
      const result = renameNoReplace(from, to);
      if (f.interrupt === "after") throw new Error("private failure after native effect");
      return result;
    };
    startServiceProcess(parent, options.productionDefault ? undefined :
      (path, folder) => openSettingsService(path, folder, undefined, observers, undefined, native), () => child.emit("exit", 0));
    generation = { parent, child, servicePort, desktopPort };
    assert.equal(await controller.start(child, desktopPort, database, {}, 2000), true);
  }
  try {
    await connect();
    const one = (await client.createWorkspace("One", root)).value;
    const sibling = (await client.createWorkspace("Sibling", root)).value;
    const unrelated = (await client.createWorkspace("Unrelated", otherRoot)).value;
    const preview = (await client.previewDiscovery(one.workspaceId, undefined, "grouped")).value;
    const list = (await client.applyDiscovery(one.workspaceId, preview.previewToken)).value;
    const otherPreview = (await client.previewDiscovery(unrelated.workspaceId, undefined, "direct")).value;
    const otherList = (await client.applyDiscovery(unrelated.workspaceId, otherPreview.previewToken)).value;
    const project = list.projects.find((row) => row.name === "Original");
    const property = (await client.createProperty(one.workspaceId, "Notes")).value;
    await client.setTextValue(one.workspaceId, project.projectId, property.propertyId, "  Exact\nТекст  ");
    Object.assign(f, { client, api, controller, ipc, one, sibling, unrelated, project, list, otherList, property,
      getGeneration: () => generation,
      destination: list.categories.find((row) => row.name === "Destination"),
      request: (extra = {}) => ({ workspaceId: one.workspaceId, projectId: project.projectId,
        operationId: randomUUID(), destinationCategoryId: list.categories.find((row) => row.name === "Destination").categoryId,
        expectedRevision: list.revision, ...extra }),
      restart: async () => {
        const previous = generation;
        f.dropRequest = false; f.dropResponse = false; f.interrupt = null;
        await connect();
        // Replacement keeps the current desktop subscriptions; the old exit and
        // any late response belong to the previous controller generation.
        previous.parent.emit("message", { data: { type: "shutdown" }, ports: [] });
      },
    });
    f.events.length = 0; generation.servicePort.sent.length = 0;
    await run(f);
  } finally {
    off(); offRelay(); unload.dispatchEvent(new Event("unload"));
    assert.equal(ipc.listenerCount("workspace:change"), 0);
    await controller.stop(100);
    generation?.parent.emit("message", { data: { type: "shutdown" }, ports: [] });
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
function assertPublic(value, f) {
  const encoded = JSON.stringify(value);
  for (const forbidden of [f.directory, "stagingRelativePath", ".workspace-rename-", "stagedIdentity", "nativeIdentity", "rootIdentity", "parentIdentity", "originalParentIdentity", "destinationParentIdentity", "projectIdentity", "stack", "private failure"]) {
    assert.equal(encoded.includes(forbidden), false, forbidden);
  }
}
test("all five category move requests traverse compiled routing with committed sibling events", () => fixture(async (f) => {
  const input = f.request();
  const identity = fs.statSync(join(f.root, f.relative("Original")), { bigint: true });
  const values = await f.client.listTextProperties(f.one.workspaceId);
  const result = await f.client.moveProjectCategory(input);
  assert.equal(result.value.outcome, "completed", JSON.stringify(result));
  assert.equal(result.value.project.projectId, f.project.projectId);
  assert.equal(result.value.project.name, "Original");
  assert.equal(result.value.project.categoryId, f.destination.categoryId);
  assert.equal(result.value.project.relativePath, "Destination/Original");
  const messages = f.getGeneration().servicePort.sent;
  const responseIndex = messages.findIndex((message) => message.result?.value?.operation?.operationId === input.operationId);
  const eventIndex = messages.findIndex((message) => message.change?.type === "workspace.projectsChanged");
  assert.ok(eventIndex >= 0 && eventIndex < responseIndex);
  assert.deepEqual(f.events, [{ type: "workspace.projectsChanged", sourceId: f.one.sourceId,
    workspaceIds: [f.one.workspaceId, f.sibling.workspaceId], revision: f.list.revision + 1 }]);
  const sibling = (await f.client.listProjects(f.sibling.workspaceId)).value;
  assert.equal(sibling.revision, f.list.revision + 1);
  assert.equal(sibling.projects.find((p) => p.projectId === f.project.projectId).categoryId, f.destination.categoryId);
  assert.deepEqual((await f.client.listProjects(f.unrelated.workspaceId)).value, f.otherList);
  assert.deepEqual(await f.client.listTextProperties(f.one.workspaceId), values);
  assert.deepEqual(await f.client.getProjectCategoryMove(f.sibling.workspaceId, input.operationId), result);
  assert.deepEqual((await f.client.listProjectCategoryMoves(f.one.workspaceId)).value.operations, []);
  assert.deepEqual((await f.client.previewProjectCategoryMoveRecovery(f.sibling.workspaceId, input.operationId)).value.actions, []);
  assert.equal((await f.client.recoverProjectCategoryMove(f.one.workspaceId, input.operationId, randomUUID(), "retry_original")).error.code, "stale_preview");
  assert.deepEqual(await f.client.moveProjectCategory(input), result); assert.equal(f.calls.length, 1);
  const noop = await f.client.moveProjectCategory(f.request({ expectedRevision: result.value.project.revision }));
  assert.equal(noop.value.outcome, "unchanged"); assert.equal(f.calls.length, 1); assert.equal(f.events.length, 1);
  const rejected = await f.client.moveProjectCategory(f.request({ destinationCategoryId: randomUUID(), expectedRevision: result.value.project.revision }));
  assert.equal(rejected.value.problem, "category_unavailable");
  const final = fs.statSync(join(f.root, "Destination/Original"), { bigint: true });
  assert.deepEqual([final.dev, final.ino, final.birthtimeNs], [identity.dev, identity.ino, identity.birthtimeNs]);
  assert.equal(fs.readFileSync(join(f.root, "Destination/Original/sentinel"), "utf8"), "  Original\n");
  for (const value of [result, noop, rejected, ...f.events]) assertPublic(value, f);
  assert.equal(Object.keys(f.api).some((key) => /native|shell|path|url/i.test(key)), false);
}));

test("exact IPC requests reject forged evidence, invalid IDs and foreign entities; client sends accepted fields only", () => fixture(async (f) => {
  const input = f.request();
  const commands = [
    { ...input, type: "workspace.moveProjectCategory" },
    { type: "workspace.listProjectCategoryMoves", workspaceId: f.one.workspaceId },
    { type: "workspace.getProjectCategoryMove", workspaceId: f.one.workspaceId, operationId: input.operationId },
    { type: "workspace.previewProjectCategoryMoveRecovery", workspaceId: f.one.workspaceId, operationId: input.operationId },
    { type: "workspace.recoverProjectCategoryMove", workspaceId: f.one.workspaceId, operationId: input.operationId, previewToken: randomUUID(), action: "retry_original" },
  ];
  for (const command of commands) {
    for (const extra of [{ path: "/outside" }, { name: "Chosen" }, { nativeIdentity: "forged" },
      { rootIdentity: "forged" }, { stagingRelativePath: "chosen" }, { modulePath: "chosen" }, { adapter: "chosen" },
      { extra: true }, { workspaceId: "bad" }]) {
      assert.equal((await f.api.workspace({ ...command, ...extra })).error.code, "invalid_input");
    }
    for (const key of Object.keys(command)) {
      const missing = { ...command }; delete missing[key];
      assert.equal((await f.api.workspace(missing)).error.code, "invalid_input");
    }
  }
  for (const extra of [{ operationId: "bad" }, { projectId: "bad" }, { destinationCategoryId: "" },
    { destinationCategoryId: null }, { expectedRevision: -1 }, { expectedRevision: 1.5 },
    { expectedRevision: Number.MAX_SAFE_INTEGER + 1 }, { expectedRevision: "1" }]) {
    assert.equal((await f.api.workspace({ ...commands[0], ...extra })).error.code, "invalid_input");
  }
  for (const extra of [{ previewToken: "bad" }, { operationId: "bad" }, { action: "automatic" }, { action: "finish_staged" }]) {
    assert.equal((await f.api.workspace({ ...commands[4], ...extra })).error.code, "invalid_input");
  }
  assert.equal((await f.client.moveProjectCategory({ ...input, workspaceId: randomUUID() })).error.code, "invalid_input");
  assert.equal((await f.client.moveProjectCategory({ ...input, workspaceId: f.unrelated.workspaceId })).value.problem, "unconfigured");
  assert.equal((await f.client.moveProjectCategory({ ...input, projectId: f.otherList.projects[0].projectId })).value.problem, "project_unavailable");
  const foreignPreview = (await f.client.previewDiscovery(f.unrelated.workspaceId, undefined, "grouped")).value;
  const foreignList = (await f.client.applyDiscovery(f.unrelated.workspaceId, foreignPreview.previewToken)).value;
  assert.equal((await f.client.moveProjectCategory({ ...input, workspaceId: f.unrelated.workspaceId, expectedRevision: foreignList.revision })).value.problem, "project_unavailable");
  assert.equal((await f.client.moveProjectCategory({ ...input, destinationCategoryId: foreignList.categories[0].categoryId })).value.problem, "category_unavailable");
  assert.equal(f.calls.length, 0);
  assert.deepEqual((await f.client.listProjectCategoryMoves(f.one.workspaceId)).value.operations, []);
  const result = await f.client.moveProjectCategory({ ...input, path: "/outside", nativeIdentity: "forged", type: "workspace.renameProject" });
  assert.equal(result.value.outcome, "completed");
  assert.deepEqual(f.requests.at(-1), { ...input, type: "workspace.moveProjectCategory" });
  for (const extra of [{ destinationCategoryId: f.project.categoryId }, { expectedRevision: input.expectedRevision + 1 },
    { projectId: f.list.projects.find((p) => p.name === "Other").projectId }, { workspaceId: f.sibling.workspaceId }]) {
    assert.equal((await f.client.moveProjectCategory({ ...input, ...extra })).error.code, "invalid_input");
  }
}));

for (const action of ["retry_original", "complete_destination", "keep_original"]) {
  test(`explicit ${action} recovery uses a fresh owned token through IPC and keeps private evidence hidden`, () => fixture(async (f) => {
    const input = f.request(); f.interrupt = action === "complete_destination" ? "after" : "before";
    const uncertain = await f.client.moveProjectCategory(input);
    assert.equal(uncertain.value.outcome, "recoverable");
    const status = await f.client.getProjectCategoryMove(f.sibling.workspaceId, input.operationId);
    assert.deepEqual(status, uncertain);
    const list = await f.client.listProjectCategoryMoves(f.sibling.workspaceId);
    assert.deepEqual(list.value.operations, [uncertain.value.operation]);
    for (const workspaceId of [randomUUID(), f.unrelated.workspaceId]) {
      assert.equal((await f.client.getProjectCategoryMove(workspaceId, input.operationId)).error.code, "invalid_input");
      assert.equal((await f.client.previewProjectCategoryMoveRecovery(workspaceId, input.operationId)).error.code, "invalid_input");
    }
    assert.deepEqual((await f.client.listProjectCategoryMoves(f.unrelated.workspaceId)).value.operations, []);
    const old = (await f.client.previewProjectCategoryMoveRecovery(f.sibling.workspaceId, input.operationId)).value;
    const review = (await f.client.previewProjectCategoryMoveRecovery(f.sibling.workspaceId, input.operationId)).value;
    assert.ok(review.actions.includes(action));
    for (const [workspaceId, operationId, token, chosen] of [
      [f.one.workspaceId, input.operationId, review.previewToken, action],
      [f.unrelated.workspaceId, input.operationId, review.previewToken, action],
      [f.sibling.workspaceId, randomUUID(), review.previewToken, action],
      [f.sibling.workspaceId, input.operationId, old.previewToken, action],
      [f.sibling.workspaceId, input.operationId, review.previewToken, action === "complete_destination" ? "keep_original" : "complete_destination"],
    ]) assert.equal((await f.client.recoverProjectCategoryMove(workspaceId, operationId, token, chosen)).error.code, "stale_preview");
    f.interrupt = null;
    const offset = f.getGeneration().servicePort.sent.length;
    const recovered = await f.client.recoverProjectCategoryMove(f.sibling.workspaceId, input.operationId, review.previewToken, action);
    assert.equal(recovered.value.outcome, action === "keep_original" ? "rejected" : "completed");
    assert.equal((await f.client.recoverProjectCategoryMove(f.sibling.workspaceId, input.operationId, review.previewToken, action)).error.code, "stale_preview");
    assert.deepEqual(await f.client.moveProjectCategory(input), recovered);
    assert.deepEqual((await f.client.listProjectCategoryMoves(f.one.workspaceId)).value.operations, []);
    assert.equal(f.calls.length, action === "retry_original" ? 2 : 1);
    const messages = f.getGeneration().servicePort.sent.slice(offset);
    if (action === "keep_original") {
      assert.equal(recovered.value.problem, "kept_original");
      assert.deepEqual(f.events, []);
      assert.equal((await f.client.listProjects(f.one.workspaceId)).value.revision, f.list.revision);
    } else {
      assert.equal(messages[0].change.type, "workspace.projectsChanged");
      assert.equal(messages[1].result.value.operation.operationId, input.operationId);
      assert.deepEqual(f.events, [{ type: "workspace.projectsChanged", sourceId: f.one.sourceId,
        workspaceIds: [f.one.workspaceId, f.sibling.workspaceId], revision: f.list.revision + 1 }]);
    }
    const path = action === "keep_original" ? "Category/Original" : "Destination/Original";
    assert.equal(fs.readFileSync(join(f.root, path, "sentinel"), "utf8"), "  Original\n");
    for (const value of [uncertain, status, list, review, recovered, ...f.events]) assertPublic(value, f);
  }));
}

for (const boundary of ["pre-intent", "unfinished-original", "unfinished-destination", "completed"]) {
  test(`lost response and backend replacement at ${boundary} never replay a category move`, () => fixture(async (f) => {
    const input = f.request(), old = f.getGeneration();
    f.dropRequest = boundary === "pre-intent"; f.dropResponse = true;
    f.interrupt = boundary === "unfinished-original" ? "before" : boundary === "unfinished-destination" ? "after" : null;
    const lost = f.client.moveProjectCategory(input);
    if (boundary !== "pre-intent") assert.ok(f.droppedResponse, "response produced before transport loss");
    const calls = f.calls.length;
    const oldReview = boundary.startsWith("unfinished")
      ? (await f.client.previewProjectCategoryMoveRecovery(f.sibling.workspaceId, input.operationId)).value : null;
    await f.restart();
    assert.equal((await lost).error.code, "service_unavailable");
    assert.equal((await f.client.getBackendStatus()).state, "ready");
    assert.equal(f.calls.length, calls);
    const eventCount = f.events.length;
    if (f.droppedResponse) old.desktopPort.emit("message", { data: f.droppedResponse });
    old.desktopPort.emit("message", { data: { type: "workspace.change", change: {
      type: "workspace.projectsChanged", sourceId: f.one.sourceId, workspaceIds: [f.one.workspaceId], revision: 999 } } });
    assert.equal(f.events.length, eventCount);
    const status = await f.client.getProjectCategoryMove(f.sibling.workspaceId, input.operationId);
    const list = await f.client.listProjectCategoryMoves(f.sibling.workspaceId);
    assert.equal(f.calls.length, calls);
    assert.equal(f.requests.filter((row) => row.type === "workspace.moveProjectCategory").length, 1);
    const retry = await f.client.moveProjectCategory(input);
    if (boundary === "pre-intent") {
      assert.equal(status.error.code, "invalid_input"); assert.deepEqual(list.value.operations, []);
      assert.equal(retry.value.outcome, "completed"); assert.equal(f.calls.length, 1);
    } else if (boundary === "completed") {
      assert.deepEqual(retry, f.droppedResponse.result); assert.deepEqual(status, retry);
      assert.deepEqual(list.value.operations, []); assert.equal(f.calls.length, calls);
    } else {
      assert.equal(status.value.outcome, "recoverable"); assert.deepEqual(retry, status);
      assert.deepEqual(list.value.operations, [status.value.operation]); assert.equal(f.calls.length, calls);
      assert.equal((await f.client.recoverProjectCategoryMove(f.sibling.workspaceId, input.operationId, oldReview.previewToken, oldReview.actions[0])).error.code, "stale_preview");
      const review = (await f.client.previewProjectCategoryMoveRecovery(f.sibling.workspaceId, input.operationId)).value;
      const action = boundary === "unfinished-original" ? "retry_original" : "complete_destination";
      assert.ok(review.actions.includes(action));
      const offset = f.getGeneration().servicePort.sent.length;
      const recovered = await f.client.recoverProjectCategoryMove(f.sibling.workspaceId, input.operationId, review.previewToken, action);
      assert.equal(recovered.value.outcome, "completed");
      const messages = f.getGeneration().servicePort.sent.slice(offset);
      assert.equal(messages[0].change.type, "workspace.projectsChanged");
      assert.equal(messages.at(-1).result.value.operation.operationId, input.operationId);
      assert.deepEqual(await f.client.moveProjectCategory(input), recovered);
    }
    assert.equal((await f.client.listProjects(f.one.workspaceId)).value.revision, f.list.revision + 1);
    assert.equal(f.events.length, 1);
    assert.deepEqual(new Set(f.events[0].workspaceIds), new Set([f.one.workspaceId, f.sibling.workspaceId]));
    assert.equal(fs.readFileSync(join(f.root, "Destination/Original/sentinel"), "utf8"), "  Original\n");
    assert.deepEqual(f.requests.filter((row) => row.type === "workspace.moveProjectCategory"),
      Array(boundary.startsWith("unfinished") ? 3 : 2).fill({ ...input, type: "workspace.moveProjectCategory" }));
  }));
}

test("compiled production entry moves categories with its fixed native adapter", () => fixture(async (f) => {
  const result = await f.client.moveProjectCategory(f.request());
  assert.equal(result.value.outcome, "completed");
  assert.equal(fs.readFileSync(join(f.root, "Destination/Original/sentinel"), "utf8"), "  Original\n");
}, { productionDefault: true }));

for (const delivered of [false, true]) {
  test(`lost recovery ${delivered ? "response" : "request"} stays unresolved until explicit fresh review after backend replacement`, () => fixture(async (f) => {
    const input = f.request(); f.interrupt = "before";
    assert.equal((await f.client.moveProjectCategory(input)).value.outcome, "recoverable");
    const review = (await f.client.previewProjectCategoryMoveRecovery(f.sibling.workspaceId, input.operationId)).value;
    f.interrupt = null; f.dropType = "workspace.recoverProjectCategoryMove";
    f.dropRequest = !delivered; f.dropResponse = true;
    const old = f.getGeneration();
    const pending = f.client.recoverProjectCategoryMove(f.sibling.workspaceId, input.operationId, review.previewToken, "retry_original");
    assert.equal(f.calls.length, delivered ? 2 : 1);
    if (delivered) assert.equal(f.droppedResponse.result.value.outcome, "completed");
    await f.restart();
    assert.equal((await pending).error.code, "service_unavailable");
    if (f.droppedResponse) old.desktopPort.emit("message", { data: f.droppedResponse });
    const status = await f.client.getProjectCategoryMove(f.one.workspaceId, input.operationId);
    assert.equal(status.value.outcome, delivered ? "completed" : "recoverable");
    assert.equal(f.calls.length, delivered ? 2 : 1);
    assert.equal(f.requests.filter((row) => row.type === "workspace.recoverProjectCategoryMove").length, 1);
    assert.equal((await f.client.recoverProjectCategoryMove(f.sibling.workspaceId, input.operationId, review.previewToken, "retry_original")).error.code, "stale_preview");
    if (!delivered) {
      const fresh = (await f.client.previewProjectCategoryMoveRecovery(f.sibling.workspaceId, input.operationId)).value;
      assert.equal((await f.client.recoverProjectCategoryMove(f.sibling.workspaceId, input.operationId, fresh.previewToken, "retry_original")).value.outcome, "completed");
    }
    assert.equal(f.calls.length, 2); assert.equal(f.events.length, 1);
    assert.equal(fs.readFileSync(join(f.root, "Destination/Original/sentinel"), "utf8"), "  Original\n");
  }));
}

test("a timed-out completed move is resolved by status without automatic replay", () => fixture(async (f) => {
  const input = f.request(); f.dropResponse = true;
  assert.equal((await f.client.moveProjectCategory(input)).error.code, "service_unavailable");
  assert.equal(f.calls.length, 1);
  f.dropResponse = false;
  const status = await f.client.getProjectCategoryMove(f.one.workspaceId, input.operationId);
  assert.deepEqual(status, f.droppedResponse.result);
  assert.equal(status.value.outcome, "completed");
  assert.equal(f.requests.filter((row) => row.type === "workspace.moveProjectCategory").length, 1);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(await f.client.moveProjectCategory(input), status);
  assert.equal(f.calls.length, 1);
}));
