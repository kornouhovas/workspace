import { Worker } from "node:worker_threads";
import type { DiscoveryScan } from "./discovery.js";
import type { DiscoveryMode } from "../contracts/workspaces.js";

export const SCAN_CLOSED = 0;
export const SCAN_BUSY = 1;

export interface BackgroundScanRequest {
  mode: DiscoveryMode; canonicalRoot: string; archiveRelativePath: string | null; exclusions: string[];
}

// Only the unchanged read-only filesystem scanner runs here. SQLite, source
// ownership, stale-result checks and reconciliation stay in the owning service.
export function createBackgroundDiscovery(workerFile: string) {
  let worker: Worker | undefined, state: Int32Array, closed = false, failed = false, sequence = 0;
  const pending = new Map<number, {resolve(scan: DiscoveryScan): void; reject(error: Error): void}>();
  const rejectPending = () => {
    for (const request of pending.values()) request.reject(new Error(closed ? "Background discovery closed" : "Background discovery unavailable"));
    pending.clear();
  };
  function start() {
    state = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2));
    const unpacked = workerFile.replace(/([/\\])app\.asar([/\\])/, "$1app.asar.unpacked$2");
    const created = new Worker(unpacked, {workerData:state.buffer});
    worker = created; failed = false;
    created.on("message", ({id,scan}: {id:number;scan:DiscoveryScan}) => {
      if (closed || worker !== created) return;
      const request = pending.get(id); if (!request) return;
      pending.delete(id); request.resolve(scan);
      if (!pending.size) created.unref();
    });
    created.on("error", () => { failed = true; rejectPending(); });
    created.on("exit", () => { if (worker === created) { worker = undefined; rejectPending(); } });
    return created;
  }
  return {
    scan(request: BackgroundScanRequest): Promise<DiscoveryScan> {
      if (closed || failed && worker) return Promise.reject(new Error(closed ? "Background discovery closed" : "Background discovery unavailable"));
      const active = worker ?? start(); active.ref();
      const id = ++sequence;
      return new Promise((resolve,reject) => {
        pending.set(id,{resolve,reject});
        try { active.postMessage({...request,id}); }
        catch { pending.delete(id); reject(new Error("Background discovery unavailable")); if (!pending.size) active.unref(); }
      });
    },
    close() {
      closed = true;
      if (!worker) return;
      Atomics.store(state, SCAN_CLOSED, 1);
      // Cooperative cancellation is checked between native filesystem calls.
      // Keep the existing controller's 1.5-second shutdown deadline unchanged.
      const stopped = Atomics.load(state, SCAN_BUSY) === 0 || Atomics.wait(state, SCAN_BUSY, 1, 1000) !== "timed-out";
      rejectPending();
      worker.unref(); void worker.terminate().catch(() => {});
      if (!stopped) throw new Error("Background discovery stop unverified");
    },
  };
}
