import {isDeepStrictEqual} from "node:util";
import {savedFolderRoles,roleParentPlacement,validRolePath} from "./folder-roles.js";
import {eq} from "drizzle-orm";
import type {BetterSQLite3Database} from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";
import {join} from "node:path";
import {sameIdentity, reliableIdentity, type NativeIdentity} from "./discovery.js";
import {durableOwnershipKey, sameDurableFolder, validateEvidence, type FolderEvidence, type FolderObservation} from "./folder-evidence.js";
import {rootOwnershipConflict, storedEvidence, identityState, sameVolumeEvidence, type EvidenceReader} from "./source-identity.js";
import {CreationFailure} from "./project-filesystem.js";

export type VerifiedFolder = Extract<FolderObservation,{ok:true}>;
type LegacyParents = {root:NativeIdentity;parent:NativeIdentity};
export interface FilesystemAuthorization {
  version: 1 | 2;
  ancestors?: {relativePath:string;observation:VerifiedFolder}[];
  generation: number;
  root: VerifiedFolder;
  parent: VerifiedFolder;
}
/** Closed legacy tuple syntax is separate from reliable current evidence. */
export function exactNativeIdentity(value:unknown):value is NativeIdentity {
  if(!value || typeof value!=="object" || Array.isArray(value) || Object.keys(value).sort().join()!=="birthtimeNs,dev,ino")return false;
  const v=value as NativeIdentity;
  return [v.dev,v.ino,v.birthtimeNs].every(field=>typeof field==="string"&&/^\d+$/.test(field));
}
export function parseLegacyNativeIdentity(encoded:unknown):NativeIdentity|null {
  try{if(typeof encoded!=="string")return null;const value:unknown=JSON.parse(encoded);return exactNativeIdentity(value)?value:null;}catch{return null;}
}
export function sameLegacyNativeIdentity(encoded:unknown,current:NativeIdentity):boolean {
  const saved=parseLegacyNativeIdentity(encoded);return !!saved&&sameIdentity(saved,current);
}
export function parseFolderObservation(value:unknown): VerifiedFolder | null {
  if(!value || typeof value!=="object" || Array.isArray(value))return null;
  const v=value as Partial<VerifiedFolder>;
  return Object.keys(v).sort().join() === "evidence,mount,ok" && v.ok===true && validateEvidence(v.evidence) && v.mount !== null && typeof v.mount === "object" && !Array.isArray(v.mount)
    && [v.mount.dev,v.mount.ino,v.mount.birthtimeNs].every(field=>typeof field === "string" && /^\d+$/.test(field)) && reliableIdentity(v.mount)
    && Object.keys(v.mount).sort().join()==="birthtimeNs,dev,ino" ? v as VerifiedFolder : null;
}
export function parseFilesystemAuthorization(value:string|null): FilesystemAuthorization | null {
  try {
    const v=value ? JSON.parse(value) : null;
    if(!v || ![1,2].includes(v.version) || Object.keys(v).sort().join()!==(v.version===2?"ancestors,generation,parent,root,version":"generation,parent,root,version") || !Number.isSafeInteger(v.generation) || v.generation<0 ||
      !parseFolderObservation(v.root) || !parseFolderObservation(v.parent) || !sameVolumeEvidence(v.root,v.parent) || v.root.evidence.scope!==v.parent.evidence.scope)return null;
    if(v.version===2) {
      if(!Array.isArray(v.ancestors)||!v.ancestors.length||v.ancestors.length>65)return null;
      const last=v.ancestors.at(-1);
      if(!last || typeof last.relativePath!=="string" || last.relativePath!==""&&!validRolePath(last.relativePath))return null;
      const paths=["",...(last.relativePath?last.relativePath.split("/").map((_:string,index:number)=>last.relativePath.split("/").slice(0,index+1).join("/")):[])];
      if(paths.length!==v.ancestors.length || v.ancestors.some((frame:{relativePath:string;observation:VerifiedFolder},index:number)=>!frame || Object.keys(frame).sort().join()!=="observation,relativePath" || frame.relativePath!==paths[index] || !parseFolderObservation(frame.observation) || !sameVolumeEvidence(v.root,frame.observation) || frame.observation.evidence.scope!==v.root.evidence.scope) ||
        !isDeepStrictEqual(v.ancestors[0].observation,v.root) || !isDeepStrictEqual(last.observation,v.parent))return null;
    }
    return v;
  } catch {return null;}
}
/** Durable route continuity for explicitly reviewed recovery, never an effect permit. */
export function sameAuthorizationRoute(a:FilesystemAuthorization,b:FilesystemAuthorization):boolean {
  if(!sameDurableFolder(a.root.evidence,b.root.evidence)||!sameDurableFolder(a.parent.evidence,b.parent.evidence))return false;
  if(a.version!==b.version)return false;
  return a.version===1 || a.ancestors!.length===b.ancestors!.length && a.ancestors!.every((frame,index)=>frame.relativePath===b.ancestors![index].relativePath&&sameDurableFolder(frame.observation.evidence,b.ancestors![index].observation.evidence));
}
/** An authentic old snapshot has no generation; a present field is still typed history. */
export function validLegacyGeneration(source:{evidenceGeneration?:unknown},maximum:number):boolean {
  return !Object.hasOwn(source,"evidenceGeneration") || Number.isSafeInteger(source.evidenceGeneration) && Number(source.evidenceGeneration)>=0 && Number(source.evidenceGeneration)<=maximum;
}
export function sameAuthorizationRoot(a:FilesystemAuthorization,b:FilesystemAuthorization):boolean {
  return a.generation===b.generation && sameDurableFolder(a.root.evidence,b.root.evidence) && sameIdentity(a.root.mount,b.root.mount);
}
/** Durable continuity admits an earlier mount; an execution snapshot never does. */
export function createFilesystemAuthorization(scope:string, read:EvidenceReader, db:BetterSQLite3Database<typeof schema>) {
  function capture(source:{canonicalRoot:string;durableEvidence:string|null;evidenceGeneration:number},parentRelativePath:string,parentEvidence:string|null,legacy?:LegacyParents):FilesystemAuthorization {
    if(legacy&&(!exactNativeIdentity(legacy.root)||!exactNativeIdentity(legacy.parent)))throw new CreationFailure("ownership_uncertain");
    const root=read(source.canonicalRoot,scope), parent=read(join(source.canonicalRoot,parentRelativePath),scope);
    if(identityState(source.durableEvidence,root,scope)!=="verified" ||
      !(identityState(parentEvidence,parent,scope)==="verified" || parentEvidence===null && legacy && parent.ok && sameIdentity(legacy.parent,parent.mount)) ||
      !root.ok || !parent.ok || !sameVolumeEvidence(root,parent))throw new CreationFailure("filesystem_changed");
    const owner=db.select().from(schema.sources).all().find(row=>row.canonicalRoot===source.canonicalRoot&&row.durableEvidence===source.durableEvidence);
    const ancestors=owner?.folderRoles ? ["",...(parentRelativePath?parentRelativePath.split("/").map((_,index)=>parentRelativePath.split("/").slice(0,index+1).join("/")):[])].map(relativePath=>{
      const observation=relativePath===""?root:relativePath===parentRelativePath?parent:read(join(source.canonicalRoot,relativePath),scope);
      if(!observation.ok||!parseFolderObservation(observation)||!sameVolumeEvidence(root,observation)||observation.evidence.scope!==scope)throw new CreationFailure("filesystem_changed");
      return {relativePath,observation};
    }) : undefined;
    const binding:FilesystemAuthorization={version:ancestors?2:1,generation:source.evidenceGeneration,root,parent,...(ancestors?{ancestors}: {})};
    verify(binding,source,parentRelativePath,parentEvidence,legacy);
    return binding;
  }
  function verify(binding:FilesystemAuthorization,source:{canonicalRoot:string;durableEvidence:string|null;evidenceGeneration:number},parentRelativePath:string,parentEvidence:string|null,legacy?:LegacyParents) {
    {
      const roots=db.select().from(schema.sources).all();
      const owner=roots.find(row=>row.canonicalRoot===source.canonicalRoot && row.durableEvidence===source.durableEvidence);
      if(!owner || rootOwnershipConflict(binding.root,roots.filter(row=>row.id!==owner.id),scope,read))throw new CreationFailure("native_conflict");
      const records=[...db.select().from(schema.categories).where(eq(schema.categories.sourceId,owner.id)).all(),
        ...db.select().from(schema.projects).where(eq(schema.projects.sourceId,owner.id)).all()];
      const parentOwner=db.select().from(schema.categories).where(eq(schema.categories.sourceId,owner.id)).all()
        .find(category=>category.relativePath===parentRelativePath && category.associationState==="active" && !category.modeInactive);
      for(const record of records) {
        const saved=storedEvidence(record.durableEvidence);
        const historical=JSON.parse(record.nativeIdentity) as NativeIdentity;
        if(record.relativePath===parentRelativePath) {
          if(parentOwner?.id===record.id)continue;
          const dormant="categoryId" in record && record.categoryId===null && record.modeInactive && ["active","excluded"].includes(record.associationState) && parentOwner;
          const roleHistory=!!owner.folderRoles && record.modeInactive && ["active","excluded"].includes(record.associationState) && !!saved && sameDurableFolder(saved,binding.parent.evidence,false);
          if(roleHistory || dormant && (saved ? sameDurableFolder(saved,binding.parent.evidence,false)
            : sameIdentity(historical,JSON.parse(parentOwner.nativeIdentity))))continue;
          throw new CreationFailure("native_conflict");
        }
        const conflicts=(observed:VerifiedFolder)=>saved ? durableOwnershipKey(saved)===durableOwnershipKey(observed.evidence)
          : record.durableEvidence!==null || historical.ino===observed.mount.ino && historical.birthtimeNs===observed.mount.birthtimeNs;
        if(conflicts(binding.root) || conflicts(binding.parent))throw new CreationFailure("native_conflict");
      }
    }
    if(binding.version===2) {
      if(!parseFilesystemAuthorization(JSON.stringify(binding)))throw new CreationFailure("ownership_uncertain");
      const owner=db.select().from(schema.sources).all().find(row=>row.canonicalRoot===source.canonicalRoot&&row.durableEvidence===source.durableEvidence);
      const roles=owner?savedFolderRoles(owner):null;
      if(!owner||!roles||!roleParentPlacement(parentRelativePath,roles,"grouped").allowed)throw new CreationFailure("category_unavailable");
      const paths=["",...(parentRelativePath?parentRelativePath.split("/").map((_,index)=>parentRelativePath.split("/").slice(0,index+1).join("/")):[])];
      if(binding.ancestors!.length!==paths.length || binding.ancestors!.some((frame,index)=>frame.relativePath!==paths[index]))throw new CreationFailure("ownership_uncertain");
      const records=[...db.select().from(schema.categories).where(eq(schema.categories.sourceId,owner.id)).all(),...db.select().from(schema.projects).where(eq(schema.projects.sourceId,owner.id)).all()];
      const peers=db.select().from(schema.sources).all().filter(peer=>peer.id!==owner.id);
      const aliases=new Set<string>();
      for(const frame of binding.ancestors!) {
        const observed=read(join(source.canonicalRoot,frame.relativePath),scope),key=durableOwnershipKey(frame.observation.evidence);
        if(aliases.has(key)||!observed.ok||identityState(JSON.stringify(frame.observation.evidence),observed,scope)!=="verified" || !sameVolumeEvidence(binding.root,observed)||!sameIdentity(frame.observation.mount,observed.mount)||rootOwnershipConflict(observed,peers,scope,read))throw new CreationFailure("filesystem_changed");
        aliases.add(key);
        for(const record of records) {
          const saved=storedEvidence(record.durableEvidence),native=JSON.parse(record.nativeIdentity) as NativeIdentity;
          const alias=saved?durableOwnershipKey(saved)===key:record.durableEvidence!==null||native.ino===observed.mount.ino&&native.birthtimeNs===observed.mount.birthtimeNs;
          if(record.relativePath!==frame.relativePath&&!alias)continue;
          const currentStatus=!("categoryId" in record)&&!record.modeInactive&&record.associationState==="active";
          const dormant=record.modeInactive&&["active","excluded"].includes(record.associationState);
          if(record.relativePath===frame.relativePath&&(currentStatus||dormant)&&saved&&identityState(record.durableEvidence,observed,scope)==="verified")continue;
          throw new CreationFailure("native_conflict");
        }
      }
    }
    if(legacy && (!exactNativeIdentity(legacy.root) || !exactNativeIdentity(legacy.parent) || !sameIdentity(binding.root.mount,legacy.root) || !sameIdentity(binding.parent.mount,legacy.parent)))throw new CreationFailure("ownership_uncertain");
    if(source.evidenceGeneration!==binding.generation)throw new CreationFailure("stale_configuration");
    for(const [path,saved,old] of [[source.canonicalRoot,binding.root,source.durableEvidence],
      [join(source.canonicalRoot,parentRelativePath),binding.parent,parentEvidence]] as const) {
      const current=read(path,scope);
      const reviewedLegacyParent=path===join(source.canonicalRoot,parentRelativePath) && old===null && !!legacy && current.ok && sameIdentity(legacy.parent,current.mount);
      if((identityState(old,current,scope)!=="verified" && !reviewedLegacyParent) || !current.ok || current.evidence.scope!==scope || !sameDurableFolder(saved.evidence,current.evidence) ||
        !sameIdentity(saved.mount,current.mount))throw new CreationFailure("filesystem_changed");
    }
  }
  function observe(path:string,root:VerifiedFolder,mount:NativeIdentity,expected?:FolderEvidence):VerifiedFolder {
    const current=read(path,scope);
    if(!exactNativeIdentity(mount) || !parseFolderObservation(current) || !current.ok || current.evidence.scope!==scope || root.evidence.scope!==scope || !sameVolumeEvidence(root,current) || !sameIdentity(current.mount,mount) ||
      expected && !sameDurableFolder(expected,current.evidence))throw new CreationFailure("filesystem_changed");
    return current;
  }
  function captureRoleParent(source:typeof schema.sources.$inferSelect,parentRelativePath:string) {
    const roles=savedFolderRoles(source);
    if(!roles || parentRelativePath!==""&&!validRolePath(parentRelativePath))throw new CreationFailure("category_unavailable");
    const placement=roleParentPlacement(parentRelativePath,roles,"grouped");
    if(!placement.allowed)throw new CreationFailure("category_unavailable");
    const root=read(source.canonicalRoot,scope),parent=read(join(source.canonicalRoot,parentRelativePath),scope);
    if(!root.ok||!parent.ok||identityState(source.durableEvidence,root,scope)!=="verified"||!sameVolumeEvidence(root,parent))throw new CreationFailure("filesystem_changed");
    const category=placement.categoryPath===null?null:db.select().from(schema.categories).where(eq(schema.categories.sourceId,source.id)).all().find(row=>row.relativePath===placement.categoryPath&&!row.modeInactive&&row.associationState==="active");
    if(placement.categoryPath!==null&&(!category||identityState(category.durableEvidence,read(join(source.canonicalRoot,category.relativePath),scope),scope)!=="verified"))throw new CreationFailure("category_unavailable");
    const evidence=JSON.stringify(parent.evidence),authorization=capture(source,parentRelativePath,evidence);
    return {categoryId:category?.id??null,parentIdentity:JSON.stringify(parent.mount),parentEvidence:evidence,authorization};
  }
  return {capture,verify,observe,captureRoleParent};
}
export type FilesystemAuthorizer=ReturnType<typeof createFilesystemAuthorization>;
