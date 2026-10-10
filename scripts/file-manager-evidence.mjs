import { execFile } from "node:child_process";
import { basename, dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
const execute = promisify(execFile);
const selectionDiagnosticsPath = fileURLToPath(new URL("./windows-selection-diagnostics.ps1", import.meta.url));

// Read only evidence for this exact disposable selected item. Do not record user
// locations, close arbitrary windows, or terminate the shared file manager.
export const windowsObservation = String.raw`
$ErrorActionPreference = 'Stop'
$diagnostic = [ordered]@{ exactParentFound = $false; targetPresent = $false; selectedTargetMatch = $false; exactParentCount = 0; errorCount = 0; errors = [Collections.Generic.List[object]]::new() }
function Record-ObservationError($stage, $failure) {
  $diagnostic.errorCount++
  if ($diagnostic.errors.Count -lt 8) {
    $diagnostic.errors.Add([ordered]@{ stage = $stage; code = [int]$failure.Exception.HResult })
  }
}
$ownedWindows = [Collections.Generic.List[object]]::new()
$stage = 'target'
try {
  $expected = [IO.Path]::GetFullPath($env:WORKSPACE_OBSERVE_TARGET).TrimEnd('\')
  $parent = [IO.Path]::GetDirectoryName($expected)
  $stage = 'shell'
  $shell = New-Object -ComObject Shell.Application
  $stage = 'windows'
  $windows = $shell.Windows()
  foreach ($window in $windows) {
    try {
      $document = $window.Document
      $folder = $document.Folder
      $path = $folder.Self.Path
      if ([string]::IsNullOrEmpty($path)) { throw [InvalidOperationException]::new('No filesystem view') }
      if (-not [string]::Equals([IO.Path]::GetFullPath($path).TrimEnd('\'), $parent, [StringComparison]::OrdinalIgnoreCase)) { continue }
      $diagnostic.exactParentFound = $true
      $diagnostic.exactParentCount++
      $ownedWindows.Add($window)
    } catch { Record-ObservationError 'document' $_; continue }
    try {
      $item = $folder.ParseName([IO.Path]::GetFileName($expected))
      if ($null -ne $item -and [string]::Equals([IO.Path]::GetFullPath($item.Path).TrimEnd('\'), $expected, [StringComparison]::OrdinalIgnoreCase)) { $diagnostic.targetPresent = $true }
    } catch { Record-ObservationError 'target' $_ }
    try {
      foreach ($item in $document.SelectedItems()) {
        if ([string]::Equals([IO.Path]::GetFullPath($item.Path).TrimEnd('\'), $expected, [StringComparison]::OrdinalIgnoreCase)) {
          $diagnostic.targetPresent = $true
          $diagnostic.selectedTargetMatch = $true
        }
      }
    } catch { Record-ObservationError 'selection' $_ }
    $stage = 'windows'
  }
} catch { Record-ObservationError $stage $_ }
if ($env:WORKSPACE_SELECTION_DIAGNOSTICS -eq '1') {
  # Preserve COM evidence even if the UIA provider blocks until process timeout.
  $diagnostic | ConvertTo-Json -Depth 4 -Compress
  $diagnostic['independentSelection'] = Get-WorkspaceSelectionDiagnostic $ownedWindows $expected
}
$diagnostic | ConvertTo-Json -Depth 4 -Compress
`;

export function windowsObservationResult(stdout, independent = false) {
  // Only explicitly selected scalar fields cross into evidence. Never retain raw
  // stdout, COM messages, window paths/titles, or selections from other folders.
  const invalid = () => ({ status: "pending", unavailable: true, diagnostics: { stage: "protocol_error" }, ...(independent ? independentSelectionResult(null, null) : {}), reason: "Invalid exact-target observation response" });
  try {
    if (Buffer.byteLength(stdout, "utf8") > 16384) return invalid();
    const lines = stdout.trim().split(/\r?\n/);
    if (lines.length !== (independent ? 2 : 1)) return invalid();
    const value = JSON.parse(lines.at(-1));
    if (independent) {
      const first = windowsObservationResult(lines[0]);
      const lastCom = windowsObservationResult(JSON.stringify({ ...value, independentSelection: undefined }));
      if ((first.unavailable && first.diagnostics.stage === "protocol_error") || JSON.stringify(first) !== JSON.stringify(lastCom)) return invalid();
    }
    if (!value || typeof value !== "object") return invalid();
    const { exactParentFound, targetPresent, selectedTargetMatch, exactParentCount, errorCount } = value;
    if (![exactParentFound, targetPresent, selectedTargetMatch].every((flag) => typeof flag === "boolean") ||
      ![exactParentCount, errorCount].every((count) => Number.isSafeInteger(count) && count >= 0 && count <= 100000) ||
      exactParentFound !== (exactParentCount > 0) || (targetPresent && !exactParentFound) ||
      (selectedTargetMatch && (!exactParentFound || !targetPresent)) || !Array.isArray(value.errors) ||
      value.errors.length > errorCount || (errorCount > 0 && value.errors.length === 0)) return invalid();
    const errors = [];
    for (const error of value.errors.slice(0, 8)) {
      if (!error || !["shell", "windows", "document", "target", "selection"].includes(error.stage) ||
        !Number.isInteger(error.code) || error.code < -2147483648 || error.code > 2147483647) return invalid();
      errors.push({ stage: error.stage, code: error.code });
    }
    const ui = value.independentSelection;
    const boundUi = exactParentCount === 1 || (ui?.windowVerified === false && ui?.targetVerified === false && ui?.selected === null);
    const selectionEvidence = independent ? independentSelectionResult(boundUi ? ui : null,
      exactParentFound && targetPresent && errorCount === 0 ? selectedTargetMatch : null) : {};
    const matched = exactParentFound && selectedTargetMatch;
    const stage = matched ? "exact_target" : errorCount ? "observation_error" :
      !exactParentFound ? "parent_absent" : !targetPresent ? "target_absent" : "target_not_selected";
    const diagnostics = { stage, exactParentFound, targetPresent, selectedTargetMatch, exactParentCount, errorCount, errors };
    if (matched) return { status: "passed", asserted: true, exactTargetObserved: true, diagnostics, ...selectionEvidence };
    return { status: "pending", diagnostics, ...selectionEvidence,
      ...(errors.some((error) => error.stage === "shell" || error.stage === "windows") ? { unavailable: true } : {}),
      reason: errorCount ? "Exact-target observation encountered a read error" : "No exact disposable selected item observed; API acknowledgment alone is insufficient" };
  } catch { return invalid(); }
}

export function independentSelectionResult(value, comSelected) {
  const unavailable = { source: "ui_automation", status: "unavailable", stage: "protocol_error", windowVerified: false, targetVerified: false, selected: null, code: null };
  const stages = ["selected", "unselected", "parent_absent", "ambiguous_parent", "target_absent", "wrong_window", "ambiguous_target", "pattern_unavailable", "read_error", "view_changed", "timeout", "command_error", "output_limit"];
  let result = unavailable;
  if (value && stages.includes(value.stage) && typeof value.windowVerified === "boolean" && typeof value.targetVerified === "boolean" &&
    (value.code === null || (Number.isInteger(value.code) && value.code >= -2147483648 && value.code <= 2147483647))) {
    const observed = value.stage === "selected" || value.stage === "unselected";
    if ((observed && value.windowVerified && value.targetVerified && value.selected === (value.stage === "selected") && value.code === null) ||
      (!observed && value.selected === null && !value.targetVerified &&
        (value.stage === "read_error" ? value.code !== null : value.code === null) &&
        (!["ambiguous_target", "pattern_unavailable", "view_changed"].includes(value.stage) || value.windowVerified) &&
        (!["parent_absent", "wrong_window", "timeout", "command_error", "output_limit"].includes(value.stage) || !value.windowVerified))) {
      result = { source: "ui_automation", status: observed ? "observed" : "unavailable", stage: value.stage,
        windowVerified: value.windowVerified, targetVerified: value.targetVerified, selected: value.selected, code: value.code };
    }
  }
  return { independentSelection: result, selectionAgreement: result.status !== "observed" || comSelected === null ? "unavailable" :
    comSelected === result.selected ? "agree" : "disagree" };
}

export async function observeFileManagerTarget(target, platform = process.platform, runCommand = execute, timeoutMs = 5000, options = {}) {
  try {
    let output;
    if (platform === "darwin") {
      output = await runCommand("osascript", ["-e", `on run argv
set expectedTarget to POSIX file (item 1 of argv) as alias
set expectedParent to POSIX file (item 2 of argv) as alias
with timeout of 2 seconds
tell application "Finder"
set candidates to windows whose name is (item 3 of argv)
repeat with candidate in candidates
try
if target of candidate as alias is expectedParent then
repeat with selectedItem in (get selection)
if selectedItem as alias is expectedTarget then return "true"
end repeat
end if
end try
end repeat
end tell
end timeout
return "false"
end run`, target, dirname(target), basename(dirname(target))], { timeout: timeoutMs });
    } else if (platform === "win32") {
      // Path arrives as data in the environment, never as executable script text.
      const independent = options.windowsDiagnostics === true;
      const script = independent ? `. $env:WORKSPACE_SELECTION_DIAGNOSTICS_SCRIPT
${windowsObservation}` : windowsObservation;
      output = await runCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
        timeout: timeoutMs, maxBuffer: 16384, windowsHide: true, env: { ...process.env, WORKSPACE_OBSERVE_TARGET: target,
          WORKSPACE_SELECTION_DIAGNOSTICS: independent ? "1" : "0", WORKSPACE_SELECTION_DIAGNOSTICS_SCRIPT: selectionDiagnosticsPath },
      });
      return windowsObservationResult(output.stdout, independent);
    } else return { status: "skipped", reason: "No supported file-manager observation on this host" };
    if (output.stdout.trim().toLowerCase() === "true") return { status: "passed", asserted: true, exactTargetObserved: true };
    return { status: "pending", reason: "No exact disposable selected item observed; API acknowledgment alone is insufficient" };
  } catch (error) {
    // Avoid stderr which may contain unrelated system/user information.
    const code = error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" ? "output_limit" : error.killed ? "timeout" : ["EACCES", "ENOENT", "EPERM", "ETIMEDOUT", "ENOBUFS", "EIO"].includes(error.code) ? error.code : "OS error";
    const stage = ["timeout", "output_limit"].includes(code) ? code : "command_error";
    return { status: "pending", unavailable: code !== "timeout", diagnostics: { stage },
      ...(platform === "win32" && options.windowsDiagnostics ? {
        ...independentSelectionResult({ stage, windowVerified: false, targetVerified: false, selected: null, code: null }, null),
        // Diagnostic only: partial output never overrides a timeout or deadline.
        comBeforeInterruption: windowsObservationResult(typeof error.stdout === "string" ? error.stdout.trim().split(/\r?\n/)[0] : ""),
      } : {}),
      reason: `Exact-target observation unavailable (${code})` };
  }
}

