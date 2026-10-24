import {parseFilesystemAuthorization,parseFolderObservation,type FilesystemAuthorization,type VerifiedFolder} from "./filesystem-authorization.js";
import {sameVolumeEvidence} from "./source-identity.js";
import {sameDurableFolder,durableOwnershipKey} from "./folder-evidence.js";
import {isChildName,reliableIdentity,sameIdentity,type NativeIdentity} from "./discovery.js";

export interface ArchiveAuthorization {
 version:1;root:FilesystemAuthorization;project:VerifiedFolder;originalParent:VerifiedFolder;
}
export interface ArchiveParent {path:string;identity:NativeIdentity|null;observation?:VerifiedFolder|null}
export function parseArchiveAuthorization(value:string|null):ArchiveAuthorization|null {
 try {
  const v=value?JSON.parse(value):null,root=v?parseFilesystemAuthorization(JSON.stringify(v.root)):null;
  if(!v || Object.keys(v).sort().join()!=="originalParent,project,root,version" || v.version!==1 || !root ||
   !sameDurableFolder(root.root.evidence,root.parent.evidence) || !sameIdentity(root.root.mount,root.parent.mount) ||
   !parseFolderObservation(v.project) || !parseFolderObservation(v.originalParent))return null;
  for(const proof of [v.project,v.originalParent])if(!sameVolumeEvidence(root.root,proof) || proof.evidence.scope!==root.root.evidence.scope)return null;
  const projectKey=durableOwnershipKey(v.project.evidence);
  if(projectKey===durableOwnershipKey(root.root.evidence) || projectKey===durableOwnershipKey(v.originalParent.evidence))return null;
  return v;
 }catch{return null;}
}
export function parseArchiveParents(value:unknown,requireProof:boolean):ArchiveParent[]|null {
 try {
  if(!Array.isArray(value))return null;
  for(const [index,p] of value.entries()) {
   if(!p || typeof p!=="object" || Array.isArray(p) || !["identity,path","identity,observation,path"].includes(Object.keys(p).sort().join()) ||
    typeof p.path!=="string" || p.path.split("/").length!==index+1 || !p.path.split("/").every(isChildName) ||
    index>0 && !p.path.startsWith(value[index-1].path+"/"))return null;
   if(p.identity!==null && (!reliableIdentity(p.identity) || Object.keys(p.identity).sort().join()!=="birthtimeNs,dev,ino" ||
    ![p.identity.dev,p.identity.ino,p.identity.birthtimeNs].every(field=>typeof field==="string"&&/^\d+$/.test(field))))return null;
   if(p.identity===null ? p.observation!=null : requireProof && !parseFolderObservation(p.observation) || p.observation!=null && (!parseFolderObservation(p.observation) || !sameIdentity(p.identity,p.observation.mount)))return null;
   if(index>0 && value[index-1].identity===null && p.identity!==null)return null;
  }
  return value;
 }catch{return null;}
}
/** Different locators cannot supply the same physical parent/project proof. */
export function uniqueArchiveProofs(authority:ArchiveAuthorization,groups:ArchiveParent[][]):boolean {
 const paths=new Map<string,VerifiedFolder>([["",authority.root.root]]),owners=new Map<string,string>([[durableOwnershipKey(authority.root.root.evidence),""]]);
 for(const group of groups)for(const parent of group) {
  const proof=parent.observation;
  if(!proof)continue;
  if(!sameVolumeEvidence(authority.root.root,proof) || authority.root.root.evidence.scope!==proof.evidence.scope)return false;
  const key=durableOwnershipKey(proof.evidence),existing=paths.get(parent.path),owner=owners.get(key);
  if(existing && (!sameDurableFolder(existing.evidence,proof.evidence) || !sameIdentity(existing.mount,proof.mount)) || owner!==undefined && owner!==parent.path || key===durableOwnershipKey(authority.project.evidence))return false;
  paths.set(parent.path,proof);owners.set(key,parent.path);
 }
 return true;
}

