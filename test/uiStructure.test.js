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

test("folder picker is only exposed from settings", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.equal(html.includes("id=\"chooseFolderButton\""), false);
  assert.equal(html.includes("Choose folder"), false);
  assert.equal(app.includes("chooseFolderButton"), false);
  assert.match(app, /changeButton\.textContent = selectedHandle \? "Change" : "Choose folder"/);
  assert.equal(html.includes("Refresh"), false);
  assert.equal(html.includes("refreshButton"), false);
  assert.equal(app.includes("refreshButton"), false);
  assert.equal(html.includes("emptyChooseButton"), false);
});

test("settings access view exposes folder picker and recursive access tree controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(html, /id="settingsNavButton"/);
  assert.match(html, /data-view="settings"/);
  assert.match(html, /id="workspaceTabs"[\s\S]*id="settingsNavButton"/);
  assert.equal(html.includes("Selected root"), false);
  assert.equal(html.includes("sidebarRootName"), false);
  assert.doesNotMatch(html, /sidebar-footer-nav/);
  assert.match(css, /\.workspace-tools\s*\{[^}]*border-top:\s*1px solid var\(--line-soft\)[^}]*padding-top:\s*20px/s);
  assert.doesNotMatch(css, /\.workspace-tools\s*\{[^}]*border-bottom/s);
  assert.match(html, /id="settingsViewSwitcher"/);
  assert.match(html, />Access</);
  assert.match(app, /settingsViewSwitcher\.hidden = false/);
  assert.match(app, /import \{[^}]*listFolderAccessTree[^}]*flattenAccessTreeCards[^}]*\} from "\.\/src\/folderModel\.js"/s);
  assert.match(app, /const folderAccessRulesStorageKey = "folder-access-rules"/);
  assert.match(app, /let folderAccessTree = \[\]/);
  assert.match(app, /settingsNavButton\.addEventListener\("click",/);
  assert.match(app, /function renderSettingsView\(\)/);
  assert.match(app, /function createSettingsAccessTree\(tree\)/);
  assert.match(app, /function createSettingsTreeRow\(node, depth\)/);
  assert.match(app, /function isAccessNodeInsideCard\(path\)/);
  assert.match(app, /function handleSettingsTreeClick\(event\)/);
  assert.match(app, /function setFolderAccessRule\(path, rule\)/);
  assert.match(app, /flattenAccessTreeCards\(folderAccessTree/);
  assert.match(app, /listFolderAccessTree\(selectedHandle,/);
  assert.match(app, /const folderRoleLabels = \{/);
  assert.match(app, /status:\s*"STATUS"/);
  assert.match(app, /card:\s*"CARD"/);
  assert.match(app, /group:\s*"GROUP"/);
  assert.match(app, /input\.type = "checkbox"/);
  assert.match(app, /button\.className = "settings-tree-chevron"/);
  assert.match(app, /function createSettingsRoleOptions\(node, isLockedInsideCard\)/);
  assert.match(app, /roleButton\.className = "settings-tree-role-option"/);
  assert.match(app, /roleButton\.dataset\.role = role/);
  assert.match(app, /roleButton\.disabled = isLockedInsideCard/);
  assert.match(app, /action === "set-role"/);
  assert.match(css, /\.settings-view\s*\{/);
  assert.match(css, /\.settings-root-card\s*\{/);
  assert.match(css, /\.settings-tree-row\s*\{/);
  assert.match(css, /\.settings-tree-checkbox\s*\{/);
  assert.match(css, /\.settings-tree-role-options\s*\{/);
  assert.match(css, /\.settings-tree-role-option\.is-status\s*\{/);
  assert.match(css, /\.settings-tree-role-option\.is-card\s*\{/);
  assert.match(css, /\.settings-tree-role-option\.is-group\s*\{/);
  assert.match(css, /\.board-view-switcher\[hidden\]\s*\{[^}]*display:\s*none/s);
});

test("sidebar navigation exposes view state and mouse titles", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(app, /button\.dataset\.view = "workspace"/);
  assert.equal(html.includes('data-view="folders"'), false);
  assert.equal(html.includes('data-view="recent"'), false);
  assert.match(html, /data-view="settings"/);
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
  assert.doesNotMatch(css, /\.app-loading \.main\s*\{[^}]*visibility:\s*hidden/s);
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
  assert.match(app, /workspace\.id === "workspace-1"/);
  assert.match(app, /function getNextWorkspaceNumber\(\)/);
  assert.match(app, /name:\s*`Workspace \$\{getNextWorkspaceNumber\(\)\}`/);
  assert.match(app, /tab\.dataset\.workspaceId = workspace\.id/);
  assert.match(app, /let workspacePointerDragState = null/);
  assert.match(app, /let workspaceDragImage = null/);
  assert.match(app, /let workspaceSuppressClickTimer = null/);
  assert.match(app, /workspaceTabs\.addEventListener\("pointerdown", handleWorkspacePointerDragStart\)/);
  assert.match(app, /window\.addEventListener\("pointermove", handleWorkspacePointerDragMove\)/);
  assert.match(app, /window\.addEventListener\("pointerup", handleWorkspacePointerDragEnd\)/);
  assert.match(app, /function handleWorkspacePointerDragStart\(event\)/);
  assert.match(app, /function handleWorkspacePointerDragMove\(event\)/);
  assert.match(app, /function handleWorkspacePointerDragEnd\(event\)/);
  assert.match(app, /dragOffsetX:\s*event\.clientX - sourceRect\.left/);
  assert.match(app, /dragOffsetY:\s*event\.clientY - sourceRect\.top/);
  assert.match(app, /function suppressNextWorkspaceClick\(\)/);
  assert.match(app, /window\.setTimeout\(\(\) => \{\s*workspaceSuppressClick = false/s);
  assert.match(app, /event\.clientX - offsetX/);
  assert.match(app, /function saveWorkspaceOrder\(workspaceIds\)/);
  assert.match(app, /function applyWorkspaceOrderPreview\(previewWorkspaceIds\)/);
  assert.match(app, /function createWorkspaceDragImage\(workspace, sourceTab, event\)/);
  assert.match(app, /function removeWorkspaceDragImage\(\)/);
  assert.match(css, /\.workspace-delete\s*\{[^}]*opacity:\s*0/s);
  assert.match(css, /\.workspace-tab:hover \.workspace-delete/s);
  assert.match(css, /\.workspace-tabs\s*\{[^}]*gap:\s*2px/s);
  assert.match(css, /\.workspace-list-head\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 30px/s);
  assert.match(css, /\.workspace-tab\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 30px/s);
  assert.match(css, /\.workspace-tab\.is-workspace-drag-source\s*\{[^}]*opacity:\s*0/s);
  assert.match(css, /\.workspace-tab\.is-workspace-preview-up/s);
  assert.match(css, /\.workspace-tab\.is-workspace-preview-down/s);
  assert.match(css, /\.workspace-drag-image\s*\{/);
  assert.match(css, /\.workspace-drag-image\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /\.workspace-drag-image\s*\{[^}]*pointer-events:\s*none/s);
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
  assert.match(
    html,
    /renderInitialFolders\(\s*folderGrid,\s*snapshot\.folders,\s*boardView,\s*statusOrder,\s*hiddenStatuses,\s*showHiddenStatuses,\s*tableColumnOrder,\s*tableColumnWidths,\s*\)/,
  );
  assert.match(html, /function getStoredStatusOrder\(state\)/);
  assert.match(html, /createInitialBoardColumns\(folders, statusOrder, hiddenStatuses, showHiddenStatuses\)/);
  assert.equal(html.includes("sidebarFolderCount"), false);
});

test("topbar exposes per-workspace board view modes instead of folder summary text", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(html, /id="boardViewSwitcher"/);
  assert.match(html, /data-board-view="overview"[^>]*>Overview</);
  assert.match(html, /data-board-view="board"[^>]*>Board</);
  assert.match(html, /data-board-view="table"[^>]*>Table</);
  assert.match(html, /data-board-view="table"[\s\S]*class="search board-view-search"[\s\S]*id="boardColumnMenuButton"/);
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

  assert.match(css, /\.app-shell\s*\{[^}]*height:\s*100vh/s);
  assert.match(css, /\.app-shell\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.main\s*\{[^}]*overflow:\s*hidden/s);
  assert.doesNotMatch(app, /document\.querySelector\("#boardScrollbar/);
  assert.doesNotMatch(app, /handleBoardScrollbarPointer/);
  assert.doesNotMatch(app, /boardScrollbarDragState/);
  assert.match(app, /function renderOverviewView\(visibleFolders\)/);
  assert.match(app, /function renderBoardView\(visibleFolders\)/);
  assert.match(app, /function renderTableView\(visibleFolders\)/);
  assert.match(app, /function createBoardColumn\(status, statusFolders, options = \{\}\)/);
  assert.match(app, /function createTableRow\(folder, columnOrder = getActiveTableColumnOrder\(\), options = \{\}\)/);
  assert.match(app, /createFolderCard\(folder, \{ showStatus: false \}\)/);
  assert.match(app, /"Name"/);
  assert.match(app, /"Status"/);
  assert.match(css, /\.folder-board-view\s*\{/);
  assert.match(css, /\.folder-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(245px,\s*100%\),\s*245px\)\)/s);
  assert.doesNotMatch(css, /\.folder-grid\s*\{[^}]*grid-auto-flow:\s*column/s);
  assert.doesNotMatch(css, /\.folder-grid\s*\{[^}]*grid-auto-columns:\s*245px/s);
  assert.doesNotMatch(css, /\.folder-grid\s*\{[^}]*width:\s*max-content/s);
  assert.doesNotMatch(css, /\.folder-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(245px,\s*1fr\)\)/s);
  assert.match(css, /\.folder-board-view\s*\{[^}]*grid-auto-flow:\s*column/s);
  assert.match(css, /\.folder-board-view\s*\{[^}]*grid-auto-columns:\s*245px/s);
  assert.match(css, /\.folder-board-view\s*\{[^}]*width:\s*max-content/s);
  assert.match(css, /\.folder-board-view\s*\{[^}]*min-width:\s*100%/s);
  assert.doesNotMatch(css, /\.folder-board-view\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(245px,\s*1fr\)\)/s);
  assert.match(app, /boardSurface\.addEventListener\("pointermove", handleBoardSurfacePointerMove\)/);
  assert.match(app, /boardSurface\.addEventListener\("pointerleave", hideBoardScrollbar\)/);
  assert.match(app, /boardSurface\.addEventListener\("scroll", handleBoardSurfaceScroll\)/);
  assert.match(app, /function handleBoardSurfacePointerMove\(event\)/);
  assert.match(app, /function handleBoardSurfaceScroll\(\)/);
  assert.match(app, /function showBoardScrollbar\(\)/);
  assert.match(app, /function hideBoardScrollbar\(\)/);
  assert.doesNotMatch(css, /\.board-scrollbar\s*\{/);
  assert.doesNotMatch(css, /\.board-scrollbar-thumb\s*\{/);
  assert.match(css, /\.kanban-board\.horizontal-scroll-mode\.is-board-scrollbar-visible/s);
  assert.match(css, /\.kanban-board::-webkit-scrollbar-thumb/s);
  assert.match(css, /\.kanban-board\.horizontal-scroll-mode\.is-board-scrollbar-visible::-webkit-scrollbar-thumb\s*\{[^}]*border-radius:\s*999px/s);
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
  assert.match(app, /const usesHorizontalScroll = activeBoardView === "board"/);
  assert.match(app, /boardSurface\.classList\.toggle\("board-mode", activeBoardView === "board"\)/);
  assert.match(app, /boardSurface\.classList\.toggle\("table-mode", activeBoardView === "table"\)/);
  assert.match(app, /boardSurface\.classList\.toggle\("horizontal-scroll-mode", usesHorizontalScroll\)/);
  assert.match(app, /boardSurface\.classList\.contains\("horizontal-scroll-mode"\)/);
  assert.match(css, /\.kanban-board\.table-mode\s*\{[^}]*margin-top:\s*-21px/s);
  assert.match(css, /\.folder-table\s*\{/);
  assert.doesNotMatch(css, /\.folder-table\s*\{[^}]*margin-top:\s*-/s);
  assert.doesNotMatch(css, /\.folder-table-surface\s*\{[^}]*border-top:/s);
  assert.match(css, /\.folder-table-row\s*\{[^}]*border-bottom:/s);
  assert.match(css, /\.folder-table-row:not\(\.folder-table-head\):hover\s*\{[^}]*background:/s);
  assert.match(css, /\.folder-table-head\s*\{[^}]*font-size:\s*13px/s);
  assert.match(css, /\.folder-table-head \.folder-table-cell\s*\{[^}]*font-size:\s*13px/s);
  assert.match(css, /\.folder-table-head \.folder-table-cell\s*\{[^}]*line-height:\s*1\.2/s);
  assert.doesNotMatch(css, /\.folder-table-head\s*\{[^}]*text-transform:\s*uppercase/s);
  assert.doesNotMatch(css, /\.folder-table-row\s*\{[^}]*border-left:/s);
  assert.doesNotMatch(css, /\.folder-table-cell\s*\{[^}]*border-left:/s);
});

test("table columns can be resized and reordered from the header", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(app, /const tableColumnIds = \["name", "status"\]/);
  assert.match(app, /const defaultTableColumnWidths = \{/);
  assert.match(app, /let tableColumnPointerDragState = null/);
  assert.match(app, /let tableColumnDragImage = null/);
  assert.match(app, /tableColumnOrder:\s*\[\.\.\.tableColumnIds\]/);
  assert.match(app, /tableColumnWidths:\s*\{\s*\.\.\.defaultTableColumnWidths\s*\}/s);
  assert.match(app, /function normalizeTableColumnOrder\(columnOrder\)/);
  assert.match(app, /function normalizeTableColumnWidths\(widths, legacyNameWidth\)/);
  assert.match(app, /function saveTableColumnOrder\(tableColumnOrder\)/);
  assert.match(app, /function saveTableColumnWidth\(columnId, width\)/);
  assert.match(app, /folderGrid\.addEventListener\("pointerdown", handleTableColumnResizeStart\)/);
  assert.match(app, /folderGrid\.addEventListener\("pointerdown", handleTableColumnPointerDragStart\)/);
  assert.match(app, /window\.addEventListener\("pointermove", handleTableColumnPointerDragMove\)/);
  assert.match(app, /window\.addEventListener\("pointerup", handleTableColumnPointerDragEnd\)/);
  assert.match(app, /folderGrid\.addEventListener\("dragstart", handleTableColumnDragStart\)/);
  assert.match(app, /function handleTableColumnPointerDragStart\(event\)/);
  assert.match(app, /function handleTableColumnPointerDragMove\(event\)/);
  assert.match(app, /function handleTableColumnPointerDragEnd\(event\)/);
  assert.match(app, /function createTableColumnDragImage\(columnId, event\)/);
  assert.match(app, /function moveTableColumnDragImage\(event\)/);
  assert.match(app, /function removeTableColumnDragImage\(\)/);
  assert.match(app, /document\s*\.elementFromPoint\(event\.clientX, event\.clientY\)/);
  assert.match(app, /function createTableHeaderCell\(columnId\)/);
  assert.match(app, /function createTableResizeHandle\(columnId\)/);
  assert.match(app, /function getTablePreviewColumnOrder\(event, targetCell\)/);
  assert.match(app, /function applyTableColumnPreview\(previewColumnOrder\)/);
  assert.match(app, /function clearTableColumnDragState\(\)/);
  assert.match(app, /function setTableGridTemplate\(tableElement\)/);
  assert.match(app, /tableElement\.style\.setProperty\("--table-name-column-width"/);
  assert.match(app, /tableElement\.style\.setProperty\("--table-status-column-width"/);
  assert.match(app, /tableElement\.style\.setProperty\("--table-columns"/);
  assert.match(app, /cell\.dataset\.tableColumn = columnId/);
  assert.match(app, /cell\.draggable = false/);
  assert.match(css, /\.folder-table-row\s*\{[^}]*grid-template-columns:\s*var\(--table-columns/s);
  assert.match(css, /\.folder-table-row\s*\{[^}]*gap:\s*0/s);
  assert.match(css, /\.folder-table-head\s*\{[^}]*padding:\s*0/s);
  assert.match(css, /\.folder-table-cell\s*\{[^}]*padding:\s*0 12px/s);
  assert.match(css, /\.folder-table-head \.folder-table-cell\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.folder-table-head \.folder-table-cell\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.folder-table-head \.folder-table-cell\s*\{[^}]*min-height:\s*36px/s);
  assert.match(css, /\.folder-table-head \.folder-table-cell\s*\{[^}]*align-items:\s*center/s);
  assert.doesNotMatch(css, /\.folder-table-head \.folder-table-cell::after\s*\{/);
  assert.doesNotMatch(css, /\.folder-table-head \.folder-table-cell:hover::after/s);
  assert.match(css, /\.folder-table-head \.folder-table-cell:hover\s*\{[^}]*background:/s);
  assert.doesNotMatch(css, /\.folder-table-head \.folder-table-cell:hover\s*\{[^}]*border-radius/s);
  assert.match(css, /\.table-column-drag-image\s*\{/);
  assert.match(css, /\.table-column-drag-image\s*\{[^}]*min-height:\s*36px/s);
  assert.match(css, /\.table-resize-handle\s*\{/);
  assert.match(css, /\.table-resize-handle\s*\{[^}]*top:\s*0/s);
  assert.match(css, /\.table-resize-handle\s*\{[^}]*right:\s*0/s);
  assert.match(css, /\.table-resize-handle\s*\{[^}]*bottom:\s*0/s);
  assert.match(css, /\.table-resize-handle\s*\{[^}]*cursor:\s*col-resize/s);
  assert.match(css, /\.table-resize-handle::after\s*\{[^}]*top:\s*0/s);
  assert.match(css, /\.table-resize-handle::after\s*\{[^}]*right:\s*0/s);
  assert.match(css, /\.table-resize-handle::after\s*\{[^}]*bottom:\s*0/s);
  assert.match(css, /\.table-resize-handle::after\s*\{[^}]*background:\s*var\(--line\)/s);
  assert.match(css, /\.folder-table-head:hover \.table-resize-handle/s);
  assert.match(css, /\.folder-table-cell\.is-table-drag-source\s*\{[^}]*opacity:\s*0/s);
  assert.match(css, /\.folder-table-cell\.is-table-preview-left/s);
  assert.match(css, /\.folder-table-cell\.is-table-preview-right/s);
  assert.match(html, /function getStoredTableColumnOrder\(state\)/);
  assert.match(html, /function getStoredTableColumnWidths\(state\)/);
  assert.match(html, /createInitialTable\(folders, tableColumnOrder, tableColumnWidths, hiddenStatuses, showHiddenStatuses\)/);
});

test("table view can hide and unhide status sections", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(app, /folderGrid\.addEventListener\("click", handleTableStatusMenuClick\)/);
  assert.match(app, /document\.addEventListener\("click", handleTableStatusMenuOutsideClick\)/);
  assert.match(app, /document\.addEventListener\("keydown", handleTableStatusMenuKeydown\)/);
  assert.match(app, /function getTableFolders\(visibleFolders\)/);
  assert.match(app, /return visibleFolders\.filter\(\(folder\) => showHiddenStatuses \|\| !hiddenStatuses\.has\(folder\.status\)\)/);
  assert.match(app, /const tableFolders = getTableFolders\(visibleFolders\)/);
  assert.match(app, /tableFolders\.map\(\(folder\) => createTableRow\(folder, columnOrder, \{ hidden: hiddenStatuses\.has\(folder\.status\) \}\)\)/);
  assert.match(app, /function createTableStatusMenu\(statuses, hiddenStatuses\)/);
  assert.match(app, /function handleTableStatusMenuClick\(event\)/);
  assert.match(app, /function closeTableStatusMenus\(\)/);
  assert.match(app, /let reopenTableStatusMenuAfterRender = false/);
  assert.match(app, /reopenTableStatusMenuAfterRender = true/);
  assert.match(app, /function reopenTableStatusMenuIfNeeded\(\)/);
  assert.match(app, /reopenTableStatusMenuIfNeeded\(\)/);
  assert.match(app, /toggleTableStatusMenu\(statusHeader\)/);
  assert.match(app, /item\.dataset\.status/);
  assert.match(app, /toggleStatusVisibility\(item\.dataset\.status\)/);
  assert.match(app, /columnId === "status"/);
  assert.match(app, /cell\.classList\.add\("has-table-status-menu"\)/);
  assert.match(app, /cell\.setAttribute\("aria-haspopup", "menu"\)/);
  assert.match(app, /cell\.setAttribute\("aria-expanded", "false"\)/);
  assert.match(app, /createTableStatusMenu\(getOrderedStatuses\(folders\), getActiveHiddenStatuses\(\)\)/);
  assert.match(app, /row\.classList\.toggle\("is-hidden-status-row", Boolean\(options\.hidden\)\)/);
  assert.match(html, /createInitialTable\(folders, tableColumnOrder, tableColumnWidths, hiddenStatuses, showHiddenStatuses\)/);
  assert.match(html, /folders[\s\S]*\.filter\(\(folder\) => showHiddenStatuses \|\| !hiddenStatuses\.includes\(folder\.status\)\)/);
  assert.match(html, /row\.classList\.toggle\("is-hidden-status-row", hiddenStatuses\.includes\(folder\.status\)\)/);
  assert.match(css, /\.has-table-status-menu\.is-table-status-menu-open \.table-status-menu\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.table-status-menu\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.table-status-menu-item\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 20px/s);
  assert.match(css, /\.folder-table-row\.is-hidden-status-row\s*\{[^}]*opacity:\s*0\.46/s);
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

test("board columns can be hidden and revealed per workspace", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(html, /id="boardColumnMenuButton"/);
  assert.match(html, /id="toggleHiddenColumnsButton"[\s\S]*Show hidden columns/);
  assert.match(html, /function getStoredHiddenStatuses\(state\)/);
  assert.match(html, /function getStoredShowHiddenStatuses\(state\)/);
  assert.match(html, /createInitialBoardColumns\(folders, statusOrder, hiddenStatuses, showHiddenStatuses\)/);
  assert.match(html, /column\.classList\.toggle\("is-hidden-column", hiddenStatuses\.includes\(status\)\)/);
  assert.match(html, /statuses[\s\S]*\.filter\(\(status\) => showHiddenStatuses \|\| !hiddenStatuses\.includes\(status\)\)/);
  assert.match(app, /hiddenStatuses:\s*\[\]/);
  assert.match(app, /showHiddenStatuses:\s*false/);
  assert.match(app, /hiddenStatuses:\s*Array\.isArray\(workspace\.hiddenStatuses\)/);
  assert.match(app, /showHiddenStatuses:\s*workspace\.showHiddenStatuses === true/);
  assert.match(app, /function getActiveHiddenStatuses\(\)/);
  assert.match(app, /function getActiveShowHiddenStatuses\(\)/);
  assert.match(app, /function saveHiddenStatuses\(hiddenStatuses\)/);
  assert.match(app, /function setShowHiddenStatuses\(showHiddenStatuses\)/);
  assert.match(app, /function toggleStatusVisibility\(status\)/);
  assert.match(app, /function getBoardStatuses\(visibleFolders\)/);
  assert.match(app, /getOrderedStatuses\(visibleFolders\)\.filter\(\(status\) => showHiddenStatuses \|\| !hiddenStatuses\.has\(status\)\)/);
  assert.match(app, /folderGrid\.addEventListener\("click", handleBoardColumnVisibilityClick\)/);
  assert.match(app, /boardColumnMenuButton\.addEventListener\("click", handleBoardColumnMenuToggle\)/);
  assert.match(app, /toggleHiddenColumnsButton\.addEventListener\("click", handleToggleHiddenColumns\)/);
  assert.match(app, /document\.addEventListener\("click", handleBoardColumnMenuOutsideClick\)/);
  assert.match(app, /document\.addEventListener\("keydown", handleBoardColumnMenuKeydown\)/);
  assert.match(app, /const statuses = getBoardStatuses\(visibleFolders\)/);
  assert.match(app, /createBoardColumn\(\s*status,\s*visibleFolders\.filter\(\(folder\) => folder\.status === status\),\s*\{ hidden: hiddenStatuses\.has\(status\) \}/s);
  assert.match(app, /column\.classList\.toggle\("is-hidden-column", Boolean\(options\.hidden\)\)/);
  assert.match(app, /button\.className = "board-column-visibility"/);
  assert.match(app, /button\.dataset\.status = status/);
  assert.match(app, /button\.classList\.toggle\("is-hidden-status", Boolean\(options\.hidden\)\)/);
  assert.match(app, /button\.setAttribute\("aria-label", options\.hidden \? `Show \$\{status\} column` : `Hide \$\{status\} column`\)/);
  assert.match(app, /button\.setAttribute\("aria-pressed", String\(Boolean\(options\.hidden\)\)\)/);
  assert.match(app, /function createEyeIcon\(hidden\)/);
  assert.match(app, /document\.createElementNS\("http:\/\/www\.w3\.org\/2000\/svg", "svg"\)/);
  assert.match(app, /icon\.setAttribute\("viewBox", "0 0 24 24"\)/);
  assert.match(app, /slash\.classList\.add\("eye-slash"\)/);
  assert.match(app, /toggleHiddenColumnsButton\.textContent = getActiveShowHiddenStatuses\(\)\s*\?\s*"Hide hidden columns"\s*:\s*"Show hidden columns"/);
  assert.match(html, /class="settings-gear"[\s\S]*viewBox="0 0 24 24"/);
  assert.match(css, /\.topbar\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.board-view-switcher\s*\{[^}]*padding-right:\s*36px/s);
  assert.match(css, /\.board-view-search\s*\{[^}]*margin-left:\s*auto/s);
  assert.match(css, /\.search\s*\{[^}]*height:\s*28px/s);
  assert.match(css, /\.search\s*\{[^}]*border-radius:\s*14px/s);
  assert.match(css, /\.board-view-settings\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.board-view-settings\s*\{[^}]*right:\s*0/s);
  assert.match(css, /\.board-column-menu-popover\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.board-column-visibility\s*\{[^}]*opacity:\s*0/s);
  assert.match(css, /\.board-column:hover \.board-column-visibility/s);
  assert.match(css, /\.board-column\.is-hidden-column\s*\{[^}]*opacity:\s*0\.46/s);
  assert.match(css, /\.eye-icon\s*\{[^}]*stroke-linecap:\s*round/s);
  assert.match(css, /\.eye-slash\s*\{[^}]*stroke-width:\s*2\.2/s);
  assert.match(css, /\.settings-gear\s*\{[^}]*stroke-linejoin:\s*round/s);
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

  assert.match(css, /--content-x:\s*9px/);
  assert.match(css, /\.main\s*\{[^}]*padding:\s*0/s);
  assert.match(css, /\.topbar\s*\{[^}]*margin:\s*9px var\(--content-x\) 24px/s);
  assert.match(css, /\.board-toolbar\s*\{[^}]*margin:\s*0 var\(--content-x\) 18px/s);
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
  assert.match(css, /\.kanban-board\s*\{[^}]*padding:\s*6px 4px 18px var\(--content-x\)/s);
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
