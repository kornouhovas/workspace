/* global document */
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir,release} from 'node:os';
import {join,resolve} from 'node:path';
import {promisify} from 'node:util';
import {_electron} from 'playwright-core';
import {openSettingsSection} from './runtime-settings.mjs';
import {runtimeSmokeLaunch} from './runtime-executable.mjs';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';

const root=resolve(import.meta.dirname,'..');
const mode=process.env.WORKSPACE_SMOKE_MODE??'dev';
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-82-system-theme');
await mkdir(evidence,{recursive:true});
const run=promisify(execFile);
const script=source=>run('/usr/bin/osascript',['-e',source],{timeout:10000}).then(result=>result.stdout.trim());
const readTheme=()=>script('tell application "System Events" to get dark mode of appearance preferences');
const report={sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),platform:process.platform,kernel:release(),mode,checks:[],status:'running'};
const parents=new Set(),backends=new Set();
let app,failure,original,fixture,launchUnverified=false;
try{
  assert.equal(process.platform,'darwin','Actual OS appearance switching requires macOS');
  original=await readTheme();
  assert.ok(['true','false'].includes(original));
  report.original=original;
  fixture=await mkdtemp(join(tmpdir(),'issue82-system-theme-'));
  launchUnverified=true;
  app=await _electron.launch({...runtimeSmokeLaunch(root),cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')}});
  parents.add(app.process());
  const page=await app.firstWindow();page.setDefaultTimeout(15000);
  await page.locator('.workspace-screen[data-ready="true"]').waitFor();
  await page.emulateMedia({colorScheme:null});
  assert.equal(await app.evaluate(({app})=>app.isPackaged),mode==='release');
  for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(item=>item.type==='Utility'&&item.serviceName?.includes('Node')).map(item=>item.pid)))backends.add(pid);
  assert.ok(backends.size>0,'Backend process must be observed for cleanup verification');
  launchUnverified=false;
  await openSettingsSection(page,'general');
  await page.getByRole('radio',{name:'System',exact:true}).click();
  for(const dark of [false,true]){
    await script(`tell application "System Events" to set dark mode of appearance preferences to ${dark}`);
    assert.equal(await readTheme(),String(dark));
    await page.waitForFunction(expected=>document.documentElement.dataset.theme===(expected?'dark':'light'),dark);
    const nativeDark=await app.evaluate(({nativeTheme})=>nativeTheme.shouldUseDarkColors);
    assert.equal(nativeDark,dark);
    await page.screenshot({path:join(evidence,dark?'native-dark.png':'native-light.png')});
    report.checks.push({osDark:dark,nativeDark,rendererTheme:await page.locator('html').getAttribute('data-theme')});
  }
  report.status='passed';
}catch(error){failure=error;report.status='failed';report.error=error.stack;}
finally{
  try{if(original!==undefined){
    await script(`tell application "System Events" to set dark mode of appearance preferences to ${original}`);
    report.restored=(await readTheme())===original;
    assert.equal(report.restored,true);
  }}catch(error){failure??=error;report.restoreError=error.message;}
  try{if(app){await closeElectron(app);report.normalQuit=true;}}catch(error){failure??=error;report.normalQuit=false;report.quitError=error.message;}
  report.stopped=ownedProcessesStopped(parents,backends,{launchUnverified});
  try{if(fixture)await cleanupOwnedFixture(fixture,{processesStopped:report.stopped,primaryFailure:undefined,record:result=>report.cleanup=result});}catch(error){failure??=error;}
  if(failure){report.status='failed';report.error??=failure.stack;}
  await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2));
}
if(failure)throw failure;
