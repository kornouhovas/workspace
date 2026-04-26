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
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sidebar-collapsed \.main\s*\{[\s\S]*margin-left:\s*72px/s);
});

test("folder picker has one primary click target in the initial view", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.equal(html.match(/Choose folder/g)?.length, 1);
  assert.equal(html.includes("emptyChooseButton"), false);
});

test("sidebar navigation exposes view state and mouse titles", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  for (const view of ["workspace", "folders", "recent", "settings"]) {
    assert.match(html, new RegExp(`data-view="${view}"`));
  }

  assert.match(html, /id="sidebarToggle"[^>]*title="Скрыть меню"/);
});

test("collapsed sidebar keeps the toggle clickable and shows icon rail", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.sidebar-collapsed \.brand-mark\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.sidebar-collapsed \.sidebar-toggle\s*\{[^}]*width:\s*40px/s);
  assert.match(css, /\.sidebar-collapsed \.nav-label\s*\{[^}]*display:\s*none/s);
  assert.equal(css.includes(".sidebar-collapsed .nav-list,\n.sidebar-collapsed .workspace-panel"), false);
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
