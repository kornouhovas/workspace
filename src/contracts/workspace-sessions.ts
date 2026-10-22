export interface WorkspaceSessionState {
  tabs: string[];
  expanded: string | null;
  previews: Record<string, string | null>;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  projectWidth: number;
}
export interface WorkspaceSessionSnapshot {
  workspaceId: string;
  activeViewId: string;
  revision: number;
  // Runtime-only generation; restored backups cannot authorize an old writer.
  epoch: string;
  state: WorkspaceSessionState;
}
export type WorkspaceSessionQuery = { type: "workspace.getSession"; workspaceId: string };
export type WorkspaceSessionCommand = { type: "workspace.setSession"; workspaceId: string; epoch: string; expectedRevision: number; state: WorkspaceSessionState };
export function defaultWorkspaceSession(): WorkspaceSessionState {
  return { tabs: [], expanded: null, previews: {}, sidebarWidth: 220, sidebarCollapsed: false, projectWidth: 360 };
}
export function isWorkspaceSessionState(value: unknown): value is WorkspaceSessionState {
  if (!record(value) || !exact(value, ["tabs", "expanded", "previews", "sidebarWidth", "sidebarCollapsed", "projectWidth"])) return false;
  return Array.isArray(value.tabs) && value.tabs.length <= 1000 && Array.from(value.tabs).every(uuid) && new Set(value.tabs).size === value.tabs.length &&
    (value.expanded === null || uuid(value.expanded) && value.tabs.includes(value.expanded)) &&
    record(value.previews) && Object.keys(value.previews).length <= 1000 && Object.entries(value.previews).every(([id, project]) => uuid(id) && (project === null || uuid(project))) &&
    typeof value.sidebarCollapsed === "boolean" && size(value.sidebarWidth, 180, 320) && size(value.projectWidth, 280, 600);
}
export function isWorkspaceSessionRequest(value: unknown): value is WorkspaceSessionQuery | WorkspaceSessionCommand {
  if (!record(value) || !uuid(value.workspaceId)) return false;
  if (value.type === "workspace.getSession") return exact(value, ["type", "workspaceId"]);
  return value.type === "workspace.setSession" && exact(value, ["type", "workspaceId", "epoch", "expectedRevision", "state"]) &&
    uuid(value.epoch) && typeof value.expectedRevision === "number" && Number.isSafeInteger(value.expectedRevision) && value.expectedRevision >= 0 && isWorkspaceSessionState(value.state);
}
function size(value: unknown, min: number, max: number) { return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max; }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function exact(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)); }
function uuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
