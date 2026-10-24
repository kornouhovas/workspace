import {archiveBindingMatchesRow,parseArchiveAuthorization,parseArchiveBindingAuthorization,parseArchiveParents,archiveParentPathsMatch,uniqueArchiveProofs,type ArchiveRowDescriptor} from "./archive-authorization.js";
import {parseRemovalAuthorization,removalBindingMatchesRow,removalAttestationMatchesBinding} from "./category-removal-authorization.js";
import {categoryAuthorizationMatchesBinding,parseCategoryFolderAuthorization,type CategoryFolderBindingRow} from "./category-folder-authorization.js";
import {sameIdentity} from "./discovery.js";
import {sameAuthorizationRoot,parseFilesystemAuthorization, parseFolderObservation} from "./filesystem-authorization.js";
import { durableOwnershipKey, sameDurableFolder, validateEvidence } from "./folder-evidence.js";
import { isWorkspaceSessionState } from "../contracts/workspace-sessions.js";
import { validateSnapshotRelations } from "./data-recovery-invariants.js";
import { validExclusions, validArchive } from "./discovery.js";
import Database from "better-sqlite3";
import { encodeSnapshot, openSnapshot } from "./snapshot.js";
import { isDataRecoveryRequest, type DataRecoveryPayload } from "../contracts/data-recovery.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isBoardLayoutConfig } from "../contracts/board-layout.js";
import { isTableLayoutConfig } from "../contracts/table-layout.js";
import { isViewGroupingConfig } from "../contracts/view-grouping.js";
import { isViewFilterConfig } from "../contracts/view-filters.js";

type SchemaEntry = { type: string; name: string; sql: string };
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
function schema(db: Database.Database): SchemaEntry[] {
  return db.prepare("SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type, name").all() as SchemaEntry[];
}
/** An attestation may precede new evidence, but cannot contradict any evidence
 * that its immutable journal snapshot already says was recorded. */
