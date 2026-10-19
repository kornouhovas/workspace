/* global window, document */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron } from "playwright-core";
import { closeElectron, cleanupOwnedFixture, ownedProcessesStopped } from "./runtime-lifecycle.mjs";
import { openSettingsSection, returnToWorkspace, setInterfaceLanguage } from "./runtime-settings.mjs";

const root = resolve(import.meta.dirname, "..");
const fixture = await realpath(await mkdtemp(join(tmpdir(), "workspace-shell-")));
const evidence = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-48-desktop-shell");
await mkdir(evidence, { recursive: true });
const data = join(fixture, "data"), source = join(fixture, "source");
await mkdir(source); for (let i = 0; i < 50; i++) await mkdir(join(source, `Project ${String(i).padStart(2, "0")}`));
const parents = new Set(), backends = new Set(), checks = [];
let app, page, failed, launchUnverified = false;
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
const query = input => page.evaluate(input => window.workspace.workspace(input), input).then(unwrap);
async function launch() {
  launchUnverified = true;
  app = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"), args: [root], cwd: root,
    env: { ...process.env, WORKSPACE_USER_DATA_DIR: data }, timeout: 30000 });
  parents.add(app.process()); page = await app.firstWindow(); page.setDefaultTimeout(15000);
  await page.waitForFunction(async () => (await window.workspace.getBackendStatus()).state === "ready");
  const pids = await app.evaluate(({ app }) => app.getAppMetrics().filter(m => m.type === "Utility" && m.serviceName?.includes("Node")).map(m => m.pid));
  assert.ok(pids.length > 0, "Owned backend process is observed after readiness");
  for (const pid of pids) backends.add(pid);
  launchUnverified = false;
  const geometry = await app.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const display = screen.getDisplayMatching(window.getBounds());
    return { outer:window.getBounds(), content:window.getContentBounds(), minimum:window.getMinimumSize(),
      display:display.bounds, workArea:display.workArea, scaleFactor:display.scaleFactor };
  });
  checks.push({ freshLaunchGeometry:geometry });
  assert.ok(geometry.outer.width >= 1024 && geometry.outer.height >= 720,
    `Fresh launch window below supported minimum: ${JSON.stringify(geometry)}`);
}
async function scrollState() {
  return page.locator(".desktop-workspace").evaluate(el => ({
    top: el.scrollTop, height: el.scrollHeight, viewport: el.clientHeight,
    hidden: el.hidden, fonts: document.fonts.status,
    rows: [...el.querySelectorAll("tr[data-project-id]")].slice(0, 8).map(row => ({
      ready: row.dataset.fieldsReady, top: row.getBoundingClientRect().top, height: row.getBoundingClientRect().height,
    })),
  }));
}
async function close() { if (app) { await closeElectron(app); app = undefined; } }
try {
  await launch();
  const first = await query({ type: "workspace.create", name: "  Рабочие проекты  ", rootPath: source });
  const preview = await query({ type: "workspace.previewDiscovery", workspaceId: first.workspaceId, mode: "direct" });
  await query({ type: "workspace.applyDiscovery", workspaceId: first.workspaceId, previewToken: preview.previewToken });
  const saved = await query({ type: "workspace.createView", workspaceId: first.workspaceId, name: "Authored Table", kind: "table" });
  const view = saved.views.find(v => v.name === "Authored Table"); assert.ok(view);
  await query({ type: "workspace.activateView", workspaceId: first.workspaceId, viewId: view.viewId });
  await query({ type: "workspace.create", name: "Second workspace", rootPath: source });
  for (let i = 0; i < 24; i++) await query({ type: "workspace.create", name: `Extra workspace ${i}`, rootPath: source });
  await query({ type: "workspace.activate", workspaceId: first.workspaceId }); await page.reload();
  for (const language of ["en", "ru"]) {
    await setInterfaceLanguage(page, language);
    for (const theme of ["light", "dark"]) {
      await openSettingsSection(page, "appearance");
      await page.getByRole("radio", { name: theme === "light" ? /^(Light|Светлая)$/ : /^(Dark|Тёмная)$/ }).click();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      await returnToWorkspace(page);
      for (const size of [{width:1024,height:720},{width:1440,height:960}]) {
        await page.setViewportSize(size);
        await page.getByRole("cell", { name: "Project 00", exact: true }).scrollIntoViewIfNeeded();
        assert.equal(await page.getByRole("combobox", { name: /^(Current view|Текущее представление)$/ }).inputValue(), view.viewId);
        const layout = await page.evaluate(() => {
          const sidebar = document.querySelector(".desktop-sidebar").getBoundingClientRect();
          const scroll = document.querySelector(".desktop-workspace"), sidebarScroll = document.querySelector(".sidebar-scroll");
          return { viewport: sidebar.top === 0 && sidebar.bottom <= window.innerHeight, documentScroll: document.documentElement.scrollHeight > window.innerHeight,
            workScroll: scroll.scrollHeight > scroll.clientHeight, sidebarScroll: sidebarScroll.scrollHeight > sidebarScroll.clientHeight,
            noHorizontalOverflow: document.documentElement.scrollWidth === window.innerWidth };
        });
        assert.deepEqual(layout, { viewport:true, documentScroll:false, workScroll:true, sidebarScroll:true, noHorizontalOverflow:true });
        await page.screenshot({ path: join(evidence, `${language}-${theme}-${size.width}-table.png`) });
        // Keyboard-only entry/return preserves scroll, mounted rows and focus.
        const settings = page.getByRole("button", { name: /^(Settings|Настройки)$/ });
        const scrollBefore = await scrollState();
        await settings.focus();
        const scrollFocused = await scrollState();
        await settings.press("Enter");
        const scrollHidden = await scrollState();
        await page.getByRole("tab", { name: /^(General|Основные)$/ }).focus();
        await page.keyboard.press("Enter");
        await page.keyboard.press("ArrowDown");
        await page.waitForFunction(label => document.activeElement?.textContent === label, language === "en" ? "Appearance" : "Оформление");
        await page.keyboard.press("Enter");
        await page.getByRole("radiogroup", { name: /^(Color theme|Цветовая тема)$/ }).waitFor();
        await page.screenshot({ path: join(evidence, `${language}-${theme}-${size.width}-settings.png`) });
        const back = page.getByRole("button", { name: /^(Back to workspace|Вернуться к работе)$/ });
        await back.focus(); await back.press("Enter");
        assert.equal(await settings.evaluate(el => el === document.activeElement), true);
        const scrollAfter = await scrollState();
        checks.push({ scrollReturn: { language, theme, size, before:scrollBefore, focused:scrollFocused, hidden:scrollHidden, after:scrollAfter } });
        assert.equal(scrollAfter.top, scrollBefore.top);
        checks.push({ language, theme, size, layout, keyboardFocusAndScroll:true });
      }
    }
  }
  // OS changes affect System only, using real renderer media-query notifications.
  await openSettingsSection(page, "appearance");
  await page.getByRole("radio", { name: /^(System|Системная)$/ }).click();
  await page.emulateMedia({ colorScheme: "dark" }); await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await page.emulateMedia({ colorScheme: "light" }); await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
  await returnToWorkspace(page);
  await openSettingsSection(page, "sources");
  await page.getByRole("button", { name: /^(Preview project folders|Посмотреть папки проектов)$/ }).click();
  await page.getByRole("button", { name: /^(Apply reviewed projects|Применить проверенные проекты)$/ }).waitFor();
  await page.getByRole("button", { name: /^(Cancel|Отмена)$/ }).click();
  await returnToWorkspace(page);
  const nav = page.getByRole("navigation", { name: /^(Workspaces|Рабочие пространства)$/ });
  await nav.getByRole("button", { name: /Second workspace/ }).click();
  await page.getByRole("heading", { name: "Second workspace", exact: true }).waitFor();
  await nav.getByRole("button", { name: /Рабочие проекты/ }).click();
  await page.waitForFunction(viewId => document.querySelector('.view-controls select')?.value === viewId, view.viewId);
  assert.equal(await page.getByRole("combobox", { name: /^(Current view|Текущее представление)$/ }).inputValue(), view.viewId);
  await close(); await launch();
  await page.getByRole("heading", { name: "Рабочие проекты", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: /^(Settings|Настройки)$/ }).isVisible(), true);
  const settings = unwrap(await page.evaluate(() => window.workspace.settings({ type: "settings.load" })));
  assert.deepEqual(settings, { language:"ru", appearance:"system" });
  checks.push({ sidebarSwitchAndSavedView:true, systemThemeChanges:true, restartPreferencesAndWorkspace:true });
} catch (error) { failed = error;
  if (page) { await page.screenshot({ path: join(evidence, "failure.png") }).catch(() => {});
    console.log(await page.evaluate(() => ({ focus:document.activeElement?.textContent?.slice(0,80), selected:document.querySelector('[role="tab"][aria-selected="true"]')?.textContent })).catch(() => ({}))); }
}
finally {
  try { await close(); } catch (error) { failed ??= error; }
  const stopped = ownedProcessesStopped(parents, backends, { launchUnverified });
  let cleanup;
  try { await cleanupOwnedFixture(fixture, { processesStopped:stopped, record: result => { cleanup = result; } }); }
  catch (error) { failed ??= error; }
  await writeFile(join(evidence, "result.json"), JSON.stringify({ issue:48, sha:process.env.GITHUB_SHA ?? null, platform:process.platform, checks,
    stopped, cleanup, status:failed ? "failed" : "passed", error:failed?.message }, null, 2));
}
if (failed) throw failed;
console.log("Desktop shell native journey passed");
