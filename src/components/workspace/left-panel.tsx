import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderKanbanIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  Trash2Icon,
} from "@/lib/lucide-icons";
import {
  workspaceMenuContentClassName,
  workspaceMenuDangerIconClassName,
  workspaceMenuDangerItemClassName,
  workspaceMenuIconClassName,
  workspaceMenuItemClassName,
  workspaceMenuSeparatorClassName,
} from "@/components/workspace/menu-styles";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type WorkspaceNavigationItem = {
  readonly id: string;
  readonly name: string;
};

type WorkspaceLeftPanelProps = {
  readonly collapsed?: boolean;
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

type WorkspaceDragPreviewRow = {
  readonly workspaceId: string;
  readonly top: number;
  readonly height: number;
};

type WorkspacePointerDragState = {
  readonly workspaceId: string;
  readonly startY: number;
  readonly currentY: number;
  readonly dropIndex: number;
  readonly rows: readonly WorkspaceDragPreviewRow[];
};

function getWorkspaceDragOrder(
  orderedWorkspaceIds: readonly string[],
  sourceWorkspaceId: string,
  dropIndex: number,
) {
  const remainingWorkspaceIds = orderedWorkspaceIds.filter((workspaceId) => workspaceId !== sourceWorkspaceId);
  const boundedDropIndex = Math.min(Math.max(dropIndex, 0), remainingWorkspaceIds.length);
  return [
    ...remainingWorkspaceIds.slice(0, boundedDropIndex),
    sourceWorkspaceId,
    ...remainingWorkspaceIds.slice(boundedDropIndex),
  ];
}

export function WorkspaceLeftPanel({
  collapsed = false,
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
  const { t } = useI18n();
  const [workspaceDragState, setWorkspaceDragState] = useState<WorkspacePointerDragState | null>(null);
  const [contextMenuWorkspaceId, setContextMenuWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState("");
  const editingWorkspaceInputRef = useRef<HTMLInputElement | null>(null);
  const cancelWorkspaceRenameRef = useRef(false);
  const suppressWorkspaceClickRef = useRef<string | null>(null);

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
    if (window.confirm(t("confirm.deleteWorkspace", { name: workspace.name }))) {
      onDeleteWorkspace(workspace.id);
    }
  }

  function getWorkspaceDragPreviewRows() {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-workspace-row-id]"))
      .map((row) => {
        const workspaceId = row.dataset.workspaceRowId;
        const rect = row.getBoundingClientRect();

        if (!workspaceId) {
          return null;
        }

        return {
          workspaceId,
          top: rect.top,
          height: rect.height,
        };
      })
      .filter((row): row is WorkspaceDragPreviewRow => row !== null);
  }

  function findWorkspaceDragTarget(clientY: number, rows: readonly WorkspaceDragPreviewRow[]) {
    let dropIndex = 0;

    for (const row of rows) {
      if (clientY >= row.top + row.height / 2) {
        dropIndex += 1;
      }
    }

    return dropIndex;
  }

  function findWorkspaceDropIndex(
    clientY: number,
    rows: readonly WorkspaceDragPreviewRow[],
    sourceWorkspaceId: string,
  ) {
    return findWorkspaceDragTarget(
      clientY,
      rows.filter((row) => row.workspaceId !== sourceWorkspaceId),
    );
  }

  function getWorkspaceDragTops(
    orderedWorkspaceIds: readonly string[],
    rows: readonly WorkspaceDragPreviewRow[],
  ) {
    const tops = new Map<string, number>();

    orderedWorkspaceIds.forEach((workspaceId, index) => {
      const row = rows[index];
      if (row) {
        tops.set(workspaceId, row.top);
      }
    });

    return tops;
  }

  function getWorkspaceDragStyle(workspaceId: string): CSSProperties | undefined {
    if (!workspaceDragState) {
      return undefined;
    }

    const orderedWorkspaceIds = workspaces.map((workspace) => workspace.id);
    const currentRow = workspaceDragState.rows.find((row) => row.workspaceId === workspaceId);

    if (!currentRow || !orderedWorkspaceIds.includes(workspaceId)) {
      return undefined;
    }

    if (workspaceId === workspaceDragState.workspaceId) {
      return {
        transform: `translateY(${workspaceDragState.currentY - workspaceDragState.startY}px)`,
        transitionDuration: "0ms",
        zIndex: 30,
      };
    }

    const previewOrder = getWorkspaceDragOrder(
      orderedWorkspaceIds,
      workspaceDragState.workspaceId,
      workspaceDragState.dropIndex,
    );
    const previewTops = getWorkspaceDragTops(previewOrder, workspaceDragState.rows);
    const previewTop = previewTops.get(workspaceId);

    if (previewTop === undefined) {
      return undefined;
    }

    const offset = previewTop - currentRow.top;

    if (Math.abs(offset) < 0.5) {
      return undefined;
    }

    return {
      transform: `translateY(${offset}px)`,
      transitionDuration: "180ms",
    };
  }

  function startPointerWorkspaceDrag(event: ReactPointerEvent<HTMLButtonElement>, workspaceId: string) {
    if (event.button !== 0 || editingWorkspaceId === workspaceId) {
      return;
    }

    event.stopPropagation();

    const workspaceDragPreviewRows = getWorkspaceDragPreviewRows();
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    let frameId = 0;
    let pendingClientY = event.clientY;
    let moved = false;

    setContextMenuWorkspaceId(null);
    setWorkspaceDragState({
      workspaceId,
      startY: event.clientY,
      currentY: event.clientY,
      dropIndex: findWorkspaceDropIndex(event.clientY, workspaceDragPreviewRows, workspaceId),
      rows: workspaceDragPreviewRows,
    });

    function updateDraggedWorkspace() {
      frameId = 0;

      const dropIndex = findWorkspaceDropIndex(
        pendingClientY,
        workspaceDragPreviewRows,
        workspaceId,
      );

      setWorkspaceDragState((currentDrag) => {
        if (!currentDrag || currentDrag.workspaceId !== workspaceId) {
          return currentDrag;
        }

        return {
          ...currentDrag,
          currentY: pendingClientY,
          dropIndex,
        };
      });
    }

    function moveWorkspace(pointerEvent: PointerEvent) {
      pendingClientY = pointerEvent.clientY;
      moved ||= Math.abs(pointerEvent.clientY - event.clientY) > 4;

      if (frameId === 0) {
        frameId = window.requestAnimationFrame(updateDraggedWorkspace);
      }
    }

    function finishWorkspaceDrag(pointerEvent: PointerEvent) {
      const dropIndex = findWorkspaceDropIndex(
        pointerEvent.clientY,
        workspaceDragPreviewRows,
        workspaceId,
      );
      const orderedWorkspaceIds = workspaceDragPreviewRows.map((row) => row.workspaceId);
      const nextWorkspaceIds = getWorkspaceDragOrder(orderedWorkspaceIds, workspaceId, dropIndex);

      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", moveWorkspace);
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointerup", finishWorkspaceDrag);
      setWorkspaceDragState(null);

      if (moved) {
        suppressWorkspaceClickRef.current = workspaceId;
        window.setTimeout(() => {
          if (suppressWorkspaceClickRef.current === workspaceId) {
            suppressWorkspaceClickRef.current = null;
          }
        }, 0);

        if (nextWorkspaceIds.join("\0") !== workspaces.map((workspace) => workspace.id).join("\0")) {
          onReorderWorkspaces(nextWorkspaceIds);
        }
      }
    }

    window.addEventListener("pointermove", moveWorkspace);
    window.addEventListener("pointerup", finishWorkspaceDrag, { once: true });
  }

  function openWorkspace(workspaceId: string) {
    if (suppressWorkspaceClickRef.current === workspaceId) {
      suppressWorkspaceClickRef.current = null;
      return;
    }

    onWorkspaceOpen(workspaceId);
  }

  return (
    <aside className="workspace-sidebar flex h-full w-80 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className={`mr-12 min-h-[3.75rem] pt-7 ${collapsed ? "" : "electron-window-drag"}`} />
      <div className="electron-window-no-drag flex min-h-0 flex-1 flex-col gap-3.5 pl-[22px] pr-[14px] pb-12 pt-2">
        <button
          type="button"
          className="inline-flex h-11 w-full items-center justify-start gap-3 rounded-lg border border-border bg-card px-3.5 text-base font-medium text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          title={t("sidebar.addWorkspace")}
          onClick={onAddWorkspace}
        >
          <PlusIcon className="size-5" aria-hidden="true" />
          {t("sidebar.addWorkspace")}
        </button>
        <label className="grid gap-1 text-xs text-muted-foreground">
          <span className="sr-only">{t("sidebar.search")}</span>
          <span className="relative block">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-11 w-full rounded-lg border border-input bg-card pl-12 pr-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
              placeholder={t("sidebar.searchPlaceholder")}
              type="search"
            />
          </span>
        </label>
        <div className="h-px bg-border" />
        <div className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto">
          <p className="px-1 text-sm font-medium text-muted-foreground">{t("sidebar.workspaces")}</p>
          {workspaces.map((workspace) => {
            const active = activeSurface === "workspace" && activeWorkspaceId === workspace.id;
            const editing = editingWorkspaceId === workspace.id;

            return (
              <div
                key={workspace.id}
                data-workspace-row-id={workspace.id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenuWorkspaceId(workspace.id);
                }}
                className={cn(
                  "group/workspace relative flex items-center gap-1 rounded-lg transition-colors duration-100",
                  active && "bg-sidebar-accent",
                  workspaceDragState && "transition-transform ease-out",
                )}
                style={getWorkspaceDragStyle(workspace.id)}
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
                      aria-label={t("sidebar.renameWorkspaceInput")}
                      className="h-11 w-full rounded-lg border border-ring bg-background px-3 text-base text-foreground outline-none ring-3 ring-ring/30"
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
                        "inline-flex h-11 min-w-0 flex-1 cursor-grab items-center justify-start gap-2 rounded-md px-[22px] text-base text-sidebar-foreground hover:bg-sidebar-accent active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        active && "text-sidebar-accent-foreground",
                      )}
                      title={workspace.name}
                      onPointerDown={(event) => startPointerWorkspaceDrag(event, workspace.id)}
                      onClick={() => openWorkspace(workspace.id)}
                    >
                      <FolderKanbanIcon className={cn("size-5 shrink-0", active && "text-primary")} aria-hidden="true" />
                      <span className="truncate">{workspace.name}</span>
                    </button>
                    <DropdownMenu
                      open={contextMenuWorkspaceId === workspace.id}
                      onOpenChange={(open) => setContextMenuWorkspaceId(open ? workspace.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover/workspace:opacity-100 data-open:opacity-100", active && "opacity-100")}
                          aria-label={t("sidebar.workspaceActions", { name: workspace.name })}
                          title={t("sidebar.workspaceActions", { name: workspace.name })}
                        >
                          <MoreHorizontalIcon className="size-5" aria-hidden="true" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={cn(workspaceMenuContentClassName, "min-w-52")}>
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            className={workspaceMenuItemClassName}
                            onSelect={() => startRenameWorkspace(workspace)}
                          >
                            <PencilIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                            {t("sidebar.renameWorkspace")}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator className={workspaceMenuSeparatorClassName} />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            className={workspaceMenuDangerItemClassName}
                            variant="destructive"
                            onSelect={() => deleteWorkspace(workspace)}
                          >
                            <Trash2Icon className={workspaceMenuDangerIconClassName} aria-hidden="true" />
                            {t("sidebar.deleteWorkspace")}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="shrink-0 pt-2">
          <button
            type="button"
            aria-current={activeSurface === "settings" ? "page" : undefined}
            className={cn(
              "inline-flex h-11 w-full items-center justify-start gap-2 rounded-lg px-[22px] text-base text-sidebar-foreground hover:bg-sidebar-accent",
              activeSurface === "settings" && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
            title={t("sidebar.settings")}
            onClick={onOpenSettings}
          >
            <SettingsIcon className="size-5" aria-hidden="true" />
            {t("sidebar.settings")}
          </button>
        </div>
      </div>
    </aside>
  );
}
