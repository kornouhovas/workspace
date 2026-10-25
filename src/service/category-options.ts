import {validLegacyCategoryFolderHistory,categoryAuthorizationMatchesBinding,parseCategoryFolderAuthorization,type CategoryFolderAuthorization} from "./category-folder-authorization.js";
import {parseFolderObservation,type FilesystemAuthorizer,type VerifiedFolder} from "./filesystem-authorization.js";
import {identityState,storedEvidence} from "./source-identity.js";
import {durableOwnershipKey,sameDurableFolder} from "./folder-evidence.js";
import {isDeepStrictEqual} from "node:util";
import { randomUUID } from "node:crypto";
import { join, sep } from "node:path";
import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isCategoryOptionsRequest, type CategoryFolderPreview, type CategoryFolderOperation, type CategoryFolderResult, type CategoryFolderStatus, type CategoryFolderRecoveryPreview, type CategoryPresentationSnapshot } from "../contracts/category-options.js";
import type { ServiceResult } from "../contracts/settings.js";
import { nativeProjectFilesystem, validProjectBasename, verifyCreationDirectory, assertCreationDestinationFree, filesystemProblem, type ProjectFilesystem } from "./project-filesystem.js";
import { sameIdentity, reliableIdentity, scanGroupedSource, projectExclusions } from "./discovery.js";
import { readProjectReservations } from "./project-rename-reservations.js";
import { renameNoReplace, type ProjectRenameFilesystemResult } from "./project-rename-filesystem.js";
import { filesystemAlias } from "./path-alias.js";
import * as schema from "./db/schema.js";

class FolderFailure extends Error { constructor(readonly problem: string) { super(problem); } }

