/* global window, document, innerWidth */
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,realpath,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {openSettingsSection,returnToWorkspace,setInterfaceLanguage} from './runtime-settings.mjs';
import {observeExternalFile,closeExternalFile} from './external-file-evidence.mjs';
import {setTimeout as delay} from 'node:timers/promises';
import {waitForFileManagerTarget,closeDisposableFileManagerTarget} from './file-manager-evidence.mjs';
const root=resolve(import.meta.dirname,'..'), evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-64-files');
await mkdir(evidence,{recursive:true});
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-files-'))), source=join(fixture,'source'), project=join(source,'Atlas');
await mkdir(join(project,'src'),{recursive:true});await mkdir(join(source,'Beacon'));
const fileName='Workspace file check — Текст.txt', target=join(project,'src',fileName);
await writeFile(target,'Workspace issue 64 disposable file. External opening must preserve these bytes.\n');
await writeFile(join(project,'Release planning — Длинное имя файла для проверки обрезки и подсказки.md'),'Fixture');
const parents=new Set(),backends=new Set(),checks=[],captures=[];
let app,page,failure,launchUnverified=false,native,external;
try {
 launchUnverified=true;
 app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[root],cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')}});
 parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
 await page.waitForFunction(async()=>(await window.workspace.getBackendStatus()).state==='ready');
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid)))backends.add(pid);
 assert.ok(backends.size);launchUnverified=false;
 const query=async input=>{const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
 const {workspaceId}=await query({type:'workspace.create',name:'Design studio',rootPath:source});
 const call=(type,fields={})=>query({type:`workspace.${type}`,workspaceId,...fields});
 const projects=(await call('applyDiscovery',{previewToken:(await call('previewDiscovery',{mode:'direct'})).previewToken})).projects;
 const atlas=projects.find(p=>p.name==='Atlas');
 const notes=(await call('createProperty',{name:'Notes',propertyType:'text'})).propertyId;
 await call('setTextValue',{projectId:atlas.projectId,propertyId:notes,value:'Review the release files\nПроверить документацию'});
 await page.reload();
 for(const language of ['en','ru']) {
  await setInterfaceLanguage(page,language);const en=language==='en';
  for(const theme of ['light','dark']) {
   await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnToWorkspace(page);
   for(const size of [{width:1024,height:720},{width:1440,height:960}]) {
    await page.setViewportSize(size);await page.getByRole('button',{name:`${en?'Preview project':'Открыть предпросмотр проекта'}: Atlas`,exact:true}).click();
    await page.getByRole('treeitem',{name:'src',exact:true}).waitFor();
    const folder=page.getByRole('treeitem',{name:'src',exact:true});await folder.focus();await folder.press('ArrowRight');
    const file=page.getByRole('treeitem',{name:fileName,exact:true});await file.waitFor();await folder.press('ArrowDown');
    assert.equal(await file.evaluate(el=>el===document.activeElement),true);
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:join(evidence,`preview-${language}-${theme}-${size.width}.png`)});
    await page.getByRole('button',{name:en?'Expand project':'Развернуть проект',exact:true}).click();
    await file.waitFor();await page.screenshot({path:join(evidence,`expanded-${language}-${theme}-${size.width}.png`)});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:en?'Return project to the right':'Вернуть проект вправо',exact:true}).click();
    await page.getByRole('button',{name:en?'Close preview':'Закрыть предпросмотр',exact:true}).click();
    captures.push({language,theme,...size});
   }
  }
 }
 checks.push('real nested tree, arrow navigation/focus, retained expansion across expand/return, 16 preview/expanded EN/RU/theme/size captures');
 await setInterfaceLanguage(page,'en');await page.getByRole('button',{name:'Preview project: Beacon',exact:true}).click();
 await page.getByText('This folder is empty.',{exact:true}).waitFor();
 await page.screenshot({path:join(evidence,'empty.png')});
 await writeFile(join(source,'Beacon','new.txt'),'Refresh fixture');
 await page.getByRole('button',{name:'Refresh files',exact:true}).click();await page.getByRole('treeitem',{name:'new.txt',exact:true}).waitFor();
 await rm(join(source,'Beacon','new.txt'));
 await page.getByRole('treeitem',{name:'new.txt',exact:true}).click();
 await page.getByRole('button',{name:'Open externally',exact:true}).click();await page.locator('.project-files [role="alert"]').waitFor();
 await page.screenshot({path:join(evidence,'disappeared.png')});
 checks.push('empty, Refresh sees real added file, disappearing file gives actionable error');
 await page.getByRole('button',{name:'Preview project: Atlas',exact:true}).click();
 await page.getByRole('treeitem',{name:'src',exact:true}).click();await page.getByRole('treeitem',{name:fileName,exact:true}).click();
 await page.getByRole('button',{name:'Reveal in Finder / Explorer',exact:true}).click();
 await page.getByRole('button',{name:'Reveal in Finder / Explorer',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('.project-files [role="alert"]') && ![...document.querySelectorAll('.project-files [role="status"]')].some(el=>el.textContent==='Opening…'));
 native=await waitForFileManagerTarget(target);
 assert.equal(native.status,'passed',JSON.stringify(native));
 checks.push('actual file manager shows/selects exact disposable nested Unicode file');
 await page.getByRole('button',{name:'Open externally',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.project-files [role="alert"]') && ![...document.querySelectorAll('.project-files [role="status"]')].some(el=>el.textContent==='Opening…'));
 // OS document/window observation is separate from the successful shell dispatch.
 for(let attempt=0;attempt<20;attempt++) {
   external=await observeExternalFile(target);
   if(external.status==='passed')break;
   await delay(100);
 }
 assert.equal(external.status,'passed',JSON.stringify(external));
 assert.equal(await readFile(target,'utf8'),'Workspace issue 64 disposable file. External opening must preserve these bytes.\n');
 checks.push('default external application displays the exact disposable file; bytes preserved');
 await writeFile(join(evidence,'external-target.json'),JSON.stringify({target,fixture,workspaceId,projectId:atlas.projectId}));
} catch(error) {
 failure=error;
 if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});
 if(process.platform==='darwin') {
   const diagnostics={errorCode:error.code??null,killed:error.killed??false,signal:error.signal??null,stderr:String(error.stderr??'').slice(-1000)};
   try {await promisify(execFile)('/usr/sbin/screencapture',['-x',join(evidence,'native-desktop-failure.png')],{timeout:5000});diagnostics.desktopCaptured=true;}catch(error){diagnostics.desktopCaptureCode=error.code??null;}
   try {
     const {stdout}=await promisify(execFile)('/usr/bin/osascript',['-l','JavaScript','-e',`ObjC.import("AppKit"); var apps=$.NSWorkspace.sharedWorkspace.runningApplications, result=[]; for(var i=0;i<apps.count;i++){var app=apps.objectAtIndex(i); if(app.bundleIdentifier.js==="com.apple.TextEdit")result.push({name:app.localizedName.js,pid:app.processIdentifier});} JSON.stringify(result)`],{timeout:5000});
     diagnostics.application=stdout.trim();
   }catch(error){diagnostics.applicationReadCode=error.code??null;}
   await writeFile(join(evidence,'native-diagnostic.json'),JSON.stringify(diagnostics,null,2));
 }
}
finally {
 let stopped=false,cleaned=false;
 try{if(app)await closeElectron(app);stopped=ownedProcessesStopped(parents,backends,{launchUnverified});assert.equal(stopped,true);}catch(error){failure??=error;}
 try{await closeExternalFile(target,external);await closeDisposableFileManagerTarget(target);}catch(error){failure??=error;}
 try{cleaned=await cleanupOwnedFixture(fixture,{processesStopped:stopped,primaryFailure:failure,record:result=>{cleaned=result;}});}catch(error){failure??=error;}
 await writeFile(join(evidence,'report.json'),JSON.stringify({sha:process.env.GITHUB_SHA??null,platform:process.platform,checks,captures,native,external,stopped,cleaned,failure:failure?.stack},null,2));
}
if(failure)throw failure;
console.log(`Project files: ${checks.join('; ')}`);
