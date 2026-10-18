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
const browser = new Window();
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { cleanup, render, screen, waitFor, fireEvent } = await import("@testing-library/react");
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
        assert.equal((screen.getByLabelText(`${changeLabel}: Alpha`) as HTMLSelectElement).disabled,true);
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