type Database = BetterSQLite3Database<typeof schema>;
type Source = typeof schema.sources.$inferSelect;
type Operation = typeof schema.categoryFolderOperations.$inferSelect;
type Category = typeof schema.categories.$inferSelect;
type Project = typeof schema.projects.$inferSelect;
type Binding = { source: Source; snapshot: unknown; category: Category | null; members: Project[]; additions: Project[]; associationIdentity: string | null };
type Execution = {authorization:CategoryFolderAuthorization;destination:VerifiedFolder|null;source:Source;legacy:boolean};
const same = (a: unknown, b: unknown) => isDeepStrictEqual(a,b);
const policy=(source:Source)=>({...source,propertyRevision:0,categoryPropertyRevision:0});
const invalid = (message = "Review a category folder in a saved grouped workspace.") => ({ ok: false as const, error: { code: "invalid_input" as const, message } });
const storageFailure = () => ({ ok: false as const, error: { code: "storage" as const, message: "Category operation history could not be read." } });
const stale = () => ({ ok: false as const, error: { code: "stale_preview" as const, message: "Refresh the preview and review the current folder state." } });
const failure = () => ({ ok: false as const, error: { code: "filesystem" as const, message: "The category folder is unavailable, occupied, excluded or changed." } });
function view(row: Operation): CategoryFolderOperation {
  return { operationId: row.operationId, sourceId: row.sourceId, categoryId: row.categoryId, action: row.action,
    originalRelativePath: row.originalRelativePath, requestedRelativePath: row.requestedRelativePath,
    stage: row.stage, problem: row.problem, completedRevision: row.completedRevision };
}
function result(row: Operation): ServiceResult<CategoryFolderResult> {
  return { ok: true, value: { outcome: row.stage === "completed" ? "completed" : row.stage === "failed" ? "rejected" : "recoverable", operation: view(row) } };
}
export function createCategoryOptionsService(db: Database, committed: (sourceId: string, revision: number, workspaceIds: string[], presentation?: boolean) => void,
  filesystem: ProjectFilesystem = nativeProjectFilesystem, native: (from: string, to: string) => ProjectRenameFilesystemResult = renameNoReplace, authorizer?: FilesystemAuthorizer, settled?: (sourceId:string)=>void) {
  const recoveryReviews = new Map<string, { token: string; row: Operation; fingerprint: string; actions: ("complete_destination" | "keep_original")[];execution:Execution|null }>();
  const reviews = new Map<string, { preview: CategoryFolderPreview; binding: Binding; authorization:CategoryFolderAuthorization|null }>();
  const sourceFor = (workspaceId: string) => db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
    .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  const operationFor = (operationId: string) => db.select().from(schema.categoryFolderOperations).where(eq(schema.categoryFolderOperations.operationId, operationId)).get();
  function executionFor(row:Operation):Execution|null {
    if(!authorizer)return null;
    const authorization=parseCategoryFolderAuthorization(row.authorization);
    const destination=row.destinationEvidence ? parseFolderObservation(JSON.parse(row.destinationEvidence)) : null;
    if(!authorization || !categoryAuthorizationMatchesBinding(authorization,row) || row.destinationEvidence!==null && !destination)throw new Error("Unverified operation authority");
    return {authorization,destination,source:(JSON.parse(row.binding) as Binding).source,legacy:false};
  }
  function verifyRoot(source:Source,execution:Execution|null) {
    if(execution)authorizer!.verify(execution.authorization.binding,source,"",source.durableEvidence);
    verifyCreationDirectory(filesystem,source.canonicalRoot,execution?.authorization.binding.root.mount ?? JSON.parse(source.appliedRootIdentity!));
  }
  function scan(source: Source,execution:Execution|null=null) {
    if (source.discoveryMode !== "grouped" || !source.appliedRootIdentity) throw new Error("Unconfigured");
    const current=execution ?? (authorizer ? {authorization:{version:1 as const,binding:authorizer.capture(source,"",source.durableEvidence),category:null,projects:[]},destination:null,source,legacy:false} : null);
    verifyRoot(source,current);
    const observed = scanGroupedSource(source.canonicalRoot, source.archiveRelativePath, projectExclusions(JSON.parse(source.excludedRelativePaths), "grouped").effective);
    if (!observed.snapshot || !same(observed.snapshot.root.identity,current?.authorization.binding.root.mount ?? JSON.parse(source.appliedRootIdentity))) throw new Error("Changed root");
    verifyRoot(source,current);
    return observed;
  }
  function inventory(source:Source,execution:Execution,observed=scan(source,execution)) {
    const folders=new Map<string,VerifiedFolder>();
    const counts=new Map([[durableOwnershipKey(execution.authorization.binding.root.evidence),1]]);
    for(const entry of observed.entries.filter(entry=>entry.reason===null)) {
      const child=observed.snapshot!.children.find(child=>child.relativePath===entry.relativePath);
      if(child?.kind!=="directory")continue;
      try {
        const proof=authorizer!.observe(join(source.canonicalRoot,entry.relativePath),execution.authorization.binding.root,child.identity);
        folders.set(entry.relativePath,proof);const key=durableOwnershipKey(proof.evidence);counts.set(key,(counts.get(key)??0)+1);
      }catch{/* Unavailable unrelated entries grant no authority. */}
    }
    verifyRoot(source,execution);
    if(counts.get(durableOwnershipKey(execution.authorization.binding.root.evidence))!==1)throw new Error("Ambiguous source root");
    for(const [path,proof] of folders)if(counts.get(durableOwnershipKey(proof.evidence))!==1)folders.delete(path);
    return {folders,counts};
  }
  function verifyNamespace(row:Pick<Operation,"sourceId"|"categoryId"|"originalRelativePath"|"requestedRelativePath">,b:Binding,execution:Execution) {
    const category=execution.authorization.category ?? execution.destination;
    const proofs=[...(category?[category]:[]),...execution.authorization.projects.map(p=>p.observation)];
    const keys=new Set(proofs.map(p=>durableOwnershipKey(p.evidence)));
    const current=inventory(b.source,execution);
    const observations=new Map([...current.folders.values()].map(proof=>[durableOwnershipKey(proof.evidence),proof]));
    for(const proof of proofs) {
      const observed=observations.get(durableOwnershipKey(proof.evidence));
      if(!observed || !sameDurableFolder(observed.evidence,proof.evidence) || !sameIdentity(observed.mount,proof.mount))throw new Error("Category observation changed");
    }
    const selected=new Set([row.categoryId,...b.members.map(p=>p.id),...b.additions.map(p=>p.id)]);
    const paths=[row.requestedRelativePath,...(row.originalRelativePath?[row.originalRelativePath]:[]),...b.members.flatMap(p=>[p.relativePath,row.requestedRelativePath+p.relativePath.slice(row.originalRelativePath!.length)]),...b.additions.map(p=>p.relativePath)].map(filesystemAlias);
    for(const record of [...db.select().from(schema.categories).where(eq(schema.categories.sourceId,row.sourceId)).all(),...db.select().from(schema.projects).where(eq(schema.projects.sourceId,row.sourceId)).all()]) {
      if(selected.has(record.id))continue;
      const saved=storedEvidence(record.durableEvidence),nativeIdentity=JSON.parse(record.nativeIdentity);
      const dormant=b.category && category && "categoryId" in record && record.categoryId===null && record.modeInactive && ["active","excluded"].includes(record.associationState) && record.relativePath===b.category.relativePath &&
        (saved ? sameDurableFolder(saved,category.evidence,false) : record.durableEvidence===null && sameIdentity(nativeIdentity,JSON.parse(b.category.nativeIdentity)) && sameIdentity(nativeIdentity,category.mount));
      if(dormant)continue;
      if(paths.includes(filesystemAlias(record.relativePath)) || (saved ? keys.has(durableOwnershipKey(saved)) : record.durableEvidence!==null || proofs.some(p=>p.mount.ino===nativeIdentity.ino && p.mount.birthtimeNs===nativeIdentity.birthtimeNs)))throw new Error("Reserved category ownership");
    }
    for(const peer of db.select().from(schema.sources).all().filter(p=>p.id!==row.sourceId)) {
      const absolute=(path:string)=>filesystemAlias(path);
      const original=row.originalRelativePath?absolute(join(b.source.canonicalRoot,row.originalRelativePath)):null;
      const peerPath=absolute(peer.canonicalRoot);
      if(proofs.some(proof=>{const saved=storedEvidence(peer.durableEvidence);if(saved)return keys.has(durableOwnershipKey(saved));if(peer.durableEvidence!==null)return true;if(!peer.appliedRootIdentity)return false;const old=JSON.parse(peer.appliedRootIdentity);return old.ino===proof.mount.ino && old.birthtimeNs===proof.mount.birthtimeNs;}) ||
        [row.requestedRelativePath,...execution.authorization.projects.map(p=>p.relativePath)].some(path=>absolute(join(b.source.canonicalRoot,path))===peerPath) ||
        original && (peerPath===original || peerPath.startsWith(original+sep)))throw new Error("Saved source root ownership");
    }
  }
  function targetProof(execution:Execution|null) {return execution?.destination ?? execution?.authorization.category ?? null;}
  function verifyPhysical(row:Operation,b:Binding,path:string,execution:Execution|null) {
    verifyRoot(b.source,execution);
    const proof=targetProof(execution);
    if(!row.nativeIdentity || execution && !proof)throw new Error("No ownership evidence");
    if(proof && execution?.authorization.category && !sameIdentity(proof.mount,execution.authorization.category.mount))throw new Error("Category mount changed during execution");
    verifyCreationDirectory(filesystem,join(b.source.canonicalRoot,path),proof?.mount ?? JSON.parse(row.nativeIdentity!));
    if(execution) {
      authorizer!.observe(join(b.source.canonicalRoot,path),execution.authorization.binding.root,proof!.mount,proof!.evidence);
      for(const project of execution.authorization.projects) {
        const relative=path+"/"+project.relativePath.split("/").at(-1)!;
        verifyCreationDirectory(filesystem,join(b.source.canonicalRoot,relative),project.observation.mount);
        authorizer!.observe(join(b.source.canonicalRoot,relative),execution.authorization.binding.root,project.observation.mount,project.observation.evidence);
      }
      authorizer!.observe(join(b.source.canonicalRoot,path),execution.authorization.binding.root,proof!.mount,proof!.evidence);
    }
    verifyRoot(b.source,execution);
  }
  function verifyBinding(row: Operation, workspaceId: string,execution:Execution|null=executionFor(row)) {
    const original: Binding = JSON.parse(row.binding), source = sourceFor(workspaceId);
    const b={...original,source:execution?.source ?? original.source};
    // Text and property-label revisions are independent of folder authorization.
    if (!source || !same(policy(source), policy(b.source))) throw new Error("Configuration changed");
    verifyRoot(source,execution);
    if(execution)verifyNamespace(row,b,execution);
    filesystem.assertAccessible?.(source.canonicalRoot);
    if (readProjectReservations(db, source.id).some(r => r.operationKind !== "category_folder" || r.operationId !== row.operationId)) throw new Error("Reserved source");
    const historical=<T extends object>(record:T)=>execution?.legacy?{durableEvidence:null,...record}:record;
    if (b.category && !same(db.select().from(schema.categories).where(eq(schema.categories.id, b.category.id)).get(), historical(b.category))) throw new Error("Category changed");
    if (b.category && !same(db.select().from(schema.projects).where(eq(schema.projects.categoryId, b.category.id)).orderBy(asc(schema.projects.id)).all(), b.members.map(historical))) throw new Error("Projects changed");
    return b;
  }
  function impactSnapshot(row:Operation,b:Binding,execution:Execution|null) {
    const snapshot=b.snapshot as NonNullable<ReturnType<typeof scan>["snapshot"]>;
    if(!execution)return snapshot;
    // This is only an impact-comparison projection. Current authority comes
    // from sufficient immutable full proofs and fresh per-review observations.
    const root=execution.authorization.binding.root.mount,old=snapshot.root.identity;
    const category=execution.authorization.category;
    return {...snapshot,root:{...snapshot.root,identity:root},children:snapshot.children.map(child=>{
      if(child.kind!=="directory")return child;
      const project=execution.authorization.projects.find(p=>p.relativePath===child.relativePath);
      const identity=project?.observation.mount ?? (category && child.relativePath===(row.originalRelativePath??row.requestedRelativePath) ? category.mount
        : child.identity.dev===old.dev ? {...child.identity,dev:root.dev} : child.identity);
      return {...child,identity};
    })};
  }
  function verifyPlacement(row: Operation, workspaceId: string, path: string,execution:Execution|null=executionFor(row)) {
    const b = verifyBinding(row, workspaceId,execution);
    if (!row.nativeIdentity) throw new Error("No ownership evidence");
    const absolute = join(b.source.canonicalRoot, path);
    if (!filesystem.names(b.source.canonicalRoot).includes(path)) throw new Error("Spelling changed");
    verifyPhysical(row,b,path,execution);
    filesystem.assertAccessible?.(absolute);
    const observed = scan(b.source,execution);
    const originalSnapshot = impactSnapshot(row,b,execution);
    const expected = originalSnapshot.children.filter(c => c.relativePath.startsWith(`${row.originalRelativePath}/`));
    const actual = observed.snapshot!.children.filter(c => c.relativePath.startsWith(`${path}/`));
    if (row.action === "create" && filesystem.names(absolute).length) throw new Error("New folder changed");
    if (row.action === "associate" && !same(observed.snapshot, originalSnapshot)) throw new Error("Association changed");
    if (row.action === "rename" && !same(expected.map(c => ({ ...c, relativePath: c.relativePath.slice(row.originalRelativePath!.length) })),
      actual.map(c => ({ ...c, relativePath: c.relativePath.slice(path.length) })))) throw new Error("Category contents changed");
    verifyBinding(row, workspaceId,execution);
    return b;
  }
  function complete(row: Operation, workspaceId: string,execution:Execution|null=executionFor(row)) {
    const b = verifyPlacement(row, workspaceId, row.requestedRelativePath,execution);
    const categoryEvidence=targetProof(execution);
    if (row.originalRelativePath) assertCreationDestinationFree(filesystem, b.source.canonicalRoot, row.originalRelativePath);
    const revision = b.source.discoveryRevision + 1;
    if (!Number.isSafeInteger(revision)) throw new Error("Revision exhausted");
    db.transaction(tx => {
      verifyPlacement(row, workspaceId, row.requestedRelativePath,execution);
      if (row.action === "rename") {
        // Temporarily retire members inside the transaction to preserve existing
        // grouped ownership guards while changing parent and child locators.
        for (const member of b.members) tx.update(schema.projects).set({ modeInactive: true }).where(eq(schema.projects.id, member.id)).run();
        tx.update(schema.categories).set({ relativePath: row.requestedRelativePath, ...(categoryEvidence ? {durableEvidence:JSON.stringify(categoryEvidence.evidence)} : {}) }).where(eq(schema.categories.id, row.categoryId)).run();
        for (const member of b.members) tx.update(schema.projects).set({ relativePath: row.requestedRelativePath + member.relativePath.slice(row.originalRelativePath!.length), modeInactive: member.modeInactive,...(execution?{durableEvidence:JSON.stringify(execution.authorization.projects.find(p=>p.id===member.id)!.observation.evidence)}:{}) }).where(eq(schema.projects.id, member.id)).run();
      } else {
        tx.insert(schema.categories).values({ id: row.categoryId, sourceId: b.source.id, relativePath: row.requestedRelativePath, nativeIdentity: row.nativeIdentity!, associationState: "active", durableEvidence: categoryEvidence ? JSON.stringify(categoryEvidence.evidence) : null, modeInactive: false }).run();
        for (const project of b.additions) tx.insert(schema.projects).values({ ...project, categoryId: row.categoryId,...(execution?{durableEvidence:JSON.stringify(execution.authorization.projects.find(p=>p.id===project.id)!.observation.evidence)}:{}) }).run();
      }
      tx.update(schema.sources).set({ discoveryRevision: revision }).where(eq(schema.sources.id, b.source.id)).run();
      tx.update(schema.categoryFolderOperations).set({ stage: "completed", completedRevision: revision, problem: null }).where(eq(schema.categoryFolderOperations.operationId, row.operationId)).run();
      verifyPhysical(row,b,row.requestedRelativePath,execution);
    }, { behavior: "immediate" });
    committed(b.source.id, revision, db.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId, b.source.id)).all().map(w => w.id));
    return result(operationFor(row.operationId)!);
  }
  function previewCategoryFolder(input: unknown): ServiceResult<CategoryFolderPreview> {
    if (!isCategoryOptionsRequest(input) || input.type !== "workspace.previewCategoryFolder") return invalid();
    try {
      const source = sourceFor(input.workspaceId);
      if (!source || !validProjectBasename(input.name, filesystem.platform) || !input.name.trim() || input.name.startsWith(".") ||
        ["$RECYCLE.BIN", "SYSTEM VOLUME INFORMATION"].includes(filesystemAlias(input.name)) || input.name.includes("\\")) return invalid();
      if (readProjectReservations(db, source.id).length) return stale();
      const authority:CategoryFolderAuthorization|null=authorizer?{version:1,binding:authorizer.capture(source,"",source.durableEvidence),category:null,projects:[]}:null;
      const execution:Execution|null=authority?{authorization:authority,destination:null,source,legacy:false}:null;
      const observed = scan(source,execution);
      const folders=execution?inventory(source,execution,observed).folders:null;
      const capture=(relative:string,saved:string|null,known:boolean)=>{
        const child=observed.snapshot!.children.find(c=>c.relativePath===relative);if(child?.kind!=="directory")throw new Error("Changed category content");
        const proof=folders!.get(relative);if(!proof || !sameIdentity(proof.mount,child.identity))throw new Error("Unverified category contents");
        if(known && identityState(saved,proof,authority!.binding.root.evidence.scope)!=="verified")throw new Error("Unverified association");return proof;
      };
      const excluded = JSON.parse(source.excludedRelativePaths) as string[];
      if (excluded.some(p => filesystemAlias(p.split("/")[0]) === filesystemAlias(input.name)) || source.archiveRelativePath && filesystemAlias(source.archiveRelativePath.split("/")[0]) === filesystemAlias(input.name)) return failure();
      const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).all();
      const category = input.action === "rename" ? categories.find(c => c.id === input.categoryId && !c.modeInactive && c.associationState === "active") : null;
      if (input.action === "rename" && !category) return invalid();
      // Preserve configured child exclusions/archive locators even when those
      // children are currently missing and therefore absent from the scan.
      if (category && (excluded.some(p => filesystemAlias(p.split("/")[0]) === filesystemAlias(category.relativePath)) ||
        source.archiveRelativePath && filesystemAlias(source.archiveRelativePath.split("/")[0]) === filesystemAlias(category.relativePath))) return failure();
      if (categories.some(c => filesystemAlias(c.relativePath) === filesystemAlias(input.name))) return failure();
      if (input.action !== "associate") assertCreationDestinationFree(filesystem, source.canonicalRoot, input.name);
      let associationIdentity: string | null = null;
      const additions: Project[] = [];
      if (input.action === "associate") {
        const entry = observed.entries.find(c => c.kind === "category" && c.relativePath === input.name && c.reason === null);
        const target = observed.snapshot!.children.find(c => c.kind === "directory" && c.relativePath === input.name);
        if (!entry || !target || target.kind !== "directory") return failure();
        associationIdentity = JSON.stringify(target.identity);
        verifyCreationDirectory(filesystem, join(source.canonicalRoot, input.name), target.identity);
        const records = [...categories, ...db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all()];
        const candidates = observed.entries.filter(c => c.kind === "project" && c.relativePath.startsWith(`${input.name}/`) && c.reason === null);
        for (const candidate of candidates) {
          const child = observed.snapshot!.children.find(c => c.kind === "directory" && c.relativePath === candidate.relativePath);
          if (!child || child.kind !== "directory" || !reliableIdentity(child.identity)) return failure();
          additions.push({ id: randomUUID(), sourceId: source.id, relativePath: candidate.relativePath, nativeIdentity: JSON.stringify(child.identity), categoryId: null, associationState: "active", durableEvidence: null, modeInactive: false });
        }
        const proposed = [{ relativePath: input.name, nativeIdentity: associationIdentity }, ...additions];
        if (proposed.some(c => records.some(r => filesystemAlias(r.relativePath) === filesystemAlias(c.relativePath) || same(JSON.parse(r.nativeIdentity), JSON.parse(c.nativeIdentity))))) return failure();
      }
      const members = category ? db.select().from(schema.projects).where(eq(schema.projects.categoryId, category.id)).orderBy(asc(schema.projects.id)).all() : [];
      if (category) {
        if(authority)authority.category=capture(category.relativePath,category.durableEvidence,true);
        verifyCreationDirectory(filesystem, join(source.canonicalRoot, category.relativePath), authority?.category?.mount ?? JSON.parse(category.nativeIdentity));
        if (!observed.entries.some(c => c.kind === "category" && c.relativePath === category.relativePath && c.reason === null)) return failure();
        // Retained or mode-inactive members need explicit recovery, never a bulk
        // rewrite of historical placements masquerading as a category rename.
        if (members.some(m => m.modeInactive || m.associationState !== "active" || !m.relativePath.startsWith(`${category.relativePath}/`))) return failure();
        for (const m of members) {
          if(authority)authority.projects.push({id:m.id,relativePath:m.relativePath,observation:capture(m.relativePath,m.durableEvidence,true)});
          verifyCreationDirectory(filesystem, join(source.canonicalRoot, ...m.relativePath.split("/")),authority?.projects.find(p=>p.id===m.id)?.observation.mount ?? JSON.parse(m.nativeIdentity));
        }
        const eligible = observed.entries.filter(c => c.kind === "project" && c.relativePath.startsWith(`${category.relativePath}/`));
        if (eligible.some(c => c.reason !== null || !members.some(m => m.relativePath === c.relativePath))) return failure();
      }
      if(authority && input.action==="associate") {authority.category=capture(input.name,null,false);for(const p of additions)authority.projects.push({id:p.id,relativePath:p.relativePath,observation:capture(p.relativePath,null,false)});}
      if(authority && !parseCategoryFolderAuthorization(JSON.stringify(authority)))return failure();
      const preview: CategoryFolderPreview = { workspaceId: input.workspaceId, sourceId: source.id, action: input.action, categoryId: category?.id ?? null,
        originalRelativePath: category?.relativePath ?? null, requestedRelativePath: input.name, revision: source.discoveryRevision,
        affectedProjects: [...members, ...additions].map(m => ({ projectId: input.action === "associate" ? null : m.id, name: m.relativePath.split("/").at(-1)!, originalRelativePath: m.relativePath, requestedRelativePath: input.action === "associate" ? m.relativePath : input.name + m.relativePath.slice(category!.relativePath.length) })), previewToken: randomUUID() };
      const binding:Binding={source,snapshot:observed.snapshot,category:category??null,members,additions,associationIdentity};
      if(execution)verifyNamespace({sourceId:source.id,categoryId:category?.id??randomUUID(),originalRelativePath:category?.relativePath??null,requestedRelativePath:input.name},binding,execution);
      reviews.set(input.workspaceId,{preview,binding,authorization:authority});
      return { ok: true, value: preview };
    } catch { return failure(); }
  }
  function applyCategoryFolder(input: unknown): ServiceResult<CategoryFolderResult> {
    if (!isCategoryOptionsRequest(input) || input.type !== "workspace.applyCategoryFolder") return invalid();
    let row: Operation | undefined, possibleEffect = false;
    try {
      const source = sourceFor(input.workspaceId);
      if (!source) return invalid();
      const prior = operationFor(input.operationId);
      if (prior) return prior.sourceId === source.id && prior.workspaceId === input.workspaceId && prior.previewToken === input.previewToken ? result(prior) : invalid();
      const review = reviews.get(input.workspaceId);
      if(review?.preview.previewToken===input.previewToken)reviews.delete(input.workspaceId);
      if (!review || review.preview.previewToken !== input.previewToken || !same(policy(source), policy(review.binding.source)) ||
        readProjectReservations(db, source.id).length || !same(scan(source).snapshot, review.binding.snapshot)) return stale();
      const name = review.preview.requestedRelativePath;
      if (review.preview.action !== "associate") assertCreationDestinationFree(filesystem, source.canonicalRoot, name);
      row = { operationId: input.operationId, sourceId: source.id, workspaceId: input.workspaceId, previewToken: input.previewToken,
        categoryId: review.preview.categoryId ?? randomUUID(), action: review.preview.action, originalRelativePath: review.preview.originalRelativePath, requestedRelativePath: name,
        authorization:review.authorization?JSON.stringify(review.authorization):null,destinationEvidence:null,
        binding: JSON.stringify(review.binding), nativeIdentity: review.binding.category?.nativeIdentity ?? review.binding.associationIdentity, stage: "intent", problem: null, completedRevision: null };
      verifyBinding(row,input.workspaceId);
      if(row.action!=="create")verifyPlacement(row,input.workspaceId,row.originalRelativePath??row.requestedRelativePath);
      db.transaction(tx => {
        if (!same(policy(sourceFor(input.workspaceId)!), policy(source)) || readProjectReservations(db, source.id).length || !same(scan(source).snapshot, review.binding.snapshot)) throw new Error("Stale review");
        tx.insert(schema.categoryFolderOperations).values(row!).run();
      }, { behavior: "immediate" });
      reviews.delete(input.workspaceId);
      verifyBinding(row, input.workspaceId);
      if (row.action !== "associate") assertCreationDestinationFree(filesystem, source.canonicalRoot, name);
      if (row.action === "create") { possibleEffect = true; filesystem.mkdir(join(source.canonicalRoot, name)); }
      else if (row.action === "rename") {
        verifyPlacement(row, input.workspaceId, row.originalRelativePath!);
        assertCreationDestinationFree(filesystem, source.canonicalRoot, name);
        possibleEffect = true;
        const outcome = native(join(source.canonicalRoot, row.originalRelativePath!), join(source.canonicalRoot, name));
        possibleEffect = outcome === "renamed" || outcome === "filesystem_error";
        if (outcome !== "renamed") throw new FolderFailure(outcome === "invalid_argument" ? "invalid_name" : outcome);
      }
      const identity = filesystem.inspect(join(source.canonicalRoot, name));
      if (identity.kind !== "directory" || !reliableIdentity(identity.identity)) throw new Error("Uncertain creation");
      const execution=executionFor(row);
      const proof=execution?authorizer!.observe(join(source.canonicalRoot,name),execution.authorization.binding.root,identity.identity,execution.authorization.category?.evidence):null;
      const nativeIdentity = execution ? row.nativeIdentity ?? JSON.stringify(identity.identity) : JSON.stringify(identity.identity);
      if (!execution && row.nativeIdentity && row.nativeIdentity !== nativeIdentity) throw new Error("Destination replaced");
      const destinationEvidence=proof?JSON.stringify(proof):null;
      verifyPlacement({ ...row, nativeIdentity,destinationEvidence }, input.workspaceId, name);
      db.update(schema.categoryFolderOperations).set({ nativeIdentity,destinationEvidence, stage: "destination_recorded" }).where(eq(schema.categoryFolderOperations.operationId, row.operationId)).run();
      row = operationFor(row.operationId)!;
      return complete(row, input.workspaceId);
    } catch (error) {
      if (!row || !operationFor(row.operationId)) return failure();
      try {
        const persisted = operationFor(row.operationId)!;
        if (["completed", "failed"].includes(persisted.stage)) return result(persisted);
        let noEffect = !possibleEffect;
        if (noEffect) try {
          verifyBinding(persisted, input.workspaceId);
          if (persisted.action === "rename") verifyPlacement(persisted, input.workspaceId, persisted.originalRelativePath!);
          else if (persisted.action === "create") assertCreationDestinationFree(filesystem, sourceFor(input.workspaceId)!.canonicalRoot, persisted.requestedRelativePath);
        } catch { noEffect = false; }
        db.update(schema.categoryFolderOperations).set({ ...(noEffect ? { stage: "failed" as const } : {}),
          problem: error instanceof FolderFailure ? error.problem : filesystemProblem(error) }).where(eq(schema.categoryFolderOperations.operationId, row.operationId)).run();
      } catch { /* Keep durable intent/evidence. */ }
      const retained=operationFor(row.operationId) ?? row;
      if(retained.stage==="failed")settled?.(retained.sourceId);
      return result(retained);
    }
  }
  function getCategoryFolderOperation(input: unknown): ServiceResult<CategoryFolderResult> {
    if (!isCategoryOptionsRequest(input) || input.type !== "workspace.getCategoryFolderOperation") return invalid();
    try {
      const source = sourceFor(input.workspaceId), row = operationFor(input.operationId);
      return source && row && source.id === row.sourceId ? result(row) : invalid();
    } catch { return { ok: false, error: { code: "storage", message: "Category operation could not be read." } }; }
  }
  function listCategoryFolderOperations(input: unknown): ServiceResult<CategoryFolderStatus> {
    if (!isCategoryOptionsRequest(input) || input.type !== "workspace.listCategoryFolderOperations") return invalid();
    try {
      const source = sourceFor(input.workspaceId); if (!source) return invalid();
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, operations: db.select().from(schema.categoryFolderOperations).where(eq(schema.categoryFolderOperations.sourceId, source.id)).orderBy(asc(schema.categoryFolderOperations.operationId)).all().filter(r => r.stage !== "completed" && r.stage !== "failed").map(view) } };
    } catch { return storageFailure(); }
  }
  function recoveryExecution(row:Operation,workspaceId:string):Execution|null {
    if(!authorizer)return null;
    const b:Binding=JSON.parse(row.binding),source=sourceFor(workspaceId);
    if(!source || source.id!==row.sourceId || ["id","canonicalRoot","discoveryMode","excludedRelativePaths","archiveRelativePath","appliedRootIdentity"].some(key=>
      source[key as keyof Source]!==b.source[key as keyof Source]))throw new Error("Changed source policy");
    const original=parseCategoryFolderAuthorization(row.authorization),legacy=row.authorization===null;
    if(!legacy && !original)throw new Error("Unknown authorization policy");
    const authority:CategoryFolderAuthorization={version:1,binding:authorizer.capture(source,"",source.durableEvidence),category:null,projects:[]};
    if(legacy ? !validLegacyCategoryFolderHistory(row,authority.binding.generation) || !sameIdentity(JSON.parse(b.source.appliedRootIdentity!),authority.binding.root.mount)
      : source.evidenceGeneration<original!.binding.generation || !sameDurableFolder(original!.binding.root.evidence,authority.binding.root.evidence))throw new Error("Unprovable operation root");
    const recorded=row.destinationEvidence?parseFolderObservation(JSON.parse(row.destinationEvidence)):null;
    if(row.destinationEvidence!==null && !recorded)throw new Error("Invalid recorded target");
    const expected=recorded ?? original?.category ?? null;
    const placements=[...new Set([row.originalRelativePath,row.requestedRelativePath])].filter((path):path is string=>path!==null);
    const matches=placements.flatMap(path=>{
      try {
        const item=filesystem.inspect(join(source.canonicalRoot,path));if(item.kind!=="directory" || !reliableIdentity(item.identity))return [];
        const proof=authorizer.observe(join(source.canonicalRoot,path),authority.binding.root,item.identity,expected?.evidence);
        if(legacy ? !row.nativeIdentity || !sameIdentity(JSON.parse(row.nativeIdentity),proof.mount) : !expected)return [];
        return [{path,proof}];
      }catch{return [];}
    });
    if(matches.length>1 || row.nativeIdentity!==null && matches.length!==1)throw new Error("Ambiguous operation target");
    const matching=matches[0];
    if(row.action!=="create")authority.category=matching?.proof ?? null;
    for(const project of [...b.members,...b.additions]) {
      if(!matching)throw new Error("Unproven category member");
      const path=matching.path+"/"+project.relativePath.split("/").at(-1)!;
      const expectedProject=original?.projects.find(p=>p.id===project.id);
      const item=filesystem.inspect(join(source.canonicalRoot,path));if(item.kind!=="directory")throw new Error("Missing member");
      const observation=authorizer.observe(join(source.canonicalRoot,path),authority.binding.root,item.identity,expectedProject?.observation.evidence);
      if(legacy ? !sameIdentity(JSON.parse(project.nativeIdentity),observation.mount) : !expectedProject)throw new Error("Unproven member history");
      authority.projects.push({id:project.id,relativePath:project.relativePath,observation});
    }
    if(!parseCategoryFolderAuthorization(JSON.stringify(authority)) || !categoryAuthorizationMatchesBinding(authority,row,legacy?"legacy_review":"renewed_review"))throw new Error("Invalid reviewed binding");
    return {authorization:authority,destination:matching?.path===row.requestedRelativePath?matching.proof:null,source,legacy};
  }
  const executionState=(execution:Execution|null)=>execution?{...execution,source:policy(execution.source)}:null;
  function inspectRecovery(row: Operation, workspaceId: string,execution:Execution|null=recoveryExecution(row,workspaceId)) {
    const b = verifyBinding(row, workspaceId,execution);
    const placement = (path: string | null): "matching" | "missing" | "changed" => {
      if (path === null) return "missing";
      try {
        assertCreationDestinationFree(filesystem, b.source.canonicalRoot, path);
        return "missing";
      } catch { /* Inspect exact ownership, never adopt a directory by path. */ }
      try { verifyPlacement(row, workspaceId, path,execution); return "matching"; } catch { return "changed"; }
    };
    const originalState = placement(row.originalRelativePath), destinationState = placement(row.requestedRelativePath);
    const actions: ("complete_destination" | "keep_original")[] = [];
    if (originalState === "missing" && destinationState === "matching") actions.push("complete_destination");
    if (destinationState === "missing" && (row.action === "create" || originalState === "matching")) actions.push("keep_original");
    if (row.action === "associate" && destinationState === "matching") actions.push("keep_original");
    const snapshot=scan(b.source,execution).snapshot;
    return { originalState, destinationState, actions,execution,snapshot,
      fingerprint: JSON.stringify({ row,execution:executionState(execution),snapshot,reservations: readProjectReservations(db, b.source.id) }) };
  }
  function previewCategoryFolderRecovery(input: unknown): ServiceResult<CategoryFolderRecoveryPreview> {
    if (!isCategoryOptionsRequest(input) || input.type !== "workspace.previewCategoryFolderRecovery") return invalid();
    let source: Source | undefined, row: Operation | undefined;
    try { source = sourceFor(input.workspaceId); row = operationFor(input.operationId); } catch { return storageFailure(); }
    if (!source || !row || row.sourceId !== source.id || ["completed", "failed"].includes(row.stage)) return invalid();
    const key = `${input.workspaceId}:${row.operationId}`;
    recoveryReviews.delete(key);
    try {
      const observed = inspectRecovery(row, input.workspaceId), token = observed.actions.length ? randomUUID() : null;
      if (token) recoveryReviews.set(key, { token, row, fingerprint: observed.fingerprint, actions: observed.actions,execution:observed.execution });
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, operation: view(row),
        originalState: observed.originalState, destinationState: observed.destinationState, actions: observed.actions, previewToken: token } };
    } catch {
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, operation: view(row), originalState: "changed", destinationState: "changed", actions: [], previewToken: null } };
    }
  }
  function recoverCategoryFolder(input: unknown): ServiceResult<CategoryFolderResult> {
    if (!isCategoryOptionsRequest(input) || input.type !== "workspace.recoverCategoryFolder") return invalid();
    const key = `${input.workspaceId}:${input.operationId}`, review = recoveryReviews.get(key);
    recoveryReviews.delete(key);
    if (!review || review.token !== input.previewToken || !review.actions.includes(input.action)) return stale();
    let row: Operation | undefined;
    try { row = operationFor(input.operationId); } catch { return storageFailure(); }
    if (!row || !same(row, review.row)) return stale();
    try {
      const current=inspectRecovery(row,input.workspaceId);
      if(current.fingerprint!==review.fingerprint || !current.actions.includes(input.action))return stale();
      const execution=current.execution;
      db.transaction(tx=>{
        if(inspectRecovery(row!,input.workspaceId).fingerprint!==review.fingerprint)throw new Error("Stale recovery");
        if(execution)tx.insert(schema.categoryFolderAttestations).values({id:randomUUID(),operationId:row!.operationId,journal:JSON.stringify(row),authorization:JSON.stringify(execution.authorization),destinationEvidence:execution.destination?JSON.stringify(execution.destination):null}).run();
        if(input.action==="keep_original") {
          tx.update(schema.categoryFolderOperations).set({stage:"failed",problem:"kept_original"}).where(eq(schema.categoryFolderOperations.operationId,row!.operationId)).run();
          const after=inspectRecovery(row!,input.workspaceId);
          if(!same(executionState(after.execution),executionState(execution)) || !same(after.snapshot,current.snapshot) ||
            after.originalState!==current.originalState || after.destinationState!==current.destinationState || !same(after.actions,current.actions))throw new Error("Recovery changed during settlement");
        }
      },{behavior:"immediate"});
      if(input.action==="keep_original") {settled?.(row.sourceId);return result(operationFor(row.operationId)!);}
      verifyPlacement(row,input.workspaceId,row.requestedRelativePath,execution);
      if(row.stage==="intent") {
        db.update(schema.categoryFolderOperations).set({stage:"destination_recorded",...(execution && !execution.legacy && row.destinationEvidence===null ? {destinationEvidence:JSON.stringify(execution.destination)} : {})}).where(eq(schema.categoryFolderOperations.operationId,row.operationId)).run();
        row=operationFor(row.operationId)!;
      }
      return complete(row,input.workspaceId,execution);
    } catch { try { return result(operationFor(input.operationId) ?? row); } catch { return result(row); } }
  }
  function presentation(workspaceId: string, source: Source): CategoryPresentationSnapshot {
    const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).all()
      .filter(c => c.associationState === "active" && !c.modeInactive).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const saved = db.select().from(schema.categoryPresentation).where(eq(schema.categoryPresentation.workspaceId, workspaceId)).all();
    const options = categories.map((category, i) => {
      const existing = saved.find(p => p.categoryId === category.id);
      return { categoryId: category.id, color: existing?.color ?? "default" as const, hidden: existing?.hidden ?? false, position: existing?.position ?? categories.length + i };
    }).sort((a, b) => a.position - b.position || a.categoryId.localeCompare(b.categoryId)).map((p, position) => ({ ...p, position }));
    return { workspaceId, sourceId: source.id, options };
  }
  function listCategoryPresentation(input: unknown): ServiceResult<CategoryPresentationSnapshot> {
    if (!isCategoryOptionsRequest(input) || input.type !== "workspace.listCategoryPresentation") return invalid();
    try {
      const source = sourceFor(input.workspaceId); if (!source || source.discoveryMode !== "grouped") return invalid();
      return { ok: true, value: presentation(input.workspaceId, source) };
    } catch { return { ok: false, error: { code: "storage", message: "Category presentation could not be read." } }; }
  }
  function setCategoryPresentation(input: unknown): ServiceResult<CategoryPresentationSnapshot> {
    if (!isCategoryOptionsRequest(input) || input.type !== "workspace.setCategoryPresentation") return invalid();
    try {
      const source = sourceFor(input.workspaceId); if (!source || source.discoveryMode !== "grouped") return invalid();
      const expected = presentation(input.workspaceId, source).options.map(p => p.categoryId).sort();
      if (!same(input.options.map(p => p.categoryId).sort(), expected) ||
        !same(input.options.map(p => p.position).sort((a, b) => a - b), expected.map((_, i) => i))) return invalid();
      db.transaction(tx => {
        tx.delete(schema.categoryPresentation).where(eq(schema.categoryPresentation.workspaceId, input.workspaceId)).run();
        for (const option of input.options) tx.insert(schema.categoryPresentation).values({ workspaceId: input.workspaceId, ...option }).run();
      }, { behavior: "immediate" });
      committed(source.id, source.discoveryRevision, [input.workspaceId], true);
      return { ok: true, value: presentation(input.workspaceId, source) };
    } catch { return { ok: false, error: { code: "storage", message: "Category presentation could not be saved." } }; }
  }
  return { getCategoryFolderOperation, previewCategoryFolder, applyCategoryFolder, listCategoryFolderOperations, previewCategoryFolderRecovery, recoverCategoryFolder, listCategoryPresentation, setCategoryPresentation,
    invalidateSource(sourceId: string) { for (const [key, r] of reviews) if (r.preview.sourceId === sourceId) reviews.delete(key);
      for (const [key, r] of recoveryReviews) if (r.row.sourceId === sourceId) recoveryReviews.delete(key); },
    close() { reviews.clear(); recoveryReviews.clear(); } };
}
