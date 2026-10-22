import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { Window } from 'happy-dom';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TextPropertiesTable } from '../src/renderer/components/TextPropertiesTable.js';
import { WorkspaceServiceClient } from '../src/renderer/workspace-service-client.js';
import type { WorkspaceDesktopApi } from '../src/contracts/desktop-api.js';
import { translate } from '../src/renderer/localization.js';
const browser = new Window();
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Node:browser.Node,MutationObserver:browser.MutationObserver,CustomEvent:browser.CustomEvent,Element:browser.Element,NodeFilter:browser.NodeFilter,HTMLInputElement:browser.HTMLInputElement,ResizeObserver:browser.ResizeObserver,requestAnimationFrame:browser.requestAnimationFrame.bind(browser),cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser),getComputedStyle:browser.getComputedStyle.bind(browser)});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:browser.navigator});
const {render,screen,cleanup,waitFor}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
// @ts-expect-error Built service has no declarations.
const {openSettingsService}=await import('../dist/service/settings.mjs');
for(const language of ['en','ru'] as const) for(const surface of ['table','board','detail'] as const) test(`${language} ${surface}: contextual create, rename, cancel and current reviewed removal preserve shared data`,async()=>{
 const directory=mkdtempSync(join(tmpdir(),'property-management-')),root=join(directory,'root');mkdirSync(root);mkdirSync(join(root,'Atlas'));
 const service=openSettingsService(join(directory,'app.sqlite'));
 const workspace=service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value;
 const workspaceId=workspace.workspaceId;
 const sibling=service.handleCommand({type:'workspace.create',rootPath:root,name:'Sibling'}).value;
 const command=(type:string,fields={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
 const query=(type:string,fields={})=>service.handleQuery({type:`workspace.${type}`,workspaceId,...fields});
 const projects=command('applyDiscovery',{previewToken:query('previewDiscovery').value.previewToken}).value.projects;
 const client=new WorkspaceServiceClient({workspace:async(input:{type:string})=>input.type.startsWith('workspace.list')||input.type.startsWith('workspace.preview')?service.handleQuery(input):service.handleCommand(input),onWorkspaceChange:(listener:unknown)=>service.workspaces.subscribe(listener)} as unknown as WorkspaceDesktopApi);
 const t=(key:Parameters<typeof translate>[1])=>translate(language,key),user=userEvent.setup();
 try{
  render(<TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={workspace.sourceId} projects={projects} language={language} layout={surface==='board'?'board':'table'} detail={surface==='detail'} disabled={false} hideReveal/>);
  if(surface==='board')await user.click(screen.getByRole('button',{name:t('propertyTools')}));
  const add=await screen.findByRole('button',{name:t('addProperty')});await waitFor(()=>assert.equal(add.hasAttribute('disabled'),false));
  await user.click(add);await user.type(screen.getByRole('textbox',{name:t('propertyName')}),'Notes');
  await user.click(screen.getByRole('button',{name:t('savePropertyName')}));
  await waitFor(()=>assert.equal(query('listTextProperties').value.definitions.length,1));
  const propertyId=query('listTextProperties').value.definitions[0].propertyId;
  command('setTextValue',{propertyId,projectId:projects[0].projectId,value:'Keep exact text'});
  const rename=await screen.findByRole('button',{name:`${t('renameProperty')}: Notes`});await user.click(rename);
  assert.equal(screen.queryByRole('combobox',{name:t('propertyType')}),null,'Existing type is immutable');
  const input=screen.getByRole('textbox',{name:t('propertyName')});await user.clear(input);await user.type(input,'Draft');await user.keyboard('{Escape}');
  await waitFor(()=>assert.ok(document.activeElement === rename));assert.equal(query('listTextProperties').value.definitions[0].name,'Notes');
  await user.click(rename);await user.clear(screen.getByRole('textbox',{name:t('propertyName')}));await user.type(screen.getByRole('textbox',{name:t('propertyName')}),'Research{Enter}');
  await waitFor(()=>assert.equal(service.handleQuery({type:'workspace.listTextProperties',workspaceId:sibling.workspaceId}).value.definitions[0].name,'Research'));
  const trigger=await screen.findByRole('button',{name:`${t('renameProperty')}: Research`});await user.click(trigger);
  await user.click(screen.getByRole('button',{name:t('metadataDeleteProperty')}));await screen.findByText('Keep exact text',{selector:'li'});
  await user.click(screen.getByRole('button',{name:t('metadataCancel')}));assert.equal(query('listTextProperties').value.definitions.length,1);
  await user.click(screen.getByRole('button',{name:t('metadataDeleteProperty')}));await screen.findByText('Keep exact text',{selector:'li'});
  command('setTextValue',{propertyId,projectId:projects[0].projectId,value:'New usage'});
  await user.click(screen.getByRole('button',{name:t('metadataConfirm')}));await screen.findByText(t('metadataStale'));assert.equal(query('listTextProperties').value.definitions.length,1);
  await user.click(screen.getByRole('button',{name:t('metadataReview')}));await screen.findByText('New usage',{selector:'li'});
  await user.click(screen.getByRole('button',{name:t('metadataConfirm')}));await waitFor(()=>assert.equal(query('listTextProperties').value.definitions.length,0));
  await waitFor(()=>assert.ok(document.activeElement === add));
 }finally{cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
});
for(const type of ['single_select','multi_select'] as const)test(`${type}: remove an ordinary option from its value editor, cancel or reassign only reviewed usages`,async()=>{
 const directory=mkdtempSync(join(tmpdir(),'option-removal-')),root=join(directory,'root');mkdirSync(root);mkdirSync(join(root,'Atlas'));
 const service=openSettingsService(join(directory,'app.sqlite'));
 const workspace=service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value,workspaceId=workspace.workspaceId;
 const command=(type:string,fields={})=>service.handleCommand({type:`workspace.${type}`,workspaceId,...fields});
 const query=(type:string,fields={})=>service.handleQuery({type:`workspace.${type}`,workspaceId,...fields});
 const projects=command('applyDiscovery',{previewToken:query('previewDiscovery').value.previewToken}).value.projects;
 const propertyId=command('createProperty',{name:'Status',propertyType:type}).value.propertyId;
 for(const name of ['Old','Next'])command('createSelectOption',{propertyId,name,color:'blue'});
 const options=query('listTextProperties').value.selectOptions;
 command(type==='single_select'?'setSelectValue':'setMultiSelectValue',{propertyId,projectId:projects[0].projectId,...(type==='single_select'?{optionId:options[0].optionId}:{optionIds:[options[0].optionId]})});
 const client=new WorkspaceServiceClient({workspace:async(input:{type:string})=>input.type.startsWith('workspace.list')||input.type.startsWith('workspace.preview')?service.handleQuery(input):service.handleCommand(input),onWorkspaceChange:(listener:unknown)=>service.workspaces.subscribe(listener)} as unknown as WorkspaceDesktopApi);
 const user=userEvent.setup();
 try{
  render(<TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={workspace.sourceId} projects={projects} language="en" disabled={false} hideReveal/>);
  await user.click(await screen.findByRole('button',{name:`Edit ${type==='single_select'?'Single Select':'MultiSelect'} value: Atlas / Status`}));
  await user.click(screen.getByText('Select options: Status'));
  const remove=screen.getByRole('button',{name:'Delete option: Old'});await user.click(remove);
  await screen.findByRole('heading',{name:'Affected project values (1)'});
  await user.keyboard('{Escape}');await waitFor(()=>assert.ok(document.activeElement === remove));assert.equal(query('listTextProperties').value.selectOptions.length,2);
  await user.click(remove);await screen.findByRole('heading',{name:'Affected project values (1)'});
  await user.selectOptions(screen.getByRole('combobox',{name:'Values and references'}),options[1].optionId);
  assert.equal(screen.getByRole('button',{name:'Confirm deletion'}).hasAttribute('disabled'),true);
  await user.click(screen.getByRole('button',{name:'Review usages'}));await screen.findByRole('heading',{name:'Affected project values (1)'});
  await user.click(screen.getByRole('button',{name:'Confirm deletion'}));
  await waitFor(()=>assert.equal(query('listTextProperties').value.selectOptions.length,1));
  const values=query('listTextProperties').value[type==='single_select'?'selectValues':'multiSelectValues'];assert.equal(values[0].optionId,options[1].optionId);
  await screen.findByRole('button',{name:'Delete option: Next'});
 }finally{cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
});

for(const operation of ['Hide option: Old','Move option down: Old'])for(const dismissal of ['cancel','escape'])test(`${operation} failure allows ${dismissal} without another mutation`,async()=>{
 const property={propertyId:'p',sourceId:'s',name:'Status',propertyType:'single_select' as const};
 const snapshot={workspaceId:'w',sourceId:'s',revision:1,definitions:[property],values:[],selectOptions:['Old','Next'].map((name,index)=>({optionId:name,propertyId:'p',name,color:'blue' as const,hidden:false,position:index}))};
 let mutations=0;
 const client=new WorkspaceServiceClient({workspace:async(input:{type:string})=>{
  if(input.type==='workspace.listTextProperties')return {ok:true,value:snapshot};
  mutations++;return {ok:false,error:{code:'storage',message:'Unavailable'}};
 },onWorkspaceChange:()=>()=>{}} as unknown as WorkspaceDesktopApi);
 const user=userEvent.setup();
 try{
  render(<TextPropertiesTable client={client} workspaceId="w" sourceId="s" projects={[]} language="en" disabled={false}/>);
  const trigger=await screen.findByRole('button',{name:'Rename property: Status'});await user.click(trigger);
  await user.click(screen.getByText('Select options: Status'));await user.click(screen.getByRole('button',{name:operation}));await screen.findByRole('alert');
  if(dismissal==='cancel')await user.click(screen.getByRole('button',{name:'Cancel'}));else await user.keyboard('{Escape}');
  await waitFor(()=>assert.ok(!screen.queryByRole('dialog')));await waitFor(()=>assert.ok(document.activeElement===trigger));assert.equal(mutations,1);
 }finally{cleanup();}
});

test('early deletion notification with a delayed Apply reply returns focus to Details while its background Table remains mounted',async()=>{
 const {within}=await import('@testing-library/react');
 const directory=mkdtempSync(join(tmpdir(),'property-return-')),root=join(directory,'root');mkdirSync(root);mkdirSync(join(root,'Atlas'));
 const service=openSettingsService(join(directory,'app.sqlite'));
 const workspace=service.handleCommand({type:'workspace.create',rootPath:root,name:'One'}).value,workspaceId=workspace.workspaceId;
 const preview=service.handleQuery({type:'workspace.previewDiscovery',workspaceId}).value;
 const projects=service.handleCommand({type:'workspace.applyDiscovery',workspaceId,previewToken:preview.previewToken}).value.projects;
 service.handleCommand({type:'workspace.createProperty',workspaceId,name:'Notes',propertyType:'text'});
 let release:(()=>void)|undefined;
 const client=new WorkspaceServiceClient({workspace:async(input:{type:string})=>{
  const result=input.type.startsWith('workspace.list')||input.type.startsWith('workspace.preview')?service.handleQuery(input):service.handleCommand(input);
  if(input.type==='workspace.applyMetadataRemoval')await new Promise<void>(resolve=>{release=resolve;});
  return result;
 },onWorkspaceChange:(listener:unknown)=>service.workspaces.subscribe(listener)} as unknown as WorkspaceDesktopApi);
 const user=userEvent.setup(),props={client,workspaceId,sourceId:workspace.sourceId,projects,language:'en' as const,disabled:false,hideReveal:true};
 try{
  render(<><div data-testid="background"><TextPropertiesTable {...props}/></div><div data-testid="details"><TextPropertiesTable {...props} detail/></div></>);
  const details=within(screen.getByTestId('details')),background=within(screen.getByTestId('background'));
  const add=await details.findByRole('button',{name:'Add property'});assert.ok(await background.findByRole('button',{name:'Add property'}));
  await user.click(await details.findByRole('button',{name:'Rename property: Notes'}));
  await user.click(screen.getByRole('button',{name:'Delete property'}));await screen.findByText('No stored values are affected.');
  await user.click(screen.getByRole('button',{name:'Confirm deletion'}));
  await waitFor(()=>assert.equal(service.handleQuery({type:'workspace.listTextProperties',workspaceId}).value.definitions.length,0));
  await waitFor(()=>assert.ok(document.activeElement===add));release!();
  await waitFor(()=>assert.ok(!screen.queryByRole('dialog')));assert.ok(document.activeElement===add);
 }finally{release?.();cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
});

for(const moved of [false,true])test(`creator ${moved?'preserves a newer user focus choice':'returns focus'} after a newer source read temporarily disables its initiating control`,async()=>{
 const property={propertyId:'p',sourceId:'22222222-2222-4222-8222-222222222222',name:'Notes',propertyType:'text' as const};
 const initial={workspaceId:'11111111-1111-4111-8111-111111111111',sourceId:'22222222-2222-4222-8222-222222222222',revision:0,definitions:[],values:[]};
 const saved={...initial,revision:1,definitions:[property]};
 const newer={...saved,revision:2};
 const listeners=new Set<(event:unknown)=>void>();
 let save:((value:unknown)=>void)|undefined,read:((value:unknown)=>void)|undefined,lists=0;
 const client=new WorkspaceServiceClient({workspace:async(input:{type:string})=>{
  if(input.type==='workspace.listTextProperties')return ++lists===1?{ok:true,value:initial}:new Promise(resolve=>{read=resolve;});
  return new Promise(resolve=>{save=resolve;});
 },onWorkspaceChange:(listener:(event:unknown)=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};}} as unknown as WorkspaceDesktopApi);
 const user=userEvent.setup();
 try{
  render(<><textarea aria-label="Other draft"/><TextPropertiesTable client={client} workspaceId="11111111-1111-4111-8111-111111111111" sourceId="22222222-2222-4222-8222-222222222222" projects={[]} language="en" disabled={false}/></>);
  const add=await screen.findByRole('button',{name:'Add property'});await waitFor(()=>assert.ok(!add.hasAttribute('disabled')));await user.click(add);
  await user.type(screen.getByRole('textbox',{name:'Property name'}),'Notes{Enter}');
  for(const notify of listeners)notify({type:'workspace.propertiesChanged',sourceId:'22222222-2222-4222-8222-222222222222',workspaceIds:['11111111-1111-4111-8111-111111111111'],revision:2});
  await waitFor(()=>assert.equal(lists,2));save!({ok:true,value:{propertyId:'p',projectId:null,snapshot:saved}});
  await waitFor(()=>assert.ok(!screen.queryByRole('dialog')));
  await new Promise<void>(resolve=>window.requestAnimationFrame(()=>resolve()));
  assert.ok(add.hasAttribute('disabled'));
  const other=screen.getByRole('textbox',{name:'Other draft'});if(moved)await user.click(other);
  read!({ok:true,value:newer});await waitFor(()=>assert.ok(!add.hasAttribute('disabled')));
  await waitFor(()=>assert.ok(document.activeElement===(moved?other:add)));
 }finally{cleanup();}
});
