# Shared read-only exact Explorer HWND/tab guard. Extracted unchanged from
# scripts/windows-selection-diagnostics.ps1; diagnostic observation stays read-only.
function Get-WorkspaceUiaRoot($handle) {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    return [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$handle)
}

function Read-WorkspaceUiaWindow($handle, $trace = $null) {
    if ($null -ne $trace) { try { [void](& $trace 'uia_root') } catch { } }
    # [DEBUG-issue26] Non-nested finite scopes for the same one-shot timer.
    # Standalone readers need neither initialization nor the managed helper.
    $checkpoint = 0
    if ($env:WORKSPACE_REVEAL_DEFERRED_TRACE -ceq '1' -and ('WorkspaceReadyCom' -as [type])) { $checkpoint = [WorkspaceReadyCom]::BeginOwnerCheckpoint('uia_root') }
    try { $root = Get-WorkspaceUiaRoot $handle }
    finally { if ($checkpoint -ne 0) { [WorkspaceReadyCom]::EndOwnerCheckpoint($checkpoint) } }
    if ($null -ne $trace) { try { [void](& $trace 'uia_properties') } catch { } }
    $checkpoint = 0
    if ($env:WORKSPACE_REVEAL_DEFERRED_TRACE -ceq '1' -and ('WorkspaceReadyCom' -as [type])) { $checkpoint = [WorkspaceReadyCom]::BeginOwnerCheckpoint('uia_properties') }
    try {
    if ($null -eq $root -or $root.Current.NativeWindowHandle -ne $handle -or
        $root.Current.ControlType -ne [System.Windows.Automation.ControlType]::Window -or
        (Get-Process -Id $root.Current.ProcessId -ErrorAction Stop).ProcessName -ne 'explorer') {
        return @{ stage = 'wrong_window'; root = $null }
    }
    } finally { if ($checkpoint -ne 0) { [WorkspaceReadyCom]::EndOwnerCheckpoint($checkpoint) } }
    # A shared HWND cannot prove which of several Explorer tabs owns ItemsView.
    # Fail closed rather than inspect another tab's target with the same basename.
    if ($null -ne $trace) { try { [void](& $trace 'uia_tabs') } catch { } }
    $checkpoint = 0
    if ($env:WORKSPACE_REVEAL_DEFERRED_TRACE -ceq '1' -and ('WorkspaceReadyCom' -as [type])) { $checkpoint = [WorkspaceReadyCom]::BeginOwnerCheckpoint('uia_tabs') }
    try {
    $tabs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::TabItem))
    if ($tabs.Count -gt 1) { return @{ stage = 'ambiguous_parent'; root = $null } }
    } finally { if ($checkpoint -ne 0) { [WorkspaceReadyCom]::EndOwnerCheckpoint($checkpoint) } }
    return @{ stage = 'verified'; root = $root }
}
