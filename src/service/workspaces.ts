import { createSourceObserver, nativeObserverDependencies, type ObserverDependencies, type SourceObservation } from "./source-observer.js";
import { reconcileSource } from "./external-reconciliation.js";
import { createProjectRecoveryService } from "./project-recovery.js";
import { createProjectCreationService } from "./project-creation.js";
import type { ProjectFilesystem } from "./project-filesystem.js";
import type { ProjectCreationResult } from "../contracts/project-creation.js";
import type { ProjectRecoveryPreview } from "../contracts/project-recovery.js";
import { createCategoryPropertyService } from "./category-properties.js";
import { createTextPropertyService } from "./text-properties.js";
import type { TextPropertySnapshot, TextPropertyMutation } from "../contracts/text-properties.js";
import { modeRetainedResolution, planDiscovery, projectExclusions, reliableIdentity, sameIdentity, scanDirectSource, scanGroupedSource, validArchive, validExclusions, type DiscoveryScan, type DiscoverySnapshot } from "./discovery.js";
import type { CategoryPropertySnapshot, DiscoveryPreview, ProjectList } from "../contracts/workspaces.js";
import type { ServiceResult } from "../contracts/settings.js";
import { randomUUID } from "node:crypto";
import { accessSync, constants, opendirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { asc, eq, max, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";
import type { ActiveWorkspace, WorkspaceCreated, WorkspaceLoad, WorkspaceSourceObservationSnapshot, WorkspaceSourceState, WorkspaceChangeEvent } from "../contracts/workspaces.js";

type Database = BetterSQLite3Database<typeof schema>;

export interface WorkspaceFilesystem {
  realpath(path: string): string;
  legacyRealpath?(path: string): string;
  isDirectory(path: string): boolean;
  assertAccessible(path: string): void;
}

const nativeFilesystem: WorkspaceFilesystem = {
  realpath: (path) => realpathSync.native(path),
  legacyRealpath: (path) => realpathSync(path),
  isDirectory: (path) => statSync(path).isDirectory(),
  assertAccessible(path) {
    accessSync(path, constants.R_OK | constants.X_OK);
    // Windows access() does not check directory ACLs. Open without reading entries.
    const directory = opendirSync(path);
    directory.closeSync();
  },
};

export interface WorkspaceService {
  createProject(input: unknown): ServiceResult<ProjectCreationResult>;
  getSourceObservation(input: unknown): ServiceResult<WorkspaceSourceObservationSnapshot>;
  previewProjectRecovery(input: unknown): ServiceResult<ProjectRecoveryPreview>;
  reassociateProject(input: unknown): ServiceResult<ProjectList>;
  renameCategoryProperty(input: unknown): ServiceResult<CategoryPropertySnapshot>;
  listTextProperties(input: unknown): ServiceResult<TextPropertySnapshot>;
  createProperty(input: unknown): ServiceResult<TextPropertyMutation>;
  setTextValue(input: unknown): ServiceResult<TextPropertyMutation>;
  renameProperty(input: unknown): ServiceResult<TextPropertyMutation>;
  applyDiscovery(input: unknown): ServiceResult<ProjectList>;
  listProjects(input: unknown): ServiceResult<ProjectList>;
  previewDiscovery(input: unknown): ServiceResult<DiscoveryPreview>;
  subscribe(listener: (event: WorkspaceChangeEvent) => void): () => void;
  close(): void;
  refreshSource(input: unknown):
    | { ok: true; value: WorkspaceSourceState }
    | { ok: false; error: { code: "invalid_input" | "storage"; message: string } };
  create(input: unknown):
    | { ok: true; value: WorkspaceCreated }
    | { ok: false; error: { code: "invalid_input" | "filesystem" | "storage"; message: string } };
  rename(input: unknown):
    | { ok: true; value: WorkspaceLoad }
    | { ok: false; error: { code: "invalid_input" | "storage"; message: string } };
  reorder(input: unknown):
    | { ok: true; value: WorkspaceLoad }
    | { ok: false; error: { code: "invalid_input" | "storage"; message: string } };
  remove(input: unknown):
    | { ok: true; value: WorkspaceLoad }
    | { ok: false; error: { code: "invalid_input" | "storage"; message: string } };
  assertContained(sourceRoot: string, targetPath: string): boolean;
  load(): { ok: true; value: WorkspaceLoad } | { ok: false; error: { code: "storage"; message: string } };
  activate(input: unknown):
    | { ok: true; value: ActiveWorkspace }
    | { ok: false; error: { code: "invalid_input" | "storage"; message: string } };
}

export function createWorkspaceService(db: Database, filesystem = nativeFilesystem, observerDependencies?: ObserverDependencies, projectFilesystem?: ProjectFilesystem): WorkspaceService {
  const previewTokens = new Map<string, {
    preview: DiscoveryPreview;
    snapshot: DiscoverySnapshot;
    source: typeof schema.sources.$inferSelect;
    projects: typeof schema.projects.$inferSelect[];
    categories: typeof schema.categories.$inferSelect[];
    interpretation: ReturnType<typeof planDiscovery>;
  }>();
  const listeners = new Set<(event: WorkspaceChangeEvent) => void>();
  const observationEvents = new Map<string, Extract<WorkspaceChangeEvent, { type: "workspace.sourceObserved" }>>();
  const subscriptionTimers = new Set<{ cancel(): void }>();
  const observed = new Map<string, { canonicalRoot: string; sourceAvailable: boolean }>();
  const observationCache = new Map<string, SourceObservation>();
  const observationVersions = new Map<string, number>();
  type PendingObservation = { version: number; value: SourceObservation };
  let pendingObservations = new Map<string, PendingObservation>();
  let pendingProjectEvents: WorkspaceChangeEvent[] = [];
  let pending = new Map<string, { canonicalRoot: string; sourceAvailable: boolean }>();
  const observe: SourceObserver = (sourceId, state) => { pending.set(sourceId, state); };
  const recovery = createProjectRecoveryService(db, {
    projectList,
    invalidateSourceReviews,
    committed(sourceId, revision, workspaceIds) {
      for (const [id, saved] of previewTokens) if (saved.preview.sourceId === sourceId) previewTokens.delete(id);
      publish([{ type: "workspace.projectsChanged", sourceId, revision, workspaceIds }]);
      observer.request(sourceId);
    },
  });
  function invalidateSourceReviews(sourceId: string) {
    recovery.invalidateSource(sourceId);
    for (const [id, saved] of previewTokens) if (saved.preview.sourceId === sourceId) previewTokens.delete(id);
  }
  const service: WorkspaceService = {
    ...createProjectCreationService(db, {
      invalidateSourceReviews,
      committed(sourceId, revision, workspaceIds) {
        invalidateSourceReviews(sourceId);
        publish([{ type: "workspace.projectsChanged", sourceId, revision, workspaceIds }]);
        observer.request(sourceId);
      },
    }, projectFilesystem),
    getSourceObservation(input) {
      if (!isRecord(input) || input.type !== "workspace.getSourceObservation" || !isUuid(input.workspaceId) ||
        Object.keys(input).length !== 2 || !Object.hasOwn(input, "workspaceId")) return invalid("Choose a saved workspace.");
      try {
        const workspace = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, input.workspaceId)).get();
        if (!workspace) return invalid("Choose a saved workspace.");
        const event = observationEvents.get(workspace.sourceId);
        const workspaceIds = sourceState(workspace.sourceId, { canonicalRoot: "", sourceAvailable: false }).workspaceIds;
        return { ok: true, value: { observation: event ? { ...event, workspaceIds } : null } };
      } catch { return storageFailure(); }
    },
    previewProjectRecovery: recovery.previewProjectRecovery,
    reassociateProject: recovery.reassociateProject,
    ...createTextPropertyService(db, publish),
    ...createCategoryPropertyService(db, publish),
    subscribe(listener) {
      let active = true;
      const delivered = new Set<string>();
      const receive = (event: WorkspaceChangeEvent) => {
        if (!active) return;
        if (event.type === "workspace.sourceObserved") delivered.add(event.sourceId);
        listener(event);
      };
      listeners.add(receive);
      // Startup runs before the IPC subscriber exists. Deliver its current
      // runtime status after connection readiness, without a new revision.
      const timer = (observerDependencies ?? nativeObserverDependencies).schedule(() => {
        subscriptionTimers.delete(timer);
        if (!active) return;
        for (const [sourceId, event] of observationEvents) {
          const workspaceIds = sourceState(sourceId, { canonicalRoot: "", sourceAvailable: false }).workspaceIds;
          if (delivered.has(sourceId) || !workspaceIds.length) continue;
          try { receive({ ...event, workspaceIds }); } catch { /* Isolate the subscriber. */ }
        }
      }, 0);
      subscriptionTimers.add(timer);
      return () => { active = false; timer.cancel(); subscriptionTimers.delete(timer); listeners.delete(receive); };
    },
    close() {
      observer.close();
      for (const timer of subscriptionTimers) timer.cancel();
      subscriptionTimers.clear(); observationEvents.clear(); observationCache.clear(); observationVersions.clear();
      listeners.clear(); observed.clear(); previewTokens.clear(); recovery.close();
    },
    previewDiscovery(input) {
      if (!isRecord(input) || input.type !== "workspace.previewDiscovery" || !isUuid(input.workspaceId) ||
        !["type", "workspaceId"].every((key) => Object.hasOwn(input, key)) ||
        !Object.keys(input).every((key) => ["type", "workspaceId", "excludedRelativePaths", "mode"].includes(key)) ||
        (Object.hasOwn(input, "mode") && input.mode !== "direct" && input.mode !== "grouped")) {
        return invalid("Choose a saved workspace and valid discovery mode and folder exclusions.");
      }
      const workspaceId = input.workspaceId;
      previewTokens.delete(workspaceId);
      try {
        const source = db.select().from(schema.workspaces)
          .innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
          .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
        if (!source) return invalid("Choose a saved workspace.");
        const mode = input.mode ?? source.discoveryMode ?? "direct";
        if (mode !== "direct" && mode !== "grouped") return storageFailure();
        const saved: unknown = JSON.parse(source.excludedRelativePaths);
        if (!validExclusions(saved, "grouped") || !validArchive(source.archiveRelativePath) ||
          !Number.isSafeInteger(source.discoveryRevision) || source.discoveryRevision < 0 ||
          (source.discoveryMode !== null && source.discoveryMode !== "direct" && source.discoveryMode !== "grouped")) return storageFailure();
        if (Object.hasOwn(input, "excludedRelativePaths") && (!validExclusions(input.excludedRelativePaths, "grouped") ||
          input.excludedRelativePaths.some((path) => !saved.includes(path) && !validExclusions([path], mode)))) return invalid("Choose valid source-relative exclusions.");
        const exclusions = Object.hasOwn(input, "excludedRelativePaths") ? input.excludedRelativePaths as string[] : saved;
        const exclusionProjection = projectExclusions(exclusions, mode);
        const scan = (mode === "grouped" ? scanGroupedSource : scanDirectSource)(source.canonicalRoot, source.archiveRelativePath, exclusionProjection.effective);
        if (scan.snapshot && exclusions.some((name) => !saved.includes(name) &&
          !scan.entries.some((entry) => entry.relativePath === name && (entry.reason === null || entry.reason === "manual")))) {
          return invalid("Exclude only selectable folders in the current preview.");
        }
        let snapshot = scan.snapshot;
        let state = scan.state;
        if (snapshot && (!reliableIdentity(snapshot.root.identity) || (source.appliedRootIdentity !== null &&
          !sameIdentity(JSON.parse(source.appliedRootIdentity), snapshot.root.identity)))) {
          snapshot = null;
          state = "root_identity_conflict";
        }
        if (!snapshot) invalidateSourceReviews(source.id);
        const projects = readProjects(source.id);
        const categories = readCategories(source.id);
        const interpretation = snapshot ? planDiscovery(scan, categories, projects) : null;
        const interpreted = interpretation?.entries ?? [];
        const property = db.select().from(schema.categoryProperties).where(eq(schema.categoryProperties.sourceId, source.id)).get();
        if (snapshot) state = interpreted.some((entry) => entry.reason === null) ? "ready" : "empty";
        const preview: DiscoveryPreview = {
          currentMode: source.discoveryMode as DiscoveryPreview["currentMode"],
          projectEffects: interpretation?.projectEffects ?? { added: [], retained: [], noLongerRecognized: [], alreadyRetained: [] },
          categoryAvailability: { current: source.discoveryMode === "grouped", target: mode === "grouped", propertyId: property?.id ?? null, name: property?.name ?? null },
          mode, configured: source.discoveryMode !== null, workspaceId, sourceId: source.id, revision: source.discoveryRevision, canonicalRoot: source.canonicalRoot,
          excludedRelativePaths: [...exclusions].sort(), entries: interpreted, state,
          effectiveExcludedRelativePaths: exclusionProjection.effective, inactiveExcludedRelativePaths: exclusionProjection.inactive,
          previewToken: snapshot ? randomUUID() : null,
        };
        // Keep the reviewed draft/configuration independent of the caller's response object.
        if (snapshot && interpretation) previewTokens.set(workspaceId, { preview: structuredClone(preview), snapshot, source, projects, categories, interpretation: structuredClone(interpretation) });
        return { ok: true, value: preview };
      } catch { return storageFailure(); }
    },
    listProjects(input) {
      if (!workspacePayload(input, "workspace.listProjects", ["type", "workspaceId"])) return invalid("Choose a saved workspace.");
      try {
        const source = workspaceSource(input.workspaceId as string);
        if (!source) return invalid("Choose a saved workspace.");
        return { ok: true, value: projectList(input.workspaceId as string, source) };
      } catch { return storageFailure(); }
    },
    applyDiscovery(input) {
      if (!workspacePayload(input, "workspace.applyDiscovery", ["type", "workspaceId", "previewToken"]) ||
        !isUuid(input.previewToken)) return invalid("Choose a saved workspace and a reviewed preview.");
      const workspaceId = input.workspaceId as string;
      const stale = () => {
        previewTokens.delete(workspaceId);
        return { ok: false as const, error: { code: "stale_preview" as const, message: "Refresh the preview and review current folders before applying." } };
      };
      try {
        const source = workspaceSource(workspaceId);
        if (!source) return invalid("Choose a saved workspace.");
        const token = previewTokens.get(workspaceId);
        if (!token || token.preview.previewToken !== input.previewToken ||
          discoverySourceState(token.source) !== discoverySourceState(source) ||
          JSON.stringify(token.projects) !== JSON.stringify(readProjects(source.id)) ||
          JSON.stringify(token.categories) !== JSON.stringify(readCategories(source.id))) return stale();
        const mode = token.preview.mode;
        const scanner = mode === "grouped" ? scanGroupedSource : scanDirectSource;
        const scan = scanner(source.canonicalRoot, source.archiveRelativePath, token.preview.effectiveExcludedRelativePaths);
        if (!scan.snapshot || JSON.stringify(scan.snapshot) !== JSON.stringify(token.snapshot) ||
          !reliableIdentity(scan.snapshot.root.identity)) return stale();
        const planned = planDiscovery(scan, token.categories, token.projects);
        const interpretation = planned.projects;
        if (JSON.stringify(planned) !== JSON.stringify(token.interpretation)) return stale();
        const changed = source.discoveryMode !== mode ||
          source.excludedRelativePaths !== JSON.stringify(token.preview.excludedRelativePaths) ||
          source.appliedRootIdentity !== JSON.stringify(scan.snapshot.root.identity) ||
          interpretation.additions.length > 0 ||
          interpretation.retained.some((row, index) => row.associationState !== token.projects[index].associationState || !!row.modeInactive !== token.projects[index].modeInactive) ||
          planned.categories.additions.length > 0 ||
          planned.categories.retained.some((row, index) => row.associationState !== token.categories[index].associationState || !!row.modeInactive !== token.categories[index].modeInactive);
        if (changed && !Number.isSafeInteger(source.discoveryRevision + 1)) return storageFailure();
        const committedEvent: WorkspaceChangeEvent = { type: "workspace.projectsChanged", sourceId: source.id,
          workspaceIds: sourceState(source.id, { canonicalRoot: source.canonicalRoot, sourceAvailable: true }).workspaceIds,
          revision: source.discoveryRevision + (changed ? 1 : 0) };
        const { result, observation } = db.transaction((tx) => {
          if (discoverySourceState(workspaceSource(workspaceId)) !== discoverySourceState(source) ||
            JSON.stringify(readProjects(source.id)) !== JSON.stringify(token.projects) ||
            JSON.stringify(readCategories(source.id)) !== JSON.stringify(token.categories)) throw new StalePreview();
          // Revalidate again inside the transaction, before making any persistent change.
          const beforeWrites = scanner(source.canonicalRoot, source.archiveRelativePath, token.preview.effectiveExcludedRelativePaths);
          if (!beforeWrites.snapshot || JSON.stringify(beforeWrites.snapshot) !== JSON.stringify(token.snapshot)) throw new StalePreview();
          const changedProjects = interpretation.retained.filter((row, index) =>
            row.associationState !== token.projects[index].associationState || !!row.modeInactive !== token.projects[index].modeInactive);
          const changedCategories = planned.categories.retained.filter((row, index) =>
            row.associationState !== token.categories[index].associationState || !!row.modeInactive !== token.categories[index].modeInactive);
          const writeProject = (row: typeof changedProjects[number]) => tx.update(schema.projects)
            .set({ associationState: row.associationState, modeInactive: !!row.modeInactive }).where(eq(schema.projects.id, row.id)).run();
          // Retire incompatible projects before categories and source configuration.
          for (const row of changedProjects.filter((row) => row.modeInactive || row.associationState !== "active")) writeProject(row);
          for (const row of changedCategories.filter((row) => row.modeInactive || row.associationState !== "active")) {
            tx.update(schema.categories).set({ associationState: row.associationState, modeInactive: !!row.modeInactive })
              .where(eq(schema.categories.id, row.id)).run();
          }
          const expectedSource = { ...source, discoveryMode: mode, discoveryRevision: source.discoveryRevision + (changed ? 1 : 0),
            excludedRelativePaths: JSON.stringify(token.preview.excludedRelativePaths), appliedRootIdentity: JSON.stringify(scan.snapshot!.root.identity) };
          if (changed) tx.update(schema.sources).set({ discoveryMode: mode, discoveryRevision: expectedSource.discoveryRevision,
            excludedRelativePaths: expectedSource.excludedRelativePaths, appliedRootIdentity: expectedSource.appliedRootIdentity,
          }).where(eq(schema.sources.id, source.id)).run();
          const insertedCategories: typeof schema.categories.$inferSelect[] = [];
          if (mode === "grouped") {
            for (const row of changedCategories.filter((row) => !row.modeInactive && row.associationState === "active")) {
              tx.update(schema.categories).set({ associationState: row.associationState, modeInactive: false }).where(eq(schema.categories.id, row.id)).run();
            }
            for (const row of planned.categories.additions) {
              const inserted = { id: randomUUID(), sourceId: source.id, ...row, associationState: "active" as const, modeInactive: false };
              tx.insert(schema.categories).values(inserted).run(); insertedCategories.push(inserted);
            }
            if (!tx.select().from(schema.categoryProperties).where(eq(schema.categoryProperties.sourceId, source.id)).get()) {
              tx.insert(schema.categoryProperties).values({ id: randomUUID(), sourceId: source.id, name: null }).run();
            }
          }
          for (const row of changedProjects.filter((row) => !row.modeInactive && row.associationState === "active")) writeProject(row);
          const categories = readCategories(source.id);
          const insertedProjects: typeof schema.projects.$inferSelect[] = [];
          for (const row of interpretation.additions) {
            const category = mode === "grouped" ? categories.find((category) => !category.modeInactive && category.relativePath === row.relativePath.split("/")[0] && category.associationState === "active") : null;
            if (mode === "grouped" && !category) throw new Error("Missing required category");
            const inserted = { id: randomUUID(), sourceId: source.id, ...row,
              categoryId: category?.id ?? null, associationState: "active" as const, modeInactive: false };
            tx.insert(schema.projects).values(inserted).run(); insertedProjects.push(inserted);
          }
          const expectedProjects = [...token.projects.map((row) => {
            const target = interpretation.retained.find((target) => target.id === row.id)!;
            return { ...row, associationState: target.associationState, modeInactive: !!target.modeInactive };
          }), ...insertedProjects].sort((a, b) => a.id.localeCompare(b.id));
          const expectedCategories = [...token.categories.map((row) => {
            const target = planned.categories.retained.find((target) => target.id === row.id)!;
            return { ...row, associationState: target.associationState, modeInactive: !!target.modeInactive };
          }), ...insertedCategories].sort((a, b) => a.id.localeCompare(b.id));
          // Observed changes during persistence roll back all DB writes. This is not a filesystem lock.
          const recheck = scanner(source.canonicalRoot, source.archiveRelativePath, token.preview.effectiveExcludedRelativePaths);
          if (!recheck.snapshot || JSON.stringify(recheck.snapshot) !== JSON.stringify(token.snapshot)) throw new StalePreview();
          if (discoverySourceState(workspaceSource(workspaceId)) !== discoverySourceState(expectedSource) ||
            !sameAssociations(readProjects(source.id), expectedProjects) ||
            !sameAssociations(readCategories(source.id), expectedCategories)) throw new StalePreview();
          const committed = tx.select().from(schema.sources).where(eq(schema.sources.id, source.id)).get()!;
          const result = projectList(workspaceId, committed, recheck);
          return { result, observation: sourceObservation(committed, recheck, result) };
        });
        previewTokens.delete(workspaceId);
        const observationVersion = (observationVersions.get(source.id) ?? 0) + 1;
        observationVersions.set(source.id, observationVersion);
        if (changed) {
          recovery.invalidateSource(source.id);
          for (const [id, saved] of previewTokens) if (saved.preview.sourceId === source.id) previewTokens.delete(id);
          publish([committedEvent]);
        }
        syncObserverReferences();
        // Subscribers may commit a newer mode before publication returns. Only
        // accept this command's validated targets while its lifetime is current.
        if (source.discoveryMode !== mode && observationVersions.get(source.id) === observationVersion) {
          const current = db.select().from(schema.sources).where(eq(schema.sources.id, source.id)).get();
          if (current?.discoveryRevision === result.revision && current.discoveryMode === mode) {
            observationCache.set(source.id, observation);
            observer.accept(source.id, observation);
          }
        }
        observer.request(source.id);
        return { ok: true, value: result };
      } catch (error) { return error instanceof StalePreview ? stale() : storageFailure(); }
    },
    refreshSource(input) {
      if (!isRecord(input) || input.type !== "workspace.refreshSource" ||
        Object.keys(input).length !== 2 || !Object.hasOwn(input, "workspaceId") || !isUuid(input.workspaceId)) {
        return invalid("Choose a saved workspace.");
      }
      const source = db.select({ sourceId: schema.sources.id, canonicalRoot: schema.sources.canonicalRoot })
        .from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
        .where(eq(schema.workspaces.id, input.workspaceId)).get();
      if (!source) return invalid("Choose a saved workspace.");
      const observationVersion = (observationVersions.get(source.sourceId) ?? 0) + 1;
      observationVersions.set(source.sourceId, observationVersion);
      const state = normalizeSource(db, source.sourceId, source.canonicalRoot, filesystem, observe);
      const configured = workspaceSource(input.workspaceId)!;
      const reconciled = state.sourceAvailable ? reconcileSource(db, configured) : { changed: false, scan: null };
      if (!state.sourceAvailable || reconciled.scan && !reconciled.scan.snapshot) invalidateSourceReviews(source.sourceId);
      if (reconciled.changed) pendingProjectEvents.push({ type: "workspace.projectsChanged", sourceId: source.sourceId,
        revision: configured.discoveryRevision + 1, workspaceIds: sourceState(source.sourceId, state).workspaceIds });
      if (configured.discoveryMode !== null) {
        const scan = reconciled.scan ?? { state: "unavailable" as const, entries: [], snapshot: null };
        const current = workspaceSource(input.workspaceId)!;
        const projection = projectList(input.workspaceId, current, scan);
        pendingObservations.set(current.id, { version: observationVersion, value: sourceObservation(current, scan, projection) });
      }
      return { ok: true, value: sourceState(source.sourceId, state) };
    },
    create(input) {
      if (!isRecord(input) || input.type !== "workspace.create" || typeof input.name !== "string" ||
        typeof input.rootPath !== "string") {
        return invalid("Expected a workspace name and root path.");
      }
      const name = input.name;
      const rootPath = input.rootPath;
      if (!name.trim()) return invalid("Enter a workspace name.");

      let canonicalRoot: string;
      try {
        canonicalRoot = filesystem.realpath(rootPath);
        if (!filesystem.isDirectory(canonicalRoot)) return filesystemError();
        filesystem.assertAccessible(canonicalRoot);
      } catch {
        return filesystemError();
      }

      const workspaceId = randomUUID();
      const viewId = randomUUID();
      try {
        const created = db.transaction((tx) => {
          let source = tx.select().from(schema.sources)
            .where(eq(schema.sources.canonicalRoot, canonicalRoot)).get();
          if (!source) {
            source = tx.select().from(schema.sources).all().find((candidate) =>
              availableRoot(candidate.canonicalRoot, filesystem) === canonicalRoot);
            if (source) {
              tx.update(schema.sources).set({ canonicalRoot }).where(eq(schema.sources.id, source.id)).run();
            }
          }
          if (!source) {
            source = tx.insert(schema.sources).values({ id: randomUUID(), canonicalRoot }).returning().get();
          }
          const lastPosition = tx.select({ value: max(schema.workspaces.position) }).from(schema.workspaces).get()?.value;
          tx.insert(schema.workspaces).values({ id: workspaceId, name, sourceId: source.id, position: (lastPosition ?? -1) + 1 }).run();
          tx.insert(schema.views).values({
            id: viewId, workspaceId, name: "Table", kind: "table",
          }).run();
          tx.insert(schema.activeWorkspace).values({ key: "active", workspaceId, viewId })
            .onConflictDoUpdate({
              target: schema.activeWorkspace.key,
              set: { workspaceId, viewId },
            }).run();
          return source.id;
        });
        observe(created, { canonicalRoot, sourceAvailable: true });
        return { ok: true, value: { sourceId: created, workspaceId, viewId, name, canonicalRoot } };
      } catch {
        return { ok: false, error: { code: "storage", message: "Workspace could not be created." } };
      }
    },
    rename(input) {
      if (!isRecord(input) || input.type !== "workspace.rename" ||
        Object.keys(input).length !== 3 || !["type", "workspaceId", "name"].every((key) => Object.hasOwn(input, key)) ||
        !isUuid(input.workspaceId) || typeof input.name !== "string" ||
        !input.name.trim()) {
        return invalid("Choose a saved workspace and enter a nonblank name.");
      }
      const { workspaceId, name } = input;
      try {
        return db.transaction((tx) => {
          const workspace = tx.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get();
          if (!workspace) return invalid("Choose a saved workspace and enter a nonblank name.");
          tx.update(schema.workspaces).set({ name }).where(eq(schema.workspaces.id, workspaceId)).run();
          return { ok: true as const, value: readWorkspaceLoad(tx, filesystem, observe) };
        });
      } catch {
        return storageFailure();
      }
    },
    reorder(input) {
      if (!isRecord(input) || input.type !== "workspace.reorder" ||
        Object.keys(input).length !== 2 || !Object.hasOwn(input, "workspaceIds") ||
        !Array.isArray(input.workspaceIds) || !input.workspaceIds.every(isUuid)) {
        return invalid("Submit the complete current workspace order.");
      }
      const workspaceIds = input.workspaceIds as string[];
      try {
        return db.transaction((tx) => {
          const current = tx.select({ id: schema.workspaces.id }).from(schema.workspaces).all();
          const submitted = new Set(workspaceIds);
          if (submitted.size !== workspaceIds.length || current.length !== workspaceIds.length ||
            !current.every(({ id }) => submitted.has(id))) {
            return invalid("Submit the complete current workspace order.");
          }
          workspaceIds.forEach((id, position) => {
            tx.update(schema.workspaces).set({ position }).where(eq(schema.workspaces.id, id)).run();
          });
          return { ok: true as const, value: readWorkspaceLoad(tx, filesystem, observe) };
        });
      } catch {
        return storageFailure();
      }
    },
    remove(input) {
      if (!isRecord(input) || input.type !== "workspace.remove" ||
        Object.keys(input).length !== 2 || !Object.hasOwn(input, "workspaceId") || !isUuid(input.workspaceId)) {
        return invalid("Choose a saved workspace to remove.");
      }
      const { workspaceId } = input;
      try {
        return db.transaction((tx) => {
          const current = tx.select().from(schema.workspaces)
            .orderBy(asc(schema.workspaces.position), asc(schema.workspaces.id)).all();
          if (!current.some((workspace) => workspace.id === workspaceId)) return invalid("Choose a saved workspace to remove.");
          const remaining = current.filter((workspace) => workspace.id !== workspaceId);
          const active = tx.select().from(schema.activeWorkspace).where(eq(schema.activeWorkspace.key, "active")).get();
          if (active?.workspaceId === workspaceId) {
            const fallback = remaining[0];
            if (fallback) {
              const view = tx.select().from(schema.views).where(eq(schema.views.workspaceId, fallback.id))
                .orderBy(asc(schema.views.id)).all().find((candidate) => candidate.kind === "table");
              if (!view) throw new Error("Missing fallback Table view.");
              tx.update(schema.activeWorkspace).set({ workspaceId: fallback.id, viewId: view.id })
                .where(eq(schema.activeWorkspace.key, "active")).run();
            } else {
              tx.delete(schema.activeWorkspace).where(eq(schema.activeWorkspace.key, "active")).run();
            }
          }
          tx.delete(schema.views).where(eq(schema.views.workspaceId, workspaceId)).run();
          tx.delete(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).run();
          remaining.forEach((workspace, position) => {
            tx.update(schema.workspaces).set({ position }).where(eq(schema.workspaces.id, workspace.id)).run();
          });
          return { ok: true as const, value: readWorkspaceLoad(tx, filesystem, observe) };
        });
      } catch {
        return storageFailure();
      }
    },
    assertContained(sourceRoot, targetPath) {
      try {
        const canonicalSource = filesystem.realpath(sourceRoot);
        const canonicalTarget = filesystem.realpath(targetPath);
        const rel = relative(canonicalSource, canonicalTarget);
        return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
      } catch {
        return false;
      }
    },
    load() {
      try {
        return { ok: true, value: db.transaction((tx) => readWorkspaceLoad(tx, filesystem, observe)) };
      } catch {
        return storageFailure();
      }
    },
    activate(input) {
      if (!isRecord(input) || input.type !== "workspace.activate" || !isUuid(input.workspaceId)) {
        return invalid("Choose a saved workspace.");
      }
      try {
        const workspace = db.select({
          workspaceId: schema.workspaces.id,
          name: schema.workspaces.name,
          sourceId: schema.sources.id,
          canonicalRoot: schema.sources.canonicalRoot,
        }).from(schema.workspaces)
          .innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
          .where(eq(schema.workspaces.id, input.workspaceId)).get();
        if (!workspace) return invalid("Choose a saved workspace.");
        const view = db.select().from(schema.views)
          .where(eq(schema.views.workspaceId, workspace.workspaceId)).get();
        if (!view || view.kind !== "table") return storageFailure();
        const value = db.transaction((tx) => {
          const sourceState = normalizeSource(tx, workspace.sourceId, workspace.canonicalRoot, filesystem, observe);
          tx.insert(schema.activeWorkspace).values({
            key: "active", workspaceId: workspace.workspaceId, viewId: view.id,
          }).onConflictDoUpdate({
            target: schema.activeWorkspace.key,
            set: { workspaceId: workspace.workspaceId, viewId: view.id },
          }).run();
          return { ...toActiveWorkspace(workspace, view.id, sourceState.sourceAvailable), ...sourceState };
        });
        return { ok: true, value };
      } catch {
        return storageFailure();
      }
    },
  };

  function workspaceSource(workspaceId: string) {
    return db.select().from(schema.workspaces).innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
      .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
  }
  function readProjects(sourceId: string) {
    return db.select().from(schema.projects).where(eq(schema.projects.sourceId, sourceId)).orderBy(asc(schema.projects.id)).all();
  }
  function readCategories(sourceId: string) {
    return db.select().from(schema.categories).where(eq(schema.categories.sourceId, sourceId)).orderBy(asc(schema.categories.id)).all();
  }
  function projectList(workspaceId: string, source: typeof schema.sources.$inferSelect,
    observedScan?: DiscoveryScan): ProjectList {
    const mode = source.discoveryMode;
    if (!validExclusions(JSON.parse(source.excludedRelativePaths), "grouped") || !validArchive(source.archiveRelativePath) ||
      !Number.isSafeInteger(source.discoveryRevision) || source.discoveryRevision < 0 ||
      !Number.isSafeInteger(source.categoryPropertyRevision) || source.categoryPropertyRevision < 0 ||
      (mode !== null && mode !== "direct" && mode !== "grouped")) throw new Error("Invalid source configuration");
    const currentScan = observedScan ?? (source.discoveryMode === "grouped" ? scanGroupedSource : scanDirectSource)(source.canonicalRoot, source.archiveRelativePath, projectExclusions(JSON.parse(source.excludedRelativePaths), mode === "grouped" ? "grouped" : "direct").effective);
    const projects = readProjects(source.id);
    const categories = readCategories(source.id);
    const property = db.select().from(schema.categoryProperties).where(eq(schema.categoryProperties.sourceId, source.id)).get();
    if (mode === "grouped" && !property) throw new Error("Invalid category property configuration");
    let state = currentScan.state;
    if (currentScan.snapshot && (!reliableIdentity(currentScan.snapshot.root.identity) || source.appliedRootIdentity &&
      !sameIdentity(JSON.parse(source.appliedRootIdentity), currentScan.snapshot.root.identity))) state = "root_identity_conflict";
    const verified = currentScan.snapshot && state !== "root_identity_conflict";
    if (!verified) invalidateSourceReviews(source.id);
    const planned = verified ? planDiscovery(currentScan, categories, projects) : null;
    const interpretation = planned?.projects;
    const projection = projects.map((row) => {
      const category = categories.find((category) => category.id === row.categoryId && !category.modeInactive && category.associationState === "active");
      if (!row.modeInactive && row.associationState === "active" && (mode === "grouped" ? !category || row.relativePath.split("/").length !== 2 || row.relativePath.split("/")[0] !== category.relativePath : row.categoryId !== null)) {
        throw new Error("Invalid required category");
      }
      return { projectId: row.id, relativePath: row.relativePath, name: row.relativePath.split("/").at(-1)!, categoryId: row.categoryId,
        categoryName: categories.find((category) => category.id === row.categoryId)?.relativePath ?? null,
        retentionReason: row.modeInactive ? "mode_change" as const : null,
        associationState: row.associationState, resolution: row.modeInactive
          ? modeRetainedResolution(verified ? currentScan : { ...currentScan, snapshot: null }, row, JSON.parse(source.excludedRelativePaths), source.archiveRelativePath)
          : interpretation?.retained.find((observed) => observed.id === row.id)?.associationState ?? null };
    }).sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0);
    const active = projection.filter((row) => row.retentionReason === null && row.associationState === "active" && (row.resolution === "active" || row.resolution === null));
    const retainedProjects = projection.filter((row) => !active.includes(row));
    return { workspaceId, sourceId: source.id, revision: source.discoveryRevision, configured: mode !== null, mode,
      categories: categories.filter((row) => mode === "grouped" && !row.modeInactive && row.associationState === "active" &&
        (!planned || planned.categories.retained.find((observed) => observed.id === row.id)?.associationState === "active")).map((row) => ({
        categoryId: row.id, relativePath: row.relativePath, name: row.relativePath,
      })).sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0),
      categoryProperty: mode === "grouped" && property ? { propertyId: property.id, sourceId: property.sourceId, name: property.name } : null,
      categoryPropertyRevision: source.categoryPropertyRevision,
      state, projects: active, retainedProjects, retainedCount: retainedProjects.length };
  }

  function sourceObservation(current: typeof schema.sources.$inferSelect, scan: DiscoveryScan, projection: ProjectList): SourceObservation {
    const targets = scan.snapshot ? [scan.snapshot.root, ...scan.snapshot.children.filter((child) =>
      scan.snapshot!.mode === "grouped" && child.kind === "directory" && !child.relativePath.includes("/"))]
      .filter((child) => child.kind === "directory" && reliableIdentity(child.identity))
      .map((child) => {
        if (child.kind !== "directory") throw new Error("Invalid watch target");
        return { path: join(current.canonicalRoot, child.relativePath), identity: child.identity, stamp: `${child.mtimeNs}:${child.ctimeNs}` };
      }) : [];
    // Timestamp changes help validate scans, but have no semantic observation revision.
    const topology = scan.snapshot?.children.map((child) => child.kind === "excluded" ? child :
      { relativePath: child.relativePath, kind: child.kind, identity: child.identity });
    return { state: projection.state, targets,
      signature: JSON.stringify([topology, projection.projects, projection.retainedProjects, projection.categories]) };
  }

  function sourceState(sourceId: string, state: { canonicalRoot: string; sourceAvailable: boolean }): WorkspaceSourceState {
    const references = db.select({ workspaceId: schema.workspaces.id }).from(schema.workspaces)
      .where(eq(schema.workspaces.sourceId, sourceId))
      .orderBy(asc(schema.workspaces.position), asc(schema.workspaces.id)).all();
    return { sourceId, workspaceIds: references.map((row) => row.workspaceId), ...state };
  }

  const notificationQueue: WorkspaceChangeEvent[] = [];
  let publishing = false;
  function publish(events: WorkspaceChangeEvent[]) {
    notificationQueue.push(...events);
    if (publishing) return;
    publishing = true;
    try {
      let event: WorkspaceChangeEvent | undefined;
      while ((event = notificationQueue.shift())) {
        for (const listener of [...listeners]) {
          // Subscriber failure cannot change the result of a committed command.
          try { listener(event); } catch { /* The remaining subscribers still receive the change. */ }
        }
      }
    } finally { publishing = false; }
  }

  function returnedSnapshot(result: ReturnType<WorkspaceService["rename"]>): WorkspaceLoad | undefined {
    return result.ok ? result.value : undefined;
  }

  function currentSnapshot(): WorkspaceLoad {
    return readWorkspaceLoad(db, filesystem, observe);
  }

  function activationSnapshot(result: ReturnType<WorkspaceService["activate"]>): WorkspaceLoad | undefined {
    return result.ok ? readWorkspaceLoad(db, filesystem, observe, result.value) : undefined;
  }

  function run<R extends { ok: boolean }>(operation: () => R, listSnapshot?: (result: R) => WorkspaceLoad | undefined, acceptObservation = true): R | ReturnType<typeof storageFailure> {
    pending = new Map();
    pendingProjectEvents = [];
    pendingObservations = new Map();
    let observations = new Map<string, PendingObservation>();
    let snapshot: WorkspaceLoad | undefined;
    let sources: WorkspaceSourceState[] = [];
    try {
      const result = db.transaction(() => {
        const result = operation();
        if (result.ok) {
          snapshot = listSnapshot?.(result);
          observations = pendingObservations;
          sources = [...pending].map(([sourceId, state]) => sourceState(sourceId, state));
        }
        return result;
      });
      if (result.ok) {
        // Publish the authoritative selection/list before source observations.
        const events: WorkspaceChangeEvent[] = snapshot ? [{ type: "workspace.listChanged", snapshot }] : [];
        for (const event of pendingProjectEvents) {
          if (event.type === "workspace.projectsChanged") invalidateSourceReviews(event.sourceId);
          events.push(event);
        }
        for (const source of sources) {
          const previous = observed.get(source.sourceId);
          observed.set(source.sourceId, { canonicalRoot: source.canonicalRoot, sourceAvailable: source.sourceAvailable });
          if (!previous || previous.canonicalRoot !== source.canonicalRoot || previous.sourceAvailable !== source.sourceAvailable) {
            invalidateSourceReviews(source.sourceId);
            events.push({ type: "workspace.sourceChanged", source });
          }
        }
        publish(events);
        syncObserverReferences();
        for (const [sourceId, observation] of observations) {
          // A reentrant subscriber may already have refreshed a newer snapshot.
          if (observation.version !== observationVersions.get(sourceId)) continue;
          observationCache.set(sourceId, observation.value);
          if (acceptObservation) observer.accept(sourceId, observation.value);
        }
      }
      return result;
    } catch { return storageFailure(); }
  }

  const observer = createSourceObserver((sourceId) => {
    const workspaceId = sourceState(sourceId, { canonicalRoot: "", sourceAvailable: false }).workspaceIds[0];
    if (!workspaceId) throw new Error("Source no longer referenced");
    const result = run(() => service.refreshSource({ type: "workspace.refreshSource", workspaceId }), undefined, false);
    const observation = observationCache.get(sourceId);
    if (!result.ok || !observation) throw new Error("Source observation failed");
    return observation;
  }, (sourceId, observation, observationRevision, automaticUpdates) => {
    const workspaceIds = sourceState(sourceId, { canonicalRoot: "", sourceAvailable: false }).workspaceIds;
    if (!workspaceIds.length) return;
    invalidateSourceReviews(sourceId);
    const event: Extract<WorkspaceChangeEvent, { type: "workspace.sourceObserved" }> = {
      type: "workspace.sourceObserved", sourceId, workspaceIds, observationRevision, state: observation.state, automaticUpdates,
    };
    observationEvents.set(sourceId, event);
    publish([event]);
  }, observerDependencies);
  function syncObserverReferences() {
    const references = new Set(db.select({ sourceId: schema.workspaces.sourceId }).from(schema.workspaces).all().map((row) => row.sourceId));
    observer.sync(db.select().from(schema.sources).all().filter((source) => references.has(source.id) && source.discoveryMode !== null)
      .map((source) => ({ sourceId: source.id, root: source.canonicalRoot })));
  }
  // Reconcile persisted configured sources before clients can query after restart.
  // Historical settings-only migration fixtures have no configured sources yet.
  if (db.all<{ name: string }>(sql`PRAGMA table_info(projects)`).some((column) => column.name === "category_id")) syncObserverReferences();
  return {
    ...service,
    create: (input) => run(() => service.create(input), currentSnapshot),
    rename: (input) => run(() => service.rename(input), returnedSnapshot),
    reorder: (input) => run(() => service.reorder(input), returnedSnapshot),
    remove: (input) => {
      const result = run(() => service.remove(input), returnedSnapshot);
      if (result.ok && isRecord(input) && typeof input.workspaceId === "string") { previewTokens.delete(input.workspaceId); recovery.removeWorkspace(input.workspaceId); }
      return result;
    },
    activate: (input) => run(() => service.activate(input), activationSnapshot),
    load: () => run(() => service.load()),
    refreshSource: (input) => run(() => service.refreshSource(input)),
  };
}

