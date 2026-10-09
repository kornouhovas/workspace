import { createTextPropertyService } from "./text-properties.js";
import type { TextPropertySnapshot, TextPropertyMutation } from "../contracts/text-properties.js";
import { interpretProjects, reliableIdentity, sameIdentity, scanDirectSource, validArchive, validExclusions, type DiscoverySnapshot } from "./discovery.js";
import type { DiscoveryPreview, ProjectList } from "../contracts/workspaces.js";
import type { ServiceResult } from "../contracts/settings.js";
import { randomUUID } from "node:crypto";
import { accessSync, constants, opendirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
import { asc, eq, max } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";
import type { ActiveWorkspace, WorkspaceCreated, WorkspaceLoad, WorkspaceSourceState, WorkspaceChangeEvent } from "../contracts/workspaces.js";

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

export function createWorkspaceService(db: Database, filesystem = nativeFilesystem): WorkspaceService {
  const previewTokens = new Map<string, {
    preview: DiscoveryPreview;
    snapshot: DiscoverySnapshot;
    source: typeof schema.sources.$inferSelect;
    projects: typeof schema.projects.$inferSelect[];
  }>();
  const listeners = new Set<(event: WorkspaceChangeEvent) => void>();
  const observed = new Map<string, { canonicalRoot: string; sourceAvailable: boolean }>();
  let pending = new Map<string, { canonicalRoot: string; sourceAvailable: boolean }>();
  const observe: SourceObserver = (sourceId, state) => { pending.set(sourceId, state); };
  const service: WorkspaceService = {
    ...createTextPropertyService(db, publish),
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    close() { listeners.clear(); observed.clear(); previewTokens.clear(); },
    previewDiscovery(input) {
      if (!isRecord(input) || input.type !== "workspace.previewDiscovery" || !isUuid(input.workspaceId) ||
        !["type", "workspaceId"].every((key) => Object.hasOwn(input, key)) ||
        !Object.keys(input).every((key) => ["type", "workspaceId", "excludedRelativePaths"].includes(key)) ||
        (Object.hasOwn(input, "excludedRelativePaths") && !validExclusions(input.excludedRelativePaths))) {
        return invalid("Choose a saved workspace and valid direct-folder exclusions.");
      }
      const workspaceId = input.workspaceId;
      previewTokens.delete(workspaceId);
      try {
        const source = db.select().from(schema.workspaces)
          .innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id))
          .where(eq(schema.workspaces.id, workspaceId)).get()?.sources;
        if (!source) return invalid("Choose a saved workspace.");
        const saved: unknown = JSON.parse(source.excludedRelativePaths);
        if (!validExclusions(saved) || !validArchive(source.archiveRelativePath) ||
          !Number.isSafeInteger(source.discoveryRevision) || source.discoveryRevision < 0 ||
          (source.discoveryMode !== null && source.discoveryMode !== "direct")) return storageFailure();
        const exclusions = Object.hasOwn(input, "excludedRelativePaths") ? input.excludedRelativePaths as string[] : saved;
        const scan = scanDirectSource(source.canonicalRoot, source.archiveRelativePath, exclusions);
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
        const projects = readProjects(source.id);
        const interpreted = snapshot ? interpretProjects(scan, projects).entries : [];
        if (snapshot) state = interpreted.some((entry) => entry.reason === null) ? "ready" : "empty";
        const preview: DiscoveryPreview = {
          workspaceId, sourceId: source.id, revision: source.discoveryRevision, canonicalRoot: source.canonicalRoot,
          excludedRelativePaths: [...exclusions].sort(), entries: interpreted, state,
          previewToken: snapshot ? randomUUID() : null,
        };
        // Keep the reviewed draft/configuration independent of the caller's response object.
        if (snapshot) previewTokens.set(workspaceId, { preview: structuredClone(preview), snapshot, source, projects });
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
          JSON.stringify(token.projects) !== JSON.stringify(readProjects(source.id))) return stale();
        const scan = scanDirectSource(source.canonicalRoot, source.archiveRelativePath, token.preview.excludedRelativePaths);
        if (!scan.snapshot || JSON.stringify(scan.snapshot) !== JSON.stringify(token.snapshot) ||
          !reliableIdentity(scan.snapshot.root.identity)) return stale();
        const interpretation = interpretProjects(scan, token.projects);
        if (JSON.stringify(interpretation.entries) !== JSON.stringify(token.preview.entries)) return stale();
        const changed = source.discoveryMode !== "direct" ||
          source.excludedRelativePaths !== JSON.stringify(token.preview.excludedRelativePaths) ||
          source.appliedRootIdentity !== JSON.stringify(scan.snapshot.root.identity) ||
          interpretation.additions.length > 0 ||
          interpretation.retained.some((row, index) => row.associationState !== token.projects[index].associationState);
        const committedEvent: WorkspaceChangeEvent = { type: "workspace.projectsChanged", sourceId: source.id,
          workspaceIds: sourceState(source.id, { canonicalRoot: source.canonicalRoot, sourceAvailable: true }).workspaceIds,
          revision: source.discoveryRevision + (changed ? 1 : 0) };
        const result = db.transaction((tx) => {
          if (discoverySourceState(workspaceSource(workspaceId)) !== discoverySourceState(source) ||
            JSON.stringify(readProjects(source.id)) !== JSON.stringify(token.projects)) throw new StalePreview();
          if (changed) tx.update(schema.sources).set({ discoveryMode: "direct", discoveryRevision: source.discoveryRevision + (changed ? 1 : 0),
            excludedRelativePaths: JSON.stringify(token.preview.excludedRelativePaths),
            appliedRootIdentity: JSON.stringify(scan.snapshot!.root.identity),
          }).where(eq(schema.sources.id, source.id)).run();
          // Retire associations before inserting replacements into the unique current-path index.
          for (const row of interpretation.retained.filter((row, index) => row.associationState !== token.projects[index].associationState)) {
            tx.update(schema.projects).set({ associationState: row.associationState })
              .where(eq(schema.projects.id, row.id)).run();
          }
          for (const row of interpretation.additions) tx.insert(schema.projects).values({
            id: randomUUID(), sourceId: source.id, ...row, associationState: "active",
          }).run();
          // Observed changes during persistence roll back all DB writes. This is not a filesystem lock.
          const recheck = scanDirectSource(source.canonicalRoot, source.archiveRelativePath, token.preview.excludedRelativePaths);
          if (!recheck.snapshot || JSON.stringify(recheck.snapshot) !== JSON.stringify(token.snapshot)) throw new StalePreview();
          const committed = tx.select().from(schema.sources).where(eq(schema.sources.id, source.id)).get()!;
          return projectList(workspaceId, committed, recheck);
        });
        previewTokens.delete(workspaceId);
        if (changed) {
          for (const [id, saved] of previewTokens) if (saved.preview.sourceId === source.id) previewTokens.delete(id);
          publish([committedEvent]);
        }
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
      const state = normalizeSource(db, source.sourceId, source.canonicalRoot, filesystem, observe);
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
  function projectList(workspaceId: string, source: typeof schema.sources.$inferSelect,
    currentScan = scanDirectSource(source.canonicalRoot, source.archiveRelativePath, JSON.parse(source.excludedRelativePaths))): ProjectList {
    if (!validExclusions(JSON.parse(source.excludedRelativePaths)) || !validArchive(source.archiveRelativePath) ||
      !Number.isSafeInteger(source.discoveryRevision) || source.discoveryRevision < 0 ||
      (source.discoveryMode !== null && source.discoveryMode !== "direct")) throw new Error("Invalid source configuration");
    const projects = readProjects(source.id);
    let state = currentScan.state;
    if (currentScan.snapshot && source.appliedRootIdentity &&
      !sameIdentity(JSON.parse(source.appliedRootIdentity), currentScan.snapshot.root.identity)) state = "root_identity_conflict";
    const active = projects.filter((row) => row.associationState === "active").map((row) => ({
      projectId: row.id, relativePath: row.relativePath, name: row.relativePath,
    })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    return { workspaceId, sourceId: source.id, revision: source.discoveryRevision, configured: source.discoveryMode !== null,
      state, projects: active, retainedCount: projects.length - active.length };
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

  function run<R extends { ok: boolean }>(operation: () => R, listSnapshot?: (result: R) => WorkspaceLoad | undefined): R | ReturnType<typeof storageFailure> {
    pending = new Map();
    let snapshot: WorkspaceLoad | undefined;
    let sources: WorkspaceSourceState[] = [];
    try {
      const result = db.transaction(() => {
        const result = operation();
        if (result.ok) {
          snapshot = listSnapshot?.(result);
          sources = [...pending].map(([sourceId, state]) => sourceState(sourceId, state));
        }
        return result;
      });
      if (result.ok) {
        // Publish the authoritative selection/list before source observations.
        const events: WorkspaceChangeEvent[] = snapshot ? [{ type: "workspace.listChanged", snapshot }] : [];
        for (const source of sources) {
          const previous = observed.get(source.sourceId);
          observed.set(source.sourceId, { canonicalRoot: source.canonicalRoot, sourceAvailable: source.sourceAvailable });
          if (!previous || previous.canonicalRoot !== source.canonicalRoot || previous.sourceAvailable !== source.sourceAvailable) {
            events.push({ type: "workspace.sourceChanged", source });
          }
        }
        publish(events);
      }
      return result;
    } catch { return storageFailure(); }
  }

  return {
    ...service,
    create: (input) => run(() => service.create(input), currentSnapshot),
    rename: (input) => run(() => service.rename(input), returnedSnapshot),
    reorder: (input) => run(() => service.reorder(input), returnedSnapshot),
    remove: (input) => {
      const result = run(() => service.remove(input), returnedSnapshot);
      if (result.ok && isRecord(input) && typeof input.workspaceId === "string") previewTokens.delete(input.workspaceId);
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
