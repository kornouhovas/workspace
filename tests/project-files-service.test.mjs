import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync,symlinkSync,linkSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openSettingsService} from '../dist/service/settings.mjs';
import {createNativeProjectReveal} from '../src/desktop/project-reveal.ts';

async function fixture(run,mode='direct') {
 const temp=realpathSync(mkdtempSync(join(tmpdir(),'project-files-'))),root=join(temp,'root');
 mkdirSync(root);const projectPath=mode==='direct'?join(root,'Atlas'):join(root,'Category','Atlas');mkdirSync(projectPath,{recursive:true});
 const service=openSettingsService(join(temp,'data.sqlite'));
 try {
  const workspace=service.workspaces.create({type:'workspace.create',name:'Files',rootPath:root}).value;
  const preview=service.workspaces.previewDiscovery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,mode}).value;
  const list=service.workspaces.applyDiscovery({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:preview.previewToken}).value;
  const input={type:'workspace.listProjectFiles',workspaceId:workspace.workspaceId,projectId:list.projects[0].projectId,relativePath:''};
  await run({service,projectPath,input,root,temp});
 }finally{service.close();rmSync(temp,{recursive:true,force:true});}
}
for(const mode of ['direct','grouped'])test(`${mode} browse real project children and empty nested directories through public service`,()=>fixture(({service,projectPath,input})=>{
 mkdirSync(join(projectPath,'src'));writeFileSync(join(projectPath,'Readme Текст.md'),'owned content');
 const result=service.workspaces.listProjectFiles(input);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.outcome,'listed');
 assert.deepEqual(result.value.entries.map(({name,kind})=>({name,kind})),[{name:'src',kind:'directory'},{name:'Readme Текст.md',kind:'file'}]);
 assert.equal(JSON.stringify(result).includes(projectPath),false);
 assert.deepEqual(service.workspaces.listProjectFiles({...input,relativePath:'src'}).value.entries,[]);
},mode));

test('public query rejects traversal, foreign project ownership and renderer native evidence',()=>fixture(({service,input,projectPath,temp})=>{
 for(const relativePath of ['..','../outside','/outside','a/../b','a//b',`a${String.fromCharCode(0)}b`])assert.equal(service.workspaces.listProjectFiles({...input,relativePath}).error.code,'invalid_input');
 assert.equal(service.workspaces.listProjectFiles({...input,absolutePath:projectPath}).error.code,'invalid_input');
 const other=join(temp,'foreign');mkdirSync(other);const foreign=service.workspaces.create({type:'workspace.create',name:'Foreign',rootPath:other}).value;
 assert.equal(service.workspaces.listProjectFiles({...input,workspaceId:foreign.workspaceId}).error.code,'invalid_input');
}));

test('Open and Reveal dispatch distinct current file targets, never a directory Open',()=>fixture(async({service,input,projectPath})=>{
 writeFileSync(join(projectPath,'notes.txt'),'safe content');mkdirSync(join(projectPath,'nested'));const seen=[];
 for(const type of ['workspace.openProjectFile','workspace.revealProjectFile']) {
  const result=await service.workspaces.projectFileCommand({...input,type,relativePath:'notes.txt'},async(target,verify)=>{assert.equal(verify().outcome,'verified');seen.push(target.item.action);return {outcome:'dispatched'};});
  assert.equal(result.value.outcome,'dispatched',JSON.stringify(result));
 }
 assert.deepEqual(seen,['open','reveal']);let directoryDispatches=0;
 const directory=await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath:'nested'},async()=>{directoryDispatches++;return {outcome:'dispatched'};});
 assert.equal(directory.value.outcome,'rejected');assert.equal(directoryDispatches,0);
}));

