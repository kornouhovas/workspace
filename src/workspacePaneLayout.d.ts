import type { WorkspaceLayoutNode, SplitSide } from "./workspaceSplitTree";
export type PaneId = string;
export type PaneLayout = {
  tree: WorkspaceLayoutNode;
  rightVisible: boolean;
  rightWidth: number;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  split: boolean;
  splitRatio: number;
  maximized: PaneId | null;
  focused: PaneId;
  rightTabs: string[];
  activeRightTab: string;
  closedRightTabs: string[];
};
export type PaneAction =
  | { type: "split"; tabId?: string; target?: string; paneId?: string; side?: SplitSide }
  | { type: "dropPane"; source: string; target: string; side: SplitSide | "center" }
  | { type: "closePane"; paneId: string }
  | { type: "resizeTree"; path: number[]; index: number; fraction: number }
  | { type: "replacePane"; paneId: string; tabId: string | null }
  | { type: "rightToggle" | "sidebarToggle" | "closeSplit" | "rightReopen" | "showWorkspace" }
  | { type: "resizeRight" | "resizeSidebar"; width: number }
  | { type: "resizeSplit"; ratio: number }
  | { type: "focus" | "maximize"; pane: PaneId }
  | {
      type: "rightOpen" | "rightSelect" | "rightClose" | "rightCloseOthers" | "rightCloseAfter";
      id: string;
    }
  | { type: "rightReorder"; ids: string[] };
export function createPaneLayout(): PaneLayout;
export function paneLayoutReducer(state: PaneLayout, action: PaneAction): PaneLayout;
export function readPaneLayouts(storage: Pick<Storage, "getItem">): Record<string, PaneLayout>;
export function writePaneLayouts(
  storage: Pick<Storage, "setItem">,
  layouts: Record<string, PaneLayout>,
): boolean;
