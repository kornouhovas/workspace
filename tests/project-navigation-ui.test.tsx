import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import type { WorkspaceDesktopApi } from "../src/contracts/desktop-api.js";
const browser = new Window();
Object.assign(globalThis, { requestAnimationFrame:browser.requestAnimationFrame.bind(browser), cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser), window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Element: browser.Element, Node: browser.Node, MutationObserver: browser.MutationObserver, CustomEvent: browser.CustomEvent, getComputedStyle: browser.getComputedStyle.bind(browser), NodeFilter: browser.NodeFilter, HTMLInputElement: browser.HTMLInputElement, ResizeObserver: browser.ResizeObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { cleanup, render, screen, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { DiscoveryWorkspace } = await import("../src/renderer/components/DiscoveryPanel.js");
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "project-navigation-")), root = join(directory, "root"); mkdirSync(root);
  for (const name of ["Atlas", "Beacon", "Cedar"]) mkdirSync(join(root, name));
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value;
  const workspaceId = workspace.workspaceId;
  const preview = service.handleQuery({type:"workspace.previewDiscovery",workspaceId,mode:"direct"}).value;
  service.handleCommand({type:"workspace.applyDiscovery",workspaceId,previewToken:preview.previewToken});
  const api = {onBackendStatus:()=>()=>{}, workspace: async (input: {type:string}) => /workspace\.(list|get|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input), onWorkspaceChange:service.workspaces.subscribe};
  return {api, service, workspace, client:new WorkspaceServiceClient(api as unknown as WorkspaceDesktopApi), dispose(){cleanup();service.close();rmSync(directory,{recursive:true,force:true});}};
}
test("row preview replaces the previous project, expands uniquely and returns to its saved view", async () => {
  const f=fixture(), user=userEvent.setup({document});
  try {
    render(<DiscoveryWorkspace client={f.client} workspaceId={f.workspace.workspaceId} sourceId={f.workspace.sourceId} language="en" disabled={false}/>);
    await user.click(await screen.findByRole("button",{name:"Preview project: Atlas"}));
    let area=await screen.findByRole("region",{name:"Project: Atlas"});
    await user.click(screen.getByRole("button",{name:"Preview project: Beacon"}));
    area=await screen.findByRole("region",{name:"Project: Beacon"});
    assert.equal(screen.queryByRole("region",{name:"Project: Atlas"}),null);
    await user.click(within(area).getByRole("button",{name:"Expand project"}));
    await screen.findByRole("tab",{name:"Beacon",selected:true});
    await user.click(screen.getByRole("tab",{name:"Table"}));
    await user.click(screen.getByRole("button",{name:"Preview project: Beacon"}));
    await user.click(within(screen.getByRole("region",{name:"Project: Beacon"})).getByRole("button",{name:"Expand project"}));
    assert.equal(screen.getAllByRole("tab",{name:"Beacon"}).length,1);
    await user.click(screen.getByRole("button",{name:"Return project to the right"}));
    await waitFor(()=>assert.equal(screen.queryByRole("tab",{name:"Beacon"}),null));
    assert.ok(screen.getByRole("tab",{name:"Table",selected:true}));
    await user.click(screen.getByRole("button",{name:"Close preview"}));
    assert.equal(screen.queryByRole("region",{name:"Project: Beacon"}),null);
  } finally { f.dispose(); }
});

test("inactive close, tab ordering, close-right and reopen preserve unique active content",async()=>{
 const f=fixture(),user=userEvent.setup({document});
 try {
  render(<DiscoveryWorkspace client={f.client} workspaceId={f.workspace.workspaceId} sourceId={f.workspace.sourceId} language="en" disabled={false}/>);
  for(const name of ["Atlas","Beacon","Cedar"]){
    await user.click(await screen.findByRole("button",{name:`Preview project: ${name}`}));
    await user.click(screen.getByRole("button",{name:"Expand project"}));
    await user.click(screen.getByRole("tab",{name:"Table"}));
  }
  await user.click(screen.getByRole("tab",{name:"Beacon"}));
  await user.click(screen.getByRole("button",{name:"Close project tab: Atlas"}));
  assert.ok(screen.getByRole("tab",{name:"Beacon",selected:true}));
  await user.click(screen.getByRole("button",{name:"Reopen closed project"}));
  assert.deepEqual(within(screen.getByRole("tablist",{name:"Project tabs"})).getAllByRole("tab").map(tab=>tab.textContent),["Beacon","Cedar","Atlas"]);
  await user.click(screen.getByRole("button",{name:"Project tab actions: Atlas"}));
  await user.click(screen.getByRole("menuitem",{name:"Move tab left"}));
  await user.click(screen.getByRole("button",{name:"Project tab actions: Atlas"}));
  await user.click(screen.getByRole("menuitem",{name:"Close project tabs to the right"}));
  assert.equal(screen.queryByRole("tab",{name:"Cedar"}),null);
  assert.ok(screen.getByRole("tab",{name:"Atlas",selected:true}));
  await user.click(screen.getByRole("button",{name:"Project tab actions: Beacon"}));
  await user.click(screen.getByRole("menuitem",{name:"Close other project tabs"}));
  assert.ok(screen.getByRole("tab",{name:"Table",selected:true}));
  await user.click(screen.getByRole("button",{name:"Reopen closed project"}));
  await user.dblClick(screen.getByRole("button",{name:"Reopen closed project"}));
  const ids=within(screen.getByRole("tablist",{name:"Project tabs"})).getAllByRole("tab").map(tab=>tab.textContent);
  assert.equal(new Set(ids).size,ids.length);
 }finally{f.dispose();}
});

