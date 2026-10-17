/* global document, innerWidth, getComputedStyle */
import assert from "node:assert/strict";
import { join } from "node:path";
export async function exerciseTableLayout({page,query,rootPath,language,evidenceDirectory}) {
  const en=language==="en", workspace=await query(page,{type:"workspace.create",rootPath,name:`Table layout ${language}`});
  const {workspaceId,viewId}=workspace;
  const call=(type,fields={})=>query(page,{type:`workspace.${type}`,workspaceId,...fields});
  const preview=await call("previewDiscovery"), projects=(await call("applyDiscovery",{previewToken:preview.previewToken})).projects;
  const propertyId=(await call("createProperty",{name:"Notes",propertyType:"text"})).propertyId;
  const text="Long authored text ".repeat(12)+"\nExact second line";
  await call("setTextValue",{projectId:projects[0].projectId,propertyId,value:text});
  await page.reload();
  const controls=page.getByRole("region",{name:en?"Table layout":"Настройки таблицы",exact:true});
  await controls.locator("summary").press("Enter");
  const visible=controls.getByLabel(`${en?"Visible":"Показывать"}: Notes`,{exact:true});
  await visible.and(page.locator(":enabled")).focus();await visible.press("Space");
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll("th")).some(th=>th.textContent.includes("Notes")));
  await visible.and(page.locator(":enabled")).press("Space");
  const earlier=controls.getByRole("button",{name:`${en?"Move column earlier":"Переместить столбец раньше"}: Notes`,exact:true});
  await earlier.and(page.locator(":enabled")).press("Enter");
  await page.waitForFunction(()=>document.querySelector("th")?.textContent.includes("Notes"));
  const width=controls.getByLabel(`${en?"Column width":"Ширина столбца"}: Notes`,{exact:true});
  await width.and(page.locator(":enabled")).focus();await width.press("End");
  await page.waitForFunction(()=>document.querySelector('th[data-column-id]')?.style.width==="800px");
  await page.waitForFunction(label=>document.activeElement?.getAttribute("aria-label")===label,`${en?"Column width":"Ширина столбца"}: Notes`);
  await width.press("ArrowLeft");
  await page.waitForFunction(()=>document.querySelector('th[data-column-id]')?.style.width==="799px");
  await page.waitForFunction(label=>document.activeElement?.getAttribute("aria-label")===label,`${en?"Column width":"Ширина столбца"}: Notes`);
  const wrap=controls.getByLabel(`${en?"Wrap Text":"Переносить текст"}: Notes`,{exact:true});
  await wrap.and(page.locator(":enabled")).press("Space");
  await page.waitForFunction(()=>document.querySelector("td.table-text-wrap .text-value-button") && getComputedStyle(document.querySelector("td.table-text-wrap .text-value-button")).whiteSpace==="pre-wrap");
  const later=page.getByRole("button",{name:`${en?"Move row later":"Переместить строку позже"}: Alpha`,exact:true});
  await later.and(page.locator(":enabled")).press("Enter");
  await page.waitForFunction(()=>document.querySelector("tbody tr")?.textContent.includes("Beta"));
  const drag=page.getByRole("button",{name:`${en?"Drag to reorder row":"Перетащить строку для изменения порядка"}: Beta`,exact:true});
  await drag.and(page.locator(":enabled")).dragTo(page.locator(`tr[data-project-id="${projects.find(p=>p.name==="Alpha").projectId}"]`));
  await page.waitForFunction(()=>document.querySelector("tbody tr")?.textContent.includes("Alpha"));
  const saved=(await call("getTableLayout",{viewId})).config;
  assert.equal(saved.columns.find(c=>c.propertyId===propertyId).width,799);
  assert.equal(saved.columns.find(c=>c.propertyId===propertyId).wrap,true);
  const properties=await call("listTextProperties");assert.equal(properties.values[0].value,text);
  const copy=(await call("duplicateView",{viewId,name:"Independent layout"})).activeViewId;
  assert.deepEqual((await call("getTableLayout",{viewId:copy})).config,saved);
  await call("setTableLayout",{viewId:copy,config:{columns:[],rowOrder:[]}});
  assert.deepEqual((await call("getTableLayout",{viewId})).config,saved);
  const sibling=await query(page,{type:"workspace.create",rootPath,name:"Layout sibling"});
  assert.deepEqual((await query(page,{type:"workspace.getTableLayout",workspaceId:sibling.workspaceId,viewId:sibling.viewId})).config,{columns:[],rowOrder:[]});
  await call("activate");await call("activateView",{viewId});await page.reload();
  await page.getByRole("region",{name:en?"Table layout":"Настройки таблицы",exact:true}).locator("summary").press("Enter");
  await page.waitForFunction(()=>document.querySelector("th")?.textContent.includes("Notes"));
  for(const width of [360,1024,1440]) {
    await page.setViewportSize({width,height:width===1440?960:720});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if (width === 360) assert.equal(await page.locator(".project-table-scroll").evaluate(el=>el.scrollWidth>el.clientWidth),true);
    await page.screenshot({path:join(evidenceDirectory,`${language}-${width}-table-layout.png`),fullPage:true});
  }
  return {keyboard:true,dragOrderOnly:true,columns:true,width:true,wrap:true,independentCopy:true,sibling:true,reload:true,widths:[360,1024,1440]};
}
