import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { win32 } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

function policyProbeSummary(result) {
  const line = typeof result.stdout === "string" ? result.stdout.trim() : "";
  const valid = /^(?:LOADED|MANAGED|FAILED:(?:module_import|policy_query|helper_load):(?:SecurityException|CommandNotFoundException|RuntimeException|PSSecurityException|unknown):-?\d{1,10}:(?:Desktop|Core|unknown):\d{1,2}:\d{1,2})$/.test(line);
  return { marker: valid ? line : "protocol_error", code: Number.isInteger(result.code) ? result.code : null,
    killed: result.killed === true, stderrEmpty: result.stderr === "" };
}

test("policy probe failure context retains only finite type/code/runtime markers", () => {
  const failure = "FAILED:module_import:RuntimeException:-2146233087:Desktop:5:1";
  assert.deepEqual(policyProbeSummary({ stdout: failure, stderr: "", code: 1 }),
    { marker: failure, code: 1, killed: false, stderrEmpty: true });
  for (const stdout of ["LOADED\nprivate path", "FAILED:private:RuntimeException:1:Desktop:5:1", "C:\\private\\module", "x".repeat(5000)]) {
    assert.deepEqual(policyProbeSummary({ stdout, stderr: "private exception", code: "private" }),
      { marker: "protocol_error", code: null, killed: false, stderrEmpty: false });
  }
  assert.equal(policyProbeSummary({ stdout: "MANAGED\r\n", stderr: "", code: 0 }).marker, "MANAGED");
  assert.equal(policyProbeSummary({ stdout: "", stderr: "", killed: true }).killed, true);
});

