import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, win32 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { closeDisposableFileManagerTarget, waitForFileManagerTarget } from "./file-manager-evidence.mjs";
import { explorerSelectionArgument, resolveSystemExplorer } from "./windows-explorer-selection.mjs";
import { collectNativeSelectionMetadata, removeOwnedFixture } from "./windows-native-selection.mjs";

const bridgePath = fileURLToPath(new URL("./windows-ready-selection.ps1", import.meta.url));
const maximumOutputBytes = 8192;
const signedInteger = (value) => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
const finiteTime = (value) => Number.isFinite(value) && value >= 0 && value <= 60000;
const filesystemCode = (error) => ["EACCES", "EPERM", "ENOENT", "ENOTEMPTY", "EEXIST", "EIO", "ENOSPC", "EBUSY"]
  .includes(error?.code) ? error.code : "filesystem_error";

// Only finite diagnostic scalars survive this boundary, never COM identities,
// target paths, process IDs, exception messages or additional bridge properties.
export function parseReadySelectionResponse(stdout) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > maximumOutputBytes) return null;
  try {
    const value = JSON.parse(stdout);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const { version, stage, deadlineMs, navigationCount, navigationCompleted, selectionCount,
      selectionCompleted, readinessAttempts, confirmationAttempts, readyMs, selectionMs,
      elapsedMs, selected, code } = value;
    const stages = ["input", "setup_error", "navigation_error", "parent_absent", "ambiguous_parent",
      "target_absent", "wrong_window", "ambiguous_tabs", "property_unavailable", "view_changed",
      "unready", "read_error", "selection_error", "deadline", "iteration_limit", "selected"];
    const errorStages = ["setup_error", "navigation_error", "read_error", "selection_error"];
    if (version !== 1 || !stages.includes(stage) || deadlineMs !== 10000 ||
      ![navigationCount, selectionCount].every((n) => n === 0 || n === 1) ||
      ![navigationCompleted, selectionCompleted].every((v) => typeof v === "boolean") ||
      ![readinessAttempts, confirmationAttempts].every((n) => Number.isInteger(n) && n >= 0 && n <= 128) ||
      !finiteTime(elapsedMs) || ![readyMs, selectionMs].every((v) => v === null || finiteTime(v)) ||
      ![null, true, false].includes(selected) || (code !== null && !signedInteger(code)) ||
      (errorStages.includes(stage) ? code === null : code !== null)) return null;
    if ((navigationCompleted && navigationCount !== 1) || (selectionCompleted && selectionCount !== 1) ||
      (selectionCount === 1 && (!navigationCompleted || readinessAttempts < 1 || readyMs === null)) ||
      (selectionMs !== null) !== (selectionCount === 1) ||
      (readyMs !== null && (!navigationCompleted || readinessAttempts < 1 || readyMs >= 10000 || readyMs > elapsedMs)) ||
      (selectionMs !== null && (selectionMs < readyMs || selectionMs >= 10000 || selectionMs > elapsedMs)) ||
      (confirmationAttempts > 0 && !selectionCompleted) ||
      (selected !== null && (!selectionCompleted || confirmationAttempts < 1)) ||
      (stage !== "selected" && selected === true)) return null;
    if (["input", "setup_error"].includes(stage) && (navigationCount !== 0 || selectionCount !== 0 ||
      readinessAttempts !== 0 || confirmationAttempts !== 0 || readyMs !== null)) return null;
    if (stage === "navigation_error" && (navigationCount !== 1 || navigationCompleted || selectionCount !== 0 || readinessAttempts !== 0)) return null;
    if (stage === "selection_error" && (selectionCount !== 1 || selectionCompleted)) return null;
    if (!["input", "setup_error", "navigation_error"].includes(stage) && !navigationCompleted) return null;
    if (stage === "selected" && (navigationCount !== 1 || selectionCount !== 1 || !selectionCompleted ||
      selected !== true || readinessAttempts < 1 || confirmationAttempts < 1 || elapsedMs >= 10000)) return null;
    return { version, stage, deadlineMs, navigationCount, navigationCompleted, selectionCount,
      selectionCompleted, readinessAttempts, confirmationAttempts, readyMs, selectionMs, elapsedMs, selected, code };
  } catch { return null; }
}

