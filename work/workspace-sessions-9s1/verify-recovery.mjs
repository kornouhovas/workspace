import {_electron as electron} from '@playwright/test';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {createWorkspaceIpcHandler} from '../../electron/workspaceIpc.js';
const dir='work/workspace-sessions-9s1/evidence', phase=process.argv[2]||'renderer-matrix';
const f=JSON.parse(await readFile(`${dir}/fixture.json`));
const rootB=join(f.fixture,'projects-b');await mkdir(join(rootB,'Review','Project Delta','docs'),{recursive:true});await writeFile(join(rootB,'Review','Project Delta','docs','delta.txt'),'Delta workspace content');
const handler=createWorkspaceIpcHandler({configPath:join(f.metadata,'settings.json'),propertyStorePath:join(f.metadata,'properties.json'),viewStorePath:join(f.metadata,'views.json'),chooseRoot:async()=>rootB});
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
async function click(locator,wait=270){await locator.click();await delay(wait)}
async function sidebar(collapsed){await click(card(collapsed?'Hide sidebar':'Show sidebar'));check(`CDP sidebar ${collapsed}`,await page.locator('.workspace-shell').getAttribute('data-sidebar-collapsed')===String(collapsed));const toggle=await page.getByRole('button',{name:collapsed?'Show sidebar':'Hide sidebar',exact:true}).boundingBox();const forward=await card('Go forward').boundingBox();check('toggle remains right of arrows',toggle.x>=forward.x+forward.width,{toggle,forward})}
async function switchTo(id,name){await page.locator(`[data-workspace-row-id="${id}"] > button`).first().click();await card(name).or(dialog(name)).first().waitFor();await delay(320);check(`active ${id}`,(await page.evaluate(()=>window.workspace.request('workspace.getRoot'))).root.workspaceId===id)}
async function settings(){await page.locator('.workspace-sidebar').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('heading',{name:/Source ·/}).waitFor()}
async function pick(path){await app.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:!path,filePaths:path?[path]:[]})},path);await page.getByRole('button',{name:/Select folder|Change folder/,exact:false}).click();await delay(400)}
async function frameStart(){await page.evaluate(()=>{window.__frames=[];const start=performance.now();const tick=()=>{const sidebar=document.querySelector('.workspace-sidebar-host'),right=document.querySelector('.bb-right-panel'),tab=document.querySelector('[data-view-tab-id]');window.__frames.push({t:performance.now()-start,left:sidebar.getBoundingClientRect().width,right:right.getBoundingClientRect().width,titleX:tab?.getBoundingClientRect().x,dialog:right.querySelector('[role=dialog]')?.getAttribute('aria-label'),toggleX:document.querySelector('[title="Hide sidebar"],[title="Show sidebar"]')?.getBoundingClientRect().x});if(performance.now()-start<900)requestAnimationFrame(tick)};requestAnimationFrame(tick)})}
try{
 await start();
 await rename(rootB,rootB+'-offline-check');
 await page.locator(`[data-workspace-row-id="${b}"] > button`).first().click();await delay(400);await settings();
 check('unavailable stored source keeps path',await page.getByText(rootB,{exact:true}).count()>0);
 check('unavailable has no stale role tree or mock properties',await page.getByText('Active',{exact:true}).count()===0);
 check('settings suppresses empty preview host',await width()===0);
 await page.locator(`[data-workspace-row-id="${a}"] > button`).first().click();await card('Project Alpha').waitFor();
 check('unavailable B does not block A',await card('Project Alpha').count()===1);
 await rename(rootB+'-offline-check',rootB);
 await snapshot('recovery-final');
}catch(e){out.error=e.stack;try{await snapshot('failure')}catch{}}finally{try{await rename(rootB+'-offline-check',rootB)}catch{}try{out.events.push(...await page.evaluate(()=>window.__events||[]))}catch{}await writeFile(`${dir}/${phase}-results.json`,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({checks:out.checks.length,failed:out.checks.filter(c=>!c.passed),error:out.error,events:out.events.length},null,2));if(out.error&&process.env.KEEP_OPEN)await delay(45000);if(app)await app.close().catch(()=>{});if(out.error)process.exitCode=1}