for(const mode of ['direct','grouped'])test(`${mode} unsafe links/hardlinks and disappearing files never dispatch`,()=>fixture(async({service,input,projectPath,temp})=>{
 const outside=join(temp,'outside.txt');writeFileSync(outside,'outside');symlinkSync(outside,join(projectPath,'linked.txt'),'file');linkSync(outside,join(projectPath,'hard.txt'));
 const query=service.workspaces.listProjectFiles(input);assert.deepEqual(query.value.entries.map(entry=>entry.kind),['unavailable','unavailable']);let dispatches=0;
 for(const relativePath of ['linked.txt','hard.txt','missing.txt']) {
  const result=await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath},async()=>{dispatches++;return {outcome:'dispatched'};});
  assert.equal(result.value.outcome,'rejected');assert.equal(dispatches,0);
 }
 mkdirSync(join(projectPath,'nested'));writeFileSync(join(projectPath,'nested','safe.txt'),'safe');
 const native=createNativeProjectReveal(async()=>{dispatches++;});
 const result=await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath:'nested/safe.txt'},async(target,verify)=>{
  renameSync(join(projectPath,'nested'),join(projectPath,'old-nested'));symlinkSync(join(projectPath,'old-nested'),join(projectPath,'nested'),'junction');return native(target,()=>true,async()=>verify());
 });
 assert.equal(result.value.outcome,'rejected');assert.equal(dispatches,0);
},mode));

test('native Open/Reveal receives exact long Unicode paths and external failures are bounded',()=>fixture(async({service,input,projectPath})=>{
 const components=['Длинная папка '.repeat(8),'nested','notes Текст.txt'];mkdirSync(join(projectPath,...components.slice(0,-1)),{recursive:true});const file=join(projectPath,...components);writeFileSync(file,'safe');
 const relativePath=components.join('/'),seen=[];const native=createNativeProjectReveal(async(path,context,action)=>{await context.permit(()=>seen.push({path,action}));});
 for(const type of ['workspace.openProjectFile','workspace.revealProjectFile'])assert.equal((await service.workspaces.projectFileCommand({...input,type,relativePath},(target,verify)=>native(target,()=>true,async()=>verify()))).value.outcome,'dispatched');
 assert.deepEqual(seen,[{path:file,action:'open'},{path:file,action:'reveal'}]);
 const failure=await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath},(target,verify)=>createNativeProjectReveal(()=>{throw new Error(file);})(target,()=>true,async()=>verify()));
 assert.equal(failure.value.problem,'native_error');assert.equal(JSON.stringify(failure).includes(projectPath),false);
}));

test('fresh authorization rejects removed source and closed services at native permit',()=>fixture(async({service,input,projectPath,root})=>{
 writeFileSync(join(projectPath,'note.txt'),'safe');let dispatches=0;
 const native=createNativeProjectReveal(async(_path,context)=>{renameSync(root,`${root}-away`);try{await context.permit(()=>dispatches++);}finally{renameSync(`${root}-away`,root);}});
 const result=await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath:'note.txt'},(target,verify)=>native(target,()=>true,async()=>verify()));
 assert.equal(result.value.outcome,'rejected');assert.equal(dispatches,0);service.workspaces.close();assert.equal(service.workspaces.listProjectFiles(input).value.problem,'request_expired');
}));

test('public Settings query routes tree access with the same validation',()=>fixture(({service,input})=>{assert.equal(service.handleQuery(input).value.outcome,'listed');assert.equal(service.handleQuery({...input,relativePath:'..'}).error.code,'invalid_input');}));

for(const mode of ['direct','grouped'])test(`${mode} archived project tree uses recorded archive parents and preserves external files`,()=>fixture(async({service,input,projectPath})=>{
 writeFileSync(join(projectPath,'note.txt'),'archived bytes');
 const designation=service.handleQuery({type:'workspace.previewArchiveLocation',workspaceId:input.workspaceId,relativePath:'Archive'}).value;
 service.handleCommand({type:'workspace.applyArchiveLocation',workspaceId:input.workspaceId,previewToken:designation.previewToken,operationId:randomUUID()});
 const review=service.handleQuery({type:'workspace.previewProjectArchive',workspaceId:input.workspaceId,projectId:input.projectId,action:'archive',name:null,createParent:false}).value;
 const archived=service.handleCommand({type:'workspace.applyProjectArchive',workspaceId:input.workspaceId,previewToken:review.previewToken,operationId:randomUUID()});assert.equal(archived.value.operation.stage,'completed');
 const tree=service.workspaces.listProjectFiles(input);assert.equal(tree.value.outcome,'listed',JSON.stringify(tree));assert.deepEqual(tree.value.entries.map(entry=>entry.name),['note.txt']);
 const native=createNativeProjectReveal(async()=>{});assert.equal((await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath:'note.txt'},(target,verify)=>native(target,()=>true,async()=>verify()))).value.outcome,'dispatched');
},mode));

