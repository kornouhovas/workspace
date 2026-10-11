import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { superviseRenameService } from "../scripts/smoke-project-rename.mjs";

const controlEvidence = name => process.env.WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR
  ? join(process.env.WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR, name) : undefined;

const supported = ["darwin", "win32"].includes(process.platform);
test("real Electron service checkpoint requires every scenario, handshake, shutdown and cleanup", { skip: !supported }, async () => {
  const result = await superviseRenameService({ evidenceDirectory: controlEvidence("success") });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.cleanup, "removed");
  assert.equal(result.shutdownConfirmed, true);
  assert.ok(Object.values(result.scenarios).every(value => value.status === "passed"));
  assert.deepEqual(Object.keys(result.mountedCase), ["direct", "grouped"]);
  for (const behavior of Object.values(result.mountedCase)) assert.ok(["self_alias_staged", "distinct_direct"].includes(behavior));
});
for (const fault of ["failure", "timeout", "malformed", "missing-assertion", "skipped", "missing-ack", "cleanup"]) {
  test(`service fixture rejects ${fault} and reports finite failure/cleanup evidence`, { skip: !supported }, async () => {
    const result = await superviseRenameService({ fault, evidenceDirectory: controlEvidence(fault) });
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.shutdownConfirmed, true, JSON.stringify(result));
    assert.equal(result.cleanup, fault === "cleanup" ? "failed" : "removed");
    if (fault === "failure") assert.ok(Object.values(result.scenarios).some(value => value.status === "failed"));
    if (fault === "skipped") assert.ok(Object.values(result.scenarios).some(value => value.status === "skipped"));
    if (fault === "missing-assertion") assert.ok(Object.values(result.scenarios).some(value => value.status === "unreached"));
    if (fault === "malformed") assert.equal(result.protocol.failed, true);
    if (["timeout", "missing-ack"].includes(fault)) {
      assert.equal(result.timedOut, true); assert.ok(result.utilityCount > 0);
    }
    const encoded = JSON.stringify(result);
    for (const secret of ["Original", "Category", "sentinel", "nativeIdentity", "birthtimeNs", "workspace.sqlite", "stack", "private injected"]) assert.equal(encoded.includes(secret), false, secret);
  });
}

test("evidence persists sanitized failure outcomes and cleanup, and write failures cannot prevent cleanup", { skip: !supported }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "rename-evidence-test-"));
  try {
    const result = await superviseRenameService({ fault: "failure", evidenceDirectory: directory });
    const stored = JSON.parse(await readFile(join(directory, "service-checkpoint.json"), "utf8"));
    assert.deepEqual(stored, result);
    assert.equal(stored.scenarios["direct.rename"].status, "failed");
    assert.equal(stored.scenarios["grouped.recovery"].status, "unreached");
    const file = join(directory, "occupied"); await writeFile(file, "Keep");
    const unavailable = await superviseRenameService({ fault: "failure", evidenceDirectory: file });
    assert.equal(unavailable.evidenceWriteFailed, true);
    assert.equal(unavailable.ok, false); assert.equal(unavailable.cleanup, "removed");
    assert.equal(await readFile(file, "utf8"), "Keep");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
