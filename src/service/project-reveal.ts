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
  // A request-local receipt can acknowledge an already completed native call
  // across a dirty scan only while every persisted authorization input is unchanged.
  function authorizationFor(workspaceId: string, projectId: string): string {
    const workspace = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get();
    const source = workspace && db.select().from(schema.sources).where(eq(schema.sources.id, workspace.sourceId)).get();
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
    if (!source || !project || project.sourceId !== source.id) throw new InvalidReveal();
    const ordered = <T extends { id: string }>(rows: T[]) => rows.sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify([workspace, source, ordered(db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).all()),
      ordered(db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).all()),
      readProjectReservations(db, source.id), readProjectRelocationReservations(db, source.id)]);
  }
  function targetFor(workspaceId: string, projectId: string): { target: TrustedProjectRevealTarget; authorization: string } {
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
    const scan = (source.discoveryMode === "grouped" ? scanGroupedSource : scanDirectSource)(source.canonicalRoot,
      source.archiveRelativePath, projectExclusions(exclusions, source.discoveryMode).effective);
    if (!scan.snapshot) {
      if (scan.state === "changed") throw new UnstableRevealScan();
      throw new RevealFailure(scan.state === "root_identity_conflict" ? "root_replaced" : "unavailable");
    }
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
    return { target, authorization: authorizationFor(workspaceId, projectId) };
  }
  return {
    close() { closed = true; },
    async revealProject(input: unknown, native?: NativeProjectReveal): Promise<ServiceResult<ProjectRevealResult>> {
      if (!isProjectRevealRequest(input)) return invalid();
      const rejected = (problem: ProjectRevealProblem): ServiceResult<ProjectRevealResult> => ({ ok: true,
        value: { outcome: "rejected", workspaceId: input.workspaceId, projectId: input.projectId, problem } });
      try {
        if (closed) return rejected("request_expired");
        const initial = targetFor(input.workspaceId, input.projectId);
        const target = initial.target;
        let authorization = initial.authorization;
        if (!native) return rejected("native_unavailable");
        const revalidate = (): NativeProjectRevealValidation => {
          if (closed) return { outcome: "rejected", problem: "request_expired" };
          try {
            const current = targetFor(input.workspaceId, input.projectId);
            if (JSON.stringify(current.target) !== JSON.stringify(target)) return { outcome: "rejected", problem: "unresolved" };
            authorization = current.authorization;
            return { outcome: "verified" };
          } catch (error) { return { outcome: "rejected", problem: error instanceof RevealFailure ? error.problem : "request_expired" }; }
        };
        let result;
        try { result = await native(target, revalidate); } catch { return rejected("native_error"); }
        if (closed) return rejected("request_expired");
        if (result.outcome === "rejected") return rejected(result.problem);
        try {
          const current = targetFor(input.workspaceId, input.projectId);
          if (JSON.stringify(current.target) !== JSON.stringify(target)) return rejected("unresolved");
        } catch (error) {
          // This cannot authorize a native effect: that already returned dispatched.
          // Retain policy/ownership and physical target checks without demanding
          // that unrelated file-manager metadata stop changing after the effect.
          if (!(error instanceof UnstableRevealScan) || authorizationFor(input.workspaceId, input.projectId) !== authorization) throw error;
          verifyTrustedProjectRevealTarget(target, filesystem);
        }
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
class UnstableRevealScan extends RevealFailure {
  constructor() { super("unavailable"); }
}
function invalid(): ServiceResult<never> {
  return { ok: false, error: { code: "invalid_input", message: "Choose a saved workspace and one of its projects." } };
}

function nativeAlias(a: string, b: string): boolean {
  const left = JSON.parse(a), right = JSON.parse(b);
  return left.dev === right.dev && left.ino === right.ino;
}
