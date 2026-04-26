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

  assert.equal(html.match(/Choose folder/g)?.length, 1);
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

test("topbar title mirrors and edits the active workspace name", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(html, /class="topbar-copy"/);
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
  assert.match(css, /\.workspace-title-input\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.045\)/s);
  assert.match(css, /\.workspace-title-input\s*\{[^}]*padding:\s*4px 8px/s);
  assert.match(css, /\.project-meta\s*\{[^}]*margin-left:\s*8px/s);
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
  assert.match(app, /<span class="folder-tag">\$\{escapeHtml\(folder\.status\)\}<\/span>/);
});

test("folder status tag is anchored to the bottom of the card", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.folder-card\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/s);
  assert.match(css, /\.card-meta\s*\{[^}]*grid-row:\s*3/s);
  assert.match(css, /\.card-meta\s*\{[^}]*align-self:\s*end/s);
});
