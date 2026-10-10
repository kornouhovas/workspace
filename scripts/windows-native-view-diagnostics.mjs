import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./windows-native-view-diagnostics.ps1", import.meta.url));
const flags = ["comBusy", "comVisible", "windowVisible", "windowMinimized", "windowForeground",
  "viewEnabled", "viewOffscreen", "viewBoundsNonempty", "itemEnabled", "itemOffscreen",
  "itemBoundsNonempty", "itemKeyboardFocus", "itemSelected"];
const stages = ["observed", "parent_absent", "ambiguous_parent", "target_absent", "wrong_window",
  "ambiguous_view", "ambiguous_target", "view_changed", "property_unavailable", "read_error"];

export function parseNativeViewResponse(stdout) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > 8192) return null;
  try {
    const value = JSON.parse(stdout);
    if (value?.version !== 1 || !stages.includes(value.stage)) return null;
    const { stage, code, snapshot } = value;
    if (stage === "read_error" ? !Number.isInteger(code) || code < -2147483648 || code > 2147483647 : code !== null) return null;
    if (stage !== "observed") return snapshot === null ? { version: 1, stage, snapshot: null, code } : null;
    if (!snapshot || !flags.every((flag) => typeof snapshot[flag] === "boolean") ||
      ![0, 1, 2, 3, 4].includes(snapshot.readyState)) return null;
    return { version: 1, stage, snapshot: { ...Object.fromEntries(flags.map((flag) => [flag, snapshot[flag]])),
      readyState: snapshot.readyState }, code };
  } catch { return null; }
}

// Read-only and strictly post-verdict. A late selected state is diagnostic data;
// this module cannot return acceptance or dispatch another selection.
export async function inspectNativeView(target, { platform = process.platform,
  spawnProcess = spawn, env = process.env, clock = { setTimeout, clearTimeout } } = {}) {
  const unavailable = (stage) => ({ status: "unavailable", stage, diagnostic: null,
    process: { termination: "not_started", killAttempted: false } });
  if (platform !== "win32") return unavailable("unsupported");
  if (typeof target !== "string" || !target || target.includes("\0")) return unavailable("input");
  return new Promise((resolve) => {
    let child, deadline, terminationDeadline, done = false, stopped = null, launchError = false;
    let output = "", bytes = 0, killAttempted = false;
    const finish = (termination, code) => {
      if (done) return;
      done = true;
      clock.clearTimeout(deadline); clock.clearTimeout(terminationDeadline);
      if (termination === "unknown") { child.unref(); child.stdout.destroy(); }
      const diagnostic = stopped || launchError || code !== 0 ? null : parseNativeViewResponse(output);
      const stage = stopped ?? (launchError ? "launch_error" : code !== 0 ? "process_error" : diagnostic?.stage ?? "protocol_error");
      resolve({ status: stage === "observed" ? "observed" : "unavailable", stage, diagnostic,
        process: { termination, killAttempted } });
    };
    const stop = (reason) => {
      if (done || stopped) return;
      stopped = reason; killAttempted = true;
      terminationDeadline = clock.setTimeout(() => finish("unknown"), 1000);
      try { child.kill("SIGKILL"); } catch { /* Only close confirms termination. */ }
    };
    deadline = clock.setTimeout(() => stop("timeout"), 5000);
    try {
      child = spawnProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", scriptPath], {
        windowsHide: true, shell: false, stdio: ["ignore", "pipe", "ignore"],
        env: { ...env, WORKSPACE_OBSERVE_TARGET: target },
      });
    } catch { clock.clearTimeout(deadline); resolve(unavailable("launch_error")); return; }
    child.on("error", () => { launchError = true; });
    child.on("close", (code) => finish("confirmed", code));
    child.stdout.on("error", () => stop("output_error"));
    child.stdout.on("data", (chunk) => {
      if (done || stopped) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > 8192) { output = ""; stop("output_limit"); return; }
      output += chunk.toString(); // The fixed protocol contains only ASCII scalars.
    });
  });
}
