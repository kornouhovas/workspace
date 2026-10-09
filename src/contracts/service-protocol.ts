import type { TextPropertySnapshot, TextPropertyMutation } from "./text-properties.js";
import type { ServiceResult } from "./settings.js";
import type { CategoryPropertySnapshot, ProjectList, DiscoveryPreview, ActiveWorkspace, WorkspaceCreated, WorkspaceLoad, WorkspaceSourceState, WorkspaceChangeEvent } from "./workspaces.js";
import type { Settings } from "./settings.js";

export type ServicePayload = CategoryPropertySnapshot | TextPropertySnapshot | TextPropertyMutation | ProjectList | DiscoveryPreview | Settings | WorkspaceLoad | WorkspaceCreated | ActiveWorkspace | WorkspaceSourceState;

export type ServiceRequest = {
  id: number;
  input: unknown;
};

export type ServiceResponse = {
  id: number;
  result: ServiceResult<ServicePayload>;
};

export type ServicePort = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (event: { data: unknown }) => void): void;
  start?(): void;
  close(): void;
};

export function isServiceRequest(value: unknown): value is ServiceRequest {
  return record(value) && exact(value, ["id", "input"]) &&
    typeof value.id === "number" && Number.isSafeInteger(value.id) && value.id > 0;
}

export function isServiceResponse(value: unknown): value is ServiceResponse {
  if (!record(value) || !exact(value, ["id", "result"]) ||
    typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id <= 0 || !record(value.result)) return false;
  const result = value.result;
  if (result.ok === true) return exact(result, ["ok", "value"]);
  const error = result.error;
  return result.ok === false && exact(result, ["ok", "error"]) &&
    record(error) && exact(error, ["code", "message"]) &&
    ["invalid_input", "filesystem", "storage", "service_unavailable", "stale_preview"].includes(typeof error.code === "string" ? error.code : "") &&
    typeof error.message === "string";
}

export type ServiceEvent = { type: "workspace.change"; change: WorkspaceChangeEvent };

export function isWorkspaceChangeEvent(value: unknown): value is WorkspaceChangeEvent {
  if (!record(value)) return false;
  if (value.type === "workspace.projectsChanged" || value.type === "workspace.propertiesChanged" || value.type === "workspace.categoryPropertyChanged") {
    return exact(value, ["type", "sourceId", "workspaceIds", "revision"]) &&
      uuid(value.sourceId) && ids(value.workspaceIds) && value.workspaceIds.length > 0 &&
      typeof value.revision === "number" && Number.isSafeInteger(value.revision) && value.revision >= 0;
  }
  if (value.type === "workspace.sourceChanged" && exact(value, ["type", "source"])) {
    const source = value.source;
    return record(source) && exact(source, ["sourceId", "workspaceIds", "canonicalRoot", "sourceAvailable"]) &&
      uuid(source.sourceId) && ids(source.workspaceIds) &&
      typeof source.canonicalRoot === "string" && source.canonicalRoot.length > 0 &&
      typeof source.sourceAvailable === "boolean";
  }
  if (value.type !== "workspace.listChanged" || !exact(value, ["type", "snapshot"])) return false;
  const snapshot = value.snapshot;
  if (!record(snapshot) || !exact(snapshot, ["workspaces", "activeWorkspace"]) ||
    !Array.isArray(snapshot.workspaces)) return false;
  const workspaces = snapshot.workspaces;
  if (!workspaces.every((row) => record(row) && exact(row, ["workspaceId", "name"]) &&
    uuid(row.workspaceId) && typeof row.name === "string") ||
    new Set(workspaces.map((row) => row.workspaceId)).size !== workspaces.length) return false;
  const active = snapshot.activeWorkspace;
  return active === null || (record(active) &&
    exact(active, ["workspaceId", "sourceId", "viewId", "name", "canonicalRoot", "sourceAvailable"]) &&
    uuid(active.workspaceId) && uuid(active.sourceId) && uuid(active.viewId) &&
    typeof active.name === "string" && typeof active.canonicalRoot === "string" && active.canonicalRoot.length > 0 &&
    typeof active.sourceAvailable === "boolean" &&
    workspaces.some((row) => row.workspaceId === active.workspaceId && row.name === active.name));
}

export function isServiceEvent(value: unknown): value is ServiceEvent {
  return record(value) && exact(value, ["type", "change"]) &&
    value.type === "workspace.change" && isWorkspaceChangeEvent(value.change);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function ids(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(uuid) && new Set(value).size === value.length;
}
