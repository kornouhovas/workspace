# Read-only, exact owned Explorer view only. Called after the product dispatch by
# file-manager-evidence.mjs, in the SAME bounded observation subprocess.
# UIA contracts: https://learn.microsoft.com/dotnet/api/system.windows.automation.automationelement.fromhandle
# https://learn.microsoft.com/dotnet/api/system.windows.automation.selectionitempattern.current
# Explorer ItemsView is a provider detail: missing/ambiguous views are unavailable,
# never a reason to search the desktop, manipulate input or infer success.
function Get-WorkspaceUiaRoot($handle) {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    return [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$handle)
}

function Read-WorkspaceUiaWindow($handle) {
    $root = Get-WorkspaceUiaRoot $handle
    if ($null -eq $root -or $root.Current.NativeWindowHandle -ne $handle -or
        $root.Current.ControlType -ne [System.Windows.Automation.ControlType]::Window -or
        (Get-Process -Id $root.Current.ProcessId -ErrorAction Stop).ProcessName -ne 'explorer') {
        return @{ stage = 'wrong_window'; root = $null }
    }
    # A shared HWND cannot prove which of several Explorer tabs owns ItemsView.
    # Fail closed rather than inspect another tab's target with the same basename.
    $tabs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::TabItem))
    if ($tabs.Count -gt 1) { return @{ stage = 'ambiguous_parent'; root = $null } }
    return @{ stage = 'verified'; root = $root }
}

function Read-WorkspaceUiaSelection($handle, $name) {
    $binding = Read-WorkspaceUiaWindow $handle
    if ($binding.stage -ne 'verified') { return @{ stage = $binding.stage; selected = $null } }
    $root = $binding.root
    # No desktop root, tree dump, title capture or navigation-pane item matching.
    $viewCondition = [System.Windows.Automation.AndCondition]::new(
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'ItemsView'),
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::List))
    $views = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $viewCondition)
    if ($views.Count -ne 1) { return @{ stage = 'ambiguous_target'; selected = $null } }
    $itemCondition = [System.Windows.Automation.AndCondition]::new(
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, $name),
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ListItem))
    $items = $views[0].FindAll([System.Windows.Automation.TreeScope]::Children, $itemCondition)
    if ($items.Count -eq 0) { return @{ stage = 'target_absent'; selected = $null } }
    if ($items.Count -ne 1 -or $items[0].Current.IsOffscreen) { return @{ stage = 'ambiguous_target'; selected = $null } }
    $pattern = $null
    if (-not $items[0].TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
        return @{ stage = 'pattern_unavailable'; selected = $null }
    }
    $selected = [bool]$pattern.Current.IsSelected
    return @{ stage = $(if ($selected) { 'selected' } else { 'unselected' }); selected = $selected }
}

function Test-WorkspaceExactView($window, $expected) {
    $folder = $window.Document.Folder
    $parent = [IO.Path]::GetDirectoryName($expected)
    if (-not [string]::Equals([IO.Path]::GetFullPath($folder.Self.Path).TrimEnd('\'), $parent, [StringComparison]::OrdinalIgnoreCase)) { return $false }
    $item = $folder.ParseName([IO.Path]::GetFileName($expected))
    return $null -ne $item -and [string]::Equals([IO.Path]::GetFullPath($item.Path).TrimEnd('\'), $expected, [StringComparison]::OrdinalIgnoreCase)
}

function Get-WorkspaceSelectionDiagnostic($ownedWindows, $expected) {
    $result = [ordered]@{ stage = 'parent_absent'; windowVerified = $false; targetVerified = $false; selected = $null; code = $null }
    if ($ownedWindows.Count -eq 0) { return $result }
    if ($ownedWindows.Count -ne 1) { $result.stage = 'ambiguous_parent'; return $result }
    try {
        $window = $ownedWindows[0]
        # Revalidate full parent/target BEFORE querying any UIA content and again
        # afterwards. HWND is only read from this COM-bound exact disposable view.
        $result.stage = 'target_absent'
        if (-not (Test-WorkspaceExactView $window $expected)) { return $result }
        $result.stage = 'wrong_window'
        $handle = [long]$window.HWND
        if ($handle -le 0 -or $handle -gt [int]::MaxValue) { return $result }
        $read = Read-WorkspaceUiaSelection $handle ([IO.Path]::GetFileName($expected))
        if ($read.stage -eq 'wrong_window') { return $result }
        $result.windowVerified = $true
        $result.stage = 'view_changed'
        if (-not (Test-WorkspaceExactView $window $expected) -or [long]$window.HWND -ne $handle) { return $result }
        $result.stage = $read.stage
        if ($read.stage -eq 'selected' -or $read.stage -eq 'unselected') {
            $result.targetVerified = $true
            $result.selected = $read.selected
        }
    } catch {
        $result.stage = 'read_error'
        $result.selected = $null
        $result.code = [int]$_.Exception.HResult
    }
    return $result
}