// Poll only the read-only predicate for the same already dispatched invocation.
// The monotonic budget includes subprocess execution and waits between attempts.
export async function waitForFileManagerTarget(target, platform = process.platform, runCommand = execute, timing = {}) {
  const now = timing.now ?? (() => performance.now());
  const pause = timing.sleep ?? sleep;
  const deadlineMs = 10000, started = now(), attempts = [];
  const finish = (outcome, completion) => ({ ...outcome, completion, deadlineMs, elapsedMs: now() - started, attempts });
  while (true) {
    const remaining = deadlineMs - (now() - started);
    if (remaining < 1) return finish({ status: "pending", reason: "Exact-target observation deadline exhausted" }, "deadline");
    const timeoutMs = Math.min(5000, Math.floor(remaining));
    const result = await observeFileManagerTarget(target, platform, runCommand, timeoutMs, timing);
    attempts.push({ attempt: attempts.length + 1, elapsedMs: now() - started, timeoutMs, ...result });
    if (now() - started > deadlineMs) return finish({ status: "pending", reason: "Exact-target observation deadline exhausted" }, "deadline");
    if (result.status === "passed") return finish(result, "exact_target");
    if (result.status === "skipped") return finish(result, "unsupported");
    if (result.unavailable) return finish(result, "unavailable");
    await pause(Math.min(100, Math.max(0, deadlineMs - (now() - started))));
  }
}

