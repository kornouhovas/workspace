import {openSettingsService} from "../dist/service/settings.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { assertRuntimeCategoryCell, assertRuntimeCategoryAcknowledgment, captureRuntimeCategoryState, runtimeCategoryBinding,
  expectedRuntimeCategoryRow, assertRuntimeCategoryReceipt, assertRuntimeCategoryJournal, assertRuntimeCategoryUnchanged,
  recordRuntimeCategoryAction, assertRuntimeCategoryKeptOriginal, assertRuntimeCategoryUnavailableGuard, assertRuntimeCategoryUnavailablePreservation } from "../scripts/smoke-project-category-move-ui.mjs";

test("unavailable-category evidence distinguishes a blocked stale editor from one rejected submission", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const empty = { requests: 0, responses: 0, observerFailed: false, expired: false };
  const rejected = { ...empty, requests: 1, responses: 1, requestBindingMatches: true, operationId: id, serviceOk: true,
    responseShapeMatches: true, outcome: "rejected", problem: "category_unavailable", operationAbsent: true };
  assert.equal(assertRuntimeCategoryUnavailableGuard({ stale: true, ids: [], editorDisabled: true, submitDisabled: true, receipt: empty }), "stale_before_submission");
  assert.equal(assertRuntimeCategoryUnavailableGuard({ stale: false, ids: [id], editorDisabled: false, submitDisabled: false, receipt: rejected }), "destination_unavailable");
  for (const change of [{ requests: 2 }, { responses: 0 }, { responses: 2 }, { requestBindingMatches: false }, { operationId: "22222222-2222-4222-8222-222222222222" },
    { serviceOk: false }, { responseShapeMatches: false }, { outcome: "completed" }, { outcome: "recoverable" }, { problem: "unknown" }, { operationAbsent: false }, { observerFailed: true }, { expired: true }]) {
    assert.throws(() => assertRuntimeCategoryUnavailableGuard({ stale: true, ids: [id], editorDisabled: true, submitDisabled: true, receipt: { ...rejected, ...change } }));
  }
  assert.throws(() => assertRuntimeCategoryUnavailableGuard({ stale: true, ids: [], editorDisabled: true, submitDisabled: true, receipt: { ...empty, requests: 1 } }));
  for (const invalid of [
    { stale: true, ids: [id], editorDisabled: true, submitDisabled: true },
    { stale: true, ids: [], editorDisabled: false, submitDisabled: true },
    { stale: true, ids: [], editorDisabled: true, submitDisabled: false },
    { stale: false, ids: [], editorDisabled: false, submitDisabled: false },
    { stale: false, ids: [id, id], editorDisabled: false, submitDisabled: false },
    { stale: false, ids: ["malformed"], editorDisabled: false, submitDisabled: false },
  ]) assert.throws(() => assertRuntimeCategoryUnavailableGuard(invalid), { name: "AssertionError" });
});

test("post-submission stale text accepts only the exact bound unavailable rejection", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const receipt = { requests: 1, requestBindingMatches: true, operationId: id, responses: 1,
    serviceOk: true, responseShapeMatches: true, outcome: "rejected", problem: "category_unavailable", operationAbsent: true,
    observerFailed: false, expired: false };
  for (const problem of ["category_unavailable", "source_unavailable", "stale_configuration", "filesystem_changed"]) {
    assert.equal(assertRuntimeCategoryUnavailableGuard({ stale: true, ids: [id], editorDisabled: true, submitDisabled: true, receipt: { ...receipt, problem } }), "rejected_before_stale");
  }
});

test("bound stale-code rejection retains an enabled draft without proving source invalidation", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const receipt = { requests: 1, requestBindingMatches: true, operationId: id, responses: 1,
    serviceOk: true, responseShapeMatches: true, outcome: "rejected", problem: "filesystem_changed", operationAbsent: true,
    observerFailed: false, expired: false };
  const input = { stale: true, ids: [id], editorDisabled: false, submitDisabled: false, receipt };
  for (const problem of ["filesystem_changed", "stale_configuration"])
    assert.equal(assertRuntimeCategoryUnavailableGuard({...input, receipt: {...receipt, problem}}), "rejected_with_stale_feedback");
  for (const change of [{editorDisabled:true}, {submitDisabled:true}, {ids:[]},
    {receipt:{...receipt,problem:"category_unavailable"}}, {receipt:{...receipt,operationAbsent:false}},
    {receipt:{...receipt,responses:0}}, {receipt:{...receipt,requestBindingMatches:false}}])
    assert.throws(()=>assertRuntimeCategoryUnavailableGuard({...input,...change}));
});

test("unavailable-category proof rejects effects beyond the deliberate missing empty category", () => {
  const projection = { revision: 2, projects: [{ projectId: "project", relativePath: "Destination/project" }], categories: [{ categoryId: "current" }, { categoryId: "missing" }] };
  const before = { durable: { journal: [], metadata: { projects: ["unchanged"], settings: ["unchanged"] }, tree: "before", otherTree: "other" },
    projects: projection, sibling: { ...projection, workspaceId: "sibling" }, other: "other", text: "text", siblingText: "siblingText", otherText: "otherText", configurations: "configurations", settings: "settings", events: [] };
  const after = structuredClone(before); after.durable.tree = "post-removal";
  for (const key of ["projects", "sibling"]) after[key].categories = [{ categoryId: "current" }];
  assertRuntimeCategoryUnavailablePreservation(before, after, "post-removal", "missing");
  for (const path of [["durable", "journal"], ["durable", "metadata"], ["durable", "tree"], ["durable", "otherTree"],
    ["projects"], ["sibling"], ["other"], ["text"], ["siblingText"], ["otherText"], ["configurations"], ["settings"], ["events"]]) {
    const broken = structuredClone(after); let target = broken;
    for (const key of path.slice(0, -1)) target = target[key];
    target[path.at(-1)] = "unexpected effect";
    assert.throws(() => assertRuntimeCategoryUnavailablePreservation(before, broken, "post-removal", "missing"));
  }
});

const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, getComputedStyle: browser.getComputedStyle.bind(browser), CustomEvent: browser.CustomEvent, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { render, screen, cleanup, within } = await import("@testing-library/react");
const { TextPropertiesTable } = await import("../src/renderer/components/TextPropertiesTable.tsx");
const { findAction } = await import("./context-tools-driver.ts");
const {default:toolsUser}=await import("@testing-library/user-event");
const { translate } = await import("../src/renderer/localization.ts");
test.afterEach(cleanup);

