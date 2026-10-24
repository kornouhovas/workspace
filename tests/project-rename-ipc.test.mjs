import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Database from "better-sqlite3";
import { build } from "esbuild";
import { BackendController } from "../dist/desktop/backend-controller.mjs";
import { startServiceProcess } from "../dist/service/entry.cjs";
import { openUnconvertedEngineFixture } from "./support/unconverted-command-engines.mjs";
const openEngineService = (...args) => openUnconvertedEngineFixture(...args).engines;
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
async function fixture(mode, run, options = {}) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "rename-ipc-")));
  const root = join(directory, "root"), otherRoot = join(directory, "unrelated"), database = join(directory, "workspace.sqlite");
  const relative = (name) => mode === "grouped" ? `Category/${name}` : name;
  fs.mkdirSync(root); fs.mkdirSync(otherRoot); if (mode === "grouped") fs.mkdirSync(join(root, "Category"));
  for (const name of ["Original", "Other"]) {
    fs.mkdirSync(join(root, relative(name))); fs.writeFileSync(join(root, relative(name), "sentinel"), `  ${name}\n`);
  }
  fs.mkdirSync(join(otherRoot, "Unrelated"));
  let generation, sql;
  const f = { directory, root, database, relative, calls: [], dropRequest: false, dropResponse: false, interrupt: null,
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
      if (message.id && f.dropResponse && desktopPort.sent.some((row) => row.id === message.id && row.input.type === "workspace.renameProject")) {
        f.droppedResponse = structuredClone(message); return;
      }
      desktopPort.receive(message);
    };
    desktopPort.postMessage = (message) => {
      desktopPort.sent.push(structuredClone(message));
      if (message.input) f.requests.push(structuredClone(message.input));
      if (f.dropRequest && message.input?.type === "workspace.renameProject") return;
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
      (path, folder) => openEngineService(path, folder, undefined, observers, undefined, native), () => child.emit("exit", 0));
    generation = { parent, child, servicePort, desktopPort };
    assert.equal(await controller.start(child, desktopPort, database, {}, 2000), true);
  }
  try {
    await connect(); sql = new Database(database);
    const one = (await client.createWorkspace("One", root)).value;
    const sibling = (await client.createWorkspace("Sibling", root)).value;
    const unrelated = (await client.createWorkspace("Unrelated", otherRoot)).value;
    const preview = (await client.previewDiscovery(one.workspaceId, undefined, mode)).value;
    const list = (await client.applyDiscovery(one.workspaceId, preview.previewToken)).value;
    const otherPreview = (await client.previewDiscovery(unrelated.workspaceId, undefined, "direct")).value;
    const otherList = (await client.applyDiscovery(unrelated.workspaceId, otherPreview.previewToken)).value;
    const project = list.projects.find((row) => row.name === "Original");
    const property = (await client.createProperty(one.workspaceId, "Notes")).value;
    await client.setTextValue(one.workspaceId, project.projectId, property.propertyId, "  Exact\nТекст  ");
    Object.assign(f, { client, api, controller, ipc, sql, one, sibling, unrelated, project, list, otherList, property,
      getGeneration: () => generation,
      request: (name = "Renamed", extra = {}) => ({ workspaceId: one.workspaceId, projectId: project.projectId,
        operationId: randomUUID(), name, expectedRevision: list.revision, ...extra }),
      journal: () => sql.prepare("SELECT * FROM project_rename_operations ORDER BY operation_id").all(),
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
    sql?.close(); fs.rmSync(directory, { recursive: true, force: true });
  }
}
function assertPublic(value, f) {
  const encoded = JSON.stringify(value);
  for (const forbidden of [f.directory, "stagingRelativePath", ".workspace-rename-", "stagedIdentity", "nativeIdentity", "rootIdentity", "parentIdentity", "stack", "private failure"]) {
    assert.equal(encoded.includes(forbidden), false, forbidden);
  }
}
for (const mode of ["direct", "grouped"]) {
  test(`${mode}: all five rename requests traverse compiled entry/controller/preload/client with committed sibling events`, () => fixture(mode, async (f) => {
    const input = f.request("  Authored 📝");
    const before = f.sql.prepare("SELECT * FROM text_property_values").all();
    const result = await f.client.renameProject(input);
    assert.equal(result.value.outcome, "completed", JSON.stringify(result));
    assert.equal(result.value.project.projectId, f.project.projectId);
    assert.equal(result.value.project.categoryId, f.project.categoryId);
    assert.equal(result.value.project.name, input.name);
    const messages = f.getGeneration().servicePort.sent;
    const responseIndex = messages.findIndex((message) => message.result?.value?.operation?.operationId === input.operationId);
    const eventIndex = messages.findIndex((message) => message.change?.type === "workspace.projectsChanged");
    assert.ok(eventIndex >= 0 && eventIndex < responseIndex);
    assert.deepEqual(f.events, [{ type: "workspace.projectsChanged", sourceId: f.one.sourceId,
      workspaceIds: [f.one.workspaceId, f.sibling.workspaceId], revision: f.list.revision + 1 }]);
    const sibling = (await f.client.listProjects(f.sibling.workspaceId)).value;
    assert.equal(sibling.revision, f.list.revision + 1);
    assert.equal(sibling.projects.find((p) => p.projectId === f.project.projectId).name, input.name);
    assert.deepEqual((await f.client.listProjects(f.unrelated.workspaceId)).value, f.otherList);
    assert.deepEqual(f.sql.prepare("SELECT * FROM text_property_values").all(), before);
    assert.deepEqual(await f.client.getProjectRename(f.sibling.workspaceId, input.operationId), result);
    assert.deepEqual((await f.client.listProjectRenames(f.one.workspaceId)).value.operations, []);
    assert.deepEqual((await f.client.previewProjectRenameRecovery(f.sibling.workspaceId, input.operationId)).value.actions, []);
    assert.equal((await f.client.recoverProjectRename(f.one.workspaceId, input.operationId, randomUUID(), "retry_original")).error.code, "stale_preview");
    assert.deepEqual(await f.client.renameProject(input), result); assert.equal(f.calls.length, 1);
    assert.deepEqual(f.requests.filter((row) => row.type === "workspace.renameProject"), [input, input].map((row) => ({ ...row, type: "workspace.renameProject" })));
    const noop = await f.client.renameProject(f.request(input.name, { expectedRevision: result.value.project.revision }));
    assert.equal(noop.value.outcome, "unchanged"); assert.equal(f.calls.length, 1); assert.equal(f.events.length, 1);
    assert.equal((await f.client.renameProject(f.request("Other", { expectedRevision: result.value.project.revision }))).value.outcome, "rejected");
    assert.equal((await f.client.revealProject(f.sibling.workspaceId, f.project.projectId)).value.outcome, "dispatched");
    assert.equal(f.nativeTargets.at(-1).relativePath, f.relative(input.name));
    assert.deepEqual(f.dispatchedPaths, [join(f.root, f.relative(input.name))]);
    for (const value of [result, noop, await f.client.getProjectRename(f.one.workspaceId, input.operationId)]) assertPublic(value, f);
    assert.equal(Object.keys(f.api).some((key) => /native|shell|path|url/i.test(key)), false);
  }));
  test(`${mode}: malformed and foreign requests, altered retries and recovery token ownership remain isolated`, () => fixture(mode, async (f) => {
    const input = f.request();
    const commands = [
      { ...input, type: "workspace.renameProject" },
      { type: "workspace.listProjectRenames", workspaceId: f.one.workspaceId },
      { type: "workspace.getProjectRename", workspaceId: f.one.workspaceId, operationId: input.operationId },
      { type: "workspace.previewProjectRenameRecovery", workspaceId: f.one.workspaceId, operationId: input.operationId },
      { type: "workspace.recoverProjectRename", workspaceId: f.one.workspaceId, operationId: input.operationId, previewToken: randomUUID(), action: "retry_original" },
    ];
    for (const command of commands) {
      for (const extra of [{ path: "/outside" }, { nativeIdentity: "forged" }, { stagingRelativePath: "chosen" }, { modulePath: "chosen" }, { extra: true }, { workspaceId: "bad" }]) {
        assert.equal((await f.api.workspace({ ...command, ...extra })).error.code, "invalid_input");
      }
      const missing = { ...command }; delete missing.workspaceId;
      assert.equal((await f.api.workspace(missing)).error.code, "invalid_input");
    }
    for (const extra of [{ operationId: "bad" }, { projectId: "bad" }, { expectedRevision: -1 }, { expectedRevision: 1.5 }, { name: null }]) {
      assert.equal((await f.api.workspace({ ...commands[0], ...extra })).error.code, "invalid_input");
    }
    assert.equal((await f.api.workspace({ ...commands[4], action: "automatic" })).error.code, "invalid_input");
    assert.equal((await f.client.renameProject({ ...input, workspaceId: randomUUID() })).error.code, "invalid_input");
    for (const foreign of [{ workspaceId: f.unrelated.workspaceId }, { projectId: f.otherList.projects[0].projectId }]) {
      assert.deepEqual((await f.client.renameProject({ ...input, ...foreign })).value,
        { outcome: "rejected", problem: "project_unavailable", operation: null });
    }
    assert.equal(f.calls.length, 0); assert.deepEqual(f.journal(), []);
    f.interrupt = "after";
    const uncertain = await f.client.renameProject(input);
    assert.equal(uncertain.value.outcome, "recoverable");
    for (const extra of [{ name: "Altered" }, { expectedRevision: input.expectedRevision + 1 }, { projectId: f.list.projects.find((p) => p.name === "Other").projectId }]) {
      assert.equal((await f.client.renameProject({ ...input, ...extra })).error.code, "invalid_input");
    }
    for (const workspaceId of [randomUUID(), f.unrelated.workspaceId]) {
      assert.equal((await f.client.getProjectRename(workspaceId, input.operationId)).error.code, "invalid_input");
      assert.equal((await f.client.previewProjectRenameRecovery(workspaceId, input.operationId)).error.code, "invalid_input");
    }
    assert.deepEqual((await f.client.listProjectRenames(f.unrelated.workspaceId)).value.operations, []);
    const review = (await f.client.previewProjectRenameRecovery(f.one.workspaceId, input.operationId)).value;
    assert.deepEqual(review.actions, ["complete_destination"]); assertPublic(review, f);
    for (const workspaceId of [f.sibling.workspaceId, f.unrelated.workspaceId]) {
      assert.equal((await f.client.recoverProjectRename(workspaceId, input.operationId, review.previewToken, "complete_destination")).error.code, "stale_preview");
    }
    assert.equal((await f.client.recoverProjectRename(f.one.workspaceId, randomUUID(), review.previewToken, "complete_destination")).error.code, "stale_preview");
    assert.equal((await f.client.recoverProjectRename(f.one.workspaceId, input.operationId, review.previewToken, "keep_original")).error.code, "stale_preview");
    assert.equal((await f.client.recoverProjectRename(f.one.workspaceId, input.operationId, review.previewToken, "complete_destination")).value.outcome, "completed");
    assert.equal((await f.client.recoverProjectRename(f.one.workspaceId, input.operationId, review.previewToken, "complete_destination")).error.code, "stale_preview");
    assert.equal(f.calls.length, 1); assert.equal(f.events.length, 1);
  }));
  test(`${mode}: keep_original returns a terminal rejected receipt without another native effect or revision`, () => fixture(mode, async (f) => {
    const input = f.request(); f.interrupt = "before";
    assert.equal((await f.client.renameProject(input)).value.outcome, "recoverable");
    const review = (await f.client.previewProjectRenameRecovery(f.sibling.workspaceId, input.operationId)).value;
    assert.deepEqual(review.actions, ["retry_original", "keep_original"]);
    const kept = await f.client.recoverProjectRename(f.sibling.workspaceId, input.operationId, review.previewToken, "keep_original");
    assert.equal(kept.value.outcome, "rejected"); assert.equal(kept.value.problem, "kept_original");
    assert.equal(kept.value.operation.stage, "failed"); assertPublic(kept, f);
    assert.deepEqual(await f.client.renameProject(input), kept);
    assert.deepEqual(await f.client.getProjectRename(f.one.workspaceId, input.operationId), kept);
    assert.deepEqual((await f.client.listProjectRenames(f.sibling.workspaceId)).value.operations, []);
    assert.equal((await f.client.listProjects(f.one.workspaceId)).value.revision, f.list.revision);
    assert.deepEqual(f.events, []); assert.equal(f.calls.length, 1);
    assert.equal(fs.readFileSync(join(f.root, f.relative("Original"), "sentinel"), "utf8"), "  Original\n");
  }));
  test(`${mode}: interrupted mounted-case placement stays private and fresh recovery completes exact spelling`, (t) => fixture(mode, async (f) => {
    const original = fs.statSync(join(f.root, f.relative("Original")), { bigint: true });
    const alias = fs.existsSync(join(f.root, f.relative("original")));
    const input = f.request("original"); f.interrupt = "after";
    const uncertain = await f.client.renameProject(input);
    assert.equal(uncertain.value.outcome, "recoverable"); assertPublic(uncertain, f);
    const status = await f.client.getProjectRename(f.sibling.workspaceId, input.operationId);
    const list = await f.client.listProjectRenames(f.one.workspaceId);
    const review = (await f.client.previewProjectRenameRecovery(f.sibling.workspaceId, input.operationId)).value;
    assertPublic(status, f); assertPublic(list, f); assertPublic(review, f);
    const action = alias ? "finish_staged" : "complete_destination";
    assert.deepEqual(review.actions, [action]);
    t.diagnostic(alias ? "mountedCaseBehavior=self_alias;recovery=finish_staged" : "mountedCaseBehavior=distinct;recovery=complete_destination");
    f.interrupt = null;
    const recovered = await f.client.recoverProjectRename(f.sibling.workspaceId, input.operationId, review.previewToken, action);
    assert.equal(recovered.value.outcome, "completed"); assertPublic(recovered, f);
    assert.equal(recovered.value.project.projectId, f.project.projectId);
    assert.equal(recovered.value.project.categoryId, f.project.categoryId);
    const final = fs.statSync(join(f.root, f.relative(input.name)), { bigint: true });
    assert.deepEqual([final.dev, final.ino, final.birthtimeNs], [original.dev, original.ino, original.birthtimeNs]);
    assert.ok(fs.readdirSync(join(f.root, mode === "grouped" ? "Category" : "")).includes("original"));
    assert.equal(f.calls.length, alias ? 2 : 1); assert.equal(f.events.length, 1);
  }));
  for (const boundary of ["pre-intent", "unfinished-original", "unfinished-destination", "completed"]) {
    test(`${mode}: lost response and backend replacement at ${boundary} never replay rename`, () => fixture(mode, async (f) => {
      const input = f.request(), old = f.getGeneration();
      f.dropRequest = boundary === "pre-intent"; f.dropResponse = true;
      f.interrupt = boundary === "unfinished-original" ? "before" : boundary === "unfinished-destination" ? "after" : null;
      const lost = f.client.renameProject(input);
      assert.equal(f.journal().length, boundary === "pre-intent" ? 0 : 1);
      if (boundary !== "pre-intent") assert.ok(f.droppedResponse, "response was produced before being dropped");
      const before = f.journal(), calls = f.calls.length;
      const oldReview = boundary.startsWith("unfinished")
        ? (await f.client.previewProjectRenameRecovery(f.sibling.workspaceId, input.operationId)).value : null;
      await f.restart();
      assert.equal((await lost).error.code, "service_unavailable");
      assert.equal((await f.client.getBackendStatus()).state, "ready");
      assert.deepEqual(f.journal(), before); assert.equal(f.calls.length, calls);
      if (f.droppedResponse) old.desktopPort.emit("message", { data: f.droppedResponse });
      const status = await f.client.getProjectRename(f.sibling.workspaceId, input.operationId);
      const list = await f.client.listProjectRenames(f.sibling.workspaceId);
      assert.deepEqual(f.journal(), before); assert.equal(f.calls.length, calls);
      const retry = await f.client.renameProject(input);
      if (boundary === "pre-intent") {
        assert.equal(status.error.code, "invalid_input"); assert.deepEqual(list.value.operations, []);
        assert.equal(retry.value.outcome, "completed"); assert.equal(f.calls.length, 1);
      } else if (boundary === "completed") {
        assert.deepEqual(retry, f.droppedResponse.result); assert.deepEqual(status, retry);
        assert.deepEqual(list.value.operations, []); assert.equal(f.calls.length, calls);
      } else {
        assert.equal(status.value.outcome, "recoverable"); assert.deepEqual(retry, status);
        assert.equal(list.value.operations.length, 1); assert.equal(f.calls.length, calls);
        assert.deepEqual(f.journal(), before);
        assert.equal((await f.client.recoverProjectRename(f.sibling.workspaceId, input.operationId, oldReview.previewToken, oldReview.actions[0])).error.code, "stale_preview");
        assert.deepEqual(f.journal(), before);
        assert.equal((await f.client.revealProject(f.one.workspaceId, f.project.projectId)).value.problem, "unresolved");
        const review = (await f.client.previewProjectRenameRecovery(f.sibling.workspaceId, input.operationId)).value;
        const action = boundary === "unfinished-original" ? "retry_original" : "complete_destination";
        assert.ok(review.actions.includes(action));
        const offset = f.getGeneration().servicePort.sent.length;
        const recovered = await f.client.recoverProjectRename(f.sibling.workspaceId, input.operationId, review.previewToken, action);
        assert.equal(recovered.value.outcome, "completed");
        const messages = f.getGeneration().servicePort.sent.slice(offset);
        assert.equal(messages[0].change.type, "workspace.projectsChanged");
        assert.equal(messages.at(-1).result.value.operation.operationId, input.operationId);
        assert.equal((await f.client.revealProject(f.one.workspaceId, f.project.projectId)).value.outcome, "dispatched");
        assert.equal(f.nativeTargets.at(-1).relativePath, f.relative(input.name));
        assert.deepEqual(await f.client.renameProject(input), recovered);
      }
      assert.equal((await f.client.listProjects(f.one.workspaceId)).value.revision, f.list.revision + 1);
      assert.equal(f.events.length, 1); assert.deepEqual(new Set(f.events[0].workspaceIds), new Set([f.one.workspaceId, f.sibling.workspaceId]));
      assert.equal(fs.readFileSync(join(f.root, f.relative(input.name), "sentinel"), "utf8"), "  Original\n");
      assert.deepEqual(f.requests.filter((row) => row.type === "workspace.renameProject"),
        Array(boundary.startsWith("unfinished") ? 3 : 2).fill({ ...input, type: "workspace.renameProject" }));
    }));
  }
  for (const recovery of [false, true]) {
    test(`${mode}: pending old Reveal authorization fails after ${recovery ? "explicit recovery" : "rename"} and fresh Reveal uses completed location`, () => fixture(mode, async (f) => {
      let release, reached;
      const started = new Promise((resolve) => { reached = resolve; });
      const gate = new Promise((resolve) => { release = resolve; });
      let authorization;
      f.nativeReveal = async (_target, current, authorize) => {
        reached(); await gate; assert.equal(current(), true);
        authorization = await authorize(); return authorization;
      };
      const pending = f.client.revealProject(f.one.workspaceId, f.project.projectId);
      await started;
      const input = f.request(); f.interrupt = recovery ? "after" : null;
      const renamed = await f.client.renameProject(input);
      assert.equal(renamed.value.outcome, recovery ? "recoverable" : "completed");
      if (recovery) {
        const review = (await f.client.previewProjectRenameRecovery(f.sibling.workspaceId, input.operationId)).value;
        assert.equal((await f.client.recoverProjectRename(f.sibling.workspaceId, input.operationId, review.previewToken, "complete_destination")).value.outcome, "completed");
      }
      release();
      assert.equal((await pending).value.outcome, "rejected"); assert.equal(authorization.outcome, "rejected");
      assert.deepEqual(f.dispatchedPaths, []);
      f.nativeReveal = null;
      assert.equal((await f.client.revealProject(f.sibling.workspaceId, f.project.projectId)).value.outcome, "dispatched");
      assert.equal(f.nativeTargets.at(-1).relativePath, f.relative(input.name));
      assert.deepEqual(f.dispatchedPaths, [join(f.root, f.relative(input.name))]);
    }));
  }
}
test("compiled production entry denies unconverted rename before native dispatch", () => fixture("direct", async (f) => {
  const result = await f.client.renameProject(f.request());
  assert.equal(result.error.code,"identity_update_required");
  assert.equal(fs.existsSync(join(f.root,"Renamed")),false);
  assert.equal(fs.readFileSync(join(f.root,"Original","sentinel"),"utf8"),"  Original\n");
}, { productionDefault: true }));
