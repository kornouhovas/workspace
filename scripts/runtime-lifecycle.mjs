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
  let onNormalExit, expired = false;
  const normalExit = child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : new Promise(resolve => {
    onNormalExit = resolve; child.once("exit", onNormalExit);
  });
  // Request quit without waiting for the inspector response from an exiting app.
  // Playwright close() also calls app.quit(). Defer its channel disposal until
  // the owned process exits so two live quit paths cannot race backend shutdown.
  void electron.evaluate(({ app }) => app.quit()).catch(() => undefined);
  try {
    await withDeadline((async () => {
      await normalExit;
      if (!expired) await electron.close();
    })(), timeoutMs, "Electron shutdown");
  } catch (error) {
    expired = true;
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
  } finally { if (onNormalExit) child.removeListener("exit", onNormalExit); }
}

// Failure diagnostics must never prevent the bounded attempt to close an owned
// application. Preserve collection failures separately; none counts as a pass.
export async function closeRuntimeSession(electron, { shutdown, readBackendPids, beforeClose, assertBackendsStopped, recordBackendsStopped }, close = closeElectron) {
  let pids = [], verificationFailure;
  try { pids = await readBackendPids(electron); }
  catch (error) { verificationFailure = error; shutdown.ownershipError = error.message; }
  try { await beforeClose(); }
  catch (error) { verificationFailure ??= error; shutdown.evidenceError = error.message; }
  try {
    await close(electron);
    await assertBackendsStopped(pids);
    if (verificationFailure) throw verificationFailure;
    await recordBackendsStopped?.(pids);
    shutdown.passed = true;
  } catch (error) {
    shutdown.error = error.message;
    shutdown.forcedCleanup = error.forcedCleanup;
    throw error;
  }
}

// A cleared UI session is not exit evidence. Callers retain every launched
// parent and unresolved backend PID, including launches that failed before UI.
// Independently confirmed exit may retire a PID before the OS reuses its number.
export function ownedProcessesStopped(children, backendPids, { probe = (pid) => process.kill(pid, 0), launchUnverified = false } = {}) {
  if (launchUnverified || ![...children].every(child => child.exitCode != null || child.signalCode != null)) return false;
  return [...backendPids].every(pid => {
    if (!Number.isSafeInteger(pid) || pid <= 0) return false;
    try { probe(pid); return false; }
    catch (error) { return error.code === "ESRCH"; }
  });
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
