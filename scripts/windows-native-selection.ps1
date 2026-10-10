$ErrorActionPreference = 'Stop'

# Fixed source only. The target is environment data, never C#/PowerShell text.
# Native contracts: Microsoft SHOpenFolderAndSelectItems, SHParseDisplayName,
# CoInitializeEx and ILFree/CoTaskMemFree documentation linked in the plan.
$bridgeSource = @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

namespace WorkspaceNativeSelection {
    public sealed class Result {
        public int version = 1;
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
        public Func<IntPtr, uint, IntPtr, uint, int> Select;
        public Action<IntPtr> Free;
        public Action Uninitialize;

        public static NativeCalls SystemCalls() {
            return new NativeCalls {
                Initialize = Native.CoInitializeEx,
                Parse = Native.SHParseDisplayName,
                Select = Native.SHOpenFolderAndSelectItems,
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
            IntPtr absoluteTarget, uint count, IntPtr children, uint flags);
    }

    public static class Bridge {
        public static Result Run(string target) {
            return Run(target, NativeCalls.SystemCalls());
        }

        public static Result Run(string target, NativeCalls calls) {
            var result = new Result();
            if (String.IsNullOrEmpty(target) || target.IndexOf('\0') >= 0) return result;
            // All native operations and cleanup run on this same dedicated STA.
            var worker = new Thread(delegate() { Execute(target, calls, result); });
            worker.IsBackground = true;
            worker.SetApartmentState(ApartmentState.STA);
            worker.Start();
            worker.Join(); // Node bounds the entire owned process, including Add-Type.
            return result;
        }

        private static void Execute(string target, NativeCalls calls, Result result) {
            IntPtr pidl = IntPtr.Zero;
            bool initialized = false;
            try {
                result.stage = "initialize";
                result.initializeHresult = calls.Initialize(IntPtr.Zero, 2); // COINIT_APARTMENTTHREADED
                initialized = result.initializeHresult.Value >= 0;
                if (!initialized) return; // Includes RPC_E_CHANGED_MODE: no parse/select/uninitialize.

                result.stage = "parse";
                uint attributes;
                result.parseHresult = calls.Parse(target, IntPtr.Zero, out pidl, 0, out attributes);
                if (result.parseHresult.Value != 0 || pidl == IntPtr.Zero) return;

                result.stage = "select";
                result.invocationCount++;
                // The documented single-item form opens the parent and selects
                // absoluteTarget. No child array, flags, fallback or second call.
                result.selectionHresult = calls.Select(pidl, 0, IntPtr.Zero, 0);
                if (result.selectionHresult.Value == 0) result.stage = "completed";
            } catch {
                result.exception = true; // Never export exception messages or paths.
            } finally {
                result.pidlAllocated = pidl != IntPtr.Zero;
                if (result.pidlAllocated) {
                    result.pidlCleanup = "failed";
                    try { calls.Free(pidl); result.pidlCleanup = "completed"; } catch { }
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
    [ordered]@{ version = 1; stage = 'compile'; exception = $true;
        initializeHresult = $null; parseHresult = $null; selectionHresult = $null;
        invocationCount = 0; pidlAllocated = $false; pidlCleanup = 'not_needed'; comCleanup = 'not_needed'
    } | ConvertTo-Json -Compress
    exit 0
}
try {
    $result = [WorkspaceNativeSelection.Bridge]::Run($env:WORKSPACE_NATIVE_SELECTION_TARGET)
    $result | ConvertTo-Json -Compress
} catch {
    # A worker/serialization failure cannot establish an invocation count.
    # Missing protocol is deliberately unknown in the Node owner.
    exit 1
}
