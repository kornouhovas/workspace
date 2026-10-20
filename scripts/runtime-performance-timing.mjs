import assert from "node:assert/strict";
import { usableRuntimeViewProjection } from "./runtime-view-readiness.mjs";

// Keep both readiness observations and both pairs of frames. Capture the final
// renderer endpoint alongside the later driver read, which cannot move it.
function afterPaint() {
  return new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => done(performance.now()))));
}
export async function waitForRuntimeProjection(page, ids) {
  await page.waitForFunction(usableRuntimeViewProjection, ids);
  await page.evaluate(afterPaint);
  await page.waitForFunction(usableRuntimeViewProjection, ids);
  return page.evaluate(afterPaint);
}
export async function readRuntimeInteraction(page, paintedAt) {
  const { startedAt, observedAt } = await page.evaluate(() => ({ startedAt: globalThis.__workspacePerformanceStarted, observedAt: performance.now() }));
  assert.ok(Number.isFinite(startedAt) && Number.isFinite(paintedAt) && paintedAt >= startedAt && paintedAt <= observedAt, "A fresh measured event and completed paint must precede observation");
  return { ms: paintedAt - startedAt, observedMs: observedAt - startedAt, paintedMs: paintedAt - startedAt, driverObservationDelayMs: observedAt - paintedAt };
}
