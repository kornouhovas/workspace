import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron} from 'playwright-core';
import {waitForRuntimeProjectPath} from '../scripts/runtime-project-visibility.mjs';

test('runtime path readiness awaits false async reads and binds the committed workspace/project/path', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'runtime-path-readiness-'));
  const app = await _electron.launch({executablePath: createRequire(import.meta.url)('electron'),
    args: [fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs', import.meta.url))],
    env: {...process.env, WORKSPACE_RENAME_EDITOR_PROFILE: profile}, timeout: 10000});
  let primary;
  try {
    const page = await app.firstWindow();
    const url = await app.evaluate(() => globalThis.renameEditorInitialLoad);
    await page.waitForURL(url, {waitUntil: 'load'});
    await page.evaluate(() => {
      globalThis.readiness = {reads: 0, active: 0, maximum: 0};
      globalThis.window.workspace = {workspace: async input => {
        const state = globalThis.readiness;
        state.reads++; state.active++; state.maximum = Math.max(state.maximum, state.active);
        await new Promise(resolve => setTimeout(resolve, 5));
        const projects = state.reads === 1 ? [{projectId: 'project', relativePath: 'A/Alpha'}]
          : state.reads === 2 ? [{projectId: 'other', relativePath: 'A/Target'}]
          : [{projectId: 'project', relativePath: 'A/Target'}];
        state.active--;
        return {ok: true, value: {workspaceId: input.workspaceId, projects}};
      }};
    });
    await waitForRuntimeProjectPath(page, 'workspace', 'project', 'A/Target');
    assert.deepEqual(await page.evaluate(() => globalThis.readiness), {reads: 3, active: 0, maximum: 1});
    await page.evaluate(() => {
      globalThis.readiness.reads = 0;
      globalThis.window.workspace.workspace = async () => ({ok: true, value: {
        workspaceId: ++globalThis.readiness.reads === 1 ? 'other-workspace' : 'workspace',
        projects: [{projectId: 'project', relativePath: 'C/Target'}],
      }});
    });
    await waitForRuntimeProjectPath(page, 'workspace', 'project', 'C/Target');
    assert.equal(await page.evaluate(() => globalThis.readiness.reads), 2);
  } catch (error) {primary = error;}
  try {await app.close(); await rm(profile, {recursive: true, force: true});}
  catch (error) {primary ??= error;}
  if (primary) throw primary;
});
