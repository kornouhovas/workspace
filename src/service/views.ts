import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isViewRequest, type ViewSnapshot } from "../contracts/views.js";
import type { ServiceResult } from "../contracts/settings.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
export function readViews(db: Pick<Database, "select">, workspaceId: string): ViewSnapshot {
  const rows = db.select().from(schema.views).where(eq(schema.views.workspaceId, workspaceId)).orderBy(asc(schema.views.position), asc(schema.views.id)).all();
  const selected = db.select().from(schema.workspaceViewSelection).where(eq(schema.workspaceViewSelection.workspaceId, workspaceId)).get();
  if (!selected || !rows.some(row => row.id === selected.viewId) || rows.some(row => row.kind !== "table" && row.kind !== "board")) throw new Error("Invalid view collection.");
  return { workspaceId, activeViewId: selected.viewId, views: rows.map(row => ({ viewId: row.id, name: row.name, kind: row.kind as "table" | "board" })) };
}
export function createViewService(db: Database) {
  return (input: unknown): ServiceResult<ViewSnapshot> => {
    if (!isViewRequest(input)) return invalid();
    try {
      const result = db.transaction(tx => {
        if (!tx.select().from(schema.workspaces).where(eq(schema.workspaces.id, input.workspaceId)).get()) return invalid();
        const before = readViews(tx, input.workspaceId);
        if (input.type === "workspace.listViews") return { ok: true as const, value: before };
        const owned = "viewId" in input ? before.views.find(view => view.viewId === input.viewId) : undefined;
        if ("viewId" in input && !owned) return invalid();
        switch (input.type) {
          case "workspace.createView":
          case "workspace.duplicateView": {
            const id = randomUUID();
            const original = owned ? tx.select().from(schema.views).where(eq(schema.views.id, owned.viewId)).get() : undefined;
            tx.insert(schema.views).values({ id, workspaceId: input.workspaceId, name: input.name,
              kind: input.type === "workspace.createView" ? input.kind : owned!.kind, position: before.views.length, ...(original ? { filterConfig: original.filterConfig } : {}) }).run();
            selectView(tx, input.workspaceId, id);
            break;
          }
          case "workspace.updateView":
            tx.update(schema.views).set({ name: input.name, kind: input.kind }).where(eq(schema.views.id, input.viewId)).run(); break;
          case "workspace.renameView":
            tx.update(schema.views).set({ name: input.name }).where(eq(schema.views.id, input.viewId)).run(); break;
          case "workspace.setViewLayout":
            tx.update(schema.views).set({ kind: input.kind }).where(eq(schema.views.id, input.viewId)).run(); break;
          case "workspace.activateView": selectView(tx, input.workspaceId, input.viewId); break;
          case "workspace.reorderViews":
            if (input.viewIds.length !== before.views.length || input.viewIds.some(id => !before.views.some(view => view.viewId === id))) return invalid();
            input.viewIds.forEach((id, position) => tx.update(schema.views).set({ position }).where(eq(schema.views.id, id)).run());
            break;
          case "workspace.deleteView": {
            if (before.views.length === 1) return invalid();
            const remaining = before.views.filter(view => view.viewId !== input.viewId);
            if (before.activeViewId === input.viewId) selectView(tx, input.workspaceId, remaining[0].viewId);
            tx.delete(schema.views).where(eq(schema.views.id, input.viewId)).run();
            remaining.forEach((view, position) => tx.update(schema.views).set({ position }).where(eq(schema.views.id, view.viewId)).run());
            break;
          }
        }
        return { ok: true as const, value: readViews(tx, input.workspaceId) };
      });
      return result;
    } catch { return { ok: false, error: { code: "storage", message: "Views could not be read or saved." } }; }
  };
}
function selectView(db: Database, workspaceId: string, viewId: string) {
  db.update(schema.workspaceViewSelection).set({ viewId }).where(eq(schema.workspaceViewSelection.workspaceId, workspaceId)).run();
  const active = db.select().from(schema.activeWorkspace).where(eq(schema.activeWorkspace.key, "active")).get();
  if (active?.workspaceId === workspaceId) db.update(schema.activeWorkspace).set({ viewId }).where(eq(schema.activeWorkspace.key, "active")).run();
}
function invalid(): ServiceResult<never> { return { ok: false, error: { code: "invalid_input", message: "Choose a valid workspace and view." } }; }
