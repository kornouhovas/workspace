import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("app shell is not wrapped in a decorative browser frame", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.equal(html.includes("browser-frame"), false);
  assert.equal(html.includes("browser-bar"), false);
  assert.match(html, /<div class="app-shell" id="appShell">/);
});

test("mobile layout pins navigation to an auto-height row", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.app-shell,\s*\.app-shell\.sidebar-collapsed\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/s);
});
