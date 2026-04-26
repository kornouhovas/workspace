import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("app shell is not wrapped in a decorative browser frame", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.equal(html.includes("browser-frame"), false);
  assert.equal(html.includes("browser-bar"), false);
  assert.match(html, /<html lang="ru">/);
  assert.doesNotMatch(html, /<html lang="ru" class="app-loading">/);
  assert.match(html, /localStorage\.getItem\("sidebar-state"\) === "collapsed"/);
  assert.match(html, /document\.documentElement\.classList\.add\("app-loading", "sidebar-saved-collapsed"\)/);
  assert.match(html, /<div class="app-shell" id="appShell">/);
});

test("mobile layout keeps navigation as a left rail instead of a top bar", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sidebar\s*\{[\s\S]*position:\s*fixed/s);
  assert.match(css, /\.app-shell\s*\{[^}]*grid-template-columns:\s*280px minmax\(0,\s*1fr\)/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sidebar\s*\{[\s\S]*width:\s*280px/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.main\s*\{[\s\S]*margin-left:\s*280px/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sidebar-collapsed \.main\s*\{[\s\S]*margin-left:\s*0/s);
});

test("folder picker has one primary click target in the initial view", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.equal(html.match(/Choose folder/g)?.length, 1);
  assert.equal(html.includes("Refresh"), false);
  assert.equal(html.includes("refreshButton"), false);
  assert.equal(app.includes("refreshButton"), false);
  assert.equal(html.includes("emptyChooseButton"), false);
});

test("sidebar navigation exposes view state and mouse titles", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(app, /button\.dataset\.view = "workspace"/);
  assert.equal(html.includes('data-view="folders"'), false);
  assert.equal(html.includes('data-view="recent"'), false);
  assert.equal(html.includes('data-view="settings"'), false);
  assert.match(html, /id="sidebarToggle"[^>]*title="Скрыть меню"/);
});

test("collapsed sidebar fully hides the panel and leaves a return button", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(html, /id="sidebarReturn"/);
  assert.match(css, /\.app-shell\.sidebar-collapsed\s*\{[^}]*grid-template-columns:\s*0 minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.sidebar-saved-collapsed \.app-shell\s*\{[^}]*grid-template-columns:\s*0 minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.sidebar-collapsed \.sidebar\s*\{[^}]*visibility:\s*hidden/s);
  assert.match(css, /\.sidebar-saved-collapsed \.sidebar\s*\{[^}]*visibility:\s*hidden/s);
  assert.match(css, /\.icon-button\.sidebar-return\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.icon-button\.sidebar-return\s*\{[^}]*left:\s*26px/s);
  assert.match(css, /\.icon-button\.sidebar-return\s*\{[^}]*top:\s*26px/s);
  assert.match(css, /\.sidebar-collapsed \.icon-button\.sidebar-return\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.sidebar-saved-collapsed \.icon-button\.sidebar-return\s*\{[^}]*display:\s*grid/s);
  assert.doesNotMatch(css, /\.sidebar-collapsed \.main\s*\{[^}]*padding-top/s);
  assert.match(css, /\.sidebar-collapsed \.topbar-copy\s*\{[^}]*margin-left:\s*64px/s);
  assert.match(css, /\.app-loading \.app-shell\s*\{[^}]*transition:\s*none/s);
  assert.match(app, /document\.documentElement\.classList\.remove\("app-loading", "sidebar-saved-collapsed"\)/);
  assert.doesNotMatch(css, /\.sidebar-return span\s*\{[^}]*transform:\s*rotate/s);
});

test("left panel action buttons align on the same vertical rail", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.brand-row\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.brand-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 30px/s);
  assert.match(css, /\.sidebar-toggle\s*\{[^}]*width:\s*30px/s);
  assert.match(css, /\.sidebar-toggle\s*\{[^}]*min-height:\s*30px/s);
  assert.match(css, /\.workspace-list-head\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 30px/s);
  assert.match(css, /\.workspace-tab\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 30px/s);
});

test("left panel shows workspace tab controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(html, /class="workspace-tabs"/);
  assert.match(html, /id="addWorkspaceButton"/);
  assert.match(app, /function addWorkspace\(\)/);
  assert.match(app, /function deleteWorkspace\(workspaceId\)/);
  assert.match(app, /function isDefaultWorkspace\(workspace\)/);
  assert.match(app, /function getNextWorkspaceNumber\(\)/);
  assert.match(app, /name:\s*`Workspace \$\{getNextWorkspaceNumber\(\)\}`/);
  assert.match(css, /\.workspace-delete\s*\{[^}]*opacity:\s*0/s);
  assert.match(css, /\.workspace-tab:hover \.workspace-delete/s);
  assert.match(css, /\.workspace-tabs\s*\{[^}]*gap:\s*5px/s);
  assert.match(css, /\.workspace-list-head\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 30px/s);
  assert.match(css, /\.workspace-tab\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 30px/s);
});

