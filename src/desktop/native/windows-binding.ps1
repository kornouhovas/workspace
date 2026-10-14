# Shared exact parent/target/Explorer/Document binding. Extracted unchanged from
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
    if ($null -eq $windows -or $windows.Count -isnot [int] -or $windows.Count -lt 0 -or $windows.Count -gt 256) {
        return @{ stage = 'property_unavailable' }
    }
    $owned = [Collections.Generic.List[object]]::new()
    for ($i = 0; $i -lt $windows.Count; $i++) {
        if ($null -ne $trace) { try { [void](& $trace 'window_item') } catch { } }
        $candidate = $windows.Item($i)
        if ($null -ne $trace) { try { [void](& $trace 'document') } catch { } }
        $document = $candidate.Document
        if ($null -ne $trace) { try { [void](& $trace 'parent') } catch { } }
        if (Test-WorkspaceReadyPath $document.Folder.Self.Path $parent) {
            $owned.Add(@{ window = $candidate; document = $document })
        }
    }
    if ($owned.Count -eq 0) { return @{ stage = 'parent_absent' } }
    if ($owned.Count -ne 1) { return @{ stage = 'ambiguous_parent' } }
    $window = $owned[0].window; $document = $owned[0].document
    $handle = $window.HWND
    if ($null -ne $trace) { try { [void](& $trace 'owner') } catch { } }
    $owner = Read-WorkspaceReadyOwner $handle $trace
    if ($null -eq $owner) { return @{ stage = 'wrong_window' } }
    if ($null -ne $anchor -and ($anchor.handle -ne $handle -or $anchor.owner -ne $owner -or
        -not (Test-WorkspaceReadyDocument $anchor.document $document))) { return @{ stage = 'view_changed' } }
    if ($null -ne $trace) { try { [void](& $trace 'readiness') } catch { } }
    $busy = $window.Busy; $ready = $window.ReadyState
    if ($busy -isnot [bool] -or $null -eq $ready -or
        ($ready -isnot [int] -and $ready -isnot [System.Enum]) -or $ready -notin @(0,1,2,3,4)) {
        return @{ stage = 'property_unavailable' }
    }
    if ($null -ne $trace) { try { [void](& $trace 'item') } catch { } }
    $item = $document.Folder.ParseName([IO.Path]::GetFileName($expected))
    if ($null -eq $item -or -not (Test-WorkspaceReadyPath $item.Path $expected)) { return @{ stage = 'target_absent' } }
    # Re-read the same window/document after the potentially blocking item query.
    if ($null -ne $trace) { try { [void](& $trace 'document_recheck') } catch { } }
    if ($window.HWND -ne $handle -or -not (Test-WorkspaceReadyDocument $document $window.Document) -or
        -not (Test-WorkspaceReadyPath $document.Folder.Self.Path $parent) -or
        (Read-WorkspaceReadyOwner $handle $trace) -ne $owner) { return @{ stage = 'view_changed' } }
    if ($null -ne $trace) { try { [void](& $trace 'readiness_recheck') } catch { } }
    $busyAfter = $window.Busy; $readyAfter = $window.ReadyState
    if ($busyAfter -isnot [bool] -or $null -eq $readyAfter -or
        ($readyAfter -isnot [int] -and $readyAfter -isnot [System.Enum]) -or $readyAfter -notin @(0,1,2,3,4)) {
        return @{ stage = 'property_unavailable' }
    }
    return @{ stage = $(if (-not $busy -and -not $busyAfter -and [int]$ready -eq 4 -and [int]$readyAfter -eq 4) { 'ready' } else { 'unready' });
        window = $window; document = $document; item = $item; handle = $handle; owner = $owner }
}
