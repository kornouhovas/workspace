import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";

export async function withDeadline(operation, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function closeElectron(electron, timeoutMs = 10000) {
  const child = electron.process();
  // Playwright close owns the normal quit request and debugger disconnection.
  // A competing app.quit() can bypass the application's deferred backend stop.
  try {
    await withDeadline(electron.close(), timeoutMs, "Electron shutdown");
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      let onExit;
      const exited = new Promise((resolve) => { onExit = resolve; child.once("exit", onExit); });
      const cleanup = { status: "passed", processStopped: false };
      try {
        try {
          if (process.platform === "win32") {
            await promisify(execFile)("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
              timeout: 5000, windowsHide: true,
            });
          } else {
            // Playwright launches Electron as the leader of a separate process group.
            process.kill(-child.pid, "SIGKILL");
          }
        } catch (cleanupError) {
          cleanup.status = "failed";
          // Never retain taskkill stdout/stderr or its command text in evidence.
          const code = cleanupError.code;
          cleanup.errorCode = Number.isSafeInteger(code) || ["ENOENT", "EPERM", "EACCES", "ESRCH", "ETIMEDOUT"].includes(code) ? code : "unknown";
        }
        // taskkill can kill the parent and still fail for an already absent child.
        // Verify the owned parent's exit independently of the command result.
        try { await withDeadline(exited, 5000, "Electron forced exit"); }
        catch { cleanup.status = "failed"; cleanup.exitTimedOut = true; }
        cleanup.processStopped = child.exitCode !== null || child.signalCode !== null;
        error.forcedCleanup = cleanup;
      } finally {
        child.removeListener("exit", onExit);
      }
    }
    throw error;
  }
}

// Failure diagnostics must never prevent the bounded attempt to close an owned
// application. Preserve collection failures separately; none counts as a pass.
export async function closeRuntimeSession(electron, { shutdown, readBackendPids, beforeClose, assertBackendsStopped }, close = closeElectron) {
  let pids = [], verificationFailure;
  try { pids = await readBackendPids(electron); }
  catch (error) { verificationFailure = error; shutdown.ownershipError = error.message; }
  try { await beforeClose(); }
  catch (error) { verificationFailure ??= error; shutdown.evidenceError = error.message; }
  try {
    await close(electron);
    await assertBackendsStopped(pids);
    if (verificationFailure) throw verificationFailure;
    shutdown.passed = true;
  } catch (error) {
    shutdown.error = error.message;
    shutdown.forcedCleanup = error.forcedCleanup;
    throw error;
  }
}

// A cleared UI session is not exit evidence. Callers retain every launched
// parent and observed backend PID, including launches that failed before UI.
export function inspectOwnedProcesses(children, backendPids, { probe = (pid) => process.kill(pid, 0), launchUnverified = false } = {}) {
  const parents = [...children], backends = [...backendPids];
  const result = { stopped: false, reason: "confirmed", parentCount: parents.length,
    unconfirmedParents: parents.filter(child => child.exitCode == null && child.signalCode == null).length,
    backendCount: backends.length, checkedBackends: 0, launchUnverified };
  if (launchUnverified) return { ...result, reason: "launch_unverified" };
  if (result.unconfirmedParents) return { ...result, reason: "parent_exit_unconfirmed" };
  for (const pid of backends) {
    if (!Number.isSafeInteger(pid) || pid <= 0) return { ...result, reason: "invalid_backend_pid" };
    result.checkedBackends++;
    try { probe(pid); return { ...result, reason: "backend_present" }; }
    catch (error) { if (error.code !== "ESRCH") return { ...result, reason: "backend_probe_unverified" }; }
  }
  return { ...result, stopped: true };
}

export function ownedProcessesStopped(children, backendPids, options) {
  return inspectOwnedProcesses(children, backendPids, options).stopped;
}

// The caller owns this disposable tree and verifies all its processes first.
// Record cleanup independently, then preserve the original scenario failure.
export async function cleanupOwnedFixture(fixture, { processesStopped, primaryFailure, record }, remove = rm) {
  let result, cleanupFailure;
  if (!processesStopped) {
    cleanupFailure = new Error("Owned-process termination is unverified; fixture cleanup skipped");
    result = { status: "skipped", reason: cleanupFailure.message };
  } else {
    try {
      await remove(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      result = { status: "passed", asserted: true, processesStopped: true, maxRetries: 5, retryDelay: 100 };
    } catch (error) {
      cleanupFailure = error;
      result = { status: "failed", reason: error.message, code: error.code, processesStopped: true };
    }
  }
  try { await record(result); }
  catch (error) { throw primaryFailure ?? cleanupFailure ?? error; }
  if (primaryFailure) throw primaryFailure;
  if (cleanupFailure) throw cleanupFailure;
  return result;
}