// Internal seam only: the entry point creates the target and resolves the system
// directory. No command-line option can supply this target, program or script.
export async function invokeReadySelection(target, {
  systemExplorer, platform = process.platform, spawnProcess = spawn, env = process.env,
  clock = { setTimeout, clearTimeout },
} = {}) {
  const notStarted = (stage) => ({ status: "unavailable", stage, native: null,
    process: { termination: "not_started", exitCode: null, signal: null, killAttempted: false } });
  if (platform !== "win32") return notStarted("unsupported");
  if (typeof systemExplorer !== "string" || !/^C:\\Windows\\explorer\.exe$/i.test(systemExplorer)) return notStarted("system_directory");
  try { explorerSelectionArgument(target); } catch { return notStarted("input"); }
  const program = win32.join(win32.dirname(systemExplorer), "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return new Promise((resolve) => {
    let child, deadline, terminationDeadline, settled = false, stopReason = null, launchError = false;
    let stdout = "", outputBytes = 0, killAttempted = false;
    const finish = (termination, exitCode = null, signal = null) => {
      if (settled) return;
      settled = true;
      clock.clearTimeout(deadline); clock.clearTimeout(terminationDeadline);
      if (termination === "unknown") { child.unref(); child.stdout.destroy(); }
      const native = stopReason || launchError ? null : parseReadySelectionResponse(stdout);
      const stage = stopReason ?? (launchError ? "launch_error" : exitCode !== 0 || signal ? "process_error" : native?.stage ?? "protocol_error");
      resolve({ status: stage === "selected" ? "completed" : "failed", stage, native,
        process: { termination, exitCode: signedInteger(exitCode) ? exitCode : null,
          signal: ["SIGKILL", "SIGTERM"].includes(signal) ? signal : null, killAttempted } });
    };
    const stop = (reason) => {
      if (settled || stopReason) return;
      stopReason = reason; killAttempted = true;
      terminationDeadline = clock.setTimeout(() => finish("unknown"), 1000);
      // This is only our PowerShell bridge, never a shared Explorer process.
      try { child.kill("SIGKILL"); } catch { /* Only close proves termination. */ }
    };
    deadline = clock.setTimeout(() => stop("timeout"), 30000);
    try {
      child = spawnProcess(program, ["-STA", "-NoProfile", "-NonInteractive", "-File", bridgePath], {
        windowsHide: true, shell: false, stdio: ["ignore", "pipe", "ignore"],
        env: { ...env, WORKSPACE_READY_SELECTION_TARGET: target },
      });
    } catch { clock.clearTimeout(deadline); settled = true; resolve(notStarted("launch_error")); return; }
    child.on("error", () => { launchError = true; });
    child.on("close", (code, signal) => finish("confirmed", code, signal));
    child.stdout.on("error", () => stop("output_error"));
    child.stdout.on("data", (chunk) => {
      if (settled || stopReason) return;
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > maximumOutputBytes) { stdout = ""; stop("output_limit"); return; }
      // The protocol is ASCII scalar JSON, not arbitrary UTF-8 text.
      stdout += chunk.toString();
    });
  });
}

