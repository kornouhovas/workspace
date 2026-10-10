import { execFile, spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, win32 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { closeDisposableFileManagerTarget, waitForFileManagerTarget } from "./file-manager-evidence.mjs";
import { collectNativeSelectionMetadata, removeOwnedFixture } from "./windows-native-selection.mjs";

// Deliberately limited to the two hosted Windows images. No PATH/SystemRoot/
// caller executable fallback. The helper independently checks the OS directory.
const resolverProgram = String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const resolverScript = fileURLToPath(new URL("./windows-explorer-directory.ps1", import.meta.url));
const execute = promisify(execFile);
// Match the prior API fixture shape: only the dispatch route changes.
const fixtureName = "Native selection 日本語";
const finiteExit = (code) => Number.isInteger(code) && code >= -2147483648 && code <= 4294967295 ? code : null;
const filesystemCode = (error) => ["EACCES", "EPERM", "ENOENT", "ENOTEMPTY", "EEXIST", "EIO", "ENOSPC", "EBUSY"]
  .includes(error?.code) ? error.code : "filesystem_error";

export function explorerSelectionArgument(target) {
  if (typeof target !== "string" || target.length > 32000 || !/^[A-Za-z]:\\/.test(target) ||
    [...target].some((character) => character.charCodeAt(0) < 32) || /["<>|?*]/.test(target) ||
    target.endsWith("\\") || win32.normalize(target) !== target ||
    target.slice(2).includes(":")) throw new Error("Invalid Explorer selection target");
  // Explorer parses a raw command line, not the usual CRT argv convention.
  // windowsVerbatimArguments below preserves these inner quotes exactly.
  return `/select,"${target}"`;
}

export async function resolveSystemExplorer(runResolver = execute) {
  const output = await runResolver(resolverProgram, ["-NoProfile", "-NonInteractive", "-File", resolverScript], {
    timeout: 10000, maxBuffer: 1024, windowsHide: true, shell: false,
  });
  if (typeof output?.stdout !== "string" || Buffer.byteLength(output.stdout) > 1024 ||
    output.stderr !== "" || !/^C:\\Windows\r?\n$/i.test(output.stdout)) throw new Error("System directory unavailable");
  return win32.join(output.stdout.replace(/\r?\n$/, ""), "explorer.exe");
}

// Track only the direct child. Never kill Explorer: it may host shared windows.
// Install both listeners before awaiting launch so fast handoffs retain close.
function launchExplorer(executable, argument, spawnProcess, clock) {
  const record = { attempts: 1, status: "pending", process: {
    termination: "unknown", exitCode: null, signal: null, killAttempted: false,
  } };
  let child, launchTimer, closeTimer, closed = false, launchSettled = false;
  let resolveLaunch, resolveClose;
  const launched = new Promise((resolve) => { resolveLaunch = resolve; });
  const closedPromise = new Promise((resolve) => { resolveClose = resolve; });
  const finishLaunch = (status) => {
    if (launchSettled) return;
    launchSettled = true;
    clock.clearTimeout(launchTimer);
    record.status = status;
    resolveLaunch(status === "launched");
  };
  launchTimer = clock.setTimeout(() => finishLaunch("launch_timeout"), 5000);
  try {
    child = spawnProcess(executable, [argument], { shell: false, windowsVerbatimArguments: true, stdio: "ignore" });
    child.on("spawn", () => finishLaunch("launched"));
    child.on("error", () => {
      if (!launchSettled) finishLaunch("launch_error");
      else record.status = "process_error";
    });
    child.on("close", (code, signal) => {
      closed = true;
      record.process = { termination: "confirmed", exitCode: finiteExit(code),
        signal: ["SIGKILL", "SIGTERM"].includes(signal) ? signal : null, killAttempted: false };
      if (!launchSettled) finishLaunch("launch_error");
      clock.clearTimeout(closeTimer);
      resolveClose();
    });
  } catch {
    record.process.termination = "not_started";
    closed = true;
    finishLaunch("launch_error");
    resolveClose();
  }
  return { record, launched, confirmClose: async () => {
    if (!closed) {
      const bounded = new Promise((resolve) => { closeTimer = clock.setTimeout(resolve, 1000); });
      await Promise.race([closedPromise, bounded]);
      clock.clearTimeout(closeTimer);
      if (!closed) child.unref();
    }
    // Evidence is a snapshot: a later event cannot mutate persisted verdicts.
    return { ...record, process: { ...record.process } };
  } };
}

export async function runExplorerSelectionExperiment({
  evidenceDirectory = fileURLToPath(new URL("../work/windows-explorer-selection-evidence/", import.meta.url)),
  platform = process.platform, filesystem = fs, spawnProcess = spawn, runResolver = execute,
  runCommand, timing, clock = { setTimeout, clearTimeout }, env = process.env, readCodeRevision,
} = {}) {
  const evidence = {
    version: 1, source: "os_explorer_cli", mode: "select_quoted", status: "failed", failure: null,
    metadata: await collectNativeSelectionMetadata({ env, readCodeRevision }),
    resolver: { status: "not_attempted", bootstrap: "hosted_c_windows", deadlineMs: 10000 },
    fixture: { status: "not_attempted", rootCreated: false, targetCreated: false },
    launch: { attempts: 0, status: "not_attempted", process: { termination: "not_started", exitCode: null, signal: null, killAttempted: false } },
    observation: { status: "not_attempted" },
    windowCleanup: { status: "not_attempted", closure: "unverified" },
    fixtureRemoval: { status: "not_needed" }, persistence: { status: "not_attempted" },
  };
  const fail = (stage, code) => { evidence.failure ??= { stage, code }; };
  let executable, root, target, launched;
  if (platform !== "win32") fail("host", "unsupported");
  if (!evidence.metadata.codeSha) fail("metadata", "revision_unavailable");
  if (!evidence.failure) {
    try { executable = await resolveSystemExplorer(runResolver); evidence.resolver.status = "completed"; }
    catch { evidence.resolver.status = "unavailable"; fail("resolver", "unavailable"); }
  }
  if (!evidence.failure) {
    try {
      root = await filesystem.mkdtemp(join(tmpdir(), "workspace-native-selection-"));
      evidence.fixture.rootCreated = true;
      target = win32.join(root, fixtureName);
      await filesystem.mkdir(target);
      evidence.fixture.targetCreated = true;
      const argument = explorerSelectionArgument(target);
      evidence.fixture.status = "completed";
      launched = launchExplorer(executable, argument, spawnProcess, clock);
      if (await launched.launched) {
        try {
          evidence.observation = await waitForFileManagerTarget(target, platform, runCommand, timing);
          if (evidence.observation.status !== "passed" || evidence.observation.exactTargetObserved !== true) {
            fail("observation", evidence.observation.completion);
          }
        } catch { evidence.observation = { status: "unavailable", completion: "observer_error" }; fail("observation", "observer_error"); }
        try {
          const cleanup = await closeDisposableFileManagerTarget(target, platform, runCommand, { ownedParent: true });
          evidence.windowCleanup = { status: cleanup.status === "completed" ? "completed" : "failed", closure: "unverified",
            matched: cleanup.matched ?? null, closed: cleanup.closed ?? null, errorCount: cleanup.errorCount ?? null };
          if (evidence.windowCleanup.status !== "completed") fail("window_cleanup", "unavailable");
        } catch { evidence.windowCleanup.status = "failed"; fail("window_cleanup", "unavailable"); }
      } else fail("launch", launched.record.status);
    } catch (error) {
      evidence.fixture.status = "failed";
      fail("fixture", filesystemCode(error));
    }
  }
  if (launched) {
    evidence.launch = await launched.confirmClose();
    if (evidence.launch.status !== "launched") fail("launch", evidence.launch.status);
    if (evidence.launch.process.termination !== "confirmed") fail("process", "termination_unknown");
    else if (evidence.launch.process.exitCode !== 0 || evidence.launch.process.signal !== null) fail("process", "nonzero_exit");
  }
  if (root) {
    evidence.fixtureRemoval = !launched || ["confirmed", "not_started"].includes(evidence.launch.process.termination)
      ? await removeOwnedFixture(root, target, evidence.fixture.targetCreated, filesystem, clock)
      : { status: "unverified", code: "process_termination_unknown" };
    if (evidence.fixtureRemoval.status !== "completed") fail("fixture_removal", evidence.fixtureRemoval.code);
  }
  evidence.status = evidence.failure ? "failed" : "passed";
  try {
    await filesystem.mkdir(evidenceDirectory, { recursive: true });
    evidence.persistence.status = "completed";
    await filesystem.writeFile(join(evidenceDirectory, "result.json"), JSON.stringify(evidence, null, 2) + "\n", "utf8");
  } catch { evidence.persistence.status = "failed"; fail("evidence", "persistence_error"); evidence.status = "failed"; }
  if (evidence.status !== "passed") {
    const error = new Error("Windows Explorer selection experiment failed");
    error.evidence = evidence;
    throw error;
  }
  return evidence;
}

export async function runExplorerSelectionCli({ args = process.argv.slice(2),
  stdout = process.stdout, stderr = process.stderr, experiment = runExplorerSelectionExperiment,
} = {}) {
  if (args.length) { stderr.write("Windows Explorer selection experiment failed (arguments).\n"); return 1; }
  try { await experiment(); stdout.write("Windows Explorer selection experiment passed.\n"); return 0; }
  catch { stderr.write("Windows Explorer selection experiment failed.\n"); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runExplorerSelectionCli();
}
