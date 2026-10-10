import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";
import { inspectNativeView, parseNativeViewResponse } from "../scripts/windows-native-view-diagnostics.mjs";

const target = "C:\\Disposable\\Folder's 日本語 $value `quoted` & text";
const snapshot = { comBusy: false, readyState: 4, comVisible: true, windowVisible: true,
  windowMinimized: false, windowForeground: true, viewEnabled: true, viewOffscreen: false,
  viewBoundsNonempty: true, itemEnabled: true, itemOffscreen: false, itemBoundsNonempty: true,
  itemKeyboardFocus: false, itemSelected: false };
const observed = { version: 1, stage: "observed", snapshot, code: null };

test("terminal snapshot retains finite states, including unready and late-selected states, without acceptance", () => {
  for (const values of [snapshot, { ...snapshot, comBusy: true, readyState: 1, windowMinimized: true,
    itemOffscreen: true, itemBoundsNonempty: false }, { ...snapshot, itemSelected: true }]) {
    const response = { ...observed, snapshot: values };
    assert.deepEqual(parseNativeViewResponse(JSON.stringify({ ...response, hwnd: 123, path: target,
      snapshot: { ...values, title: target } })), response);
  }
});

test("terminal protocol rejects malformed, missing and contradictory state without leaking output", () => {
  for (const value of [null, [], {}, { ...observed, version: 2 }, { ...observed, code: 0 },
    { ...observed, stage: "private" }, { ...observed, snapshot: null },
    ...[null, "4", -1, 5, 0.5].map((readyState) => ({ ...observed, snapshot: { ...snapshot, readyState } })),
    ...Object.keys(snapshot).filter((key) => key !== "readyState").map((key) => ({ ...observed, snapshot: { ...snapshot, [key]: null } })),
    { version: 1, stage: "view_changed", snapshot, code: null },
    { version: 1, stage: "read_error", snapshot: null, code: null }]) {
    assert.equal(parseNativeViewResponse(JSON.stringify(value)), null);
  }
  assert.equal(parseNativeViewResponse(" ".repeat(8193)), null);
  for (const stage of ["parent_absent", "ambiguous_parent", "target_absent", "wrong_window", "ambiguous_view", "ambiguous_target", "view_changed", "property_unavailable"]) {
    const value = { version: 1, stage, snapshot: null, code: null };
    assert.deepEqual(parseNativeViewResponse(JSON.stringify(value)), value);
  }
  const error = { version: 1, stage: "read_error", snapshot: null, code: -2147467259 };
  assert.deepEqual(parseNativeViewResponse(JSON.stringify(error)), error);
});

function fixture(action, killCloses = true) {
  const timers = new Map();
  let calls = 0;
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stdout.destroy = () => { child.destroyed = true; };
  child.unref = () => { child.released = true; };
  child.kill = () => { if (killCloses) queueMicrotask(() => child.emit("close", null, "SIGKILL")); };
  return { child, get calls() { return calls; }, clock: {
    setTimeout: (fn, ms) => { timers.set(ms, fn); return ms; }, clearTimeout: (id) => timers.delete(id),
  }, fire: (ms) => timers.get(ms)(), spawnProcess: (program, args, options) => {
    calls++;
    assert.equal(program, "powershell.exe");
    assert.deepEqual(args.slice(0, 3), ["-NoProfile", "-NonInteractive", "-File"]);
    assert.ok(args[3].endsWith("windows-native-view-diagnostics.ps1"));
    assert.equal(args.length, 4);
    assert.equal(args.join(" ").includes(target), false);
    assert.equal(options.env.WORKSPACE_OBSERVE_TARGET, target);
    assert.equal(options.shell, false);
    assert.deepEqual(options.stdio, ["ignore", "pipe", "ignore"]);
    queueMicrotask(() => action(child));
    return child;
  } };
}

test("terminal inspector uses one fixed read-only bridge and environment-only Unicode input", async () => {
  const f = fixture((child) => { child.stdout.emit("data", JSON.stringify(observed)); child.emit("close", 0); });
  const result = await inspectNativeView(target, { platform: "win32", ...f });
  assert.equal(f.calls, 1);
  assert.equal(result.status, "observed");
  assert.deepEqual(result.diagnostic, observed);
  assert.equal(result.process.termination, "confirmed");
  assert.equal(JSON.stringify(result).includes(target), false);
});

