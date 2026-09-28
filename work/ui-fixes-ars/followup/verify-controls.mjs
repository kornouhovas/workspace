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
 await page.getByRole('button',{name:'Project Alpha',exact:true}).waitFor();await listen();
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setPosition(30,50);w.setContentSize(1024,720);});await page.setViewportSize({width:1024,height:720});
 await page.getByRole('button',{name:'Project Alpha',exact:true}).click();
 check('native collapse right preview',await click('Hide sidebar')==='true');await snapshot('collapsed-preview');
 check('native expand right preview',await click('Show sidebar')==='false');
 await page.getByTestId('workspace-right-panel').getByRole('button',{name:/Hide right panel/}).click();
 const initial=await page.getByRole('tab').count();
 let created=0;
 for(const kind of ['Board','Table']){
  await page.getByRole('button',{name:'Add Board or Table view',exact:true}).click();await page.getByRole('menuitem',{name:`New ${kind} View`,exact:true}).click();
  created++;await page.waitForFunction(expected=>document.querySelectorAll('[role=tab]').length===expected,initial+created);await page.getByRole('menu').waitFor({state:'hidden'});
 }
 check('main plus creates Board and Table',await page.getByRole('tab').count()===initial+2);
 await page.keyboard.press('Meta+t');await page.keyboard.press('Meta+t');
 check('keyboard launcher still supported and deduplicated',await page.getByTestId('workspace-right-panel').getByRole('tab',{name:'New tab',exact:true}).count()===1);
 check('right plus absent with existing tab',await page.getByTestId('workspace-right-panel').getByRole('button',{name:/Open new tab/}).count()===0);
 await page.reload();await page.getByTestId('workspace-right-panel').getByRole('tab',{name:'New tab',exact:true}).waitFor();
 check('existing right tab survives reload',await page.getByTestId('workspace-right-panel').getByRole('tab',{name:'New tab',exact:true}).count()===1);
 await snapshot('retained-tabs');
}catch(e){out.error=e.stack;await snapshot('failure');}finally{await writeFile(`${dir}/${phase}-results.json`,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({checks:out.checks,error:out.error},null,2));await app.close();if(out.error||out.checks.some(c=>!c.passed))process.exitCode=1;}
