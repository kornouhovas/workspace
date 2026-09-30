import {nativeCapture} from './native-capture.mjs';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const phase=process.argv[2]||'before';
const out=`work/workspace-6fh/${phase}`;await mkdir(out,{recursive:true});
const runtime=JSON.parse(await readFile('work/workspace-6fh/runtime.json','utf8'));
const browser=await chromium.connectOverCDP('http://127.0.0.1:9246');const page=browser.contexts()[0].pages()[0];
const result={phase,fixture:runtime.fixture,kind:'Native Electron captures include OS traffic lights; separately named renderer images are diagnostics',shots:[],styles:[],errors:[]};
page.on('pageerror',e=>result.errors.push(e.message));
const request=(method,payload={})=>page.evaluate(({method,payload})=>window.workspace.request(method,payload),{method,payload});
const roots=await request('workspace.getRoot');const workspaceId=roots.root.workspaceId;
await request('workspace.updateView',{workspaceId,viewId:'view:default-table',patch:{grouping:{propertyId:'property:status',sort:'default'}}});
const shot=async(name)=>{await page.waitForTimeout(300);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});const path=`${out}/renderer-${theme}-${width}x${height}-${name}.png`;await page.screenshot({path});result.shots.push(path);await fetch('http://127.0.0.1:9247/front');const nativePath=`${out}/native-${theme}-${width}x${height}-${name}.png`;const capture=await nativeCapture(runtime.pid,nativePath,width,height);result.shots.push({nativePath,...capture});};
let theme,width,height;
try{
for(theme of ['light','dark'])for([width,height] of [[1440,960],[1024,720]]){
await fetch(`http://127.0.0.1:9247/size?width=${width}&height=${height}`);
await page.evaluate(theme=>{localStorage.setItem('workspace.theme',theme);localStorage.removeItem('workspace.pane-layout.v1');localStorage.removeItem('workspace.project-tabs.v1')},theme);
await request('workspace.setActiveView',{workspaceId,viewId:'view:default-board'});
await page.reload();await page.getByRole('button',{name:'Project Alpha',exact:true}).waitFor();
await shot('board');
result.styles.push(await page.evaluate(({theme,width,height})=>{const root=getComputedStyle(document.documentElement);const sample=selector=>{const e=document.querySelector(selector);if(!e)return null;const s=getComputedStyle(e);const r=e.getBoundingClientRect();return {selector,font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,color:s.color,background:s.backgroundColor,border:s.borderColor,radius:s.borderRadius,shadow:s.boxShadow,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}};return {theme,width,height,viewport:{width:innerWidth,height:innerHeight},roles:Object.fromEntries(['canvas','ink','input','surface-raised','surface-selected','sidebar-accent','destructive-text','text-base','text-sm'].map(n=>[n,root.getPropertyValue('--'+n)])),samples:['.workspace-sidebar','header','.bb-chrome-action','[role=tab]','[data-slot=input]','.workspace-board-card'].map(sample)}},{theme,width,height}));
await page.getByRole('button',{name:'Hide sidebar',exact:true}).click();await shot('board-collapsed');
await page.getByRole('button',{name:'Show sidebar',exact:true}).click();
await page.getByRole('button',{name:'Customize Columns',exact:true}).click();await shot('customize-menu');await page.keyboard.press('Escape');
await page.getByRole('button',{name:'Project Alpha',exact:true}).click();await shot('project-preview');
await page.getByRole('button',{name:/^(Expand project|Maximize pane)/}).click();await shot('project-expanded');
await page.getByRole('button',{name:'Edit Notes value',exact:true}).last().click();await shot('text-editor');await page.keyboard.press('Escape');
await page.getByRole('button',{name:/^(Close project details|Hide right panel)/}).last().click();
await page.getByRole('tab',{name:'Table',exact:true}).click();await page.getByRole('row').filter({hasText:'Project Alpha'}).waitFor();await shot('grouped-table');
await page.getByRole('button',{name:'Workspace actions for Operations',exact:true}).click();await shot('workspace-menu');
await page.getByRole('menuitem',{name:'Workspace settings',exact:true}).click();await page.getByRole('heading',{name:'Folder role tree',exact:true}).waitFor();await shot('workspace-settings');
await page.getByRole('button',{name:'Settings',exact:true}).click();await shot('global-settings');
await page.getByRole('combobox',{name:'Appearance',exact:true}).click();await shot('appearance-select');await page.keyboard.press('Escape');
await page.getByRole('button',{name:'Back to workspace',exact:true}).click();
await page.getByPlaceholder('Project name',{exact:true}).fill('No such project');await shot('search-empty');await page.getByPlaceholder('Project name',{exact:true}).fill('');
}
}catch(e){result.failure=String(e);await page.screenshot({path:`${out}/failure.png`});await writeFile(`${out}/failure-dom.txt`,await page.locator('body').innerText());throw e;}finally{await writeFile(`${out}/report.json`,JSON.stringify(result,null,2));void browser;}

process.exit(process.exitCode || 0);
