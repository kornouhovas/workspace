import {durableOwnershipKey, sameDurableFolder} from "./folder-evidence.js";
import {sameLegacyNativeIdentity,parseFilesystemAuthorization, parseFolderObservation, type FilesystemAuthorizer, type FilesystemAuthorization, type VerifiedFolder} from "./filesystem-authorization.js";
import { hasUnfinishedProjectRelocation, readProjectReservations } from "./project-rename-reservations.js";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isProjectCreationRequest, type ProjectCreationOperation, type ProjectCreationProblem, type ProjectCreationResult,
  type WorkspaceCreateProjectCommand, type ProjectCreationList, type ProjectCreationRecoveryPreview } from "../contracts/project-creation.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isChildName, reliableIdentity, sameIdentity, validArchive, validExclusions, type NativeIdentity } from "./discovery.js";
import { assertCreationDestinationFree, CreationFailure, filesystemCode, filesystemProblem,
  nativeProjectFilesystem, validProjectBasename, verifyCreationDirectory, verifyCreationParents, type ProjectFilesystem } from "./project-filesystem.js";
import * as schema from "./db/schema.js";
import { filesystemAlias } from "./path-alias.js";

type Database = BetterSQLite3Database<typeof schema>;
type Source = typeof schema.sources.$inferSelect;
type Operation = typeof schema.projectCreationOperations.$inferSelect;

function operationView(row: Operation): ProjectCreationOperation {
  return { operationId: row.operationId, sourceId: row.sourceId, initiatingWorkspaceId: row.initiatingWorkspaceId,
    projectId: row.projectId, name: row.name, relativePath: row.relativePath, mode: row.mode, categoryId: row.categoryId,
    expectedRevision: row.expectedRevision, stage: row.stage, evidenceRecorded: row.nativeIdentity !== null,
    problem: row.problem, completedRevision: row.completedRevision };
}

function recordedResult(row: Operation): ProjectCreationResult {
  const operation = operationView(row);
  if (row.stage === "completed") return { outcome: "completed", operation, project: {
    operationId: row.operationId, sourceId: row.sourceId, projectId: row.projectId, name: row.name,
    relativePath: row.relativePath, categoryId: row.categoryId, revision: row.completedRevision!,
  } };
  if (row.stage === "failed") return { outcome: "rejected", problem: row.problem!, operation };
  return { outcome: "recoverable", operation };
}

