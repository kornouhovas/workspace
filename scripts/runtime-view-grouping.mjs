import { closeGroupingForSelection } from "./selection-editor-driver.mjs";
import { openGroupingControls, closeGroupingControls } from "./runtime-presentation-controls.mjs";
/* global window, document */
import assert from "node:assert/strict";
import { join } from "node:path";

// Extends the existing owned development/packaged view fixture and cleanup route.
export async function exerciseViewGrouping({ page, query, workspaceId, propertyId, language, layout, evidenceDirectory }) {
  const en = language === "en";
  const panel = await openGroupingControls(page, language);
  const grouping = panel.getByLabel(en ? "Group by" : "Группировать по", { exact: true });
  const viewId = (await query(page, { type: "workspace.listViews", workspaceId })).activeViewId;
  const rows = page.locator(layout === "board" ? ".project-board:visible > li" : ".project-table:visible tbody > tr");
  const group = () => page.getByRole("heading", { name: "Board keyboard edit (1)", exact: true });
  await grouping.and(page.locator(":enabled")).selectOption(propertyId);
  await group().waitFor();
  const order = panel.getByLabel(en ? "Group order" : "Порядок групп", { exact: true });
  await order.and(page.locator(":enabled")).selectOption("descending");
  const collapse = panel.getByRole("button", { name: `${en ? "Collapse group" : "Свернуть группу"}: Board keyboard edit`, exact: true });
  await collapse.and(page.locator(":enabled")).focus(); await collapse.press("Enter");
  await page.waitForFunction(selector => document.querySelectorAll(selector).length === 0, layout === "board" ? ".project-card" : "tbody tr");
  const expand = panel.getByRole("button", { name: `${en ? "Expand group" : "Развернуть группу"}: Board keyboard edit`, exact: true });
  await expand.and(page.locator(":enabled")).focus(); await expand.press("Enter"); await rows.first().waitFor();
  const hide = panel.getByRole("button", { name: `${en ? "Hide group" : "Скрыть группу"}: Board keyboard edit`, exact: true });
  await hide.and(page.locator(":enabled")).focus(); await hide.press("Enter"); await group().waitFor({ state: "hidden" });
  const show = panel.getByRole("button", { name: `${en ? "Show group" : "Показать группу"}: Board keyboard edit`, exact: true });
  await show.and(page.locator(":enabled")).focus(); await show.press("Enter"); await group().waitFor();
  for (const width of [360, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 960 : 720 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-${layout}-grouping.png`), fullPage: true });
  }
  const config = (await query(page, { type: "workspace.getViewGrouping", workspaceId, viewId })).config;
  assert.equal(config.propertyId, propertyId); assert.equal(config.settings.find(s => s.propertyId === propertyId).order, "descending");
  await openGroupingControls(page, language);
  await grouping.and(page.locator(":enabled")).selectOption("");
  await closeGroupingControls(page, language);
  await group().waitFor({ state: "hidden" }); await rows.first().waitFor();
  await closeGroupingControls(page, language);
  return { layout, exactScalar: true, serviceProjection: true, hideShow: true, collapseExpand: true, keyboard: true, widths: [360, 1024, 1440] };
}

// Reuse the owned views runtime for real preload/IPC and visual coverage.
export async function exerciseSelectionGrouping({ page, query, workspaceId, language, layout, evidenceDirectory }) {
  const en = language === "en";
  const panel = await openGroupingControls(page, language);
  const grouping = panel.getByLabel(en ? "Group by" : "Группировать по", { exact: true });
  const call = (type, fields = {}) => query(page, { type: `workspace.${type}`, workspaceId, ...fields });
  const projectId = (await call("listProjects")).projects[0].projectId;
  const snapshot = await call("listTextProperties");
  const propertyId = snapshot.definitions.find(p => p.name === "Grouping tags")?.propertyId ??
    (await call("createProperty", { name: "Grouping tags", propertyType: "multi_select" })).propertyId;
  let options = (await call("listTextProperties")).selectOptions.filter(o => o.propertyId === propertyId);
  if (!options.length) for (const name of ["A", "B", "Unused"]) {
    options = (await call("createSelectOption", { propertyId, name, color: "default" })).snapshot.selectOptions.filter(o => o.propertyId === propertyId);
  }
  const [a, b] = options;
  await call("setMultiSelectValue", { projectId, propertyId, optionIds: [a.optionId, b.optionId] });
  await grouping.and(page.locator(":enabled")).selectOption(propertyId);
  await page.getByRole("heading", { name: "A (1)", exact: true }).waitFor();
  await page.getByRole("heading", { name: "B (1)", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Unused (0)", exact: true }).waitFor();
  const viewId = (await call("listViews")).activeViewId;
  const groups = (await call("queryView", { viewId, archived: false })).groups;
  assert.deepEqual(groups.slice(0, 2).map(g => g.projectIds), [[projectId], [projectId]]);
  await closeGroupingForSelection(page, language);
  const value = page.getByRole("region", { name: "B", exact: true }).getByRole("button", {
    name: `${en ? "Edit MultiSelect value" : "Редактировать MultiSelect-значение"}: Project / Grouping tags`, exact: true });
  await value.and(page.locator(":enabled")).focus(); await value.press("Enter");
  const editor = page.getByRole("region", { name: "B", exact: true });
  await editor.getByRole("checkbox", { name: "A", exact: true }).uncheck();
  await page.waitForFunction(async ({workspaceId,propertyId,projectId,optionId}) => {
    const result=await window.workspace.workspace({type:"workspace.listTextProperties",workspaceId});
    const values=result.value.multiSelectValues.filter(value=>value.propertyId===propertyId&&value.projectId===projectId);
    return values.length===1&&values[0].optionId===optionId;
  }, {workspaceId,propertyId,projectId,optionId:b.optionId});
  await editor.getByRole("button",{name:en ? "Close" : "Закрыть",exact:true}).and(page.locator(":enabled")).waitFor();
  assert.equal(await editor.getByRole("dialog").isVisible(),true);
  await editor.getByRole("checkbox",{name:"B",exact:true}).press("Escape");
  await page.getByRole("heading", { name: "A (0)", exact: true }).waitFor();
  await page.getByRole("heading", { name: "B (1)", exact: true }).waitFor();
  await call("setMultiSelectValue", { projectId, propertyId, optionIds: [a.optionId, b.optionId] });
  await page.getByRole("heading", { name: "A (1)", exact: true }).waitFor();
  for (const width of [360, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 960 : 720 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-${layout}-selection-grouping.png`), fullPage: true });
  }
  await openGroupingControls(page, language);
  await grouping.and(page.locator(":enabled")).selectOption("");
  await closeGroupingControls(page, language);
  await page.getByRole("heading", { name: "A (1)", exact: true }).waitFor({ state: "hidden" });
  return { layout, stableOptionIds: true, repeatedLogicalId: true, keyboardEditFromOccurrence: true, widths: [360, 1024, 1440] };
}

