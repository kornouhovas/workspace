$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ge 7) {
    Import-Module "$PSHOME/Modules/Microsoft.PowerShell.Utility/Microsoft.PowerShell.Utility.psd1"
}
. "$PSScriptRoot/../../src/desktop/native/windows-binding.ps1"
Initialize-WorkspaceNativeBinding
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
// SDK MsXml6.h IXMLDOMNodeList: preserve IDispatch and four node-list slots.
// Call only typed get__newEnum so .NET Framework cannot apply its automatic
// DISPID_NEWENUM IEnumerator view before the IEnumVARIANT control sees it.
[ComImport, Guid("2933BF82-7B36-11D2-B20E-00C04F983E60"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface WindowEnumeratorXmlNodeList {
    [PreserveSig] int GetTypeInfoCount(out uint count);
    [PreserveSig] int GetTypeInfo(uint index, uint locale, out IntPtr info);
    [PreserveSig] int GetIDsOfNames(ref Guid id, IntPtr names, uint count, uint locale, IntPtr ids);
    [PreserveSig] int Invoke(int member, ref Guid id, uint locale, ushort flags,
        IntPtr arguments, IntPtr result, IntPtr exception, IntPtr argumentError);
    [PreserveSig] int GetItem(int index, out IntPtr node);
    [PreserveSig] int GetLength(out int length);
    [PreserveSig] int NextNode(out IntPtr node);
    [PreserveSig] int Reset();
    [PreserveSig] int NewEnum([Out, MarshalAs(UnmanagedType.IUnknown)] out object enumerator);
}
public sealed class WindowEnumeratorControl : IEnumVARIANT {
    public object[] Values;
    public string Mode;
    public int Calls;
    public int Next(int count, object[] values, IntPtr fetched) {
        if (count != 1 || values.Length != 1 || fetched != IntPtr.Zero) throw new Exception("next_contract");
        int index = Calls++;
        if (Mode == "error") return unchecked((int)0x80004005);
        if (Mode == "bad_status") return 2;
        if (Mode == "false_value") { values[0] = Values[0]; return 1; }
        if (index == Values.Length) return 1;
        values[0] = Values[index]; return 0;
    }
    public int Skip(int count) { throw new NotSupportedException(); }
    public int Reset() { throw new NotSupportedException(); }
    public IEnumVARIANT Clone() { throw new NotSupportedException(); }
}
public sealed class WindowEnumeratorReceipt {
    public string mode;
    public bool accepted, opaque, exactIdentity;
    public int nextCalls, afterCalls, length;
}
public static class WindowEnumeratorControls {
    public static Array CollectGenuine(MethodInfo collect, object value, int count, Func<int> after) {
        while (value is System.Management.Automation.PSObject)
            value = ((System.Management.Automation.PSObject)value).BaseObject;
        object enumerator;
        if (((WindowEnumeratorXmlNodeList)value).NewEnum(out enumerator) != 0 || enumerator == null || !Marshal.IsComObject(enumerator))
            throw new InvalidOperationException();
        return (Array)collect.Invoke(null, new object[] { (IEnumVARIANT)enumerator, count, after });
    }
    public static WindowEnumeratorReceipt[] Run(MethodInfo collect, bool portable) {
        object[] pool = new object[257];
        if (!portable) for (int i = 0; i < pool.Length; i++)
            pool[i] = Activator.CreateInstance(Type.GetTypeFromProgID("Scripting.Dictionary", true));
        string[] modes = portable ? new string[] { "empty", "negative", "oversize", "null", "non_com", "error", "bad_status" } :
            new string[] { "empty", "single", "multiple", "maximum", "negative", "oversize", "short", "extra", "duplicate", "null", "non_com", "error", "bad_status", "false_value", "changed_count", "after_throw", "overrun" };
        var reports = new List<WindowEnumeratorReceipt>();
        foreach (string mode in modes) {
            int count = mode == "empty" ? 0 : mode == "multiple" || mode == "short" || mode == "duplicate" ? 2 :
                mode == "maximum" || mode == "overrun" ? 256 : mode == "negative" ? -1 : mode == "oversize" ? 257 : 1;
            int size = mode == "empty" ? 0 : mode == "multiple" || mode == "extra" || mode == "duplicate" ? 2 :
                mode == "maximum" ? 256 : mode == "overrun" ? 257 : 1;
            var values = new object[size];
            for (int i = 0; i < size; i++) values[i] = pool[i];
            if (mode == "duplicate") values[1] = values[0];
            if (mode == "null") values[0] = null;
            if (mode == "non_com") values[0] = new object();
            var sequence = new WindowEnumeratorControl { Values = values, Mode = mode };
            var receipt = new WindowEnumeratorReceipt { mode = mode, length = -1 };
            Func<int> after = delegate {
                receipt.afterCalls++;
                if (mode == "after_throw") throw new InvalidOperationException();
                return mode == "changed_count" ? count + 1 : count;
            };
            try {
                var result = (Array)collect.Invoke(null, new object[] { sequence, count, after });
                receipt.accepted = true; receipt.length = result.Length;
                receipt.opaque = result.GetType().GetElementType().Name == "WorkspaceReadyComReference";
                receipt.exactIdentity = true;
                for (int i = 0; i < result.Length; i++) {
                    object holder = result.GetValue(i);
                    receipt.opaque &= holder != null && !Marshal.IsComObject(holder);
                    object raw = holder.GetType().GetField("Value", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(holder);
                    IntPtr a = Marshal.GetIUnknownForObject(raw), b = IntPtr.Zero;
                    try { b = Marshal.GetIUnknownForObject(values[i]); receipt.exactIdentity &= a == b; }
                    finally { if (b != IntPtr.Zero) Marshal.Release(b); Marshal.Release(a); }
                }
            } catch (TargetInvocationException) { }
            receipt.nextCalls = sequence.Calls;
            reports.Add(receipt);
        }
        // All genuine RCWs remain scoped to this owned, short-lived control process.
        return reports.ToArray();
    }
}
'@
$collect = [WorkspaceReadyCom].GetMethod('CollectWindowEnumerator', [Reflection.BindingFlags]'NonPublic,Static')
$reports = [WindowEnumeratorControls]::Run($collect, $env:WORKSPACE_ENUM_PORTABLE -ceq '1')
$realReports = [Collections.Generic.List[object]]::new()
if ($env:WORKSPACE_ENUM_PORTABLE -cne '1') {
    # Genuine IEnumVARIANT positive marshaling without opening/warming Explorer UI.
    # Parse fixed local XML only; no documents, paths or network inputs are loaded.
    foreach ($shape in @('empty','single','multiple')) {
        $document = New-Object -ComObject Msxml2.DOMDocument.6.0
        $xml = $(if ($shape -ceq 'empty') { '<root/>' } elseif ($shape -ceq 'single') { '<root><a/></root>' } else { '<root><a/><b/></root>' })
        if ([WorkspaceReadyCom]::Call($document, 'loadXML', [object[]]@($xml)) -cne $true) { throw 'xml_control' }
        $items = [WorkspaceReadyCom]::Call($document, 'selectNodes', [object[]]@('/root/*'))
        $raw = $items.GetType().GetField('Value', [Reflection.BindingFlags]'Instance,NonPublic').GetValue($items)
        $reflectionView = $raw.GetType().InvokeMember('[DispID=-4]', [Reflection.BindingFlags]::GetProperty, $null, $raw, $null)
        $formerCastRejected = $reflectionView -is [Collections.IEnumerator] -and $reflectionView -isnot [Runtime.InteropServices.ComTypes.IEnumVARIANT]
        if (-not $formerCastRejected) { throw 'missing_reflection_counterexample' }
        $count = [WorkspaceReadyCom]::Read($items, 'length')
        $counter = [Func[int]]{ [WorkspaceReadyCom]::Read($items, 'length') }
        $collected = [WindowEnumeratorControls]::CollectGenuine($collect, $raw, $count, $counter)
        $expected = @()
        if ($shape -ceq 'single') { $expected = @('a') }
        elseif ($shape -ceq 'multiple') { $expected = @('a','b') }
        $names = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        $opaque = $true
        foreach ($entry in $collected) {
            $opaque = $opaque -and $entry -is [WorkspaceReadyComReference] -and -not [Runtime.InteropServices.Marshal]::IsComObject($entry)
            if (-not $names.Add([WorkspaceReadyCom]::Read($entry, 'nodeName'))) { throw 'duplicate_node' }
        }
        if ($collected -isnot [Array] -or $names.Count -ne $expected.Length -or $collected.Length -ne $expected.Length) { throw 'node_count' }
        foreach ($name in $expected) { if (-not $names.Contains($name)) { throw 'node_identity' } }
        $realReports.Add([ordered]@{ mode = $shape; count = $collected.Length; opaque = $opaque; exactNames = $true; formerCastRejected = $formerCastRejected })
    }
}
[ordered]@{ controlled = $reports; genuine = $realReports.ToArray() } | ConvertTo-Json -Depth 4 -Compress
