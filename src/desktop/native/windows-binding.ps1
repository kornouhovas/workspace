# Loading the fixed scripts defines helpers only. Compile on use so policy/load
# probes do not instantiate COM or change their existing execution boundary.
function Initialize-WorkspaceNativeBinding {
    if ('WorkspaceReadyCom' -as [type]) { return }
    Add-Type -TypeDefinition @'
using System;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Management.Automation;

public static class WorkspaceReadyWindow {
    [DllImport("user32.dll", ExactSpelling=true)]
    [return: MarshalAs(UnmanagedType.Bool)] public static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll", ExactSpelling=true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
}

// Keep returned RCWs inside managed code. Handing a raw COM result back to
// PowerShell can trigger its COM adapter before the next binding guard runs.
public sealed class WorkspaceReadyComReference {
    internal readonly object Value;
    internal WorkspaceReadyComReference(object value) { Value = value; }

    public void SelectItem(WorkspaceReadyComReference item, int flags) {
        if (item == null || flags != 5) throw new ArgumentException();
        WorkspaceReadyCom.Call(this, "SelectItem", new object[] { item, flags });
    }
}

public static class WorkspaceReadyCom {
    private static object Unwrap(object value) {
        // PowerShell can retain PSObject wrappers in object[] arguments and
        // reflection construction. Unwrap those as well as our opaque holder.
        while (true) {
            var reference = value as WorkspaceReadyComReference;
            if (reference != null) { value = reference.Value; continue; }
            var shellObject = value as PSObject;
            if (shellObject == null) return value;
            var raw = shellObject.BaseObject;
            if (Object.ReferenceEquals(raw, value)) return value;
            value = raw;
        }
    }
    private static object Wrap(object value) {
        return value != null && Marshal.IsComObject(value)
            ? new WorkspaceReadyComReference(value) : value;
    }
    public static object Read(object value, string name) {
        var raw = Unwrap(value);
        if (raw == null) throw new ArgumentNullException();
        return Wrap(raw.GetType().InvokeMember(name, BindingFlags.GetProperty, null, raw, null));
    }
    public static object Call(object value, string name, object[] arguments) {
        var raw = Unwrap(value);
        if (raw == null) throw new ArgumentNullException();
        var unwrapped = new object[arguments.Length];
        for (int i = 0; i < arguments.Length; i++) unwrapped[i] = Unwrap(arguments[i]);
        return Wrap(raw.GetType().InvokeMember(name, BindingFlags.InvokeMethod, null, raw, unwrapped));
    }
    public static bool SameIdentity(object left, object right) {
        left = Unwrap(left); right = Unwrap(right);
        if (left == null || right == null) return false;
        IntPtr a = IntPtr.Zero, b = IntPtr.Zero;
        try {
            a = Marshal.GetIUnknownForObject(left);
            b = Marshal.GetIUnknownForObject(right);
            return a == b;
        } finally {
            if (b != IntPtr.Zero) Marshal.Release(b);
            if (a != IntPtr.Zero) Marshal.Release(a);
        }
    }
}
'@ | Out-Null
}
function Get-WorkspaceComProperty($value, [string]$name) {
    Initialize-WorkspaceNativeBinding
    # Preserve collection/null results as one value rather than pipeline items.
    return ,([WorkspaceReadyCom]::Read($value, $name))
}
function Invoke-WorkspaceComMethod($value, [string]$name, [object[]]$arguments, $trace = $null) {
    Initialize-WorkspaceNativeBinding
    $result = [WorkspaceReadyCom]::Call($value, $name, $arguments)
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
    Initialize-WorkspaceNativeBinding
    return [WorkspaceReadyCom]::SameIdentity($left, $right)
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