export function createProjectCreationService(db: Database, integration: {
  invalidateSourceReviews(sourceId: string): void;
  committed(sourceId: string, revision: number, workspaceIds: string[]): void;
}, filesystem: ProjectFilesystem = nativeProjectFilesystem, authorizer?: FilesystemAuthorizer) {
  const reviews = new Map<string, { row: Operation; revision: number; preview: ProjectCreationRecoveryPreview; evidence: NativeIdentity | null; binding?: FilesystemAuthorization; destination?: VerifiedFolder; reservations: ReturnType<typeof readProjectReservations> }>();
  const reviewKey = (workspaceId: string, operationId: string) => `${workspaceId}:${operationId}`;
  const invalid = () => ({ ok: false as const, error: { code: "invalid_input" as const, message: "Choose a saved workspace and its creation operation." } });
  const storage = () => ({ ok: false as const, error: { code: "storage" as const, message: "Creation history could not be read." } });
  function invalidateSource(sourceId: string) {
    for (const [key, review] of reviews) if (review.row.sourceId === sourceId) reviews.delete(key);
  }
  const operationFor = (id: string) => db.select().from(schema.projectCreationOperations)
    .where(eq(schema.projectCreationOperations.operationId, id)).get();
  const sourceFor = (workspaceId: string) => db.select().from(schema.workspaces)
    .innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
    .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  const rejected = (problem: ProjectCreationProblem): ServiceResult<ProjectCreationResult> =>
    ({ ok: true, value: { outcome: "rejected", problem, operation: null } });

  function policy(source: Source, parentRelativePath: string, relativePath: string) {
    const exclusions: unknown = JSON.parse(source.excludedRelativePaths);
    if (!validExclusions(exclusions, "grouped", !!source.folderRoles) || !validArchive(source.archiveRelativePath)) throw new Error("Invalid source configuration");
    const parts = relativePath.split("/");
    if (parts.some((name) => name.startsWith(".") || ["$RECYCLE.BIN", "SYSTEM VOLUME INFORMATION"].includes(filesystemAlias(name))) ||
      exclusions.some((path) => filesystemAlias(path) === filesystemAlias(relativePath) ||
        parentRelativePath && filesystemAlias(path) === filesystemAlias(parentRelativePath))) throw new CreationFailure("excluded");
    // Discovery suppresses the containing project, or an archive category.
    const archive = source.archiveRelativePath?.split("/");
    if (archive && (source.discoveryMode === "direct" ? filesystemAlias(parts[0]) === filesystemAlias(archive[0])
      : filesystemAlias(parts[0]) === filesystemAlias(archive[0]) && (archive.length === 1 || filesystemAlias(parts[1]) === filesystemAlias(archive[1])))) {
      throw new CreationFailure("archive");
    }
  }

  function assertReservations(row: Operation, nativeIdentity?: NativeIdentity, completed = false, authority?: FilesystemAuthorization) {
    // Reused dev/ino with a different birthtime is ambiguous historical evidence,
    // just as in discovery; it must not produce a completed but unresolved project.
    const nativeCollision = (stored: string, durable?:string|null) => {
      const identity: NativeIdentity = JSON.parse(stored);
      const source = db.select().from(schema.sources).where(eq(schema.sources.id,row.sourceId)).get();
      const root = source?.appliedRootIdentity ? JSON.parse(source.appliedRootIdentity) as NativeIdentity : null;
      return nativeIdentity && identity.ino === nativeIdentity.ino && (identity.dev === nativeIdentity.dev ||
        authorizer && root && identity.dev === root.dev || authorizer && !durable && identity.birthtimeNs===nativeIdentity.birthtimeNs);
    };
    const binding = authority ?? parseFilesystemAuthorization(row.authorization);
    const destination = authorizer && nativeIdentity && binding ? authorizer.observe(join(row.canonicalRoot,row.relativePath),binding.root,nativeIdentity) : null;
    const projects = db.select().from(schema.projects).where(eq(schema.projects.sourceId, row.sourceId)).all();
    const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, row.sourceId)).all();
    for (const record of [...projects.filter((p) => !completed || p.id !== row.projectId), ...categories]) {
      if (filesystemAlias(record.relativePath) === filesystemAlias(row.relativePath)) throw new CreationFailure("reserved_destination");
      if (nativeCollision(record.nativeIdentity,record.durableEvidence) || destination && record.durableEvidence &&
        durableOwnershipKey(JSON.parse(record.durableEvidence)) === durableOwnershipKey(destination.evidence)) throw new CreationFailure("native_conflict");
    }
    if(destination) {
      const unfinished = db.select().from(schema.projectCreationOperations).where(eq(schema.projectCreationOperations.sourceId,row.sourceId)).all()
        .filter(operation=>operation.operationId!==row.operationId && !["completed","failed"].includes(operation.stage));
      const operationIds=new Set(unfinished.map(operation=>operation.operationId));
      const proofs = [...unfinished.map(operation=>operation.destinationEvidence),
        ...db.select().from(schema.projectCreationAttestations).all().filter(proof=>operationIds.has(proof.operationId)).map(proof=>proof.destinationEvidence)];
      for(const proof of proofs) if(proof) {
        const observed=parseFolderObservation(JSON.parse(proof));
        if(!observed || durableOwnershipKey(observed.evidence)===durableOwnershipKey(destination.evidence))throw new CreationFailure("native_conflict");
      }
    }
    for (const record of readProjectReservations(db, row.sourceId)
      .filter((o) => o.operationKind !== "creation" || o.operationId !== row.operationId)) {
      if (filesystemAlias(record.relativePath) === filesystemAlias(row.relativePath)) throw new CreationFailure("reserved_destination");
      if (record.nativeIdentity && nativeCollision(record.nativeIdentity)) throw new CreationFailure("native_conflict");
    }
  }

  function verifyContext(row: Operation, revision = row.expectedRevision, workspaceId = row.initiatingWorkspaceId, authority?: FilesystemAuthorization) {
    if (hasUnfinishedProjectRelocation(db, row.sourceId)) throw new CreationFailure("reserved_destination");
    const current = sourceFor(workspaceId);
    if (!current || current.id !== row.sourceId || current.canonicalRoot !== row.canonicalRoot || current.discoveryMode !== row.mode ||
      current.discoveryRevision !== revision || current.appliedRootIdentity !== row.rootIdentity ||
      current.excludedRelativePaths !== row.excludedRelativePaths || current.archiveRelativePath !== row.archiveRelativePath) {
      throw new CreationFailure("stale_configuration");
    }
    let parentEvidence = current.durableEvidence;
    if (row.mode === "grouped") {
      const category = db.select().from(schema.categories).where(eq(schema.categories.id, row.categoryId!)).get();
      if (!category || category.sourceId !== row.sourceId || category.relativePath !== row.parentRelativePath ||
        category.nativeIdentity !== row.parentIdentity || category.associationState !== "active" || category.modeInactive) {
        throw new CreationFailure("category_unavailable");
      }
      parentEvidence = category.durableEvidence;
    }
    policy(current, row.parentRelativePath, row.relativePath);
    if (!authorizer) return verifyCreationParents(filesystem, row);
    const binding = authority ?? parseFilesystemAuthorization(row.authorization);
    if (binding && row.authorization === null && (!sameIdentity(binding.root.mount,JSON.parse(row.rootIdentity)) ||
      !sameIdentity(binding.parent.mount,JSON.parse(row.parentIdentity)))) throw new CreationFailure("ownership_uncertain");
    if (!binding) throw new CreationFailure("ownership_uncertain");
    authorizer.verify(binding, current, row.parentRelativePath, parentEvidence, row.authorization===null ? {root:JSON.parse(row.rootIdentity),parent:JSON.parse(row.parentIdentity)} : undefined);
    return verifyCreationParents(filesystem, {...row, rootIdentity: JSON.stringify(binding.root.mount), parentIdentity: JSON.stringify(binding.parent.mount)});
  }

  function verifyDestination(row: Operation, evidence: NativeIdentity, revision = row.expectedRevision, workspaceId = row.initiatingWorkspaceId, authority?: FilesystemAuthorization, destination?: VerifiedFolder) {
    verifyContext(row, revision, workspaceId, authority);
    verifyCreationDirectory(filesystem, join(row.canonicalRoot, row.relativePath), evidence);
    if (authorizer) {
      const binding = authority ?? parseFilesystemAuthorization(row.authorization);
      const saved = row.destinationEvidence ? parseFolderObservation(JSON.parse(row.destinationEvidence)) : null;
      if (!binding || row.destinationEvidence && !saved) throw new CreationFailure("filesystem_changed");
      const observed = authorizer.observe(join(row.canonicalRoot,row.relativePath),binding.root,evidence,(destination ?? saved)?.evidence);
      if(destination && !sameIdentity(destination.mount,observed.mount))throw new CreationFailure("filesystem_changed");
    }
    verifyContext(row, revision, workspaceId, authority);
  }

  function complete(row: Operation, evidence: NativeIdentity, currentRevision: number, workspaceId: string, authority?: FilesystemAuthorization, destination?: VerifiedFolder) {
    const revision = currentRevision + 1;
    if (!Number.isSafeInteger(revision)) throw new Error("Invalid revision");
    const completed = db.transaction((tx) => {
      verifyDestination(row, evidence, currentRevision, workspaceId, authority, destination); assertReservations(row, evidence, false, authority);
      if (JSON.stringify(operationFor(row.operationId)) !== JSON.stringify(row)) throw new CreationFailure("filesystem_changed");
      tx.insert(schema.projects).values({ id: row.projectId, sourceId: row.sourceId, relativePath: row.relativePath,
        nativeIdentity: row.nativeIdentity ?? JSON.stringify(evidence), durableEvidence: row.destinationEvidence ? JSON.stringify(parseFolderObservation(JSON.parse(row.destinationEvidence))!.evidence)
          : authorizer && authority ? JSON.stringify(authorizer.observe(join(row.canonicalRoot,row.relativePath),authority.root,evidence).evidence) : null, categoryId: row.categoryId, associationState: "active", modeInactive: false }).run();
      tx.update(schema.sources).set({ discoveryRevision: revision }).where(eq(schema.sources.id, row.sourceId)).run();
      tx.update(schema.projectCreationOperations).set({ stage: "completed", completedRevision: revision, problem: null })
        .where(eq(schema.projectCreationOperations.operationId, row.operationId)).run();
      verifyDestination(row, evidence, revision, workspaceId, authority, destination); assertReservations(row, evidence, true, authority);
      return operationFor(row.operationId)!;
    }, { behavior: "immediate" });
    const workspaceIds = db.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId, row.sourceId)).all().map((w) => w.id);
    integration.committed(row.sourceId, revision, workspaceIds);
    return completed;
  }

  function inspectRecovery(row: Operation, workspaceId: string, revision: number) {
    const preview: ProjectCreationRecoveryPreview = { workspaceId, sourceId: row.sourceId, operation: operationView(row), revision,
      destinationState: "unavailable", problem: null, actions: [], previewToken: null };
    let evidence: NativeIdentity | null = null;
    let binding: FilesystemAuthorization | undefined;
    let destinationObservation: VerifiedFolder | undefined;
    if (["completed", "failed"].includes(row.stage)) return { preview, evidence, binding, destination:destinationObservation };
    try {
      if (authorizer) {
        const original = parseFilesystemAuthorization(row.authorization), source = sourceFor(workspaceId);
        if (!source || row.authorization !== null && !original) throw new CreationFailure("ownership_uncertain");
        const category = row.categoryId ? db.select().from(schema.categories).where(eq(schema.categories.id,row.categoryId)).get() : null;
        binding = authorizer.capture(source,row.parentRelativePath,category ? category.durableEvidence : source.durableEvidence, row.authorization===null ? {root:JSON.parse(row.rootIdentity),parent:JSON.parse(row.parentIdentity)} : undefined);
        if (original && (!sameDurableFolder(original.root.evidence,binding.root.evidence) || !sameDurableFolder(original.parent.evidence,binding.parent.evidence))) throw new CreationFailure("filesystem_changed");
      }
      const parent = verifyContext(row, revision, workspaceId,binding);
      assertReservations(row);
      let destination;
      try { destination = filesystem.inspect(join(parent, row.name)); }
      catch (error) {
        if (filesystemCode(error) !== "ENOENT") throw error;
        // A missing evidenced folder cannot be replaced while keeping immutable evidence.
        assertCreationDestinationFree(filesystem, parent, row.name);
        verifyContext(row, revision, workspaceId,binding);
        preview.destinationState = "missing"; preview.problem = "destination_missing";
        if (row.nativeIdentity === null) preview.actions = ["retry_missing"];
        return { preview, evidence, binding, destination:destinationObservation };
      }
      if (destination.kind === "link") { preview.destinationState = "link"; preview.problem = "destination_link"; }
      else if (destination.kind !== "directory" || !reliableIdentity(destination.identity) ||
        row.nativeIdentity && (authorizer && binding && row.destinationEvidence
          ? !sameDurableFolder(parseFolderObservation(JSON.parse(row.destinationEvidence))!.evidence,authorizer.observe(join(parent,row.name),binding.root,destination.identity).evidence)
          : !sameLegacyNativeIdentity(row.nativeIdentity, destination.identity))) {
        preview.destinationState = "replaced"; preview.problem = "destination_replaced";
      } else {
        evidence = destination.identity;
        if(authorizer && binding)destinationObservation=authorizer.observe(join(parent,row.name),binding.root,evidence);
        verifyDestination(row, evidence, revision, workspaceId,binding,destinationObservation); assertReservations(row, evidence, false, binding);
        if (filesystem.names(parent).some((name) => name !== row.name && filesystemAlias(name) === filesystemAlias(row.name))) throw new CreationFailure("case_alias");
        preview.destinationState = row.nativeIdentity ? "recorded" : "unverified";
        preview.problem = row.nativeIdentity ? null : "ownership_uncertain";
        preview.actions = [row.nativeIdentity ? "complete_recorded" : "associate_reviewed"];
      }
    } catch (error) {
      preview.problem = filesystemProblem(error);
      preview.destinationState = ["reserved_destination", "native_conflict", "case_alias"].includes(preview.problem) ? "conflicting" : "unavailable";
      preview.actions = []; evidence = null;
    }
    return { preview, evidence, binding, destination:destinationObservation };
  }

  function listProjectCreations(input: unknown): ServiceResult<ProjectCreationList> {
    if (!isProjectCreationRequest(input) || input.type !== "workspace.listProjectCreations") return invalid();
    try {
      const source = sourceFor(input.workspaceId);
      if (!source) return invalid();
      const operations = db.select().from(schema.projectCreationOperations).where(eq(schema.projectCreationOperations.sourceId, source.id))
        .all().filter((row) => !["completed", "failed"].includes(row.stage)).map(operationView);
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, operations } };
    } catch { return storage(); }
  }
  function getProjectCreation(input: unknown): ServiceResult<ProjectCreationResult> {
    if (!isProjectCreationRequest(input) || input.type !== "workspace.getProjectCreation") return invalid();
    try {
      const source = sourceFor(input.workspaceId), row = operationFor(input.operationId);
      if (!source || !row || source.id !== row.sourceId) return invalid();
      return { ok: true, value: recordedResult(row) };
    } catch { return storage(); }
  }
  function previewProjectCreationRecovery(input: unknown): ServiceResult<ProjectCreationRecoveryPreview> {
    if (!isProjectCreationRequest(input) || input.type !== "workspace.previewProjectCreationRecovery") return invalid();
    const key = reviewKey(input.workspaceId, input.operationId);
    reviews.delete(key);
    try {
      const source = sourceFor(input.workspaceId), row = operationFor(input.operationId);
      if (!source || !row || row.sourceId !== source.id) return invalid();
      const { preview, evidence, binding, destination } = inspectRecovery(row, input.workspaceId, source.discoveryRevision);
      if (preview.actions.length) {
        preview.previewToken = randomUUID();
        reviews.set(key, { row, revision: source.discoveryRevision, preview: structuredClone(preview), evidence, binding, destination, reservations: readProjectReservations(db, source.id) });
      }
      return { ok: true, value: preview };
    } catch { return storage(); }
  }
  function recoverProjectCreation(input: unknown): ServiceResult<ProjectCreationResult> {
    if (!isProjectCreationRequest(input) || input.type !== "workspace.recoverProjectCreation") return invalid();
    const request = { ...input }, key = reviewKey(request.workspaceId, request.operationId);
    let row: Operation | undefined;
    let effectAccepted = false;
    const stale = () => ({ ok: false as const, error: { code: "stale_preview" as const, message: "Refresh creation recovery and explicitly review the current destination." } });
    try {
      const source = sourceFor(request.workspaceId);
      row = operationFor(request.operationId);
      if (!source || !row || row.sourceId !== source.id) return invalid();
      if (["completed", "failed"].includes(row.stage)) return { ok: true, value: recordedResult(row) };
      const review = reviews.get(key);
      if (!review || review.preview.previewToken !== request.previewToken || !review.preview.actions.includes(request.action)) return stale();
      reviews.delete(key);
      const current = inspectRecovery(row, request.workspaceId, source.discoveryRevision);
      if (JSON.stringify(readProjectReservations(db, source.id)) !== JSON.stringify(review.reservations) ||
        JSON.stringify(row) !== JSON.stringify(review.row) || source.discoveryRevision !== review.revision ||
        JSON.stringify(current.binding) !== JSON.stringify(review.binding) || JSON.stringify(current.destination)!==JSON.stringify(review.destination) ||
        current.preview.destinationState !== review.preview.destinationState ||
        !current.preview.actions.includes(request.action) || JSON.stringify(current.evidence) !== JSON.stringify(review.evidence)) return stale();
      const revision = source.discoveryRevision;
      if (authorizer && review.binding) {
        const bound = row;
        db.transaction(tx=>{
          verifyContext(bound,source.discoveryRevision,request.workspaceId,review.binding);
          if(JSON.stringify(operationFor(bound.operationId))!==JSON.stringify(bound))throw new CreationFailure("filesystem_changed");
          tx.insert(schema.projectCreationAttestations).values({id:randomUUID(),operationId:bound.operationId,journal:JSON.stringify(bound),authorization:JSON.stringify(review.binding),destinationEvidence:review.destination ? JSON.stringify(review.destination) : null}).run();
          verifyContext(bound,source.discoveryRevision,request.workspaceId,review.binding);
        },{behavior:"immediate"});
      }
      integration.invalidateSourceReviews(row.sourceId);
      let evidence = review.evidence;
      let destination = review.destination;
      if (request.action === "retry_missing") {
        const parent = verifyContext(row, revision, request.workspaceId, review.binding);
        assertReservations(row); assertCreationDestinationFree(filesystem, parent, row.name);
        verifyContext(row, revision, request.workspaceId, review.binding);
        effectAccepted = true;
        filesystem.mkdir(join(parent, row.name));
        verifyContext(row, revision, request.workspaceId, review.binding);
        const entry = filesystem.inspect(join(parent, row.name));
        if (entry.kind !== "directory" || !reliableIdentity(entry.identity)) throw new CreationFailure("filesystem_changed");
        evidence = entry.identity;
        if(authorizer && review.binding)destination=authorizer.observe(join(parent,row.name),review.binding.root,evidence);
      }
      if (!evidence) throw new CreationFailure("ownership_uncertain");
      verifyDestination(row, evidence, revision, request.workspaceId, review.binding, destination); assertReservations(row, evidence, false, review.binding);
      // A reviewed association may accept uncertain ownership but never replace
      // prior recorded evidence. The immutable journal constraint enforces this too.
      effectAccepted = true;
      const bound = row;
      db.transaction((tx) => {
        verifyDestination(bound, evidence, revision, request.workspaceId, review.binding, destination); assertReservations(bound, evidence, false, review.binding);
        if (JSON.stringify(operationFor(bound.operationId)) !== JSON.stringify(bound)) throw new CreationFailure("filesystem_changed");
        tx.update(schema.projectCreationOperations).set({ stage: "evidence_recorded", nativeIdentity: bound.nativeIdentity ?? JSON.stringify(evidence), destinationEvidence: bound.destinationEvidence ?? (authorizer && review.binding && bound.authorization !== null ? JSON.stringify(authorizer.observe(join(bound.canonicalRoot,bound.relativePath),review.binding.root,evidence)) : null), problem: null })
          .where(eq(schema.projectCreationOperations.operationId, bound.operationId)).run();
        verifyDestination(bound, evidence, revision, request.workspaceId, review.binding, destination);
      }, { behavior: "immediate" });
      row = operationFor(row.operationId)!;
      const completed = complete(row, evidence, revision, request.workspaceId, review.binding, destination);
      return { ok: true, value: recordedResult(completed) };
    } catch (error) {
      if (!row || !effectAccepted) return stale();
      const problem = error instanceof CreationFailure ? error.problem : /^E[A-Z]+$/.test(String(filesystemCode(error))) ? filesystemProblem(error) : "storage_error";
      try {
        const persisted = operationFor(row.operationId)!;
        if (["completed", "failed"].includes(persisted.stage)) return { ok: true, value: recordedResult(persisted) };
        db.update(schema.projectCreationOperations).set({ stage: "uncertain", problem })
          .where(eq(schema.projectCreationOperations.operationId, row.operationId)).run();
        row = operationFor(row.operationId)!;
      } catch { try { row = operationFor(row.operationId) ?? row; } catch { /* Retain durable history. */ } }
      return { ok: true, value: { outcome: "recoverable", operation: operationView(row) } };
    }
  }

  function createProject(input: unknown): ServiceResult<ProjectCreationResult> {
    if (!isProjectCreationRequest(input) || input.type !== "workspace.createProject") return {
      ok: false, error: { code: "invalid_input", message: "Choose a saved workspace and an exact project creation request." },
    };
    // Copy the request before any filesystem seam or subscriber can mutate it.
    const request: WorkspaceCreateProjectCommand = { ...input };
    let intent: Operation | undefined;
    let mkdirStarted = false, mkdirReturned = false;
    let phase: "storage" | "filesystem" = "storage";
    try {
      const source = sourceFor(request.workspaceId);
      if (!source) return { ok: false, error: { code: "invalid_input", message: "Choose a saved workspace." } };
      const prior = operationFor(request.operationId);
      if (prior) {
        if (prior.initiatingWorkspaceId !== request.workspaceId || prior.sourceId !== source.id || prior.name !== request.name ||
          prior.mode !== request.mode || prior.expectedRevision !== request.expectedRevision ||
          prior.categoryId !== (request.mode === "grouped" ? request.categoryId : null)) return {
          ok: false, error: { code: "invalid_input", message: "The operation ID belongs to its immutable original request." },
        };
        return { ok: true, value: recordedResult(prior) };
      }
      if (db.select().from(schema.projectCategoryMoveOperations).where(eq(schema.projectCategoryMoveOperations.operationId, request.operationId)).get()) return {
        ok: false, error: { code: "invalid_input", message: "The operation ID belongs to its immutable category move request." },
      };
      if (!validProjectBasename(request.name, filesystem.platform)) return rejected("invalid_name");
      if (source.discoveryMode === null || source.appliedRootIdentity === null) return rejected("unconfigured");
      if (source.discoveryMode !== request.mode || source.discoveryRevision !== request.expectedRevision) return rejected("stale_configuration");
      if (!Number.isSafeInteger(source.discoveryRevision + 1)) throw new Error("Invalid revision");
      const category = request.mode === "grouped" ? db.select().from(schema.categories).where(eq(schema.categories.id, request.categoryId)).get() : null;
      if (request.mode === "grouped" && (!category || category.sourceId !== source.id || category.associationState !== "active" ||
        category.modeInactive || !isChildName(category.relativePath))) return rejected("category_unavailable");
      const parentRelativePath = category?.relativePath ?? "";
      phase = "filesystem";
      const authorization = authorizer ? JSON.stringify(authorizer.capture(source,parentRelativePath,category ? category.durableEvidence : source.durableEvidence)) : null;
      const row: Operation = {
        authorization, destinationEvidence: null,
        operationId: request.operationId, sourceId: source.id, initiatingWorkspaceId: request.workspaceId,
        projectId: randomUUID(), name: request.name, mode: request.mode, expectedRevision: request.expectedRevision,
        categoryId: category?.id ?? null, canonicalRoot: source.canonicalRoot, parentRelativePath,
        relativePath: parentRelativePath ? `${parentRelativePath}/${request.name}` : request.name,
        rootIdentity: source.appliedRootIdentity, parentIdentity: category?.nativeIdentity ?? source.appliedRootIdentity,
        excludedRelativePaths: source.excludedRelativePaths, archiveRelativePath: source.archiveRelativePath,
        stage: "intent", nativeIdentity: null, problem: null, completedRevision: null,
      };
      phase = "filesystem";
      const parent = verifyContext(row);
      assertReservations(row);
      assertCreationDestinationFree(filesystem, parent, row.name);
      verifyContext(row);
      phase = "storage";
      // Standalone durable boundary: never wrap this whole command in the
      // Workspace lifecycle transaction that would roll intent back on failure.
      db.transaction((tx) => {
        verifyContext(row); assertReservations(row);
        assertCreationDestinationFree(filesystem, parent, row.name);
        tx.insert(schema.projectCreationOperations).values(row).run();
        verifyContext(row);
      }, { behavior: "immediate" });
      intent = row;
      integration.invalidateSourceReviews(source.id);
      phase = "filesystem";
      verifyContext(row); assertReservations(row);
      assertCreationDestinationFree(filesystem, parent, row.name);
      verifyContext(row);
      mkdirStarted = true;
      filesystem.mkdir(join(parent, row.name));
      mkdirReturned = true;
      verifyContext(row);
      const destination = filesystem.inspect(join(parent, row.name));
      if (destination.kind !== "directory" || !reliableIdentity(destination.identity)) throw new CreationFailure("filesystem_changed");
      const evidence = destination.identity;
      const binding = parseFilesystemAuthorization(row.authorization);
      const destinationEvidence = authorizer && binding ? JSON.stringify(authorizer.observe(join(parent,row.name),binding.root,evidence)) : null;
      verifyDestination(row, evidence); assertReservations(row, evidence);
      phase = "storage";
      db.transaction((tx) => {
        verifyDestination(row, evidence); assertReservations(row, evidence);
        tx.update(schema.projectCreationOperations).set({ stage: "evidence_recorded", nativeIdentity: JSON.stringify(evidence), destinationEvidence })
          .where(eq(schema.projectCreationOperations.operationId, row.operationId)).run();
        verifyDestination(row, evidence);
      }, { behavior: "immediate" });
      intent = { ...row, stage: "evidence_recorded", nativeIdentity: JSON.stringify(evidence), destinationEvidence };
      const completed = complete(operationFor(row.operationId)!, evidence, source.discoveryRevision, request.workspaceId);
      return { ok: true, value: recordedResult(completed) };
    } catch (error) {
      const code = filesystemCode(error);
      const problem = error instanceof CreationFailure ? error.problem
        : phase === "filesystem" || typeof code === "string" && /^E[A-Z]+$/.test(code) ? filesystemProblem(error) : "storage_error";
      if (!intent) return rejected(problem);
      // Only native mkdir errors known to have made no directory can release
      // the reservation. All ambiguous effects retain intent/evidence/history.
      const definitelyNoEffect = !mkdirStarted || !mkdirReturned && ["EEXIST", "EACCES", "EPERM", "EROFS", "ENOENT", "ENOTDIR", "ENAMETOOLONG"].includes(String(filesystemCode(error)));
      try {
        const persisted = operationFor(intent.operationId)!;
        if (persisted.stage === "completed") return { ok: true, value: recordedResult(persisted) };
        db.update(schema.projectCreationOperations).set({ stage: definitelyNoEffect ? "failed" : "uncertain", problem })
          .where(eq(schema.projectCreationOperations.operationId, intent.operationId)).run();
        return { ok: true, value: recordedResult(operationFor(intent.operationId)!) };
      } catch {
        // Durable intent/evidence still makes the unresolved operation visible
        // if recording the diagnostic fails. Never clean up user folders here.
        let persisted = intent;
        try { persisted = operationFor(intent.operationId) ?? intent; } catch { /* Keep the last known durable stage. */ }
        return { ok: true, value: { outcome: "recoverable", operation: operationView(persisted) } };
      }
    }
  }
  return { createProject, listProjectCreations, getProjectCreation, previewProjectCreationRecovery, recoverProjectCreation, invalidateSource,
    removeWorkspace(workspaceId: string) {
      for (const [key, review] of reviews) if (review.preview.workspaceId === workspaceId) reviews.delete(key);
    },
    close() { reviews.clear(); },
  };
}
