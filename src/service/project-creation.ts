import { hasUnfinishedProjectRename, readProjectRenameReservations } from "./project-rename-reservations.js";
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
}, filesystem: ProjectFilesystem = nativeProjectFilesystem) {
  const reviews = new Map<string, { row: Operation; revision: number; preview: ProjectCreationRecoveryPreview; evidence: NativeIdentity | null; renames: ReturnType<typeof readProjectRenameReservations> }>();
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
    if (!validExclusions(exclusions, "grouped") || !validArchive(source.archiveRelativePath)) throw new Error("Invalid source configuration");
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

  function assertReservations(row: Operation, nativeIdentity?: NativeIdentity, completed = false) {
    // Reused dev/ino with a different birthtime is ambiguous historical evidence,
    // just as in discovery; it must not produce a completed but unresolved project.
    const nativeCollision = (stored: string) => {
      const identity: NativeIdentity = JSON.parse(stored);
      return nativeIdentity && identity.dev === nativeIdentity.dev && identity.ino === nativeIdentity.ino;
    };
    const projects = db.select().from(schema.projects).where(eq(schema.projects.sourceId, row.sourceId)).all();
    const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, row.sourceId)).all();
    const operations = db.select().from(schema.projectCreationOperations).where(eq(schema.projectCreationOperations.sourceId, row.sourceId)).all();
    for (const record of [...projects.filter((p) => !completed || p.id !== row.projectId), ...categories]) {
      if (filesystemAlias(record.relativePath) === filesystemAlias(row.relativePath)) throw new CreationFailure("reserved_destination");
      if (nativeCollision(record.nativeIdentity)) throw new CreationFailure("native_conflict");
    }
    for (const record of operations.filter((o) => o.operationId !== row.operationId && o.stage !== "failed" && o.stage !== "completed")) {
      if (filesystemAlias(record.relativePath) === filesystemAlias(row.relativePath)) throw new CreationFailure("reserved_destination");
      if (record.nativeIdentity && nativeCollision(record.nativeIdentity)) throw new CreationFailure("native_conflict");
    }
  }

  function verifyContext(row: Operation, revision = row.expectedRevision, workspaceId = row.initiatingWorkspaceId) {
    if (hasUnfinishedProjectRename(db, row.sourceId)) throw new CreationFailure("reserved_destination");
    const current = sourceFor(workspaceId);
    if (!current || current.id !== row.sourceId || current.canonicalRoot !== row.canonicalRoot || current.discoveryMode !== row.mode ||
      current.discoveryRevision !== revision || current.appliedRootIdentity !== row.rootIdentity ||
      current.excludedRelativePaths !== row.excludedRelativePaths || current.archiveRelativePath !== row.archiveRelativePath) {
      throw new CreationFailure("stale_configuration");
    }
    if (row.mode === "grouped") {
      const category = db.select().from(schema.categories).where(eq(schema.categories.id, row.categoryId!)).get();
      if (!category || category.sourceId !== row.sourceId || category.relativePath !== row.parentRelativePath ||
        category.nativeIdentity !== row.parentIdentity || category.associationState !== "active" || category.modeInactive) {
        throw new CreationFailure("category_unavailable");
      }
    }
    policy(current, row.parentRelativePath, row.relativePath);
    return verifyCreationParents(filesystem, row);
  }

  function verifyDestination(row: Operation, evidence: NativeIdentity, revision = row.expectedRevision, workspaceId = row.initiatingWorkspaceId) {
    verifyContext(row, revision, workspaceId);
    verifyCreationDirectory(filesystem, join(row.canonicalRoot, row.relativePath), evidence);
    verifyContext(row, revision, workspaceId);
  }

  function complete(row: Operation, evidence: NativeIdentity, currentRevision: number, workspaceId: string) {
    const revision = currentRevision + 1;
    if (!Number.isSafeInteger(revision)) throw new Error("Invalid revision");
    const completed = db.transaction((tx) => {
      verifyDestination(row, evidence, currentRevision, workspaceId); assertReservations(row, evidence);
      if (JSON.stringify(operationFor(row.operationId)) !== JSON.stringify(row)) throw new CreationFailure("filesystem_changed");
      tx.insert(schema.projects).values({ id: row.projectId, sourceId: row.sourceId, relativePath: row.relativePath,
        nativeIdentity: JSON.stringify(evidence), categoryId: row.categoryId, associationState: "active", modeInactive: false }).run();
      tx.update(schema.sources).set({ discoveryRevision: revision }).where(eq(schema.sources.id, row.sourceId)).run();
      tx.update(schema.projectCreationOperations).set({ stage: "completed", completedRevision: revision, problem: null })
        .where(eq(schema.projectCreationOperations.operationId, row.operationId)).run();
      verifyDestination(row, evidence, revision, workspaceId); assertReservations(row, evidence, true);
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
    if (["completed", "failed"].includes(row.stage)) return { preview, evidence };
    try {
      const parent = verifyContext(row, revision, workspaceId);
      assertReservations(row);
      let destination;
      try { destination = filesystem.inspect(join(parent, row.name)); }
      catch (error) {
        if (filesystemCode(error) !== "ENOENT") throw error;
        // A missing evidenced folder cannot be replaced while keeping immutable evidence.
        assertCreationDestinationFree(filesystem, parent, row.name);
        verifyContext(row, revision, workspaceId);
        preview.destinationState = "missing"; preview.problem = "destination_missing";
        if (row.nativeIdentity === null) preview.actions = ["retry_missing"];
        return { preview, evidence };
      }
      if (destination.kind === "link") { preview.destinationState = "link"; preview.problem = "destination_link"; }
      else if (destination.kind !== "directory" || !reliableIdentity(destination.identity) ||
        row.nativeIdentity && !sameIdentity(JSON.parse(row.nativeIdentity), destination.identity)) {
        preview.destinationState = "replaced"; preview.problem = "destination_replaced";
      } else {
        evidence = destination.identity;
        verifyDestination(row, evidence, revision, workspaceId); assertReservations(row, evidence);
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
    return { preview, evidence };
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
      const { preview, evidence } = inspectRecovery(row, input.workspaceId, source.discoveryRevision);
      if (preview.actions.length) {
        preview.previewToken = randomUUID();
        reviews.set(key, { row, revision: source.discoveryRevision, preview: structuredClone(preview), evidence, renames: readProjectRenameReservations(db, source.id) });
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
      if (JSON.stringify(readProjectRenameReservations(db, source.id)) !== JSON.stringify(review.renames) ||
        JSON.stringify(row) !== JSON.stringify(review.row) || source.discoveryRevision !== review.revision ||
        current.preview.destinationState !== review.preview.destinationState ||
        !current.preview.actions.includes(request.action) || JSON.stringify(current.evidence) !== JSON.stringify(review.evidence)) return stale();
      const revision = source.discoveryRevision;
      integration.invalidateSourceReviews(row.sourceId);
      let evidence = review.evidence;
      if (request.action === "retry_missing") {
        const parent = verifyContext(row, revision, request.workspaceId);
        assertReservations(row); assertCreationDestinationFree(filesystem, parent, row.name);
        verifyContext(row, revision, request.workspaceId);
        effectAccepted = true;
        filesystem.mkdir(join(parent, row.name));
        verifyContext(row, revision, request.workspaceId);
        const destination = filesystem.inspect(join(parent, row.name));
        if (destination.kind !== "directory" || !reliableIdentity(destination.identity)) throw new CreationFailure("filesystem_changed");
        evidence = destination.identity;
      }
      if (!evidence) throw new CreationFailure("ownership_uncertain");
      verifyDestination(row, evidence, revision, request.workspaceId); assertReservations(row, evidence);
      // A reviewed association may accept uncertain ownership but never replace
      // prior recorded evidence. The immutable journal constraint enforces this too.
      effectAccepted = true;
      const bound = row;
      db.transaction((tx) => {
        verifyDestination(bound, evidence, revision, request.workspaceId); assertReservations(bound, evidence);
        if (JSON.stringify(operationFor(bound.operationId)) !== JSON.stringify(bound)) throw new CreationFailure("filesystem_changed");
        tx.update(schema.projectCreationOperations).set({ stage: "evidence_recorded", nativeIdentity: JSON.stringify(evidence), problem: null })
          .where(eq(schema.projectCreationOperations.operationId, bound.operationId)).run();
        verifyDestination(bound, evidence, revision, request.workspaceId);
      }, { behavior: "immediate" });
      row = operationFor(row.operationId)!;
      const completed = complete(row, evidence, revision, request.workspaceId);
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
      if (!validProjectBasename(request.name, filesystem.platform)) return rejected("invalid_name");
      if (source.discoveryMode === null || source.appliedRootIdentity === null) return rejected("unconfigured");
      if (source.discoveryMode !== request.mode || source.discoveryRevision !== request.expectedRevision) return rejected("stale_configuration");
      if (!Number.isSafeInteger(source.discoveryRevision + 1)) throw new Error("Invalid revision");
      const category = request.mode === "grouped" ? db.select().from(schema.categories).where(eq(schema.categories.id, request.categoryId)).get() : null;
      if (request.mode === "grouped" && (!category || category.sourceId !== source.id || category.associationState !== "active" ||
        category.modeInactive || !isChildName(category.relativePath))) return rejected("category_unavailable");
      const parentRelativePath = category?.relativePath ?? "";
      const row: Operation = {
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
      verifyDestination(row, evidence); assertReservations(row, evidence);
      phase = "storage";
      db.transaction((tx) => {
        verifyDestination(row, evidence); assertReservations(row, evidence);
        tx.update(schema.projectCreationOperations).set({ stage: "evidence_recorded", nativeIdentity: JSON.stringify(evidence) })
          .where(eq(schema.projectCreationOperations.operationId, row.operationId)).run();
        verifyDestination(row, evidence);
      }, { behavior: "immediate" });
      intent = { ...row, stage: "evidence_recorded", nativeIdentity: JSON.stringify(evidence) };
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
