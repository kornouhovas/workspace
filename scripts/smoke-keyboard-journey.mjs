/* global window, document, requestAnimationFrame */
import assert from 'node:assert/strict';
import {_electron} from 'playwright-core';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir,release} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {packagedExecutablePath} from './runtime-executable.mjs';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
const root=resolve(import.meta.dirname,'..'),fixture=await mkdtemp(join(tmpdir(),'issue67-keyboard-')),source=join(fixture,'source'),evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-67-keyboard');await mkdir(evidence,{recursive:true});
for(const name of ['Atlas','Beacon']){await mkdir(join(source,name),{recursive:true});await writeFile(join(source,name,'keep.txt'),'Preserve project bytes.');}
const parents=new Set(),backends=new Set(),report={issue:67,sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),status:'running',checks:[],languages:[],steps:[],captures:[],assignmentTransitions:[]};report.harnessSha256=createHash('sha256').update(await readFile(import.meta.filename)).digest('hex');let app,page,failure,launchUnverified=false;
try{
 launchUnverified=true;
 app=await _electron.launch({executablePath:packagedExecutablePath(root,process.platform,process.arch),args:[],env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')}});parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);await page.locator('.workspace-screen[data-ready="true"]').waitFor();assert.equal(await app.evaluate(({app})=>app.isPackaged),true);
 report.packageAsarSha256=createHash('sha256').update(await readFile(join(dirname(packagedExecutablePath(root,process.platform,process.arch)),process.platform==='darwin'?'../Resources/app.asar':'resources/app.asar'))).digest('hex');
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid)))backends.add(pid);assert.ok(backends.size);launchUnverified=false;
 const query=async input=>{const r=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(r.ok,true,JSON.stringify(r));return r.value;};
 const {workspaceId,viewId}=await query({type:'workspace.create',name:'Keyboard studio',rootPath:source});const call=(type,fields={})=>query({type:'workspace.'+type,workspaceId,...fields});
 const projects=(await call('applyDiscovery',{previewToken:(await call('previewDiscovery',{mode:'direct'})).previewToken})).projects;
 const atlas=projects.find(p=>p.name==='Atlas');
 const notes=(await call('createProperty',{name:'Notes',propertyType:'text'})).propertyId;await call('setTextValue',{projectId:atlas.projectId,propertyId:notes,value:'Original'});
 const score=(await call('createProperty',{name:'Score',propertyType:'number'})).propertyId;await call('setNumberValue',{projectId:atlas.projectId,propertyId:score,expression:'15'});
 const state=(await call('createProperty',{name:'State',propertyType:'single_select'})).propertyId;for(const name of ['Backlog','Ready'])await call('createSelectOption',{propertyId:state,name,color:'blue'});
 await call('setViewGrouping',{viewId,config:{propertyId:state,settings:[]}});
 await page.waitForFunction(()=>document.querySelector('.text-properties[aria-busy="false"]'));
 await page.evaluate(()=>{globalThis.keyboardReceipt={pointerdowns:0,keyCount:0};document.addEventListener('pointerdown',()=>globalThis.keyboardReceipt.pointerdowns++);document.addEventListener('keydown',()=>globalThis.keyboardReceipt.keyCount++);});
 const focused=async control=>await control.evaluate(el=>el===document.activeElement);
 const key=async value=>{await page.keyboard.press(value);};
 async function reach(control){
  await control.waitFor({state:'visible'});
  const role=await control.getAttribute('role');
  if(role==='menuitem'){
   for(let i=0;i<30;i++){if(await focused(control))return;await key('ArrowDown');}throw new Error('Menu item is not keyboard reachable');
  }
  if(role==='tab' && await control.getAttribute('tabindex')==='-1' && await control.locator('xpath=ancestor::*[@role="tablist"][1]').locator('[role="tab"][tabindex="0"]').count()){
   const list=control.locator('xpath=ancestor::*[@role="tablist"][1]'),current=list.locator('[role="tab"][tabindex="0"]');await reach(current);
   const arrow=await list.getAttribute('aria-orientation')==='vertical'?'ArrowDown':'ArrowRight';
   for(let i=0;i<20;i++){if(await focused(control))return;await key(arrow);}throw new Error('Tab is not keyboard reachable');
  }
  for(let i=0;i<220;i++){if(await focused(control))return;await key('Tab');}throw new Error('Control is not keyboard reachable: '+await control.getAttribute('aria-label'));
 }
 const activate=async control=>{await reach(control);await key('Enter');};
 const button=name=>page.getByRole('button',{name,exact:true});
 const editText=()=>page.locator('.project-area').getByRole('button',{name:/^(Edit Text value|Редактировать Text-значение): Atlas \/ Notes$/,exact:true});
 const editNumber=()=>page.locator('.project-area').getByRole('button',{name:/^(Edit Number value|Редактировать Number-значение): Atlas \/ Score$/,exact:true});
 const expand=()=>button(/^(Expand project|Развернуть проект)$/);
 const preview=name=>button(new RegExp('^(Preview project|Открыть предпросмотр проекта): '+name+'$'));
 const begin=async name=>{report.steps.push(name);console.log(name);};
 for(const language of ['en','ru']){
  await page.setViewportSize(language==='en'?{width:1024,height:720}:{width:1440,height:960});
  await begin(language+' sidebar and preview widths');
  if(language==='ru'){
   await activate(button(/^(Settings|Настройки)$/));
   await activate(page.getByRole('tab',{name:/^(General|Основные)$/,exact:true}));
   const chooser=page.getByLabel(/^(Interface language|Язык интерфейса)$/, {exact:true});await reach(chooser);// The high-level keyboard API maps US keys only. Send the real Cyrillic
   // typeahead key through Chromium's keyboard protocol without editing the DOM.
   const session=await page.context().newCDPSession(page);try{await session.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Р',text:'Р',windowsVirtualKeyCode:0});await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Р',windowsVirtualKeyCode:0});}finally{await session.detach();}await key('Enter');report.languageChoice={value:await chooser.inputValue(),focused:await focused(chooser)};
   await page.waitForFunction(()=>document.documentElement.lang==='ru');await activate(button(/^(Back to workspace|Вернуться к работе)$/));
  }
  const close=button(/^(Close preview|Закрыть предпросмотр)$/);if(await close.isVisible())await activate(close);
  for(const name of ['Atlas','Beacon']){const c=button(new RegExp('^(Close project tab|Закрыть вкладку проекта): '+name+'$'));if(await c.isVisible())await activate(c);}
  await activate(page.getByRole('tab',{name:'Table',exact:true}));
  const sidebar=page.getByRole('separator',{name:/^(Sidebar width|Ширина боковой панели)$/,exact:true});await reach(sidebar);await key('Home');assert.equal(await sidebar.getAttribute('aria-valuenow'),'180');await key('End');assert.equal(await sidebar.getAttribute('aria-valuenow'),'320');
  await activate(preview('Atlas'));await page.locator('.project-detail-fields[aria-busy="false"]').waitFor();
  const width=page.getByRole('separator',{name:/^(Project area width|Ширина области проекта)$/,exact:true});await reach(width);await key('ArrowLeft');const w=await width.getAttribute('aria-valuenow');await key('ArrowRight');assert.notEqual(await width.getAttribute('aria-valuenow'),w);
  await begin(language+' draft Escape and invalid navigation guard');
  await activate(editText());let input=page.locator('.project-area textarea');assert.equal(await focused(input),true);await page.keyboard.insertText('Cancelled draft');await key('Escape');assert.equal(await editText().textContent(),'Original');
  await activate(editNumber());input=page.locator('.project-area input').filter({visible:true});await reach(input);await key(process.platform==='darwin'?'Meta+A':'Control+A');await page.keyboard.insertText('1/0');await key('Enter');await page.locator('.project-area [role="alert"]').waitFor();
  await activate(expand());assert.equal(await page.locator('.saved-view-content').getAttribute('hidden'),null);assert.equal(await input.inputValue(),'1/0');await reach(input);await key('Escape');
  await begin(language+' tabs expand, reorder, close, reopen and return');
  await activate(expand());await page.getByRole('tab',{name:'Atlas',selected:true,exact:true}).waitFor();await activate(page.getByRole('tab',{name:'Table',exact:true}));await activate(preview('Beacon'));await activate(expand());
  await activate(button(/^(Project tab actions|Действия с вкладкой проекта): Beacon$/));await activate(page.getByRole('menuitem',{name:/^(Move tab left|Переместить вкладку влево)$/,exact:true}));assert.deepEqual(await page.locator('.project-tab [role="tab"]').allTextContents(),['Beacon','Atlas']);
  await activate(button(/^(Close project tab|Закрыть вкладку проекта): Beacon$/));await activate(button(/^(Reopen closed project|Открыть закрытый проект)$/));await page.getByRole('tab',{name:'Beacon',selected:true,exact:true}).waitFor();
  await activate(button(/^(Return project to the right|Вернуть проект вправо)$/));assert.equal(await page.getByRole('tab',{name:'Atlas',exact:true}).count(),1);assert.equal(await page.getByRole('tab',{name:'Beacon',exact:true}).count(),0);await activate(close);
  const group=page.locator('.saved-view-content').getByRole('combobox',{name:/^(Change group|Изменить группу): Atlas$/,exact:true});
  const destination=language==='en'?'Ready':'Backlog';
  const beforeGroup=(await call('queryView',{viewId,archived:false})).groups.find(group=>group.projectIds.includes(atlas.projectId));
  assert.ok(beforeGroup,'The current group must be observed before keyboard assignment');assert.notEqual(beforeGroup.label,destination,'Each language must perform a real transition');
  await reach(group);await key(language==='en'?'r':'b');await key('Enter');
  let assigned=false;for(let i=0;i<100;i++){const result=await call('queryView',{viewId,archived:false});assigned=result.groups.some(g=>g.label===destination&&g.projectIds.includes(atlas.projectId));if(assigned)break;await page.evaluate(()=>new Promise(done=>requestAnimationFrame(done)));}assert.equal(assigned,true,'Keyboard assignment must commit the new destination membership');
  report.assignmentTransitions.push({language,from:beforeGroup.label??null,to:destination});
  await begin(language+' contextual operation Escape and settings Back');
  await activate(preview('Atlas'));const actions=page.locator('.project-area').getByRole('button',{name:/^(Project actions|Действия с проектом): Atlas$/,exact:true});await activate(actions);await key('Escape');assert.equal(await focused(actions),true);await activate(actions);
  const rename=page.locator('.project-area').getByRole('button',{name:/^(Rename project folder|Переименовать папку проекта): Atlas$/,exact:true});await activate(rename);const dialog=page.getByRole('dialog',{name:/^(Rename project folder|Переименовать папку проекта)$/,exact:true});await dialog.waitFor();
  const review=dialog.getByRole('button',{name:/^(Review current project name|Проверить текущее имя проекта)$/,exact:true});await Promise.race([dialog.getByRole('textbox').and(page.locator(':enabled')).waitFor(),review.waitFor()]);if(await review.isVisible())await activate(review);input=dialog.getByRole('textbox');await reach(input);await key(process.platform==='darwin'?'Meta+A':'Control+A');await page.keyboard.insertText('Cancelled rename');await key('Escape');await dialog.waitFor({state:'hidden'});assert.equal((await call('listProjects')).projects.find(p=>p.projectId===atlas.projectId).name,'Atlas');
  await activate(button(/^(Settings|Настройки)$/));await activate(button(/^(Back to workspace|Вернуться к работе)$/));await page.locator('.project-area-header h2').filter({hasText:'Atlas'}).waitFor();
  assert.equal(await readFile(join(source,'Atlas','keep.txt'),'utf8'),'Preserve project bytes.');report.languages.push(language);report.captures.push({language,...await page.evaluate(()=>({width:window.innerWidth,height:window.innerHeight})),path:language+'-daily.png'});report.checks.push(language+': Tab/roving navigation, widths, draft Escape/guard, unique tabs/reorder/close/reopen/return, native group assignment, operation Escape and settings Back');await page.screenshot({path:join(evidence,language+'-daily.png')});
 }
 report.keyboard=await page.evaluate(()=>globalThis.keyboardReceipt);assert.equal(report.keyboard.pointerdowns,0);assert.ok(report.keyboard.keyCount>20);report.status='passed';
}catch(error){failure=error;report.status='failed';report.error=error.stack;if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally{if(page)try{report.keyboard=await page.evaluate(()=>globalThis.keyboardReceipt);}catch(error){failure??=error;report.counterReadError=error.message;report.status='failed';}try{if(app)await closeElectron(app);report.normalQuit=!!app;}catch(error){failure??=error;report.quitError=error.message;report.status='failed';}const stopped=ownedProcessesStopped(parents,backends,{launchUnverified});report.launchUnverified=launchUnverified;report.stopped=stopped;try{await cleanupOwnedFixture(fixture,{processesStopped:stopped,primaryFailure:undefined,record:r=>report.cleanup=r});}catch(error){failure??=error;report.status='failed';}await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2));}
if(failure)throw failure;
