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

// This report belongs only to the synthetic fixture below, never the real reader.
// No arbitrary CLR type names or property/runtime-ID values reach the CI log.
const syntheticKinds = ['null', 'not_supported', 'boolean', 'rect', 'int32', 'int32_array', 'object_array', 'psobject', 'other'];
function syntheticBindingReport(value) {
  const shape = (input) => {
    assert.ok(syntheticKinds.includes(input?.kind));
    assert.ok(input.count === null || Number.isInteger(input.count) && input.count >= 0 && input.count <= 9);
    assert.ok(Array.isArray(input.members) && input.members.length <= 8 && input.members.every((kind) => syntheticKinds.includes(kind)));
    assert.equal(input.members.length, input.count === null ? 0 : Math.min(input.count, 8));
    assert.equal(['int32_array', 'object_array'].includes(input.kind), input.count !== null);
    return { kind: input.kind, count: input.count, members: [...input.members] };
  };
  const element = (input, item) => {
    assert.equal(typeof input?.available, 'boolean');
    assert.equal(typeof input.runtimeIdValid, 'boolean');
    const fields = ['IsEnabled', 'IsOffscreen', 'BoundingRectangle', ...(item ? ['HasKeyboardFocus', 'IsSelected'] : [])];
    return { available: input.available, runtimeIdValid: input.runtimeIdValid, runtimeId: shape(input.runtimeId),
      fields: Object.fromEntries(fields.map((field) => [field, shape(input.fields?.[field])])) };
  };
  return { view: element(value?.view, false), item: element(value?.item, true) };
}

