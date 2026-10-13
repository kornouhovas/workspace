import type { CategoryRemovalPayload } from "./category-removal.js";
import type { CategoryOptionsPayload } from "./category-options.js";
import type { ProjectCategoryMoveResult, ProjectCategoryMoveList, ProjectCategoryMoveRecoveryPreview } from "./project-category-move.js";
import type { ProjectRenameResult, ProjectRenameList, ProjectRenameRecoveryPreview } from "./project-rename.js";
import type { ProjectCreationResult, ProjectCreationOperation, ProjectCreationList, ProjectCreationRecoveryPreview } from "./project-creation.js";
import type { ProjectRevealResult, ProjectRevealProblem } from "./project-reveal.js";
import type { ProjectRecoveryPreview } from "./project-recovery.js";
import type { TextPropertySnapshot, TextPropertyMutation } from "./text-properties.js";
import type { ServiceResult } from "./settings.js";
import type { CategoryPropertySnapshot, ProjectList, DiscoveryPreview, ActiveWorkspace, WorkspaceCreated, WorkspaceLoad, WorkspaceSourceObservationSnapshot, WorkspaceSourceState, WorkspaceChangeEvent } from "./workspaces.js";
import type { Settings } from "./settings.js";

export type ServicePayload = CategoryRemovalPayload | CategoryOptionsPayload | ProjectCategoryMoveResult | ProjectCategoryMoveList | ProjectCategoryMoveRecoveryPreview | ProjectRenameResult | ProjectRenameList | ProjectRenameRecoveryPreview | ProjectRevealResult | ProjectCreationResult | ProjectCreationOperation | ProjectCreationList | ProjectCreationRecoveryPreview | WorkspaceSourceObservationSnapshot | ProjectRecoveryPreview | CategoryPropertySnapshot | TextPropertySnapshot | TextPropertyMutation | ProjectList | DiscoveryPreview | Settings | WorkspaceLoad | WorkspaceCreated | ActiveWorkspace | WorkspaceSourceState;

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
  if (value.type === "workspace.categoryPresentationChanged") return exact(value, ["type", "sourceId", "workspaceIds"]) && uuid(value.sourceId) && ids(value.workspaceIds) && value.workspaceIds.length > 0;
  if (value.type === "workspace.sourceObserved") {
    return exact(value, ["type", "sourceId", "workspaceIds", "observationRevision", "state", "automaticUpdates"]) &&
      uuid(value.sourceId) && ids(value.workspaceIds) && value.workspaceIds.length > 0 &&
      typeof value.observationRevision === "number" && Number.isSafeInteger(value.observationRevision) && value.observationRevision > 0 &&
      ["ready", "empty", "unavailable", "unreadable", "root_identity_conflict", "changed"].includes(typeof value.state === "string" ? value.state : "") &&
      (value.automaticUpdates === "active" || value.automaticUpdates === "degraded");
  }
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

// Private service/main protocol. Never forward these messages to the renderer.
export interface TrustedProjectRevealTarget {
  canonicalRoot: string;
  parentRelativePath: string;
  relativePath: string;
  rootIdentity: string;
  parentIdentity: string;
  nativeIdentity: string;
}
export type NativeProjectRevealResult = { outcome: "dispatched" } | { outcome: "rejected"; problem: ProjectRevealProblem };
export type NativeProjectRevealValidation = { outcome: "verified" } | { outcome: "rejected"; problem: ProjectRevealProblem };
export type NativeProjectReveal = (target: TrustedProjectRevealTarget, revalidate: () => NativeProjectRevealValidation) => Promise<NativeProjectRevealResult>;
export type NativeProjectRevealVerify = { type: "project.reveal.verify"; requestId: number; dispatchId: string };
export type NativeProjectRevealVerified = { type: "project.reveal.verified"; requestId: number; dispatchId: string; result: NativeProjectRevealValidation };
export type NativeProjectRevealRequest = {
  type: "project.reveal.native"; requestId: number; dispatchId: string; target: TrustedProjectRevealTarget;
};
export type NativeProjectRevealReply = {
  type: "project.reveal.reply"; requestId: number; dispatchId: string; result: NativeProjectRevealResult;
};
export type NativeProjectRevealCancel = { type: "project.reveal.cancel"; requestId: number; dispatchId: string };
export function isTrustedProjectRevealTarget(value: unknown): value is TrustedProjectRevealTarget {
  if (!record(value) || !exact(value, ["canonicalRoot", "parentRelativePath", "relativePath", "rootIdentity", "parentIdentity", "nativeIdentity"]) ||
    ![value.canonicalRoot, value.parentRelativePath, value.relativePath].every((path) => typeof path === "string" && !path.includes("\0")) ||
    value.canonicalRoot === "" || value.relativePath === "") return false;
  return [value.rootIdentity, value.parentIdentity, value.nativeIdentity].every((encoded) => {
    if (typeof encoded !== "string") return false;
    try {
      const identity: unknown = JSON.parse(encoded);
      return record(identity) && exact(identity, ["dev", "ino", "birthtimeNs"]) &&
        typeof identity.dev === "string" && /^[0-9]+$/.test(identity.dev) &&
        typeof identity.ino === "string" && /^[0-9]+$/.test(identity.ino) && BigInt(identity.ino) > 0n &&
        typeof identity.birthtimeNs === "string" && /^[0-9]+$/.test(identity.birthtimeNs) && BigInt(identity.birthtimeNs) > 0n;
    } catch { return false; }
  });
}
function nativeBinding(value: Record<string, unknown>) {
  return typeof value.requestId === "number" && Number.isSafeInteger(value.requestId) && value.requestId > 0 && uuid(value.dispatchId);
}
export function isNativeProjectRevealRequest(value: unknown): value is NativeProjectRevealRequest {
  return record(value) && exact(value, ["type", "requestId", "dispatchId", "target"]) && value.type === "project.reveal.native" &&
    nativeBinding(value) && isTrustedProjectRevealTarget(value.target);
}
export function isNativeProjectRevealReply(value: unknown): value is NativeProjectRevealReply {
  if (!record(value) || !exact(value, ["type", "requestId", "dispatchId", "result"]) || value.type !== "project.reveal.reply" ||
    !nativeBinding(value) || !record(value.result)) return false;
  return value.result.outcome === "dispatched" ? exact(value.result, ["outcome"]) :
    value.result.outcome === "rejected" && exact(value.result, ["outcome", "problem"]) &&
    ["unconfigured", "mode_retained", "excluded", "missing", "replaced", "unresolved", "root_unavailable", "root_replaced", "category_unavailable",
      "unavailable", "native_unavailable", "native_error", "request_expired"].includes(String(value.result.problem));
}
export function isNativeProjectRevealCancel(value: unknown): value is NativeProjectRevealCancel {
  return record(value) && exact(value, ["type", "requestId", "dispatchId"]) && value.type === "project.reveal.cancel" && nativeBinding(value);
}

export function isNativeProjectRevealVerify(value: unknown): value is NativeProjectRevealVerify {
  return record(value) && exact(value, ["type", "requestId", "dispatchId"]) && value.type === "project.reveal.verify" && nativeBinding(value);
}
export function isNativeProjectRevealVerified(value: unknown): value is NativeProjectRevealVerified {
  if (!record(value) || !exact(value, ["type", "requestId", "dispatchId", "result"]) || value.type !== "project.reveal.verified" ||
    !nativeBinding(value) || !record(value.result)) return false;
  return value.result.outcome === "verified" ? exact(value.result, ["outcome"]) :
    isNativeProjectRevealReply({ ...value, type: "project.reveal.reply" });
}
