import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const [phase,theme,width,height,surface,mode]=process.argv.slice(2);
const runtime=JSON.parse(await readFile('work/workspace-bk1/runtime.json','utf8'));
await fetch(`http://127.0.0.1:9267/size?width=${width}&height=${height}`);
if(mode==='configure'){
const browser=await chromium.connectOverCDP('http://127.0.0.1:9266');const page=browser.contexts()[0].pages()[0];
await page.evaluate(theme=>localStorage.setItem('workspace.theme',theme),theme);await page.reload();await page.waitForLoadState('networkidle');await browser.close();
}
await fetch('http://127.0.0.1:9267/front');
execFileSync('osascript',['-e',`tell application "System Events" to set frontmost of first application process whose unix id is ${runtime.pid} to true`]);
await new Promise(resolve=>setTimeout(resolve,750));
const path=`work/workspace-bk1/${phase}/native-${theme}-${width}x${height}-${surface}.png`;
const output=execFileSync('/tmp/workspace-bk1-capture-window',[String(runtime.pid),path],{encoding:'utf8'});
const bytes=await readFile(path);const pixels={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
const bounds=await(await fetch('http://127.0.0.1:9267/')).json();
if(pixels.width!==+width||pixels.height!==+height||bounds.bounds.width!==+width||bounds.bounds.height!==+height)throw Error('Native dimensions mismatch');
let shots=[];try{shots=JSON.parse(await readFile(`work/workspace-bk1/${phase}/manifest.json`,'utf8'))}catch{}
shots=shots.filter(s=>s.path!==path);shots.push({path,theme,surface,pid:runtime.pid,pixels,bounds,output});await writeFile(`work/workspace-bk1/${phase}/manifest.json`,JSON.stringify(shots,null,2));console.log(path);