test('synthetic binding reports retain finite field/collection types and exclude values or arbitrary type names', () => {
  const scalar = { kind: 'boolean', count: null, members: [] };
  const id = { kind: 'object_array', count: 1, members: ['int32_array'] };
  const fields = Object.fromEntries(['IsEnabled', 'IsOffscreen', 'BoundingRectangle', 'HasKeyboardFocus', 'IsSelected']
    .map((field) => [field, { ...scalar, private: target }]));
  const input = { available: false, runtimeIdValid: false, runtimeId: id, fields, private: target };
  const value = { view: input, item: input, private: target };
  const result = syntheticBindingReport(value);
  assert.equal(JSON.stringify(result).includes(target), false);
  assert.deepEqual(result.view.runtimeId, id);
  assert.equal(result.item.available, false);
  for (const invalid of [{ ...id, kind: target }, { ...id, count: 10 }, { ...id, members: [target] },
    { ...id, count: 2 }, { ...scalar, count: 0 }, { ...id, members: Array(9).fill('int32') }]) {
    assert.throws(() => syntheticBindingReport({ ...value, view: { ...input, runtimeId: invalid } }));
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

test("Windows terminal binding uses actual UIA conditions and retains disabled/offscreen states", { skip: process.platform !== "win32" }, async (t) => {
  const script = String.raw`
$ErrorActionPreference = 'Stop'
. ./scripts/windows-selection-diagnostics.ps1
. ./scripts/windows-native-view-diagnostics.ps1
# Rect belongs to WindowsBase. Load it before the FIRST synthetic construction,
# rather than depending on a later UIA query to load the referenced assembly.
Add-Type -AssemblyName WindowsBase, UIAutomationClient, UIAutomationTypes -ErrorAction Stop
if ($null -ne (Test-WorkspaceTerminalBounds $null) -or
    $null -ne (Test-WorkspaceTerminalBounds ([pscustomobject]@{ X = 0 }))) { throw 'missing bounds became false' }
# Synthetic objects only. Record type/collection shapes, not values, names or exception text.
function Get-SyntheticKind($value) {
  if ($null -eq $value) { return 'null' }
  if ([object]::ReferenceEquals($value, [System.Windows.Automation.AutomationElement]::NotSupported)) { return 'not_supported' }
  switch ($value.GetType().FullName) {
    'System.Boolean' { return 'boolean' }
    'System.Windows.Rect' { return 'rect' }
    'System.Int32' { return 'int32' }
    'System.Int32[]' { return 'int32_array' }
    'System.Object[]' { return 'object_array' }
    'System.Management.Automation.PSObject' { return 'psobject' }
    default { return 'other' }
  }
}
function Get-SyntheticShape($value) {
  $kind = Get-SyntheticKind $value
  $count = $null; $members = @()
  if ($kind -in @('int32_array', 'object_array')) {
    $count = [Math]::Min(9, $value.Length)
    for ($index = 0; $index -lt [Math]::Min(8, $value.Length); $index++) { $members += Get-SyntheticKind $value[$index] }
  }
  return [ordered]@{ kind = $kind; count = $count; members = @($members) }
}
function Get-SyntheticElementShape($element, $isItem) {
  $fields = [ordered]@{}
  $names = @('IsEnabled', 'IsOffscreen', 'BoundingRectangle')
  if ($isItem) { $names += @('HasKeyboardFocus', 'IsSelected') }
  foreach ($field in $names) {
    $property = if ($field -eq 'IsSelected') { [System.Windows.Automation.SelectionItemPattern]::IsSelectedProperty }
      else { [System.Windows.Automation.AutomationElement]::($field + 'Property') }
    $value = $element.GetCurrentPropertyValue($property, $true)
    $fields[$field] = Get-SyntheticShape $value
  }
  $runtimeId = $element.GetRuntimeId()
  $read = Read-WorkspaceTerminalElement $element $isItem
  return [ordered]@{ fields = $fields; runtimeId = (Get-SyntheticShape $runtimeId);
    runtimeIdValid = (Test-WorkspaceTerminalRuntimeId $runtimeId); available = ($null -ne $read) }
}
function Get-Process { param($Id) return @{ ProcessName = $(if ($mode -eq 'wrong_process') { 'other' } else { 'explorer' }) } }
function Get-WorkspaceUiaRoot($handle) { return $root }
function Read-WorkspaceTerminalNativeWindow($handle) { return @{ stage = 'verified'; processId = $(if ($mode -eq 'native_pid_mismatch') { 999 } else { 456 }); windowVisible = $true; windowMinimized = $false; windowForeground = $false } }
$name = [IO.Path]::GetFileName($env:WORKSPACE_OBSERVE_TARGET)
foreach ($mode in @('observed','late_selected','unready','wrong_handle','wrong_process','native_pid_mismatch','tabs','view_absent','duplicate_views','target_absent','duplicate_items','no_pattern','unsupported_bool','unsupported_bounds','unsupported_selected','null_view_bounds','null_item_bounds','null_view_id','empty_item_id','nested_view_id')) {
  $patternReads = 0
  $bounds = [System.Windows.Rect]::new(-50.5,0,$(if ($mode -eq 'unready') { 0 } else { 100 }),50)
  # This runs in a fresh -NoProfile process, before any reader/query invocation.
  if ($bounds -isnot [System.Windows.Rect]) { throw 'synthetic bounds initialization failed' }
  $item = [pscustomobject]@{ Current = [pscustomobject]@{ IsEnabled = ($mode -ne 'unready'); IsOffscreen = ($mode -eq 'unready'); BoundingRectangle = $bounds; HasKeyboardFocus = $false } }
  if ($mode -eq 'null_item_bounds') { $item.Current.BoundingRectangle = $null }
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
  if ($mode -eq 'null_view_bounds') { $view.Current.BoundingRectangle = $null }
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
  $diagnostics = [ordered]@{ view = (Get-SyntheticElementShape $view $false); item = (Get-SyntheticElementShape $item $true) }
  [ordered]@{ mode = $mode; stage = $result.stage; snapshot = $result.snapshot; patternReads = $patternReads; diagnostics = $diagnostics } | ConvertTo-Json -Depth 7 -Compress
}
`;
  const { stdout, stderr } = await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    timeout: 30000, maxBuffer: 65536, windowsHide: true, env: { ...process.env, WORKSPACE_OBSERVE_TARGET: target },
  });
  assert.equal(stderr.trim().length, 0, 'controlled binding fixture emitted PowerShell errors');
  const results = stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(results.length, 20);
  const modes = ['observed','late_selected','unready','wrong_handle','wrong_process','native_pid_mismatch','tabs','view_absent',
    'duplicate_views','target_absent','duplicate_items','no_pattern','unsupported_bool','unsupported_bounds','unsupported_selected',
    'null_view_bounds','null_item_bounds','null_view_id','empty_item_id','nested_view_id'];
  assert.deepEqual(results.map(({ mode }) => mode), modes);
  // Emit every case BEFORE the first strict assertion; a broken observed case
  // must not hide the unsupported/nested-ID controls needed to diagnose it.
  for (const { mode, diagnostics } of results) {
    t.diagnostic(JSON.stringify({ mode, diagnostics: syntheticBindingReport(diagnostics) }));
  }
  for (const { mode, stage, snapshot, patternReads, diagnostics } of results) {
    const verified = ["observed", "late_selected", "unready"].includes(mode);
    const expected = verified ? "verified" : ["wrong_handle", "wrong_process", "native_pid_mismatch"].includes(mode) ? "wrong_window" :
      mode === "tabs" ? "ambiguous_parent" : ["view_absent", "duplicate_views"].includes(mode) ? "ambiguous_view" :
      mode === "duplicate_items" ? "ambiguous_target" : mode === "no_pattern" || mode.startsWith("unsupported_") || mode.startsWith("null_") || mode.endsWith("_id") ? "property_unavailable" : mode;
    assert.equal(stage, expected, mode);
    assert.equal(patternReads, verified || mode === "no_pattern" || mode.startsWith("unsupported_") || mode.startsWith("null_") || mode.endsWith("_id") ? 1 : 0, mode);
    assert.equal(diagnostics.view.fields.BoundingRectangle.kind,
      mode === 'unsupported_bounds' ? 'not_supported' : mode === 'null_view_bounds' ? 'null' : 'rect', mode);
    assert.equal(diagnostics.item.fields.BoundingRectangle.kind, mode === 'null_item_bounds' ? 'null' : 'rect', mode);
    if (mode === 'null_view_bounds') assert.equal(diagnostics.view.available, false, mode);
    if (mode === 'null_item_bounds') assert.equal(diagnostics.item.available, false, mode);
    if (verified) {
      assert.equal(diagnostics.view.available, true, mode);
      assert.equal(diagnostics.item.available, true, mode);
      assert.equal(snapshot.itemSelected, mode === "late_selected", mode);
      assert.equal(snapshot.itemEnabled, mode !== "unready", mode);
      assert.equal(snapshot.itemOffscreen, mode === "unready", mode);
      assert.equal(snapshot.itemBoundsNonempty, mode !== "unready", mode);
    } else assert.equal(snapshot ?? null, null, mode);
  }
});

test('creation failure collects terminal native state only after its strict verdict and confirmed bridge stop', async () => {
  const source=await readFile(new URL('../scripts/smoke-project-creation.mjs',import.meta.url),'utf8');
  const verdict=source.indexOf('Reveal must invoke the real native API exactly once');
  const stopped=source.indexOf('nativeBridgesStopped &&= nativeBridgeCleanup.status === "passed";',source.indexOf('} finally {',verdict));
  const inspect=source.indexOf('await inspectNativeView(target)');
  assert.ok(inspect > verdict && inspect > stopped);
  assert.match(source.slice(stopped,inspect), /failure && process.platform === "win32" && process.env.WORKSPACE_REVEAL_TRACE === "1" && nativeBridgesStopped/);
  assert.match(source.slice(inspect,inspect+700), /termination !== "unknown"/);
  assert.match(source.slice(inspect,inspect+700), /nativeBridgesStopped = false/);
});
