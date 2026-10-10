import { execFile } from "node:child_process";
import { basename, dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
const execute = promisify(execFile);

// Read only a boolean for this exact disposable selected item. Do not record user
// locations, close arbitrary windows, or terminate the shared file manager.
export async function observeFileManagerTarget(target, platform = process.platform, runCommand = execute, timeoutMs = 5000) {
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
      output = await runCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$expected = [IO.Path]::GetFullPath($env:WORKSPACE_OBSERVE_TARGET).TrimEnd('\\'); $parent = [IO.Path]::GetDirectoryName($expected); $matched = $false; $shell = New-Object -ComObject Shell.Application; foreach ($window in $shell.Windows()) { try { $path = $window.Document.Folder.Self.Path; if ([string]::Equals([IO.Path]::GetFullPath($path).TrimEnd('\\'), $parent, [StringComparison]::OrdinalIgnoreCase)) { foreach ($item in $window.Document.SelectedItems()) { if ([string]::Equals([IO.Path]::GetFullPath($item.Path).TrimEnd('\\'), $expected, [StringComparison]::OrdinalIgnoreCase)) { $matched = $true } } } } catch {} }; if ($matched) { 'true' } else { 'false' }`], {
        timeout: timeoutMs, windowsHide: true, env: { ...process.env, WORKSPACE_OBSERVE_TARGET: target },
      });
    } else return { status: "skipped", reason: "No supported file-manager observation on this host" };
    if (output.stdout.trim().toLowerCase() === "true") return { status: "passed", asserted: true, exactTargetObserved: true };
    return { status: "pending", reason: "No exact disposable selected item observed; API acknowledgment alone is insufficient" };
  } catch (error) {
    // Avoid stderr which may contain unrelated system/user information.
    return { status: "pending", unavailable: !error.killed, reason: `Exact-target observation unavailable (${error.killed ? "timeout" : error.code ?? "OS error"})` };
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
    const result = await observeFileManagerTarget(target, platform, runCommand, timeoutMs);
    attempts.push({ attempt: attempts.length + 1, elapsedMs: now() - started, timeoutMs, ...result });
    if (now() - started > deadlineMs) return finish({ status: "pending", reason: "Exact-target observation deadline exhausted" }, "deadline");
    if (result.status === "passed") return finish(result, "exact_target");
    if (result.status === "skipped") return finish(result, "unsupported");
    if (result.unavailable) return finish(result, "unavailable");
    await pause(Math.min(100, Math.max(0, deadlineMs - (now() - started))));
  }
}

// Targets come only from this harness's freshly created, unique fixture roots.
// Close matching windows only; Finder/Explorer processes and other windows live on.
export async function closeDisposableFileManagerTarget(target, platform = process.platform, runCommand = execute) {
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
      await runCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$expected = [IO.Path]::GetFullPath($env:WORKSPACE_OBSERVE_TARGET).TrimEnd('\\'); $parent = [IO.Path]::GetDirectoryName($expected); $shell = New-Object -ComObject Shell.Application; foreach ($window in $shell.Windows()) { try { $path = $window.Document.Folder.Self.Path; if ([string]::Equals([IO.Path]::GetFullPath($path).TrimEnd('\\'), $parent, [StringComparison]::OrdinalIgnoreCase)) { foreach ($item in $window.Document.SelectedItems()) { if ([string]::Equals([IO.Path]::GetFullPath($item.Path).TrimEnd('\\'), $expected, [StringComparison]::OrdinalIgnoreCase)) { $window.Quit(); break } } } } catch {} }`], {
        timeout: 5000, windowsHide: true, env: { ...process.env, WORKSPACE_OBSERVE_TARGET: target },
      });
    } else return { status: "skipped" };
    return { status: "completed", scope: "exact disposable target only" };
  } catch (error) { return { status: "pending", reason: `Exact-target cleanup unavailable (${error.killed ? "timeout" : error.code ?? "OS error"})` }; }
}
