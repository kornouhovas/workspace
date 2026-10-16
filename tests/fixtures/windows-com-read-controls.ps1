# Test-only dispatch for PSCustomObject fixtures. Production binding, owner,
# permit, identity and deadline guards still execute unchanged around these reads.
# Genuine COM dispatch is exercised separately in windows-project-reveal-com.
function Get-WorkspaceComProperty($value, [string]$name) {
    return ,($value.$name)
}
function Invoke-WorkspaceComMethod($value, [string]$name, [object[]]$arguments) {
    if ($name -ceq '[DispID=0]') { $name = 'Item' }
    return ,($value.PSObject.Methods[$name].Invoke($arguments))
}
function Read-WorkspaceWindowEnumerator($windows) {
    $before = Get-WorkspaceComProperty $windows 'Count'
    if ($before -isnot [int] -or $before -lt 0 -or $before -gt 256) { throw 'invalid_count' }
    # Separate enumerator data from Item: the old acquisition must fail this fixture.
    $entries = $windows.Entries
    if ($entries -isnot [Array] -or $entries.Length -ne $before) { throw 'invalid_entries' }
    return ,$entries
}
