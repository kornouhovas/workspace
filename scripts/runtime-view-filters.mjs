import { enterContextFor } from "./runtime-context-tools.mjs";
/* global window, document */
import assert from "node:assert/strict";
import { join } from "node:path";

// Shared by the existing development/packaged views route: exercise the real
// renderer/preload/service path, keeping its owned fixture and shutdown gates.
export async function exerciseViewFilters({ page, query, workspaceId, projectId, propertyId, language, layout, evidenceDirectory }) {
  const en = language === "en";
  const rows = layout === "board" ? page.locator(".project-board:visible > li") : page.locator(".project-table:visible tbody > tr");
  await rows.first().waitFor();
  const filters = page.getByRole("region", { name: en ? "Search and filters" : "Поиск и фильтры", exact: true });
  const controls = await page.locator(".view-filter-controls").count() ? page.locator('.view-filter-controls:not([aria-hidden="true"] *)') : filters;
  await enterContextFor(page,controls);
  const search = controls.getByLabel(en ? "Search project names" : "Поиск по названиям проектов", { exact: true });
  const save = controls.getByRole("button", { name: en ? "Save search and filters" : "Сохранить поиск и фильтры", exact: true });
  const clear = controls.getByRole("button", { name: en ? "Clear search and filters" : "Очистить поиск и фильтры", exact: true });
  const empty = filters.getByText(en ? "No matching projects" : "Нет подходящих проектов", { exact: true });
  await search.fill("does-not-match"); await search.press("Enter"); await empty.waitFor(); assert.equal(await rows.count(), 0);
  for (const width of [360, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 960 : 720 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-${layout}-filter-empty.png`), fullPage: true });
  }
  await clear.focus(); await clear.press("Enter"); await rows.first().waitFor();
  const add = controls.getByRole("button", { name: en ? "Add condition" : "Добавить условие", exact: true });
  const toggle = controls.getByRole("button", { name: en ? "Search and filters" : "Поиск и фильтры", exact: true });
  await toggle.focus(); await toggle.press("Enter");
  await add.focus(); await add.press("Enter");
  await controls.getByLabel(en ? "Property" : "Свойство", { exact: true }).selectOption(propertyId);
  await controls.getByLabel(en ? "Operator" : "Оператор", { exact: true }).selectOption("contains");
  await controls.getByLabel(en ? "Value" : "Значение", { exact: true }).fill("keyboard");
  await save.focus(); await save.press("Enter"); await rows.first().waitFor();
  const viewId = (await query(page, { type: "workspace.listViews", workspaceId })).activeViewId;
  assert.deepEqual((await query(page, { type: "workspace.getViewFilter", workspaceId, viewId })).config.rules,
    [{ propertyId, operator: "contains", operand: "keyboard" }]);
  await query(page, { type: "workspace.setTextValue", workspaceId, projectId, propertyId, value: "Outside result" });
  await empty.waitFor(); assert.equal(await rows.count(), 0);
  await query(page, { type: "workspace.setTextValue", workspaceId, projectId, propertyId, value: "Board keyboard edit" });
  await rows.first().waitFor();
  await page.screenshot({ path: join(evidenceDirectory, `${language}-${layout}-typed-filter.png`), fullPage: true });
  await clear.focus(); await clear.press("Enter"); await rows.first().waitFor();
  return { layout, nameSearch: true, typedCondition: true, liveMembership: true, emptyGuidance: true, keyboard: true, widths: [360, 1024, 1440] };
}
