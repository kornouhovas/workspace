import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isWorkspaceSessionRequest, isWorkspaceSessionState, type WorkspaceSessionSnapshot } from "../contracts/workspace-sessions.js";
import type { ServiceResult } from "../contracts/settings.js";
import * as schema from "./db/schema.js";
import { readViews } from "./views.js";

export function createWorkspaceSessionService(db: BetterSQLite3Database<typeof schema>) {
  const epoch = randomUUID();
  return (input: unknown): ServiceResult<WorkspaceSessionSnapshot> => {
    if (!isWorkspaceSessionRequest(input)) return invalid();
    try {
      return db.transaction(tx => {
        const workspace = tx.select().from(schema.workspaces).where(eq(schema.workspaces.id, input.workspaceId)).get();
        const row = tx.select().from(schema.workspaceSessions).where(eq(schema.workspaceSessions.workspaceId, input.workspaceId)).get();
        if (!workspace || !row) return invalid();
        const state: unknown = JSON.parse(row.state);
        if (!isWorkspaceSessionState(state)) throw new Error("Invalid stored session");
        if (input.type === "workspace.setSession") {
          if (input.epoch !== epoch || input.expectedRevision !== row.revision) return { ok: false as const, error: { code: "stale_preview" as const, message: "The workspace session changed. Reload before saving." } };
          const views = new Set(readViews(tx, input.workspaceId).views.map(view => view.viewId));
          const projects = new Set(tx.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.sourceId, workspace.sourceId)).all().map(project => project.id));
          if (Object.keys(input.state.previews).some(id => !views.has(id)) ||
            [...input.state.tabs, ...Object.values(input.state.previews).filter((id): id is string => id !== null)].some(id => !projects.has(id))) return invalid();
          tx.update(schema.workspaceSessions).set({ state: JSON.stringify(input.state), revision: row.revision + 1 }).where(eq(schema.workspaceSessions.workspaceId, input.workspaceId)).run();
        }
        return { ok: true as const, value: { workspaceId: input.workspaceId, activeViewId: readViews(tx, input.workspaceId).activeViewId, epoch,
          revision: row.revision + (input.type === "workspace.setSession" ? 1 : 0), state: input.type === "workspace.setSession" ? input.state : state } };
      });
    } catch { return { ok: false, error: { code: "storage", message: "The workspace session could not be read or saved." } }; }
  };
}
function invalid(): ServiceResult<never> { return { ok: false, error: { code: "invalid_input", message: "Choose a valid workspace session." } }; }
