import type { WorkspaceMockProject } from "./workspaceMockData";
export type ProjectTab = WorkspaceMockProject & { readonly tabId: string };
export type ProjectTabsState = Readonly<Record<string, readonly ProjectTab[]>>;
export type ProjectTabsAction =
  | { type: "reorder"; workspaceId: string; tabIds: readonly string[] }
  | { type: "valueSaved"; workspaceId: string; projectId: string; propertyId: string; value: unknown }
  | { type: "expand"; workspaceId: string; tabId: string; project: WorkspaceMockProject; afterTabId?: string }
  | { type: "update"; workspaceId: string; project: WorkspaceMockProject }
  | { type: "remove"; workspaceId: string; tabId: string };
export function projectTabsReducer(state: ProjectTabsState, action: ProjectTabsAction): ProjectTabsState;
