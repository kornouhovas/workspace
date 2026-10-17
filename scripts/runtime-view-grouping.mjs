/* global window, document */
import assert from "node:assert/strict";
import { join } from "node:path";

// Extends the existing owned development/packaged view fixture and cleanup route.
export async function exerciseViewGrouping({ page, query, workspaceId, propertyId, language, layout, evidenceDirectory }) {
  const en = language === "en";
  const panel = page.getByRole("region", { name: en ? "Grouping" : "Группировка", exact: true });
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
  await grouping.and(page.locator(":enabled")).selectOption("");
  await group().waitFor({ state: "hidden" }); await rows.first().waitFor();
  return { layout, exactScalar: true, serviceProjection: true, hideShow: true, collapseExpand: true, keyboard: true, widths: [360, 1024, 1440] };
}
