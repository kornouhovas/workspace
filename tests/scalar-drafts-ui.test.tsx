import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { TextPropertyCell } from "../src/renderer/components/TextPropertyCell.js";
const browser = new Window();
Object.assign(globalThis, {requestAnimationFrame:browser.requestAnimationFrame.bind(browser),cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser),Element:browser.Element,CustomEvent:browser.CustomEvent,getComputedStyle:browser.getComputedStyle.bind(browser),NodeFilter:browser.NodeFilter,HTMLInputElement:browser.HTMLInputElement,ResizeObserver:browser.ResizeObserver,window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Node:browser.Node,MutationObserver:browser.MutationObserver});
Object.defineProperty(globalThis,"navigator",{configurable:true,value:browser.navigator});
const {render,cleanup,screen,waitFor}=await import("@testing-library/react");
const {default:userEvent}=await import("@testing-library/user-event");
test("Text Enter keeps multiline draft; leaving field commits once and Cancel never saves",async()=>{
 const values:(string|null)[]=[];
 const user=userEvent.setup({document});
 try {
  render(<><TextPropertyCell workspaceId="w" sourceId="s" projectId="p" propertyId="f" projectName="Atlas" propertyName="Notes" value={null} revision={0} minimumRevision={{current:0}} language="en" disabled={false} onSave={async value=>{values.push(value);return {ok:true,value:{projectId:"p",propertyId:"f",snapshot:{workspaceId:"w",sourceId:"s",revision:1,definitions:[],values:[],numberValues:[],dateValues:[],selectOptions:[],selectValues:[],multiSelectValues:[]}}};}}/><button>Next</button></>);
  await user.click(screen.getByRole("button",{name:/Edit Text value/}));
  await user.keyboard("one{Enter}two");
  assert.equal(values.length,0);
  await user.click(screen.getByRole("button",{name:"Next"}));
  await waitFor(()=>assert.deepEqual(values,["one\ntwo"]));
  await user.click(screen.getByRole("button",{name:/Edit Text value/}));
  await user.keyboard("discard");await user.click(screen.getByRole("button",{name:"Cancel value edit"}));
  assert.deepEqual(values,["one\ntwo"]);
 }finally{cleanup();}
});

test("invalid Number blocks project replacement and close until correction or explicit cancellation",async()=>{
 const {mkdtempSync,mkdirSync,rmSync}=await import("node:fs"),{tmpdir}=await import("node:os"),{join}=await import("node:path");
 // @ts-expect-error Built service has no declarations.
 const {openSettingsService}=await import("../dist/service/settings.mjs");
 const {WorkspaceServiceClient}=await import("../src/renderer/workspace-service-client.js");
 const {DiscoveryWorkspace}=await import("../src/renderer/components/DiscoveryPanel.js");
 const {within}=await import("@testing-library/react");
 const directory=mkdtempSync(join(tmpdir(),"scalar-draft-")),root=join(directory,"root");mkdirSync(root);mkdirSync(join(root,"Atlas"));mkdirSync(join(root,"Beacon"));
 const service=openSettingsService(join(directory,"app.sqlite"));
 const workspace=service.handleCommand({type:"workspace.create",name:"One",rootPath:root}).value;
 const {workspaceId,sourceId}=workspace;
 const preview=service.handleQuery({type:"workspace.previewDiscovery",workspaceId}).value;
 service.handleCommand({type:"workspace.applyDiscovery",workspaceId,previewToken:preview.previewToken});
 service.handleCommand({type:"workspace.createProperty",workspaceId,name:"Budget",propertyType:"number"});
 const api={onBackendStatus:()=>()=>{},workspace:async(input:{type:string})=>/workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input),onWorkspaceChange:service.workspaces.subscribe};
 const client=new WorkspaceServiceClient(api as unknown as import("../src/contracts/desktop-api.js").WorkspaceDesktopApi),user=userEvent.setup({document});
 try {
  render(<DiscoveryWorkspace client={client} workspaceId={workspaceId} sourceId={sourceId} language="en" disabled={false}/>);
  await user.click(await screen.findByRole("button",{name:"Preview project: Atlas"}));
  let area=await screen.findByRole("region",{name:"Project: Atlas"});
  await user.click(await within(area).findByRole("button",{name:"Edit Number value: Atlas / Budget"}));
  await user.keyboard("1/0");
  await user.click(screen.getByRole("button",{name:"Preview project: Beacon"}));
  await waitFor(()=>assert.ok(screen.getByRole("region",{name:"Project: Atlas"})));
  assert.equal((within(area).getByRole("textbox") as HTMLInputElement).value,"1/0");
  await user.click(screen.getByRole("button",{name:"Close preview"}));
  assert.ok(screen.getByRole("region",{name:"Project: Atlas"}));
  await user.click(within(area).getByRole("button",{name:"Cancel value edit"}));
  await user.click(screen.getByRole("button",{name:"Preview project: Beacon"}));
  area=await screen.findByRole("region",{name:"Project: Beacon"});
  await user.click(await within(area).findByRole("button",{name:"Edit Number value: Beacon / Budget"}));
  await user.keyboard("10+5");await user.click(screen.getByRole("button",{name:"Close preview"}));
  await waitFor(()=>assert.equal(screen.queryByRole("region",{name:"Project: Beacon"}),null));
  assert.equal(service.handleQuery({type:"workspace.listTextProperties",workspaceId}).value.numberValues[0].value,15);
 }finally{cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
});

