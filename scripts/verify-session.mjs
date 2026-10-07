import { _electron as electron, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createWorkspaceIpcHandler } from "../electron/workspaceIpc.js";

const evidence = resolve(process.env.WORKSPACE_SESSION_EVIDENCE || ".workspace-dev/session-commands/electron");
await mkdir(evidence, { recursive: true });
const report = { checks: [], windows: [], errors: [] };
const fixture = await mkdtemp(join(tmpdir(), "workspace-session-"));
report.fixture = fixture;
const root = join(fixture, "projects");
for (const name of ["Alpha", "Beta"])
  await mkdir(join(root, "Active", `Project ${name}`), { recursive: true });

for (const [width, height] of [[1440, 960], [1024, 720]]) {
  const metadata = join(fixture, `metadata-${width}`);
  const handler = createWorkspaceIpcHandler({
    configPath: join(metadata, "settings.json"),
    viewStorePath: join(metadata, "views.json"),
    propertyStorePath: join(metadata, "properties.json"),
    chooseRoot: async () => root,
  });
  const initial = await handler(null, "workspace.setRoot");
  const secondary = await handler(null, "workspace.createWorkspace", { name: "Secondary" });
  await handler(null, "workspace.setRoot", { workspaceId: secondary.workspace.id });
  await handler(null, "workspace.setActiveWorkspace", { workspaceId: initial.root.workspaceId });
  const app = await electron.launch({
    executablePath: process.env.WORKSPACE_ELECTRON_EXECUTABLE || undefined,
    args: ["electron/main.js"],
    cwd: process.cwd(),
    env: { ...process.env, WORKSPACE_DEV: "1", WORKSPACE_DEV_DATA: metadata, WORKSPACE_DEV_URL: "" },
  });
  let page;
  try {
    page = await app.firstWindow();
    page.on("pageerror", error => report.errors.push(error.message));
    const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert.equal(preferences.contextIsolation, true);
    assert.equal(preferences.nodeIntegration, false);
    assert.equal(preferences.sandbox, true);
    const check = name => report.checks.push(`${width}x${height}: ${name}`);
    const capture = async name => {
      await page.mouse.move(0, height - 1);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
      });
      await page.screenshot({ path: join(evidence, `${name}-${width}x${height}.png`) });
    };
    const tab = name => page.getByRole("tab", { name, exact: true });
    const view = () => tab("Board").first().click();
    const open = async name => {
      await page.getByRole("button", { name, exact: true }).first().click();
      await page.getByRole("button", { name: "Maximize pane (⇧ ⌘ E)", exact: true }).click();
      await tab(name).waitFor();
    };
    const split = async name => {
      const source = await tab(name).boundingBox();
      const target = await page.locator('[data-pane-id="workspace"]').first().boundingBox();
      assert.ok(source && target);
      await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
      // Radix selects inactive tabs on mouse-down; Control-drag keeps the existing
      // Workspace host mounted while the PointerSensor starts.
      await page.keyboard.down("Control");
      await page.mouse.down();
      await page.keyboard.up("Control");
      await page.mouse.move(source.x + source.width / 2 + 8, source.y + source.height / 2, { steps: 3 });
      await page.mouse.move(target.x + target.width - 12, target.y + target.height / 2, { steps: 15 });
      await page.mouse.up();
      await page.locator(".bb-tree-split").first().waitFor();
      // PointerSensor briefly suppresses click after a drop. A subsequent
      // independent action must start after that suppression interval.
      await page.waitForTimeout(100);
    };
    await page.getByRole("button", { name: "Project Alpha", exact: true }).first().waitFor();
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(true);
    await app.evaluate(({ BrowserWindow }, [width, height]) => {
      BrowserWindow.getAllWindows()[0].setBounds({ x: 0, y: 0, width, height });
    }, [width, height]);
    await page.waitForFunction(({ width, height }) => innerWidth === width && innerHeight === height, { width, height });
    await capture("board");
    await open("Project Alpha");
    await capture("expanded");
    await view();
    await open("Project Beta");
    await tab("Project Beta").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Close view", exact: true }).click();
    await page.locator('[data-project-tab-id][aria-selected="true"]').filter({ hasText: "Project Alpha" }).waitFor();
    await page.keyboard.press("ControlOrMeta+Shift+T");
    await tab("Project Beta").waitFor();
    check("tab close fallback and keyboard reopen");

    await view();
    await split("Project Beta");
    await capture("split");
    const paneId = await page.locator(".bb-tree-split [data-pane-id]").filter({ has: page.getByRole("button", { name: "Close pane", exact: true }) }).last().getAttribute("data-pane-id");
    const projectPane = page.locator(`[data-pane-id="${paneId}"]`);
    await projectPane.getByRole("button", { name: "Maximize pane (⇧ ⌘ E)", exact: true }).click();
    await projectPane.getByRole("button", { name: "Restore split", exact: true }).click();
    await projectPane.getByRole("button", { name: "Close pane", exact: true }).click();
    await tab("Project Beta").waitFor();
    check("split drag, maximize/restore and pane close retain project tabs");

    await tab("Project Beta").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Close other tabs", exact: true }).click();
    assert.equal(await page.locator("[data-project-tab-id]").count(), 1);
    await page.keyboard.press("ControlOrMeta+Shift+T");
    await tab("Project Alpha").waitFor();
    check("bulk close and reopen");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("heading", { name: "Appearance", exact: true }).waitFor();
    await page.getByRole("button", { name: "Back to workspace", exact: true }).click();
    await tab("Project Alpha").waitFor();
    await page.reload();
    await tab("Project Alpha").waitFor();
    await tab("Project Beta").waitFor();
    await capture("restored");
    check("Settings navigation and existing session restoration after reload");
    await view();
    await split("Project Beta");
    await page.getByRole("button", { name: "Secondary", exact: true }).click();
    await page.locator("[data-project-tab-id]").first().waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Project Alpha", exact: true }).first().waitFor();
    assert.equal(await page.locator("[data-project-tab-id]").count(), 0);
    await open("Project Alpha");
    assert.equal(await page.locator("[data-project-tab-id]").count(), 1);
    await page.getByRole("button", { name: "Operations", exact: true }).click();
    await tab("Project Beta").waitFor();
    await tab("Project Alpha").waitFor();
    await page.locator(".bb-tree-split").first().waitFor();
    await page.reload();
    await page.locator(".bb-tree-split").first().waitFor();
    await capture("workspace-restored-split");
    check("Workspace switching isolates tabs and retains its split through reload");

    // Delay time at the IPC boundary while retaining the real fixture backend.
    // The retained outgoing surface must reject project selection commands.
    await app.evaluate(({ ipcMain }, config) => {
      const require = process.getBuiltinModule("module").createRequire(config.modulePath);
      const { createWorkspaceIpcHandler } = require(config.modulePath);
      const handler = createWorkspaceIpcHandler(config.options);
      globalThis.sessionCheckPending = false;
      let released = false;
      const gate = new Promise(resolve => {
        globalThis.releaseSessionCheck = () => { released = true; resolve(); };
      });
      ipcMain.removeHandler("workspace:request");
      ipcMain.handle("workspace:request", async (event, method, payload) => {
        if (!released && method === "workspace.getViewProjection" && payload?.viewId === "view:default-table") {
          globalThis.sessionCheckPending = true;
          await gate;
        }
        return handler(event, method, payload);
      });
    }, {
      modulePath: resolve("electron/workspaceIpc.js"),
      options: { configPath: join(metadata, "settings.json"), viewStorePath: join(metadata, "views.json"), propertyStorePath: join(metadata, "properties.json") },
    });
    await tab("Table").first().click();
    await page.waitForFunction(() => document.querySelector('[aria-busy="true"]'));
    await expect.poll(() => app.evaluate(() => globalThis.sessionCheckPending)).toBe(true);
    assert.equal(await page.locator(".bb-tree-split").first().isVisible(), true);
    await tab("Project Alpha").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Duplicate tab", exact: true }).click();
    assert.equal(await page.locator(".bb-tree-split").first().isVisible(), true, "pending view retains the outgoing split instead of selecting the duplicate full-screen");
    await app.evaluate(() => globalThis.releaseSessionCheck());
    await tab("Table").first().waitFor();
    await page.locator('[aria-busy="true"]').first().waitFor({ state: "detached" });
    check("pending saved-view response rejects a project-tab selection command");

    // Restore each saved view's partial preview independently of expanded tabs.
    while (await page.locator("[data-project-tab-id]").count()) {
      await page.locator("[data-project-tab-id]").first().click({ button: "right" });
      await page.getByRole("menuitem", { name: "Close view", exact: true }).click();
    }
    await view();
    await page.getByRole("button", { name: "Project Alpha", exact: true }).first().click();
    await page.getByRole("dialog", { name: "Project Alpha", exact: true }).waitFor();
    await capture("preview-board");
    await tab("Table").first().click();
    await page.locator('[aria-busy="true"]').first().waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Project Beta", exact: true }).first().click();
    await page.getByRole("dialog", { name: "Project Beta", exact: true }).waitFor();
    await capture("preview-table");
    await view();
    await page.getByRole("dialog", { name: "Project Alpha", exact: true }).waitFor();
    await page.reload();
    await page.getByRole("dialog", { name: "Project Alpha", exact: true }).waitFor();
    check("independent saved-view previews survive switching and reload");

    // Delay the Table's project lookup at the existing IPC boundary, then reverse
    // the navigation before the destination is ready.
    const betaId = await page.evaluate(() => {
      const screens = JSON.parse(localStorage.getItem("workspace.project-tabs.v1")).screens;
      return Object.values(screens).find(screen => screen.previewByView?.["view:default-table"])?.previewByView["view:default-table"];
    });
    assert.ok(betaId);
    await app.evaluate(({ ipcMain }, config) => {
      const require = process.getBuiltinModule("module").createRequire(config.modulePath);
      const { createWorkspaceIpcHandler } = require(config.modulePath);
      const handler = createWorkspaceIpcHandler(config.options);
      globalThis.lifecycleLookupPending = false;
      globalThis.lifecycleLookupFinished = false;
      let released = false;
      const gate = new Promise(resolve => { globalThis.releaseLifecycleLookup = () => { released = true; resolve(); }; });
      ipcMain.removeHandler("workspace:request");
      ipcMain.handle("workspace:request", async (event, method, payload) => {
        const delayed = !released && method === "workspace.getProject" && payload?.projectId === config.projectId;
        if (delayed) { globalThis.lifecycleLookupPending = true; await gate; }
        const response = await handler(event, method, payload);
        if (delayed) globalThis.lifecycleLookupFinished = true;
        return response;
      });
    }, { modulePath: resolve("electron/workspaceIpc.js"), projectId: betaId,
      options: { configPath: join(metadata, "settings.json"), viewStorePath: join(metadata, "views.json"), propertyStorePath: join(metadata, "properties.json") } });
    await tab("Table").first().click();
    await expect.poll(() => app.evaluate(() => globalThis.lifecycleLookupPending)).toBe(true);
    await view();
    await page.getByRole("dialog", { name: "Project Alpha", exact: true }).waitFor();
    await app.evaluate(() => globalThis.releaseLifecycleLookup());
    await expect.poll(() => app.evaluate(() => globalThis.lifecycleLookupFinished)).toBe(true);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByRole("dialog", { name: "Project Alpha", exact: true })).toBeVisible();
    assert.equal(await tab("Table").first().getAttribute("aria-selected"), "false");
    check("reversing a pending saved-view lookup rejects its delayed preview");

    await page.evaluate(workspaceId => {
      const saved = JSON.parse(localStorage.getItem("workspace.project-tabs.v1"));
      saved.screens[workspaceId] = { viewId: "view:default-board", tabId: null, previewId: "missing-project", previewByView: { "view:default-board": "missing-project" } };
      localStorage.setItem("workspace.project-tabs.v1", JSON.stringify(saved));
    }, initial.root.workspaceId);
    await page.reload();
    await page.getByRole("button", { name: "Project Alpha", exact: true }).first().waitFor();
    await expect(page.getByRole("dialog", { name: "Project Alpha", exact: true })).toHaveCount(0);
    const cleared = await page.evaluate(workspaceId => JSON.parse(localStorage.getItem("workspace.project-tabs.v1")).screens[workspaceId].previewByView["view:default-board"], initial.root.workspaceId);
    assert.equal(cleared, null);
    check("unavailable saved preview closes its host and persists cleanup");

    await page.evaluate(() => {
      localStorage.setItem("workspace.project-tabs.v1", "malformed");
      localStorage.setItem("workspace.pane-layout.v1", "malformed");
    });
    await page.reload();
    await page.getByRole("button", { name: "Project Alpha", exact: true }).first().click();
    await page.getByRole("dialog", { name: "Project Alpha", exact: true }).waitFor();
    check("malformed session storage leaves project selection usable");

    // Include a failing storage getter, not only getItem/setItem failures.
    await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new Error("Session storage unavailable"); } }));
    await page.reload();
    await page.getByRole("button", { name: "Project Alpha", exact: true }).first().click();
    await page.getByRole("dialog", { name: "Project Alpha", exact: true }).waitFor();
    await page.keyboard.press("ControlOrMeta+J");
    await expect(page.getByRole("dialog", { name: "Project Alpha", exact: true })).toHaveCount(0);
    check("unavailable storage getter leaves preview open and close commands usable");
    report.windows.push(await app.evaluate(({ BrowserWindow }) => ({ bounds: BrowserWindow.getAllWindows()[0].getBounds(), contentBounds: BrowserWindow.getAllWindows()[0].getContentBounds() })));
  } catch (error) {
    report.errors.push(error.stack || String(error));
    if (page) {
      report.diagnostics = await page.evaluate(async () => ({
        root: await window.workspace.request("workspace.getRoot", {}),
        workspaces: await window.workspace.request("workspace.listWorkspaces", {}),
        currentButtons: [...document.querySelectorAll("button[aria-current]")].map(button => button.textContent),
        storage: { ...localStorage },
      })).catch(() => null);
      await page.screenshot({ path: join(evidence, `failure-${width}.png`) }).catch(() => {});
      await writeFile(join(evidence, `failure-${width}.txt`), await page.locator("body").innerText().catch(() => ""));
    }
    throw error;
  } finally {
    await app.close();
    await writeFile(join(evidence, "report.json"), JSON.stringify(report, null, 2));
  }
}
assert.deepEqual(report.errors, []);
console.log(`Session desktop checks passed: ${report.checks.length}; evidence: ${evidence}`);
