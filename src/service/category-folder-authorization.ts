import {parseFilesystemAuthorization,parseFolderObservation,type FilesystemAuthorization,type VerifiedFolder} from "./filesystem-authorization.js";
import {sameIdentity,isChildName} from "./discovery.js";
import {durableOwnershipKey,sameDurableFolder} from "./folder-evidence.js";
import {sameVolumeEvidence} from "./source-identity.js";

export interface CategoryFolderAuthorization {
  version: 1;
  binding: FilesystemAuthorization;
  category: VerifiedFolder | null;
  projects: {id:string;relativePath:string;observation:VerifiedFolder}[];
}
export function parseCategoryFolderAuthorization(value:string|null):CategoryFolderAuthorization|null {
  try {
    const v=value?JSON.parse(value):null;
    if(!v || Object.keys(v).sort().join()!=="binding,category,projects,version" || v.version!==1)return null;
    const binding=parseFilesystemAuthorization(JSON.stringify(v.binding));
    if(!binding || !sameDurableFolder(binding.root.evidence,binding.parent.evidence) || !sameIdentity(binding.root.mount,binding.parent.mount) ||
      v.category!==null && !parseFolderObservation(v.category) || !Array.isArray(v.projects))return null;
    const ids=new Set<string>(),paths=new Set<string>(),owners=new Set([durableOwnershipKey(binding.root.evidence)]);
    const observations:VerifiedFolder[]=[];
    if(v.category)observations.push(v.category);
    for(const project of v.projects) {
      if(!project || Object.keys(project).sort().join()!=="id,observation,relativePath" || typeof project.id!=="string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(project.id) ||
        typeof project.relativePath!=="string" || project.relativePath.split("/").length!==2 || !project.relativePath.split("/").every(isChildName) ||
        !parseFolderObservation(project.observation) || ids.has(project.id) || paths.has(project.relativePath))return null;
      ids.add(project.id);paths.add(project.relativePath);observations.push(project.observation);
    }
    for(const observed of observations) {
      const key=durableOwnershipKey(observed.evidence);
      if(!sameVolumeEvidence(binding.root,observed) || observed.evidence.scope!==binding.root.evidence.scope || owners.has(key))return null;
      owners.add(key);
    }
    return v;
  }catch{return null;}
}

export interface CategoryFolderBindingRow {
  sourceId:string;categoryId:string;action:string;binding:string;nativeIdentity:string|null;
  originalRelativePath:string|null;requestedRelativePath:string;
}
/** Match proof roles to the immutable request. Renewed reviews keep full durable
 * evidence; legacy reviews must additionally prove every original native tuple. */
export function categoryAuthorizationMatchesBinding(authority:CategoryFolderAuthorization,row:CategoryFolderBindingRow,mode:"original"|"legacy_review"|"renewed_review"="original"):boolean {
  try {
    const b=JSON.parse(row.binding),root=authority.binding.root;
    if(!b || b.source?.id!==row.sourceId || b.source.discoveryMode!=="grouped" || !b.snapshot || !Array.isArray(b.snapshot.children) ||
      !Array.isArray(b.members) || !Array.isArray(b.additions) || !["create","associate","rename"].includes(row.action) || !isChildName(row.requestedRelativePath))return false;
    if(mode!=="renewed_review" && !sameIdentity(b.snapshot.root.identity,root.mount))return false;
    if(mode==="legacy_review") {if(!sameIdentity(JSON.parse(b.source.appliedRootIdentity),root.mount))return false;}
    else {
      const sourceProof=JSON.parse(b.source.durableEvidence);
      if(!sameDurableFolder(sourceProof,root.evidence) || mode==="original" && b.source.evidenceGeneration!==authority.binding.generation)return false;
    }
    if(row.action==="create") {
      if(authority.category!==null || b.category!==null || row.originalRelativePath!==null || b.members.length || b.additions.length || authority.projects.length)return false;
    } else {
      if(!authority.category || row.nativeIdentity===null)return false;
      const path=row.action==="rename"?row.originalRelativePath:row.requestedRelativePath;
      const child=b.snapshot.children.find((child:{relativePath:string})=>child.relativePath===path);
      if(!child || child.kind!=="directory" || mode!=="renewed_review" && !sameIdentity(child.identity,authority.category.mount))return false;
      if(row.action==="rename") {
        if(!b.category || b.category.id!==row.categoryId || b.category.sourceId!==row.sourceId || b.category.relativePath!==row.originalRelativePath ||
          b.category.nativeIdentity!==row.nativeIdentity || b.additions.length)return false;
        if(mode==="legacy_review") {if(!sameIdentity(JSON.parse(row.nativeIdentity),authority.category.mount))return false;}
        else if(!sameDurableFolder(JSON.parse(b.category.durableEvidence),authority.category.evidence))return false;
      } else if(b.category!==null || row.originalRelativePath!==null || b.members.length || b.associationIdentity!==row.nativeIdentity ||
        mode!=="renewed_review" && !sameIdentity(JSON.parse(row.nativeIdentity),authority.category.mount))return false;
    }
    const expected=row.action==="rename"?b.members:b.additions;
    if(expected.length!==authority.projects.length)return false;
    for(const project of authority.projects) {
      const saved=expected.find((p:{id:string})=>p.id===project.id);
      const child=b.snapshot.children.find((p:{relativePath:string})=>p.relativePath===project.relativePath);
      if(!saved || saved.sourceId!==row.sourceId || saved.relativePath!==project.relativePath || !child || child.kind!=="directory" ||
        project.relativePath.split("/")[0]!== (row.originalRelativePath??row.requestedRelativePath) ||
        mode!=="renewed_review" && !sameIdentity(child.identity,project.observation.mount))return false;
      if(mode==="legacy_review" || row.action==="associate" && mode==="original") {
        if(!sameIdentity(JSON.parse(saved.nativeIdentity),project.observation.mount))return false;
      } else if(row.action==="rename" && !sameDurableFolder(JSON.parse(saved.durableEvidence),project.observation.evidence))return false;
    }
    return true;
  }catch{return false;}
}
