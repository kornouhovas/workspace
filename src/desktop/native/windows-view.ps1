# Shared read-only exact Explorer HWND/tab guard. Extracted unchanged from
# scripts/windows-selection-diagnostics.ps1; diagnostic observation stays read-only.
function Get-WorkspaceUiaRoot($handle) {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    return [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$handle)
}

function Read-WorkspaceUiaWindow($handle, $trace = $null) {
    if ($null -ne $trace) { try { [void](& $trace 'uia_root') } catch { } }
    $root = Get-WorkspaceUiaRoot $handle
    if ($null -ne $trace) { try { [void](& $trace 'uia_properties') } catch { } }
    if ($null -eq $root -or $root.Current.NativeWindowHandle -ne $handle -or
        $root.Current.ControlType -ne [System.Windows.Automation.ControlType]::Window -or
        (Get-Process -Id $root.Current.ProcessId -ErrorAction Stop).ProcessName -ne 'explorer') {
        return @{ stage = 'wrong_window'; root = $null }
    }
    # A shared HWND cannot prove which of several Explorer tabs owns ItemsView.
    # Fail closed rather than inspect another tab's target with the same basename.
    if ($null -ne $trace) { try { [void](& $trace 'uia_tabs') } catch { } }
    $tabs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::TabItem))
    if ($tabs.Count -gt 1) { return @{ stage = 'ambiguous_parent'; root = $null } }
    return @{ stage = 'verified'; root = $root }
}
