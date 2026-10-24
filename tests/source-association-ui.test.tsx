import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { SourceAssociationPanel } from "../src/renderer/components/SourceAssociationPanel.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import type { SourceAssociationPreview } from "../src/contracts/source-association.js";
const browser=new Window({url:"http://localhost"});
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Node:browser.Node,Element:browser.Element,MutationObserver:browser.MutationObserver});
Object.defineProperty(globalThis,"navigator",{configurable:true,value:browser.navigator});
const {render,screen,cleanup,waitFor}=await import("@testing-library/react");
const {default:userEvent}=await import("@testing-library/user-event");
test.afterEach(()=>cleanup());
for(const language of ["en","ru"] as const) test(`${language}: selecting mappings requires a fresh impact preview and explicit confirmation; Cancel never applies`,async()=>{
 const calls:unknown[]=[], applied:unknown[]=[];
 const preview:SourceAssociationPreview={workspaceId:"workspace",sourceId:"source",canonicalRoot:"/Source",reason:"review_required",targets:[{kind:"project",relativePath:"Authored name"}],candidates:[{kind:"project",id:"project",relativePath:"Authored name",savedPath:"Authored name",eligible:true,selected:false,reason:"review_required"}],mappings:[],retainedCount:1,pendingOperations:0,previewToken:"root-review"};
 const client={cancelSourceAssociation:async()=>({ok:true,value:{canceled:true}}),previewSourceAssociation:async(_workspace:string,mappings:unknown[])=>{calls.push(mappings);return{ok:true,value:{...preview,previewToken:mappings.length?"selected-review":"root-review",retainedCount:1-mappings.length}};},applySourceAssociation:async(...args:unknown[])=>{applied.push(args);return{ok:true,value:{sourceId:"source",generation:1}};}} as unknown as WorkspaceServiceClient;
 const user=userEvent.setup({document:browser.document as unknown as Document});
 render(<SourceAssociationPanel client={client} workspaceId="workspace" language={language}/>);
 await user.click(screen.getByRole("button",{name:language==="en"?"Review folder association":"Проверить связь с папкой"}));
 const apply=await screen.findByRole("button",{name:language==="en"?"Confirm association":"Подтвердить связь"});
 assert.equal((apply as HTMLButtonElement).disabled,true);
 const [mapping,confirm]=screen.getAllByRole("checkbox") as HTMLInputElement[];
 assert.equal(mapping.checked,false);await user.click(mapping);assert.equal(confirm.disabled,true);
 await user.click(screen.getByRole("button",{name:language==="en"?"Preview selected mappings":"Предпросмотр выбранных связей"}));
 await waitFor(()=>assert.equal(confirm.disabled,false));await user.click(confirm);await user.click(apply);
 await waitFor(()=>assert.equal(applied.length,1));assert.deepEqual(applied[0],["workspace","selected-review"]);
 assert.equal(calls.length,2);
 await user.click(screen.getByRole("button",{name:language==="en"?"Review folder association":"Проверить связь с папкой"}));
 await user.click(await screen.findByRole("button",{name:language==="en"?"Cancel":"Отмена"}));assert.equal(applied.length,1);
});

for(const language of ["en","ru"] as const)test(`${language}: archived mapping stays in its own designated archive and requires explicit selection`,async()=>{
 const preview:SourceAssociationPreview={workspaceId:"workspace",sourceId:"source",canonicalRoot:"/Source",reason:"review_required",targets:[
  {kind:"project",relativePath:"Cold/Archive/Project",archivedProjectId:"archived"},{kind:"project",relativePath:"Other"},{kind:"project",relativePath:"Cold/Archive/Other",archivedProjectId:"another"}],
  candidates:[{kind:"project",id:"archived",relativePath:"Cold/Archive/Project",savedPath:"Project",archived:true,eligible:true,selected:false,reason:"review_required"}],mappings:[],retainedCount:1,pendingOperations:0,previewToken:"review"};
 const client={previewSourceAssociation:async()=>({ok:true,value:preview}),cancelSourceAssociation:async()=>({ok:true,value:{canceled:true}})} as unknown as WorkspaceServiceClient;
 const user=userEvent.setup({document:browser.document as unknown as Document});render(<SourceAssociationPanel client={client} workspaceId="workspace" language={language}/>);
 await user.click(screen.getByRole("button",{name:language==="en"?"Review folder association":"Проверить связь с папкой"}));
 assert.ok(await screen.findByText(language==="en"?"Archived project. It stays archived; its original location is preserved.":"Архивный проект останется в архиве; исходное расположение сохранится."));
 assert.deepEqual(screen.getAllByRole("option").map(option=>option.textContent),["Cold/Archive/Project"]);
 assert.equal((screen.getByRole("combobox") as HTMLSelectElement).disabled,true);assert.equal((screen.getAllByRole("checkbox")[0] as HTMLInputElement).checked,false);
});

for(const language of ["en","ru"] as const)test(`${language}: retained archive parent mapping preserves its role and fixed original route`,async()=>{
 const preview:SourceAssociationPreview={workspaceId:"workspace",sourceId:"source",canonicalRoot:"/Source",reason:"scope_unverified",targets:[{kind:"category",relativePath:"Category",archivedParentCategoryId:"parent"},{kind:"category",relativePath:"Other"}],candidates:[{kind:"category",id:"parent",relativePath:"Category",savedPath:"Category",archivedParent:true,eligible:true,selected:false,reason:"scope_unverified"}],mappings:[],retainedCount:1,pendingOperations:0,previewToken:"review"};
 const client={previewSourceAssociation:async()=>({ok:true,value:preview}),cancelSourceAssociation:async()=>({ok:true,value:{canceled:true}})} as unknown as WorkspaceServiceClient;
 const user=userEvent.setup({document:browser.document as unknown as Document});render(<SourceAssociationPanel client={client} workspaceId="workspace" language={language}/>);
 await user.click(screen.getByRole("button",{name:language==="en"?"Review folder association":"Проверить связь с папкой"}));
 assert.ok(await screen.findByText(language==="en"?"Original category of an archived project. Association preserves its inactive state; review the source mode separately.":"Исходная категория архивного проекта. Привязка сохранит её неактивное состояние; режим источника проверяется отдельно."));
 assert.equal((screen.getByRole("combobox") as HTMLSelectElement).disabled,true);assert.deepEqual(screen.getAllByRole("option").map(option=>option.textContent),["Category"]);
 assert.equal((screen.getAllByRole("checkbox")[0] as HTMLInputElement).checked,false);
});
