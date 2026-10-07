import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from '@playwright/test';
import { createWorkspaceIpcHandler } from '../electron/workspaceIpc.js';

const directory = await mkdtemp(join(tmpdir(), 'workspace-board-bounds-'));
const source = join(directory, 'source');
const output = resolve('work/board-card-overlap');
await mkdir(output, { recursive: true });
const names = ['АльфаАсфальт. Контроль вращения валов — длинное название проекта', 'Город', 'Обслуживание'];
for (let index = 0; index < names.length; index++) {
  const folder = join(source, `Status ${index}`, names[index]);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'fixture.txt'), 'isolated test');
}
const handler = createWorkspaceIpcHandler({ configPath: join(directory, 'settings.json'), viewStorePath: join(directory, 'views.json'), propertyStorePath: join(directory, 'properties.json'), chooseRoot: async () => source });
const workspaceId = (await handler(null, 'workspace.setRoot', {})).root.workspaceId;
const call = (method, payload = {}) => handler(null, `workspace.${method}`, { workspaceId, ...payload });
for (let index = 0; index < names.length; index++) await call('updateFolderRole', { path: `Status ${index}`, role: 'status' });
const text = (await call('createProperty', { name: 'Text', type: 'text' })).property.id;
const projection = await call('getViewProjection', { viewId: 'view:default-board' });
for (const project of projection.projection.columns.flatMap(column => column.projects)) await call('updateProjectPropertyValue', { projectId: project.id, propertyId: text, value: 'VeryLongUnbrokenPropertyValue'.repeat(8) });
await call('updateView', { viewId: 'view:default-board', patch: { visiblePropertyIds: ['property:name', 'property:status', text] } });
const app = await _electron.launch({ args: ['electron/main.js'], cwd: process.cwd(), env: { ...process.env, WORKSPACE_DEV: '1', WORKSPACE_DEV_DATA: directory } });
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.workspace-board-card');
  for (const [width, height] of [[1440, 960], [1024, 720]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    for (const wrap of [false, true]) {
      const active = !!await page.locator('[data-workspace-board-wrap]').count();
      if (active !== wrap) {
        await page.locator('[data-workspace-column-header]').first().click({ button: 'right' });
        await page.getByRole('menuitemcheckbox', { name: /Wrap content|Перенос содержимого/ }).click();
        await page.waitForFunction(wrap => !!document.querySelector('[data-workspace-board-wrap]') === wrap, wrap);
      }
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const bounds = await page.locator('.workspace-board-column').evaluateAll(columns => columns.map(column => ({ column: column.getBoundingClientRect().toJSON(), cards: [...column.querySelectorAll('.workspace-board-card')].map(card => card.getBoundingClientRect().toJSON()) })));
      await writeFile(join(output, `${width}-${height}-${wrap}.json`), JSON.stringify(bounds, null, 2));
      await page.screenshot({ path: join(output, `${width}-${height}-${wrap}.png`) });
      for (const group of bounds) for (const card of group.cards) {
        assert.ok(card.left >= group.column.left, 'card left stays inside its column');
        assert.ok(card.right <= group.column.right, `card right ${card.right} exceeds column right ${group.column.right}`);
      }
      console.log(`${width}x${height} wrap=${wrap}: PASS`);
    }
  }
} finally {
  await app.close();
  await rm(directory, { recursive: true, force: true });
}