function recordedEvidenceRetained(snapshot:Record<string,unknown>,current:Record<string,unknown>,fields:readonly string[]):boolean {
  return fields.every(field=>Object.hasOwn(snapshot,field) && (snapshot[field]===null ||
    snapshot[field]===current[field.replace(/[A-Z]/g,letter=>"_"+letter.toLowerCase())]));
}
function validate(db: Database.Database) {
  if (db.pragma("integrity_check", { simple: true }) !== "ok" || (db.pragma("foreign_key_check") as unknown[]).length) throw new Error("Invalid SQLite data");
  validateSnapshotRelations(db);
  // Historical pre-migration backups retain their matching schema.
  if (db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='workspace_sessions'").get()) {
    if (db.prepare("SELECT 1 FROM workspaces w WHERE NOT EXISTS (SELECT 1 FROM workspace_sessions s WHERE s.workspace_id=w.id)").get()) throw new Error("Missing workspace session");
    const rows = db.prepare("SELECT s.workspace_id, s.state, s.revision, w.source_id FROM workspace_sessions s JOIN workspaces w ON w.id=s.workspace_id").all() as { workspace_id: string; state: string; revision: number; source_id: string }[];
    for (const row of rows) {
      const state: unknown = JSON.parse(row.state);
      if (!isWorkspaceSessionState(state) || !Number.isSafeInteger(row.revision) || row.revision < 0) throw new Error("Invalid workspace session");
      const views = new Set((db.prepare("SELECT id FROM views WHERE workspace_id=?").all(row.workspace_id) as { id: string }[]).map(v => v.id));
      const projects = new Set((db.prepare("SELECT id FROM projects WHERE source_id=?").all(row.source_id) as { id: string }[]).map(p => p.id));
      if (Object.keys(state.previews).some(id => !views.has(id)) || [...state.tabs, ...Object.values(state.previews).filter((id): id is string => id !== null)].some(id => !projects.has(id))) throw new Error("Foreign session reference");
    }
  }

  const language = db.prepare("SELECT value FROM settings WHERE key = 'language'").get() as { value: string } | undefined;
  if (!language || !["en", "ru"].includes(language.value)) throw new Error("Invalid language");
  for (const view of db.prepare("SELECT kind, board_config, table_config, grouping_config, filter_config FROM views").all() as Record<string, string>[]) {
    if (!["table", "board"].includes(view.kind) || !isBoardLayoutConfig(JSON.parse(view.board_config)) ||
      !isTableLayoutConfig(JSON.parse(view.table_config)) || !isViewGroupingConfig(JSON.parse(view.grouping_config)) ||
      !isViewFilterConfig(JSON.parse(view.filter_config))) throw new Error("Invalid view");
  }
  for (const source of db.prepare("SELECT discovery_mode, excluded_relative_paths, archive_relative_path FROM sources").all() as Record<string, unknown>[]) {
    if (source.discovery_mode !== null && !["direct", "grouped"].includes(String(source.discovery_mode)) ||
      !validExclusions(JSON.parse(String(source.excluded_relative_paths)), "grouped") || !validArchive(source.archive_relative_path)) throw new Error("Invalid source configuration");
  }
  for (const table of schema(db).filter(entry => entry.type === "table")) {
    const columns = db.prepare(`PRAGMA table_info(${quote(table.name)})`).all() as { name: string }[];
    for (const column of columns.filter(c => c.name.endsWith("_identity"))) {
      for (const row of db.prepare(`SELECT ${quote(column.name)} AS value FROM ${quote(table.name)} WHERE ${quote(column.name)} IS NOT NULL`).all() as { value: string }[]) {
        const identity = JSON.parse(row.value);
        if (!identity || typeof identity.dev !== "string" || typeof identity.ino !== "string" || typeof identity.birthtimeNs !== "string") throw new Error("Invalid filesystem identity");
      }
    }
  }
  for (const table of ["sources", "categories", "projects"]) {
    const columns = db.prepare(`PRAGMA table_info(${quote(table)})`).all() as {name:string}[];
    if (!columns.some(column => column.name === "durable_evidence")) continue;
    for (const row of db.prepare(`SELECT durable_evidence FROM ${quote(table)} WHERE durable_evidence IS NOT NULL`).all() as {durable_evidence:string}[]) {
      if (!validateEvidence(JSON.parse(row.durable_evidence))) throw new Error("Unsupported durable folder evidence");
    }
  }
  if ((db.prepare("PRAGMA table_info(sources)").all() as {name:string}[]).some(c => c.name === "durable_evidence")) {
    for(const row of db.prepare("SELECT evidence_generation FROM sources").all() as {evidence_generation:unknown}[]) {
      if(typeof row.evidence_generation!=="number" || !Number.isSafeInteger(row.evidence_generation) || row.evidence_generation<0)throw new Error("Invalid source evidence generation");
    }
    const roots = new Map((db.prepare("SELECT id,durable_evidence FROM sources").all() as {id:string;durable_evidence:string|null}[])
      .map(row => [row.id,row.durable_evidence ? JSON.parse(row.durable_evidence) as import("./folder-evidence.js").FolderEvidence : null]));
    const rootOwners=new Set<string>();
    for(const evidence of roots.values())if(evidence){
      const key=durableOwnershipKey(evidence);
      if(rootOwners.has(key))throw new Error("Duplicate durable source ownership");
      rootOwners.add(key);
    }
    for (const table of ["projects","categories"]) {
      const owners = new Set<string>();
      for (const row of db.prepare(`SELECT source_id,durable_evidence,association_state FROM ${quote(table)} WHERE durable_evidence IS NOT NULL`).all() as {source_id:string;durable_evidence:string;association_state:string}[]) {
        const evidence = JSON.parse(row.durable_evidence) as import("./folder-evidence.js").FolderEvidence;
        const root = roots.get(row.source_id);
        if (!root || evidence.provider !== root.provider || evidence.volume !== root.volume || evidence.serial !== root.serial) throw new Error("Conflicting durable volume ownership");
        const key = JSON.stringify([row.source_id,durableOwnershipKey(evidence)]);
        if (row.association_state !== "replaced") {if (owners.has(key)) throw new Error("Duplicate durable folder ownership"); owners.add(key);}
      }
    }
  }
  if ((db.prepare("PRAGMA table_info(project_creation_operations)").all() as {name:string}[]).some(c=>c.name==="authorization")) {
    const immutableFields = ["operationId","sourceId","initiatingWorkspaceId","projectId","name","mode","expectedRevision","categoryId",
      "canonicalRoot","parentRelativePath","relativePath","rootIdentity","parentIdentity","excludedRelativePaths","archiveRelativePath","authorization"];
    for(const row of db.prepare("SELECT operation_id,journal,authorization,destination_evidence FROM project_creation_attestations").all() as {operation_id:string;journal:string;authorization:string;destination_evidence:string|null}[]) {
      const journal=JSON.parse(row.journal), binding=parseFilesystemAuthorization(row.authorization);
      const current=db.prepare("SELECT * FROM project_creation_operations WHERE operation_id=?").get(row.operation_id) as Record<string,unknown> | undefined;
      const destination=row.destination_evidence ? parseFolderObservation(JSON.parse(row.destination_evidence)) : null;
      if(!binding || !current || !journal || journal.operationId!==row.operation_id ||
        !["intent","evidence_recorded","uncertain"].includes(journal.stage) ||
        immutableFields.some(field=>!Object.hasOwn(journal,field) || journal[field]!==current[field.replace(/[A-Z]/g,letter=>"_"+letter.toLowerCase())]) ||
        !recordedEvidenceRetained(journal,current,["nativeIdentity","destinationEvidence"]) ||
        row.destination_evidence!==null && (!destination || destination.evidence.scope!==binding.root.evidence.scope ||
          destination.evidence.provider!==binding.root.evidence.provider || destination.evidence.volume!==binding.root.evidence.volume || destination.evidence.serial!==binding.root.evidence.serial))throw new Error("Invalid creation attestation");
      const recordedDestination=current.destination_evidence ? parseFolderObservation(JSON.parse(current.destination_evidence as string)) : null;
      if(current.authorization!==null && destination && recordedDestination && !sameDurableFolder(destination.evidence,recordedDestination.evidence))throw new Error("Conflicting attestation destination");
      const original=parseFilesystemAuthorization(journal.authorization);
      if(journal.authorization!==null && (!original || !sameDurableFolder(original.root.evidence,binding.root.evidence) || !sameDurableFolder(original.parent.evidence,binding.parent.evidence)) ||
        journal.authorization===null && (!sameIdentity(JSON.parse(journal.rootIdentity),binding.root.mount) || !sameIdentity(JSON.parse(journal.parentIdentity),binding.parent.mount) ||
          journal.nativeIdentity!==null && destination && !sameIdentity(JSON.parse(journal.nativeIdentity),destination.mount)))throw new Error("Conflicting creation attestation");
    }
    const rows=db.prepare("SELECT authorization,destination_evidence,native_identity FROM project_creation_operations").all() as {authorization:string|null;destination_evidence:string|null;native_identity:string|null}[];
    for(const row of rows) {
      const binding=parseFilesystemAuthorization(row.authorization);
      const destination=row.destination_evidence ? parseFolderObservation(JSON.parse(row.destination_evidence)) : null;
      if(row.authorization!==null && (!binding || row.native_identity!==null && row.destination_evidence===null) || row.destination_evidence!==null && (!binding || !destination || !row.native_identity ||
        destination.evidence.provider!==binding.root.evidence.provider || destination.evidence.volume!==binding.root.evidence.volume ||
        destination.evidence.serial!==binding.root.evidence.serial || destination.evidence.scope!==binding.root.evidence.scope || !sameIdentity(destination.mount,JSON.parse(row.native_identity))))throw new Error("Invalid creation filesystem authorization");
    }
  }
  if ((db.prepare("PRAGMA table_info(project_rename_operations)").all() as {name:string}[]).some(c=>c.name==="authorization")) {
    const rows=db.prepare("SELECT * FROM project_rename_operations").all() as Record<string,unknown>[];
    const volumeMatch=(binding:NonNullable<ReturnType<typeof parseFilesystemAuthorization>>,target:NonNullable<ReturnType<typeof parseFolderObservation>>)=>
      target.evidence.provider===binding.root.evidence.provider && target.evidence.volume===binding.root.evidence.volume &&
      target.evidence.serial===binding.root.evidence.serial && target.evidence.scope===binding.root.evidence.scope;
    for(const row of rows) {
      const binding=parseFilesystemAuthorization(row.authorization as string|null);
      const target=row.project_evidence ? parseFolderObservation(JSON.parse(row.project_evidence as string)) : null;
      if(row.authorization!==null && (!binding || !target || !volumeMatch(binding,target)) || row.authorization===null && row.project_evidence!==null)throw new Error("Invalid rename authorization");
    }
    const immutableFields=["operationId","sourceId","initiatingWorkspaceId","projectId","originalName","name","mode","expectedRevision","categoryId",
      "canonicalRoot","parentRelativePath","originalRelativePath","requestedRelativePath","stagingRelativePath","rootIdentity","parentIdentity",
      "nativeIdentity","excludedRelativePaths","archiveRelativePath","authorization","projectEvidence"];
    for(const proof of db.prepare("SELECT * FROM project_rename_attestations").all() as Record<string,string>[]) {
      const row=rows.find(row=>row.operation_id===proof.operation_id), journal=JSON.parse(proof.journal);
      const binding=parseFilesystemAuthorization(proof.authorization), target=parseFolderObservation(JSON.parse(proof.project_evidence));
      if(!row || !journal || !binding || !target || !volumeMatch(binding,target) ||
        !["intent","staged","destination_recorded","uncertain"].includes(journal.stage) || !recordedEvidenceRetained(journal,row,["stagedIdentity","destinationIdentity","lastVerifiedIdentity"]) || immutableFields.some(field=>!Object.hasOwn(journal,field) ||
          journal[field]!==row[field.replace(/[A-Z]/g,letter=>"_"+letter.toLowerCase())]))throw new Error("Invalid rename attestation");
      const original=parseFilesystemAuthorization(journal.authorization), saved=journal.projectEvidence ? parseFolderObservation(JSON.parse(journal.projectEvidence)) : null;
      if(journal.authorization!==null && (!original || !saved || !sameDurableFolder(original.root.evidence,binding.root.evidence) ||
        !sameDurableFolder(original.parent.evidence,binding.parent.evidence) || !sameDurableFolder(saved.evidence,target.evidence)) ||
        journal.authorization===null && (!sameIdentity(JSON.parse(journal.rootIdentity),binding.root.mount) ||
          !sameIdentity(JSON.parse(journal.parentIdentity),binding.parent.mount) || !sameIdentity(JSON.parse(journal.nativeIdentity),target.mount)))throw new Error("Conflicting rename attestation");
    }
  }
  if ((db.prepare("PRAGMA table_info(project_category_move_operations)").all() as {name:string}[]).some(c=>c.name==="original_authorization")) {
    const rows=db.prepare("SELECT * FROM project_category_move_operations").all() as Record<string,unknown>[];
    function parseMoveProof(from:string|null,to:string|null,project:string|null) {
      const original=parseFilesystemAuthorization(from), destination=parseFilesystemAuthorization(to), target=project ? parseFolderObservation(JSON.parse(project)) : null;
      if(!original || !destination || !target || !sameAuthorizationRoot(original,destination) ||
        target.evidence.provider!==original.root.evidence.provider || target.evidence.volume!==original.root.evidence.volume ||
        target.evidence.serial!==original.root.evidence.serial || target.evidence.scope!==original.root.evidence.scope)throw new Error("Invalid category move authorization");
      return {original,destination,target};
    }
    for(const row of rows)if(row.original_authorization!==null || row.destination_authorization!==null || row.project_evidence!==null)
      parseMoveProof(row.original_authorization as string|null,row.destination_authorization as string|null,row.project_evidence as string|null);
    const fields=["operationId","sourceId","initiatingWorkspaceId","projectId","name","expectedRevision","originalCategoryId","destinationCategoryId",
      "canonicalRoot","originalParentRelativePath","destinationParentRelativePath","originalRelativePath","requestedRelativePath","rootIdentity",
      "originalParentIdentity","destinationParentIdentity","nativeIdentity","excludedRelativePaths","archiveRelativePath","originalAuthorization","destinationAuthorization","projectEvidence"];
    for(const proof of db.prepare("SELECT * FROM project_category_move_attestations").all() as Record<string,string>[]) {
      const row=rows.find(row=>row.operation_id===proof.operation_id), journal=JSON.parse(proof.journal);
      const current=parseMoveProof(proof.original_authorization,proof.destination_authorization,proof.project_evidence);
      if(!row || !journal || !["intent","destination_recorded","uncertain"].includes(journal.stage) || !recordedEvidenceRetained(journal,row,["destinationIdentity","lastVerifiedIdentity"]) || fields.some(field=>!Object.hasOwn(journal,field) ||
        journal[field]!==row[field.replace(/[A-Z]/g,letter=>"_"+letter.toLowerCase())]))throw new Error("Invalid category move attestation");
      if(journal.originalAuthorization===null && journal.destinationAuthorization===null && journal.projectEvidence===null) {
        if(!sameIdentity(JSON.parse(journal.rootIdentity),current.original.root.mount) || !sameIdentity(JSON.parse(journal.originalParentIdentity),current.original.parent.mount) ||
          !sameIdentity(JSON.parse(journal.destinationParentIdentity),current.destination.parent.mount) || !sameIdentity(JSON.parse(journal.nativeIdentity),current.target.mount))throw new Error("Conflicting legacy category move attestation");
      }else {
        const old=parseMoveProof(journal.originalAuthorization,journal.destinationAuthorization,journal.projectEvidence);
        if(!sameDurableFolder(old.original.root.evidence,current.original.root.evidence) || !sameDurableFolder(old.original.parent.evidence,current.original.parent.evidence) ||
          !sameDurableFolder(old.destination.parent.evidence,current.destination.parent.evidence) || !sameDurableFolder(old.target.evidence,current.target.evidence))throw new Error("Conflicting category move attestation");
      }
    }
  }
  if ((db.prepare("PRAGMA table_info(category_folder_operations)").all() as {name:string}[]).some(c=>c.name==="authorization")) {
    const rows=db.prepare("SELECT * FROM category_folder_operations").all() as Record<string,unknown>[];
    const generations=new Map((db.prepare("SELECT id,evidence_generation FROM sources").all() as {id:string;evidence_generation:number}[]).map(source=>[source.id,source.evidence_generation]));
    const validGeneration=(authority:NonNullable<ReturnType<typeof parseCategoryFolderAuthorization>>,sourceId:string)=>authority.binding.generation<=generations.get(sourceId)!;
    const descriptor=(row:Record<string,unknown>):CategoryFolderBindingRow=>({sourceId:row.source_id as string,categoryId:row.category_id as string,
      action:row.action as string,binding:row.binding as string,nativeIdentity:row.native_identity as string|null,originalRelativePath:row.original_relative_path as string|null,requestedRelativePath:row.requested_relative_path as string});
    const target=(value:unknown)=>typeof value==="string"?parseFolderObservation(JSON.parse(value)):null;
    const volume=(authority:NonNullable<ReturnType<typeof parseCategoryFolderAuthorization>>,destination:NonNullable<ReturnType<typeof target>>)=>
      ["provider","volume","serial","scope"].every(key=>authority.binding.root.evidence[key as keyof typeof destination.evidence]===destination.evidence[key as keyof typeof destination.evidence]);
    for(const row of rows) {
      const authority=parseCategoryFolderAuthorization(row.authorization as string|null),destination=target(row.destination_evidence);
      if(row.authorization===null) {if(row.destination_evidence!==null)throw new Error("Legacy category evidence was rewritten");continue;}
      if(!authority || !validGeneration(authority,row.source_id as string) || !categoryAuthorizationMatchesBinding(authority,descriptor(row)) ||
        ["destination_recorded","completed"].includes(row.stage as string) && !destination ||
        row.destination_evidence!==null && (!destination || !volume(authority,destination) || authority.category && !sameDurableFolder(authority.category.evidence,destination.evidence)) ||
        row.action==="create" && row.native_identity!==null && (!destination || !sameIdentity(JSON.parse(row.native_identity as string),destination.mount)))throw new Error("Invalid category folder authorization");
    }
    const fields=["operationId","sourceId","workspaceId","previewToken","categoryId","action","originalRelativePath","requestedRelativePath","binding","authorization"];
    for(const proof of db.prepare("SELECT * FROM category_folder_attestations").all() as Record<string,string|null>[]) {
      const row=rows.find(row=>row.operation_id===proof.operation_id),journal=JSON.parse(proof.journal!),authority=parseCategoryFolderAuthorization(proof.authorization),destination=target(proof.destination_evidence);
      if(!row || !journal || !authority || !validGeneration(authority,row.source_id as string) || !["intent","destination_recorded"].includes(journal.stage) ||
        fields.some(field=>!Object.hasOwn(journal,field) || journal[field]!==row[field.replace(/[A-Z]/g,letter=>"_"+letter.toLowerCase())]) ||
        !recordedEvidenceRetained(journal,row,["nativeIdentity","destinationEvidence"]) ||
        !categoryAuthorizationMatchesBinding(authority,descriptor(row),row.authorization===null?"legacy_review":"renewed_review") ||
        proof.destination_evidence!==null && (!destination || !volume(authority,destination)))throw new Error("Invalid category folder attestation");
      const original=parseCategoryFolderAuthorization(row.authorization as string|null),recorded=target(row.destination_evidence);
      if(original && (authority.binding.generation<original.binding.generation || !sameDurableFolder(original.binding.root.evidence,authority.binding.root.evidence) ||
        (original.category===null ? authority.category!==null : !authority.category || !sameDurableFolder(original.category.evidence,authority.category.evidence)) ||
        original.projects.some(project=>!authority.projects.some(current=>current.id===project.id && sameDurableFolder(project.observation.evidence,current.observation.evidence)))) ||
        recorded && destination && !sameDurableFolder(recorded.evidence,destination.evidence) ||
        row.authorization===null && row.action==="create" && (row.native_identity===null ? destination!==null : !destination || !sameIdentity(JSON.parse(row.native_identity as string),destination.mount)))throw new Error("Conflicting category folder attestation");
    }
  }
  if(db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='category_removal_operations'").get()) {
    for(const row of db.prepare("SELECT * FROM category_removal_operations").all() as Record<string,unknown>[]) {
      const binding=JSON.parse(row.binding as string);
      if(!removalBindingMatchesRow(binding,{sourceId:row.source_id as string,categoryId:row.category_id as string,destinationCategoryId:row.destination_category_id as string|null,
        originalRelativePath:row.original_relative_path as string,requestedRelativePath:row.requested_relative_path as string|null,nativeIdentity:row.native_identity as string}))throw new Error("Contradictory removal binding");
      if(!Object.hasOwn(binding,"authorization")) {
        for(const record of [binding.source,binding.category,...(binding.destination?[binding.destination]:[]),...binding.members]) {
          if(record.durableEvidence!==undefined && record.durableEvidence!==null && (typeof record.durableEvidence!=="string" || !validateEvidence(JSON.parse(record.durableEvidence))))throw new Error("Malformed historical removal evidence");
        }
        continue;
      }
      const auth=parseRemovalAuthorization(JSON.stringify(binding.authorization),binding);
      const source=db.prepare("SELECT evidence_generation FROM sources WHERE id=?").get(row.source_id) as {evidence_generation:number}|undefined;
      if(!auth || !source || auth.root.generation>source.evidence_generation || !removalBindingMatchesRow(binding,{
        sourceId:row.source_id as string,categoryId:row.category_id as string,destinationCategoryId:row.destination_category_id as string|null,
        originalRelativePath:row.original_relative_path as string,requestedRelativePath:row.requested_relative_path as string|null,nativeIdentity:row.native_identity as string,
      }))throw new Error("Invalid category removal authorization");
    }
  }
  if(db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='category_removal_attestations'").get()) {
    const fields=["operationId","sourceId","workspaceId","categoryId","destinationCategoryId","originalRelativePath","requestedRelativePath","nativeIdentity","previewToken","binding"];
    for(const proof of db.prepare("SELECT * FROM category_removal_attestations").all() as Record<string,string>[]) {
      const row=db.prepare("SELECT * FROM category_removal_operations WHERE operation_id=?").get(proof.operation_id) as Record<string,unknown>|undefined;
      const journal=JSON.parse(proof.journal),binding=JSON.parse(proof.binding),auth=parseRemovalAuthorization(JSON.stringify(binding.authorization),binding);
      const source=row?db.prepare("SELECT evidence_generation FROM sources WHERE id=?").get(row.source_id) as {evidence_generation:number}|undefined:undefined;
      if(!row || !source || !journal || !["moving","cleanup_intent"].includes(journal.stage) ||
        fields.some(field=>!Object.hasOwn(journal,field)||journal[field]!==row[field.replace(/[A-Z]/g,letter=>"_"+letter.toLowerCase())]) ||
        !auth || auth.root.generation>source.evidence_generation || !removalAttestationMatchesBinding(binding,JSON.parse(row.binding as string)))throw new Error("Invalid category removal attestation");
    }
  }
  if((db.prepare("PRAGMA table_info(project_archives)").all() as {name:string}[]).some(column=>column.name==="authorization")) {
    const descriptor=(row:Record<string,unknown>):ArchiveRowDescriptor=>({sourceId:row.source_id as string,projectId:row.project_id as string,action:row.action as string,
      originalRelativePath:row.original_relative_path as string,requestedRelativePath:row.requested_relative_path as string,nativeIdentity:row.native_identity as string});
    for(const row of db.prepare("SELECT * FROM project_archive_operations").all() as Record<string,unknown>[]) {
      const binding=JSON.parse(row.binding as string),parents=parseArchiveParents(JSON.parse(row.parents as string),Object.hasOwn(binding,"authorization"));
      if(!parents || !archiveBindingMatchesRow(binding,descriptor(row)) || !archiveParentPathsMatch(parents,row.requested_relative_path as string) ||
        parents.some((parent,index)=>binding.destinationParents[index].identity!==null &&
          (!sameIdentity(parent.identity!,binding.destinationParents[index].identity) || binding.destinationParents[index].observation && JSON.stringify(parent.observation)!==JSON.stringify(binding.destinationParents[index].observation))) ||
        ["destination_recorded","completed"].includes(row.stage as string)&&parents.some(parent=>parent.identity===null))throw new Error("Invalid archive operation binding");
      if(!Object.hasOwn(binding,"authorization") && parents.some(parent=>parent.observation!=null))throw new Error("Partial legacy archive authorization");
      if(Object.hasOwn(binding,"authorization")) {
        const auth=parseArchiveBindingAuthorization(binding,descriptor(row)),source=db.prepare("SELECT evidence_generation FROM sources WHERE id=?").get(row.source_id) as {evidence_generation:number}|undefined;
        if(!auth || !source || auth.root.generation>source.evidence_generation || !uniqueArchiveProofs(auth,[binding.sourceParents,parents]))throw new Error("Invalid archive operation authorization");
      }
    }
    for(const row of db.prepare("SELECT * FROM project_archives").all() as Record<string,unknown>[]) {
      const auth=parseArchiveAuthorization(row.authorization as string|null),parents=parseArchiveParents(JSON.parse(row.parents as string),row.authorization!==null);
      if(!parents || parents.some(parent=>parent.identity===null) || !archiveParentPathsMatch(parents,row.relative_path as string))throw new Error("Invalid archive placement");
      if(row.authorization===null) {if(parents.some(parent=>parent.observation!=null))throw new Error("Partial archive authority");continue;}
      const source=db.prepare("SELECT durable_evidence,evidence_generation FROM sources WHERE id=?").get(row.source_id) as {durable_evidence:string|null;evidence_generation:number}|undefined;
      const project=db.prepare("SELECT durable_evidence,category_id FROM projects WHERE id=?").get(row.project_id) as {durable_evidence:string|null;category_id:string|null}|undefined;
      const category=project?.category_id?db.prepare("SELECT durable_evidence FROM categories WHERE id=?").get(project.category_id) as {durable_evidence:string|null}|undefined:undefined;
      if(!auth || !source?.durable_evidence || !project?.durable_evidence || auth.root.generation>source.evidence_generation ||
        !sameDurableFolder(auth.root.root.evidence,JSON.parse(source.durable_evidence),false) || !sameDurableFolder(auth.project.evidence,JSON.parse(project.durable_evidence),false) ||
        !sameIdentity(auth.originalParent.mount,JSON.parse(row.parent_identity as string)) || !uniqueArchiveProofs(auth,[parents]))throw new Error("Invalid archived folder authorization");
      if(row.mode==="direct" ? !sameDurableFolder(auth.originalParent.evidence,auth.root.root.evidence) :
        !category?.durable_evidence || !sameDurableFolder(auth.originalParent.evidence,JSON.parse(category.durable_evidence),false) ||
        durableOwnershipKey(auth.originalParent.evidence)===durableOwnershipKey(auth.root.root.evidence) || parents.some(parent=>parent.observation&&durableOwnershipKey(parent.observation.evidence)===durableOwnershipKey(auth.originalParent.evidence)))throw new Error("Invalid original archive parent");
    }
  }
  // These ownership constraints predate their SQL equivalents.
  if (db.prepare(`SELECT 1 FROM workspaces w WHERE NOT EXISTS (SELECT 1 FROM views v WHERE v.workspace_id=w.id)
    UNION ALL SELECT 1 FROM workspace_view_selection s JOIN views v ON v.id=s.view_id WHERE s.workspace_id!=v.workspace_id
    UNION ALL SELECT 1 FROM active_workspace a JOIN views v ON v.id=a.view_id WHERE a.workspace_id!=v.workspace_id LIMIT 1`).get()) throw new Error("Invalid view ownership");
}

