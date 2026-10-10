import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { closeDisposableFileManagerTarget, observeFileManagerTarget, waitForFileManagerTarget } from "../scripts/file-manager-evidence.mjs";

const target = "C:\\Disposable\\Folder's 日本語 $value `quoted` & text";
const com = { exactParentFound: true, targetPresent: true, selectedTargetMatch: false, exactParentCount: 1, errorCount: 0, errors: [] };
const uia = { stage: "selected", windowVerified: true, targetVerified: true, selected: true, code: null };
const encode = (value, independentSelection) => JSON.stringify(value) + "\n" + JSON.stringify({ ...value, independentSelection });
const read = (value, independentSelection) => observeFileManagerTarget(target, "win32", async () => ({ stdout: encode(value, independentSelection) }), 5000, { windowsDiagnostics: true });

test("independent selected and unselected evidence preserves both agreements and disagreements without changing strict COM acceptance", async () => {
  for (const comSelected of [true, false]) for (const uiSelected of [true, false]) {
    const result = await read({ ...com, selectedTargetMatch: comSelected }, { ...uia, stage: uiSelected ? "selected" : "unselected", selected: uiSelected });
    assert.equal(result.status, comSelected ? "passed" : "pending");
    assert.equal(result.independentSelection.status, "observed");
    assert.equal(result.independentSelection.selected, uiSelected);
    assert.equal(result.selectionAgreement, comSelected === uiSelected ? "agree" : "disagree");
    assert.equal(result.exactTargetObserved === true, comSelected);
  }
});

test("COM selection error stays distinct when UIA reads the exact item", async () => {
  const result = await read({ ...com, errorCount: 1, errors: [{ stage: "selection", code: -2147467259 }] }, uia);
  assert.equal(result.status, "pending");
  assert.equal(result.diagnostics.stage, "observation_error");
  assert.equal(result.independentSelection.stage, "selected");
  assert.equal(result.selectionAgreement, "unavailable");
});

test("absent, wrong, ambiguous and unavailable UIA evidence never implies selected or overrides COM", async () => {
  for (const stage of ["parent_absent", "ambiguous_parent", "target_absent", "wrong_window", "ambiguous_target", "pattern_unavailable", "read_error", "view_changed"]) {
    const result = await read({ ...com, selectedTargetMatch: true }, { stage, windowVerified: ["ambiguous_target", "pattern_unavailable", "view_changed"].includes(stage), targetVerified: false, selected: null, code: stage === "read_error" ? -2147467259 : null });
    assert.equal(result.status, "passed");
    assert.equal(result.independentSelection.status, "unavailable");
    assert.equal(result.independentSelection.stage, stage);
    assert.equal(result.independentSelection.selected, null);
    assert.equal(result.selectionAgreement, "unavailable");
  }
});

const marker = { controlType: "List", className: "UIItemsView", automationId: "ItemsView" };
const shape = { stage: "observed", viewCount: 1, itemCount: 1, candidateCount: 1, candidates: [marker], code: null };

test("exact-window query shape keeps only finite counts and allowlisted provider markers", async () => {
  for (const [stage, queryShape] of [["selected", shape],
    ["view_absent", { ...shape, viewCount: 0, itemCount: null }],
    ["ambiguous_view", { ...shape, viewCount: 2, itemCount: null, candidateCount: 2, candidates: [marker, marker] }],
    ["selected", { ...shape, stage: "read_error", candidateCount: null, candidates: [], code: -2147467259 }]]) {
    const observed = stage === "selected";
    const result = await read(com, { ...uia, stage, targetVerified: observed, selected: observed ? true : null,
      queryShape: { ...queryShape, rawTitle: target, candidates: queryShape.candidates.map((value) => ({ ...value, path: target })) } });
    assert.deepEqual(result.independentSelection.queryShape, queryShape);
    assert.equal(result.independentSelection.stage, stage);
    assert.equal(JSON.stringify(result).includes(target), false);
    assert.equal(result.status, "pending");
  }
  for (const controlType of ["List", "DataGrid", "Pane", "Custom", "Table", "other"]) {
    for (const [className, automationId] of [["UIItemsView", "ItemsView"], ["other", "ItemsView"], ["UIItemsView", "other"]]) {
      const candidates = [{ controlType, className, automationId }];
      const result = await read(com, { ...uia, queryShape: { ...shape, candidates } });
      assert.deepEqual(result.independentSelection.queryShape.candidates, candidates);
    }
  }
});

