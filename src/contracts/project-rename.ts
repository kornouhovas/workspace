import type { DiscoveryMode } from "./workspaces.js";

// The service alone resolves mode, category, locators and native evidence.
export interface WorkspaceRenameProjectCommand {
  type: "workspace.renameProject";
  workspaceId: string;
  projectId: string;
  operationId: string;
  name: string;
  expectedRevision: number;
}
export interface WorkspaceListProjectRenamesQuery {
  type: "workspace.listProjectRenames";
  workspaceId: string;
}
export interface WorkspaceGetProjectRenameQuery {
  type: "workspace.getProjectRename";
  workspaceId: string;
  operationId: string;
}
export interface WorkspacePreviewProjectRenameRecoveryQuery {
  type: "workspace.previewProjectRenameRecovery";
  workspaceId: string;
  operationId: string;
}
export type ProjectRenameRecoveryAction = "retry_original" | "finish_staged" | "complete_destination" | "keep_original";
export interface WorkspaceRecoverProjectRenameCommand {
  type: "workspace.recoverProjectRename";
  workspaceId: string;
  operationId: string;
  previewToken: string;
  action: ProjectRenameRecoveryAction;
}
export type ProjectRenameRequest = WorkspaceRenameProjectCommand | WorkspaceListProjectRenamesQuery |
  WorkspaceGetProjectRenameQuery | WorkspacePreviewProjectRenameRecoveryQuery | WorkspaceRecoverProjectRenameCommand;
export type ProjectRenameStage = "intent" | "staged" | "destination_recorded" | "uncertain" | "completed" | "failed";
export type ProjectRenamePlacement = "original" | "staged" | "destination";
export type ProjectRenameProblem =
  | "invalid_name" | "unconfigured" | "stale_configuration" | "category_unavailable" | "project_unavailable"
  | "excluded" | "archive" | "reserved_destination" | "occupied" | "source_unavailable" | "permission_denied"
  | "filesystem_changed" | "filesystem_error" | "ownership_uncertain" | "destination_missing"
  | "destination_replaced" | "destination_link" | "native_conflict" | "native_unavailable" | "busy"
  | "cross_device" | "unsupported" | "storage_error" | "kept_original";
export interface ProjectRenameOperation {
  operationId: string;
  sourceId: string;
  initiatingWorkspaceId: string;
  projectId: string;
  originalName: string;
  name: string;
  originalRelativePath: string;
  requestedRelativePath: string;
  mode: DiscoveryMode;
  categoryId: string | null;
  expectedRevision: number;
  stage: ProjectRenameStage;
  // Staging locators and full native evidence remain private.
  lastVerifiedPlacement: ProjectRenamePlacement;
  problem: ProjectRenameProblem | null;
  resultKind: "completed" | "unchanged" | "rejected" | null;
  completedRevision: number | null;
}
export interface ProjectRenameCompleted {
  operationId: string;
  sourceId: string;
  projectId: string;
  name: string;
  relativePath: string;
  categoryId: string | null;
  revision: number;
}
export type ProjectRenameResult =
  | { outcome: "completed" | "unchanged"; operation: ProjectRenameOperation; project: ProjectRenameCompleted }
  | { outcome: "recoverable"; operation: ProjectRenameOperation }
  | { outcome: "rejected"; problem: ProjectRenameProblem; operation: ProjectRenameOperation | null };
export interface ProjectRenameList {
  workspaceId: string;
  sourceId: string;
  operations: ProjectRenameOperation[];
}
export type ProjectRenamePlacementState = "missing" | "matching" | "replaced" | "link" | "unavailable" | "conflicting";
export interface ProjectRenameRecoveryPreview {
  workspaceId: string;
  sourceId: string;
  operation: ProjectRenameOperation;
  revision: number;
  originalState: ProjectRenamePlacementState;
  stagedState: ProjectRenamePlacementState | null;
  destinationState: ProjectRenamePlacementState;
  problem: ProjectRenameProblem | null;
  actions: ProjectRenameRecoveryAction[];
  previewToken: string | null;
}

// Shape validation only; basename policy and current authorization belong to the service.
export function isProjectRenameRequest(value: unknown): value is ProjectRenameRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const exact = (keys: string[]) => Object.keys(input).length === keys.length && keys.every((key) => Object.hasOwn(input, key));
  const uuid = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  if (!uuid(input.workspaceId)) return false;
  if (input.type === "workspace.listProjectRenames") return exact(["type", "workspaceId"]);
  if (!uuid(input.operationId)) return false;
  if (input.type === "workspace.getProjectRename" || input.type === "workspace.previewProjectRenameRecovery") {
    return exact(["type", "workspaceId", "operationId"]);
  }
  if (input.type === "workspace.recoverProjectRename") {
    return exact(["type", "workspaceId", "operationId", "previewToken", "action"]) && uuid(input.previewToken) &&
      ["retry_original", "finish_staged", "complete_destination", "keep_original"].includes(typeof input.action === "string" ? input.action : "");
  }
  return input.type === "workspace.renameProject" && uuid(input.projectId) && typeof input.name === "string" &&
    typeof input.expectedRevision === "number" && Number.isSafeInteger(input.expectedRevision) && input.expectedRevision >= 0 &&
    exact(["type", "workspaceId", "projectId", "operationId", "name", "expectedRevision"]);
}
