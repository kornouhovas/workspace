import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { observeFileManagerTarget, waitForFileManagerTarget } from "../scripts/file-manager-evidence.mjs";

const target = "C:\\Disposable\\Folder's 日本語 $value";
const empty = { exactParentFound: false, targetPresent: false, selectedTargetMatch: false, exactParentCount: 0, errorCount: 0, errors: [] };
const parent = { ...empty, exactParentFound: true, exactParentCount: 1 };
const selected = { ...parent, targetPresent: true, selectedTargetMatch: true };

test("Windows observation distinguishes absent parent, absent target and unselected target", async () => {
  for (const [payload, stage] of [[empty, "parent_absent"], [parent, "target_absent"], [{ ...parent, targetPresent: true }, "target_not_selected"]]) {
    const result = await observeFileManagerTarget(target, "win32", async () => ({ stdout: JSON.stringify(payload) }));
    assert.equal(result.status, "pending");
    assert.equal(result.diagnostics.stage, stage);
    assert.equal(result.diagnostics.exactParentFound, payload.exactParentFound);
    assert.equal(result.diagnostics.targetPresent, payload.targetPresent);
    assert.notEqual(result.exactTargetObserved, true);
  }
});

test("Windows exact selection passes only with full parent and target evidence", async () => {
  const result = await observeFileManagerTarget(target, "win32", async (_program, args, options) => {
    assert.equal(options.env.WORKSPACE_OBSERVE_TARGET, target);
    assert.equal(args.join(" ").includes(target), false);
    return { stdout: JSON.stringify(selected) };
  });
  assert.equal(result.status, "passed");
  assert.equal(result.exactTargetObserved, true);
  assert.equal(result.diagnostics.stage, "exact_target");
});

test("Windows COM errors remain distinguishable from normal nonmatches without disclosing messages", async () => {
  for (const stage of ["shell", "windows", "document", "target", "selection"]) {
    const result = await observeFileManagerTarget(target, "win32", async () => ({ stdout: JSON.stringify({
      ...parent, errorCount: 1, errors: [{ stage, code: -2147467259, message: "C:\\private\\secret" }],
      title: "private title", path: "C:\\private\\secret",
    }) }));
    assert.equal(result.status, "pending");
    assert.equal(result.diagnostics.stage, "observation_error");
    assert.deepEqual(result.diagnostics.errors, [{ stage, code: -2147467259 }]);
    assert.equal(result.unavailable === true, stage === "shell" || stage === "windows");
    assert.equal(JSON.stringify(result).includes("private"), false);
  }
});

test("Windows malformed or inconsistent telemetry never becomes successful or leaks subprocess output", async () => {
  for (const payload of ["true", "private stderr", "", "null", JSON.stringify({ ...selected, exactParentFound: false }),
    JSON.stringify({ ...selected, targetPresent: false }), JSON.stringify({ ...selected, exactParentCount: -1 }),
    JSON.stringify({ ...parent, errorCount: 1, errors: [{ stage: "private path", code: "secret" }] })]) {
    const result = await observeFileManagerTarget(target, "win32", async () => ({ stdout: payload }));
    assert.equal(result.status, "pending");
    assert.equal(result.unavailable, true);
    assert.equal(result.diagnostics.stage, "protocol_error");
    assert.equal(JSON.stringify(result).includes("private"), false);
    assert.equal(JSON.stringify(result).includes("secret"), false);
  }
});

test("Windows observation bounds retained errors and sanitizes command failure codes", async () => {
  const errors = Array.from({ length: 20 }, () => ({ stage: "document", code: -2147467259 }));
  const result = await observeFileManagerTarget(target, "win32", async () => ({ stdout: JSON.stringify({ ...empty, errorCount: 20, errors }) }));
  assert.equal(result.diagnostics.errorCount, 20);
  assert.equal(result.diagnostics.errors.length, 8);
  const failed = await observeFileManagerTarget(target, "win32", async () => { throw Object.assign(new Error("private stderr"), { code: "private path" }); });
  assert.equal(failed.status, "pending");
  assert.equal(failed.unavailable, true);
  assert.equal(JSON.stringify(failed).includes("private"), false);
});

test("Windows per-window errors can resolve during the same bounded single-invocation observation", async () => {
  let elapsed = 0, attempts = 0;
  const result = await waitForFileManagerTarget(target, "win32", async () => {
    elapsed += 50;
    return { stdout: JSON.stringify(++attempts === 1 ? { ...parent, errorCount: 1, errors: [{ stage: "selection", code: -2147467259 }] } : selected) };
  }, { now: () => elapsed, sleep: async (ms) => { elapsed += ms; } });
  assert.equal(result.status, "passed");
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[0].diagnostics.stage, "observation_error");
  assert.equal(result.attempts[1].diagnostics.stage, "exact_target");
  assert.equal(result.deadlineMs, 10000);
});

// Execute the actual PowerShell observer with controlled COM objects on Windows.
// This verifies script decisions, not real Explorer or native dispatch acceptance.
test("Windows PowerShell observer classifies controlled COM views and failures", { skip: process.platform !== "win32" }, async () => {
  const execute = promisify(execFile);
  const fixture = `
$fixtureMode = $env:WORKSPACE_OBSERVE_FIXTURE
$fixtureTarget = $env:WORKSPACE_OBSERVE_TARGET
$folder = [pscustomobject]@{ Self = [pscustomobject]@{ Path = [IO.Path]::GetDirectoryName($fixtureTarget) } }
if ($fixtureMode -eq 'wrong_parent') { $folder.Self.Path = 'C:\\Other' }
$folder | Add-Member ScriptMethod ParseName { param($name) if ($fixtureMode -ne 'target_absent') { [pscustomobject]@{ Path = $fixtureTarget } } }
$document = [pscustomobject]@{ Folder = $folder }
$document | Add-Member ScriptMethod SelectedItems {
  if ($fixtureMode -eq 'selection_error') { throw [Runtime.InteropServices.COMException]::new('private selection', -2147467259) }
  if ($fixtureMode -eq 'exact' -or $fixtureMode -eq 'wrong_parent') { [pscustomobject]@{ Path = $fixtureTarget } }
}
$window = [pscustomobject]@{ Document = $document }
if ($fixtureMode -eq 'document_error') {
  $window = [pscustomobject]@{}
  $window | Add-Member ScriptProperty Document { throw [Runtime.InteropServices.COMException]::new('private document', -2147467259) }
}
$fixtureShell = [pscustomobject]@{}
$fixtureShell | Add-Member ScriptMethod Windows { if ($fixtureMode -ne 'parent_absent') { $window } }
function New-Object { param([string]$ComObject)
  if ($fixtureMode -eq 'shell_error') { throw [Runtime.InteropServices.COMException]::new('private shell', -2147467259) }
  return $fixtureShell
}
`;
  for (const [mode, stage] of [["parent_absent", "parent_absent"], ["wrong_parent", "parent_absent"], ["target_absent", "target_absent"],
    ["unselected", "target_not_selected"], ["document_error", "observation_error"], ["selection_error", "observation_error"],
    ["shell_error", "observation_error"], ["exact", "exact_target"]]) {
    const result = await observeFileManagerTarget(target, "win32", (program, args, options) => execute(program,
      [...args.slice(0, -1), `${fixture}\n& { ${args.at(-1)} }`], { ...options, env: { ...options.env, WORKSPACE_OBSERVE_FIXTURE: mode } }));
    assert.equal(result.diagnostics.stage, stage, mode);
    assert.equal(result.status, mode === "exact" ? "passed" : "pending", mode);
    assert.equal(JSON.stringify(result).includes("private"), false);
  }
});