test("terminal unavailable, invalid protocol and process error remain separate from any selection verdict", async () => {
  for (const [output, code, stage] of [[JSON.stringify({ version: 1, stage: "property_unavailable", snapshot: null, code: null }), 0, "property_unavailable"],
    [target, 0, "protocol_error"], [JSON.stringify(observed), 7, "process_error"], ["a".repeat(8193), 0, "output_limit"]]) {
    const f = fixture((child) => { child.stdout.emit("data", output); child.emit("close", code); });
    const result = await inspectNativeView(target, { platform: "win32", ...f });
    assert.equal(result.status, "unavailable"); assert.equal(result.stage, stage);
    assert.equal(result.process.termination, "confirmed"); assert.equal(f.calls, 1);
    assert.equal(JSON.stringify(result).includes(target), false);
  }
});

test("five-second terminal budget and one-second termination confirmation never claim an unknown kill as cleanup", async () => {
  for (const killCloses of [true, false]) {
    const f = fixture(() => {}, killCloses);
    const pending = inspectNativeView(target, { platform: "win32", ...f });
    f.fire(5000);
    if (!killCloses) f.fire(1000);
    const result = await pending;
    assert.equal(result.stage, "timeout");
    assert.equal(result.process.termination, killCloses ? "confirmed" : "unknown");
    assert.equal(result.diagnostic, null); assert.equal(f.calls, 1);
    if (!killCloses) { assert.equal(f.child.released, true); assert.equal(f.child.destroyed, true); }
  }
});

test("terminal inspector never starts for unsupported input/host and sanitizes launch/stream failures", async () => {
  for (const options of [{ platform: "darwin" }, { platform: "win32" }]) {
    const result = await inspectNativeView("", { ...options, spawnProcess: () => { throw new Error(target); } });
    assert.equal(result.process.termination, "not_started");
  }
  const f = fixture((child) => { child.stdout.emit("error", new Error(target)); child.emit("close", 1); });
  const result = await inspectNativeView(target, { platform: "win32", ...f });
  assert.equal(result.stage, "output_error"); assert.equal(JSON.stringify(result).includes(target), false);
});

