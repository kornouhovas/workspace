/* global document */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron} from 'playwright-core';
import {closeElectron} from '../scripts/runtime-lifecycle.mjs';
import {closeBoardLayout} from '../scripts/board-layout-driver.mjs';
import {removeChosenOption, waitForSelectionFocus} from '../scripts/selection-editor-driver.mjs';

test('one removal gesture completes when a chosen hidden checkbox disappears during that gesture',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'selection-driver-'));
 const app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile}});
 const child=app.process();let failure;
 try{
  const page=await app.firstWindow();const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url);
  await page.setContent('<label><input type="checkbox" checked>Chosen hidden option</label><output id="saved">Selected</output>');
  await page.evaluate(()=>{document.querySelector('input').addEventListener('change',event=>{document.querySelector('output').textContent=event.target.checked?'Selected':'Empty';event.target.remove();});});
  const choice=page.getByRole('checkbox',{name:'Chosen hidden option'});
  // Diagnostic fixture bound only; the product smoke retains its 15-second deadline.
  page.setDefaultTimeout(1000);assert.equal(await choice.isChecked(),true);
  await removeChosenOption(choice);
  assert.equal(await page.locator('output').textContent(),'Empty');assert.equal(await choice.count(),0);
 }catch(error){failure=error;}
 try{await closeElectron(app);}catch(error){if(failure)failure.cleanupFailure=error.message;else failure=error;}
 if(child.exitCode!==null||child.signalCode!==null)await rm(profile,{recursive:true,force:true});
 if(failure)throw failure;
});


test('Board layout closure waits for nested focus return before the next editor owns input',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'board-close-driver-'));
 const app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile}});
 const child=app.process();let failure;
 try{
  const page=await app.firstWindow();const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url);
  await page.setContent('<button id="parent" aria-label="View settings" aria-expanded="true">Settings</button><button id="layout" aria-label="Board layout" aria-expanded="true">Layout</button><div role="dialog" aria-label="Board layout"><button id="wrap">Wrap</button></div><button id="edit">Edit notes</button>');
  await page.evaluate(()=>{
   document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const panel=document.querySelector('[role="dialog"]');
    if(panel){panel.remove();document.querySelector('#layout').setAttribute('aria-expanded','false');setTimeout(()=>document.querySelector('#layout').focus(),50);}
    else if(event.target===document.querySelector('#layout')){document.querySelector('#parent').setAttribute('aria-expanded','false');document.querySelector('#parent').focus();}
   });
   document.querySelector('#edit').addEventListener('click',()=>{const editor=document.createElement('textarea');editor.value='Exact notes';editor.addEventListener('blur',()=>editor.remove());document.body.append(editor);editor.focus();});
   document.querySelector('#wrap').focus();
  });
  page.setDefaultTimeout(1000);await closeBoardLayout(page,'Board layout');
  await page.getByRole('button',{name:'Edit notes'}).click();
  await page.waitForFunction(()=>document.activeElement?.tagName==='TEXTAREA'&&document.querySelector('#parent').getAttribute('aria-expanded')==='false');
  assert.equal(await page.getByRole('textbox').inputValue(),'Exact notes');
 }catch(error){failure=error;}
 try{await closeElectron(app);}catch(error){if(failure)failure.cleanupFailure=error.message;else failure=error;}
 if(child.exitCode!==null||child.signalCode!==null)await rm(profile,{recursive:true,force:true});
 if(failure)throw failure;
});


test('selection dismissal waits for asynchronous focus return to its exact trigger',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'selection-focus-driver-'));
 const app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile}});
 const child=app.process();let failure;
 try{
  const page=await app.firstWindow();const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url);
  const label='Edit MultiSelect value: Project / Status';
  await page.setContent('<button aria-label="'+label+'">Ready</button><div role="group"><input type="checkbox"></div>');
  await page.evaluate(()=>{document.querySelector('input').focus();document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('[role="group"]').remove();setTimeout(()=>document.querySelector('button').focus(),50);}});});
  page.setDefaultTimeout(1000);await page.keyboard.press('Escape');await page.getByRole('group').waitFor({state:'hidden'});
  await waitForSelectionFocus(page,label);
  assert.equal(await page.getByRole('button',{name:label,exact:true}).evaluate(element=>element===document.activeElement),true);
 }catch(error){failure=error;}
 try{await closeElectron(app);}catch(error){if(failure)failure.cleanupFailure=error.message;else failure=error;}
 if(child.exitCode!==null||child.signalCode!==null)await rm(profile,{recursive:true,force:true});
 if(failure)throw failure;
});

