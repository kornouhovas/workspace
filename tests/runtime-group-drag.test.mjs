/* global document */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron} from 'playwright-core';
import {dragRuntimeGroup} from '../scripts/runtime-group-drag.mjs';

test('native group drag positions both endpoints before pressing the source near a scroll boundary', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'runtime-group-drag-'));
  const app = await _electron.launch({executablePath: createRequire(import.meta.url)('electron'),
    args: [fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs', import.meta.url))],
    env: {...process.env, WORKSPACE_RENAME_EDITOR_PROFILE: profile}, timeout: 10000});
  let primary;
  try {
    const page = await app.firstWindow();
    await page.waitForURL(await app.evaluate(() => globalThis.renameEditorInitialLoad));
    await page.setViewportSize({width: 1440, height: 960});
    await page.setContent(`<style>body{margin:0}</style><main style="height:960px;overflow:auto">
      <div style="height:900px"></div><button id="source" draggable="true" style="height:40px;width:200px">Alpha</button>
      <div style="height:140px"></div><h3 id="target">Target</h3><div style="height:900px"></div></main>`);
    await page.evaluate(() => {
      const area = document.querySelector('main');
      globalThis.gesture = {starts: 0, drops: 0, payload: null, pressedScroll: null, droppedScroll: null};
      document.querySelector('#source').addEventListener('mousedown', () => {globalThis.gesture.pressedScroll = area.scrollTop;});
      document.querySelector('#source').addEventListener('dragstart', event => {
        globalThis.gesture.starts++; event.dataTransfer.setData('text/plain', 'Alpha');
      });
      document.querySelector('#target').addEventListener('dragover', event => event.preventDefault());
      document.querySelector('#target').addEventListener('drop', event => {
        event.preventDefault(); globalThis.gesture.drops++;
        globalThis.gesture.payload = event.dataTransfer.getData('text/plain');
        globalThis.gesture.droppedScroll = area.scrollTop;
      });
    });
    await dragRuntimeGroup(page.locator('#source'), page.locator('#target'));
    const result = await page.evaluate(() => globalThis.gesture);
    assert.equal(result.starts, 1, 'The real native drag starts');
    assert.equal(result.drops, 1, 'The real native payload reaches Target exactly once');
    assert.equal(result.payload, 'Alpha');
    assert.equal(result.pressedScroll, result.droppedScroll, 'Scrolling finishes before mouse-down');
  } catch (error) {primary = error;}
  try {await app.close(); await rm(profile, {recursive: true, force: true});}
  catch (error) {primary ??= error;}
  if (primary) throw primary;
});