type SourceObserver = (sourceId: string, state: { canonicalRoot: string; sourceAvailable: boolean }) => void;

function readWorkspaceLoad(
  db: Pick<Database, "select" | "update">,
  filesystem: WorkspaceFilesystem,
  observe: SourceObserver,
  observedSource?: Pick<ActiveWorkspace, "sourceId" | "canonicalRoot" | "sourceAvailable">,
): WorkspaceLoad {
  const workspaces = db.select({
    workspaceId: schema.workspaces.id,
    name: schema.workspaces.name,
    sourceId: schema.sources.id,
    canonicalRoot: schema.sources.canonicalRoot,
  }).from(schema.workspaces)
    .innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
    .orderBy(asc(schema.workspaces.position), asc(schema.workspaces.id)).all();
  const active = db.select({
    workspaceId: schema.activeWorkspace.workspaceId,
    viewId: schema.activeWorkspace.viewId,
  }).from(schema.activeWorkspace).where(eq(schema.activeWorkspace.key, "active")).get();
  const summaries = workspaces.map(({ workspaceId, name }) => ({ workspaceId, name }));
  if (!active) return { workspaces: summaries, activeWorkspace: null };

  const current = workspaces.find((workspace) => workspace.workspaceId === active.workspaceId);
  const view = db.select().from(schema.views).where(eq(schema.views.id, active.viewId)).get();
  if (!current || !view || view.workspaceId !== current.workspaceId || view.kind !== "table") {
    throw new Error("Invalid active workspace or view.");
  }
  const sourceState = observedSource?.sourceId === current.sourceId
    ? { canonicalRoot: observedSource.canonicalRoot, sourceAvailable: observedSource.sourceAvailable }
    : normalizeSource(db, current.sourceId, current.canonicalRoot, filesystem, observe);
  const activeWorkspace = { ...toActiveWorkspace(current, active.viewId, sourceState.sourceAvailable), ...sourceState };
  return { workspaces: summaries, activeWorkspace };
}