for (const surface of ["table","board","details"] as const) for (const language of ["en","ru"] as const) {
 test(`${surface} ${language} shared scalars preserve empty Text, arithmetic Number and manual/calendar Date`,async()=>{
  const f=await scalarFixture(),user=userEvent.setup({document});
  const {TextPropertiesTable}=await import("../src/renderer/components/TextPropertiesTable.js");
  const {translate}=await import("../src/renderer/localization.js");
  const t=(key:Parameters<typeof translate>[1])=>translate(language,key);
  const label=(type:"text"|"number"|"date",name:string)=>`${t(type==="text"?"editTextValue":type==="number"?"editNumberValue":"editDateValue")}: Atlas / ${name}`;
  try {
   render(<TextPropertiesTable client={f.client} workspaceId={f.workspaceId} sourceId={f.sourceId} projects={[f.projects[0]]} language={language} layout={surface==="board"?"board":"table"} detail={surface==="details"} hideReveal disabled={false}/>);
   await user.click(await screen.findByRole("button",{name:label("text","Notes")}));
   await user.keyboard("line one{Enter}строка{Control>}{Enter}{/Control}");
   await waitFor(()=>assert.equal(f.snapshot().values[0].value,"line one\nстрока"));
   await user.click(screen.getByRole("button",{name:label("text","Notes")}));
   await user.clear(screen.getByRole("textbox",{name:label("text","Notes")}));
   await user.keyboard("{Meta>}{Enter}{/Meta}");
   await waitFor(()=>assert.equal(f.snapshot().values[0].value,""));
   await user.click(screen.getByRole("button",{name:label("text","Notes")}));
   await user.click(screen.getByRole("button",{name:t("clearTextValue")}));
   await waitFor(()=>assert.equal(f.snapshot().values.length,0));
   await user.click(screen.getByRole("button",{name:label("number","Budget")}));
   await user.keyboard("10+5{Enter}");
   await waitFor(()=>assert.equal(f.snapshot().numberValues[0].value,15));
   await user.click(screen.getByRole("button",{name:label("number","Budget")}));
   assert.equal((screen.getByRole("textbox",{name:label("number","Budget")}) as HTMLInputElement).value,"15");
   await user.keyboard("{Escape}");
   await user.click(screen.getByRole("button",{name:label("date","Deadline")}));
   await user.keyboard("2024-02-29{Enter}");
   await waitFor(()=>assert.equal(f.snapshot().dateValues[0].value,"2024-02-29"));
   await user.click(screen.getByRole("button",{name:label("date","Deadline")}));
   await user.click(screen.getByRole("button",{name:t("chooseCalendarDate")}));
   const picker=screen.getByLabelText(t("chooseCalendarDate"),{selector:"input"});
   const {fireEvent}=await import("@testing-library/react");
   fireEvent.change(picker,{target:{value:"0001-01-01"}});
   await waitFor(()=>assert.equal(f.snapshot().dateValues[0].value,"0001-01-01"));
   await user.keyboard("{Escape}");
   assert.equal(f.snapshot().dateValues[0].value,"0001-01-01");
  }finally{f.dispose();}
 });
}

