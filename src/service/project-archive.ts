import type { FilesystemAuthorizer } from "./filesystem-authorization.js";
import { durableOwnershipKey } from "./folder-evidence.js";
import { storedEvidence } from "./source-identity.js";
import { randomUUID } from "node:crypto";
import { join, sep } from "node:path";
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
}, filesystem: ProjectFilesystem = nativeProjectFilesystem, authorizer?: FilesystemAuthorizer) {
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
    const authorization=authorizer?.capture(source,"",source.durableEvidence);
    const verifyRoot=()=>{
      if(authorization)authorizer!.verify(authorization,source,"",source.durableEvidence);
      verifyCreationDirectory(filesystem,source.canonicalRoot,authorization?.root.mount ?? JSON.parse(source.appliedRootIdentity!));
    };
    verifyRoot();
    const projects = db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all();
    const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).all();
    const reservations = readProjectReservations(db, source.id);
    const blockers: string[] = [];
    const savedSources=db.select().from(schema.sources).all();
    const contains=(parent:string,child:string)=>{
      const key=(path:string)=>filesystemAlias(path.split(sep).join("/")).replace(/\/+$/,"");
      const a=key(parent),b=key(child);
      return a===b || b.startsWith(`${a}/`);
    };
    const location=join(source.canonicalRoot,...parts);
    // Saved root locators retain ownership even before durable enrollment.
    // This is only a veto; a locator never proves filesystem continuity.
    if(savedSources.some(peer=>{
      if(peer.id===source.id)return false;
      const strictAncestor=contains(peer.canonicalRoot,source.canonicalRoot) && !contains(source.canonicalRoot,peer.canonicalRoot);
      return contains(location,peer.canonicalRoot) || contains(peer.canonicalRoot,location) && !strictAncestor;
    }))blockers.push("owned_location");
    if (reservations.length) blockers.push("busy");
    if (source.archiveRelativePath !== relativePath && db.select().from(schema.projectArchives).where(eq(schema.projectArchives.sourceId, source.id)).all().length) blockers.push("archive_not_empty");
    const overlap = (a: string, b: string) => { a = filesystemAlias(a); b = filesystemAlias(b); return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`); };
    if (projects.some(p => p.associationState !== "replaced" && overlap(p.relativePath, relativePath)) ||
      categories.some(c => c.associationState !== "replaced" && overlap(c.relativePath, relativePath))) blockers.push("owned_location");
    const evidence: unknown[] = [];
    const observations: {path:string;proof:NonNullable<typeof authorization>["root"]}[]=[];
    const owners=[...projects,...categories,...savedSources.map(row=>({durableEvidence:row.durableEvidence,nativeIdentity:row.appliedRootIdentity}))];
    const keys=new Set(authorization?[durableOwnershipKey(authorization.root.evidence)]:[]);
    let parent = source.canonicalRoot, missing = false;
    for (const part of parts) {
      if (missing) continue;
      const names = filesystem.names(parent);
      if (names.some(n => n !== part && filesystemAlias(n) === filesystemAlias(part))) { blockers.push("occupied"); break; }
      const path = join(parent, part);
      try {
        const item = filesystem.inspect(path);
        if (item.kind !== "directory" || !reliableIdentity(item.identity) || filesystem.realpath(path) !== path) { blockers.push("unsafe_location"); break; }
        if(authorization) {
          const proof=authorizer!.observe(path,authorization.root,item.identity);
          const key=durableOwnershipKey(proof.evidence);
          if(keys.has(key) || owners.some(row=>{
            const saved=storedEvidence(row.durableEvidence);
            if(saved)return durableOwnershipKey(saved)===key;
            if(row.durableEvidence!==null)return true;
            if(!row.nativeIdentity)return false;
            const old=JSON.parse(row.nativeIdentity);
            return old.ino===proof.mount.ino && old.birthtimeNs===proof.mount.birthtimeNs;
          })) {blockers.push("owned_location");break;}
          keys.add(key);observations.push({path,proof});evidence.push([part,item.identity,proof]);
        } else evidence.push([part, item.identity]);
        parent = path;
      } catch (error) { if (filesystemCode(error) !== "ENOENT") throw error; missing = true; evidence.push([part, "missing"]); }
    }
    for(const {path,proof} of observations) {
      verifyCreationDirectory(filesystem,path,proof.mount);
      authorizer!.observe(path,authorization!.root,proof.mount,proof.evidence);
    }
    verifyRoot();
    const state={source:{...source,propertyRevision:0,categoryPropertyRevision:0},projects,categories,reservations,evidence,authorization:authorization??null};
    return { source, blockers, state, binding: JSON.stringify(state) };
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
        const after=inspect(input.workspaceId,review.relativePath);
        const expected={...current.state,source:{...current.state.source,archiveRelativePath:review.relativePath,discoveryRevision:next}};
        if(!after || after.blockers.length || after.binding!==JSON.stringify(expected))throw new Error("Archive designation changed during commit");
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
