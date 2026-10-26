export type CategoryFolderAction = "create" | "associate" | "rename";
export interface CategoryFolderPreview {
  workspaceId: string; sourceId: string; action: CategoryFolderAction; categoryId: string | null;
  originalRelativePath: string | null; requestedRelativePath: string; revision: number;
  affectedProjects: { projectId: string | null; name: string; originalRelativePath: string; requestedRelativePath: string }[];
  previewToken: string;
}
export interface CategoryFolderOperation {
  operationId: string; sourceId: string; categoryId: string; action: CategoryFolderAction;
  originalRelativePath: string | null; requestedRelativePath: string;
  stage: "intent" | "destination_recorded" | "completed" | "failed";
  problem: string | null; completedRevision: number | null;
}
export interface CategoryFolderResult { outcome: "completed" | "recoverable" | "rejected"; operation: CategoryFolderOperation }
export interface CategoryFolderStatus {
  workspaceId: string; sourceId: string; operations: CategoryFolderOperation[];
}
export interface CategoryFolderRecoveryPreview {
  workspaceId: string; sourceId: string; operation: CategoryFolderOperation;
  originalState: "matching" | "missing" | "changed"; destinationState: "matching" | "missing" | "changed";
  actions: ("complete_destination" | "keep_original")[]; previewToken: string | null;
}
export const categoryColors = ["default", "gray", "red", "orange", "yellow", "green", "blue", "purple"] as const;
export type CategoryColor = typeof categoryColors[number];
export interface CategoryPresentation {
  categoryId: string; color: CategoryColor;
  hidden: boolean; position: number;
}
export interface CategoryPresentationSnapshot { workspaceId: string; sourceId: string; options: CategoryPresentation[] }
export type CategoryOptionsQuery =
  | { type: "workspace.previewCategoryFolder"; workspaceId: string; action: CategoryFolderAction; name: string; categoryId: string | null }
  | { type: "workspace.listCategoryFolderOperations"; workspaceId: string }
  | { type: "workspace.getCategoryFolderOperation"; workspaceId: string; operationId: string }
  | { type: "workspace.previewCategoryFolderRecovery"; workspaceId: string; operationId: string }
  | { type: "workspace.listCategoryPresentation"; workspaceId: string };
export type CategoryOptionsCommand =
  | { type: "workspace.setCategoryColor"; workspaceId: string; categoryId: string; color: CategoryColor }
  | { type: "workspace.applyCategoryFolder"; workspaceId: string; operationId: string; previewToken: string }
  | { type: "workspace.recoverCategoryFolder"; workspaceId: string; operationId: string; previewToken: string; action: "complete_destination" | "keep_original" }
  | { type: "workspace.setCategoryPresentation"; workspaceId: string; options: CategoryPresentation[] };
export type CategoryOptionsPayload = CategoryFolderPreview | CategoryFolderResult | CategoryFolderStatus | CategoryFolderRecoveryPreview | CategoryPresentationSnapshot;
export const categoryOptionsQueries = ["workspace.previewCategoryFolder", "workspace.listCategoryFolderOperations", "workspace.previewCategoryFolderRecovery", "workspace.getCategoryFolderOperation", "workspace.listCategoryPresentation"];
export const categoryOptionsCommands = ["workspace.setCategoryColor", "workspace.applyCategoryFolder", "workspace.recoverCategoryFolder", "workspace.setCategoryPresentation"];
export function isCategoryOptionsRequest(value: unknown): value is CategoryOptionsQuery | CategoryOptionsCommand {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const uuid = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const exact = (keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
  if (!uuid(v.workspaceId)) return false;
  if (v.type === "workspace.previewCategoryFolder") return exact(["type", "workspaceId", "action", "name", "categoryId"]) &&
    ["create", "associate", "rename"].includes(typeof v.action === "string" ? v.action : "") && typeof v.name === "string" &&
    (v.action === "rename" ? uuid(v.categoryId) : v.categoryId === null);
  if (v.type === "workspace.listCategoryFolderOperations" || v.type === "workspace.listCategoryPresentation") return exact(["type", "workspaceId"]);
  if (v.type === "workspace.previewCategoryFolderRecovery" || v.type === "workspace.getCategoryFolderOperation") return exact(["type", "workspaceId", "operationId"]) && uuid(v.operationId);
  if (v.type === "workspace.applyCategoryFolder") return exact(["type", "workspaceId", "operationId", "previewToken"]) && uuid(v.operationId) && uuid(v.previewToken);
  if (v.type === "workspace.recoverCategoryFolder") return exact(["type", "workspaceId", "operationId", "previewToken", "action"]) && uuid(v.operationId) && uuid(v.previewToken) && ["complete_destination", "keep_original"].includes(typeof v.action === "string" ? v.action : "");
  if (v.type === "workspace.setCategoryColor") return exact(["type", "workspaceId", "categoryId", "color"]) && uuid(v.categoryId) && categoryColors.some(color => color === v.color);
  return v.type === "workspace.setCategoryPresentation" && exact(["type", "workspaceId", "options"]) && Array.isArray(v.options) && v.options.every((o: unknown) => {
    if (typeof o !== "object" || o === null || Array.isArray(o)) return false;
    const p = o as Record<string, unknown>;
    return Object.keys(p).length === 4 && uuid(p.categoryId) && typeof p.hidden === "boolean" && Number.isSafeInteger(p.position) && Number(p.position) >= 0 &&
      ["default", "gray", "red", "orange", "yellow", "green", "blue", "purple"].includes(typeof p.color === "string" ? p.color : "");
  });
}
