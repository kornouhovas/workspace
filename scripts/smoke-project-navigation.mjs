/* global window, document, innerWidth, requestAnimationFrame */
import assert from 'node:assert/strict';
import {runtimeSmokeLaunch} from './runtime-executable.mjs';
import {mkdtemp,mkdir,realpath,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {openSettingsSection,returnToWorkspace,setInterfaceLanguage} from './runtime-settings.mjs';
import {usableRuntimeViewProjection} from './runtime-view-readiness.mjs';
const root=resolve(import.meta.dirname,'..');
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-54-navigation');
await mkdir(evidence,{recursive:true});
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-navigation-')));
const source=join(fixture,'source');await mkdir(source);
const longName='Release planning — Длинное название проекта и проверка переноса';
for(const name of [longName,'Atlas','Beacon','Cedar',...Array.from({length:50},(_,i)=>`Project ${i}`)])await mkdir(join(source,name));
const parents=new Set(),backends=new Set(),screens=[],checks=[];
let app,page,failure,launchUnverified=false;
try{
 launchUnverified=true;
 app=await _electron.launch({...runtimeSmokeLaunch(root),cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')}});
 parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
 await page.waitForFunction(async()=>(await window.workspace.getBackendStatus()).state==='ready');
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid)))backends.add(pid);
 assert.ok(backends.size);launchUnverified=false;
 const query=async input=>{const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
 const {workspaceId,viewId}=await query({type:'workspace.create',name:'Design studio',rootPath:source});
 const call=(type,fields={})=>query({type:`workspace.${type}`,workspaceId,...fields});
 const projects=(await call('applyDiscovery',{previewToken:(await call('previewDiscovery',{mode:'direct'})).previewToken})).projects;
 const longProject=projects.find(p=>p.name===longName);
 const atlas=projects.find(p=>p.name==='Atlas');
 const notes=(await call('createProperty',{name:'Notes',propertyType:'text'})).propertyId;
 const number=(await call('createProperty',{name:'Estimate',propertyType:'number'})).propertyId;
 const date=(await call('createProperty',{name:'Due',propertyType:'date'})).propertyId;
 await call('setTextValue',{projectId:atlas.projectId,propertyId:notes,value:'Prepare launch materials\nПроверить макеты и тексты'});
 await call('setTextValue',{projectId:longProject.projectId,propertyId:notes,value:'Long authored notes. Длинный текст проекта. '.repeat(24)+'\nSecond line'});
 await call('setNumberValue',{projectId:atlas.projectId,propertyId:number,expression:'10 + 5'});
 await call('setDateValue',{projectId:atlas.projectId,propertyId:date,value:'2026-10-21'});
 await page.reload();
 const expectedIds=(await call('queryView',{viewId,archived:false})).projectIds;
 await page.waitForFunction(usableRuntimeViewProjection,expectedIds);
 await page.waitForFunction(()=>!document.querySelector('.saved-view-content').dataset.scrollRestoring);
 // Large scrollbar jumps exercise real IntersectionObserver loading, without
 // materializing fields or focusing controls on behalf of the application.
 await page.locator('.saved-view-content').evaluate(async content=>{
  for(const fraction of [1,0,0.5,0,1]) {
   content.scrollTop=(content.scrollHeight-content.clientHeight)*fraction;
   await new Promise(resolve=>requestAnimationFrame(resolve));
  }
 });
 await page.waitForFunction(usableRuntimeViewProjection,expectedIds);
 await page.locator('.saved-view-content').evaluate(content=>{content.scrollTop=0;});
 await page.waitForFunction(usableRuntimeViewProjection,expectedIds);
 checks.push('rapid scroll preserves exact ordered identities and all clipped visible fields');
 const viewGeometry=()=>page.locator('.saved-view-content').evaluate(el=>{
  const rect=node=>{const r=node.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
  const scroll=el.querySelector('.project-table-scroll');
  const row=el.querySelector('[data-project-id]');
  return {view:rect(el),row:rect(row),scroll:[el.scrollTop,scroll.scrollLeft],scrollWidth:scroll.scrollWidth};
 });
 const geometryBefore=await viewGeometry();
 await page.getByRole('cell',{name:'Atlas',exact:true}).click({position:{x:150,y:10}});
 assert.deepEqual(await viewGeometry(),geometryBefore,'opening the preview must not resize or scroll the saved view');
 const overlap=await page.evaluate(()=>{const view=document.querySelector('.saved-view-content').getBoundingClientRect(),project=document.querySelector('.project-area').getBoundingClientRect();return project.left<view.right && project.right<=view.right+1;});
 assert.equal(overlap,true,'the project area overlaps the saved view');
 await page.getByRole('button',{name:'Close preview',exact:true}).click();
 assert.deepEqual(await viewGeometry(),geometryBefore,'closing the preview must not resize or scroll the saved view');
 await page.getByRole('button',{name:'Preview project: Atlas',exact:true}).and(page.locator(':focus')).waitFor();
 await page.getByRole('button',{name:'Edit Text value: Atlas / Notes',exact:true}).click();
 await page.locator('.text-value-label').filter({hasText:'Edit Text value: Atlas / Notes'}).click();
 assert.equal(await page.locator('.project-area').count(),0);
 await page.getByRole('textbox',{name:'Edit Text value: Atlas / Notes',exact:true}).press('Escape');
 checks.push('non-editor row activation/focus return, editor label isolation and Escape');
 await page.setViewportSize({width:1024,height:720});
 await page.getByRole('button',{name:'Preview project: Atlas',exact:true}).click();
 await page.locator('.project-detail-fields[aria-busy="false"]').waitFor();
 const setScroll=async(top,left)=>{await page.waitForFunction(()=>!document.querySelector(".saved-view-content").dataset.scrollRestoring);await page.locator('.saved-view-content').evaluate((el,{top,left})=>{el.scrollTop=top;el.querySelector('.project-table-scroll').scrollLeft=left;},{top,left});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
 const assertScroll=async(top,left)=>{try{await page.waitForFunction(({top,left})=>{const el=document.querySelector('.saved-view-content');return !el.dataset.scrollRestoring && Math.abs(el.scrollTop-top)<2 && Math.abs(el.querySelector('.project-table-scroll').scrollLeft-left)<2;},{top,left});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const settled=await page.locator(".saved-view-content").evaluate(el=>[el.scrollTop,el.querySelector(".project-table-scroll").scrollLeft]);assert.deepEqual(settled,[top,left]);}catch(error){console.log(await page.locator('.saved-view-content').evaluate(el=>({actual:[el.scrollTop,el.scrollLeft],horizontal:[...el.querySelectorAll('.project-table-scroll')].map(e=>[e.scrollLeft,e.scrollWidth,e.clientWidth]),busy:[...el.querySelectorAll('[aria-busy=true]')].map(e=>e.className)})));throw error;}};
 await setScroll(160,100);
 await page.getByRole('button',{name:'Expand project',exact:true}).click();
 await page.getByRole('button',{name:'Return project to the right',exact:true}).click();
 await assertScroll(160,100);
 const review=(await call('createView',{name:'Review Table',kind:'table'})).views.find(v=>v.name==='Review Table');
 await page.getByRole('tab',{name:'Review Table',selected:true,exact:true}).waitFor();
 await page.locator('.text-properties[aria-busy="false"]').first().waitFor();
 await assertScroll(0,0);await setScroll(80,50);
 await page.getByRole('tab',{name:'Table',exact:true}).click();await assertScroll(160,100);
 await page.getByRole('tab',{name:'Review Table',exact:true}).click();await assertScroll(80,50);
 await page.getByRole('tab',{name:'Table',exact:true}).click();await assertScroll(160,100);
 await call('deleteView',{viewId:review.viewId});
 await call('setViewFilter',{viewId,config:{search:'Atlas',rules:[]}});
 await page.waitForFunction(()=>!document.querySelector('.saved-view-content').dataset.scrollRestoring && document.querySelectorAll('.saved-view-content [data-project-id]').length===1);
 assert.equal(await page.locator('.saved-view-content').evaluate(el=>el.scrollTop),0);
 await call('setViewFilter',{viewId,config:{search:'',rules:[]}});
 await page.waitForFunction(()=>!document.querySelector('.saved-view-content').dataset.scrollRestoring && document.querySelectorAll('.saved-view-content [data-project-id]').length>1);
 checks.push('scroll clamps and releases after a shorter filtered projection');

 await setScroll(0,0);
 const handle=page.getByRole('separator',{name:'Project area width',exact:true});
 const before=await page.locator('.project-area').evaluate(el=>el.getBoundingClientRect().width);
 const bounds=await handle.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+50);await page.mouse.down();await page.mouse.move(bounds.x-30,bounds.y+50);await page.mouse.up();
 assert.ok((await page.locator('.project-area').evaluate(el=>el.getBoundingClientRect().width))>before+20);
 await page.getByRole('button',{name:'Close preview',exact:true}).click();
 checks.push('independent vertical/horizontal view scroll, expand/return restoration, pointer project resize');
 for(const language of ['en','ru']){
  await setInterfaceLanguage(page,language);
  const en=language==='en';
  const preview=name=>page.getByRole('button',{name:`${en?'Preview project':'Открыть предпросмотр проекта'}: ${name}`,exact:true});
  const openPreview=async name=>{await page.waitForFunction(()=>!document.querySelector(".saved-view-content").dataset.scrollRestoring && !document.querySelector(".saved-view-content [aria-busy=true]"));const project=projects.find(p=>p.name===name);await page.locator(`.saved-view-content [data-project-id="${project.projectId}"]`).first().scrollIntoViewIfNeeded();await preview(name).click();};
  const expand=()=>page.getByRole('button',{name:en?'Expand project':'Развернуть проект',exact:true});
  const backRight=()=>page.getByRole('button',{name:en?'Return project to the right':'Вернуть проект вправо',exact:true});
  for(const theme of ['light','dark']){
   await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnToWorkspace(page);
   for(const size of [{width:1024,height:720},{width:1440,height:960}]){
    await page.setViewportSize(size);await openPreview('Atlas');await page.locator('.project-area').waitFor();await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.project-area').count(),1);
    await page.screenshot({path:join(evidence,`preview-${language}-${theme}-${size.width}.png`)});
    const width=await page.locator('.project-area').evaluate(el=>el.getBoundingClientRect().width);
    await expand().press('Enter');await page.getByRole('tab',{name:'Atlas',selected:true,exact:true}).waitFor();
    assert.equal(await page.locator('.saved-view-content').isVisible(),false);
    assert.equal(await page.locator('.desktop-sidebar').isVisible(),true);
    await page.screenshot({path:join(evidence,`expanded-${language}-${theme}-${size.width}.png`)});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await backRight().press('Enter');
    assert.ok(Math.abs((await page.locator('.project-area').evaluate(el=>el.getBoundingClientRect().width))-width)<2);
    assert.equal(await page.getByRole('tab',{name:'Atlas',exact:true}).count(),0);
    await openPreview(longName);await page.locator('.project-detail-fields[aria-busy="false"]').waitFor();
    await page.screenshot({path:join(evidence,`long-preview-${language}-${theme}-${size.width}.png`)});
    await expand().click();await page.screenshot({path:join(evidence,`long-expanded-${language}-${theme}-${size.width}.png`)});await backRight().click();
    screens.push({language,theme,...size});
   }
  }
  await openPreview('Beacon');assert.equal(await page.locator('.project-area-header h2').textContent(),'Beacon');
  await expand().click();await page.getByRole('tab',{name:'Table',exact:true}).click();
  await openPreview('Atlas');await expand().click();
  await page.getByRole('button',{name:`${en?'Close project tab':'Закрыть вкладку проекта'}: Beacon`,exact:true}).click();
  await page.getByRole('tab',{name:'Atlas',selected:true,exact:true}).waitFor();
  await page.getByRole('button',{name:en?'Reopen closed project':'Открыть закрытый проект',exact:true}).click();
  await page.getByRole('tab',{name:'Beacon',selected:true,exact:true}).waitFor();
  await page.getByRole('tab',{name:'Beacon',exact:true}).dragTo(page.getByRole('tab',{name:'Atlas',exact:true}));
  assert.deepEqual(await page.locator('.project-tab [role="tab"]').allTextContents(),['Beacon','Atlas']);
  await page.getByRole('tab',{name:'Beacon',exact:true}).focus();await page.keyboard.press('ArrowRight');await page.getByRole('tab',{name:'Atlas',exact:true}).and(page.locator(':focus')).waitFor();await page.keyboard.press('Enter');
  await page.getByRole('tab',{name:'Atlas',selected:true,exact:true}).waitFor();
  await page.keyboard.press('ArrowLeft');await page.getByRole('tab',{name:'Beacon',exact:true}).and(page.locator(':focus')).waitFor();await page.keyboard.press('Enter');await page.getByRole('tab',{name:'Beacon',selected:true,exact:true}).waitFor();
  await backRight().click();
  const resize=page.getByRole('separator',{name:en?'Project area width':'Ширина области проекта',exact:true});
  await resize.focus();await resize.press('Home');assert.equal(await resize.getAttribute('aria-valuenow'),'280');
  await resize.press('End');assert.equal(await resize.getAttribute('aria-valuenow'),await resize.getAttribute('aria-valuemax'));
  const actualWidth=await page.locator('.project-area').evaluate(el=>el.getBoundingClientRect().width);assert.ok(Math.abs(actualWidth-Number(await resize.getAttribute('aria-valuenow')))<2);
  await page.getByRole('button',{name:en?'Close preview':'Закрыть предпросмотр',exact:true}).click();
  assert.equal(await page.locator('.project-area').count(),0);assert.equal(await resize.count(),0);
  await page.getByRole('button',{name:en?'Collapse sidebar':'Свернуть боковую панель',exact:true}).click();
  await page.getByRole('button',{name:en?'Restore sidebar':'Восстановить боковую панель',exact:true}).click();
  const sidebar=page.getByRole('separator',{name:en?'Sidebar width':'Ширина боковой панели',exact:true});await sidebar.focus();await sidebar.press('End');assert.equal(await sidebar.getAttribute('aria-valuenow'),'320');await sidebar.press('Home');
  await page.getByRole('tab',{name:'Atlas',exact:true}).click();
  await page.getByRole('button',{name:en?'Close project tab':'Закрыть вкладку проекта',exact:true}).click();
  checks.push(`${language} preview/expand/return, inactive-close/reopen, width endpoints, collapse/restore`);
 }
 const sibling=await query({type:'workspace.create',name:'Second studio',rootPath:source});
 await page.locator(`.sidebar-workspace-row > button[data-workspace-id="${sibling.workspaceId}"][aria-current="page"]`).waitFor();
 await page.locator(`.sidebar-workspace-row > button[data-workspace-id="${workspaceId}"]`).click();await page.locator(`.sidebar-workspace-row > button[data-workspace-id="${workspaceId}"][aria-current="page"]`).waitFor();
 await page.getByRole('button',{name:'Назад',exact:true}).press('Enter');await page.locator(`.sidebar-workspace-row > button[data-workspace-id="${sibling.workspaceId}"][aria-current="page"]`).waitFor();
 await page.getByRole('button',{name:'Вперёд',exact:true}).press('Enter');await page.locator(`.sidebar-workspace-row > button[data-workspace-id="${workspaceId}"][aria-current="page"]`).waitFor();
 checks.push('actual workspace Back/Forward keyboard navigation, project tab pointer reorder and keyboard selection');
 await call('updateView',{viewId,name:'Board',kind:'board'});
 await page.getByRole('button',{name:'Открыть предпросмотр проекта: Cedar',exact:true}).waitFor();
 const boardGeometry=()=>page.locator('.saved-view-content').evaluate(el=>{
  const rect=node=>{const r=node.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
  const card=el.querySelector('[data-project-id]');
  const board=el.querySelector('.project-board');
  return {view:rect(el),card:rect(card),boardWidth:board.getBoundingClientRect().width,scroll:[el.scrollTop,board.scrollLeft]};
 });
 const boardBefore=await boardGeometry();
 await page.getByRole('button',{name:'Открыть предпросмотр проекта: Cedar',exact:true}).click();assert.equal(await page.locator('.project-area-header h2').textContent(),'Cedar');
 assert.deepEqual(await boardGeometry(),boardBefore,'opening the preview must preserve Board geometry and scroll');
 await page.getByRole('button',{name:'Закрыть предпросмотр',exact:true}).click();
 assert.deepEqual(await boardGeometry(),boardBefore,'closing the preview must preserve Board geometry and scroll');
 checks.push('Board preview and unchanged geometry');
}catch(error){failure=error;if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally{
 let stopped=false,cleaned=false;
 try{if(app)await closeElectron(app);stopped=await ownedProcessesStopped(parents,backends,{launchUnverified});assert.equal(stopped,true);}catch(error){failure??=error;}
 try{cleaned=await cleanupOwnedFixture(fixture,{processesStopped:stopped,primaryFailure:failure,record:result=>{cleaned=result;}});}catch(error){failure??=error;}
 await writeFile(join(evidence,'report.json'),JSON.stringify({sha:process.env.GITHUB_SHA??null,platform:process.platform,screens,checks,launchUnverified,stopped,cleaned,failure:failure?.stack},null,2));
}
if(failure)throw failure;
console.log(`Project navigation: ${screens.length*4} ordinary/long preview/expanded variants; ${checks.join(', ')}`);