// Testing Library's real role queries adapt the production table DOM to the
// driver's small Playwright locator surface. No mocked authored cell contents.
function locator(value) {
  const nodes = Array.isArray(value) ? value : [value];
  return {
    nodes,
    getByRole: (role, options) => locator(nodes.flatMap(node => within(node).queryAllByRole(role, {...options,hidden:options?.includeHidden}))),
    filter: ({ has, hasText }) => locator(nodes.filter(node => has ? has.nodes.some(child => node.contains(child)) : node.textContent.includes(hasText))),
    locator: selector => selector === ".." ? locator(nodes.map(node => node.parentElement)) : locator(nodes.flatMap(node=>[...node.querySelectorAll(selector)])),
    nth: index=>locator(nodes[index]),
    evaluate: async fn => { assert.equal(nodes.length, 1); return fn(nodes[0]); },
    waitFor: async () => assert.equal(nodes.length, 1),
    count: async () => nodes.length,
    isDisabled: async () => nodes[0].disabled,
  };
}
for (const language of ["en", "ru"]) test(`${language}: runtime category cell binds authored text and eligible action to the intended production project row`, async () => {
  const project = { projectId: "p", name: "Authored 📝", categoryId: "c", relativePath: "Category/Authored 📝", associationState: "active", resolution: "active" };
  const client = { listTextProperties: async () => ({ ok: true, value: { workspaceId: "w", sourceId: "s", revision: 0, definitions: [], values: [] } }), onBackendStatus: () => () => {}, onWorkspaceChange: () => () => {} };
  let moved;
  render(React.createElement(TextPropertiesTable, { client, workspaceId: "w", sourceId: "s", projects: [project, { ...project, projectId: "other", name: "Other" }, { ...project, projectId: "duplicate", categoryId: "d" }], categories: [{ categoryId: "c", name: "  Exact категория  " }, { categoryId: "d", name: "Different" }], categoryProperty: { propertyId: "label", sourceId: "s", name: "Label" }, language, disabled: false, onMoveCategory: value => { moved = value; } }));
  await findAction("button", { name: `${translate(language, "moveCategory")}: Other` });
  const page = { getByRole: (role, options) => locator(screen.queryAllByRole(role,{...options,hidden:options?.includeHidden})), locator:selector=>locator([...globalThis.document.querySelectorAll(selector)]) };
  await assertRuntimeCategoryCell(page, project.name, "  Exact категория  ", translate(language, "moveCategory"));
  const cell = await assertRuntimeCategoryCell(page, project.name, "  Exact категория  ", translate(language, "moveCategory"));
  const move=await cell.locator("..").getByRole("button",{name:`${translate(language,"moveCategory")}: ${project.name}`,includeHidden:true}).evaluate(node=>node);
  await toolsUser.click(globalThis.document.getElementById(move.closest("[data-context-return]").dataset.contextReturn));
  await toolsUser.click(move);
  assert.equal(moved.projectId, "p");
  await assert.rejects(assertRuntimeCategoryCell(page, project.name, "Wrong category", translate(language, "moveCategory")));
});

for (const language of ["en", "ru"]) test(`${language}: retained grouped and direct production rows never expose category moves`, async () => {
  const project = { projectId: "p", name: "Retained", categoryId: "c", relativePath: "Category/Retained", categoryName: "Exact category", associationState: "missing", resolution: "missing" };
  const client = { listTextProperties: async () => ({ ok: true, value: { workspaceId: "w", sourceId: "s", revision: 0, definitions: [], values: [] } }), onBackendStatus: () => () => {}, onWorkspaceChange: () => () => {} };
  const props = { client, workspaceId: "w", sourceId: "s", language, disabled: false, onMoveCategory: () => assert.fail("Retained/direct move must be unavailable") };
  const grouped = render(React.createElement(TextPropertiesTable, { ...props, projects: [], retainedProjects: [project], categoryProperty: { propertyId: "c", sourceId: "s", name: "Category" } }));
  const row = (await screen.findByText("Retained")).closest("tr");
  assert.equal(row.querySelectorAll("td")[1].textContent, "Exact category");
  assert.equal(within(row).queryAllByRole("button", { name: new RegExp(translate(language, "moveCategory")) }).length, 0);
  grouped.unmount();
  render(React.createElement(TextPropertiesTable, { ...props, projects: [{ ...project, name: "Direct", categoryId: null, associationState: "active", resolution: "active" }], categoryProperty: null }));
  const direct = (await screen.findByText("Direct")).closest("tr");
  assert.equal(direct.querySelectorAll("td").length, 2);
  assert.equal(within(direct).queryAllByRole("button", { name: new RegExp(translate(language, "moveCategory")) }).length, 0);
});

