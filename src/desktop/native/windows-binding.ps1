# Loading the fixed scripts defines helpers only. Compile on use so policy/load
# probes do not instantiate COM or change their existing execution boundary.
function Initialize-WorkspaceNativeBinding {
    if ('WorkspaceReadyCom' -as [type]) { return }
    Add-Type -TypeDefinition @'
using System;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Management.Automation;
using System.Diagnostics;
using System.Threading;

public static class WorkspaceReadyWindow {
    [DllImport("user32.dll", ExactSpelling=true)]
    [return: MarshalAs(UnmanagedType.Bool)] public static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll", ExactSpelling=true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
}

// ExDisp.idl: IShellWindows derives from IDispatch; Count and Item are its
// first two members. Preserve the four inherited IDispatch slots exactly.
// The opaque returned interface is the SDK's IDispatch**, not a discovered type.
[ComImport, Guid("00020400-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface WorkspaceReturnedDispatch { }
[ComImport, Guid("85CB6900-4D95-11CF-960C-0080C7F4EE85"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface WorkspaceShellWindows {
    [PreserveSig] int GetTypeInfoCount(out uint count);
    [PreserveSig] int GetTypeInfo(uint index, uint locale, out IntPtr info);
    [PreserveSig] int GetIDsOfNames(ref Guid id, IntPtr names, uint count, uint locale, IntPtr ids);
    [PreserveSig] int Invoke(int member, ref Guid id, uint locale, ushort flags,
        IntPtr arguments, IntPtr result, IntPtr exception, IntPtr argumentError);
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int Item([In, MarshalAs(UnmanagedType.Struct)] object index,
        [Out, MarshalAs(UnmanagedType.Interface)] out WorkspaceReturnedDispatch window);
    [PreserveSig] int NewEnum([Out, MarshalAs(UnmanagedType.IUnknown)] out object enumerator);
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
    // [DEBUG-issue26] Optional one-shot quiet-call observation. This timer never
    // enters COM/PowerShell and never owns a permit or changes a command result.
    private static bool ReadCheckpointEnabled() {
        try { return Environment.GetEnvironmentVariable("WORKSPACE_REVEAL_DEFERRED_TRACE") == "1"; } catch { return false; }
    }
    private static readonly bool checkpointEnabled = ReadCheckpointEnabled();
    private static readonly object checkpointGate = new object();
    private static Timer checkpointTimer;
    private static Stopwatch checkpointWatch;
    private static string checkpointOperation = "none";
    private static int checkpointSequence;
    private static bool checkpointActive, checkpointReported, checkpointDisposed;
    public static void StartDeferredTrace() {
        if (!checkpointEnabled) return;
        try {
            lock (checkpointGate) {
                if (checkpointWatch != null || checkpointDisposed) return;
                checkpointWatch = Stopwatch.StartNew();
                checkpointTimer = new Timer(EmitDeferredCheckpoint, null, 9000, Timeout.Infinite);
            }
        } catch { /* A missing checkpoint is unknown, never command authority. */ }
    }
    public static void StopDeferredTrace() {
        if (!checkpointEnabled) return;
        try {
            Timer timer;
            lock (checkpointGate) { checkpointDisposed = true; timer = checkpointTimer; checkpointTimer = null; }
            if (timer != null) timer.Dispose(); // Do not wait for an in-flight callback.
        } catch { }
    }
    private static void EmitDeferredCheckpoint(object unused) {
        try {
            string line;
            lock (checkpointGate) {
                if (!checkpointEnabled || checkpointDisposed || checkpointReported || checkpointWatch == null) return;
                long elapsed = checkpointWatch.ElapsedMilliseconds;
                if (elapsed > 12000) return;
                checkpointReported = true;
                line = "CHECKPOINT:" + checkpointOperation + ":" + (checkpointActive ? "active" : "complete") + ":" +
                    checkpointSequence.ToString(System.Globalization.CultureInfo.InvariantCulture) + ":" +
                    elapsed.ToString(System.Globalization.CultureInfo.InvariantCulture);
            }
            // Snapshot precedes output. Disposal may race this already captured
            // line; output is atomic, bounded and cannot advance the protocol.
            Console.Out.WriteLine(line);
            Console.Out.Flush();
        } catch { /* Observation/console faults never replace a COM result. */ }
    }
    private static int EnterCheckpoint(string operation) {
        if (!checkpointEnabled) return 0;
        try {
            lock (checkpointGate) {
                if (checkpointDisposed) return 0;
                checkpointSequence = Math.Min(100000, checkpointSequence + 1);
                checkpointOperation = operation; checkpointActive = true;
                return checkpointSequence;
            }
        } catch { return 0; }
    }
    private static void LeaveCheckpoint(int sequence) {
        if (sequence == 0) return;
        try { lock (checkpointGate) { if (checkpointSequence == sequence) checkpointActive = false; } } catch { }
    }
    public static int BeginOwnerCheckpoint(string operation) {
        if (!checkpointEnabled) return 0;
        switch (operation) {
            case "owner_validation": case "uia_root": case "uia_properties": case "uia_tabs": case "uia_owner":
                return EnterCheckpoint(operation);
            default: return 0;
        }
    }
    public static void EndOwnerCheckpoint(int sequence) { LeaveCheckpoint(sequence); }
    private static string CheckpointName(string name, bool read) {
        if (read) {
            switch (name) {
                case "Count": return "read_count";
                case "Document": return "read_document";
                case "Folder": return "read_folder";
                case "Self": return "read_self";
                case "Path": return "read_path";
                case "HWND": return "read_hwnd";
                case "Busy": return "read_busy";
                case "ReadyState": return "read_ready";
                default: return "other_read";
            }
        }
        switch (name) {
            case "Windows": return "call_windows";
            case "[DispID=0]": return "call_window_item";
            case "ParseName": return "call_parse";
            case "SelectItem": return "call_select";
            default: return "other_call";
        }
    }
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
    private static int ReadWindowCount(WorkspaceShellWindows windows) {
        int count;
        if (windows.GetCount(out count) != 0 || count < 0 || count > 256) throw new InvalidOperationException();
        return count;
    }
    private static WorkspaceReadyComReference[] CollectWindowEnumerator(
        System.Runtime.InteropServices.ComTypes.IEnumVARIANT enumerator, int before, Func<int> readAfter) {
        if (enumerator == null || before < 0 || before > 256 || readAfter == null) throw new ArgumentException();
        var entries = new System.Collections.Generic.List<WorkspaceReadyComReference>();
        var identities = new System.Collections.Generic.HashSet<IntPtr>();
        // Accept at most 256 entries and one terminal check; never accept a prefix.
        for (int index = 0; index <= 256; index++) {
            var value = new object[1];
            int status = enumerator.Next(1, value, IntPtr.Zero);
            if (status == 1) {
                if (value[0] != null || entries.Count != before || readAfter() != before) throw new InvalidOperationException();
                return entries.ToArray();
            }
            if (status < 0) Marshal.ThrowExceptionForHR(status);
            if (status != 0 || entries.Count >= before || index == 256 || value[0] == null || !Marshal.IsComObject(value[0]))
                throw new InvalidOperationException();
            IntPtr identity = Marshal.GetIUnknownForObject(value[0]);
            try { if (identity == IntPtr.Zero || !identities.Add(identity)) throw new InvalidOperationException(); }
            finally { Marshal.Release(identity); }
            entries.Add(new WorkspaceReadyComReference(value[0]));
        }
        throw new InvalidOperationException();
    }
    // [DEBUG-issue26] Explicit counterfactual acquisition; all downstream guards
    // remain common. A fresh enumeration is bounded, not an atomic membership proof.
    public static WorkspaceReadyComReference[] WindowsByEnumerator(object value) {
        int sequence = EnterCheckpoint("call_window_enum");
        try {
            var windows = (WorkspaceShellWindows)Unwrap(value);
            int before = ReadWindowCount(windows);
            object rawEnumerator;
            if (windows.NewEnum(out rawEnumerator) != 0 || rawEnumerator == null || !Marshal.IsComObject(rawEnumerator))
                throw new InvalidOperationException();
            return CollectWindowEnumerator((System.Runtime.InteropServices.ComTypes.IEnumVARIANT)rawEnumerator,
                before, delegate { return ReadWindowCount(windows); });
            // Enumerator and window RCWs stay owned by this short-lived process.
        } finally { LeaveCheckpoint(sequence); }
    }
    public static object Read(object value, string name) {
        int sequence = checkpointEnabled ? EnterCheckpoint(CheckpointName(name, true)) : 0;
        try {
        var raw = Unwrap(value);
        if (raw == null) throw new ArgumentNullException();
        return Wrap(raw.GetType().InvokeMember(name, BindingFlags.GetProperty, null, raw, null));
        } finally { LeaveCheckpoint(sequence); }
    }
    public static object Call(object value, string name, object[] arguments) {
        int sequence = checkpointEnabled ? EnterCheckpoint(CheckpointName(name, false)) : 0;
        try {
        var raw = Unwrap(value);
        if (raw == null) throw new ArgumentNullException();
        var unwrapped = new object[arguments.Length];
        for (int i = 0; i < arguments.Length; i++) unwrapped[i] = Unwrap(arguments[i]);
        if (name == "[DispID=0]") {
            if (unwrapped.Length != 1 || !(unwrapped[0] is int) || (int)unwrapped[0] < 0 || (int)unwrapped[0] > 255)
                throw new ArgumentException();
            WorkspaceReturnedDispatch window;
            int status = ((WorkspaceShellWindows)raw).Item(unwrapped[0], out window);
            Marshal.ThrowExceptionForHR(status);
            return Wrap(window);
        }
        return Wrap(raw.GetType().InvokeMember(name, BindingFlags.InvokeMethod, null, raw, unwrapped));
        } finally { LeaveCheckpoint(sequence); }
    }
    public static bool SameIdentity(object left, object right) {
        int sequence = EnterCheckpoint("identity");
        try {
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
        } finally { LeaveCheckpoint(sequence); }
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
function Read-WorkspaceWindowEnumerator($windows) {
    Initialize-WorkspaceNativeBinding
    return ,([WorkspaceReadyCom]::WindowsByEnumerator($windows))
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
    $checkpoint = 0
    if ($env:WORKSPACE_REVEAL_DEFERRED_TRACE -ceq '1' -and ('WorkspaceReadyCom' -as [type])) { $checkpoint = [WorkspaceReadyCom]::BeginOwnerCheckpoint('owner_validation') }
    try {
    [uint32]$owner = 0
    if ($handle -isnot [int] -and $handle -isnot [long]) { return $null }
    if ($handle -le 0 -or -not [WorkspaceReadyWindow]::IsWindow([IntPtr]$handle) -or
        [WorkspaceReadyWindow]::GetWindowThreadProcessId([IntPtr]$handle, [ref]$owner) -eq 0 -or
        $owner -eq 0 -or (Get-Process -Id $owner -ErrorAction Stop).ProcessName -ne 'explorer') { return $null }
    } finally { if ($checkpoint -ne 0) { [WorkspaceReadyCom]::EndOwnerCheckpoint($checkpoint) } }
    # The existing exact-HWND guard rejects shared tabbed views. No desktop UIA.
    $binding = Read-WorkspaceUiaWindow $handle $trace
    if ($binding.stage -ne 'verified') { return $null }
    $checkpoint = 0
    if ($env:WORKSPACE_REVEAL_DEFERRED_TRACE -ceq '1' -and ('WorkspaceReadyCom' -as [type])) { $checkpoint = [WorkspaceReadyCom]::BeginOwnerCheckpoint('uia_owner') }
    try {
        if ($binding.root.Current.ProcessId -ne $owner) { return $null }
    } finally { if ($checkpoint -ne 0) { [WorkspaceReadyCom]::EndOwnerCheckpoint($checkpoint) } }
    return $owner
}

function Read-WorkspaceReadyBinding($shell, $expected, $anchor, $trace = $null) {
    $parent = [IO.Path]::GetDirectoryName($expected)
    if ($null -ne $trace) { try { [void](& $trace 'enumeration') } catch { } }
    # Keep the collection RCW opaque too; a raw return would re-enter the
    # PowerShell COM adapter before Count and typed Item guards can run.
    $windows = (Invoke-WorkspaceComMethod $shell 'Windows' @())
    if ($null -ne $trace) { try { [void](& $trace 'collection') } catch { } }
    $useEnumerator = $env:WORKSPACE_REVEAL_ENUMERATOR -ceq '1'
    $candidates = $null
    if ($useEnumerator) { $candidates = Read-WorkspaceWindowEnumerator $windows }
    elseif ($null -eq $windows -or (Get-WorkspaceComProperty $windows 'Count') -isnot [int] -or (Get-WorkspaceComProperty $windows 'Count') -lt 0 -or (Get-WorkspaceComProperty $windows 'Count') -gt 256) {
        return @{ stage = 'property_unavailable' }
    }
    $owned = [Collections.Generic.List[object]]::new()
    for ($i = 0; $i -lt $(if ($useEnumerator) { $candidates.Length } else { Get-WorkspaceComProperty $windows 'Count' }); $i++) {
        if ($null -ne $trace) { try { [void](& $trace 'window_item') } catch { } }
        # IShellWindows::Item is DISPID 0 in the Windows SDK ExDisp.idl.
        # Invoke that same member without a GetIDsOfNames lookup.
        if ($useEnumerator) { $candidate = $candidates[$i] }
        else { $candidate = (Invoke-WorkspaceComMethod $windows '[DispID=0]' @($i) $trace) }
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
