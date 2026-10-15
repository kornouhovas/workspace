# Intentional diagnostic commands on a NEW owned fixture, never an observer
# fallback for product Reveal. Contracts and limits are in the verification doc.
. "$PSScriptRoot/../src/desktop/native/windows-view.ps1"
. "$PSScriptRoot/../src/desktop/native/windows-binding.ps1"

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
        if (-not (Test-WorkspaceReadyPath (Get-WorkspaceComProperty $anchor.item 'Path') $expected)) { $result.stage = 'view_changed'; return $result }
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
            $selected = Invoke-WorkspaceComMethod $anchor.document 'SelectedItems' @()
            if ($null -eq $selected -or (Get-WorkspaceComProperty $selected 'Count') -isnot [int] -or (Get-WorkspaceComProperty $selected 'Count') -lt 0 -or (Get-WorkspaceComProperty $selected 'Count') -gt 256) {
                $result.stage = 'property_unavailable'; return $result
            }
            $match = (Get-WorkspaceComProperty $selected 'Count') -eq 1 -and (Test-WorkspaceReadyPath (Get-WorkspaceComProperty (Invoke-WorkspaceComMethod $selected 'Item' @(0)) 'Path') $expected)
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
        Initialize-WorkspaceNativeBinding
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
