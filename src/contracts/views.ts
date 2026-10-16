export type ViewKind = "table" | "board";
export interface WorkspaceView { viewId: string; name: string; kind: ViewKind }
export interface ViewSnapshot { workspaceId: string; views: WorkspaceView[]; activeViewId: string }
export type ViewQuery = { type: "workspace.listViews"; workspaceId: string };
export type ViewCommand =
  | { type: "workspace.updateView"; workspaceId: string; viewId: string; name: string; kind: ViewKind }
  | { type: "workspace.createView"; workspaceId: string; name: string; kind: ViewKind }
  | { type: "workspace.renameView"; workspaceId: string; viewId: string; name: string }
  | { type: "workspace.setViewLayout"; workspaceId: string; viewId: string; kind: ViewKind }
  | { type: "workspace.duplicateView"; workspaceId: string; viewId: string; name: string }
  | { type: "workspace.activateView" | "workspace.deleteView"; workspaceId: string; viewId: string }
  | { type: "workspace.reorderViews"; workspaceId: string; viewIds: string[] };
export const viewCommands: readonly string[] = ["workspace.updateView", "workspace.createView", "workspace.renameView", "workspace.setViewLayout", "workspace.duplicateView", "workspace.activateView", "workspace.deleteView", "workspace.reorderViews"];
export function isViewRequest(value: unknown): value is ViewQuery | ViewCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string" || !["workspace.listViews", ...viewCommands].includes(v.type) || !uuid(v.workspaceId)) return false;
  const keys = ["type", "workspaceId"];
  if (!["workspace.listViews", "workspace.createView", "workspace.reorderViews"].includes(v.type)) { keys.push("viewId"); if (!uuid(v.viewId)) return false; }
  if (["workspace.updateView", "workspace.createView", "workspace.renameView", "workspace.duplicateView"].includes(v.type)) {
    keys.push("name"); if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 200) return false;
  }
  if (["workspace.updateView", "workspace.createView", "workspace.setViewLayout"].includes(v.type)) { keys.push("kind"); if (v.kind !== "table" && v.kind !== "board") return false; }
  if (v.type === "workspace.reorderViews") {
    keys.push("viewIds"); if (!Array.isArray(v.viewIds) || v.viewIds.length === 0 || !Array.from(v.viewIds).every(uuid) || new Set(v.viewIds).size !== v.viewIds.length) return false;
  }
  return Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
}
function uuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
