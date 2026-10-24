import {parseFilesystemAuthorization,parseFolderObservation,type FilesystemAuthorization,type VerifiedFolder} from "./filesystem-authorization.js";
import {sameVolumeEvidence} from "./source-identity.js";
import {sameDurableFolder,durableOwnershipKey} from "./folder-evidence.js";
import {isChildName,reliableIdentity,sameIdentity,type NativeIdentity} from "./discovery.js";

export interface ArchiveAuthorizationV1 {
 version:1;root:FilesystemAuthorization;project:VerifiedFolder;originalParent:VerifiedFolder;
}
export interface ArchiveParent {path:string;identity:NativeIdentity|null;observation?:VerifiedFolder|null}
export function parseArchiveAuthorizationV1(value:string|null):ArchiveAuthorizationV1|null {
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
export function uniqueArchiveProofs(authority:Pick<ArchiveAuthorizationV1,"root"|"project">,groups:ArchiveParent[][]):boolean {
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


export function archiveParentPathsMatch(parents:ArchiveParent[],path:string):boolean {
 const parts=path.split('/').slice(0,-1);
 return parents.length===parts.length&&parents.every((parent,index)=>parent.path===parts.slice(0,index+1).join('/'));
}
