import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createWorkspaceIpcHandler } from '../../electron/workspaceIpc.js';

const evidence = resolve('work/project-close-to-view');
const fixture = await mkdtemp(join(tmpdir(), 'workspace-close-to-view-'));
const root = join(fixture, 'projects');
const metadata = join(fixture, 'metadata');
for (const name of ['Alpha', 'Beta']) await mkdir(join(root, 'Active', `Project ${name}`), { recursive: true });
const handler = createWorkspaceIpcHandler({ configPath: join(metadata, 'settings.json'), viewStorePath: join(metadata, 'views.json'), propertyStorePath: join(metadata, 'properties.json'), chooseRoot: async () => root });
const initial = await handler(null, 'workspace.setRoot');
const workspaceId = initial.root.workspaceId;
const report = { fixture, checks: [], windows: [], errors: [] };
let app;
let page;
const launch = async () => {
  app = await electron.launch({ args: ['electron/main.js'], cwd: process.cwd(), env: { ...process.env, WORKSPACE_DEV: '1', WORKSPACE_DEV_DATA: metadata, WORKSPACE_DEV_URL: '' } });
  page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push(error.message));
};
const settle = () => page.waitForTimeout(400);
const right = () => page.getByTestId('workspace-right-panel');
const check = name => report.checks.push(name);
const open = async name => { await page.getByRole('button', { name: `Project ${name}`, exact: true }).click(); await page.getByRole('dialog', { name: `Project ${name}`, exact: true }).waitFor(); };
const expand = async () => { await right().getByRole('button', { name: /^Maximize pane/ }).click(); await page.locator('.workspace-project-detail-expanded').waitFor(); };
const close = async () => { await page.getByRole('button', { name: 'Close project details', exact: true }).last().click(); await settle(); };
const closed = async view => {
  assert.equal(await page.getByRole('tab', { name: view, exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await right().getAttribute('data-open'), 'false');
  assert.equal(await right().evaluate(el => el.getBoundingClientRect().width), 0);
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.locator('.bb-navigation,.bb-new-tab').count(), 0);
  assert.equal(await page.getByTestId('workspace-main').isVisible(), true);
};
try {
  await launch();
  await page.getByRole('button', { name: 'Project Alpha', exact: true }).waitFor();
  const security = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(security.contextIsolation, true); assert.equal(security.nodeIntegration, false); assert.equal(security.sandbox, true);
  check('Existing Electron preload security settings preserved');
  for (const size of [[1440, 960], [1024, 720]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), size);
    report.windows.push(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds()));
    await open('Alpha'); await expand(); await close(); await closed('Board');
    await page.screenshot({ path: join(evidence, `closed-board-${size.join('x')}.png`) });
    check(`Fullscreen X returns to Board with no right host at ${size.join('x')}`);
    await open('Alpha'); await expand();
    await page.getByRole('tab', { name: 'Board', exact: true }).click();
    await open('Beta'); await expand(); await close(); await closed('Board');
    assert.equal(await page.locator('[data-project-tab-id]').count(), 1);
    await page.getByRole('tab', { name: 'Project Alpha', exact: true }).click();
    await page.locator('.workspace-project-detail-expanded').waitFor();
    await page.getByRole('button', { name: 'Restore side panel', exact: true }).click();
    await settle(); assert.equal(await right().getAttribute('data-open'), 'true');
    assert.equal(await page.locator('[data-project-tab-id]').count(), 0);
    await page.screenshot({ path: join(evidence, `restored-preview-${size.join('x')}.png`) });
    await right().getByRole('button', { name: 'Close project preview', exact: true }).click(); await settle(); await closed('Board');
    check(`Multiple-tab close keeps other tab; Restore retains partial preview; preview Close hides host at ${size.join('x')}`);
    await page.getByRole('tab', { name: 'Table', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Project Alpha' }).click();
    await page.getByRole('dialog', { name: 'Project Alpha', exact: true }).waitFor();
    await expand(); await close(); await closed('Table');
    check(`Fullscreen X returns to selected Table at ${size.join('x')}`);
    await page.getByRole('tab', { name: 'Board', exact: true }).click(); await settle(); await closed('Board');
  }
  // Old navigation/launcher session entries must not become an empty host.
  await page.evaluate(workspaceId => {
    const layouts = JSON.parse(localStorage.getItem('workspace.pane-layout.v1'));
    layouts.layouts[workspaceId] = { ...layouts.layouts[workspaceId], rightVisible: true, rightTabs: ['launcher'], activeRightTab: 'launcher', focused: 'right', maximized: 'right' };
    localStorage.setItem('workspace.pane-layout.v1', JSON.stringify(layouts));
  }, workspaceId);
  await page.reload(); await page.getByRole('button', { name: 'Project Alpha', exact: true }).waitFor(); await settle(); await closed('Board');
  await page.keyboard.press('Meta+j'); await page.keyboard.press('Meta+t'); await settle(); await closed('Board');
  check('Legacy launcher/session and obsolete Cmd+J/Cmd+T cannot reopen Navigation or an empty host');
  await open('Alpha'); await expand(); await page.getByRole('tab', { name: 'Board', exact: true }).click();
  await open('Beta'); await expand(); await close(); await closed('Board');
  await app.close(); app = null;
  await launch(); await page.getByRole('button', { name: 'Project Alpha', exact: true }).waitFor(); await settle(); await closed('Board');
  assert.equal(await page.locator('[data-project-tab-id]').count(), 1);
  check('Actual Electron restart restores Board/closed preview and preserves inactive project tab');
  await open('Beta'); await expand(); await close(); await closed('Board');
  await page.keyboard.press('Meta+Shift+t'); await page.locator('.workspace-project-detail-expanded').waitFor();
  assert.equal(await page.locator('[data-project-tab-id]').count(), 2);
  await page.keyboard.press('Meta+w'); await settle(); await closed('Board');
  check('Reopen restores closed project tab; Cmd+W closes active fullscreen project back to view');
  // Restore a split layout through the same validated renderer-session boundary.
  await page.evaluate(workspaceId => {
    const tabs = JSON.parse(localStorage.getItem('workspace.project-tabs.v1')).tabs[workspaceId];
    const layouts = JSON.parse(localStorage.getItem('workspace.pane-layout.v1'));
    layouts.layouts[workspaceId] = { ...layouts.layouts[workspaceId], rightVisible: false, focused: 'workspace', maximized: null, tree: { type: 'split', dir: 'row', sizes: [0.5, 0.5], children: [{ type: 'pane', paneId: 'workspace', tabId: null }, { type: 'pane', paneId: 'alpha-pane', tabId: tabs[0].tabId }] } };
    localStorage.setItem('workspace.pane-layout.v1', JSON.stringify(layouts));
  }, workspaceId);
  await page.reload(); await page.locator('[data-pane-id="alpha-pane"]').waitFor();
  await open('Beta'); await settle(); assert.equal(await right().getAttribute('data-open'), 'true');
  assert.equal(await page.locator('[data-pane-id="alpha-pane"]').count(), 1);
  await right().getByRole('button', { name: 'Close project preview', exact: true }).click(); await settle();
  assert.equal(await right().getAttribute('data-open'), 'false');
  assert.equal(await page.locator('[data-pane-id="alpha-pane"]').count(), 1);
  check('Split project pane survives opening and closing an independent right preview');
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  if (page) await page.screenshot({ path: join(evidence, 'failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (app) await app.close();
  await writeFile(join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
