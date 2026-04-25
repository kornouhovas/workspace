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