test("workspace state is persisted across browser refresh", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(app, /const workspaceStorageKey = "workspaces-state"/);
  assert.match(app, /function loadWorkspaceState\(\)/);
  assert.match(app, /function saveWorkspaceState\(\)/);
  assert.match(app, /localStorage\.getItem\(workspaceStorageKey\)/);
  assert.match(app, /localStorage\.setItem\(workspaceStorageKey/);
  assert.match(app, /saveWorkspaceState\(\);\s*renderWorkspaceTabs\(\);/s);
  assert.match(app, /boardView:\s*"overview"/);
  assert.match(app, /statusOrder:\s*\[\]/);
  assert.match(app, /function getActiveBoardView\(\)/);
  assert.match(app, /function normalizeBoardView\(boardView\)/);
  assert.match(app, /function getActiveStatusOrder\(\)/);
  assert.match(app, /function saveStatusOrder\(statusOrder\)/);
});

test("saved workspace chrome is bootstrapped before app module hydration", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /function hydrateSavedWorkspaceState\(\)/);
  assert.match(html, /localStorage\.getItem\("workspaces-state"\)/);
  assert.match(html, /workspaceTitle\.textContent = activeWorkspace\.name/);
  assert.match(html, /workspaceTabs\.replaceChildren\(\.\.\.state\.workspaces\.map\(createInitialWorkspaceTab\)\)/);
  assert.match(html, /button\.dataset\.workspaceId = workspace\.id/);
});

test("folder board snapshot is persisted and bootstrapped before app module hydration", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(app, /const boardSnapshotStorageKey = "folder-board-snapshot"/);
  assert.match(app, /function saveBoardSnapshot\(\)/);
  assert.match(app, /localStorage\.setItem\(boardSnapshotStorageKey/);
  assert.match(html, /function hydrateSavedBoardSnapshot\(\)/);
  assert.match(html, /localStorage\.getItem\("folder-board-snapshot"\)/);
  assert.match(html, /localStorage\.getItem\("folder-board-snapshot"\)[\s\S]*document\.documentElement\.classList\.add\("app-loading"\)/);
  assert.match(html, /renderInitialFolders\(folderGrid, snapshot\.folders, boardView, statusOrder\)/);
  assert.match(html, /function getStoredStatusOrder\(state\)/);
  assert.match(html, /createInitialBoardColumns\(folders, statusOrder\)/);
  assert.match(html, /sidebarFolderCount\.textContent = String\(snapshot\.folders\.length\)/);
});

test("topbar exposes per-workspace board view modes instead of folder summary text", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(html, /id="boardViewSwitcher"/);
  assert.match(html, /data-board-view="overview"[^>]*>Overview</);
  assert.match(html, /data-board-view="board"[^>]*>Board</);
  assert.match(html, /data-board-view="table"[^>]*>Table</);
  assert.doesNotMatch(html, /id="totalFolders"/);
  assert.doesNotMatch(html, /id="rootLabel"/);
  assert.match(html, /function hydrateSavedBoardViewState\(\)/);
  assert.match(app, /function loadBoardView\(\)/);
  assert.match(app, /function saveBoardView\(\)/);
  assert.doesNotMatch(app, /const boardViewStorageKey = "board-view"/);
  assert.doesNotMatch(app, /localStorage\.setItem\(boardViewStorageKey, boardView\)/);
  assert.match(app, /workspace\.id === activeWorkspaceId \? \{ \.\.\.workspace, boardView \}/);
  assert.match(html, /activeWorkspace\.boardView/);
});

