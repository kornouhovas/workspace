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
import {removeChosenOption} from '../scripts/selection-editor-driver.mjs';

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
