import assert from "node:assert/strict";
/* global document, requestAnimationFrame */
import { usableRuntimeViewProjection } from "./runtime-view-readiness.mjs";

function afterPaint() {
  return new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => done(performance.now()))));
}
function stabilizeProjection({ ids, timeout, trace, endpoint = [] }, usable, painted) {
  return (async () => {
    const observationStartedAt = performance.now();
    const deadline = observationStartedAt + timeout;
    const inspections = trace ? [] : undefined;
    const ready = async () => {
      while (true) {
        const projectionReady = usable(ids);
        const endpointReady = projectionReady && endpoint.every(({selector,text}) => [...globalThis.document.querySelectorAll(selector)].some(element => text === undefined || element.textContent.trim() === text));
        if (trace) {
          inspections.push({at:performance.now(),projectionReady,endpointReady,pendingCount:globalThis.document.querySelectorAll('[aria-busy="true"]').length});
          if (inspections.length > 64) inspections.shift();
        }
        if (projectionReady && endpointReady) return;
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
    return { observationStartedAt, firstPaintedAt, paintedAt, ...(trace ? {inspections} : {}) };
  })();
}
// Playwright serializes functions without their module imports. Embed only our
// fixed, owned functions so host RPC pauses cannot split the stabilization.
const observeProjection = new Function("input", `return (${stabilizeProjection.toString()})(input, (${usableRuntimeViewProjection.toString()}), (${afterPaint.toString()}));`);
export async function waitForRuntimeProjection(page, ids, trace = false, endpoint = []) {
  const result = await page.waitForFunction(observeProjection, { ids, timeout: 30000, trace, endpoint });
  try { return await result.jsonValue(); }
  finally { await result.dispose(); }
}
export async function readRuntimeInteraction(page, { observationStartedAt, firstPaintedAt, paintedAt } = {}) {
  const { startedAt, observedAt } = await page.evaluate(() => ({ startedAt: globalThis.__workspacePerformanceStarted, observedAt: performance.now() }));
  assert.ok(Number.isFinite(startedAt) && Number.isFinite(observationStartedAt) && Number.isFinite(firstPaintedAt) && Number.isFinite(paintedAt) && observationStartedAt >= startedAt && firstPaintedAt >= observationStartedAt && paintedAt >= firstPaintedAt && paintedAt <= observedAt, "A fresh measured event and completed paint must precede observation");
  return { ms: paintedAt - startedAt, observationStartMs: observationStartedAt - startedAt, initialReadinessMs: firstPaintedAt - observationStartedAt, firstPaintedMs: firstPaintedAt - startedAt, stabilizationMs: paintedAt - firstPaintedAt,
    observedMs: observedAt - startedAt, paintedMs: paintedAt - startedAt, driverObservationDelayMs: observedAt - paintedAt };
}

// Expanded projects hide the view; verify their own fields, tree and selected tab.
export async function waitForRuntimeProject(page, projectId, expanded, text, fileState = 'ready') {
  assert.ok(['ready','presented'].includes(fileState), 'Choose a project tree readiness endpoint');
  const handle = await page.waitForFunction(async ({ projectId, expanded, text, fileState }) => {
    const observationStartedAt = performance.now();
    const deadline = observationStartedAt + 30000;
    const usable = () => {
      const area = document.querySelector('.project-area');
      const view = document.querySelector('.saved-view-content');
      const tab = document.querySelector(`[data-project-tab="${projectId}"][aria-selected="true"]`);
      const files = area?.querySelector('.project-files');
      const presented = fileState === 'presented' && files && [...files.querySelectorAll('[role="status"], [role="treeitem"]')].some(node =>
        node.checkVisibility() && (node.getAttribute('role') === 'treeitem' || ['Loading files…','Загрузка файлов…'].includes(node.textContent.trim())));
      return !!area && !!view && view.hidden === expanded && (!expanded || !!tab) &&
        area.querySelector('.project-detail-fields[aria-busy="false"]') &&
        area.querySelector(`.project-detail-fields [data-project-id="${projectId}"]`) &&
        (fileState === 'presented' ? !area.querySelector('.project-detail-fields [aria-busy="true"]') && presented :
          !area.querySelector('[aria-busy="true"]') && area.querySelector('.project-files [role="treeitem"]')) &&
        (text === null || [...area.querySelectorAll('.text-value-button')].some(element => element.textContent.trim() === text &&
          (fileState !== 'presented' || !element.disabled && element.checkVisibility())));
    };
    // An async predicate is a truthy Promise before it resolves. Poll internally
    // so Playwright never accepts a Promise that later resolves to false.
    while (true) {
      if (performance.now() >= deadline) throw new Error('Project readiness timed out');
      if (!usable()) { await new Promise(done => requestAnimationFrame(done)); continue; }
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      const firstPaintedAt = performance.now();
      if (!usable()) continue;
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      if (!usable()) continue;
      return { observationStartedAt, firstPaintedAt, paintedAt: performance.now() };
    }
  }, { projectId, expanded, text, fileState });
  try { return await handle.jsonValue(); }
  finally { await handle.dispose(); }
}
