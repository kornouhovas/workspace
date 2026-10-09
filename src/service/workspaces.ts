import { randomUUID } from "node:crypto";
import { accessSync, constants, opendirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";
import type { ActiveWorkspace, WorkspaceCreated, WorkspaceLoad } from "../contracts/workspaces.js";

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
  create(input: unknown):
    | { ok: true; value: WorkspaceCreated }
    | { ok: false; error: { code: "invalid_input" | "filesystem" | "storage"; message: string } };
  assertContained(sourceRoot: string, targetPath: string): boolean;
  load(): { ok: true; value: WorkspaceLoad } | { ok: false; error: { code: "storage"; message: string } };
  activate(input: unknown):
    | { ok: true; value: ActiveWorkspace }
    | { ok: false; error: { code: "invalid_input" | "storage"; message: string } };
}

export function createWorkspaceService(db: Database, filesystem = nativeFilesystem): WorkspaceService {
  return {
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
            source = { id: randomUUID(), canonicalRoot };
            tx.insert(schema.sources).values(source).run();
          }
          tx.insert(schema.workspaces).values({ id: workspaceId, name, sourceId: source.id }).run();
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
        return { ok: true, value: { sourceId: created, workspaceId, viewId, name, canonicalRoot } };
      } catch {
        return { ok: false, error: { code: "storage", message: "Workspace could not be created." } };
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
        const workspaces = db.select({
          workspaceId: schema.workspaces.id,
          name: schema.workspaces.name,
          sourceId: schema.sources.id,
          canonicalRoot: schema.sources.canonicalRoot,
        }).from(schema.workspaces)
          .innerJoin(schema.sources, eq(schema.workspaces.sourceId, schema.sources.id)).all();
        const active = db.select({
          workspaceId: schema.activeWorkspace.workspaceId,
          viewId: schema.activeWorkspace.viewId,
        }).from(schema.activeWorkspace).where(eq(schema.activeWorkspace.key, "active")).get();
        const summaries = workspaces.map(({ workspaceId, name }) => ({ workspaceId, name }));
        if (!active) return { ok: true, value: { workspaces: summaries, activeWorkspace: null } };

        const current = workspaces.find((workspace) => workspace.workspaceId === active.workspaceId);
        const view = db.select().from(schema.views).where(eq(schema.views.id, active.viewId)).get();
        if (!current || !view || view.workspaceId !== current.workspaceId || view.kind !== "table") {
          return storageFailure();
        }
        const sourceState = db.transaction((tx) => normalizeSource(tx, current.sourceId, current.canonicalRoot, filesystem));
        const activeWorkspace = { ...toActiveWorkspace(current, active.viewId, sourceState.sourceAvailable), ...sourceState };
        return { ok: true, value: { workspaces: summaries, activeWorkspace } };
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
          const sourceState = normalizeSource(tx, workspace.sourceId, workspace.canonicalRoot, filesystem);
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
): { canonicalRoot: string; sourceAvailable: boolean } {
  const canonicalRoot = availableRoot(storedRoot, filesystem);
  if (canonicalRoot === undefined) return { canonicalRoot: storedRoot, sourceAvailable: false };
  if (canonicalRoot !== storedRoot) {
    const existing = db.select().from(schema.sources).where(eq(schema.sources.canonicalRoot, canonicalRoot)).get();
    // Older alias duplicates keep their logical IDs and associations. Do not merge or delete them.
    if (!existing) db.update(schema.sources).set({ canonicalRoot }).where(eq(schema.sources.id, sourceId)).run();
  }
  return { canonicalRoot, sourceAvailable: true };
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
