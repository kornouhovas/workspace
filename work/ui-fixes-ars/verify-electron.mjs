import { _electron as electron } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const fixture=JSON.parse(await readFile('work/ui-fixes-ars/evidence/fixture.json','utf8'));
const phase=process.argv[2]||'after';
let app=await electron.launch({executablePath:join(fixture.app,'Contents/MacOS/Electron'),args:['electron/main.js'],env:{...process.env,WORKSPACE_DEV:'1',WORKSPACE_DEV_DATA:fixture.metadata,WORKSPACE_DEV_URL:''}});
let page=await app.firstWindow();page.setDefaultTimeout(8000);
await page.waitForLoadState();
await page.evaluate(()=>{localStorage.removeItem('workspace.project-tabs.v1');localStorage.removeItem('workspace.pane-layout.v1');});
await page.reload();const out={phase,checks:[],errors:[]};
page.on('pageerror',e=>out.errors.push(e.message));
const check=async(name,fn)=>{try {await fn();out.checks.push({name,passed:true});}catch(e){out.checks.push({name,passed:false,error:e.message});}};
const assert=(value,msg)=>{if(!value)throw Error(msg)};
const shot=async(name)=>page.screenshot({path:`work/ui-fixes-ars/evidence/${phase}-${name}.png`});
try {
await page.getByRole('button',{name:'Project Alpha',exact:true}).waitFor();
await check('native isolated security',async()=>{const x=await app.evaluate(({app,BrowserWindow})=>({path:app.getPath('userData'),prefs:BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()}));assert(x.path===join(fixture.metadata,'electron'),'wrong userData');assert(x.prefs.contextIsolation&&!x.prefs.nodeIntegration&&x.prefs.sandbox,'security changed');});
await page.getByRole('tab',{name:'Table',exact:true}).click();
await check('empty Notes has property and project name',async()=>{assert(await page.getByRole('button',{name:/Notes.*Project Alpha|Project Alpha.*Notes/}).count()>0,'empty Notes unnamed');});
if(phase!=='before') {
 await page.getByRole('button',{name:/^Notes — Project Alpha/}).click();
 await page.getByRole('textbox',{name:/Notes.*Project Alpha/}).fill('ARS preserved note');
 await page.keyboard.press('Tab');
 await page.getByRole('button',{name:'Notes — Project Alpha: ARS preserved note',exact:true}).waitFor();
}

await page.getByRole('tab',{name:'Board',exact:true}).click();
await page.getByRole('button',{name:'Project Alpha',exact:true}).click();
await page.getByRole('dialog').waitFor();
await check('no Open in split command',async()=>assert(await page.getByRole('button',{name:'Open in split',exact:true}).count()===0,'split button present'));
await shot('preview');
await check('bb expand glyph is13px in28px hit area',async()=>{const b=page.getByRole('button',{name:/Maximize pane/}).last();const r=await b.boundingBox();const icon=await b.locator('svg').boundingBox();assert(r.width===28&&r.height===28&&icon.width===13&&icon.height===13,JSON.stringify({r,icon}));await b.screenshot({path:`work/ui-fixes-ars/evidence/${phase}-expand-icon.png`});});
// Capture baseline and use actual chrome action to expand.
await page.getByRole('button',{name:/Maximize pane/}).last().click();
await check('expanded hides right panel',async()=>assert(await page.locator('[data-testid="workspace-right-panel"]').count()===0,'Navigation still visible'));
await shot('expanded');
await check('bb restore glyph is13px in28px hit area',async()=>{const b=page.getByRole('button',{name:'Restore side panel',exact:true});const r=await b.boundingBox();const icon=await b.locator('svg').boundingBox();assert(r.width===28&&r.height===28&&icon.width===13&&icon.height===13,JSON.stringify({r,icon}));await b.screenshot({path:`work/ui-fixes-ars/evidence/${phase}-restore-icon.png`});});
await page.getByRole('tab',{name:'Board',exact:true}).click();
const tabs=page.getByRole('tab',{name:'Project Alpha',exact:true});
await page.evaluate(()=>{window.__arsFrames=[];let n=0;const observe=()=>{const el=document.querySelector('[role="dialog"]');window.__arsFrames.push({name:el?.textContent.slice(0,80),transform:el?getComputedStyle(el).transform:null,animations:el?.getAnimations().length});if(++n<24)requestAnimationFrame(observe)};requestAnimationFrame(observe);});
await tabs.first().click();
await check('expanded content visible immediately without transform animation',async()=>{const x=await page.getByRole('dialog').evaluate(el=>({transform:getComputedStyle(el).transform,animations:el.getAnimations().length}));assert(x.transform==='none'||x.transform==='matrix(1, 0, 0, 1, 0, 0)','translated content '+x.transform);assert(x.animations===0,'animated');});
await shot('selected-expanded');
await page.waitForTimeout(450);
out.transitionFrames=await page.evaluate(()=>window.__arsFrames);
assert(out.transitionFrames.filter(f=>f.transform).every(f=>f.transform==='none'||f.transform==='matrix(1, 0, 0, 1, 0, 0)'),'transition translated');
await page.getByRole('tab',{name:'Board',exact:true}).click();
await page.getByRole('button',{name:'Project Beta',exact:true}).click();
await page.getByRole('button',{name:/Maximize pane/}).last().click();
const identities=await page.evaluate(()=>JSON.parse(localStorage.getItem('workspace.project-tabs.v1')));
await page.getByRole('tab',{name:'Project Alpha',exact:true}).click();
await check('switch expanded tabs retains identities and correct content',async()=>{assert(await page.getByRole('heading',{name:'Project Alpha',exact:true}).count()>0,'Alpha not displayed');assert(await page.getByRole('tab',{name:'Project Beta',exact:true}).count()===1,'Beta tab lost');assert(JSON.stringify((await page.evaluate(()=>JSON.parse(localStorage.getItem('workspace.project-tabs.v1')))).tabs)===JSON.stringify(identities.tabs),'identities changed');});
await page.getByRole('tab',{name:'Project Beta',exact:true}).click();
await page.keyboard.press('Meta+w');
await page.keyboard.press('Meta+Shift+t');
await check('close and keyboard reopen retains Beta',async()=>assert(await page.getByRole('tab',{name:'Project Beta',exact:true}).count()===1,'Beta not reopened'));
await page.getByRole('tab',{name:'Board',exact:true}).click();
// Build a legacy saved layout from the tabs actually created through the UI.
await page.evaluate(({workspaceId})=>{
 const saved=JSON.parse(localStorage.getItem('workspace.project-tabs.v1'));
 const alpha=saved.tabs[workspaceId].find(t=>t.name==='Project Alpha');
 saved.screens[workspaceId]={viewId:'view:default-board',tabId:null};
 localStorage.setItem('workspace.project-tabs.v1',JSON.stringify(saved));
 const layouts=JSON.parse(localStorage.getItem('workspace.pane-layout.v1'));
 const layout=layouts.layouts[workspaceId];
 layout.tree={type:'split',dir:'col',sizes:[0.5,0.5],children:[{type:'pane',paneId:'workspace',tabId:null},{type:'pane',paneId:'alpha-saved',tabId:alpha.tabId}]};
 layout.rightVisible=true;layout.maximized=null;layout.focused='workspace';layout.sidebarCollapsed=false;
 localStorage.setItem('workspace.pane-layout.v1',JSON.stringify(layouts));
},fixture);
await page.reload();
await page.getByRole('button',{name:'Project Beta',exact:true}).click();
await check('Beta opens beside restored split without replacing Alpha',async()=>{await page.getByRole('dialog').getByRole('heading',{name:'Project Beta',exact:true}).waitFor();assert(await page.getByRole('dialog').getByRole('heading',{name:'Project Alpha',exact:true}).count()===1,'Alpha lost');assert(await page.locator('[data-pane-id="alpha-saved"]').count()===1,'saved pane lost');});
await shot('saved-split-beta');
await page.getByRole('tab',{name:'Project Alpha',exact:true}).click();
await check('select saved split tab expands with Board escape route',async()=>{assert(await page.getByRole('tab',{name:'Board',exact:true}).count()===1,'no Board route');assert(await page.locator('[data-testid="workspace-right-panel"]').count()===0,'Navigation visible');});
await page.getByRole('tab',{name:'Board',exact:true}).click();
await check('return Board preserves split tree',async()=>assert(await page.locator('[data-pane-id="alpha-saved"]').count()===1,'saved pane removed'));

await page.getByRole('tab',{name:'Table',exact:true}).click();
await page.getByRole('button',{name:'Project Beta',exact:true}).click();
await check('Table Beta opens with existing split',async()=>assert(await page.getByRole('heading',{name:'Project Beta',exact:true}).count()===1,'Beta not in preview'));
await page.getByRole('button',{name:/Close pane/}).last().click();
await page.getByRole('button',{name:'Settings',exact:true}).first().click();
for(const theme of ['Light','Dark']) {
 await page.getByRole('combobox',{name:'Appearance',exact:true}).click();
 await page.getByRole('option',{name:theme,exact:true}).click();
 for(const [width,height] of [[1440,960],[1024,720]]) {
  await app.evaluate(({BrowserWindow},{width,height})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(width,height);w.webContents.setZoomFactor(1);},{width,height});
  await page.setViewportSize({width,height});
  const metrics={renderer:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),window:await app.evaluate(({BrowserWindow})=>({contentSize:BrowserWindow.getAllWindows()[0].getContentSize(),zoomFactor:BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()}))};
  out.checks.push({name:`viewport ${theme} ${width}`,metrics});
  await shot(`settings-${theme}-${width}`);
  await check(`Settings controls contained ${theme} ${width}`,async()=>{const failures=await page.locator('.workspace-folder-role-row').evaluateAll(rows=>rows.flatMap(row=>{const r=row.getBoundingClientRect();return [...row.querySelectorAll('button')].filter(b=>{const x=b.getBoundingClientRect();return x.x<r.x||x.right>r.right+1}).map(b=>b.getAttribute('aria-label'));}));assert(failures.length===0,JSON.stringify(failures));});
  await page.getByRole('button',{name:'Hide sidebar',exact:true}).click();
  await check(`collapsed toolbar disjoint ${theme} ${width}`,async()=>{const labels=['Show sidebar','Go back','Go forward'];const boxes=await Promise.all(labels.map(async name=>{const b=page.getByRole('button',{name,exact:true});return b.boundingBox();}));assert(boxes.every(Boolean),'missing chrome');for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(a.x+a.width<=b.x||b.x+b.width<=a.x,'overlap');}assert(boxes[0].x>=90,'traffic lights overlap');});
  await shot(`collapsed-${theme}-${width}`);
  await page.getByRole('button',{name:'Show sidebar',exact:true}).click();
  await page.getByRole('button',{name:'Back to workspace',exact:true}).click();
  await page.getByRole('tab',{name:'Project Alpha',exact:true}).click();
  await shot(`expanded-${theme}-${width}`);
  await page.getByRole('button',{name:'Restore side panel',exact:true}).click();
  await shot(`restored-${theme}-${width}`);
  await check(`restore preview keeps Alpha value ${theme} ${width}`,async()=>assert(await page.getByRole('dialog').getByText('ARS preserved note',{exact:true}).count()>0,'note lost'));
  await page.getByRole('button',{name:/Maximize pane/}).last().click();
  await page.getByRole('button',{name:'Settings',exact:true}).first().click();
 }

}
await page.getByRole('button',{name:'Back to workspace',exact:true}).click();
await page.getByRole('tab',{name:'Project Alpha',exact:true}).click();
await check('expanded hides explicit Navigation and fills available area',async()=>{assert(await page.locator('[data-testid="workspace-right-panel"]').count()===0,'right visible');const shell=await page.locator('[data-testid="workspace-main"]').boundingBox();assert(Math.abs(shell.width-(1024-320))<1,'wrong expanded width '+shell.width);});
await shot('expanded-dark-1024');
await page.reload();
await check('reload keeps active expanded Alpha and Beta identity',async()=>{await page.getByRole('heading',{name:'Project Alpha',exact:true}).waitFor();assert(await page.getByRole('tab',{name:'Project Beta',exact:true}).count()===1,'Beta lost');assert(await page.locator('[data-testid="workspace-right-panel"]').count()===0,'right returns');});
const beforeRestart=await page.evaluate(()=>JSON.parse(localStorage.getItem('workspace.project-tabs.v1')));
await app.close();
app=await electron.launch({executablePath:join(fixture.app,'Contents/MacOS/Electron'),args:['electron/main.js'],env:{...process.env,WORKSPACE_DEV:'1',WORKSPACE_DEV_DATA:fixture.metadata,WORKSPACE_DEV_URL:''}});
page=await app.firstWindow();page.setDefaultTimeout(8000);
await check('real Electron restart restores expanded screen and tab identities',async()=>{await page.getByRole('dialog').getByRole('heading',{name:'Project Alpha',exact:true}).waitFor();const afterRestart=await page.evaluate(()=>JSON.parse(localStorage.getItem('workspace.project-tabs.v1')));assert(JSON.stringify(beforeRestart.tabs)===JSON.stringify(afterRestart.tabs),'tabs changed');assert(await page.locator('[data-testid="workspace-right-panel"]').count()===0,'right returns');});
await page.getByRole('button',{name:'Restore side panel',exact:true}).click();
await check('restore after restart retains Alpha note',async()=>{await page.getByRole('dialog').getByText('ARS preserved note',{exact:true}).waitFor();});
await shot('restart-restore');


} catch(e){out.errors.push(e.stack);await shot('failure');out.geometry=await page.locator('[role=tab]').evaluateAll(els=>els.map(e=>({label:e.getAttribute('aria-label'),rect:e.getBoundingClientRect().toJSON(),parent:e.parentElement.parentElement.getBoundingClientRect().toJSON()})));} finally {await writeFile(`work/ui-fixes-ars/evidence/${phase}-results.json`,JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));await app.close();if(out.errors.length||out.checks.some(c=>c.passed===false))process.exitCode=1;}
