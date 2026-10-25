import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { join, sep } from "node:path";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isCategoryRemovalRequest, type CategoryRemovalPreview, type CategoryRemovalResult, type CategoryRemovalLookup, type CategoryRemovalList, type CategoryRemovalOperation, type CategoryRemovalRecoveryPreview } from "../contracts/category-removal.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isChildName, validArchive, validExclusions, scanGroupedSource, projectExclusions, sameIdentity } from "./discovery.js";
import { filesystemAlias } from "./path-alias.js";
import { assertCreationDestinationFree, filesystemCode, filesystemProblem, nativeProjectFilesystem, validProjectBasename, verifyCreationDirectory, type ProjectFilesystem } from "./project-filesystem.js";
import { readProjectReservations } from "./project-rename-reservations.js";
import type { createProjectCategoryMoveService } from "./project-category-move.js";
import {validLegacyRemovalHistory,parseRemovalAuthorization, removalBindingMatchesRow, type RemovalAuthorization} from "./category-removal-authorization.js";
import {type FilesystemAuthorizer, type VerifiedFolder} from "./filesystem-authorization.js";
import {sameDurableFolder, durableOwnershipKey} from "./folder-evidence.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
type Source = typeof schema.sources.$inferSelect;
type Category = typeof schema.categories.$inferSelect;
type Project = typeof schema.projects.$inferSelect;
type Operation = typeof schema.categoryRemovalOperations.$inferSelect;
type Binding = { legacyReview?:true; authorization?: RemovalAuthorization; source: Source; category: Category; destination: Category | null; members: Project[] };
class RemovalFailure extends Error { constructor(readonly problem: string) { super(problem); } }
const same = isDeepStrictEqual;
const policy = (source: Source) => ({...source,propertyRevision:0,categoryPropertyRevision:0});
export function createCategoryRemovalService(db: Database, moves: ReturnType<typeof createProjectCategoryMoveService>,
  committed: (sourceId: string, revision: number, workspaceIds: string[]) => void,
  filesystem: ProjectFilesystem = nativeProjectFilesystem, authorizer?: FilesystemAuthorizer) {
  const reviews = new Map<string, { preview: CategoryRemovalPreview; binding: Binding; fingerprint: string }>();
  const recoveryReviews = new Map<string, { sourceId: string; token: string; fingerprint: string; actions: ("retry_remaining" | "abandon")[]; binding?:Binding }>();
  const sourceFor = (workspaceId: string) => db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
    .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  const operationFor = (id: string) => db.select().from(schema.categoryRemovalOperations).where(eq(schema.categoryRemovalOperations.operationId, id)).get();
  const stale = (): ServiceResult<never> => ({ ok: false, error: { code: "stale_preview", message: "Refresh and explicitly review the current category removal." } });
  const storage = (): ServiceResult<never> => ({ ok: false, error: { code: "storage", message: "Category removal state could not be read or saved." } });
  function authority(binding: Binding): RemovalAuthorization | null {
    if (!authorizer) return null;
    const value = parseRemovalAuthorization(binding.authorization ? JSON.stringify(binding.authorization) : null, binding);
    if (!value) throw new RemovalFailure("ownership_uncertain");
    return value;
  }
  function capture(binding: Binding): RemovalAuthorization | undefined {
    if (!authorizer) return undefined;
    const root = authorizer.capture(binding.source, "", binding.source.durableEvidence);
    for(const c of [binding.category,...(binding.destination?[binding.destination]:[])])authorizer.capture(binding.source,c.relativePath,c.durableEvidence);
    const observe = (relativePath: string, evidence: string | null) => {
      if (!evidence) throw new RemovalFailure("ownership_uncertain");
      return authorizer.observe(join(binding.source.canonicalRoot, relativePath), root.root,
        filesystem.inspect(join(binding.source.canonicalRoot, relativePath)).identity, JSON.parse(evidence));
    };
    const authorization:RemovalAuthorization={version: 1, root, category: observe(binding.category.relativePath, binding.category.durableEvidence),
      destination: binding.destination ? observe(binding.destination.relativePath, binding.destination.durableEvidence) : null,
      projects: binding.members.map(p => ({id:p.id, observation:observe(p.relativePath,p.durableEvidence)}))};
    verifyPeerRoots({...binding,authorization});
    return authorization;
  }
  function verifyPeerRoots(binding: Binding) {
    const removed=filesystemAlias(join(binding.source.canonicalRoot,binding.category.relativePath));
    for(const peer of db.select().from(schema.sources).all().filter(s=>s.id!==binding.source.id)) {
      const path=filesystemAlias(peer.canonicalRoot);
      if(path===removed || path.startsWith(removed+sep))throw new RemovalFailure("native_conflict");
      const auth=binding.authorization;
      const saved=peer.durableEvidence?JSON.parse(peer.durableEvidence):null,native=peer.appliedRootIdentity?JSON.parse(peer.appliedRootIdentity):null;
      for(const proof of auth?[auth.category,...(auth.destination?[auth.destination]:[]),...auth.projects.map(p=>p.observation)]:[]) {
        if(saved ? durableOwnershipKey(saved)===durableOwnershipKey(proof.evidence) : native && native.ino===proof.mount.ino && native.birthtimeNs===proof.mount.birthtimeNs)throw new RemovalFailure("native_conflict");
      }
    }
  }
  function verifyDirectory(binding: Binding, relativePath: string, legacyIdentity: string) {
    const auth = authority(binding), path=join(binding.source.canonicalRoot,relativePath);
    let expected: VerifiedFolder | undefined;
    if(auth) {
      verifyPeerRoots(binding);
      authorizer!.verify(auth.root,binding.source,"",binding.source.durableEvidence);
      expected = relativePath === "" ? auth.root.root : relativePath === binding.category.relativePath ? auth.category :
        relativePath === binding.destination?.relativePath ? auth.destination! : auth.projects.find(p=>{
          const member=binding.members.find(m=>m.id===p.id)!;
          return relativePath===member.relativePath || relativePath===`${binding.destination?.relativePath}/${member.relativePath.split("/").at(-1)}`;
        })?.observation;
      if(!expected)throw new RemovalFailure("ownership_uncertain");
      authorizer!.observe(path,auth.root.root,expected.mount,expected.evidence);
    }
    verifyCreationDirectory(filesystem,path,expected?.mount ?? JSON.parse(legacyIdentity));
  }
  function verifyInventory(binding: Binding, categoryMissing=false) {
    const auth=authority(binding);
    if(!auth)return;
    verifyDirectory(binding,"",binding.source.appliedRootIdentity!);
    const source=binding.source,scan=scanGroupedSource(source.canonicalRoot,source.archiveRelativePath,projectExclusions(JSON.parse(source.excludedRelativePaths),"grouped").effective);
    if(!scan.snapshot || !sameIdentity(scan.snapshot.root.identity,auth.root.root.mount))throw new RemovalFailure("filesystem_changed");
    const owners=new Map<string,VerifiedFolder[]>();
    owners.set(durableOwnershipKey(auth.root.root.evidence),[auth.root.root]);
    for(const entry of scan.entries.filter(e=>e.reason===null)) {
      const node=scan.snapshot.children.find(c=>c.relativePath===entry.relativePath);
      if(node?.kind!=="directory")continue;
      try {
        const proof=authorizer!.observe(join(source.canonicalRoot,entry.relativePath),auth.root.root,node.identity),key=durableOwnershipKey(proof.evidence);
        owners.set(key,[...(owners.get(key)??[]),proof]);
      }catch{/* An unavailable unrelated folder grants no authority. */}
    }
    for(const expected of [auth.root.root,...(categoryMissing?[]:[auth.category]),...(auth.destination?[auth.destination]:[]),...auth.projects.map(p=>p.observation)]) {
      const matches=owners.get(durableOwnershipKey(expected.evidence));
      if(matches?.length!==1 || !sameDurableFolder(matches[0].evidence,expected.evidence) || !sameIdentity(matches[0].mount,expected.mount))throw new RemovalFailure("filesystem_changed");
    }
    verifyDirectory(binding,"",source.appliedRootIdentity!);
  }
  function topology(binding: Binding, categoryMissing=false) {
    verifyInventory(binding,categoryMissing);
    const { source, category, destination } = binding;
    verifyDirectory(binding, "", source.appliedRootIdentity!);
    const proofs=new Map<string,VerifiedFolder>();
    const auth=authority(binding);
    if(auth)proofs.set("",auth.root.root);
    const result = ["", category.relativePath, ...(destination ? [destination.relativePath] : [])].map(relativePath => {
      const path = join(source.canonicalRoot, relativePath);
      let entry: ReturnType<ProjectFilesystem["inspect"]>;
      try { entry = filesystem.inspect(path); }
      catch (error) { if (relativePath === category.relativePath && filesystemCode(error) === "ENOENT") return { relativePath, entry: null, children: [] }; throw error; }
      const expected = relativePath === "" ? source.appliedRootIdentity! : relativePath === category.relativePath ? category.nativeIdentity : destination!.nativeIdentity;
      verifyDirectory(binding, relativePath, expected);
      if (entry.kind !== "directory") throw new RemovalFailure("filesystem_changed");
      return { relativePath, entry, children: filesystem.names(path).sort().map(name => {
        const child=filesystem.inspect(join(path,name));
        const childPath=[relativePath,name].filter(Boolean).join("/");
        const proof=auth && child.kind==="directory" ? authorizer!.observe(join(path,name),auth.root.root,child.identity) : null;
        if(proof)proofs.set(childPath,proof);
        return {name,...child,...(proof?{proof}:{})};
      }) };
    });
    if(auth) {
      const keys=new Set<string>();
      for(const proof of proofs.values()) {
        const key=durableOwnershipKey(proof.evidence);
        if(keys.has(key))throw new RemovalFailure("native_conflict");
        keys.add(key);
      }
    }
    verifyDirectory(binding, "", source.appliedRootIdentity!);
    return result;
  }
  function fingerprint(binding: Binding, workspaceId: string, operation?: Operation) {
    let observed: unknown;
    try { observed = topology(binding,operation?.stage==="cleanup_intent"); } catch { observed = "unavailable"; }
    return JSON.stringify({ roots: db.select().from(schema.sources).orderBy(asc(schema.sources.id)).all().map(policy), source: sourceFor(workspaceId) ? policy(sourceFor(workspaceId)!) : null, categories: db.select().from(schema.categories).where(eq(schema.categories.sourceId, binding.source.id)).orderBy(asc(schema.categories.id)).all(),
      projects: db.select().from(schema.projects).where(eq(schema.projects.sourceId, binding.source.id)).orderBy(asc(schema.projects.id)).all(),
      reservations: readProjectReservations(db, binding.source.id), observed, operation,
      attestations:db.select().from(schema.categoryRemovalAttestations).where(eq(schema.categoryRemovalAttestations.operationId,operation?.operationId??"empty")).all(),
      attempts: operation ? db.select().from(schema.categoryRemovalAttempts).where(eq(schema.categoryRemovalAttempts.removalId, operation.operationId)).orderBy(asc(schema.categoryRemovalAttempts.moveId)).all() : [] });
  }
  function lastAttempt(operationId: string, projectId: string) {
    return db.select().from(schema.categoryRemovalAttempts).where(and(eq(schema.categoryRemovalAttempts.removalId, operationId), eq(schema.categoryRemovalAttempts.projectId, projectId))).orderBy(desc(schema.categoryRemovalAttempts.sequence)).get();
  }
  function operationView(row: Operation): CategoryRemovalOperation {
    const b: Binding = JSON.parse(row.binding);
    const attempts = db.select().from(schema.categoryRemovalAttempts).where(eq(schema.categoryRemovalAttempts.removalId, row.operationId)).orderBy(desc(schema.categoryRemovalAttempts.sequence)).all();
    const latest = new Map<string, typeof schema.categoryRemovalAttempts.$inferSelect>();
    for (const a of attempts) if (!latest.has(a.projectId)) latest.set(a.projectId, a);
    const ids = [...latest.values()].map(a => a.moveId);
    const childMoves = new Map((ids.length ? db.select().from(schema.projectCategoryMoveOperations).where(inArray(schema.projectCategoryMoveOperations.operationId, ids)).all() : []).map(m => [m.operationId, m]));
    return { operationId: row.operationId, sourceId: row.sourceId, categoryId: row.categoryId, destinationCategoryId: row.destinationCategoryId,
      originalRelativePath: row.originalRelativePath, destinationRelativePath: row.requestedRelativePath, stage: row.stage, problem: row.problem, completedRevision: row.completedRevision,
      projects: b.members.map(p => {
        const attempt = latest.get(p.id), move = attempt && childMoves.get(attempt.moveId);
        return { projectId: p.id, originalRelativePath: p.relativePath, requestedRelativePath: `${b.destination!.relativePath}/${p.relativePath.split("/").at(-1)}`,
          outcome: !move ? attempt?.problem ? "rejected" : "pending" : move.stage === "completed" ? "completed" : move.stage === "failed" ? "rejected" : "recoverable", problem: move?.problem ?? attempt?.problem ?? null };
      }) };
  }
  const result = (row: Operation): ServiceResult<CategoryRemovalResult> => ({ ok: true, value: { operation: operationView(row) } });
  function notify(row: Operation, revision: number) {
    committed(row.sourceId, revision, db.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId, row.sourceId)).all().map(w => w.id));
  }

  const invalid = (): ServiceResult<never> => ({ ok: false, error: { code: "invalid_input", message: "Choose a current category and an eligible destination in this source." } });
  function previewCategoryRemoval(input: unknown): ServiceResult<CategoryRemovalPreview> {
    if (!isCategoryRemovalRequest(input) || input.type !== "workspace.previewCategoryRemoval") return invalid();
    reviews.delete(input.workspaceId);
    try {
      const source = sourceFor(input.workspaceId);
      if (!source || source.discoveryMode !== "grouped" || !source.appliedRootIdentity || readProjectReservations(db, source.id).length) return invalid();
      const exclusions: unknown = JSON.parse(source.excludedRelativePaths);
      if (!validExclusions(exclusions, "grouped") || !validArchive(source.archiveRelativePath)) return invalid();
      if(authorizer)authorizer.capture(source,"",source.durableEvidence);
      else verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity));
      const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).all();
      const category = categories.find(c => c.id === input.categoryId);
      const destination = categories.find(c => c.id === input.destinationCategoryId);
      if (!category || input.destinationCategoryId !== null && !destination || category.id === destination?.id) return invalid();
      for (const c of [category, ...(destination ? [destination] : [])]) {
        if (c.modeInactive || c.associationState !== "active" || !isChildName(c.relativePath) || !validProjectBasename(c.relativePath, filesystem.platform) ||
          c.relativePath.includes("\\") || c.relativePath.startsWith(".") || ["$RECYCLE.BIN", "SYSTEM VOLUME INFORMATION"].includes(filesystemAlias(c.relativePath)) ||
          exclusions.some(p => filesystemAlias(c.id === category.id ? p.split("/")[0] : p) === filesystemAlias(c.relativePath)) ||
          source.archiveRelativePath && filesystemAlias(c.id === category.id ? source.archiveRelativePath.split("/")[0] : source.archiveRelativePath) === filesystemAlias(c.relativePath)) return invalid();
        if (filesystem.names(source.canonicalRoot).filter(n => filesystemAlias(n) === filesystemAlias(c.relativePath)).join() !== c.relativePath) return invalid();
        if(authorizer)authorizer.capture(source,c.relativePath,c.durableEvidence);
        else verifyCreationDirectory(filesystem,join(source.canonicalRoot,c.relativePath),JSON.parse(c.nativeIdentity));
        filesystem.assertAccessible?.(join(source.canonicalRoot, c.relativePath));
      }
      const provisional: Binding={source,category,destination:destination??null,members:[]};
      provisional.authorization=capture(provisional);
      const initialTopology = topology(provisional);
      const sourceProjects = db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all();
      const occupiedPaths = new Set(sourceProjects.map(p => filesystemAlias(p.relativePath)));
      const members = sourceProjects.filter(p => p.categoryId === category.id).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      if (members.length && !destination) return invalid();
      const blockers: CategoryRemovalPreview["blockers"] = [];
      const names = filesystem.names(join(source.canonicalRoot, category.relativePath));
      for (const name of names) if (!members.some(p => p.relativePath === `${category.relativePath}/${name}`)) blockers.push({ relativePath: `${category.relativePath}/${name}`, problem: "unexpected_entry" });
      const projects = members.map(p => ({ projectId: p.id, originalRelativePath: p.relativePath,
        requestedRelativePath: `${destination!.relativePath}/${p.relativePath.split("/").at(-1)}` }));
      const destinationNames = new Set((destination ? filesystem.names(join(source.canonicalRoot, destination.relativePath)) : []).map(filesystemAlias));
      const plannedCounts = new Map<string, number>();
      for (const p of projects) { const key = filesystemAlias(p.requestedRelativePath); plannedCounts.set(key, (plannedCounts.get(key) ?? 0) + 1); }
      for (const [index, p] of members.entries()) {
        const parts = p.relativePath.split("/"), name = parts[1];
        try {
          if (p.sourceId !== source.id || p.modeInactive || p.associationState !== "active" || parts.length !== 2 ||
            parts[0] !== category.relativePath || !names.includes(name)) throw new Error("Unavailable project");
          if(authorizer)authorizer.observe(join(source.canonicalRoot,p.relativePath),provisional.authorization!.root.root,filesystem.inspect(join(source.canonicalRoot,p.relativePath)).identity,JSON.parse(p.durableEvidence!));
          else verifyCreationDirectory(filesystem, join(source.canonicalRoot, p.relativePath), JSON.parse(p.nativeIdentity));
        } catch { blockers.push({ relativePath: p.relativePath, problem: "project_unavailable" }); }
        const requested = projects[index].requestedRelativePath;
        if (destinationNames.has(filesystemAlias(name)) || occupiedPaths.has(filesystemAlias(requested)) || plannedCounts.get(filesystemAlias(requested))! > 1) {
          blockers.push({ relativePath: requested, problem: "occupied" });
        }
        if (exclusions.some(p => filesystemAlias(p) === filesystemAlias(requested))) blockers.push({ relativePath: requested, problem: "excluded" });
        if (source.archiveRelativePath && filesystemAlias(source.archiveRelativePath.split("/").slice(0, 2).join("/")) === filesystemAlias(requested)) blockers.push({ relativePath: requested, problem: "archive" });
      }
      if(authorizer)authorizer.capture(source,"",source.durableEvidence);
      else verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity));
      const preview: CategoryRemovalPreview = { workspaceId: input.workspaceId, sourceId: source.id, categoryId: category.id,
        destinationCategoryId: destination?.id ?? null, originalRelativePath: category.relativePath, destinationRelativePath: destination?.relativePath ?? null,
        revision: source.discoveryRevision, projects, blockers, previewToken: randomUUID() };
      const binding: Binding = { source, category, destination: destination ?? null, members };
      binding.authorization=capture(binding);
      if (!same(initialTopology, topology(binding)) || !same(policy(sourceFor(input.workspaceId)!), policy(source))) return stale();
      const reviewFingerprint = fingerprint(binding, input.workspaceId);
      reviews.set(input.workspaceId, { preview, binding, fingerprint: reviewFingerprint });
      return { ok: true, value: preview };
    } catch { return { ok: false, error: { code: "filesystem", message: "Category folders could not be verified. Refresh and review their current state." } }; }
  }
  function inspectBatch(row: Operation, workspaceId: string, reviewed?:Binding, abandoning=false) {
    const b: Binding = reviewed??JSON.parse(row.binding), source = sourceFor(workspaceId), view = operationView(row);
    if (!source || source.id !== row.sourceId || source.canonicalRoot !== b.source.canonicalRoot || source.discoveryMode !== "grouped" ||
      source.appliedRootIdentity !== b.source.appliedRootIdentity || source.excludedRelativePaths !== b.source.excludedRelativePaths || source.archiveRelativePath !== b.source.archiveRelativePath ||
      !same(policy(source),policy({...b.source,discoveryRevision:b.source.discoveryRevision+view.projects.filter(p=>p.outcome==="completed").length}))) throw new RemovalFailure("stale_configuration");
    for (const c of [b.category, ...(b.destination ? [b.destination] : [])]) {
      const actual=db.select().from(schema.categories).where(eq(schema.categories.id,c.id)).get();
      if(!actual || !same(b.legacyReview && actual.durableEvidence===null ? {...actual,durableEvidence:c.durableEvidence} : actual,c))throw new RemovalFailure("category_unavailable");
    }
    const attempts = db.select().from(schema.categoryRemovalAttempts).where(eq(schema.categoryRemovalAttempts.removalId, row.operationId)).all();
    if (readProjectReservations(db, row.sourceId).some(r => !(r.operationKind === "category_removal" && r.operationId === row.operationId) &&
      !(r.operationKind === "category_move" && attempts.some(a => a.moveId === r.operationId)))) throw new RemovalFailure("reserved_destination");
    verifyDirectory(b, "", source.appliedRootIdentity!);
    const rootNames = filesystem.names(source.canonicalRoot);
    const originalPath = join(source.canonicalRoot, b.category.relativePath);
    const originalMissing = !rootNames.some(n => filesystemAlias(n) === filesystemAlias(b.category.relativePath));
    if (originalMissing && row.stage !== "cleanup_intent") throw new RemovalFailure("category_unavailable");
    verifyInventory(b,originalMissing);
    for (const c of [...(originalMissing ? [] : [b.category]), ...(b.destination ? [b.destination] : [])]) {
      if (rootNames.filter(n => filesystemAlias(n) === filesystemAlias(c.relativePath)).join() !== c.relativePath) throw new RemovalFailure("filesystem_changed");
      verifyDirectory(b,c.relativePath,c.nativeIdentity);
      filesystem.assertAccessible?.(join(source.canonicalRoot, c.relativePath));
    }
    const records = db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all();
    if (records.some(p => p.categoryId === b.category.id && !b.members.some(m => m.id === p.id))) throw new RemovalFailure("unexpected_entry");
    const allowedNames = new Set(view.projects.filter(p => p.outcome !== "completed").map(p => p.originalRelativePath.split("/").at(-1)!));
    if (!abandoning && !originalMissing && filesystem.names(originalPath).some(name => !allowedNames.has(name))) throw new RemovalFailure("unexpected_entry");
    for (const [i, p] of b.members.entries()) {
      const outcome = view.projects[i], record = records.find(r => r.id === p.id), completed = outcome.outcome === "completed";
      if (!record || record.nativeIdentity !== p.nativeIdentity || record.modeInactive || record.associationState !== "active" ||
        record.durableEvidence!==null && (!p.durableEvidence || !sameDurableFolder(JSON.parse(record.durableEvidence),JSON.parse(p.durableEvidence))) ||
        record.relativePath !== (completed ? outcome.requestedRelativePath : p.relativePath) || record.categoryId !== (completed ? b.destination!.id : b.category.id)) throw new RemovalFailure("project_unavailable");
      if (outcome.outcome === "recoverable") {
        const attempt = lastAttempt(row.operationId, p.id)!;
        const recovery = moves.previewProjectCategoryMoveRecovery({ type: "workspace.previewProjectCategoryMoveRecovery", workspaceId, operationId: attempt.moveId });
        if (!recovery.ok || !recovery.value.actions.some(a => a === "retry_original" || a === "complete_destination")) throw new RemovalFailure("ownership_uncertain");
      } else {
        const path = completed ? outcome.requestedRelativePath : p.relativePath;
        verifyDirectory(b,path,p.nativeIdentity);
        filesystem.assertAccessible?.(join(source.canonicalRoot, path));
        if (!abandoning && !completed) assertCreationDestinationFree(filesystem, join(source.canonicalRoot, b.destination!.relativePath), p.relativePath.split("/").at(-1)!);
        else if (!abandoning && !originalMissing) assertCreationDestinationFree(filesystem, originalPath, p.relativePath.split("/").at(-1)!);
      }
    }
    verifyDirectory(b, "", source.appliedRootIdentity!);
    if (row.stage === "cleanup_intent" && view.projects.some(p => p.outcome !== "completed")) throw new RemovalFailure("ownership_uncertain");
    return { binding: b, source, originalMissing, view, records };
  }
  function execute(row: Operation, workspaceId: string, reviewed?:Binding): ServiceResult<CategoryRemovalResult> {
    try {
      let inspected = inspectBatch(row, workspaceId,reviewed);
      if (row.stage === "moving") {
        for (const p of inspected.binding.members) {
          // Recheck the whole reviewed membership between individual effects.
          inspected = inspectBatch(row, workspaceId,reviewed);
          const outcome = inspected.view.projects.find(m => m.projectId === p.id)!;
          if (outcome.outcome === "completed") continue;
          let attempt = lastAttempt(row.operationId, p.id);
          if (outcome.outcome === "recoverable") {
            const recovery = moves.previewProjectCategoryMoveRecovery({ type: "workspace.previewProjectCategoryMoveRecovery", workspaceId, operationId: attempt!.moveId });
            if (!recovery.ok || !recovery.value.previewToken) throw new RemovalFailure("ownership_uncertain");
            const action = recovery.value.actions.includes("complete_destination") ? "complete_destination" : "retry_original";
            const recovered = moves.recoverProjectCategoryMove({ type: "workspace.recoverProjectCategoryMove", workspaceId, operationId: attempt!.moveId, previewToken: recovery.value.previewToken, action });
            if (!recovered.ok || recovered.value.outcome !== "completed") throw new RemovalFailure(recovered.ok ? "problem" in recovered.value ? recovered.value.problem : recovered.value.operation.problem ?? "filesystem_error" : recovered.error.code);
          } else {
            // A rejected child receipt is immutable. An explicit retry gets a
            // new durable attempt; successful attempts are never resubmitted.
            const next = { moveId: randomUUID(), removalId: row.operationId, projectId: p.id, workspaceId,
              sequence: (attempt?.sequence ?? -1) + 1, expectedRevision: inspected.source.discoveryRevision, problem: null };
            db.transaction(tx => { inspectBatch(row, workspaceId,reviewed); tx.insert(schema.categoryRemovalAttempts).values(next).run(); }, { behavior: "immediate" });
            attempt = next;
            const moved = moves.moveProjectCategory({ type: "workspace.moveProjectCategory", workspaceId, projectId: p.id, operationId: attempt.moveId,
              destinationCategoryId: row.destinationCategoryId!, expectedRevision: attempt.expectedRevision });
            if (!moved.ok || moved.value.outcome === "rejected" && !moved.value.operation) {
              db.update(schema.categoryRemovalAttempts).set({ problem: moved.ok ? moved.value.outcome === "rejected" ? moved.value.problem : "filesystem_error" : moved.error.code }).where(eq(schema.categoryRemovalAttempts.moveId, attempt.moveId)).run();
            }
            if (!moved.ok || moved.value.outcome !== "completed") throw new RemovalFailure(moved.ok ? "problem" in moved.value ? moved.value.problem : moved.value.operation.problem ?? "filesystem_error" : moved.error.code);
          }
        }
        db.transaction(tx => {
          const current = inspectBatch(row, workspaceId,reviewed);
          if (current.view.projects.some(p => p.outcome !== "completed") || filesystem.names(join(current.source.canonicalRoot, row.originalRelativePath)).length) throw new RemovalFailure("unexpected_entry");
          tx.update(schema.categoryRemovalOperations).set({ stage: "cleanup_intent", problem: null }).where(eq(schema.categoryRemovalOperations.operationId, row.operationId)).run();
        }, { behavior: "immediate" });
        row = operationFor(row.operationId)!;
      }
      inspected = inspectBatch(row, workspaceId,reviewed);
      if (!inspected.originalMissing) {
        if (filesystem.names(join(inspected.source.canonicalRoot, row.originalRelativePath)).length) throw new RemovalFailure("unexpected_entry");
        if (!filesystem.removeEmptyDirectory) throw new RemovalFailure("unsupported");
        // Deliberately nonrecursive: a late arrival makes the OS reject cleanup.
        verifyDirectory(inspected.binding,"",inspected.source.appliedRootIdentity!);
        verifyDirectory(inspected.binding,row.originalRelativePath,row.nativeIdentity);
        filesystem.removeEmptyDirectory(join(inspected.source.canonicalRoot, row.originalRelativePath));
      }
      const revision = inspected.source.discoveryRevision + 1;
      if (!Number.isSafeInteger(revision)) throw new RemovalFailure("stale_configuration");
      db.transaction(tx => {
        const current = inspectBatch(row, workspaceId,reviewed);
        if (!current.originalMissing) throw new RemovalFailure("filesystem_changed");
        tx.update(schema.categories).set({ associationState: "missing" }).where(eq(schema.categories.id, row.categoryId)).run();
        tx.update(schema.sources).set({ discoveryRevision: revision }).where(eq(schema.sources.id, row.sourceId)).run();
        tx.update(schema.categoryRemovalOperations).set({ stage: "completed", problem: null, completedRevision: revision }).where(eq(schema.categoryRemovalOperations.operationId, row.operationId)).run();
        verifyDirectory(current.binding,"",current.source.appliedRootIdentity!);
        assertCreationDestinationFree(filesystem, current.source.canonicalRoot, row.originalRelativePath);
        verifyInventory(current.binding,true);
        if(current.binding.destination)verifyDirectory(current.binding,current.binding.destination.relativePath,current.binding.destination.nativeIdentity);
        for(const member of current.binding.members)verifyDirectory(current.binding,`${current.binding.destination!.relativePath}/${member.relativePath.split("/").at(-1)}`,member.nativeIdentity);
        verifyDirectory(current.binding,"",current.source.appliedRootIdentity!);
        assertCreationDestinationFree(filesystem,current.source.canonicalRoot,row.originalRelativePath);
        if (!same(policy(sourceFor(workspaceId)!), policy({ ...current.source, discoveryRevision: revision })) ||
          !same(db.select().from(schema.categories).where(eq(schema.categories.id, row.categoryId)).get(), { ...current.binding.category, associationState: "missing" }) ||
          !same(db.select().from(schema.projects).where(eq(schema.projects.sourceId, row.sourceId)).all(), current.records)) throw new RemovalFailure("storage_error");
      }, { behavior: "immediate" });
      row = operationFor(row.operationId)!;
      notify(row, revision);
      return result(row);
    } catch (error) {
      try {
        const persisted = operationFor(row.operationId)!;
        if (persisted.stage === "completed" || persisted.stage === "abandoned") return result(persisted);
        db.update(schema.categoryRemovalOperations).set({ problem: error instanceof RemovalFailure ? error.problem : filesystemCode(error) === "ENOTEMPTY" || filesystemCode(error) === "EEXIST" ? "unexpected_entry" : filesystemProblem(error) })
          .where(eq(schema.categoryRemovalOperations.operationId, row.operationId)).run();
        const saved = operationFor(row.operationId)!;
        const source = db.select().from(schema.sources).where(eq(schema.sources.id, row.sourceId)).get();
        if (source) notify(saved, source.discoveryRevision);
        return result(saved);
      } catch { return result(row); }
    }
  }
  function applyCategoryRemoval(input: unknown): ServiceResult<CategoryRemovalResult> {
    if (!isCategoryRemovalRequest(input) || input.type !== "workspace.applyCategoryRemoval") return invalid();
    try {
      const source = sourceFor(input.workspaceId), prior = operationFor(input.operationId);
      if (!source) return invalid();
      if (prior) return prior.sourceId === source.id && prior.workspaceId === input.workspaceId && prior.previewToken === input.previewToken ? result(prior) : invalid();
      const review = reviews.get(input.workspaceId);
      if (!review || review.preview.previewToken !== input.previewToken) return stale();
      reviews.delete(input.workspaceId);
      if (review.preview.blockers.length ||
        fingerprint(review.binding, input.workspaceId) !== review.fingerprint) return stale();
      const row: Operation = { operationId: input.operationId, workspaceId: input.workspaceId, sourceId: source.id,
        categoryId: review.binding.category.id, destinationCategoryId: review.binding.destination?.id ?? null,
        originalRelativePath: review.binding.category.relativePath, requestedRelativePath: review.binding.destination?.relativePath ?? null,
        nativeIdentity: review.binding.category.nativeIdentity, previewToken: input.previewToken, binding: JSON.stringify(review.binding),
        stage: "moving", problem: null, completedRevision: null };
      db.transaction(tx => {
        if (fingerprint(review.binding, input.workspaceId) !== review.fingerprint) throw new RemovalFailure("stale_preview");
        tx.insert(schema.categoryRemovalOperations).values(row).run();
      }, { behavior: "immediate" });
      reviews.delete(input.workspaceId);
      notify(row, source.discoveryRevision);
      return execute(row, input.workspaceId);
    } catch { return storage(); }
  }
  function getCategoryRemoval(input: unknown): ServiceResult<CategoryRemovalLookup> {
    if (!isCategoryRemovalRequest(input) || input.type !== "workspace.getCategoryRemoval") return invalid();
    try {
      const source = sourceFor(input.workspaceId), row = operationFor(input.operationId);
      if (!source || row && row.sourceId !== source.id) return invalid();
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, operation: row ? operationView(row) : null } };
    } catch { return storage(); }
  }
  function listCategoryRemovals(input: unknown): ServiceResult<CategoryRemovalList> {
    if (!isCategoryRemovalRequest(input) || input.type !== "workspace.listCategoryRemovals") return invalid();
    try {
      const source = sourceFor(input.workspaceId); if (!source) return invalid();
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, operations: db.select().from(schema.categoryRemovalOperations).where(eq(schema.categoryRemovalOperations.sourceId, source.id))
        .orderBy(asc(schema.categoryRemovalOperations.operationId)).all().filter(r => r.stage === "moving" || r.stage === "cleanup_intent").map(operationView) } };
    } catch { return storage(); }
  }
  function legacyReviewedBinding(row:Operation,workspaceId:string):Binding {
    const old:Binding=JSON.parse(row.binding),source=sourceFor(workspaceId);
    if(!source || !validLegacyRemovalHistory(old,source.evidenceGeneration) || !removalBindingMatchesRow(old,row) || old.source.durableEvidence!=null || old.category.durableEvidence!=null || old.destination?.durableEvidence!=null || old.members.some(p=>p.durableEvidence!=null) ||
      source.id!==old.source.id || source.canonicalRoot!==old.source.canonicalRoot || source.discoveryMode!=="grouped" || source.excludedRelativePaths!==old.source.excludedRelativePaths ||
      source.archiveRelativePath!==old.source.archiveRelativePath || source.discoveryRevision<old.source.discoveryRevision+operationView(row).projects.filter(p=>p.outcome==="completed").length)throw new RemovalFailure("ownership_uncertain");
    const root=authorizer!.capture(source,"",source.durableEvidence);
    if(!sameIdentity(root.root.mount,JSON.parse(old.source.appliedRootIdentity!)))throw new RemovalFailure("ownership_uncertain");
    const observe=(path:string,native:string)=>{
      verifyCreationDirectory(filesystem,join(source.canonicalRoot,path),JSON.parse(native));
      return authorizer!.observe(join(source.canonicalRoot,path),root.root,JSON.parse(native));
    };
    // Legacy cleanup with an absent folder cannot prove its recorded tuple.
    const category=observe(old.category.relativePath,old.category.nativeIdentity),destination=old.destination?observe(old.destination.relativePath,old.destination.nativeIdentity):null;
    const projects=old.members.map(member=>{
      const matches:VerifiedFolder[]=[];
      for(const path of [member.relativePath,`${old.destination!.relativePath}/${member.relativePath.split("/").at(-1)}`])try{matches.push(observe(path,member.nativeIdentity));}catch(error){if(filesystemCode(error)!=="ENOENT")throw error;}
      if(matches.length!==1)throw new RemovalFailure("ownership_uncertain");
      return {id:member.id,observation:matches[0]};
    });
    const binding:Binding={...old,legacyReview:true,source:{...source,discoveryRevision:source.discoveryRevision-operationView(row).projects.filter(p=>p.outcome==="completed").length},
      category:{...old.category,durableEvidence:JSON.stringify(category.evidence)},destination:old.destination?{...old.destination,durableEvidence:JSON.stringify(destination!.evidence)}:null,
      members:old.members.map(p=>({...p,durableEvidence:JSON.stringify(projects.find(q=>q.id===p.id)!.observation.evidence)})),
      authorization:{version:1,root,category,destination,projects}};
    authority(binding);verifyPeerRoots(binding);return binding;
  }
  function renewedBinding(row:Operation,workspaceId:string):Binding {
    const original:Binding=JSON.parse(row.binding);
    if(!removalBindingMatchesRow(original,row))throw new RemovalFailure("ownership_uncertain");
    if(!Object.hasOwn(original,"authorization"))return legacyReviewedBinding(row,workspaceId);
    const saved=authority(original),source=sourceFor(workspaceId),view=operationView(row);
    if(!saved || !source || source.id!==original.source.id || source.canonicalRoot!==original.source.canonicalRoot || source.discoveryMode!=="grouped" ||
      source.excludedRelativePaths!==original.source.excludedRelativePaths || source.archiveRelativePath!==original.source.archiveRelativePath ||
      source.discoveryRevision<original.source.discoveryRevision+view.projects.filter(p=>p.outcome==="completed").length || source.evidenceGeneration<saved.root.generation)throw new RemovalFailure("stale_configuration");
    const root=authorizer!.capture(source,"",source.durableEvidence);
    if(!sameDurableFolder(root.root.evidence,saved.root.root.evidence))throw new RemovalFailure("ownership_uncertain");
    const observe=(path:string,expected:VerifiedFolder)=>authorizer!.observe(join(source.canonicalRoot,path),root.root,filesystem.inspect(join(source.canonicalRoot,path)).identity,expected.evidence);
    let category:VerifiedFolder;
    try{category=observe(original.category.relativePath,saved.category);}catch(error){
      if(row.stage!=="cleanup_intent" || filesystemCode(error)!=="ENOENT")throw error;
      category=saved.category;
    }
    const destination=original.destination?observe(original.destination.relativePath,saved.destination!):null;
    const projects=saved.projects.map(p=>{
      const member=original.members.find(m=>m.id===p.id)!,paths=[member.relativePath,`${original.destination!.relativePath}/${member.relativePath.split("/").at(-1)}`],matches:VerifiedFolder[]=[];
      for(const path of paths)try{matches.push(observe(path,p.observation));}catch(error){if(filesystemCode(error)!=="ENOENT")throw error;}
      if(matches.length!==1)throw new RemovalFailure("ownership_uncertain");
      return {id:p.id,observation:matches[0]};
    });
    const binding:Binding={...original,source:{...source,discoveryRevision:source.discoveryRevision-view.projects.filter(p=>p.outcome==="completed").length},authorization:{version:1,root,category,destination,projects}};
    authority(binding);verifyPeerRoots(binding);
    return binding;
  }
  function durableRecoveryPreview(row:Operation,workspaceId:string):ServiceResult<CategoryRemovalRecoveryPreview> {
    const operation=operationView(row),actions:("retry_remaining"|"abandon")[]=[];
    let previewToken:string|null=null;
    try {
      const binding=renewedBinding(row,workspaceId),before=fingerprint(binding,workspaceId,row);
      try{inspectBatch(row,workspaceId,binding);actions.push("retry_remaining");}catch{/* A blocked retry cannot authorize another effect. */}
      if(operation.projects.every(p=>p.outcome!=="recoverable"))try{
        const inspected=inspectBatch(row,workspaceId,binding,true);
        if(!inspected.originalMissing)actions.push("abandon");
      }catch{/* Abandonment still proves every original affected object. */}
      if(!actions.length)return {ok:true,value:{workspaceId,sourceId:row.sourceId,operation,actions,previewToken:null}};
      if(before!==fingerprint(binding,workspaceId,row))return stale();
      previewToken=randomUUID();
      recoveryReviews.set(`${workspaceId}:${row.operationId}`,{sourceId:row.sourceId,token:previewToken,fingerprint:before,actions,binding});
    }catch{actions.length=0;previewToken=null;/* Unprovable journals retain status and all reservations without a permit. */}
    return {ok:true,value:{workspaceId,sourceId:row.sourceId,operation,actions,previewToken}};
  }
  function durableRecovery(row:Operation,workspaceId:string,review:NonNullable<ReturnType<typeof recoveryReviews.get>>,action:"retry_remaining"|"abandon"):ServiceResult<CategoryRemovalResult> {
    const binding=review.binding!;
    let current:Binding;
    try{current=renewedBinding(row,workspaceId);}catch{return stale();}
    if(!same({...current,source:policy(current.source)},{...binding,source:policy(binding.source)}) || fingerprint(binding,workspaceId,row)!==review.fingerprint)return stale();
    db.transaction(tx=>{
      inspectBatch(row,workspaceId,binding,action==="abandon");
      if(fingerprint(binding,workspaceId,row)!==review.fingerprint)throw new RemovalFailure("stale_preview");
      const previous=tx.select().from(schema.categoryRemovalAttestations).where(eq(schema.categoryRemovalAttestations.operationId,row.operationId)).all();
      tx.insert(schema.categoryRemovalAttestations).values({id:randomUUID(),operationId:row.operationId,sequence:Math.max(-1,...previous.map(p=>p.sequence))+1,
        journal:JSON.stringify(row),binding:JSON.stringify(binding)}).run();
      if(binding.legacyReview) {
        for(const category of [binding.category,...(binding.destination?[binding.destination]:[])])tx.update(schema.categories).set({durableEvidence:category.durableEvidence}).where(eq(schema.categories.id,category.id)).run();
        for(const project of binding.members)tx.update(schema.projects).set({durableEvidence:project.durableEvidence}).where(eq(schema.projects.id,project.id)).run();
      }
      inspectBatch(row,workspaceId,binding,action==="abandon");
      if(action==="abandon") {
        if(operationView(row).projects.some(p=>p.outcome==="recoverable"))throw new RemovalFailure("ownership_uncertain");
        tx.update(schema.categoryRemovalOperations).set({stage:"abandoned",problem:"abandoned"}).where(eq(schema.categoryRemovalOperations.operationId,row.operationId)).run();
        inspectBatch(row,workspaceId,binding,action==="abandon");
      }
    },{behavior:"immediate"});
    if(action==="abandon") {notify(row,sourceFor(workspaceId)!.discoveryRevision);return result(operationFor(row.operationId)!);}
    return execute(row,workspaceId,binding);
  }
  function previewCategoryRemovalRecovery(input: unknown): ServiceResult<CategoryRemovalRecoveryPreview> {
    if (!isCategoryRemovalRequest(input) || input.type !== "workspace.previewCategoryRemovalRecovery") return invalid();
    const key = `${input.workspaceId}:${input.operationId}`; recoveryReviews.delete(key);
    try {
      const source = sourceFor(input.workspaceId), row = operationFor(input.operationId);
      if (!source || !row || row.sourceId !== source.id || row.stage === "completed" || row.stage === "abandoned") return invalid();
      if(authorizer)return durableRecoveryPreview(row,input.workspaceId);
      const b: Binding = JSON.parse(row.binding), operation = operationView(row), actions: ("retry_remaining" | "abandon")[] = [];
      const before = fingerprint(b, input.workspaceId, row);
      try { inspectBatch(row, input.workspaceId); actions.push("retry_remaining"); } catch { /* Unsafe placements expose status without mutation. */ }
      let canAbandon = row.stage === "moving";
      if (row.stage === "cleanup_intent") try {
        verifyCreationDirectory(filesystem, b.source.canonicalRoot, JSON.parse(b.source.appliedRootIdentity!));
        verifyCreationDirectory(filesystem, join(b.source.canonicalRoot, b.category.relativePath), JSON.parse(b.category.nativeIdentity));
        canAbandon = true;
      } catch { /* A missing cleanup folder must complete its metadata instead. */ }
      if (canAbandon && operation.projects.every(p => p.outcome !== "recoverable")) actions.push("abandon");
      if (before !== fingerprint(b, input.workspaceId, row)) return stale();
      const previewToken = actions.length ? randomUUID() : null;
      if (previewToken) recoveryReviews.set(key, { sourceId: source.id, token: previewToken, fingerprint: before, actions });
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, operation, actions, previewToken } };
    } catch { return storage(); }
  }
  function recoverCategoryRemoval(input: unknown): ServiceResult<CategoryRemovalResult> {
    if (!isCategoryRemovalRequest(input) || input.type !== "workspace.recoverCategoryRemoval") return invalid();
    const key = `${input.workspaceId}:${input.operationId}`, review = recoveryReviews.get(key);
    if (!review || review.token !== input.previewToken || !review.actions.includes(input.action)) return stale();
    recoveryReviews.delete(key);
    try {
      const row = operationFor(input.operationId); if (!row) return invalid();
      if(authorizer) {if(!review.binding || sourceFor(input.workspaceId)?.id!==row.sourceId)return stale();return durableRecovery(row,input.workspaceId,review,input.action);}
      const b: Binding = JSON.parse(row.binding);
      if (fingerprint(b, input.workspaceId, row) !== review.fingerprint) return stale();
      if (input.action === "abandon") {
        db.transaction(tx => {
          if (fingerprint(b, input.workspaceId, row) !== review.fingerprint || operationView(row).projects.some(p => p.outcome === "recoverable")) throw new RemovalFailure("stale_preview");
          tx.update(schema.categoryRemovalOperations).set({ stage: "abandoned", problem: "abandoned" }).where(eq(schema.categoryRemovalOperations.operationId, row.operationId)).run();
        }, { behavior: "immediate" });
        notify(row, sourceFor(input.workspaceId)!.discoveryRevision);
        return result(operationFor(row.operationId)!);
      }
      return execute(row, input.workspaceId);
    } catch { return storage(); }
  }
  return { previewCategoryRemoval, applyCategoryRemoval, getCategoryRemoval, listCategoryRemovals, previewCategoryRemovalRecovery, recoverCategoryRemoval,
    invalidateSource(sourceId: string) {
      for (const [key, r] of reviews) if (r.preview.sourceId === sourceId) reviews.delete(key);
      // Child completion invalidates public previews, but the accepted synchronous
      // batch keeps its own immutable binding and rechecks before every effect.
      for (const [key, r] of recoveryReviews) if (r.sourceId === sourceId) recoveryReviews.delete(key);
    }, close() { reviews.clear(); recoveryReviews.clear(); } };

}
