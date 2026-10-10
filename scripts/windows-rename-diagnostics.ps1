# Disposable diagnostic only. Paths are environment data, never script code.
# CreateFileW sharing/ownership and directory flags:
# https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew
# MoveFileExW with flags=0 never replaces an existing destination:
# https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$result = [ordered]@{ version = 1; stage = 'input'; invocationCount = 0; renamed = $false;
  win32Code = $null; lockOpened = $false; lockReleased = $false; startedUnixMs = $null; endedUnixMs = $null }
$handle = [IntPtr]::Zero
try {
  $root = $env:WORKSPACE_RENAME_FIXTURE
  $scenario = $env:WORKSPACE_RENAME_SCENARIO
  if ([string]::IsNullOrEmpty($root) -or -not [IO.Path]::IsPathRooted($root) -or
      $scenario -notin @('idle', 'observation', 'concurrent_scan', 'injected_conflict', 'collision_control')) { throw 'input' }
  # ASCII script also works with Windows PowerShell 5's legacy file encoding.
  $category = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('0JrQsNGC0LXQs9C+0YDQuNGPIM6p'))
  $renamed = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('UmVuYW1lZCDmloc='))
  $source = [IO.Path]::Combine($root, 'root', $category)
  $destination = [IO.Path]::Combine($root, 'root', $(if ($scenario -eq 'collision_control') { 'Occupied' } else { $renamed }))
  if (-not [IO.Directory]::Exists($source)) { throw 'input' }
  # Reject junctions/reparse ancestors before opening the owned category.
  foreach ($path in @($root, [IO.Path]::Combine($root, 'root'), $source)) {
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
  if ($scenario -eq 'injected_conflict') {
    $result.stage = 'lock'
    # FILE_READ_ATTRIBUTES, FILE_SHARE_READ|FILE_SHARE_WRITE (no DELETE),
    # OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS. No privilege changes.
    $handle = [WorkspaceRenameDiagnostic]::CreateFileW($source, 0x80, 3, [IntPtr]::Zero, 3, 0x02000000, [IntPtr]::Zero)
    if ($handle -eq [IntPtr]::new(-1)) { $result.win32Code = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $handle = [IntPtr]::Zero; throw 'lock' }
    $result.lockOpened = $true
  }
  if ($scenario -eq 'concurrent_scan') {
    # Compilation is outside the scan/rename comparison. Start exactly once
    # after Node can begin its real synchronous scan in the other process.
    [Console]::Out.WriteLine('WORKSPACE_RENAME_READY')
    [Console]::Out.Flush()
    if ([Console]::In.ReadLine() -ne 'rename') { throw 'input' }
  }
  $result.stage = 'rename'
  $result.startedUnixMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $result.invocationCount = 1
  $result.renamed = [WorkspaceRenameDiagnostic]::MoveFileExW($source, $destination, 0)
  $result.win32Code = $(if ($result.renamed) { 0 } else { [Runtime.InteropServices.Marshal]::GetLastWin32Error() })
  $result.endedUnixMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $result.stage = 'completed'
} catch { # Keep only the finite stage/code; exception text is private.
} finally {
  if ($handle -ne [IntPtr]::Zero) { $result.lockReleased = [WorkspaceRenameDiagnostic]::CloseHandle($handle) }
}
$result | ConvertTo-Json -Compress
