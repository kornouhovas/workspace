import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron, chromium } from "playwright-core";
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
// Browser rendering can verify Ladle even when native Electron shutdown is a
// separate platform gate. The default retains its normal-quit assertion.
const browserOnly = process.argv.includes("--chromium");
const results = { browser: browserOnly ? "Chromium" : "Electron", capture: browserOnly ? "viewport" : "full-page", fixture: "production components with typed disposable Ladle data", screenshots: [], featurePassed: false, shutdownPassed: false };
const save = () => writeFile(join(evidence, "ladle-observations.json"), JSON.stringify(results, null, 2) + "\n");
let electron;
let browser;
let failure;
try {
  await writeFile(join(fixture, "main.cjs"), `const {app, BrowserWindow} = require('electron');
app.setPath('userData', ${JSON.stringify(join(fixture, "data"))});
app.whenReady().then(() => { const window = new BrowserWindow({width:1440,height:960,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}}); window.loadURL(${JSON.stringify(url)}); });
app.on('window-all-closed', () => app.quit());`);
  let page;
  if (browserOnly) {
    browser = await chromium.launch({ executablePath: process.env.WORKSPACE_LAYOUT_BROWSER_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
    page = await browser.newPage();
  } else {
    electron = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"), args: [join(fixture, "main.cjs")], timeout: 30000 });
    page = await electron.firstWindow();
  }
  page.setDefaultTimeout(15000);
  const meta = JSON.parse(await readFile(join(built, "meta.json"), "utf8"));
  const stories = Object.keys(meta.stories).filter((name) => /--(discovery-|applied-|text-|grouped-|category-|recovery-|source-|mode-|creation-|rename-)/.test(name));
  assert.equal(stories.filter((name) => name.includes("--text-")).length, 18, "Expected all nine EN/RU Text states");
  assert.equal(stories.filter((name) => name.includes("--recovery-")).length, 20, "Expected all ten EN/RU recovery states");
  assert.equal(stories.filter((name) => name.includes("--source-")).length, 14, "Expected all seven EN/RU source observation states");
  assert.equal(stories.filter((name) => name.includes("--mode-")).length, 18, "Expected all nine EN/RU mode-change states");
  assert.equal(stories.filter((name) => name.includes("--creation-")).length, 36, "Expected all eighteen EN/RU creation and Reveal states");
  assert.equal(stories.filter((name) => name.includes("--rename-")).length, 96, "Expected all 24 direct/grouped EN/RU rename states");
  const categoryMoveStories = stories.filter((name) => name.includes("--category-move-"));
  // Require the behavior matrix by name, without a total story-count target.
  const categoryMoveStates = ["editing", "pending", "saved", "unchanged", "collision", "stale", "unavailable", "rejected", "unknown", "list-loading", "list-empty", "list-error", "interrupted", "uncertain", "recovery-original", "recovery-destination", "recovery-blocked", "review-stale", "review-loading", "review-error", "recovery-pending", "recovery-unknown", "kept-original", "retained", "direct"];
  for (const state of categoryMoveStates) for (const language of ["english", "russian"]) {
    assert.ok(categoryMoveStories.some((name) => name.endsWith(`--category-move-${state}-${language}`)), `Missing category move ${state} ${language}`);
  }
  const selectedStories = process.argv.includes("--category-move") ? categoryMoveStories : process.argv.includes("--rename") ? stories.filter((name) => name.includes("--rename-")) : process.argv.includes("--mode-changes") ? stories.filter((name) => name.includes("--mode-")) : process.argv.includes("--creation") ? stories.filter((name) => name.includes("--creation-")) : stories;
  for (const story of selectedStories) {
    results.currentStory = story;
    await page.goto(`${url}/?story=${story}&mode=preview`);
    const categoryMoveStory = story.includes("--category-move-");
    const renameStory = story.includes("--rename-");
    const creationStory = story.includes("--creation-");
    const modeStory = story.includes("--mode-");
    const sourceStory = story.includes("--source-");
    const recoveryStory = story.includes("--recovery-");
    const categoryStory = story.includes("--category-") && !categoryMoveStory;
    const textStory = story.includes("--text-");
    await page.locator(categoryMoveStory ? "[data-category-move-fixture][data-fixture-ready=true]" : renameStory ? "[data-rename-fixture][data-fixture-ready=true]" : creationStory ? "[data-creation-fixture][data-fixture-ready=true]" : modeStory ? "[data-mode-fixture]" : sourceStory ? "[data-source-fixture]" : recoveryStory ? "[data-recovery-fixture]" : categoryStory ? "[data-category-fixture][data-fixture-ready=true]" : textStory ? "[data-text-fixture][data-fixture-ready=true]" : ".discovery-panel, .table-view").waitFor();
    const categoryMoveRoot = page.locator("[data-category-move-fixture]");
    const categoryMoveState = categoryMoveStory ? await categoryMoveRoot.getAttribute("data-category-move-fixture") : null;
    const categoryMoveLanguage = categoryMoveStory ? await categoryMoveRoot.getAttribute("lang") : null;
    const moveText = (en, ru) => categoryMoveLanguage === "ru" ? ru : en;
    const movePanel = page.locator(".project-category-move");
    const moveSelect = page.locator("#project-category-move-destination");
    const moveTrigger = page.locator("td:nth-child(2) .property-rename");
    const moveReview = page.locator(".category-move-review");
    const moveReviewTrigger = page.locator(".category-move-operations > div > button:last-of-type");
    const moveCalls = async () => ({ move: Number(await categoryMoveRoot.getAttribute("data-move-calls")), recovery: Number(await categoryMoveRoot.getAttribute("data-recovery-calls")) });
    if (categoryMoveStory) {
      const list = page.locator(".category-move-operations");
      assert.equal(await list.getAttribute("aria-busy"), categoryMoveState === "list-loading" ? "true" : "false");
      if (categoryMoveState === "list-error") await list.getByRole("alert").waitFor();
      if (categoryMoveState === "list-empty") await list.getByText(moveText("No interrupted category moves.", "Прерванных перемещений нет."), { exact: true }).waitFor();
      if (["collision", "stale", "unavailable", "rejected", "unknown"].includes(categoryMoveState)) await movePanel.locator(":scope > [role=alert]").waitFor();
      if (await moveSelect.count()) {
        assert.equal(await page.getByLabel(moveText("Destination category", "Категория назначения"), { exact: true }).count(), 1);
        assert.equal(await moveSelect.evaluate((node) => node.labels.length), 1);
        assert.deepEqual(await moveSelect.locator("option").evaluateAll((nodes) => nodes.map((node) => node.value)), ["move-original-category", "move-destination-category"]);
        assert.equal(await moveSelect.isDisabled(), ["pending", "unknown"].includes(categoryMoveState));
        await movePanel.getByText(moveText("Submitting physically moves the project folder into an existing category. Its exact name and Text values stay the same.", "Отправка физически перемещает папку проекта в существующую категорию. Точное имя и значения Text сохраняются."), { exact: true }).waitFor();
      }
      if (["saved", "unchanged", "kept-original"].includes(categoryMoveState)) {
        assert.equal(await moveSelect.count(), 0); assert.equal(await moveReview.count(), 0);
        await movePanel.locator(":scope > [role=status]").waitFor();
      }
      if (["retained", "direct"].includes(categoryMoveState)) {
        assert.equal(await moveTrigger.count(), 0);
        assert.equal(await moveSelect.count(), 0);
        assert.equal(await page.locator(".text-property-cell .text-value-button").count(), 1, "Text remains usable on restricted rows");
      }
      if (["recovery-original", "recovery-destination", "recovery-blocked"].includes(categoryMoveState)) {
        await page.locator(".category-move-placements").waitFor();
        const actions = moveReview.locator(".workspace-form-actions").first().getByRole("button");
        const expected = categoryMoveState === "recovery-original" ? [moveText("Retry original category move", "Повторить исходное перемещение"), moveText("Keep original category folder", "Сохранить папку в исходной категории")] : categoryMoveState === "recovery-destination" ? [moveText("Complete destination category move", "Подтвердить перемещение в категорию назначения")] : [];
        assert.deepEqual(await actions.allTextContents(), expected);
        for (const action of await actions.all()) assert.equal(await action.isEnabled(), true);
      }
      if (["review-stale", "review-loading", "review-error", "recovery-pending", "recovery-unknown"].includes(categoryMoveState)) assert.equal(await page.locator(".category-move-placements").count(), 0);
      if (["unknown", "recovery-unknown"].includes(categoryMoveState)) assert.equal(await movePanel.getByRole("button", { name: moveText("Check category move status", "Проверить статус перемещения в категорию"), exact: true }).isEnabled(), true);
      assert.deepEqual(await moveCalls(), {
        move: ["pending", "saved", "unchanged", "collision", "stale", "unavailable", "rejected", "unknown"].includes(categoryMoveState) ? 1 : 0,
        recovery: ["recovery-pending", "recovery-unknown", "kept-original"].includes(categoryMoveState) ? 1 : 0,
      }, "Preparation performs only the requested explicit mutation");
    }
    const renameState = renameStory ? await page.locator("[data-rename-fixture]").getAttribute("data-rename-fixture") : null;
    const renameLanguage = renameStory ? await page.locator("[data-rename-fixture]").getAttribute("lang") : null;
    const renameText = (en, ru) => renameLanguage === "ru" ? ru : en;
    if (renameStory) {
      const list = page.locator(".rename-operations");
      assert.equal(await list.getAttribute("aria-busy"), renameState === "list-loading" ? "true" : "false");
      if (["invalid", "collision", "stale", "unavailable", "unknown"].includes(renameState)) await page.locator(".project-rename > [role=alert]").waitFor();
      if (renameState === "invalid") assert.equal(await page.locator("#project-rename-name").getAttribute("aria-invalid"), "true");
      if (renameState === "list-error") await list.getByRole("alert").waitFor();
      if (["pending", "unknown"].includes(renameState)) assert.equal(await page.locator("#project-rename-name").isDisabled(), true);
      if (["saved", "unchanged", "kept-original"].includes(renameState)) {
        assert.equal(await page.locator("#project-rename-name, .rename-review").count(), 0);
        await page.locator(".project-rename > [role=status]").waitFor();
      }
      if (await page.locator("#project-rename-name").count()) {
        assert.equal(await page.getByLabel(renameText("Project name", "Название проекта"), { exact: true }).count(), 1, "Name must have its visible associated label");
        assert.equal(await page.locator("#project-rename-name").evaluate((node) => node.labels.length), 1);
      }
      const actions = page.locator(".rename-review .workspace-form-actions").first().getByRole("button");
      if (["recovery-original", "recovery-staged", "recovery-destination", "recovery-blocked"].includes(renameState)) {
        await page.locator(".rename-placements").waitFor();
        assert.equal(await actions.count(), renameState === "recovery-original" ? 2 : renameState === "recovery-blocked" ? 0 : 1);
      }
      if (["review-stale", "review-loading", "review-error", "recovery-pending", "recovery-unknown"].includes(renameState)) assert.equal(await page.locator(".rename-placements").count(), 0);
      if (renameState === "unknown" || renameState === "recovery-unknown") assert.equal(await page.getByRole("button", { name: renameText("Check rename status", "Проверить статус переименования"), exact: true }).isEnabled(), true);
    }
    const creationState = creationStory ? await page.locator("[data-creation-fixture]").getAttribute("data-creation-fixture") : null;
    if (creationState?.startsWith("success-list")) {
      const language = await page.locator("[data-creation-fixture]").getAttribute("lang");
      await page.getByText(language === "ru" ? "Папка проекта создана." : "Project folder created.", { exact: true }).waitFor();
      assert.equal(await page.locator(".project-creation [role=alert]").count(), creationState === "success-list-error" ? 1 : 0);
    }
    const modeState = modeStory ? await page.locator("[data-mode-fixture]").getAttribute("data-mode-fixture") : null;
    if (["retained", "category"].includes(modeState)) await page.waitForFunction(() => globalThis.document.querySelector(".text-properties")?.getAttribute("aria-busy") === "false");
    if (modeStory && !["retained", "category"].includes(modeState)) {
      assert.equal(await page.locator(".discovery-mode select").isDisabled(), modeState === "loading");
      assert.equal(await page.locator(".discovery-effects h4").count(), 6);
      assert.equal(await page.locator(".workspace-form-actions button").first().isDisabled(), ["loading", "unavailable", "stale"].includes(modeState));
    }
    const sourceState = sourceStory ? await page.locator("[data-source-fixture]").getAttribute("data-source-fixture") : null;
    if (sourceStory) {
      await page.waitForFunction(() => globalThis.document.querySelector(".text-properties")?.getAttribute("aria-busy") === "false");
      assert.equal(await page.locator(".source-refresh > button").isDisabled(), sourceState === "pending");
      if (sourceState === "pending") assert.equal(await page.locator(".source-refresh").getAttribute("aria-busy"), "true");
      if (sourceState === "error") await page.locator(".source-refresh [role=alert]").waitFor();
      if (sourceState === "degraded") await page.locator(".source-refresh [role=status]").waitFor();
      if (sourceState === "new-category") { assert.equal(await page.locator(".saved-categories li").count(), 2); assert.equal(await page.locator("tbody tr").count(), 1); }
      if (sourceState === "empty") assert.equal(await page.locator("tbody tr").count(), 0);
    }
    const recoveryState = recoveryStory ? await page.locator("[data-recovery-fixture]").getAttribute("data-recovery-fixture") : null;
    if (["retained", "saved"].includes(recoveryState)) await page.waitForFunction(() => globalThis.document.querySelector(".text-properties")?.getAttribute("aria-busy") === "false");
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
    if (textState === "no-definitions") {
      assert.equal(await page.getByRole("columnheader").count(), 2, "Only Name and Reveal columns remain without Text definitions");
      assert.equal(await page.locator(".text-property-cell").count(), 0);
      assert.equal(await page.locator("tbody td:first-child .property-authored").count(), 1, "The authored Name must remain visible");
    }
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
        elements: Array.from(globalThis.document.querySelectorAll(".discovery-panel, .discovery-effects, .discovery-effects li, .discovery-entries li, .project-table td, .project-table th, .workspace-root, .workspace-form-actions, .text-value-button, .text-value-editor, .category-property-header, .recovery-review dd, .recovery-candidates, .recovery-path, .source-refresh, .source-refresh .bb-status, .project-creation, .project-creation .bb-status, .project-creation .workspace-form-actions, .creation-review, .project-reveal .bb-status, .project-rename, .project-rename form, .project-rename .bb-status, .rename-operations, .rename-review, .project-rename dl, .project-rename dt, .project-rename dd, .project-rename .workspace-form-actions, .project-category-move, .project-category-move form, .project-category-move .bb-status, .category-move-operations, .category-move-review, .project-category-move dl, .project-category-move dt, .project-category-move dd, .project-category-move .workspace-form-actions"))
          .filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.className || node.tagName),
        wrapped: Array.from(globalThis.document.querySelectorAll(".discovery-name, .property-authored, .text-value-button:not([hidden]), .project-table td, .saved-categories li, .workspace-root, .recovery-review dd, .recovery-path, .project-rename dd, .project-rename p, .project-category-move dd"))
          .filter((node) => node.textContent.length > 150).every((node) => {
            const range = globalThis.document.createRange(); range.selectNodeContents(node);
            return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size > 1;
          }),
      }));
      if (categoryMoveStory && !layout.wrapped) {
        results.unwrapped = await page.locator(".property-authored, .text-value-button:not([hidden]), .project-table td, .saved-categories li, .project-category-move dd").evaluateAll((nodes) => nodes.filter((node) => {
          const range = globalThis.document.createRange(); range.selectNodeContents(node);
          return node.textContent.length > 150 && new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size <= 1;
        }).map((node) => ({ tag: node.tagName, className: node.className, textLength: node.textContent.length, width: node.clientWidth, text: node.textContent })));
      }
      if (categoryMoveStory || renameStory || recoveryStory || modeStory || creationStory) {
        for (const button of await page.locator(categoryMoveStory ? ".project-category-move button, td:nth-child(2) .property-rename" : renameStory ? ".project-rename button, td:first-child .property-rename" : creationStory ? ".project-creation button, .project-reveal button" : recoveryStory ? ".recovery-panel button" : ".workspace-form-actions button, [data-mode-fixture] > button").all()) {
          await button.evaluate(async (node) => {
            node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
            await new Promise((done) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done)));
          });
          assert.equal(await button.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return rect.left >= 0 && rect.right <= globalThis.innerWidth && rect.top >= 0 && rect.bottom <= globalThis.innerHeight;
          }), true, `${story} ${size.width} recovery control unreachable`);
        }
      }
      assert.deepEqual(layout.clippedControls, [], `${story} ${size.width} editing controls clipped after scrolling`);
      assert.equal(layout.overflow, false, `${story} ${size.width} document overflow`);
      assert.deepEqual(layout.elements, [], `${story} ${size.width} element overflow`);
      if (size.width === 420 || categoryMoveStory || renameStory || recoveryStory || creationStory) assert.equal(layout.wrapped, true, `${story} long authored text did not wrap`);
      if (categoryMoveStory) {
        const surface = page.locator(".category-move-review, .project-category-move form").first();
        await (await surface.count() ? surface : movePanel).evaluate((node) => node.scrollIntoView({ block: "start", behavior: "instant" }));
      }
      if (renameStory) {
        const surface = page.locator(".rename-review, .project-rename form").first();
        await (await surface.count() ? surface : page.locator(".project-rename")).evaluate((node) => node.scrollIntoView({ block: "start", behavior: "instant" }));
      }
      const screenshot = `${story}-${size.width}x${size.height}.png`;
      // Keep complete rename surfaces in the captures, including long recovery
      // evidence. Other Chromium states retain their existing viewport captures.
      await page.screenshot({ path: join(evidence, screenshot), fullPage: !browserOnly || renameStory || categoryMoveStory });
      results.screenshots.push({ story, ...size, screenshot, capture: !browserOnly || renameStory || categoryMoveStory ? "full-page" : "viewport", layout });
    }
    // Exercise the actual fixture controls after recording the requested state.
    if (categoryMoveStory) {
      const initialCalls = await moveCalls();
      let expectedCalls = { ...initialCalls };
      const focused = async (locator) => assert.equal(await locator.evaluate((node) => node === globalThis.document.activeElement), true);
      const table = page.getByRole("heading", { name: moveText("Table", "Таблица"), exact: true });
      const status = movePanel.getByRole("button", { name: moveText("Check category move status", "Проверить статус перемещения в категорию"), exact: true });
      if (["editing", "collision", "stale", "unavailable", "rejected"].includes(categoryMoveState)) {
        await focused(moveSelect);
        await moveSelect.press("Escape"); await moveSelect.waitFor({ state: "detached" }); await focused(moveTrigger);
        await moveTrigger.press("Enter"); await moveSelect.waitFor(); await focused(moveSelect);
        assert.equal(await moveSelect.inputValue(), "move-original-category");
        await moveSelect.press("d");
        assert.equal(await moveSelect.inputValue(), "move-destination-category", "Native select keyboard chooses the eligible empty category");
        assert.deepEqual(await moveCalls(), initialCalls, "Changing selection cannot submit a move");
        if (categoryMoveState === "editing") {
          await moveSelect.press("Enter");
          await movePanel.getByText(moveText("Project folder moved to the selected category.", "Папка проекта перемещена в выбранную категорию."), { exact: true }).waitFor();
          expectedCalls.move++;
          assert.equal(await moveTrigger.evaluate((node) => node === globalThis.document.activeElement) || await table.evaluate((node) => node === globalThis.document.activeElement), true, "Completion restores the initiating control or stable Table heading");
        } else { await moveSelect.press("Escape"); await moveSelect.waitFor({ state: "detached" }); await focused(moveTrigger); }
      } else if (["pending", "unknown"].includes(categoryMoveState)) {
        // A duplicate submit event must also be guarded at the command boundary.
        await moveSelect.evaluate((node) => node.closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
        await movePanel.locator("form").press("Escape"); await moveSelect.waitFor({ state: "detached" });
        assert.equal(await moveTrigger.isDisabled(), true); await focused(table);
        if (categoryMoveState === "unknown") {
          await status.press("Enter"); await movePanel.getByText(moveText("Project folder moved to the selected category.", "Папка проекта перемещена в выбранную категорию."), { exact: true }).waitFor();
          assert.equal(await categoryMoveRoot.getAttribute("data-status-calls"), "1");
        }
      } else if (categoryMoveState === "list-error") {
        await page.locator(".category-move-operations > button").press("Enter"); await page.locator(".category-move-operations [role=alert]").waitFor();
      } else if (["interrupted", "uncertain"].includes(categoryMoveState)) {
        await moveReviewTrigger.press("Enter"); await page.locator(".category-move-placements").waitFor();
        await focused(page.locator("#category-move-review-title"));
        await moveReview.press("Escape"); await moveReview.waitFor({ state: "detached" }); await focused(moveReviewTrigger);
        // Explicit read-only status is available independently of recovery review.
        await page.locator(".category-move-operations > div > button").first().press("Enter");
        await movePanel.getByText(moveText("Project folder moved to the selected category.", "Папка проекта перемещена в выбранную категорию."), { exact: true }).waitFor();
        assert.equal(await categoryMoveRoot.getAttribute("data-status-calls"), "1");
      } else if (categoryMoveState.startsWith("recovery-") || categoryMoveState.startsWith("review-")) {
        if (categoryMoveState === "review-stale") {
          await focused(moveReview.getByRole("button").first());
          await moveReview.getByRole("button").first().press("Enter"); await page.locator(".category-move-placements").waitFor();
        } else if (!["recovery-pending", "recovery-unknown"].includes(categoryMoveState)) await focused(page.locator("#category-move-review-title"));
        if (["recovery-original", "recovery-destination"].includes(categoryMoveState)) {
          await moveReview.locator(".workspace-form-actions").first().getByRole("button").first().press("Enter");
          await movePanel.getByText(moveText("Project folder moved to the selected category.", "Папка проекта перемещена в выбранную категорию."), { exact: true }).waitFor();
          expectedCalls.recovery++; await focused(table);
        } else {
          await moveReview.press("Escape"); await moveReview.waitFor({ state: "detached" });
          if (["recovery-pending", "recovery-unknown"].includes(categoryMoveState)) {
            await focused(table);
            if (categoryMoveState === "recovery-unknown") {
              await status.press("Enter"); await movePanel.getByText(moveText("Project folder moved to the selected category.", "Папка проекта перемещена в выбранную категорию."), { exact: true }).waitFor();
            }
          } else await focused(moveReviewTrigger);
        }
      }
      assert.deepEqual(await moveCalls(), expectedCalls, "Dismissal, selection, list, review and status cannot duplicate mutations");
      results.interactions ??= []; results.interactions.push({ story, state: categoryMoveState, passed: true, mutationCalls: await moveCalls(), native: "typed fixture only" });
    }
    if (renameStory) {
      const root = page.locator("[data-rename-fixture]");
      const trigger = page.locator("td:first-child .property-rename");
      const name = page.locator("#project-rename-name");
      const panel = page.locator(".project-rename");
      const calls = async () => ({ rename: Number(await root.getAttribute("data-rename-calls")), recovery: Number(await root.getAttribute("data-recovery-calls")) });
      const initialCalls = await calls();
      if (["editing", "invalid", "collision", "stale", "unavailable"].includes(renameState)) {
        assert.equal(await name.evaluate((node) => node === globalThis.document.activeElement), true, "Editor/error returns focus to the associated input");
        const authored = await name.inputValue(); assert.ok(authored.startsWith("  Requested-")); assert.ok(authored.endsWith("  "));
        await name.press("Escape"); await name.waitFor({ state: "detached" });
        assert.equal(await trigger.evaluate((node) => node === globalThis.document.activeElement), true);
        await trigger.press("Enter"); await name.waitFor();
        assert.equal(await name.evaluate((node) => node === globalThis.document.activeElement), true);
        await name.press("Tab");
        assert.equal(await panel.locator("button[type=submit]").evaluate((node) => node === globalThis.document.activeElement), true);
        await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
        await name.waitFor({ state: "detached" });
        assert.equal(await trigger.evaluate((node) => node === globalThis.document.activeElement), true);
      } else if (["pending", "unknown"].includes(renameState)) {
        await panel.locator("form").press("Escape"); await name.waitFor({ state: "detached" });
        assert.equal(await trigger.isDisabled(), true);
        assert.equal(await page.getByRole("heading", { name: renameText("Table", "Таблица"), exact: true }).evaluate((node) => node === globalThis.document.activeElement), true);
        if (renameState === "unknown") {
          await panel.getByRole("button", { name: renameText("Check rename status", "Проверить статус переименования"), exact: true }).press("Enter");
          await panel.getByText(renameText("Project folder renamed.", "Папка проекта переименована."), { exact: true }).waitFor();
          assert.equal(await root.getAttribute("data-status-calls"), "1");
        }
      } else if (renameState === "list-error") {
        await page.locator(".rename-operations > button").press("Enter");
        await page.locator(".rename-operations [role=alert]").waitFor();
        assert.equal(await page.locator(".rename-operations").getAttribute("aria-busy"), "false");
      } else if (["interrupted", "uncertain"].includes(renameState)) {
        await page.locator(".rename-operations div > button").press("Enter");
        await page.locator(".rename-placements").waitFor();
        assert.equal(await page.locator("#rename-review-title").evaluate((node) => node === globalThis.document.activeElement), true);
        await page.locator("#rename-review-title").press("Escape");
        assert.equal(await page.locator(".rename-operations div > button").evaluate((node) => node === globalThis.document.activeElement), true);
      } else if (renameState.startsWith("recovery-") || renameState.startsWith("review-")) {
        const review = page.locator(".rename-review");
        if (renameState === "review-stale") {
          assert.equal(await review.getByRole("button").first().evaluate((node) => node === globalThis.document.activeElement), true, "Stale review restores focus to explicit review control");
          await review.getByRole("button").first().press("Enter"); await page.locator(".rename-placements").waitFor();
        } else if (!["recovery-pending", "recovery-unknown"].includes(renameState)) {
          assert.equal(await page.locator("#rename-review-title").evaluate((node) => node === globalThis.document.activeElement), true);
        }
        await review.press("Escape"); await review.waitFor({ state: "detached" });
        if (["recovery-pending", "recovery-unknown"].includes(renameState)) {
          assert.equal(await page.getByRole("heading", { name: renameText("Table", "Таблица"), exact: true }).evaluate((node) => node === globalThis.document.activeElement), true);
          if (renameState === "recovery-unknown") {
            await panel.getByRole("button", { name: renameText("Check rename status", "Проверить статус переименования"), exact: true }).press("Enter");
            await panel.getByText(renameText("Project folder renamed.", "Папка проекта переименована."), { exact: true }).waitFor();
          }
        } else assert.equal(await page.locator(".rename-operations div > button").evaluate((node) => node === globalThis.document.activeElement), true);
      }
      assert.deepEqual(await calls(), initialCalls, "Keyboard dismissal, list, review and status must not replay rename/recovery");
      results.interactions ??= []; results.interactions.push({ story, state: renameState, passed: true, mutationCalls: initialCalls, native: "typed fixture only" });
    }
    if (creationStory) {
      const trigger = page.locator(".project-creation > button").first();
      if (["direct", "grouped", "validation", "collision", "failure"].includes(creationState)) {
        const input = page.locator("#project-creation-name");
        await input.focus(); await input.press("Escape");
        await input.waitFor({ state: "detached" });
        assert.equal(await trigger.evaluate((node) => node === globalThis.document.activeElement), true);
        await trigger.press("Enter");
        await input.waitFor();
        assert.equal(await input.evaluate((node) => node === globalThis.document.activeElement), true);
        if (creationState === "grouped") {
          const category = page.locator(".project-creation select");
          await category.selectOption("existing-category");
          assert.equal(await category.inputValue(), "existing-category");
        }
      } else if (["unconfigured", "no-category", "unavailable", "pending"].includes(creationState)) {
        assert.equal(await trigger.isDisabled(), true);
        if (creationState === "pending") {
          assert.equal(await page.locator("#project-creation-name").isDisabled(), true);
          await page.locator(".project-creation form").press("Escape");
          assert.equal(await page.locator(".project-creation form").count(), 0);
          assert.equal(await trigger.isDisabled(), true, "Closing a pending form cannot authorize another creation");
        }
      } else if (["recovery", "blocked"].includes(creationState)) {
        const review = page.locator(".creation-review");
        assert.equal(await review.locator("button").count(), creationState === "blocked" ? 1 : 2);
        await review.getByRole("button").last().press("Enter");
        await review.waitFor({ state: "detached" });
        assert.equal(await trigger.evaluate((node) => node === globalThis.document.activeElement), true);
      } else if (creationState.startsWith("reveal-")) {
        assert.equal(await page.locator(".project-reveal button").isDisabled(), creationState === "reveal-pending");
        if (creationState !== "reveal-pending") await page.locator(".project-reveal [role=alert]").waitFor();
      } else if (creationState === "uncertain") {
        assert.equal(await page.locator("#project-creation-name").isDisabled(), true);
        assert.equal(await page.locator(".project-creation button[type=submit]").isDisabled(), true);
      } else if (creationState.startsWith("success")) assert.equal(await page.locator(".project-creation form").count(), 0);
      results.interactions ??= []; results.interactions.push({ story, state: creationState, passed: true, native: "typed fixture only" });
    }
    if (modeStory) {
      if (modeState === "category") {
        await page.locator(".category-property-header > button").press("Enter");
        const input = page.locator(".category-property-header input");
        await input.fill("  Hidden category draft 日本語  ");
        await page.locator("[data-toggle-mode]").press("Enter");
        assert.equal(await page.locator(".category-property-header").count(), 0);
        await page.locator("[data-toggle-mode]").press("Enter");
        await input.waitFor();
        assert.equal(await input.inputValue(), "  Hidden category draft 日本語  ");
        assert.equal(await page.locator("[data-toggle-mode]").evaluate((node) => node === globalThis.document.activeElement), true);
        await input.focus(); await input.press("Escape");
        assert.equal(await page.locator(".category-property-header > button").evaluate((node) => node === globalThis.document.activeElement), true);
      } else if (modeState === "retained") {
        const locate = page.locator(".project-previous-path + button");
        assert.equal(await locate.isVisible(), true, "Removed exclusions must expose explicit recovery");
        assert.equal(await page.locator(".project-resolution").count(), 1, "Historical exclusion must not display current exclusion guidance");
        await locate.press("Enter");
        assert.equal(await locate.evaluate((node) => node === globalThis.document.activeElement), true);
        const cell = page.locator(".text-value-button"); await cell.press("Enter");
        await page.locator("textarea").fill("  Mode-retained draft 日本語\n  ");
        await page.locator("textarea").press("Control+Enter");
        await page.locator("textarea").waitFor({ state: "detached" });
        assert.equal(await cell.textContent(), "  Mode-retained draft 日本語\n  ");
        assert.equal(await cell.evaluate((node) => node === globalThis.document.activeElement), true);
      } else if (modeState !== "loading") {
        const select = page.locator(".discovery-mode select");
        if (!["unavailable", "stale"].includes(modeState)) {
          await select.focus(); await select.selectOption(await select.inputValue() === "direct" ? "grouped" : "direct");
          assert.equal(await select.evaluate((node) => node === globalThis.document.activeElement), true);
        }
        if (["stale", "failure"].includes(modeState)) {
          await page.locator(".workspace-form-actions button").nth(1).press("Enter");
          assert.equal(await page.locator(".workspace-form-actions button").first().isDisabled(), false);
        }
        if (["return", "stale", "failure"].includes(modeState)) await page.locator(".workspace-form-actions button").first().press("Enter");
        else await page.locator(".discovery-panel").press("Escape");
        await page.locator(".discovery-panel").waitFor({ state: "detached" });
        assert.equal(await page.locator("[data-mode-fixture] > button").evaluate((node) => node === globalThis.document.activeElement), true);
      }
      results.interactions ??= []; results.interactions.push({ story, state: modeState, passed: true });
    }
    if (sourceStory) {
      const refresh = page.locator(".source-refresh > button");
      if (sourceState === "pending") {
        await page.locator("[data-complete-refresh]").press("Enter");
        assert.equal(await refresh.isDisabled(), false);
      } else {
        let editor;
        if (!["empty", "recovery"].includes(sourceState)) {
          await page.locator(".text-value-button").press("Enter");
          editor = page.locator("textarea"); await editor.fill("Unsaved refresh draft 日本語");
          await editor.evaluate((node) => { globalThis.sourceFixtureEditor = node; });
        }
        await refresh.press("Enter");
        if (editor) {
          await page.getByRole("cell", { name: /^Renamed / }).waitFor();
          assert.equal(await editor.inputValue(), "Unsaved refresh draft 日本語");
          assert.equal(await editor.evaluate((node) => node === globalThis.sourceFixtureEditor), true);
          await editor.press("Escape");
          assert.equal(await page.locator(".text-value-button").evaluate((node) => node === globalThis.document.activeElement), true);
        }
        assert.equal(await page.locator(".source-refresh [role=alert]").count(), 0);
        if (sourceState === "recovery") {
          await page.locator(".project-resolution + .project-previous-path + button").press("Enter");
          await page.locator(".recovery-panel").waitFor();
          assert.equal(await page.locator(".recovery-panel input:not(:disabled)").count(), 0);
          await page.locator(".recovery-panel").press("Escape");
          assert.equal(await page.locator(".recovery-panel").count(), 0);
        }
      }
      results.interactions ??= []; results.interactions.push({ story, state: sourceState, passed: true });
    }
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
    if (recoveryStory) {
      const trigger = page.locator("[data-recovery-fixture] > button");
      const panel = page.locator(".recovery-panel");
      if (["selection", "grouped", "failure", "stale"].includes(recoveryState)) {
        if (["failure", "stale"].includes(recoveryState)) {
          await panel.locator("button").nth(1).press("Enter");
          assert.equal(await panel.locator("input:checked").count(), 0, "Refresh must require reselection");
          assert.equal(await panel.locator("button").first().isDisabled(), true);
        }
        const radio = panel.locator("input[type=radio]:not(:disabled)").first();
        await radio.press("Space");
        assert.equal(await radio.isChecked(), true);
        await panel.locator("button").first().press("Enter");
        await panel.waitFor({ state: "detached" });
        assert.equal(await trigger.evaluate((node) => node === globalThis.document.activeElement), true);
        await page.locator(".text-value-button").waitFor();
      } else if (recoveryState === "pending") {
        assert.equal(await panel.locator("button:disabled").count(), 3);
        await panel.press("Escape");
        assert.equal(await panel.count(), 1);
      } else if (["loading", "empty", "conflict"].includes(recoveryState)) {
        if (recoveryState === "conflict") assert.equal(await panel.locator("input:not(:disabled)").count(), 0);
        await panel.press("Escape"); await panel.waitFor({ state: "detached" });
        assert.equal(await trigger.evaluate((node) => node === globalThis.document.activeElement), true);
      } else if (recoveryState === "retained") {
        assert.equal(await page.locator("tbody tr").count(), 4);
        assert.ok((await page.locator(".text-value-button").first().textContent()).includes("Exact authored 日本語"));
      } else if (recoveryState === "saved") {
        assert.equal(await page.locator("tbody tr").count(), 1);
        assert.ok((await page.locator(".text-value-button").textContent()).includes("Exact authored 日本語"));
      }
      results.interactions ??= []; results.interactions.push({ story, state: recoveryState, passed: true });
    }
    if (categoryStory) { results.interactions ??= []; results.interactions.push({ story, state: categoryState, passed: true }); }
    if (textStory) { results.interactions ??= []; results.interactions.push({ story, state: textState, passed: true }); }
  }
  assert.equal(results.screenshots.length, selectedStories.length * 3, "Every selected state requires all three layouts");
  results.completedStories = selectedStories.length; delete results.currentStory;
  results.featurePassed = true; await save();
  console.info(`Verified ${results.screenshots.length} EN/RU Ladle screenshots, including wrapping and no horizontal overflow`);
} catch (error) { results.error = error.message; failure = error; await save(); }
finally {
  try {
    if (electron) { await closeElectron(electron); results.shutdownPassed = true; await save(); }
    if (browser) { await browser.close(); results.browserClosed = true; await save(); }
  } catch (error) {
    results.shutdownError = error.message;
    failure = failure ? new AggregateError([failure, error], "Layout checks and shutdown failed") : error;
    await save();
  }
  finally { server.close(); await rm(fixture, { recursive: true, force: true }); }
}
if (failure) throw failure;