const windowsOwnedCleanup = String.raw`
$ErrorActionPreference = 'Stop'
$result = [ordered]@{ matched = 0; closed = 0; errorCount = 0 }
try {
  $expected = [IO.Path]::GetFullPath($env:WORKSPACE_OBSERVE_TARGET).TrimEnd('\')
  $parent = [IO.Path]::GetDirectoryName($expected)
  $shell = New-Object -ComObject Shell.Application
  foreach ($window in $shell.Windows()) {
    try {
      $folder = $window.Document.Folder
      if (-not [string]::Equals([IO.Path]::GetFullPath($folder.Self.Path).TrimEnd('\'), $parent, [StringComparison]::OrdinalIgnoreCase)) { continue }
      $item = $folder.ParseName([IO.Path]::GetFileName($expected))
      if ($null -eq $item -or -not [string]::Equals([IO.Path]::GetFullPath($item.Path).TrimEnd('\'), $expected, [StringComparison]::OrdinalIgnoreCase)) { continue }
      $result.matched++
      # Do not close a shared Explorer window containing another tab.
      $handle = [long]$window.HWND
      if ($handle -le 0 -or $handle -gt [int]::MaxValue -or (Read-WorkspaceUiaWindow $handle).stage -ne 'verified') { $result.errorCount++; continue }
      if (-not (Test-WorkspaceExactView $window $expected) -or [long]$window.HWND -ne $handle) { $result.errorCount++; continue }
      $window.Quit()
      $result.closed++
    } catch { $result.errorCount++ }
  }
} catch { $result.errorCount++ }
$result | ConvertTo-Json -Compress
`;