function availableRoot(storedRoot: string, filesystem: WorkspaceFilesystem): string | undefined {
  try {
    const canonicalRoot = filesystem.realpath(storedRoot);
    // Accept the previous canonical spelling, but never a root retargeted by a symlink.
    if (canonicalRoot !== storedRoot && filesystem.legacyRealpath?.(storedRoot) !== storedRoot) return undefined;
    if (!filesystem.isDirectory(canonicalRoot)) return undefined;
    filesystem.assertAccessible(canonicalRoot);
    return canonicalRoot;
  } catch {
    return undefined;
  }
}

function normalizeSource(
  db: Pick<Database, "select" | "update">,
  sourceId: string,
  storedRoot: string,
  filesystem: WorkspaceFilesystem,
  observe: SourceObserver,
): { canonicalRoot: string; sourceAvailable: boolean } {
  const canonicalRoot = availableRoot(storedRoot, filesystem);
  if (canonicalRoot === undefined) {
    const state = { canonicalRoot: storedRoot, sourceAvailable: false };
    observe(sourceId, state);
    return state;
  }
  if (canonicalRoot !== storedRoot) {
    const existing = db.select().from(schema.sources).where(eq(schema.sources.canonicalRoot, canonicalRoot)).get();
    // Older alias duplicates keep their logical IDs and associations. Do not merge or delete them.
    if (!existing) db.update(schema.sources).set({ canonicalRoot }).where(eq(schema.sources.id, sourceId)).run();
  }
  const state = { canonicalRoot, sourceAvailable: true };
  observe(sourceId, state);
  return state;
}

