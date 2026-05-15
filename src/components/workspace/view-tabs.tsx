import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontalIcon, PlusIcon } from "@/lib/lucide-icons";

type WorkspaceView = {
  readonly id: string;
  readonly name: string;
  readonly viewType: string;
};

type WorkspaceViewTabsProps = {
  readonly activeViewId: string;
  readonly views: readonly WorkspaceView[];
  readonly onActiveViewChange: (viewId: string) => void;
  readonly onCreateView: (viewType: "board" | "table") => void;
  readonly onRenameView: (viewId: string, name: string) => void;
  readonly onDeleteView: (viewId: string) => void;
};

export function WorkspaceViewTabs({
  activeViewId,
  views,
  onActiveViewChange,
  onCreateView,
  onRenameView,
  onDeleteView,
}: WorkspaceViewTabsProps) {
  const activeView = views.find((view) => view.id === activeViewId) || views[0] || null;

  function renameActiveView() {
    if (!activeView) {
      return;
    }

    const nextName = window.prompt("Rename View", activeView.name);
    if (nextName?.trim()) {
      onRenameView(activeView.id, nextName.trim());
    }
  }

  function deleteActiveView() {
    if (!activeView) {
      return;
    }

    if (window.confirm(`Delete view "${activeView.name}"?`)) {
      onDeleteView(activeView.id);
    }
  }

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
      <Tabs value={activeViewId} onValueChange={onActiveViewChange} className="min-w-0">
        <TabsList variant="line" aria-label="Workspace views">
          {views.map((view) => (
            <TabsTrigger key={view.id} value={view.id} className="capitalize">
              {view.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex shrink-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Add Board or Table view"
              title="Add view"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onCreateView("board")}>New Board View</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCreateView("table")}>New Table View</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="View actions"
              title="View actions"
            >
              <MoreHorizontalIcon className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!activeView} onSelect={renameActiveView}>
              Rename View
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!activeView || views.length <= 1} variant="destructive" onSelect={deleteActiveView}>
              Delete View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
