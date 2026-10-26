import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {_electron} from 'playwright-core';
import {closeElectron} from '../scripts/runtime-lifecycle.mjs';

test('real status editor retains keyboard recovery and Escape after rejected and transport-failed saves',async()=>{
 const bundle=await build({bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
  import React from 'react';import {createRoot} from 'react-dom/client';
  import {StatusColorEditor} from './src/renderer/components/StatusColorEditor.tsx';
  import {ContextTools} from './src/renderer/components/ContextTools.tsx';
  globalThis.colorWrites=0;
  const client={setCategoryColor:()=>{globalThis.colorWrites++;return new Promise((resolve,reject)=>{globalThis.failColorSave=()=>globalThis.transportFailure?reject(new Error('Disconnected')):resolve({ok:false,error:{code:'storage'}});});},listCategoryPresentation:async()=>({ok:true,value:{workspaceId:'one',options:[{categoryId:'status',color:'default'}]}})};
  createRoot(document.getElementById('root')).render(<ContextTools label="Status actions: Work"><StatusColorEditor client={client} workspaceId="one" category={{categoryId:'status',relativePath:'Work'}} language="en" disabled={false}/></ContextTools>);
 `}});
 const profile=await mkdtemp(join(tmpdir(),'status-color-focus-'));let app;
 try{
  app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile},timeout:10000});
  const page=await app.firstWindow();page.setDefaultTimeout(3000);await page.waitForURL(await app.evaluate(()=>globalThis.renameEditorInitialLoad));
  for(const transportFailure of [false,true]){
   await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});await page.evaluate(value=>{globalThis.transportFailure=value;},transportFailure);
   const trigger=page.getByRole('button',{name:'Status actions: Work',exact:true});await trigger.press('Enter');
   const editor=page.getByRole('combobox',{name:'Status color: Work',exact:true});await editor.focus();await editor.selectOption('red');
   assert.equal(await editor.isDisabled(),true);await page.evaluate(()=>globalThis.failColorSave());
   const retry=page.getByRole('button',{name:'Refresh',exact:true});await retry.and(page.locator(':focus')).waitFor();assert.equal(await editor.isDisabled(),true);
   await retry.press('Escape');await trigger.and(page.locator(':focus')).waitFor();await trigger.press('Enter');
   await retry.press('Enter');await editor.and(page.locator(':focus:enabled')).waitFor();assert.equal(await editor.inputValue(),'default');
   assert.equal(await page.evaluate(()=>globalThis.colorWrites),1);await editor.press('Escape');await trigger.and(page.locator(':focus')).waitFor();
  }
 }finally{if(app)await closeElectron(app);await rm(profile,{recursive:true,force:true});}
});