function toActiveWorkspace(
  workspace: { workspaceId: string; name: string; sourceId: string; canonicalRoot: string },
  viewId: string,
  sourceAvailable: boolean,
): ActiveWorkspace {
  return { ...workspace, viewId, sourceAvailable };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(message: string) {
  return { ok: false as const, error: { code: "invalid_input" as const, message } };
}

function filesystemError() {
  return { ok: false as const, error: { code: "filesystem" as const, message: "Choose an accessible folder." } };
}

function storageFailure() {
  return { ok: false as const, error: { code: "storage" as const, message: "Workspace data could not be read or saved." } };
}

class StalePreview extends Error {}
function workspacePayload(input: unknown, type: string, keys: string[]): input is Record<string, unknown> {
  return isRecord(input) && input.type === type && Object.keys(input).length === keys.length &&
    keys.every((key) => Object.hasOwn(input, key)) && isUuid(input.workspaceId);
}

function discoverySourceState(source: typeof schema.sources.$inferSelect | undefined): string {
  if (!source) return "missing";
  const { id, canonicalRoot, discoveryMode, discoveryRevision, excludedRelativePaths, archiveRelativePath, appliedRootIdentity } = source;
  return JSON.stringify({ id, canonicalRoot, discoveryMode, discoveryRevision, excludedRelativePaths, archiveRelativePath, appliedRootIdentity });
}

function sameAssociations(a: object[], b: object[]) {
  const normalize = (rows: object[]) => JSON.stringify(rows.map((row) => Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))));
  return normalize(a) === normalize(b);
}
