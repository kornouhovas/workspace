import { _electron as electron } from '@playwright/test';
import { readFile,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const dir='work/ui-fixes-ars/followup/evidence';
const fixture=JSON.parse(await readFile(`${dir}/fixture.json`,'utf8'));
const phase=process.argv[2]||'before';
const launch=()=>electron.launch({executablePath:join(fixture.app,'Contents/MacOS/Electron'),args:['electron/main.js'],env:{...process.env,WORKSPACE_DEV:'1',WORKSPACE_DEV_DATA:fixture.metadata,WORKSPACE_DEV_URL:''}});
let app=await launch(),page=await app.firstWindow();page.setDefaultTimeout(5000);
const out={phase,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],events:[]};
async function click(name){
 const button=page.getByRole('button',{name,exact:true});
 const box=await button.boundingBox();if(!box)throw Error(`missing ${name}`);
 const window=await app.evaluate(({BrowserWindow,app})=>{app.focus({steal:true});const w=BrowserWindow.getAllWindows()[0];w.show();w.focus();return {content:w.getContentBounds(),bounds:w.getBounds(),position:w.getWindowButtonPosition(),url:w.webContents.getURL()};});
 const hit=await button.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),appRegion:getComputedStyle(el).getPropertyValue('-webkit-app-region'),target:document.elementFromPoint(el.getBoundingClientRect().x+el.getBoundingClientRect().width/2,el.getBoundingClientRect().y+el.getBoundingClientRect().height/2)?.outerHTML.slice(0,200)}));
 execFileSync('/tmp/workspace-ars-native-click',[String(window.content.x+box.x+box.width/2),String(window.content.y+box.y+box.height/2)]);
 await page.waitForTimeout(250);
 const collapsed=await page.locator('.workspace-shell').getAttribute('data-sidebar-collapsed');
 out.events.push({name,window,hit,collapsed});
 return collapsed;
}
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const check=(name,ok)=>{out.checks.push({name,passed:!!ok});assert(ok,name);};
const snapshot=async name=>page.screenshot({path:`${dir}/${phase}-${name}.png`});
async function captureEvents(){out.nativeEvents=(out.nativeEvents||[]).concat(await page.evaluate(()=>window.__nativeEvents||[]));}
async function listen(){await page.evaluate(()=>{window.__nativeEvents=[];document.addEventListener('pointerdown',e=>window.__nativeEvents.push({type:e.type,trusted:e.isTrusted,x:e.clientX,y:e.clientY,label:e.target.closest('button')?.getAttribute('aria-label')}),true);});}
try{
 await page.getByRole('button',{name:'Project Alpha',exact:true}).waitFor();
 await page.evaluate(()=>{localStorage.removeItem('workspace.pane-layout.v1');localStorage.removeItem('workspace.project-tabs.v1');});await page.reload();
 await page.getByRole('button',{name:'Project Alpha',exact:true}).waitFor();await listen();
 check('main right panel toggle removed',await page.getByRole('main').getByRole('button',{name:/Show right panel/}).count()===0);
 for(const theme of ['Light','Dark']){
  await page.locator('.workspace-sidebar').getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('combobox',{name:'Appearance',exact:true}).click();await page.getByRole('option',{name:theme,exact:true}).click();
  await page.getByRole('button',{name:'Back to workspace',exact:true}).click();
  for(const [width,height] of [[1440,960],[1024,720]]){
   await app.evaluate(({BrowserWindow},{width,height})=>{const w=BrowserWindow.getAllWindows()[0];w.setPosition(30,50);w.setContentSize(width,height);w.webContents.setZoomFactor(1);},{width,height});
   await page.setViewportSize({width,height});
   const metrics={renderer:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),native:await app.evaluate(({BrowserWindow})=>({bounds:BrowserWindow.getAllWindows()[0].getContentBounds(),zoom:BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()}))};
   check(`measured ${theme} ${width}`,metrics.renderer.width===width&&metrics.renderer.height===height&&metrics.native.bounds.width===width&&metrics.native.bounds.height===height&&metrics.native.zoom===1);out.checks.at(-1).metrics=metrics;
   for(const view of ['Board','Table']){
    await page.getByRole('tab',{name:view,exact:true}).click();
    for(const right of [false,true]){
     if(right)await page.getByRole('button',{name:'Project Alpha',exact:true}).click();
     const name=`${theme}-${width}-${view}-right${right}`;
     const before=await page.locator('.workspace-sidebar').boundingBox();
     for(let cycle=1;cycle<=3;cycle++){
      check(`${name} cycle${cycle} hide`,await click('Hide sidebar')==='true');
      check(`${name} cycle${cycle} show`,await click('Show sidebar')==='false');
      const restored=await page.locator('.workspace-sidebar').boundingBox();
      check(`${name} cycle${cycle} width/content`,restored.width===before.width&&await page.locator('.workspace-sidebar').getByRole('button',{name:'Settings',exact:true}).isVisible());
     }
     if(right){
      check(`${name} no duplicate main controls`,await page.getByRole('main').getByRole('button',{name:/^(Expand project|Close project details|Show right panel)/}).count()===0);
      check(`${name} no right plus`,await page.getByTestId('workspace-right-panel').getByRole('button',{name:/Open new tab/}).count()===0);
      check(`${name} main Add view preserved`,await page.getByRole('main').getByRole('button',{name:'Add Board or Table view',exact:true}).count()===1);
     }
     await snapshot(name);
     if(right)await page.getByTestId('workspace-right-panel').getByRole('button',{name:/Hide right panel/}).click();
    }
   }
  }
 }
 // Preserve card controls and demonstrate keyboard remains additional, not the pointer proof.
 await page.getByRole('button',{name:'Project Alpha',exact:true}).click();
 await page.getByTestId('workspace-right-panel').getByRole('button',{name:/Maximize pane/}).click();
 await page.getByRole('button',{name:'Restore side panel',exact:true}).click();
 check('right card expand/restore keeps Alpha',await page.getByRole('dialog').getByRole('heading',{name:'Project Alpha',exact:true}).count()===1);
 await page.getByTestId('workspace-right-panel').getByRole('button',{name:/Hide right panel/}).click();
 await page.keyboard.press('Meta+\\');check('keyboard collapse',await page.locator('.workspace-shell').getAttribute('data-sidebar-collapsed')==='true');
 await page.keyboard.press('Meta+\\');check('keyboard expand',await page.locator('.workspace-shell').getAttribute('data-sidebar-collapsed')==='false');
 check('collapse before restart',await click('Hide sidebar')==='true');await captureEvents();
 await app.close();app=await launch();page=await app.firstWindow();page.setDefaultTimeout(5000);
 await page.getByRole('button',{name:'Show sidebar',exact:true}).waitFor();await listen();
 check('restart retains collapsed',await page.locator('.workspace-shell').getAttribute('data-sidebar-collapsed')==='true');
 check('native expand after restart',await click('Show sidebar')==='false');
 check('restart restores sidebar width/content',(await page.locator('.workspace-sidebar').boundingBox()).width===320&&await page.locator('.workspace-sidebar').getByRole('button',{name:'Settings',exact:true}).isVisible());
 await snapshot('restart-expanded');await captureEvents();
}catch(e){out.error=e.stack;await snapshot('failure');await captureEvents();}finally{await writeFile(`${dir}/${phase}-results.json`,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({phase,checks:out.checks.length,failed:out.checks.filter(c=>!c.passed),error:out.error,nativeEvents:out.nativeEvents?.length},null,2));await app.close();if(out.error||out.checks.some(c=>!c.passed))process.exitCode=1;}
