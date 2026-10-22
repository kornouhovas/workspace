import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { translate } from "../src/renderer/localization.js";
import { Window } from "happy-dom";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import type { WorkspaceDesktopApi } from "../src/contracts/desktop-api.js";
import { TextPropertiesTable } from "../src/renderer/components/TextPropertiesTable.js";
const browser = new Window();
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { cleanup, render, screen, waitFor, fireEvent, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");

for (const language of ["en", "ru"] as const) for (const layout of ["table", "board"] as const) for (const type of ["text", "number", "date", "single_select"] as const) {
  test(`${language} ${layout} ${type} pointer assignment and keyboard empty clearing persist`, async () => {
    const directory=mkdtempSync(join(tmpdir(),"assignment-ui-")),root=join(directory,"root");mkdirSync(root);
    for(const name of ["Alpha","Beta"])mkdirSync(join(root,name));
    const service=openSettingsService(join(directory,"app.sqlite"));
    const workspace=service.handleCommand({type:"workspace.create",rootPath:root,name:"One"}).value;
    const {workspaceId,viewId,sourceId}=workspace;
    const command=(type:string,fields={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
    const preview=service.handleQuery({type:"workspace.previewDiscovery",workspaceId}).value;
    const projects=command("applyDiscovery",{previewToken:preview.previewToken}).value.projects;
    const a=projects.find((p:{name:string})=>p.name==='Alpha');
    const b=projects.find((p:{name:string})=>p.name==='Beta');
    const propertyId=command('createProperty',{name:'Field',propertyType:type}).value.propertyId;
    let target:string|number=type==='text'?' Exact ':type==='number'?0:'2024-02-29';
    if(type==='single_select')target=command('createSelectOption',{propertyId,name:'Ready',color:'green'}).value.snapshot.selectOptions[0].optionId;
    command(type==='text'?'setTextValue':type==='number'?'setNumberValue':type==='date'?'setDateValue':'setSelectValue', {projectId:b.projectId,propertyId,[type==='number'?'expression':type==='single_select'?'optionId':'value']:String(target)});
    command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    let delayAfterAssignment = type === "text", holdProperties = false;
    const releaseProperties: (()=>void)[] = [];
    let outcome: "ok" | "reject" | "lost" = "ok", assignments = 0;
    const api={getBackendStatus:async()=>({state:"ready"}),onBackendStatus:()=>()=>{},workspace:async(input:{type:string})=>{
      if(input.type==='workspace.assignProjectGroup') {
        assignments++;
        holdProperties = delayAfterAssignment; delayAfterAssignment = false;
        if(outcome==='reject')return {ok:false,error:{code:'invalid_input',message:'stale'}};
        const result=service.handleCommand(input);
        if(outcome==='lost')throw new Error('lost reply');
        return result;
      }
      if(input.type==='workspace.listTextProperties' && holdProperties) await new Promise<void>(resolve=>releaseProperties.push(resolve));
      return /workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input);
    },onWorkspaceChange:service.workspaces.subscribe} as unknown as WorkspaceDesktopApi;
    const user=userEvent.setup({document});
    const changeLabel=language==='en'?'Change group':'Изменить группу';
    const dragLabel=language==='en'?'Drag to change group':'Перетащить для изменения группы';
    try {
      render(<TextPropertiesTable viewId={viewId} layout={layout} client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={language} disabled={false}/>);
      const handle=await screen.findByRole('button',{name:`${dragLabel}: Alpha`});
      await waitFor(()=>assert.equal((handle as HTMLButtonElement).disabled,false));
      const data=new Map<string,string>();const dataTransfer={types:['application/x-workspace-group-assignment'],setData:(type:string,value:string)=>data.set(type,value),getData:(type:string)=>data.get(type)??'',effectAllowed:'move'};
      fireEvent.dragStart(handle,{dataTransfer});
      const region=screen.getByRole('region',{name:type==='single_select'?'Ready':String(target).trim()});
      fireEvent.drop(region,{dataTransfer});
      const selected=JSON.stringify(target);
      await waitFor(()=>assert.equal((screen.getByLabelText(`${changeLabel}: Alpha`) as HTMLSelectElement).value,selected));
      if(type==='text') {
        await waitFor(()=>assert.equal((screen.getByLabelText(`${changeLabel}: Alpha`) as HTMLSelectElement).disabled,false,
          'A complete accepted mutation snapshot must not wait for a redundant property read'));
        await waitFor(()=>assert.equal(document.activeElement===screen.getByLabelText(`${changeLabel}: Alpha`),true));
        holdProperties=false;for(const release of releaseProperties.splice(0))release();
      }
      await waitFor(()=>assert.equal(document.activeElement===screen.getByLabelText(`${changeLabel}: Alpha`),true));
      const clear=screen.getByRole('button',{name:`${language==='en'?'Clear grouping value':'Очистить значение группировки'}: Alpha`});
      await waitFor(()=>assert.equal((clear as HTMLButtonElement).disabled,false));clear.focus();await user.keyboard('{Enter}');
      await waitFor(()=>assert.equal((screen.getByLabelText(`${changeLabel}: Alpha`) as HTMLSelectElement).value,'null'));
      await waitFor(()=>assert.equal(document.activeElement===screen.getByLabelText(`${changeLabel}: Alpha`),true));
      const snapshot=service.handleQuery({type:'workspace.listTextProperties',workspaceId}).value;
      assert.equal([...snapshot.values,...(snapshot.numberValues??[]),...(snapshot.dateValues??[]),...(snapshot.selectValues??[])].some(v=>v.projectId===a.projectId),false);
      assert.deepEqual(service.handleQuery({type:'workspace.listProjects',workspaceId}).value.projects,projects);
      if(type==='text') {
        await waitFor(()=>assert.equal((screen.getByLabelText(`${changeLabel}: Alpha`) as HTMLSelectElement).disabled,false));
        outcome='reject';
        await user.selectOptions(screen.getByLabelText(`${changeLabel}: Alpha`),selected);
        await screen.findByText(language==='en'?'The project, grouping or destination changed. Refresh and choose an available group.':'Проект, группировка или назначение изменились. Обновите данные и выберите доступную группу.');
        assert.equal((screen.getByLabelText(`${changeLabel}: Alpha`) as HTMLSelectElement).value,'null');
        await waitFor(()=>assert.equal((screen.getByLabelText(`${changeLabel}: Alpha`) as HTMLSelectElement).disabled,false));
        outcome='lost';
        await user.selectOptions(screen.getByLabelText(`${changeLabel}: Alpha`),selected);
        await screen.findByText(language==='en'?'Could not confirm the group change. Refresh actual values before retrying.':'Не удалось подтвердить смену группы. Обновите значения перед повторной попыткой.');
        await waitFor(()=>assert.equal((screen.getByLabelText(`${changeLabel}: Alpha`) as HTMLSelectElement).value,selected));
        assert.equal(assignments,4,'Each user action sends one command; lost replies are never replayed');
        outcome='ok';
        command('setViewFilter',{viewId,config:{search:'',rules:[{propertyId,operator:'equals',operand:target}]}});
        await waitFor(()=>assert.equal((screen.getByLabelText(`${changeLabel}: Alpha`) as HTMLSelectElement).disabled,false));
        screen.getByLabelText(`${changeLabel}: Alpha`).focus();
        await user.selectOptions(screen.getByLabelText(`${changeLabel}: Alpha`),'null');
        await waitFor(()=>assert.equal(screen.queryByLabelText(`${changeLabel}: Alpha`),null));
        await waitFor(()=>assert.equal(document.activeElement?.getAttribute('aria-label'),changeLabel));
      }
    } finally {cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
  });
}

for (const language of ["en", "ru"] as const) for (const layout of ["table", "board"] as const) {
  test(`${language} ${layout} MultiSelect uses each occurrence's source and refreshes duplicates`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "multi-drop-ui-")), root = join(directory, "root");
    mkdirSync(root); mkdirSync(join(root, "Alpha"));
    const service = openSettingsService(join(directory, "app.sqlite"));
    const {workspaceId, viewId, sourceId} = service.handleCommand({type:"workspace.create", rootPath:root, name:"Multi"}).value;
    const command = (type:string, fields={}) => service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
    const query = (type:string, fields={}) => service.handleQuery({type:`workspace.${type}`,workspaceId,...fields});
    const projects = command("applyDiscovery", {previewToken:query("previewDiscovery").value.previewToken}).value.projects;
    const projectId = projects[0].projectId;
    const propertyId = command("createProperty", {name:"Tags",propertyType:"multi_select"}).value.propertyId;
    const options: Record<string,string> = {};
    for (const name of ["A","B","C"]) options[name] = command("createSelectOption", {propertyId,name,color:"green"}).value.snapshot.selectOptions.find((o:{name:string}) => o.name===name).optionId;
    command("setMultiSelectValue", {projectId,propertyId,optionIds:[options.A,options.B]});
    command("setViewGrouping", {viewId,config:{propertyId,settings:[]}});
    let outcome: "ok" | "reject" | "lost" = "ok";
    const requests: {fromKey:string;toKey:string}[] = [];
    const api = {getBackendStatus:async()=>({state:"ready"}),onBackendStatus:()=>()=>{},onWorkspaceChange:service.workspaces.subscribe, workspace:async(input:{type:string;fromKey:string;toKey:string}) => {
      if (input.type==='workspace.assignProjectGroup') {
        requests.push(input);
        if (outcome==='reject') return {ok:false,error:{code:'invalid_input',message:'stale'}};
        const result=service.handleCommand(input);
        if (outcome==='lost') throw new Error('Lost reply');
        return result;
      }
      return /workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input);
    }} as unknown as WorkspaceDesktopApi;
    const user = userEvent.setup({document});
    const changeLabel = `${language==='en'?'Change group':'Изменить группу'}: Alpha`;
    const dragLabel = `${language==='en'?'Drag to change group':'Перетащить для изменения группы'}: Alpha`;
    const region = (name:string) => screen.getByRole('region',{name});
    const members = () => query('listTextProperties').value.multiSelectValues.map((v:{optionId:string})=>v.optionId).sort();
    const expectGroups = async(names:string[]) => {
      await waitFor(() => {
        assert.equal(screen.getAllByLabelText(changeLabel).length,names.length);
        for (const name of names) assert.equal((within(region(name)).getByLabelText(changeLabel) as HTMLSelectElement).value, name==='No value'||name==='Без значения'?'null':JSON.stringify(options[name]));
      });
      await waitFor(() => {for(const control of screen.getAllByLabelText(changeLabel)) assert.equal((control as HTMLSelectElement).disabled,false);});
    };
    const drag = (from:string,to:string) => {
      const data = new Map<string,string>();
      const dataTransfer = {types:['application/x-workspace-group-assignment'],setData:(type:string,value:string)=>data.set(type,value),getData:(type:string)=>data.get(type)??'',effectAllowed:'move'};
      fireEvent.dragStart(within(region(from)).getByRole('button',{name:dragLabel}),{dataTransfer});
      fireEvent.drop(region(to),{dataTransfer});
    };
    const empty=language==='en'?'No value':'Без значения';
    try {
      render(<TextPropertiesTable viewId={viewId} layout={layout} client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={language} disabled={false}/>);
      await expectGroups(['A','B']);
      drag('B','C'); await expectGroups(['A','C']);
      assert.equal(requests[0].fromKey,JSON.stringify(options.B));
      assert.deepEqual(members(),[options.A,options.C].sort());
      await waitFor(()=>assert.equal(document.activeElement===within(region('C')).getByLabelText(changeLabel),true));
      drag('A',empty); await expectGroups([empty]); assert.deepEqual(members(),[]);
      command('setMultiSelectValue',{projectId,propertyId,optionIds:[options.A,options.C]});
      await expectGroups(['A','C']);
      await user.selectOptions(within(region('A')).getByLabelText(changeLabel),JSON.stringify(options.C));
      await expectGroups(['C']); assert.deepEqual(members(),[options.C]);
      drag('C',empty); await expectGroups([empty]); assert.deepEqual(members(),[]);
      await user.selectOptions(within(region(empty)).getByLabelText(changeLabel),JSON.stringify(options.A));
      await expectGroups(['A']); assert.deepEqual(members(),[options.A]);
      outcome='reject'; drag('A','B');
      await screen.findByText(language==='en'?'The project, grouping or destination changed. Refresh and choose an available group.':'Проект, группировка или назначение изменились. Обновите данные и выберите доступную группу.');
      await expectGroups(['A']); assert.deepEqual(members(),[options.A]);
      outcome='lost'; drag('A','B');
      await screen.findByText(language==='en'?'Could not confirm the group change. Refresh actual values before retrying.':'Не удалось подтвердить смену группы. Обновите значения перед повторной попыткой.');
      await expectGroups(['B']); assert.deepEqual(members(),[options.B]); assert.equal(requests.length,7);
      outcome='ok';
      assert.equal(command('setViewFilter',{viewId,config:{search:'',rules:[{propertyId,operator:'any',operand:[options.B]}]}}).ok,true);
      await waitFor(()=>assert.equal((within(region('B')).getByLabelText(changeLabel) as HTMLSelectElement).disabled,false));
      drag('B','C');
      await waitFor(()=>assert.equal(screen.queryAllByLabelText(changeLabel).length,0));
      assert.deepEqual(members(),[options.C]);
    } finally {cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
  });
}

