import assert from "node:assert/strict";
import { withDeadline } from "./runtime-lifecycle.mjs";
import { waitForRuntimeInterface } from "./runtime-startup.mjs";

// Rename fixtures retain every launch until backend ownership is positively
// established, including launches that fail before a window is available.
export function createRenameRuntimeStartup({ launchElectron, ownedProcesses, backendPids, recordStartup }) {
  const uncertain = new Set(), launches = new Map();
  let current;
  async function readBackendPids(electron) {
    const attempt = launches.get(electron);
    assert.ok(attempt && !attempt.stopped, "Rename metrics require an active owned launch");
    try {
      const pids = await withDeadline(electron.evaluate(({ app }) => app.getAppMetrics().filter(metric => metric.type === "Utility" && metric.serviceName?.includes("Node")).map(metric => metric.pid)), 10000, "Rename backend metrics");
      assert.ok(Array.isArray(pids) && pids.length && pids.every(pid => Number.isSafeInteger(pid) && pid > 0), "Rename backend metrics require nonempty valid PIDs");
      for (const pid of pids) { attempt.pids.add(pid); backendPids.add(pid); }
      uncertain.delete(attempt);
      return [...attempt.pids];
    } catch (error) { uncertain.add(attempt); throw error; }
  }
  return {
    get current() { return current; },
    clearCurrent() { current = undefined; },
    get launchUnverified() { return uncertain.size > 0; },
    readBackendPids,
    // Only normal-shutdown callers with independent ESRCH evidence may retire
    // an observed backend. A later launch can own the same numeric PID again.
    confirmBackendExit(electron, pids) {
      const attempt = launches.get(electron);
      assert.ok(attempt && !uncertain.has(attempt), "Backend exit requires verified launch ownership");
      assert.deepEqual(new Set(pids), attempt.pids, "Backend exit must cover every observed PID");
      attempt.stopped = true;
      for (const pid of attempt.pids) {
        if (![...launches.values()].some(other => !other.stopped && other.pids.has(pid))) backendPids.delete(pid);
      }
    },
    async launch(options) {
      const attempt = { pids: new Set(), stopped: false };
      uncertain.add(attempt);
      const electron = await launchElectron(options);
      ownedProcesses.add(electron.process());
      launches.set(electron, attempt);
      current = { electron };
      const page = await electron.firstWindow({ timeout: 30000 });
      current.page = page;
      page.setDefaultTimeout(15000);
      await waitForRuntimeInterface(page, recordStartup);
      await readBackendPids(electron);
      return page;
    },
  };
}
