/* global document, innerWidth */
import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
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
  checks.push(...await exerciseMultiSelectAssignment({page,call,viewId,project:a,language,evidenceDirectory}));
  assert.deepEqual((await call("listProjects")).projects,projects);
  return {checks,filesUnchanged:true};
}

// Observe the original native gesture without dispatching DOM events, changing
// focus, retrying a mutation or replacing its result assertions.
export async function recordGroupDrag(page, source, destination, receiptPath) {
  await page.evaluate(() => {
    const events = [], counts = {dragstart: 0, dragover: 0, drop: 0, dragend: 0}, terminal = {}, pointer = [];
    let pressedButton;
    const pointerListener = event => {
      if (event.type === "mousemove" && !event.buttons || pointer.length >= 12) return;
      const button = event.target.closest?.("button");
      if (event.type === "pointerdown") pressedButton = button;
      pointer.push({type: event.type, x: event.clientX, y: event.clientY, buttons: event.buttons,
        group: event.target.closest?.(".project-group")?.getAttribute("aria-label") ?? null,
        button: button ? {disabled: button.disabled, draggable: button.draggable} : null,
        source: pressedButton ? {connected: pressedButton.isConnected, disabled: pressedButton.disabled, draggable: pressedButton.draggable} : null});
    };
    const listener = event => {
      counts[event.type]++;
      if (events.length >= 32 && !["drop", "dragend"].includes(event.type)) return;
      const row = {type: event.type, group: event.target.closest?.(".project-group")?.getAttribute("aria-label") ?? null,
        x: event.clientX, y: event.clientY, types: [...(event.dataTransfer?.types ?? [])], event};
      if (events.length < 32) events.push(row);
      if (["drop", "dragend"].includes(event.type)) terminal[event.type] = row;
    };
    globalThis.runtimeGroupDragReceipt = {events, counts, terminal, listener, pointer, pointerListener};
    for (const type of ["dragstart", "dragover", "drop", "dragend"]) document.addEventListener(type, listener, true);
    for (const type of ["pointerdown", "mousedown", "mousemove", "mouseup"]) document.addEventListener(type, pointerListener, true);
  });
  let primary;
  try {await source.dragTo(destination);}
  catch (error) {primary = error;}
  try {
    const receipt = await page.evaluate(() => {
      const {events, counts, terminal, listener, pointer, pointerListener} = globalThis.runtimeGroupDragReceipt;
      for (const type of ["dragstart", "dragover", "drop", "dragend"]) document.removeEventListener(type, listener, true);
      for (const type of ["pointerdown", "mousedown", "mousemove", "mouseup"]) document.removeEventListener(type, pointerListener, true);
      delete globalThis.runtimeGroupDragReceipt;
      // Read final cancellation flags after dispatch, rather than guessing when
      // a capture-listener microtask runs relative to React's later handlers.
      const snapshot = ({event, ...row}) => ({...row, prevented: event.defaultPrevented});
      return {events: events.map(snapshot), counts, pointer, terminal: Object.fromEntries(Object.entries(terminal).map(([type,row]) => [type,snapshot(row)]))};
    });
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  } catch (error) {primary ??= error;}
  if (primary) throw primary;
}

