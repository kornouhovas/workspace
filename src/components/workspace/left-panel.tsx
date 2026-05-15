import {
  FolderKanbanIcon,
  PanelLeftIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from "@/lib/lucide-icons";
import { cn } from "@/lib/utils";

type WorkspaceLeftPanelProps = {
  readonly activeSurface: "workspace" | "settings";
  readonly collapsed: boolean;
  readonly searchQuery: string;
  readonly onToggleCollapsed: () => void;
  readonly onSearchQueryChange: (searchQuery: string) => void;
  readonly onWorkspaceOpen: () => void;
  readonly onOpenSettings: () => void;
};

export function WorkspaceLeftPanel({
  activeSurface,
  collapsed,
  searchQuery,
  onToggleCollapsed,
  onSearchQueryChange,
  onWorkspaceOpen,
  onOpenSettings,
}: WorkspaceLeftPanelProps) {
  return (
    <aside className={cn(
      "flex h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-150",
      collapsed ? "w-16" : "w-72",
    )}>
      <div className="electron-window-drag flex min-h-16 items-end px-3 pb-3 pt-7">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
          <FolderKanbanIcon className="size-4" aria-hidden="true" />
          {!collapsed ? <span className="truncate">Workspace Project Board</span> : null}
        </div>
        <button
          type="button"
          className="electron-window-no-drag inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
        >
          <PanelLeftIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="electron-window-no-drag flex flex-1 flex-col gap-3 px-3 py-3">
        <button
          type="button"
          className={cn(
            "inline-flex h-8 w-full items-center gap-2 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90",
            collapsed ? "justify-center" : "justify-start",
          )}
          title="Add Workspace"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          {!collapsed ? "Add Workspace" : null}
        </button>
        {!collapsed ? (
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
        ) : null}
        <div className="h-px bg-border" />
        <div className="grid gap-1">
          {!collapsed ? <p className="px-2 text-xs font-medium text-muted-foreground">Workspaces</p> : null}
          <button
            type="button"
            aria-current={activeSurface === "workspace" ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
              collapsed ? "justify-center" : "justify-start",
              activeSurface === "workspace" && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
            title="Operations"
            onClick={onWorkspaceOpen}
          >
            <FolderKanbanIcon className="size-4" aria-hidden="true" />
            {!collapsed ? "Operations" : null}
          </button>
        </div>
        <div className="mt-auto">
          <button
            type="button"
            aria-current={activeSurface === "settings" ? "page" : undefined}
            className={cn(
              "inline-flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
              collapsed ? "justify-center" : "justify-start",
              activeSurface === "settings" && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
            title="Settings"
            onClick={onOpenSettings}
          >
            <SettingsIcon className="size-4" aria-hidden="true" />
            {!collapsed ? "Settings" : null}
          </button>
        </div>
      </div>
    </aside>
  );
}