test("terminal script contains no dispatch, navigation, input, screenshot or raw output boundary", async () => {
  const source = await readFile("scripts/windows-native-view-diagnostics.ps1", "utf8");
  for (const forbidden of ["SHOpenFolderAndSelectItems", "SelectItem(", "SetForegroundWindow", "SendKeys", "PrintWindow", "CopyFromScreen", ".Navigate(", "RootElement", "Write-Host"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

// Actual PowerShell/UIA guards are exercised on Windows with synthetic objects;
// this test neither opens nor selects a real Explorer window.
test("Windows terminal owner rejects changed COM/HWND/PID/tab/view binding and unsupported properties", { skip: process.platform !== "win32" }, async () => {
  const script = String.raw`
. ./scripts/windows-native-view-diagnostics.ps1
. ./scripts/windows-selection-diagnostics.ps1
$expected = $env:WORKSPACE_OBSERVE_TARGET
$parent = [IO.Path]::GetDirectoryName($expected)
$cases = @('observed', 'late_selected', 'unready', 'parent_absent', 'ambiguous_parent', 'wrong_parent', 'wrong_target', 'zero_handle', 'wrong_window', 'tabs', 'view_absent', 'duplicate_views', 'target_absent', 'duplicate_items', 'changed_parent', 'changed_handle', 'changed_process', 'changed_item', 'null_id', 'empty_id', 'nested_id', 'missing_busy', 'bad_ready', 'read_error')
foreach ($mode in $cases) {
  $folder = [pscustomobject]@{ Self = [pscustomobject]@{ Path = $(if ($mode -eq 'wrong_parent') { 'C:\Other' } else { $parent }) } }
  $folder | Add-Member ScriptMethod ParseName { param($name) [pscustomobject]@{ Path = $(if ($mode -eq 'wrong_target') { 'C:\Other\target' } else { $expected }) } }
  $window = [pscustomobject]@{ HWND = $(if ($mode -eq 'zero_handle') { 0 } else { 123 }); Document = [pscustomobject]@{ Folder = $folder }; Busy = ($mode -eq 'unready'); ReadyState = $(if ($mode -eq 'bad_ready') { 7 } else { 4 }); Visible = $true }
  if ($mode -eq 'missing_busy') { $window.PSObject.Properties.Remove('Busy') }
  $reads = 0
  function Read-WorkspaceTerminalBinding($handle, $name) {
    $script:reads++
    if ($mode -eq 'read_error') { throw [Runtime.InteropServices.COMException]::new('private', -2147467259) }
    if ($mode -in @('wrong_window','tabs','view_absent','duplicate_views','target_absent','duplicate_items')) {
      return @{ stage = $(switch ($mode) { 'tabs' {'ambiguous_parent'} 'view_absent' {'ambiguous_view'} 'duplicate_views' {'ambiguous_view'} 'duplicate_items' {'ambiguous_target'} default {$mode} }) }
    }
    if ($mode -eq 'changed_parent') { $folder.Self.Path = 'C:\Other' }
    if ($mode -eq 'changed_handle') { $window.HWND = 999 }
    $flags = @{ windowVisible = $true; windowMinimized = ($mode -eq 'unready'); windowForeground = $false; viewEnabled = $true; viewOffscreen = $false; viewBoundsNonempty = $true; itemEnabled = $true; itemOffscreen = ($mode -eq 'unready'); itemBoundsNonempty = $true; itemKeyboardFocus = $false; itemSelected = ($mode -eq 'late_selected') }
    return @{ stage = 'verified'; processId = $(if ($mode -eq 'changed_process' -and $reads -gt 1) { 777 } else { 456 }); viewId = @(1,2); itemId = $(switch ($mode) { 'null_id' { ,@($null) } 'empty_id' { ,@() } 'nested_id' { ,@(,@(1,2)) } default { ,@($(if ($mode -eq 'changed_item' -and $reads -gt 1) { 4 } else { 3 })) } }); snapshot = $flags }
  }
  $windows = [Collections.Generic.List[object]]::new()
  if ($mode -ne 'parent_absent') { $windows.Add($window) }
  if ($mode -eq 'ambiguous_parent') { $windows.Add($window) }
  $result = Get-WorkspaceTerminalDiagnostic $windows $expected
  [ordered]@{ mode = $mode; reads = $reads; result = $result } | ConvertTo-Json -Depth 5 -Compress
}
`;
  const { stdout } = await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    timeout: 30000, maxBuffer: 32768, windowsHide: true, env: { ...process.env, WORKSPACE_OBSERVE_TARGET: target },
  });
  const results = stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(results.length, 24);
  for (const { mode, result, reads } of results) {
    const expected = ["observed", "late_selected", "unready"].includes(mode) ? "observed" :
      ["wrong_parent", "wrong_target"].includes(mode) ? "target_absent" : mode === "zero_handle" ? "wrong_window" :
      mode.startsWith("changed_") || mode.endsWith("_id") ? "view_changed" : ["missing_busy", "bad_ready"].includes(mode) ? "property_unavailable" :
      mode === "tabs" ? "ambiguous_parent" : ["view_absent", "duplicate_views"].includes(mode) ? "ambiguous_view" :
      mode === "duplicate_items" ? "ambiguous_target" : mode;
    assert.equal(result.stage, expected, mode);
    assert.ok(parseNativeViewResponse(JSON.stringify(result)), mode);
    if (expected === "observed") {
      assert.equal(reads, 2, mode); assert.equal(result.snapshot.itemSelected, mode === "late_selected");
      assert.equal(result.snapshot.comBusy, mode === "unready");
    } else assert.equal(result.snapshot, null, mode);
    assert.equal(JSON.stringify(result).includes("private"), false);
    assert.equal(JSON.stringify(result).includes(target), false);
  }
});

test("Windows terminal binding uses actual UIA conditions and retains disabled/offscreen states", { skip: process.platform !== "win32" }, async () => {
  const script = String.raw`
. ./scripts/windows-selection-diagnostics.ps1
. ./scripts/windows-native-view-diagnostics.ps1
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
if ($null -ne (Test-WorkspaceTerminalBounds $null) -or
    $null -ne (Test-WorkspaceTerminalBounds ([pscustomobject]@{ X = 0 }))) { throw 'missing bounds became false' }
function Get-Process { param($Id) return @{ ProcessName = $(if ($mode -eq 'wrong_process') { 'other' } else { 'explorer' }) } }
function Get-WorkspaceUiaRoot($handle) { return $root }
function Read-WorkspaceTerminalNativeWindow($handle) { return @{ stage = 'verified'; processId = $(if ($mode -eq 'native_pid_mismatch') { 999 } else { 456 }); windowVisible = $true; windowMinimized = $false; windowForeground = $false } }
$name = [IO.Path]::GetFileName($env:WORKSPACE_OBSERVE_TARGET)
foreach ($mode in @('observed','late_selected','unready','wrong_handle','wrong_process','native_pid_mismatch','tabs','view_absent','duplicate_views','target_absent','duplicate_items','no_pattern','unsupported_bool','unsupported_bounds','unsupported_selected','null_view_id','empty_item_id','nested_view_id')) {
  $patternReads = 0
  $bounds = [System.Windows.Rect]::new(-50.5,0,$(if ($mode -eq 'unready') { 0 } else { 100 }),50)
  $item = [pscustomobject]@{ Current = [pscustomobject]@{ IsEnabled = ($mode -ne 'unready'); IsOffscreen = ($mode -eq 'unready'); BoundingRectangle = $bounds; HasKeyboardFocus = $false } }
  $item | Add-Member ScriptMethod GetRuntimeId { if ($mode -eq 'empty_item_id') { return ,([int[]]@()) }; return ,([int[]]@(4,5)) }
  $item | Add-Member ScriptMethod GetCurrentPropertyValue { param($property, $ignoreDefault)
    if ($ignoreDefault -ne $true) { throw 'private defaults not ignored' }
    switch ($property.Id) {
      ([System.Windows.Automation.AutomationElement]::IsEnabledProperty.Id) { return $this.Current.IsEnabled }
      ([System.Windows.Automation.AutomationElement]::IsOffscreenProperty.Id) { return $this.Current.IsOffscreen }
      ([System.Windows.Automation.AutomationElement]::BoundingRectangleProperty.Id) { return $this.Current.BoundingRectangle }
      ([System.Windows.Automation.AutomationElement]::HasKeyboardFocusProperty.Id) { return $this.Current.HasKeyboardFocus }
      ([System.Windows.Automation.SelectionItemPattern]::IsSelectedProperty.Id) {
        if ($mode -eq 'unsupported_selected') { return [System.Windows.Automation.AutomationElement]::NotSupported }
        return ($mode -eq 'late_selected')
      }
      default { throw 'private unsupported item property' }
    }
  }
  $item | Add-Member ScriptMethod TryGetCurrentPattern { param($pattern, $output)
    if ($pattern -ne [System.Windows.Automation.SelectionItemPattern]::Pattern) { throw 'private pattern' }
    $script:patternReads++
    if ($mode -eq 'no_pattern') { return $false }
    $output.Value = [pscustomobject]@{ Current = [pscustomobject]@{ IsSelected = ($mode -eq 'late_selected') } }
    return $true
  }
  $view = [pscustomobject]@{ Current = [pscustomobject]@{ IsEnabled = $true; IsOffscreen = $false; BoundingRectangle = $bounds } }
  $view | Add-Member ScriptMethod GetRuntimeId {
    if ($mode -eq 'null_view_id') { return $null }
    if ($mode -eq 'nested_view_id') { return ,@(,@(2,3)) }
    return ,([int[]]@(2,3))
  }
  $view | Add-Member ScriptMethod GetCurrentPropertyValue { param($property, $ignoreDefault)
    if ($ignoreDefault -ne $true) { throw 'private defaults not ignored' }
    switch ($property.Id) {
      ([System.Windows.Automation.AutomationElement]::IsEnabledProperty.Id) {
        if ($mode -eq 'unsupported_bool') { return [System.Windows.Automation.AutomationElement]::NotSupported }
        return $this.Current.IsEnabled
      }
      ([System.Windows.Automation.AutomationElement]::IsOffscreenProperty.Id) { return $this.Current.IsOffscreen }
      ([System.Windows.Automation.AutomationElement]::BoundingRectangleProperty.Id) {
        if ($mode -eq 'unsupported_bounds') { return [System.Windows.Automation.AutomationElement]::NotSupported }
        return $this.Current.BoundingRectangle
      }
      default { throw 'private unsupported view property' }
    }
  }
  $view | Add-Member ScriptMethod FindAll { param($scope, $condition)
    $parts = $condition.GetConditions()
    if ($scope -ne [System.Windows.Automation.TreeScope]::Children -or
      $parts[0].Property -ne [System.Windows.Automation.AutomationElement]::NameProperty -or $parts[0].Value -cne $name -or
      $parts[1].Property -ne [System.Windows.Automation.AutomationElement]::ControlTypeProperty -or $parts[1].Value -ne [System.Windows.Automation.ControlType]::ListItem.Id) { throw 'private item query' }
    if ($mode -eq 'target_absent') { return ,@() }
    if ($mode -eq 'duplicate_items') { return ,@($item,$item) }
    return ,@($item)
  }
  $root = [pscustomobject]@{ Current = [pscustomobject]@{ NativeWindowHandle = $(if ($mode -eq 'wrong_handle') { 999 } else { 123 }); ProcessId = 456; ControlType = [System.Windows.Automation.ControlType]::Window } }
  $root | Add-Member ScriptMethod FindAll { param($scope, $condition)
    if ($scope -ne [System.Windows.Automation.TreeScope]::Descendants) { throw 'private scope' }
    if ($condition -is [System.Windows.Automation.PropertyCondition]) {
      if ($condition.Property -ne [System.Windows.Automation.AutomationElement]::ControlTypeProperty -or $condition.Value -ne [System.Windows.Automation.ControlType]::TabItem.Id) { throw 'private tab query' }
      if ($mode -eq 'tabs') { return ,@(1,2) }; return ,@()
    }
    $parts = $condition.GetConditions()
    if ($parts[0].Property -ne [System.Windows.Automation.AutomationElement]::ClassNameProperty -or $parts[0].Value -cne 'UIItemsView' -or
      $parts[1].Property -ne [System.Windows.Automation.AutomationElement]::ControlTypeProperty -or $parts[1].Value -ne [System.Windows.Automation.ControlType]::List.Id) { throw 'private view query' }
    if ($mode -eq 'view_absent') { return ,@() }
    if ($mode -eq 'duplicate_views') { return ,@($view,$view) }
    return ,@($view)
  }
  $result = Read-WorkspaceTerminalBinding 123 $name
  # Raw runtime IDs/PID are internal ownership data, never terminal evidence.
  [ordered]@{ mode = $mode; stage = $result.stage; snapshot = $result.snapshot; patternReads = $patternReads } | ConvertTo-Json -Depth 4 -Compress
}
`;
  const { stdout } = await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    timeout: 30000, maxBuffer: 32768, windowsHide: true, env: { ...process.env, WORKSPACE_OBSERVE_TARGET: target },
  });
  const results = stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(results.length, 18);
  for (const { mode, stage, snapshot, patternReads } of results) {
    const verified = ["observed", "late_selected", "unready"].includes(mode);
    const expected = verified ? "verified" : ["wrong_handle", "wrong_process", "native_pid_mismatch"].includes(mode) ? "wrong_window" :
      mode === "tabs" ? "ambiguous_parent" : ["view_absent", "duplicate_views"].includes(mode) ? "ambiguous_view" :
      mode === "duplicate_items" ? "ambiguous_target" : mode === "no_pattern" || mode.startsWith("unsupported_") || mode.endsWith("_id") ? "property_unavailable" : mode;
    assert.equal(stage, expected, mode);
    assert.equal(patternReads, verified || mode === "no_pattern" || mode.startsWith("unsupported_") || mode.endsWith("_id") ? 1 : 0, mode);
    if (verified) {
      assert.equal(snapshot.itemSelected, mode === "late_selected", mode);
      assert.equal(snapshot.itemEnabled, mode !== "unready", mode);
      assert.equal(snapshot.itemOffscreen, mode === "unready", mode);
      assert.equal(snapshot.itemBoundsNonempty, mode !== "unready", mode);
    }
  }
});
