import { readProjectRelocationReservations, readProjectReservations } from "./project-rename-reservations.js";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isProjectRevealRequest, type ProjectRevealProblem, type ProjectRevealResult } from "../contracts/project-reveal.js";
import type { ServiceResult } from "../contracts/settings.js";
import type { NativeProjectReveal, NativeProjectRevealValidation, TrustedProjectRevealTarget } from "../contracts/service-protocol.js";
import { isChildName, planDiscovery, projectExclusions, sameIdentity, scanDirectSource, scanGroupedSource, validArchive, validExclusions } from "./discovery.js";
import { nativeProjectFilesystem, verifyTrustedProjectRevealTarget, RevealFailure, type ProjectFilesystem } from "./project-filesystem.js";
import * as schema from "./db/schema.js";
import { filesystemAlias } from "./path-alias.js";

export function createProjectRevealService(db: BetterSQLite3Database<typeof schema>, filesystem: ProjectFilesystem = nativeProjectFilesystem) {
  let closed = false;
  function targetFor(workspaceId: string, projectId: string): TrustedProjectRevealTarget {
    const source = db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
      .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
    if (!source || !project || project.sourceId !== source.id) throw new InvalidReveal();
    if (source.discoveryMode !== "direct" && source.discoveryMode !== "grouped" || source.appliedRootIdentity === null) throw new RevealFailure("unconfigured");
    if (readProjectRelocationReservations(db, source.id).some((row) => row.projectId === projectId)) throw new RevealFailure("unresolved");
    if (project.modeInactive) throw new RevealFailure("mode_retained");
    if (project.associationState !== "active") throw new RevealFailure(project.associationState);
    const components = project.relativePath.split("/");
    if (components.length !== (source.discoveryMode === "direct" ? 1 : 2) || !components.every(isChildName) ||
      (source.discoveryMode === "direct" && project.categoryId !== null)) throw new RevealFailure("unresolved");
    let parentRelativePath = "", parentIdentity = source.appliedRootIdentity;
    if (source.discoveryMode === "grouped") {
      const category = project.categoryId ? db.select().from(schema.categories).where(eq(schema.categories.id, project.categoryId)).get() : undefined;
      if (!category || category.sourceId !== source.id || category.modeInactive || category.associationState !== "active" ||
        category.relativePath !== components[0]) throw new RevealFailure("category_unavailable");
      parentRelativePath = category.relativePath; parentIdentity = category.nativeIdentity;
    }
    const target = { canonicalRoot: source.canonicalRoot, parentRelativePath, relativePath: project.relativePath,
      rootIdentity: source.appliedRootIdentity, parentIdentity, nativeIdentity: project.nativeIdentity };
    verifyTrustedProjectRevealTarget(target, filesystem);
    const exclusions: unknown = JSON.parse(source.excludedRelativePaths);
    if (!validExclusions(exclusions, "grouped") || !validArchive(source.archiveRelativePath)) throw new Error("Invalid source policy");
    const discoveryMode = source.discoveryMode;
    const scanSource = () => (discoveryMode === "grouped" ? scanGroupedSource : scanDirectSource)(source.canonicalRoot,
      source.archiveRelativePath, projectExclusions(exclusions, discoveryMode).effective);
    let scan = scanSource();
    // Finder can update directory metadata while a read-only snapshot is being
    // collected. Retry that unstable read once; never repeat native dispatch or
    // retry missing roots, denied access, identity conflicts or persistent churn.
    if (scan.state === "changed") scan = scanSource();
    if (!scan.snapshot) throw new RevealFailure(scan.state === "root_identity_conflict" ? "root_replaced" : "unavailable");
    if (!sameIdentity(scan.snapshot.root.identity, JSON.parse(source.appliedRootIdentity))) throw new RevealFailure("root_replaced");
    const entry = scan.entries.find((row) => row.kind === "project" && row.relativePath === project.relativePath);
    if (!entry || entry.reason !== null) throw new RevealFailure(entry?.reason === "link" ? "replaced" : "excluded");
    // Outstanding intents/evidence cannot be opened through another logical ID.
    const reservations = readProjectReservations(db, source.id);
    if (reservations.some((row) => !["completed", "failed"].includes(row.stage) &&
      (filesystemAlias(row.relativePath) === filesystemAlias(project.relativePath) ||
        row.nativeIdentity && nativeAlias(row.nativeIdentity, project.nativeIdentity)))) throw new RevealFailure("unresolved");
    const projects = db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all();
    const identity = JSON.parse(project.nativeIdentity);
    const categories = db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).all();
    const interpretation = planDiscovery(scan, categories, projects, reservations.filter((row) => !["completed", "failed"].includes(row.stage)));
    if (project.categoryId && interpretation.categories.retained.find((row) => row.id === project.categoryId)?.associationState !== "active") throw new RevealFailure("category_unavailable");
    const resolution = interpretation.projects.retained.find((row) => row.id === projectId)?.associationState;
    if (resolution !== "active") throw new RevealFailure(resolution ?? "unresolved");
    if (projects.some((row) => row.id !== projectId && row.associationState !== "replaced" &&
      sameIdentity(JSON.parse(row.nativeIdentity), identity)) || scan.snapshot.children.some((row) => row.kind === "directory" &&
        row.relativePath !== project.relativePath && sameIdentity(row.identity, identity))) throw new RevealFailure("unresolved");
    verifyTrustedProjectRevealTarget(target, filesystem);
    return target;
  }
  return {
    close() { closed = true; },
    async revealProject(input: unknown, native?: NativeProjectReveal): Promise<ServiceResult<ProjectRevealResult>> {
      if (!isProjectRevealRequest(input)) return invalid();
      const rejected = (problem: ProjectRevealProblem): ServiceResult<ProjectRevealResult> => ({ ok: true,
        value: { outcome: "rejected", workspaceId: input.workspaceId, projectId: input.projectId, problem } });
      try {
        if (closed) return rejected("request_expired");
        const target = targetFor(input.workspaceId, input.projectId);
        if (!native) return rejected("native_unavailable");
        const revalidate = (): NativeProjectRevealValidation => {
          if (closed) return { outcome: "rejected", problem: "request_expired" };
          try {
            return JSON.stringify(targetFor(input.workspaceId, input.projectId)) === JSON.stringify(target)
              ? { outcome: "verified" } : { outcome: "rejected", problem: "unresolved" };
          } catch (error) { return { outcome: "rejected", problem: error instanceof RevealFailure ? error.problem : "request_expired" }; }
        };
        let result;
        try { result = await native(target, revalidate); } catch { return rejected("native_error"); }
        if (closed) return rejected("request_expired");
        if (result.outcome === "rejected") return rejected(result.problem);
        const current = targetFor(input.workspaceId, input.projectId);
        if (JSON.stringify(current) !== JSON.stringify(target)) return rejected("unresolved");
        return { ok: true, value: { outcome: "dispatched", workspaceId: input.workspaceId, projectId: input.projectId } };
      } catch (error) {
        if (error instanceof InvalidReveal) return invalid();
        if (error instanceof RevealFailure) return rejected(error.problem);
        return { ok: false, error: { code: "storage", message: "The selected project folder could not be verified." } };
      }
    },
  };
}
class InvalidReveal extends Error {}
function invalid(): ServiceResult<never> {
  return { ok: false, error: { code: "invalid_input", message: "Choose a saved workspace and one of its projects." } };
}

function nativeAlias(a: string, b: string): boolean {
  const left = JSON.parse(a), right = JSON.parse(b);
  return left.dev === right.dev && left.ino === right.ino;
}
