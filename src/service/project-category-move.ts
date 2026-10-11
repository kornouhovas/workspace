import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isProjectCategoryMoveRequest, type ProjectCategoryMoveOperation, type ProjectCategoryMoveProblem,
  type ProjectCategoryMoveResult, type ProjectCategoryMoveList } from "../contracts/project-category-move.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isChildName, validArchive, validExclusions, type NativeIdentity } from "./discovery.js";
import { CreationFailure, filesystemCode, filesystemProblem, nativeProjectFilesystem, validProjectBasename,
  assertCreationDestinationFree, verifyCreationDirectory, verifyCreationParents, type ProjectFilesystem } from "./project-filesystem.js";
import { renameNoReplace, type ProjectRenameFilesystemResult } from "./project-rename-filesystem.js";
import { readProjectReservations } from "./project-rename-reservations.js";
import { filesystemAlias } from "./path-alias.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
type Operation = typeof schema.projectCategoryMoveOperations.$inferSelect;
class MoveFailure extends Error {
  constructor(readonly problem: ProjectCategoryMoveProblem) { super(problem); }
}
function operationView(row: Operation): ProjectCategoryMoveOperation {
  return { operationId: row.operationId, sourceId: row.sourceId, initiatingWorkspaceId: row.initiatingWorkspaceId,
    projectId: row.projectId, name: row.name, originalCategoryId: row.originalCategoryId,
    destinationCategoryId: row.destinationCategoryId, originalRelativePath: row.originalRelativePath,
    requestedRelativePath: row.requestedRelativePath, expectedRevision: row.expectedRevision,
    stage: row.stage, lastVerifiedPlacement: row.lastVerifiedPlacement, problem: row.problem,
    resultKind: row.resultKind, completedRevision: row.completedRevision };
}
function recordedResult(row: Operation): ProjectCategoryMoveResult {
  const operation = operationView(row);
  if (row.stage === "completed") return { outcome: row.resultKind as "completed" | "unchanged", operation, project: {
    operationId: row.operationId, sourceId: row.sourceId, projectId: row.projectId, name: row.name,
    relativePath: row.requestedRelativePath, categoryId: row.destinationCategoryId, revision: row.completedRevision!,
  } };
  if (row.stage === "failed") return { outcome: "rejected", operation, problem: row.problem! };
  return { outcome: "recoverable", operation };
}

