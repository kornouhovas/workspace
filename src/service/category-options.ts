import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isCategoryOptionsRequest, type CategoryFolderPreview, type CategoryFolderOperation, type CategoryFolderResult, type CategoryFolderStatus, type CategoryFolderRecoveryPreview, type CategoryPresentationSnapshot } from "../contracts/category-options.js";
import type { ServiceResult } from "../contracts/settings.js";
import { nativeProjectFilesystem, validProjectBasename, verifyCreationDirectory, assertCreationDestinationFree, filesystemProblem, type ProjectFilesystem } from "./project-filesystem.js";
import { reliableIdentity, scanGroupedSource, projectExclusions } from "./discovery.js";
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
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
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
  filesystem: ProjectFilesystem = nativeProjectFilesystem, native: (from: string, to: string) => ProjectRenameFilesystemResult = renameNoReplace) {
  const recoveryReviews = new Map<string, { token: string; row: Operation; fingerprint: string; actions: ("complete_destination" | "keep_original")[] }>();
  const reviews = new Map<string, { preview: CategoryFolderPreview; binding: Binding }>();
  const sourceFor = (workspaceId: string) => db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
    .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  const operationFor = (operationId: string) => db.select().from(schema.categoryFolderOperations).where(eq(schema.categoryFolderOperations.operationId, operationId)).get();
  function scan(source: Source) {
    if (source.discoveryMode !== "grouped" || !source.appliedRootIdentity) throw new Error("Unconfigured");
    verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity));
    const scan = scanGroupedSource(source.canonicalRoot, source.archiveRelativePath, projectExclusions(JSON.parse(source.excludedRelativePaths), "grouped").effective);
    if (!scan.snapshot || !same(scan.snapshot.root.identity, JSON.parse(source.appliedRootIdentity))) throw new Error("Changed root");
    return scan;
  }
  function verifyBinding(row: Operation, workspaceId: string) {
    const b: Binding = JSON.parse(row.binding), source = sourceFor(workspaceId);
    // Text and property-label revisions are independent of folder authorization.
    const policy = (s: Source) => ({ ...s, propertyRevision: 0, categoryPropertyRevision: 0 });
    if (!source || !same(policy(source), policy(b.source))) throw new Error("Configuration changed");
    verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity!));
    filesystem.assertAccessible?.(source.canonicalRoot);
    if (readProjectReservations(db, source.id).some(r => r.operationKind !== "category_folder" || r.operationId !== row.operationId)) throw new Error("Reserved source");
    if (b.category && !same(db.select().from(schema.categories).where(eq(schema.categories.id, b.category.id)).get(), b.category)) throw new Error("Category changed");
    if (b.category && !same(db.select().from(schema.projects).where(eq(schema.projects.categoryId, b.category.id)).orderBy(asc(schema.projects.id)).all(), b.members)) throw new Error("Projects changed");
    return b;
  }
  function verifyPlacement(row: Operation, workspaceId: string, path: string) {
    const b = verifyBinding(row, workspaceId);
    if (!row.nativeIdentity) throw new Error("No ownership evidence");
    const absolute = join(b.source.canonicalRoot, path);
    if (!filesystem.names(b.source.canonicalRoot).includes(path)) throw new Error("Spelling changed");
    verifyCreationDirectory(filesystem, absolute, JSON.parse(row.nativeIdentity));
    filesystem.assertAccessible?.(absolute);
    const observed = scan(b.source);
    const originalSnapshot = b.snapshot as NonNullable<ReturnType<typeof scan>["snapshot"]>;
    const expected = originalSnapshot.children.filter(c => c.relativePath.startsWith(`${row.originalRelativePath}/`));
    const actual = observed.snapshot!.children.filter(c => c.relativePath.startsWith(`${path}/`));
    if (row.action === "create" && filesystem.names(absolute).length) throw new Error("New folder changed");
    if (row.action === "associate" && !same(observed.snapshot, b.snapshot)) throw new Error("Association changed");
    if (row.action === "rename" && !same(expected.map(c => ({ ...c, relativePath: c.relativePath.slice(row.originalRelativePath!.length) })),
      actual.map(c => ({ ...c, relativePath: c.relativePath.slice(path.length) })))) throw new Error("Category contents changed");
    verifyBinding(row, workspaceId);
    return b;
  }
  function complete(row: Operation, workspaceId: string) {
    const b = verifyPlacement(row, workspaceId, row.requestedRelativePath);
    if (row.originalRelativePath) assertCreationDestinationFree(filesystem, b.source.canonicalRoot, row.originalRelativePath);
    const revision = b.source.discoveryRevision + 1;
    if (!Number.isSafeInteger(revision)) throw new Error("Revision exhausted");
    db.transaction(tx => {
      verifyPlacement(row, workspaceId, row.requestedRelativePath);
      if (row.action === "rename") {
        // Temporarily retire members inside the transaction to preserve existing
        // grouped ownership guards while changing parent and child locators.
        for (const member of b.members) tx.update(schema.projects).set({ modeInactive: true }).where(eq(schema.projects.id, member.id)).run();
        tx.update(schema.categories).set({ relativePath: row.requestedRelativePath }).where(eq(schema.categories.id, row.categoryId)).run();
        for (const member of b.members) tx.update(schema.projects).set({ relativePath: row.requestedRelativePath + member.relativePath.slice(row.originalRelativePath!.length), modeInactive: member.modeInactive }).where(eq(schema.projects.id, member.id)).run();
      } else {
        tx.insert(schema.categories).values({ id: row.categoryId, sourceId: b.source.id, relativePath: row.requestedRelativePath, nativeIdentity: row.nativeIdentity!, associationState: "active", durableEvidence: null, modeInactive: false }).run();
        for (const project of b.additions) tx.insert(schema.projects).values({ ...project, categoryId: row.categoryId }).run();
      }
      tx.update(schema.sources).set({ discoveryRevision: revision }).where(eq(schema.sources.id, b.source.id)).run();
      tx.update(schema.categoryFolderOperations).set({ stage: "completed", completedRevision: revision, problem: null }).where(eq(schema.categoryFolderOperations.operationId, row.operationId)).run();
      verifyCreationDirectory(filesystem, b.source.canonicalRoot, JSON.parse(b.source.appliedRootIdentity!));
      verifyCreationDirectory(filesystem, join(b.source.canonicalRoot, row.requestedRelativePath), JSON.parse(row.nativeIdentity!));
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
      const observed = scan(source);
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
        verifyCreationDirectory(filesystem, join(source.canonicalRoot, category.relativePath), JSON.parse(category.nativeIdentity));
        if (!observed.entries.some(c => c.kind === "category" && c.relativePath === category.relativePath && c.reason === null)) return failure();
        // Retained or mode-inactive members need explicit recovery, never a bulk
        // rewrite of historical placements masquerading as a category rename.
        if (members.some(m => m.modeInactive || m.associationState !== "active" || !m.relativePath.startsWith(`${category.relativePath}/`))) return failure();
        for (const m of members) verifyCreationDirectory(filesystem, join(source.canonicalRoot, ...m.relativePath.split("/")), JSON.parse(m.nativeIdentity));
        const eligible = observed.entries.filter(c => c.kind === "project" && c.relativePath.startsWith(`${category.relativePath}/`));
        if (eligible.some(c => c.reason !== null || !members.some(m => m.relativePath === c.relativePath))) return failure();
      }
      const preview: CategoryFolderPreview = { workspaceId: input.workspaceId, sourceId: source.id, action: input.action, categoryId: category?.id ?? null,
        originalRelativePath: category?.relativePath ?? null, requestedRelativePath: input.name, revision: source.discoveryRevision,
        affectedProjects: [...members, ...additions].map(m => ({ projectId: input.action === "associate" ? null : m.id, name: m.relativePath.split("/").at(-1)!, originalRelativePath: m.relativePath, requestedRelativePath: input.action === "associate" ? m.relativePath : input.name + m.relativePath.slice(category!.relativePath.length) })), previewToken: randomUUID() };
      reviews.set(input.workspaceId, { preview, binding: { source, snapshot: observed.snapshot, category: category ?? null, members, additions, associationIdentity } });
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
      if (!review || review.preview.previewToken !== input.previewToken || !same(source, review.binding.source) ||
        readProjectReservations(db, source.id).length || !same(scan(source).snapshot, review.binding.snapshot)) return stale();
      const name = review.preview.requestedRelativePath;
      if (review.preview.action !== "associate") assertCreationDestinationFree(filesystem, source.canonicalRoot, name);
      row = { operationId: input.operationId, sourceId: source.id, workspaceId: input.workspaceId, previewToken: input.previewToken,
        categoryId: review.preview.categoryId ?? randomUUID(), action: review.preview.action, originalRelativePath: review.preview.originalRelativePath, requestedRelativePath: name,
        binding: JSON.stringify(review.binding), nativeIdentity: review.binding.category?.nativeIdentity ?? review.binding.associationIdentity, stage: "intent", problem: null, completedRevision: null };
      db.transaction(tx => {
        if (!same(sourceFor(input.workspaceId), source) || readProjectReservations(db, source.id).length || !same(scan(source).snapshot, review.binding.snapshot)) throw new Error("Stale review");
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
      const nativeIdentity = JSON.stringify(identity.identity);
      if (row.nativeIdentity && row.nativeIdentity !== nativeIdentity) throw new Error("Destination replaced");
      verifyPlacement({ ...row, nativeIdentity }, input.workspaceId, name);
      db.update(schema.categoryFolderOperations).set({ nativeIdentity, stage: "destination_recorded" }).where(eq(schema.categoryFolderOperations.operationId, row.operationId)).run();
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
      return result(operationFor(row.operationId) ?? row);
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
  function inspectRecovery(row: Operation, workspaceId: string) {
    const b = verifyBinding(row, workspaceId);
    const placement = (path: string | null): "matching" | "missing" | "changed" => {
      if (path === null) return "missing";
      try {
        assertCreationDestinationFree(filesystem, b.source.canonicalRoot, path);
        return "missing";
      } catch { /* Inspect exact ownership, never adopt a directory by path. */ }
      try { verifyPlacement(row, workspaceId, path); return "matching"; } catch { return "changed"; }
    };
    const originalState = placement(row.originalRelativePath), destinationState = placement(row.requestedRelativePath);
    const actions: ("complete_destination" | "keep_original")[] = [];
    if (originalState === "missing" && destinationState === "matching") actions.push("complete_destination");
    if (destinationState === "missing" && (row.action === "create" || originalState === "matching")) actions.push("keep_original");
    if (row.action === "associate" && destinationState === "matching") actions.push("keep_original");
    return { originalState, destinationState, actions,
      fingerprint: JSON.stringify({ row, snapshot: scan(b.source).snapshot, reservations: readProjectReservations(db, b.source.id) }) };
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
      if (token) recoveryReviews.set(key, { token, row, fingerprint: observed.fingerprint, actions: observed.actions });
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
      if (inspectRecovery(row, input.workspaceId).fingerprint !== review.fingerprint) return stale();
      if (input.action === "keep_original") {
        db.transaction(tx => {
          if (inspectRecovery(row!, input.workspaceId).fingerprint !== review.fingerprint) throw new Error("Stale recovery");
          tx.update(schema.categoryFolderOperations).set({ stage: "failed", problem: "kept_original" }).where(eq(schema.categoryFolderOperations.operationId, row!.operationId)).run();
        }, { behavior: "immediate" });
        return result(operationFor(row.operationId)!);
      }
      verifyPlacement(row, input.workspaceId, row.requestedRelativePath);
      if (row.stage === "intent") {
        db.update(schema.categoryFolderOperations).set({ stage: "destination_recorded" }).where(eq(schema.categoryFolderOperations.operationId, row.operationId)).run();
        row = operationFor(row.operationId)!;
      }
      return complete(row, input.workspaceId);
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
