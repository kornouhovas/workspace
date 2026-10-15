$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ge 7) {
    Import-Module "$PSHOME/Modules/Microsoft.PowerShell.Utility/Microsoft.PowerShell.Utility.psd1"
}
$mode = $env:WORKSPACE_CHECKPOINT_CONTROL
if ($mode -cnotin @('root_active','root_throw','properties_early','properties_active','tabs_active','owner_early','invalid','helper_absent')) { throw 'input' }
. "$PSScriptRoot/../../src/desktop/native/windows-view.ps1"
if ($mode -ceq 'helper_absent') {
    if ('WorkspaceReadyCom' -as [type]) { throw 'unexpected_helper' }
    function Get-WorkspaceUiaRoot($handle) { return $null }
    $result = Read-WorkspaceUiaWindow 42
    if ($result.stage -cne 'wrong_window' -or ('WorkspaceReadyCom' -as [type])) { throw 'standalone_changed' }
    [ordered]@{ mode = $mode; lines = @() } | ConvertTo-Json -Compress
    exit 0
}
. "$PSScriptRoot/../../src/desktop/native/windows-binding.ps1"
Initialize-WorkspaceNativeBinding
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Threading;
public static class OwnerCheckpointControl {
    public static Timer Timer;
    public static string Mode;
    public static readonly ManualResetEvent Release = new ManualResetEvent(false);
    public static readonly ManualResetEvent Written = new ManualResetEvent(false);
    public static int PropertiesEntered;
    public static void Block() {
        if (!Timer.Change(25, Timeout.Infinite)) throw new Exception("timer_schedule");
        if (!Release.WaitOne(2000)) throw new Exception("timer_delivery");
    }
}
public sealed class OwnerCheckpointData {
    public int NativeWindowHandle = 42, ProcessId = 123;
    public object ControlType;
}
public sealed class OwnerCheckpointItems { public int Count = 1; }
public sealed class OwnerCheckpointRoot {
    public readonly OwnerCheckpointData Data = new OwnerCheckpointData();
    public OwnerCheckpointData Current { get {
        if (OwnerCheckpointControl.Mode == "properties_active" && Interlocked.Increment(ref OwnerCheckpointControl.PropertiesEntered) == 1)
            OwnerCheckpointControl.Block();
        return Data;
    } }
    public OwnerCheckpointItems FindAll(object scope, object condition) {
        if (OwnerCheckpointControl.Mode == "tabs_active") OwnerCheckpointControl.Block();
        return new OwnerCheckpointItems();
    }
}
public sealed class OwnerCheckpointWriter : TextWriter {
    public readonly StringBuilder Text = new StringBuilder();
    public override Encoding Encoding { get { return Encoding.UTF8; } }
    public override void WriteLine(string value) {
        lock (Text) { Text.AppendLine(value); }
        OwnerCheckpointControl.Written.Set();
        OwnerCheckpointControl.Release.Set();
    }
}
'@
[OwnerCheckpointControl]::Mode = $mode
$writer = [OwnerCheckpointWriter]::new()
$original = [Console]::Out
try {
    [Console]::SetOut($writer)
    [WorkspaceReadyCom]::StartDeferredTrace()
    [OwnerCheckpointControl]::Timer = [WorkspaceReadyCom].GetField('checkpointTimer', [Reflection.BindingFlags]'NonPublic,Static').GetValue($null)
    if ($mode -cin @('properties_active','tabs_active')) {
        Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
        $script:controlledRoot = [OwnerCheckpointRoot]::new()
        $script:controlledRoot.Data.ControlType = [System.Windows.Automation.ControlType]::Window
    }
    function Get-Process { param($Id, $ErrorAction) return [pscustomobject]@{ ProcessName = 'explorer' } }
    function Get-WorkspaceUiaRoot($handle) {
        if ($mode -ceq 'root_active') { [OwnerCheckpointControl]::Block() }
        if ($mode -ceq 'root_throw') { throw 'PRIVATE_ROOT_FAULT' }
        if ($mode -cin @('properties_active','tabs_active')) { return $script:controlledRoot }
        return $null
    }
    if ($mode -ceq 'owner_early') {
        if ($null -ne (Read-WorkspaceReadyOwner 0)) { throw 'owner_changed' }
    } elseif ($mode -ceq 'invalid') {
        if ([WorkspaceReadyCom]::BeginOwnerCheckpoint('PRIVATE_TAG') -ne 0) { throw 'invalid_tag' }
    } else {
        $threw = $false
        try { $result = Read-WorkspaceUiaWindow 42 } catch {
            if ($mode -cne 'root_throw' -or $_.Exception.Message -cne 'PRIVATE_ROOT_FAULT') { throw }
            $threw = $true
        }
        if ($mode -ceq 'root_throw') { if (-not $threw) { throw 'exception_changed' } }
        elseif ($result.stage -cne $(if ($mode -cin @('properties_active','tabs_active')) { 'verified' } else { 'wrong_window' })) { throw 'result_changed' }
    }
    if ($mode -cnotin @('root_active','properties_active','tabs_active')) {
        if (-not [OwnerCheckpointControl]::Timer.Change(25, [Threading.Timeout]::Infinite)) { throw 'timer_schedule' }
    }
    if (-not [OwnerCheckpointControl]::Written.WaitOne(2000)) { throw 'timer_delivery' }
} finally {
    [OwnerCheckpointControl]::Release.Set() | Out-Null
    [WorkspaceReadyCom]::StopDeferredTrace()
    [Console]::SetOut($original)
}
$lines = @($writer.Text.ToString().Split([char]10) | ForEach-Object { $_.TrimEnd([char]13) } | Where-Object { $_.Length -gt 0 })
[ordered]@{ mode = $mode; lines = $lines } | ConvertTo-Json -Compress
