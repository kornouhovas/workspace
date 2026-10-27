/* global document */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {_electron} from 'playwright-core';
import {closeElectron,cleanupOwnedFixture,withDeadline} from '../scripts/runtime-lifecycle.mjs';
import {openRuntimeViewActions} from '../scripts/runtime-view-actions.mjs';
import {dismissCreationMenu} from '../scripts/runtime-menu-transition.mjs';

const renderer=language=>`
import React,{useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {ViewsPanel} from './src/renderer/components/ViewsPanel.tsx';
import {ContextTools} from './src/renderer/components/ContextTools.tsx';
import {WorkspaceServiceClient} from './src/renderer/workspace-service-client.ts';
const language=${JSON.stringify(language)},commands=[];
const client=new class extends WorkspaceServiceClient{
 onWorkspaceChange(){return()=>{};}
 async listViews(workspaceId){return {ok:true,value:{workspaceId,views:[{viewId:'table',name:'Table',kind:'table'},{viewId:'review',name:'Review',kind:'board'}],activeViewId:'review'}};}
 async changeView(command){commands.push(command);throw new Error('No saved mutation is authorized in this fixture');}
};
function App(){
 const grouping=useRef(null);
 // Deliver a delayed focus return after the native menu has mounted. The real
 // browser cannot focus this button once its owning tools surface is hidden.
 window.deliverGroupingFocus=()=>grouping.current?.focus();window.viewActionCommands=commands;
 return <><ContextTools label={language==='en'?'View settings':'Настройки представления'}><button ref={grouping}>{language==='en'?'Grouping':'Группировка'}</button></ContextTools>
 <ViewsPanel client={client} workspaceId="workspace" language={language} disabled={false} onChange={()=>{}}/></>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;

test('view actions dismiss the actual owning tools before a delayed grouping focus return in EN/RU',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'workspace-view-actions-'));
 let app,child,failure,stopped=false,cleanup;
 try{
  app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile},timeout:10000});
  child=app.process();const page=await app.firstWindow();page.setDefaultTimeout(1000);
  const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url,{waitUntil:'load'});
  for(const language of ['en','ru']){
   const bundle=await build({stdin:{contents:renderer(language),loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
   await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
   const settings=page.getByRole('button',{name:language==='en'?'View settings':'Настройки представления',exact:true});
   const grouping=page.getByRole('button',{name:language==='en'?'Grouping':'Группировка',exact:true});
   await settings.press('Enter');await grouping.focus();
   const actions=page.getByRole('button',{name:/^(View actions|Действия с представлением): Review$/});
   await openRuntimeViewActions(page,actions);
   const duplicate=page.getByRole('menuitem',{name:language==='en'?'Duplicate view':'Дублировать представление',exact:true});
   await duplicate.waitFor();await duplicate.focus();
   await withDeadline(page.evaluate(()=>globalThis.deliverGroupingFocus()),15000,'Controlled grouping focus return');
   await duplicate.press('Enter');
   const input=page.getByRole('textbox',{name:language==='en'?'View name':'Название представления',exact:true});
   await input.waitFor();assert.equal(await input.inputValue(),'Review');
   assert.equal(await settings.getAttribute('aria-expanded'),'false');
   assert.equal(await input.evaluate(node=>node===document.activeElement),true,'The actual draft owns focus');
   assert.deepEqual(await page.evaluate(()=>globalThis.viewActionCommands),[],'Entering a duplicate draft saves no view');
   await input.press('Escape');await input.waitFor({state:'detached'});
   await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-haspopup')==='menu');
   assert.equal(await actions.evaluate(node=>node===document.activeElement),true);
   assert.deepEqual(await page.evaluate(()=>globalThis.viewActionCommands),[],'Cancel cannot create or delete a view');
  }
 }catch(error){failure=error;}
 try{if(app){await closeElectron(app);stopped=child.exitCode!==null||child.signalCode!==null;assert.equal(stopped,true);}}catch(error){failure??=error;}
 try{await cleanupOwnedFixture(profile,{processesStopped:stopped,primaryFailure:failure,record:result=>{cleanup=result;}});}catch(error){failure??=error;}
 if(failure)throw failure;
 assert.equal(cleanup.status,'passed');
});


test('a deferred creation-menu focus return cannot steal focus from the next actions menu',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'workspace-view-menu-return-'));
 let app,child,failure,stopped=false,cleanup;
 try {
  app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile},timeout:10000});
  child=app.process();const page=await app.firstWindow();page.setDefaultTimeout(3000);
  const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url,{waitUntil:'load'});
  const bundle=await build({stdin:{contents:renderer('en'),loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
  await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  const create=page.getByRole('button',{name:'New view',exact:true});
  const actions=page.getByRole('button',{name:/^View actions: Review$/});
  await create.focus();await create.press('Enter');await page.getByRole('menuitem',{name:'Board'}).waitFor();
  await create.evaluate(node=>{const original=node.focus.bind(node);node.focus=(...args)=>{globalThis.deferredReturnScheduled=true;setTimeout(()=>{original(...args);globalThis.deferredReturnFinished=true;},600);};});
  await dismissCreationMenu(page,create);
  await page.waitForFunction(()=>globalThis.deferredReturnScheduled===true);
  await openRuntimeViewActions(page,actions);await page.getByRole('menuitem',{name:'Duplicate view'}).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>globalThis.deferredReturnFinished===true);
  await actions.and(page.locator(':focus')).waitFor();
  assert.equal(await actions.evaluate(node=>node===document.activeElement),true,'The subsequent menu trigger owns final focus');
 } catch(error){failure=error;}
 try{if(app){await closeElectron(app);stopped=child.exitCode!==null||child.signalCode!==null;assert.equal(stopped,true);}}catch(error){failure??=error;}
 try{await cleanupOwnedFixture(profile,{processesStopped:stopped,primaryFailure:failure,record:result=>{cleanup=result;}});}catch(error){failure??=error;}
 if(failure)throw failure;
 assert.equal(cleanup.status,'passed');
});
