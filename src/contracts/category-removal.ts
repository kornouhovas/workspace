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
export type CategoryRemovalQuery = {
  type: "workspace.previewCategoryRemoval";
  workspaceId: string;
  categoryId: string;
  destinationCategoryId: string | null;
};
export function isCategoryRemovalRequest(value: unknown): value is CategoryRemovalQuery {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const uuid = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  return v.type === "workspace.previewCategoryRemoval" && Object.keys(v).length === 4 && uuid(v.workspaceId) &&
    uuid(v.categoryId) && (v.destinationCategoryId === null || uuid(v.destinationCategoryId));
}
export const categoryRemovalQueries = ["workspace.previewCategoryRemoval"];
