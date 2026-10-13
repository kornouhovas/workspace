import type { ProjectSummary } from "./workspaces.js";
export interface ArchiveLocationPreview {
  workspaceId: string; sourceId: string; relativePath: string; revision: number;
  blockers: string[]; previewToken: string | null;
}
export interface ArchiveSnapshot {
  workspaceId: string; sourceId: string; relativePath: string | null; revision: number;
  projects: (ProjectSummary & { originalRelativePath: string; categoryName: string | null })[];
}
export interface ProjectArchivePreview {
  workspaceId: string; sourceId: string; projectId: string; action: "archive" | "restore";
  originalRelativePath: string; requestedRelativePath: string; revision: number;
  missingParents: string[]; blockers: string[]; previewToken: string | null;
}
export interface ProjectArchiveOperation {
  operationId: string; sourceId: string; projectId: string; action: "archive" | "restore";
  originalRelativePath: string; requestedRelativePath: string;
  stage: "intent" | "destination_recorded" | "completed" | "failed"; problem: string | null; completedRevision: number | null;
}
export interface ProjectArchiveResult { operation: ProjectArchiveOperation }
export interface ProjectArchiveOperationList { workspaceId: string; sourceId: string; operations: ProjectArchiveOperation[] }
export interface ProjectArchiveRecoveryPreview {
  workspaceId: string; sourceId: string; operation: ProjectArchiveOperation;
  actions: ("retry_original" | "complete_destination" | "keep_original")[]; problem: string | null; previewToken: string | null;
}
export type ArchiveQuery =
  | { type: "workspace.previewProjectArchive"; workspaceId: string; projectId: string; action: "archive" | "restore"; name: string | null; createParent: boolean }
  | { type: "workspace.listProjectArchiveOperations"; workspaceId: string }
  | { type: "workspace.getProjectArchiveOperation"; workspaceId: string; operationId: string }
  | { type: "workspace.previewProjectArchiveRecovery"; workspaceId: string; operationId: string }

  | { type: "workspace.previewArchiveLocation"; workspaceId: string; relativePath: string }
  | { type: "workspace.listArchivedProjects"; workspaceId: string };
export type ArchiveCommand =
  | { type: "workspace.applyProjectArchive"; workspaceId: string; operationId: string; previewToken: string }
  | { type: "workspace.recoverProjectArchive"; workspaceId: string; operationId: string; previewToken: string; action: "retry_original" | "complete_destination" | "keep_original" }
  | { type: "workspace.applyArchiveLocation"; workspaceId: string; operationId: string; previewToken: string };
export type ArchivePayload = ArchiveSnapshot | ArchiveLocationPreview | ProjectArchivePreview | ProjectArchiveResult | ProjectArchiveOperationList | ProjectArchiveRecoveryPreview;
export const archiveQueries = ["workspace.previewProjectArchive", "workspace.listProjectArchiveOperations", "workspace.getProjectArchiveOperation", "workspace.previewProjectArchiveRecovery", "workspace.previewArchiveLocation", "workspace.listArchivedProjects"];
export const archiveCommands = ["workspace.applyProjectArchive", "workspace.recoverProjectArchive", "workspace.applyArchiveLocation"];
export function isArchiveRequest(input: unknown): input is ArchiveQuery | ArchiveCommand {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const v = input as Record<string, unknown>;
  const uuid = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const exact = (keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
  if (!uuid(v.workspaceId)) return false;
  if (v.type === "workspace.previewProjectArchive") return exact(["type", "workspaceId", "projectId", "action", "name", "createParent"]) && uuid(v.projectId) && ["archive", "restore"].includes(String(v.action)) && (v.name === null || typeof v.name === "string") && typeof v.createParent === "boolean";
  if (v.type === "workspace.listProjectArchiveOperations") return exact(["type", "workspaceId"]);
  if (v.type === "workspace.getProjectArchiveOperation" || v.type === "workspace.previewProjectArchiveRecovery") return exact(["type", "workspaceId", "operationId"]) && uuid(v.operationId);
  if (v.type === "workspace.applyProjectArchive") return exact(["type", "workspaceId", "operationId", "previewToken"]) && uuid(v.operationId) && uuid(v.previewToken);
  if (v.type === "workspace.recoverProjectArchive") return exact(["type", "workspaceId", "operationId", "previewToken", "action"]) && uuid(v.operationId) && uuid(v.previewToken) && ["retry_original", "complete_destination", "keep_original"].includes(String(v.action));
  if (v.type === "workspace.listArchivedProjects") return exact(["type", "workspaceId"]);
  if (v.type === "workspace.previewArchiveLocation") return exact(["type", "workspaceId", "relativePath"]) && typeof v.relativePath === "string";
  return v.type === "workspace.applyArchiveLocation" && exact(["type", "workspaceId", "operationId", "previewToken"]) && uuid(v.operationId) && uuid(v.previewToken);
}