async function exerciseMultiSelectAssignment({page,call,viewId,project,language,evidenceDirectory}) {
  const en=language==='en', {projectId}=project;
  const propertyId=(await call('createProperty',{name:'Multi drag',propertyType:'multi_select'})).propertyId;
  const options={};
  for(const name of ['A','B','C'])options[name]=(await call('createSelectOption',{propertyId,name,color:'green'})).snapshot.selectOptions.find(o=>o.propertyId===propertyId&&o.name===name).optionId;
  await call('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
  const changeLabel=`${en?'Change group':'Изменить группу'}: ${project.name}`;
  const dragLabel=`${en?'Drag to change group':'Перетащить для изменения группы'}: ${project.name}`;
  const empty=en?'No value':'Без значения';
  const region=name=>page.getByRole('region',{name,exact:true});
  const checks=[];
  for(const layout of ['table','board']) {
    await call('setMultiSelectValue',{projectId,propertyId,optionIds:[options.A,options.B]});
    await call('setViewLayout',{viewId,kind:layout});await page.reload();
    const handle=region('B').getByRole('button',{name:dragLabel,exact:true}).and(page.locator(':enabled'));
    await page.locator(layout==='board'?'.grouped-board':'.grouped-table').waitFor();
    await handle.waitFor();
    const destination=region('C').getByRole('heading');
    await destination.evaluate(el=>el.scrollIntoView({block:'start',inline:'nearest'}));
    await recordGroupDrag(page, handle, destination, join(evidenceDirectory, `${language}-${layout}-multi-membership-drag-receipt.json`));
    await region('C').getByLabel(changeLabel,{exact:true}).and(page.locator(':enabled')).waitFor();
    assert.equal(await page.getByLabel(changeLabel,{exact:true}).count(),2);
    const saved=(await call('listTextProperties')).multiSelectValues.filter(v=>v.projectId===projectId&&v.propertyId===propertyId).map(v=>v.optionId).sort();
    assert.deepEqual(saved,[options.A,options.C].sort());
    for(const width of [360,1440]) {
      await page.setViewportSize({width,height:width===1440?960:720});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await region('C').getByLabel(changeLabel,{exact:true}).and(page.locator(':enabled')).waitFor();
      await region('C').getByLabel(changeLabel,{exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({path:join(evidenceDirectory,`${language}-${layout}-${width}-multi-drag.png`)});
    }
    // A pointer drop into empty clears both visible memberships.
    const emptyHeading=region(empty).getByRole('heading');
    await emptyHeading.evaluate(el=>el.scrollIntoView({block:'start',inline:'nearest'}));
    // Use the adjacent C occurrence so both native drag endpoints fit the
    // viewport; scrolling between mouse-down and movement can cancel dragstart.
    await region('C').getByRole('button',{name:dragLabel,exact:true}).and(page.locator(':enabled')).dragTo(emptyHeading);
    await region(empty).getByLabel(changeLabel,{exact:true}).and(page.locator(':enabled')).waitFor();
    assert.equal(await page.getByLabel(changeLabel,{exact:true}).count(),1);
    assert.deepEqual((await call('listTextProperties')).multiSelectValues.filter(v=>v.projectId===projectId&&v.propertyId===propertyId),[]);
    await call('setMultiSelectValue',{projectId,propertyId,optionIds:[options.A,options.C]});
    await region('A').getByLabel(changeLabel,{exact:true}).and(page.locator(':enabled')).waitFor();
    // Merge into an existing membership using the accessible native selector.
    const selector=region('A').getByLabel(changeLabel,{exact:true}).and(page.locator(':enabled'));
    await selector.selectOption(JSON.stringify(options.C));
    await page.waitForFunction(label=>document.querySelectorAll(`select[aria-label="${label}"]`).length===1,changeLabel);
    assert.deepEqual((await call('listTextProperties')).multiSelectValues.filter(v=>v.projectId===projectId&&v.propertyId===propertyId).map(v=>v.optionId),[options.C]);
    const clear=region('C').getByRole('button',{name:`${en?'Clear grouping value':'Очистить значение группировки'}: ${project.name}`,exact:true}).and(page.locator(':enabled'));
    await clear.focus();await clear.press('Enter');
    await region(empty).getByLabel(changeLabel,{exact:true}).and(page.locator(':enabled')).waitFor();
    await region(empty).getByLabel(changeLabel,{exact:true}).selectOption(JSON.stringify(options.C));
    await region('C').getByLabel(changeLabel,{exact:true}).and(page.locator(':enabled')).waitFor();
    await page.reload();await region('C').getByLabel(changeLabel,{exact:true}).waitFor();
    assert.deepEqual((await call('listTextProperties')).multiSelectValues.filter(v=>v.projectId===projectId&&v.propertyId===propertyId).map(v=>v.optionId),[options.C]);
    checks.push({type:'multi_select',layout,pointerSource:'B',preservedOtherMembership:true,keyboardMerge:true,clearAll:true,emptyAssignment:true,reload:true,widths:[360,1440]});
  }
  return checks;
}
