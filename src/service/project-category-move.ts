import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isProjectCategoryMoveRequest, type ProjectCategoryMoveOperation, type ProjectCategoryMoveProblem,
  type ProjectCategoryMoveResult, type ProjectCategoryMoveList, type ProjectCategoryMoveRecoveryPreview,
  type ProjectCategoryMovePlacementState } from "../contracts/project-category-move.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isChildName, reliableIdentity, sameIdentity, validArchive, validExclusions, type NativeIdentity } from "./discovery.js";
import { CreationFailure, filesystemCode, filesystemProblem, nativeProjectFilesystem, validProjectBasename,
  assertCreationDestinationFree, verifyCreationDirectory, verifyCreationParents, type ProjectFilesystem } from "./project-filesystem.js";
import { renameNoReplace, type ProjectRenameFilesystemResult } from "./project-rename-filesystem.js";
import { categoryRemovalOwner, readProjectReservations } from "./project-rename-reservations.js";
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
  settled(sourceId: string): void;
}, filesystem: ProjectFilesystem = nativeProjectFilesystem,
  native: (from: string, to: string) => ProjectRenameFilesystemResult = renameNoReplace) {
  type Execution = { workspaceId: string; revision: number };
  const executionFor = (row: Operation): Execution => ({ workspaceId: row.initiatingWorkspaceId, revision: row.expectedRevision });
  const reviews = new Map<string, { row: Operation; execution: Execution; inspected: ReturnType<typeof inspectRecovery>; token: string }>();
  const reviewKey = (workspaceId: string, operationId: string) => `${workspaceId}:${operationId}`;
  function invalidateSource(sourceId: string) {
    for (const [key, review] of reviews) if (review.row.sourceId === sourceId) reviews.delete(key);
  }
  const stale = () => ({ ok: false as const, error: { code: "stale_preview" as const,
    message: "Refresh category move recovery and explicitly review current placements." } });
  function problemFor(error: unknown, phase: "storage" | "filesystem"): ProjectCategoryMoveProblem {
    const problem = error instanceof MoveFailure ? error.problem : error instanceof CreationFailure ? error.problem :
      phase === "filesystem" || /^E[A-Z]+$/.test(String(filesystemCode(error))) ? filesystemProblem(error) : "storage_error";
    return problem === "case_alias" ? "occupied" : problem;
  }
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
    const removalOwner = categoryRemovalOwner(db, row);
    if (readProjectReservations(db, row.sourceId)
      .some((op) => !(op.operationKind === "category_move" && op.operationId === row.operationId) &&
        !(op.operationKind === "category_removal" && op.operationId === removalOwner))) fail("reserved_destination");
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
  function context(row: Operation, completed = false, execution = executionFor(row)) {
    const source = sourceFor(execution.workspaceId);
    if (!source || source.id !== row.sourceId || source.canonicalRoot !== row.canonicalRoot || source.discoveryMode !== "grouped" ||
      source.discoveryRevision !== execution.revision + (completed ? 1 : 0) || source.appliedRootIdentity !== row.rootIdentity ||
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
  function parents(row: Operation, completed = false, execution = executionFor(row)) {
    context(row, completed, execution);
    for (const [parentRelativePath, parentIdentity] of [[row.originalParentRelativePath, row.originalParentIdentity],
      [row.destinationParentRelativePath, row.destinationParentIdentity]]) {
      const parent = verifyCreationParents(filesystem, { ...row, parentRelativePath, parentIdentity });
      filesystem.assertAccessible?.(row.canonicalRoot); filesystem.assertAccessible?.(parent);
      const names = filesystem.names(row.canonicalRoot);
      if (!names.includes(parentRelativePath)) fail("filesystem_changed");
      if (names.some((name) => name !== parentRelativePath && filesystemAlias(name) === filesystemAlias(parentRelativePath))) fail("occupied");
    }
    context(row, completed, execution);
  }
  function placement(row: Operation, relativePath = row.originalRelativePath, completed = false, execution = executionFor(row)) {
    parents(row, completed, execution);
    const parent = join(row.canonicalRoot, relativePath === row.originalRelativePath ? row.originalParentRelativePath : row.destinationParentRelativePath);
    const path = join(row.canonicalRoot, relativePath);
    if (!filesystem.names(parent).includes(row.name)) fail("filesystem_changed");
    if (filesystem.names(parent).some((name) => name !== row.name && filesystemAlias(name) === filesystemAlias(row.name))) fail("occupied");
    verifyCreationDirectory(filesystem, path, JSON.parse(row.nativeIdentity));
    filesystem.assertAccessible?.(path);
    // Recheck both ancestors after observing the project; no filesystem lock is implied.
    for (const [parentRelativePath, parentIdentity] of [[row.originalParentRelativePath, row.originalParentIdentity],
      [row.destinationParentRelativePath, row.destinationParentIdentity]]) verifyCreationParents(filesystem, { ...row, parentRelativePath, parentIdentity });
    parents(row, completed, execution);
  }
  function destinationFree(row: Operation, execution = executionFor(row)) {
    placement(row, row.originalRelativePath, false, execution);
    assertCreationDestinationFree(filesystem, join(row.canonicalRoot, row.destinationParentRelativePath), row.name);
    placement(row, row.originalRelativePath, false, execution);
  }
  function uniqueDestination(row: Operation, completed = false, execution = executionFor(row)) {
    placement(row, row.requestedRelativePath, completed, execution);
    assertCreationDestinationFree(filesystem, join(row.canonicalRoot, row.originalParentRelativePath), row.name);
    placement(row, row.requestedRelativePath, completed, execution);
  }
  const unchangedOperation = (row: Operation) => {
    const current = operationFor(row.operationId);
    return !!current && (Object.keys(row) as (keyof Operation)[]).every((key) => current[key] === row[key]);
  };
  function evidence(row: Operation, execution = executionFor(row)) {
    return db.transaction((tx) => {
      uniqueDestination(row, false, execution);
      if (!unchangedOperation(row)) fail("filesystem_changed");
      tx.update(schema.projectCategoryMoveOperations).set({ stage: "destination_recorded", destinationIdentity: row.nativeIdentity,
        lastVerifiedPlacement: "destination", problem: null }).where(eq(schema.projectCategoryMoveOperations.operationId, row.operationId)).run();
      uniqueDestination(row, false, execution);
      return operationFor(row.operationId)!;
    }, { behavior: "immediate" });
  }
  function complete(row: Operation, execution = executionFor(row)) {
    const revision = execution.revision + 1;
    if (!Number.isSafeInteger(revision)) fail("stale_configuration");
    const receipt = db.transaction((tx) => {
      uniqueDestination(row, false, execution);
      if (!unchangedOperation(row)) fail("filesystem_changed");
      tx.update(schema.projects).set({ categoryId: row.destinationCategoryId, relativePath: row.requestedRelativePath })
        .where(eq(schema.projects.id, row.projectId)).run();
      tx.update(schema.sources).set({ discoveryRevision: revision }).where(eq(schema.sources.id, row.sourceId)).run();
      tx.update(schema.projectCategoryMoveOperations).set({ stage: "completed", resultKind: "completed", completedRevision: revision, problem: null })
        .where(eq(schema.projectCategoryMoveOperations.operationId, row.operationId)).run();
      uniqueDestination(row, true, execution);
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
      const finiteProblem = problemFor(error, phase);
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
  function inspectRecovery(row: Operation, execution: Execution) {
    const preview: ProjectCategoryMoveRecoveryPreview = { workspaceId: execution.workspaceId, sourceId: row.sourceId,
      operation: operationView(row), revision: execution.revision, originalState: "unavailable", destinationState: "unavailable",
      problem: null, actions: [], previewToken: null };
    const observations: { path: string; state: ProjectCategoryMovePlacementState; identity: NativeIdentity | null }[] = [];
    const parentObservations: { path: string; identity: NativeIdentity; names: string[] }[] = [];
    const reserved = readProjectReservations(db, row.sourceId);
    if (["completed", "failed"].includes(row.stage)) return { preview, observations, parentObservations, reserved };
    try {
      parents(row, false, execution);
      for (const parentPath of ["", row.originalParentRelativePath, row.destinationParentRelativePath]) {
        const path = join(row.canonicalRoot, parentPath);
        parentObservations.push({ path: parentPath, identity: filesystem.inspect(path).identity, names: filesystem.names(path).sort() });
      }
      for (const path of [row.originalRelativePath, row.requestedRelativePath]) {
        let state: ProjectCategoryMovePlacementState = "missing", identity: NativeIdentity | null = null;
        try {
          const entry = filesystem.inspect(join(row.canonicalRoot, path));
          identity = entry.identity;
          if (entry.kind === "link") state = "link";
          else if (entry.kind !== "directory" || !reliableIdentity(identity) || !sameIdentity(identity, JSON.parse(row.nativeIdentity))) state = "replaced";
          else {
            placement(row, path, false, execution);
            state = "matching";
          }
        } catch (error) { if (filesystemCode(error) !== "ENOENT") throw error; }
        observations.push({ path, state, identity });
      }
      preview.originalState = observations[0].state; preview.destinationState = observations[1].state;
      const matches = observations.filter((entry) => entry.state === "matching");
      if (observations.some((entry) => !["matching", "missing"].includes(entry.state))) {
        preview.problem = observations.some((entry) => entry.state === "link") ? "destination_link" : "destination_replaced";
      } else if (matches.length !== 1) {
        preview.problem = matches.length ? "native_conflict" : "destination_missing";
        if (matches.length) preview.originalState = preview.destinationState = "conflicting";
      } else if (matches[0].path === row.originalRelativePath) {
        destinationFree(row, execution);
        preview.actions = ["retry_original", "keep_original"];
      } else {
        uniqueDestination(row, false, execution);
        preview.actions = ["complete_destination"];
      }
      parents(row, false, execution);
      if (preview.actions.length && !Number.isSafeInteger(execution.revision + 1)) {
        preview.actions = preview.actions.filter((action) => action === "keep_original");
        preview.problem = "stale_configuration";
      }
    } catch (error) {
      preview.problem = problemFor(error, "filesystem"); preview.actions = [];
      preview.originalState = preview.destinationState = ["occupied", "native_conflict", "reserved_destination"].includes(preview.problem) ? "conflicting" : "unavailable";
    }
    return { preview, observations, parentObservations, reserved };
  }
  function previewProjectCategoryMoveRecovery(input: unknown): ServiceResult<ProjectCategoryMoveRecoveryPreview> {
    if (!isProjectCategoryMoveRequest(input) || input.type !== "workspace.previewProjectCategoryMoveRecovery") return invalid();
    const key = reviewKey(input.workspaceId, input.operationId);
    reviews.delete(key);
    try {
      const source = sourceFor(input.workspaceId), row = operationFor(input.operationId);
      if (!source || !row || source.id !== row.sourceId) return invalid();
      const execution = { workspaceId: input.workspaceId, revision: source.discoveryRevision };
      const inspected = inspectRecovery(row, execution);
      if (inspected.preview.actions.length) {
        const token = randomUUID();
        reviews.set(key, { row, execution, inspected: structuredClone(inspected), token });
        inspected.preview.previewToken = token;
      }
      return { ok: true, value: inspected.preview };
    } catch { return storage(); }
  }
  function recoverProjectCategoryMove(input: unknown): ServiceResult<ProjectCategoryMoveResult> {
    if (!isProjectCategoryMoveRequest(input) || input.type !== "workspace.recoverProjectCategoryMove") return invalid();
    const request = { ...input }, key = reviewKey(request.workspaceId, request.operationId), review = reviews.get(key);
    if (!review || review.token !== request.previewToken || !review.inspected.preview.actions.includes(request.action)) return stale();
    reviews.delete(key);
    let row: Operation | undefined, accepted = false;
    let phase: "storage" | "filesystem" = "storage";
    try {
      const source = sourceFor(request.workspaceId);
      row = operationFor(request.operationId);
      if (!source || !row || source.id !== row.sourceId) return invalid();
      if (!unchangedOperation(review.row) || source.discoveryRevision !== review.execution.revision ||
        JSON.stringify(inspectRecovery(row, review.execution)) !== JSON.stringify(review.inspected)) return stale();
      const execution = review.execution;
      if (request.action !== "keep_original" && !Number.isSafeInteger(execution.revision + 1)) return stale();
      integration.invalidateSourceReviews(row.sourceId);
      accepted = true;
      if (request.action === "keep_original") {
        const bound = row;
        row = db.transaction((tx) => {
          destinationFree(bound, execution);
          if (!unchangedOperation(bound)) fail("filesystem_changed");
          // Preserve destination evidence even after a verified external return.
          if (bound.stage === "destination_recorded") tx.update(schema.projectCategoryMoveOperations)
            .set({ stage: "uncertain", problem: "kept_original" }).where(eq(schema.projectCategoryMoveOperations.operationId, bound.operationId)).run();
          tx.update(schema.projectCategoryMoveOperations).set({ stage: "failed", resultKind: "rejected", problem: "kept_original", lastVerifiedPlacement: "original" })
            .where(eq(schema.projectCategoryMoveOperations.operationId, bound.operationId)).run();
          destinationFree(bound, execution);
          return operationFor(bound.operationId)!;
        }, { behavior: "immediate" });
        integration.settled(row.sourceId);
        return { ok: true, value: recordedResult(row) };
      }
      if (request.action === "retry_original") {
        phase = "filesystem";
        destinationFree(row, execution);
        if (!unchangedOperation(row)) fail("filesystem_changed");
        const outcome = native(join(row.canonicalRoot, row.originalRelativePath), join(row.canonicalRoot, row.requestedRelativePath));
        if (outcome !== "renamed") fail(outcome === "invalid_argument" ? "invalid_name" : outcome);
        uniqueDestination(row, false, execution);
      }
      phase = "storage";
      row = evidence(row, execution);
      row = complete(row, execution);
      return { ok: true, value: recordedResult(row) };
    } catch (error) {
      if (!row || !accepted) return stale();
      try {
        const persisted = operationFor(row.operationId)!;
        if (["completed", "failed"].includes(persisted.stage)) return { ok: true, value: recordedResult(persisted) };
        db.update(schema.projectCategoryMoveOperations).set({ stage: "uncertain", problem: problemFor(error, phase) })
          .where(eq(schema.projectCategoryMoveOperations.operationId, row.operationId)).run();
        row = operationFor(row.operationId)!;
      } catch { try { row = operationFor(row.operationId) ?? row; } catch { /* Retain last durable evidence. */ } }
      return { ok: true, value: recordedResult(row) };
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
  return { moveProjectCategory, listProjectCategoryMoves, getProjectCategoryMove, previewProjectCategoryMoveRecovery, recoverProjectCategoryMove,
    invalidateSource,
    removeWorkspace(workspaceId: string) {
      for (const [key, review] of reviews) if (review.execution.workspaceId === workspaceId) reviews.delete(key);
    },
    close() { reviews.clear(); },
  };
}
