import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderKanbanIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from "@/lib/lucide-icons";
import { cn } from "@/lib/utils";
import { reorderWorkspaceIdsForDrag, type WorkspaceDragTargetEdge } from "@/workspaceDrag";

type WorkspaceNavigationItem = {
  readonly id: string;
  readonly name: string;
};

type WorkspaceLeftPanelProps = {
  readonly activeSurface: "workspace" | "settings";
  readonly activeWorkspaceId: string | null;
  readonly workspaces: readonly WorkspaceNavigationItem[];
  readonly searchQuery: string;
  readonly onAddWorkspace: () => void;
  readonly onRenameWorkspace: (workspaceId: string, name: string) => void;
  readonly onDeleteWorkspace: (workspaceId: string) => void;
  readonly onReorderWorkspaces: (orderedWorkspaceIds: readonly string[]) => void;
  readonly onWorkspaceOpen: (workspaceId: string) => void;
  readonly onSearchQueryChange: (searchQuery: string) => void;
  readonly onOpenSettings: () => void;
};

export function WorkspaceLeftPanel({
  activeSurface,
  activeWorkspaceId,
  workspaces,
  searchQuery,
  onAddWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onReorderWorkspaces,
  onWorkspaceOpen,
  onSearchQueryChange,
  onOpenSettings,
}: WorkspaceLeftPanelProps) {
  const [workspaceDragState, setWorkspaceDragState] = useState<{
    readonly draggedWorkspaceId: string;
    readonly orderedWorkspaceIds: readonly string[];
  } | null>(null);
  const [contextMenuWorkspaceId, setContextMenuWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState("");
  const editingWorkspaceInputRef = useRef<HTMLInputElement | null>(null);
  const cancelWorkspaceRenameRef = useRef(false);
  const draggedWorkspaceIdRef = useRef<string | null>(null);
  const workspaceDragOrderRef = useRef<readonly string[]>([]);
  const workspaceDragCommittedRef = useRef(false);

  useEffect(() => {
    if (editingWorkspaceId) {
      editingWorkspaceInputRef.current?.focus();
      editingWorkspaceInputRef.current?.select();
    }
  }, [editingWorkspaceId]);

  function startRenameWorkspace(workspace: WorkspaceNavigationItem) {
    cancelWorkspaceRenameRef.current = false;
    setContextMenuWorkspaceId(null);
    setEditingWorkspaceId(workspace.id);
    setEditingWorkspaceName(workspace.name);
  }

  function submitWorkspaceRename(workspace: WorkspaceNavigationItem) {
    if (cancelWorkspaceRenameRef.current) {
      cancelWorkspaceRenameRef.current = false;
      return;
    }

    const nextName = editingWorkspaceName.trim();
    cancelWorkspaceRenameRef.current = true;
    setEditingWorkspaceId(null);
    setEditingWorkspaceName("");

    if (nextName && nextName !== workspace.name) {
      onRenameWorkspace(workspace.id, nextName);
    }
  }

  function cancelWorkspaceRename() {
    cancelWorkspaceRenameRef.current = true;
    setEditingWorkspaceId(null);
    setEditingWorkspaceName("");
  }

  function deleteWorkspace(workspace: WorkspaceNavigationItem) {
    if (window.confirm(`Delete workspace "${workspace.name}"?`)) {
      onDeleteWorkspace(workspace.id);
    }
  }

  function getWorkspaceDragTargetEdge(event: ReactDragEvent<HTMLDivElement>): WorkspaceDragTargetEdge {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY >= rect.top + rect.height / 2 ? "after" : "before";
  }

  function startWorkspaceDrag(event: ReactDragEvent<HTMLDivElement>, workspaceId: string) {
    const orderedWorkspaceIds = workspaces.map((workspace) => workspace.id);
    workspaceDragCommittedRef.current = false;
    draggedWorkspaceIdRef.current = workspaceId;
    workspaceDragOrderRef.current = orderedWorkspaceIds;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", workspaceId);
    setWorkspaceDragState({ draggedWorkspaceId: workspaceId, orderedWorkspaceIds });
  }

  function previewWorkspaceDrag(event: ReactDragEvent<HTMLDivElement>, targetWorkspaceId: string) {
    const draggedWorkspaceId = workspaceDragState?.draggedWorkspaceId ?? draggedWorkspaceIdRef.current;
    if (!draggedWorkspaceId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const orderedWorkspaceIds = reorderWorkspaceIdsForDrag(
      workspaceDragOrderRef.current.length > 0
        ? workspaceDragOrderRef.current
        : workspaces.map((workspace) => workspace.id),
      draggedWorkspaceId,
      targetWorkspaceId,
      getWorkspaceDragTargetEdge(event),
    );

    if (orderedWorkspaceIds.join("\0") === workspaceDragOrderRef.current.join("\0")) {
      return;
    }

    workspaceDragOrderRef.current = orderedWorkspaceIds;
    setWorkspaceDragState({ draggedWorkspaceId, orderedWorkspaceIds });
  }

  function clearWorkspaceDragPreview() {
    draggedWorkspaceIdRef.current = null;
    workspaceDragOrderRef.current = [];
    setWorkspaceDragState(null);
  }

  function commitWorkspaceDrag(event: ReactDragEvent<HTMLDivElement>) {
    if (!workspaceDragState && !draggedWorkspaceIdRef.current) {
      return;
    }

    event.preventDefault();
    const orderedWorkspaceIds = workspaceDragOrderRef.current;
    workspaceDragCommittedRef.current = true;
    clearWorkspaceDragPreview();

    if (orderedWorkspaceIds.join("\0") !== workspaces.map((workspace) => workspace.id).join("\0")) {
      onReorderWorkspaces(orderedWorkspaceIds);
    }
  }

  function finishWorkspaceDrag() {
    if (!workspaceDragCommittedRef.current) {
      clearWorkspaceDragPreview();
    }

    workspaceDragCommittedRef.current = false;
  }

  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const renderedWorkspaces = workspaceDragState
    ? [
        ...workspaceDragState.orderedWorkspaceIds
          .map((workspaceId) => workspaceById.get(workspaceId))
          .filter((workspace): workspace is WorkspaceNavigationItem => workspace !== undefined),
        ...workspaces.filter((workspace) => !workspaceDragState.orderedWorkspaceIds.includes(workspace.id)),
      ]
    : workspaces;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="electron-window-drag min-h-12 pt-7" />
      <div className="electron-window-no-drag flex flex-1 flex-col gap-3 px-3 py-3">
        <button
          type="button"
          className="inline-flex h-8 w-full items-center justify-start gap-2 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          title="Add Workspace"
          onClick={onAddWorkspace}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          Add Workspace
        </button>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Search
          <span className="relative block">
            <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
              placeholder="Project name"
              type="search"
            />
          </span>
        </label>
        <div className="h-px bg-border" />
        <div className="grid gap-1">
          <p className="px-2 text-xs font-medium text-muted-foreground">Workspaces</p>
          {renderedWorkspaces.map((workspace) => {
            const active = activeSurface === "workspace" && activeWorkspaceId === workspace.id;
            const editing = editingWorkspaceId === workspace.id;
            const dragging = workspaceDragState?.draggedWorkspaceId === workspace.id;

            return (
              <div
                key={workspace.id}
                draggable={!editing}
                onDragStart={(event) => startWorkspaceDrag(event, workspace.id)}
                onDragOver={(event) => previewWorkspaceDrag(event, workspace.id)}
                onDrop={commitWorkspaceDrag}
                onDragEnd={finishWorkspaceDrag}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenuWorkspaceId(workspace.id);
                }}
                className={cn(
                  "group/workspace flex items-center gap-1 rounded-lg transition-opacity duration-100",
                  dragging && "opacity-60",
                )}
              >
                {editing ? (
                  <form
                    className="min-w-0 flex-1"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitWorkspaceRename(workspace);
                    }}
                  >
                    <input
                      ref={editingWorkspaceInputRef}
                      aria-label="Rename workspace"
                      className="h-8 w-full rounded-lg border border-ring bg-background px-2 text-sm text-foreground outline-none ring-3 ring-ring/30"
                      value={editingWorkspaceName}
                      onChange={(event) => setEditingWorkspaceName(event.currentTarget.value)}
                      onBlur={() => submitWorkspaceRename(workspace)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelWorkspaceRename();
                        }
                      }}
                    />
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex h-8 min-w-0 flex-1 items-center justify-start gap-2 rounded-lg px-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
                        active && "bg-sidebar-accent text-sidebar-accent-foreground",
                      )}
                      title={workspace.name}
                      onClick={() => onWorkspaceOpen(workspace.id)}
                    >
                      <FolderKanbanIcon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{workspace.name}</span>
                    </button>
                    <DropdownMenu
                      open={contextMenuWorkspaceId === workspace.id}
                      onOpenChange={(open) => setContextMenuWorkspaceId(open ? workspace.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover/workspace:opacity-100 data-open:opacity-100"
                          aria-label={`Workspace actions for ${workspace.name}`}
                          title="Workspace actions"
                        >
                          <MoreHorizontalIcon className="size-4" aria-hidden="true" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        <DropdownMenuItem onSelect={() => startRenameWorkspace(workspace)}>
                          Rename Workspace
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => deleteWorkspace(workspace)}>
                          Delete Workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-auto">
          <button
            type="button"
            aria-current={activeSurface === "settings" ? "page" : undefined}
            className={cn(
              "inline-flex h-8 w-full items-center justify-start gap-2 rounded-lg px-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
              activeSurface === "settings" && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
            title="Settings"
            onClick={onOpenSettings}
          >
            <SettingsIcon className="size-4" aria-hidden="true" />
            Settings
          </button>
        </div>
      </div>
    </aside>
  );
}