for(const language of ['en','ru'])test(`${language} grouping closure completes its delayed focus return before the next selection opens`,async()=>{
 const {closeGroupingForSelection}=await import('../scripts/selection-editor-driver.mjs');
 const profile=await mkdtemp(join(tmpdir(),'grouping-close-driver-'));
 const app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile}});
 const child=app.process();let failure;
 try{
  const page=await app.firstWindow();const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url);page.setDefaultTimeout(1000);
  const label=language==='en'?'Grouping':'Группировка',parentLabel=language==='en'?'View settings':'Настройки представления';
  await page.setContent(`<button id="parent" aria-label="${parentLabel}" aria-expanded="true">Settings</button><button id="grouping" aria-label="${label}" aria-expanded="true">Grouping</button><div role="region" aria-label="${label}"><button id="inside">Group by</button></div><button id="edit">Edit selection</button>`,{waitUntil:'domcontentloaded',timeout:15000});
  await page.evaluate(()=>{
   document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const panel=document.querySelector('[role="region"]');
    if(panel){panel.remove();document.querySelector('#grouping').setAttribute('aria-expanded','false');setTimeout(()=>document.querySelector('#grouping').focus(),100);}
    else if(event.target===document.querySelector('#grouping')){document.querySelector('#parent').setAttribute('aria-expanded','false');document.querySelector('#parent').focus();}
   });
   document.querySelector('#edit').addEventListener('click',()=>{const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label','A');input.addEventListener('blur',()=>input.remove());document.body.append(input);input.focus();});document.querySelector('#inside').focus();
  });
  await closeGroupingForSelection(page,language);
  assert.equal(await page.locator('#parent').getAttribute('aria-expanded'),'false');
  await page.getByRole('button',{name:'Edit selection'}).click();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='A');
  assert.equal(await page.getByRole('checkbox',{name:'A'}).count(),1);
 }catch(error){failure=error;}
 try{await closeElectron(app);}catch(error){failure??=error;}
 if(child.exitCode!==null||child.signalCode!==null)await rm(profile,{recursive:true,force:true});
 if(failure)throw failure;
});

test('closing a selection finishes delayed focus return before reopening the same value editor',async()=>{
 const {closeSelectionEditor}=await import('../scripts/selection-editor-driver.mjs');
 const profile=await mkdtemp(join(tmpdir(),'selection-reopen-driver-'));
 const app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile}});
 const child=app.process();let failure;
 try{
  const page=await app.firstWindow();const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url);
  const label='Edit MultiSelect value: Project / Status';
  await page.setContent(`<button id="trigger" aria-label="${label}">Value</button><div role="group" aria-label="${label}"><button id="close">Close</button></div>`,{waitUntil:'domcontentloaded',timeout:15000});
  await page.evaluate(()=>{
   const trigger=document.querySelector('#trigger');
   globalThis.selectionCloseReturned=false;
   document.querySelector('#close').addEventListener('click',()=>{
    document.querySelector('[role="group"]').remove();
    setTimeout(()=>{trigger.focus();globalThis.selectionCloseReturned=true;},100);
   });
   trigger.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    const group=document.createElement('div');group.setAttribute('role','group');group.setAttribute('aria-label',trigger.getAttribute('aria-label'));
    const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label','Second');group.append(input);document.body.append(group);
    input.addEventListener('blur',()=>group.remove());input.focus();
   });
   document.querySelector('#close').focus();
  });
  page.setDefaultTimeout(1000);
  await closeSelectionEditor(page,{label,closeLabel:'Close'});
  await page.locator('#trigger').press('Enter');
  await page.waitForFunction(()=>globalThis.selectionCloseReturned);
  assert.equal(await page.getByRole('group',{name:label,exact:true}).count(),1);
  assert.equal(await page.getByRole('checkbox',{name:'Second',exact:true}).evaluate(input=>document.activeElement===input),true);
 }catch(error){failure=error;}
 try{await closeElectron(app);}catch(error){failure??=error;}
 if(child.exitCode!==null||child.signalCode!==null)await rm(profile,{recursive:true,force:true});
 if(failure)throw failure;
});
