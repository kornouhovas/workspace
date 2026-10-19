import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";
import {withDeadline} from "./runtime-lifecycle.mjs";

// Visit the real owned row before expecting viewport-loaded fields. This only
// scrolls; callers retain their exact control/value checks and original deadlines.
export async function showRuntimeProject(page, name, projectId) {
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
  await page.locator(`[data-project-id="${matches[0].projectId}"]`).first().scrollIntoViewIfNeeded();
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
