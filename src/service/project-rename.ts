import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isProjectRenameRequest, type ProjectRenameOperation, type ProjectRenameProblem,
  type ProjectRenameResult, type ProjectRenameList, type ProjectRenameRecoveryPreview,
  type ProjectRenamePlacementState, type WorkspaceRenameProjectCommand } from "../contracts/project-rename.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isChildName, reliableIdentity, sameIdentity, validArchive, validExclusions, type NativeIdentity } from "./discovery.js";
import { CreationFailure, filesystemCode, filesystemProblem, nativeProjectFilesystem, validProjectBasename,
  verifyCreationDirectory, verifyCreationParents, type ProjectFilesystem } from "./project-filesystem.js";
import { renameNoReplace, type ProjectRenameFilesystemResult } from "./project-rename-filesystem.js";
import { readProjectReservations } from "./project-rename-reservations.js";
import { filesystemAlias } from "./path-alias.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
type Operation = typeof schema.projectRenameOperations.$inferSelect;
export type ProjectRenameNative = (from: string, to: string) => ProjectRenameFilesystemResult;
class RenameFailure extends Error {
  constructor(readonly problem: ProjectRenameProblem) { super(problem); }
}
function operationView(row: Operation): ProjectRenameOperation {
  return { operationId: row.operationId, sourceId: row.sourceId, initiatingWorkspaceId: row.initiatingWorkspaceId,
    projectId: row.projectId, originalName: row.originalName, name: row.name, originalRelativePath: row.originalRelativePath,
    requestedRelativePath: row.requestedRelativePath, mode: row.mode, categoryId: row.categoryId,
    expectedRevision: row.expectedRevision, stage: row.stage, lastVerifiedPlacement: row.lastVerifiedPlacement,
    problem: row.problem, resultKind: row.resultKind, completedRevision: row.completedRevision };
}
function recordedResult(row: Operation): ProjectRenameResult {
  const operation = operationView(row);
  if (row.stage === "completed") return { outcome: row.resultKind as "completed" | "unchanged", operation, project: {
    operationId: row.operationId, sourceId: row.sourceId, projectId: row.projectId, name: row.name,
    relativePath: row.requestedRelativePath, categoryId: row.categoryId, revision: row.completedRevision!,
  } };
  if (row.stage === "failed") return { outcome: "rejected", operation, problem: row.problem! };
  return { outcome: "recoverable", operation };
}

