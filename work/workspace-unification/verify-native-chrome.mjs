import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
const run = promisify(execFile);
const evidence = resolve('work/workspace-unification/native');
await mkdir(evidence, { recursive: true });
const { fixture } = JSON.parse(await readFile('work/workspace-unification/features/report.json', 'utf8'));
const report = { checks: [], captures: [] };
for (const [width, height] of [[1440, 960], [1024, 720]]) {
  const app = await electron.launch({ args: ['electron/main.js'], cwd: process.cwd(), env: { ...process.env, WORKSPACE_DEV: '1', WORKSPACE_DEV_DATA: join(fixture, `metadata-${width}`), WORKSPACE_DEV_URL: '' } });
  try {
    const page = await app.firstWindow();
    await page.locator('[data-pane-id="renamed-pane"]').waitFor();
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setBounds({ x: 0, y: 39, ...size }), { width, height });
    await page.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, { width, height });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => localStorage.setItem('workspace.theme', theme), theme); await page.reload();
      const toggle = page.locator('[data-sidebar-toggle]'); await toggle.waitFor();
      await expect.poll(() => page.locator('html').evaluate(element => element.classList.contains('dark'))).toBe(theme === 'dark');
      if (await page.locator('[data-sidebar-collapsed]').getAttribute('data-sidebar-collapsed') === 'true') await toggle.click();
      await app.evaluate(({ app, BrowserWindow }) => { app.focus({ steal: true }); BrowserWindow.getAllWindows()[0].focus(); });
      await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFocused())).toBe(true);
      const bounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
      const box = await toggle.boundingBox(); assert.ok(box);
      const x = String(bounds.x + box.x + box.width / 2), y = String(bounds.y + box.y + box.height / 2);
      await run('swift', ['work/workspace-unification/native-click.swift', String(app.process().pid), x, y]);
      await expect(page.locator('[data-sidebar-collapsed]')).toHaveAttribute('data-sidebar-collapsed', 'true');
      await page.evaluate(async () => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
      await app.evaluate(({ app, BrowserWindow }) => { app.focus({ steal: true }); BrowserWindow.getAllWindows()[0].focus(); });
      const restoreBox = await toggle.boundingBox();
      await run('swift', ['work/workspace-unification/native-click.swift', String(app.process().pid), String(bounds.x + restoreBox.x + restoreBox.width / 2), String(bounds.y + restoreBox.y + restoreBox.height / 2)]);
      await expect(page.locator('[data-sidebar-collapsed]')).toHaveAttribute('data-sidebar-collapsed', 'false');
      assert.deepEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds()), bounds, 'titlebar action must click instead of dragging the native window');
      const path = join(evidence, `split-${theme}-${width}x${height}.png`);
      const { stdout } = await run('swift', ['work/workspace-6fh/capture-window.swift', String(app.process().pid), path]);
      assert.match(stdout, new RegExp(`pixels ${width} ${height}`));
      report.captures.push({ theme, width, height, pid: app.process().pid, bounds, path: path.slice(process.cwd().length + 1), nativeOutput: stdout });
      report.checks.push(`${width}x${height} ${theme}: macOS CGEvent sidebar hide/restore through titlebar; no window drag; native window capture`);
    }
  } finally { await app.close(); await writeFile(join(evidence, 'report.json'), JSON.stringify(report, null, 2)); }
}
console.log(`Native chrome checks passed: ${report.checks.length}`);
