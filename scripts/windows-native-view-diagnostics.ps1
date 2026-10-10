# Terminal state only, after the strict observation verdict. No UI mutation.
# Native contracts and interpretation limitations are linked in the verification doc.
function Read-WorkspaceTerminalNativeWindow($handle) {
    if (-not ('WorkspaceTerminalView.Window' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace WorkspaceTerminalView {
    public static class Window {
        [DllImport("user32.dll", ExactSpelling = true)]
        [return: MarshalAs(UnmanagedType.Bool)] public static extern bool IsWindow(IntPtr hwnd);
        [DllImport("user32.dll", ExactSpelling = true)]
        [return: MarshalAs(UnmanagedType.Bool)] public static extern bool IsWindowVisible(IntPtr hwnd);
        [DllImport("user32.dll", ExactSpelling = true)]
        [return: MarshalAs(UnmanagedType.Bool)] public static extern bool IsIconic(IntPtr hwnd);
        [DllImport("user32.dll", ExactSpelling = true)] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll", ExactSpelling = true)]
        public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    }
}
'@
    }
    $hwnd = [IntPtr]$handle
    [uint32]$owner = 0
    if (-not [WorkspaceTerminalView.Window]::IsWindow($hwnd) -or
        [WorkspaceTerminalView.Window]::GetWindowThreadProcessId($hwnd, [ref]$owner) -eq 0 -or $owner -eq 0) {
        return @{ stage = 'wrong_window' }
    }
    return @{ stage = 'verified'; processId = $owner; windowVisible = [WorkspaceTerminalView.Window]::IsWindowVisible($hwnd);
        windowMinimized = [WorkspaceTerminalView.Window]::IsIconic($hwnd);
        windowForeground = ([WorkspaceTerminalView.Window]::GetForegroundWindow() -eq $hwnd) }
}

function Test-WorkspaceTerminalBounds($bounds) {
    # Report only nonempty finite geometry, never raw screen coordinates.
    if ($null -eq $bounds) { return $null }
    foreach ($value in @($bounds.X, $bounds.Y, $bounds.Width, $bounds.Height)) {
        if ($null -eq $value) { return $null }
        if ([double]::IsNaN($value) -or [double]::IsInfinity($value)) { return $false }
    }
    return $bounds.Width -gt 0 -and $bounds.Height -gt 0
}

function Test-WorkspaceTerminalRuntimeId($values) {
    if ($null -eq $values -or $values.Count -eq 0) { return $false }
    foreach ($value in $values) { if ($value -isnot [int]) { return $false } }
    return $true
}

function Read-WorkspaceTerminalElement($element, $isItem) {
    $values = @{}
    $fields = @('IsEnabled', 'IsOffscreen', 'BoundingRectangle')
    if ($isItem) { $fields += @('HasKeyboardFocus', 'IsSelected') }
    foreach ($field in $fields) {
        $property = if ($field -eq 'IsSelected') { [System.Windows.Automation.SelectionItemPattern]::IsSelectedProperty }
            else { [System.Windows.Automation.AutomationElement]::("${field}Property") }
        # Current getters substitute defaults for unsupported properties. The
        # explicit overload retains NotSupported instead of inventing false.
        $value = $element.GetCurrentPropertyValue($property, $true)
        if ($null -eq $value -or [object]::ReferenceEquals($value, [System.Windows.Automation.AutomationElement]::NotSupported)) { return $null }
        if ($field -eq 'BoundingRectangle') {
            if ($value -isnot [System.Windows.Rect]) { return $null }
            $values[$field] = Test-WorkspaceTerminalBounds $value
        } else {
            if ($value -isnot [bool]) { return $null }
            $values[$field] = $value
        }
    }
    return $values
}

function Read-WorkspaceTerminalBinding($handle, $name) {
    $binding = Read-WorkspaceUiaWindow $handle
    if ($binding.stage -ne 'verified') { return @{ stage = $binding.stage } }
    $root = $binding.root
    $native = Read-WorkspaceTerminalNativeWindow $handle
    if ($native.stage -ne 'verified' -or $root.Current.ProcessId -ne $native.processId) { return @{ stage = 'wrong_window' } }
    $condition = [System.Windows.Automation.AndCondition]::new(
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'UIItemsView'),
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::List))
    $views = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if ($views.Count -ne 1) { return @{ stage = 'ambiguous_view' } }
    $condition = [System.Windows.Automation.AndCondition]::new(
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, $name),
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ListItem))
    $items = $views[0].FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
    if ($items.Count -eq 0) { return @{ stage = 'target_absent' } }
    if ($items.Count -ne 1) { return @{ stage = 'ambiguous_target' } }
    $pattern = $null
    if (-not $items[0].TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
        return @{ stage = 'property_unavailable' }
    }
    # Offscreen/disabled/unfocused are evidence, never ownership failures.
    $view = Read-WorkspaceTerminalElement $views[0] $false
    $item = Read-WorkspaceTerminalElement $items[0] $true
    $viewId = $views[0].GetRuntimeId(); $itemId = $items[0].GetRuntimeId()
    if ($null -eq $view -or $null -eq $item -or
        -not (Test-WorkspaceTerminalRuntimeId $viewId) -or -not (Test-WorkspaceTerminalRuntimeId $itemId)) { return @{ stage = 'property_unavailable' } }
    return @{ stage = 'verified'; processId = $native.processId; viewId = $viewId; itemId = $itemId;
        snapshot = @{ windowVisible = $native.windowVisible; windowMinimized = $native.windowMinimized; windowForeground = $native.windowForeground;
            viewEnabled = $view.IsEnabled; viewOffscreen = $view.IsOffscreen; viewBoundsNonempty = $view.BoundingRectangle;
            itemEnabled = $item.IsEnabled; itemOffscreen = $item.IsOffscreen; itemBoundsNonempty = $item.BoundingRectangle;
            itemKeyboardFocus = $item.HasKeyboardFocus; itemSelected = $item.IsSelected } }
}

