import { spawn } from 'node:child_process';
import { lstat, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join, isAbsolute } from 'node:path';
import { resolveWorkspacePath } from './localOpen.js';
import { readWorkspaceSettings, writeWorkspaceSettings } from './workspaceBackend.js';
import { projectDirectoryHelperPath, validProjectDirectoryName } from './workspaceProjectCreate.js';
import { commitProjectLocations } from './workspaceStatusMove.js';

const fail = (code,message) => Object.assign(new Error(message),{code});
async function statOrNull(path) { try{return await lstat(path)}catch(error){if(error.code==='ENOENT')return null;throw error;} }
const owned = (stat,journal) => stat?.isDirectory() && !stat.isSymbolicLink() && stat.dev === journal.sourceDev && stat.ino === journal.sourceIno;

async function exclusiveRename(journal, from, to, helperPath) {
 return new Promise((resolve,reject)=>{
  const child=spawn(helperPath,['--rename-project-directory'],{stdio:['pipe','pipe','pipe']});let output='',stderr='';
  child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.once('error',reject);child.stdin.on('error',()=>{});
  child.once('close',code=>{let result;try{result=JSON.parse(output)}catch{result={error:stderr||'Project rename helper failed.'}}
   if(code===0 && result.renamed===true)resolve();else reject(fail(result.code||'PROJECT_RENAME_FAILED',result.error||'Project rename failed.'));
  });
  child.stdin.end(JSON.stringify({root:journal.rootPath,parent:journal.parent,from:basename(from),to:basename(to),dev:journal.sourceDev,ino:journal.sourceIno,parentDev:journal.parentDev,parentIno:journal.parentIno}));
 });
}

