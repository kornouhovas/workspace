export interface MetadataRemovalPreview {
  workspaceId: string; sourceId: string; previewToken: string;
  propertyId: string; propertyName: string; optionId: string | null; optionName: string | null;
  replacementOptionId: string | null; replacementName: string | null;
  projects: { projectId: string; relativePath: string; values: string[] }[];
  views: { workspaceId: string; workspaceName: string; viewId: string; viewName: string;
    filters: number; grouping: boolean; table: boolean; board: boolean }[];
}
export interface MetadataRemovalResult { workspaceId: string; sourceId: string; revision: number }
export type PreviewMetadataRemoval = { type: "workspace.previewMetadataRemoval"; workspaceId: string;
  propertyId: string; optionId: string | null; replacementOptionId: string | null };
export type ApplyMetadataRemoval = { type: "workspace.applyMetadataRemoval"; workspaceId: string; previewToken: string };
export const metadataRemovalRequests = ["workspace.previewMetadataRemoval", "workspace.applyMetadataRemoval"];
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function isMetadataRemovalRequest(v: unknown): v is PreviewMetadataRemoval | ApplyMetadataRemoval {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  if (!uuid(r.workspaceId)) return false;
  const keys = r.type === "workspace.previewMetadataRemoval" ? ["type", "workspaceId", "propertyId", "optionId", "replacementOptionId"] : ["type", "workspaceId", "previewToken"];
  if (Object.keys(r).length !== keys.length || !keys.every(k => Object.hasOwn(r, k))) return false;
  return r.type === "workspace.previewMetadataRemoval" ? uuid(r.propertyId) && (r.optionId === null || uuid(r.optionId)) &&
    (r.replacementOptionId === null || uuid(r.replacementOptionId)) && (r.optionId !== null || r.replacementOptionId === null) &&
    (r.optionId === null || r.optionId !== r.replacementOptionId) : r.type === "workspace.applyMetadataRemoval" && uuid(r.previewToken);
}