test("workspace/settings Back and Forward traverse once, truncate fresh branches and remain available collapsed",async()=>{
 const {DesktopShell}=await import("../src/renderer/components/DesktopShell.js");
 const user=userEvent.setup({document});
 function Harness(){const [id,setId]=React.useState("one");return <DesktopShell language="en" busy={false} locked={false} data={{workspaces:[{workspaceId:"one",name:"One"},{workspaceId:"two",name:"Two"}],activeWorkspace:{workspaceId:id,sourceId:id,viewId:id,name:id,canonicalRoot:"/fixture",sourceAvailable:true}}} onActivate={async id=>{setId(id);return true;}} renderPanels={()=>({general:<>General</>,appearance:null,workspaces:null,sources:null,backup:null,about:null})}><p>Current {id}</p></DesktopShell>;}
 try{
 render(<Harness/>);
 assert.equal((screen.getByRole("button",{name:"Back"}) as HTMLButtonElement).disabled,true);
 await user.click(screen.getByRole("button",{name:"Two"}));
 await user.click(screen.getByRole("button",{name:"Settings"}));
 await user.click(screen.getByRole("button",{name:"Back"}));
 await waitFor(()=>assert.ok(screen.getByText("Current two")));
 await user.click(screen.getByRole("button",{name:"Back"}));
 await waitFor(()=>assert.equal((screen.getByRole("button",{name:"Back"}) as HTMLButtonElement).disabled,true));
 await user.click(screen.getByRole("button",{name:"Forward"}));
 await user.click(screen.getByRole("button",{name:"One"}));
 assert.equal((screen.getByRole("button",{name:"Forward"}) as HTMLButtonElement).disabled,true);
 await user.click(screen.getByRole("button",{name:"Collapse sidebar"}));
 await user.click(screen.getByRole("button",{name:"Back"}));
 await waitFor(()=>assert.ok(screen.getByText("Current two")));
 await user.click(screen.getByRole("button",{name:"Restore sidebar"}));
 assert.ok(screen.getByRole("button",{name:"Two"}));
 }finally{cleanup();}
});

for(const language of ["en","ru"] as const)test(`${language} property editing stays in the view and project details use real values with Cancel and save`,async()=>{
 const f=fixture(),user=userEvent.setup({document}),en=language==="en",workspaceId=f.workspace.workspaceId;
 const project=f.service.handleQuery({type:"workspace.listProjects",workspaceId}).value.projects.find((p:{name:string})=>p.name==="Atlas");
 const propertyId=f.service.handleCommand({type:"workspace.createProperty",workspaceId,name:"Notes",propertyType:"text"}).value.propertyId;
 f.service.handleCommand({type:"workspace.setTextValue",workspaceId,projectId:project.projectId,propertyId,value:"Original\nТочная строка"});
 try{
  render(<DiscoveryWorkspace client={f.client} workspaceId={workspaceId} sourceId={f.workspace.sourceId} language={language} disabled={false}/>);
  const {translate}=await import("../src/renderer/localization.js");
  const t=(key:Parameters<typeof translate>[1])=>translate(language,key);
  await user.click(await screen.findByRole("button",{name:`${t("editTextValue")}: Atlas / Notes`}));
  assert.equal(!!screen.queryByRole("region",{name:`${en?'Project':'Проект'}: Atlas`}),false);
  const input=screen.getByRole("textbox",{name:`${t("editTextValue")}: Atlas / Notes`});
  await user.click(screen.getByText(`${t("editTextValue")}: Atlas / Notes`,{selector:"label"}));
  assert.equal(!!screen.queryByRole("region",{name:`${en?'Project':'Проект'}: Atlas`}),false);
  await user.clear(input);await user.type(input,"Discard");await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button",{name:`${en?'Preview project':'Открыть предпросмотр проекта'}: Atlas`}));
  const area=await screen.findByRole("region",{name:`${en?'Project':'Проект'}: Atlas`});
  assert.ok(within(area).getByText("Original Точная строка"));
  await user.click(within(area).getByRole("button",{name:`${t("editTextValue")}: Atlas / Notes`}));
  const detail=within(area).getByRole("textbox",{name:`${t("editTextValue")}: Atlas / Notes`});
  await user.clear(detail);await user.type(detail,"Saved from details");
  await user.click(within(area).getByRole("button",{name:t("saveTextValue")}));
  await waitFor(()=>assert.equal(f.service.handleQuery({type:"workspace.listTextProperties",workspaceId}).value.values.find((v:{projectId:string;propertyId:string})=>v.projectId===project.projectId&&v.propertyId===propertyId).value,"Saved from details"));
 }finally{f.dispose();}
});

