import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const runtime=JSON.parse(await readFile('work/workspace-jqv/runtime.json','utf8'));
const browser=await chromium.connectOverCDP('http://127.0.0.1:9246');
const page=browser.contexts()[0].pages()[0];
const out='work/workspace-jqv/after';await mkdir(out,{recursive:true});
const shots=[];
for(const theme of ['light','dark'])for(const [width,height] of [[1440,960],[1024,720]]){
 await fetch(`http://127.0.0.1:9247/size?width=${width}&height=${height}`);
 // Isolated test configuration only; no DOM UI clicks or injected UI actions.
 await page.evaluate(theme=>localStorage.setItem('workspace.theme',theme),theme);
 await page.reload();await page.waitForLoadState('networkidle');
 await fetch('http://127.0.0.1:9247/front');
 execFileSync('osascript',['-e',`tell application "System Events" to set frontmost of first application process whose unix id is ${runtime.pid} to true`]);
 const path=`${out}/native-${theme}-${width}x${height}-table.png`;
 const output=execFileSync('/tmp/workspace-jqv-capture-window',[String(runtime.pid),path],{encoding:'utf8'});
 const bytes=await readFile(path);const pixels={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 const state=await page.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight},theme:document.documentElement.className,activeTab:[...document.querySelectorAll('[role=tab][data-state=active]')].map(el=>el.textContent)}));
 const cg=output.match(/Height = (\d+);[\s\S]*?Width = (\d+);/);
 const dimensionsPass=pixels.width===width&&pixels.height===height&&Number(cg?.[1])===height&&Number(cg?.[2])===width;
 shots.push({path,theme,width,height,pixels,dimensionsPass,state,output});
 if(!dimensionsPass)throw Error(`Invalid native dimensions ${path}`);
}
await writeFile(`${out}/partial-native-report.json`,JSON.stringify({status:'partial; no UI interaction gate',source:'current renderer build; fixture theme/size/reload only',shots},null,2));
process.exit(0);
