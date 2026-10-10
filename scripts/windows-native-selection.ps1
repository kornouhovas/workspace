$ErrorActionPreference = 'Stop'

# Fixed source only. The target is environment data, never C#/PowerShell text.
# Native contracts: Microsoft SHOpenFolderAndSelectItems, SHParseDisplayName,
# CoInitializeEx and ILFree/CoTaskMemFree documentation linked in the plan.
$bridgeSource = @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

namespace WorkspaceNativeSelection {
    public sealed class Result {
        public int version = 2;
        public string mode;
        public int? parentParseHresult;
        public bool parentPidlAllocated = false;
        public string parentPidlCleanup = "not_needed";
        public string stage = "input";
        public bool exception = false;
        public int? initializeHresult;
        public int? parseHresult;
        public int? selectionHresult;
        // Counts selection attempts, including a call that throws. A count alone
        // is not proof of native success or of observed Explorer selection.
        public int invocationCount = 0;
        public bool pidlAllocated = false;
        public string pidlCleanup = "not_needed";
        public string comCleanup = "not_needed";
    }

    public delegate int ParseCall(string name, IntPtr context, out IntPtr pidl,
        uint requestedAttributes, out uint attributes);

    // Tests supply controlled delegates to the same compiled worker. Production
    // has no environment/CLI switch that substitutes native implementations.
    public sealed class NativeCalls {
        public Func<IntPtr, uint, int> Initialize;
        public ParseCall Parse;
        public Func<IntPtr, uint, IntPtr[], uint, int> Select;
        public Func<IntPtr, IntPtr> LastId;
        public Action<IntPtr> Free;
        public Action Uninitialize;

        public static NativeCalls SystemCalls() {
            return new NativeCalls {
                Initialize = Native.CoInitializeEx,
                Parse = Native.SHParseDisplayName,
                Select = Native.SHOpenFolderAndSelectItems,
                LastId = Native.ILFindLastID,
                Free = Native.CoTaskMemFree,
                Uninitialize = Native.CoUninitialize
            };
        }
    }

    internal static class Native {
        [DllImport("ole32.dll", ExactSpelling = true, PreserveSig = true)]
        internal static extern int CoInitializeEx(IntPtr reserved, uint flags);
        [DllImport("ole32.dll", ExactSpelling = true)]
        internal static extern void CoUninitialize();
        [DllImport("ole32.dll", ExactSpelling = true)]
        internal static extern void CoTaskMemFree(IntPtr pidl);
        [DllImport("shell32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, PreserveSig = true)]
        internal static extern int SHParseDisplayName(
            [MarshalAs(UnmanagedType.LPWStr)] string name, IntPtr context,
            out IntPtr pidl, uint requestedAttributes, out uint attributes);
        [DllImport("shell32.dll", ExactSpelling = true, PreserveSig = true)]
        internal static extern int SHOpenFolderAndSelectItems(
            IntPtr absoluteTarget, uint count,
            [In, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 1)] IntPtr[] children, uint flags);
        [DllImport("shell32.dll", ExactSpelling = true)]
        internal static extern IntPtr ILFindLastID(IntPtr pidl);
    }

    public static class Bridge {
        public static Result Run(string target, string mode) {
            return Run(target, mode, NativeCalls.SystemCalls());
        }

        public static Result Run(string target, string mode, NativeCalls calls) {
            var result = new Result();
            if (mode != "electron_absolute" && mode != "relative_child" && mode != "zero_child") return result;
            result.mode = mode;
            if (String.IsNullOrEmpty(target) || target.IndexOf('\0') >= 0) return result;
            string parent;
            try { parent = Path.GetDirectoryName(target); } catch { return result; }
            if (String.IsNullOrEmpty(parent)) return result;
            // All native operations and cleanup run on this same dedicated STA.
            var worker = new Thread(delegate() { Execute(parent, target, mode, calls, result); });
            worker.IsBackground = true;
            worker.SetApartmentState(ApartmentState.STA);
            worker.Start();
            worker.Join(); // Node bounds the entire owned process, including Add-Type.
            return result;
        }

