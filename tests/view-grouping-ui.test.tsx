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
const { cleanup, render, screen, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");
for (const language of ["en", "ru"] as const) for (const layout of ["table", "board"] as const) {
  test(`${language} ${layout} scalar grouping, visibility and keyboard control`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "grouping-ui-")), root = join(directory, "root"); mkdirSync(root);
    for (const name of ["Alpha", "Beta"]) mkdirSync(join(root,name));
    const service = openSettingsService(join(directory,"app.sqlite"));
    const workspace = service.handleCommand({type:"workspace.create",rootPath:root,name:"One"}).value;
    const {workspaceId,viewId,sourceId}=workspace;
    const preview=service.handleQuery({type:"workspace.previewDiscovery",workspaceId}).value;
    const projects=service.handleCommand({type:"workspace.applyDiscovery",workspaceId,previewToken:preview.previewToken}).value.projects;
    const api={getBackendStatus:async()=>({state:"ready"}),onBackendStatus:()=>()=>{},workspace:async(input:{type:string})=>/workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input),onWorkspaceChange:service.workspaces.subscribe} as unknown as WorkspaceDesktopApi;
    const user=userEvent.setup({document}),t=(key:Parameters<typeof translate>[1])=>translate(language,key);
    try {
      render(<TextPropertiesTable viewId={viewId} layout={layout} client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={language} disabled={false}/>);
      const select=await screen.findByLabelText(t("groupProperty"));
      await waitFor(()=>assert.equal((select as HTMLSelectElement).disabled,false));
      select.focus();await user.selectOptions(select,"name");
      await screen.findByRole("heading",{name:"Alpha (1)"});
      const panel=screen.getByRole("region",{name:t("groupTitle")});
      const hide=within(panel).getByRole("button",{name:`${t("groupHide")}: Alpha`});hide.focus();await user.keyboard("{Enter}");
      await waitFor(()=>assert.equal(screen.queryByRole("heading",{name:"Alpha (1)"}),null));
      await user.click(within(panel).getByRole("button",{name:`${t("groupShow")}: Alpha`}));
      await screen.findByRole("heading",{name:"Alpha (1)"});
      await user.click(within(panel).getByRole("button",{name:`${t("groupCollapse")}: Alpha`}));
      await waitFor(()=>assert.equal(document.querySelectorAll(layout==="table"?"tbody tr":".project-card").length,1));
      await user.selectOptions(select,"");
      await waitFor(()=>assert.equal(document.querySelectorAll(layout==="table"?"tbody tr":".project-card").length,2));
    } finally {cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
  });
}

test('grouping read/save failures retain an explicit retry and do not claim a failed change',async()=>{
  const {ViewGrouping}=await import('../src/renderer/components/ViewGrouping.js');
  const workspaceId='00000000-0000-4000-8000-000000000001',viewId='00000000-0000-4000-8000-000000000002';
  let failRead=true,failSave=false;let config={propertyId:null as string|null,settings:[]};
  const api={workspace:async(input:{type:string;config:typeof config})=>{
    if(input.type==='workspace.getViewGrouping')return failRead?{ok:false,error:{code:'storage',message:'failed'}}:{ok:true,value:{workspaceId,viewId,config}};
    if(failSave)return {ok:false,error:{code:'storage',message:'failed'}};
    config=input.config;return {ok:true,value:{workspaceId,viewId,config}};
  },onWorkspaceChange:()=>()=>{}} as unknown as WorkspaceDesktopApi;
  const user=userEvent.setup({document});
  try{
    render(<ViewGrouping client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} viewId={viewId} language="en" snapshot={null} groups={null} disabled={false}/>);
    await screen.findByText(translate('en','groupError'));
    failRead=false;await user.click(screen.getByRole('button',{name:translate('en','viewsRetry')}));
    const select=screen.getByLabelText(translate('en','groupProperty')) as HTMLSelectElement;
    await waitFor(()=>assert.equal(select.disabled,false));
    failSave=true;await user.selectOptions(select,'name');
    await screen.findByText(translate('en','groupError'));assert.equal(select.value,'');
    failSave=false;await user.click(screen.getByRole('button',{name:translate('en','viewsRetry')}));
    await waitFor(()=>assert.equal(select.disabled,false));await user.selectOptions(select,'name');
    await waitFor(()=>assert.equal(select.value,'name'));assert.equal(config.propertyId,'name');
  }finally{cleanup();}
});

test('a delayed projection cannot apply old-property group keys to a new grouping property',async()=>{
  const {ViewGrouping}=await import('../src/renderer/components/ViewGrouping.js');
  const workspaceId='00000000-0000-4000-8000-000000000001',viewId='00000000-0000-4000-8000-000000000002',propertyId='00000000-0000-4000-8000-000000000003';
  let config={propertyId:'name',settings:[]};
  const api={workspace:async(input:{type:string;config:typeof config})=>{if(input.type==='workspace.setViewGrouping')config=input.config;return {ok:true,value:{workspaceId,viewId,config}};},onWorkspaceChange:()=>()=>{}} as unknown as WorkspaceDesktopApi;
  const props={client:new WorkspaceServiceClient(api),workspaceId,viewId,language:'en' as const,disabled:false,groupPropertyId:'name',snapshot:{workspaceId,sourceId:workspaceId,revision:0,definitions:[{propertyId,sourceId:workspaceId,name:'Text',propertyType:'text' as const,position:0}],values:[]},groups:[{key:'"Alpha"',value:'Alpha',projectIds:['one'],hidden:false,collapsed:false,empty:false}]};
  const user=userEvent.setup({document});
  try{
    render(<ViewGrouping {...props}/>);
    await screen.findByRole('button',{name:'Hide group: Alpha'});
    await user.selectOptions(screen.getByLabelText('Group by'),propertyId);
    await waitFor(()=>assert.equal((screen.getByLabelText('Group by') as HTMLSelectElement).value,propertyId));
    assert.equal(screen.queryByRole('button',{name:'Hide group: Alpha'})===null,true);
  }finally{cleanup();}
});
