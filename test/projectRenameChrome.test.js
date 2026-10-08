import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPaneLayout } from '../src/workspacePaneLayout.js';

// A restored text trigger, a missing chrome slot or an action after Maximize
// breaks the observable project action contract in the real rendered hosts.
test('project rename is an accessible icon directly before maximize in preview and split chrome', async () => {
  const folder = await mkdtemp(resolve('test/.project-rename-chrome-'));
  const savedWindow = globalThis.window;
  try {
    globalThis.window = { innerWidth: 1440 };
    await build({ stdin: { contents: `export { ProjectRenameAction } from '@/components/workspace/project-rename-action'; export { WorkspaceRightPanel } from '@/components/workspace/pane-chrome'; export { WorkspaceSplitTree } from '@/components/workspace/split-tree'; export { I18nProvider } from '@/i18n'; export { TooltipProvider } from '@/components/ui/tooltip';`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { '@': resolve('src') }, outfile: resolve(folder, 'chrome.mjs') });
    const { ProjectRenameAction, WorkspaceRightPanel, WorkspaceSplitTree, I18nProvider, TooltipProvider } = await import(pathToFileURL(resolve(folder, 'chrome.mjs')));
    const action = React.createElement(ProjectRenameAction, { name: 'Alpha', relativePath: 'Active/Alpha', disabled: false, onRename: async () => {} });
    const render = child => renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(TooltipProvider, null, child)));
    const trigger = render(action);
    assert.match(trigger, /<button[^>]*class="bb-chrome-action electron-window-no-drag"[^>]*aria-label="Rename project"/);
    assert.match(trigger, /<svg[^>]*aria-hidden="true"/);
    assert.doesNotMatch(trigger, />Rename project<\/button>/);
    const base = createPaneLayout();
    const preview = render(React.createElement(WorkspaceRightPanel, { previewIdentity: 'fixture', layout: { ...base, rightVisible: true }, send() {}, navigation: null, project: React.createElement('div', null, 'Properties'), projectName: 'Alpha', projectActions: action, onCloseProject() {}, onMaximizeProject() {} }));
    const split = render(React.createElement(WorkspaceSplitTree, { layout: { ...base, tree: { type: 'pane', paneId: 'project-pane', tabId: 'alpha-tab' } }, send() {}, primary: null, renderProject: () => React.createElement('div', null, 'Properties'), renderProjectActions: () => action, titleForPane: () => 'Alpha', onClosePane() {}, onPaneFocus() {} }));
    for (const html of [preview, split]) {
      const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1];
      assert.ok(header);
      assert.match(header, /aria-label="Rename project"/);
      assert.match(header, /aria-label="Maximize pane/);
      assert.ok(header.indexOf('aria-label="Rename project"') < header.indexOf('aria-label="Maximize pane'));
      assert.equal((html.match(/aria-label="Rename project"/g) || []).length, 1);
    }
  } finally { globalThis.window = savedWindow; await rm(folder, { recursive: true, force: true }); }
});
