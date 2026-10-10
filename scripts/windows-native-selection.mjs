import { execFile, spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { arch, release, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { closeDisposableFileManagerTarget, waitForFileManagerTarget } from "./file-manager-evidence.mjs";
import { inspectNativeView } from "./windows-native-view-diagnostics.mjs";

const bridgePath = fileURLToPath(new URL("./windows-native-selection.ps1", import.meta.url));
const maximumOutputBytes = 8192;
const selectionModes = ["electron_absolute", "relative_child", "zero_child"];
const signedHresult = (value) => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

export async function collectNativeSelectionMetadata({ env = process.env,
  readCodeRevision = () => promisify(execFile)("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot, timeout: 5000, maxBuffer: 1024, windowsHide: true,
  }),
} = {}) {
  let codeSha = null;
  try {
    const { stdout } = await readCodeRevision();
    if (typeof stdout === "string" && /^[a-f0-9]{40}\s*$/.test(stdout)) codeSha = stdout.trim();
  } catch { /* Unavailable revision is finite; no command output is retained. */ }
  const allowed = (value, values) => values.includes(value) ? value : null;
  const version = (value) => typeof value === "string" && /^\d{1,10}(?:\.\d{1,10}){1,3}$/.test(value) ? value : null;
  return {
    codeSha, platform: allowed(process.platform, ["win32", "darwin", "linux"]),
    architecture: allowed(arch(), ["x64", "arm64", "ia32"]), osRelease: version(release()),
    nodeVersion: version(process.versions.node),
    runner: {
      os: allowed(env.RUNNER_OS, ["Windows", "macOS", "Linux"]),
      architecture: allowed(env.RUNNER_ARCH, ["X64", "ARM64", "X86", "ARM"]),
      environment: allowed(env.RUNNER_ENVIRONMENT, ["github-hosted", "self-hosted"]),
      image: allowed(env.ImageOS, ["win19", "win22", "win25"]), imageVersion: version(env.ImageVersion),
    },
  };
}

// Return only validated scalar fields. Raw output, target paths, exception text
// and additional subprocess fields never become experiment evidence.
export function parseNativeSelectionResponse(stdout) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > maximumOutputBytes) return null;
  try {
    const value = JSON.parse(stdout);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const { version, mode, parentParseHresult, parentPidlAllocated, parentPidlCleanup,
      stage, exception, initializeHresult, parseHresult, selectionHresult,
      invocationCount, pidlAllocated, pidlCleanup, comCleanup } = value;
    const stages = ["input", "compile", "initialize", "parse_parent", "parse", "child", "select", "completed"];
    const cleanups = ["not_needed", "completed", "failed"];
    if (version !== 2 || !selectionModes.includes(mode) || typeof parentPidlAllocated !== "boolean" ||
      !cleanups.includes(parentPidlCleanup) || !stages.includes(stage) || typeof exception !== "boolean" ||
      ![initializeHresult, parentParseHresult, parseHresult, selectionHresult].every((code) => code === null || signedHresult(code)) ||
      ![0, 1].includes(invocationCount) || typeof pidlAllocated !== "boolean" ||
      ![pidlCleanup, comCleanup].every((cleanup) => cleanups.includes(cleanup))) return null;
    const initialized = initializeHresult !== null && initializeHresult >= 0;
    if ((pidlCleanup !== "not_needed") !== pidlAllocated || (comCleanup !== "not_needed") !== initialized) return null;
    if ((parentPidlCleanup !== "not_needed") !== parentPidlAllocated) return null;
    if (parentParseHresult !== null && !initialized) return null;
    if (["input", "compile", "initialize"].includes(stage) && (parentParseHresult !== null || parentPidlAllocated)) return null;
    if (["parse", "child", "select", "completed"].includes(stage) && (parentParseHresult !== 0 || !parentPidlAllocated)) return null;
    if (stage === "parse_parent" && (!initialized || parseHresult !== null || pidlAllocated ||
      selectionHresult !== null || invocationCount !== 0 ||
      (exception ? parentParseHresult !== null : parentParseHresult === null) ||
      (!exception && parentParseHresult === 0 && parentPidlAllocated))) return null;
    if (stage === "child" && (mode !== "relative_child" || parseHresult !== 0 || !pidlAllocated ||
      invocationCount !== 0 || selectionHresult !== null)) return null;
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
    return { version, mode, parentParseHresult, parentPidlAllocated, parentPidlCleanup,
      stage, exception, initializeHresult, parseHresult, selectionHresult,
      invocationCount, pidlAllocated, pidlCleanup, comCleanup };
  } catch { return null; }
}

