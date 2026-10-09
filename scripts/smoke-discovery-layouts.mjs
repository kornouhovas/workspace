import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { closeElectron } from "./runtime-lifecycle.mjs";

// Deterministic Ladle presentation and interaction fixtures complement runtime smoke.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = join(root, "dist", "ladle");
const evidence = process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? join(root, "work", "discovery-layouts");
await mkdir(evidence, { recursive: true });
const fixture = await mkdtemp(join(tmpdir(), "workspace-ladle-"));
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer(async (request, response) => {
  try {
    const path = resolve(built, "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname));
    assert.ok(path === built || path.startsWith(built + sep));
    const target = path === built ? join(built, "index.html") : path;
    response.setHeader("Content-Type", mime[extname(target)] ?? "application/octet-stream");
    response.end(await readFile(target));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const results = { fixture: "production components with typed disposable Ladle data", screenshots: [], featurePassed: false, shutdownPassed: false };
const save = () => writeFile(join(evidence, "ladle-observations.json"), JSON.stringify(results, null, 2) + "\n");
let electron;
let failure;
try {
  await writeFile(join(fixture, "main.cjs"), `const {app, BrowserWindow} = require('electron');
app.setPath('userData', ${JSON.stringify(join(fixture, "data"))});
app.whenReady().then(() => { const window = new BrowserWindow({width:1440,height:960,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}}); window.loadURL(${JSON.stringify(url)}); });
app.on('window-all-closed', () => app.quit());`);
  electron = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"), args: [join(fixture, "main.cjs")], timeout: 30000 });
  const page = await electron.firstWindow();
  page.setDefaultTimeout(15000);
  const meta = JSON.parse(await readFile(join(built, "meta.json"), "utf8"));
  const stories = Object.keys(meta.stories).filter((name) => /--(discovery-|applied-|text-|grouped-|category-)/.test(name));
  assert.equal(stories.filter((name) => name.includes("--text-")).length, 18, "Expected all nine EN/RU Text states");
  assert.equal(stories.length, 68, "Expected discovery and Text presentation states");
  for (const story of stories) {
    await page.goto(`${url}/?story=${story}&mode=preview`);
    const categoryStory = story.includes("--category-");
    const textStory = story.includes("--text-");
    await page.locator(categoryStory ? "[data-category-fixture][data-fixture-ready=true]" : textStory ? "[data-text-fixture][data-fixture-ready=true]" : ".discovery-panel, .table-view").waitFor();
    const textState = textStory ? await page.locator("[data-text-fixture]").getAttribute("data-text-fixture") : null;
    const categoryState = categoryStory ? await page.locator("[data-category-fixture]").getAttribute("data-category-fixture") : null;
    if (categoryStory) {
      assert.equal(await page.locator(".category-property-header").count(), 1);
      if (categoryState === "no-projects") assert.equal(await page.locator("tbody tr").count(), 0);
      if (categoryState === "loading") assert.equal(await page.locator(".text-properties").getAttribute("aria-busy"), "true");
      if (["editing", "saving", "validation", "failure", "sibling"].includes(categoryState)) await page.locator(".category-property-header input").waitFor();
      if (categoryState === "saving") await page.waitForFunction(() => globalThis.document.querySelector(".category-property-header input")?.disabled);
      if (categoryState === "validation") await page.waitForFunction(() => globalThis.document.querySelector(".category-property-header input")?.getAttribute("aria-invalid") === "true");
      if (categoryState === "failure") await page.getByRole("alert").waitFor();
      if (["sibling", "saved", "newer"].includes(categoryState)) await page.locator(".category-property-header .bb-status").waitFor();
    }
    if (story.includes("--grouped-preview-")) {
      assert.equal(await page.locator(".discovery-entries--projects").count(), 2);
      await page.getByText("Empty category", { exact: true }).waitFor();
      assert.equal(await page.locator(".discovery-mode select").inputValue(), "grouped");
    }
    if (textState === "loading") assert.equal(await page.locator(".text-properties").getAttribute("aria-busy"), "true");
    if (textState === "no-definitions") assert.equal(await page.locator(".property-authored").count(), 0);
    if (textState === "no-projects") assert.equal(await page.locator("tbody tr").count(), 0);
    if (["editing", "saving", "validation", "failure", "sibling"].includes(textState)) {
      await page.locator("textarea").waitFor();
      assert.ok((await page.locator("textarea").inputValue()).includes("日本語"));
      if (textState === "saving") await page.waitForFunction(() => globalThis.document.querySelector("textarea")?.disabled);
      if (textState === "validation") await page.waitForFunction(() => globalThis.document.querySelector("textarea")?.getAttribute("aria-invalid") === "true");
      if (textState === "failure") await page.getByRole("alert").waitFor();
      if (textState === "sibling") await page.locator(".text-property-cell .bb-status").waitFor();
    }
    if (story.includes("applied-")) await page.waitForFunction(() => globalThis.document.querySelector(".table-view")?.getAttribute("aria-busy") === "false");
    for (const size of [{ width: 1440, height: 960 }, { width: 1024, height: 720 }, { width: 420, height: 800 }]) {
      await page.setViewportSize(size);
      if (await page.locator(".text-value-editor").count()) await page.locator(".text-value-editor").scrollIntoViewIfNeeded();
      if (await page.locator(".category-property-header").count()) await page.locator(".category-property-header").scrollIntoViewIfNeeded();
      const layout = await page.evaluate(() => ({
        overflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        clippedControls: Array.from(globalThis.document.querySelectorAll(".text-value-editor button, .category-property-header button")).filter((node) => {
          const bounds = node.getBoundingClientRect(), scroll = node.closest(".project-table-scroll").getBoundingClientRect();
          return bounds.left < scroll.left - 1 || bounds.right > scroll.right + 1;
        }).map((node) => node.textContent),
        elements: Array.from(globalThis.document.querySelectorAll(".discovery-panel, .discovery-entries li, .project-table td, .project-table th, .workspace-root, .workspace-form-actions, .text-value-button, .text-value-editor, .category-property-header"))
          .filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.className || node.tagName),
        wrapped: Array.from(globalThis.document.querySelectorAll(".discovery-name, .property-authored, .text-value-button:not([hidden]), .project-table td, .saved-categories li, .workspace-root"))
          .filter((node) => node.textContent.length > 150).every((node) => {
            const range = globalThis.document.createRange(); range.selectNodeContents(node);
            return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size > 1;
          }),
      }));
      assert.deepEqual(layout.clippedControls, [], `${story} ${size.width} editing controls clipped after scrolling`);
      assert.equal(layout.overflow, false, `${story} ${size.width} document overflow`);
      assert.deepEqual(layout.elements, [], `${story} ${size.width} element overflow`);
      if (size.width === 420) assert.equal(layout.wrapped, true, `${story} long authored text did not wrap`);
      const screenshot = `${story}-${size.width}x${size.height}.png`;
      await page.screenshot({ path: join(evidence, screenshot), fullPage: true });
      results.screenshots.push({ story, ...size, screenshot, layout });
    }
    // Exercise the actual fixture controls after recording the requested state.
    if (["editing", "sibling"].includes(textState)) {
      await page.locator("textarea").press("Escape");
      await page.locator("textarea").waitFor({ state: "detached" });
      assert.equal(await page.locator(".text-value-button").evaluate((node) => node === globalThis.document.activeElement), true);
      if (textState === "sibling") assert.equal(await page.locator(".text-value-button").textContent(), "Sibling committed change");
    }
    if (["validation", "failure"].includes(textState)) {
      const draft = await page.locator("textarea").inputValue();
      await page.locator("textarea").press("Control+Enter");
      await page.locator("textarea").waitFor({ state: "detached" });
      assert.equal(await page.locator(".text-value-button").textContent(), draft);
    }
    if (textState === "saving") {
      assert.equal(await page.locator(".text-value-editor button:disabled").count(), 3);
      await page.locator("textarea").press("Escape");
      assert.equal(await page.locator("textarea").count(), 1);
    }
    if (["editing", "sibling", "validation", "failure"].includes(categoryState)) {
      const input = page.locator(".category-property-header input");
      if (["validation", "failure"].includes(categoryState)) { await input.fill("Recovered label 日本語"); await input.press("Enter"); }
      else await input.press("Escape");
      await input.waitFor({ state: "detached" });
      assert.equal(await page.locator(".category-property-header > button").evaluate((node) => node === globalThis.document.activeElement), true);
      if (categoryState === "sibling") assert.equal(await page.locator(".category-property-header .property-authored").textContent(), "Sibling category label");
    }
    if (categoryState === "saving") {
      await page.locator(".category-property-header input").press("Escape");
      assert.equal(await page.locator(".category-property-header input").count(), 1);
    }
    if (categoryStory) { results.interactions ??= []; results.interactions.push({ story, state: categoryState, passed: true }); }
    if (textStory) { results.interactions ??= []; results.interactions.push({ story, state: textState, passed: true }); }
  }
  results.featurePassed = true; await save();
  console.info(`Verified ${results.screenshots.length} EN/RU Ladle screenshots, including wrapping and no horizontal overflow`);
} catch (error) { results.error = error.message; failure = error; await save(); }
finally {
  try {
    if (electron) { await closeElectron(electron); results.shutdownPassed = true; await save(); }
  } catch (error) {
    results.shutdownError = error.message;
    failure = failure ? new AggregateError([failure, error], "Layout checks and shutdown failed") : error;
    await save();
  }
  finally { server.close(); await rm(fixture, { recursive: true, force: true }); }
}
if (failure) throw failure;
