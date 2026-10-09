import { randomUUID } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;

export interface WorkspaceFilesystem {
  realpath(path: string): string;
  isDirectory(path: string): boolean;
}

const nativeFilesystem: WorkspaceFilesystem = {
  realpath: (path) => realpathSync(path),
  isDirectory: (path) => statSync(path).isDirectory(),
};

export interface WorkspaceCreated {
  sourceId: string;
  workspaceId: string;
  viewId: string;
  name: string;
  canonicalRoot: string;
}

export interface WorkspaceService {
  create(input: unknown):
    | { ok: true; value: WorkspaceCreated }
    | { ok: false; error: { code: "invalid_input" | "filesystem" | "storage"; message: string } };
  assertContained(sourceRoot: string, targetPath: string): boolean;
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
  };
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
