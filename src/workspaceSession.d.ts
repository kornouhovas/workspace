import type { WorkspaceMockProject } from "./workspaceMockData";
import type { ProjectTab, ProjectTabsState, ProjectTabsAction } from "./workspaceProjectTabs";
import type { PaneAction, PaneLayout } from "./workspacePaneLayout";
import type { SplitSide } from "./workspaceSplitTree";

export type WorkspaceSurface = "workspace" | "workspace-settings" | "settings";
type Update<T> = T | ((current: T) => T);
export type SessionSnapshot = Readonly<{
  tabs: ProjectTabsState;
  layouts: Record<string, PaneLayout>;
  sidebarWidth: number;
  selectedProject: WorkspaceMockProject | null;
  activeProjectTabId: string | null;
  projectTabSelected: boolean;
  activeSurface: WorkspaceSurface;
  closedProjectTabs: Readonly<Record<string, readonly ProjectTab[]>>;
}>;
export type SessionCommand = { workspaceId: string } & (
  | { type: "restoreScreen"; project: WorkspaceMockProject | null; tabId?: string | null; fullScreen?: boolean }
  | { type: "openProject"; project: WorkspaceMockProject; tabId?: string | null; fullScreen?: boolean }
  | { type: "expandProject"; project: WorkspaceMockProject; tabId: string; afterTabId?: string }
  | { type: "splitProject"; project: WorkspaceMockProject; tabId?: string; newTabId: string; paneId: string; target?: string; side?: SplitSide | "center" }
  | { type: "restoreProject"; tabId: string }
  | { type: "closeTabs"; tabIds: readonly string[] }
  | { type: "closePane"; paneId: string }
  | { type: "closePreview" | "reopenProject" }
  | { type: "showSurface" | "surface"; surface: WorkspaceSurface }
  | { type: "pane"; action: PaneAction }
  // Compatibility commands keep current restoration and CRUD adapters working.
  | { type: "selection"; selectedProject?: Update<WorkspaceMockProject | null>; activeProjectTabId?: Update<string | null>; projectTabSelected?: Update<boolean> }
  | { type: "tabs"; action: ProjectTabsAction }
);
export type SessionResult = {
  snapshot: SessionSnapshot;
  tabId?: string;
  projectToLoad?: WorkspaceMockProject;
  focus?: { kind: "pane" | "projectTab"; id: string } | { kind: "viewTab" };
};
export function createWorkspaceSession(initial?: {
  tabs?: ProjectTabsState;
  layouts?: Record<string, PaneLayout>;
  sidebarWidth?: number;
}): {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  dispatch(command: SessionCommand): SessionResult;
};
