# Intentional diagnostic commands on a NEW owned fixture, never an observer
# fallback for product Reveal. Contracts and limits are in the verification doc.
function Test-WorkspaceReadyPath($actual, $expected) {
    return $actual -is [string] -and [string]::Equals($actual, $expected, [StringComparison]::OrdinalIgnoreCase)
}

function Test-WorkspaceReadyDocument($left, $right) {
    if ($null -eq $left -or $null -eq $right) { return $false }
    $a = [IntPtr]::Zero; $b = [IntPtr]::Zero
    try {
        $a = [Runtime.InteropServices.Marshal]::GetIUnknownForObject($left)
        $b = [Runtime.InteropServices.Marshal]::GetIUnknownForObject($right)
        return $a -eq $b
    } finally {
        if ($b -ne [IntPtr]::Zero) { [void][Runtime.InteropServices.Marshal]::Release($b) }
        if ($a -ne [IntPtr]::Zero) { [void][Runtime.InteropServices.Marshal]::Release($a) }
    }
}

function Read-WorkspaceReadyOwner($handle) {
    [uint32]$owner = 0
    if ($handle -isnot [int] -and $handle -isnot [long]) { return $null }
    if ($handle -le 0 -or -not [WorkspaceReadyWindow]::IsWindow([IntPtr]$handle) -or
        [WorkspaceReadyWindow]::GetWindowThreadProcessId([IntPtr]$handle, [ref]$owner) -eq 0 -or
        $owner -eq 0 -or (Get-Process -Id $owner -ErrorAction Stop).ProcessName -ne 'explorer') { return $null }
    # The existing exact-HWND guard rejects shared tabbed views. No desktop UIA.
    $binding = Read-WorkspaceUiaWindow $handle
    if ($binding.stage -ne 'verified') { return $null }
    if ($binding.root.Current.ProcessId -ne $owner) { return $null }
    return $owner
}

function Read-WorkspaceReadyBinding($shell, $expected, $anchor) {
    $parent = [IO.Path]::GetDirectoryName($expected)
    $windows = $shell.Windows()
    if ($null -eq $windows -or $windows.Count -isnot [int] -or $windows.Count -lt 0 -or $windows.Count -gt 256) {
        return @{ stage = 'property_unavailable' }
    }
    $owned = [Collections.Generic.List[object]]::new()
    for ($i = 0; $i -lt $windows.Count; $i++) {
        $candidate = $windows.Item($i)
        $document = $candidate.Document
        if (Test-WorkspaceReadyPath $document.Folder.Self.Path $parent) {
            $owned.Add(@{ window = $candidate; document = $document })
        }
    }
    if ($owned.Count -eq 0) { return @{ stage = 'parent_absent' } }
    if ($owned.Count -ne 1) { return @{ stage = 'ambiguous_parent' } }
    $window = $owned[0].window; $document = $owned[0].document
    $handle = $window.HWND
    $owner = Read-WorkspaceReadyOwner $handle
    if ($null -eq $owner) { return @{ stage = 'wrong_window' } }
    if ($null -ne $anchor -and ($anchor.handle -ne $handle -or $anchor.owner -ne $owner -or
        -not (Test-WorkspaceReadyDocument $anchor.document $document))) { return @{ stage = 'view_changed' } }
    $busy = $window.Busy; $ready = $window.ReadyState
    if ($busy -isnot [bool] -or $null -eq $ready -or
        ($ready -isnot [int] -and $ready -isnot [System.Enum]) -or $ready -notin @(0,1,2,3,4)) {
        return @{ stage = 'property_unavailable' }
    }
    $item = $document.Folder.ParseName([IO.Path]::GetFileName($expected))
    if ($null -eq $item -or -not (Test-WorkspaceReadyPath $item.Path $expected)) { return @{ stage = 'target_absent' } }
    # Re-read the same window/document after the potentially blocking item query.
    if ($window.HWND -ne $handle -or -not (Test-WorkspaceReadyDocument $document $window.Document) -or
        -not (Test-WorkspaceReadyPath $document.Folder.Self.Path $parent) -or
        (Read-WorkspaceReadyOwner $handle) -ne $owner) { return @{ stage = 'view_changed' } }
    $busyAfter = $window.Busy; $readyAfter = $window.ReadyState
    if ($busyAfter -isnot [bool] -or $null -eq $readyAfter -or
        ($readyAfter -isnot [int] -and $readyAfter -isnot [System.Enum]) -or $readyAfter -notin @(0,1,2,3,4)) {
        return @{ stage = 'property_unavailable' }
    }
    return @{ stage = $(if (-not $busy -and -not $busyAfter -and [int]$ready -eq 4 -and [int]$readyAfter -eq 4) { 'ready' } else { 'unready' });
        window = $window; document = $document; item = $item; handle = $handle; owner = $owner }
}

