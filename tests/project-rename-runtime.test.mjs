import assert from "node:assert/strict";
import test from "node:test";
import { createRenameEvidence, recordRenameEvidence, assertRenameAcceptance } from "../scripts/runtime-evidence.mjs";

test("rename acceptance rejects unreached stages and cannot promote skipped or failed assertions", () => {
  const evidence = createRenameEvidence();
  assert.throws(() => assertRenameAcceptance(evidence), /unreached/);
  assert.throws(() => recordRenameEvidence(evidence.direct, "submission", { status: "passed" }), /assertion/);
  recordRenameEvidence(evidence.direct, "submission", { status: "skipped" });
  assert.throws(() => recordRenameEvidence(evidence.direct, "submission", { status: "passed", asserted: true }), /skipped/);
  recordRenameEvidence(evidence.grouped, "submission", { status: "failed" });
  assert.throws(() => recordRenameEvidence(evidence.grouped, "submission", { status: "passed", asserted: true }), /failed/);
});

test("driver-owned intent and committed interruption fixtures survive restart without mutation replay", async () => {
  const { mkdtemp, rm, readFile, readdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { seedRenameFixture, interruptRenameFixture } = await import("../scripts/smoke-project-rename-ui.mjs");
  const { openSettingsService } = await import("../dist/service/settings.mjs");
  const fixture = await mkdtemp(join(tmpdir(), "rename-ui-driver-test-"));
  try {
    for (const discoveryMode of ["direct", "grouped"]) for (const checkpoint of ["intent", "commit"]) {
      const setup = await seedRenameFixture(join(fixture, `${discoveryMode}-${checkpoint}`), discoveryMode);
      const reached = await interruptRenameFixture(setup, checkpoint, new Set());
      assert.equal(reached.cleanupExecuted, false);
      assert.equal(reached.stage, checkpoint === "commit" ? "completed" : "intent");
      const before = await readdir(setup.parent);
      const service = openSettingsService(setup.database);
      try {
        const input = { workspaceId: setup.workspace.workspaceId, operationId: setup.request.operationId };
        const status = service.getProjectRename({ type: "workspace.getProjectRename", ...input });
        assert.equal(status.ok, true);
        assert.equal(status.value.outcome, checkpoint === "commit" ? "completed" : "recoverable");
        const list = service.listProjectRenames({ type: "workspace.listProjectRenames", workspaceId: input.workspaceId });
        assert.equal(list.value.operations.length, checkpoint === "commit" ? 0 : 1);
        const projection = service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: input.workspaceId }).value;
        assert.equal([...projection.projects, ...projection.retainedProjects].some(project => project.projectId === setup.project.projectId), true);
        assert.equal(service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: input.workspaceId }).value.values[0].value, "  Exact\nТекст\t  ");
        assert.deepEqual(await readdir(setup.parent), before);
        assert.deepEqual((await readFile(join(setup.parent, checkpoint === "commit" ? setup.request.name : "Original", "sentinel"))).toString(), "original bytes\0日本語\n");
      } finally { service.close(); }
    }
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test("rename evidence requires all named assertions, exact native target and completed shutdown/cleanup", () => {
  const evidence = createRenameEvidence();
  delete evidence.direct.submission;
  assert.throws(() => assertRenameAcceptance(evidence), /missing|shape/);
  const populate = target => {
    for (const [name, value] of Object.entries(target)) {
      if (Object.hasOwn(value, "status")) recordRenameEvidence(target, name, { status: "passed", asserted: true, exactTargetObserved: true });
      else populate(value);
    }
  };
  const complete = createRenameEvidence(); populate(complete);
  assert.doesNotThrow(() => assertRenameAcceptance(complete));
  for (const status of ["failed", "skipped", "pending", "unreached"]) {
    const incomplete = structuredClone(complete);
    incomplete.grouped.recovery.final_effect.preservation.status = status;
    assert.throws(() => assertRenameAcceptance(incomplete), new RegExp(status));
  }
  const partial = createRenameEvidence();
  assert.throws(() => recordRenameEvidence(partial.direct, "fileManagerOutcome", { status: "passed", asserted: true, exactTargetObserved: true }), /invocation/);
  recordRenameEvidence(partial.direct, "revealInvocation", { status: "passed", asserted: true });
  assert.throws(() => recordRenameEvidence(partial.direct, "fileManagerOutcome", { status: "passed", asserted: true }), /exact/);
  recordRenameEvidence(partial.direct, "submission", { status: "failed" });
  assert.throws(() => recordRenameEvidence(partial.direct, "submission", { status: "pending" }), /failed/);
});
