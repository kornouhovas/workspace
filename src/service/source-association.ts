import {filesystemAlias} from "./path-alias.js";
import {parseFolderObservation} from "./filesystem-authorization.js";
import {observeArchivedFolder,parseArchivedFolderAssociation,type ArchivedFolderAssociation} from "./archive-association.js";
import { randomUUID } from "node:crypto";
import { join,sep } from "node:path";
import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";
import { scanDirectSource, scanGroupedSource, projectExclusions, reliableIdentity, sameIdentity, type DiscoveryScan } from "./discovery.js";
import { readProjectReservations } from "./project-rename-reservations.js";
import { reservationOwnsFolder, identityState, sourceIdentity, storedEvidence, type EvidenceReader } from "./source-identity.js";
import { durableOwnershipKey, sameDurableFolder, type FolderObservation } from "./folder-evidence.js";
import type { FolderMapping, SourceAssociationPreview, SourceAssociationResult } from "../contracts/source-association.js";
import type { ServiceResult } from "../contracts/settings.js";

type Database = BetterSQLite3Database<typeof schema>;
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9-]{36}$/i.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
class StaleBinding extends Error {}
export function createSourceAssociationService(db: Database, scope: string, reader: EvidenceReader,
  committed: (sourceId: string, revision: number) => void) {
  const reviews = new Map<string, {workspaceId: string; preview: SourceAssociationPreview; fingerprint: string; scan: DiscoveryScan;
    evidence: {mapping: FolderMapping | null; observation: FolderObservation}[];archiveFrames:string;archiveInventory:DiscoveryScan|null}>();
  function read(workspaceId: string) {
    const workspace = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get();
    if (!workspace) throw new StaleBinding();
    const source = db.select().from(schema.sources).where(eq(schema.sources.id, workspace.sourceId)).get();
    if (!source) throw new StaleBinding();
    const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).orderBy(asc(schema.categories.id)).all();
    const projects = db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).orderBy(asc(schema.projects.id)).all();
    const archives = db.select().from(schema.projectArchives).where(eq(schema.projectArchives.sourceId, source.id)).all();
    const reservations = readProjectReservations(db, source.id);
    const siblings = db.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId, source.id)).orderBy(asc(schema.workspaces.id)).all();
    const peerSources=db.select().from(schema.sources).orderBy(asc(schema.sources.id)).all().filter(peer=>peer.id!==source.id)
      .map(({id,canonicalRoot,durableEvidence,appliedRootIdentity})=>({id,canonicalRoot,durableEvidence,appliedRootIdentity}));
    const archiveBindings=db.select().from(schema.archivedFolderAssociations).where(eq(schema.archivedFolderAssociations.sourceId,source.id)).orderBy(asc(schema.archivedFolderAssociations.id)).all();
    return {workspace,source,categories,projects,archives,reservations,siblings,peerSources,archiveBindings};
  }
  function inspect(workspaceId: string, mappings: FolderMapping[], afterEnrollment = false) {
    const data = read(workspaceId), {source} = data;
    const mode = source.discoveryMode ?? "direct";
    if (mode !== "direct" && mode !== "grouped") throw new StaleBinding();
    const scan = (mode === "grouped" ? scanGroupedSource : scanDirectSource)(source.canonicalRoot, source.archiveRelativePath,
      projectExclusions(JSON.parse(source.excludedRelativePaths), mode).effective);
    const root = sourceIdentity(source, scan, scope, reader,data.peerSources);
    if(data.reservations.some(reservation=>reservationOwnsFolder(reservation,root.observation)))root.state="unsafe";
    const evidence: {mapping: FolderMapping | null; observation: FolderObservation}[] = [{mapping: null, observation: root.observation}];
    const rootEligible = scan.snapshot && root.observation.ok && ["verified", "review_required", "scope_unverified"].includes(root.state);
    const observations = new Map<string, FolderObservation>();
    for (const entry of scan.entries.filter(e => e.reason === null)) observations.set(entry.relativePath, reader(join(source.canonicalRoot, entry.relativePath), scope));
    const archiveFrames=new Map<string,ArchivedFolderAssociation>();
    if(root.observation.ok && scan.snapshot && sameIdentity(root.observation.mount,scan.snapshot.root.identity))for(const archive of data.archives) {
      try {
        const previous=data.archiveBindings.filter(row=>row.projectId===archive.projectId).map(row=>{
          const proof=parseArchivedFolderAssociation(row.authorization);
          if(!proof || proof.sourceId!==row.sourceId || proof.projectId!==row.projectId || proof.root.generation!==row.generation || row.generation>source.evidenceGeneration)throw new StaleBinding();
          return proof;
        });
        const frame=observeArchivedFolder(source,archive,{version:1,generation:source.evidenceGeneration+(afterEnrollment?0:1),root:root.observation,parent:root.observation},reader,previous);
        archiveFrames.set(archive.projectId,frame);
        for(const parent of frame.parents)if(parent.observation)observations.set(parent.path,parent.observation);
        observations.set(archive.relativePath,frame.project);
      }catch{ /* An unavailable archive retains metadata and grants no mapping. */ }
    }
    let archiveInventory:DiscoveryScan|null=null;
    if(archiveFrames.size && source.archiveRelativePath) {
      const base=join(source.canonicalRoot,source.archiveRelativePath),first=[...archiveFrames.values()][0];
      const expected=first.parents.find(parent=>parent.path===source.archiveRelativePath)?.observation;
      const grouped=data.archives.some(archive=>archive.mode==="grouped");
      const directFolders=data.archives.filter(archive=>archive.mode==="direct").map(archive=>archive.relativePath.slice(source.archiveRelativePath!.length+1));
      archiveInventory=grouped?scanGroupedSource(base,null,directFolders):scanDirectSource(base,null,[]);
      const current=reader(base,scope);
      if(!expected || !archiveInventory.snapshot || !sameIdentity(archiveInventory.snapshot.root.identity,expected.mount) || !parseFolderObservation(current) || !current.ok ||
        !sameDurableFolder(current.evidence,expected.evidence) || !sameIdentity(current.mount,expected.mount))archiveFrames.clear();
      else for(const entry of archiveInventory.entries.filter(entry=>entry.reason===null))observations.set(`${source.archiveRelativePath}/${entry.relativePath}`,reader(join(base,entry.relativePath),scope));
    }
    // Each physical identity has exactly one observable candidate. Root and descendants cannot alias.
    const key = (o: FolderObservation) => o.ok ? durableOwnershipKey(o.evidence) : null;
    const counts = new Map<string, number>();
    for (const observation of [root.observation, ...observations.values()]) {
      const id = key(observation); if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const rows = [...data.categories.map(row => ({kind:"category" as const, row})), ...data.projects.map(row => ({kind:"project" as const, row}))];
    const sameOwnership = (row: typeof data.categories[number] | typeof data.projects[number], observed: FolderObservation) => {
      if (!observed.ok) return false;
      try {
        if (row.durableEvidence) {
          const evidence = JSON.parse(row.durableEvidence);
          return key({ok:true,evidence,mount:observed.mount}) === key(observed);
        }
        // Incomplete legacy history cannot grant authority, but observable
        // competing folder evidence still prevents stealing another record.
        const legacy = JSON.parse(row.nativeIdentity);
        return reliableIdentity(legacy) && legacy.ino === observed.mount.ino && legacy.birthtimeNs === observed.mount.birthtimeNs;
      } catch {return true;}
    };
    const archivedParent = (id:string) => data.categories.find(category=>category.id===id && category.modeInactive &&
      data.archives.some(archive=>archive.mode==="grouped" && archiveFrames.has(archive.projectId) && archive.originalRelativePath.split('/').slice(0,-1).join('/')===category.relativePath &&
        data.projects.some(project=>project.id===archive.projectId && project.categoryId===category.id && project.relativePath===archive.originalRelativePath && project.modeInactive)));
    const retainedArchiveRole = (other:typeof rows[number],kind:"category"|"project",owner:typeof rows[number]["row"],observed:FolderObservation) => {
      const category=kind==="category"?archivedParent(owner.id):other.kind==="category"?archivedParent(other.row.id):undefined;
      const project=kind==="project"?owner:other.kind==="project"?other.row:undefined;
      if(!category || !project || !("categoryId" in project) || project.categoryId!==null || project.modeInactive || project.associationState!=="active" ||
        mode!=="direct" || category.relativePath!==project.relativePath || !observed.ok)return false;
      const savedCategory=storedEvidence(category.durableEvidence),savedProject=storedEvidence(project.durableEvidence);
      if(savedCategory && savedProject)return sameDurableFolder(savedCategory,observed.evidence,false) && sameDurableFolder(savedProject,observed.evidence,false) &&
        (afterEnrollment || savedCategory.scope===savedProject.scope || savedCategory.scope===scope);
      // After selected-only enrollment the other role may still be legacy.
      // Every remaining native-only role must match the current exact tuple.
      try{return [category,project].every(row=>row.durableEvidence===null ? sameIdentity(JSON.parse(row.nativeIdentity),observed.mount) :
        !!storedEvidence(row.durableEvidence) && sameDurableFolder(storedEvidence(row.durableEvidence)!,observed.evidence,false));}catch{return false;}
    };
    const dormantRoleHistory = (other: typeof rows[number], kind: "category" | "project", owner: typeof data.categories[number] | typeof data.projects[number], observed: FolderObservation) => {
      if(data.archives.some(a=>a.projectId===owner.id||a.projectId===other.row.id))return false;
      if (kind !== "category" || owner.modeInactive || owner.associationState !== "active" || other.kind !== "project" ||
        !other.row.modeInactive || !("categoryId" in other.row) || other.row.categoryId !== null ||
        other.row.relativePath !== owner.relativePath || !["active","excluded"].includes(other.row.associationState)) return false;
      if (other.row.durableEvidence !== null) {
        const saved = storedEvidence(other.row.durableEvidence);
        const historicalOwner = storedEvidence(owner.durableEvidence);
        return !!saved && observed.ok && sameDurableFolder(saved, observed.evidence, false) &&
          // Pre-write verification binds the old scopes. After enrollment the
          // owner scope is new; exact expected-row comparison below preserves
          // the untouched dormant history while checking the committed state.
          (afterEnrollment || owner.durableEvidence === null || !!historicalOwner && sameDurableFolder(saved, historicalOwner));
      }
      try {
        const old = JSON.parse(other.row.nativeIdentity), current = JSON.parse(owner.nativeIdentity);
        return reliableIdentity(old) && reliableIdentity(current) && sameIdentity(old,current);
      } catch {return false;}
    };
    const verifiedParents = new Set<string>();
    const candidates = rows.map(({kind, row}) => {
      const mapping = mappings.find(m => m.kind === kind && m.id === row.id);
      const archive=kind==="project"?data.archives.find(a=>a.projectId===row.id):undefined;
      const archivedFrame=archive?archiveFrames.get(row.id):undefined;
      const archiveParent=kind==="category"?archivedParent(row.id):undefined;
      const path = mapping?.relativePath ?? archive?.relativePath ?? row.relativePath;
      const observed = observations.get(path);
      const entry = archive ? archivedFrame && path===archive.relativePath && archive.originalRelativePath===row.relativePath : scan.entries.find(e => e.relativePath === path && (e.kind === kind || !!archiveParent && path===row.relativePath && e.kind==="project") && e.reason === null);
      const oldState = observed ? identityState(row.durableEvidence, observed, scope) : "evidence_unavailable";
      const child = archive&&archivedFrame&&path===archive.relativePath?{kind:"directory",identity:archivedFrame.project.mount}:scan.snapshot?.children.find(c => c.relativePath === path);
      const rootObservation = root.observation;
      const archiveReady=!archive || !!archivedFrame && !!observed?.ok && sameDurableFolder(archivedFrame.project.evidence,observed.evidence) && sameIdentity(archivedFrame.project.mount,observed.mount) &&
        archivedFrame.parents.every(parent=>{const current=observations.get(parent.path);return !!current?.ok && !!parent.observation && sameDurableFolder(parent.observation.evidence,current.evidence) &&
          sameIdentity(parent.observation.mount,current.mount) && counts.get(key(current)!)===1 &&
          !rows.some(other=>other.row.id!==row.id && (filesystemAlias(other.row.relativePath)===filesystemAlias(parent.path) ||
            other.row.durableEvidence!==null&&!storedEvidence(other.row.durableEvidence) || sameOwnership(other.row,current))) &&
          !data.reservations.some(reservation=>reservationOwnsFolder(reservation,current));});
      const pathKey=(path:string)=>filesystemAlias(path.split(sep).join('/'));
      const targetKey=pathKey(join(source.canonicalRoot,path));
      const peerOwned=!!archive&&!!observed?.ok&&data.peerSources.some(peer=>{
        const locator=pathKey(peer.canonicalRoot),saved=storedEvidence(peer.durableEvidence),legacy=peer.appliedRootIdentity?JSON.parse(peer.appliedRootIdentity):null;
        return locator===targetKey || locator.startsWith(targetKey+'/') || (saved?durableOwnershipKey(saved)===key(observed):peer.durableEvidence!==null || legacy&&legacy.ino===observed.mount.ino&&legacy.birthtimeNs===observed.mount.birthtimeNs);
      });
      const eligible = !!(!peerOwned && archiveReady && rootEligible && observed?.ok && rootObservation.ok && entry && (archive?row.modeInactive:!row.modeInactive || !!archiveParent && path===row.relativePath) &&
        row.associationState !== "excluded" && row.associationState !== "replaced" &&
        ["review_required", "scope_unverified", "verified"].includes(oldState) &&
        observed.evidence.volume === rootObservation.evidence.volume && observed.evidence.serial === rootObservation.evidence.serial &&
        counts.get(key(observed)!) === 1 && child?.kind === "directory" && sameIdentity(child.identity, observed.mount) &&
        !rows.some(other => other.row.id !== row.id && !dormantRoleHistory(other,kind,row,observed) && !retainedArchiveRole(other,kind,row,observed) && (other.row.relativePath === path || sameOwnership(other.row, observed))) &&
        !data.reservations.some(r => r.relativePath === path || r.relativePath.startsWith(`${path}/`) || path.startsWith(`${r.relativePath}/`) || observed && reservationOwnsFolder(r,observed)));
      if (kind === "category" && eligible && oldState === "verified" && path === row.relativePath) verifiedParents.add(row.id);
      return {kind, id:row.id, relativePath:path, savedPath:row.relativePath,...(archive?{archived:true}:{}),...(archiveParent?{archivedParent:true}:{}), eligible:eligible && (oldState !== "verified" || afterEnrollment && path === (archive?.relativePath??row.relativePath)), selected:!!mapping, reason:observed?.ok && root.observation.ok && (observed.evidence.provider !== root.observation.evidence.provider || observed.evidence.volume !== root.observation.evidence.volume || observed.evidence.serial !== root.observation.evidence.serial) ? "different_volume" as const : oldState as import("../contracts/source-association.js").FolderIdentityReason};
    });
    let valid = !!rootEligible && counts.get(key(root.observation)!) === 1 && mappings.every(m => candidates.some(c => c.kind === m.kind && c.id === m.id && c.eligible));
    // A legacy parent requires its own explicit mapping; root consent never enrolls it implicitly.
    for (const mapping of mappings) {
      if (mapping.kind === "project" && mode === "grouped" && !data.archives.some(archive=>archive.projectId===mapping.id)) {
        const project = data.projects.find(p => p.id === mapping.id)!;
        const parent = data.categories.find(c => c.id === project.categoryId);
        const selectedParent = mappings.find(m => m.kind === "category" && m.id === parent?.id);
        const parentPath = selectedParent?.relativePath ?? parent?.relativePath;
        const parentObserved = parentPath ? observations.get(parentPath) : undefined;
        if (!parent || mapping.relativePath.split("/")[0] !== parentPath || (!selectedParent &&
          (!parentObserved?.ok || !root.observation.ok || parentObserved.evidence.volume !== root.observation.evidence.volume ||
            parentObserved.evidence.serial !== root.observation.evidence.serial ||
            !verifiedParents.has(parent.id) ||
            identityState(parent.durableEvidence, parentObserved, scope) !== "verified"))) valid = false;
      }
      evidence.push({mapping, observation: observations.get(mapping.relativePath) ?? {ok:false,reason:"missing_attributes"}});
    }
    for (const mapping of mappings.filter(m => m.kind === "category")) {
      const category = data.categories.find(c => c.id === mapping.id);
      if (category && category.relativePath !== mapping.relativePath && data.projects.some(project => project.categoryId === category.id &&
        !project.modeInactive && project.associationState === "active" && !mappings.some(m => m.kind === "project" && m.id === project.id &&
          m.relativePath.split("/")[0] === mapping.relativePath))) valid = false;
    }
    return {data, scan, evidence, archiveFrames,archiveInventory, valid, reason:root.state, candidates, fingerprint:JSON.stringify({...data,source:{...source,propertyRevision:0,categoryPropertyRevision:0}})};
  }
  return {
    invalidate(sourceId: string) { for (const [token, review] of reviews) if (review.preview.sourceId === sourceId) reviews.delete(token); },
    close() { reviews.clear(); },
    removeWorkspace(workspaceId: string) { for (const [token, review] of reviews) if (review.workspaceId === workspaceId) reviews.delete(token); },
    preview(input: unknown): ServiceResult<SourceAssociationPreview> {
      if (!record(input) || input.type !== "workspace.previewSourceAssociation" || !uuid(input.workspaceId) || Object.keys(input).length !== 3 ||
        !Array.isArray(input.mappings) || input.mappings.length > 10000 || !input.mappings.every(m => record(m) && Object.keys(m).length === 3 &&
          (m.kind === "project" || m.kind === "category") && uuid(m.id) && typeof m.relativePath === "string") ||
        new Set(input.mappings.map(m => m.id)).size !== input.mappings.length ||
        new Set(input.mappings.map(m => m.relativePath)).size !== input.mappings.length) return invalid();
      try {
        for (const [token, review] of reviews) if (review.workspaceId === input.workspaceId) reviews.delete(token);
        const mappings = structuredClone(input.mappings) as FolderMapping[];
        const current = inspect(input.workspaceId, mappings);
        const preview: SourceAssociationPreview = {workspaceId:input.workspaceId, sourceId:current.data.source.id,
          canonicalRoot:current.data.source.canonicalRoot, reason:current.reason, candidates:current.candidates,
          targets:[...current.scan.entries.filter(e => e.reason === null).map(e => ({kind:e.kind,relativePath:e.relativePath})),...current.data.archives.filter(a=>current.archiveFrames.has(a.projectId)).map(a=>({kind:"project" as const,relativePath:a.relativePath,archivedProjectId:a.projectId})),...current.candidates.filter(c=>c.archivedParent).map(c=>({kind:"category" as const,relativePath:c.relativePath,archivedParentCategoryId:c.id}))],
          mappings, retainedCount:current.candidates.length - mappings.length, pendingOperations:new Set(current.data.reservations.map(r => r.operationId)).size,
          previewToken:current.valid ? randomUUID() : null};
        if (preview.previewToken) reviews.set(preview.previewToken, {workspaceId:input.workspaceId, preview:structuredClone(preview),
          fingerprint:current.fingerprint, scan:current.scan, evidence:current.evidence,archiveFrames:JSON.stringify([...current.archiveFrames]),archiveInventory:current.archiveInventory});
        return {ok:true,value:preview};
      } catch { return invalid(); }
    },
    cancel(input: unknown): ServiceResult<SourceAssociationResult> {
      if (!record(input) || input.type !== "workspace.cancelSourceAssociation" || Object.keys(input).length !== 3 ||
        !uuid(input.workspaceId) || !uuid(input.previewToken)) return invalid();
      const review = reviews.get(input.previewToken);
      if (review && review.workspaceId !== input.workspaceId) return invalid();
      reviews.delete(input.previewToken);
      return {ok:true,value:{canceled:true}};
    },
    apply(input: unknown): ServiceResult<SourceAssociationResult> {
      if (!record(input) || input.type !== "workspace.applySourceAssociation" || Object.keys(input).length !== 3 ||
        !uuid(input.workspaceId) || !uuid(input.previewToken)) return invalid();
      const saved = reviews.get(input.previewToken);
      reviews.delete(input.previewToken);
      if (!saved || saved.workspaceId !== input.workspaceId) return stale();
      try {
        const verify = () => {
          const current = inspect(saved.workspaceId, saved.preview.mappings);
          if (!current.valid || current.fingerprint !== saved.fingerprint || !equal(current.scan, saved.scan) || !equal(current.evidence, saved.evidence) || JSON.stringify([...current.archiveFrames])!==saved.archiveFrames || !equal(current.archiveInventory,saved.archiveInventory)) throw new StaleBinding();
          return current;
        };
        verify();
        const source = db.transaction(() => {
          const current = verify(), {source} = current.data;
          const root = current.evidence[0].observation;
          if (!root.ok || !Number.isSafeInteger(source.evidenceGeneration + 1) || !Number.isSafeInteger(source.discoveryRevision + 1)) throw new StaleBinding();
          const movedProjects = current.data.projects.filter(project => !project.modeInactive && project.associationState === "active" &&
            saved.preview.mappings.some(m => m.kind === "project" && m.id === project.id && m.relativePath !== project.relativePath));
          for (const project of movedProjects) db.update(schema.projects).set({associationState:"replaced"}).where(eq(schema.projects.id, project.id)).run();
          const ordered = current.evidence.slice(1).sort((a,b) => Number(a.mapping?.kind === "project") - Number(b.mapping?.kind === "project"));
          for (const {mapping, observation} of ordered) {
            if (!mapping || !observation.ok) throw new StaleBinding();
            const table = mapping.kind === "category" ? schema.categories : schema.projects;
            db.update(table).set({...(!current.data.archives.some(a=>mapping.kind==="project"&&a.projectId===mapping.id)?{relativePath:mapping.relativePath}:{}),durableEvidence:JSON.stringify(observation.evidence)}).where(eq(table.id, mapping.id)).run();
          }
          for (const project of movedProjects) db.update(schema.projects).set({associationState:project.associationState}).where(eq(schema.projects.id, project.id)).run();
          db.update(schema.sources).set({durableEvidence:JSON.stringify(root.evidence), evidenceGeneration:source.evidenceGeneration + 1,
            discoveryRevision:source.discoveryRevision + 1}).where(eq(schema.sources.id, source.id)).run();
          const archiveBindings=saved.preview.mappings.flatMap(mapping=>{
            const frame=mapping.kind==="project"?current.archiveFrames.get(mapping.id):undefined;
            return frame?[{id:randomUUID(),sourceId:source.id,projectId:mapping.id,generation:source.evidenceGeneration+1,authorization:JSON.stringify(frame)}]:[];
          });
          for(const binding of archiveBindings)db.insert(schema.archivedFolderAssociations).values(binding).run();
          const after = inspect(saved.workspaceId, saved.preview.mappings, true);
          const expectedRows = <T extends {id:string;relativePath:string;durableEvidence:string|null}>(rows:T[],kind:"project"|"category") => rows.map(row => {
            const accepted=current.evidence.find(item=>item.mapping?.kind===kind&&item.mapping.id===row.id);
            return accepted?.mapping && accepted.observation.ok
              ? {...row,relativePath:kind==="project"&&current.data.archives.some(a=>a.projectId===row.id)?row.relativePath:accepted.mapping.relativePath,durableEvidence:JSON.stringify(accepted.observation.evidence)} : row;
          });
          const expected = {...current.data,
            source:{...source,durableEvidence:JSON.stringify(root.evidence),evidenceGeneration:source.evidenceGeneration+1,discoveryRevision:source.discoveryRevision+1},
            projects:expectedRows(current.data.projects,"project"),categories:expectedRows(current.data.categories,"category"),archiveBindings:[...current.data.archiveBindings,...archiveBindings].sort((a,b)=>a.id.localeCompare(b.id))};
          if (!after.valid || !equal(after.data,expected) || !equal(after.scan, saved.scan) || !equal(after.evidence, saved.evidence) || JSON.stringify([...after.archiveFrames])!==saved.archiveFrames || !equal(after.archiveInventory,saved.archiveInventory)) throw new StaleBinding();
          return {...source,evidenceGeneration:source.evidenceGeneration + 1,discoveryRevision:source.discoveryRevision + 1};
        });
        committed(source.id, source.discoveryRevision);
        return {ok:true,value:{sourceId:source.id,generation:source.evidenceGeneration}};
      } catch (error) { return error instanceof StaleBinding ? stale() : {ok:false,error:{code:"storage",message:"Folder association could not be saved."}}; }
    },
  };
}
function invalid(): ServiceResult<never> { return {ok:false,error:{code:"invalid_input",message:"Choose an existing source and explicit eligible folder mappings."}}; }
function stale(): ServiceResult<never> { return {ok:false,error:{code:"stale_preview",message:"Folder state changed; review again."}}; }
