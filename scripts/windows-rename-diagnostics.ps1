# Disposable diagnostic only. Paths are environment data, never script code.
# Candidate GENERIC_READ/no FILE_SHARE_DELETE control expects a sharing failure;
# actual Windows verification remains required. Directory
# handles require FILE_FLAG_BACKUP_SEMANTICS. Attributes-only access is exempt:
# https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew
# Collision control alone calls MoveFileExW(flags=0); noncontrols use Node rename.
# https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$scenario = $env:WORKSPACE_RENAME_SCENARIO
$result = [ordered]@{ version = 1; api = $(if ($scenario -eq 'collision_control') { 'move_file_ex' } else { 'node_fs_rename' });
  stage = 'input'; invocationCount = 0; renamed = $false; win32Code = $null; nodeCode = $null; syscall = $null;
  lockOpened = $false; lockReleased = $false; startedUnixMs = $null; endedUnixMs = $null }
$handle = [IntPtr]::Zero
try {
  $root = $env:WORKSPACE_RENAME_FIXTURE
  if ([string]::IsNullOrEmpty($root) -or -not [IO.Path]::IsPathRooted($root) -or
      [IO.Path]::GetFileName($root) -notmatch '^workspace-rename-diagnostic-[A-Za-z0-9]{6}$' -or
      $scenario -notin @('injected_conflict', 'delete_shared_control', 'collision_control')) { throw 'input' }
  # Explicit long-path form avoids relying on global Win32 long-path policy.
  $nativeRoot = $(if ($root.StartsWith('\\')) { '\\?\UNC\' + $root.Substring(2) } else { '\\?\' + $root })
  $source = [IO.Path]::Combine($nativeRoot, 'root', $env:WORKSPACE_RENAME_CATEGORY)
  $destination = [IO.Path]::Combine($nativeRoot, 'root', 'Occupied')
  if ([string]::IsNullOrEmpty($env:WORKSPACE_RENAME_CATEGORY) -or
      $env:WORKSPACE_RENAME_CATEGORY.IndexOfAny([IO.Path]::GetInvalidFileNameChars()) -ge 0 -or
      -not [IO.Directory]::Exists($source)) { throw 'input' }
  foreach ($path in @($nativeRoot, [IO.Path]::Combine($nativeRoot, 'root'), $source)) {
    if (([IO.File]::GetAttributes($path) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'input' }
  }
  $result.stage = 'compile'
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WorkspaceRenameDiagnostic {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)]
  public static extern IntPtr CreateFileW(string path, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool MoveFileExW(string source, string destination, uint flags);
  [DllImport("kernel32.dll", SetLastError=true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool CloseHandle(IntPtr handle);
}
'@
  if ($scenario -ne 'collision_control') {
    $result.stage = 'lock'
    # GENERIC_READ; READ|WRITE sharing, plus DELETE only in the contrast.
    # OPEN_EXISTING + BACKUP_SEMANTICS. No privileges or content reads.
    $share = $(if ($scenario -eq 'delete_shared_control') { 7 } else { 3 })
    $handle = [WorkspaceRenameDiagnostic]::CreateFileW($source, [uint32]2147483648, $share, [IntPtr]::Zero, 3, 0x02000000, [IntPtr]::Zero)
    if ($handle -eq [IntPtr]::new(-1)) { $result.win32Code = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $handle = [IntPtr]::Zero; throw 'lock' }
    $result.lockOpened = $true
    $result.stage = 'rename'
    [Console]::Out.WriteLine('WORKSPACE_RENAME_LOCKED')
    [Console]::Out.Flush()
    # Node performs its one rename in another process while this handle lives.
    if ([Console]::In.ReadLine() -ne 'release') { throw 'input' }
  } else {
    $result.stage = 'rename'
    $result.startedUnixMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $result.invocationCount = 1
    $result.renamed = [WorkspaceRenameDiagnostic]::MoveFileExW($source, $destination, 0)
    $result.win32Code = $(if ($result.renamed) { 0 } else { [Runtime.InteropServices.Marshal]::GetLastWin32Error() })
    $result.endedUnixMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $result.stage = 'completed'
  }
} catch { # Only finite stage/code crosses the protocol boundary.
} finally {
  if ($handle -ne [IntPtr]::Zero) { $result.lockReleased = [WorkspaceRenameDiagnostic]::CloseHandle($handle) }
}
$result | ConvertTo-Json -Compress
