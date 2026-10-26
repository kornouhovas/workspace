import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { FolderRolesPanel } from "../src/renderer/components/FolderRolesPanel.js";
import type { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
const browser=new Window({url:"http://localhost"});
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Node:browser.Node,Element:browser.Element,MutationObserver:browser.MutationObserver});
Object.defineProperty(globalThis,"navigator",{configurable:true,value:browser.navigator});
const {render,screen,cleanup,waitFor}=await import("@testing-library/react");
const {default:userEvent}=await import("@testing-library/user-event");
test.afterEach(()=>cleanup());
for (const language of ["en","ru"] as const) test(`${language}: roles require shared-impact review and confirmation; explicit expansion never applies`, async()=>{
  const calls:unknown[]=[],applied:unknown[]=[];
  const client={onWorkspaceChange:()=>()=>{},listProjects:async()=>({ok:true,value:{categories:[]}}),getFolderChildren:async(_id:string,path:string)=>({ok:true,value:{sourceId:"source",canonicalRoot:"/Root",mode:"grouped",revision:1,state:"ready",folderRoles:[],excludedRelativePaths:[],affectedWorkspaces:[{workspaceId:"one",name:"First"},{workspaceId:"two",name:"Second"}],children:path ? [{relativePath:"Work/App",name:"App",role:"project",reason:null}]:[{relativePath:"Work",name:"Work",role:"status",reason:null}]}}),previewDiscovery:async(...args:unknown[])=>{calls.push(args);return {ok:true,value:{previewToken:"review",state:"ready",affectedWorkspaces:[{workspaceId:"one",name:"First"},{workspaceId:"two",name:"Second"}],projectEffects:{added:[],retained:[],noLongerRecognized:[{projectId:"old",relativePath:"Work",name:"Work",categoryId:null}],alreadyRetained:[]}}};},applyDiscovery:async(...args:unknown[])=>{applied.push(args);return {ok:true,value:{}};}} as unknown as WorkspaceServiceClient;
  const user=userEvent.setup({document:browser.document as unknown as Document});
  render(<FolderRolesPanel client={client} workspaceId="one" language={language} disabled={false} invalidation={0} onCommitted={()=>{}} onPendingChange={()=>{}}/>);
  await user.click(await screen.findByRole("button",{name:`${language==="en"?"Expand":"Раскрыть"}: Work`}));
  assert.ok(await screen.findByRole("combobox",{name:`${language==="en"?"Role":"Роль"}: Work/App`}));
  assert.equal(applied.length,0);
  await user.selectOptions(screen.getByRole("combobox",{name:`${language==="en"?"Role":"Роль"}: Work`}),"group");
  await user.click(screen.getByRole("button",{name:language==="en"?"Review changes":"Проверить изменения"}));
  const apply=await screen.findByRole("button",{name:language==="en"?"Apply folder configuration":"Применить настройку папок"});
  assert.ok(screen.getByText("Second"));assert.equal((apply as HTMLButtonElement).disabled,true);
  await user.click(screen.getByRole("checkbox",{name:language==="en"?"I reviewed the shared impact":"Я проверил влияние на общие данные"}));
  await user.click(apply);await waitFor(()=>assert.equal(applied.length,1));
  assert.deepEqual(applied[0],["one","review"]);assert.equal(calls.length,1);
});

test('a delayed impact response cannot revive a review after source invalidation',async()=>{
  let finish!: (value:unknown)=>void;
  const delayed=new Promise(resolve=>{finish=resolve;});
  const client={onWorkspaceChange:()=>()=>{},listProjects:async()=>({ok:true,value:{categories:[]}}),getFolderChildren:async()=>({ok:true,value:{sourceId:'source',canonicalRoot:'/Root',mode:'grouped',revision:1,state:'ready',folderRoles:[],excludedRelativePaths:[],affectedWorkspaces:[],children:[{relativePath:'Work',name:'Work',role:'status',reason:null}]}}),previewDiscovery:()=>delayed} as unknown as WorkspaceServiceClient;
  const user=userEvent.setup({document:browser.document as unknown as Document});
  const props={client,workspaceId:'one',language:'en' as const,disabled:false,onCommitted:()=>{},onPendingChange:()=>{}};
  const mounted=render(<FolderRolesPanel {...props} invalidation={0}/>);
  const role=await screen.findByRole('combobox',{name:'Role: Work'});
  await user.selectOptions(role,'group');await user.click(screen.getByRole('button',{name:'Review changes'}));
  mounted.rerender(<FolderRolesPanel {...props} invalidation={1}/>);
  finish({ok:true,value:{previewToken:'stale',state:'ready',affectedWorkspaces:[],projectEffects:{added:[],retained:[],noLongerRecognized:[],alreadyRetained:[]}}});
  await waitFor(()=>assert.equal((screen.getByRole('button',{name:'Review changes'}) as HTMLButtonElement).disabled,false));
  assert.equal(screen.queryByRole('button',{name:'Apply folder configuration'}),null);
  await user.click(screen.getByRole('button',{name:'Cancel'}));
  await waitFor(()=>assert.equal((role as HTMLSelectElement).value,'status'));
  await waitFor(()=>assert.equal(document.activeElement===role,true));
});

test('an unavailable folder still exposes its saved role overrides without enabling Apply',async()=>{
  const client={onWorkspaceChange:()=>()=>{},listProjects:async()=>({ok:true,value:{categories:[]}}),getFolderChildren:async()=>({ok:true,value:{sourceId:'source',canonicalRoot:'/Offline',mode:'grouped',revision:1,state:'unavailable',folderRoles:[{relativePath:'Work/Urgent',role:'status'}],excludedRelativePaths:[],affectedWorkspaces:[],children:[]}})} as unknown as WorkspaceServiceClient;
  render(<FolderRolesPanel client={client} workspaceId="one" language="en" disabled={false} invalidation={0} onCommitted={()=>{}} onPendingChange={()=>{}}/>);
  assert.ok(await screen.findByText('Work/Urgent'));
  assert.equal((screen.getByRole('button',{name:'Review changes'}) as HTMLButtonElement).disabled,true);
});
