/* global HTMLElement, requestAnimationFrame, innerHeight, document */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron} from 'playwright-core';
import {waitForRuntimeRecoverySource} from '../scripts/runtime-recovery-readiness.mjs';
import {waitForRuntimeProjectPath,scrollRuntimeControlIntoView,showRuntimeProject} from '../scripts/runtime-project-visibility.mjs';

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
    await page.setContent('<div style="height:1500px"></div><button id="resized-control">Current owned control</button>');
    await page.evaluate(() => {
      globalThis.scrollAttempts = 0;
      const original = HTMLElement.prototype.scrollIntoView;
      HTMLElement.prototype.scrollIntoView = function (...args) {
        globalThis.scrollAttempts++;
        original.apply(this, args);
        if (globalThis.scrollAttempts === 1) requestAnimationFrame(() => { this.replaceWith(this.cloneNode(true)); });
      };
    });
    await scrollRuntimeControlIntoView(page.locator('#resized-control'));
    assert.ok(await page.evaluate(() => globalThis.scrollAttempts >= 2));
    assert.equal(await page.locator('#resized-control').evaluate(element => element.isConnected && element.getBoundingClientRect().bottom <= innerHeight), true);

    // A grouping command can resolve while the old owned row still exists.
    // Visit the current group, not that old occurrence, before expecting fields.
    await page.setContent('<section role="region" aria-label="Name"><div data-project-id="project" id="old">Old occurrence</div></section>');
    await page.evaluate(() => {
      globalThis.window.workspace.workspace = async input => ({ok:true,value:input.type==='workspace.load'
        ? {activeWorkspace:{workspaceId:'workspace'}}
        : {projects:[{projectId:'project',name:'Target',relativePath:'C/Target'}],retainedProjects:[]}});
      setTimeout(() => { document.body.innerHTML='<section role="region" aria-label="C"><div style="height:1500px"></div><div data-project-id="project" id="current">Current occurrence</div></section>'; },100);
    });
    await showRuntimeProject(page,'Target','project','C');
    assert.equal(await page.locator('#current').evaluate(element=>element.getBoundingClientRect().bottom<=innerHeight),true);

    // A selected Sources tab precedes the asynchronous source list response.
    await page.setContent('<div role="tab" aria-selected="true">Sources</div><section class="settings-page"><p>Loading</p></section>');
    await page.evaluate(() => {
      setTimeout(() => { document.querySelector('.settings-page').innerHTML='<button aria-label="/owned/source">/owned/source</button>'; }, 100);
    });
    await waitForRuntimeRecoverySource(page, '/owned/source');
    assert.equal(await page.getByRole('button', {name:'/owned/source', exact:true}).isVisible(), true);

  } catch (error) {primary = error;}
  try {await app.close(); await rm(profile, {recursive: true, force: true});}
  catch (error) {primary ??= error;}
  if (primary) throw primary;
});
