import { useState } from "react";

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
  readonly onReorderWorkspace: (sourceWorkspaceId: string, targetWorkspaceId: string) => void;
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
  onReorderWorkspace,
  onWorkspaceOpen,
  onSearchQueryChange,
  onOpenSettings,
}: WorkspaceLeftPanelProps) {
  const [draggedWorkspaceId, setDraggedWorkspaceId] = useState<string | null>(null);
  const [contextMenuWorkspaceId, setContextMenuWorkspaceId] = useState<string | null>(null);

  function renameWorkspace(workspace: WorkspaceNavigationItem) {
    const nextName = window.prompt("Rename Workspace", workspace.name);
    if (nextName?.trim()) {
      onRenameWorkspace(workspace.id, nextName.trim());
    }
  }

  function deleteWorkspace(workspace: WorkspaceNavigationItem) {
    if (window.confirm(`Delete workspace "${workspace.name}"?`)) {
      onDeleteWorkspace(workspace.id);
    }
  }

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
          {workspaces.map((workspace) => {
            const active = activeSurface === "workspace" && activeWorkspaceId === workspace.id;

            return (
              <div
                key={workspace.id}
                draggable
                onDragStart={() => setDraggedWorkspaceId(workspace.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedWorkspaceId) {
                    onReorderWorkspace(draggedWorkspaceId, workspace.id);
                  }
                  setDraggedWorkspaceId(null);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenuWorkspaceId(workspace.id);
                }}
                className="group/workspace flex items-center gap-1 rounded-lg"
              >
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
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => renameWorkspace(workspace)}>
                      Rename Workspace
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => deleteWorkspace(workspace)}>
                      Delete Workspace
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
