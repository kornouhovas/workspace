/* global requestAnimationFrame, innerHeight, innerWidth */
import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";
import {withDeadline} from "./runtime-lifecycle.mjs";

// Visit the real owned row before expecting viewport-loaded fields. This only
// scrolls; callers retain their exact control/value checks and original deadlines.
export async function showRuntimeProject(page, name, projectId, groupLabel) {
  const read = async input => {
    const result = await page.evaluate(input => globalThis.window.workspace.workspace(input), input);
    assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result));
    return result.value;
  };
  const active = (await read({type:"workspace.load"})).activeWorkspace;
  assert.ok(active);
  const list = await read({type:"workspace.listProjects",workspaceId:active.workspaceId});
  const matches = [...list.projects, ...list.retainedProjects].filter(project => project.name === name && (projectId === undefined || project.projectId === projectId));
  assert.equal(matches.length, 1, "The runtime fixture must identify one owned project");
  const group = groupLabel === undefined ? null : page.getByRole("region", {name:groupLabel, exact:true});
  // Service replies precede renderer projection. An old occurrence can still
  // exist under a different group; visit only the requested current projection.
  if (group) await group.waitFor({state:"visible"});
  await (group ?? page).locator(`[data-project-id="${matches[0].projectId}"]`).first().scrollIntoViewIfNeeded();
}

// Playwright's waitForFunction treats a Promise as truthy before its boolean
// result settles. Await each readonly service response on the host instead.
export async function waitForRuntimeProjectPath(page, workspaceId, projectId, relativePath) {
  const deadline = performance.now() + 15000;
  while (performance.now() < deadline) {
    const matched = await withDeadline(page.evaluate(async ({workspaceId,projectId,relativePath}) => {
      const result = await globalThis.window.workspace.workspace({type: "workspace.listProjects", workspaceId});
      return result.ok && result.value.workspaceId === workspaceId && result.value.projects.some(project => project.projectId === projectId && project.relativePath === relativePath);
    }, {workspaceId,projectId,relativePath}), Math.max(1, deadline - performance.now()), "Runtime project path readiness");
    if (matched) return;
    await delay(Math.min(16, Math.max(0, deadline - performance.now())));
  }
  throw new Error("Runtime project path readiness timed out after 15000ms");
}

// Resize/viewport projection can replace a control while Playwright holds its
// previous element handle. Re-read only scroll/geometry; never replay a mutation.
export async function scrollRuntimeControlIntoView(locator, timeoutMs = 15000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    try {
      const visible = await withDeadline(locator.evaluate(element => new Promise(resolve => {
        element.scrollIntoView({block: "nearest", inline: "nearest"});
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const bounds = element.getBoundingClientRect();
          resolve(element.isConnected && bounds.width > 0 && bounds.height > 0 &&
            bounds.top >= 0 && bounds.bottom <= innerHeight && bounds.left >= 0 && bounds.right <= innerWidth);
        }));
      }), undefined, {timeout: Math.max(1, deadline - performance.now())}), Math.max(1, deadline - performance.now()), "Runtime control visibility");
      if (visible) return;
    } catch (error) {
      if (!/not attached|detached/i.test(String(error.message))) throw error;
    }
  }
  throw new Error(`Runtime control visibility timed out after ${timeoutMs}ms`);
}
