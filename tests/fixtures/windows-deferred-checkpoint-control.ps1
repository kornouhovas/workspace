$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ge 7) {
    Import-Module "$PSHOME/Modules/Microsoft.PowerShell.Utility/Microsoft.PowerShell.Utility.psd1"
}
. "$PSScriptRoot/../../src/desktop/native/windows-project-reveal.ps1"
Initialize-WorkspaceNativeBinding
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
public sealed class CheckpointControl {
    public readonly ManualResetEvent Entered = new ManualResetEvent(false);
    public readonly ManualResetEvent Release = new ManualResetEvent(false);
    public int Done() { return 17; }
    public void Fail() { throw new InvalidOperationException("PRIVATE_CHECKPOINT_FAULT"); }
    public void Block() { Entered.Set(); if (!Release.WaitOne(5000)) throw new TimeoutException(); }
}
public static class CheckpointControlTask {
    public static Task Invoke(MethodInfo method, object[] args) {
        return Task.Run(delegate { method.Invoke(null, args); });
    }
}
public sealed class CheckpointControlWriter : TextWriter {
    public readonly StringBuilder Text = new StringBuilder();
    public readonly ManualResetEvent Entered = new ManualResetEvent(false);
    public readonly ManualResetEvent Release = new ManualResetEvent(false);
    public readonly ManualResetEvent Completed = new ManualResetEvent(false);
    public bool BlockWrites, ThrowWrites;
    public override Encoding Encoding { get { return Encoding.UTF8; } }
    public override void WriteLine(string value) {
        Entered.Set();
        if (BlockWrites && !Release.WaitOne(5000)) throw new TimeoutException();
        if (ThrowWrites) throw new IOException("PRIVATE_OUTPUT_FAULT");
        lock (Text) { Text.AppendLine(value); }
        Completed.Set();
    }
}
'@
$mode = $env:WORKSPACE_CHECKPOINT_CONTROL
if ($mode -cnotin @('off','active','timer','complete','throw','disposed','fault','race','both')) { throw 'input' }
$writer = [CheckpointControlWriter]::new()
$control = [CheckpointControl]::new()
$original = [Console]::Out
$report = [WorkspaceReadyCom].GetMethod('EmitDeferredCheckpoint', [Reflection.BindingFlags]'NonPublic,Static')
$task = $null
try {
    [Console]::SetOut($writer)
    [WorkspaceReadyCom]::StartDeferredTrace()
    if ($mode -ceq 'both') { Write-WorkspaceRevealTrace 'assemblies' }
    if ($mode -ceq 'disposed') { [WorkspaceReadyCom]::StopDeferredTrace() }
    if ($mode -cin @('active','timer')) {
        $arguments = [object[]]::new(3)
        $arguments[0] = $control; $arguments[1] = 'Block'; $arguments[2] = [object[]]@()
        $task = [CheckpointControlTask]::Invoke([WorkspaceReadyCom].GetMethod('Call'), $arguments)
        if (-not $control.Entered.WaitOne(2000)) { throw 'managed_entry' }
    } elseif ($mode -ceq 'throw') {
        $threw = $false
        try { [void][WorkspaceReadyCom]::Call($control, 'Fail', [object[]]@()) } catch { $threw = $true }
        if (-not $threw) { throw 'missing_failure' }
    } else {
        if ([WorkspaceReadyCom]::Call($control, 'Done', [object[]]@()) -ne 17) { throw 'changed_result' }
    }
    if ($mode -ceq 'fault') { $writer.ThrowWrites = $true }
    if ($mode -ceq 'race') {
        $writer.BlockWrites = $true
        $task = [CheckpointControlTask]::Invoke($report, [object[]]::new(1))
        if (-not $writer.Entered.WaitOne(2000)) { throw 'callback_entry' }
        # Stop must not wait for this already captured callback's console write.
        [WorkspaceReadyCom]::StopDeferredTrace()
        [void]$writer.Release.Set()
    } elseif ($mode -ceq 'timer') {
        # Exercise the actual managed timer delivery path while the helper is
        # blocked. Only the test shortens its due time; production remains 9s.
        $timer = [WorkspaceReadyCom].GetField('checkpointTimer', [Reflection.BindingFlags]'NonPublic,Static').GetValue($null)
        if ($null -eq $timer -or -not $timer.Change(25, [Threading.Timeout]::Infinite)) { throw 'timer_schedule' }
        if (-not $writer.Completed.WaitOne(2000)) { throw 'timer_delivery' }
    } else { [void]$report.Invoke($null, [object[]]::new(1)) }
    if ($mode -cin @('active','timer')) { [void]$control.Release.Set() }
    if ($null -ne $task -and -not $task.Wait(2000)) { throw 'managed_exit' }
    # A second callback cannot publish a duplicate, including after output fault.
    [void]$report.Invoke($null, [object[]]::new(1))
    if ([WorkspaceReadyCom]::Call($control, 'Done', [object[]]@()) -ne 17) { throw 'post_observer_result' }
} finally {
    [void]$control.Release.Set(); [void]$writer.Release.Set()
    [WorkspaceReadyCom]::StopDeferredTrace()
    [Console]::SetOut($original)
}
$lines = @($writer.Text.ToString().Split([char]10) | ForEach-Object { $_.TrimEnd([char]13) } | Where-Object { $_.Length -gt 0 })
[ordered]@{ mode = $mode; lines = $lines } | ConvertTo-Json -Compress
