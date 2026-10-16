import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { parseReadySelectionResponse } from "../scripts/windows-ready-selection.mjs";

const modes = ["selected", "delayed_ready", "unselected", "wrong_selected", "duplicate_selected", "absent", "wrong_parent",
  "duplicate_parent", "busy", "incomplete", "missing_busy", "string_busy", "missing_ready", "string_ready", "zero_handle",
  "wrong_owner", "ambiguous_tabs", "target_absent", "wrong_target", "changed_document_before", "changed_handle_before",
  "changed_owner_before", "changed_parent_before", "changed_target_before", "changed_document_after", "changed_handle_after",
  "changed_owner_after", "changed_parent_after", "changed_target_after", "late_open", "late_binding", "late_precommand",
  "late_selection", "late_selected_read", "navigation_throw", "selection_throw", "read_throw", "missing_selected",
  "bad_selected_count", "readiness_reverts"];

test("Windows actual command controller enforces readiness exact binding one intent and one total budget", {
  skip: process.platform !== "win32",
}, async (t) => {
  const script = String.raw`
$ErrorActionPreference = 'Stop'
. ./scripts/windows-ready-selection.ps1
. ./tests/fixtures/windows-com-read-controls.ps1
# Exercise the actual identity helper on distinct controlled COM instances first.
$a = New-Object -ComObject Scripting.Dictionary
$b = New-Object -ComObject Scripting.Dictionary
if (-not (Test-WorkspaceReadyDocument $a $a) -or (Test-WorkspaceReadyDocument $a $b)) { throw 'identity' }
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($a)
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($b)
function Test-WorkspaceReadyDocument($left, $right) { return [object]::ReferenceEquals($left, $right) }
function Get-WorkspaceReadyMilliseconds($watch) { return $script:now }
function Wait-WorkspaceReadyPoll($milliseconds) { $script:now += $milliseconds }
function Read-WorkspaceReadyOwner($handle) {
  if ($handle -eq 0 -or $script:mode -in @('wrong_owner','ambiguous_tabs')) { return $null }
  return $script:owner
}
$expected = $env:WORKSPACE_CONTROL_TARGET
foreach ($mode in ($env:WORKSPACE_CONTROL_MODES | ConvertFrom-Json)) {
  $script:mode = $mode; $script:now = 0.0; $script:owner = 456
  $script:opens = 0; $script:selects = 0; $script:enumerations = 0
  $script:itemPath = $expected
  $parent = [IO.Path]::GetDirectoryName($expected)
  $folder = [pscustomobject]@{ Self = [pscustomobject]@{ Path = $parent } }
  $folder | Add-Member ScriptMethod ParseName { param($name)
    if ($name -cne [IO.Path]::GetFileName($env:WORKSPACE_CONTROL_TARGET)) { throw 'literal transport' }
    if ($script:mode -eq 'target_absent') { return $null }
    return [pscustomobject]@{ Path = $(if ($script:mode -eq 'wrong_target') { 'C:\private\other' } else { $script:itemPath }) }
  }
  $document = [pscustomobject]@{ Folder = $folder }
  $document | Add-Member ScriptMethod SelectItem { param($item, $flags)
    $script:selects++
    if ($flags -ne 5 -or $item.Path -cne $env:WORKSPACE_CONTROL_TARGET) { throw 'item/flags' }
    if ($script:mode -eq 'selection_throw') { throw [Runtime.InteropServices.COMException]::new('private path', -2147467259) }
    if ($script:mode -eq 'late_selection') { $script:now = 10001.25 }
  }
  $document | Add-Member ScriptMethod SelectedItems {
    if ($script:mode -eq 'missing_selected') { return $null }
    if ($script:mode -eq 'late_selected_read') { $script:now = 10001.5 }
    $items = [pscustomobject]@{ Count = $(if ($script:mode -eq 'unselected') { 0 } elseif ($script:mode -eq 'duplicate_selected') { 2 }
        elseif ($script:mode -eq 'bad_selected_count') { '1' } else { 1 }) }
    $items | Add-Member ScriptMethod Item { param($index)
      return [pscustomobject]@{ Path = $(if ($script:mode -eq 'wrong_selected') { 'C:\private\same-name' } else { $env:WORKSPACE_CONTROL_TARGET }) }
    }
    return $items
  }
  $script:window = [pscustomobject]@{ HWND = 123; Document = $document; Busy = ($mode -in @('busy','delayed_ready')); ReadyState = $(if ($mode -eq 'incomplete') { 3 } else { 4 }) }
  if ($mode -eq 'zero_handle') { $script:window.HWND = 0 }
  if ($mode -eq 'wrong_parent') { $folder.Self.Path = 'C:\private\wrong' }
  if ($mode -eq 'missing_busy') { $script:window.PSObject.Properties.Remove('Busy') }
  if ($mode -eq 'string_busy') { $script:window.Busy = 'false' }
  if ($mode -eq 'missing_ready') { $script:window.PSObject.Properties.Remove('ReadyState') }
  if ($mode -eq 'string_ready') { $script:window.ReadyState = '4' }
  $shell = [pscustomobject]@{}
  $shell | Add-Member ScriptMethod Open { param($path)
    $script:opens++
    if ($path -cne [IO.Path]::GetDirectoryName($env:WORKSPACE_CONTROL_TARGET)) { throw 'parent transport' }
    if ($script:mode -eq 'navigation_throw') { throw [Runtime.InteropServices.COMException]::new('private', -2147467259) }
    if ($script:mode -eq 'late_open') { $script:now = 10000.5 }
  }
  $shell | Add-Member ScriptMethod Windows {
    $script:enumerations++
    if ($script:mode -eq 'read_throw') { throw [Runtime.InteropServices.COMException]::new('private', -2147467259) }
    if ($script:mode -eq 'late_binding') { $script:now = 10000.25 }
    if ($script:mode -eq 'late_precommand' -and $script:enumerations -eq 2) { $script:now = 10000.75 }
    if ($script:mode -eq 'delayed_ready' -and $script:now -ge 200) { $script:window.Busy = $false }
    if ($script:mode -eq 'readiness_reverts' -and $script:enumerations -eq 2) { $script:window.Busy = $true }
    $changeBefore = $script:mode.EndsWith('_before') -and $script:enumerations -eq 2
    $changeAfter = $script:mode.EndsWith('_after') -and $script:selects -eq 1
    if ($changeBefore -or $changeAfter) {
      if ($script:mode.StartsWith('changed_document')) { $script:window.Document = [pscustomobject]@{ Folder = $script:window.Document.Folder } }
      if ($script:mode.StartsWith('changed_handle')) { $script:window.HWND = 999 }
      if ($script:mode.StartsWith('changed_owner')) { $script:owner = 777 }
      if ($script:mode.StartsWith('changed_parent')) { $script:window.Document.Folder.Self.Path = 'C:\private\other' }
      if ($script:mode.StartsWith('changed_target')) { $script:itemPath = 'C:\private\other' }
    }
    $collection = [pscustomobject]@{ Count = $(if ($script:mode -eq 'absent') { 0 } elseif ($script:mode -eq 'duplicate_parent') { 2 } else { 1 }) }
    $entries = [object[]]@()
    if ($script:mode -ne 'absent') { $entries = [object[]]@($script:window) }
    if ($script:mode -eq 'duplicate_parent') {
      $otherWindow = [pscustomobject]@{ HWND = 124; Document = [pscustomobject]@{ Folder = $script:window.Document.Folder }; Busy = $false; ReadyState = 4 }
      $entries = [object[]]@($script:window, $otherWindow)
    }
    $collection | Add-Member NoteProperty Entries $entries
    $collection | Add-Member ScriptMethod Item { param($index) throw 'indexed_acquisition_forbidden' }
    return $collection
  }
  $watch = [Diagnostics.Stopwatch]::new()
  $result = Invoke-WorkspaceReadySelection $shell $expected $watch
  [ordered]@{ mode = $mode; actualOpens = $script:opens; actualSelects = $script:selects; result = $result } | ConvertTo-Json -Depth 5 -Compress
}
`;
  const target = "C:\\owned fixture\\日本語, & $literal 'quote' %x% !^; `tick` (folder)";
  const { stdout, stderr } = await promisify(execFile)(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,
    ["-STA", "-NoProfile", "-NonInteractive", "-Command", script], {
      timeout: 30000, maxBuffer: 65536, windowsHide: true,
      env: { ...process.env, WORKSPACE_CONTROL_TARGET: target, WORKSPACE_CONTROL_MODES: JSON.stringify(modes) },
    });
  assert.equal(stderr, "");
  const reports = stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(reports.length, modes.length);
  for (const { mode, result, actualOpens, actualSelects } of reports) {
    await t.test(mode, () => {
      assert.ok(parseReadySelectionResponse(JSON.stringify(result)), `invalid protocol: ${JSON.stringify(result)}`);
      assert.equal(actualOpens, 1); assert.equal(result.navigationCount, actualOpens);
      const shouldSelect = ["selected", "delayed_ready", "unselected", "wrong_selected", "duplicate_selected", "late_selection", "late_selected_read",
        "selection_throw", "missing_selected", "bad_selected_count"].includes(mode) || mode.endsWith("_after");
      assert.equal(actualSelects, shouldSelect ? 1 : 0); assert.equal(result.selectionCount, actualSelects);
      if (["selected", "delayed_ready"].includes(mode)) {
        assert.equal(result.stage, "selected"); assert.equal(result.selected, true);
        assert.ok(result.elapsedMs < 10000);
        if (mode === "delayed_ready") { assert.equal(result.readyMs, 200); assert.equal(result.readinessAttempts, 3); }
      } else {
        assert.notEqual(result.stage, "selected"); assert.notEqual(result.selected, true);
        if (mode.startsWith("late_") || ["unselected", "wrong_selected", "duplicate_selected", "absent", "wrong_parent", "busy", "incomplete", "target_absent", "wrong_target"].includes(mode)) assert.equal(result.stage, "deadline");
        if (mode.endsWith("_throw")) assert.ok(Number.isInteger(result.code));
      }
      assert.equal(JSON.stringify(result).includes("private"), false); assert.equal(JSON.stringify(result).includes(target), false);
      assert.ok(result.readinessAttempts <= 128); assert.ok(result.confirmationAttempts <= 128);
    });
  }
});
