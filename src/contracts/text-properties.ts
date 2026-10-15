export interface PropertyDefinition {
  propertyId: string;
  sourceId: string;
  name: string;
  propertyType: "text" | "number" | "date" | "single_select" | "multi_select";
}
export interface PropertySnapshot {
  workspaceId: string;
  sourceId: string;
  revision: number;
  definitions: PropertyDefinition[];
  selectOptions?: SelectOption[];
  multiSelectValues?: { projectId: string; propertyId: string; optionId: string }[];
  selectValues?: { projectId: string; propertyId: string; optionId: string }[];
  dateValues?: { projectId: string; propertyId: string; value: string }[];
  numberValues?: { projectId: string; propertyId: string; value: number }[];
  values: { projectId: string; propertyId: string; value: string }[];
}
export interface PropertyMutation {
  snapshot: PropertySnapshot;
  propertyId: string;
  projectId: string | null;
}
export type WorkspaceListTextPropertiesQuery = { type: "workspace.listTextProperties"; workspaceId: string };
export type WorkspaceCreatePropertyCommand = { type: "workspace.createProperty"; workspaceId: string; name: string; propertyType: "text" | "number" | "date" | "single_select" | "multi_select" };
export type WorkspaceRenamePropertyCommand = { type: "workspace.renameProperty"; workspaceId: string; propertyId: string; name: string };
export type WorkspaceSetTextValueCommand = { type: "workspace.setTextValue"; workspaceId: string; projectId: string; propertyId: string; value: string | null };

export type WorkspaceSetNumberValueCommand = { type: "workspace.setNumberValue"; workspaceId: string; projectId: string; propertyId: string; expression: string | null };

// Existing Text callers retain their projection and payload names during type expansion.
export type TextPropertyDefinition = PropertyDefinition;
export type TextPropertySnapshot = PropertySnapshot;
export type TextPropertyMutation = PropertyMutation;

export type WorkspaceSetDateValueCommand = { type: "workspace.setDateValue"; workspaceId: string; projectId: string; propertyId: string; value: string | null };

export const selectColors = ["default", "gray", "red", "orange", "yellow", "green", "blue", "purple"] as const;
export type SelectColor = typeof selectColors[number];
export interface SelectOption {
  optionId: string; propertyId: string; name: string; color: SelectColor; position: number; hidden: boolean;
}
export type SelectCommand =
  | { type: "workspace.createSelectOption"; workspaceId: string; propertyId: string; name: string; color: SelectColor }
  | { type: "workspace.updateSelectOption"; workspaceId: string; propertyId: string; optionId: string; name: string; color: SelectColor }
  | { type: "workspace.reorderSelectOptions"; workspaceId: string; propertyId: string; optionIds: string[] }
  | { type: "workspace.setSelectOptionHidden"; workspaceId: string; propertyId: string; optionId: string; hidden: boolean }
  | { type: "workspace.setMultiSelectValue"; workspaceId: string; propertyId: string; projectId: string; optionIds: string[] }
  | { type: "workspace.setSelectValue"; workspaceId: string; propertyId: string; projectId: string; optionId: string | null };
export const selectCommands = ["workspace.createSelectOption", "workspace.updateSelectOption", "workspace.reorderSelectOptions", "workspace.setSelectOptionHidden", "workspace.setSelectValue", "workspace.setMultiSelectValue"];
export function isSelectCommand(input: unknown): input is SelectCommand {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const v = input as Record<string, unknown>;
  const uuid = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const exact = (...keys: string[]) => Object.keys(v).length === keys.length + 3 && ["type", "workspaceId", "propertyId", ...keys].every(key => Object.hasOwn(v, key));
  const named = () => typeof v.name === "string" && !!v.name.trim() && selectColors.includes(v.color as SelectColor);
  if (!uuid(v.workspaceId) || !uuid(v.propertyId)) return false;
  switch (v.type) {
    case "workspace.createSelectOption": return exact("name", "color") && named();
    case "workspace.updateSelectOption": return exact("optionId", "name", "color") && uuid(v.optionId) && named();
    case "workspace.reorderSelectOptions": return exact("optionIds") && Array.isArray(v.optionIds) && Array.from(v.optionIds).every(uuid) && new Set(v.optionIds).size === v.optionIds.length;
    case "workspace.setSelectOptionHidden": return exact("optionId", "hidden") && uuid(v.optionId) && typeof v.hidden === "boolean";
    case "workspace.setMultiSelectValue": return exact("projectId", "optionIds") && uuid(v.projectId) && Array.isArray(v.optionIds) && Array.from(v.optionIds).every(uuid) && new Set(v.optionIds).size === v.optionIds.length;
    case "workspace.setSelectValue": return exact("projectId", "optionId") && uuid(v.projectId) && (v.optionId === null || uuid(v.optionId));
    default: return false;
  }
}
