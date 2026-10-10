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
  // Request quit without waiting for the inspector response from an exiting app.
  void electron.evaluate(({ app }) => app.quit()).catch(() => undefined);
  try {
    await withDeadline(electron.close(), timeoutMs, "Electron shutdown");
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      if (process.platform === "win32") {
        await promisify(execFile)("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          timeout: 5000, windowsHide: true,
        });
      } else {
        // Playwright launches Electron as the leader of a separate process group.
        process.kill(-child.pid, "SIGKILL");
      }
      await withDeadline(exited, 5000, "Electron forced exit");
    }
    throw error;
  }
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
