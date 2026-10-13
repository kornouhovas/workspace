import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isCategoryRemovalRequest, type CategoryRemovalPreview, type CategoryRemovalResult, type CategoryRemovalLookup, type CategoryRemovalList, type CategoryRemovalOperation, type CategoryRemovalRecoveryPreview } from "../contracts/category-removal.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isChildName, validArchive, validExclusions } from "./discovery.js";
import { filesystemAlias } from "./path-alias.js";
import { assertCreationDestinationFree, filesystemCode, filesystemProblem, nativeProjectFilesystem, validProjectBasename, verifyCreationDirectory, type ProjectFilesystem } from "./project-filesystem.js";
import { readProjectReservations } from "./project-rename-reservations.js";
import type { createProjectCategoryMoveService } from "./project-category-move.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
type Source = typeof schema.sources.$inferSelect;
type Category = typeof schema.categories.$inferSelect;
type Project = typeof schema.projects.$inferSelect;
type Operation = typeof schema.categoryRemovalOperations.$inferSelect;
type Binding = { source: Source; category: Category; destination: Category | null; members: Project[] };
class RemovalFailure extends Error { constructor(readonly problem: string) { super(problem); } }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function createCategoryRemovalService(db: Database, moves: ReturnType<typeof createProjectCategoryMoveService>,
  committed: (sourceId: string, revision: number, workspaceIds: string[]) => void,
  filesystem: ProjectFilesystem = nativeProjectFilesystem) {
  const reviews = new Map<string, { preview: CategoryRemovalPreview; binding: Binding; fingerprint: string }>();
  const recoveryReviews = new Map<string, { sourceId: string; token: string; fingerprint: string; actions: ("retry_remaining" | "abandon")[] }>();
  const sourceFor = (workspaceId: string) => db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
    .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  const operationFor = (id: string) => db.select().from(schema.categoryRemovalOperations).where(eq(schema.categoryRemovalOperations.operationId, id)).get();
  const stale = (): ServiceResult<never> => ({ ok: false, error: { code: "stale_preview", message: "Refresh and explicitly review the current category removal." } });
  const storage = (): ServiceResult<never> => ({ ok: false, error: { code: "storage", message: "Category removal state could not be read or saved." } });
  function topology(binding: Binding) {
    const { source, category, destination } = binding;
    verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity!));
    const result = ["", category.relativePath, ...(destination ? [destination.relativePath] : [])].map(relativePath => {
      const path = join(source.canonicalRoot, relativePath);
      let entry: ReturnType<ProjectFilesystem["inspect"]>;
      try { entry = filesystem.inspect(path); }
      catch (error) { if (relativePath === category.relativePath && filesystemCode(error) === "ENOENT") return { relativePath, entry: null, children: [] }; throw error; }
      const expected = relativePath === "" ? source.appliedRootIdentity! : relativePath === category.relativePath ? category.nativeIdentity : destination!.nativeIdentity;
      verifyCreationDirectory(filesystem, path, JSON.parse(expected));
      if (entry.kind !== "directory") throw new RemovalFailure("filesystem_changed");
      return { relativePath, entry, children: filesystem.names(path).sort().map(name => ({ name, ...filesystem.inspect(join(path, name)) })) };
    });
    verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity!));
    return result;
  }
  function fingerprint(binding: Binding, workspaceId: string, operation?: Operation) {
    let observed: unknown;
    try { observed = topology(binding); } catch { observed = "unavailable"; }
    return JSON.stringify({ source: sourceFor(workspaceId), categories: db.select().from(schema.categories).where(eq(schema.categories.sourceId, binding.source.id)).orderBy(asc(schema.categories.id)).all(),
      projects: db.select().from(schema.projects).where(eq(schema.projects.sourceId, binding.source.id)).orderBy(asc(schema.projects.id)).all(),
      reservations: readProjectReservations(db, binding.source.id), observed, operation,
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
      verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity));
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
        verifyCreationDirectory(filesystem, join(source.canonicalRoot, c.relativePath), JSON.parse(c.nativeIdentity));
        filesystem.assertAccessible?.(join(source.canonicalRoot, c.relativePath));
      }
      const initialTopology = topology({ source, category, destination: destination ?? null, members: [] });
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
          verifyCreationDirectory(filesystem, join(source.canonicalRoot, p.relativePath), JSON.parse(p.nativeIdentity));
        } catch { blockers.push({ relativePath: p.relativePath, problem: "project_unavailable" }); }
        const requested = projects[index].requestedRelativePath;
        if (destinationNames.has(filesystemAlias(name)) || occupiedPaths.has(filesystemAlias(requested)) || plannedCounts.get(filesystemAlias(requested))! > 1) {
          blockers.push({ relativePath: requested, problem: "occupied" });
        }
        if (exclusions.some(p => filesystemAlias(p) === filesystemAlias(requested))) blockers.push({ relativePath: requested, problem: "excluded" });
        if (source.archiveRelativePath && filesystemAlias(source.archiveRelativePath.split("/").slice(0, 2).join("/")) === filesystemAlias(requested)) blockers.push({ relativePath: requested, problem: "archive" });
      }
      verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity));
      const preview: CategoryRemovalPreview = { workspaceId: input.workspaceId, sourceId: source.id, categoryId: category.id,
        destinationCategoryId: destination?.id ?? null, originalRelativePath: category.relativePath, destinationRelativePath: destination?.relativePath ?? null,
        revision: source.discoveryRevision, projects, blockers, previewToken: randomUUID() };
      const binding: Binding = { source, category, destination: destination ?? null, members };
      if (!same(initialTopology, topology(binding)) || !same(sourceFor(input.workspaceId), source)) return stale();
      const reviewFingerprint = fingerprint(binding, input.workspaceId);
      reviews.set(input.workspaceId, { preview, binding, fingerprint: reviewFingerprint });
      return { ok: true, value: preview };
    } catch { return { ok: false, error: { code: "filesystem", message: "Category folders could not be verified. Refresh and review their current state." } }; }
  }
  function inspectBatch(row: Operation, workspaceId: string) {
    const b: Binding = JSON.parse(row.binding), source = sourceFor(workspaceId), view = operationView(row);
    if (!source || source.id !== row.sourceId || source.canonicalRoot !== b.source.canonicalRoot || source.discoveryMode !== "grouped" ||
      source.appliedRootIdentity !== b.source.appliedRootIdentity || source.excludedRelativePaths !== b.source.excludedRelativePaths || source.archiveRelativePath !== b.source.archiveRelativePath ||
      source.discoveryRevision !== b.source.discoveryRevision + view.projects.filter(p => p.outcome === "completed").length) throw new RemovalFailure("stale_configuration");
    for (const c of [b.category, ...(b.destination ? [b.destination] : [])]) {
      if (!same(db.select().from(schema.categories).where(eq(schema.categories.id, c.id)).get(), c)) throw new RemovalFailure("category_unavailable");
    }
    const attempts = db.select().from(schema.categoryRemovalAttempts).where(eq(schema.categoryRemovalAttempts.removalId, row.operationId)).all();
    if (readProjectReservations(db, row.sourceId).some(r => !(r.operationKind === "category_removal" && r.operationId === row.operationId) &&
      !(r.operationKind === "category_move" && attempts.some(a => a.moveId === r.operationId)))) throw new RemovalFailure("reserved_destination");
    verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity!));
    const rootNames = filesystem.names(source.canonicalRoot);
    const originalPath = join(source.canonicalRoot, b.category.relativePath);
    const originalMissing = !rootNames.some(n => filesystemAlias(n) === filesystemAlias(b.category.relativePath));
    if (originalMissing && row.stage !== "cleanup_intent") throw new RemovalFailure("category_unavailable");
    for (const c of [...(originalMissing ? [] : [b.category]), ...(b.destination ? [b.destination] : [])]) {
      if (rootNames.filter(n => filesystemAlias(n) === filesystemAlias(c.relativePath)).join() !== c.relativePath) throw new RemovalFailure("filesystem_changed");
      verifyCreationDirectory(filesystem, join(source.canonicalRoot, c.relativePath), JSON.parse(c.nativeIdentity));
      filesystem.assertAccessible?.(join(source.canonicalRoot, c.relativePath));
    }
    const records = db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all();
    if (records.some(p => p.categoryId === b.category.id && !b.members.some(m => m.id === p.id))) throw new RemovalFailure("unexpected_entry");
    const allowedNames = new Set(view.projects.filter(p => p.outcome !== "completed").map(p => p.originalRelativePath.split("/").at(-1)!));
    if (!originalMissing && filesystem.names(originalPath).some(name => !allowedNames.has(name))) throw new RemovalFailure("unexpected_entry");
    for (const [i, p] of b.members.entries()) {
      const outcome = view.projects[i], record = records.find(r => r.id === p.id), completed = outcome.outcome === "completed";
      if (!record || record.nativeIdentity !== p.nativeIdentity || record.modeInactive || record.associationState !== "active" ||
        record.relativePath !== (completed ? outcome.requestedRelativePath : p.relativePath) || record.categoryId !== (completed ? b.destination!.id : b.category.id)) throw new RemovalFailure("project_unavailable");
      if (outcome.outcome === "recoverable") {
        const attempt = lastAttempt(row.operationId, p.id)!;
        const recovery = moves.previewProjectCategoryMoveRecovery({ type: "workspace.previewProjectCategoryMoveRecovery", workspaceId, operationId: attempt.moveId });
        if (!recovery.ok || !recovery.value.actions.some(a => a === "retry_original" || a === "complete_destination")) throw new RemovalFailure("ownership_uncertain");
      } else {
        const path = completed ? outcome.requestedRelativePath : p.relativePath;
        verifyCreationDirectory(filesystem, join(source.canonicalRoot, path), JSON.parse(p.nativeIdentity));
        filesystem.assertAccessible?.(join(source.canonicalRoot, path));
        if (!completed) assertCreationDestinationFree(filesystem, join(source.canonicalRoot, b.destination!.relativePath), p.relativePath.split("/").at(-1)!);
        else if (!originalMissing) assertCreationDestinationFree(filesystem, originalPath, p.relativePath.split("/").at(-1)!);
      }
    }
    verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity!));
    if (row.stage === "cleanup_intent" && view.projects.some(p => p.outcome !== "completed")) throw new RemovalFailure("ownership_uncertain");
    return { binding: b, source, originalMissing, view, records };
  }
  function execute(row: Operation, workspaceId: string): ServiceResult<CategoryRemovalResult> {
    try {
      let inspected = inspectBatch(row, workspaceId);
      if (row.stage === "moving") {
        for (const p of inspected.binding.members) {
          // Recheck the whole reviewed membership between individual effects.
          inspected = inspectBatch(row, workspaceId);
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
            db.transaction(tx => { inspectBatch(row, workspaceId); tx.insert(schema.categoryRemovalAttempts).values(next).run(); }, { behavior: "immediate" });
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
          const current = inspectBatch(row, workspaceId);
          if (current.view.projects.some(p => p.outcome !== "completed") || filesystem.names(join(current.source.canonicalRoot, row.originalRelativePath)).length) throw new RemovalFailure("unexpected_entry");
          tx.update(schema.categoryRemovalOperations).set({ stage: "cleanup_intent", problem: null }).where(eq(schema.categoryRemovalOperations.operationId, row.operationId)).run();
        }, { behavior: "immediate" });
        row = operationFor(row.operationId)!;
      }
      inspected = inspectBatch(row, workspaceId);
      if (!inspected.originalMissing) {
        if (filesystem.names(join(inspected.source.canonicalRoot, row.originalRelativePath)).length) throw new RemovalFailure("unexpected_entry");
        if (!filesystem.removeEmptyDirectory) throw new RemovalFailure("unsupported");
        // Deliberately nonrecursive: a late arrival makes the OS reject cleanup.
        verifyCreationDirectory(filesystem, inspected.source.canonicalRoot, JSON.parse(inspected.source.appliedRootIdentity!));
        verifyCreationDirectory(filesystem, join(inspected.source.canonicalRoot, row.originalRelativePath), JSON.parse(row.nativeIdentity));
        filesystem.removeEmptyDirectory(join(inspected.source.canonicalRoot, row.originalRelativePath));
      }
      const revision = inspected.source.discoveryRevision + 1;
      if (!Number.isSafeInteger(revision)) throw new RemovalFailure("stale_configuration");
      db.transaction(tx => {
        const current = inspectBatch(row, workspaceId);
        if (!current.originalMissing) throw new RemovalFailure("filesystem_changed");
        tx.update(schema.categories).set({ associationState: "missing" }).where(eq(schema.categories.id, row.categoryId)).run();
        tx.update(schema.sources).set({ discoveryRevision: revision }).where(eq(schema.sources.id, row.sourceId)).run();
        tx.update(schema.categoryRemovalOperations).set({ stage: "completed", problem: null, completedRevision: revision }).where(eq(schema.categoryRemovalOperations.operationId, row.operationId)).run();
        verifyCreationDirectory(filesystem, current.source.canonicalRoot, JSON.parse(current.source.appliedRootIdentity!));
        assertCreationDestinationFree(filesystem, current.source.canonicalRoot, row.originalRelativePath);
        if (!same(sourceFor(workspaceId), { ...current.source, discoveryRevision: revision }) ||
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
      if (!review || review.preview.previewToken !== input.previewToken || review.preview.blockers.length ||
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
  function previewCategoryRemovalRecovery(input: unknown): ServiceResult<CategoryRemovalRecoveryPreview> {
    if (!isCategoryRemovalRequest(input) || input.type !== "workspace.previewCategoryRemovalRecovery") return invalid();
    const key = `${input.workspaceId}:${input.operationId}`; recoveryReviews.delete(key);
    try {
      const source = sourceFor(input.workspaceId), row = operationFor(input.operationId);
      if (!source || !row || row.sourceId !== source.id || row.stage === "completed" || row.stage === "abandoned") return invalid();
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
    const key = `${input.workspaceId}:${input.operationId}`, review = recoveryReviews.get(key); recoveryReviews.delete(key);
    if (!review || review.token !== input.previewToken || !review.actions.includes(input.action)) return stale();
    try {
      const row = operationFor(input.operationId); if (!row) return invalid();
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
