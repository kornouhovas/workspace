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
import {waitForSelectedRuntimeWorkspace,setRuntimeCaptureViewport,openSettingsSection,returnToWorkspace} from '../scripts/runtime-settings.mjs';

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
