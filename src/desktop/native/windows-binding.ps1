function Get-WorkspaceComProperty($value, [string]$name) {
    # Call IDispatch through .NET without PowerShell's COM member discovery.
    # Preserve collection/null results as one value rather than pipeline items.
    return ,([System.__ComObject].InvokeMember($name, [Reflection.BindingFlags]::GetProperty, $null, $value, $null))
}
# [DEBUG-issue26] First traced Item only; no timing work when tracing is disabled.
$script:workspaceComTimingProbed = $false
function Read-WorkspaceComTimingSnapshot {
    $process = [Diagnostics.Process]::GetCurrentProcess()
    try {
        return @{ cpu = $process.TotalProcessorTime.TotalMilliseconds;
            wall = [Diagnostics.Stopwatch]::GetTimestamp() * 1000.0 / [Diagnostics.Stopwatch]::Frequency }
    } finally { $process.Dispose() }
}
function Get-WorkspaceComTimingPhase($before, $after) {
    $wall = $after.wall - $before.wall; $cpu = $after.cpu - $before.cpu
    if ($wall -lt 0 -or $cpu -lt 0) { return $null }
    if ($wall -lt 1000) { return 'item_fast' }
    if ($cpu -ge $wall * 0.5) { return 'item_cpu_bound' }
    return 'item_wait_bound'
}
function Invoke-WorkspaceComMethod($value, [string]$name, [object[]]$arguments, $trace = $null) {
    $before = $null
    if ($null -ne $trace -and -not $script:workspaceComTimingProbed) {
        $script:workspaceComTimingProbed = $true
        try { [void](& $trace 'item_invoking') } catch { }
        try { $before = Read-WorkspaceComTimingSnapshot } catch { }
    }
    $result = [System.__ComObject].InvokeMember($name, [Reflection.BindingFlags]::InvokeMethod, $null, $value, $arguments)
    if ($null -ne $before) {
        try {
            $phase = Get-WorkspaceComTimingPhase $before (Read-WorkspaceComTimingSnapshot)
            if ($null -ne $phase) { [void](& $trace $phase) }
        } catch { }
    }
    if ($null -ne $trace) { try { [void](& $trace 'item_returned') } catch { } }
    return ,$result
}
function Read-WorkspaceReadyParentPath($document) {
    $folder = Get-WorkspaceComProperty $document 'Folder'
    $self = Get-WorkspaceComProperty $folder 'Self'
    return (Get-WorkspaceComProperty $self 'Path')
}
# Shared exact parent/target/Explorer/Document binding, originally extracted from
# scripts/windows-ready-selection.ps1. No navigation or selection here; an optional
# guarded callback observes only fixed read boundaries.
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

function Read-WorkspaceReadyOwner($handle, $trace = $null) {
    [uint32]$owner = 0
    if ($handle -isnot [int] -and $handle -isnot [long]) { return $null }
    if ($handle -le 0 -or -not [WorkspaceReadyWindow]::IsWindow([IntPtr]$handle) -or
        [WorkspaceReadyWindow]::GetWindowThreadProcessId([IntPtr]$handle, [ref]$owner) -eq 0 -or
        $owner -eq 0 -or (Get-Process -Id $owner -ErrorAction Stop).ProcessName -ne 'explorer') { return $null }
    # The existing exact-HWND guard rejects shared tabbed views. No desktop UIA.
    $binding = Read-WorkspaceUiaWindow $handle $trace
    if ($binding.stage -ne 'verified') { return $null }
    if ($binding.root.Current.ProcessId -ne $owner) { return $null }
    return $owner
}

