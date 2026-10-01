import { chromium } from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const runtime=JSON.parse(await readFile('work/workspace-jqv/runtime.json','utf8'));
const [mode,theme,width,height,surface]=process.argv.slice(2);
if(mode==='configure') {
 await fetch(`http://127.0.0.1:9247/size?width=${width}&height=${height}`);
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9246');
 const page=browser.contexts()[0].pages()[0];
 // Authorized isolated-fixture theme/size configuration only. No UI input.
 await page.evaluate(theme=>localStorage.setItem('workspace.theme',theme),theme);
 await page.reload();await page.waitForLoadState('networkidle');
 await browser.close();
 await fetch('http://127.0.0.1:9247/front');
 process.exit(0);
}
// Reassert the requested fixture dimensions immediately before native capture.
await fetch(`http://127.0.0.1:9247/size?width=${width}&height=${height}`);
const path=`work/workspace-jqv/refinement-after/native-${theme}-${width}x${height}-${surface}.png`;
await fetch('http://127.0.0.1:9247/front');
execFileSync('osascript',['-e',`tell application "System Events" to set frontmost of first application process whose unix id is ${runtime.pid} to true`]);
// Allow the native Stage Manager foreground animation to finish before validating CG dimensions.
await new Promise(resolve=>setTimeout(resolve,750));
const output=execFileSync('/tmp/workspace-jqv-capture-window',[String(runtime.pid),path],{encoding:'utf8'});
const bytes=await readFile(path);const pixels={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
const bounds=JSON.parse(await (await fetch('http://127.0.0.1:9247/')).text());
if(pixels.width!==Number(width)||pixels.height!==Number(height)||bounds.bounds.width!==Number(width)||bounds.bounds.height!==Number(height))throw Error('Native dimensions mismatch');
const manifestPath='work/workspace-jqv/refinement-after/native-manifest.json';
let shots=[];try{shots=JSON.parse(await readFile(manifestPath,'utf8'))}catch{}
shots=shots.filter(shot=>shot.path!==path);
shots.push({path,pid:runtime.pid,surface,theme,pixels,...bounds,output});
await writeFile(manifestPath,JSON.stringify(shots,null,2));console.log(path);