export function createProjectCategoryMoveService(db: Database, integration: {
  invalidateSourceReviews(sourceId: string): void;
  committed(sourceId: string, revision: number, workspaceIds: string[]): void;
}, filesystem: ProjectFilesystem = nativeProjectFilesystem,
  native: (from: string, to: string) => ProjectRenameFilesystemResult = renameNoReplace) {
  const invalid = () => ({ ok: false as const, error: { code: "invalid_input" as const,
    message: "Choose a saved workspace and its immutable project category move request." } });
  const storage = () => ({ ok: false as const, error: { code: "storage" as const, message: "Category move history could not be read." } });
  const rejected = (problem: ProjectCategoryMoveProblem): ServiceResult<ProjectCategoryMoveResult> =>
    ({ ok: true, value: { outcome: "rejected", problem, operation: null } });
  const fail = (problem: ProjectCategoryMoveProblem): never => { throw new MoveFailure(problem); };
  const operationFor = (id: string) => db.select().from(schema.projectCategoryMoveOperations)
    .where(eq(schema.projectCategoryMoveOperations.operationId, id)).get();
  const sourceFor = (workspaceId: string) => db.select().from(schema.workspaces)
    .innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
    .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  function policy(row: Operation, path: string) {
    const exclusions: unknown = JSON.parse(row.excludedRelativePaths);
    if (!validExclusions(exclusions, "grouped") || !validArchive(row.archiveRelativePath)) fail("stale_configuration");
    const parts = path.split("/"), parent = parts[0];
    if (parts.some((name) => name.startsWith(".") || ["$RECYCLE.BIN", "SYSTEM VOLUME INFORMATION"].includes(filesystemAlias(name))) ||
      (exclusions as string[]).some((excluded) => [path, parent].some((p) => filesystemAlias(excluded) === filesystemAlias(p)))) fail("excluded");
    const archive = row.archiveRelativePath?.split("/");
    if (archive && filesystemAlias(parent) === filesystemAlias(archive[0]) &&
      (archive.length === 1 || filesystemAlias(parts[1]) === filesystemAlias(archive[1]))) fail("archive");
  }
  function reservations(row: Operation) {
    if (readProjectReservations(db, row.sourceId)
      .some((op) => op.operationKind !== "category_move" || op.operationId !== row.operationId)) fail("reserved_destination");
    const paths = [row.originalRelativePath, row.requestedRelativePath];
    const records = [...db.select().from(schema.projects).where(eq(schema.projects.sourceId, row.sourceId)).all().filter((p) => p.id !== row.projectId),
      ...db.select().from(schema.categories).where(eq(schema.categories.sourceId, row.sourceId)).all()];
    const evidence: NativeIdentity = JSON.parse(row.nativeIdentity);
    for (const record of records) {
      if (paths.some((path) => filesystemAlias(path) === filesystemAlias(record.relativePath))) fail("reserved_destination");
      const other: NativeIdentity = JSON.parse(record.nativeIdentity);
      if (other.dev === evidence.dev && other.ino === evidence.ino) fail("native_conflict");
    }
  }
  function context(row: Operation, completed = false) {
    const source = sourceFor(row.initiatingWorkspaceId);
    if (!source || source.id !== row.sourceId || source.canonicalRoot !== row.canonicalRoot || source.discoveryMode !== "grouped" ||
      source.discoveryRevision !== row.expectedRevision + (completed ? 1 : 0) || source.appliedRootIdentity !== row.rootIdentity ||
      source.excludedRelativePaths !== row.excludedRelativePaths || source.archiveRelativePath !== row.archiveRelativePath) fail("stale_configuration");
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, row.projectId)).get();
    if (!project || project.sourceId !== row.sourceId || project.relativePath !== (completed ? row.requestedRelativePath : row.originalRelativePath) || project.nativeIdentity !== row.nativeIdentity ||
      project.categoryId !== (completed ? row.destinationCategoryId : row.originalCategoryId) || project.associationState !== "active" || project.modeInactive) fail("project_unavailable");
    for (const [id, path, identity] of [[row.originalCategoryId, row.originalParentRelativePath, row.originalParentIdentity],
      [row.destinationCategoryId, row.destinationParentRelativePath, row.destinationParentIdentity]]) {
      const category = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
      if (!category || category.sourceId !== row.sourceId || category.relativePath !== path || category.nativeIdentity !== identity ||
        category.associationState !== "active" || category.modeInactive) fail("category_unavailable");
    }
    policy(row, row.originalRelativePath); policy(row, row.requestedRelativePath); reservations(row);
  }
  function parents(row: Operation, completed = false) {
    context(row, completed);
    for (const [parentRelativePath, parentIdentity] of [[row.originalParentRelativePath, row.originalParentIdentity],
      [row.destinationParentRelativePath, row.destinationParentIdentity]]) {
      const parent = verifyCreationParents(filesystem, { ...row, parentRelativePath, parentIdentity });
      filesystem.assertAccessible?.(row.canonicalRoot); filesystem.assertAccessible?.(parent);
      const names = filesystem.names(row.canonicalRoot);
      if (!names.includes(parentRelativePath)) fail("filesystem_changed");
      if (names.some((name) => name !== parentRelativePath && filesystemAlias(name) === filesystemAlias(parentRelativePath))) fail("occupied");
    }
    context(row, completed);
  }
  function placement(row: Operation, relativePath = row.originalRelativePath, completed = false) {
    parents(row, completed);
    const parent = join(row.canonicalRoot, relativePath === row.originalRelativePath ? row.originalParentRelativePath : row.destinationParentRelativePath);
    const path = join(row.canonicalRoot, relativePath);
    if (!filesystem.names(parent).includes(row.name)) fail("filesystem_changed");
    if (filesystem.names(parent).some((name) => name !== row.name && filesystemAlias(name) === filesystemAlias(row.name))) fail("occupied");
    verifyCreationDirectory(filesystem, path, JSON.parse(row.nativeIdentity));
    filesystem.assertAccessible?.(path);
    // Recheck both ancestors after observing the project; no filesystem lock is implied.
    for (const [parentRelativePath, parentIdentity] of [[row.originalParentRelativePath, row.originalParentIdentity],
      [row.destinationParentRelativePath, row.destinationParentIdentity]]) verifyCreationParents(filesystem, { ...row, parentRelativePath, parentIdentity });
    parents(row, completed);
  }
  function destinationFree(row: Operation) {
    placement(row);
    assertCreationDestinationFree(filesystem, join(row.canonicalRoot, row.destinationParentRelativePath), row.name);
    placement(row);
  }
  function uniqueDestination(row: Operation, completed = false) {
    placement(row, row.requestedRelativePath, completed);
    assertCreationDestinationFree(filesystem, join(row.canonicalRoot, row.originalParentRelativePath), row.name);
    placement(row, row.requestedRelativePath, completed);
  }
  const unchangedOperation = (row: Operation) => {
    const current = operationFor(row.operationId);
    return !!current && (Object.keys(row) as (keyof Operation)[]).every((key) => current[key] === row[key]);
  };
  function evidence(row: Operation) {
    return db.transaction((tx) => {
      uniqueDestination(row);
      if (!unchangedOperation(row)) fail("filesystem_changed");
      tx.update(schema.projectCategoryMoveOperations).set({ stage: "destination_recorded", destinationIdentity: row.nativeIdentity,
        lastVerifiedPlacement: "destination", problem: null }).where(eq(schema.projectCategoryMoveOperations.operationId, row.operationId)).run();
      uniqueDestination(row);
      return operationFor(row.operationId)!;
    }, { behavior: "immediate" });
  }
  function complete(row: Operation) {
    const revision = row.expectedRevision + 1;
    if (!Number.isSafeInteger(revision)) fail("stale_configuration");
    const receipt = db.transaction((tx) => {
      uniqueDestination(row);
      if (!unchangedOperation(row)) fail("filesystem_changed");
      tx.update(schema.projects).set({ categoryId: row.destinationCategoryId, relativePath: row.requestedRelativePath })
        .where(eq(schema.projects.id, row.projectId)).run();
      tx.update(schema.sources).set({ discoveryRevision: revision }).where(eq(schema.sources.id, row.sourceId)).run();
      tx.update(schema.projectCategoryMoveOperations).set({ stage: "completed", resultKind: "completed", completedRevision: revision, problem: null })
        .where(eq(schema.projectCategoryMoveOperations.operationId, row.operationId)).run();
      uniqueDestination(row, true);
      return operationFor(row.operationId)!;
    }, { behavior: "immediate" });
    const workspaceIds = db.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId, row.sourceId)).all().map((w) => w.id);
    integration.committed(row.sourceId, revision, workspaceIds);
    return receipt;
  }
  function moveProjectCategory(input: unknown): ServiceResult<ProjectCategoryMoveResult> {
    if (!isProjectCategoryMoveRequest(input) || input.type !== "workspace.moveProjectCategory") return invalid();
    const request = { ...input };
    let phase: "storage" | "filesystem" = "storage";
    let intent: Operation | undefined, possibleEffect = false;
    try {
      const source = sourceFor(request.workspaceId);
      if (!source) return invalid();
      const prior = operationFor(request.operationId);
      if (prior) {
        if (prior.initiatingWorkspaceId !== request.workspaceId || prior.sourceId !== source.id || prior.projectId !== request.projectId ||
          prior.destinationCategoryId !== request.destinationCategoryId || prior.expectedRevision !== request.expectedRevision) return invalid();
        return { ok: true, value: recordedResult(prior) };
      }
      if (db.select().from(schema.projectCreationOperations).where(eq(schema.projectCreationOperations.operationId, request.operationId)).get() ||
        db.select().from(schema.projectRenameOperations).where(eq(schema.projectRenameOperations.operationId, request.operationId)).get()) return invalid();
      if (source.discoveryMode !== "grouped" || !source.appliedRootIdentity) return rejected("unconfigured");
      if (source.discoveryRevision !== request.expectedRevision) return rejected("stale_configuration");
      const project = db.select().from(schema.projects).where(eq(schema.projects.id, request.projectId)).get();
      if (!project || project.sourceId !== source.id || !project.categoryId || project.associationState !== "active" || project.modeInactive) return rejected("project_unavailable");
      const original = db.select().from(schema.categories).where(eq(schema.categories.id, project.categoryId)).get();
      const destination = db.select().from(schema.categories).where(eq(schema.categories.id, request.destinationCategoryId)).get();
      for (const category of [original, destination]) {
        if (!category || category.sourceId !== source.id || category.associationState !== "active" || category.modeInactive ||
          !isChildName(category.relativePath) || !validProjectBasename(category.relativePath, filesystem.platform)) return rejected("category_unavailable");
      }
      const name = project.relativePath.split("/").at(-1)!;
      if (!validProjectBasename(name, filesystem.platform) || project.relativePath !== `${original!.relativePath}/${name}`) return rejected("project_unavailable");
      const row: Operation = { operationId: request.operationId, sourceId: source.id, initiatingWorkspaceId: request.workspaceId,
        projectId: project.id, name, expectedRevision: request.expectedRevision, originalCategoryId: original!.id, destinationCategoryId: destination!.id,
        canonicalRoot: source.canonicalRoot, originalParentRelativePath: original!.relativePath, destinationParentRelativePath: destination!.relativePath,
        originalRelativePath: project.relativePath, requestedRelativePath: `${destination!.relativePath}/${name}`,
        rootIdentity: source.appliedRootIdentity, originalParentIdentity: original!.nativeIdentity, destinationParentIdentity: destination!.nativeIdentity,
        nativeIdentity: project.nativeIdentity, excludedRelativePaths: source.excludedRelativePaths, archiveRelativePath: source.archiveRelativePath,
        stage: "intent", destinationIdentity: null, lastVerifiedPlacement: "original", lastVerifiedIdentity: project.nativeIdentity,
        problem: null, resultKind: null, completedRevision: null };
      phase = "filesystem"; placement(row);
      phase = "storage";
      if (row.originalCategoryId === row.destinationCategoryId) {
        const receipt = db.transaction((tx) => {
          placement(row);
          tx.insert(schema.projectCategoryMoveOperations).values(row).run();
          tx.update(schema.projectCategoryMoveOperations).set({ stage: "completed", resultKind: "unchanged", completedRevision: row.expectedRevision })
            .where(eq(schema.projectCategoryMoveOperations.operationId, row.operationId)).run();
          placement(row);
          return operationFor(row.operationId)!;
        }, { behavior: "immediate" });
        return { ok: true, value: recordedResult(receipt) };
      }
      if (!Number.isSafeInteger(row.expectedRevision + 1)) return rejected("stale_configuration");
      intent = db.transaction((tx) => {
        destinationFree(row);
        tx.insert(schema.projectCategoryMoveOperations).values(row).run();
        destinationFree(row);
        return operationFor(row.operationId)!;
      }, { behavior: "immediate" });
      integration.invalidateSourceReviews(row.sourceId);
      phase = "filesystem";
      destinationFree(intent);
      if (!unchangedOperation(intent)) fail("filesystem_changed");
      // The primitive protects only the destination. Repeated identity checks
      // detect observed substitutions, but do not lock filesystem ancestors.
      possibleEffect = true;
      const outcome = native(join(row.canonicalRoot, row.originalRelativePath), join(row.canonicalRoot, row.requestedRelativePath));
      possibleEffect = outcome === "renamed" || outcome === "filesystem_error";
      if (outcome !== "renamed") fail(outcome === "invalid_argument" ? "invalid_name" : outcome);
      uniqueDestination(intent);
      phase = "storage";
      intent = evidence(intent);
      return { ok: true, value: recordedResult(complete(intent)) };
    } catch (error) {
      const problem = error instanceof MoveFailure ? error.problem : error instanceof CreationFailure ? error.problem :
        phase === "filesystem" || /^E[A-Z]+$/.test(String(filesystemCode(error))) ? filesystemProblem(error) : "storage_error";
      const finiteProblem = problem === "case_alias" ? "occupied" : problem;
      if (!intent) return rejected(finiteProblem);
      try {
        let persisted = operationFor(intent.operationId)!;
        if (["completed", "failed"].includes(persisted.stage)) return { ok: true, value: recordedResult(persisted) };
        let noEffect = !possibleEffect;
        if (noEffect) { try { placement(persisted); } catch { noEffect = false; } }
        db.update(schema.projectCategoryMoveOperations).set(noEffect ? { stage: "failed", resultKind: "rejected", problem: finiteProblem }
          : { stage: "uncertain", problem: finiteProblem }).where(eq(schema.projectCategoryMoveOperations.operationId, intent.operationId)).run();
        persisted = operationFor(intent.operationId)!;
        return { ok: true, value: recordedResult(persisted) };
      } catch {
        // A failed uncertainty write cannot erase or fabricate durable evidence.
        try { intent = operationFor(intent.operationId) ?? intent; } catch { /* Retain last durable evidence. */ }
        return { ok: true, value: recordedResult(intent) };
      }
    }
  }
  function listProjectCategoryMoves(input: unknown): ServiceResult<ProjectCategoryMoveList> {
    if (!isProjectCategoryMoveRequest(input) || input.type !== "workspace.listProjectCategoryMoves") return invalid();
    try {
      const source = sourceFor(input.workspaceId);
      if (!source) return invalid();
      const operations = db.select().from(schema.projectCategoryMoveOperations).where(eq(schema.projectCategoryMoveOperations.sourceId, source.id))
        .all().filter((row) => !["completed", "failed"].includes(row.stage)).map(operationView);
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, operations } };
    } catch { return storage(); }
  }
  function getProjectCategoryMove(input: unknown): ServiceResult<ProjectCategoryMoveResult> {
    if (!isProjectCategoryMoveRequest(input) || input.type !== "workspace.getProjectCategoryMove") return invalid();
    try {
      const source = sourceFor(input.workspaceId), row = operationFor(input.operationId);
      if (!source || !row || source.id !== row.sourceId) return invalid();
      return { ok: true, value: recordedResult(row) };
    } catch { return storage(); }
  }
  return { moveProjectCategory, listProjectCategoryMoves, getProjectCategoryMove };
}