test("each saved view restores its preview and workspace remount retains unique tabs in session",async()=>{
 const f=fixture(),user=userEvent.setup({document}),workspaceId=f.workspace.workspaceId;
 const views=f.service.handleCommand({type:"workspace.createView",workspaceId,name:"Review",kind:"board"}).value;
 const table=views.views.find((v:{name:string})=>v.name==="Table");f.service.handleCommand({type:"workspace.activateView",workspaceId,viewId:table.viewId});
 const {createNavigationMemory}=await import("../src/renderer/components/ProjectNavigation.js");const memory=createNavigationMemory();
 const element=()=> <DiscoveryWorkspace memory={memory} client={f.client} workspaceId={workspaceId} sourceId={f.workspace.sourceId} language="en" disabled={false}/>;
 try{
  const mounted=render(element());
  await user.click(await screen.findByRole("button",{name:"Preview project: Atlas"}));await user.click(screen.getByRole("button",{name:"Expand project"}));
  await user.click(screen.getByRole("tab",{name:"Review"}));
  await user.click(await screen.findByRole("button",{name:"Preview project: Beacon"}));
  await user.click(screen.getByRole("tab",{name:"Table"}));
  await screen.findByRole("region",{name:"Project: Atlas"});
  await user.click(screen.getByRole("tab",{name:"Atlas"}));
  mounted.unmount();render(element());
  await screen.findByRole("tab",{name:"Atlas",selected:true});
  assert.equal(screen.getAllByRole("region",{name:"Project: Atlas"}).length,1);
  await user.click(screen.getByRole("button",{name:"Return project to the right"}));
  assert.ok(screen.getByRole("tab",{name:"Table",selected:true}));
 }finally{f.dispose();}
});

test("late detail reads cannot replace the next project or reopen a closed preview",async()=>{
 const f=fixture(),user=userEvent.setup({document});
 try{
  render(<DiscoveryWorkspace client={f.client} workspaceId={f.workspace.workspaceId} sourceId={f.workspace.sourceId} language="en" disabled={false}/>);
  await screen.findByRole("button",{name:"Preview project: Atlas"});
  const read=f.api.workspace;let release:((value:unknown)=>void)|undefined;
  let delayed=true;
  f.api.workspace=async input=>{const result=await read(input);if(delayed && input.type==="workspace.listTextProperties"){delayed=false;return await new Promise(resolve=>{release=resolve;}).then(()=>result);}return result;};
  await user.click(screen.getByRole("button",{name:"Preview project: Atlas"}));
  await waitFor(()=>assert.ok(release));
  await user.click(screen.getByRole("button",{name:"Preview project: Beacon"}));
  await screen.findByRole("region",{name:"Project: Beacon"});
  await user.click(screen.getByRole("button",{name:"Close preview"}));
  release?.(undefined);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(screen.queryByRole("region",{name:/^Project:/}),null);
 }finally{f.dispose();}
});

