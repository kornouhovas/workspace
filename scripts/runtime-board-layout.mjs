import { openGroupingControls,closeGroupingControls } from "./runtime-presentation-controls.mjs";
/* global document, innerWidth, getComputedStyle */
import assert from "node:assert/strict";
import { join } from "node:path";
export async function exerciseBoardLayout({page, query, rootPath, language, evidenceDirectory}) {
  const en = language === "en", workspace = await query(page, {type:"workspace.create", rootPath, name:`Board layout ${language}`});
  const {workspaceId, viewId} = workspace;
  const call = (type, fields = {}) => query(page, {type:`workspace.${type}`, workspaceId, ...fields});
  const projects = (await call("applyDiscovery", {previewToken:(await call("previewDiscovery")).previewToken})).projects;
  await call("setViewLayout", {viewId, kind:"board"});
  const propertyId = (await call("createProperty", {name:"Notes", propertyType:"text"})).propertyId;
  const text = "Exact long content ".repeat(30) + "\nPreserved second line";
  await call("setTextValue", {projectId:projects[0].projectId, propertyId, value:text});
  const groupProperty = (await call("createProperty", {name:"Stage", propertyType:"single_select"})).propertyId;
  const a = (await call("createSelectOption", {propertyId:groupProperty, name:"A", color:"default"})).snapshot.selectOptions.find(o => o.name === "A").optionId;
  await call("createSelectOption", {propertyId:groupProperty, name:"B", color:"blue"});
  await call("setSelectValue", {propertyId:groupProperty, projectId:projects[0].projectId, optionId:a});
  await call("setViewGrouping", {viewId, config:{propertyId:groupProperty, settings:[]}});
  const tags = (await call("createProperty", {name:"Tags", propertyType:"multi_select"})).propertyId;
  const tag = (await call("createSelectOption", {propertyId:tags, name:"A long chip value", color:"default"})).snapshot.selectOptions.find(o => o.propertyId === tags).optionId;
  await call("setMultiSelectValue", {projectId:projects[0].projectId, propertyId:tags, optionIds:[tag]});
  const before = await call("listTextProperties");
  await page.reload();
  const controls = page.getByRole("region", {name:en ? "Board layout" : "Настройки доски", exact:true});
  await controls.locator("summary").press("Enter");
  const enabled = locator => locator.and(page.locator(":enabled"));
  const width = controls.getByLabel(`${en ? "Column width" : "Ширина колонки"}: A`, {exact:true});
  await enabled(width).focus(); await width.press("End");
  await page.waitForFunction(() => document.querySelector('.project-group[aria-label="A"]')?.style.flexBasis === "800px");
  await page.waitForFunction(label => document.activeElement?.getAttribute("aria-label") === label, `${en ? "Column width" : "Ширина колонки"}: A`);
  await width.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelector('.project-group[aria-label="A"]')?.style.flexBasis === "799px");
  const wrap = controls.getByLabel(en ? "Wrap card content" : "Переносить содержимое карточек", {exact:true});
  await enabled(wrap).press("Space");
  await page.waitForFunction(() => {
    const text = document.querySelector(".board-content-nowrap .text-value-button");
    return text && getComputedStyle(text).whiteSpace === "nowrap" && getComputedStyle(text).textOverflow === "ellipsis";
  });
  assert.equal(await page.locator(".board-content-nowrap .multi-select-values").evaluate(el => getComputedStyle(el).flexWrap), "nowrap");
  await enabled(wrap).press("Space");
  await page.waitForFunction(() => {
    const chips = document.querySelector(".board-content-wrap .multi-select-values");
    return chips && getComputedStyle(chips).flexWrap === "wrap";
  });
  await enabled(wrap).press("Space");
  await page.locator(".board-content-nowrap").first().waitFor();
  // Presentation clipping must not obstruct keyboard editing or alter exact values.
  const textButton = page.locator('.project-group[aria-label="A"] .text-value-button').first();
  await textButton.focus(); await textButton.press("Enter");
  const textarea = page.locator('.project-group[aria-label="A"] textarea');
  await textarea.waitFor(); assert.equal(await textarea.inputValue(), text); await textarea.press("Escape");
  const visible = controls.getByLabel(`${en ? "Show on cards" : "Показывать в карточках"}: Notes`, {exact:true});
  await enabled(visible).press("Space");
  await page.waitForFunction(id => !document.querySelector(`.project-card [data-column-id="${id}"]`), propertyId);
  const grouping=await openGroupingControls(page,language);
  const later = grouping.getByRole("button", {name:`${en ? "Move group later" : "Переместить группу ниже"}: A`, exact:true});
  await enabled(later).press("Enter");
  await page.waitForFunction(() => document.querySelector(".project-group")?.getAttribute("aria-label") === "B");
  const hide = grouping.getByRole("button", {name:`${en ? "Hide group" : "Скрыть группу"}: A`, exact:true});
  await enabled(hide).press("Enter");
  await page.locator('.project-group[aria-label="A"]').waitFor({state:"detached"});
  await enabled(grouping.getByRole("button", {name:`${en ? "Show group" : "Показать группу"}: A`, exact:true})).press("Enter");
  await page.locator('.project-group[aria-label="A"]').waitFor();
  await closeGroupingControls(page,language);
  assert.deepEqual(await call("listTextProperties"), before);
  await call("updateSelectOption", {propertyId:groupProperty, optionId:a, name:"Renamed", color:"default"});
  await page.locator('.project-group[aria-label="Renamed"]').waitFor();
  assert.equal(await page.locator('.project-group[aria-label="Renamed"]').evaluate(el => el.style.flexBasis), "799px");
  await call("createSelectOption", {propertyId:groupProperty, name:"New", color:"default"});
  await page.locator('.project-group[aria-label="New"]').waitFor();
  assert.equal(await page.locator('.project-group[aria-label="New"]').evaluate(el => el.style.flexBasis), "384px");
  const saved = (await call("getBoardLayout", {viewId})).config;
  const copy = (await call("duplicateView", {viewId, name:"Independent Board"})).activeViewId;
  assert.deepEqual((await call("getBoardLayout", {viewId:copy})).config, saved);
  await call("setBoardLayout", {viewId:copy, config:{widths:[], properties:[], wrap:true}});
  assert.deepEqual((await call("getBoardLayout", {viewId})).config, saved);
  await call("activateView", {viewId}); await page.reload();
  await page.locator('.project-group[aria-label="Renamed"] .board-content-nowrap').waitFor();
  assert.equal(await page.locator('.project-group[aria-label="Renamed"]').evaluate(el => el.style.flexBasis), "799px");
  assert.equal(await page.locator(`.project-card [data-column-id="${propertyId}"]`).count(), 0);
  for (const width of [360, 1024, 1440]) {
    await page.setViewportSize({width, height:width === 1440 ? 960 : 720});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width === 360) assert.equal(await page.locator(".grouped-board").evaluate(el => el.scrollWidth > el.clientWidth), true);
    await page.screenshot({path:join(evidenceDirectory, `${language}-${width}-board-layout.png`), fullPage:true});
  }
  return {keyboard:true, widths:true, wrap:true, editorUnclipped:true, visibility:true, orderOnly:true, stableRename:true, newDefault:true, independentCopy:true, reload:true, widthsChecked:[360,1024,1440]};
}
