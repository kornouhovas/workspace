import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isProjectCategoryMoveRequest, type ProjectCategoryMoveOperation, type ProjectCategoryMoveProblem,
  type ProjectCategoryMoveResult, type ProjectCategoryMoveList } from "../contracts/project-category-move.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isChildName, validArchive, validExclusions, type NativeIdentity } from "./discovery.js";
import { CreationFailure, filesystemCode, filesystemProblem, nativeProjectFilesystem, validProjectBasename,
  verifyCreationDirectory, verifyCreationParents, type ProjectFilesystem } from "./project-filesystem.js";
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

export function createProjectCategoryMoveService(db: Database, filesystem: ProjectFilesystem = nativeProjectFilesystem) {
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
    if (readProjectReservations(db, row.sourceId).length || db.select().from(schema.projectCategoryMoveOperations)
      .where(eq(schema.projectCategoryMoveOperations.sourceId, row.sourceId)).all()
      .some((op) => op.operationId !== row.operationId && !["completed", "failed"].includes(op.stage))) fail("reserved_destination");
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
  function context(row: Operation) {
    const source = sourceFor(row.initiatingWorkspaceId);
    if (!source || source.id !== row.sourceId || source.canonicalRoot !== row.canonicalRoot || source.discoveryMode !== "grouped" ||
      source.discoveryRevision !== row.expectedRevision || source.appliedRootIdentity !== row.rootIdentity ||
      source.excludedRelativePaths !== row.excludedRelativePaths || source.archiveRelativePath !== row.archiveRelativePath) fail("stale_configuration");
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, row.projectId)).get();
    if (!project || project.sourceId !== row.sourceId || project.relativePath !== row.originalRelativePath || project.nativeIdentity !== row.nativeIdentity ||
      project.categoryId !== row.originalCategoryId || project.associationState !== "active" || project.modeInactive) fail("project_unavailable");
    for (const [id, path, identity] of [[row.originalCategoryId, row.originalParentRelativePath, row.originalParentIdentity],
      [row.destinationCategoryId, row.destinationParentRelativePath, row.destinationParentIdentity]]) {
      const category = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
      if (!category || category.sourceId !== row.sourceId || category.relativePath !== path || category.nativeIdentity !== identity ||
        category.associationState !== "active" || category.modeInactive) fail("category_unavailable");
    }
    policy(row, row.originalRelativePath); policy(row, row.requestedRelativePath); reservations(row);
  }
  function placement(row: Operation) {
    context(row);
    for (const [parentRelativePath, parentIdentity] of [[row.originalParentRelativePath, row.originalParentIdentity],
      [row.destinationParentRelativePath, row.destinationParentIdentity]]) {
      const parent = verifyCreationParents(filesystem, { ...row, parentRelativePath, parentIdentity });
      filesystem.assertAccessible?.(row.canonicalRoot); filesystem.assertAccessible?.(parent);
      if (!filesystem.names(row.canonicalRoot).includes(parentRelativePath)) fail("filesystem_changed");
    }
    const parent = join(row.canonicalRoot, row.originalParentRelativePath), path = join(row.canonicalRoot, row.originalRelativePath);
    if (!filesystem.names(parent).includes(row.name)) fail("filesystem_changed");
    if (filesystem.names(parent).some((name) => name !== row.name && filesystemAlias(name) === filesystemAlias(row.name))) fail("occupied");
    verifyCreationDirectory(filesystem, path, JSON.parse(row.nativeIdentity));
    filesystem.assertAccessible?.(path);
    // Recheck both ancestors after observing the project; no filesystem lock is implied.
    for (const [parentRelativePath, parentIdentity] of [[row.originalParentRelativePath, row.originalParentIdentity],
      [row.destinationParentRelativePath, row.destinationParentIdentity]]) verifyCreationParents(filesystem, { ...row, parentRelativePath, parentIdentity });
    context(row);
  }
  function moveProjectCategory(input: unknown): ServiceResult<ProjectCategoryMoveResult> {
    if (!isProjectCategoryMoveRequest(input) || input.type !== "workspace.moveProjectCategory") return invalid();
    const request = { ...input };
    let phase: "storage" | "filesystem" = "storage";
    try {
      const source = sourceFor(request.workspaceId);
      if (!source) return invalid();
      const prior = operationFor(request.operationId);
      if (prior) {
        if (prior.initiatingWorkspaceId !== request.workspaceId || prior.sourceId !== source.id || prior.projectId !== request.projectId ||
          prior.destinationCategoryId !== request.destinationCategoryId || prior.expectedRevision !== request.expectedRevision) return invalid();
        return { ok: true, value: recordedResult(prior) };
      }
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
      // Physical effects are deliberately closed until the subsequent move slice.
      if (row.originalCategoryId !== row.destinationCategoryId) return rejected("unsupported");
      phase = "storage";
      const receipt = db.transaction((tx) => {
        placement(row);
        tx.insert(schema.projectCategoryMoveOperations).values(row).run();
        tx.update(schema.projectCategoryMoveOperations).set({ stage: "completed", resultKind: "unchanged", completedRevision: row.expectedRevision })
          .where(eq(schema.projectCategoryMoveOperations.operationId, row.operationId)).run();
        placement(row);
        return operationFor(row.operationId)!;
      }, { behavior: "immediate" });
      return { ok: true, value: recordedResult(receipt) };
    } catch (error) {
      const problem = error instanceof MoveFailure ? error.problem : error instanceof CreationFailure ? error.problem :
        phase === "filesystem" || /^E[A-Z]+$/.test(String(filesystemCode(error))) ? filesystemProblem(error) : "storage_error";
      return rejected(problem === "case_alias" ? "occupied" : problem);
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
