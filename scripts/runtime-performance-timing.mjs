import assert from "node:assert/strict";
import { usableRuntimeViewProjection } from "./runtime-view-readiness.mjs";

function afterPaint() {
  return new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => done(performance.now()))));
}
function stabilizeProjection({ ids, timeout, trace }, usable, painted) {
  return (async () => {
    const observationStartedAt = performance.now();
    const deadline = observationStartedAt + timeout;
    const ready = async () => {
      while (!usable(ids)) {
        if (performance.now() >= deadline) throw new Error("Runtime projection readiness timed out");
        await new Promise(done => globalThis.requestAnimationFrame(done));
      }
    };
    await ready();
    const firstPaintedAt = await painted();
    if (trace) performance.mark("workspace-performance-first-paint");
    // Mounting can reveal additional rows. Recheck complete membership and all
    // visible editors after layout, then retain the original final frame pair.
    await ready();
    const paintedAt = await painted();
    if (trace) performance.mark("workspace-performance-ready");
    return { observationStartedAt, firstPaintedAt, paintedAt };
  })();
}
// Playwright serializes functions without their module imports. Embed only our
// fixed, owned functions so host RPC pauses cannot split the stabilization.
const observeProjection = new Function("input", `return (${stabilizeProjection.toString()})(input, (${usableRuntimeViewProjection.toString()}), (${afterPaint.toString()}));`);
export async function waitForRuntimeProjection(page, ids, trace = false) {
  const result = await page.waitForFunction(observeProjection, { ids, timeout: 30000, trace });
  try { return await result.jsonValue(); }
  finally { await result.dispose(); }
}
export async function readRuntimeInteraction(page, { observationStartedAt, firstPaintedAt, paintedAt } = {}) {
  const { startedAt, observedAt } = await page.evaluate(() => ({ startedAt: globalThis.__workspacePerformanceStarted, observedAt: performance.now() }));
  assert.ok(Number.isFinite(startedAt) && Number.isFinite(observationStartedAt) && Number.isFinite(firstPaintedAt) && Number.isFinite(paintedAt) && observationStartedAt >= startedAt && firstPaintedAt >= observationStartedAt && paintedAt >= firstPaintedAt && paintedAt <= observedAt, "A fresh measured event and completed paint must precede observation");
  return { ms: paintedAt - startedAt, observationStartMs: observationStartedAt - startedAt, initialReadinessMs: firstPaintedAt - observationStartedAt, firstPaintedMs: firstPaintedAt - startedAt, stabilizationMs: paintedAt - firstPaintedAt,
    observedMs: observedAt - startedAt, paintedMs: paintedAt - startedAt, driverObservationDelayMs: observedAt - paintedAt };
}