test('real digit-containing paths expand and Open while actual NUL is rejected',()=>fixture(async({service,input,projectPath})=>{
 mkdirSync(join(projectPath,'v0'));writeFileSync(join(projectPath,'v0','2026.txt'),'safe');assert.equal(service.workspaces.listProjectFiles({...input,relativePath:'v0'}).value.outcome,'listed');
 assert.equal((await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath:'v0/2026.txt'},async()=>({outcome:'dispatched'}))).value.outcome,'dispatched');
 assert.equal(service.workspaces.listProjectFiles({...input,relativePath:`a${String.fromCharCode(0)}b`}).error.code,'invalid_input');
}));

test('shell shortcuts cannot activate out-of-project targets through Open',()=>fixture(async({service,input,projectPath})=>{
 let dispatches=0;
 for(const name of ['outside.lnk','outside.URL','outside.webloc','outside.alias']) {
  writeFileSync(join(projectPath,name),'fixture shell shortcut');const result=await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath:name},async()=>{dispatches++;return {outcome:'dispatched'};});
  assert.equal(result.value.outcome,'rejected',name);assert.equal(result.value.problem,'replaced');assert.equal(dispatches,0,name);
 }
}));
if(process.platform==='darwin')test('extensionless real Finder aliases cannot Open their external target',()=>fixture(async({service,input,projectPath,temp})=>{
  const outside=join(temp,'outside.txt');writeFileSync(outside,'outside owned fixture');
  execFileSync('/usr/bin/osascript',['-e',`on run argv
    tell application "Finder"
      make new alias file at POSIX file (item 1 of argv) to POSIX file (item 2 of argv) with properties {name:"External reference"}
    end tell
  end run`,projectPath,outside],{timeout:5000});
  let dispatches=0;
  const result=await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath:'External reference'},async()=>{dispatches++;return {outcome:'dispatched'};});
  assert.equal(result.value.outcome,'rejected',JSON.stringify(result));assert.equal(result.value.problem,'replaced');assert.equal(dispatches,0);
}));

if(process.platform==='win32')test('real Windows shell shortcut to an external file cannot Open',()=>fixture(async({service,input,projectPath,temp})=>{
  const outside=join(temp,'outside.txt');writeFileSync(outside,'outside owned fixture');
  const shortcut=join(projectPath,'External reference.lnk');
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$shell=New-Object -ComObject WScript.Shell;$shortcut=$shell.CreateShortcut($env:WORKSPACE_SHORTCUT);$shortcut.TargetPath=$env:WORKSPACE_OUTSIDE;$shortcut.Save()`],{timeout:5000,env:{...process.env,WORKSPACE_SHORTCUT:shortcut,WORKSPACE_OUTSIDE:outside}});
  let dispatches=0;
  const result=await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath:'External reference.lnk'},async()=>{dispatches++;return {outcome:'dispatched'};});
  assert.equal(result.value.outcome,'rejected');assert.equal(result.value.problem,'replaced');assert.equal(dispatches,0);
}));

for(const mode of ['direct','grouped'])test(`${mode} file commands follow the current logical project after rename and reject a delayed old target`,()=>fixture(async({service,input,projectPath})=>{
 writeFileSync(join(projectPath,'note.txt'),'safe');let dispatches=0;
 const native=createNativeProjectReveal(async()=>{dispatches++;});
 const pending=await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath:'note.txt'},async(target,verify)=>{
  const revision=service.handleQuery({type:'workspace.listProjects',workspaceId:input.workspaceId}).value.revision;
  const renamed=service.handleCommand({type:'workspace.renameProject',workspaceId:input.workspaceId,projectId:input.projectId,name:'Renamed project',expectedRevision:revision,operationId:randomUUID()});
  assert.equal(renamed.value.outcome,'completed',JSON.stringify(renamed));
  return native(target,()=>true,async()=>verify());
 });
 assert.equal(pending.value.outcome,'rejected');assert.equal(dispatches,0);
 const current=service.workspaces.listProjectFiles(input);assert.equal(current.value.outcome,'listed');assert.deepEqual(current.value.entries.map(entry=>entry.name),['note.txt']);
 const next=await service.workspaces.projectFileCommand({...input,type:'workspace.openProjectFile',relativePath:'note.txt'},(target,verify)=>native(target,()=>true,async()=>verify()));assert.equal(next.value.outcome,'dispatched');assert.equal(dispatches,1);
},mode));
