import { useEffect, useRef, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceViewFilterMenu } from "@/components/workspace/view-filter-menu";
import { MoreHorizontalIcon, PlusIcon } from "@/lib/lucide-icons";
import type {
  WorkspacePropertyDefinitionState,
  WorkspaceProjectionResponse,
  WorkspaceSelectValueState,
  WorkspaceViewState,
} from "@/workspaceAppState";

type WorkspaceView = WorkspaceViewState;

type WorkspaceViewTabsProps = {
  readonly activeViewId: string;
  readonly views: readonly WorkspaceView[];
  readonly onActiveViewChange: (viewId: string) => void;
  readonly onCreateView: (viewType: "board" | "table") => void;
  readonly onRenameView: (viewId: string, name: string) => void;
  readonly onDeleteView: (viewId: string) => void;
  readonly dismissSignal?: number;
  readonly properties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly statusValues: WorkspaceProjectionResponse["statusValues"];
  readonly onTogglePropertyVisibility: (propertyId: string, visible: boolean) => void;
  readonly onToggleValueFilter: (propertyId: string, valueId: string, included: boolean) => void;
  readonly onRenameProperty: (propertyId: string, name: string) => void;
  readonly onDeleteProperty: (propertyId: string) => void;
};

export function WorkspaceViewTabs({
  activeViewId,
  views,
  onActiveViewChange,
  onCreateView,
  onRenameView,
  onDeleteView,
  dismissSignal,
  properties,
  selectValues,
  statusValues,
  onTogglePropertyVisibility,
  onToggleValueFilter,
  onRenameProperty,
  onDeleteProperty,
}: WorkspaceViewTabsProps) {
  const activeView = views.find((view) => view.id === activeViewId) || views[0] || null;
  const [contextMenuViewId, setContextMenuViewId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingViewName, setEditingViewName] = useState("");
  const [openCreateViewMenu, setOpenCreateViewMenu] = useState(false);
  const [openViewActionsMenu, setOpenViewActionsMenu] = useState(false);
  const editingViewInputRef = useRef<HTMLInputElement | null>(null);
  const cancelViewRenameRef = useRef(false);
  const contextMenuView = views.find((view) => view.id === contextMenuViewId) || null;

  useEffect(() => {
    if (editingViewId) {
      editingViewInputRef.current?.focus();
      editingViewInputRef.current?.select();
    }
  }, [editingViewId]);

  useEffect(() => {
    setContextMenuViewId(null);
    setOpenCreateViewMenu(false);
    setOpenViewActionsMenu(false);
  }, [dismissSignal]);

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
    <div className="relative flex min-w-0 items-center justify-between gap-4 px-4 py-3">
      <Tabs value={activeViewId} onValueChange={onActiveViewChange} className="min-w-0 overflow-hidden">
        <TabsList
          aria-label="Workspace views"
          className="max-w-full justify-start overflow-x-auto rounded-xl bg-muted/80 p-0.5 ring-1 ring-border/40 group-data-horizontal/tabs:!h-9"
        >
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
                    className="h-full w-full rounded-lg border border-ring bg-background px-2.5 text-sm font-medium text-foreground outline-none ring-2 ring-ring/30"
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
                className="h-7 flex-none rounded-lg px-2.5 text-sm font-medium text-muted-foreground data-active:border-border data-active:bg-background data-active:text-foreground dark:data-active:border-border dark:data-active:bg-background/60"
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
      <div className="flex shrink-0 items-center gap-2">
        <WorkspaceViewFilterMenu
          view={activeView}
          dismissSignal={dismissSignal}
          properties={properties}
          selectValues={selectValues}
          statusValues={statusValues}
          onTogglePropertyVisibility={onTogglePropertyVisibility}
          onToggleValueFilter={onToggleValueFilter}
          onRenameProperty={onRenameProperty}
          onDeleteProperty={onDeleteProperty}
        />
        <DropdownMenu open={openCreateViewMenu} onOpenChange={setOpenCreateViewMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label="Add Board or Table view"
              title="Add view"
            >
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              <span>Add View</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onSelect={() => onCreateView("board")}>New Board View</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCreateView("table")}>New Table View</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu open={openViewActionsMenu} onOpenChange={setOpenViewActionsMenu}>
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