export function createProjectRenamer({configPath,helperPath=projectDirectoryHelperPath(),testHooks={},writeSettings=writeWorkspaceSettings}) {
 const save = async journal => writeSettings(configPath,{...await readWorkspaceSettings(configPath),projectRename:journal});
 const clear = async () => {const {projectRename:_journal,...settings}=await readWorkspaceSettings(configPath);await writeSettings(configPath,settings)};
 async function verifyParent(journal) {
  let current=journal.rootPath;
  for(const component of ['',...(journal.parent?journal.parent.split('/'):[])]){
   if(component)current=join(current,component);
   const stat=await lstat(current);
   if(!stat.isDirectory() || stat.isSymbolicLink())throw fail('RENAME_RECOVERY_REQUIRED','Project parent is unavailable or changed; the rename journal was retained.');
  }
  const stat=await lstat(current);
  if(stat.dev!==journal.parentDev || stat.ino!==journal.parentIno)throw fail('RENAME_RECOVERY_REQUIRED','Project parent identity changed; the rename journal was retained.');
 }
 async function inspect(journal,path) {
  // Exact directory spelling distinguishes a case-only rename on APFS/NTFS.
  const parent=resolveWorkspacePath(journal.rootPath,journal.parent||'.');
  if(!(await readdir(parent)).includes(basename(path)))return null;
  return statOrNull(resolveWorkspacePath(journal.rootPath,path));
 }
 async function recover() {
  const settings=await readWorkspaceSettings(configPath),j=settings.projectRename;
  if(!j)return;
  if(j.version!==1 || typeof j.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(j.id) || typeof j.rootPath !== 'string' || !isAbsolute(j.rootPath) || typeof j.parent !== 'string' || typeof j.from !== 'string' || typeof j.to !== 'string' || j.stage!==[j.parent,`.workspace-rename-${j.id}`].filter(Boolean).join('/') || dirname(j.from)!==dirname(j.to) || !['prepared','staged','finalizing','committed'].includes(j.phase))throw fail('RENAME_RECOVERY_REQUIRED','Invalid rename journal; files were retained.');
  await verifyParent(j);
  const old=await inspect(j,j.from),stage=await inspect(j,j.stage),target=await inspect(j,j.to);
  if(stage && !owned(stage,j) || old && !owned(old,j) || target && !owned(target,j))throw fail('RENAME_RECOVERY_REQUIRED','A rename location is occupied by another entry; files and journal were retained.');
  if((j.phase==='finalizing'||j.phase==='committed') && owned(target,j) && !stage && !old){
   if(j.phase!=='committed')await writeSettings(configPath,commitProjectLocations(settings,{...j,targetDev:j.sourceDev,targetIno:j.sourceIno},'projectRename'));
   await clear();return {committed:true};
  }
  if(j.phase==='committed')throw fail('RENAME_RECOVERY_REQUIRED','Committed project locator changed; journal retained.');
  if(owned(stage,j) && !old && !target){await exclusiveRename(j,j.stage,j.from,helperPath);if(!owned(await inspect(j,j.from),j))throw fail('RENAME_RECOVERY_REQUIRED','Restored folder identity could not be verified.');await clear();return {committed:false};}
  if(owned(old,j) && !stage && !target){await clear();return {committed:false};}
  throw fail('RENAME_RECOVERY_REQUIRED','Rename locations are ambiguous; files and journal were retained.');
 }
 async function rename({rootPath,sourceId,project,name}) {
  if(!validProjectDirectoryName(name))throw fail('INVALID_PROJECT_NAME','Enter one visible folder name without path separators or control characters.');
  const from=project.currentRelativePath;
  if(name===basename(from))return {state:'unchanged',projectId:project.id,from,to:from};
  const parent=dirname(from)==='.'?'':dirname(from),to=[parent,name].filter(Boolean).join('/');
  const source=await lstat(resolveWorkspacePath(rootPath,from));
  if(!source.isDirectory()||source.isSymbolicLink())throw fail('PROJECT_RENAME_FAILED','Project must be a real directory.');
  const parentStat=await lstat(parent?resolveWorkspacePath(rootPath,parent):rootPath),id=randomUUID();
  let j={version:1,id,rootPath,sourceId,projectId:project.id,from,to,parent,parentDev:parentStat.dev,parentIno:parentStat.ino,stage:[parent,`.workspace-rename-${id}`].filter(Boolean).join('/'),sourceDev:source.dev,sourceIno:source.ino,phase:'prepared'};
  await verifyParent(j);
  const target=await statOrNull(resolveWorkspacePath(rootPath,to));
  if(target && !owned(target,j))throw fail('PROJECT_NAME_CONFLICT','An entry with this name already exists.');
  await save(j);
  try {
   await testHooks.beforeStage?.(j);
   await exclusiveRename(j,from,j.stage,helperPath);
   if(!owned(await inspect(j,j.stage),j))throw fail('RENAME_RECOVERY_REQUIRED','Project identity changed during rename.');
   j={...j,phase:'staged'};await save(j);await testHooks.afterStage?.(j);
   j={...j,phase:'finalizing'};await save(j);await testHooks.beforeFinalize?.(j);
   await exclusiveRename(j,j.stage,to,helperPath);
   await testHooks.afterFinalize?.(j);
   await verifyParent(j);
   if(!owned(await inspect(j,to),j))throw fail('RENAME_RECOVERY_REQUIRED','Renamed project identity changed.');
   await testHooks.beforeMetadataCommit?.(j);
   await writeSettings(configPath,commitProjectLocations(await readWorkspaceSettings(configPath),{...j,targetDev:source.dev,targetIno:source.ino},'projectRename'));
   j={...j,phase:'committed'};await testHooks.afterMetadataCommit?.(j);await clear();
   return {state:'completed',projectId:project.id,from,to};
  } catch(cause) {
   if(cause.simulateCrash)throw cause;
   try {const recovered=await recover();if(recovered?.committed)return {state:'completed',projectId:project.id,from,to,recovered:true};}catch(recovery){
    const target = await inspect(j,to).catch(()=>null);
    const stage = await inspect(j,j.stage).catch(()=>null);
    const old = await inspect(j,from).catch(()=>null);
    const message = `${cause.message} ${recovery.message} Original: ${from}; new: ${to}; staging: ${j.stage}`;
    const parentValid = await verifyParent(j).then(()=>true,()=>false);
    if (parentValid && ['finalizing','committed'].includes(j.phase) && owned(target,j) && !stage && !old) return {
      state:'recovery-required',physicalCompleted:true,committed:j.phase==='committed',projectId:project.id,from,to,
      project:{...project,name:basename(to),currentRelativePath:to,fileTree:[]},error:{code:'RENAME_RECOVERY_REQUIRED',message},
    };
    throw fail('RENAME_RECOVERY_REQUIRED',message);
   }
   throw cause;
  }
 }
 return {rename,recover};
}
