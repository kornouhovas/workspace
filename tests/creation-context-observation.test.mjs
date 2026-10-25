import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {_electron} from 'playwright-core';
import {closeElectron} from '../scripts/runtime-lifecycle.mjs';
import {enterContextFor} from '../scripts/runtime-context-tools.mjs';
import {installCreationContextObservation,collectCreationContextObservation} from '../scripts/creation-context-observation.mjs';

test('passive creation entry diagnosis records source/panel changes without commands and disposes bounded evidence',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'creation-context-observation-'));
 const app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile}});
 const child=app.process();let failure;
 try{
  const page=await app.firstWindow(),url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url,{waitUntil:'load'});page.setDefaultTimeout(500);
  await page.setContent('<button id="entry" class="context-tools-trigger" aria-expanded="false">Project actions</button><section hidden data-context-return="entry"><button aria-label="Reveal folder: Created">Reveal</button></section>');
  await page.evaluate(()=>{
   globalThis.listeners=new Set();globalThis.commands=0;globalThis.opens=0;
   globalThis.window.workspace={onWorkspaceChange(listener){globalThis.listeners.add(listener);return()=>globalThis.listeners.delete(listener);},workspace(){globalThis.commands++;throw new Error('No command is permitted');}};
   const entry=globalThis.document.querySelector('#entry'),panel=globalThis.document.querySelector('section');
   entry.onclick=()=>{globalThis.opens++;entry.setAttribute('aria-expanded','true');panel.hidden=false;
    for(const listener of globalThis.listeners)listener({sourceId:'fixture',type:'workspace.sourceObserved',observationRevision:1});
    queueMicrotask(()=>{panel.hidden=true;entry.setAttribute('aria-expanded','false');});};
  });
  await page.context().tracing.start({screenshots:true,snapshots:true,sources:false});
  await installCreationContextObservation(page,{label:'Reveal folder: Created',sourceId:'fixture'});
  await assert.rejects(enterContextFor(page,page.getByRole('button',{name:'Reveal folder: Created',exact:true,includeHidden:true})),/Timeout/);
  const trace=join(profile,'entry-trace.zip');await page.context().tracing.stop({path:trace});assert.ok((await stat(trace)).size>0);
  const transitions=await collectCreationContextObservation(page);
  assert.ok(transitions.events.some(event=>event.state.visible));assert.equal(transitions.final.visible,false);
  assert.ok(transitions.events.some(event=>event.reason==='workspace'));
  await installCreationContextObservation(page,{label:'Reveal folder: Created',sourceId:'fixture'});
  await page.evaluate(()=>{for(let i=0;i<120;i++)for(const listener of globalThis.listeners)listener({sourceId:'fixture',type:'workspace.sourceObserved',observationRevision:i+2});});
  const result=await collectCreationContextObservation(page);
  assert.equal(result.diagnostic,true);assert.equal(result.final.visible,false);assert.equal(result.events.length,96);assert.ok(result.dropped>0);
  assert.ok(result.events.some(event=>event.reason==='workspace'));assert.equal(result.final.owners[0].hidden,true);
  assert.deepEqual(await page.evaluate(()=>({commands:globalThis.commands,opens:globalThis.opens,listeners:globalThis.listeners.size})),{commands:0,opens:1,listeners:0});
 }catch(error){failure=error;}
 try{await closeElectron(app);}catch(error){failure??=error;}
 if(child.exitCode!==null||child.signalCode!==null)await rm(profile,{recursive:true,force:true});
 if(failure)throw failure;
});
