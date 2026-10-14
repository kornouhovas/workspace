export interface PropertyDefinition {
  propertyId: string;
  sourceId: string;
  name: string;
  propertyType: "text" | "number";
}
export interface PropertySnapshot {
  workspaceId: string;
  sourceId: string;
  revision: number;
  definitions: PropertyDefinition[];
  numberValues?: { projectId: string; propertyId: string; value: number }[];
  values: { projectId: string; propertyId: string; value: string }[];
}
export interface PropertyMutation {
  snapshot: PropertySnapshot;
  propertyId: string;
  projectId: string | null;
}
export type WorkspaceListTextPropertiesQuery = { type: "workspace.listTextProperties"; workspaceId: string };
export type WorkspaceCreatePropertyCommand = { type: "workspace.createProperty"; workspaceId: string; name: string; propertyType: "text" | "number" };
export type WorkspaceRenamePropertyCommand = { type: "workspace.renameProperty"; workspaceId: string; propertyId: string; name: string };
export type WorkspaceSetTextValueCommand = { type: "workspace.setTextValue"; workspaceId: string; projectId: string; propertyId: string; value: string | null };

export type WorkspaceSetNumberValueCommand = { type: "workspace.setNumberValue"; workspaceId: string; projectId: string; propertyId: string; expression: string | null };

// Existing Text callers retain their projection and payload names during type expansion.
export type TextPropertyDefinition = PropertyDefinition;
export type TextPropertySnapshot = PropertySnapshot;
export type TextPropertyMutation = PropertyMutation;
