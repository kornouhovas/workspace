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
    $entries = [Collections.Generic.List[object]]::new()
    for ($index = 0; $index -lt $before; $index++) {
        $entry = Invoke-WorkspaceComMethod $windows '[DispID=0]' @($index)
        if ($null -eq $entry) { throw 'invalid_entry' }
        $entries.Add($entry)
    }
    if ((Get-WorkspaceComProperty $windows 'Count') -cne $before) { throw 'changed_count' }
    return ,($entries.ToArray())
}
