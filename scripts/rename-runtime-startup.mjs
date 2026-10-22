import assert from "node:assert/strict";
import { withDeadline } from "./runtime-lifecycle.mjs";
import { waitForRuntimeInterface } from "./runtime-startup.mjs";

// Rename fixtures retain every launch until backend ownership is positively
// established, including launches that fail before a window is available.
export function createRenameRuntimeStartup({ launchElectron, ownedProcesses, backendPids, recordStartup, probeBackendPid = pid => process.kill(pid, 0) }) {
  const uncertain = new Set(), launches = new Map();
  let current;
  async function readBackendPids(electron) {
    const attempt = launches.get(electron);
    assert.ok(attempt, "Rename metrics require an owned launch");
    try {
      const pids = await withDeadline(electron.evaluate(({ app }) => app.getAppMetrics().filter(metric => metric.type === "Utility" && metric.serviceName?.includes("Node")).map(metric => metric.pid)), 10000, "Rename backend metrics");
      assert.ok(Array.isArray(pids) && pids.length && pids.every(pid => Number.isSafeInteger(pid) && pid > 0), "Rename backend metrics require nonempty valid PIDs");
      for (const pid of pids) { backendPids.add(pid); attempt.pids.add(pid); }
      uncertain.delete(attempt);
      return [...attempt.pids];
    } catch (error) { uncertain.add(attempt); throw error; }
  }
  return {
    get current() { return current; },
    clearCurrent() { current = undefined; },
    get launchUnverified() { return uncertain.size > 0; },
    get pendingBackendPids() {
      return new Set([...launches.values()].flatMap(attempt => [...attempt.pids].filter(pid => !attempt.exited.has(pid))));
    },
    get backendExitEvidence() {
      const attempts = [...launches.values()];
      const observedOccurrences = attempts.reduce((count, attempt) => count + attempt.pids.size, 0);
      const confirmedExits = attempts.reduce((count, attempt) => count + attempt.exited.size, 0);
      return { observedOccurrences, confirmedExits, pendingOccurrences: observedOccurrences - confirmedExits };
    },
    confirmBackendExit(electron, pid) {
      const attempt = launches.get(electron);
      assert.ok(attempt?.pids.has(pid), "Exit proof requires an owned backend occurrence");
      const child = attempt.child;
      assert.ok(child.exitCode != null || child.signalCode != null, "Backend proof requires confirmed parent exit");
      if (attempt.exited.has(pid)) return true;
      try { probeBackendPid(pid); return false; }
      catch (error) {
        if (error.code !== "ESRCH") throw error;
        // An exited occurrence cannot become alive again. A later owned launch
        // reusing this number has its own unconfirmed entry in launches.
        attempt.exited.add(pid); return true;
      }
    },
    readBackendPids,
    async launch(options) {
      const attempt = { pids: new Set(), exited: new Set() };
      uncertain.add(attempt);
      const electron = await launchElectron(options);
      attempt.child = electron.process();
      ownedProcesses.add(attempt.child);
      launches.set(electron, attempt);
      current = { electron, child: attempt.child };
      const page = await electron.firstWindow({ timeout: 30000 });
      current.page = page;
      page.setDefaultTimeout(15000);
      await waitForRuntimeInterface(page, recordStartup);
      await readBackendPids(electron);
      return page;
    },
  };
}