test("malformed or ownership-inconsistent query shape cannot assert independent selection", async () => {
  for (const queryShape of [null, {}, { ...shape, stage: "private" }, { ...shape, viewCount: -1 },
    { ...shape, itemCount: 1.5 }, { ...shape, candidateCount: Infinity }, { ...shape, candidateCount: 100001 },
    { ...shape, candidates: [] }, { ...shape, candidates: Array(9).fill(marker) },
    { ...shape, candidates: [{ ...marker, className: target }] },
    { ...shape, candidates: [{ ...marker, controlType: target }] },
    { ...shape, candidates: [{ ...marker, automationId: target }] },
    { ...shape, candidates: [{ ...marker, className: "other", automationId: "other" }] },
    { ...shape, viewCount: 2 }, { ...shape, stage: "read_error", candidateCount: null, candidates: [], code: null }]) {
    const result = await read(com, { ...uia, queryShape });
    assert.equal(result.independentSelection.stage, "protocol_error");
    assert.equal(JSON.stringify(result).includes(target), false);
  }
  for (const [stage, queryShape] of [["view_absent", shape], ["ambiguous_view", shape],
    ["selected", { ...shape, itemCount: 0 }]]) {
    const result = await read(com, { ...uia, stage, selected: stage === "selected" ? true : null,
      targetVerified: stage === "selected", queryShape });
    assert.equal(result.independentSelection.stage, "protocol_error");
  }
  const result = await read(com, { ...uia, windowVerified: false, queryShape: shape });
  assert.equal(result.independentSelection.stage, "protocol_error");
  for (const stage of ["view_absent", "ambiguous_view"]) {
    const missing = await read(com, { ...uia, stage, targetVerified: false, selected: null });
    assert.equal(missing.independentSelection.stage, "protocol_error");
  }
});

test("malformed UIA protocol cannot assert selection; only allowlisted fields survive", async () => {
  for (const value of [null, {}, { ...uia, stage: "private" }, { ...uia, windowVerified: false },
    { ...uia, targetVerified: false }, { ...uia, selected: false }, { ...uia, code: 2147483648 },
    { ...uia, stage: "wrong_window", selected: null }, { ...uia, stage: "read_error", selected: null }]) {
    const result = await read(com, value);
    assert.equal(result.status, "pending");
    assert.equal(result.independentSelection.stage, "protocol_error");
    assert.equal(JSON.stringify(result).includes("private"), false);
  }
  const result = await read(com, { ...uia, title: "private", path: target, selection: ["private"] });
  assert.deepEqual(result.independentSelection, { ...uia, status: "observed", source: "ui_automation" });
  assert.equal(JSON.stringify(result).includes(target), false);
});

test("UIA selected evidence with no unique COM-bound owned parent is rejected", async () => {
  for (const exactParentCount of [0, 2]) {
    const result = await read({ ...com, exactParentCount, exactParentFound: exactParentCount > 0, targetPresent: exactParentCount > 0 }, uia);
    assert.equal(result.status, "pending");
    assert.equal(result.independentSelection.stage, "protocol_error");
    assert.equal(result.independentSelection.selected, null);
  }
});

test("unavailable UIA parent evidence retains its stage without a unique parent", async () => {
  for (const [exactParentCount, stage] of [[0, "parent_absent"], [2, "ambiguous_parent"]]) {
    const result = await read({ ...com, exactParentCount, exactParentFound: exactParentCount > 0, targetPresent: exactParentCount > 0 },
      { stage, windowVerified: false, targetVerified: false, selected: null, code: null });
    assert.equal(result.independentSelection.stage, stage);
    assert.equal(result.independentSelection.status, "unavailable");
    assert.equal(result.selectionAgreement, "unavailable");
  }
});