test("folder board supports overview board and table renderers", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(app, /function renderOverviewView\(visibleFolders\)/);
  assert.match(app, /function renderBoardView\(visibleFolders\)/);
  assert.match(app, /function renderTableView\(visibleFolders\)/);
  assert.match(app, /function createBoardColumn\(status, statusFolders\)/);
  assert.match(app, /function createTableRow\(folder\)/);
  assert.match(app, /createFolderCard\(folder, \{ showStatus: false \}\)/);
  assert.match(app, /"Name"/);
  assert.match(app, /"Status"/);
  assert.match(css, /\.folder-board-view\s*\{/);
  assert.match(css, /\.folder-board-view\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(245px,\s*1fr\)\)/s);
  assert.match(css, /\.folder-grid\s*\{[^}]*padding-top:\s*12px/s);
  assert.match(css, /\.folder-board-view\s*\{[^}]*padding-top:\s*12px/s);
  assert.match(css, /\.kanban-board\.board-mode\s*\{[^}]*margin-top:\s*-22px/s);
  assert.match(css, /\.kanban-board\.board-mode\s*\{[^}]*padding-top:\s*28px/s);
  assert.match(css, /\.board-column\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.board-column\s*\{[^}]*margin-top:\s*-22px/s);
  assert.match(css, /\.board-column\s*\{[^}]*padding-top:\s*22px/s);
  assert.match(css, /\.board-column-title\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.board-column-title\s*\{[^}]*top:\s*0/s);
  assert.match(css, /\.folder-board-view \.folder-card\s*\{[^}]*min-height:\s*0/s);
  assert.match(app, /boardSurface\.classList\.toggle\("board-mode", activeBoardView === "board"\)/);
  assert.match(css, /\.folder-table\s*\{/);
  assert.match(css, /\.folder-table\s*\{[^}]*margin-top:\s*-21px/s);
  assert.match(css, /\.folder-table-row\s*\{[^}]*border-bottom:/s);
  assert.match(css, /\.folder-table-row:not\(\.folder-table-head\):hover\s*\{[^}]*background:/s);
  assert.match(css, /\.folder-table-head\s*\{[^}]*font-size:\s*13px/s);
  assert.doesNotMatch(css, /\.folder-table-head\s*\{[^}]*text-transform:\s*uppercase/s);
  assert.doesNotMatch(css, /\.folder-table-row\s*\{[^}]*border-left:/s);
  assert.doesNotMatch(css, /\.folder-table-cell\s*\{[^}]*border-left:/s);
});

test("board columns can be reordered by dragging column titles", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(app, /let draggedStatus = null/);
  assert.match(app, /folderGrid\.addEventListener\("dragstart", handleBoardColumnDragStart\)/);
  assert.match(app, /folderGrid\.addEventListener\("dragover", handleBoardColumnDragOver\)/);
  assert.match(app, /folderGrid\.addEventListener\("drop", handleBoardColumnDrop\)/);
  assert.match(app, /function getPreviewStatusOrder\(event, targetColumn\)/);
  assert.match(app, /function getColumnInsertAfterTarget\(event, statuses, targetColumn\)/);
  assert.match(app, /function applyBoardColumnTitlePreview\(previewStatuses\)/);
  assert.match(app, /function clearBoardColumnTitlePreview\(\)/);
  assert.match(app, /function clearBoardColumnShiftPreview\(\)/);
  assert.match(app, /function clearBoardColumnDragState\(\)/);
  assert.match(app, /function createBoardColumnDragImage\(status\)/);
  assert.match(app, /function removeBoardColumnDragImage\(\)/);
  assert.match(app, /event\.dataTransfer\.setDragImage\(dragImage,/);
  assert.match(app, /requestAnimationFrame\(\(\) => title\.classList\.add\("is-drag-source-title"\)\)/);
  assert.match(app, /removeBoardColumnDragImage\(\);\s*renderFolders\(\);/s);
  assert.match(app, /title\.style\.setProperty\("--board-title-shift"/);
  assert.match(app, /title\.style\.removeProperty\("--board-title-shift"\)/);
  assert.match(app, /column\.dataset\.status === draggedStatus\)[\s\S]*title\.classList\.add\("is-drag-source-title"\)/);
  assert.match(app, /function handleBoardColumnDragLeave\(event\)[\s\S]*clearBoardColumnShiftPreview\(\)/);
  assert.match(app, /dragImage\.className = "board-column-drag-image"/);
  assert.match(app, /clearBoardColumnShiftPreview\(\);[\s\S]*title\.classList\.remove\("is-drag-source-title"\)/);
  assert.match(app, /targetRect\.left \+ targetRect\.width \* 0\.25/);
  assert.match(app, /targetRect\.right - targetRect\.width \* 0\.25/);
  assert.match(app, /function handleBoardColumnDragStart\(event\)/);
  assert.match(app, /function handleBoardColumnDragOver\(event\)/);
  assert.match(app, /function handleBoardColumnDrop\(event\)/);
  assert.match(app, /title\.draggable = true/);
  assert.match(app, /column\.dataset\.status = status/);
  assert.match(app, /function getOrderedStatuses\(visibleFolders\)/);
  assert.match(app, /saveStatusOrder\(reorderedStatuses\)/);
  assert.match(css, /\.board-column-title\s*\{[^}]*cursor:\s*grab/s);
  assert.doesNotMatch(css, /\.board-column-title\s*\{[^}]*pointer-events:\s*none/s);
  assert.doesNotMatch(css, /\.board-column\.is-drop-target/s);
  assert.doesNotMatch(app, /is-drop-target/);
  assert.match(css, /--board-title-shift:\s*0px/);
  assert.match(css, /\.board-column-title\.is-drag-source-title\s*\{[^}]*opacity:\s*0/s);
  assert.match(css, /\.board-column-drag-image\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /\.board-column-drag-image\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.board-column-drag-image\s*\{[^}]*background:\s*var\(--comment\)/s);
  assert.doesNotMatch(css, /\.board-column-drag-image\s*\{[^}]*rgba\(94,\s*168,\s*239/s);
  assert.match(css, /\.board-column-title\.is-preview-shift-left\s*\{[^}]*transform:\s*translateX\(calc\(-1 \* var\(--board-title-shift\)\)\)/s);
  assert.match(css, /\.board-column-title\.is-preview-shift-right\s*\{[^}]*transform:\s*translateX\(var\(--board-title-shift\)\)/s);
});

test("left panel collapsed state is persisted across browser refresh", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(app, /const sidebarStorageKey = "sidebar-state"/);
  assert.match(app, /function loadSidebarState\(\)/);
  assert.match(app, /function saveSidebarState\(collapsed\)/);
  assert.match(app, /localStorage\.getItem\(sidebarStorageKey\)/);
  assert.match(app, /localStorage\.setItem\(sidebarStorageKey/);
  assert.match(app, /setSidebarCollapsed\(loadSidebarState\(\), false\)/);
});

test("left panel can be toggled with command or control plus b", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(app, /window\.addEventListener\("keydown", handleSidebarShortcut\)/);
  assert.match(app, /function handleSidebarShortcut\(event\)/);
  assert.match(app, /event\.key\.toLowerCase\(\) !== "b"/);
  assert.match(app, /!\(event\.metaKey \|\| event\.ctrlKey\)/);
  assert.match(app, /event\.preventDefault\(\)/);
  assert.match(app, /setSidebarCollapsed\(!appShell\.classList\.contains\("sidebar-collapsed"\)\)/);
  assert.match(app, /function isEditableShortcutTarget\(target\)/);
});

