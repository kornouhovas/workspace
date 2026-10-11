# Test-only holder for a generated, exclusively owned runtime fixture. No caller
# target, rename API, privilege changes, children or production folders.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$result = [ordered]@{ version = 1; stage = 'input'; opened = $false; released = $false }
$handle = [IntPtr]::Zero
try {
  $root = $env:WORKSPACE_RUNTIME_HOLDER_FIXTURE
  if ($args.Count -ne 0 -or [string]::IsNullOrEmpty($root) -or
      -not [IO.Path]::IsPathRooted($root) -or
      [IO.Path]::GetFileName($root) -cnotmatch '^workspace-runtime-[A-Za-z0-9]{6}$' -or
      $root -cne [IO.Path]::GetFullPath($root)) { throw 'input' }
  Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class RuntimeSourceHolder {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)]
  public static extern IntPtr CreateFileW(string path, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)]
  public static extern uint GetFinalPathNameByHandleW(IntPtr handle, StringBuilder path, uint length, uint flags);
  [DllImport("kernel32.dll", SetLastError=true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool CloseHandle(IntPtr handle);
  public static string CanonicalDirectory(string path) {
    // Attributes-only, fully shared and immediately closed. This is a path
    // validation probe, distinct from the GENERIC_READ blocking handle below.
    IntPtr h = CreateFileW(path, 0, 7, IntPtr.Zero, 3, 0x02000000, IntPtr.Zero);
    if (h == new IntPtr(-1)) throw new InvalidOperationException();
    try {
      var text = new StringBuilder(32768);
      uint length = GetFinalPathNameByHandleW(h, text, (uint)text.Capacity, 0);
      if (length == 0 || length >= text.Capacity) throw new InvalidOperationException();
      string value = text.ToString();
      if (value.StartsWith(@"\\?\UNC\")) return @"\\" + value.Substring(8);
      if (value.StartsWith(@"\\?\")) return value.Substring(4);
      throw new InvalidOperationException();
    } finally { if (!CloseHandle(h)) throw new InvalidOperationException(); }
  }
}
'@
  # Canonical temp aliases are accepted outside the owned boundary. The supplied
  # fixture must itself be canonical: no dot/short-name/ancestor-reparse alias.
  $temp = [RuntimeSourceHolder]::CanonicalDirectory([IO.Path]::GetTempPath().TrimEnd('\'))
  if ($root -cne [RuntimeSourceHolder]::CanonicalDirectory($root) -or
      -not [string]::Equals([IO.Path]::GetDirectoryName($root), $temp, [StringComparison]::OrdinalIgnoreCase)) { throw 'input' }
  $source = [IO.Path]::Combine($root, 'SelectedProjectRoot')
  $held = [IO.Path]::Combine($source, 'nested')
  foreach ($path in @($root, $source, $held)) {
    $attributes = [IO.File]::GetAttributes($path)
    if (($attributes -band [IO.FileAttributes]::Directory) -eq 0 -or
        ($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'input' }
  }
  $destination = [IO.Path]::Combine($root, 'temporarily-disconnected')
  $absent = $false
  try { $null = [IO.File]::GetAttributes($destination) }
  catch [IO.FileNotFoundException] { $absent = $true }
  catch [IO.DirectoryNotFoundException] { $absent = $true }
  if (-not $absent) { throw 'input' }
  $result.stage = 'lock'
  # GENERIC_READ, READ|WRITE sharing without DELETE, OPEN_EXISTING and
  # BACKUP_SEMANTICS. Node, in the parent test process, performs every move.
  $handle = [RuntimeSourceHolder]::CreateFileW($held, [uint32]2147483648, 3, [IntPtr]::Zero, 3, 0x02000000, [IntPtr]::Zero)
  if ($handle -eq [IntPtr]::new(-1)) { $handle = [IntPtr]::Zero; throw 'lock' }
  $result.opened = $true
  $result.stage = 'held'
  [Console]::Out.WriteLine('WORKSPACE_RUNTIME_SOURCE_LOCKED')
  [Console]::Out.Flush()
  # The bounded parent sends this only after a real blocked rename (release
  # control), or after helper exhaustion (persistent control). EOF is failure.
  if ([Console]::In.ReadLine() -cne 'release') { throw 'handshake' }
  $result.stage = 'completed'
} catch { # Finite protocol only: no exception text, names, paths or identities.
} finally {
  if ($handle -ne [IntPtr]::Zero) { $result.released = [RuntimeSourceHolder]::CloseHandle($handle) }
}
$result | ConvertTo-Json -Compress
if ($result.stage -ne 'completed' -or -not $result.opened -or -not $result.released) { exit 1 }
