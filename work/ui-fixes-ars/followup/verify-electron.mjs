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
try{
 await page.getByRole('button',{name:'Project Alpha',exact:true}).waitFor();
 await page.evaluate(()=>localStorage.removeItem('workspace.pane-layout.v1'));await page.reload();await page.getByRole('button',{name:'Project Alpha',exact:true}).waitFor();
 await page.evaluate(()=>{window.__nativeEvents=[];document.addEventListener('pointerdown',e=>window.__nativeEvents.push({type:e.type,trusted:e.isTrusted,x:e.clientX,y:e.clientY,label:e.target.closest('button')?.getAttribute('aria-label')}),true);});
 await page.screenshot({path:`${dir}/${phase}-initial.png`});
 out.checks.push({name:'no main right toggle',passed:await page.getByRole('main').getByRole('button',{name:/Show right panel/}).count()===0});
 for(let cycle=0;cycle<3;cycle++){
  const hidden=await click('Hide sidebar');
  const shown=await click('Show sidebar');
  out.checks.push({name:`native cycle ${cycle+1}`,passed:hidden==='true'&&shown==='false'});
  if(shown!=='false')break;
 }
 await page.getByRole('button',{name:'Project Alpha',exact:true}).click();
 out.mainButtons=await page.getByRole('main').getByRole('button').allTextContents();
 out.checks.push({name:'no duplicate preview expand in main',passed:await page.getByRole('main').getByRole('button',{name:'Expand project',exact:true}).count()===0});
 out.checks.push({name:'no right plus',passed:await page.getByTestId('workspace-right-panel').getByRole('button',{name:/Open new tab/}).count()===0});
 await page.screenshot({path:`${dir}/${phase}-preview.png`});
 out.nativeEvents=await page.evaluate(()=>window.__nativeEvents);
 await page.screenshot({path:`${dir}/${phase}-end.png`});
}catch(e){out.error=e.stack;}finally{await writeFile(`${dir}/${phase}-results.json`,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));await app.close();if(out.error||out.checks.some(c=>!c.passed))process.exitCode=1;}