export async function exerciseCategoryGrouping({ page, query, rootPath, language, evidenceDirectory }) {
  const en = language === "en";
  const workspace = await query(page, { type: "workspace.create", rootPath, name: `Category groups ${language}` });
  const { workspaceId, viewId } = workspace;
  const call = (type, fields = {}) => query(page, { type: `workspace.${type}`, workspaceId, ...fields });
  const preview = await call("previewDiscovery", { mode: "grouped" });
  const list = await call("applyDiscovery", { previewToken: preview.previewToken });
  await call("activate"); await page.reload();
  const grouping = (await openGroupingControls(page, language))
    .getByLabel(en ? "Group by" : "Группировать по", { exact: true });
  await grouping.and(page.locator(":enabled")).selectOption(list.categoryProperty.propertyId);
  await closeGroupingControls(page, language);
  for (const layout of ["table", "board"]) {
    await call("updateView", { viewId, name: "Categories", kind: layout });
    await page.getByRole("heading", { name: "Category (1)", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Empty (0)", exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: en ? "No value (0)" : "Без значения (0)", exact: true }).count(), 0);
    const groups = (await call("queryView", { viewId, archived: false })).groups;
    assert.deepEqual(groups.map(g => g.value), list.categories.map(c => c.categoryId));
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 720 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-${layout}-category-grouping.png`), fullPage: true });
    }
  }
  return { categoryIdentity: true, noEmptyDestination: true, layouts: ["table", "board"], widths: [360, 1440] };
}

export async function exerciseRetainedCategoryGrouping({ page, query, rootPath, language, evidenceDirectory }) {
  const en = language === "en";
  const { workspaceId, viewId } = await query(page, { type: "workspace.create", rootPath, name: `Recovery groups ${language}` });
  const call = (type, fields = {}) => query(page, { type: `workspace.${type}`, workspaceId, ...fields });
  const direct = await call("previewDiscovery", { mode: "direct" });
  const projectId = (await call("applyDiscovery", { previewToken: direct.previewToken })).projects[0].projectId;
  const propertyId = (await call("createProperty", { name: "Notes", propertyType: "text" })).propertyId;
  await call("setTextValue", { projectId, propertyId, value: "Preserved" });
  const grouped = await call("previewDiscovery", { mode: "grouped" });
  const list = await call("applyDiscovery", { previewToken: grouped.previewToken });
  assert.equal(list.retainedProjects[0].projectId, projectId);
  await call("activate"); await page.reload();
  const grouping = (await openGroupingControls(page, language))
    .getByLabel(en ? "Group by" : "Группировать по", { exact: true });
  await grouping.and(page.locator(":enabled")).selectOption(list.categoryProperty.propertyId);
  await closeGroupingControls(page, language);
  for (const layout of ["table", "board"]) {
    await call("updateView", { viewId, name: "Recovery", kind: layout });
    const group = page.getByRole("region", { name: en ? "No value" : "Без значения", exact: true });
    await group.getByRole("heading", { name: en ? "No value (1)" : "Без значения (1)", exact: true }).waitFor();
    const locate = group.getByRole("button", { name: `${en ? "Locate folder" : "Найти папку"}: Retained`, exact: true });
    await locate.waitFor(); assert.equal(await locate.isEnabled(), true);
    const value = group.getByRole("button", { name: `${en ? "Edit Text value" : "Редактировать Text-значение"}: Retained / Notes`, exact: true });
    await value.and(page.locator(":enabled")).focus(); await value.press("Enter");
    await group.getByRole("textbox").fill(`Recovered ${layout}`);
    const save = group.getByRole("button", { name: en ? "Save value" : "Сохранить значение", exact: true });
    await save.focus(); await save.press("Enter"); await value.waitFor();
    assert.equal((await call("listTextProperties")).values[0].value, `Recovered ${layout}`);
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 720 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-${layout}-retained-grouping.png`), fullPage: true });
    }
  }
  return { retainedLogicalId: true, conditionalNoValue: true, recoveryControl: true, keyboardMetadataEdit: true };
}
