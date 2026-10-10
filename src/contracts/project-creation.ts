import type { DiscoveryMode } from "./workspaces.js";

// Paths, native evidence and the logical project ID are resolved by the service.
export type WorkspaceCreateProjectCommand = {
  type: "workspace.createProject";
  workspaceId: string;
  operationId: string;
  name: string;
  expectedRevision: number;
} & ({ mode: "direct" } | { mode: "grouped"; categoryId: string });

export type WorkspaceListProjectCreationsQuery = {
  type: "workspace.listProjectCreations";
  workspaceId: string;
};
export type WorkspaceGetProjectCreationQuery = {
  type: "workspace.getProjectCreation";
  workspaceId: string;
  operationId: string;
};
export type WorkspacePreviewProjectCreationRecoveryQuery = {
  type: "workspace.previewProjectCreationRecovery";
  workspaceId: string;
  operationId: string;
};
export type ProjectCreationRecoveryAction = "retry_missing" | "complete_recorded" | "associate_reviewed";
export type WorkspaceRecoverProjectCreationCommand = {
  type: "workspace.recoverProjectCreation";
  workspaceId: string;
  operationId: string;
  previewToken: string;
  action: ProjectCreationRecoveryAction;
};
export type ProjectCreationRequest = WorkspaceCreateProjectCommand | WorkspaceListProjectCreationsQuery |
  WorkspaceGetProjectCreationQuery | WorkspacePreviewProjectCreationRecoveryQuery | WorkspaceRecoverProjectCreationCommand;

export type ProjectCreationStage = "intent" | "evidence_recorded" | "uncertain" | "completed" | "failed";
export type ProjectCreationProblem =
  | "invalid_name" | "unconfigured" | "stale_configuration" | "category_unavailable"
  | "excluded" | "archive" | "reserved_destination" | "occupied" | "case_alias"
  | "source_unavailable" | "permission_denied" | "filesystem_changed" | "filesystem_error"
  | "ownership_uncertain" | "destination_missing" | "destination_replaced" | "destination_link"
  | "native_conflict" | "storage_error";
export interface ProjectCreationOperation {
  operationId: string;
  sourceId: string;
  initiatingWorkspaceId: string;
  projectId: string;
  name: string;
  relativePath: string;
  mode: DiscoveryMode;
  categoryId: string | null;
  expectedRevision: number;
  stage: ProjectCreationStage;
  // Recorded evidence is private. It permits completion only after fresh validation.
  evidenceRecorded: boolean;
  problem: ProjectCreationProblem | null;
  completedRevision: number | null;
}
export interface ProjectCreationList {
  workspaceId: string;
  sourceId: string;
  operations: ProjectCreationOperation[];
}
export interface ProjectCreationCompleted {
  operationId: string;
  sourceId: string;
  projectId: string;
  name: string;
  relativePath: string;
  categoryId: string | null;
  revision: number;
}
export type ProjectCreationResult =
  | { outcome: "completed"; operation: ProjectCreationOperation; project: ProjectCreationCompleted }
  | { outcome: "recoverable"; operation: ProjectCreationOperation }
  | { outcome: "rejected"; problem: ProjectCreationProblem; operation: ProjectCreationOperation | null };
export interface ProjectCreationRecoveryPreview {
  workspaceId: string;
  sourceId: string;
  operation: ProjectCreationOperation;
  revision: number;
  destinationState: "missing" | "recorded" | "unverified" | "replaced" | "link" | "unavailable" | "conflicting";
  problem: ProjectCreationProblem | null;
  // associate_reviewed is explicit acceptance of uncertain ownership, not proof of it.
  actions: ProjectCreationRecoveryAction[];
  previewToken: string | null;
}

// Shape validation only. Platform basenames, ownership and filesystem policy belong to the service.
export function isProjectCreationRequest(value: unknown): value is ProjectCreationRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const exact = (keys: string[]) => Object.keys(input).length === keys.length && keys.every((key) => Object.hasOwn(input, key));
  const uuid = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  if (!uuid(input.workspaceId)) return false;
  if (input.type === "workspace.listProjectCreations") return exact(["type", "workspaceId"]);
  if (!uuid(input.operationId)) return false;
  if (input.type === "workspace.getProjectCreation" || input.type === "workspace.previewProjectCreationRecovery") {
    return exact(["type", "workspaceId", "operationId"]);
  }
  if (input.type === "workspace.recoverProjectCreation") {
    return exact(["type", "workspaceId", "operationId", "previewToken", "action"]) && uuid(input.previewToken) &&
      ["retry_missing", "complete_recorded", "associate_reviewed"].includes(typeof input.action === "string" ? input.action : "");
  }
  if (input.type !== "workspace.createProject" || typeof input.name !== "string" ||
    typeof input.expectedRevision !== "number" || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) return false;
  const keys = ["type", "workspaceId", "operationId", "name", "expectedRevision", "mode"];
  return (input.mode === "direct" && exact(keys)) ||
    (input.mode === "grouped" && exact([...keys, "categoryId"]) && uuid(input.categoryId));
}
