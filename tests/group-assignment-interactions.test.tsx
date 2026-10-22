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
import { ScalarDrafts, useDraftGuard } from "../src/renderer/components/ScalarDrafts.js";
const browser = new Window();
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { cleanup, render, screen, waitFor, fireEvent } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");
function GuardedNavigation({onNavigate}:{onNavigate():void}) {
 const guard=useDraftGuard();
 return <button onClick={()=>guard?.run(onNavigate)}>Leave view</button>;
}
function fixture(layout: "table" | "board", delay?: Promise<void>) {
 const directory=mkdtempSync(join(tmpdir(),"assignment-interaction-")),root=join(directory,"root");mkdirSync(root);
 for(const name of ["Alpha","Beta"])mkdirSync(join(root,name));
 const service=openSettingsService(join(directory,"app.sqlite"));
 const {workspaceId,viewId,sourceId}=service.handleCommand({type:"workspace.create",rootPath:root,name:"One"}).value;
 const command=(type:string,fields={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
 const projects=command("applyDiscovery",{previewToken:service.handleQuery({type:"workspace.previewDiscovery",workspaceId}).value.previewToken}).value.projects;
 const propertyId=command("createProperty",{name:"Budget",propertyType:"number"}).value.propertyId;
 command("setNumberValue",{projectId:projects.find((p:{name:string})=>p.name==="Beta").projectId,propertyId,expression:"42"});
 command("setViewGrouping",{viewId,config:{propertyId,settings:[]}});
 let assignments=0,navigations=0;
 const api={getBackendStatus:async()=>({state:"ready"}),onBackendStatus:()=>()=>{},onWorkspaceChange:service.workspaces.subscribe,workspace:async(input:{type:string})=>{
  if(input.type==="workspace.assignProjectGroup")assignments++;
  const result=/workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input);
  if(input.type==="workspace.assignProjectGroup" && delay) await delay;
  return result;
 }} as unknown as WorkspaceDesktopApi;
 render(<ScalarDrafts><TextPropertiesTable viewId={viewId} layout={layout} client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language="en" disabled={false}/><GuardedNavigation onNavigate={()=>navigations++}/><button>Keep focus</button></ScalarDrafts>);
 const data=new Map<string,string>();
 const dataTransfer={types:["application/x-workspace-group-assignment"],setData:(type:string,value:string)=>data.set(type,value),getData:(type:string)=>data.get(type)??"",effectAllowed:"move",dropEffect:"none"};
 return {navigations:()=>navigations,assignments:()=>assignments,dataTransfer,close:()=>{cleanup();service.close();rmSync(directory,{recursive:true,force:true});}};
}
for(const layout of ["table","board"] as const) test(`${layout} cancelled assignment drag clears feedback and cannot replay a retained payload`,async()=>{
 const f=fixture(layout);
 try {
  const source=await screen.findByRole("button",{name:"Drag to change group: Alpha"});
  await waitFor(()=>assert.equal((source as HTMLButtonElement).disabled,false));
  const target=screen.getByRole("region",{name:"42"});
  fireEvent.dragStart(source,{dataTransfer:f.dataTransfer});
  await screen.findByText("Choose a destination group. Escape cancels the drag.");
  fireEvent.dragOver(target,{dataTransfer:f.dataTransfer});
  assert.equal(target.getAttribute("data-assignment-target"),"true");
  fireEvent.keyDown(document,{key:"Escape"});
  assert.equal(screen.queryByText("Choose a destination group. Escape cancels the drag."),null);
  assert.equal(target.hasAttribute("data-assignment-target"),false);
  fireEvent.drop(target,{dataTransfer:f.dataTransfer});
  assert.equal(f.assignments(),0);
  fireEvent.dragStart(source,{dataTransfer:f.dataTransfer});
  fireEvent.dragEnd(source,{dataTransfer:f.dataTransfer});
  fireEvent.drop(target,{dataTransfer:f.dataTransfer});
  assert.equal(f.assignments(),0);
 }finally{f.close();}
});
for(const layout of ["table","board"] as const) test(`${layout} active invalid draft blocks assignment until explicitly cancelled`,async()=>{
 const f=fixture(layout),user=userEvent.setup({document});
 try {
  const control=await screen.findByLabelText("Change group: Alpha");
  await waitFor(()=>assert.equal((control as HTMLSelectElement).disabled,false));
  await user.click(screen.getByRole("button",{name:"Edit Number value: Alpha / Budget"}));
  await user.type(screen.getByRole("textbox"),"1/0");
  assert.equal((control as HTMLSelectElement).disabled,true);
  assert.equal((screen.getByRole("button",{name:"Drag to change group: Alpha"}) as HTMLButtonElement).disabled,true);
  assert.equal(f.assignments(),0);
  assert.equal((screen.getByRole("textbox") as HTMLInputElement).value,"1/0");
  await user.click(screen.getByRole("button",{name:"Cancel value edit"}));
  await waitFor(()=>assert.equal((screen.getByLabelText("Change group: Alpha") as HTMLSelectElement).disabled,false));
  await user.selectOptions(screen.getByLabelText("Change group: Alpha"),"42");
  await waitFor(()=>assert.equal((screen.getByLabelText("Change group: Alpha") as HTMLSelectElement).value,"42"));
  assert.equal(f.assignments(),1);
 }finally{f.close();}
});
for(const layout of ["table","board"] as const) test(`${layout} pending assignment blocks competing edits and navigation without replay`,async()=>{
 let release!:()=>void;
 const f=fixture(layout,new Promise<void>(resolve=>{release=resolve;})),user=userEvent.setup({document});
 try {
  const control=await screen.findByLabelText("Change group: Alpha");
  await waitFor(()=>assert.equal((control as HTMLSelectElement).disabled,false));
  await user.selectOptions(control,"42");
  await screen.findByText("Saving group value…");
  assert.equal((screen.getByRole("button",{name:"Edit Number value: Alpha / Budget"}) as HTMLButtonElement).disabled,true);
  assert.equal((screen.getByRole("button",{name:"Edit Number value: Beta / Budget"}) as HTMLButtonElement).disabled,true);
  await user.click(screen.getByRole("button",{name:"Leave view"}));
  assert.equal(f.navigations(),0);
  assert.equal(f.assignments(),1);
  release();
  await waitFor(()=>assert.equal((screen.getByLabelText("Change group: Alpha") as HTMLSelectElement).value,"42"));
  await waitFor(()=>assert.equal((screen.getByLabelText("Change group: Alpha") as HTMLSelectElement).disabled,false));
  assert.equal(f.navigations(),0,"A blocked transition is not queued");
  await user.click(screen.getByRole("button",{name:"Leave view"}));
  assert.equal(f.navigations(),1);
  assert.equal(f.assignments(),1);
 }finally{release();f.close();}
});
test("a delayed assignment does not steal focus from a subsequently chosen control",async()=>{
 let release!:()=>void;
 const f=fixture("table",new Promise<void>(resolve=>{release=resolve;})),user=userEvent.setup({document});
 try{
  const control=await screen.findByLabelText("Change group: Alpha");
  await waitFor(()=>assert.equal((control as HTMLSelectElement).disabled,false));
  await user.selectOptions(control,"42");
  await screen.findByText("Saving group value…");
  const chosen=screen.getByRole("button",{name:"Keep focus"});await user.click(chosen);
  release();
  await waitFor(()=>assert.equal((screen.getByLabelText("Change group: Alpha") as HTMLSelectElement).disabled,false));
  await waitFor(()=>assert.equal((screen.getByRole("region",{name:"42"}).querySelector('select[aria-label="Change group: Alpha"]') as HTMLSelectElement)?.value,"42"));
  assert.equal(document.activeElement===chosen,true);
 }finally{release();f.close();}
});
