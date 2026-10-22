/* global document, requestAnimationFrame, innerWidth, innerHeight */
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
import {prepareRuntimeControlScroll} from '../scripts/runtime-control-scroll.mjs';

// Real browser geometry and input; no DOM dimension or animation-frame mocks.
const renderer=`
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useViewScroll} from './src/renderer/components/useViewScroll.ts';
const positions=new Map([
 ['one',{top:300,left:0,children:[{top:0,left:120}]}],
 ['two',{top:80,left:0,children:[{top:0,left:40}]}],
]);
function App(){
 const [view,setView]=useState('one'),[busy,setBusy]=useState(true),[short,setShort]=useState(false),[expanded,setExpanded]=useState(false);
 const scroll=useViewScroll(view,expanded,positions);
 return <><button onClick={()=>{setBusy(true);scroll.resume();}}>Restore saved position</button>
 <button onClick={()=>setBusy(false)}>Finish projection</button>
 <button onClick={()=>setView(current=>current==='one'?'two':'one')}>Switch view</button>
 <button onClick={()=>{setShort(true);setBusy(false);}}>Short projection</button>
 <button onClick={()=>setExpanded(current=>!current)}>Expand or return</button>
 <output>{view}</output><div id="view" tabIndex={0} ref={scroll.element} hidden={expanded} onScrollCapture={scroll.save}
 onWheelCapture={scroll.cancelRestore} onPointerDownCapture={scroll.cancelRestore} onKeyDownCapture={scroll.cancelRestore}
 style={{height:200,width:320,overflow:'auto',border:'1px solid'}}>
 <div aria-busy={busy} style={{height:short?80:1200}}>
 <div className="project-table-scroll" style={{width:280,height:100,overflow:'auto'}}>
 <div style={{width:short?100:900,height:80}}>Native project fields</div></div>
 <input aria-label="Retained editor" defaultValue="Keep this draft"/>
 </div></div></>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;

test('native scroll restoration retains coordinates, cancels for user input and view changes, and clamps a shorter projection',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'workspace-scroll-native-'));
 let app,child,failure,stopped=false,cleanup;
 try{
  const bundle=await build({stdin:{contents:renderer,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
  app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile},timeout:10000});
  child=app.process();
  const page=await app.firstWindow();const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url,{waitUntil:'load'});
  await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  const owner=page.locator('#view');
  const coordinates=()=>owner.evaluate(node=>[node.scrollTop,node.querySelector('.project-table-scroll').scrollLeft]);
  const complete=()=>page.waitForFunction(()=>!document.querySelector('#view').dataset.scrollRestoring);
  const frames=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await page.getByRole('button',{name:'Finish projection',exact:true}).click();await complete();
  assert.deepEqual(await coordinates(),[300,120]);
  await page.getByRole('button',{name:'Expand or return',exact:true}).click();assert.equal(await owner.isVisible(),false);
  await page.getByRole('button',{name:'Expand or return',exact:true}).click();await complete();assert.deepEqual(await coordinates(),[300,120]);
  // A pending projection keeps restoration active while real wheel input owns
  // the new position. Later geometry notifications must not snap it back.
  await page.getByRole('button',{name:'Restore saved position',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#view').dataset.scrollRestoring==='true');
  await owner.hover();await page.mouse.wheel(0,100);await page.waitForFunction(()=>document.querySelector('#view').scrollTop===400);
  await frames();const interrupted=await coordinates();assert.equal(await owner.getAttribute('data-scroll-restoring'),null);
  await page.getByRole('button',{name:'Finish projection',exact:true}).click();await complete();await frames();assert.deepEqual(await coordinates(),interrupted);
  await page.getByRole('button',{name:'Restore saved position',exact:true}).click();
  await page.getByRole('textbox',{name:'Retained editor',exact:true}).click();
  await frames();const pointerPosition=await coordinates();assert.equal(await owner.getAttribute('data-scroll-restoring'),null);
  await page.getByRole('button',{name:'Finish projection',exact:true}).click();await complete();await frames();assert.deepEqual(await coordinates(),pointerPosition);
  await page.getByRole('button',{name:'Restore saved position',exact:true}).click();
  await page.getByRole('button',{name:'Switch view',exact:true}).click();
  await page.getByRole('button',{name:'Finish projection',exact:true}).click();await complete();await frames();assert.deepEqual(await coordinates(),[80,40]);
  const editor=page.getByRole('textbox',{name:'Retained editor',exact:true});await editor.fill('Keep the edited draft');
  await page.getByRole('button',{name:'Restore saved position',exact:true}).click();await owner.focus();await owner.press('End');
  await page.waitForFunction(()=>{const node=document.querySelector('#view');return node.scrollTop===node.scrollHeight-node.clientHeight;});
  await frames();const keyboardPosition=await coordinates();assert.equal(await owner.getAttribute('data-scroll-restoring'),null);
  await page.getByRole('button',{name:'Finish projection',exact:true}).click();await complete();await frames();
  assert.deepEqual(await coordinates(),keyboardPosition);assert.equal(await editor.inputValue(),'Keep the edited draft');
  await page.getByRole('button',{name:'Restore saved position',exact:true}).click();
  await page.getByRole('button',{name:'Short projection',exact:true}).click();await complete();await frames();assert.deepEqual(await coordinates(),[0,0]);
 }catch(error){failure=error;}
 try{if(app){await closeElectron(app);stopped=child.exitCode!==null||child.signalCode!==null;assert.equal(stopped,true);}}catch(error){failure??=error;}
 try{await cleanupOwnedFixture(profile,{processesStopped:stopped,primaryFailure:failure,record:result=>{cleanup=result;}});}catch(error){failure??=error;}
 if(failure)throw failure;
 assert.equal(cleanup.status,'passed');
});

// Keep the existing coordinate/clamping fixture unchanged. This loading-history
// scenario adds a focused source control and an offscreen project action.
const intentRenderer=renderer
 .replace("const [view,setView]", "const [clicks,setClicks]=useState(0); const [view,setView]")
 .replace('<output>{view}</output><div id="view"', '<output>{view}</output><output id="clicks">{clicks}</output><div className="saved-view-content" id="view"')
 .replace('<div aria-busy={busy} style={{height:short?80:1200}}>', '<div aria-busy={busy} style={{height:short?80:1200}}><button id="source" onClick={()=>setClicks(value=>value+1)}>Source tools</button>')
 .replace('Native project fields</div>', 'Native project fields<button id="target" style={{marginLeft:800}} onClick={()=>setClicks(value=>value+1)}>Project actions</button></div>');

test('native loading-history control inspection keeps keyboard scroll intent through later restoration notifications',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'workspace-scroll-intent-'));
 let app,child,failure,stopped=false,cleanup;
 try{
  const bundle=await build({stdin:{contents:intentRenderer,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
  app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile},timeout:10000});
  child=app.process();const page=await app.firstWindow();
  const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url,{waitUntil:'load'});
  await page.setViewportSize({width:420,height:800});
  await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  const owner=page.locator('#view'),source=page.locator('#source'),target=page.locator('#target');
  await page.waitForFunction(()=>document.querySelector('#view')?.dataset.scrollRestoring==='true');
  await source.focus();
  await prepareRuntimeControlScroll(page,target);
  const reachable=()=>withDeadline(target.evaluate(async node=>{
   // Deliver the real hook's pending mutation/resize restoration after the
   // scroll, matching the host-dependent ordering observed in the story.
   const owner=node.closest('.saved-view-content');owner.setAttribute('style',owner.getAttribute('style'));
   node.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
   await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
   const rect=node.getBoundingClientRect();return rect.left>=0 && rect.right<=innerWidth && rect.top>=0 && rect.bottom<=innerHeight;
  }),15000,'Native loading-history control bounds');
  assert.equal(await reachable(),true,'Pending restoration must not undo ordinary keyboard scroll intent');
  assert.equal(await owner.getAttribute('data-scroll-restoring'),null);
  assert.equal(await source.evaluate(node=>node===document.activeElement),true,'Preparation preserves the focused source control');
  assert.equal(await page.locator('#clicks').textContent(),'0','Arrow navigation activates no command');
  assert.equal(await owner.locator('[aria-busy]').getAttribute('aria-busy'),'true','Loading fixture is not completed to make the measurement pass');
  await target.evaluate(node=>{node.style.position='fixed';node.style.left='500px';node.style.marginLeft='0';});
  assert.equal(await reachable(),false,'The original predicate still rejects a truly unreachable control');
 }catch(error){failure=error;}
 try{if(app){await closeElectron(app);stopped=child.exitCode!==null||child.signalCode!==null;assert.equal(stopped,true);}}catch(error){failure??=error;}
 try{await cleanupOwnedFixture(profile,{processesStopped:stopped,primaryFailure:failure,record:result=>{cleanup=result;}});}catch(error){failure??=error;}
 if(failure)throw failure;
 assert.equal(cleanup.status,'passed');
});
