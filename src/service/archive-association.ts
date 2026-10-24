import {isDeepStrictEqual} from 'node:util';
import {join} from 'node:path';
import {parseFilesystemAuthorization,parseFolderObservation,type FilesystemAuthorization,type VerifiedFolder} from './filesystem-authorization.js';
import {parseArchiveAuthorizationV1 as parseArchiveAuthorization,parseArchiveParents,archiveParentPathsMatch,uniqueArchiveProofs,type ArchiveParent} from './archive-proof.js';
import {durableOwnershipKey,sameDurableFolder} from './folder-evidence.js';
import {sameVolumeEvidence,type EvidenceReader} from './source-identity.js';
import {sameIdentity,isChildName} from './discovery.js';
import {nativeProjectFilesystem,verifyCreationDirectory,validProjectBasename} from './project-filesystem.js';
import {filesystemAlias} from './path-alias.js';
import type * as schema from './db/schema.js';

type Archive=typeof schema.projectArchives.$inferSelect;
export interface ArchivedFolderAssociation {
 version:1;sourceId:string;projectId:string;archive:Archive;root:FilesystemAuthorization;project:VerifiedFolder;parents:ArchiveParent[];
}
export function parseArchivedFolderAssociation(value:string):ArchivedFolderAssociation|null {
 try {
  const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
  const safe=(path:string)=>path.split('/').every(name=>isChildName(name)&&validProjectBasename(name,process.platform)&&!name.startsWith('.')&&!/^(\$RECYCLE.BIN|System Volume Information)$/i.test(name));
  const v=JSON.parse(value),root=parseFilesystemAuthorization(JSON.stringify(v.root)),archive=v.archive as Archive;
  if(!v || Object.keys(v).sort().join()!=='archive,parents,project,projectId,root,sourceId,version' || v.version!==1 || !uuid(v.sourceId) || !uuid(v.projectId) || !root || root.generation<1 ||
   !sameDurableFolder(root.root.evidence,root.parent.evidence) || !sameIdentity(root.root.mount,root.parent.mount) || !parseFolderObservation(v.project) ||
   !archive || Object.keys(archive).sort().join()!=='authorization,categoryName,mode,originalRelativePath,parentIdentity,parents,projectId,relativePath,sourceId' ||
   archive.sourceId!==v.sourceId || archive.projectId!==v.projectId || !['direct','grouped'].includes(archive.mode) ||
   typeof archive.relativePath!=='string' || !safe(archive.relativePath) || typeof archive.originalRelativePath!=='string' ||
   archive.originalRelativePath.split('/').length!==(archive.mode==='direct'?1:2) || !safe(archive.originalRelativePath) || archive.categoryName!==null&&typeof archive.categoryName!=='string' || typeof archive.parentIdentity!=='string' || !JSON.parse(archive.parentIdentity) || !parseArchiveParents([{path:'Role',identity:JSON.parse(archive.parentIdentity)}],false) ||
   durableOwnershipKey(root.root.evidence)===durableOwnershipKey(v.project.evidence) || !sameVolumeEvidence(root.root,v.project) || root.root.evidence.scope!==v.project.evidence.scope ||
   !parseArchiveParents(v.parents,true) || v.parents.some((p:ArchiveParent)=>!p.observation) || !archiveParentPathsMatch(v.parents,archive.relativePath) ||
   !uniqueArchiveProofs({root,project:v.project},[v.parents]))return null;
  const oldParents=parseArchiveParents(JSON.parse(archive.parents),archive.authorization!==null),old=archive.authorization===null?null:parseArchiveAuthorization(archive.authorization);
  if(!oldParents || oldParents.some(parent=>parent.identity===null) || !archiveParentPathsMatch(oldParents,archive.relativePath) ||
   archive.authorization!==null&&!old || old&&(old.root.generation>root.generation || !sameIdentity(JSON.parse(archive.parentIdentity),old.originalParent.mount) ||
    (archive.mode==='direct'?!sameDurableFolder(old.originalParent.evidence,old.root.root.evidence):sameDurableFolder(old.originalParent.evidence,old.root.root.evidence,false)) || !sameDurableFolder(old.root.root.evidence,root.root.evidence,false)||!sameDurableFolder(old.project.evidence,v.project.evidence,false)))return null;
  if(oldParents.some((parent,index)=>parent.observation&&(!v.parents[index]?.observation||!sameDurableFolder(parent.observation.evidence,v.parents[index].observation.evidence,false))))return null;
  return v;
 }catch{return null;}
}
export function observeArchivedFolder(source:{id:string;canonicalRoot:string;archiveRelativePath:string|null},archive:Archive,root:FilesystemAuthorization,reader:EvidenceReader,
 previous:ArchivedFolderAssociation[]=[]):ArchivedFolderAssociation {
 if(!source.archiveRelativePath || archive.sourceId!==source.id || !archive.relativePath.startsWith(source.archiveRelativePath+'/'))throw new Error('Invalid designated archive route');
 const parts=archive.relativePath.split('/'),parents:ArchiveParent[]=[];
 if(!parts.every(isChildName))throw new Error('Invalid archive route');
 const observe=(path:string)=>{
  const entry=nativeProjectFilesystem.inspect(path);verifyCreationDirectory(nativeProjectFilesystem,path,entry.identity);
  nativeProjectFilesystem.assertAccessible?.(path);
  const proof=reader(path,root.root.evidence.scope);
  if(!parseFolderObservation(proof) || !proof.ok || !sameIdentity(entry.identity,proof.mount) || !sameVolumeEvidence(root.root,proof) || proof.evidence.scope!==root.root.evidence.scope)throw new Error('Unverified archive route');
  return proof;
 };
 let parent=source.canonicalRoot;
 for(const [index,name] of parts.entries()) {
  if(nativeProjectFilesystem.names(parent).some(entry=>entry!==name&&filesystemAlias(entry)===filesystemAlias(name)))throw new Error('Archive route alias');
  const path=join(parent,name),proof=observe(path);
  if(index<parts.length-1)parents.push({path:parts.slice(0,index+1).join('/'),identity:proof.mount,observation:proof});
  else {
   const result:ArchivedFolderAssociation={version:1,sourceId:source.id,projectId:archive.projectId,archive,root,project:proof,parents};
   if(!parseArchivedFolderAssociation(JSON.stringify(result)))throw new Error('Invalid archive association');
   for(const before of previous.filter(item=>isDeepStrictEqual(item.archive,archive)))if(!sameDurableFolder(before.root.root.evidence,root.root.evidence,false) || !sameDurableFolder(before.project.evidence,proof.evidence,false) ||
    before.parents.some((saved,i)=>!sameDurableFolder(saved.observation!.evidence,parents[i].observation!.evidence,false)))throw new Error('Changed archived association');
   const after=observe(source.canonicalRoot);
   if(!sameDurableFolder(after.evidence,root.root.evidence)||!sameIdentity(after.mount,root.root.mount))throw new Error('Changed archive root');
   return result;
  }
  parent=path;
 }
 throw new Error('Missing archive folder');
}


export function archivedAssociationMatchesRecord(record:typeof schema.archivedFolderAssociations.$inferSelect|undefined,id:string,authority:ArchivedFolderAssociation):boolean {
 if(!record)return false;
 const parsed=parseArchivedFolderAssociation(record.authorization);
 return record.id===id && record.sourceId===authority.sourceId && record.projectId===authority.projectId && record.generation===authority.root.generation &&
  !!parsed && isDeepStrictEqual(parsed,authority);
}
