import {scanConfiguredSource,planRoleDiscovery} from "./folder-roles.js";
import { hasUnfinishedProjectRelocation, readProjectReservations } from "./project-rename-reservations.js";
import { join } from "node:path";
import { createFilesystemAuthorization } from "./filesystem-authorization.js";
import { continuityRecords, discoveryEvidence, identityState, sourceIdentity, discoveryIdentityState, reserveDurablePlacements, storedEvidence, type EvidenceReader } from "./source-identity.js";
import { durableOwnershipKey, sameDurableFolder, type FolderObservation } from "./folder-evidence.js";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ProjectRecoveryCandidate, ProjectRecoveryPreview } from "../contracts/project-recovery.js";
import type { ServiceResult } from "../contracts/settings.js";
import type { ProjectList } from "../contracts/workspaces.js";
import { modeRetainedResolution, reserveProjectPlacements, planDiscovery, projectExclusions, isChildName, reliableIdentity, sameIdentity, validArchive, validExclusions,
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
  reservations: ReturnType<typeof readProjectReservations>;
  evidence: [string, FolderObservation][] | null;
}

export function createProjectRecoveryService(db: Database, integration: {
  projectList(workspaceId: string, source: Source, scan: DiscoveryScan): ProjectList;
  committed(sourceId: string, revision: number, workspaceIds: string[]): void;
  invalidateSourceReviews(sourceId: string): void;
}, identity?: {scope: string; reader: EvidenceReader}) {
  const authorizer = identity ? createFilesystemAuthorization(identity.scope,identity.reader,db) : null;
  const reviews = new Map<string, Review>();
  // Each scan is request-local. Revalidation always creates a new scan and map;
  // this avoids repeating a complete native inventory for every candidate.
  const evidenceByScan = new WeakMap<DiscoveryScan, Map<string,FolderObservation>>();
  const invalidEvidenceScans = new WeakSet<DiscoveryScan>();
  const key = (workspaceId: string, projectId: string) => `${workspaceId}:${projectId}`;
  function sourceFor(workspaceId: string) {
    return db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
      .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  }
  const projectsFor = (sourceId: string) => db.select().from(schema.projects).where(eq(schema.projects.sourceId, sourceId)).orderBy(asc(schema.projects.id)).all();
  const categoriesFor = (sourceId: string) => db.select().from(schema.categories).where(eq(schema.categories.sourceId, sourceId)).orderBy(asc(schema.categories.id)).all();
  const reservationsFor = (sourceId: string) => readProjectReservations(db, sourceId);
  function scanSource(source: Source) {
    const exclusions: unknown = JSON.parse(source.excludedRelativePaths);
    if (!validExclusions(exclusions, "grouped", !!source.folderRoles) || !validArchive(source.archiveRelativePath) || !Number.isSafeInteger(source.discoveryRevision) ||
      source.discoveryRevision < 0 || source.appliedRootIdentity === null) throw new Error("Invalid configured source");
    const scan = scanConfiguredSource(source,projectExclusions(exclusions, source.discoveryMode === "grouped" ? "grouped" : "direct").effective);
    if(identity) {
      const peers=db.select().from(schema.sources).all().filter(row=>row.id!==source.id);
      const current=sourceIdentity(source,scan,identity.scope,identity.reader,peers);
      if(current.state!=="verified") {
        integration.invalidateSourceReviews(source.id);
        return {state:discoveryIdentityState(current.state),entries:[],snapshot:null};
      }
      try {authorizer!.capture(source,"",source.durableEvidence);}
      catch {
        integration.invalidateSourceReviews(source.id);
        return {state:"changed" as const,entries:[],snapshot:null};
      }
      return reserveProjectPlacements(reserveDurablePlacements(source,current.scan,reservationsFor(source.id),identity.scope,identity.reader),reservationsFor(source.id));
    }
    if (scan.snapshot && (!reliableIdentity(scan.snapshot.root.identity) ||
      !sameIdentity(JSON.parse(source.appliedRootIdentity), scan.snapshot.root.identity))) {
      integration.invalidateSourceReviews(source.id);
      return { state: "root_identity_conflict" as const, entries: [], snapshot: null };
    }
    if (!scan.snapshot) integration.invalidateSourceReviews(source.id);
    return reserveProjectPlacements(scan, reservationsFor(source.id));
  }
  function observedFolders(source: Source,scan: DiscoveryScan) {
    if(!identity)return null;
    if(invalidEvidenceScans.has(scan))throw new StaleReview();
    let evidence=evidenceByScan.get(scan);
    if(!evidence) {
      evidence=discoveryEvidence(source,scan,identity.scope,identity.reader);
      const root=evidence.get("");
      if(!scan.snapshot || !root?.ok || root.evidence.scope!==identity.scope ||
        identityState(source.durableEvidence,root,identity.scope)!=="verified" || !sameIdentity(root.mount,scan.snapshot.root.identity)) {invalidEvidenceScans.add(scan);throw new StaleReview();}
      evidenceByScan.set(scan,evidence);
    }
    return evidence;
  }
  function evidenceFor(source: Source,scan: DiscoveryScan): [string,FolderObservation][] | null {
    const evidence=observedFolders(source,scan);
    return evidence ? [...evidence] : null;
  }
  function projectEvidence(source: Source,scan: DiscoveryScan,path: string) {
    if(!identity || !authorizer)return null;
    const child=scan.snapshot?.children.find(row=>row.relativePath===path);
    const evidence=observedFolders(source,scan), root=evidence?.get(""), selected=evidence?.get(path);
    if(child?.kind!=="directory" || !root?.ok || !selected?.ok || !sameIdentity(child.identity,selected.mount))throw new StaleReview();
    return authorizer.observe(join(source.canonicalRoot,path),root,child.identity,selected.evidence);
  }
  function ownerMatches(row: Project | Category,observation: FolderObservation) {
    if(!observation.ok)return true;
    const saved=storedEvidence(row.durableEvidence);
    if(saved)return durableOwnershipKey(saved)===durableOwnershipKey(observation.evidence);
    if(row.durableEvidence!==null)return true;
    const native=JSON.parse(row.nativeIdentity) as NativeIdentity;
    return native.ino===observation.mount.ino && native.birthtimeNs===observation.mount.birthtimeNs;
  }
  function dormantCategoryRole(row: Project | Category,project: Project,path: string,source: Source,observation: FolderObservation) {
    if(!identity || !observation.ok || "categoryId" in row || source.discoveryMode!=="direct" || project.categoryId!==null ||
      path!==project.relativePath || row.sourceId!==source.id || row.relativePath!==path || !row.modeInactive ||
      !["active","excluded"].includes(row.associationState))return false;
    const subject=storedEvidence(project.durableEvidence),category=storedEvidence(row.durableEvidence);
    return !!subject && !!category && subject.scope===identity.scope && sameDurableFolder(subject,category) && sameDurableFolder(subject,observation.evidence);
  }
  function eligible(project: Project, scan: DiscoveryScan, projects: Project[], categories: Category[], source: Source) {
    if (project.modeInactive) return modeRetainedResolution(scan, project, JSON.parse(source.excludedRelativePaths), source.archiveRelativePath) !== "excluded";
    const resolution = scan.snapshot ? (source.folderRoles ? planRoleDiscovery : planDiscovery)(scan, identity ? continuityRecords(source,scan,categories,identity.scope,identity.reader) : categories, identity ? continuityRecords(source,scan,projects,identity.scope,identity.reader) : projects).projects.retained.find((row) => row.id === project.id)?.associationState : null;
    // Exclusion has its own explicit discovery controls. It is not recovery.
    return project.associationState !== "excluded" && resolution !== "excluded" &&
      (project.modeInactive || ["missing", "unresolved", "replaced"].includes(project.associationState) ||
        resolution !== null && resolution !== undefined && ["missing", "unresolved", "replaced"].includes(resolution));
  }
  // Existing categories are reusable only while both stored and observed states
  // are active. Recovery does not repair a category association as a side effect.
  function categoryTarget(scan: DiscoveryScan, path: string, categories: Category[], source: Source, projects: Project[]) {
    const entry = scan.entries.find((row) => row.kind === "category" && row.relativePath === path);
    const child = scan.snapshot?.children.find((row) => row.relativePath === path);
    if (!entry || entry.reason !== null || child?.kind !== "directory" || !reliableIdentity(child.identity)) return null;
    const current = categories.find((row) => row.relativePath === path && row.associationState !== "replaced");
    if (current && (current.modeInactive || current.associationState !== "active" || (!identity && !sameIdentity(JSON.parse(current.nativeIdentity), child.identity)))) return null;
    if (!current && categories.some((row) => row.relativePath === path)) return null;
    if (categories.some((row) => row.id !== current?.id && row.associationState !== "replaced" &&
      nativeAlias(JSON.parse(row.nativeIdentity), child.identity)) || scan.snapshot!.children.some((row) =>
        row.kind === "directory" && row.relativePath !== path && nativeAlias(row.identity, child.identity))) return null;
    let evidence: string | null = null;
    if(identity && authorizer) {
      try {
        const observed=projectEvidence(source,scan,path);
        if(!observed)return null;
        if(current && identityState(current.durableEvidence,observed,identity.scope)!=="verified")return null;
        const dormantRole=(row: Project | Category) => {
          if(!current || !("categoryId" in row) || !row.modeInactive || row.categoryId!==null || row.relativePath!==path ||
            !["active","excluded"].includes(row.associationState))return false;
          const saved=storedEvidence(row.durableEvidence);
          return saved ? sameDurableFolder(saved,observed.evidence,false)
            : row.durableEvidence===null && sameIdentity(JSON.parse(row.nativeIdentity),JSON.parse(current.nativeIdentity)) && sameIdentity(JSON.parse(row.nativeIdentity),observed.mount);
        };
        // Explicit recovery may establish a new parent over retired category
        // history, preserving that history. It never bypasses a live owner.
        if([...categories,...projects].some(row=>row.id!==current?.id && row.associationState!=="replaced" &&
          !dormantRole(row) && (row.relativePath===path || ownerMatches(row,observed))))return null;
        evidence=JSON.stringify(observed.evidence);
      } catch {return null;}
    }
    return { current, child, evidence };
  }
  function candidates(scan: DiscoveryScan, project: Project, projects: Project[], categories: Category[], source: Source): ProjectRecoveryCandidate[] {
    return scan.entries.filter((entry) => entry.kind === "project").map((entry) => {
      const child = scan.snapshot?.children.find((row) => row.relativePath === entry.relativePath);
      let status: ProjectRecoveryCandidate["status"] = "selectable";
      if (entry.reason !== null) status = entry.reason === "unresolved" ? "unresolved" : "excluded";
      else if (child?.kind !== "directory" || !reliableIdentity(child.identity)) status = "unresolved";
      else if (entry.categoryPath && !categoryTarget(scan, entry.categoryPath, categories, source, projects)) status = "category_unavailable";
      else if (projects.some((row) => row.id !== project.id && row.associationState !== "replaced" && row.relativePath === entry.relativePath)) status = "reserved_path";
      else if (projects.some((row) => row.id !== project.id && row.associationState !== "replaced" && nativeAlias(JSON.parse(row.nativeIdentity), child.identity)) ||
        scan.snapshot!.children.some((row) => row.kind === "directory" && row.relativePath !== child.relativePath && nativeAlias(row.identity, child.identity))) status = "native_conflict";
      if(status==="selectable" && identity) {
        try {
          const observation=projectEvidence(source,scan,entry.relativePath);
          if(!observation)status="unresolved";
          else if([...projects,...categories].some(row=>row.id!==project.id && row.associationState!=="replaced" && !dormantCategoryRole(row,project,entry.relativePath,source,observation) && (row.relativePath===entry.relativePath || ownerMatches(row,observation))))status="native_conflict";
        }catch{status="unresolved";}
      }
      return { relativePath: entry.relativePath, name: entry.name, categoryPath: entry.categoryPath, status };
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
        if (!source || (source.discoveryMode !== "direct" && source.discoveryMode !== "grouped")) return invalid();
        const projects = projectsFor(source.id), categories = categoriesFor(source.id);
        const project = projects.find((row) => row.id === input.projectId);
        if (!project || db.select().from(schema.projectArchives).where(eq(schema.projectArchives.projectId, project.id)).get()) return invalid();
        const scan = scanSource(source);
        if (!eligible(project, scan, projects, categories, source)) return invalid();
        const preview: ProjectRecoveryPreview = { workspaceId: input.workspaceId, sourceId: source.id, projectId: project.id,
          mode: source.discoveryMode, revision: source.discoveryRevision, state: scan.state,
          previewToken: scan.snapshot ? randomUUID() : null, entries: candidates(scan, project, projects, categories, source) };
        if (scan.snapshot) reviews.set(reviewKey, { preview: structuredClone(preview), snapshot: scan.snapshot, source, projects, categories, reservations: reservationsFor(source.id), evidence:evidenceFor(source,scan) });
        return { ok: true, value: preview };
      } catch (error) { return error instanceof StaleReview
        ? {ok:false,error:{code:"stale_preview",message:"Folder evidence changed; refresh recovery and review again."}} : storage(); }
    },
    reassociateProject(input: unknown): ServiceResult<ProjectList> {
      if (!payload(input, "workspace.reassociateProject", ["type", "workspaceId", "projectId", "previewToken", "relativePath"]) ||
        !uuid(input.previewToken) || typeof input.relativePath !== "string" || !input.relativePath.split("/").every(isChildName)) return invalid();
      const reviewKey = key(input.workspaceId, input.projectId);
      const stale = () => {
        if (reviews.get(reviewKey)?.preview.previewToken === input.previewToken) reviews.delete(reviewKey);
        return { ok: false as const, error: { code: "stale_preview" as const, message: "Refresh recovery and explicitly select and review a current folder." } };
      };
      try {
        const source = sourceFor(input.workspaceId);
        if (!source || !projectsFor(source.id).some((row) => row.id === input.projectId)) return invalid();
        if (hasUnfinishedProjectRelocation(db, source.id) || db.select().from(schema.projectArchives).where(eq(schema.projectArchives.projectId, input.projectId)).get()) return stale();
        const review = reviews.get(reviewKey);
        if (!review || review.preview.previewToken !== input.previewToken) return stale();
        const target = review.preview.entries.find((entry) => entry.relativePath === input.relativePath);
        if (!target || target.status !== "selectable" || !source.folderRoles && input.relativePath.split("/").length !== (review.preview.mode === "grouped" ? 2 : 1)) return invalid();
        const verify = () => {
          if (hasUnfinishedProjectRelocation(db, source.id)) throw new StaleReview();
          const current = sourceFor(input.workspaceId);
          if (!current || configuration(current) !== configuration(review.source) || current.discoveryMode !== review.preview.mode ||
            JSON.stringify(projectsFor(source.id)) !== JSON.stringify(review.projects) ||
            JSON.stringify(categoriesFor(source.id)) !== JSON.stringify(review.categories) ||
            JSON.stringify(reservationsFor(source.id)) !== JSON.stringify(review.reservations)) throw new StaleReview();
          const scan = scanSource(current);
          if (!scan.snapshot || JSON.stringify(scan.snapshot) !== JSON.stringify(review.snapshot) || JSON.stringify(evidenceFor(current,scan)) !== JSON.stringify(review.evidence)) throw new StaleReview();
          const project = review.projects.find((row) => row.id === input.projectId)!;
          if (!eligible(project, scan, review.projects, review.categories, current) ||
            candidates(scan, project, review.projects, review.categories, current).find((row) => row.relativePath === target.relativePath)?.status !== "selectable") throw new StaleReview();
          return scan;
        };
        verify();
        const workspaceIds = db.select({ id: schema.workspaces.id }).from(schema.workspaces)
          .where(eq(schema.workspaces.sourceId, source.id)).orderBy(asc(schema.workspaces.position), asc(schema.workspaces.id)).all().map((row) => row.id);
        const result = db.transaction((tx) => {
          const scan = verify();
          const nextGeneration=source.evidenceGeneration+(identity?1:0);
          if(!Number.isSafeInteger(source.discoveryRevision+1) || !Number.isSafeInteger(nextGeneration))throw new StaleReview();
          const child = scan.snapshot!.children.find((row) => row.relativePath === target.relativePath);
          if (child?.kind !== "directory") throw new StaleReview();
          const enrolled=projectEvidence(source,scan,target.relativePath);
          const durableEvidence=enrolled ? JSON.stringify(enrolled.evidence) : null;
          let categoryId: string | null = null;
          let insertedCategory: Category | null = null;
          if (target.categoryPath) {
            const category = categoryTarget(scan, target.categoryPath, review.categories, source, review.projects);
            if (!category) throw new StaleReview();
            categoryId = category.current?.id ?? randomUUID();
            if (!category.current) {
              insertedCategory = { modeInactive: false, id: categoryId, sourceId: source.id, relativePath: target.categoryPath,
                nativeIdentity: JSON.stringify(category.child.identity), durableEvidence: category.evidence, associationState: "active" };
              tx.insert(schema.categories).values(insertedCategory).run();
            }
          }
          tx.update(schema.projects).set({ relativePath: target.relativePath, nativeIdentity: JSON.stringify(child.identity),
            categoryId, associationState: "active", durableEvidence, modeInactive: false }).where(eq(schema.projects.id, input.projectId)).run();
          tx.update(schema.sources).set({ discoveryRevision: source.discoveryRevision + 1, evidenceGeneration:nextGeneration }).where(eq(schema.sources.id, source.id)).run();
          // Observations are not a filesystem lock. Any change seen during writes
          // rolls back; a later external change requires another explicit review.
          const after = scanSource(source);
          if (!after.snapshot || JSON.stringify(after.snapshot) !== JSON.stringify(review.snapshot) || JSON.stringify(evidenceFor(source,after)) !== JSON.stringify(review.evidence)) throw new StaleReview();
          const committed = tx.select().from(schema.sources).where(eq(schema.sources.id, source.id)).get()!;
          const expectedProjects = review.projects.map((row) => row.id === input.projectId ? { ...row,
            relativePath: target.relativePath, nativeIdentity: JSON.stringify(child.identity), categoryId, associationState: "active", durableEvidence, modeInactive: false } : row);
          const expectedCategories = [...review.categories, ...(insertedCategory ? [insertedCategory] : [])]
            .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
          if (configuration(committed) !== configuration({ ...review.source, discoveryRevision: source.discoveryRevision + 1, evidenceGeneration:nextGeneration }) ||
            JSON.stringify(projectsFor(source.id)) !== JSON.stringify(expectedProjects) ||
            JSON.stringify(categoriesFor(source.id)) !== JSON.stringify(expectedCategories) ||
            JSON.stringify(reservationsFor(source.id)) !== JSON.stringify(review.reservations)) throw new StaleReview();
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
  const { id, canonicalRoot, discoveryMode, folderRoles, discoveryRevision, excludedRelativePaths, archiveRelativePath, appliedRootIdentity, durableEvidence, evidenceGeneration } = source;
  return JSON.stringify({ id, canonicalRoot, discoveryMode, folderRoles, discoveryRevision, excludedRelativePaths, archiveRelativePath, appliedRootIdentity, durableEvidence, evidenceGeneration });
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