function Get-WorkspaceReadyMilliseconds($watch) { return $watch.Elapsed.TotalMilliseconds }
function Wait-WorkspaceReadyPoll($milliseconds) { Start-Sleep -Milliseconds $milliseconds }

function Invoke-WorkspaceReadySelection($shell, $expected, $watch) {
    $result = [ordered]@{ version = 1; stage = 'input'; deadlineMs = 10000;
        navigationCount = 0; navigationCompleted = $false; selectionCount = 0; selectionCompleted = $false;
        readinessAttempts = 0; confirmationAttempts = 0; readyMs = $null; selectionMs = $null;
        elapsedMs = 0; selected = $null; code = $null }
    try {
        if (-not [IO.Path]::IsPathRooted($expected) -or $expected.Contains([char]0)) { return $result }
        $watch.Start()
        $result.stage = 'navigation_error'; $result.navigationCount = 1
        $shell.Open([IO.Path]::GetDirectoryName($expected))
        $result.navigationCompleted = $true
        $anchor = $null
        for ($iteration = 0; $iteration -lt 128; $iteration++) {
            $result.elapsedMs = Get-WorkspaceReadyMilliseconds $watch
            if ($result.elapsedMs -ge 10000) { $result.stage = 'deadline'; return $result }
            $result.stage = 'read_error'; $result.readinessAttempts++
            $binding = Read-WorkspaceReadyBinding $shell $expected $anchor
            $result.elapsedMs = Get-WorkspaceReadyMilliseconds $watch
            if ($result.elapsedMs -ge 10000) { $result.stage = 'deadline'; return $result }
            $result.stage = $binding.stage
            if ($binding.stage -eq 'ready') { $anchor = $binding; break }
            if ($binding.stage -eq 'unready') { $anchor = $binding }
            elseif ($binding.stage -notin @('parent_absent','target_absent')) { return $result }
            # Once bound, disappearance is a lifetime failure, not a new search.
            elseif ($null -ne $anchor) { $result.stage = 'view_changed'; return $result }
            Wait-WorkspaceReadyPoll ([int][Math]::Min(100, [Math]::Ceiling(10000 - $result.elapsedMs)))
        }
        if ($null -eq $anchor -or $binding.stage -ne 'ready') { $result.stage = 'iteration_limit'; return $result }
        $result.readyMs = $result.elapsedMs
        # Second independent enumeration immediately before mutation. Never
        # transfer the command to a new window or Document after anchoring.
        $result.stage = 'read_error'
        $before = Read-WorkspaceReadyBinding $shell $expected $anchor
        $result.elapsedMs = Get-WorkspaceReadyMilliseconds $watch
        if ($result.elapsedMs -ge 10000) { $result.stage = 'deadline'; return $result }
        if ($before.stage -ne 'ready') { $result.stage = $(if ($before.stage -eq 'unready') { 'unready' } else { $before.stage }); return $result }
        # Revalidate the captured FolderItem's path; use its captured Document.
        if (-not (Test-WorkspaceReadyPath $anchor.item.Path $expected)) { $result.stage = 'view_changed'; return $result }
        $result.selectionMs = Get-WorkspaceReadyMilliseconds $watch
        if ($result.selectionMs -ge 10000) { $result.elapsedMs = $result.selectionMs; $result.selectionMs = $null; $result.stage = 'deadline'; return $result }
        $result.stage = 'selection_error'; $result.selectionCount = 1
        # SELECT | DESELECTOTHERS only: no edit, focus or simulated input.
        $anchor.document.SelectItem($anchor.item, 5)
        $result.selectionCompleted = $true
        for ($iteration = 0; $iteration -lt 128; $iteration++) {
            $result.elapsedMs = Get-WorkspaceReadyMilliseconds $watch
            if ($result.elapsedMs -ge 10000) { $result.stage = 'deadline'; return $result }
            $result.stage = 'read_error'; $result.confirmationAttempts++
            $after = Read-WorkspaceReadyBinding $shell $expected $anchor
            $result.elapsedMs = Get-WorkspaceReadyMilliseconds $watch
            if ($result.elapsedMs -ge 10000) { $result.stage = 'deadline'; return $result }
            if ($after.stage -ne 'ready') { $result.stage = $after.stage; return $result }
            $selected = $anchor.document.SelectedItems()
            if ($null -eq $selected -or $selected.Count -isnot [int] -or $selected.Count -lt 0 -or $selected.Count -gt 256) {
                $result.stage = 'property_unavailable'; return $result
            }
            $match = $selected.Count -eq 1 -and (Test-WorkspaceReadyPath $selected.Item(0).Path $expected)
            $verified = Read-WorkspaceReadyBinding $shell $expected $anchor
            $result.elapsedMs = Get-WorkspaceReadyMilliseconds $watch
            if ($result.elapsedMs -ge 10000) { $result.stage = 'deadline'; return $result }
            if ($verified.stage -ne 'ready') { $result.stage = $verified.stage; return $result }
            $result.selected = [bool]$match
            if ($match) { $result.stage = 'selected'; return $result }
            Wait-WorkspaceReadyPoll ([int][Math]::Min(100, [Math]::Ceiling(10000 - $result.elapsedMs)))
        }
        $result.stage = 'iteration_limit'
    } catch {
        # Stage identifies the operation that threw. No exception text/paths.
        $result.code = [int]$_.Exception.HResult
        $result.elapsedMs = Get-WorkspaceReadyMilliseconds $watch
    }
    return $result
}

