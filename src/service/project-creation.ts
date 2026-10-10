import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isProjectCreationRequest, type ProjectCreationOperation, type ProjectCreationProblem, type ProjectCreationResult,
  type WorkspaceCreateProjectCommand } from "../contracts/project-creation.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isChildName, reliableIdentity, sameIdentity, validArchive, validExclusions, type NativeIdentity } from "./discovery.js";
import { assertCreationDestinationFree, creationAlias, CreationFailure, filesystemCode, filesystemProblem,
  nativeProjectFilesystem, validProjectBasename, verifyCreationDirectory, verifyCreationParents, type ProjectFilesystem } from "./project-filesystem.js";
import * as schema from "./db/schema.js";

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
    if (parts.some((name) => name.startsWith(".") || ["$recycle.bin", "system volume information"].includes(creationAlias(name))) ||
      exclusions.some((path) => creationAlias(path) === creationAlias(relativePath) ||
        parentRelativePath && creationAlias(path) === creationAlias(parentRelativePath))) throw new CreationFailure("excluded");
    // Discovery suppresses the containing project, or an archive category.
    const archive = source.archiveRelativePath?.split("/");
    if (archive && (source.discoveryMode === "direct" ? creationAlias(parts[0]) === creationAlias(archive[0])
      : creationAlias(parts[0]) === creationAlias(archive[0]) && (archive.length === 1 || creationAlias(parts[1]) === creationAlias(archive[1])))) {
      throw new CreationFailure("archive");
    }
  }

  function assertReservations(row: Operation, nativeIdentity?: NativeIdentity, completed = false) {
    const projects = db.select().from(schema.projects).where(eq(schema.projects.sourceId, row.sourceId)).all();
    const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, row.sourceId)).all();
    const operations = db.select().from(schema.projectCreationOperations).where(eq(schema.projectCreationOperations.sourceId, row.sourceId)).all();
    for (const record of [...projects.filter((p) => !completed || p.id !== row.projectId), ...categories]) {
      if (creationAlias(record.relativePath) === creationAlias(row.relativePath)) throw new CreationFailure("reserved_destination");
      if (nativeIdentity && sameIdentity(JSON.parse(record.nativeIdentity), nativeIdentity)) throw new CreationFailure("native_conflict");
    }
    for (const record of operations.filter((o) => o.operationId !== row.operationId && o.stage !== "failed")) {
      if (creationAlias(record.relativePath) === creationAlias(row.relativePath)) throw new CreationFailure("reserved_destination");
      if (nativeIdentity && record.nativeIdentity && sameIdentity(JSON.parse(record.nativeIdentity), nativeIdentity)) throw new CreationFailure("native_conflict");
    }
  }

  function verifyContext(row: Operation, revision = row.expectedRevision) {
    const current = sourceFor(row.initiatingWorkspaceId);
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

  function verifyDestination(row: Operation, evidence: NativeIdentity, revision = row.expectedRevision) {
    verifyContext(row, revision);
    verifyCreationDirectory(filesystem, join(row.canonicalRoot, row.relativePath), evidence);
    verifyContext(row, revision);
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
      const revision = source.discoveryRevision + 1;
      const completed = db.transaction((tx) => {
        verifyDestination(row, evidence); assertReservations(row, evidence);
        tx.insert(schema.projects).values({ id: row.projectId, sourceId: row.sourceId, relativePath: row.relativePath,
          nativeIdentity: JSON.stringify(evidence), categoryId: row.categoryId, associationState: "active", modeInactive: false }).run();
        tx.update(schema.sources).set({ discoveryRevision: revision }).where(eq(schema.sources.id, row.sourceId)).run();
        tx.update(schema.projectCreationOperations).set({ stage: "completed", completedRevision: revision })
          .where(eq(schema.projectCreationOperations.operationId, row.operationId)).run();
        verifyDestination(row, evidence, revision); assertReservations(row, evidence, true);
        return operationFor(row.operationId)!;
      }, { behavior: "immediate" });
      const workspaceIds = db.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId, source.id)).all().map((w) => w.id);
      integration.committed(source.id, revision, workspaceIds);
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
  return { createProject };
}