// Targets come only from this harness's freshly created, unique fixture roots.
// Close matching windows only; Finder/Explorer processes and other windows live on.
export async function closeDisposableFileManagerTarget(target, platform = process.platform, runCommand = execute, options = {}) {
  try {
    if (platform === "darwin") {
      await runCommand("osascript", ["-e", `on run argv
set expectedTarget to POSIX file (item 1 of argv) as alias
set expectedParent to POSIX file (item 2 of argv) as alias
with timeout of 2 seconds
tell application "Finder"
set candidates to windows whose name is (item 3 of argv)
repeat with candidate in candidates
try
if target of candidate as alias is expectedParent then
repeat with selectedItem in (get selection)
if selectedItem as alias is expectedTarget then
close candidate
exit repeat
end if
end repeat
end if
end try
end repeat
end tell
end timeout
end run`, target, dirname(target), basename(dirname(target))], { timeout: 5000 });
    } else if (platform === "win32") {
      const output = await runCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", options.ownedParent === true ? `. $env:WORKSPACE_SELECTION_DIAGNOSTICS_SCRIPT\n${windowsOwnedCleanup}` : `$expected = [IO.Path]::GetFullPath($env:WORKSPACE_OBSERVE_TARGET).TrimEnd('\\'); $parent = [IO.Path]::GetDirectoryName($expected); $shell = New-Object -ComObject Shell.Application; foreach ($window in $shell.Windows()) { try { $path = $window.Document.Folder.Self.Path; if ([string]::Equals([IO.Path]::GetFullPath($path).TrimEnd('\\'), $parent, [StringComparison]::OrdinalIgnoreCase)) { foreach ($item in $window.Document.SelectedItems()) { if ([string]::Equals([IO.Path]::GetFullPath($item.Path).TrimEnd('\\'), $expected, [StringComparison]::OrdinalIgnoreCase)) { $window.Quit(); break } } } } catch {} }`], {
        timeout: 5000, maxBuffer: 16384, windowsHide: true, env: { ...process.env, WORKSPACE_OBSERVE_TARGET: target, WORKSPACE_SELECTION_DIAGNOSTICS_SCRIPT: selectionDiagnosticsPath },
      });
      if (options.ownedParent === true) {
        try {
          if (Buffer.byteLength(output.stdout, "utf8") > 16384) throw new Error();
          const value = JSON.parse(output.stdout);
          if (![value.matched, value.closed, value.errorCount].every((count) => Number.isSafeInteger(count) && count >= 0 && count <= 100000) || value.closed > value.matched) throw new Error();
          return { status: value.errorCount || value.closed !== value.matched ? "pending" : "completed",
            scope: "exact disposable parent and target only", matched: value.matched, closed: value.closed, errorCount: value.errorCount };
        } catch { return { status: "pending", reason: "Invalid owned cleanup response" }; }
      }
    } else return { status: "skipped" };
    return { status: "completed", scope: options.ownedParent === true && platform === "win32" ? "exact disposable parent and target only" : "exact disposable target only" };
  } catch (error) { return { status: "pending", reason: `Exact-target cleanup unavailable (${error.killed ? "timeout" : ["EACCES", "ENOENT", "EPERM", "ETIMEDOUT", "ENOBUFS", "EIO"].includes(error.code) ? error.code : "OS error"})` }; }
}
