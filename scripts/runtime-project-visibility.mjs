import assert from "node:assert/strict";

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
