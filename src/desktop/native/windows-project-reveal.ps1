# Fixed production bridge. The trusted desktop adapter supplies the target as
# environment data and authorizes one GO only after this process reports READY.
$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot/windows-view.ps1"
    . "$PSScriptRoot/windows-binding.ps1"
} catch {
    [Console]::Out.WriteLine('FAIL')
    exit 1
}

function Write-WorkspaceRevealEvent($event) {
    [Console]::Out.WriteLine($event)
    [Console]::Out.Flush()
}

function Read-WorkspaceRevealPermit {
    # Exactly one ASCII GO line followed by EOF; read at most four characters.
    # The owner closes stdin after its permit. Waiting for EOF stays within the
    # owner's process deadline, and duplicate/trailing input never authorizes.
    foreach ($code in @(71,79,10,-1)) {
        if ([Console]::In.Read() -ne $code) { return $null }
    }
    return 'GO'
}
function Get-WorkspaceRevealMilliseconds($watch) { return $watch.Elapsed.TotalMilliseconds }
function Wait-WorkspaceRevealPoll($milliseconds) { Start-Sleep -Milliseconds $milliseconds }

function Invoke-WorkspaceProjectReveal($shell, $expected, $watch) {
    $phase = 'input'
    try {
        if ($expected -isnot [string] -or -not [IO.Path]::IsPathRooted($expected) -or
            $expected.Contains([char]0) -or [IO.Path]::GetFullPath($expected) -cne $expected) { throw 'input' }
        $parent = [IO.Path]::GetDirectoryName($expected)
        if ([string]::IsNullOrEmpty($parent) -or [string]::IsNullOrEmpty([IO.Path]::GetFileName($expected))) { throw 'input' }
        $phase = 'navigation'
        $watch.Start()
        Write-WorkspaceRevealEvent 'OPEN'
        [void]$shell.Open($parent)
        $phase = 'readiness'
        $anchor = $null
        for ($iteration = 0; $iteration -lt 128; $iteration++) {
            if ((Get-WorkspaceRevealMilliseconds $watch) -ge 10000) { throw 'deadline' }
            $binding = Read-WorkspaceReadyBinding $shell $expected $anchor
            $elapsed = Get-WorkspaceRevealMilliseconds $watch
            if ($elapsed -ge 10000) { throw 'deadline' }
            if ($binding.stage -eq 'ready') { $anchor = $binding; break }
            if ($binding.stage -eq 'unready') { $anchor = $binding }
            elseif ($binding.stage -notin @('parent_absent','target_absent') -or $null -ne $anchor) { throw 'binding' }
            Wait-WorkspaceRevealPoll ([int][Math]::Min(100, [Math]::Ceiling(10000 - $elapsed)))
        }
        if ($null -eq $anchor -or $binding.stage -ne 'ready') { throw 'unready' }
        $phase = 'permit'
        Write-WorkspaceRevealEvent 'READY'
        # The owner enforces its total process deadline and kills only this
        # bridge on cancellation. EOF/anything except the sole GO fails closed.
        if ((Read-WorkspaceRevealPermit) -cne 'GO') { throw 'permit' }
        if ((Get-WorkspaceRevealMilliseconds $watch) -ge 10000) { throw 'deadline' }
        $phase = 'precommand'
        $before = Read-WorkspaceReadyBinding $shell $expected $anchor
        if ((Get-WorkspaceRevealMilliseconds $watch) -ge 10000) { throw 'deadline' }
        if ($before.stage -ne 'ready' -or -not (Test-WorkspaceReadyPath $anchor.item.Path $expected)) { throw 'binding' }
        Write-WorkspaceRevealEvent 'SELECT'
        # Check again after the flushed event, immediately before the mutation.
        if ((Get-WorkspaceRevealMilliseconds $watch) -ge 10000 -or
            -not (Test-WorkspaceReadyPath $anchor.item.Path $expected)) { throw 'deadline' }
        $phase = 'selection'
        [void]$anchor.document.SelectItem($anchor.item, 5)
        if ((Get-WorkspaceRevealMilliseconds $watch) -ge 10000) { throw 'deadline' }
        $phase = 'postcheck'
        $after = Read-WorkspaceReadyBinding $shell $expected $anchor
        if ((Get-WorkspaceRevealMilliseconds $watch) -ge 10000) { throw 'deadline' }
        if ($after.stage -ne 'ready') { throw 'binding' }
        Write-WorkspaceRevealEvent 'DONE'
        return $true
    } catch {
        # Finite private protocol only: never emit exception text or paths.
        $reason = 'exception'
        if ($_.Exception.Message -cin @('input','deadline','binding','unready','permit')) { $reason = $_.Exception.Message }
        Write-WorkspaceRevealEvent ('FAIL:{0}:{1}' -f $phase,$reason)
        return $false
    }
}

function Invoke-WorkspaceProjectRevealFromEnvironment($shell, $watch) {
    # This is the same consumer boundary for the fixed-file entry and controlled
    # COM regression. No diagnostic/test-only variable supplies product paths.
    return Invoke-WorkspaceProjectReveal $shell $env:WORKSPACE_PROJECT_REVEAL_TARGET $watch
}

if ($MyInvocation.InvocationName -ne '.') {
    $ErrorActionPreference = 'Stop'
    try {
        Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes -ErrorAction Stop
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WorkspaceReadyWindow {
    [DllImport("user32.dll", ExactSpelling=true)]
    [return: MarshalAs(UnmanagedType.Bool)] public static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll", ExactSpelling=true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
}
'@ | Out-Null
        $shell = New-Object -ComObject Shell.Application
        $completed = Invoke-WorkspaceProjectRevealFromEnvironment $shell ([Diagnostics.Stopwatch]::new())
        if ($completed) { exit 0 }
    } catch { Write-WorkspaceRevealEvent 'FAIL' }
    exit 1
}
