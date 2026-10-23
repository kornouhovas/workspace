import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { _electron } from 'playwright-core';
import { closeElectron } from '../scripts/runtime-lifecycle.mjs';
import { activateProjectContextAction } from '../scripts/project-context-driver.mjs';

test('contextual rename sends one keyboard activation after the real control becomes enabled', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'workspace-context-entry-'));
  const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'),
    args: [fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs', import.meta.url))],
    env: { ...process.env, WORKSPACE_RENAME_EDITOR_PROFILE: profile } });
  const child = app.process();
  let failure;
  try {
    const page = await app.firstWindow();
    const url = await app.evaluate(() => globalThis.renameEditorInitialLoad);
    await page.waitForURL(url, { waitUntil: 'load' });
    page.setDefaultTimeout(1500);
    await page.setContent('<button disabled>Rename project folder</button><div id="result"></div>');
    await page.evaluate(() => {
      const button = globalThis.document.querySelector('button');
      globalThis.activations = 0;
      button.addEventListener('click', () => {
        globalThis.activations++;
        globalThis.document.querySelector('#result').innerHTML = '<div role="dialog" aria-label="Rename project folder"><label>Name<input></label></div>';
      });
      globalThis.setTimeout(() => { button.disabled = false; }, 500);
    });
    const rename = page.getByRole('button', { name: 'Rename project folder', exact: true });
    await activateProjectContextAction(page, rename);
    await page.getByRole('dialog', { name: 'Rename project folder', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => globalThis.activations), 1);

    await page.setContent('<button disabled>Rename project folder</button>');
    await page.evaluate(() => {
      globalThis.activations = 0;
      globalThis.document.querySelector('button').addEventListener('click', () => globalThis.activations++);
    });
    page.setDefaultTimeout(100);
    await assert.rejects(activateProjectContextAction(page, rename), /Timeout/);
    assert.equal(await page.evaluate(() => globalThis.activations), 0);
  } catch (error) { failure = error; }
  try {
    await closeElectron(app);
    assert.ok(child.exitCode !== null || child.signalCode !== null);
    await rm(profile, { recursive: true, force: true });
  } catch (error) { failure ??= error; }
  if (failure) throw failure;
});