if ($MyInvocation.InvocationName -ne '.') {
    $ErrorActionPreference = 'Stop'
    try {
        . "$PSScriptRoot/windows-selection-diagnostics.ps1"
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
        $expected = [IO.Path]::GetFullPath($env:WORKSPACE_READY_SELECTION_TARGET)
        # Only the orchestrator's fresh owned shape is accepted, including Unicode.
        $parent = [IO.Path]::GetDirectoryName($expected)
        $basename = 'Native selection ' + (-join ([char[]]@(0x65e5,0x672c,0x8a9e)))
        if ([IO.Path]::GetFileName($expected) -cne $basename -or
            [IO.Path]::GetFileName($parent) -notmatch '^workspace-native-selection-[a-zA-Z0-9]+$' -or
            -not (Test-Path -LiteralPath $expected -PathType Container)) { throw 'input' }
        $shell = New-Object -ComObject Shell.Application
        Invoke-WorkspaceReadySelection $shell $expected ([Diagnostics.Stopwatch]::new()) | ConvertTo-Json -Compress
    } catch {
        [ordered]@{ version = 1; stage = 'setup_error'; deadlineMs = 10000;
            navigationCount = 0; navigationCompleted = $false; selectionCount = 0; selectionCompleted = $false;
            readinessAttempts = 0; confirmationAttempts = 0; readyMs = $null; selectionMs = $null;
            elapsedMs = 0; selected = $null; code = [int]$_.Exception.HResult } | ConvertTo-Json -Compress
    }
}
