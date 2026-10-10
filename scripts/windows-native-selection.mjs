import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const bridgePath = fileURLToPath(new URL("./windows-native-selection.ps1", import.meta.url));
const maximumOutputBytes = 8192;
const signedHresult = (value) => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;

// Return only validated scalar fields. Raw output, target paths, exception text
// and additional subprocess fields never become experiment evidence.
export function parseNativeSelectionResponse(stdout) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > maximumOutputBytes) return null;
  try {
    const value = JSON.parse(stdout);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const { version, stage, exception, initializeHresult, parseHresult, selectionHresult,
      invocationCount, pidlAllocated, pidlCleanup, comCleanup } = value;
    const stages = ["input", "compile", "initialize", "parse", "select", "completed"];
    const cleanups = ["not_needed", "completed", "failed"];
    if (version !== 1 || !stages.includes(stage) || typeof exception !== "boolean" ||
      ![initializeHresult, parseHresult, selectionHresult].every((code) => code === null || signedHresult(code)) ||
      ![0, 1].includes(invocationCount) || typeof pidlAllocated !== "boolean" ||
      ![pidlCleanup, comCleanup].every((cleanup) => cleanups.includes(cleanup))) return null;
    const initialized = initializeHresult !== null && initializeHresult >= 0;
    if ((pidlCleanup !== "not_needed") !== pidlAllocated || (comCleanup !== "not_needed") !== initialized) return null;
    if (parseHresult !== null && !initialized) return null;
    if (invocationCount === 1 && (!initialized || parseHresult !== 0 || !pidlAllocated)) return null;
    if (selectionHresult !== null && invocationCount !== 1) return null;
    if (["input", "compile"].includes(stage) && (initializeHresult !== null || parseHresult !== null ||
      selectionHresult !== null || invocationCount !== 0 || pidlAllocated)) return null;
    if (stage === "input" && exception) return null;
    if (stage === "compile" && !exception) return null;
    if (stage === "initialize" && (initialized || parseHresult !== null || selectionHresult !== null ||
      invocationCount !== 0 || pidlAllocated || (exception ? initializeHresult !== null : initializeHresult === null))) return null;
    if (stage === "parse" && (!initialized || selectionHresult !== null || invocationCount !== 0 ||
      (exception ? parseHresult !== null : parseHresult === null) || (!exception && parseHresult === 0 && pidlAllocated))) return null;
    if (stage === "select" && (invocationCount !== 1 ||
      (exception ? selectionHresult !== null : selectionHresult === null || selectionHresult === 0))) return null;
    if (stage === "completed" && (exception || invocationCount !== 1 || selectionHresult !== 0)) return null;
    return { version, stage, exception, initializeHresult, parseHresult, selectionHresult,
      invocationCount, pidlAllocated, pidlCleanup, comCleanup };
  } catch { return null; }
}

// Internal bridge boundary. The experiment orchestrator will own the generated
// target; this module has no caller-target CLI and importing it does not dispatch.
export async function invokeNativeSelection(target, {
  platform = process.platform, spawnProcess = spawn, env = process.env,
  clock = { setTimeout, clearTimeout },
} = {}) {
  const notStarted = (stage) => ({ status: "unavailable", stage, invocationCount: 0, native: null,
    process: { termination: "not_started", exitCode: null, signal: null, killAttempted: false } });
  if (platform !== "win32") return notStarted("unsupported");
  if (typeof target !== "string" || !target || target.includes("\0")) return notStarted("input");

  return new Promise((resolve) => {
    let child, deadline, terminationDeadline, settled = false, stopReason = null, launchError = false;
    let stdout = "", outputBytes = 0, killAttempted = false;
    const finish = (termination, exitCode = null, signal = null) => {
      if (settled) return;
      settled = true;
      clock.clearTimeout(deadline);
      clock.clearTimeout(terminationDeadline);
      if (termination === "unknown") {
        // Permit evidence persistence and caller failure even if the OS never
        // confirms the kill. This does not turn unknown termination into cleanup.
        child.unref();
        child.stdout.destroy();
      }
      const native = stopReason || launchError ? null : parseNativeSelectionResponse(stdout);
      const stage = stopReason ?? (launchError ? "launch_error" : exitCode !== 0 ? "process_error" : native ? native.stage : "protocol_error");
      resolve({ status: stage === "completed" && native?.pidlCleanup === "completed" && native?.comCleanup === "completed" ? "completed" : "failed",
        stage, invocationCount: native?.invocationCount ?? null, native,
        process: { termination, exitCode: signedHresult(exitCode) ? exitCode : null,
          signal: ["SIGKILL", "SIGTERM"].includes(signal) ? signal : null, killAttempted } });
    };
    const stop = (reason) => {
      if (settled || stopReason) return;
      stopReason = reason;
      killAttempted = true;
      // A successful kill request is not proof of termination. Only close proves
      // the process and its stdio closed; bound that wait and otherwise say unknown.
      terminationDeadline = clock.setTimeout(() => finish("unknown"), 1000);
      try { child.kill("SIGKILL"); } catch { /* Unknown until close. */ }
    };
    // Starts before spawn, so process startup and Add-Type compilation consume
    // the same 30-second budget. There is no retry after any outcome.
    deadline = clock.setTimeout(() => stop("timeout"), 30000);
    try {
      child = spawnProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", bridgePath], {
        windowsHide: true, shell: false, stdio: ["ignore", "pipe", "ignore"],
        env: { ...env, WORKSPACE_NATIVE_SELECTION_TARGET: target },
      });
    } catch {
      clock.clearTimeout(deadline);
      settled = true;
      resolve(notStarted("launch_error"));
      return;
    }
    child.on("error", () => { launchError = true; });
    child.on("close", (code, signal) => finish("confirmed", code, signal));
    child.stdout.on("error", () => stop("output_error"));
    child.stdout.on("data", (chunk) => {
      if (settled || stopReason) return;
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > maximumOutputBytes) { stdout = ""; stop("output_limit"); return; }
      // The bridge emits ASCII-only JSON scalars, so multibyte chunk boundaries
      // cannot corrupt any permitted protocol value.
      stdout += chunk.toString();
    });
  });
}
