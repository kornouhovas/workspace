export interface TextPropertyDefinition {
  propertyId: string;
  sourceId: string;
  name: string;
  propertyType: "text";
}
export interface TextPropertySnapshot {
  workspaceId: string;
  sourceId: string;
  revision: number;
  definitions: TextPropertyDefinition[];
  values: { projectId: string; propertyId: string; value: string }[];
}
export interface TextPropertyMutation {
  snapshot: TextPropertySnapshot;
  propertyId: string;
  projectId: string | null;
}
export type WorkspaceListTextPropertiesQuery = { type: "workspace.listTextProperties"; workspaceId: string };
export type WorkspaceCreatePropertyCommand = { type: "workspace.createProperty"; workspaceId: string; name: string; propertyType: "text" };
export type WorkspaceRenamePropertyCommand = { type: "workspace.renameProperty"; workspaceId: string; propertyId: string; name: string };
