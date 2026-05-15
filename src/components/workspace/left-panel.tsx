import {
  FolderKanbanIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from "@/lib/lucide-icons";
import { cn } from "@/lib/utils";

type WorkspaceLeftPanelProps = {
  readonly activeSurface: "workspace" | "settings";
  readonly searchQuery: string;
  readonly onSearchQueryChange: (searchQuery: string) => void;
  readonly onWorkspaceOpen: () => void;
  readonly onOpenSettings: () => void;
};

export function WorkspaceLeftPanel({
  activeSurface,
  searchQuery,
  onSearchQueryChange,
  onWorkspaceOpen,
  onOpenSettings,
}: WorkspaceLeftPanelProps) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="electron-window-drag flex h-12 items-center px-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FolderKanbanIcon className="size-4" aria-hidden="true" />
          <span>Workspace Project Board</span>
        </div>
      </div>
      <div className="electron-window-no-drag flex flex-1 flex-col gap-3 px-3 py-3">
        <button
          type="button"
          className="inline-flex h-8 w-full items-center justify-start gap-2 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
          <button
            type="button"
            aria-current={activeSurface === "workspace" ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center justify-start rounded-lg px-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
              activeSurface === "workspace" && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
            onClick={onWorkspaceOpen}
          >
            Operations
          </button>
        </div>
        <div className="mt-auto">
          <button
            type="button"
            aria-current={activeSurface === "settings" ? "page" : undefined}
            className={cn(
              "inline-flex h-8 w-full items-center justify-start gap-2 rounded-lg px-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
              activeSurface === "settings" && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
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
