import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { assertRuntimeCategoryCell } from "../scripts/smoke-project-category-move-ui.mjs";

const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { render, screen, cleanup, within } = await import("@testing-library/react");
const { TextPropertiesTable } = await import("../src/renderer/components/TextPropertiesTable.tsx");
const { translate } = await import("../src/renderer/localization.ts");
test.afterEach(cleanup);

// Testing Library's real role queries adapt the production table DOM to the
// driver's small Playwright locator surface. No mocked authored cell contents.
function locator(value) {
  const nodes = Array.isArray(value) ? value : [value];
  return {
    nodes,
    getByRole: (role, options) => locator(nodes.flatMap(node => within(node).queryAllByRole(role, options))),
    filter: ({ has, hasText }) => locator(nodes.filter(node => has ? has.nodes.some(child => node.contains(child)) : node.textContent.includes(hasText))),
    locator: selector => selector === ".." ? locator(nodes.map(node => node.parentElement)) : { nth: index => locator(nodes.flatMap(node => [...node.querySelectorAll(selector)])[index]) },
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
  await screen.findByRole("button", { name: `${translate(language, "moveCategory")}: Other`, exact: true });
  const page = { getByRole: (role, options) => locator(screen.queryAllByRole(role, options)) };
  await assertRuntimeCategoryCell(page, project.name, "  Exact категория  ", translate(language, "moveCategory"));
  const cell = await assertRuntimeCategoryCell(page, project.name, "  Exact категория  ", translate(language, "moveCategory"));
  (await cell.getByRole("button").evaluate(node => node)).click();
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
    assert.equal(setup.project.name, "  Exact 日本語 📝  ");
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
    assert.equal(normal[0].if, "${{ !cancelled() }}");
    assert.equal(normal[0].env.WORKSPACE_SMOKE_EVIDENCE_DIR, `work/ci-runtime-${mode}`);
  }
  assert.equal(steps.filter(step => /smoke:runtime.*--category-move/.test(step.run ?? "")).length, 0);
});