export interface ArchiveBindingSnapshot {
 source:typeof import('./db/schema.js').sources.$inferSelect;
 project:typeof import('./db/schema.js').projects.$inferSelect;
 archive:typeof import('./db/schema.js').projectArchives.$inferSelect|null;
 category:typeof import('./db/schema.js').categories.$inferSelect|null;
 sourceParents:ArchiveParent[];destinationParents:ArchiveParent[];createParent:boolean;
 mode:'direct'|'grouped';categoryName:string|null;authorization?:ArchiveAuthorization;
}
export interface ArchiveRowDescriptor {
 sourceId:string;projectId:string;action:string;originalRelativePath:string;requestedRelativePath:string;nativeIdentity:string;
}
const pathParts=(path:string)=>typeof path==='string'&&path.split('/').every(isChildName);
export function archiveParentPathsMatch(parents:ArchiveParent[],path:string):boolean {
 const parts=path.split('/').slice(0,-1);
 return parents.length===parts.length&&parents.every((parent,index)=>parent.path===parts.slice(0,index+1).join('/'));
}
/** Bind physical observations to the immutable operation's logical and path roles. */
export function archiveBindingMatchesRow(binding:ArchiveBindingSnapshot,row:ArchiveRowDescriptor):boolean {
 try {
  const b=binding;
  if(!b || b.source.id!==row.sourceId || b.project.id!==row.projectId || b.project.sourceId!==row.sourceId ||
   !['direct','grouped'].includes(b.mode) || b.source.discoveryMode!==b.mode || typeof b.createParent!=='boolean' ||
   b.project.nativeIdentity!==row.nativeIdentity || !pathParts(row.originalRelativePath) || !pathParts(row.requestedRelativePath) ||
   row.originalRelativePath===row.requestedRelativePath || !parseArchiveParents(b.sourceParents,false) || !parseArchiveParents(b.destinationParents,false) ||
   !archiveParentPathsMatch(b.sourceParents,row.originalRelativePath) || !archiveParentPathsMatch(b.destinationParents,row.requestedRelativePath) ||
   b.sourceParents.some(p=>p.identity===null))return false;
  if(b.category && (b.category.id!==b.project.categoryId || b.category.sourceId!==row.sourceId))return false;
  if(row.action==='archive')return b.archive===null && !b.project.modeInactive && b.project.associationState==='active' &&
   b.project.relativePath===row.originalRelativePath && b.project.relativePath.split('/').length===(b.mode==='direct'?1:2) &&
   typeof b.source.archiveRelativePath==='string'&&pathParts(b.source.archiveRelativePath)&&row.requestedRelativePath===`${b.source.archiveRelativePath}/${b.project.relativePath}` &&
   (b.mode==='direct'?b.category===null&&b.project.categoryId===null:!!b.category&&b.category.relativePath===b.project.relativePath.split('/')[0]);
  if(row.action!=='restore' || !b.archive || b.archive.projectId!==row.projectId || b.archive.sourceId!==row.sourceId ||
   b.archive.relativePath!==row.originalRelativePath || b.archive.originalRelativePath!==b.project.relativePath || b.archive.mode!==b.mode ||
   !b.project.modeInactive || b.destinationParents.some(p=>p.identity===null)&&!b.createParent)return false;
  const parts=b.archive.originalRelativePath.split('/');
  return parts.length===(b.mode==='direct'?1:2)&&row.requestedRelativePath.split('/').length===parts.length &&
   row.requestedRelativePath.split('/').slice(0,-1).join('/')===parts.slice(0,-1).join('/');
 }catch{return false;}
}
export function parseArchiveBindingAuthorization(binding:ArchiveBindingSnapshot,row?:ArchiveRowDescriptor):ArchiveAuthorization|null {
 try {
  const auth=parseArchiveAuthorization(binding.authorization?JSON.stringify(binding.authorization):null);
  if(!auth || auth.root.generation!==binding.source.evidenceGeneration || !sameDurableFolder(auth.root.root.evidence,JSON.parse(binding.source.durableEvidence!)) ||
   !sameDurableFolder(auth.project.evidence,JSON.parse(binding.project.durableEvidence!)) || !parseArchiveParents(binding.sourceParents,true) ||
   !parseArchiveParents(binding.destinationParents,true) || binding.sourceParents.some(p=>p.identity===null) ||
   !uniqueArchiveProofs(auth,[binding.sourceParents,binding.destinationParents]) || row&&!archiveBindingMatchesRow(binding,row))return null;
  if(binding.archive) {
   const saved=binding.archive.authorization?parseArchiveAuthorization(binding.archive.authorization):null;
   if(binding.archive.authorization!==null && !saved)return null;
   if(saved) {
    if(saved.root.generation>auth.root.generation)return null;
    if(!sameDurableFolder(saved.root.root.evidence,auth.root.root.evidence) || !sameDurableFolder(saved.project.evidence,auth.project.evidence) ||
     !sameDurableFolder(saved.originalParent.evidence,auth.originalParent.evidence))return null;
   } else {
    const expected=binding.mode==='direct'?auth.root.root.evidence:binding.category?JSON.parse(binding.category.durableEvidence!):null;
    if(!expected || !sameDurableFolder(expected,auth.originalParent.evidence) || !sameIdentity(JSON.parse(binding.archive.parentIdentity),auth.originalParent.mount))return null;
   }
  }else {
   const parent=binding.sourceParents.at(-1)?.observation??auth.root.root;
   if(!parent || !sameDurableFolder(parent.evidence,auth.originalParent.evidence) || !sameIdentity(parent.mount,auth.originalParent.mount))return null;
   if(binding.mode==='grouped' && (!binding.category || !sameDurableFolder(JSON.parse(binding.category.durableEvidence!),auth.originalParent.evidence)))return null;
  }
  return auth;
 }catch{return null;}
}
