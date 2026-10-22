/* global document */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {_electron} from 'playwright-core';
import {closeElectron,cleanupOwnedFixture,withDeadline} from '../scripts/runtime-lifecycle.mjs';

const renderer=`
import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CategoryPropertyHeader} from './src/renderer/components/CategoryPropertyHeader.tsx';
function App(){
 const [language,setLanguage]=useState('en'),[width,setWidth]=useState(120),[property,setProperty]=useState({name:'  Exact категория 日本語  ',revision:1}),[saves,setSaves]=useState([]);
 const minimum=useRef(1);
 const [client]=useState(()=>{let revision=1;return {async renameCategoryProperty(workspaceId,propertyId,name){
  setSaves(values=>[...values,name]);return {ok:true,value:{workspaceId,sourceId:'source',propertyId,name,revision:++revision}};
 }};});
 return <><button onClick={()=>setLanguage('en')}>English</button><button onClick={()=>setLanguage('ru')}>Russian</button>
 <button onClick={()=>setWidth(120)}>Minimum column</button><button onClick={()=>setWidth(180)}>Wider column</button>
 <output id="saves">{JSON.stringify(saves)}</output>
 <table className="project-table" style={{width,minWidth:width}}><thead><tr><th style={{width}}>
 <CategoryPropertyHeader client={client} workspaceId="workspace" sourceId="source" property={{propertyId:'category',sourceId:'source',name:property.name}}
 revision={property.revision} minimumRevision={minimum} onCommitted={value=>{minimum.current=value.revision;setProperty(value);}}
 language={language} disabled={false}/></th></tr></thead></table></>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;

test('native category label editing fits legal narrow Table columns and retains keyboard cancel, exact save and focus',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'workspace-category-header-native-'));
 let app,child,failure,stopped=false,cleanup;
 try{
  const assets=join(process.cwd(),'dist/renderer/assets');
  const cssFile=(await readdir(assets)).find(name=>name.endsWith('.css'));
  assert.ok(cssFile,'Build the actual production renderer before the native check');
  let css=await readFile(join(assets,cssFile),'utf8');
  for(const match of [...css.matchAll(/url\(([^)]+\.woff2)\)/g)]){
   const name=match[1].replace(/["']/g,'');
   css=css.replaceAll(match[0],`url(data:font/woff2;base64,${(await readFile(join(assets,name))).toString('base64')})`);
  }
  const bundle=await build({stdin:{contents:renderer,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
  app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[fileURLToPath(new URL('./fixtures/rename-editor-readiness-electron.cjs',import.meta.url))],env:{...process.env,WORKSPACE_RENAME_EDITOR_PROFILE:profile},timeout:10000});
  child=app.process();const page=await app.firstWindow();page.setDefaultTimeout(5000);const url=await app.evaluate(()=>globalThis.renameEditorInitialLoad);await page.waitForURL(url,{waitUntil:'load'});
  await page.setContent('<div id="root"></div>');await page.addStyleTag({content:css});await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByRole('button',{name:'English',exact:true}).waitFor();
  await withDeadline(page.evaluate(()=>document.fonts.ready),5000,'Native category fonts');
  assert.equal(await page.evaluate(()=>[...document.fonts].some(font=>font.family.includes('Inter') && font.status==='loaded')),true);
  const trigger=page.locator('.category-property-header > button');
  const saves=async()=>JSON.parse(await page.locator('#saves').textContent());
  let expected=[];
  for(const language of ['en','ru']){
   await page.getByRole('button',{name:language==='en'?'English':'Russian',exact:true}).click();
   for(const viewport of [1024,1440]) for(const column of ['Minimum column','Wider column']){
    await page.setViewportSize({width:viewport,height:720});await page.getByRole('button',{name:column,exact:true}).click();
    await trigger.focus();const hint=page.getByRole('tooltip');await hint.waitFor();
    assert.equal(await hint.textContent(),await trigger.getAttribute('aria-label'));
    assert.equal(await trigger.locator('svg[aria-hidden="true"]').count(),1);
    const popup=await hint.boundingBox();assert.ok(popup.x>=0 && popup.x+popup.width<=viewport && popup.y>=0 && popup.y+popup.height<=720);
    await trigger.click();
    const input=page.getByRole('textbox',{name:language==='en'?'Category property name':'Название свойства категории',exact:true});
    await input.fill('  Cancelled 日本語 draft  ');
    const bounds=await input.evaluate(node=>{const owner=node.closest('.category-property-header'),a=node.getBoundingClientRect(),b=owner.getBoundingClientRect();return {left:a.left,right:a.right,ownerLeft:b.left,ownerRight:b.right,overflow:owner.scrollWidth-owner.clientWidth,triggerBottom:owner.querySelector('button').getBoundingClientRect().bottom,inputTop:a.top};});
    assert.ok(bounds.left>=bounds.ownerLeft-1 && bounds.right<=bounds.ownerRight+1,JSON.stringify(bounds));
    assert.ok(bounds.overflow<=1,JSON.stringify(bounds));
    assert.ok(bounds.triggerBottom<=bounds.inputTop,JSON.stringify(bounds));
    await input.press('Escape');await input.waitFor({state:'detached'});assert.deepEqual(await saves(),expected);
    await page.waitForFunction(()=>document.querySelector('.category-property-header > button')===document.activeElement);
    assert.equal(await trigger.evaluate(node=>node===document.activeElement),true);
    await trigger.click();const exact=`  Saved ${language} ${viewport} ${column} 日本語  `;await input.fill(exact);await input.press('Enter');await input.waitFor({state:'detached'});
    expected=[...expected,exact];assert.deepEqual(await saves(),expected);await page.waitForFunction(()=>document.querySelector('.category-property-header > button')===document.activeElement);assert.equal(await trigger.evaluate(node=>node===document.activeElement),true);
   }
  }
 }catch(error){failure=error;}
 try{if(app){await closeElectron(app);stopped=child.exitCode!==null||child.signalCode!==null;assert.equal(stopped,true);}}catch(error){failure??=error;}
 try{await cleanupOwnedFixture(profile,{processesStopped:stopped,primaryFailure:failure,record:result=>{cleanup=result;}});}catch(error){failure??=error;}
 if(failure)throw failure;
 assert.equal(cleanup.status,'passed');
});