async function scalarFixture(intercept?: (input: Record<string,unknown>, handle:()=>unknown)=>Promise<unknown>) {
 const {mkdtempSync,mkdirSync,rmSync}=await import("node:fs"),{tmpdir}=await import("node:os"),{join}=await import("node:path");
 // @ts-expect-error Built service has no declarations.
 const {openSettingsService}=await import("../dist/service/settings.mjs");
 const {WorkspaceServiceClient}=await import("../src/renderer/workspace-service-client.js");
 const directory=mkdtempSync(join(tmpdir(),"scalar-draft-")),root=join(directory,"root");mkdirSync(root);mkdirSync(join(root,"Atlas"));mkdirSync(join(root,"Beacon"));
 const service=openSettingsService(join(directory,"app.sqlite"));
 const workspace=service.handleCommand({type:"workspace.create",name:"One",rootPath:root}).value;
 const {workspaceId,sourceId}=workspace;
 const sibling=service.handleCommand({type:"workspace.create",name:"Sibling",rootPath:root}).value;
 const call=(type:string,fields:Record<string,unknown>={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields}).value;
 const preview=service.handleQuery({type:"workspace.previewDiscovery",workspaceId}).value;
 const projects=call("applyDiscovery",{previewToken:preview.previewToken}).projects;
 const properties=Object.fromEntries(([['text','Notes'],['number','Budget'],['date','Deadline']] as const).map(([type,name])=>[type,call("createProperty",{name,propertyType:type}).propertyId]));
 const api={onBackendStatus:()=>()=>{},workspace:async(input:Record<string,unknown>&{type:string})=>{
  const handle=()=>/workspace\.(list|get|query)/.test(input.type)?service.handleQuery(input):service.handleCommand(input);
  return intercept?intercept(input,handle):handle();
 },onWorkspaceChange:service.workspaces.subscribe};
 const client=new WorkspaceServiceClient(api as unknown as import("../src/contracts/desktop-api.js").WorkspaceDesktopApi);
 return {client,service,workspaceId,sourceId,projects,properties,sibling,call,snapshot:()=>service.handleQuery({type:"workspace.listTextProperties",workspaceId}).value,
 dispose(){cleanup();service.close();rmSync(directory,{recursive:true,force:true});}};
}

