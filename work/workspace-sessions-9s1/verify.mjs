import {_electron as electron} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {createWorkspaceIpcHandler} from '../../electron/workspaceIpc.js';
const dir='work/workspace-sessions-9s1/evidence', phase=process.argv[2]||'native';
const f=JSON.parse(await readFile(`${dir}/fixture.json`));
const rootB=join(f.fixture,'projects-b');await mkdir(join(rootB,'Review','Project Delta','docs'),{recursive:true});await writeFile(join(rootB,'Review','Project Delta','docs','delta.txt'),'Delta workspace content');
const handler=createWorkspaceIpcHandler({configPath:join(f.metadata,'settings.json'),propertyStorePath:join(f.metadata,'properties.json'),viewStorePath:join(f.metadata,'views.json'),chooseRoot:async()=>join(f.fixture,'projects')});
let all=await handler(null,'workspace.listWorkspaces');
const a=f.workspaceId;const b=all.workspaces.find(w=>w.id!==a)?.id||(await handler(null,'workspace.createWorkspace',{name:'Research'})).workspace.id;
await handler(null,'workspace.setRoot',{workspaceId:b});
await handler(null,'workspace.setActiveWorkspace',{workspaceId:a});
const launch=()=>electron.launch({executablePath:`${f.app}/Contents/MacOS/Electron`,args:['electron/main.js'],env:{...process.env,WORKSPACE_DEV:'1',WORKSPACE_DEV_DATA:f.metadata,WORKSPACE_DEV_URL:''}});
let app,page;
const out={phase,checks:[],frames:[],events:[]};
const check=(name,ok,data)=>{out.checks.push({name,passed:!!ok,data});if(!ok)throw Error(name)};
const delay=ms=>page.waitForTimeout(ms);
const panel=()=>page.getByTestId('workspace-right-panel');
const card=name=>page.getByRole('button',{name,exact:true});
const dialog=name=>page.getByRole('dialog',{name,exact:true});
const width=async()=> (await panel().boundingBox())?.width||0;
const snapshot=name=>page.screenshot({path:`${dir}/${phase}-${name}.png`});
async function fit(w=1440,h=960){await page.waitForFunction(()=>document.querySelector('[data-view-tab-id]'));await app.evaluate(async({BrowserWindow,app},{w,h})=>{const win=BrowserWindow.getAllWindows()[0];if(!win.isVisible())win.show();win.restore();app.focus({steal:true});win.focus();win.setPosition(30,50);win.setContentSize(w,h);win.webContents.setZoomFactor(1)},{w,h});await page.setViewportSize({width:w,height:h});await delay(300);const native=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getContentBounds());check(`native size ${w}`,native.width===w&&native.height===h,native)}
async function start(){app=await launch();page=await app.firstWindow();page.setDefaultTimeout(7000);await fit();await page.evaluate(()=>{window.__events=[];for(const type of ['pointerdown','pointerup'])document.addEventListener(type,e=>window.__events.push({type,trusted:e.isTrusted,x:e.clientX,y:e.clientY,label:e.target.closest('[aria-label]')?.getAttribute('aria-label')}),true)})}
async function bounds(){
 const b=await app.evaluate(({BrowserWindow,app})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.show();app.focus({steal:true});w.focus();return w.getContentBounds()});
 let state;
 for(let i=0;i<30;i++){
  state=JSON.parse(execFileSync('/tmp/workspace-2ly-native-state',[String(app.process().pid)],{encoding:'utf8'}));
  const win=state.windows.find(w=>Math.abs(w.kCGWindowBounds.Width-b.width)<2&&Math.abs(w.kCGWindowBounds.Height-b.height)<2);
  if(state.pid===app.process().pid&&win){check('native bounds match renderer',Math.abs(win.kCGWindowBounds.X-b.x)<2&&Math.abs(win.kCGWindowBounds.Y-b.y)<2,{b,native:win.kCGWindowBounds});return b;}
  if(i===0)execFileSync('open',['-a',f.app]);
  await delay(100);
 }
 throw Error('Native foreground/bounds unstable '+JSON.stringify({b,state}));
}
async function pointer(action,x,y){const b=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getContentBounds());execFileSync('/tmp/workspace-2ly-native-pointer',[action,String(b.x+x),String(b.y+y)])}
async function click(locator,wait=270){await bounds();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const r=await locator.boundingBox();if(!r)throw Error('Missing native target');await pointer('move',r.x+r.width/2,r.y+r.height/2);await pointer('down',r.x+r.width/2,r.y+r.height/2);await pointer('up',r.x+r.width/2,r.y+r.height/2);await delay(wait)}
async function sidebar(collapsed){await click(card(collapsed?'Hide sidebar':'Show sidebar'));check(`OS sidebar ${collapsed}`,await page.locator('.workspace-shell').getAttribute('data-sidebar-collapsed')===String(collapsed));const toggle=await page.getByRole('button',{name:collapsed?'Show sidebar':'Hide sidebar',exact:true}).boundingBox();const forward=await card('Go forward').boundingBox();check('toggle remains right of arrows',toggle.x>=forward.x+forward.width,{toggle,forward})}
async function switchTo(id,name){await page.locator(`[data-workspace-row-id="${id}"] > button`).first().click();await card(name).or(dialog(name)).first().waitFor();await delay(320);check(`active ${id}`,(await page.evaluate(()=>window.workspace.request('workspace.getRoot'))).root.workspaceId===id)}
async function settings(){await page.locator('.workspace-sidebar').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('heading',{name:/Source ·/}).waitFor()}
async function pick(path){await app.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:!path,filePaths:path?[path]:[]})},path);await page.getByRole('button',{name:/Select folder|Change folder/,exact:false}).click();await delay(400)}
async function frameStart(){await page.evaluate(()=>{window.__frames=[];const start=performance.now();const tick=()=>{const sidebar=document.querySelector('.workspace-sidebar-host'),right=document.querySelector('.bb-right-panel'),tab=document.querySelector('[data-view-tab-id]');window.__frames.push({t:performance.now()-start,left:sidebar.getBoundingClientRect().width,right:right.getBoundingClientRect().width,titleX:tab?.getBoundingClientRect().x,dialog:right.querySelector('[role=dialog]')?.getAttribute('aria-label'),toggleX:document.querySelector('[title="Hide sidebar"],[title="Show sidebar"]')?.getBoundingClientRect().x});if(performance.now()-start<900)requestAnimationFrame(tick)};requestAnimationFrame(tick)})}
try{
 await start();
 // Normalize only this disposable fixture session for repeatable run.
 await page.evaluate(()=>{localStorage.removeItem('workspace.pane-layout.v1');localStorage.removeItem('workspace.project-tabs.v1');localStorage.removeItem('workspace.sidebar-width.v1')});await page.reload();await fit();await page.evaluate(()=>{window.__events=[];for(const type of ['pointerdown','pointerup'])document.addEventListener(type,e=>window.__events.push({type,trusted:e.isTrusted,x:e.clientX,y:e.clientY,label:e.target.closest('[aria-label]')?.getAttribute('aria-label')}),true)});
 for(const view of ['Board','Table']){await page.getByRole('tab',{name:view,exact:true}).click();await card('Project Alpha').click();await dialog('Project Alpha').waitFor();await card('Project Alpha').click();await delay(280);check(`${view} same card closes`,await width()===0);await card('Project Alpha').click();await dialog('Project Alpha').waitFor();await card('Project Beta').click();await dialog('Project Beta').waitFor();check(`${view} different card content`,await dialog('Project Beta').count()===1)}
 await page.getByRole('tab',{name:'Board',exact:true}).click();await card('Project Alpha').click();await dialog('Project Alpha').waitFor();
 // Workspace B selects a distinct source via the Settings UI and real IPC.
 await switchTo(b,'Project Alpha');await settings();check('Settings identifies B',await page.getByRole('heading',{name:/Research/}).count()===1);await pick(rootB);await page.getByText(rootB,{exact:true}).first().waitFor();check('B source displayed',await page.getByText(rootB,{exact:true}).count()>0);await page.getByRole('button',{name:'Back to workspace'}).click();await card('Project Delta').click();await dialog('Project Delta').waitFor();await dialog('Project Delta').getByText('docs',{exact:true}).waitFor();
 await switchTo(a,'Project Alpha');await dialog('Project Alpha').waitFor();check('A preview restores actual content',await dialog('Project Alpha').getByText('README.md',{exact:true}).count()>0);
 // Change global sidebar width with its real separator keyboard interface.
 await page.getByRole('separator',{name:/Resize sidebar/}).press('End');await delay(280);check('global width set',await page.locator('.workspace-sidebar-host').evaluate(el=>el.getBoundingClientRect().width)===460);
 for(let i=0;i<3;i++){await switchTo(b,'Project Delta');await dialog('Project Delta').waitFor();await switchTo(a,'Project Alpha');await dialog('Project Alpha').waitFor()}check('global width across A B A',await page.locator('.workspace-sidebar-host').evaluate(el=>el.getBoundingClientRect().width)===460);
 await settings();check('A source unchanged',await page.getByText(join(f.fixture,'projects'),{exact:true}).count()>0);await pick('');check('cancel keeps A source',await page.getByText(join(f.fixture,'projects'),{exact:true}).count()>0);await pick(join(f.fixture,'missing'));check('unavailable selection keeps A source',await page.getByText(join(f.fixture,'projects'),{exact:true}).count()>0);await page.getByRole('button',{name:'Back to workspace'}).click();
 for(const theme of ['Light','Dark']){
  await settings();await page.getByRole('combobox',{name:'Appearance'}).click();await page.getByRole('option',{name:theme,exact:true}).click();await page.getByRole('button',{name:'Back to workspace'}).click();
  for(const [w,h] of [[1440,960],[1024,720]]){await fit(w,h);for(let i=0;i<3;i++){await sidebar(true);await sidebar(false)}
   await frameStart();const promise=click(card('Hide sidebar'),0);await delay(100);await snapshot(`${theme}-${w}-sidebar-intermediate`);await promise;await delay(380);const frames=await page.evaluate(()=>window.__frames);out.frames.push({name:`${theme}-${w}-sidebar`,frames});check('intermediate sidebar widths',frames.some(x=>x.left>2&&x.left<458));check('toggle stationary',new Set(frames.map(x=>x.toggleX)).size===1);await sidebar(false);
   await frameStart();await panel().getByRole('button',{name:/Hide right panel/}).click();await delay(80);await snapshot(`${theme}-${w}-preview-intermediate`);await delay(350);out.frames.push({name:`${theme}-${w}-preview-close`,frames:await page.evaluate(()=>window.__frames)});await card('Project Alpha').click();await dialog('Project Alpha').waitFor();
   await card('Hide sidebar').click();await delay(40);await card('Show sidebar').click();await delay(280);check('rapid toggle restores width',await page.locator('.workspace-sidebar-host').evaluate(el=>el.getBoundingClientRect().width)===460);await snapshot(`${theme}-${w}-settled`);
   await switchTo(b,'Project Delta');await dialog('Project Delta').waitFor();await switchTo(a,'Project Alpha');await dialog('Project Alpha').waitFor();
  }
 }
 await page.emulateMedia({reducedMotion:'reduce'});check('reduced motion disables sidebar transition',await page.locator('.workspace-sidebar-host').evaluate(el=>getComputedStyle(el).transitionDuration)==='0s');await page.emulateMedia({reducedMotion:'no-preference'});
 await sidebar(true);out.events.push(...await page.evaluate(()=>window.__events||[]));await app.close();await start();check('restart sidebar hidden',await page.locator('.workspace-shell').getAttribute('data-sidebar-collapsed')==='true');await dialog('Project Alpha').waitFor();check('restart A content',await dialog('Project Alpha').getByText('README.md',{exact:true}).count()>0);for(let i=0;i<3;i++){await sidebar(false);await sidebar(true)}await sidebar(false);check('restart global width',await page.locator('.workspace-sidebar-host').evaluate(el=>el.getBoundingClientRect().width)===460);await switchTo(b,'Project Delta');await dialog('Project Delta').waitFor();await settings();check('restart B source',await page.getByText(rootB,{exact:true}).count()>0);await page.getByRole('button',{name:'Back to workspace'}).click();await panel().getByRole('button',{name:/Hide right panel/}).click();await switchTo(a,'Project Alpha');await switchTo(b,'Project Delta');check('closed preview stays closed',await panel().getAttribute('data-open')==='false');
 await snapshot('final');
}catch(e){out.error=e.stack;try{await snapshot('failure')}catch{}}finally{try{out.events.push(...await page.evaluate(()=>window.__events||[]))}catch{}await writeFile(`${dir}/${phase}-results.json`,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({checks:out.checks.length,failed:out.checks.filter(c=>!c.passed),error:out.error,events:out.events.length},null,2));if(app)await app.close().catch(()=>{});if(out.error)process.exitCode=1}
