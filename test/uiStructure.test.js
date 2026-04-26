import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("app shell is not wrapped in a decorative browser frame", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.equal(html.includes("browser-frame"), false);
  assert.equal(html.includes("browser-bar"), false);
  assert.match(html, /<div class="app-shell" id="appShell">/);
});

test("mobile layout keeps navigation as a left rail instead of a top bar", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sidebar\s*\{[\s\S]*position:\s*fixed/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.main\s*\{[\s\S]*margin-left:\s*224px/s);
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

  assert.match(html, /id="sidebarReturn"/);
  assert.match(css, /\.app-shell\.sidebar-collapsed\s*\{[^}]*grid-template-columns:\s*0 minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.sidebar-collapsed \.sidebar\s*\{[^}]*visibility:\s*hidden/s);
  assert.match(css, /\.icon-button\.sidebar-return\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.sidebar-collapsed \.icon-button\.sidebar-return\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.sidebar-collapsed \.main\s*\{[^}]*padding-top:\s*72px/s);
  assert.doesNotMatch(css, /\.sidebar-return span\s*\{[^}]*transform:\s*rotate/s);
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
  assert.match(css, /\.workspace-delete\s*\{[^}]*opacity:\s*0/s);
  assert.match(css, /\.workspace-tab:hover \.workspace-delete/s);
  assert.match(css, /\.workspace-list-head\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 30px/s);
  assert.match(css, /\.workspace-tab\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 30px/s);
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
