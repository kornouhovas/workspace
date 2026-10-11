// The service alone resolves mode, category, locators and native evidence.
export interface WorkspaceMoveProjectCategoryCommand {
  type: "workspace.moveProjectCategory";
  workspaceId: string;
  projectId: string;
  operationId: string;
  destinationCategoryId: string;
  expectedRevision: number;
}
export interface WorkspaceListProjectCategoryMovesQuery {
  type: "workspace.listProjectCategoryMoves";
  workspaceId: string;
}
export interface WorkspaceGetProjectCategoryMoveQuery {
  type: "workspace.getProjectCategoryMove";
  workspaceId: string;
  operationId: string;
}
export interface WorkspacePreviewProjectCategoryMoveRecoveryQuery {
  type: "workspace.previewProjectCategoryMoveRecovery";
  workspaceId: string;
  operationId: string;
}
export type ProjectCategoryMoveRecoveryAction = "retry_original" | "complete_destination" | "keep_original";
export interface WorkspaceRecoverProjectCategoryMoveCommand {
  type: "workspace.recoverProjectCategoryMove";
  workspaceId: string;
  operationId: string;
  previewToken: string;
  action: ProjectCategoryMoveRecoveryAction;
}
export type ProjectCategoryMoveRequest = WorkspaceMoveProjectCategoryCommand | WorkspaceListProjectCategoryMovesQuery |
  WorkspaceGetProjectCategoryMoveQuery | WorkspacePreviewProjectCategoryMoveRecoveryQuery | WorkspaceRecoverProjectCategoryMoveCommand;
export type ProjectCategoryMoveStage = "intent" | "destination_recorded" | "uncertain" | "completed" | "failed";
export type ProjectCategoryMovePlacement = "original" | "destination";
export type ProjectCategoryMoveProblem =
  | "invalid_name" | "unconfigured" | "stale_configuration" | "category_unavailable" | "project_unavailable"
  | "excluded" | "archive" | "reserved_destination" | "occupied" | "source_unavailable" | "permission_denied"
  | "filesystem_changed" | "filesystem_error" | "ownership_uncertain" | "destination_missing"
  | "destination_replaced" | "destination_link" | "native_conflict" | "native_unavailable" | "busy"
  | "cross_device" | "unsupported" | "storage_error" | "kept_original";
export interface ProjectCategoryMoveOperation {
  operationId: string;
  sourceId: string;
  initiatingWorkspaceId: string;
  projectId: string;
  name: string;
  originalCategoryId: string;
  destinationCategoryId: string;
  originalRelativePath: string;
  requestedRelativePath: string;
  expectedRevision: number;
  stage: ProjectCategoryMoveStage;
  // Absolute locators and full native evidence remain private.
  lastVerifiedPlacement: ProjectCategoryMovePlacement;
  problem: ProjectCategoryMoveProblem | null;
  resultKind: "completed" | "unchanged" | "rejected" | null;
  completedRevision: number | null;
}
export interface ProjectCategoryMoveCompleted {
  operationId: string;
  sourceId: string;
  projectId: string;
  name: string;
  relativePath: string;
  categoryId: string;
  revision: number;
}
export type ProjectCategoryMoveResult =
  | { outcome: "completed" | "unchanged"; operation: ProjectCategoryMoveOperation; project: ProjectCategoryMoveCompleted }
  | { outcome: "recoverable"; operation: ProjectCategoryMoveOperation }
  | { outcome: "rejected"; problem: ProjectCategoryMoveProblem; operation: ProjectCategoryMoveOperation | null };
export interface ProjectCategoryMoveList {
  workspaceId: string;
  sourceId: string;
  operations: ProjectCategoryMoveOperation[];
}
export type ProjectCategoryMovePlacementState = "missing" | "matching" | "replaced" | "link" | "unavailable" | "conflicting";
export interface ProjectCategoryMoveRecoveryPreview {
  workspaceId: string;
  sourceId: string;
  operation: ProjectCategoryMoveOperation;
  revision: number;
  originalState: ProjectCategoryMovePlacementState;
  destinationState: ProjectCategoryMovePlacementState;
  problem: ProjectCategoryMoveProblem | null;
  actions: ProjectCategoryMoveRecoveryAction[];
  previewToken: string | null;
}

// Shape validation only; placement policy and current authorization belong to the service.
export function isProjectCategoryMoveRequest(value: unknown): value is ProjectCategoryMoveRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const exact = (keys: string[]) => Object.keys(input).length === keys.length && keys.every((key) => Object.hasOwn(input, key));
  const uuid = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  if (!uuid(input.workspaceId)) return false;
  if (input.type === "workspace.listProjectCategoryMoves") return exact(["type", "workspaceId"]);
  if (!uuid(input.operationId)) return false;
  if (input.type === "workspace.getProjectCategoryMove" || input.type === "workspace.previewProjectCategoryMoveRecovery") {
    return exact(["type", "workspaceId", "operationId"]);
  }
  if (input.type === "workspace.recoverProjectCategoryMove") {
    return exact(["type", "workspaceId", "operationId", "previewToken", "action"]) && uuid(input.previewToken) &&
      ["retry_original", "complete_destination", "keep_original"].includes(typeof input.action === "string" ? input.action : "");
  }
  return input.type === "workspace.moveProjectCategory" && uuid(input.projectId) && uuid(input.destinationCategoryId) &&
    typeof input.expectedRevision === "number" && Number.isSafeInteger(input.expectedRevision) && input.expectedRevision >= 0 &&
    exact(["type", "workspaceId", "projectId", "operationId", "destinationCategoryId", "expectedRevision"]);
}
