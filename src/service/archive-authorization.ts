import {sourceFolderRolePolicy} from "./folder-roles.js";
import {isDeepStrictEqual} from "node:util";
import {parseFilesystemAuthorization,parseFolderObservation,type FilesystemAuthorization,type VerifiedFolder} from "./filesystem-authorization.js";
import {sameVolumeEvidence} from "./source-identity.js";
import {sameDurableFolder,durableOwnershipKey} from "./folder-evidence.js";
import {isChildName,sameIdentity} from "./discovery.js";
import {parseArchivedFolderAssociation,type ArchivedFolderAssociation} from "./archive-association.js";
import {parseArchiveAuthorizationV1,parseArchiveParents,archiveParentPathsMatch,uniqueArchiveProofs,type ArchiveAuthorizationV1,type ArchiveParent} from "./archive-proof.js";
export {parseArchiveParents,archiveParentPathsMatch,uniqueArchiveProofs};
export type {ArchiveParent};
export interface ArchiveAuthorizationV2 {
 version:2;root:FilesystemAuthorization;project:VerifiedFolder;originalParent:VerifiedFolder|null;association:ArchivedFolderAssociation;associationId:string;
}
export type ArchiveAuthorization=ArchiveAuthorizationV1|ArchiveAuthorizationV2;
export function parseArchiveAuthorization(value:string|null):ArchiveAuthorization|null {
 try {
  const v=value?JSON.parse(value):null;
  if(v?.version===1)return parseArchiveAuthorizationV1(value);
  const root=v?parseFilesystemAuthorization(JSON.stringify(v.root)):null,association=v?parseArchivedFolderAssociation(JSON.stringify(v.association)):null;
  if(!v || v.version!==2 || Object.keys(v).sort().join()!=="association,associationId,originalParent,project,root,version" || !root || !association || typeof v.associationId!=="string" || !/^[a-f0-9-]{36}$/i.test(v.associationId) ||
   !parseFolderObservation(v.project) || !sameDurableFolder(root.root.evidence,root.parent.evidence) || !sameIdentity(root.root.mount,root.parent.mount) ||
   !sameVolumeEvidence(root.root,v.project) || root.root.evidence.scope!==v.project.evidence.scope || root.generation<association.root.generation ||
   !sameDurableFolder(root.root.evidence,association.root.root.evidence) || !sameDurableFolder(v.project.evidence,association.project.evidence) ||
   durableOwnershipKey(root.root.evidence)===durableOwnershipKey(v.project.evidence))return null;
  const old=association.archive.authorization===null?null:parseArchiveAuthorizationV1(association.archive.authorization);
  if(old ? !isDeepStrictEqual(v.originalParent,old.originalParent) : v.originalParent!==null)return null;
  return v;
 }catch{return null;}
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
  if(auth.version===2) {
   if(!binding.archive || typeof binding.source.archiveRelativePath!=="string" || !pathParts(binding.source.archiveRelativePath) || !binding.archive.relativePath.startsWith(binding.source.archiveRelativePath+'/') || auth.association.sourceId!==binding.source.id || auth.association.projectId!==binding.project.id || !isDeepStrictEqual(auth.association.archive,binding.archive) ||
    binding.sourceParents.length!==auth.association.parents.length || binding.sourceParents.some((parent,index)=>parent.path!==auth.association.parents[index].path ||
      !parent.observation || !sameDurableFolder(parent.observation.evidence,auth.association.parents[index].observation!.evidence)))return null;
   return auth;
  }
  if(binding.archive) {
   const saved=binding.archive.authorization?parseArchiveAuthorization(binding.archive.authorization):null;
   if(binding.archive.authorization!==null && !saved)return null;
   if(saved) {
    if(saved.version!==1)return null;
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

/** A renewal retains every logical/path role and full identity from its journal. */
export function archiveRenewalMatches(original:ArchiveBindingSnapshot,current:ArchiveBindingSnapshot,parents:ArchiveParent[],recorded:ArchiveParent[]):boolean {
 try {
  const before=parseArchiveBindingAuthorization(original),after=parseArchiveBindingAuthorization(current);
  if(!before || !after || before.version!==after.version || before.version===2&&(after.version!==2||before.associationId!==after.associationId||!isDeepStrictEqual(before.association,after.association)) || after.root.generation<before.root.generation || current.source.discoveryRevision<original.source.discoveryRevision ||
   !sameDurableFolder(before.root.root.evidence,after.root.root.evidence) || !sameDurableFolder(before.project.evidence,after.project.evidence) ||
   (before.originalParent===null?after.originalParent!==null:after.originalParent===null||!sameDurableFolder(before.originalParent.evidence,after.originalParent.evidence)))return false;
  const policy=(source:ArchiveBindingSnapshot['source'])=>({...sourceFolderRolePolicy(source),discoveryRevision:0,evidenceGeneration:0,propertyRevision:0,categoryPropertyRevision:0,appliedRootIdentity:null});
  if(!isDeepStrictEqual(policy(original.source),policy(current.source)) ||
   ['project','archive','category','mode','createParent','categoryName'].some(field=>!isDeepStrictEqual(original[field as keyof ArchiveBindingSnapshot],current[field as keyof ArchiveBindingSnapshot])))return false;
  const sameRoles=(old:ArchiveParent[],fresh:ArchiveParent[])=>old.length===fresh.length && old.every((parent,index)=>{
   const next=fresh[index];return parent.path===next.path && (parent.identity===null ? next.identity===null : !!parent.observation&&!!next.observation&&sameDurableFolder(parent.observation.evidence,next.observation.evidence));
  });
  return !!parseArchiveParents(parents,true) && !!parseArchiveParents(recorded,true) &&
   sameRoles(original.sourceParents,current.sourceParents) && sameRoles(original.destinationParents,current.destinationParents) && sameRoles(recorded,parents) && uniqueArchiveProofs(after,[current.sourceParents,parents]);
 }catch{return false;}
}

/** Sidecars carry renewed observations, never a rewritten original request. */
export function parseArchiveAttestation(proof:Pick<typeof import('./db/schema.js').projectArchiveAttestations.$inferSelect,'journal'|'binding'|'parents'|'sequence'>,
 row:typeof import('./db/schema.js').projectArchiveOperations.$inferSelect,prior?:{binding:ArchiveBindingSnapshot;parents:ArchiveParent[];sequence:number}):{binding:ArchiveBindingSnapshot;parents:ArchiveParent[];sequence:number}|null {
 try {
  const journal=JSON.parse(proof.journal),binding=JSON.parse(proof.binding),parents=parseArchiveParents(JSON.parse(proof.parents),true);
  const fields=['operationId','sourceId','workspaceId','projectId','action','originalRelativePath','requestedRelativePath','nativeIdentity','binding','previewToken'] as const;
  const original=JSON.parse(row.binding),legacy=!Object.hasOwn(original,"authorization");
  const recorded=parseArchiveParents(JSON.parse(journal.parents),!legacy),current=parseArchiveParents(JSON.parse(row.parents),!legacy);
  const auth=parseArchiveBindingAuthorization(binding,row);
  const known=recorded?.map((parent,index)=>parent.identity!==null && !parent.observation && prior?.parents[index]?.observation?{...prior.parents[index],path:parent.path}:parent);
  if(!Number.isSafeInteger(proof.sequence) || proof.sequence!==(prior?prior.sequence+1:0) || !['intent','destination_recorded'].includes(journal.stage) || fields.some(field=>!Object.hasOwn(journal,field)||journal[field]!==row[field]) ||
   !auth || !parents || !recorded || !current || !archiveParentPathsMatch(parents,row.requestedRelativePath) || !uniqueArchiveProofs(auth,[binding.sourceParents,current]) ||
   legacy&&current.some((parent,index)=>parent.observation!=null&&original.destinationParents[index].identity!==null) ||
   !(prior?archiveRenewalMatches(prior.binding,binding,parents,known!):legacy?legacyArchiveRenewalMatches(original,binding,parents,recorded):archiveRenewalMatches(original,binding,parents,recorded)) || recorded.some((parent,index)=>parent.identity!==null&&!isDeepStrictEqual(parent,current[index])))return null;
  return {binding,parents,sequence:proof.sequence};
 }catch{return null;}
}

/** First consent for old journals proves every recorded native tuple exactly. */
export function legacyArchiveRenewalMatches(original:ArchiveBindingSnapshot,current:ArchiveBindingSnapshot,parents:ArchiveParent[],recorded:ArchiveParent[]):boolean {
 try {
  if(Object.hasOwn(original,'authorization') || original.source.durableEvidence!=null || original.project.durableEvidence!=null || original.category?.durableEvidence!=null || original.archive?.authorization!=null)return false;
  const native=(value:string)=>{const identity=JSON.parse(value);if(!parseArchiveParents([{path:'Role',identity}],false))throw new Error('Invalid legacy identity');return identity;};
  const auth=parseArchiveBindingAuthorization(current);
  if(!auth || auth.version!==1 || original.source.evidenceGeneration!==undefined && (!Number.isSafeInteger(original.source.evidenceGeneration) || original.source.evidenceGeneration<0 || original.source.evidenceGeneration>auth.root.generation) || !sameIdentity(native(original.source.appliedRootIdentity!),auth.root.root.mount) || !sameIdentity(native(original.project.nativeIdentity),auth.project.mount))return false;
  const evidenceMatches=(saved:string|null|undefined,proof:VerifiedFolder)=>saved==null || sameDurableFolder(JSON.parse(saved),proof.evidence);
  if(!evidenceMatches(original.source.durableEvidence,auth.root.root) || !evidenceMatches(original.project.durableEvidence,auth.project))return false;
  const policy=(source:ArchiveBindingSnapshot['source'])=>({...sourceFolderRolePolicy(source),durableEvidence:null,evidenceGeneration:0,discoveryRevision:0,propertyRevision:0,categoryPropertyRevision:0});
  const record=(value:ArchiveBindingSnapshot['project']|ArchiveBindingSnapshot['category'])=>value?{...value,durableEvidence:null}:null;
  const archive=(value:ArchiveBindingSnapshot['archive'])=>value?{...value,authorization:value.authorization??null}:null;
  if(!isDeepStrictEqual(policy(original.source),policy(current.source)) || !isDeepStrictEqual(record(original.project),record(current.project)) ||
   !isDeepStrictEqual(record(original.category),record(current.category)) || !isDeepStrictEqual(archive(original.archive),current.archive) ||
   ['mode','createParent','categoryName'].some(field=>!isDeepStrictEqual(original[field as keyof ArchiveBindingSnapshot],current[field as keyof ArchiveBindingSnapshot])))return false;
  if(original.category && (!sameIdentity(native(original.category.nativeIdentity),auth.originalParent.mount) || !evidenceMatches(original.category.durableEvidence,auth.originalParent)))return false;
  if(original.archive && !sameIdentity(native(original.archive.parentIdentity),auth.originalParent.mount))return false;
  const sameRoles=(old:ArchiveParent[],fresh:ArchiveParent[])=>!!parseArchiveParents(old,false)&&!!parseArchiveParents(fresh,true)&&old.length===fresh.length && old.every((parent,index)=>{
   const next=fresh[index];return parent.path===next.path && (parent.identity===null ? next.identity===null : !!next.observation&&sameIdentity(parent.identity,next.observation.mount)&&
    (parent.observation==null || sameDurableFolder(parent.observation.evidence,next.observation.evidence)));
  });
  return sameRoles(original.sourceParents,current.sourceParents) && sameRoles(original.destinationParents,current.destinationParents) && sameRoles(recorded,parents) && uniqueArchiveProofs(auth,[current.sourceParents,parents]);
 }catch{return false;}
}