test("failed/lost reply retains draft, blocks navigation without replay, and explicit retry/cancel recovers",async()=>{
 let writes=0,fail=true;
 const f=await scalarFixture(async(input,handle)=>{
  const result=handle();
  if(input.type==="workspace.setNumberValue"){writes++;if(fail)throw new Error("Lost committed response");}
  return result;
 }),user=userEvent.setup({document});
 const {DiscoveryWorkspace}=await import("../src/renderer/components/DiscoveryPanel.js"),{within}=await import("@testing-library/react");
 try {
  render(<DiscoveryWorkspace client={f.client} workspaceId={f.workspaceId} sourceId={f.sourceId} language="en" disabled={false}/>);
  await user.click(await screen.findByRole("button",{name:"Preview project: Atlas"}));
  const area=await screen.findByRole("region",{name:"Project: Atlas"});
  await user.click(await within(area).findByRole("button",{name:"Edit Number value: Atlas / Budget"}));
  await user.keyboard("10+5{Enter}");await within(area).findByRole("alert");
  assert.equal(f.snapshot().numberValues[0].value,15);
  assert.equal((within(area).getByRole("textbox") as HTMLInputElement).value,"10+5");
  await user.click(screen.getByRole("button",{name:"Preview project: Beacon"}));
  await user.click(screen.getByRole("button",{name:"Close preview"}));
  assert.equal(writes,1,"navigation never blindly retries a failed response");
  assert.ok(screen.getByRole("region",{name:"Project: Atlas"}));
  fail=false;await user.click(within(area).getByRole("button",{name:"Save value"}));
  await waitFor(()=>assert.equal(within(area).queryByRole("textbox"),null));
  assert.equal(writes,2);
  await user.click(screen.getByRole("button",{name:"Preview project: Beacon"}));
  await screen.findByRole("region",{name:"Project: Beacon"});
 }finally{f.dispose();}
});

test("Enter plus blur and rapid transitions await one owned delayed write and preserve newer source value",async()=>{
 let writes=0,release:(()=>void)|undefined;
 const f=await scalarFixture(async(input,handle)=>{
  const result=handle();
  if(input.type==="workspace.setNumberValue"){
   writes++;
   await new Promise<void>(resolve=>{release=resolve;});
  }
  return result;
 }),user=userEvent.setup({document});
 const {DiscoveryWorkspace}=await import("../src/renderer/components/DiscoveryPanel.js"),{within}=await import("@testing-library/react");
 try {
  render(<DiscoveryWorkspace client={f.client} workspaceId={f.workspaceId} sourceId={f.sourceId} language="en" disabled={false}/>);
  await user.click(await screen.findByRole("button",{name:"Preview project: Atlas"}));
  const area=await screen.findByRole("region",{name:"Project: Atlas"});
  await user.click(await within(area).findByRole("button",{name:"Edit Number value: Atlas / Budget"}));
  await user.keyboard("10+5{Enter}");
  await waitFor(()=>assert.ok(release));
  await user.click(screen.getByRole("button",{name:"Preview project: Beacon"}));
  await user.click(screen.getByRole("button",{name:"Close preview"}));
  assert.ok(screen.getByRole("region",{name:"Project: Atlas"}));
  f.service.handleCommand({type:"workspace.setNumberValue",workspaceId:f.sibling.workspaceId,projectId:f.projects[0].projectId,propertyId:f.properties.number,expression:"84"});
  release!();
  await screen.findByRole("region",{name:"Project: Beacon"});
  assert.equal(writes,1);
  assert.equal(f.snapshot().numberValues[0].value,84);
  await user.click(screen.getByRole("button",{name:"Preview project: Atlas"}));
  const returned=await screen.findByRole("region",{name:"Project: Atlas"});
  await waitFor(()=>assert.equal(within(returned).getByRole("button",{name:"Edit Number value: Atlas / Budget"}).textContent,"84"));
 }finally{release?.();f.dispose();}
});

