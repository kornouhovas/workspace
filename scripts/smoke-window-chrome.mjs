/* global window, document */
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, realpath, writeFile, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {_electron} from 'playwright-core';
import {runtimeSmokeLaunch} from './runtime-executable.mjs';
import {closeElectron, cleanupOwnedFixture, ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {openSettingsSection, returnToWorkspace, setInterfaceLanguage} from './runtime-settings.mjs';

const root=resolve(import.meta.dirname,'..');
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-window-chrome-')));
const source=join(fixture,'Studio');
await mkdir(join(source,'Active','Atlas'),{recursive:true});
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-79-window-chrome');
await mkdir(evidence,{recursive:true});
const parents=new Set(),backends=new Set();
const report={issue:79,sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),platform:process.platform,mode:process.env.WORKSPACE_SMOKE_MODE??'dev',run:process.env.GITHUB_RUN_ID??null,checks:[],screens:[],status:'running'};
let app,page,failure,launchUnverified=true;
async function geometry(){return app.evaluate(({BrowserWindow})=>{
  const w=BrowserWindow.getAllWindows()[0],p=w.webContents.getLastWebPreferences();
  return {outer:w.getBounds(),content:w.getContentBounds(),minimum:w.getMinimumSize(),buttons:process.platform==='darwin'?w.getWindowButtonPosition():null,isolation:[p.contextIsolation,p.nodeIntegration,p.sandbox]};
});}
try {
  app=await _electron.launch({...runtimeSmokeLaunch(root),cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data'),WORKSPACE_TEST_ROOT_PICKER_PATH:source}});
  parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
  await page.locator('.workspace-screen[data-ready="true"]').waitFor();
  for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid)))backends.add(pid);
  assert.ok(backends.size);launchUnverified=false;
  report.geometry=await geometry();
  assert.deepEqual(report.geometry.isolation,[true,false,true]);
  if(process.platform==='darwin'){
    assert.equal(report.geometry.content.y,report.geometry.outer.y,'macOS content reaches the native top edge without a separate title row');
    assert.deepEqual(report.geometry.buttons,{x:18,y:18});
  }else if(process.platform==='win32'){
    assert.ok(report.geometry.content.y>report.geometry.outer.y,'Windows retains its native title bar');
  }
  await page.getByRole('button',{name:'Add workspace',exact:true}).click();
  await page.getByRole('cell',{name:'Atlas',exact:true}).waitFor();
  for(const language of ['en','ru']){
    await setInterfaceLanguage(page,language);
    for(const theme of ['light','dark']){
      await openSettingsSection(page);
      await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
      await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
      await returnToWorkspace(page);
      for(const size of [{width:1024,height:720},{width:1440,height:960}]){
        await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(size.width,size.height),size);
        await page.getByRole('cell',{name:'Atlas',exact:true}).waitFor();
        const navigation=page.getByRole('button',{name:language==='en'?'Collapse sidebar':'Свернуть боковую панель',exact:true});
        const bounds=await navigation.boundingBox();
        if(process.platform==='darwin')assert.ok(bounds.x>=80&&bounds.y<52,`Navigation shares the native strip: ${JSON.stringify(bounds)}`);
        await navigation.click();
        const restore=page.getByRole('button',{name:language==='en'?'Restore sidebar':'Восстановить боковую панель',exact:true});
        if(process.platform==='darwin')assert.ok((await restore.boundingBox()).x>=80,'Collapsed navigation clears native buttons');
        await restore.focus();await restore.press('Enter');await navigation.waitFor();
        const tab=page.locator('.saved-view-tabs [role="tab"]').first();
        await tab.focus();await tab.press('Enter');
        const tabBounds=await tab.boundingBox();
        if(process.platform==='darwin')assert.ok(tabBounds.y<52,'Saved view tabs share the native strip');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
        const screen=`${language}-${theme}-${size.width}.png`;
        await page.screenshot({path:join(evidence,screen)});report.screens.push(screen);
        await page.getByRole('button',{name:`${language==='en'?'Preview project':'Открыть предпросмотр проекта'}: Atlas`,exact:true}).click();
        await page.getByRole('button',{name:language==='en'?'Expand project':'Развернуть проект',exact:true}).click();
        const projectTab=page.getByRole('tab',{name:'Atlas',exact:true});
        await projectTab.and(page.locator('[aria-selected="true"]')).waitFor();
        if(process.platform==='darwin')assert.ok((await projectTab.boundingBox()).y<52,'Project tabs share the native strip');
        await navigation.click();
        await projectTab.focus();await projectTab.press('Enter');
        const projectMenu=page.getByRole('button',{name:`${language==='en'?'Project tab actions':'Действия с вкладкой проекта'}: Atlas`,exact:true});
        await projectMenu.press('Enter');await page.getByRole('menu').waitFor();
        await page.keyboard.press('Escape');await projectMenu.and(page.locator(':focus')).waitFor();
        await page.screenshot({path:join(evidence,`${language}-${theme}-${size.width}-project-collapsed.png`)});
        await page.getByRole('button',{name:`${language==='en'?'Close project tab':'Закрыть вкладку проекта'}: Atlas`,exact:true}).click();
        await projectTab.waitFor({state:'hidden'});
        await restore.press('Enter');await navigation.waitFor();
        await openSettingsSection(page);await page.getByRole('heading',{name:language==='en'?'General':'Основные',exact:true}).waitFor();
        await returnToWorkspace(page);
        report.checks.push({language,theme,size,navigationPointer:true,restoreKeyboard:true,tabsKeyboard:true,projectTabsAndMenu:true,collapsedProjectClose:true,settingsReturn:true});
      }
    }
  }
  report.lifecycle=[];
  for(const [action,event] of [['minimize','minimize'],['restore','restore'],['fullscreen','enter-full-screen'],['windowed','leave-full-screen']]){
    await app.evaluate(({BrowserWindow},{action,event})=>new Promise((resolve,reject)=>{
      const w=BrowserWindow.getAllWindows()[0];
      const timer=setTimeout(()=>{w.removeListener(event,done);reject(new Error(`Window ${action} timed out`));},10000);
      function done(){clearTimeout(timer);resolve({minimized:w.isMinimized(),fullscreen:w.isFullScreen()});}
      w.once(event,done);
      if(action==='fullscreen'||action==='windowed')w.setFullScreen(action==='fullscreen');
      else if(action==='minimize')w.minimize();else w.restore();
    }),{action,event});
    report.lifecycle.push(action);
  }
  if(process.env.WORKSPACE_WINDOW_CHROME_MANUAL==='1'){
    await app.evaluate(({BrowserWindow})=>{
      const w=BrowserWindow.getAllWindows()[0];w.setSize(1024,720);w.center();w.focus();
      globalThis.chromeEvents=[];
      for(const event of ['move','resize','minimize','restore','maximize','unmaximize','enter-full-screen','leave-full-screen','close'])w.on(event,()=>globalThis.chromeEvents.push({event,time:Date.now(),bounds:w.getBounds()}));
    });
    await writeFile(join(evidence,'manual-ready.json'),JSON.stringify({pid:app.process().pid,fixture}));
    page.on('close',()=>{report.nativeCloseRequested=true;});
    const deadline=Date.now()+600000;
    while(Date.now()<deadline){
      try{
        report.native=await app.evaluate(({BrowserWindow})=>{
          const w=BrowserWindow.getAllWindows()[0];return {bounds:w?.getBounds(),minimized:w?.isMinimized(),fullscreen:w?.isFullScreen(),events:globalThis.chromeEvents};
        });
      }catch(error){if(report.nativeCloseRequested)break;throw error;}
      await writeFile(join(evidence,'native-observation.json'),JSON.stringify(report.native,null,2));
      if(await access(join(evidence,'manual-finished')).then(()=>true,()=>false))break;
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    assert.ok(Date.now()<deadline,'Manual native evidence timed out');
  }
}catch(error){failure=error;if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally{
  try{if(app&&app.process().exitCode===null)await closeElectron(app);}catch(error){failure??=error;}
  if(report.nativeCloseRequested)assert.equal(app.process().exitCode,0,'Native Close exits normally');
  report.stopped=ownedProcessesStopped(parents,backends,{launchUnverified});
  try{report.cleanup=await cleanupOwnedFixture(fixture,{processesStopped:report.stopped,record:result=>{report.cleanup=result;}});}catch(error){failure??=error;}
  report.status=failure?'failed':'passed';report.error=failure?.stack;
  await writeFile(join(evidence,'result.json'),JSON.stringify(report,null,2));
}
if(failure)throw failure;
console.log(JSON.stringify(report));
