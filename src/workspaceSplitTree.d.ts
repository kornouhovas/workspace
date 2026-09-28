export type SplitSide = "left" | "right" | "top" | "bottom";
export type WorkspacePaneNode = { type: "pane"; paneId: string; tabId: string | null };
export type WorkspaceSplitNode = {
  type: "split";
  dir: "row" | "col";
  sizes: number[];
  children: WorkspaceLayoutNode[];
};
export type WorkspaceLayoutNode = WorkspacePaneNode | WorkspaceSplitNode;
export const MAX_WORKSPACE_PANES: number;
export function workspacePane(): WorkspacePaneNode;
export function listWorkspacePanes(root: WorkspaceLayoutNode): WorkspacePaneNode[];
export function insertWorkspacePane(
  root: WorkspaceLayoutNode,
  target: string,
  side: SplitSide,
  pane: WorkspacePaneNode,
): WorkspaceLayoutNode;
export function removeWorkspacePane(
  root: WorkspaceLayoutNode,
  id: string,
): WorkspaceLayoutNode | null;
export function mapWorkspacePane(
  root: WorkspaceLayoutNode,
  id: string,
  patch: Partial<WorkspacePaneNode>,
): WorkspaceLayoutNode;
export function resizeWorkspaceSplit(
  root: WorkspaceLayoutNode,
  path: number[],
  index: number,
  fraction: number,
): WorkspaceLayoutNode;
export function readWorkspaceSplitTree(value: unknown): WorkspaceLayoutNode | null;
export function workspaceSplitDrop(
  rect: { left: number; top: number; width: number; height: number } | null,
  x: number,
  y: number,
): SplitSide | "center" | null;
export function moveWorkspacePane(
  root: WorkspaceLayoutNode,
  source: string,
  target: string,
  side: SplitSide | "center",
): WorkspaceLayoutNode;
