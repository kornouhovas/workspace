import type { TextPropertyMutation } from "./text-properties.js";
export interface AssignProjectGroupCommand {
  type: "workspace.assignProjectGroup";
  workspaceId: string;
  viewId: string;
  projectId: string;
  propertyId: string;
  fromKey: string;
  toKey: string;
  archived: boolean;
}
export function isAssignProjectGroupCommand(input: unknown): input is AssignProjectGroupCommand {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const v = input as Record<string, unknown>;
  const fields = ["type", "workspaceId", "viewId", "projectId", "propertyId", "fromKey", "toKey", "archived"];
  const uuid = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  return Object.keys(v).length === fields.length && fields.every(key => Object.hasOwn(v, key)) &&
    v.type === "workspace.assignProjectGroup" && [v.workspaceId, v.viewId, v.projectId].every(uuid) && (v.propertyId === "name" || uuid(v.propertyId)) &&
    typeof v.fromKey === "string" && typeof v.toKey === "string" && typeof v.archived === "boolean";
}

// Filesystem receipts retain rejected/recoverable outcomes; neither is a saved value.
export interface GroupAssignmentResult extends TextPropertyMutation {
  filesystem?: import("./project-rename.js").ProjectRenameResult | import("./project-category-move.js").ProjectCategoryMoveResult;
}
