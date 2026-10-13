import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isArchiveRequest, type ProjectArchivePreview, type ProjectArchiveOperation, type ProjectArchiveResult, type ProjectArchiveRecoveryPreview, type ProjectArchiveOperationList } from "../contracts/project-archive.js";
import { nativeProjectFilesystem, verifyCreationDirectory, validProjectBasename, filesystemCode, assertCreationDestinationFree, type ProjectFilesystem } from "./project-filesystem.js";
import { readProjectReservations } from "./project-rename-reservations.js";
import { filesystemAlias } from "./path-alias.js";
import { reliableIdentity, sameIdentity, type NativeIdentity } from "./discovery.js";
import { renameNoReplace } from "./project-rename-filesystem.js";
import type { ProjectRenameNative } from "./project-rename.js";

type Database = BetterSQLite3Database<typeof schema>;
type Source = typeof schema.sources.$inferSelect;
type Project = typeof schema.projects.$inferSelect;
type Archive = typeof schema.projectArchives.$inferSelect;
type Operation = typeof schema.projectArchiveOperations.$inferSelect;
type Parent = { path: string; identity: NativeIdentity | null };
type Binding = { source: Source; project: Project; archive: Archive | null; category: typeof schema.categories.$inferSelect | null;
  sourceParents: Parent[]; destinationParents: Parent[]; createParent: boolean; mode: "direct" | "grouped"; categoryName: string | null };
class ArchiveFailure extends Error {}
const fail = (reason: string): never => { throw new ArchiveFailure(reason); };
const problem = (e: unknown) => e instanceof ArchiveFailure ? e.message : filesystemCode(e) === "ENOENT" ? "source_unavailable"
  : ["EACCES", "EPERM", "EROFS"].includes(String(filesystemCode(e))) ? "permission_denied" : "filesystem_changed";
const invalid = (): ServiceResult<never> => ({ ok: false, error: { code: "invalid_input", message: "Invalid or stale archive request. Review again." } });
const storage = (): ServiceResult<never> => ({ ok: false, error: { code: "storage", message: "Archive state could not be read or saved." } });
const view = (r: Operation): ProjectArchiveOperation => ({ operationId: r.operationId, sourceId: r.sourceId, projectId: r.projectId, action: r.action,
  originalRelativePath: r.originalRelativePath, requestedRelativePath: r.requestedRelativePath, stage: r.stage, problem: r.problem, completedRevision: r.completedRevision });