function Get-WorkspaceTerminalDiagnostic($ownedWindows, $expected) {
    $result = [ordered]@{ version = 1; stage = 'parent_absent'; snapshot = $null; code = $null }
    if ($ownedWindows.Count -eq 0) { return $result }
    if ($ownedWindows.Count -ne 1) { $result.stage = 'ambiguous_parent'; return $result }
    try {
        $window = $ownedWindows[0]
        $result.stage = 'target_absent'
        if (-not (Test-WorkspaceExactView $window $expected)) { return $result }
        $handle = [long]$window.HWND
        $result.stage = 'wrong_window'
        if ($handle -le 0 -or $handle -gt [int]::MaxValue) { return $result }
        $before = Read-WorkspaceTerminalBinding $handle ([IO.Path]::GetFileName($expected))
        $result.stage = $before.stage
        if ($before.stage -ne 'verified') { return $result }
        $result.stage = 'property_unavailable'
        $busy = $window.Busy; $ready = $window.ReadyState; $visible = $window.Visible
        if ($busy -isnot [bool] -or $visible -isnot [bool] -or $null -eq $ready -or
            $ready -is [string] -or $ready -is [bool] -or $ready -notin @(0,1,2,3,4)) { return $result }
        $result.stage = 'view_changed'
        if (-not (Test-WorkspaceExactView $window $expected) -or [long]$window.HWND -ne $handle) { return $result }
        $after = Read-WorkspaceTerminalBinding $handle ([IO.Path]::GetFileName($expected))
        if ($after.stage -ne 'verified' -or $before.processId -ne $after.processId -or
            -not (Test-WorkspaceTerminalRuntimeId $before.viewId) -or -not (Test-WorkspaceTerminalRuntimeId $before.itemId) -or
            -not (Test-WorkspaceTerminalRuntimeId $after.viewId) -or -not (Test-WorkspaceTerminalRuntimeId $after.itemId) -or
            (($before.viewId -join ',') -cne ($after.viewId -join ',')) -or
            (($before.itemId -join ',') -cne ($after.itemId -join ',')) -or
            -not (Test-WorkspaceExactView $window $expected) -or [long]$window.HWND -ne $handle) { return $result }
        $snapshot = $before.snapshot
        foreach ($key in @('windowVisible','windowMinimized','windowForeground','viewEnabled','viewOffscreen','viewBoundsNonempty',
            'itemEnabled','itemOffscreen','itemBoundsNonempty','itemKeyboardFocus','itemSelected')) {
            if ($snapshot[$key] -isnot [bool]) { $result.stage = 'property_unavailable'; return $result }
        }
        $snapshot['comBusy'] = $busy; $snapshot['readyState'] = [int]$ready; $snapshot['comVisible'] = $visible
        $result.stage = 'observed'; $result.snapshot = $snapshot
    } catch {
        $result.stage = 'read_error'; $result.snapshot = $null; $result.code = [int]$_.Exception.HResult
    }
    return $result
}

if ($MyInvocation.InvocationName -ne '.') {
    $ErrorActionPreference = 'Stop'
    try {
        . "$PSScriptRoot/windows-selection-diagnostics.ps1"
        $expected = [IO.Path]::GetFullPath($env:WORKSPACE_OBSERVE_TARGET).TrimEnd('\')
        $parent = [IO.Path]::GetDirectoryName($expected)
        $owned = [Collections.Generic.List[object]]::new()
        $shell = New-Object -ComObject Shell.Application
        foreach ($window in $shell.Windows()) {
            # Only the full disposable parent match authorizes any state reads.
            # A document-read error invalidates the whole snapshot, rather than
            # overlooking a possible duplicate exact-parent view.
            $path = $window.Document.Folder.Self.Path
            if (-not [string]::IsNullOrEmpty($path) -and
                [string]::Equals([IO.Path]::GetFullPath($path).TrimEnd('\'), $parent, [StringComparison]::OrdinalIgnoreCase)) { $owned.Add($window) }
        }
        Get-WorkspaceTerminalDiagnostic $owned $expected | ConvertTo-Json -Depth 5 -Compress
    } catch {
        [ordered]@{ version = 1; stage = 'read_error'; snapshot = $null; code = [int]$_.Exception.HResult } | ConvertTo-Json -Compress
    }
}
