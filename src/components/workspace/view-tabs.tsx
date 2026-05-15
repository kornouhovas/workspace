import { useEffect, useRef, useState } from "react";

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
  const [contextMenuViewId, setContextMenuViewId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingViewName, setEditingViewName] = useState("");
  const editingViewInputRef = useRef<HTMLInputElement | null>(null);
  const cancelViewRenameRef = useRef(false);
  const contextMenuView = views.find((view) => view.id === contextMenuViewId) || null;

  useEffect(() => {
    if (editingViewId) {
      editingViewInputRef.current?.focus();
      editingViewInputRef.current?.select();
    }
  }, [editingViewId]);

  function startRenameView(view: WorkspaceView) {
    cancelViewRenameRef.current = false;
    setContextMenuViewId(null);
    setEditingViewId(view.id);
    setEditingViewName(view.name);
  }

  function renameActiveView() {
    if (activeView) {
      startRenameView(activeView);
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

  function submitViewRename(view: WorkspaceView) {
    if (cancelViewRenameRef.current) {
      cancelViewRenameRef.current = false;
      return;
    }

    const nextName = editingViewName.trim();
    cancelViewRenameRef.current = true;
    setEditingViewId(null);
    setEditingViewName("");

    if (nextName && nextName !== view.name) {
      onRenameView(view.id, nextName);
    }
  }

  function cancelViewRename() {
    cancelViewRenameRef.current = true;
    setEditingViewId(null);
    setEditingViewName("");
  }

  function deleteView(view: WorkspaceView) {
    if (window.confirm(`Delete view "${view.name}"?`)) {
      onDeleteView(view.id);
    }
    setContextMenuViewId(null);
  }

  return (
    <div className="relative flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
      <Tabs value={activeViewId} onValueChange={onActiveViewChange} className="min-w-0">
        <TabsList variant="line" aria-label="Workspace views">
          {views.map((view) => {
            if (editingViewId === view.id) {
              return (
                <form
                  key={view.id}
                  className="h-7 min-w-32"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitViewRename(view);
                  }}
                >
                  <input
                    ref={editingViewInputRef}
                    aria-label="Rename view"
                    className="h-full w-full rounded-md border border-ring bg-background px-2 text-sm font-medium text-foreground outline-none ring-3 ring-ring/30"
                    value={editingViewName}
                    onChange={(event) => setEditingViewName(event.currentTarget.value)}
                    onBlur={() => submitViewRename(view)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelViewRename();
                      }
                    }}
                  />
                </form>
              );
            }

            return (
              <TabsTrigger
                key={view.id}
                value={view.id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenuViewId(view.id);
                  setContextMenuPosition({ x: event.clientX, y: event.clientY });
                }}
              >
                {view.name}
              </TabsTrigger>
            );
          })}
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
          <DropdownMenuContent align="end" className="min-w-44">
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
          <DropdownMenuContent align="end" className="min-w-44">
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
      {contextMenuView ? (
        <div
          className="fixed z-50 min-w-44 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
          role="menu"
          onMouseLeave={() => setContextMenuViewId(null)}
        >
          <button
            type="button"
            className="flex w-full items-center rounded-md px-2 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => startRenameView(contextMenuView)}
          >
            Rename View
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded-md px-2 py-1 text-left text-sm text-destructive hover:bg-destructive/10"
            disabled={views.length <= 1}
            onClick={() => deleteView(contextMenuView)}
          >
            Delete View
          </button>
        </div>
      ) : null}
    </div>
  );
}
