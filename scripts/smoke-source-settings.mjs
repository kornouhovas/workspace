import { applyReviewedDiscovery } from "./workspace-management-driver.mjs";
/* global window, document */
import assert from "node:assert/strict";
import { runtimeSmokeLaunch } from "./runtime-executable.mjs";
import { mkdtemp, mkdir, realpath, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron } from "playwright-core";
import { closeElectron, cleanupOwnedFixture, ownedProcessesStopped } from "./runtime-lifecycle.mjs";
import { openSettingsSection, setInterfaceLanguage } from "./runtime-settings.mjs";

const root = resolve(import.meta.dirname, "..");
const fixture = await realpath(await mkdtemp(join(tmpdir(), "source-settings-")));
const evidence = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-50-source-settings");
await mkdir(evidence, { recursive: true });
const data = join(fixture, "data"), source = join(fixture, "source");
await mkdir(source); await mkdir(join(source, "Project"));
await writeFile(join(source, "Project", "keep.txt"), "User project bytes");
const parents = new Set(), backends = new Set(), checks = [];
let app, page, failed, launchUnverified = false;
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
const query = input => page.evaluate(input => window.workspace.workspace(input), input).then(unwrap);
async function launch() {
  launchUnverified = true;
  app = await _electron.launch({ ...runtimeSmokeLaunch(root), cwd: root,
    env: { ...process.env, WORKSPACE_USER_DATA_DIR: data }, timeout: 30000 });
  parents.add(app.process()); page = await app.firstWindow(); page.setDefaultTimeout(15000);
  await page.waitForFunction(async () => (await window.workspace.getBackendStatus()).state === "ready");
  const pids = await app.evaluate(({ app }) => app.getAppMetrics().filter(m => m.type === "Utility" && m.serviceName?.includes("Node")).map(m => m.pid));
  assert.ok(pids.length > 0); for (const pid of pids) backends.add(pid);
  launchUnverified = false;
}
async function close() { if (app) { const current = app; app = null; await closeElectron(current); } }
const previewButton = () => page.getByRole("button", { name: /^(Preview project folders|Посмотреть папки проектов)$/ });
async function openSource() {
  await openSettingsSection(page, "sources");
  const entry = page.getByRole("button", { name: source, exact: true });
  await entry.or(page.getByRole("region", { name: source, exact: true })).waitFor();
  if (await entry.isVisible()) await entry.press("Enter");
  await page.getByRole("region", { name: source, exact: true }).waitFor();
}
try {
  await mkdir(join(source, "Client", "Nested"), { recursive: true });
  await launch();
  const first = await query({ type: "workspace.create", name: "First", rootPath: source });
  const second = await query({ type: "workspace.create", name: "Second", rootPath: source });
  const view = await query({ type: "workspace.createView", workspaceId: second.workspaceId, name: "Independent", kind: "board" });
  const beforeViews = await query({ type: "workspace.listViews", workspaceId: second.workspaceId });
  assert.ok(view);
  for (const language of ["en", "ru"]) {
    await setInterfaceLanguage(page, language);
    for (const theme of ["light", "dark"]) {
      await openSettingsSection(page, "appearance");
      await page.getByRole("radio", { name: theme === "light" ? /^(Light|Светлая)$/ : /^(Dark|Тёмная)$/ }).click();
      for (const size of [{ width:1024, height:720 }, { width:1440, height:960 }]) {
        await page.setViewportSize(size); await openSource();
        const detail = page.getByRole("region", { name: source, exact: true });
        assert.equal(await detail.getByText("First", { exact: true }).count(), 1);
        assert.equal(await detail.getByText("Second", { exact: true }).count(), 1);
        await page.screenshot({ path: join(evidence, `${language}-${theme}-${size.width}-source.png`) });
        await previewButton().press("Enter");
        // The visible label is localized by the application's contract.
        await page.locator(".discovery-mode select").selectOption("grouped");
        await page.waitForFunction(() => !document.querySelector(".discovery-panel .workspace-button")?.disabled);
        assert.equal(await page.locator(".discovery-mode select").inputValue(), "grouped");
        await page.screenshot({ path: join(evidence, `${language}-${theme}-${size.width}-review.png`) });
        await page.getByRole("button", { name: /^(Cancel|Отмена)$/ }).press("Enter");
        assert.equal((await query({ type: "workspace.listSources" })).sources[0].mode, null);
        assert.equal((await query({ type: "workspace.load" })).activeWorkspace.workspaceId, second.workspaceId);
        checks.push({ language, theme, size, sharedSource: true, cancelRetainsConfiguration: true });
      }
    }
  }
  await setInterfaceLanguage(page, "en"); await openSource();
  await previewButton().press("Enter"); await page.locator(".discovery-mode select").selectOption("grouped");
  await applyReviewedDiscovery(page);
  assert.equal((await query({ type: "workspace.listProjects", workspaceId:first.workspaceId })).mode, "grouped");
  assert.deepEqual(await query({ type: "workspace.listViews", workspaceId:second.workspaceId }), beforeViews);
  await page.getByRole("region", { name: source, exact: true }).locator(".project-archive summary").click();
  await page.getByRole("textbox", { name:"Archive folder relative to the source", exact:true }).fill("Stored");
  await page.getByRole("button", { name:/Review archive folder/ }).press("Enter");
  await page.getByRole("button", { name:/Confirm archive folder/ }).press("Enter");
  await page.waitForFunction(async () => (await window.workspace.workspace({ type:"workspace.listSources" })).value.sources[0].archiveRelativePath === "Stored");
  await page.getByRole("button", { name:"Refresh source", exact:true }).press("Enter");
  await close(); await launch();
  const saved = (await query({ type:"workspace.listSources" })).sources;
  assert.equal(saved.length, 1); assert.equal(saved[0].mode, "grouped"); assert.equal(saved[0].archiveRelativePath, "Stored");
  assert.deepEqual(await query({ type:"workspace.listViews", workspaceId:second.workspaceId }), beforeViews);
  assert.equal(await readFile(join(source,"Project","keep.txt"),"utf8"), "User project bytes");
  checks.push({ applyShared: true, independentViews: true, archiveDesignation: true, refresh: true, restart: true, filesPreserved: true });
} catch (error) { failed = error; if (page) await page.screenshot({ path:join(evidence, "failure.png") }).catch(() => {}); }
finally {
  try { await close(); } catch (error) { failed ??= error; }
  const stopped = ownedProcessesStopped(parents, backends, { launchUnverified });
  let cleanup;
  try { await cleanupOwnedFixture(fixture, { processesStopped:stopped, record:result => { cleanup = result; } }); } catch (error) { failed ??= error; }
  await writeFile(join(evidence, "result.json"), JSON.stringify({ issue:50, sha:process.env.GITHUB_SHA ?? null, platform:process.platform, checks,
    stopped, cleanup, status:failed ? "failed" : "passed", error:failed?.message }, null, 2));
}
if (failed) throw failed;
console.log("Source settings native journey passed");