import { assertCategoryMoveAcceptance, createCategoryMoveEvidence, recordCategoryMoveEvidence } from "../scripts/runtime-evidence.mjs";
const inputs = { sourceRevision: "a".repeat(40), inputDigest: "b".repeat(64), mode: "dev", platform: "darwin", arch: "arm64", node: "v22.21.1" };
test("category recovery evidence names all controlled checkpoints and rejects absent recovery", () => {
  const evidence = createCategoryMoveEvidence(inputs);
  for (const language of ["en", "ru"]) {
    assert.deepEqual(Object.keys(evidence[language].recovery).sort(), ["commit", "destination_evidence", "intent", "keep_original", "native_effect"]);
    for (const checkpoint of Object.values(evidence[language].recovery)) {
      assert.deepEqual(Object.keys(checkpoint).sort(), ["preparation", "preservation", "resolution", "restartNoReplay", "restartPersistence"]);
      assert.ok(Object.values(checkpoint).every(stage => stage.status === "unreached"));
    }
  }
});
function completedEvidence() {
  const evidence = createCategoryMoveEvidence(inputs);
  for (const language of ["en", "ru"]) {
    for (const stage of Object.keys(evidence[language]).filter(key => key !== "recovery")) recordCategoryMoveEvidence(evidence[language], stage, { status: "passed", asserted: true });
    for (const [checkpoint, recovery] of Object.entries(evidence[language].recovery)) {
      for (const stage of Object.keys(recovery)) recordCategoryMoveEvidence(recovery, stage, { status: "passed", asserted: true });
      Object.assign(recovery.preparation, { kind: "controlled_fixture_preparation", checkpoint: checkpoint === "keep_original" ? "intent" : checkpoint,
        stage: checkpoint === "commit" ? "completed" : checkpoint === "destination_evidence" ? "destination_recorded" : "intent", workerExited: true, cleanupExecuted: false });
      Object.assign(recovery.resolution, { action: checkpoint === "commit" ? null : checkpoint === "keep_original" ? "keep_original" : checkpoint === "intent" ? "retry_original" : "complete_destination",
        mutationRequired: checkpoint !== "commit", freshAdvertisedAction: checkpoint !== "commit", outcome: checkpoint === "keep_original" ? "rejected" : "completed" });
    }
  }
  recordCategoryMoveEvidence(evidence, "isolation", { status: "passed", asserted: true });
  recordCategoryMoveEvidence(evidence, "normalShutdown", { status: "passed", asserted: true, normalQuit: true, backendExit: true, forcedCleanup: false, invocations: 34 });
  recordCategoryMoveEvidence(evidence, "fixtureCleanup", { status: "passed", asserted: true, processesStopped: true, removed: true });
  return evidence;
}
test("category move evidence requires every named EN/RU assertion, exact inputs and normal lifecycle", () => {
  assert.throws(() => assertCategoryMoveAcceptance(createCategoryMoveEvidence(inputs), inputs), /unreached/);
  const complete = completedEvidence(); assert.doesNotThrow(() => assertCategoryMoveAcceptance(complete, inputs));
  for (const language of ["en", "ru"]) for (const stage of Object.keys(complete[language]).filter(key => key !== "recovery")) {
    for (const status of ["failed", "skipped", "pending", "unreached"]) {
      const value = structuredClone(complete); value[language][stage].status = status;
      assert.throws(() => assertCategoryMoveAcceptance(value, inputs), new RegExp(status));
    }
    const missing = structuredClone(complete); delete missing[language][stage];
    assert.throws(() => assertCategoryMoveAcceptance(missing, inputs), /shape|missing/);
    const unasserted = structuredClone(complete); unasserted[language][stage].asserted = false;
    assert.throws(() => assertCategoryMoveAcceptance(unasserted, inputs), /acceptance/);
  }
  for (const stage of ["isolation", "normalShutdown", "fixtureCleanup"]) {
    const value = structuredClone(complete); value[stage].status = "failed";
    assert.throws(() => assertCategoryMoveAcceptance(value, inputs), /failed/);
  }
  for (const key of Object.keys(inputs)) {
    const wrong = { ...inputs, [key]: key === "mode" ? "release" : key === "platform" ? "win32" : key === "arch" ? "x64" : key === "node" ? "v24.1.0" : "c".repeat(inputs[key].length) };
    assert.throws(() => assertCategoryMoveAcceptance(complete, wrong), /identity/);
  }
  for (const patch of [{ normalQuit: false }, { backendExit: false }, { forcedCleanup: true }, { invocations: 0 }]) {
    const value = structuredClone(complete); Object.assign(value.normalShutdown, patch);
    assert.throws(() => assertCategoryMoveAcceptance(value, inputs), /shutdown/);
  }
  for (const patch of [{ processesStopped: false }, { removed: false }]) {
    const value = structuredClone(complete); Object.assign(value.fixtureCleanup, patch);
    assert.throws(() => assertCategoryMoveAcceptance(value, inputs), /cleanup/);
  }
  const extra = structuredClone(complete); extra.en.extra = { status: "passed", asserted: true };
  assert.throws(() => assertCategoryMoveAcceptance(extra, inputs), /shape/);
  assert.throws(() => assertCategoryMoveAcceptance(complete), /identity/);
});
test("category evidence cannot promote failed/skipped assertions or accept unknown/unasserted stages", () => {
  const evidence = createCategoryMoveEvidence(inputs);
  for (const status of ["failed", "skipped"]) {
    recordCategoryMoveEvidence(evidence.en, "submission", { status });
    assert.throws(() => recordCategoryMoveEvidence(evidence.en, "submission", { status: "passed", asserted: true }), /promote/);
    assert.throws(() => recordCategoryMoveEvidence(evidence.en, "submission", { status: "pending" }), /promote/);
    evidence.en.submission = { status: "unreached" };
  }
  assert.throws(() => recordCategoryMoveEvidence(evidence.en, "occupied", { status: "passed" }), /assertion/);
  assert.throws(() => recordCategoryMoveEvidence(evidence.en, "unknown", { status: "passed", asserted: true }), /Unknown/);
  assert.throws(() => recordCategoryMoveEvidence(evidence.en, "occupied", { status: "anything" }), /status/);
});

test("category recovery acceptance fails for every missing or unsuccessful assertion, wrong preparation and wrong UI action", () => {
  const complete = completedEvidence();
  for (const language of ["en", "ru"]) for (const [checkpoint, recovery] of Object.entries(complete[language].recovery)) {
    for (const stage of Object.keys(recovery)) {
      for (const status of ["failed", "skipped", "pending", "unreached"]) {
        const value = structuredClone(complete); value[language].recovery[checkpoint][stage].status = status;
        assert.throws(() => assertCategoryMoveAcceptance(value, inputs), new RegExp(status));
      }
      for (const fault of ["missing", "unasserted"]) {
        const value = structuredClone(complete);
        if (fault === "missing") delete value[language].recovery[checkpoint][stage];
        else value[language].recovery[checkpoint][stage].asserted = false;
        assert.throws(() => assertCategoryMoveAcceptance(value, inputs), /shape|missing|acceptance/);
      }
      const value = structuredClone(complete);
      recordCategoryMoveEvidence(value[language].recovery[checkpoint], stage, { status: "failed" });
      assert.throws(() => recordCategoryMoveEvidence(value[language].recovery[checkpoint], stage, { status: "passed", asserted: true }), /promote/);
    }
    for (const patch of [{ kind: "normal_shutdown" }, { checkpoint: "wrong" }, { stage: "uncertain" }, { workerExited: false }, { cleanupExecuted: true }]) {
      const value = structuredClone(complete); Object.assign(value[language].recovery[checkpoint].preparation, patch);
      assert.throws(() => assertCategoryMoveAcceptance(value, inputs), /preparation/);
    }
    for (const patch of [{ action: "wrong" }, { mutationRequired: checkpoint === "commit" }, { outcome: "recoverable" }, ...(checkpoint === "commit" ? [] : [{ freshAdvertisedAction: false }])]) {
      const value = structuredClone(complete); Object.assign(value[language].recovery[checkpoint].resolution, patch);
      assert.throws(() => assertCategoryMoveAcceptance(value, inputs), /resolution/);
    }
    const missing = structuredClone(complete); delete missing[language].recovery[checkpoint];
    assert.throws(() => assertCategoryMoveAcceptance(missing, inputs), /shape/);
  }
  const missing = structuredClone(complete); delete missing.en.recovery;
  assert.throws(() => assertCategoryMoveAcceptance(missing, inputs), /shape/);
  const short = structuredClone(complete); short.normalShutdown.invocations = 33;
  assert.throws(() => assertCategoryMoveAcceptance(short, inputs), /shutdown/);
});

