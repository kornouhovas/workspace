/* global document */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron} from 'playwright-core';
import {closeElectron,cleanupOwnedFixture} from '../scripts/runtime-lifecycle.mjs';
import {measureDiscoveryLayout,measureRuntimeWorkspaceSettings} from '../scripts/runtime-layout.mjs';
import {waitForSelectedRuntimeWorkspace,setRuntimeCaptureViewport,openSettingsSection,returnToWorkspace,showRuntimeSourceRoot,dismissRuntimeTools} from '../scripts/runtime-settings.mjs';

test('workspace readiness uses the visible exact selected identity when the old title is hidden',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'workspace-identity-'));
 let app,child,failure,stopped=false,cleanup;
 try{
  app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile},timeout:10000});
  child=app.process();
  const page=await app.firstWindow();const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url,{waitUntil:'load'});
  await page.setContent('<h2 id="workspace-title" hidden>Target</h2><div class="sidebar-workspace-row"><button data-workspace-id="other" aria-current="page">Target</button></div><div class="sidebar-workspace-row"><button data-workspace-id="target">Target</button></div><button id="finish">Finish navigation</button>');
  await page.locator('#finish').evaluate(button=>{button.onclick=()=>{document.querySelector('[data-workspace-id="other"]').removeAttribute('aria-current');document.querySelector('[data-workspace-id="target"]').setAttribute('aria-current','page');};});
  let finished=false;const ready=waitForSelectedRuntimeWorkspace(page,{workspaceId:'target',name:'Target'}).then(()=>{finished=true;});
  await page.waitForTimeout(50);assert.equal(finished,false,'A same-name sibling does not establish the selected identity');
  await page.getByRole('button',{name:'Finish navigation',exact:true}).click();await ready;
  assert.equal(await page.locator('[data-workspace-id="target"]').isVisible(),true);
  assert.equal(await page.locator('#workspace-title').isVisible(),false);
  await page.setContent(`<style>.panel{margin-left:220px} .collapsed .panel{margin-left:0}</style><div class="desktop-shell"><button id="collapse" aria-label="Collapse sidebar" aria-expanded="true"></button><div class="panel"><button>Create folder</button></div></div>`);
  await page.locator('#collapse').evaluate(button=>{button.onclick=()=>{const collapsed=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',collapsed?'Restore sidebar':'Collapse sidebar');document.querySelector('.desktop-shell').classList.toggle('collapsed',collapsed);};});
  await setRuntimeCaptureViewport(page,{width:420,height:800});
  assert.equal(await page.getByRole('button',{name:'Restore sidebar',exact:true}).isVisible(),true);
  assert.equal(await page.locator('.panel').evaluate(node=>node.getBoundingClientRect().left),8);
  await page.locator('.desktop-shell').evaluate(shell=>{const sidebar=document.createElement('div');sidebar.className='settings-sidebar';sidebar.innerHTML='<button>Back to workspace</button><button>Settings</button><button role="tab">General</button>';shell.append(sidebar);const style=document.createElement('style');style.textContent='.collapsed .settings-sidebar{display:none}';document.head.append(style);sidebar.querySelectorAll('button').forEach(button=>{button.onclick=()=>{shell.setAttribute('data-last-action',button.textContent);};});});
  await returnToWorkspace(page);
  assert.equal(await page.locator('.desktop-shell').getAttribute('data-last-action'),'Back to workspace');
  await setRuntimeCaptureViewport(page,{width:420,height:800});
  await openSettingsSection(page);
  assert.equal(await page.locator('.desktop-shell').getAttribute('data-last-action'),'General');
  await setRuntimeCaptureViewport(page,{width:1024,height:720});
  assert.equal(await page.getByRole('button',{name:'Collapse sidebar',exact:true}).getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('.panel').evaluate(node=>node.getBoundingClientRect().left),228);
 }catch(error){failure=error;}
 try{if(app){await closeElectron(app);stopped=child.exitCode!==null||child.signalCode!==null;assert.equal(stopped,true);}}catch(error){failure??=error;}
 try{await cleanupOwnedFixture(profile,{processesStopped:stopped,primaryFailure:failure,record:result=>{cleanup=result;}});}catch(error){failure??=error;}
 if(failure)throw failure;
 assert.equal(cleanup.status,'passed');
});


