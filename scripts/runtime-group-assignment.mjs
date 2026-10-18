/* global document, innerWidth */
import assert from "node:assert/strict";
import { join } from "node:path";
export async function exerciseGroupAssignment({page,query,rootPath,language,evidenceDirectory}) {
  const en=language==="en", workspace=await query(page,{type:"workspace.create",rootPath,name:`Assignment ${language}`});
  const {workspaceId,viewId}=workspace;
  const call=(type,fields={})=>query(page,{type:`workspace.${type}`,workspaceId,...fields});
  const preview=await call("previewDiscovery"),projects=(await call("applyDiscovery",{previewToken:preview.previewToken})).projects;
  const a=projects.find(p=>p.name==="Alpha"),b=projects.find(p=>p.name==="Beta");
  const checks=[];
  for(const type of ["text","number","date","single_select"]) {
    const propertyId=(await call("createProperty",{name:`Assignment ${type}`,propertyType:type})).propertyId;
    let target=type==="text"?" Exact ":type==="number"?0:"2024-02-29";
    if(type==="single_select")target=(await call("createSelectOption",{propertyId,name:"Ready",color:"green"})).snapshot.selectOptions.find(o=>o.propertyId===propertyId).optionId;
    await call(type==="text"?"setTextValue":type==="number"?"setNumberValue":type==="date"?"setDateValue":"setSelectValue",{projectId:b.projectId,propertyId,[type==="number"?"expression":type==="single_select"?"optionId":"value"]:String(target)});
    await call("setViewGrouping",{viewId,config:{propertyId,settings:[]}});
    for(const layout of ["table","board"]) {
      await call("setViewLayout",{viewId,kind:layout});await page.reload();
      const handle=page.getByRole("button",{name:`${en?"Drag to change group":"Перетащить для изменения группы"}: Alpha`,exact:true}).and(page.locator(":enabled"));
      const targetLabel=type==="single_select"?"Ready":String(target);
      const destination = page.locator(".project-group").getByRole("heading",{name:`${targetLabel.trim()} (1)`,exact:true});
      // Place both endpoints in view before mouse-down; scrolling during the
      // gesture can prevent Chromium from starting the native drag at all.
      await destination.evaluate(element => element.scrollIntoView({block:"start",inline:"nearest"}));
      await handle.dragTo(destination);
      const label=`${en?"Change group":"Изменить группу"}: Alpha`;
      await page.waitForFunction(({label,value})=>document.querySelector(`select[aria-label="${label}"]`)?.value===value,{label,value:JSON.stringify(target)});
      const snapshot=await call("listTextProperties"),rows=type==="number"?snapshot.numberValues:type==="date"?snapshot.dateValues:type==="single_select"?snapshot.selectValues:snapshot.values;
      assert.equal(rows.find(v=>v.projectId===a.projectId&&v.propertyId===propertyId)[type==="single_select"?"optionId":"value"],target);
      for(const width of [360,1440]) {
        await page.setViewportSize({width,height:width===1440?960:720});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        if(type==="text")await page.screenshot({path:join(evidenceDirectory,`${language}-${layout}-${width}-group-assignment.png`),fullPage:true});
      }
      await page.waitForFunction(label=>document.activeElement?.getAttribute("aria-label")===label,label);
      const clear=page.getByRole("button",{name:`${en?"Clear grouping value":"Очистить значение группировки"}: Alpha`,exact:true}).and(page.locator(":enabled"));
      await clear.focus();await clear.press("Enter");
      await page.waitForFunction(label=>document.querySelector(`select[aria-label="${label}"]`)?.value==="null",label);
      await page.reload();await page.getByLabel(label,{exact:true}).waitFor();
      assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),"null");
      checks.push({type,layout,pointer:true,keyboardClear:true,focusRestored:true,reload:true,widths:[360,1440]});
    }
  }
  assert.deepEqual((await call("listProjects")).projects,projects);
  return {checks,filesUnchanged:true};
}