test("Windows-policy driver fixture completes current-category and native moves with exact authored identity and Text", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { randomUUID } = await import("node:crypto");
  const { seedCategoryMoveFixture, categoryMoveInventory } = await import("../scripts/smoke-project-category-move-ui.mjs");
  const { nativeProjectFilesystem } = await import("../src/service/project-filesystem.ts");
  const { renameNoReplace } = await import("../dist/service/project-rename-filesystem.mjs");
  const fixture = await mkdtemp(join(tmpdir(), "category-driver-windows-policy-"));
  let service;
  try {
    const setup = await seedCategoryMoveFixture(join(fixture, "data"), "win32");
    let nativeCalls = 0;
    service = openSettingsService(setup.database, undefined, undefined, undefined,
      { ...nativeProjectFilesystem, platform: "win32" }, (from, to) => { nativeCalls++; return renameNoReplace(from, to); });
    const request = { type: "workspace.moveProjectCategory", workspaceId: setup.workspace.workspaceId, projectId: setup.project.projectId,
      operationId: randomUUID(), destinationCategoryId: setup.project.categoryId, expectedRevision: setup.projection.revision };
    const noop = service.handleCommand(request);
    assert.equal(noop.ok, true);
    assert.equal(noop.value.outcome, "unchanged");
    assert.equal(noop.value.operation.name, "  Exact 日本語 📝");
    assert.equal(nativeCalls, 0);
    assert.deepEqual(await categoryMoveInventory(setup.sourceRoot), setup.tree);
    const destination = setup.projection.categories.find(c => c.name === "Destination");
    const moved = service.handleCommand({ ...request, operationId: randomUUID(), destinationCategoryId: destination.categoryId });
    assert.equal(moved.ok, true); assert.equal(moved.value.outcome, "completed");
    assert.equal(nativeCalls, 1);
    assert.equal(moved.value.project.projectId, setup.project.projectId);
    assert.equal(moved.value.project.relativePath, "Destination/  Exact 日本語 📝");
    assert.deepEqual(await categoryMoveInventory(join(setup.sourceRoot, moved.value.project.relativePath)), setup.projectTree);
    assert.deepEqual(service.handleQuery({ type: "workspace.listTextProperties", workspaceId: setup.workspace.workspaceId }).value, setup.properties);
    assert.deepEqual(await categoryMoveInventory(setup.otherRoot), setup.otherTree);
  } finally { service?.close(); await rm(fixture, { recursive: true, force: true }); }
});