export function createProjectArchiveMutations(db: Database, integration: {
  invalidateSourceReviews(sourceId: string): void;
  committed(sourceId: string, revision: number, workspaceIds: string[]): void;
}, filesystem: ProjectFilesystem = nativeProjectFilesystem, native: ProjectRenameNative = renameNoReplace) {
  const reviews = new Map<string, { sourceId: string; workspaceId: string; token: string; preview: ProjectArchivePreview; binding: Binding }>();
  const recoveryReviews = new Map<string, { sourceId: string; token: string; fingerprint: string }>();
  const sourceFor = (id: string) => db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
    .where(eq(schema.workspaces.id, id)).get()?.sources;
  const operationFor = (id: string) => db.select().from(schema.projectArchiveOperations).where(eq(schema.projectArchiveOperations.operationId, id)).get();
  const projectFor = (id: string) => db.select().from(schema.projects).where(eq(schema.projects.id, id)).get();
  const archiveFor = (id: string) => db.select().from(schema.projectArchives).where(eq(schema.projectArchives.projectId, id)).get() ?? null;
  const eqJSON = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  function root(source: Source) {
    if (!source.appliedRootIdentity) fail("unconfigured");
    verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity!));
    filesystem.assertAccessible?.(source.canonicalRoot);
  }
  function validPath(path: string) {
    return path.split("/").every(p => validProjectBasename(p, filesystem.platform) && !p.startsWith(".") && !/^(\$RECYCLE.BIN|System Volume Information)$/i.test(p));
  }
  function parents(source: Source, path: string): Parent[] {
    root(source);
    const parts = path.split("/").slice(0, -1), entries: Parent[] = [];
    let parent = source.canonicalRoot, missing = false;
    for (let i = 0; i < parts.length; i++) {
      const relative = parts.slice(0, i + 1).join("/");
      if (missing) { entries.push({ path: relative, identity: null }); continue; }
      const names = filesystem.names(parent);
      if (names.some(n => n !== parts[i] && filesystemAlias(n) === filesystemAlias(parts[i]))) fail("occupied");
      const path = join(parent, parts[i]);
      try {
        const entry = filesystem.inspect(path);
        if (entry.kind !== "directory" || !reliableIdentity(entry.identity) || filesystem.realpath(path) !== path) fail("unsafe_parent");
        verifyCreationDirectory(filesystem, path, entry.identity);
        filesystem.assertAccessible?.(path);
        entries.push({ path: relative, identity: entry.identity }); parent = path;
      } catch (e) { if (filesystemCode(e) !== "ENOENT") throw e; missing = true; entries.push({ path: relative, identity: null }); }
    }
    root(source); return entries;
  }
  function verifyParents(source: Source, entries: Parent[]) {
    root(source);
    for (const entry of entries) {
      if (!entry.identity) fail("missing_parent");
      const path = join(source.canonicalRoot, entry.path);
      verifyCreationDirectory(filesystem, path, entry.identity!);
      filesystem.assertAccessible?.(path);
    }
    root(source);
  }
  function verifyProject(source: Source, path: string, entries: Parent[], identity: string) {
    verifyParents(source, entries);
    verifyCreationDirectory(filesystem, join(source.canonicalRoot, path), JSON.parse(identity));
    verifyParents(source, entries);
  }
  const parentPath = (path: string) => path.split("/").slice(0, -1).join("/");
  function free(source: Source, path: string, entries: Parent[]) {
    verifyParents(source, entries);
    assertCreationDestinationFree(filesystem, join(source.canonicalRoot, parentPath(path)), path.split("/").at(-1)!);
    verifyParents(source, entries);
  }
  function policy(source: Source, path: string) {
    const exclusions: string[] = JSON.parse(source.excludedRelativePaths);
    const alias = filesystemAlias(path);
    if (exclusions.some(p => alias === filesystemAlias(p) || alias.startsWith(`${filesystemAlias(p)}/`))) fail("excluded");
    if (source.archiveRelativePath && (alias === filesystemAlias(source.archiveRelativePath) || alias.startsWith(`${filesystemAlias(source.archiveRelativePath)}/`))) fail("archive");
  }
  function explicitlyRecreatedParent(sourceId: string, categoryId: string | null, path: string, identity: NativeIdentity) {
    if (!categoryId) return false;
    return db.select().from(schema.projectArchiveOperations).where(eq(schema.projectArchiveOperations.sourceId, sourceId)).all().some(row => {
      if (row.action !== "restore" || row.stage !== "completed" || parentPath(row.requestedRelativePath) !== path) return false;
      const binding: Binding = JSON.parse(row.binding), recorded: Parent[] = JSON.parse(row.parents);
      const parent = recorded.at(-1);
      return binding.project.categoryId === categoryId && binding.createParent && binding.destinationParents.at(-1)?.identity === null &&
        parent?.path === path && !!parent.identity && sameIdentity(parent.identity, identity);
    });
  }
  function inspect(input: Extract<import("../contracts/project-archive.js").ArchiveQuery, { type: "workspace.previewProjectArchive" }>) {
    const source = sourceFor(input.workspaceId), project = projectFor(input.projectId);
    if (!source || !project || project.sourceId !== source.id || !source.discoveryMode || !source.archiveRelativePath || !validPath(source.archiveRelativePath)) return null;
    if (source.discoveryMode !== "direct" && source.discoveryMode !== "grouped") return null;
    root(source);
    const archive = archiveFor(project.id), category = project.categoryId ? db.select().from(schema.categories).where(eq(schema.categories.id, project.categoryId)).get() ?? null : null;
    if (input.action === "archive" && (archive || project.modeInactive || project.associationState !== "active" || input.name !== null || input.createParent)) return null;
    if (input.action === "restore" && (!archive || (input.name !== null && !validProjectBasename(input.name, filesystem.platform)))) return null;
    const original = archive?.relativePath ?? project.relativePath;
    const restoreOriginal = archive?.originalRelativePath ?? project.relativePath;
    const destination = input.action === "archive" ? `${source.archiveRelativePath}/${project.relativePath}`
      : [...restoreOriginal.split("/").slice(0, -1), input.name ?? restoreOriginal.split("/").at(-1)!].join("/");
    if (!validPath(original) || !validPath(destination)) return null;
    const sourceParents = parents(source, original), destinationParents = parents(source, destination);
    verifyProject(source, original, sourceParents, project.nativeIdentity);
    const blockers: string[] = [];
    if (readProjectReservations(db, source.id).length) blockers.push("busy");
    const mode = archive?.mode ?? source.discoveryMode;
    if (input.action === "restore" && source.discoveryMode !== mode) blockers.push("incompatible_mode");
    if (input.action === "archive") {
      policy(source, original);
      if (category && (category.modeInactive || category.associationState !== "active" || !sourceParents[0]?.identity || !sameIdentity(sourceParents[0].identity, JSON.parse(category.nativeIdentity)))) blockers.push("category_unavailable");
    } else {
      policy(source, destination);
      verifyParents(source, JSON.parse(archive!.parents));
      const existingParent = destinationParents.at(-1)?.identity;
      if (existingParent && !sameIdentity(existingParent, JSON.parse(archive!.parentIdentity)) &&
        !explicitlyRecreatedParent(source.id, project.categoryId, parentPath(destination), existingParent)) blockers.push("parent_replaced");
    }
    const missingParents = destinationParents.filter(p => !p.identity).map(p => p.path);
    if (input.action === "restore" && missingParents.length && !input.createParent) blockers.push("missing_parent");
    if (!missingParents.length) {
      try { free(source, destination, destinationParents); } catch (e) { blockers.push(problem(e)); }
    }
    const others = db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all();
    if (others.some(p => p.id !== project.id && p.associationState !== "replaced" && filesystemAlias(p.relativePath) === filesystemAlias(destination))) blockers.push("reserved_destination");
    const allArchives = db.select().from(schema.projectArchives).where(eq(schema.projectArchives.sourceId, source.id)).all();
    // Unrelated archived branches may be unavailable. Only their common
    // designation ancestors authorize reuse of this archive root.
    for (const existing of allArchives) verifyParents(source, (JSON.parse(existing.parents) as Parent[]).filter(parent =>
      source.archiveRelativePath === parent.path || source.archiveRelativePath!.startsWith(`${parent.path}/`)));
    if (others.some(p => p.id !== project.id && p.associationState !== "replaced" && (() => {
      const identity = JSON.parse(p.nativeIdentity), current = JSON.parse(project.nativeIdentity);
      return identity.dev === current.dev && identity.ino === current.ino;
    })())) blockers.push("native_conflict");
    if (allArchives.some(p => p.projectId !== project.id && filesystemAlias(p.relativePath) === filesystemAlias(destination))) blockers.push("reserved_destination");
    const binding: Binding = { source, project, archive, category, sourceParents, destinationParents, createParent: input.createParent,
      mode, categoryName: archive?.categoryName ?? category?.relativePath ?? null };
    const preview: ProjectArchivePreview = { workspaceId: input.workspaceId, sourceId: source.id, projectId: project.id, action: input.action,
      originalRelativePath: original, requestedRelativePath: destination, revision: source.discoveryRevision, missingParents, blockers, previewToken: null };
    return { binding, preview };
  }
  function previewProjectArchive(input: unknown): ServiceResult<ProjectArchivePreview> {
    if (!isArchiveRequest(input) || input.type !== "workspace.previewProjectArchive") return invalid();
    reviews.delete(input.workspaceId);
    try {
      const inspected = inspect(input); if (!inspected) return invalid();
      if (!inspected.preview.blockers.length) {
        const token = randomUUID();
        reviews.set(input.workspaceId, { sourceId: inspected.binding.source.id, workspaceId: input.workspaceId, token, ...structuredClone(inspected) });
        inspected.preview.previewToken = token;
      }
      return { ok: true, value: inspected.preview };
    } catch (e) {
      const source = sourceFor(input.workspaceId);
      if (!source) return invalid();
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, projectId: input.projectId, action: input.action,
        originalRelativePath: "", requestedRelativePath: "", revision: source.discoveryRevision, missingParents: [], blockers: [problem(e)], previewToken: null } };
    }
  }
  function sourceBinding(source: Source) {
    const { id, canonicalRoot, discoveryMode, discoveryRevision, excludedRelativePaths, archiveRelativePath, appliedRootIdentity } = source;
    return { id, canonicalRoot, discoveryMode, discoveryRevision, excludedRelativePaths, archiveRelativePath, appliedRootIdentity };
  }
  function authorization(row: Operation, workspaceId: string) {
    const b: Binding = JSON.parse(row.binding), current = sourceFor(workspaceId);
    if (!current || current.id !== row.sourceId || !eqJSON(sourceBinding(current), sourceBinding(b.source)) || !eqJSON(projectFor(row.projectId), b.project) || !eqJSON(archiveFor(row.projectId), b.archive)) fail("stale_configuration");
    if (readProjectReservations(db, row.sourceId).some(r => r.operationKind !== "project_archive" || r.operationId !== row.operationId)) fail("busy");
    if (!eqJSON(operationFor(row.operationId), row)) fail("stale_operation");
    root(current!); return b;
  }
  function ensureParents(row: Operation, workspaceId: string) {
    const b = authorization(row, workspaceId);
    const entries: Parent[] = JSON.parse(row.parents);
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      verifyParents(b.source, entries.slice(0, i));
      if (entry.identity) verifyCreationDirectory(filesystem, join(b.source.canonicalRoot, entry.path), entry.identity);
      else {
        free(b.source, entry.path, entries.slice(0, i));
        verifyProject(b.source, row.originalRelativePath, b.sourceParents, row.nativeIdentity);
        filesystem.mkdir(join(b.source.canonicalRoot, entry.path));
        const created = filesystem.inspect(join(b.source.canonicalRoot, entry.path));
        if (created.kind !== "directory" || !reliableIdentity(created.identity)) fail("filesystem_changed");
        verifyCreationDirectory(filesystem, join(b.source.canonicalRoot, entry.path), created.identity);
        entries[i] = { ...entry, identity: created.identity };
        authorization(row, workspaceId);
        db.update(schema.projectArchiveOperations).set({ parents: JSON.stringify(entries) }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
        row = operationFor(row.operationId)!;
      }
    }
    verifyParents(b.source, entries); return row;
  }
  function destinationEvidence(row: Operation, workspaceId: string) {
    const b = authorization(row, workspaceId);
    verifyProject(b.source, row.requestedRelativePath, JSON.parse(row.parents), row.nativeIdentity);
    free(b.source, row.originalRelativePath, b.sourceParents);
    authorization(row, workspaceId);
  }
  function complete(row: Operation, workspaceId: string) {
    const b: Binding = JSON.parse(row.binding);
    const revision = b.source.discoveryRevision + 1;
    if (!Number.isSafeInteger(revision)) fail("stale_configuration");
    db.transaction(tx => {
      destinationEvidence(row, workspaceId);
      if (row.stage !== "destination_recorded") {
        tx.update(schema.projectArchiveOperations).set({ stage: "destination_recorded", problem: null }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
        row = operationFor(row.operationId)!;
      }
      if (row.action === "archive") {
        tx.update(schema.projects).set({ modeInactive: true }).where(eq(schema.projects.id, row.projectId)).run();
        tx.insert(schema.projectArchives).values({ projectId: row.projectId, sourceId: row.sourceId, relativePath: row.requestedRelativePath,
          originalRelativePath: b.project.relativePath, mode: b.mode, categoryName: b.categoryName,
          parentIdentity: JSON.stringify(b.sourceParents.at(-1)?.identity ?? JSON.parse(b.source.appliedRootIdentity!)), parents: row.parents }).run();
      } else {
        let categoryId = b.project.categoryId;
        if (b.mode === "grouped") {
          const parent = JSON.parse(row.parents) as Parent[];
          const identity = JSON.stringify(parent.at(-1)!.identity);
          const current = categoryId ? tx.select().from(schema.categories).where(eq(schema.categories.id, categoryId)).get() : null;
          if (!current || current.nativeIdentity !== identity) {
            if (current) tx.update(schema.categories).set({ modeInactive: true, associationState: "replaced" }).where(eq(schema.categories.id, current.id)).run();
            const associated = tx.select().from(schema.categories).where(eq(schema.categories.sourceId, row.sourceId)).all().find(c =>
              c.associationState === "active" && !c.modeInactive && c.relativePath === parentPath(row.requestedRelativePath) && c.nativeIdentity === identity);
            categoryId = associated?.id ?? randomUUID();
            if (!associated) tx.insert(schema.categories).values({ id: categoryId, sourceId: row.sourceId, relativePath: parentPath(row.requestedRelativePath), nativeIdentity: identity, associationState: "active", modeInactive: false }).run();
          } else tx.update(schema.categories).set({ associationState: "active", modeInactive: false }).where(eq(schema.categories.id, current.id)).run();
        }
        tx.delete(schema.projectArchives).where(eq(schema.projectArchives.projectId, row.projectId)).run();
        tx.update(schema.projects).set({ relativePath: row.requestedRelativePath, categoryId, associationState: "active", modeInactive: false }).where(eq(schema.projects.id, row.projectId)).run();
      }
      tx.update(schema.sources).set({ discoveryRevision: revision }).where(eq(schema.sources.id, row.sourceId)).run();
      tx.update(schema.projectArchiveOperations).set({ stage: "completed", completedRevision: revision, problem: null }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
      verifyProject(b.source, row.requestedRelativePath, JSON.parse(row.parents), row.nativeIdentity);
      free(b.source, row.originalRelativePath, b.sourceParents);
    }, { behavior: "immediate" });
    integration.invalidateSourceReviews(row.sourceId);
    integration.committed(row.sourceId, revision, db.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId, row.sourceId)).all().map(w => w.id));
    return operationFor(row.operationId)!;
  }
  function execute(row: Operation, workspaceId: string) {
    row = ensureParents(row, workspaceId);
    const b = authorization(row, workspaceId);
    verifyProject(b.source, row.originalRelativePath, b.sourceParents, row.nativeIdentity);
    free(b.source, row.requestedRelativePath, JSON.parse(row.parents));
    authorization(row, workspaceId);
    const outcome = native(join(b.source.canonicalRoot, row.originalRelativePath), join(b.source.canonicalRoot, row.requestedRelativePath));
    if (outcome !== "renamed") fail(outcome);
    destinationEvidence(row, workspaceId);
    db.update(schema.projectArchiveOperations).set({ stage: "destination_recorded", problem: null }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
    return complete(operationFor(row.operationId)!, workspaceId);
  }
  function retain(row: Operation, e: unknown): ServiceResult<ProjectArchiveResult> {
    try {
      const current = operationFor(row.operationId)!;
      if (current.stage !== "completed" && current.stage !== "failed") db.update(schema.projectArchiveOperations).set({ problem: problem(e) }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
    } catch { /* The durable intent remains authoritative if this write fails. */ }
    try { row = operationFor(row.operationId) ?? row; } catch { /* Keep last durable receipt. */ }
    return { ok: true, value: { operation: view(row) } };
  }
  function applyProjectArchive(input: unknown): ServiceResult<ProjectArchiveResult> {
    if (!isArchiveRequest(input) || input.type !== "workspace.applyProjectArchive") return invalid();
    let row: Operation | undefined, accepted = false;
    try {
      const source = sourceFor(input.workspaceId), prior = operationFor(input.operationId);
      if (!source) return invalid();
      if (prior) return prior.workspaceId === input.workspaceId && prior.sourceId === source.id && prior.previewToken === input.previewToken
        ? { ok: true, value: { operation: view(prior) } } : invalid();
      const review = reviews.get(input.workspaceId);
      if (!review || review.token !== input.previewToken) return invalid();
      reviews.delete(input.workspaceId);
      const p = review.preview, b = review.binding;
      const request = { type: "workspace.previewProjectArchive" as const, workspaceId: input.workspaceId, projectId: p.projectId, action: p.action,
        name: p.action === "restore" ? p.requestedRelativePath.split("/").at(-1)! : null, createParent: b.createParent };
      const current = inspect(request);
      if (!current || !eqJSON(current.binding, b) || current.preview.blockers.length) return invalid();
      row = { operationId: input.operationId, sourceId: source.id, workspaceId: input.workspaceId, projectId: p.projectId, action: p.action,
        originalRelativePath: p.originalRelativePath, requestedRelativePath: p.requestedRelativePath, nativeIdentity: b.project.nativeIdentity,
        binding: JSON.stringify(b), previewToken: input.previewToken, parents: JSON.stringify(b.destinationParents), stage: "intent", problem: null, completedRevision: null };
      const intent = row;
      db.transaction(tx => {
        const latest = inspect(request);
        if (!latest || !eqJSON(latest.binding, b) || latest.preview.blockers.length) fail("stale_configuration");
        tx.insert(schema.projectArchiveOperations).values(intent).run();
      }, { behavior: "immediate" });
      accepted = true;
      integration.invalidateSourceReviews(row.sourceId);
      return { ok: true, value: { operation: view(execute(row, input.workspaceId)) } };
    } catch (e) { return accepted && row ? retain(row, e) : storage(); }
  }
  function inspectRecovery(row: Operation, workspaceId: string) {
    const result: ProjectArchiveRecoveryPreview = { workspaceId, sourceId: row.sourceId, operation: view(row), actions: [], problem: null, previewToken: null };
    const observations: unknown[] = [];
    if (row.stage === "completed" || row.stage === "failed") return { result, fingerprint: JSON.stringify([row, result]) };
    try {
      const b = authorization(row, workspaceId);
      const status = (path: string, entries: Parent[]) => {
        try {
          verifyProject(b.source, path, entries, row.nativeIdentity); return "matching";
        } catch (e) { if (filesystemCode(e) === "ENOENT") return "missing"; throw e; }
      };
      const original = status(row.originalRelativePath, b.sourceParents);
      const entries: Parent[] = JSON.parse(row.parents);
      let destination: string;
      if (entries.some(p => !p.identity)) {
        const now = parents(b.source, row.requestedRelativePath);
        if (!eqJSON(entries, now)) fail("unrecorded_parent");
        destination = "missing";
      } else destination = status(row.requestedRelativePath, entries);
      observations.push(original, destination, parents(b.source, row.requestedRelativePath));
      if (original === "matching" && destination === "missing") result.actions = ["retry_original", "keep_original"];
      else if (original === "missing" && destination === "matching") {
        destinationEvidence(row, workspaceId); result.actions = ["complete_destination"];
      } else fail("ambiguous_placement");
    } catch (e) {
      result.problem = problem(e);
      // Abandon only when the original project is still fully verified. This
      // does not adopt, remove or alter an unrecorded/replaced destination parent.
      try {
        const b = authorization(row, workspaceId);
        verifyProject(b.source, row.originalRelativePath, b.sourceParents, row.nativeIdentity);
        result.actions = ["keep_original"];
      } catch { /* Ambiguous original placement stays reserved. */ }
    }
    return { result, fingerprint: JSON.stringify([row, result, observations]) };
  }
  function previewProjectArchiveRecovery(input: unknown): ServiceResult<ProjectArchiveRecoveryPreview> {
    if (!isArchiveRequest(input) || input.type !== "workspace.previewProjectArchiveRecovery") return invalid();
    const key = `${input.workspaceId}:${input.operationId}`; recoveryReviews.delete(key);
    try {
      const source = sourceFor(input.workspaceId), row = operationFor(input.operationId);
      if (!source || !row || row.sourceId !== source.id) return invalid();
      const inspected = inspectRecovery(row, input.workspaceId);
      if (inspected.result.actions.length) {
        const token = randomUUID(); recoveryReviews.set(key, { sourceId: row.sourceId, token, fingerprint: inspected.fingerprint }); inspected.result.previewToken = token;
      }
      return { ok: true, value: inspected.result };
    } catch { return storage(); }
  }
  function recoverProjectArchive(input: unknown): ServiceResult<ProjectArchiveResult> {
    if (!isArchiveRequest(input) || input.type !== "workspace.recoverProjectArchive") return invalid();
    const key = `${input.workspaceId}:${input.operationId}`, review = recoveryReviews.get(key);
    if (!review || review.token !== input.previewToken) return invalid();
    recoveryReviews.delete(key);
    let row: Operation | undefined, accepted = false;
    try {
      row = operationFor(input.operationId);
      if (!row || sourceFor(input.workspaceId)?.id !== row.sourceId) return invalid();
      const inspected = inspectRecovery(row, input.workspaceId);
      if (inspected.fingerprint !== review.fingerprint || !inspected.result.actions.includes(input.action)) return invalid();
      accepted = true;
      integration.invalidateSourceReviews(row.sourceId);
      if (input.action === "keep_original") {
        db.update(schema.projectArchiveOperations).set({ stage: "failed", problem: "kept_original" }).where(eq(schema.projectArchiveOperations.operationId, row.operationId)).run();
        row = operationFor(row.operationId)!;
      } else row = input.action === "retry_original" ? execute(row, input.workspaceId) : complete(row, input.workspaceId);
      return { ok: true, value: { operation: view(row) } };
    } catch (e) { return accepted && row ? retain(row, e) : storage(); }
  }
  function listProjectArchiveOperations(input: unknown): ServiceResult<ProjectArchiveOperationList> {
    if (!isArchiveRequest(input) || input.type !== "workspace.listProjectArchiveOperations") return invalid();
    try {
      const source = sourceFor(input.workspaceId); if (!source) return invalid();
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: source.id, operations: db.select().from(schema.projectArchiveOperations)
        .where(eq(schema.projectArchiveOperations.sourceId, source.id)).all().filter(r => r.stage === "intent" || r.stage === "destination_recorded").map(view) } };
    } catch { return storage(); }
  }
  function getProjectArchiveOperation(input: unknown): ServiceResult<ProjectArchiveResult> {
    if (!isArchiveRequest(input) || input.type !== "workspace.getProjectArchiveOperation") return invalid();
    try {
      const row = operationFor(input.operationId); return row && sourceFor(input.workspaceId)?.id === row.sourceId ? { ok: true, value: { operation: view(row) } } : invalid();
    } catch { return storage(); }
  }
  return { previewProjectArchive, applyProjectArchive, listProjectArchiveOperations, getProjectArchiveOperation, previewProjectArchiveRecovery, recoverProjectArchive,
    invalidateSource(sourceId: string) {
      for (const [key, r] of reviews) if (r.sourceId === sourceId) reviews.delete(key);
      for (const [key, r] of recoveryReviews) if (r.sourceId === sourceId) recoveryReviews.delete(key);
    }, removeWorkspace(workspaceId: string) { reviews.delete(workspaceId); for (const key of recoveryReviews.keys()) if (key.startsWith(`${workspaceId}:`)) recoveryReviews.delete(key); },
    close() { reviews.clear(); recoveryReviews.clear(); } };
}
