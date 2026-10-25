import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {Window} from 'happy-dom';
import {ProjectCreationPanel} from '../src/renderer/components/ProjectCreationPanel.js';
import {ProjectCategoryMovePanel} from '../src/renderer/components/ProjectCategoryMovePanel.js';
import {WorkspaceServiceClient} from '../src/renderer/workspace-service-client.js';
import type {ProjectList} from '../src/contracts/workspaces.js';
import {translate} from '../src/renderer/localization.js';
const browser=new Window({url:'http://localhost'});
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,CustomEvent:browser.CustomEvent,Node:browser.Node,MutationObserver:browser.MutationObserver,Element:browser.Element,NodeFilter:browser.NodeFilter,getComputedStyle:browser.getComputedStyle.bind(browser)});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:browser.navigator});
const {render,screen,cleanup,waitFor}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
test.afterEach(cleanup);
const list:ProjectList={workspaceId:'workspace',sourceId:'source',revision:1,configured:true,mode:'grouped',state:'ready',projects:[{projectId:'project',name:'App',relativePath:'Clients/Team/App',categoryId:null,categoryName:null,associationState:'active',resolution:'active'}],categories:[],categoryProperty:null,categoryPropertyRevision:0,retainedProjects:[],retainedCount:0,
 projectParents:[{relativePath:'',role:'group'},{relativePath:'Clients/Team',role:'group'},{relativePath:'Work/Urgent',role:'status'}]};
class Client extends WorkspaceServiceClient {
 creates:Parameters<WorkspaceServiceClient['createProject']>[0][]=[]; moves:Parameters<WorkspaceServiceClient['moveProjectCategory']>[0][]=[];
 override onBackendStatus(){return ()=>{};}
 override async listProjectCreations(){return {ok:true as const,value:{workspaceId:'workspace',sourceId:'source',operations:[]}};}
 override async listProjectCategoryMoves(){return {ok:true as const,value:{workspaceId:'workspace',sourceId:'source',operations:[]}};}
 override async createProject(input:Parameters<WorkspaceServiceClient['createProject']>[0]){this.creates.push(input);return {ok:true as const,value:{outcome:'rejected' as const,operation:null,problem:'occupied' as const}};}
 override async moveProjectCategory(input:Parameters<WorkspaceServiceClient['moveProjectCategory']>[0]){this.moves.push(input);return {ok:true as const,value:{outcome:'rejected' as const,operation:null,problem:'occupied' as const}};}
}
for(const language of ['en','ru'] as const){
 const t=(key:Parameters<typeof translate>[1])=>translate(language,key);
 test(`${language}: creation explicitly selects a Group path`,async()=>{
  const client=new Client();render(<ProjectCreationPanel client={client} workspaceId="workspace" sourceId="source" language={language} projects={list} disabled={false} invalidation={0} minimumRevision={{current:1}} observationVersion={{current:0}} onCompleted={()=>{}}/>);
  await userEvent.click(screen.getByRole('button',{name:t('createProject')}));
  await userEvent.type(screen.getByRole('textbox'),'Created');
  await userEvent.selectOptions(screen.getByRole('combobox'),'Clients/Team');
  await userEvent.click(screen.getByRole('button',{name:t('creationSubmit')}));
  await waitFor(()=>assert.equal(client.creates.length,1));assert.equal(client.creates[0].mode,'grouped');assert.equal('parentRelativePath' in client.creates[0]&&client.creates[0].parentRelativePath,'Clients/Team');
 });
 test(`${language}: no-status move explicitly selects root`,async()=>{
  const client=new Client();render(<ProjectCategoryMovePanel client={client} workspaceId="workspace" sourceId="source" language={language} projects={list} project={list.projects[0]} disabled={false} minimumRevision={{current:1}} observationVersion={{current:0}} sourceLifetime={{current:0}} onClose={()=>{}} onCompleted={()=>{}} onBlockedChange={()=>{}}/>);
  await userEvent.selectOptions(screen.getByRole('combobox'),'');
  await userEvent.click(screen.getByRole('button',{name:t('moveCategorySubmit')}));
  await waitFor(()=>assert.equal(client.moves.length,1));assert.equal(client.moves[0].parentRelativePath,'');
 });
}

for(const language of ['en','ru'] as const) test(`${language}: status editor shows physical paths and explains disabled destinations, preserving explicit parent move editor`,async()=>{
 const client=new Client(),t=(key:Parameters<typeof translate>[1])=>translate(language,key);
 const projects:ProjectList={...list,categories:[{categoryId:'clients',name:'Active',relativePath:'Clients/Active'},{categoryId:'personal',name:'Active',relativePath:'Personal/Active'},{categoryId:'nested',name:'Urgent',relativePath:'Work/Urgent',statusMoveUnavailable:'nested_status'}]};
 render(<ProjectCategoryMovePanel statusOnly client={client} workspaceId="workspace" sourceId="source" language={language} projects={projects} project={projects.projects[0]} disabled={false} minimumRevision={{current:1}} observationVersion={{current:0}} sourceLifetime={{current:0}} onClose={()=>{}} onCompleted={()=>{}} onBlockedChange={()=>{}}/>);
 const select=screen.getByRole('combobox') as HTMLSelectElement;
 assert.equal((screen.getByRole('option',{name:/Clients\/Active/}) as HTMLOptionElement).value,'clients');
 assert.equal((screen.getByRole('option',{name:/Personal\/Active/}) as HTMLOptionElement).value,'personal');
 assert.equal((screen.getByRole('option',{name:/Work\/Urgent/}) as HTMLOptionElement).disabled,true);
 assert.equal((screen.getByRole('option',{name:new RegExp(language==='en'?'No status':'Без статуса')}) as HTMLOptionElement).disabled,true);
 assert.ok(screen.getByText(language==='en'?'A status inside another status cannot receive projects. Its projects remain visible.':'Статус внутри другого статуса недоступен для перемещения. Его проекты остаются видимыми.'));
 assert.equal((screen.getByRole('button',{name:t('moveCategorySubmit')}) as HTMLButtonElement).disabled,true);
 await userEvent.selectOptions(select,'personal');await userEvent.keyboard('{Enter}');
 await waitFor(()=>assert.equal(client.moves.length,1));assert.equal(client.moves[0].destinationCategoryId,'personal');assert.equal(client.moves[0].parentRelativePath,undefined);
});

for(const language of ['en','ru'] as const) test(`${language}: Cancel dismisses an unsubmitted status choice without issuing a move`,async()=>{
 const client=new Client(),t=(key:Parameters<typeof translate>[1])=>translate(language,key);let closed=0;
 const projects:ProjectList={...list,categories:[{categoryId:'personal',name:'Active',relativePath:'Personal/Active'}]};
 render(<ProjectCategoryMovePanel statusOnly client={client} workspaceId="workspace" sourceId="source" language={language} projects={projects} project={projects.projects[0]} disabled={false} minimumRevision={{current:1}} observationVersion={{current:0}} sourceLifetime={{current:0}} onClose={()=>closed++} onCompleted={()=>{}} onBlockedChange={()=>{}}/>);
 await userEvent.selectOptions(screen.getByRole('combobox'),'personal');await userEvent.click(screen.getByRole('button',{name:t('cancelRenameWorkspace')}));assert.equal(closed,1);assert.equal(client.moves.length,0);
});