test("combined observation uses one bounded process with environment-only Unicode and fixed diagnostic source", async () => {
  let calls = 0;
  const result = await observeFileManagerTarget(target, "win32", async (program, args, options) => {
    calls++;
    assert.equal(program, "powershell.exe");
    assert.equal(options.env.WORKSPACE_OBSERVE_TARGET, target);
    assert.equal(options.env.WORKSPACE_SELECTION_DIAGNOSTICS, "1");
    assert.ok(options.env.WORKSPACE_SELECTION_DIAGNOSTICS_SCRIPT.endsWith("windows-selection-diagnostics.ps1"));
    assert.equal(args.join(" ").includes(target), false);
    assert.equal(options.timeout, 900);
    assert.equal(options.maxBuffer, 16384);
    assert.equal(options.windowsHide, true);
    return { stdout: encode(com, uia) };
  }, 900, { windowsDiagnostics: true });
  assert.equal(calls, 1);
  assert.equal(result.selectionAgreement, "disagree");
});

test("timeout retains completed COM evidence separately and never becomes native success", async () => {
  const result = await observeFileManagerTarget(target, "win32", async () => {
    throw Object.assign(new Error("private stderr"), { killed: true, stdout: JSON.stringify({ ...com, selectedTargetMatch: true }) + "\n", stderr: target });
  }, 5000, { windowsDiagnostics: true });
  assert.equal(result.status, "pending");
  assert.equal(result.diagnostics.stage, "timeout");
  assert.equal(result.independentSelection.stage, "timeout");
  assert.equal(result.comBeforeInterruption.status, "passed");
  assert.equal(result.exactTargetObserved, undefined);
  assert.equal(JSON.stringify(result).includes(target), false);
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("subprocess output limit stays separate from timeout and retains no private output", async () => {
  const result = await observeFileManagerTarget(target, "win32", async () => {
    throw Object.assign(new Error(target), { killed: true, code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", stdout: "private oversized output" });
  }, 5000, { windowsDiagnostics: true });
  assert.equal(result.status, "pending");
  assert.equal(result.unavailable, true);
  assert.equal(result.diagnostics.stage, "output_limit");
  assert.equal(result.independentSelection.stage, "output_limit");
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(JSON.stringify(result).includes(target), false);
});

test("combined observation rejects oversized, extra or contradictory records", async () => {
  for (const stdout of [" ".repeat(16385), encode(com, uia) + "\nprivate", JSON.stringify(com),
    JSON.stringify({ ...com, selectedTargetMatch: true }) + "\n" + JSON.stringify({ ...com, independentSelection: uia })]) {
    const result = await observeFileManagerTarget(target, "win32", async () => ({ stdout }), 5000, { windowsDiagnostics: true });
    assert.equal(result.status, "pending");
    assert.equal(result.diagnostics.stage, "protocol_error");
    assert.equal(JSON.stringify(result).includes("private"), false);
  }
});

test("UIA reads share the unchanged ten-second budget and never cause another native dispatch", async () => {
  let elapsed = 0, calls = 0;
  const result = await waitForFileManagerTarget(target, "win32", async (_program, _args, options) => {
    calls++;
    assert.equal(options.timeout, calls === 1 ? 5000 : 4900);
    elapsed += options.timeout;
    return { stdout: encode(com, uia) };
  }, { windowsDiagnostics: true, now: () => elapsed, sleep: async (ms) => { elapsed += ms; } });
  assert.equal(calls, 2);
  assert.equal(result.status, "pending");
  assert.equal(result.elapsedMs, 10000);
  assert.equal(result.deadlineMs, 10000);
  assert.equal(result.attempts[0].independentSelection.selected, true);
  assert.equal(result.attempts[1].selectionAgreement, "disagree");
});

test("owned-parent cleanup has finite sanitized counts and retains errors", async () => {
  for (const [payload, status] of [[{ matched: 1, closed: 1, errorCount: 0 }, "completed"],
    [{ matched: 0, closed: 0, errorCount: 0 }, "completed"], [{ matched: 1, closed: 0, errorCount: 1 }, "pending"],
    [{ matched: 0, closed: 1, errorCount: 0 }, "pending"], [{ matched: 1, closed: 1, errorCount: -1 }, "pending"]]) {
    const result = await closeDisposableFileManagerTarget(target, "win32", async (_program, args, options) => {
      assert.equal(options.env.WORKSPACE_OBSERVE_TARGET, target);
      assert.equal(args.join(" ").includes(target), false);
      assert.equal(options.timeout, 5000);
      assert.equal(options.maxBuffer, 16384);
      return { stdout: JSON.stringify({ ...payload, message: "private" }) };
    }, { ownedParent: true });
    assert.equal(result.status, status);
    assert.equal(JSON.stringify(result).includes("private"), false);
  }
});

// This executes the actual ownership/revalidation script with controlled provider
// reads, not Explorer. One bounded process covers every controlled fixture case.
test("Windows controlled UIA ownership rejects wrong views before reading and detects changed views", { skip: process.platform !== "win32" }, async () => {
  const scriptPath = fileURLToPath(new URL("../scripts/windows-selection-diagnostics.ps1", import.meta.url));
  const source = await readFile(scriptPath, "utf8");
  const execute = promisify(execFile);
  const fixture = String.raw`
$target = $env:WORKSPACE_OBSERVE_TARGET
$parent = [IO.Path]::GetDirectoryName($target)
$cases = @('selected', 'unselected', 'parent_absent', 'ambiguous_parent', 'wrong_parent', 'wrong_target', 'zero_handle', 'wrong_window', 'pattern_unavailable', 'ambiguous_target', 'read_error', 'view_changed')
foreach ($mode in $cases) {
  $reads = 0
  $folder = [pscustomobject]@{ Self = [pscustomobject]@{ Path = $parent } }
  if ($mode -eq 'wrong_parent') { $folder.Self.Path = 'C:\Unrelated' }
  $folder | Add-Member ScriptMethod ParseName { param($name)
    if ($name -ne [IO.Path]::GetFileName($target)) { throw 'private wrong name' }
    [pscustomobject]@{ Path = $(if ($mode -eq 'wrong_target') { 'C:\Unrelated\other' } else { $target }) }
  }
  $window = [pscustomobject]@{ HWND = $(if ($mode -eq 'zero_handle') { 0 } else { 123 }); Document = [pscustomobject]@{ Folder = $folder } }
  function Read-WorkspaceUiaSelection($handle, $name) {
    $script:reads++
    if ($handle -ne 123 -or $name -ne [IO.Path]::GetFileName($target)) { throw 'private wrong binding' }
    if ($mode -eq 'read_error') { throw [Runtime.InteropServices.COMException]::new('private', -2147467259) }
    if ($mode -eq 'view_changed') { $folder.Self.Path = 'C:\Unrelated'; return @{ stage = 'selected'; selected = $true } }
    if ($mode -eq 'selected' -or $mode -eq 'unselected') { return @{ stage = $mode; selected = ($mode -eq 'selected') } }
    return @{ stage = $mode; selected = $null }
  }
  $windows = [Collections.Generic.List[object]]::new()
  if ($mode -ne 'parent_absent') { $windows.Add($window) }
  if ($mode -eq 'ambiguous_parent') { $windows.Add($window) }
  $result = Get-WorkspaceSelectionDiagnostic $windows $target
  [ordered]@{ mode = $mode; reads = $reads; result = $result } | ConvertTo-Json -Depth 4 -Compress
}
`;
  const output = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", source + "\n" + fixture], {
    timeout: 30000, maxBuffer: 16384, windowsHide: true, env: { ...process.env, WORKSPACE_OBSERVE_TARGET: target },
  });
  const lines = output.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(lines.length, 12);
  for (const { mode, reads, result } of lines) {
    const early = ["parent_absent", "ambiguous_parent", "wrong_parent", "wrong_target", "zero_handle"].includes(mode);
    assert.equal(reads, early ? 0 : 1, mode);
    assert.equal(result.stage, ["wrong_parent", "wrong_target"].includes(mode) ? "target_absent" : mode === "zero_handle" ? "wrong_window" : mode);
    assert.equal(result.selected, mode === "selected" ? true : mode === "unselected" ? false : null, mode);
    assert.equal(JSON.stringify(result).includes("private"), false);
  }
});

test("Windows owned-parent cleanup closes exact unselected fixture only and reports failed owned close", { skip: process.platform !== "win32" }, async () => {
  const execute = promisify(execFile);
  const fixture = String.raw`
$expected = $env:WORKSPACE_OBSERVE_TARGET
$parent = [IO.Path]::GetDirectoryName($expected)
$closed = [Collections.Generic.List[string]]::new()
function Make-View($id, $path, $targetPath) {
  $folder = [pscustomobject]@{ Self = [pscustomobject]@{ Path = $path }; targetPath = $targetPath }
  $folder | Add-Member ScriptMethod ParseName { param($name) [pscustomobject]@{ Path = $this.targetPath } }
  $window = [pscustomobject]@{ id = $id; HWND = $(if ($id -eq 'shared') { 999 } else { 123 }); Document = [pscustomobject]@{ Folder = $folder } }
  $window | Add-Member ScriptMethod Quit { if ($this.id -eq 'failed') { throw 'private close error' }; $closed.Add($this.id) }
  return $window
}
$views = @((Make-View 'other_parent' 'C:\Other' $expected), (Make-View 'wrong_target' $parent 'C:\Other\target'),
  (Make-View 'exact_unselected' $parent $expected), (Make-View 'failed' $parent $expected), (Make-View 'shared' $parent $expected))
$shellFixture = [pscustomobject]@{}
$shellFixture | Add-Member ScriptMethod Windows { return $views }
function New-Object { param([string]$ComObject) return $shellFixture }
function Read-WorkspaceUiaWindow($handle) { if ($handle -eq 999) { return @{ stage = 'ambiguous_parent' } }; if ($handle -ne 123) { throw 'private handle' }; return @{ stage = 'verified' } }
`;
  let closed;
  const result = await closeDisposableFileManagerTarget(target, "win32", async (program, args, options) => {
    const [load, ...body] = args.at(-1).split("\n");
    const output = await execute(program, [...args.slice(0, -1), load + "\n" + fixture + "\n& { " + body.join("\n") + " }\nConvertTo-Json -InputObject @($closed.ToArray()) -Compress"], { ...options, timeout: 30000 });
    const lines = output.stdout.trim().split(/\r?\n/);
    closed = JSON.parse(lines[1]);
    return { stdout: lines[0] };
  }, { ownedParent: true });
  assert.deepEqual(closed, ["exact_unselected"]);
  assert.equal(result.status, "pending");
  assert.equal(result.matched, 3);
  assert.equal(result.closed, 1);
  assert.equal(result.errorCount, 2);
});

// Real UIA condition/pattern types with controlled provider objects exercise the
// actual reader without opening, selecting or enumerating any desktop window.
// PropertyCondition stores ControlType as its integer Id (not the CLR object):
// https://github.com/dotnet/wpf/blob/main/src/Microsoft.DotNet.Wpf/src/UIAutomation/UIAutomationClient/System/Windows/Automation/PropertyCondition.cs
// The exact f753 Windows red log failed at tabs before any pattern read.
test("Windows UIA reader validates HWND/process/tab/view/item before reading SelectionItemPattern", { skip: process.platform !== "win32" }, async (t) => {
  const source = await readFile(new URL("../scripts/windows-selection-diagnostics.ps1", import.meta.url), "utf8");
  const execute = promisify(execFile);
  const fixture = String.raw`
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
function Get-Process { param($Id) $script:step = 'process'; if ($Id -ne 456) { throw 'private process' }; return @{ ProcessName = $(if ($mode -eq 'wrong_process') { 'other' } else { 'explorer' }) } }
function Get-WorkspaceUiaRoot($handle) { $script:step = 'root'; if ($handle -ne 123) { throw 'private handle' }; return $root }
$cases = @('selected', 'unselected', 'wrong_handle', 'wrong_process', 'tabs', 'view_absent', 'wrong_view_class', 'wrong_view_type', 'duplicate_views', 'target_absent', 'duplicates', 'offscreen', 'no_pattern', 'read_error')
foreach ($mode in $cases) {
  $patternReads = 0
  $itemReads = 0
  $step = 'setup'
  $item = [pscustomobject]@{ Current = [pscustomobject]@{ IsOffscreen = ($mode -eq 'offscreen') } }
  $item | Add-Member ScriptMethod TryGetCurrentPattern { param($pattern, $output)
    $script:step = 'pattern'
    if ($pattern -ne [System.Windows.Automation.SelectionItemPattern]::Pattern) { throw 'private pattern' }
    $script:patternReads++
    if ($mode -eq 'read_error') { throw 'private provider failure' }
    if ($mode -eq 'no_pattern') { return $false }
    $output.Value = [pscustomobject]@{ Current = [pscustomobject]@{ IsSelected = ($mode -eq 'selected') } }
    return $true
  }
  $view = [pscustomobject]@{}
  $view | Add-Member ScriptMethod FindAll { param($scope, $condition)
    $script:step = 'items'
    $script:itemReads++
    if ($scope -ne [System.Windows.Automation.TreeScope]::Children) { throw 'private scope' }
    $conditions = $condition.GetConditions()
    if ($conditions[0].Property -ne [System.Windows.Automation.AutomationElement]::NameProperty -or
        $conditions[0].Value -ne [IO.Path]::GetFileName($env:WORKSPACE_OBSERVE_TARGET) -or
        $conditions[1].Property -ne [System.Windows.Automation.AutomationElement]::ControlTypeProperty -or
        $conditions[1].Value -ne [System.Windows.Automation.ControlType]::ListItem.Id) { throw 'private item query' }
    if ($mode -eq 'target_absent') { return ,@() }
    if ($mode -eq 'duplicates') { return ,@($item, $item) }
    return ,@($item)
  }
  # Exact f753 Explorer evidence had a List/UIItemsView with a different ID.
  $view | Add-Member NoteProperty Current ([pscustomobject]@{
    ControlType = $(if ($mode -eq 'wrong_view_type') { [System.Windows.Automation.ControlType]::Pane } else { [System.Windows.Automation.ControlType]::List })
    ClassName = $(if ($mode -eq 'wrong_view_class') { 'other' } else { 'UIItemsView' })
    AutomationId = $(if ($mode -eq 'wrong_view_class') { 'ItemsView' } else { 'other' })
  })
  $root = [pscustomobject]@{ Current = [pscustomobject]@{ NativeWindowHandle = $(if ($mode -eq 'wrong_handle') { 999 } else { 123 }); ProcessId = 456; ControlType = [System.Windows.Automation.ControlType]::Window } }
  $root | Add-Member ScriptMethod FindAll { param($scope, $condition)
    $script:step = 'views'
    if ($scope -ne [System.Windows.Automation.TreeScope]::Descendants) { throw 'private scope' }
    if ($condition -is [System.Windows.Automation.PropertyCondition]) {
      $script:step = 'tabs'
      if ($condition.Property -ne [System.Windows.Automation.AutomationElement]::ControlTypeProperty -or
          $condition.Value -ne [System.Windows.Automation.ControlType]::TabItem.Id) { throw 'private tab query' }
      return ,$(if ($mode -eq 'tabs') { @(1, 2) } else { @() })
    }
    $conditions = $condition.GetConditions()
    if ($condition -is [System.Windows.Automation.OrCondition]) {
      $script:step = 'shape'
      if ($conditions[0].Property -ne [System.Windows.Automation.AutomationElement]::AutomationIdProperty -or
          $conditions[0].Value -ne 'ItemsView' -or $conditions[1].Property -ne [System.Windows.Automation.AutomationElement]::ClassNameProperty -or
          $conditions[1].Value -ne 'UIItemsView') { throw 'private shape query' }
      if ($mode -eq 'view_absent') { return ,@() }
      if ($mode -eq 'duplicate_views') { return ,@($view, $view) }
      return ,@($view)
    }
    if ($conditions[0].Property -ne [System.Windows.Automation.AutomationElement]::ClassNameProperty -or
        $conditions[0].Value -ne 'UIItemsView' -or $conditions[1].Property -ne [System.Windows.Automation.AutomationElement]::ControlTypeProperty -or
        $conditions[1].Value -ne [System.Windows.Automation.ControlType]::List.Id) { throw 'private view query' }
    if ($mode -eq 'view_absent' -or $view.Current.ClassName -cne $conditions[0].Value -or
        $view.Current.ControlType.Id -ne $conditions[1].Value) { return ,@() }
    if ($mode -eq 'duplicate_views') { return ,@($view, $view) }
    return ,@($view)
  }
  $stage = 'exception'
  $result = $null
  $syntheticError = $null
  $collectionShape = $null
  try {
    $result = Read-WorkspaceUiaSelection 123 ([IO.Path]::GetFileName($env:WORKSPACE_OBSERVE_TARGET))
    $stage = $result.stage
  } catch {
    # Only synthetic providers run here. Retain finite failure detail, never the
    # exception message/stack, which is inappropriate for real OS observation.
    $type = switch ($_.Exception.GetType().FullName) {
      'System.Management.Automation.MethodInvocationException' { 'method_invocation' }
      'System.Management.Automation.RuntimeException' { 'runtime' }
      'System.ArgumentException' { 'argument' }
      'System.InvalidOperationException' { 'invalid_operation' }
      'System.Runtime.InteropServices.COMException' { 'com' }
      default { 'other' }
    }
    $syntheticError = [ordered]@{ type = $type; hresult = [int]$_.Exception.HResult; sourceLine = [int]$_.InvocationInfo.ScriptLineNumber }
  }
  # Check the mock's actual method-return collection contract independently of
  # the reader outcome, including empty and duplicate collections. Do not fix
  # or normalize a failing mock without the Windows failure evidence.
  $readerStep = $step
  try {
    $condition = [System.Windows.Automation.AndCondition]::new(
      [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'UIItemsView'),
      [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::List))
    $collection = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
    $collectionShape = [ordered]@{ count = [int]$collection.Count; firstIsView = ($collection.Count -gt 0 -and [object]::ReferenceEquals($collection[0], $view)) }
  } catch { $collectionShape = [ordered]@{ count = $null; firstIsView = $false } }
  [ordered]@{ mode = $mode; stage = $stage; itemReads = $itemReads; patternReads = $patternReads; selected = $result.selected; step = $readerStep; syntheticError = $syntheticError; collectionShape = $collectionShape } | ConvertTo-Json -Depth 4 -Compress
}
`;
  const output = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", source + "\n" + fixture], {
    timeout: 30000, maxBuffer: 16384, windowsHide: true, env: { ...process.env, WORKSPACE_OBSERVE_TARGET: target },
  });
  const results = output.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  // Report every bounded synthetic case before the first assertion, so a
  // selected-mode failure does not hide later collection/provider diagnostics.
  assert.ok(Buffer.byteLength(output.stdout, "utf8") <= 16384);
  for (const result of results) t.diagnostic(JSON.stringify(result));
  const expected = { selected: "selected", unselected: "unselected", wrong_handle: "wrong_window", wrong_process: "wrong_window",
    tabs: "ambiguous_parent", view_absent: "view_absent", wrong_view_class: "view_absent", wrong_view_type: "view_absent", duplicate_views: "ambiguous_view", target_absent: "target_absent", duplicates: "ambiguous_target",
    offscreen: "ambiguous_target", no_pattern: "pattern_unavailable", read_error: "exception" };
  assert.equal(results.length, Object.keys(expected).length);
  for (const result of results) {
    assert.deepEqual(result.collectionShape, { count: ["view_absent", "wrong_view_class", "wrong_view_type"].includes(result.mode) ? 0 : result.mode === "duplicate_views" ? 2 : 1,
      firstIsView: !["view_absent", "wrong_view_class", "wrong_view_type"].includes(result.mode) }, result.mode);
    assert.equal(result.stage, expected[result.mode], result.mode);
    assert.equal(result.itemReads, ["selected", "unselected", "target_absent", "duplicates", "offscreen", "no_pattern", "read_error"].includes(result.mode) ? 1 : 0, result.mode);
    assert.equal(result.patternReads, ["selected", "unselected", "no_pattern", "read_error"].includes(result.mode) ? 1 : 0, result.mode);
    assert.equal(result.selected, result.mode === "selected" ? true : result.mode === "unselected" ? false : null, result.mode);
  }
});