export function createProjectRenameService(db: Database, integration: {
  invalidateSourceReviews(sourceId: string): void;
  committed(sourceId: string, revision: number, workspaceIds: string[]): void;
}, filesystem: ProjectFilesystem = nativeProjectFilesystem, native: ProjectRenameNative = renameNoReplace) {
  type Execution = { workspaceId: string; revision: number };
  const executionFor = (row: Operation): Execution => ({ workspaceId: row.initiatingWorkspaceId, revision: row.expectedRevision });
  const reviews = new Map<string, { row: Operation; execution: Execution; inspected: ReturnType<typeof inspectRecovery>; token: string }>();
  const reviewKey = (workspaceId: string, operationId: string) => `${workspaceId}:${operationId}`;
  function invalidateSource(sourceId: string) {
    for (const [key, review] of reviews) if (review.row.sourceId === sourceId) reviews.delete(key);
  }
  const storage = () => ({ ok: false as const, error: { code: "storage" as const, message: "Rename history could not be read." } });
  const stale = () => ({ ok: false as const, error: { code: "stale_preview" as const, message: "Refresh rename recovery and explicitly review current placements." } });
  function problemFor(error: unknown, phase: "storage" | "filesystem"): ProjectRenameProblem {
    const problem = filesystemProblem(error);
    return error instanceof RenameFailure ? error.problem : error instanceof CreationFailure ?
      (error.problem === "case_alias" ? "occupied" : error.problem) : phase === "filesystem" || /^E[A-Z]+$/.test(String(filesystemCode(error))) ?
        (problem === "case_alias" ? "occupied" : problem) : "storage_error";
  }
  const operationFor = (id: string) => db.select().from(schema.projectRenameOperations)
    .where(eq(schema.projectRenameOperations.operationId, id)).get();
  const unchangedOperation = (row: Operation) => {
    const current = operationFor(row.operationId);
    return !!current && (Object.keys(row) as (keyof Operation)[]).every((key) => current[key] === row[key]);
  };
  const sourceFor = (workspaceId: string) => db.select().from(schema.workspaces)
    .innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
    .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  const invalid = () => ({ ok: false as const, error: { code: "invalid_input" as const, message: "Choose a saved workspace and its immutable project rename request." } });
  const rejected = (problem: ProjectRenameProblem): ServiceResult<ProjectRenameResult> => ({ ok: true, value: { outcome: "rejected", problem, operation: null } });
  const fail = (problem: ProjectRenameProblem): never => { throw new RenameFailure(problem); };
  const relativeName = (row: Operation, name: string) => row.parentRelativePath ? `${row.parentRelativePath}/${name}` : name;

  function policy(row: Operation, path: string) {
    const exclusions: unknown = JSON.parse(row.excludedRelativePaths);
    if (!validExclusions(exclusions, "grouped") || !validArchive(row.archiveRelativePath)) fail("stale_configuration");
    const parts = path.split("/");
    if (parts.some((name) => name.startsWith(".") || ["$RECYCLE.BIN", "SYSTEM VOLUME INFORMATION"].includes(filesystemAlias(name))) ||
      (exclusions as string[]).some((excluded) => filesystemAlias(excluded) === filesystemAlias(path) ||
        row.parentRelativePath && filesystemAlias(excluded) === filesystemAlias(row.parentRelativePath))) fail("excluded");
    const archive = row.archiveRelativePath?.split("/");
    if (archive && filesystemAlias(parts[0]) === filesystemAlias(archive[0]) &&
      (row.mode === "direct" || archive.length === 1 || filesystemAlias(parts[1]) === filesystemAlias(archive[1]))) fail("archive");
  }
  function reservations(row: Operation, paths = [row.originalRelativePath, row.requestedRelativePath, row.stagingRelativePath].filter((p): p is string => p !== null)) {
    const evidence: NativeIdentity = JSON.parse(row.nativeIdentity);
    const records = [
      ...db.select().from(schema.projects).where(eq(schema.projects.sourceId, row.sourceId)).all().filter((p) => p.id !== row.projectId),
      ...db.select().from(schema.categories).where(eq(schema.categories.sourceId, row.sourceId)).all(),
      ...readProjectReservations(db, row.sourceId).filter((o) => o.operationId !== row.operationId),
    ];
    for (const record of records) {
      if (paths.some((path) => filesystemAlias(path) === filesystemAlias(record.relativePath))) fail("reserved_destination");
      if (record.nativeIdentity) {
        const other: NativeIdentity = JSON.parse(record.nativeIdentity);
        if (other.dev === evidence.dev && other.ino === evidence.ino) fail("native_conflict");
      }
    }
  }
  function context(row: Operation, execution = executionFor(row), projectPath = row.originalRelativePath) {
    const source = sourceFor(execution.workspaceId);
    if (!source || source.id !== row.sourceId || source.canonicalRoot !== row.canonicalRoot || source.discoveryMode !== row.mode ||
      source.discoveryRevision !== execution.revision || source.appliedRootIdentity !== row.rootIdentity ||
      source.excludedRelativePaths !== row.excludedRelativePaths || source.archiveRelativePath !== row.archiveRelativePath) fail("stale_configuration");
    if (readProjectReservations(db, row.sourceId).some((o) => o.operationId !== row.operationId)) fail("reserved_destination");
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, row.projectId)).get();
    if (!project || project.sourceId !== row.sourceId || project.relativePath !== projectPath || project.nativeIdentity !== row.nativeIdentity ||
      project.categoryId !== row.categoryId || project.associationState !== "active" || project.modeInactive) fail("project_unavailable");
    if (row.mode === "grouped") {
      const category = db.select().from(schema.categories).where(eq(schema.categories.id, row.categoryId!)).get();
      if (!category || category.sourceId !== row.sourceId || category.relativePath !== row.parentRelativePath ||
        category.nativeIdentity !== row.parentIdentity || category.associationState !== "active" || category.modeInactive) fail("category_unavailable");
    }
    policy(row, row.originalRelativePath); policy(row, row.requestedRelativePath); reservations(row);
    const parent = verifyCreationParents(filesystem, row);
    filesystem.assertAccessible?.(row.canonicalRoot); filesystem.assertAccessible?.(parent);
    if (row.parentRelativePath && !filesystem.names(row.canonicalRoot).includes(row.parentRelativePath)) fail("filesystem_changed");
    return parent;
  }
  function placement(row: Operation, path: string, execution = executionFor(row), projectPath = row.originalRelativePath) {
    const parent = context(row, execution, projectPath);
    if (!filesystem.names(parent).includes(path.split("/").at(-1)!)) fail("filesystem_changed");
    verifyCreationDirectory(filesystem, join(row.canonicalRoot, path), JSON.parse(row.nativeIdentity));
    filesystem.assertAccessible?.(join(row.canonicalRoot, path));
    context(row, execution, projectPath);
    return parent;
  }
  // Only actual full identity can grant the selected current folder a self exception.
  // Folded names reserve other entries but never establish ownership of an alias.
  function destination(row: Operation, from: string, to: string, allowSelf: boolean, execution = executionFor(row)): boolean {
    const parent = placement(row, from, execution), name = to.split("/").at(-1)!;
    let inspected;
    try { inspected = filesystem.inspect(join(row.canonicalRoot, to)); }
    catch (error) { if (filesystemCode(error) !== "ENOENT") throw error; }
    const self = !!inspected && inspected.kind === "directory" && reliableIdentity(inspected.identity) &&
      sameIdentity(inspected.identity, JSON.parse(row.nativeIdentity));
    if (inspected && !(allowSelf && self)) fail("occupied");
    for (const entry of filesystem.names(parent)) {
      if (entry === from.split("/").at(-1)) continue;
      if (entry === name || filesystemAlias(entry) === filesystemAlias(name)) fail("occupied");
    }
    placement(row, from, execution);
    return self;
  }
  function uniquePlacement(row: Operation, path: string, execution = executionFor(row), projectPath = row.originalRelativePath) {
    const parent = placement(row, path, execution, projectPath), names = filesystem.names(parent);
    for (const candidate of new Set([row.originalRelativePath, row.stagingRelativePath, row.requestedRelativePath])) {
      if (!candidate || candidate === path) continue;
      try {
        const entry = filesystem.inspect(join(row.canonicalRoot, candidate));
        const self = entry.kind === "directory" && reliableIdentity(entry.identity) && sameIdentity(entry.identity, JSON.parse(row.nativeIdentity));
        if (self && !names.includes(candidate.split("/").at(-1)!)) continue;
        fail(self ? "native_conflict" : "occupied");
      } catch (error) { if (filesystemCode(error) !== "ENOENT") throw error; }
    }
    for (const candidate of [row.originalRelativePath, row.stagingRelativePath, row.requestedRelativePath]) {
      if (candidate && names.some((name) => name !== path.split("/").at(-1) &&
        filesystemAlias(name) === filesystemAlias(candidate.split("/").at(-1)!))) fail("occupied");
    }
    placement(row, path, execution, projectPath);
  }
  function unchanged(row: Operation) {
    return db.transaction((tx) => {
      destination(row, row.originalRelativePath, row.requestedRelativePath, true);
      tx.insert(schema.projectRenameOperations).values(row).run();
      tx.update(schema.projectRenameOperations).set({ stage: "completed", resultKind: "unchanged", completedRevision: row.expectedRevision })
        .where(eq(schema.projectRenameOperations.operationId, row.operationId)).run();
      destination(row, row.originalRelativePath, row.requestedRelativePath, true);
      return operationFor(row.operationId)!;
    }, { behavior: "immediate" });
  }
  function evidence(row: Operation, staged: boolean, execution = executionFor(row)) {
    const path = staged ? row.stagingRelativePath! : row.requestedRelativePath;
    return db.transaction((tx) => {
      uniquePlacement(row, path, execution);
      if (!unchangedOperation(row)) fail("filesystem_changed");
      // A recorded destination can have been explicitly moved back outside
      // the service. Re-enter staged through uncertainty, retaining all evidence.
      if (staged && row.stage === "destination_recorded") tx.update(schema.projectRenameOperations)
        .set({ stage: "uncertain", problem: "filesystem_changed" }).where(eq(schema.projectRenameOperations.operationId, row.operationId)).run();
      tx.update(schema.projectRenameOperations).set(staged ? {
        stage: "staged", stagedIdentity: row.nativeIdentity, lastVerifiedPlacement: "staged", problem: null,
      } : { stage: "destination_recorded", destinationIdentity: row.nativeIdentity, lastVerifiedPlacement: "destination", problem: null })
        .where(eq(schema.projectRenameOperations.operationId, row.operationId)).run();
      uniquePlacement(row, path, execution);
      return operationFor(row.operationId)!;
    }, { behavior: "immediate" });
  }
  function complete(row: Operation, execution = executionFor(row)) {
    const revision = execution.revision + 1;
    if (!Number.isSafeInteger(revision)) fail("stale_configuration");
    const completed = db.transaction((tx) => {
      uniquePlacement(row, row.requestedRelativePath, execution);
      if (!unchangedOperation(row)) fail("filesystem_changed");
      tx.update(schema.projects).set({ relativePath: row.requestedRelativePath }).where(eq(schema.projects.id, row.projectId)).run();
      tx.update(schema.sources).set({ discoveryRevision: revision }).where(eq(schema.sources.id, row.sourceId)).run();
      tx.update(schema.projectRenameOperations).set({ stage: "completed", resultKind: "completed", completedRevision: revision, problem: null })
        .where(eq(schema.projectRenameOperations.operationId, row.operationId)).run();
      uniquePlacement(row, row.requestedRelativePath, { ...execution, revision }, row.requestedRelativePath);
      return operationFor(row.operationId)!;
    }, { behavior: "immediate" });
    const workspaceIds = db.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId, row.sourceId)).all().map((w) => w.id);
    integration.committed(row.sourceId, revision, workspaceIds);
    return completed;
  }
  function hop(row: Operation, from: string, to: string, execution = executionFor(row), starting = () => {}, returned: (outcome: ProjectRenameFilesystemResult) => void = () => {}) {
    destination(row, from, to, false, execution);
    if (!unchangedOperation(row)) fail("filesystem_changed");
    starting();
    const outcome = native(join(row.canonicalRoot, from), join(row.canonicalRoot, to));
    returned(outcome);
    if (outcome !== "renamed") fail(outcome === "invalid_argument" ? "invalid_name" : outcome);
    placement(row, to, execution);
  }

  function inspectRecovery(row: Operation, execution: Execution) {
    const preview: ProjectRenameRecoveryPreview = { workspaceId: execution.workspaceId, sourceId: row.sourceId,
      operation: operationView(row), revision: execution.revision, originalState: "unavailable",
      stagedState: row.stagingRelativePath ? "unavailable" : null, destinationState: "unavailable",
      problem: null, actions: [], previewToken: null };
    const observations: { path: string; state: ProjectRenamePlacementState; identity: NativeIdentity | null }[] = [];
    let names: string[] = [];
    const reserved = readProjectReservations(db, row.sourceId);
    if (["completed", "failed"].includes(row.stage)) return { preview, observations, names, reserved };
    try {
      const parent = context(row, execution);
      names = filesystem.names(parent).sort();
      for (const path of [...new Set([row.originalRelativePath, row.stagingRelativePath, row.requestedRelativePath].filter((p): p is string => p !== null))]) {
        const name = path.split("/").at(-1)!;
        let state: ProjectRenamePlacementState = "missing", identity: NativeIdentity | null = null;
        try {
          const entry = filesystem.inspect(join(row.canonicalRoot, path));
          identity = entry.identity;
          if (entry.kind === "link") state = "link";
          else if (entry.kind !== "directory" || !reliableIdentity(identity) || !sameIdentity(identity, JSON.parse(row.nativeIdentity))) state = "replaced";
          else if (names.includes(name)) {
            placement(row, path, execution);
            state = "matching";
          }
          // An actual self-alias lookup is counted only at its exact enumerated
          // spelling. Full identity alone cannot create a second placement.
        } catch (error) {
          if (filesystemCode(error) !== "ENOENT") throw error;
        }
        observations.push({ path, state, identity });
      }
      const stateFor = (path: string) => observations.find((entry) => entry.path === path)!.state;
      preview.originalState = stateFor(row.originalRelativePath);
      preview.stagedState = row.stagingRelativePath ? stateFor(row.stagingRelativePath) : null;
      preview.destinationState = stateFor(row.requestedRelativePath);
      const matches = observations.filter((entry) => entry.state === "matching");
      if (observations.some((entry) => !["missing", "matching"].includes(entry.state))) {
        preview.problem = observations.some((entry) => entry.state === "link") ? "destination_link" : "destination_replaced";
      } else if (matches.length !== 1) {
        preview.problem = matches.length ? "native_conflict" : "destination_missing";
        if (matches.length) {
          if (preview.originalState === "matching") preview.originalState = "conflicting";
          if (preview.stagedState === "matching") preview.stagedState = "conflicting";
          if (preview.destinationState === "matching") preview.destinationState = "conflicting";
        }
      } else {
        const path = matches[0].path;
        // Folded aliases other than the selected exact entry remain conflicts.
        for (const candidate of observations) if (names.some((name) =>
          name !== path.split("/").at(-1) && filesystemAlias(name) === filesystemAlias(candidate.path.split("/").at(-1)!))) fail("occupied");
        if (path === row.originalRelativePath) {
          destination(row, path, row.requestedRelativePath, true, execution);
          if (row.stagingRelativePath) destination(row, path, row.stagingRelativePath, false, execution);
          preview.actions = ["retry_original", "keep_original"];
        } else if (path === row.stagingRelativePath) {
          destination(row, path, row.requestedRelativePath, false, execution);
          preview.actions = ["finish_staged"];
        } else preview.actions = ["complete_destination"];
      }
      context(row, execution);
    } catch (error) {
      preview.problem = problemFor(error, "filesystem"); preview.actions = [];
      preview.originalState = preview.destinationState = ["occupied", "native_conflict", "reserved_destination"].includes(preview.problem) ? "conflicting" : "unavailable";
      if (row.stagingRelativePath) preview.stagedState = preview.originalState;
    }
    return { preview, observations, names, reserved };
  }
  function listProjectRenames(input: unknown): ServiceResult<ProjectRenameList> {
    if (!isProjectRenameRequest(input) || input.type !== "workspace.listProjectRenames") return invalid();
    try {
      const source = sourceFor(input.workspaceId);
      if (!source) return invalid();
      const operations = db.select().from(schema.projectRenameOperations).where(eq(schema.projectRenameOperations.sourceId, source.id))
        .all().filter((row) => !["completed", "failed"].includes(row.stage)).map(operationView);
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, operations } };
    } catch { return storage(); }
  }
  function getProjectRename(input: unknown): ServiceResult<ProjectRenameResult> {
    if (!isProjectRenameRequest(input) || input.type !== "workspace.getProjectRename") return invalid();
    try {
      const source = sourceFor(input.workspaceId), row = operationFor(input.operationId);
      if (!source || !row || source.id !== row.sourceId) return invalid();
      return { ok: true, value: recordedResult(row) };
    } catch { return storage(); }
  }
  function previewProjectRenameRecovery(input: unknown): ServiceResult<ProjectRenameRecoveryPreview> {
    if (!isProjectRenameRequest(input) || input.type !== "workspace.previewProjectRenameRecovery") return invalid();
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
  function recoverProjectRename(input: unknown): ServiceResult<ProjectRenameResult> {
    if (!isProjectRenameRequest(input) || input.type !== "workspace.recoverProjectRename") return invalid();
    const request = { ...input }, key = reviewKey(request.workspaceId, request.operationId);
    const review = reviews.get(key);
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
      integration.invalidateSourceReviews(row.sourceId);
      accepted = true;
      if (request.action === "keep_original") {
        const bound = row;
        row = db.transaction((tx) => {
          uniquePlacement(bound, bound.originalRelativePath, execution);
          if (!unchangedOperation(bound)) fail("filesystem_changed");
          // Retain all prior evidence, including evidence of a previous hop.
          if (bound.stage !== "intent" && bound.stage !== "uncertain") tx.update(schema.projectRenameOperations)
            .set({ stage: "uncertain", problem: "kept_original" }).where(eq(schema.projectRenameOperations.operationId, bound.operationId)).run();
          tx.update(schema.projectRenameOperations).set({ stage: "failed", resultKind: "rejected", problem: "kept_original", lastVerifiedPlacement: "original" })
            .where(eq(schema.projectRenameOperations.operationId, bound.operationId)).run();
          uniquePlacement(bound, bound.originalRelativePath, execution);
          return operationFor(bound.operationId)!;
        }, { behavior: "immediate" });
      } else {
        if (request.action === "retry_original" && row.stagingRelativePath) {
          phase = "filesystem"; hop(row, row.originalRelativePath, row.stagingRelativePath, execution);
          phase = "storage"; row = evidence(row, true, execution);
        } else if (request.action === "finish_staged") {
          // A crash after hop one may precede its evidence transaction.
          row = evidence(row, true, execution);
        }
        if (request.action !== "complete_destination") {
          phase = "filesystem";
          hop(row, row.stagingRelativePath ?? row.originalRelativePath, row.requestedRelativePath, execution);
        }
        phase = "storage"; row = evidence(row, false, execution);
        row = complete(row, execution);
      }
      return { ok: true, value: recordedResult(row) };
    } catch (error) {
      if (!row || !accepted) return stale();
      try {
        const persisted = operationFor(row.operationId)!;
        if (["completed", "failed"].includes(persisted.stage)) return { ok: true, value: recordedResult(persisted) };
        db.update(schema.projectRenameOperations).set({ stage: "uncertain", problem: problemFor(error, phase) })
          .where(eq(schema.projectRenameOperations.operationId, row.operationId)).run();
        row = operationFor(row.operationId)!;
      } catch { try { row = operationFor(row.operationId) ?? row; } catch { /* Retain last durable evidence. */ } }
      return { ok: true, value: recordedResult(row) };
    }
  }
  function renameProject(input: unknown): ServiceResult<ProjectRenameResult> {
    if (!isProjectRenameRequest(input) || input.type !== "workspace.renameProject") return invalid();
    const request: WorkspaceRenameProjectCommand = { ...input };
    let intent: Operation | undefined, nativeStarted = false, effect = false;
    let phase: "storage" | "filesystem" = "storage";
    try {
      const source = sourceFor(request.workspaceId);
      if (!source) return invalid();
      const prior = operationFor(request.operationId);
      if (prior) {
        if (prior.initiatingWorkspaceId !== request.workspaceId || prior.sourceId !== source.id || prior.projectId !== request.projectId ||
          prior.name !== request.name || prior.expectedRevision !== request.expectedRevision) return invalid();
        return { ok: true, value: recordedResult(prior) };
      }
      if (!validProjectBasename(request.name, filesystem.platform)) return rejected("invalid_name");
      if ((source.discoveryMode !== "direct" && source.discoveryMode !== "grouped") || !source.appliedRootIdentity) return rejected("unconfigured");
      if (source.discoveryRevision !== request.expectedRevision) return rejected("stale_configuration");
      if (!Number.isSafeInteger(source.discoveryRevision + 1)) return rejected("stale_configuration");
      const project = db.select().from(schema.projects).where(eq(schema.projects.id, request.projectId)).get();
      if (!project || project.sourceId !== source.id || project.associationState !== "active" || project.modeInactive) return rejected("project_unavailable");
      if (source.discoveryMode === "direct" && project.categoryId !== null) return rejected("project_unavailable");
      const category = project.categoryId ? db.select().from(schema.categories).where(eq(schema.categories.id, project.categoryId)).get() : null;
      if (source.discoveryMode === "grouped" && (!category || !isChildName(category.relativePath) || !validProjectBasename(category.relativePath, filesystem.platform))) return rejected("category_unavailable");
      const parentRelativePath = source.discoveryMode === "grouped" ? category!.relativePath : "";
      const originalName = project.relativePath.split("/").at(-1)!;
      if (!validProjectBasename(originalName, filesystem.platform) || project.relativePath !== (parentRelativePath ? `${parentRelativePath}/${originalName}` : originalName)) return rejected("project_unavailable");
      const row: Operation = {
        operationId: request.operationId, initiatingWorkspaceId: request.workspaceId, sourceId: source.id, projectId: project.id,
        originalName, name: request.name, mode: source.discoveryMode, categoryId: project.categoryId, expectedRevision: request.expectedRevision,
        canonicalRoot: source.canonicalRoot, parentRelativePath, originalRelativePath: project.relativePath,
        requestedRelativePath: parentRelativePath ? `${parentRelativePath}/${request.name}` : request.name, stagingRelativePath: null,
        rootIdentity: source.appliedRootIdentity, parentIdentity: category?.nativeIdentity ?? source.appliedRootIdentity,
        nativeIdentity: project.nativeIdentity, excludedRelativePaths: source.excludedRelativePaths, archiveRelativePath: source.archiveRelativePath,
        stage: "intent", stagedIdentity: null, destinationIdentity: null, lastVerifiedPlacement: "original",
        lastVerifiedIdentity: project.nativeIdentity, problem: null, resultKind: null, completedRevision: null,
      };
      phase = "filesystem";
      placement(row, row.originalRelativePath);
      if (row.name === row.originalName) {
        phase = "storage";
        return { ok: true, value: recordedResult(unchanged(row)) };
      }
      const self = destination(row, row.originalRelativePath, row.requestedRelativePath, true);
      if (self) {
        for (let attempt = 0; ; attempt++) {
          if (attempt === 16) fail("reserved_destination");
          row.stagingRelativePath = relativeName(row, `.workspace-rename-${randomUUID()}`);
          try { reservations(row); destination(row, row.originalRelativePath, row.stagingRelativePath, false); break; }
          catch (error) { if (!(error instanceof RenameFailure) || !["occupied", "reserved_destination"].includes(error.problem)) throw error; }
        }
      }
      phase = "storage";
      db.transaction((tx) => {
        placement(row, row.originalRelativePath);
        if (destination(row, row.originalRelativePath, row.requestedRelativePath, true) !== self) fail("filesystem_changed");
        if (self) destination(row, row.originalRelativePath, row.stagingRelativePath!, false);
        tx.insert(schema.projectRenameOperations).values(row).run();
        placement(row, row.originalRelativePath);
      }, { behavior: "immediate" });
      intent = row;
      integration.invalidateSourceReviews(row.sourceId);
      const executeHop = (from: string, to: string) => {
        phase = "filesystem";
        hop(intent!, from, to, executionFor(row), () => { nativeStarted = true; }, (outcome) => { nativeStarted = false; if (outcome === "renamed") effect = true; });
      };
      if (self) {
        // Self-alias ownership was revalidated inside intent; the first target is
        // a separately reserved absent hidden entry in the same real parent.
        executeHop(row.originalRelativePath, row.stagingRelativePath!);
        phase = "storage"; intent = evidence(intent, true);
        executeHop(row.stagingRelativePath!, row.requestedRelativePath);
      } else executeHop(row.originalRelativePath, row.requestedRelativePath);
      phase = "storage"; intent = evidence(intent, false);
      return { ok: true, value: recordedResult(complete(intent)) };
    } catch (error) {
      const problem = problemFor(error, phase);
      if (!intent) return rejected(problem);
      try {
        let persisted = operationFor(intent.operationId)!;
        if (["completed", "failed"].includes(persisted.stage)) return { ok: true, value: recordedResult(persisted) };
        let noEffect = !nativeStarted && !effect;
        if (noEffect) { try { placement(persisted, persisted.originalRelativePath); } catch { noEffect = false; } }
        db.update(schema.projectRenameOperations).set(noEffect ? { stage: "failed", resultKind: "rejected", problem } : { stage: "uncertain", problem })
          .where(eq(schema.projectRenameOperations.operationId, intent.operationId)).run();
        persisted = operationFor(intent.operationId)!;
        return { ok: true, value: recordedResult(persisted) };
      } catch {
        // An uncertainty write may fail. Durable intent/evidence remains the
        // authoritative recoverable status; never fabricate terminal success.
        try { intent = operationFor(intent.operationId) ?? intent; } catch { /* Keep last durable evidence. */ }
        return { ok: true, value: recordedResult(intent) };
      }
    }
  }
  return { renameProject, listProjectRenames, getProjectRename, previewProjectRenameRecovery, recoverProjectRename, invalidateSource,
    removeWorkspace(workspaceId: string) {
      for (const [key, review] of reviews) if (review.execution.workspaceId === workspaceId) reviews.delete(key);
    },
    close() { reviews.clear(); },
  };
}