// Internal bridge boundary. The experiment orchestrator will own the generated
// target; this module has no caller-target CLI and importing it does not dispatch.
export async function invokeNativeSelection(target, {
  platform = process.platform, mode = "zero_child", spawnProcess = spawn, env = process.env,
  clock = { setTimeout, clearTimeout },
} = {}) {
  const notStarted = (stage) => ({ status: "unavailable", stage, invocationCount: 0, native: null,
    process: { termination: "not_started", exitCode: null, signal: null, killAttempted: false } });
  if (!selectionModes.includes(mode)) return notStarted("mode");
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
      const parsed = stopReason || launchError ? null : parseNativeSelectionResponse(stdout);
      const native = parsed?.mode === mode ? parsed : null;
      const stage = stopReason ?? (launchError ? "launch_error" : exitCode !== 0 ? "process_error" : native ? native.stage : "protocol_error");
      resolve({ status: stage === "completed" && native?.pidlCleanup === "completed" && native?.parentPidlCleanup === "completed" && native?.comCleanup === "completed" ? "completed" : "failed",
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
        env: { ...env, WORKSPACE_NATIVE_SELECTION_TARGET: target, WORKSPACE_NATIVE_SELECTION_MODE: mode },
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

const filesystemCode = (error) => ["EACCES", "EPERM", "ENOENT", "ENOTEMPTY", "EEXIST", "EIO", "ENOSPC", "EBUSY"]
  .includes(error?.code) ? error.code : "filesystem_error";

// A fixed message and finite evidence replace exception/cause/subprocess text.
// Callers receive a rejection only after the evidence write has been awaited.
export class NativeSelectionExperimentError extends Error {
  constructor(evidence) {
    super("Windows native selection experiment failed");
    this.name = "NativeSelectionExperimentError";
    this.evidence = evidence;
  }
}

export async function removeOwnedFixture(root, target, targetCreated, filesystem, clock) {
  let deadline;
  // Never recursively delete: unexpected contents remain available for diagnosis.
  // A filesystem syscall cannot be cancelled; on timeout removal is unverified,
  // and the in-flight call may finish later. No subsequent removal is started.
  let expired = false;
  const timeout = new Promise((resolve) => {
    deadline = clock.setTimeout(() => {
      expired = true;
      resolve({ status: "unverified", code: "timeout" });
    }, 5000);
  });
  const removal = (async () => {
    try {
      if (targetCreated) await filesystem.rmdir(target);
      if (expired) return { status: "unverified", code: "timeout" };
      await filesystem.rmdir(root);
      return { status: "completed" };
    } catch (error) { return { status: "failed", code: filesystemCode(error) }; }
  })();
  try { return await Promise.race([removal, timeout]); }
  finally { clock.clearTimeout(deadline); }
}

// Own the only target internally. Options expose test seams and an artifact
// destination, never an externally supplied native target or executable script.
export async function runNativeSelectionExperiment({
  evidenceDirectory = fileURLToPath(new URL("../work/windows-native-selection-evidence/", import.meta.url)),
  platform = process.platform, filesystem = fs, spawnProcess = spawn, env = process.env,
  clock = { setTimeout, clearTimeout }, runCommand, timing, readCodeRevision,
  mode = env.WORKSPACE_NATIVE_SELECTION_MODE ?? "zero_child",
  terminalDiagnostics = env.WORKSPACE_NATIVE_VIEW_DIAGNOSTIC === "1",
} = {}) {
  const evidence = {
    version: 2, mode: selectionModes.includes(mode) ? mode : null,
    source: "os_native_call_form", parser: "SHParseDisplayName", apartment: "STA",
    status: "failed", failure: null,
    metadata: await collectNativeSelectionMetadata({ env, readCodeRevision }),
    fixture: { status: "not_attempted", rootCreated: false, targetCreated: false },
    native: { status: "not_attempted", invocationCount: 0, native: null,
      process: { termination: "not_started", exitCode: null, signal: null, killAttempted: false } },
    observation: { status: "not_attempted" },
    terminalView: { status: "not_attempted", phase: "after_negative_verdict", deadlineMs: 5000 },
    windowCleanup: { status: "not_attempted", closure: "unverified", unselectedParentMayRemain: true },
    fixtureRemoval: { status: "not_needed" }, persistence: { status: "not_attempted" },
  };
  const fail = (stage, code) => { evidence.failure ??= { stage, code }; };
  if (!selectionModes.includes(mode)) fail("mode", "unsupported");
  if (terminalDiagnostics && mode !== "electron_absolute") fail("terminal_configuration", "unsupported");
  if (!evidence.metadata.codeSha) fail("metadata", "revision_unavailable");
  let root, target;
  // Until a returned bridge result proves otherwise, cleanup must assume an
  // owned subprocess could still be alive. Unexpected bridge errors are finite.
  let terminationKnown = true;
  if (platform !== "win32") {
    fail("host", "unsupported");
  } else if (!evidence.failure) {
    try {
      root = await filesystem.mkdtemp(join(tmpdir(), "workspace-native-selection-"));
      evidence.fixture.rootCreated = true;
      target = join(root, "Native selection 日本語");
      await filesystem.mkdir(target);
      evidence.fixture.targetCreated = true;
      evidence.fixture.status = "completed";
    } catch (error) {
      evidence.fixture.status = "failed";
      evidence.fixture.code = filesystemCode(error);
      fail("fixture", evidence.fixture.code);
    }
    if (!evidence.failure) {
      terminationKnown = false;
      try {
        evidence.native = await invokeNativeSelection(target, { platform, mode, spawnProcess, env, clock });
        terminationKnown = ["confirmed", "not_started"].includes(evidence.native.process.termination);
        if (evidence.native.status !== "completed") fail("native", evidence.native.stage);
      } catch {
        evidence.native = { status: "failed", stage: "bridge_error", invocationCount: null, native: null,
          process: { termination: "unknown", exitCode: null, signal: null, killAttempted: null } };
        fail("native", "bridge_error");
      }
      // Observe even an unknown invocation count after confirmed termination:
      // this can preserve useful evidence but cannot rescue a failed dispatch.
      if (evidence.native?.process.termination === "confirmed" && evidence.native.invocationCount !== 0) {
        try {
          evidence.observation = await waitForFileManagerTarget(target, platform, runCommand, timing);
          if (evidence.observation.status !== "passed" || evidence.observation.exactTargetObserved !== true) {
            fail("observation", evidence.observation.completion);
          }
        } catch {
          evidence.observation = { status: "unavailable", completion: "observer_error" };
          fail("observation", "observer_error");
        }
        // This is new post-verdict evidence, never a retry or an extension of
        // strict selection acceptance. Late selected=true cannot clear failure.
        if (terminalDiagnostics && evidence.observation.completion === "deadline" &&
          Number.isFinite(evidence.observation.elapsedMs) && evidence.observation.elapsedMs >= 10000) {
          try {
            const terminal = await inspectNativeView(target, { platform, spawnProcess, env, clock });
            evidence.terminalView = { ...evidence.terminalView, ...terminal };
            terminationKnown = ["confirmed", "not_started"].includes(terminal.process.termination);
          } catch {
            terminationKnown = false;
            evidence.terminalView = { ...evidence.terminalView, status: "unavailable", stage: "bridge_error",
              diagnostic: null, process: { termination: "unknown", killAttempted: null } };
          }
        }
        try {
          const cleanup = terminationKnown ? await closeDisposableFileManagerTarget(target, platform, runCommand) : null;
          // The helper cannot confirm closure and its failure reason may contain
          // arbitrary OS error.code text. Retain only its finite status here.
          evidence.windowCleanup.status = !cleanup ? "not_attempted" : cleanup.status === "completed" ? "completed" : "failed";
        } catch { evidence.windowCleanup.status = "failed"; }
        if (evidence.windowCleanup.status === "failed") {
          evidence.windowCleanup.code = "cleanup_unavailable";
          fail("window_cleanup", "cleanup_unavailable");
        }
      }
    }
    if (root) {
      evidence.fixtureRemoval = terminationKnown
        ? await removeOwnedFixture(root, target, evidence.fixture.targetCreated, filesystem, clock)
        : { status: "unverified", code: "process_termination_unknown" };
      if (evidence.fixtureRemoval.status !== "completed") fail("fixture_removal", evidence.fixtureRemoval.code);
    }
  }
  evidence.status = evidence.failure ? "failed" : "passed";
  try {
    await filesystem.mkdir(evidenceDirectory, { recursive: true });
    evidence.persistence.status = "completed";
    await filesystem.writeFile(join(evidenceDirectory, "result.json"), JSON.stringify(evidence, null, 2) + "\n", "utf8");
  } catch {
    evidence.persistence.status = "failed";
    fail("evidence", "persistence_error");
    evidence.status = "failed";
  }
  if (evidence.status !== "passed") throw new NativeSelectionExperimentError(evidence);
  return evidence;
}

// CLI accepts no target, script or output-path arguments. Exceptions and raw
// subprocess output stay out of both streams; detailed finite results are on disk.
export async function runNativeSelectionCli({ args = process.argv.slice(2),
  stdout = process.stdout, stderr = process.stderr, experiment = runNativeSelectionExperiment,
} = {}) {
  if (args.length !== 0) {
    stderr.write("Windows native selection experiment failed (arguments).\n");
    return 1;
  }
  try {
    await experiment();
    stdout.write("Windows native selection experiment passed.\n");
    return 0;
  } catch {
    stderr.write("Windows native selection experiment failed.\n");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runNativeSelectionCli();
}
