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

for (const language of ['en','ru'] as const) for (const layout of ['table','board'] as const) {
  test(`${language} ${layout} edits from either MultiSelect occurrence update shared metadata`,async()=>{
    const directory=mkdtempSync(join(tmpdir(),'selection-groups-ui-')),root=join(directory,'root');mkdirSync(root);mkdirSync(join(root,'Project'));
    const service=openSettingsService(join(directory,'app.sqlite'));
    const workspace=service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
    const {workspaceId,sourceId,viewId}=workspace;
    const command=(type:string,fields:object={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
    const query=(type:string,fields:object={})=>service.handleQuery({type:`workspace.${type}`,workspaceId,...fields});
    command('applyDiscovery',{previewToken:query('previewDiscovery').value.previewToken});
    const projects=query('listProjects').value.projects,projectId=projects[0].projectId;
    const propertyId=command('createProperty',{name:'Tags',propertyType:'multi_select'}).value.propertyId;
    const textId=command('createProperty',{name:'Notes',propertyType:'text'}).value.propertyId;
    const option=(name:string)=>command('createSelectOption',{propertyId,name,color:'default'}).value.snapshot.selectOptions.find((o:{name:string})=>o.name===name).optionId;
    const a=option('A'),b=option('B');option('Unused');
    command('setMultiSelectValue',{propertyId,projectId,optionIds:[a,b]});
    const api={getBackendStatus:async()=>({state:"ready"}),onBackendStatus:()=>()=>{},workspace:async(input:{type:string})=>/workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input),onWorkspaceChange:service.workspaces.subscribe} as unknown as WorkspaceDesktopApi;
    const user=userEvent.setup({document}),t=(key:Parameters<typeof translate>[1])=>translate(language,key);
    const props={client:new WorkspaceServiceClient(api),workspaceId,sourceId,viewId,projects,language,disabled:false};
    try {
      const rendered=render(<TextPropertiesTable {...props} layout={layout}/>);
      const select=await screen.findByLabelText(t('groupProperty'));
      await waitFor(()=>assert.equal((select as HTMLSelectElement).disabled,false));
      await user.selectOptions(select,propertyId);
      await screen.findByRole('heading',{name:'A (1)'});await screen.findByRole('heading',{name:'B (1)'});
      await screen.findByRole('heading',{name:'Unused (0)'});await screen.findByRole('heading',{name:`${t('groupNoValue')} (0)`});
      const groupB=screen.getByRole('region',{name:'B'});
      const textButton=within(groupB).getByRole('button',{name:`${t('editTextValue')}: Project / Notes`});
      textButton.focus();await user.keyboard('{Enter}');
      await user.type(within(groupB).getByRole('textbox',{name:`${t('editTextValue')}: Project / Notes`}), 'Shared');
      await user.click(within(groupB).getByRole('button',{name:t('saveTextValue')}));
      await waitFor(()=>assert.equal(screen.getAllByRole('button',{name:`${t('editTextValue')}: Project / Notes`}).every(b=>b.textContent==='Shared'),true));
      await user.click(within(screen.getByRole('region',{name:'A'})).getByRole('button',{name:`${t('editMultiSelectValue')}: Project / Tags`}));
      const groupA=screen.getByRole('region',{name:'A'});
      await user.click(within(groupA).getByRole('checkbox',{name:'A'}));
      await user.click(within(groupA).getByRole('button',{name:t('saveTextValue')}));
      await screen.findByRole('heading',{name:'A (0)'});await screen.findByRole('heading',{name:'B (1)'});
      assert.deepEqual(query('listTextProperties').value.values,[{projectId,propertyId:textId,value:'Shared'}]);
      command('updateSelectOption',{propertyId,optionId:b,name:'Renamed',color:'blue'});
      await screen.findByRole('heading',{name:'Renamed (1)'});
      rendered.rerender(<TextPropertiesTable {...props} layout={layout==='table'?'board':'table'}/>);
      await screen.findByRole('heading',{name:'Renamed (1)'});
      assert.equal(screen.getAllByRole('button',{name:`${t('editTextValue')}: Project / Notes`})[0].textContent,'Shared');
    } finally {cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
  });
}

for(const language of ['en','ru'] as const) test(`${language} folder category grouping is selectable in Table and Board`,async()=>{
  const directory=mkdtempSync(join(tmpdir(),'category-groups-ui-')),root=join(directory,'root');mkdirSync(root);mkdirSync(join(root,'Category','Project'),{recursive:true});mkdirSync(join(root,'Empty'));
  const service=openSettingsService(join(directory,'app.sqlite'));
  const {workspaceId,sourceId,viewId}=service.handleCommand({type:'workspace.create',rootPath:root,name:'Grouped'}).value;
  const preview=service.handleQuery({type:'workspace.previewDiscovery',workspaceId,mode:'grouped'}).value;
  const list=service.handleCommand({type:'workspace.applyDiscovery',workspaceId,previewToken:preview.previewToken}).value;
  const api={getBackendStatus:async()=>({state:'ready'}),onBackendStatus:()=>()=>{},workspace:async(input:{type:string})=>/workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input),onWorkspaceChange:service.workspaces.subscribe} as unknown as WorkspaceDesktopApi;
  const props={client:new WorkspaceServiceClient(api),workspaceId,sourceId,viewId,projects:list.projects,categoryProperty:list.categoryProperty,categories:list.categories,language,disabled:false};
  const user=userEvent.setup({document}),t=(key:Parameters<typeof translate>[1])=>translate(language,key);
  try {
    const rendered=render(<TextPropertiesTable {...props} layout="table"/>);
    const select=await screen.findByLabelText(t('groupProperty'));
    await waitFor(()=>assert.equal((select as HTMLSelectElement).disabled,false));
    await user.selectOptions(select,list.categoryProperty.propertyId);
    await screen.findByRole('heading',{name:'Category (1)'});await screen.findByRole('heading',{name:'Empty (0)'});
    assert.equal(screen.queryByRole('heading',{name:`${t('groupNoValue')} (0)`}),null);
    rendered.rerender(<TextPropertiesTable {...props} layout="board"/>);
    await screen.findByRole('heading',{name:'Category (1)'});assert.equal(document.querySelectorAll('.project-card').length,1);
  }finally{cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
});

for(const language of ['en','ru'] as const) test(`${language} ordinary Single Select labels and empty grouping work across layouts`,async()=>{
  const directory=mkdtempSync(join(tmpdir(),'single-groups-ui-')),root=join(directory,'root');mkdirSync(root);mkdirSync(join(root,'Project'));
  const service=openSettingsService(join(directory,'app.sqlite'));
  const {workspaceId,sourceId,viewId}=service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
  const command=(type:string,fields:object={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
  const query=(type:string,fields:object={})=>service.handleQuery({type:`workspace.${type}`,workspaceId,...fields});
  const projects=command('applyDiscovery',{previewToken:query('previewDiscovery').value.previewToken}).value.projects;
  const propertyId=command('createProperty',{name:'Choice',propertyType:'single_select'}).value.propertyId;
  const optionId=command('createSelectOption',{propertyId,name:'Option',color:'default'}).value.snapshot.selectOptions[0].optionId;
  const api={getBackendStatus:async()=>({state:'ready'}),onBackendStatus:()=>()=>{},workspace:async(input:{type:string})=>/workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input),onWorkspaceChange:service.workspaces.subscribe} as unknown as WorkspaceDesktopApi;
  const props={client:new WorkspaceServiceClient(api),workspaceId,sourceId,viewId,projects,language,disabled:false};
  const user=userEvent.setup({document}),t=(key:Parameters<typeof translate>[1])=>translate(language,key);
  try{
    const rendered=render(<TextPropertiesTable {...props} layout="table"/>);
    const select=await screen.findByLabelText(t('groupProperty'));await waitFor(()=>assert.equal((select as HTMLSelectElement).disabled,false));
    await user.selectOptions(select,propertyId);
    await screen.findByRole('heading',{name:`${t('groupNoValue')} (1)`});await screen.findByRole('heading',{name:'Option (0)'});
    const empty=screen.getByRole('region',{name:t('groupNoValue')});
    await user.click(within(empty).getByRole('button',{name:`${t('editSelectValue')}: Project / Choice`}));
    await user.selectOptions(within(empty).getByRole('combobox',{name:`${t('editSelectValue')}: Project / Choice`}),optionId);
    await user.click(within(empty).getByRole('button',{name:t('saveTextValue')}));
    await screen.findByRole('heading',{name:'Option (1)'});await screen.findByRole('heading',{name:`${t('groupNoValue')} (0)`});
    rendered.rerender(<TextPropertiesTable {...props} layout="board"/>);
    await screen.findByRole('heading',{name:'Option (1)'});
    command('updateSelectOption',{propertyId,optionId,name:'Renamed',color:'green'});
    await screen.findByRole('heading',{name:'Renamed (1)'});
  }finally{cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
});

for(const language of ['en','ru'] as const) for(const layout of ['table','board'] as const) test(`${language} ${layout} category grouping retains uncategorized recovery and editable metadata`,async()=>{
  const directory=mkdtempSync(join(tmpdir(),'retained-groups-ui-')),root=join(directory,'root');mkdirSync(root);mkdirSync(join(root,'Project'));
  const service=openSettingsService(join(directory,'app.sqlite'));
  const {workspaceId,sourceId,viewId}=service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
  const command=(type:string,fields:object={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
  const query=(type:string,fields:object={})=>service.handleQuery({type:`workspace.${type}`,workspaceId,...fields});
  const original=command('applyDiscovery',{previewToken:query('previewDiscovery').value.previewToken}).value.projects[0];
  const propertyId=command('createProperty',{name:'Notes',propertyType:'text'}).value.propertyId;
  command('setTextValue',{projectId:original.projectId,propertyId,value:'Preserved'});
  command('applyDiscovery',{previewToken:query('previewDiscovery',{mode:'grouped'}).value.previewToken});
  const list=query('listProjects').value;
  const api={getBackendStatus:async()=>({state:'ready'}),onBackendStatus:()=>()=>{},workspace:async(input:{type:string})=>/workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input),onWorkspaceChange:service.workspaces.subscribe} as unknown as WorkspaceDesktopApi;
  const user=userEvent.setup({document}),t=(key:Parameters<typeof translate>[1])=>translate(language,key);
  let located:string|null=null;
  try{
    render(<TextPropertiesTable client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={sourceId} viewId={viewId} layout={layout}
      projects={list.projects} retainedProjects={list.retainedProjects} categoryProperty={list.categoryProperty} categories={list.categories} language={language} disabled={false} onLocate={project=>{located=project.projectId;}}/>);
    const select=await screen.findByLabelText(t('groupProperty'));await waitFor(()=>assert.equal((select as HTMLSelectElement).disabled,false));
    await user.selectOptions(select,list.categoryProperty.propertyId);
    await screen.findByRole('heading',{name:`${t('groupNoValue')} (1)`});
    const group=screen.getByRole('region',{name:t('groupNoValue')});
    await within(group).findByText(t('projectModeRetained'));
    const locate=within(group).getByRole('button',{name:`${t('recoveryLocate')}: Project`});locate.focus();await user.keyboard('{Enter}');
    assert.equal(located,original.projectId);
    await user.click(within(group).getByRole('button',{name:`${t('editTextValue')}: Project / Notes`}));
    const text=within(group).getByRole('textbox');await user.clear(text);await user.type(text,'Updated');
    await user.click(within(group).getByRole('button',{name:t('saveTextValue')}));
    await within(group).findByRole('button',{name:`${t('editTextValue')}: Project / Notes`});
    await waitFor(()=>assert.equal(query('listTextProperties').value.values[0].value,'Updated'));
  }finally{cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
});
