/// <reference types="vite/client" />

type WorkspaceContextMenuAction = "rename" | "delete" | null;

interface Window {
  workspace?: {
    showContextMenu?: (payload: { x: number; y: number; canDelete: boolean }) => Promise<{ action: WorkspaceContextMenuAction }>;
  };
}
