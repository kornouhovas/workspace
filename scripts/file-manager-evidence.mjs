import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);

// Read only a boolean for this exact disposable target. Do not record user
// locations, close arbitrary windows, or terminate the shared file manager.
export async function observeFileManagerTarget(target, platform = process.platform, runCommand = execute) {
  try {
    let output;
    if (platform === "darwin") {
      output = await runCommand("osascript", ["-e", `on run argv
set expectedTarget to POSIX file (item 1 of argv) as alias
tell application "Finder"
repeat with candidate in windows
try
if target of candidate as alias is expectedTarget then return "true"
end try
end repeat
end tell
return "false"
end run`, target], { timeout: 5000 });
    } else if (platform === "win32") {
      // Path arrives as data in the environment, never as executable script text.
      output = await runCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$expected = [IO.Path]::GetFullPath($env:WORKSPACE_OBSERVE_TARGET).TrimEnd('\\'); $matched = $false; $shell = New-Object -ComObject Shell.Application; foreach ($window in $shell.Windows()) { try { $path = $window.Document.Folder.Self.Path; if ([string]::Equals([IO.Path]::GetFullPath($path).TrimEnd('\\'), $expected, [StringComparison]::OrdinalIgnoreCase)) { $matched = $true } } catch {} }; if ($matched) { 'true' } else { 'false' }`], {
        timeout: 5000, windowsHide: true, env: { ...process.env, WORKSPACE_OBSERVE_TARGET: target },
      });
    } else return { status: "skipped", reason: "No supported file-manager observation on this host" };
    if (output.stdout.trim().toLowerCase() === "true") return { status: "passed", asserted: true, exactTargetObserved: true };
    return { status: "pending", reason: "No exact disposable target window observed; API acknowledgment alone is insufficient" };
  } catch (error) {
    // Avoid stderr which may contain unrelated system/user information.
    return { status: "pending", reason: `Exact-target observation unavailable (${error.killed ? "timeout" : error.code ?? "OS error"})` };
  }
}

// Targets come only from this harness's freshly created, unique fixture roots.
// Close matching windows only; Finder/Explorer processes and other windows live on.
export async function closeDisposableFileManagerTarget(target, platform = process.platform, runCommand = execute) {
  try {
    if (platform === "darwin") {
      await runCommand("osascript", ["-e", `on run argv
set expectedTarget to POSIX file (item 1 of argv) as alias
tell application "Finder"
repeat with candidate in windows
try
if target of candidate as alias is expectedTarget then close candidate
end try
end repeat
end tell
end run`, target], { timeout: 5000 });
    } else if (platform === "win32") {
      await runCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$expected = [IO.Path]::GetFullPath($env:WORKSPACE_OBSERVE_TARGET).TrimEnd('\\'); $shell = New-Object -ComObject Shell.Application; foreach ($window in $shell.Windows()) { try { $path = $window.Document.Folder.Self.Path; if ([string]::Equals([IO.Path]::GetFullPath($path).TrimEnd('\\'), $expected, [StringComparison]::OrdinalIgnoreCase)) { $window.Quit() } } catch {} }`], {
        timeout: 5000, windowsHide: true, env: { ...process.env, WORKSPACE_OBSERVE_TARGET: target },
      });
    } else return { status: "skipped" };
    return { status: "completed", scope: "exact disposable target only" };
  } catch (error) { return { status: "pending", reason: `Exact-target cleanup unavailable (${error.killed ? "timeout" : error.code ?? "OS error"})` }; }
}