test("delayed Back disables competing visits and collapse/restore keeps keyboard focus",async()=>{
 const {DesktopShell}=await import("../src/renderer/components/DesktopShell.js");const user=userEvent.setup({document});
 let resolve: (()=>void)|undefined;
 function Harness(){const [id,setId]=React.useState("one");const first=React.useRef(true);return <DesktopShell language="en" busy={false} locked={false} data={{workspaces:[{workspaceId:"one",name:"One"},{workspaceId:"two",name:"Two"}],activeWorkspace:{workspaceId:id,sourceId:id,viewId:id,name:id,canonicalRoot:"/fixture",sourceAvailable:true}}} onActivate={async next=>{if(first.current){first.current=false;setId(next);return true;}await new Promise<void>(done=>{resolve=done;});setId(next);return true;}} renderPanels={()=>({general:<>General</>,appearance:null,workspaces:null,sources:null,backup:null,about:null})}><p>Current {id}</p></DesktopShell>;}
 try{
  render(<Harness/>);await user.click(screen.getByRole("button",{name:"Two"}));await user.click(screen.getByRole("button",{name:"Back"}));
  await waitFor(()=>assert.ok(resolve));
  assert.equal((screen.getByRole("button",{name:"Settings"}) as HTMLButtonElement).disabled,true);
  await user.click(screen.getByRole("button",{name:"Settings"}));
  resolve?.();await waitFor(()=>assert.ok(screen.getByText("Current one")));
  await user.click(screen.getByRole("button",{name:"Collapse sidebar"}));
  assert.equal(document.activeElement,screen.getByRole("button",{name:"Restore sidebar"}));
  assert.equal(screen.queryByRole("separator",{name:"Sidebar width"}),null);
  await user.keyboard("{Enter}");assert.equal(document.activeElement,screen.getByRole("button",{name:"Collapse sidebar"}));
 }finally{cleanup();}
});

test("project detail read errors offer retry without replacing the selected project",async()=>{
 const f=fixture(),user=userEvent.setup({document});
 try{
  render(<DiscoveryWorkspace client={f.client} workspaceId={f.workspace.workspaceId} sourceId={f.workspace.sourceId} language="en" disabled={false}/>);
  await screen.findByRole("button",{name:"Preview project: Atlas"});
  const read=f.api.workspace;let fail=true;
  f.api.workspace=async input=>{if(fail && input.type==="workspace.listTextProperties"){fail=false;throw new Error("simulated transport failure");}return read(input);};
  await user.click(screen.getByRole("button",{name:"Preview project: Atlas"}));
  const area=await screen.findByRole("region",{name:"Project: Atlas"});
  await user.click(await within(area).findByRole("button",{name:"Reload properties"}));
  await waitFor(()=>assert.equal(within(area).queryByRole("button",{name:"Reload properties"}),null));
  assert.ok(screen.getByRole("region",{name:"Project: Atlas"}));
 }finally{f.dispose();}
});

test("removed history destinations are explained without recreation and later Back stays usable",async()=>{
 const {DesktopShell}=await import("../src/renderer/components/DesktopShell.js");const user=userEvent.setup({document});
 function Harness(){const [id,setId]=React.useState("one"),[removed,setRemoved]=React.useState(false);return <DesktopShell language="en" busy={false} locked={false} data={{workspaces:[{workspaceId:"one",name:"One"},...removed?[]:[{workspaceId:"two",name:"Two"}]],activeWorkspace:{workspaceId:id,sourceId:id,viewId:id,name:id,canonicalRoot:"/fixture",sourceAvailable:true}}} onActivate={async next=>{setId(next);return true;}} renderPanels={()=>({general:null,appearance:null,workspaces:null,sources:null,backup:null,about:null})}><p>Current {id}</p><button type="button" onClick={()=>setRemoved(true)}>Remove visited workspace</button></DesktopShell>;}
 try{
  render(<Harness/>);await user.click(screen.getByRole("button",{name:"Two"}));await user.click(screen.getByRole("button",{name:"One"}));
  await user.click(screen.getByRole("button",{name:"Remove visited workspace"}));await user.click(screen.getByRole("button",{name:"Back"}));
  assert.ok(screen.getByRole("status").textContent?.includes("no longer available"));assert.ok(screen.getByText("Current one"));assert.equal(screen.queryByRole("button",{name:"Two"}),null);
  await user.click(screen.getByRole("button",{name:"Back"}));
  await waitFor(()=>assert.equal((screen.getByRole("button",{name:"Back"}) as HTMLButtonElement).disabled,true));
  assert.equal((screen.getByRole("button",{name:"Settings"}) as HTMLButtonElement).disabled,false);
 }finally{cleanup();}
});

test("non-editor row click previews and close returns focus to the project's preview button",async()=>{
 const f=fixture(),user=userEvent.setup({document});
 try{
  render(<DiscoveryWorkspace client={f.client} workspaceId={f.workspace.workspaceId} sourceId={f.workspace.sourceId} language="en" disabled={false}/>);
  await user.click(await screen.findByRole("cell",{name:"Atlas"}));await screen.findByRole("region",{name:"Project: Atlas"});
  await user.click(screen.getByRole("button",{name:"Close preview"}));
  await waitFor(()=>assert.equal(document.activeElement===screen.getByRole("button",{name:"Preview project: Atlas"}),true));
 }finally{f.dispose();}
});
