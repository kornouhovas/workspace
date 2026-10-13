export interface CategoryRemovalProject {
  projectId: string;
  originalRelativePath: string;
  requestedRelativePath: string;
}
export interface CategoryRemovalPreview {
  workspaceId: string;
  sourceId: string;
  categoryId: string;
  destinationCategoryId: string | null;
  originalRelativePath: string;
  destinationRelativePath: string | null;
  revision: number;
  projects: CategoryRemovalProject[];
  blockers: { relativePath: string; problem: "occupied" | "unexpected_entry" | "project_unavailable" | "excluded" | "archive" }[];
  previewToken: string;
}
export interface CategoryRemovalOperation {
  operationId: string; sourceId: string; categoryId: string; destinationCategoryId: string | null;
  originalRelativePath: string; destinationRelativePath: string | null;
  stage: "moving" | "cleanup_intent" | "completed" | "abandoned";
  problem: string | null; completedRevision: number | null;
  projects: (CategoryRemovalProject & { outcome: "pending" | "completed" | "rejected" | "recoverable"; problem: string | null })[];
}
export interface CategoryRemovalLookup { workspaceId: string; sourceId: string; operation: CategoryRemovalOperation | null }
export interface CategoryRemovalResult { operation: CategoryRemovalOperation }
export interface CategoryRemovalList { workspaceId: string; sourceId: string; operations: CategoryRemovalOperation[] }
export interface CategoryRemovalRecoveryPreview {
  workspaceId: string; sourceId: string; operation: CategoryRemovalOperation;
  actions: ("retry_remaining" | "abandon")[]; previewToken: string | null;
}
export type CategoryRemovalQuery =
  | { type: "workspace.previewCategoryRemoval"; workspaceId: string; categoryId: string; destinationCategoryId: string | null }
  | { type: "workspace.listCategoryRemovals"; workspaceId: string }
  | { type: "workspace.getCategoryRemoval"; workspaceId: string; operationId: string }
  | { type: "workspace.previewCategoryRemovalRecovery"; workspaceId: string; operationId: string };
export type CategoryRemovalCommand =
  | { type: "workspace.applyCategoryRemoval"; workspaceId: string; operationId: string; previewToken: string }
  | { type: "workspace.recoverCategoryRemoval"; workspaceId: string; operationId: string; previewToken: string; action: "retry_remaining" | "abandon" };
export type CategoryRemovalPayload = CategoryRemovalPreview | CategoryRemovalResult | CategoryRemovalList | CategoryRemovalRecoveryPreview | CategoryRemovalLookup;
export function isCategoryRemovalRequest(value: unknown): value is CategoryRemovalQuery | CategoryRemovalCommand {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const uuid = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const exact = (keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
  if (!uuid(v.workspaceId)) return false;
  if (v.type === "workspace.previewCategoryRemoval") return exact(["type", "workspaceId", "categoryId", "destinationCategoryId"]) && uuid(v.categoryId) && (v.destinationCategoryId === null || uuid(v.destinationCategoryId));
  if (v.type === "workspace.listCategoryRemovals") return exact(["type", "workspaceId"]);
  if (!uuid(v.operationId)) return false;
  if (v.type === "workspace.getCategoryRemoval" || v.type === "workspace.previewCategoryRemovalRecovery") return exact(["type", "workspaceId", "operationId"]);
  if (v.type === "workspace.applyCategoryRemoval") return exact(["type", "workspaceId", "operationId", "previewToken"]) && uuid(v.previewToken);
  return v.type === "workspace.recoverCategoryRemoval" && exact(["type", "workspaceId", "operationId", "previewToken", "action"]) && uuid(v.previewToken) && ["retry_remaining", "abandon"].includes(String(v.action));
}
export const categoryRemovalQueries = ["workspace.previewCategoryRemoval", "workspace.listCategoryRemovals", "workspace.getCategoryRemoval", "workspace.previewCategoryRemovalRecovery"];
export const categoryRemovalCommands = ["workspace.applyCategoryRemoval", "workspace.recoverCategoryRemoval"];