/** Backup verification follows the matching restore schema, including known data
 * invariants. Historical schemas retain their exact ledger/schema and settings;
 * full current invariants apply once the Board-layout migration is present. */
export function verifyBackupSnapshot(source: Database.Database, candidate: Database.Database): void {
  if (JSON.stringify(schema(candidate)) !== JSON.stringify(schema(source)) ||
    JSON.stringify(candidate.prepare("SELECT * FROM __drizzle_migrations ORDER BY id").all()) !==
    JSON.stringify(source.prepare("SELECT * FROM __drizzle_migrations ORDER BY id").all())) throw new Error("Snapshot schema or ledger changed");
  const language = candidate.prepare("SELECT value FROM settings WHERE key='language'").get() as { value: string } | undefined;
  if (!language || !["en", "ru"].includes(language.value)) throw new Error("Invalid language");
  const columns = candidate.prepare("PRAGMA table_info(views)").all() as { name: string }[];
  if (columns.some(column => column.name === "board_config")) validate(candidate);
}

/** No SQL from an export is executed. Rebuild only the current trusted schema. */
export function dataRecovery(sqlite: Database.Database, input: unknown): ServiceResult<DataRecoveryPayload> {
  if (!isDataRecoveryRequest(input) || (input.type !== "data.export" && input.type !== "data.restore")) return { ok: false, error: { code: "invalid_input", message: "Invalid application-data request." } };
  if (input.type === "data.export") {
    try {
      const content = encodeSnapshot(sqlite);
      return { ok: true, value: { content } };
    } catch { return { ok: false, error: { code: "storage", message: "Application data could not be exported." } }; }
  }
  let candidate: Database.Database | undefined;
  let currentSchema: SchemaEntry[];
  try {
    candidate = openSnapshot(input.content);
    currentSchema = schema(sqlite);
    if (JSON.stringify(schema(candidate)) !== JSON.stringify(currentSchema) ||
      JSON.stringify(candidate.prepare("SELECT * FROM __drizzle_migrations ORDER BY id").all()) !==
      JSON.stringify(sqlite.prepare("SELECT * FROM __drizzle_migrations ORDER BY id").all())) throw new Error("Unsupported schema");
    validate(candidate);
  } catch {
    candidate?.close();
    return { ok: false, error: { code: "invalid_input", message: "The export is invalid or uses an unsupported format or schema." } };
  }
  try {
    const source = candidate;
    // DDL and data are journaled together. Immutable-history triggers must not
    // interpret importing a completed receipt as a new filesystem operation.
    sqlite.pragma("foreign_keys = OFF");
    sqlite.transaction(() => {
      for (const entry of currentSchema.filter(e => e.type === "trigger")) sqlite.exec(`DROP TRIGGER ${quote(entry.name)}`);
      const tables = currentSchema.filter(e => e.type === "table");
      for (const table of tables) sqlite.exec(`DELETE FROM ${quote(table.name)}`);
      for (const table of tables) {
        const columns = (sqlite.prepare(`PRAGMA table_info(${quote(table.name)})`).all() as { name: string }[]).map(c => quote(c.name));
        const select = source.prepare(`SELECT ${columns.join()} FROM ${quote(table.name)}`).raw();
        const insert = sqlite.prepare(`INSERT INTO ${quote(table.name)} (${columns.join()}) VALUES (${columns.map(() => "?").join()})`);
        for (const row of select.iterate()) insert.run(...row as unknown[]);
      }
      for (const entry of currentSchema.filter(e => e.type === "trigger")) sqlite.exec(entry.sql);
      validate(sqlite);
    }).immediate();
    return { ok: true, value: { restored: true } };
  } catch { return { ok: false, error: { code: "storage", message: "Restore failed. Current application data was preserved." } }; }
  finally { sqlite.pragma("foreign_keys = ON"); candidate.close(); }
}