test("workspace/settings/history retain invalid Date; correction saves before switching workspace",async()=>{
 const f=await scalarFixture(),user=userEvent.setup({document});
 const {ScalarDrafts}=await import("../src/renderer/components/ScalarDrafts.js");
 const {DesktopShell}=await import("../src/renderer/components/DesktopShell.js");
 const {TextPropertiesTable}=await import("../src/renderer/components/TextPropertiesTable.js");
 const {within}=await import("@testing-library/react");
 f.service.handleCommand({type:"workspace.activate",workspaceId:f.workspaceId});
 let activations=0;
 function Harness(){
  const [data,setData]=React.useState(f.service.handleQuery({type:"workspace.load"}).value);
  return <ScalarDrafts><DesktopShell language="en" data={data} busy={false} locked={false}
   onActivate={async id=>{activations++;const result=await f.client.activateWorkspace(id);if(result.ok)setData(f.service.handleQuery({type:"workspace.load"}).value);return result.ok;}}
   renderPanels={()=>({general:<p>Settings page</p>,appearance:null,workspaces:null,sources:null,backup:null,about:null})}>
   <TextPropertiesTable client={f.client} workspaceId={data.activeWorkspace.workspaceId} sourceId={data.activeWorkspace.sourceId} projects={[f.projects[0]]} language="en" disabled={false} detail hideReveal/>
  </DesktopShell></ScalarDrafts>;
 }
 try{
  render(<Harness/>);
  await user.click(await screen.findByRole("button",{name:"Edit Date value: Atlas / Deadline"}));
  await user.keyboard("2025-02-29");
  await user.click(screen.getByRole("button",{name:"Sibling"}));
  await screen.findByRole("alert");assert.equal(activations,0);
  const editor=screen.getByRole("textbox",{name:"Edit Date value: Atlas / Deadline"});
  assert.equal((editor as HTMLInputElement).value,"2025-02-29");
  await user.click(screen.getByRole("button",{name:"Settings"}));
  assert.equal(screen.queryByRole("tabpanel",{name:"General"}),null);
  await user.clear(editor);await user.type(editor,"2024-02-29");
  await user.click(screen.getByRole("button",{name:"Sibling"}));
  await waitFor(()=>assert.equal(activations,1));
  await waitFor(()=>assert.equal(screen.getByRole("button",{name:"Sibling"}).getAttribute("aria-current"),"page"));
  assert.equal(f.snapshot().dateValues[0].value,"2024-02-29");
  await user.click(await screen.findByRole("button",{name:"Edit Number value: Atlas / Budget"}));
  await user.keyboard("1/0");await user.click(screen.getByRole("button",{name:"Back"}));
  await screen.findByRole("alert");assert.equal(activations,1);
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button",{name:"Back"}));
  await waitFor(()=>assert.equal(activations,2));
  await user.click(screen.getByRole("button",{name:"Settings"}));
  await waitFor(()=>assert.ok(within(screen.getByRole("tabpanel",{name:"General"})).getByText("Settings page")));
 }finally{f.dispose();}
});

test("same-source regrouping retains the active draft and focus until explicit cancellation",async()=>{
 const f=await scalarFixture(),user=userEvent.setup({document});
 const {DiscoveryWorkspace}=await import("../src/renderer/components/DiscoveryPanel.js");
 const {act}=await import("@testing-library/react");
 const viewId=f.service.handleQuery({type:"workspace.listViews",workspaceId:f.workspaceId}).value.activeViewId;
 f.call("setViewGrouping",{viewId,config:{propertyId:f.properties.number,settings:[]}});
 try{
  render(<DiscoveryWorkspace client={f.client} workspaceId={f.workspaceId} sourceId={f.sourceId} language="en" disabled={false}/>);
  const label="Edit Text value: Atlas / Notes";
  await user.click(await screen.findByRole("button",{name:label}));
  const editor=screen.getByRole("textbox",{name:label});
  await user.type(editor,"Retain my draft");
  await act(async()=>{f.service.handleCommand({type:"workspace.setNumberValue",workspaceId:f.sibling.workspaceId,projectId:f.projects[0].projectId,propertyId:f.properties.number,expression:"84"});});
  await waitFor(()=>assert.equal(screen.getByRole("button",{name:"Edit Number value: Atlas / Budget"}).textContent,"84"));
  assert.equal(screen.queryByRole("textbox",{name:label})===editor,true);
  assert.equal(document.activeElement===editor,true);
  assert.equal((editor as HTMLTextAreaElement).value,"Retain my draft");
  await user.keyboard("{Escape}");
  await screen.findByRole("region",{name:"84"});
  assert.equal(f.snapshot().values.length,0);
 }finally{f.dispose();}
});