export async function runReadySelectionExperiment({
  evidenceDirectory = fileURLToPath(new URL("../work/windows-ready-selection-evidence/", import.meta.url)),
  platform = process.platform, filesystem = fs, spawnProcess = spawn, runResolver,
  runCommand, timing, clock = { setTimeout, clearTimeout }, env = process.env, readCodeRevision,
} = {}) {
  const evidence = {
    version: 1, source: "os_ready_folder_view_command", mode: "open_then_select_once", status: "failed", failure: null,
    metadata: await collectNativeSelectionMetadata({ env, readCodeRevision }),
    resolver: { status: "not_attempted", bootstrap: "hosted_c_windows", deadlineMs: 10000 },
    fixture: { status: "not_attempted", rootCreated: false, targetCreated: false },
    command: { status: "not_attempted", native: null, process: { termination: "not_started", exitCode: null, signal: null, killAttempted: false } },
    observation: { status: "not_attempted", phase: "later_independent_corroboration", rescuesCommand: false },
    windowCleanup: { status: "not_attempted", closure: "unverified" },
    fixtureRemoval: { status: "not_needed" }, persistence: { status: "not_attempted" },
  };
  const fail = (stage, code) => { evidence.failure ??= { stage, code }; };
  let executable, root, target, terminationKnown = true;
  if (platform !== "win32") fail("host", "unsupported");
  if (!evidence.metadata.codeSha) fail("metadata", "revision_unavailable");
  if (!evidence.failure) {
    try { executable = await resolveSystemExplorer(runResolver, (observation) => { evidence.resolver.observation = observation; }); evidence.resolver.status = "completed"; }
    catch { evidence.resolver.status = "unavailable"; fail("resolver", "unavailable"); }
  }
  if (!evidence.failure) {
    try {
      root = await filesystem.mkdtemp(join(tmpdir(), "workspace-native-selection-"));
      evidence.fixture.rootCreated = true;
      target = win32.join(root, "Native selection 日本語");
      await filesystem.mkdir(target); evidence.fixture.targetCreated = true;
      evidence.fixture.status = "completed";
    } catch (error) { evidence.fixture.status = "failed"; fail("fixture", filesystemCode(error)); }
    if (!evidence.failure) {
      terminationKnown = false;
      try {
        evidence.command = await invokeReadySelection(target, { systemExplorer: executable, platform, spawnProcess, env, clock });
        terminationKnown = ["confirmed", "not_started"].includes(evidence.command.process.termination);
        if (evidence.command.status !== "completed") fail("command", evidence.command.stage);
      } catch {
        evidence.command = { status: "failed", stage: "bridge_error", native: null,
          process: { termination: "unknown", exitCode: null, signal: null, killAttempted: null } };
        fail("command", "bridge_error");
      }
      if (evidence.command.process.termination === "confirmed") {
        try {
          const observation = await waitForFileManagerTarget(target, platform, runCommand, timing);
          evidence.observation = { ...observation, phase: "later_independent_corroboration", rescuesCommand: false };
          if (observation.status !== "passed" || observation.exactTargetObserved !== true) fail("observation", observation.completion);
        } catch { evidence.observation.status = "unavailable"; evidence.observation.completion = "observer_error"; fail("observation", "observer_error"); }
        try {
          const cleanup = await closeDisposableFileManagerTarget(target, platform, runCommand, { ownedParent: true });
          evidence.windowCleanup = { status: cleanup.status === "completed" ? "completed" : "failed", closure: "unverified",
            matched: cleanup.matched ?? null, closed: cleanup.closed ?? null, errorCount: cleanup.errorCount ?? null };
        } catch { evidence.windowCleanup.status = "failed"; }
        if (evidence.windowCleanup.status === "failed") fail("window_cleanup", "unavailable");
      }
    }
    if (root) {
      evidence.fixtureRemoval = terminationKnown ? await removeOwnedFixture(root, target, evidence.fixture.targetCreated, filesystem, clock)
        : { status: "unverified", code: "process_termination_unknown" };
      if (evidence.fixtureRemoval.status !== "completed") fail("fixture_removal", evidence.fixtureRemoval.code);
    }
  }
  evidence.status = evidence.failure ? "failed" : "passed";
  try {
    await filesystem.mkdir(evidenceDirectory, { recursive: true }); evidence.persistence.status = "completed";
    await filesystem.writeFile(join(evidenceDirectory, "result.json"), JSON.stringify(evidence, null, 2) + "\n", "utf8");
  } catch { evidence.persistence.status = "failed"; fail("evidence", "persistence_error"); evidence.status = "failed"; }
  if (evidence.status !== "passed") { const error = new Error("Windows ready selection experiment failed"); error.evidence = evidence; throw error; }
  return evidence;
}

export async function runReadySelectionCli({ args = process.argv.slice(2), stdout = process.stdout,
  stderr = process.stderr, experiment = runReadySelectionExperiment } = {}) {
  if (args.length) { stderr.write("Windows ready selection experiment failed (arguments).\n"); return 1; }
  try { await experiment(); stdout.write("Windows ready selection experiment passed.\n"); return 0; }
  catch { stderr.write("Windows ready selection experiment failed.\n"); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runReadySelectionCli();
}
