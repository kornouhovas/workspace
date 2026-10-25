import { scanConfiguredSource } from "./folder-roles.js";
import { parentPort, workerData } from "node:worker_threads";
import { SCAN_CLOSED, SCAN_BUSY, type BackgroundScanRequest } from "./background-discovery.js";

const state = new Int32Array(workerData as SharedArrayBuffer);
parentPort!.on("message", (request: BackgroundScanRequest & { id: number }) => {
  Atomics.store(state, SCAN_BUSY, 1);
  try {
    if (Atomics.load(state, SCAN_CLOSED)) return;
    const scan = scanConfiguredSource({...request,discoveryMode:request.mode,folderRoles:request.folderRoles ?? null}, request.exclusions, () => Atomics.load(state, SCAN_CLOSED) !== 0);
    if (!Atomics.load(state, SCAN_CLOSED)) parentPort!.postMessage({id:request.id,scan});
  } finally {
    // Both scanner implementations close directory handles before returning.
    // The owning service waits for this acknowledgement when it closes.
    Atomics.store(state, SCAN_BUSY, 0); Atomics.notify(state, SCAN_BUSY);
  }
});