function Read-WorkspaceReadyBinding($shell, $expected, $anchor, $trace = $null) {
    $parent = [IO.Path]::GetDirectoryName($expected)
    if ($null -ne $trace) { try { [void](& $trace 'enumeration') } catch { } }
    $windows = $shell.Windows()
    if ($null -ne $trace) { try { [void](& $trace 'collection') } catch { } }
    if ($null -eq $windows -or (Get-WorkspaceComProperty $windows 'Count') -isnot [int] -or (Get-WorkspaceComProperty $windows 'Count') -lt 0 -or (Get-WorkspaceComProperty $windows 'Count') -gt 256) {
        return @{ stage = 'property_unavailable' }
    }
    $owned = [Collections.Generic.List[object]]::new()
    for ($i = 0; $i -lt (Get-WorkspaceComProperty $windows 'Count'); $i++) {
        if ($null -ne $trace) { try { [void](& $trace 'window_item') } catch { } }
        # IShellWindows::Item is DISPID 0 in the Windows SDK ExDisp.idl.
        # Invoke that same member without a GetIDsOfNames lookup.
        $candidate = (Invoke-WorkspaceComMethod $windows '[DispID=0]' @($i) $trace)
        if ($null -ne $trace) { try { [void](& $trace 'document') } catch { } }
        $document = (Get-WorkspaceComProperty $candidate 'Document')
        if ($null -ne $trace) { try { [void](& $trace 'parent') } catch { } }
        if (Test-WorkspaceReadyPath (Read-WorkspaceReadyParentPath $document) $parent) {
            $owned.Add(@{ window = $candidate; document = $document })
        }
    }
    if ($owned.Count -eq 0) { return @{ stage = 'parent_absent' } }
    if ($owned.Count -ne 1) { return @{ stage = 'ambiguous_parent' } }
    $window = $owned[0].window; $document = $owned[0].document
    $handle = (Get-WorkspaceComProperty $window 'HWND')
    if ($null -ne $trace) { try { [void](& $trace 'owner') } catch { } }
    $owner = Read-WorkspaceReadyOwner $handle $trace
    if ($null -eq $owner) { return @{ stage = 'wrong_window' } }
    if ($null -ne $anchor -and ($anchor.handle -ne $handle -or $anchor.owner -ne $owner -or
        -not (Test-WorkspaceReadyDocument $anchor.document $document))) { return @{ stage = 'view_changed' } }
    if ($null -ne $trace) { try { [void](& $trace 'readiness') } catch { } }
    $busy = (Get-WorkspaceComProperty $window 'Busy'); $ready = (Get-WorkspaceComProperty $window 'ReadyState')
    if ($busy -isnot [bool] -or $null -eq $ready -or
        ($ready -isnot [int] -and $ready -isnot [System.Enum]) -or $ready -notin @(0,1,2,3,4)) {
        return @{ stage = 'property_unavailable' }
    }
    if ($null -ne $trace) { try { [void](& $trace 'item') } catch { } }
    $item = (Invoke-WorkspaceComMethod (Get-WorkspaceComProperty $document 'Folder') 'ParseName' @([IO.Path]::GetFileName($expected)))
    if ($null -eq $item -or -not (Test-WorkspaceReadyPath (Get-WorkspaceComProperty $item 'Path') $expected)) { return @{ stage = 'target_absent' } }
    # Re-read the same window/document after the potentially blocking item query.
    if ($null -ne $trace) { try { [void](& $trace 'document_recheck') } catch { } }
    if ((Get-WorkspaceComProperty $window 'HWND') -ne $handle -or -not (Test-WorkspaceReadyDocument $document (Get-WorkspaceComProperty $window 'Document')) -or
        -not (Test-WorkspaceReadyPath (Read-WorkspaceReadyParentPath $document) $parent) -or
        (Read-WorkspaceReadyOwner $handle $trace) -ne $owner) { return @{ stage = 'view_changed' } }
    if ($null -ne $trace) { try { [void](& $trace 'readiness_recheck') } catch { } }
    $busyAfter = (Get-WorkspaceComProperty $window 'Busy'); $readyAfter = (Get-WorkspaceComProperty $window 'ReadyState')
    if ($busyAfter -isnot [bool] -or $null -eq $readyAfter -or
        ($readyAfter -isnot [int] -and $readyAfter -isnot [System.Enum]) -or $readyAfter -notin @(0,1,2,3,4)) {
        return @{ stage = 'property_unavailable' }
    }
    return @{ stage = $(if (-not $busy -and -not $busyAfter -and [int]$ready -eq 4 -and [int]$readyAfter -eq 4) { 'ready' } else { 'unready' });
        window = $window; document = $document; item = $item; handle = $handle; owner = $owner }
}
