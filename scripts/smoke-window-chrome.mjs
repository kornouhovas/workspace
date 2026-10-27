/* global window, document */
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, realpath, writeFile, access, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {_electron} from 'playwright-core';
import {runtimeSmokeLaunch} from './runtime-executable.mjs';
import {closeElectron, cleanupOwnedFixture, ownedProcessesStopped, withDeadline} from './runtime-lifecycle.mjs';
import {openSettingsSection, returnToWorkspace, setInterfaceLanguage} from './runtime-settings.mjs';

const root=resolve(import.meta.dirname,'..');
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-window-chrome-')));
const source=join(fixture,'Studio');
await mkdir(join(source,'Active','Atlas'),{recursive:true});
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-79-window-chrome');
const restoreControl=process.env.WORKSPACE_WINDOW_CHROME_RESTORE_CONTROL==='1';
const focusControl=process.env.WORKSPACE_WINDOW_CHROME_FOCUS_CONTROL==='1';
const boundedControl=restoreControl||focusControl;
await mkdir(evidence,{recursive:true});
const parents=new Set(),backends=new Set();
const report={issue:79,sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),platform:process.platform,mode:process.env.WORKSPACE_SMOKE_MODE??'dev',run:process.env.GITHUB_RUN_ID??null,checks:[],screens:[],status:'running'};
report.diagnostic=false;
report.profile=focusControl?'focus-control':restoreControl?'disabled-control':'normal';
report.harnessSha256=createHash('sha256').update(await readFile(import.meta.filename)).digest('hex');
report.dirty=!!execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8'}).trim();
let app,page,child,failure,launchUnverified=true;
async function restoreSidebar(afterCloseFocus){
  const deadline=Date.now()+15000;
  const remaining=()=>Math.max(1,deadline-Date.now());
  // Close owns its next-frame focus return; observe it before moving to Restore.
  if(afterCloseFocus)await afterCloseFocus.and(page.locator(':focus')).waitFor({timeout:remaining()});
  await page.getByRole('button',{name:/^(Restore sidebar|Восстановить боковую панель)$/}).and(page.locator(':enabled')).press('Enter',{timeout:remaining()});
  await page.getByRole('button',{name:/^(Collapse sidebar|Свернуть боковую панель)$/}).waitFor({timeout:Math.max(1,deadline-Date.now())});
}
async function geometry(){return app.evaluate(({BrowserWindow,screen})=>{
  const w=BrowserWindow.getAllWindows()[0],p=w.webContents.getLastWebPreferences();
  const display=screen.getDisplayMatching(w.getBounds());
  return {outer:w.getBounds(),content:w.getContentBounds(),minimum:w.getMinimumSize(),buttons:process.platform==='darwin'?w.getWindowButtonPosition():null,isolation:[p.contextIsolation,p.nodeIntegration,p.sandbox],display:{bounds:display.bounds,workArea:display.workArea,scaleFactor:display.scaleFactor}};
});}
async function capture(name,requested){
  const actual=await geometry();
  assert.deepEqual({width:actual.outer.width,height:actual.outer.height},requested,'Native window must reach the requested size');
  assert.deepEqual(actual.minimum,[1024,720],'Temporary capture constraints must be restored');
  const viewport=await page.evaluate(()=>({width:window.innerWidth,height:window.innerHeight,scale:window.devicePixelRatio}));
  assert.deepEqual({width:viewport.width,height:viewport.height},{width:actual.content.width,height:actual.content.height},'Renderer viewport must match native content bounds');
  const png=await page.screenshot({path:join(evidence,name)});
  const pixels={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
  assert.deepEqual(pixels,{width:Math.round(viewport.width*viewport.scale),height:Math.round(viewport.height*viewport.scale)},'PNG dimensions must match the actual native viewport');
  (report.captures??=[]).push({file:name,requested,actual,viewport,pixels});
}
try {
  app=await _electron.launch({...runtimeSmokeLaunch(root),cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data'),WORKSPACE_TEST_ROOT_PICKER_PATH:source}});
  child=app.process();parents.add(child);page=await app.firstWindow();page.setDefaultTimeout(15000);
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
  await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
  await capture('empty-collapsed.png',{width:1024,height:720});
  await page.getByRole('button',{name:'Restore sidebar',exact:true}).click({timeout:3000});
  await page.getByRole('button',{name:'Collapse sidebar',exact:true}).waitFor();
  await page.getByRole('button',{name:'Add workspace',exact:true}).click();
  await page.getByRole('cell',{name:'Atlas',exact:true}).waitFor();
  for(const language of boundedControl?['en']:['en','ru']){
    await setInterfaceLanguage(page,language);
    for(const theme of boundedControl?['light']:['light','dark']){
      await openSettingsSection(page);
      await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
      await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
      await returnToWorkspace(page);
      for(const size of boundedControl?[{width:1024,height:720}]:[{width:1024,height:720},{width:1440,height:960}]){
        const resized=await app.evaluate(({BrowserWindow,screen},size)=>{
          const w=BrowserWindow.getAllWindows()[0],area=screen.getDisplayMatching(w.getBounds()).workArea;
          const minimum=w.getMinimumSize();
          // Small hosted displays otherwise clamp the requested native height.
          // Allocate the actual window, then restore its product minimum before use.
          w.setMinimumSize(size.width,size.height);
          try{w.setBounds({x:area.x,y:area.y,width:size.width,height:size.height});}
          finally{w.setMinimumSize(...minimum);}
          return w.getContentBounds();
        },size);
        await page.waitForFunction(size=>window.innerWidth===size.width&&window.innerHeight===size.height,resized);
        await page.getByRole('cell',{name:'Atlas',exact:true}).waitFor();
        const navigation=page.getByRole('button',{name:language==='en'?'Collapse sidebar':'Свернуть боковую панель',exact:true});
        const bounds=await navigation.boundingBox();
        if(process.platform==='darwin')assert.ok(bounds.x>=80&&bounds.y<52,`Navigation shares the native strip: ${JSON.stringify(bounds)}`);
        await navigation.click();
        const restore=page.getByRole('button',{name:language==='en'?'Restore sidebar':'Восстановить боковую панель',exact:true});
        if(process.platform==='darwin')assert.ok((await restore.boundingBox()).x>=80,'Collapsed navigation clears native buttons');
        if(process.platform==='darwin') {
          const hitRegion=await restore.evaluate(button=>{const control=button.getBoundingClientRect(),drag=document.querySelector('.view-controls').getBoundingClientRect();return {control:{left:control.left,right:control.right,top:control.top,bottom:control.bottom},drag:{left:drag.left,right:drag.right,top:drag.top,bottom:drag.bottom}};});
          assert.ok(hitRegion.control.right<=hitRegion.drag.left || hitRegion.control.left>=hitRegion.drag.right || hitRegion.control.bottom<=hitRegion.drag.top || hitRegion.control.top>=hitRegion.drag.bottom, `Restore control overlaps native drag region: ${JSON.stringify(hitRegion)}`);
        }
        await restore.click({timeout:3000});
        await navigation.waitFor();
        const tab=page.locator('.saved-view-tabs [role="tab"]').first();
        await tab.focus();await tab.press('Enter');
        const tabBounds=await tab.boundingBox();
        if(process.platform==='darwin')assert.ok(tabBounds.y<52,'Saved view tabs share the native strip');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
        const screen=`${language}-${theme}-${size.width}.png`;
        await capture(screen,size);report.screens.push(screen);
        const previewButton=page.getByRole('button',{name:`${language==='en'?'Preview project':'Открыть предпросмотр проекта'}: Atlas`,exact:true});
        await previewButton.click();
        await page.getByRole('button',{name:language==='en'?'Expand project':'Развернуть проект',exact:true}).click();
        const projectTab=page.getByRole('tab',{name:'Atlas',exact:true});
        await projectTab.and(page.locator('[aria-selected="true"]')).waitFor();
        if(process.platform==='darwin')assert.ok((await projectTab.boundingBox()).y<52,'Project tabs share the native strip');
        await navigation.click();
        await projectTab.focus();await projectTab.press('Enter');
        const projectMenu=page.getByRole('button',{name:`${language==='en'?'Project tab actions':'Действия с вкладкой проекта'}: Atlas`,exact:true});
        await projectMenu.press('Enter');await page.getByRole('menu').waitFor();
        await page.keyboard.press('Escape');await projectMenu.and(page.locator(':focus')).waitFor();
        await capture(`${language}-${theme}-${size.width}-project-collapsed.png`,size);
        // Exercise real deferred app callbacks at the keyboard-focus boundary.
        if(focusControl)await page.evaluate(()=>{
          const frame=window.requestAnimationFrame.bind(window),held=[];
          const state={queued:0,flushed:0,keyTargets:[]};globalThis.chromeFocusControl=state;
          window.requestAnimationFrame=callback=>frame(time=>{held.push(()=>callback(time));state.queued++;});
          const flush=()=>{window.requestAnimationFrame=frame;for(const callback of held.splice(0)){state.flushed++;callback();}};
          document.querySelector('button[aria-label="Restore sidebar"]').addEventListener('focus',()=>queueMicrotask(flush),{once:true});
          document.addEventListener('keydown',event=>{if(event.key==='Enter'&&state.keyTargets.length<16)state.keyTargets.push(event.target.matches('[aria-label="Restore sidebar"]')?'restore':event.target.matches('.project-preview-trigger')?'preview':'other');},true);
          globalThis.releaseChromeFocus=()=>setTimeout(flush,200);
        });
        await page.getByRole('button',{name:`${language==='en'?'Close project tab':'Закрыть вкладку проекта'}: Atlas`,exact:true}).click();
        await projectTab.waitFor({state:'hidden'});
        if(focusControl){await page.waitForFunction(()=>globalThis.chromeFocusControl.queued>0);await restore.and(page.locator(':enabled')).waitFor();await page.evaluate(()=>globalThis.releaseChromeFocus());}
        if(restoreControl){
          await restore.evaluate(element=>{element.disabled=true;setTimeout(()=>{element.disabled=false;},300);});
          report.restoreReadinessControl=true;
        }
        await restoreSidebar(previewButton.or(tab));
        await openSettingsSection(page);await page.getByRole('heading',{name:language==='en'?'General':'Основные',exact:true}).waitFor();
        await capture(`${language}-${theme}-${size.width}-settings.png`,size);
        await navigation.click();
        if(process.platform==='darwin') {
          const settingsInset=await page.locator('.desktop-settings').evaluate(el=>parseFloat(window.getComputedStyle(el,'::before').marginLeft));
          assert.ok(settingsInset>=180, `Settings drag region overlaps collapsed navigation: ${settingsInset}`);
        }
        await restore.click({timeout:3000}); await navigation.waitFor();
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
  if(focusControl&&page&&!page.isClosed())report.focusReadinessControl=await page.evaluate(()=>globalThis.chromeFocusControl).catch(()=>null);
  try{
    if(report.nativeCloseRequested){
      if(child.exitCode===null&&child.signalCode===null)await withDeadline(new Promise(resolve=>child.once('exit',resolve)),10000,'Native Close exit');
      report.nativeExitCode=child.exitCode;
      assert.equal(child.exitCode,0,'Native Close exits normally');
    }else if(app&&child?.exitCode===null)await closeElectron(app);
  }catch(error){failure??=error;}
  report.stopped=ownedProcessesStopped(parents,backends,{launchUnverified});
  try{report.cleanup=await cleanupOwnedFixture(fixture,{processesStopped:report.stopped,record:result=>{report.cleanup=result;}});}catch(error){failure??=error;}
  report.status=failure?'failed':'passed';report.error=failure?.stack;
  await writeFile(join(evidence,'result.json'),JSON.stringify(report,null,2));
}
if(failure)throw failure;
console.log(JSON.stringify(report));