for (const language of ['en','ru'] as const) for (const layout of ['table','board'] as const) for(const grouping of ['name','category'] as const) for(const recoverable of [false,true]) {
  test(`${language} ${layout} ${grouping} ${recoverable?'interrupted':'normal'} folder drag, cancel, rejection, lost reply and keyboard reflect real state`,async()=>{
    const directory=mkdtempSync(join(tmpdir(),'folder-drag-ui-')),root=join(directory,'root');mkdirSync(root);
    for(const name of ['A','B','C']){mkdirSync(join(root,name));mkdirSync(join(root,name,grouping==='category'&&(!recoverable||name==='A')||name==='A'?'Alpha':'Target'));}
    const service=openSettingsService(join(directory,'app.sqlite'),undefined,undefined,undefined,undefined,recoverable?()=>{throw new Error('interrupted native reply');}:undefined);
    const {workspaceId,viewId,sourceId}=service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
    const command=(type:string,fields={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
    const query=(type:string,fields={})=>service.handleQuery({type:`workspace.${type}`,workspaceId,...fields});
    const preview=query('previewDiscovery',{mode:'grouped'}).value;command('applyDiscovery',{previewToken:preview.previewToken});
    const list=query('listProjects').value, project=list.projects.find((p:{name:string})=>p.name==='Alpha');
    const propertyId=grouping==='name'?'name':list.categoryProperty.propertyId;
    command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    if(grouping==='name'&&!recoverable) command('setViewFilter',{viewId,config:{search:'Alpha',rules:[]}});
    let count=0,observed=0,lost=false;
    let lastFilesystem: {operation: unknown} | undefined;
    let details: string | null = null;
    const api={getBackendStatus:async()=>({state:'ready'}),onBackendStatus:()=>()=>{},workspace:async(input:{type:string})=>{
      const result=/workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input);
      if(input.type==='workspace.assignProjectGroup'){lastFilesystem=result.value?.filesystem;count++;if(lost)throw new Error('lost reply');}
      return result;
    },onWorkspaceChange:service.workspaces.subscribe} as unknown as WorkspaceDesktopApi;
    const en=language==='en',changeLabel=`${en?'Change group':'Изменить группу'}: Alpha`;
    try {
      render(<TextPropertiesTable viewId={viewId} layout={layout} client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={sourceId}
        projects={list.projects} categoryProperty={list.categoryProperty} categories={list.categories} language={language} disabled={false} onFilesystemAssignmentObserved={()=>observed++} onFilesystemAssignmentDetails={kind=>{details=kind;}}/>);
      const origin=await screen.findByRole('region',{name:grouping==='name'?'Alpha':'A'});
      const handle=await within(origin).findByRole('button',{name:`${en?'Drag to change group':'Перетащить для изменения группы'}: Alpha`});
      await waitFor(()=>assert.equal((handle as HTMLButtonElement).disabled,false));
      const data=new Map<string,string>(),dataTransfer={types:['application/x-workspace-group-assignment'],setData:(t:string,v:string)=>data.set(t,v),getData:(t:string)=>data.get(t)??'',effectAllowed:'move'};
      fireEvent.dragStart(handle,{dataTransfer});fireEvent.dragEnd(handle,{dataTransfer});assert.equal(count,0,'Cancelling a gesture sends no filesystem command');
      assert.equal(screen.queryByRole('button',{name:`${en?'Clear grouping value':'Очистить значение группировки'}: Alpha`}),null);
      const destination=screen.getByRole('region',{name:grouping==='name'?'Target':'B'});
      fireEvent.dragStart(handle,{dataTransfer});fireEvent.drop(destination,{dataTransfer});
      if(recoverable) {
        await screen.findByText(translate(language,'groupAssignmentRecovery'));
        assert.equal(screen.queryByText(translate(language,'groupAssignmentSaved')),null);
        await waitFor(()=>assert.equal(observed,1));assert.equal(count,1);
        const operation=query(grouping==='name'?'listProjectRenames':'listProjectCategoryMoves').value.operations[0];
        assert.ok(operation);
        assert.ok(screen.getByText(operation.originalRelativePath));
        assert.ok(screen.getByText(operation.requestedRelativePath));
        await userEvent.setup({document}).click(screen.getByRole('button',{name:en?'Details / Recover':'Подробности / Восстановить'}));
        assert.equal(details,grouping);
        assert.equal(count,1,'Opening recovery never replays assignment');
        return;
      }
      if(grouping==='name') {
        await waitFor(()=>assert.equal(count,1));
        await screen.findByText(translate(language,"groupAssignmentSaved"));
        assert.equal(query('listProjects').value.projects.find((p:{projectId:string})=>p.projectId===project.projectId).relativePath,'A/Target');
        await waitFor(()=>assert.equal(screen.queryByLabelText(changeLabel)===null,true));
        await waitFor(()=>assert.equal(document.activeElement?.getAttribute('aria-label'),en?'Change group':translate(language,'groupAssignmentChoose')));
      } else {
        await screen.findByText(translate(language,"renameCollision"));
        assert.equal(lastFilesystem?.operation,null,"A preflight collision has no journal operation or receipt paths");
      }
      await waitFor(()=>assert.ok(observed>=1));
      if(grouping==='category') {
        lost=true;
        const select=within(origin).getByLabelText(changeLabel);
        await waitFor(()=>assert.equal((select as HTMLSelectElement).disabled,false));
        // C is occupied too, so free a same-source destination with a safe rename.
        const c=query('listProjects').value.projects.find((p:{relativePath:string})=>p.relativePath==='C/Alpha');
        command('renameProject',{projectId:c.projectId,operationId:crypto.randomUUID(),name:'Other',expectedRevision:query('listProjects').value.revision});
        const user=userEvent.setup({document});
        await user.selectOptions(select,JSON.stringify(list.categories.find((c:{name:string})=>c.name==='C').categoryId));
        await screen.findByText(en?'Could not confirm the group change. Refresh actual values before retrying.':'Не удалось подтвердить смену группы. Обновите значения перед повторной попыткой.');
        await waitFor(()=>assert.equal(query('listProjects').value.projects.find((p:{projectId:string})=>p.projectId===project.projectId).relativePath,'C/Alpha'));
        assert.equal(count,2);
      }
    } finally {cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
  });
}

test('a newer property change during assignment supersedes its older reply without replay', async () => {
  const directory=mkdtempSync(join(tmpdir(),'assignment-revision-ui-')),root=join(directory,'root');mkdirSync(root);
  for(const name of ['Alpha','Beta'])mkdirSync(join(root,name));
  const service=openSettingsService(join(directory,'app.sqlite'));
  const {workspaceId,viewId,sourceId}=service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
  const command=(type:string,fields={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
  const projects=command('applyDiscovery',{previewToken:service.handleQuery({type:'workspace.previewDiscovery',workspaceId}).value.previewToken}).value.projects;
  const alpha=projects.find((p:{name:string})=>p.name==='Alpha'),beta=projects.find((p:{name:string})=>p.name==='Beta');
  const propertyId=command('createProperty',{name:'Field',propertyType:'text'}).value.propertyId;
  command('setTextValue',{projectId:beta.projectId,propertyId,value:'Ready'});
  command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
  let assignments=0;
  const api={getBackendStatus:async()=>({state:'ready'}),onBackendStatus:()=>()=>{},onWorkspaceChange:service.workspaces.subscribe,workspace:async(input:{type:string})=>{
    if(input.type==='workspace.assignProjectGroup'){
      assignments++;
      const reply=service.handleCommand(input);
      command('setTextValue',{projectId:alpha.projectId,propertyId,value:'Newer'});
      return reply;
    }
    return /workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input);
  }} as unknown as WorkspaceDesktopApi;
  try {
    render(<TextPropertiesTable viewId={viewId} client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language="en" disabled={false}/>);
    const control=await screen.findByLabelText('Change group: Alpha');
    await waitFor(()=>assert.equal((control as HTMLSelectElement).disabled,false));
    await userEvent.setup({document}).selectOptions(control,JSON.stringify('Ready'));
    await waitFor(()=>{
      const current=screen.getByLabelText('Change group: Alpha') as HTMLSelectElement;
      assert.equal(current.value,JSON.stringify('Newer'));assert.equal(current.disabled,false);
    });
    assert.equal(assignments,1);
    assert.equal(service.handleQuery({type:'workspace.listTextProperties',workspaceId}).value.values.find((v:{projectId:string})=>v.projectId===alpha.projectId).value,'Newer');
  } finally {cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
});
