import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import type { WorkspaceDesktopApi } from "../src/contracts/desktop-api.js";
import { TextPropertiesTable } from "../src/renderer/components/TextPropertiesTable.js";
import { translate } from "../src/renderer/localization.js";
const browser = new Window();
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { cleanup, render, screen, waitFor, within, fireEvent } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");
for (const language of ["en", "ru"] as const) {
  test(`${language} Table controls persist column changes and keyboard row order`, async () => {
    const directory=mkdtempSync(join(tmpdir(),"table-ui-")),root=join(directory,"root");mkdirSync(root);
    for(const name of ["Alpha","Beta"])mkdirSync(join(root,name));
    const service=openSettingsService(join(directory,"app.sqlite"));
    const {workspaceId,viewId,sourceId}=service.handleCommand({type:"workspace.create",rootPath:root,name:"One"}).value;
    const command=(type:string,fields={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
    const query=(type:string,fields={})=>service.handleQuery({type:`workspace.${type}`,workspaceId,...fields});
    const projects=command("applyDiscovery",{previewToken:query("previewDiscovery").value.previewToken}).value.projects;
    const propertyId=command("createProperty",{name:"Notes",propertyType:"text"}).value.propertyId;
    const api={getBackendStatus:async()=>({state:"ready"}),onBackendStatus:()=>()=>{},workspace:async(input:{type:string})=>/workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input),onWorkspaceChange:service.workspaces.subscribe} as unknown as WorkspaceDesktopApi;
    const user=userEvent.setup({document}),t=(key:Parameters<typeof translate>[1])=>translate(language,key);
    try {
      render(<TextPropertiesTable viewId={viewId} client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={language} disabled={false}/>);
      const controls=await screen.findByRole("region",{name:language==="en"?"Table layout":"Настройки таблицы"});
      await user.click(within(controls).getByText(t("tableTitle")));
      const hide=await within(controls).findByLabelText(`${t("tableVisible")}: Notes`);
      await waitFor(()=>assert.equal((hide as HTMLInputElement).disabled,false));
      hide.focus();await user.keyboard(" ");
      await waitFor(()=>assert.equal(screen.queryByRole("columnheader",{name:/Notes/}),null));
      await user.click(hide);
      const width=within(controls).getByLabelText(`${t("tableWidth")}: Notes`) as HTMLInputElement;
      for(const next of [320,321]) {
        width.focus(); fireEvent.change(width,{target:{value:String(next)}});fireEvent.keyUp(width,{key:"ArrowRight"});
        await waitFor(()=>assert.equal(query("getTableLayout",{viewId}).value.config.columns.find((c:{propertyId:string})=>c.propertyId===propertyId).width,next));
        await waitFor(()=>assert.equal(document.activeElement === within(controls).getByLabelText(`${t("tableWidth")}: Notes`),true));
        assert.equal(width.isConnected,true);
      }
      const earlier=within(controls).getByRole("button",{name:`${t("tableColumnEarlier")}: Notes`});
      earlier.focus();await user.keyboard("{Enter}");
      await waitFor(()=>assert.ok(screen.getAllByRole("columnheader")[0].textContent?.includes("Notes")));
      await user.click(within(controls).getByLabelText(`${t("tableWrap")}: Notes`));
      await waitFor(()=>assert.equal(query("getTableLayout",{viewId}).value.config.columns.find((c:{propertyId:string})=>c.propertyId===propertyId).wrap,true));
      const later=screen.getByRole("button",{name:`${t("tableRowLater")}: Alpha`});
      later.focus();await user.keyboard("{Enter}");
      await waitFor(()=>assert.deepEqual(screen.getAllByRole("row").slice(1).map(r=>r.textContent?.includes("Alpha")?"Alpha":"Beta"),["Beta","Alpha"]));
      const before=query("listTextProperties").value;
      assert.equal(before.definitions.length,1);
      assert.deepEqual(query("queryView",{viewId,archived:false}).value.projectIds,projects.map((p:{projectId:string})=>p.projectId).reverse());
    } finally {cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
  });
}

test('Table settings expose load retry and save failure without replacing committed settings',async()=>{
  const {TableLayoutControls,useTableLayout}=await import('../src/renderer/components/TableLayout.js');
  const workspaceId='11111111-1111-1111-1111-111111111111',viewId='22222222-2222-2222-2222-222222222222';
  const committed={columns:[{propertyId:'name',hidden:false,width:224,wrap:false}],rowOrder:[]};
  let failRead=true,finish:((value:unknown)=>void)|undefined;
  const api={onWorkspaceChange:()=>()=>{},workspace:async(input:{type:string})=> {
    if(input.type==='workspace.getTableLayout') return failRead?{ok:false,error:{code:'storage',message:'Unavailable'}}:{ok:true,value:{workspaceId,viewId,config:committed}};
    return new Promise(resolve=>{finish=resolve;});
  }} as unknown as WorkspaceDesktopApi;
  const client=new WorkspaceServiceClient(api),user=userEvent.setup({document});
  function Harness(){const state=useTableLayout(client,workspaceId,viewId);return <TableLayoutControls state={state} fields={[{propertyId:'name',name:'Name',text:false}]} language="en" disabled={false}/>;}
  try {
    render(<Harness/>);
    await screen.findByRole('alert');
    failRead=false;await user.click(screen.getByRole('button',{name:translate('en','viewsRetry')}));
    await waitFor(()=>assert.equal(screen.queryByRole('alert'),null));
    await user.click(screen.getByText('Table layout'));
    const width=screen.getByRole('slider') as HTMLInputElement;
    fireEvent.change(width,{target:{value:'350'}});fireEvent.keyUp(width,{key:'ArrowRight'});
    await screen.findByText('Saving Table layout...');
    assert.equal((width.closest('fieldset') as HTMLFieldSetElement).disabled,true);
    finish!({ok:false,error:{code:'storage',message:'Rejected'}});
    await screen.findByRole('alert');
    await waitFor(()=>assert.equal(width.value,'224'));
    await user.click(screen.getByRole('button',{name:'Reset Table layout'}));
    finish!({ok:true,value:{workspaceId,viewId,config:{columns:[],rowOrder:[]}}});
    await waitFor(()=>assert.equal(screen.queryByRole('alert'),null));
  }finally{cleanup();}
});