test("topbar title mirrors and edits the active workspace name", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(css, /--content-x:\s*26px/);
  assert.match(css, /\.main\s*\{[^}]*padding:\s*26px var\(--content-x\) 22px/s);
  assert.match(html, /class="topbar-copy"/);
  assert.match(html, /id="boardViewSwitcher"/);
  assert.match(html, /id="workspaceTitleButton"/);
  assert.match(html, /id="workspaceTitleEditButton"/);
  assert.match(html, /id="workspaceTitleInput"/);
  assert.match(app, /pageTitle\.textContent = getActiveWorkspace\(\)\.name/);
  assert.match(app, /function renameWorkspace\(workspaceId, name\)/);
  assert.match(app, /function startWorkspaceRename\(\)/);
  assert.match(app, /function commitWorkspaceRename\(\)/);
  assert.match(css, /\.workspace-title-row:hover \.title-edit-button/s);
  assert.match(css, /\.workspace-title-row:hover \.workspace-title-button/s);
  assert.match(css, /\.workspace-title-row:focus-within \.workspace-title-button/s);
  assert.match(css, /\.workspace-title-button\s*\{[^}]*padding:\s*4px 12px/s);
  assert.match(css, /\.workspace-title-input\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.045\)/s);
  assert.match(css, /\.workspace-title-input\s*\{[^}]*padding:\s*4px 8px/s);
  assert.match(css, /\.board-view-switcher\s*\{[^}]*margin-left:\s*0/s);
  assert.match(css, /\.board-view-option\s*\{[^}]*padding:\s*4px 12px/s);
  assert.match(css, /\.folder-card\s*\{[^}]*padding:\s*12px/s);
  assert.match(css, /\.folder-card h2\s*\{[^}]*font-size:\s*14px/s);
});

test("board status line is not visible in the app chrome", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(html, /id="statusLine"[^>]*hidden/);
  assert.equal(app.includes("Showing ${folders.length} folders across"), false);
});

test("kanban scroll area leaves room for lifted folder-card hover", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.folder-card:hover\s*\{[^}]*transform:\s*translateY\(-1px\)/s);
  assert.match(css, /\.kanban-board\s*\{[^}]*padding:\s*[1-9]\d*px 4px 18px 0/s);
});

test("folder card renders only the folder name and its status tag", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.equal(app.includes("Direct child"), false);
  assert.equal(app.includes("Saved from the selected parent folder"), false);
  assert.equal(app.includes("mini-folder"), false);
  assert.equal(app.includes("<span class=\"folder-tag\">Folder</span>"), false);
  assert.match(app, /function createFolderCard\(folder, options = \{\}\)/);
  assert.match(app, /if \(options\.showStatus === false\)/);
  assert.match(app, /tag\.textContent = folder\.status/);
});

test("folder status tag is anchored to the bottom of the card", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.folder-card\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/s);
  assert.match(css, /\.card-meta\s*\{[^}]*grid-row:\s*3/s);
  assert.match(css, /\.card-meta\s*\{[^}]*align-self:\s*end/s);
});