test("real driver-owned grouped SQLite fixture reopens read-only with identities, exact Text, labels and independent views", async () => {
  const { mkdtemp, rm, symlink, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { seedCategoryMoveFixture, categoryMoveInventory, categoryMoveMetadata } = await import("../scripts/smoke-project-category-move-ui.mjs");
  const { openSettingsService } = await import("../dist/service/settings.mjs");
  const fixture = await mkdtemp(join(tmpdir(), "category-move-driver-test-"));
  try {
    const setup = await seedCategoryMoveFixture(join(fixture, "data"));
    assert.equal(setup.workspace.sourceId, setup.sibling.sourceId);
    assert.notEqual(setup.workspace.sourceId, setup.other.sourceId);
    assert.notEqual(setup.workspace.viewId, setup.sibling.viewId);
    assert.equal(setup.project.name, process.platform === "win32" ? "  Exact 日本語 📝" : "  Exact 日本語 📝  ");
    assert.equal(setup.projection.categories.length, 4);
    assert.equal(setup.projection.categoryProperty.name, "  Exact category label 📝  ");
    assert.equal(setup.properties.values[0].value, "  Exact\nТекст\t  ");
    assert.equal(new Set(setup.metadata.views.map(view => view.name)).size, 3);
    for (let attempt = 0; attempt < 2; attempt++) {
      const service = openSettingsService(setup.database);
      try {
        const read = input => { const result = service.handleQuery(input); assert.equal(result.ok, true); return result.value; };
        assert.deepEqual(read({ type: "workspace.listProjects", workspaceId: setup.workspace.workspaceId }), setup.projection);
        assert.deepEqual(read({ type: "workspace.listProjects", workspaceId: setup.sibling.workspaceId }), { ...setup.projection, workspaceId: setup.sibling.workspaceId });
        assert.deepEqual(read({ type: "workspace.listTextProperties", workspaceId: setup.workspace.workspaceId }), setup.properties);
        assert.deepEqual(read({ type: "workspace.listProjects", workspaceId: setup.other.workspaceId }), setup.otherProjection);
        assert.deepEqual(read({ type: "workspace.load" }), setup.configurations);
        assert.deepEqual(read({ type: "workspace.listProjectCategoryMoves", workspaceId: setup.workspace.workspaceId }).operations, []);
      } finally { service.close(); }
      assert.deepEqual(await categoryMoveMetadata(setup.database), setup.metadata);
      assert.deepEqual(await categoryMoveInventory(setup.sourceRoot), setup.tree);
      assert.deepEqual(await categoryMoveInventory(setup.otherRoot), setup.otherTree);
    }
    await writeFile(join(setup.sourceRoot, "Current", setup.project.name, "sentinel"), "changed bytes");
    assert.notDeepEqual(await categoryMoveInventory(setup.sourceRoot), setup.tree);
    await symlink(setup.otherRoot, join(setup.sourceRoot, "link"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(categoryMoveInventory(setup.sourceRoot), /No-follow/);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test("owned category interruption worker reaches real durable boundaries and read-only reopening never replays", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { randomUUID } = await import("node:crypto");
  const { seedCategoryMoveFixture, interruptCategoryMoveFixture, categoryMoveInventory, categoryMoveMetadata } = await import("../scripts/smoke-project-category-move-ui.mjs");
  const { ownedProcessesStopped } = await import("../scripts/runtime-lifecycle.mjs");
  const { openSettingsService } = await import("../dist/service/settings.mjs");
  const fixture = await mkdtemp(join(tmpdir(), "category-recovery-driver-test-")), children = new Set();
  try {
    for (const [checkpoint, stage, placement] of [["intent", "intent", "Current"], ["native_effect", "intent", "Destination"], ["destination_evidence", "destination_recorded", "Destination"], ["commit", "completed", "Destination"]]) {
      const setup = await seedCategoryMoveFixture(join(fixture, checkpoint));
      setup.request = { type: "workspace.moveProjectCategory", workspaceId: setup.workspace.workspaceId, projectId: setup.project.projectId,
        operationId: randomUUID(), destinationCategoryId: setup.projection.categories.find(c => c.name === "Destination").categoryId, expectedRevision: setup.projection.revision };
      const result = await interruptCategoryMoveFixture(setup, checkpoint, children);
      assert.equal(result.kind, "controlled_fixture_preparation"); assert.equal(result.checkpoint, checkpoint);
      assert.equal(result.stage, stage); assert.equal(result.workerExited, true); assert.equal(result.cleanupExecuted, false);
      assert.equal(ownedProcessesStopped(children, new Set()), true);
      const before = await categoryMoveMetadata(setup.database), tree = await categoryMoveInventory(setup.sourceRoot);
      for (let attempt = 0; attempt < 2; attempt++) {
        const service = openSettingsService(setup.database);
        try {
          const status = service.handleQuery({ type: "workspace.getProjectCategoryMove", workspaceId: setup.sibling.workspaceId, operationId: setup.request.operationId });
          assert.equal(status.ok, true); assert.equal(status.value.operation.stage, stage);
          assert.equal(status.value.operation.projectId, setup.project.projectId);
          assert.equal(status.value.outcome, checkpoint === "commit" ? "completed" : "recoverable");
          assert.equal(service.handleQuery({ type: "workspace.listProjectCategoryMoves", workspaceId: setup.workspace.workspaceId }).value.operations.length, checkpoint === "commit" ? 0 : 1);
          assert.equal(service.handleQuery({ type: "workspace.listProjects", workspaceId: setup.sibling.workspaceId }).ok, true);
        } finally { service.close(); }
        assert.deepEqual(await categoryMoveMetadata(setup.database), before);
        assert.deepEqual(await categoryMoveInventory(setup.sourceRoot), tree);
        assert.deepEqual(await categoryMoveInventory(join(setup.sourceRoot, placement, setup.project.name)), setup.projectTree);
      }
    }
    const invalid = await seedCategoryMoveFixture(join(fixture, "invalid"));
    invalid.request = { operationId: "invalid" };
    await assert.rejects(interruptCategoryMoveFixture(invalid, "intent", children), /checkpoint/);
    assert.deepEqual(await categoryMoveMetadata(invalid.database), invalid.metadata);
    assert.deepEqual(await categoryMoveInventory(invalid.sourceRoot), invalid.tree);
    await assert.rejects(interruptCategoryMoveFixture({}, "wrong", children), /checkpoint/);
  } finally {
    assert.equal(ownedProcessesStopped(children, new Set()), true);
    await rm(fixture, { recursive: true, force: true });
  }
});

test("CI runs category layouts once and retains failures while regular runtimes own category acceptance", async () => {
  const { readFile } = await import("node:fs/promises");
  const { load } = await import("js-yaml");
  const workflow = load(await readFile(new URL("../.github/workflows/desktop-ci.yml", import.meta.url), "utf8"));
  const steps = workflow.jobs.verify.steps;
  assert.deepEqual(workflow.jobs.verify.strategy.matrix.include.map(row => row.os), ["macos-latest", "windows-latest", "windows-2022"]);
  const layouts = steps.filter(step => step.run === "node scripts/smoke-discovery-layouts.mjs --category-move");
  assert.equal(layouts.length, 1);
  assert.equal(layouts[0].env.WORKSPACE_SMOKE_EVIDENCE_DIR, "work/ci-category-move-layouts");
  const upload = steps.find(step => step.uses === "actions/upload-artifact@v4" && step.with.path.includes("work/ci-category-move-layouts/"));
  assert.equal(upload?.if, "always()");
  assert.ok(upload.with.path.includes("work/ci-runtime-*/"));
  for (const mode of ["dev", "release"]) {
    const normal = steps.filter(step => step.run === `npm run smoke:runtime -- ${mode}`);
    assert.equal(normal.length, 1);
    assert.equal(normal[0].if, undefined);
    assert.equal(normal[0].env.WORKSPACE_SMOKE_EVIDENCE_DIR, `work/ci-runtime-${mode}`);
  }
  assert.equal(steps.filter(step => /smoke:runtime.*--category-move/.test(step.run ?? "")).length, 0);
});

// Real service/SQLite/native trees supply the positive receipt and independent
// state. Altered evidence is rejected before the acknowledgment seam is reached.
test("current-category durable proof binds one actual operation and rejects every changed receipt/state", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { randomUUID } = await import("node:crypto");
  const { seedCategoryMoveFixture } = await import("../scripts/smoke-project-category-move-ui.mjs");
  const fixture = await mkdtemp(join(tmpdir(), "category-noop-proof-"));
  const savedApi = globalThis.window.workspace, savedEvents = globalThis.categoryMoveEvents;
  let service;
  try {
    const setup = await seedCategoryMoveFixture(join(fixture, "data"));
    service = openSettingsService(setup.database);
    globalThis.categoryMoveEvents = [];
    globalThis.window.workspace = { workspace: input => service.handleQuery(input), settings: input => service.handleQuery(input) };
    const page = { evaluate: async (fn, input) => fn(input) };
    const before = await captureRuntimeCategoryState(page, setup);
    const binding = runtimeCategoryBinding(before, setup.project.projectId, setup.project.categoryId);
    const id = randomUUID();
    const result = service.handleCommand({ type: "workspace.moveProjectCategory", workspaceId: binding.workspaceId,
      projectId: binding.projectId, operationId: id, destinationCategoryId: binding.destinationCategoryId, expectedRevision: binding.expectedRevision });
    const after = await captureRuntimeCategoryState(page, setup);
    const row = expectedRuntimeCategoryRow(before, binding, id, "unchanged");
    assertRuntimeCategoryJournal(before.durable.journal, after.durable.journal, row);
    assert.deepEqual(assertRuntimeCategoryUnchanged(before, after, binding, id, result), result.value);
    for (let attempt = 0; attempt < 2; attempt++) {
      const status = service.handleQuery({ type: "workspace.getProjectCategoryMove", workspaceId: binding.workspaceId, operationId: id });
      assertRuntimeCategoryUnchanged(before, await captureRuntimeCategoryState(page, setup), binding, id, status);
    }
    const reject = (state = after, receipt = result, authored = binding, operationId = id) => assert.throws(() => assertRuntimeCategoryUnchanged(before, state, authored, operationId, receipt));
    assert.throws(() => assertRuntimeCategoryUnchanged(before, after, binding, id, undefined));
    for (const invalid of [null, {}, { ok: false }, { ok: true }, { ok: true, value: null }]) reject(after, invalid);
    for (const key of Object.keys(result.value.operation)) {
      const changed = structuredClone(result); changed.value.operation[key] = key === "expectedRevision" || key === "completedRevision" ? 999 : "foreign";
      reject(after, changed);
    }
    for (const key of Object.keys(result.value.project)) {
      const changed = structuredClone(result); changed.value.project[key] = key === "revision" ? 999 : "foreign"; reject(after, changed);
    }
    for (const outcome of ["completed", "recoverable", "rejected", "unknown"]) {
      const changed = structuredClone(result); changed.value.outcome = outcome; reject(after, changed);
    }
    for (const stage of ["intent", "destination_recorded", "uncertain", "failed"]) {
      const changed = structuredClone(result); changed.value.operation.stage = stage; reject(after, changed);
    }
    for (const key of Object.keys(binding)) reject(after, result, { ...binding, [key]: key === "expectedRevision" ? 999 : "foreign" });
    reject(after, result, binding, randomUUID());
    for (const key of Object.keys(row)) {
      const changed = structuredClone(after); changed.durable.journal[0][key] = "changed"; reject(changed);
    }
    for (const key of Object.keys(after).filter(key => key !== "durable")) {
      const changed = structuredClone(after); changed[key] = null; reject(changed);
    }
    for (const table of Object.keys(after.durable.metadata)) {
      const changed = structuredClone(after); changed.durable.metadata[table].push({ foreign: true }); reject(changed);
    }
    for (const key of ["tree", "otherTree"]) {
      const changed = structuredClone(after); changed.durable[key].children[0][1].identity.ino = "999"; reject(changed);
      const bytes = structuredClone(after); bytes.durable[key].children.push(["extra", { bytes: "00" }]); reject(bytes);
    }
    const extra = structuredClone(after); extra.durable.journal.push({ ...row, operation_id: randomUUID() }); reject(extra);
    const absent = structuredClone(after); absent.durable.journal = []; reject(absent);
    const replayed = structuredClone(before); replayed.durable.journal = after.durable.journal;
    assert.throws(() => assertRuntimeCategoryUnchanged(replayed, after, binding, id, result));
    // A completed/moved receipt cannot satisfy no-op, even with coherent fields.
    const moved = structuredClone(result); moved.value.outcome = "completed"; moved.value.operation.resultKind = "completed";
    moved.value.operation.lastVerifiedPlacement = "destination"; moved.value.operation.completedRevision++;
    moved.value.project.revision++; reject(after, moved);
    // Existing history must remain byte-for-byte equal, rather than selecting
    // whichever row happens to be newest or happens to look successful.
    const withHistory = structuredClone(before); withHistory.durable.journal = [{ ...row, operation_id: randomUUID() }];
    const historicalAfter = structuredClone(after); historicalAfter.durable.journal = structuredClone([...withHistory.durable.journal, row]).sort((a, b) => a.operation_id.localeCompare(b.operation_id));
    assertRuntimeCategoryUnchanged(withHistory, historicalAfter, binding, id, result);
    historicalAfter.durable.journal.find(entry => entry.operation_id !== id).problem = "changed";
    assert.throws(() => assertRuntimeCategoryUnchanged(withHistory, historicalAfter, binding, id, result));
    assert.throws(() => assertRuntimeCategoryJournal(after.durable.journal, after.durable.journal, row), /correlated|Expected/);
    assert.doesNotThrow(() => assertRuntimeCategoryJournal(after.durable.journal, after.durable.journal, row, true));
    assert.throws(() => assertRuntimeCategoryReceipt(result, { ...row, result_kind: "completed" }));
  } finally {
    service?.close(); globalThis.window.workspace = savedApi; globalThis.categoryMoveEvents = savedEvents;
    await rm(fixture, { recursive: true, force: true });
  }
});

for (const language of ["en", "ru"]) for (const outcome of ["unchanged", "completed"]) test(`${language}: ${outcome} acknowledgment requires proof before ordinary/guarded exact text and detachment`, async () => {
  const ordinary = translate(language, outcome === "unchanged" ? "moveCategoryUnchanged" : "moveCategorySaved");
  const guarded = translate(language, "moveCategoryNewer");
  let messages = [ordinary], proof = false, editor = 0, review = 0;
  const receipt = { outcome, operation: { stage: "completed", resultKind: outcome } };
  const page = { locator: selector => selector === ".project-category-move" ? { evaluate: async () => { assert.equal(proof, true); return messages; } }
    : { count: async () => selector === "#project-category-move-destination" ? editor : review } };
  const prove = async () => { proof = true; return receipt; };
  await assertRuntimeCategoryAcknowledgment(page, language, outcome, prove);
  messages = [guarded]; proof = false; await assertRuntimeCategoryAcknowledgment(page, language, outcome, prove);
  await assert.rejects(assertRuntimeCategoryAcknowledgment(page, language, outcome), /proof/);
  proof = false;
  await assert.rejects(assertRuntimeCategoryAcknowledgment(page, language, outcome, async () => { throw new Error("Invalid durable proof"); }), /Invalid durable proof/);
  assert.equal(proof, false);
  for (messages of [[], [ordinary, guarded], [guarded + " "], [translate(language, outcome === "unchanged" ? "moveCategorySaved" : "moveCategoryUnchanged")], [translate(language, "moveCategoryUncertain")]]) {
    await assert.rejects(assertRuntimeCategoryAcknowledgment(page, language, outcome, prove), /Exact proven/);
  }
  messages = [guarded]; editor = 1;
  await assert.rejects(assertRuntimeCategoryAcknowledgment(page, language, outcome, prove), /editor detached/);
  editor = 0; review = 1;
  await assert.rejects(assertRuntimeCategoryAcknowledgment(page, language, outcome, prove), /review detached/);
  review = 0;
  for (const invalid of [null, {}, { ...receipt, outcome: "recoverable" }, { ...receipt, operation: { stage: "intent", resultKind: outcome } }, { ...receipt, operation: { stage: "completed", resultKind: "other" } }]) {
    await assert.rejects(assertRuntimeCategoryAcknowledgment(page, language, outcome, async () => invalid));
  }
});

test("actual action ID recorder restores crypto after success, rejection and thrown assertion", async () => {
  const original = globalThis.crypto.randomUUID;
  const page = { evaluate: async fn => fn() };
  const ids = await recordRuntimeCategoryAction(page, async () => { globalThis.crypto.randomUUID(); });
  assert.equal(ids.length, 1); assert.equal(globalThis.crypto.randomUUID, original);
  for (const action of [async () => { throw new Error("action rejected"); }, async () => { globalThis.crypto.randomUUID(); assert.fail("action assertion"); }]) {
    await assert.rejects(recordRuntimeCategoryAction(page, action));
    assert.equal(globalThis.crypto.randomUUID, original); assert.equal(globalThis.categoryMoveActionIds, undefined);
  }
  assert.deepEqual(await recordRuntimeCategoryAction(page, async () => {}), []);
  assert.equal(globalThis.crypto.randomUUID, original);
});

for (const language of ["en", "ru"]) for (const observation of [false, true]) test(`${language}: production DiscoveryWorkspace ${observation ? "in-flight sourceObserved" : "neutral"} no-op crosses driver proof and acknowledgment`, async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { seedCategoryMoveFixture } = await import("../scripts/smoke-project-category-move-ui.mjs");
  const { DiscoveryWorkspace } = await import("../src/renderer/components/DiscoveryPanel.tsx");
  const { WorkspaceServiceClient } = await import("../src/renderer/workspace-service-client.ts");
  const { act, waitFor } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const fixture = await mkdtemp(join(tmpdir(), "category-component-proof-"));
  const savedApi = globalThis.window.workspace, savedEvents = globalThis.categoryMoveEvents;
  let service;
  try {
    const setup = await seedCategoryMoveFixture(join(fixture, "data"));
    service = openSettingsService(setup.database);
    const listeners = new Set(), submissions = [];
    let resolveResponse, result;
    const response = new Promise(done => { resolveResponse = done; });
    globalThis.categoryMoveEvents = [];
    globalThis.window.workspace = {
      workspace: async input => {
        if (input.type === "workspace.moveProjectCategory") {
          submissions.push(structuredClone(input)); result = service.handleCommand(input); return response;
        }
        assert.equal(input.type.startsWith("workspace.recover"), false, "No recovery mutation");
        return service.handleQuery(input);
      },
      settings: async input => service.handleQuery(input),
      onWorkspaceChange: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      onBackendStatus: () => () => {},
    };
    const page = { getByRole: (role, options) => locator(screen.queryAllByRole(role,{...options,hidden:options?.includeHidden})), evaluate: async (fn, input) => fn(input), locator: selector => ({
      evaluate: async fn => fn(globalThis.document.querySelector(selector)),
      count: async () => globalThis.document.querySelectorAll(selector).length,
    }) };
    page.locator=selector=>locator([...globalThis.document.querySelectorAll(selector)]);
    render(React.createElement(DiscoveryWorkspace, { client: new WorkspaceServiceClient(), workspaceId: setup.workspace.workspaceId,
      sourceId: setup.workspace.sourceId, language, disabled: false }));
    await screen.findAllByRole("button", { name: new RegExp(`^${translate(language, "moveCategory")}:`), hidden:true });
    const cell = await assertRuntimeCategoryCell(page, setup.project.name, "Current", translate(language, "moveCategory"));
    const move=await cell.locator("..").getByRole("button",{name:new RegExp(`^${translate(language,"moveCategory")}:`),includeHidden:true}).evaluate(node=>node);
    await userEvent.click(globalThis.document.getElementById(move.closest("[data-context-return]").dataset.contextReturn));
    await userEvent.click(move);
    const input = screen.getByRole("combobox", { name: translate(language, "moveCategoryDestination") });
    assert.equal(input.value, setup.project.categoryId);
    const before = await captureRuntimeCategoryState(page, setup);
    const binding = runtimeCategoryBinding(before, setup.project.projectId, input.value);
    const ids = await recordRuntimeCategoryAction(page, async () => {
      await userEvent.keyboard("{Enter}"); assert.equal(submissions.length, 1);
      if (observation) await act(async () => listeners.forEach(listener => listener({ type: "workspace.sourceObserved", sourceId: setup.workspace.sourceId,
        workspaceIds: [setup.workspace.workspaceId, setup.sibling.workspaceId], observationRevision: 1, state: "ready", automaticUpdates: "active" })));
      await act(async () => resolveResponse(result));
      await waitFor(() => assert.equal(screen.queryByRole("combobox", { name: translate(language, "moveCategoryDestination") }), null));
    });
    assert.deepEqual(ids, [submissions[0].operationId]);
    assert.deepEqual(submissions, [{ type: "workspace.moveProjectCategory", workspaceId: binding.workspaceId, projectId: binding.projectId,
      destinationCategoryId: binding.destinationCategoryId, expectedRevision: binding.expectedRevision, operationId: ids[0] }]);
    const prove = async () => {
      let receipt;
      for (let count = 0; count < 2; count++) {
        const status = await globalThis.window.workspace.workspace({ type: "workspace.getProjectCategoryMove", workspaceId: binding.workspaceId, operationId: ids[0] });
        receipt = assertRuntimeCategoryUnchanged(before, await captureRuntimeCategoryState(page, setup), binding, ids[0], status);
      }
      return receipt;
    };
    await assertRuntimeCategoryAcknowledgment(page, language, "unchanged", prove);
    assert.ok(screen.getByText(translate(language, observation ? "moveCategoryNewer" : "moveCategoryUnchanged")));
    const finalCell = await assertRuntimeCategoryCell(page, setup.project.name, "Current", translate(language, "moveCategory"));
    const finalRow = await finalCell.locator("..").evaluate(node => node);
    assert.ok(within(finalRow).getByText(setup.properties.values[0].value, { normalizer: value => value }));
    // The actual guarded DOM cannot authorize acceptance of a foreign status.
    await assert.rejects(assertRuntimeCategoryAcknowledgment(page, language, "unchanged", async () =>
      assertRuntimeCategoryUnchanged(before, await captureRuntimeCategoryState(page, setup), binding, ids[0], { ok: true, value: { ...result.value, operation: null } })));
    assert.equal(submissions.length, 1);
  } finally {
    cleanup(); service?.close(); globalThis.window.workspace = savedApi; globalThis.categoryMoveEvents = savedEvents;
    await rm(fixture, { recursive: true, force: true });
  }
});


test("public-service keep_original reaches the exact driver oracle with independent active projection and no effects", async () => {
  const { mkdtemp, rm, realpath } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { randomUUID } = await import("node:crypto");
  const { seedCategoryMoveFixture, interruptCategoryMoveFixture } = await import("../scripts/smoke-project-category-move-ui.mjs");
  const { ownedProcessesStopped } = await import("../scripts/runtime-lifecycle.mjs");
  const { openSettingsService } = await import("../dist/service/settings.mjs");
  const fixture = await mkdtemp(join(tmpdir(), "category-keep-original-oracle-")), children = new Set();
  const savedApi = globalThis.window.workspace, savedEvents = globalThis.categoryMoveEvents;
  let service;
  try {
    const setup = await seedCategoryMoveFixture(join(fixture, "data"));
    // This complete public projection is retained before the interruption;
    // expected state never comes from the actual post-recovery query.
    const originalProjection = structuredClone(setup.projection);
    setup.request = { type: "workspace.moveProjectCategory", workspaceId: setup.workspace.workspaceId, projectId: setup.project.projectId,
      operationId: randomUUID(), destinationCategoryId: setup.projection.categories.find(c => c.name === "Destination").categoryId,
      expectedRevision: setup.projection.revision };
    await interruptCategoryMoveFixture(setup, "intent", children);
    const canonicalSourceRoot = await realpath(setup.sourceRoot);
    const {nativeObserverDependencies} = await import("../src/service/source-observer.ts");
    const {scanGroupedSource, scanDirectSource} = await import("../src/service/discovery.ts");
    const scheduled = new Set(), sourceEvents = [];
    let resolveOldScan, oldScan, holding = true;
    const dependencies = {
      probe: nativeObserverDependencies.probe,
      watch: () => ({close() {}}),
      schedule(callback, delay) {
        const timer = {callback, delay}; scheduled.add(timer);
        return {cancel() {scheduled.delete(timer);}};
      },
      scan(request) {
        const scan = (request.mode === "grouped" ? scanGroupedSource : scanDirectSource)(request.canonicalRoot, request.archiveRelativePath, request.exclusions);
        if (holding && request.canonicalRoot === canonicalSourceRoot) {
          holding = false; oldScan = scan;
          return new Promise(resolve => {resolveOldScan = resolve;});
        }
        return scan;
      },
    };
    const flushHints = () => {
      for (const timer of [...scheduled].filter(timer => timer.delay === 100)) {
        if (scheduled.delete(timer)) timer.callback();
      }
    };
    service = openSettingsService(setup.database, undefined, undefined, dependencies);
    service.workspaces.subscribe(event => {if (event.type === "workspace.sourceObserved" && event.sourceId === setup.workspace.sourceId) sourceEvents.push(event);});
    flushHints();
    assert.equal(typeof resolveOldScan, "function", "Hold a genuine pre-settlement background scan");
    globalThis.categoryMoveEvents = [];
    service.workspaces.subscribe(event => { if (event.type === "workspace.projectsChanged") globalThis.categoryMoveEvents.push(event); });
    globalThis.window.workspace = { workspace: async input => service.handleQuery(input), settings: async input => service.handleQuery(input) };
    const page = { evaluate: async (fn, input) => fn(input) };
    const before = await captureRuntimeCategoryState(page, setup, setup.sibling.workspaceId);
    const preview = service.handleQuery({ type: "workspace.previewProjectCategoryMoveRecovery", workspaceId: setup.sibling.workspaceId, operationId: setup.request.operationId });
    assert.equal(preview.ok, true); assert.ok(preview.value.actions.includes("keep_original"));
    assert.deepEqual(await captureRuntimeCategoryState(page, setup, setup.sibling.workspaceId), before, "Preview is read-only");
    const bound = before.durable.journal.find(entry => entry.operation_id === setup.request.operationId);
    const row = { ...bound, stage: "failed", result_kind: "rejected", last_verified_placement: "original", problem: "kept_original", completed_revision: null };
    const result = service.handleCommand({ type: "workspace.recoverProjectCategoryMove", workspaceId: setup.sibling.workspaceId,
      operationId: setup.request.operationId, previewToken: preview.value.previewToken, action: "keep_original" });
    assert.equal(result.ok, true); assert.equal(result.value.problem, "kept_original");
    for (const workspaceId of [setup.workspace.workspaceId, setup.sibling.workspaceId]) {
      const observed = service.handleQuery({type: "workspace.listProjects", workspaceId, observed: true});
      assert.equal(observed.ok, true);
      assert.deepEqual(observed.value, {...originalProjection, workspaceId}, "Settled recovery invalidates cached ambiguous eligibility for every source reference");
    }
    resolveOldScan(oldScan);
    for (let turn = 0; turn < 6; turn++) await Promise.resolve();
    // A rejected old pass queues a new one; neither its cache nor a degraded
    // notification may permanently restore the pre-settlement association.
    flushHints();
    for (let turn = 0; turn < 6; turn++) await Promise.resolve();
    for (const workspaceId of [setup.workspace.workspaceId, setup.sibling.workspaceId]) {
      assert.deepEqual(service.handleQuery({type: "workspace.listProjects", workspaceId, observed: true}).value, {...originalProjection, workspaceId});
    }
    assert.equal(sourceEvents.at(-1)?.automaticUpdates, "active", "Queued fresh scan restores healthy observation after the stale pass");
    const after = await captureRuntimeCategoryState(page, setup, setup.sibling.workspaceId);
    const verify = (state = after, receipt = result, expectedRow = row, projection = originalProjection) =>
      assertRuntimeCategoryKeptOriginal(before, state, expectedRow, receipt, projection);
    verify();
    for (let count = 0; count < 2; count++) {
      const receipt = service.handleQuery({ type: "workspace.getProjectCategoryMove", workspaceId: setup.sibling.workspaceId, operationId: setup.request.operationId });
      verify(await captureRuntimeCategoryState(page, setup, setup.sibling.workspaceId), receipt);
    }
    for (const key of ["projects", "sibling"]) {
      for (const field of ["projectId", "relativePath", "name", "categoryId", "categoryName", "associationState", "resolution", "retentionReason"]) {
        const bad = structuredClone(after); bad[key].projects.find(p => p.projectId === setup.project.projectId)[field] = "wrong";
        assert.throws(() => verify(bad), undefined, `${key}/${field}`);
      }
      for (const alter of [list => { list.revision++; }, list => { list.retainedCount++; }, list => { list.projects.reverse(); },
        list => { list.projects.pop(); }, list => { list.retainedProjects.push(before[key].retainedProjects[0]); },
        list => { list.projects.find(p => p.projectId !== setup.project.projectId).name = "wrong sibling"; }]) {
        const bad = structuredClone(after); alter(bad[key]); assert.throws(() => verify(bad));
      }
    }
    for (const key of ["other", "text", "siblingText", "otherText", "settings", "configurations", "events"]) {
      const bad = structuredClone(after); bad[key] = null; assert.throws(() => verify(bad), undefined, key);
    }
    for (const key of ["metadata", "tree", "otherTree"]) {
      const bad = structuredClone(after); bad.durable[key] = null; assert.throws(() => verify(bad), undefined, key);
    }
    for (const alter of [journal => journal.push({ ...row, operation_id: randomUUID() }), journal => { journal[0].native_identity = "wrong"; },
      journal => { journal[0].last_verified_placement = "destination"; }, journal => { journal[0].completed_revision = originalProjection.revision + 1; }]) {
      const bad = structuredClone(after); alter(bad.durable.journal); assert.throws(() => verify(bad));
    }
    for (const field of Object.keys(result.value.operation)) {
      const bad = structuredClone(result); bad.value.operation[field] = "wrong"; assert.throws(() => verify(after, bad), undefined, field);
    }
    for (const receipt of [null, { ok: false }, { ...result, value: { ...result.value, outcome: "completed" } },
      { ...result, value: { ...result.value, problem: null } }]) assert.throws(() => verify(after, receipt));
    const badProjection = structuredClone(originalProjection); badProjection.projects.find(p => p.projectId === setup.project.projectId).name = "foreign";
    assert.throws(() => verify(after, result, row, badProjection));
    assert.equal(ownedProcessesStopped(children, new Set()), true);
  } finally {
    service?.close(); globalThis.window.workspace = savedApi; globalThis.categoryMoveEvents = savedEvents;
    assert.equal(ownedProcessesStopped(children, new Set()), true);
    await rm(fixture, { recursive: true, force: true });
  }
});
