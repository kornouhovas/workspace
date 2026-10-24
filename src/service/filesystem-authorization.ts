import {eq} from "drizzle-orm";
import type {BetterSQLite3Database} from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";
import {join} from "node:path";
import {sameIdentity, reliableIdentity, type NativeIdentity} from "./discovery.js";
import {durableOwnershipKey, sameDurableFolder, validateEvidence, type FolderEvidence, type FolderObservation} from "./folder-evidence.js";
import {rootOwnershipConflict, storedEvidence, identityState, sameVolumeEvidence, type EvidenceReader} from "./source-identity.js";
import {CreationFailure} from "./project-filesystem.js";

export type VerifiedFolder = Extract<FolderObservation,{ok:true}>;
export interface FilesystemAuthorization {
  version: 1;
  generation: number;
  root: VerifiedFolder;
  parent: VerifiedFolder;
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
    return v && Object.keys(v).sort().join()==="generation,parent,root,version" && v.version===1 && Number.isSafeInteger(v.generation) && v.generation>=0
      && parseFolderObservation(v.root) && parseFolderObservation(v.parent) && sameVolumeEvidence(v.root,v.parent) && v.root.evidence.scope===v.parent.evidence.scope ? v : null;
  } catch {return null;}
}
/** Durable continuity admits an earlier mount; an execution snapshot never does. */
export function createFilesystemAuthorization(scope:string, read:EvidenceReader, db:BetterSQLite3Database<typeof schema>) {
  function capture(source:{canonicalRoot:string;durableEvidence:string|null;evidenceGeneration:number},parentRelativePath:string,parentEvidence:string|null):FilesystemAuthorization {
    const root=read(source.canonicalRoot,scope), parent=read(join(source.canonicalRoot,parentRelativePath),scope);
    if(identityState(source.durableEvidence,root,scope)!=="verified" || identityState(parentEvidence,parent,scope)!=="verified" ||
      !root.ok || !parent.ok || !sameVolumeEvidence(root,parent))throw new CreationFailure("filesystem_changed");
    const binding:FilesystemAuthorization={version:1,generation:source.evidenceGeneration,root,parent};
    verify(binding,source,parentRelativePath,parentEvidence);
    return binding;
  }
  function verify(binding:FilesystemAuthorization,source:{canonicalRoot:string;durableEvidence:string|null;evidenceGeneration:number},parentRelativePath:string,parentEvidence:string|null) {
    {
      const roots=db.select().from(schema.sources).all();
      const owner=roots.find(row=>row.canonicalRoot===source.canonicalRoot && row.durableEvidence===source.durableEvidence);
      if(!owner || rootOwnershipConflict(binding.root,roots.filter(row=>row.id!==owner.id),scope,read))throw new CreationFailure("native_conflict");
      const records=[...db.select().from(schema.categories).where(eq(schema.categories.sourceId,owner.id)).all(),
        ...db.select().from(schema.projects).where(eq(schema.projects.sourceId,owner.id)).all()];
      for(const record of records) {
        const saved=storedEvidence(record.durableEvidence);
        if(saved && (durableOwnershipKey(saved)===durableOwnershipKey(binding.root.evidence) ||
          record.relativePath!==parentRelativePath && durableOwnershipKey(saved)===durableOwnershipKey(binding.parent.evidence)))throw new CreationFailure("native_conflict");
      }
    }
    if(source.evidenceGeneration!==binding.generation)throw new CreationFailure("stale_configuration");
    for(const [path,saved,old] of [[source.canonicalRoot,binding.root,source.durableEvidence],
      [join(source.canonicalRoot,parentRelativePath),binding.parent,parentEvidence]] as const) {
      const current=read(path,scope);
      if(identityState(old,current,scope)!=="verified" || !current.ok || !sameDurableFolder(saved.evidence,current.evidence) ||
        !sameIdentity(saved.mount,current.mount))throw new CreationFailure("filesystem_changed");
    }
  }
  function observe(path:string,root:VerifiedFolder,mount:NativeIdentity,expected?:FolderEvidence):VerifiedFolder {
    const current=read(path,scope);
    if(!parseFolderObservation(current) || !current.ok || current.evidence.scope!==scope || root.evidence.scope!==scope || !sameVolumeEvidence(root,current) || !sameIdentity(current.mount,mount) ||
      expected && !sameDurableFolder(expected,current.evidence))throw new CreationFailure("filesystem_changed");
    return current;
  }
  return {capture,verify,observe};
}
export type FilesystemAuthorizer=ReturnType<typeof createFilesystemAuthorization>;