test('source-root readiness and stress capture preserve localized context ownership with a duplicate retained settings path',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'workspace-source-root-'));
 let app,child,failure,stopped=false,cleanup;
 try{
  app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile},timeout:10000});
  child=app.process();const page=await app.firstWindow();page.setDefaultTimeout(5000);
  const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url,{waitUntil:'load'});
  for(const language of ['en','ru']){
   const sourceLabel=language==='en'?'Source tools':'Инструменты источника';
   const backLabel=language==='en'?'Back to workspace':'Вернуться к работе';
   const collapseLabel=language==='en'?'Collapse sidebar':'Свернуть боковую панель',restoreLabel=language==='en'?'Restore sidebar':'Восстановить боковую панель';
   const exact='/Projects/Exact root — 日本語';
   await page.setViewportSize({width:1024,height:720});
   await page.setContent(`<style>.source-popup{position:fixed;right:12px;top:0;width:300px;height:300px;background:white;z-index:20}@media(max-width:600px){.source-popup{left:0;right:auto}}</style><main class="workspace-screen" hidden><button id="collapse" aria-label="${collapseLabel}" aria-expanded="true">Sidebar</button><button id="source-tools" class="context-tools-trigger" aria-label="${sourceLabel}" aria-expanded="false">${sourceLabel}</button><div class="source-popup" role="dialog" aria-label="${sourceLabel}" data-context-return="source-tools" hidden><p class="workspace-root">${exact}</p></div></main><section role="tabpanel"><p class="workspace-root">${exact}</p><button id="back">${backLabel}</button></section>`);
   await page.locator('#source-tools').evaluate(button=>{button.onclick=()=>{const panel=document.querySelector('[role="dialog"]');panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));};});
   await page.locator('#back').evaluate(button=>{button.onclick=()=>{document.querySelector('main').hidden=false;document.querySelector('[role="tabpanel"]').hidden=true;};});
   await page.locator('#collapse').evaluate((button,labels)=>{button.onclick=()=>{const collapsed=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',collapsed?labels.restore:labels.collapse);};},{collapse:collapseLabel,restore:restoreLabel});
   await page.evaluate(()=>{document.onpointerdown=event=>{const panel=document.querySelector('[role="dialog"]'),trigger=document.querySelector('#source-tools');if(!panel.contains(event.target) && !trigger.contains(event.target)){panel.hidden=true;trigger.setAttribute('aria-expanded','false');}};});
   assert.equal(await page.getByText(exact,{exact:true}).count(),2);
   const root=await showRuntimeSourceRoot(page,exact);
   assert.equal(await root.textContent(),exact);assert.equal(await root.isVisible(),true);
   assert.equal(await page.locator('#source-tools').getAttribute('aria-expanded'),'true');
   assert.equal(await page.getByRole('tabpanel',{includeHidden:true}).isVisible(),false);
   await setRuntimeCaptureViewport(page,{width:420,height:800});
   assert.equal(await page.locator('#collapse').getAttribute('aria-expanded'),'false');
   assert.equal(await root.isVisible(),true,'Preparing narrow capture retains the open source context');
   await setRuntimeCaptureViewport(page,{width:1024,height:720});
   assert.equal(await page.locator('#collapse').getAttribute('aria-expanded'),'true');
   assert.equal(await root.textContent(),exact);
   await page.evaluate(()=>{const button=document.createElement('button');button.id='property-tools';button.className='context-tools-trigger';button.setAttribute('aria-expanded','true');button.textContent='Properties';button.onclick=()=>button.setAttribute('aria-expanded','false');document.body.append(button);});
   assert.equal(await page.locator('.context-tools-trigger[aria-expanded="true"]').count(),2);
   await dismissRuntimeTools(page);
   assert.equal(await page.locator('.context-tools-trigger[aria-expanded="true"]').count(),0);
  }
 }catch(error){failure=error;}
 try{if(app){await closeElectron(app);stopped=child.exitCode!==null||child.signalCode!==null;assert.equal(stopped,true);}}catch(error){failure??=error;}
 try{await cleanupOwnedFixture(profile,{processesStopped:stopped,primaryFailure:failure,record:result=>{cleanup=result;}});}catch(error){failure??=error;}
 if(failure)throw failure;
 assert.equal(cleanup.status,'passed');
});


test('native layout measurement retains operation overflow and supported-window toolbar checks during below-minimum stress',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'workspace-layout-boundary-'));
 let app,child,failure,stopped=false,cleanup;
 try{
  app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile},timeout:10000});
  child=app.process();const page=await app.firstWindow();page.setDefaultTimeout(5000);
  const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url,{waitUntil:'load'});
  await page.setContent('<div class="table-view"><div class="daily-controls"><div class="workspace-form-actions" style="width:80px"><span style="display:block;width:200px">Daily toolbar</span></div></div><div class="discovery-panel"><div id="operation" class="workspace-form-actions" style="width:80px"><span style="display:block;width:200px">Recovery operation</span></div></div></div>');
  await page.setViewportSize({width:420,height:800});
  assert.deepEqual((await measureDiscoveryLayout(page)).elements,['workspace-form-actions'],'Operation overflow remains a failure below the supported minimum');
  await page.setViewportSize({width:1024,height:720});
  assert.deepEqual((await measureDiscoveryLayout(page)).elements,['workspace-form-actions','workspace-form-actions'],'Both daily and operation overflow fail at supported windows');
  await page.locator('#operation').evaluate(element=>element.remove());
  await page.setViewportSize({width:420,height:800});
  assert.deepEqual((await measureDiscoveryLayout(page)).elements,[]);
  await page.setViewportSize({width:1440,height:960});
  assert.deepEqual((await measureDiscoveryLayout(page)).elements,['workspace-form-actions']);
  for(const language of ['en','ru']){
   const label=language==='en'?'Workspaces':'Рабочие пространства';
   await page.setContent(`<main class="workspace-screen" style="visibility:hidden" inert><h2 id="workspace-title" style="width:1px;white-space:nowrap;overflow:hidden">${'Long retained workspace title '.repeat(20)}</h2></main><section role="tabpanel" aria-label="${label}" style="width:300px"><p class="workspace-root">Exact current source</p><div class="workspace-management__row">Current workspace</div></section>`);
   assert.deepEqual(await measureRuntimeWorkspaceSettings(page,language),{document:false,elements:[]});
   await page.getByRole('tabpanel',{name:label,exact:true}).locator('.workspace-root').evaluate(element=>{element.style.width='80px';element.innerHTML='<span style="display:block;width:200px">Overflowing visible settings path</span>';});
   assert.deepEqual((await measureRuntimeWorkspaceSettings(page,language)).elements,['workspace-root'],'Visible settings path overflow must still fail');
  }
 }catch(error){failure=error;}
 try{if(app){await closeElectron(app);stopped=child.exitCode!==null||child.signalCode!==null;assert.equal(stopped,true);}}catch(error){failure??=error;}
 try{await cleanupOwnedFixture(profile,{processesStopped:stopped,primaryFailure:failure,record:result=>{cleanup=result;}});}catch(error){failure??=error;}
 if(failure)throw failure;
 assert.equal(cleanup.status,'passed');
});
