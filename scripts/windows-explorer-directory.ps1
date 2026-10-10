$ErrorActionPreference = 'Stop'
try {
  # Read-only resolver. No Explorer launch, path input or command interpolation.
  Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
using System.Text;
public static class WorkspaceSystemDirectory {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
  private static extern uint GetSystemWindowsDirectoryW(StringBuilder buffer, uint size);
  public static string Read() {
    var buffer = new StringBuilder(512);
    uint length = GetSystemWindowsDirectoryW(buffer, (uint)buffer.Capacity);
    if (length == 0 || length >= buffer.Capacity) return null;
    return buffer.ToString();
  }
}
'@ | Out-Null
  $directory = [WorkspaceSystemDirectory]::Read()
  if (-not [string]::Equals($directory, 'C:\Windows', [StringComparison]::OrdinalIgnoreCase)) { exit 1 }
  [Console]::WriteLine($directory)
} catch { exit 1 }
