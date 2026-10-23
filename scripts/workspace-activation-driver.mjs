import assert from 'node:assert/strict';
import {waitForSelectedRuntimeWorkspace} from './runtime-settings.mjs';
// Fixture setup must cross the public backend, then its corresponding UI state.
export async function activateWorkspaceFixture(page, workspace) {
  const result = await page.evaluate(workspaceId => globalThis.workspace.workspace({type:'workspace.activate',workspaceId}),workspace.workspaceId);
  assert.equal(result.ok,true,JSON.stringify(result));
  await waitForSelectedRuntimeWorkspace(page,workspace);
  return result.value;
}
