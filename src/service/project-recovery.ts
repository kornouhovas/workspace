import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ProjectRecoveryCandidate, ProjectRecoveryPreview } from "../contracts/project-recovery.js";
import type { ServiceResult } from "../contracts/settings.js";
import type { ProjectList } from "../contracts/workspaces.js";
import { interpretProjects, isChildName, reliableIdentity, sameIdentity, scanDirectSource, validArchive, validExclusions,
  type DiscoveryScan, type DiscoverySnapshot, type NativeIdentity } from "./discovery.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
type Source = typeof schema.sources.$inferSelect;
type Project = typeof schema.projects.$inferSelect;
type Category = typeof schema.categories.$inferSelect;
interface Review {
  preview: ProjectRecoveryPreview;
  source: Source;
  projects: Project[];
  categories: Category[];
  snapshot: DiscoverySnapshot;
}

export function createProjectRecoveryService(db: Database, integration: {
  projectList(workspaceId: string, source: Source, scan: DiscoveryScan): ProjectList;
  committed(sourceId: string, revision: number, workspaceIds: string[]): void;
}) {
  const reviews = new Map<string, Review>();
  const key = (workspaceId: string, projectId: string) => `${workspaceId}:${projectId}`;
  function sourceFor(workspaceId: string) {
    return db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
      .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  }
  const projectsFor = (sourceId: string) => db.select().from(schema.projects).where(eq(schema.projects.sourceId, sourceId)).orderBy(asc(schema.projects.id)).all();
  const categoriesFor = (sourceId: string) => db.select().from(schema.categories).where(eq(schema.categories.sourceId, sourceId)).orderBy(asc(schema.categories.id)).all();
  function scanSource(source: Source) {
    const exclusions: unknown = JSON.parse(source.excludedRelativePaths);
    if (!validExclusions(exclusions) || !validArchive(source.archiveRelativePath) || !Number.isSafeInteger(source.discoveryRevision) ||
      source.discoveryRevision < 0 || source.appliedRootIdentity === null) throw new Error("Invalid configured source");
    const scan = scanDirectSource(source.canonicalRoot, source.archiveRelativePath, exclusions);
    if (scan.snapshot && (!reliableIdentity(scan.snapshot.root.identity) ||
      !sameIdentity(JSON.parse(source.appliedRootIdentity), scan.snapshot.root.identity))) {
      return { state: "root_identity_conflict" as const, entries: [], snapshot: null };
    }
    return scan;
  }
  function eligible(project: Project, scan: DiscoveryScan, projects: Project[]) {
    const resolution = scan.snapshot ? interpretProjects(scan, projects).retained.find((row) => row.id === project.id)?.associationState : null;
    // Exclusion has its own explicit discovery controls. It is not recovery.
    return project.associationState !== "excluded" && resolution !== "excluded" &&
      (["missing", "unresolved", "replaced"].includes(project.associationState) ||
        resolution !== null && resolution !== undefined && ["missing", "unresolved", "replaced"].includes(resolution));
  }
  function candidates(scan: DiscoveryScan, project: Project, projects: Project[]): ProjectRecoveryCandidate[] {
    return scan.entries.map((entry) => {
      const child = scan.snapshot?.children.find((row) => row.relativePath === entry.relativePath);
      let status: ProjectRecoveryCandidate["status"] = "selectable";
      if (entry.reason !== null) status = entry.reason === "unresolved" ? "unresolved" : "excluded";
      else if (child?.kind !== "directory" || !reliableIdentity(child.identity)) status = "unresolved";
      else if (projects.some((row) => row.id !== project.id && row.associationState !== "replaced" && row.relativePath === entry.relativePath)) status = "reserved_path";
      else if (projects.some((row) => row.id !== project.id && row.associationState !== "replaced" && nativeAlias(JSON.parse(row.nativeIdentity), child.identity)) ||
        scan.snapshot!.children.some((row) => row.kind === "directory" && row.relativePath !== child.relativePath && nativeAlias(row.identity, child.identity))) status = "native_conflict";
      return { relativePath: entry.relativePath, name: entry.name, categoryPath: null, status };
    });
  }
  function invalidateSource(sourceId: string) {
    for (const [id, review] of reviews) if (review.source.id === sourceId) reviews.delete(id);
  }
  return {
    invalidateSource,
    removeWorkspace(workspaceId: string) {
      for (const [id, review] of reviews) if (review.preview.workspaceId === workspaceId) reviews.delete(id);
    },
    close() { reviews.clear(); },
    previewProjectRecovery(input: unknown): ServiceResult<ProjectRecoveryPreview> {
      if (!payload(input, "workspace.previewProjectRecovery", ["type", "workspaceId", "projectId"])) return invalid();
      const reviewKey = key(input.workspaceId, input.projectId);
      reviews.delete(reviewKey);
      try {
        const source = sourceFor(input.workspaceId);
        if (!source || source.discoveryMode !== "direct") return invalid();
        const projects = projectsFor(source.id), categories = categoriesFor(source.id);
        const project = projects.find((row) => row.id === input.projectId);
        if (!project) return invalid();
        const scan = scanSource(source);
        if (!eligible(project, scan, projects)) return invalid();
        const preview: ProjectRecoveryPreview = { workspaceId: input.workspaceId, sourceId: source.id, projectId: project.id,
          mode: "direct", revision: source.discoveryRevision, state: scan.state,
          previewToken: scan.snapshot ? randomUUID() : null, entries: candidates(scan, project, projects) };
        if (scan.snapshot) reviews.set(reviewKey, { preview: structuredClone(preview), snapshot: scan.snapshot, source, projects, categories });
        return { ok: true, value: preview };
      } catch { return storage(); }
    },
    reassociateProject(input: unknown): ServiceResult<ProjectList> {
      if (!payload(input, "workspace.reassociateProject", ["type", "workspaceId", "projectId", "previewToken", "relativePath"]) ||
        !uuid(input.previewToken) || !isChildName(input.relativePath) || input.relativePath.includes("/")) return invalid();
      const reviewKey = key(input.workspaceId, input.projectId);
      const stale = () => {
        if (reviews.get(reviewKey)?.preview.previewToken === input.previewToken) reviews.delete(reviewKey);
        return { ok: false as const, error: { code: "stale_preview" as const, message: "Refresh recovery and explicitly select and review a current folder." } };
      };
      try {
        const source = sourceFor(input.workspaceId);
        if (!source || !projectsFor(source.id).some((row) => row.id === input.projectId)) return invalid();
        const review = reviews.get(reviewKey);
        if (!review || review.preview.previewToken !== input.previewToken) return stale();
        const target = review.preview.entries.find((entry) => entry.relativePath === input.relativePath);
        if (!target || target.status !== "selectable") return invalid();
        const verify = () => {
          const current = sourceFor(input.workspaceId);
          if (!current || configuration(current) !== configuration(review.source) || current.discoveryMode !== "direct" ||
            JSON.stringify(projectsFor(source.id)) !== JSON.stringify(review.projects) ||
            JSON.stringify(categoriesFor(source.id)) !== JSON.stringify(review.categories)) throw new StaleReview();
          const scan = scanSource(current);
          if (!scan.snapshot || JSON.stringify(scan.snapshot) !== JSON.stringify(review.snapshot)) throw new StaleReview();
          const project = review.projects.find((row) => row.id === input.projectId)!;
          if (!eligible(project, scan, review.projects) ||
            candidates(scan, project, review.projects).find((row) => row.relativePath === target.relativePath)?.status !== "selectable") throw new StaleReview();
          return scan;
        };
        verify();
        const workspaceIds = db.select({ id: schema.workspaces.id }).from(schema.workspaces)
          .where(eq(schema.workspaces.sourceId, source.id)).orderBy(asc(schema.workspaces.position), asc(schema.workspaces.id)).all().map((row) => row.id);
        const result = db.transaction((tx) => {
          const scan = verify();
          const child = scan.snapshot!.children.find((row) => row.relativePath === target.relativePath);
          if (child?.kind !== "directory") throw new StaleReview();
          tx.update(schema.projects).set({ relativePath: target.relativePath, nativeIdentity: JSON.stringify(child.identity),
            categoryId: null, associationState: "active" }).where(eq(schema.projects.id, input.projectId)).run();
          tx.update(schema.sources).set({ discoveryRevision: source.discoveryRevision + 1 }).where(eq(schema.sources.id, source.id)).run();
          // Observations are not a filesystem lock. Any change seen during writes
          // rolls back; a later external change requires another explicit review.
          const after = scanSource(source);
          if (!after.snapshot || JSON.stringify(after.snapshot) !== JSON.stringify(review.snapshot)) throw new StaleReview();
          const committed = tx.select().from(schema.sources).where(eq(schema.sources.id, source.id)).get()!;
          const expectedProjects = review.projects.map((row) => row.id === input.projectId ? { ...row,
            relativePath: target.relativePath, nativeIdentity: JSON.stringify(child.identity), categoryId: null, associationState: "active" } : row);
          if (configuration(committed) !== configuration({ ...review.source, discoveryRevision: source.discoveryRevision + 1 }) ||
            JSON.stringify(projectsFor(source.id)) !== JSON.stringify(expectedProjects) ||
            JSON.stringify(categoriesFor(source.id)) !== JSON.stringify(review.categories)) throw new StaleReview();
          return integration.projectList(input.workspaceId, committed, after);
        });
        invalidateSource(source.id);
        integration.committed(source.id, result.revision, workspaceIds);
        return { ok: true, value: result };
      } catch (error) { return error instanceof StaleReview ? stale() : storage(); }
    },
  };
}
function configuration(source: Source) {
  const { id, canonicalRoot, discoveryMode, discoveryRevision, excludedRelativePaths, archiveRelativePath, appliedRootIdentity } = source;
  return JSON.stringify({ id, canonicalRoot, discoveryMode, discoveryRevision, excludedRelativePaths, archiveRelativePath, appliedRootIdentity });
}
function nativeAlias(a: NativeIdentity, b: NativeIdentity) { return a.dev === b.dev && a.ino === b.ino; }
class StaleReview extends Error {}
function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function payload(value: unknown, type: string, keys: string[]): value is Record<string, unknown> & { workspaceId: string; projectId: string } {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    "type" in value && value.type === type && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)) &&
    "workspaceId" in value && uuid(value.workspaceId) && "projectId" in value && uuid(value.projectId);
}
function invalid() { return { ok: false as const, error: { code: "invalid_input" as const, message: "Choose a retained project and an available reviewed folder in its configured source." } }; }
function storage() { return { ok: false as const, error: { code: "storage" as const, message: "Project association could not be read or saved." } }; }
