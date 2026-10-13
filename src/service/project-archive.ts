import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isArchiveRequest, type ArchiveLocationPreview, type ArchiveSnapshot } from "../contracts/project-archive.js";
import { nativeProjectFilesystem, verifyCreationDirectory, validProjectBasename, filesystemCode, type ProjectFilesystem } from "./project-filesystem.js";
import { readProjectReservations } from "./project-rename-reservations.js";
import { filesystemAlias } from "./path-alias.js";
import { reliableIdentity } from "./discovery.js";

type Database = BetterSQLite3Database<typeof schema>;
const invalid = (): ServiceResult<never> => ({ ok: false, error: { code: "invalid_input", message: "Invalid archive request." } });
const stale = (): ServiceResult<never> => ({ ok: false, error: { code: "invalid_input", message: "Review the archive location again." } });
const storage = (): ServiceResult<never> => ({ ok: false, error: { code: "storage", message: "Archive state could not be read or saved." } });
export function createProjectArchiveService(db: Database, integration: {
  invalidateSourceReviews(sourceId: string): void;
  committed(sourceId: string, revision: number, workspaceIds: string[]): void;
}, filesystem: ProjectFilesystem = nativeProjectFilesystem) {
  const reviews = new Map<string, { sourceId: string; binding: string; relativePath: string; token: string }>();
  const sourceFor = (workspaceId: string) => db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
    .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  function snapshot(workspaceId: string): ArchiveSnapshot {
    const source = sourceFor(workspaceId)!;
    return { workspaceId, sourceId: source.id, relativePath: source.archiveRelativePath, revision: source.discoveryRevision, projects: db.select().from(schema.projectArchives).where(eq(schema.projectArchives.sourceId, source.id)).all().map(a => ({
      projectId: a.projectId, originalRelativePath: a.originalRelativePath, relativePath: a.relativePath,
      categoryName: a.categoryName, categoryId: db.select().from(schema.projects).where(eq(schema.projects.id, a.projectId)).get()!.categoryId,
      name: a.originalRelativePath.split("/").at(-1)!,
    })) };
  }
  function inspect(workspaceId: string, relativePath: string) {
    const source = sourceFor(workspaceId);
    if (!source || !source.appliedRootIdentity || !source.discoveryMode) return null;
    const parts = relativePath.split("/");
    if (!parts.length || !parts.every(p => validProjectBasename(p, filesystem.platform) && !p.startsWith(".") && !/^(\$RECYCLE.BIN|System Volume Information)$/i.test(p))) return null;
    verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity));
    const projects = db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all();
    const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).all();
    const reservations = readProjectReservations(db, source.id);
    const blockers: string[] = [];
    if (reservations.length) blockers.push("busy");
    if (source.archiveRelativePath !== relativePath && db.select().from(schema.projectArchives).where(eq(schema.projectArchives.sourceId, source.id)).all().length) blockers.push("archive_not_empty");
    const overlap = (a: string, b: string) => { a = filesystemAlias(a); b = filesystemAlias(b); return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`); };
    if (projects.some(p => p.associationState !== "replaced" && overlap(p.relativePath, relativePath)) ||
      categories.some(c => c.associationState !== "replaced" && overlap(c.relativePath, relativePath))) blockers.push("owned_location");
    const evidence: unknown[] = [];
    let parent = source.canonicalRoot, missing = false;
    for (const part of parts) {
      if (missing) continue;
      const names = filesystem.names(parent);
      if (names.some(n => n !== part && filesystemAlias(n) === filesystemAlias(part))) { blockers.push("occupied"); break; }
      const path = join(parent, part);
      try {
        const item = filesystem.inspect(path);
        if (item.kind !== "directory" || !reliableIdentity(item.identity) || filesystem.realpath(path) !== path) { blockers.push("unsafe_location"); break; }
        evidence.push([part, item.identity]);
        parent = path;
      } catch (error) { if (filesystemCode(error) !== "ENOENT") throw error; missing = true; evidence.push([part, "missing"]); }
    }
    verifyCreationDirectory(filesystem, source.canonicalRoot, JSON.parse(source.appliedRootIdentity));
    return { source, blockers, binding: JSON.stringify([source, projects, categories, reservations, evidence]) };
  }
  function previewArchiveLocation(input: unknown): ServiceResult<ArchiveLocationPreview> {
    if (!isArchiveRequest(input) || input.type !== "workspace.previewArchiveLocation") return invalid();
    reviews.delete(input.workspaceId);
    try {
      const inspected = inspect(input.workspaceId, input.relativePath);
      if (!inspected) return invalid();
      const token = inspected.blockers.length ? null : randomUUID();
      if (token) reviews.set(input.workspaceId, { sourceId: inspected.source.id, binding: inspected.binding, relativePath: input.relativePath, token });
      return { ok: true, value: { workspaceId: input.workspaceId, sourceId: inspected.source.id, relativePath: input.relativePath,
        revision: inspected.source.discoveryRevision, blockers: inspected.blockers, previewToken: token } };
    } catch { return storage(); }
  }
  function applyArchiveLocation(input: unknown): ServiceResult<ArchiveSnapshot> {
    if (!isArchiveRequest(input) || input.type !== "workspace.applyArchiveLocation") return invalid();
    const review = reviews.get(input.workspaceId);
    if (!review || review.token !== input.previewToken) return stale();
    reviews.delete(input.workspaceId);
    try {
      const revision = db.transaction(tx => {
        const current = inspect(input.workspaceId, review.relativePath);
        if (!current || current.binding !== review.binding || current.blockers.length || !Number.isSafeInteger(current.source.discoveryRevision + 1)) return null;
        const next = current.source.discoveryRevision + 1;
        tx.update(schema.sources).set({ archiveRelativePath: review.relativePath, discoveryRevision: next }).where(eq(schema.sources.id, current.source.id)).run();
        return next;
      }, { behavior: "immediate" });
      if (revision === null) return stale();
      integration.invalidateSourceReviews(review.sourceId);
      integration.committed(review.sourceId, revision, db.select().from(schema.workspaces).where(eq(schema.workspaces.sourceId, review.sourceId)).all().map(w => w.id));
      return { ok: true, value: snapshot(input.workspaceId) };
    } catch { return storage(); }
  }
  function listArchivedProjects(input: unknown): ServiceResult<ArchiveSnapshot> {
    if (!isArchiveRequest(input) || input.type !== "workspace.listArchivedProjects") return invalid();
    try { return sourceFor(input.workspaceId) ? { ok: true, value: snapshot(input.workspaceId) } : invalid(); } catch { return storage(); }
  }
  return { previewArchiveLocation, applyArchiveLocation, listArchivedProjects,
    invalidateSource(sourceId: string) { for (const [key, value] of reviews) if (value.sourceId === sourceId) reviews.delete(key); },
    removeWorkspace(workspaceId: string) { reviews.delete(workspaceId); }, close() { reviews.clear(); } };
}
