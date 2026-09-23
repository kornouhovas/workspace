import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("compact shell keeps native controls, workspace identity, and content on one stable row", async () => {
  const [appSource, sidebarSource, cssSource] = await Promise.all([
    readProjectFile("src/App.tsx"),
    readProjectFile("src/components/workspace/left-panel.tsx"),
    readProjectFile("src/styles.css"),
  ]);

  assert.match(cssSource, /--workspace-header-height:\s*4rem/);
  assert.match(cssSource, /--workspace-sidebar-width:\s*16rem/);
  assert.match(appSource, /workspace-current-name/);
  assert.match(appSource, /currentWorkspaceName/);
  assert.match(appSource, /h-\[var\(--workspace-header-height\)\]/);
  assert.doesNotMatch(appSource, /projectExpanded \? "h-\[113px\]" : "h-24"/);
  assert.match(appSource, /sidebarCollapsed \? "left-20"/);
  assert.match(appSource, /left-\[calc\(var\(--workspace-sidebar-width\)-2\.5rem\)\]/);
  assert.match(sidebarSource, /w-\[var\(--workspace-sidebar-width\)\]/);
  assert.match(sidebarSource, /pb-3 pt-1/);
});

test("Board owns both scroll axes, columns follow content, and visible counts are rendered", async () => {
  const boardSource = await readProjectFile("src/components/workspace/board-view.tsx");

  assert.match(boardSource, /workspace-board-scroll[^"\n]*overflow-auto/);
  assert.doesNotMatch(boardSource, /overflow-y-auto/);
  assert.doesNotMatch(boardSource, /grid h-full/);
  assert.match(boardSource, /workspace-board-column[^"\n]*self-start/);
  assert.match(boardSource, /data-workspace-column-count/);
  assert.match(boardSource, /aria-label=\{t\("board\.visibleCount"/);
  assert.match(boardSource, /\{column\.projects\.length\}/);
});

test("expanded project uses common compact headings and exposes a numeric file count accessibly", async () => {
  const detailSource = await readProjectFile("src/components/workspace/project-detail-panel.tsx");

  assert.match(detailSource, /top-\[var\(--workspace-header-height\)\]/);
  assert.match(detailSource, /left-\[var\(--workspace-sidebar-width\)\]/);
  assert.match(detailSource, /workspace-project-detail-heading[^"\n]*text-sm[^"\n]*font-medium/);
  assert.match(detailSource, /workspace-project-detail-content-inset/);
  assert.match(detailSource, /aria-label=\{t\("detail\.items"/);
  assert.match(detailSource, /\{displayedProject\.fileTree\.length\}/);
});

test("tabs and shared workspace menus use the compact component scale", async () => {
  const [viewTabsSource, projectTabsSource, menuStylesSource] = await Promise.all([
    readProjectFile("src/components/workspace/view-tabs.tsx"),
    readProjectFile("src/components/workspace/project-tabs.tsx"),
    readProjectFile("src/components/workspace/menu-styles.ts"),
  ]);

  for (const source of [viewTabsSource, projectTabsSource]) {
    assert.match(source, /!h-10/);
    assert.match(source, /gap-1/);
    assert.match(source, /h-8/);
    assert.doesNotMatch(source, /!h-14/);
  }
  assert.match(menuStylesSource, /min-h-8/);
  assert.doesNotMatch(menuStylesSource, /min-h-9/);
});