        private static void Execute(string parent, string target, string mode, NativeCalls calls, Result result) {
            IntPtr pidl = IntPtr.Zero, parentPidl = IntPtr.Zero;
            bool initialized = false;
            try {
                result.stage = "initialize";
                result.initializeHresult = calls.Initialize(IntPtr.Zero, 2); // COINIT_APARTMENTTHREADED
                initialized = result.initializeHresult.Value >= 0;
                if (!initialized) return; // Includes RPC_E_CHANGED_MODE: no parse/select/uninitialize.

                // Matched preparation for all conditions, including zero_child.
                result.stage = "parse_parent";
                uint attributes;
                result.parentParseHresult = calls.Parse(parent, IntPtr.Zero, out parentPidl, 0, out attributes);
                if (result.parentParseHresult.Value != 0 || parentPidl == IntPtr.Zero) return;

                result.stage = "parse";
                result.parseHresult = calls.Parse(target, IntPtr.Zero, out pidl, 0, out attributes);
                if (result.parseHresult.Value != 0 || pidl == IntPtr.Zero) return;

                IntPtr child = pidl;
                if (mode == "relative_child") {
                    result.stage = "child";
                    child = calls.LastId(pidl); // Borrowed interior storage; never separately freed.
                    if (child == IntPtr.Zero) return;
                }
                var children = mode == "zero_child" ? null : new IntPtr[] { child };
                result.stage = "select";
                result.invocationCount++;
                // Exactly one call. The managed pointer array lives through P/Invoke;
                // both owned PIDLs remain alive until finally. No fallback or retry.
                result.selectionHresult = calls.Select(mode == "zero_child" ? pidl : parentPidl,
                    mode == "zero_child" ? 0U : 1U, children, 0);
                if (result.selectionHresult.Value == 0) result.stage = "completed";
            } catch {
                result.exception = true; // Never export exception messages or paths.
            } finally {
                result.pidlAllocated = pidl != IntPtr.Zero;
                if (result.pidlAllocated) {
                    result.pidlCleanup = "failed";
                    try { calls.Free(pidl); result.pidlCleanup = "completed"; } catch { }
                }
                result.parentPidlAllocated = parentPidl != IntPtr.Zero;
                if (result.parentPidlAllocated) {
                    result.parentPidlCleanup = "failed";
                    try { calls.Free(parentPidl); result.parentPidlCleanup = "completed"; } catch { }
                }
                if (initialized) {
                    result.comCleanup = "failed";
                    try { calls.Uninitialize(); result.comCleanup = "completed"; } catch { }
                }
            }
        }
    }
}
'@

try {
    Add-Type -TypeDefinition $bridgeSource
} catch {
    # Compilation precedes any worker/native call. Do not emit compiler output.
    [ordered]@{ version = 2; mode = $env:WORKSPACE_NATIVE_SELECTION_MODE; stage = 'compile'; exception = $true;
        parentParseHresult = $null; parentPidlAllocated = $false; parentPidlCleanup = 'not_needed';
        initializeHresult = $null; parseHresult = $null; selectionHresult = $null;
        invocationCount = 0; pidlAllocated = $false; pidlCleanup = 'not_needed'; comCleanup = 'not_needed'
    } | ConvertTo-Json -Compress
    exit 0
}
try {
    $result = [WorkspaceNativeSelection.Bridge]::Run($env:WORKSPACE_NATIVE_SELECTION_TARGET, $env:WORKSPACE_NATIVE_SELECTION_MODE)
    $result | ConvertTo-Json -Compress
} catch {
    # A worker/serialization failure cannot establish an invocation count.
    # Missing protocol is deliberately unknown in the Node owner.
    exit 1
}
