import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createWorkspaceIpcHandler } from "../electron/workspaceIpc.js";

const evidence = resolve("work/bb-stack-design/electron");
await mkdir(evidence, { recursive: true });
const fixture = await mkdtemp(join(tmpdir(), "workspace-bb-desktop-"));
const root = join(fixture, "projects");
const metadata = join(fixture, "metadata");
for (const path of ["Active/Project Alpha/docs", "Active/Project Beta", "Done/Project Gamma"])
  await mkdir(join(root, path), { recursive: true });
await writeFile(
  join(root, "Active/Project Alpha/README.md"),
  "# Alpha\nTemporary desktop verification fixture.\n",
);
await writeFile(join(root, "Active/Project Alpha/docs/notes.txt"), "Temporary file\n");
const handler = createWorkspaceIpcHandler({
  configPath: join(metadata, "settings.json"),
  viewStorePath: join(metadata, "views.json"),
  propertyStorePath: join(metadata, "properties.json"),
  chooseRoot: async () => root,
});
const initial = await handler(null, "workspace.setRoot");
const workspaceId = initial.root.workspaceId;
const property = (
  await handler(null, "workspace.createProperty", { workspaceId, name: "Notes", type: "text" })
).property;
const table = { id: "view:default-table" };
await handler(null, "workspace.updateView", {
  workspaceId,
  viewId: table.id,
  patch: { visiblePropertyIds: ["property:name", "property:status", property.id] },
});
const board = "view:default-board";
await handler(null, "workspace.updateView", {
  workspaceId,
  viewId: board,
  patch: { visiblePropertyIds: ["property:name", "property:status", property.id] },
});
await handler(null, "workspace.setActiveView", { workspaceId, viewId: board });
const app = await electron.launch({
  args: ["electron/main.js"],
  cwd: process.cwd(),
  env: { ...process.env, WORKSPACE_DEV: "1", WORKSPACE_DEV_DATA: metadata, WORKSPACE_DEV_URL: "" },
});
const results = { fixture, evidence, checks: [], windows: [], errors: [] };
let page;
const check = (name) => results.checks.push(name);
try {
  page = await app.firstWindow();
  const settle = async () => {
    await page.waitForTimeout(450);
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
    });
  };
  page.on("pageerror", (error) => results.errors.push(error.message));
  await page.getByRole("button", { name: "Project Alpha", exact: true }).waitFor();
  const actual = await app.evaluate(({ app, BrowserWindow }) => ({
    userData: app.getPath("userData"),
    security: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  }));
  assert.equal(actual.userData, join(metadata, "electron"));
  assert.equal(actual.security.contextIsolation, true);
  assert.equal(actual.security.nodeIntegration, false);
  assert.equal(actual.security.sandbox, true);
  check(
    "Real Electron userData isolated; contextIsolation=true, nodeIntegration=false, sandbox=true",
  );
  const request = (method, payload = {}) =>
    page.evaluate(({ method, payload }) => window.workspace.request(method, payload), {
      method,
      payload,
    });
  const projection = await request("workspace.getViewProjection", { workspaceId, viewId: board });
  const alpha = projection.projection.columns
    .flatMap((c) => c.projects)
    .find((p) => p.name === "Project Alpha");
  for (const [width, height] of [
    [1440, 960],
    [1024, 720],
  ]) {
    await app.evaluate(
      ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size),
      [width, height],
    );
    await page.waitForTimeout(250);
    results.windows.push(
      await app.evaluate(({ BrowserWindow }) => ({
        bounds: BrowserWindow.getAllWindows()[0].getBounds(),
        contentBounds: BrowserWindow.getAllWindows()[0].getContentBounds(),
      })),
    );
    await settle();
    await page.screenshot({ path: join(evidence, `board-${width}x${height}.png`) });
    await page.getByRole("button", { name: "Project Alpha", exact: true }).click();
    await page.getByRole("button", { name: "Expand project", exact: true }).click();
    await page.locator(".workspace-project-detail-expanded #project-detail-title").waitFor();
    await settle();
    await page.screenshot({ path: join(evidence, `project-${width}x${height}.png`) });
    await page.getByRole("button", { name: "Close project details", exact: true }).last().click();
    await settle();
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.getByRole("tab", { name: "Table", exact: true }).click();
    await page.getByRole("row").filter({ hasText: "Project Alpha" }).waitFor();
    await settle();
    await page.screenshot({ path: join(evidence, `table-${width}x${height}.png`) });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("heading", { name: "Folder role tree", exact: true }).waitFor();
    await settle();
    await page.screenshot({ path: join(evidence, `settings-${width}x${height}.png`) });
    await page.getByRole("button", { name: "Back to workspace", exact: true }).click();
    await page.getByRole("tab", { name: "Board", exact: true }).click();
    check(`Board, Table, expanded Project and Settings at real ${width}x${height} window size`);
  }
  await request("workspace.updateProjectPropertyValue", {
    workspaceId,
    projectId: alpha.id,
    propertyId: property.id,
    value: "Verified through preload IPC",
  });
  assert.match(
    await readFile(join(metadata, "properties.json"), "utf8"),
    /Verified through preload IPC/,
  );
  check("Property changes persist through real preload IPC to isolated JSON");
  await page.reload();
  await page.getByRole("button", { name: "Project Alpha", exact: true }).waitFor();
  await page.getByRole("button", { name: "Project Alpha", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Verified through preload IPC", { exact: true })
    .waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Edit Notes value", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Edit Notes value", exact: true })
    .fill("Edited in project UI");
  await page.getByRole("textbox", { name: "Edit Notes value", exact: true }).press("Tab");
  await page.getByRole("dialog").getByText("Edited in project UI", { exact: true }).waitFor();
  assert.match(await readFile(join(metadata, "properties.json"), "utf8"), /Edited in project UI/);
  check("Text property edited in real Project Detail UI and persisted in fixture metadata");
  check("Saved property displayed in Project Detail after renderer restart");
  await page.getByRole("button", { name: "Expand project", exact: true }).click();
  await page.getByRole("tab", { name: "Project Alpha", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Board", exact: true }).click();
  await page.getByRole("tab", { name: "Project Alpha", exact: true }).click();
  await page.reload();
  await page.locator("#project-detail-title").waitFor();
  check(
    "Expanded project tab switches independently from saved views and survives renderer restart",
  );
  await page.getByRole("button", { name: "Close project details", exact: true }).last().click();
  await page.getByPlaceholder("Project name", { exact: true }).fill("Beta");
  await page.getByRole("button", { name: "Project Beta", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Project Alpha", exact: true }).count(), 0);
  await page.getByPlaceholder("Project name", { exact: true }).fill("");
  check("Scoped search filters board and restores projects when cleared");
  const done = projection.statusValues.find((v) => v.name === "Done");
  await request("workspace.updateView", {
    workspaceId,
    viewId: board,
    patch: { valueVisibility: { "property:status": { valueIds: [done.id] } } },
  });
  const filtered = await request("workspace.getViewProjection", { workspaceId, viewId: board });
  const filteredProjects = filtered.projection.columns.flatMap((column) => column.projects);
  assert.equal(filteredProjects.length, 1);
  assert.equal(filteredProjects[0].name, "Project Gamma");
  await page.reload();
  await page.getByRole("button", { name: "Project Gamma", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Project Alpha", exact: true }).count(), 0);
  await request("workspace.updateView", {
    workspaceId,
    viewId: board,
    patch: { valueVisibility: {} },
  });
  check("Status value filter persists via IPC and changes rendered board lanes");
  const tree = await request("workspace.listProjectFileTree", { path: alpha.currentRelativePath });
  assert.match(JSON.stringify(tree), /README.md/);
  const preview = await request("workspace.previewFile", {
    path: "Active/Project Alpha/README.md",
  });
  assert.match(preview.contentType, /markdown/);
  const opened = await request("workspace.reveal", {
    path: "Active/Project Alpha/README.md",
    kind: "file",
  });
  assert.ok(opened);
  await assert.rejects(request("workspace.previewFile", { path: "../outside.txt" }));
  assert.match(
    await readFile(join(root, "Active/Project Alpha/README.md"), "utf8"),
    /Temporary desktop/,
  );
  check(
    "Project file tree, safe preview, actual OS open on temporary README and traversal rejection through IPC; fixture content preserved",
  );
  assert.deepEqual(results.errors, []);
  results.security = actual.security;
  await writeFile(join(evidence, "report.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  results.failure = error.stack;
  if (page) {
    await page.screenshot({ path: join(evidence, "failure.png") });
    await writeFile(join(evidence, "failure-dom.txt"), await page.locator("body").innerText());
  }
  await writeFile(join(evidence, "report.json"), JSON.stringify(results, null, 2));
  throw error;
} finally {
  await app.close();
}
