import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import type { WorkspaceDesktopApi } from "../src/contracts/desktop-api.js";

import { translate } from "../src/renderer/localization.js";
const browser = new Window();
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Element: browser.Element, CustomEvent: browser.CustomEvent, getComputedStyle: browser.getComputedStyle.bind(browser), NodeFilter: browser.NodeFilter, HTMLInputElement: browser.HTMLInputElement, ResizeObserver: browser.ResizeObserver, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { TextPropertiesTable } = await import("../src/renderer/components/TextPropertiesTable.js");
const { cleanup, render, screen, waitFor, within, fireEvent } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");
for (const language of ["en", "ru"] as const) {
  test(`${language} Board keyboard controls persist widths, field visibility and wrapping`, async () => {
    const directory=mkdtempSync(join(tmpdir(),"board-ui-")),root=join(directory,"root");mkdirSync(root);
    for(const name of ["Alpha","Beta"])mkdirSync(join(root,name));
    const service=openSettingsService(join(directory,"app.sqlite"));
    const {workspaceId,viewId,sourceId}=service.handleCommand({type:"workspace.create",rootPath:root,name:"One"}).value;
    const command=(type:string,fields={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
    const query=(type:string,fields={})=>service.handleQuery({type:`workspace.${type}`,workspaceId,...fields});
    const projects=command("applyDiscovery",{previewToken:query("previewDiscovery").value.previewToken}).value.projects;
    command("setViewLayout",{viewId,kind:"board"});
    command("setViewGrouping",{viewId,config:{propertyId:"name",settings:[]}});
    const propertyId=command("createProperty",{name:"Notes",propertyType:"text"}).value.propertyId;
    command("setTextValue",{propertyId,projectId:projects[0].projectId,value:"Exact\ntext"});
    const before=query("listTextProperties");
    const api={getBackendStatus:async()=>({state:"ready"}),onBackendStatus:()=>()=>{},workspace:async(input:{type:string})=>/workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input),onWorkspaceChange:service.workspaces.subscribe} as unknown as WorkspaceDesktopApi;
    const client=new WorkspaceServiceClient(api),user=userEvent.setup({document}),t=(key:Parameters<typeof translate>[1])=>translate(language,key);
    const content=<TextPropertiesTable layout="board" viewId={viewId} client={client} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={language} disabled={false}/>;
    try {
      render(content);
      const layoutButton=await screen.findByRole("button",{name:t("boardLayoutTitle")});
      layoutButton.focus(); await user.keyboard("{Enter}");
      const controls=await screen.findByRole("dialog",{name:t("boardLayoutTitle")});
      const width=await within(controls).findByLabelText(`${t("boardColumnWidth")}: Alpha`) as HTMLInputElement;
      await waitFor(()=>assert.equal((width.closest('fieldset') as HTMLFieldSetElement).disabled,false));
      width.focus();fireEvent.change(width,{target:{value:"300"}});fireEvent.keyUp(width,{key:"ArrowLeft"});
      await waitFor(()=>assert.equal(document.querySelector('.project-group')?.getAttribute('style')?.includes('300px'),true));
      await waitFor(()=>assert.equal(document.activeElement,width));
      await user.click(within(controls).getByLabelText(`${t("boardPropertyVisible")}: Notes`));
      await waitFor(()=>assert.equal(document.querySelector(`.project-card [data-column-id="${propertyId}"]`),null));
      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('button',{name:t('propertyTools')}));
      const propertyPanel=screen.getByRole('dialog',{name:t('propertyTools')});
      const rename=within(propertyPanel).getByRole('button',{name:`${t('renameProperty')}: Notes`});
      await user.click(rename);
      const name=await screen.findByRole('textbox',{name:t('propertyName')});
      await user.clear(name);await user.type(name,'Uncommitted name');await user.keyboard('{Escape}');
      await waitFor(()=>assert.ok(document.activeElement===rename));
      assert.equal(query('listTextProperties').value.definitions.find((p:{propertyId:string})=>p.propertyId===propertyId).name,'Notes');
      await user.keyboard('{Escape}');
      await user.click(layoutButton);
      const reopened=screen.getByRole('dialog',{name:t('boardLayoutTitle')});
      await user.click(within(reopened).getByLabelText(t("boardWrap")));
      await waitFor(()=>assert.equal(query("getBoardLayout",{viewId}).value.config.wrap,false));
      await user.keyboard("{Escape}");
      await waitFor(()=>assert.equal(document.activeElement,layoutButton));
      await user.click(screen.getByRole("button",{name:t("groupTitle")}));
      const move=screen.getByRole("button",{name:`${t("groupLater")}: Alpha`});move.focus();await user.keyboard("{Enter}");
      await waitFor(()=>assert.equal(document.querySelector('.project-group')?.getAttribute('aria-label'),'Beta'));
      assert.deepEqual(query("listTextProperties"),before);
      cleanup();render(content);
      await waitFor(()=>assert.equal(document.querySelector('.project-group[aria-label="Alpha"]')?.getAttribute('style')?.includes('300px'),true));
      assert.equal(document.querySelector(`.project-card [data-column-id="${propertyId}"]`),null);
      const columnButton=screen.getByRole("button",{name:`${t("boardColumnWidth")}: Alpha`});
      await user.click(columnButton);
      const columnPanel=await screen.findByRole("dialog",{name:`${t("boardColumnWidth")}: Alpha`});
      const columnWidth=within(columnPanel).getByRole("slider");
      fireEvent.change(columnWidth,{target:{value:"420"}}); fireEvent.keyUp(columnWidth,{key:"ArrowRight"});
      await waitFor(()=>assert.equal(query("getBoardLayout",{viewId}).value.config.widths.find((c:{key:string})=>c.key.includes("Alpha")).width,420));
      await user.keyboard("{Escape}");
      await waitFor(()=>assert.equal(document.activeElement,columnButton));
      assert.deepEqual(query("listTextProperties"),before);
    }finally{cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
  });
}

test('Board retries reads, retains committed presentation on save failure and explicitly resets',async()=>{
  const {BoardLayoutControls,useBoardLayout}=await import('../src/renderer/components/BoardLayout.js');
  const workspaceId='11111111-1111-1111-1111-111111111111',viewId='22222222-2222-2222-2222-222222222222';
  const committed={widths:[],properties:[],wrap:true};
  let failRead=true,finish:((value:unknown)=>void)|undefined;
  const api={onWorkspaceChange:()=>()=>{},workspace:async(input:{type:string})=> {
    if(input.type==='workspace.getBoardLayout') return failRead?{ok:false,error:{code:'storage',message:'Unavailable'}}:{ok:true,value:{workspaceId,viewId,config:committed}};
    return new Promise(resolve=>{finish=resolve;});
  }} as unknown as WorkspaceDesktopApi;
  const client=new WorkspaceServiceClient(api),user=userEvent.setup({document});
  function Harness(){const state=useBoardLayout(client,workspaceId,viewId);return <BoardLayoutControls state={state} fields={[{propertyId:'name',name:'Name'}]} groups={[]} groupPropertyId={null} language="en" disabled={false}/>;}
  try{
    render(<Harness/>);await screen.findByRole('alert');failRead=false;
    await user.click(screen.getByRole('button',{name:translate('en','viewsRetry')}));
    await waitFor(()=>assert.equal(screen.queryByRole('alert'),null));await user.click(screen.getByRole('button',{name:'Board layout'}));
    const wrap=screen.getByLabelText('Wrap card content') as HTMLInputElement;
    await user.click(wrap);await screen.findByText('Saving Board layout...');
    assert.equal((wrap.closest('fieldset') as HTMLFieldSetElement).disabled,true);
    finish!({ok:false,error:{code:'storage',message:'Rejected'}});await screen.findByRole('alert');assert.equal(wrap.checked,true);
    await user.click(screen.getByRole('button',{name:'Reset Board layout'}));
    finish!({ok:true,value:{workspaceId,viewId,config:committed}});
    await waitFor(()=>assert.equal(screen.queryByRole('alert'),null));
  }finally{cleanup();}
});

test('a late Board save cannot replace the newly selected view presentation',async()=>{
  const {BoardLayoutControls,useBoardLayout}=await import('../src/renderer/components/BoardLayout.js');
  const workspaceId='11111111-1111-1111-1111-111111111111',first='22222222-2222-2222-2222-222222222222',second='33333333-3333-3333-3333-333333333333';
  let finish:((value:unknown)=>void)|undefined;
  const api={onWorkspaceChange:()=>()=>{},workspace:async(input:{type:string;viewId:string})=> input.type==='workspace.getBoardLayout'?{ok:true,value:{workspaceId,viewId:input.viewId,config:{widths:[],properties:[],wrap:input.viewId===first}}}:new Promise(resolve=>{finish=resolve;})} as unknown as WorkspaceDesktopApi;
  const client=new WorkspaceServiceClient(api),user=userEvent.setup({document});
  function Harness({viewId}:{viewId:string}){const state=useBoardLayout(client,workspaceId,viewId);return <BoardLayoutControls state={state} fields={[]} groups={null} groupPropertyId={null} language="en" disabled={false}/>;}
  try{
    const mounted=render(<Harness viewId={first}/>);await user.click(screen.getByRole('button',{name:'Board layout'}));
    const wrap=screen.getByLabelText('Wrap card content') as HTMLInputElement;
    await waitFor(()=>assert.equal((wrap.closest('fieldset') as HTMLFieldSetElement).disabled,false));
    await user.click(wrap);await screen.findByText('Saving Board layout...');
    mounted.rerender(<Harness viewId={second}/>);
    await waitFor(()=>assert.equal(wrap.checked,false));
    finish!({ok:true,value:{workspaceId,viewId:first,config:{widths:[],properties:[],wrap:true}}});
    await waitFor(()=>assert.equal((wrap.closest('fieldset') as HTMLFieldSetElement).disabled,false));assert.equal(wrap.checked,false);
  }finally{cleanup();}
});

test('closing Board definition tools preserves a pending category rename and its failure draft',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'board-category-pending-')),root=join(directory,'root');
  mkdirSync(join(root,'Category','Alpha'),{recursive:true});
  const service=openSettingsService(join(directory,'app.sqlite'));
  const {workspaceId,viewId,sourceId}=service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
  const preview=service.handleQuery({type:'workspace.previewDiscovery',workspaceId,mode:'grouped'}).value;
  service.handleCommand({type:'workspace.applyDiscovery',workspaceId,previewToken:preview.previewToken});
  service.handleCommand({type:'workspace.setViewLayout',workspaceId,viewId,kind:'board'});
  const list=service.handleQuery({type:'workspace.listProjects',workspaceId}).value;
  let finish:((value:unknown)=>void)|undefined,submissions=0;
  const api={getBackendStatus:async()=>({state:"ready"}),onBackendStatus:()=>()=>{},onWorkspaceChange:service.workspaces.subscribe,workspace:async(input:{type:string})=>{
    if(input.type==='workspace.renameCategoryProperty'){submissions++;return new Promise(resolve=>{finish=resolve;});}
    return /workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input);
  }} as unknown as WorkspaceDesktopApi;
  const user=userEvent.setup({document});
  try {
    render(<TextPropertiesTable layout="board" viewId={viewId} client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={sourceId}
      projects={list.projects} categoryProperty={list.categoryProperty} categories={list.categories}
      categoryPropertyRevision={list.categoryPropertyRevision} minimumCategoryPropertyRevision={{current:list.categoryPropertyRevision}}
      onCategoryPropertyCommitted={()=>assert.fail('Rejected rename must not commit')} language="en" disabled={false}/>);
    const tools=screen.getByRole('button',{name:translate('en','propertyTools')});await user.click(tools);
    const panel=screen.getByRole('dialog',{name:translate('en','propertyTools')});
    const label=list.categoryProperty.name??translate('en','discoveryCategory');
    await user.click(await within(panel).findByRole('button',{name:`${translate('en','renameCategoryProperty')}: ${label}`}));
    const input=within(panel).getByRole('textbox',{name:translate('en','categoryPropertyName')}) as HTMLInputElement;
    await user.clear(input);await user.type(input,'Clients');
    await user.click(within(panel).getByRole('button',{name:translate('en','saveCategoryPropertyName')}));
    await waitFor(()=>assert.equal(input.disabled,true));assert.equal(submissions,1);
    await user.click(tools);await user.click(tools);
    assert.equal((within(panel).getByRole('textbox',{name:translate('en','categoryPropertyName')}) as HTMLInputElement).disabled,true);
    await user.click(tools);
    finish!({ok:false,error:{code:'storage',message:'Rejected'}});
    await user.click(tools);
    await within(panel).findByRole('alert');
    await waitFor(()=>assert.equal(input.disabled,false));assert.equal(input.value,'Clients');assert.equal(submissions,1);
    await user.click(within(panel).getByRole('button',{name:translate('en','cancelRenameWorkspace')}));
    assert.equal(within(panel).queryByRole('textbox'),null);
  } finally {cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
});
