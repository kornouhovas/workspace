import {isDeepStrictEqual} from "node:util";
import {parseFilesystemAuthorization,parseFolderObservation,type FilesystemAuthorization,type VerifiedFolder} from "./filesystem-authorization.js";
import {sameIdentity,isChildName} from "./discovery.js";
import {durableOwnershipKey,sameDurableFolder} from "./folder-evidence.js";
import {sameVolumeEvidence} from "./source-identity.js";

export interface RemovalAuthorization {
  version:1;
  root:FilesystemAuthorization;
  category:VerifiedFolder;
  destination:VerifiedFolder|null;
  projects:{id:string;observation:VerifiedFolder}[];
}
type RecordProof={nativeIdentity:string;id:string;sourceId:string;relativePath:string;durableEvidence:string|null};
export interface RemovalBinding {
  source:{discoveryRevision:number;appliedRootIdentity?:string|null;id:string;discoveryMode:string|null;durableEvidence:string|null;evidenceGeneration:number};
  category:RecordProof;destination:RecordProof|null;members:RecordProof[];
}
/** Proofs are role-bound to the original immutable batch, never inferred from a locator. */
export function parseRemovalAuthorization(value:string|null,binding:RemovalBinding):RemovalAuthorization|null {
  try {
    const v=value?JSON.parse(value):null;
    if(!v || Object.keys(v).sort().join()!=="category,destination,projects,root,version" || v.version!==1 ||
      binding.source.discoveryMode!=="grouped" || !parseFilesystemAuthorization(JSON.stringify(v.root)) ||
      !sameDurableFolder(v.root.root.evidence,v.root.parent.evidence) || !sameIdentity(v.root.root.mount,v.root.parent.mount) ||
      v.root.generation!==binding.source.evidenceGeneration || !sameDurableFolder(JSON.parse(binding.source.durableEvidence!),v.root.root.evidence) ||
      !parseFolderObservation(v.category) || !isChildName(binding.category.relativePath) || binding.category.sourceId!==binding.source.id ||
      !sameDurableFolder(JSON.parse(binding.category.durableEvidence!),v.category.evidence) ||
      binding.destination===null !== (v.destination===null) || !Array.isArray(v.projects) || v.projects.length!==binding.members.length)return null;
    if(binding.destination && (!parseFolderObservation(v.destination) || !isChildName(binding.destination.relativePath) ||
      binding.destination.id===binding.category.id || binding.destination.relativePath===binding.category.relativePath || binding.destination.sourceId!==binding.source.id ||
      !sameDurableFolder(JSON.parse(binding.destination.durableEvidence!),v.destination.evidence)))return null;
    const observations=[v.root.root,v.category,...(v.destination?[v.destination]:[])],ids=new Set<string>();
    for(const project of v.projects) {
      const saved=binding.members.find(p=>p.id===project.id);
      if(Object.keys(project).sort().join()!=="id,observation" || !saved || ids.has(project.id) || saved.sourceId!==binding.source.id ||
        saved.relativePath.split("/").length!==2 || !saved.relativePath.split("/").every(isChildName) || saved.relativePath.split("/")[0]!==binding.category.relativePath ||
        !parseFolderObservation(project.observation) || !sameDurableFolder(JSON.parse(saved.durableEvidence!),project.observation.evidence))return null;
      ids.add(project.id);observations.push(project.observation);
    }
    const owners=new Set<string>();
    for(const observation of observations) {
      const key=durableOwnershipKey(observation.evidence);
      if(owners.has(key) || !sameVolumeEvidence(v.root.root,observation) || observation.evidence.scope!==v.root.root.evidence.scope)return null;
      owners.add(key);
    }
    return v;
  }catch{return null;}
}

export function removalBindingMatchesRow(binding:RemovalBinding & {category:{nativeIdentity:string}}, row:{sourceId:string;categoryId:string;destinationCategoryId:string|null;originalRelativePath:string;requestedRelativePath:string|null;nativeIdentity:string}):boolean {
  return binding.source.id===row.sourceId && binding.category.id===row.categoryId && binding.category.relativePath===row.originalRelativePath &&
    binding.category.nativeIdentity===row.nativeIdentity && (binding.destination?.id??null)===row.destinationCategoryId && (binding.destination?.relativePath??null)===row.requestedRelativePath;
}

export function removalAttestationMatchesBinding(reviewed:RemovalBinding & {authorization:RemovalAuthorization},original:RemovalBinding & {authorization?:RemovalAuthorization}):boolean {
  try {
    const saved=parseRemovalAuthorization(original.authorization?JSON.stringify(original.authorization):null,original);
    const current=parseRemovalAuthorization(JSON.stringify(reviewed.authorization),reviewed);
    if(reviewed.source.discoveryRevision<original.source.discoveryRevision)return false;
    if(!saved && current) {
      if(Object.hasOwn(original,"authorization") || original.source.durableEvidence!=null || original.category.durableEvidence!=null || original.destination?.durableEvidence!=null || original.members.some(p=>p.durableEvidence!=null) ||
        !sameIdentity(JSON.parse(original.source.appliedRootIdentity!),current.root.root.mount) || !sameIdentity(JSON.parse(original.category.nativeIdentity),current.category.mount) ||
        (original.destination===null ? current.destination!==null : !current.destination || !sameIdentity(JSON.parse(original.destination.nativeIdentity),current.destination.mount)) ||
        original.members.length!==current.projects.length || original.members.some(p=>!current.projects.some(q=>q.id===p.id&&sameIdentity(JSON.parse(p.nativeIdentity),q.observation.mount))))return false;
      const strip=(value:unknown)=>JSON.parse(JSON.stringify(value, (key,value)=>key==="durableEvidence"?undefined:value));
      const sourcePolicy=(source:RemovalBinding["source"])=>Object.fromEntries(Object.entries(source).filter(([key])=>!["propertyRevision","categoryPropertyRevision","appliedRootIdentity","durableEvidence","evidenceGeneration","discoveryRevision"].includes(key)));
      return isDeepStrictEqual(sourcePolicy(reviewed.source),sourcePolicy(original.source)) && isDeepStrictEqual(strip(reviewed.category),strip(original.category)) &&
        isDeepStrictEqual(strip(reviewed.destination),strip(original.destination)) && isDeepStrictEqual(strip(reviewed.members),strip(original.members));
    }
    if(!saved || !current || current.root.generation<saved.root.generation || !sameDurableFolder(saved.root.root.evidence,current.root.root.evidence) ||
      !sameDurableFolder(saved.category.evidence,current.category.evidence) || (saved.destination===null ? current.destination!==null : !current.destination || !sameDurableFolder(saved.destination.evidence,current.destination.evidence)) ||
      saved.projects.length!==current.projects.length || saved.projects.some(p=>!current.projects.some(q=>q.id===p.id&&sameDurableFolder(p.observation.evidence,q.observation.evidence))))return false;
    const sourcePolicy=(source:RemovalBinding["source"])=>Object.fromEntries(Object.entries(source).filter(([key])=>!["propertyRevision","categoryPropertyRevision","appliedRootIdentity","durableEvidence","evidenceGeneration","discoveryRevision"].includes(key)));
    return isDeepStrictEqual(sourcePolicy(reviewed.source),sourcePolicy(original.source)) && isDeepStrictEqual(reviewed.category,original.category) &&
      isDeepStrictEqual(reviewed.destination,original.destination) && isDeepStrictEqual(reviewed.members,original.members);
  }catch{return false;}
}