test("production and diagnostic scripts share the exact binding guards without diagnostic telemetry", async () => {
  const [bridge, binding, view, readyDiagnostic, selectionDiagnostic] = await Promise.all([
    "../src/desktop/native/windows-project-reveal.ps1", "../src/desktop/native/windows-binding.ps1",
    "../src/desktop/native/windows-view.ps1", "../scripts/windows-ready-selection.ps1",
    "../scripts/windows-selection-diagnostics.ps1",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  assert.match(bridge, /\. "\$PSScriptRoot\/windows-binding\.ps1"/);
  assert.match(bridge, /\. "\$PSScriptRoot\/windows-view\.ps1"/);
  assert.match(readyDiagnostic, /\. "\$PSScriptRoot\/\.\.\/src\/desktop\/native\/windows-binding\.ps1"/);
  assert.match(selectionDiagnostic, /\. "\$PSScriptRoot\/\.\.\/src\/desktop\/native\/windows-view\.ps1"/);
  assert.doesNotMatch(bridge + binding + view, /Native selection|workspace-native-selection-|Get-WorkspaceUiaQueryShape|Get-WorkspaceSelectionDiagnostic/);
  assert.doesNotMatch(readyDiagnostic, /function Read-WorkspaceReadyBinding/);
  assert.doesNotMatch(selectionDiagnostic, /function Read-WorkspaceUiaWindow/);
  assert.match(bridge, /function Invoke-WorkspaceProjectRevealFromEnvironment/);
  assert.match(bridge, /return Invoke-WorkspaceProjectReveal \$shell \$env:WORKSPACE_PROJECT_REVEAL_TARGET \$watch/);
  assert.match(bridge, /\$completed = Invoke-WorkspaceProjectRevealFromEnvironment \$shell/);
  assert.doesNotMatch(bridge, /WORKSPACE_CONTROL_TARGET/);
  // Every read in the COM binding uses direct IDispatch; PowerShell member
  // discovery on a cold Explorer must not return to this path.
  assert.match(binding, /\[System.__ComObject\].InvokeMember\(\$name, \[Reflection.BindingFlags\]::GetProperty/);
  assert.match(binding, /\[System.__ComObject\].InvokeMember\(\$name, \[Reflection.BindingFlags\]::InvokeMethod/);
  assert.doesNotMatch(binding, /\$windows\.Count|\$windows\.Item\(|\$candidate\.Document|\$document\.Folder|\$window\.(Document|HWND|Busy|ReadyState)|\$item\.Path/);
  assert.match(binding, /Invoke-WorkspaceComMethod \$windows '\[DispID=0\]' @\(\$i\) \$trace/);
  assert.doesNotMatch(bridge, /\$anchor.item.Path/);
  assert.equal((bridge.match(/\.SelectItem\(/g) ?? []).length, 1);
  assert.equal((bridge.match(/\$shell\.Open\(/g) ?? []).length, 1);
});

test("Windows shipped environment consumer requires one timely permit and retains captured COM binding before and after selection", {
  skip: process.platform !== "win32",
}, async (t) => {
  const modes = ["selected", "delayed_ready", "bad_permit", "duplicate_permit", "extra_permit", "missing_newline", "eof", "late_permit", "permit_throw", "relative_input", "empty_input",
    "captured_item_permit",
    "absent", "duplicate_parent", "wrong_parent", "wrong_target", "wrong_owner", "busy", "missing_busy",
    "missing_ready", "string_busy", "string_ready", "zero_handle", "navigation_throw", "selection_throw",
    "read_throw", "late_open", "late_binding", "late_precommand", "late_event", "late_selection", "late_postcheck",
    ...["document", "handle", "owner", "parent", "target", "unready"].flatMap((part) => [`${part}_permit`, `${part}_after`])];
  const script = String.raw`
$ErrorActionPreference = 'Stop'
. ./src/desktop/native/windows-project-reveal.ps1
. ./tests/fixtures/windows-com-read-controls.ps1
# Test the unchanged COM identity helper with genuine, distinct COM objects.
$a = New-Object -ComObject Scripting.Dictionary
$b = New-Object -ComObject Scripting.Dictionary
if (-not (Test-WorkspaceReadyDocument $a $a) -or (Test-WorkspaceReadyDocument $a $b)) { throw 'identity' }
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($a)
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($b)
function Test-WorkspaceReadyDocument($left, $right) { return [object]::ReferenceEquals($left, $right) }
function Get-WorkspaceRevealMilliseconds($watch) { return $script:now }
function Wait-WorkspaceRevealPoll($milliseconds) { $script:now += $milliseconds }
function Write-WorkspaceRevealEvent($event) {
  $script:events.Add($event)
  if ($script:mode -eq 'late_event' -and $event -eq 'SELECT') { $script:now = 10000 }
}
function Read-WorkspaceReadyOwner($handle) {
  if ($handle -le 0 -or $script:mode -eq 'wrong_owner') { return $null }
  return $script:owner
}
function Change-WorkspaceFixture($phase) {
  if ($script:mode -eq "document_$phase") { $script:window.Document = [pscustomobject]@{ Folder = $script:folder } }
  if ($script:mode -eq "handle_$phase") { $script:window.HWND = 999 }
  if ($script:mode -eq "owner_$phase") { $script:owner = 777 }
  if ($script:mode -eq "parent_$phase") { $script:folder.Self.Path = 'C:\private\other' }
  if ($script:mode -eq "target_$phase") { $script:itemPath = 'C:\private\other' }
  if ($script:mode -eq "captured_item_$phase") { $script:capturedItem.Path = 'C:\private\other' }
  if ($script:mode -eq "unready_$phase") { $script:window.Busy = $true }
}
$script:originalPermitReader = (Get-Item Function:Read-WorkspaceRevealPermit).ScriptBlock
function Read-WorkspaceRevealPermit {
  $script:permits++
  Change-WorkspaceFixture 'permit'
  if ($script:mode -eq 'permit_throw') { throw 'private permit' }
  if ($script:mode -eq 'late_permit') { $script:now = 10000 }
  $inputText = 'GO' + [char]10
  if ($script:mode -eq 'bad_permit') { $inputText = 'go' + [char]10 }
  if ($script:mode -eq 'duplicate_permit') { $inputText = 'GO' + [char]10 + 'GO' + [char]10 }
  if ($script:mode -eq 'extra_permit') { $inputText = 'GO' + [char]10 + 'x' }
  if ($script:mode -eq 'missing_newline') { $inputText = 'GO' }
  if ($script:mode -eq 'eof') { $inputText = '' }
  $originalInput = [Console]::In
  try {
    [Console]::SetIn([IO.StringReader]::new($inputText))
    $permit = & $script:originalPermitReader
    return $permit
  } finally { [Console]::SetIn($originalInput) }
}
$expected = $env:WORKSPACE_PROJECT_REVEAL_TARGET
foreach ($mode in ($env:WORKSPACE_CONTROL_MODES | ConvertFrom-Json)) {
  $script:mode = $mode; $script:now = 0.0; $script:owner = 456; $script:opens = 0
  $script:selects = 0; $script:permits = 0; $script:enumerations = 0
  $script:events = [Collections.Generic.List[string]]::new(); $script:itemPath = $expected; $script:capturedItem = $null
  $script:folder = [pscustomobject]@{ Self = [pscustomobject]@{ Path = [IO.Path]::GetDirectoryName($expected) } }
  $script:folder | Add-Member ScriptMethod ParseName { param($name)
    if ($name -cne [IO.Path]::GetFileName($env:WORKSPACE_PROJECT_REVEAL_TARGET)) { throw 'literal name' }
    $item = [pscustomobject]@{ Path = $(if ($script:mode -eq 'wrong_target') { 'C:\private\other' } else { $script:itemPath }) }
    if ($null -eq $script:capturedItem) { $script:capturedItem = $item }
    return $item
  }
  $document = [pscustomobject]@{ Folder = $script:folder }
  $document | Add-Member ScriptMethod SelectItem { param($item, $flags)
    $script:selects++
    if ($flags -ne 5 -or $item.Path -cne $env:WORKSPACE_PROJECT_REVEAL_TARGET) { throw 'private command' }
    if ($script:mode -eq 'selection_throw') { throw 'private selection' }
    if ($script:mode -eq 'late_selection') { $script:now = 10000 }
    Change-WorkspaceFixture 'after'
  }
  $script:window = [pscustomobject]@{ HWND = 123; Document = $document; Busy = ($mode -in @('busy','delayed_ready')); ReadyState = 4 }
  if ($mode -eq 'wrong_parent') { $script:folder.Self.Path = 'C:\private\other' }
  if ($mode -eq 'missing_busy') { $script:window.PSObject.Properties.Remove('Busy') }
  if ($mode -eq 'missing_ready') { $script:window.PSObject.Properties.Remove('ReadyState') }
  if ($mode -eq 'string_busy') { $script:window.Busy = 'false' }
  if ($mode -eq 'string_ready') { $script:window.ReadyState = '4' }
  if ($mode -eq 'zero_handle') { $script:window.HWND = 0 }
  $shell = [pscustomobject]@{}
  $shell | Add-Member ScriptMethod Open { param($parent)
    $script:opens++
    if ($parent -cne [IO.Path]::GetDirectoryName($env:WORKSPACE_PROJECT_REVEAL_TARGET)) { throw 'literal parent' }
    if ($script:mode -eq 'navigation_throw') { throw 'private navigation' }
    if ($script:mode -eq 'late_open') { $script:now = 10000 }
  }
  $shell | Add-Member ScriptMethod Windows {
    $script:enumerations++
    if ($script:mode -eq 'read_throw') { throw 'private read' }
    if ($script:mode -eq 'late_binding') { $script:now = 10000 }
    if ($script:mode -eq 'late_precommand' -and $script:permits -eq 1) { $script:now = 10000 }
    if ($script:mode -eq 'late_postcheck' -and $script:selects -eq 1) { $script:now = 10000 }
    if ($script:mode -eq 'delayed_ready' -and $script:now -ge 200) { $script:window.Busy = $false }
    $collection = [pscustomobject]@{ Count = $(if ($script:mode -eq 'absent') { 0 } elseif ($script:mode -eq 'duplicate_parent') { 2 } else { 1 }) }
    $collection | Add-Member ScriptMethod Item { param($index) return $script:window }
    return $collection
  }
  $inputValue = $(if ($mode -eq 'relative_input') { '.\relative' } elseif ($mode -eq 'empty_input') { '' } else { $expected })
  $env:WORKSPACE_PROJECT_REVEAL_TARGET = $inputValue
  $completed = Invoke-WorkspaceProjectRevealFromEnvironment $shell ([Diagnostics.Stopwatch]::new())
  $env:WORKSPACE_PROJECT_REVEAL_TARGET = $expected
  [ordered]@{ mode = $mode; completed = $completed; opens = $script:opens; selects = $script:selects;
    permits = $script:permits; events = @($script:events.ToArray()); elapsed = $script:now } | ConvertTo-Json -Compress
}
`;
  const target = "C:\\ordinary source\\日本語, & $literal 'quote' %x% !^; `tick` (folder)";
  const { stdout, stderr } = await promisify(execFile)(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,
    ["-STA", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
      timeout: 30000, maxBuffer: 65536, windowsHide: true,
      env: { ...process.env, WORKSPACE_PROJECT_REVEAL_TARGET: target,
        WORKSPACE_CONTROL_TARGET: "C:\\unrelated diagnostic target", WORKSPACE_CONTROL_MODES: JSON.stringify(modes) },
    });
  assert.equal(stderr, "");
  const reports = stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(reports.length, modes.length);
  for (const report of reports) await t.test(report.mode, () => {
    const { mode, completed, opens, selects, permits, events, elapsed } = report;
    const succeeds = ["selected", "delayed_ready"].includes(mode);
    const invalidInput = ["relative_input", "empty_input"].includes(mode);
    const selectsOnce = succeeds || mode.endsWith("_after") || ["selection_throw", "late_selection", "late_postcheck"].includes(mode);
    assert.equal(completed, succeeds); assert.equal(opens, invalidInput ? 0 : 1); assert.equal(selects, selectsOnce ? 1 : 0);
    assert.ok(permits === 0 || permits === 1); assert.equal(events.filter((event) => event === "READY").length, permits);
    assert.equal(events[0], invalidInput ? "FAIL:input:input" : "OPEN"); assert.match(events.at(-1), succeeds ? /^DONE$/ : /^FAIL:(input|navigation|readiness|permit|precommand|selection|postcheck):(input|deadline|binding|unready|permit|exception)$/);
    assert.equal(events.filter((event) => event === "SELECT").length, selectsOnce || mode === "late_event" ? 1 : 0);
    assert.equal(events.filter((event) => event.startsWith("FAIL:")).length, succeeds ? 0 : 1);
    if (succeeds) assert.ok(elapsed < 10000);
    if (mode === "delayed_ready") assert.equal(elapsed, 200);
    const expectedFailure = { late_permit: "FAIL:permit:deadline", late_precommand: "FAIL:precommand:deadline",
      late_postcheck: "FAIL:postcheck:deadline", document_permit: "FAIL:precommand:binding",
      selection_throw: "FAIL:selection:exception", read_throw: "FAIL:readiness:exception" }[mode];
    if (expectedFailure) assert.equal(events.at(-1), expectedFailure);
    assert.doesNotMatch(JSON.stringify(report), /private|ordinary source|日本語/);
  });
});

test("Windows direct COM reads preserve scalar, collection and error results without PowerShell member lookup", {
  skip: process.platform !== "win32",
}, async () => {
  const script = String.raw`
$ErrorActionPreference = 'Stop'
. ./src/desktop/native/windows-binding.ps1
$shell = New-Object -ComObject Shell.Application
$windows = $shell.Windows()
$named = Invoke-WorkspaceComMethod $windows 'Item' @(0)
$identified = Invoke-WorkspaceComMethod $windows '[DispID=0]' @(0)
if (($null -eq $named) -ne ($null -eq $identified)) { throw 'dispatch_null_identity' }
if ($null -ne $named -and -not (Test-WorkspaceReadyDocument $named $identified)) { throw 'dispatch_identity' }
$dictionary = New-Object -ComObject Scripting.Dictionary
try {
  if ((Get-WorkspaceComProperty $dictionary 'Count') -cne 0) { throw 'empty_count' }
  [void](Invoke-WorkspaceComMethod $dictionary 'Add' @('one', 1))
  [void](Invoke-WorkspaceComMethod $dictionary 'Add' @('two', 2))
  if ((Get-WorkspaceComProperty $dictionary 'Count') -cne 2) { throw 'count' }
  if ((Invoke-WorkspaceComMethod $dictionary 'Exists' @('missing')) -cne $false) { throw 'false_scalar' }
  if ((Invoke-WorkspaceComMethod $dictionary 'Exists' @('one')) -cne $true) { throw 'true_scalar' }
  $boundaries = [Collections.Generic.List[string]]::new()
  if ((Invoke-WorkspaceComMethod $dictionary 'Exists' @('one') { param($phase) $boundaries.Add($phase) }) -cne $true -or
      $boundaries.Count -ne 1 -or $boundaries[0] -cne 'item_returned') { throw 'completion_marker' }
  $methodRejected = $false
  try { [void](Invoke-WorkspaceComMethod $dictionary 'MissingMethod' @() { param($phase) $boundaries.Add($phase) }) } catch { $methodRejected = $true }
  if (-not $methodRejected -or $boundaries.Count -ne 1) { throw 'exception_marker' }
  if ((Invoke-WorkspaceComMethod $dictionary 'Exists' @('one') { throw 'TRACE_FAULT' }) -cne $true) { throw 'trace_interference' }
  $keys = Invoke-WorkspaceComMethod $dictionary 'Keys' @()
  if ($keys -isnot [Array] -or $keys.Count -ne 2 -or $keys[0] -cne 'one' -or $keys[1] -cne 'two') { throw 'collection' }
  $rejected = $false
  try { [void](Get-WorkspaceComProperty $dictionary 'MissingProperty') } catch { $rejected = $true }
  if (-not $rejected) { throw 'missing_property_accepted' }
  [void](Invoke-WorkspaceComMethod $dictionary 'RemoveAll' @())
  $empty = Invoke-WorkspaceComMethod $dictionary 'Keys' @()
  if ($empty -isnot [Array] -or $empty.Count -ne 0) { throw 'empty_collection' }
} finally { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($dictionary) }
[Console]::Out.WriteLine('COM_READ_CONTROL')
`;
  const result = await promisify(execFile)(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,
    ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
    { windowsHide: true, timeout: 10000 });
  assert.equal(result.stdout.trim(), "COM_READ_CONTROL");
  assert.equal(result.stderr, "");
});

test("Windows production file bridge uses only child-session policy under inherited Restricted without opening Explorer", {
  skip: process.platform !== "win32", timeout: 40000,
}, async (t) => {
  const { resolveWindowsPowerShell, runWindowsProjectReveal } = await import("../src/desktop/windows-project-reveal.ts");
  const program = resolveWindowsPowerShell();
  assert.equal(typeof program, "string", "The actual Windows host must resolve its system PowerShell");
  const nativeDirectory = fileURLToPath(new URL("../src/desktop/native/", import.meta.url));
  const scriptPath = win32.join(nativeDirectory, "windows-project-reveal.ps1");
  const target = win32.parse(program).root;
  const parentPolicy = process.env.PSExecutionPolicyPreference;
  const parentModulePath = process.env.PSModulePath;
  const parentTarget = process.env.WORKSPACE_PROJECT_REVEAL_TARGET;
  const restricted = { ...process.env, PSExecutionPolicyPreference: "Restricted", WORKSPACE_PROJECT_REVEAL_TARGET: target };
  const fixedArguments = ["-NoProfile", "-NonInteractive", "-STA"];
  const execute = promisify(execFile);
  // No COM instance, navigation or policy mutation. Confirm that the actual
  // fixed-file dependency graph loads, not just that inline commands can run.
  const loadProbe = String.raw`
$ErrorActionPreference = 'Stop'
$stage = 'module_import'
try {
  # Node may inherit PS7 module paths. Select only this actual Windows
  # PowerShell installation's Security manifest, without changing PSModulePath.
  Import-Module -Name "$PSHOME\Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1" -ErrorAction Stop
  $stage = 'policy_query'
  if ((Microsoft.PowerShell.Security\Get-ExecutionPolicy) -ne 'Bypass') { [Console]::Out.WriteLine('MANAGED'); exit 0 }
  $stage = 'helper_load'
  . $env:WORKSPACE_POLICY_BRIDGE
  foreach ($name in @('Invoke-WorkspaceProjectRevealFromEnvironment','Read-WorkspaceReadyBinding','Read-WorkspaceUiaWindow')) {
    if ($null -eq (Get-Command $name -CommandType Function -ErrorAction Stop)) { throw 'missing function' }
  }
  [Console]::Out.WriteLine('LOADED')
} catch {
  $kind = $_.Exception.GetType().Name
  if ($kind -notin @('SecurityException','CommandNotFoundException','RuntimeException','PSSecurityException')) { $kind = 'unknown' }
  $edition = $PSVersionTable.PSEdition
  if ($edition -notin @('Desktop','Core')) { $edition = 'unknown' }
  $major = [Math]::Min(99, [Math]::Max(0, $PSVersionTable.PSVersion.Major))
  $minor = [Math]::Min(99, [Math]::Max(0, $PSVersionTable.PSVersion.Minor))
  [Console]::Out.WriteLine(('FAILED:{0}:{1}:{2}:{3}:{4}:{5}' -f $stage,$kind,[int]$_.Exception.HResult,$edition,$major,$minor))
  exit 1
}
`;
  try {
    const probeResult = await execute(program, [...fixedArguments, "-ExecutionPolicy", "Bypass", "-Command", loadProbe], {
      env: { ...restricted, WORKSPACE_POLICY_BRIDGE: scriptPath }, timeout: 10000, maxBuffer: 4096, windowsHide: true,
    }).then((result) => ({ ...result, code: 0 }), (error) => ({ stdout: error.stdout, stderr: error.stderr,
      code: error.code, killed: error.killed }));
    const loaded = policyProbeSummary(probeResult);
    assert.equal(loaded.killed, false, JSON.stringify(loaded));
    assert.equal(loaded.code, 0, JSON.stringify(loaded));
    assert.equal(loaded.stderrEmpty, true, JSON.stringify(loaded));
    if (loaded.marker === "MANAGED") {
      t.skip("Host Group Policy prevents verifying the child-session Bypass control; actual policy acceptance remains external");
      return;
    }
    assert.equal(loaded.marker, "LOADED", JSON.stringify(loaded));
    // Without the authorized process flag, the same actual -File entry is
    // refused under inherited Restricted before it can emit the fixed protocol.
    const refused = await execute(program, [...fixedArguments, "-File", scriptPath], {
      env: restricted, timeout: 10000, maxBuffer: 4096, windowsHide: true,
    }).then((result) => ({ ...result, failed: false }), (error) => ({ stdout: error.stdout, stderr: error.stderr,
      failed: Number.isInteger(error.code) && error.code !== 0 && error.killed !== true }));
    assert.equal(refused.failed, true, "The no-flag control must be a genuine policy refusal, not a timeout");
    assert.equal(refused.stdout === "", true, "Restricted must refuse before the entry emits protocol output");
    assert.equal(typeof refused.stderr === "string" && refused.stderr.length > 0, true);

    let launches = 0, output = "", errors = "", closeResult;
    const events = [];
    await assert.rejects(runWindowsProjectReveal(target, {
      isCurrent: () => true,
      permit: async () => { assert.fail("An invalid root-only target must never request selection permission"); },
    }, {
      nativeDirectory, program, onEvent: (event) => events.push(event),
      spawnProcess(executable, args, options) {
        launches++;
        assert.equal(executable, program);
        assert.deepEqual(args, [...fixedArguments, "-ExecutionPolicy", "Bypass", "-File", scriptPath]);
        assert.equal(options.env.WORKSPACE_PROJECT_REVEAL_TARGET, target);
        const child = spawn(executable, args, { ...options, env: { ...options.env, PSExecutionPolicyPreference: "Restricted" }, stdio: "pipe" });
        child.stdout.on("data", (chunk) => { output += chunk.toString("ascii"); });
        child.stderr.on("data", (chunk) => { errors += chunk.toString("ascii"); });
        child.on("close", (code, signal) => { closeResult = { code, signal }; });
        return child;
      },
    }), (error) => error.problem === "native_error" && error.message === "native_error");
    assert.equal(launches, 1);
    assert.equal(output.trim() === "FAIL:input:input", true, "The actual -File entry must execute its sanitized input rejection");
    assert.equal(errors === "", true, "Production must not expose policy or filesystem error details");
    assert.deepEqual(events, [{ stage: "started", path: target },
      { stage: "failure", path: target, phase: "input", reason: "input" }, { stage: "stopped", path: target }]);
    assert.equal(typeof closeResult, "object", "The owned child termination must be confirmed");
    assert.equal(closeResult?.code === 0 && closeResult?.signal === null, false);
  } finally {
    assert.equal(process.env.PSExecutionPolicyPreference, parentPolicy);
    assert.equal(process.env.PSModulePath, parentModulePath);
    assert.equal(process.env.WORKSPACE_PROJECT_REVEAL_TARGET, parentTarget);
  }
});

test("Windows finite trace deduplicates boundaries and cannot replace a real query failure", { skip: process.platform !== "win32" }, async () => {
  const script = String.raw`
$ErrorActionPreference = 'Stop'
. ./src/desktop/native/windows-project-reveal.ps1
$events = [Collections.Generic.List[string]]::new()
function Write-WorkspaceRevealEvent($event) { $script:events.Add($event) }
foreach ($phase in @('assemblies','compile','shell','open','enumeration','collection','window_item','document','parent','owner','uia_root','uia_properties','uia_tabs','readiness','item','document_recheck','readiness_recheck','binding_returned','item_returned')) { Write-WorkspaceRevealTrace $phase }
Write-WorkspaceRevealTrace 'assemblies'
Write-WorkspaceRevealTrace 'private path'
if ($events.Count -ne 19 -or $events[0] -cne 'TRACE:assemblies' -or $events[18] -cne 'TRACE:item_returned') { throw 'trace_control' }
$env:WORKSPACE_REVEAL_TRACE = '0'
Write-WorkspaceRevealTrace 'assemblies'
if ($events.Count -ne 19) { throw 'trace_disabled' }
$shell = [pscustomobject]@{}
$shell | Add-Member ScriptMethod Windows { throw 'REAL_QUERY' }
try {
  [void](Read-WorkspaceReadyBinding $shell 'C:\owned\Project' $null { throw 'TRACE_FAULT' })
  throw 'missing_query'
} catch {
  if (-not $_.Exception.Message.Contains('REAL_QUERY') -or $_.Exception.Message.Contains('TRACE_FAULT')) { throw 'trace_interference' }
}

# The actual consumer emits the completion marker only after a read returns.
function Wait-WorkspaceRevealPoll($milliseconds) { }
function Read-WorkspaceReadyBinding($shell, $expected, $anchor, $trace) {
  $script:reads++
  if ($script:firstReadThrows -or $script:reads -gt 1) { throw 'CONTROL_QUERY' }
  return @{ stage = 'parent_absent' }
}
$shell = [pscustomobject]@{}
$shell | Add-Member ScriptMethod Open { param($parent) }
$env:WORKSPACE_REVEAL_TRACE = '1'
foreach ($firstReadThrows in @($true, $false)) {
  $script:firstReadThrows = $firstReadThrows; $script:reads = 0
  $script:workspaceRevealTraceSeen = $null; $events.Clear()
  $completed = Invoke-WorkspaceProjectReveal $shell 'C:\owned\Project' ([Diagnostics.Stopwatch]::new())
  $returned = @($events | Where-Object { $_ -ceq 'TRACE:binding_returned' }).Count
  if ($completed -or $returned -ne $(if ($firstReadThrows) { 0 } else { 1 }) -or
      $events.Contains('READY') -or $events.Contains('SELECT') -or
      $events[$events.Count - 1] -cne 'FAIL:readiness:exception') { throw 'completion_boundary' }
}
[Console]::Out.WriteLine('TRACE_CONTROL')
`;
  const result = await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
    { env: { ...process.env, WORKSPACE_REVEAL_TRACE: "1" }, windowsHide: true, timeout: 10000 });
  assert.equal(result.stdout.trim(), "TRACE_CONTROL"); assert.equal(result.stderr, "");
});
