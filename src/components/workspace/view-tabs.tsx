import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceViewFilterMenu } from "@/components/workspace/view-filter-menu";
import { useI18n } from "@/i18n";
import {
  KanbanIcon,
  PencilIcon,
  PlusIcon,
  TableIcon,
  Trash2Icon,
} from "@/lib/lucide-icons";
import {
  workspaceMenuContentClassName,
  workspaceMenuDangerIconClassName,
  workspaceMenuDangerItemClassName,
  workspaceMenuIconClassName,
  workspaceMenuItemClassName,
  workspaceMenuLabelClassName,
} from "@/components/workspace/menu-styles";
import {
  blockOutsideWorkspaceMenuPointerDown,
  isWorkspaceMenuSurfaceTarget,
} from "@/components/workspace/menu-dismissal";
import type {
  WorkspacePropertyDefinitionState,
  WorkspaceProjectionResponse,
  WorkspaceSelectValueState,
  WorkspaceViewState,
} from "@/workspaceAppState";

type WorkspaceView = WorkspaceViewState;

type WorkspaceViewTabsProps = {
  readonly actionsHidden?: boolean;
  readonly projectTabs?: ReactNode;
  readonly projectActive?: boolean;
  readonly onShowView?: () => void;
  readonly activeViewId: string;
  readonly views: readonly WorkspaceView[];
  readonly onActiveViewChange: (viewId: string) => void;
  readonly onCreateView: (viewType: "board" | "table") => void;
  readonly onDuplicateView: (viewId: string) => void;
  readonly onRenameView: (viewId: string, name: string) => void;
  readonly onDeleteView: (viewId: string) => void;
  readonly onReorderViews: (orderedViewIds: readonly string[]) => void;
  readonly dismissSignal?: number;
  readonly properties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly statusValues: WorkspaceProjectionResponse["statusValues"];
  readonly onTogglePropertyVisibility: (propertyId: string, visible: boolean) => void;
  readonly onToggleValueFilter: (propertyId: string, valueId: string, included: boolean) => void;
  readonly boardColumnWidthMax: number;
  readonly onBoardColumnWidthPreview: (columnWidth: number) => void;
  readonly onBoardColumnWidthCommit: (columnWidth: number, previousColumnWidth: number) => void;
  readonly onReorderViewProperties: (orderedPropertyIds: readonly string[]) => void;
  readonly onRenameProperty: (propertyId: string, name: string) => void;
  readonly onDeleteProperty: (propertyId: string) => void;
};

type ViewTabDragPreviewItem = {
  readonly viewId: string;
  readonly left: number;
  readonly width: number;
};

type ViewTabPointerDragState = {
  readonly viewId: string;
  readonly startX: number;
  readonly currentX: number;
  readonly dropIndex: number;
  readonly tabs: readonly ViewTabDragPreviewItem[];
};

const viewContextMenuSurfaceSelector = "[data-workspace-view-context-menu='true']";
const viewDropdownMenuSurfaceSelector =
  "[data-workspace-view-create-menu='true']";

function renderViewIcon(view: WorkspaceView) {
  const iconClassName = "size-3.5 shrink-0";

  if (view.viewType === "table") {
    return <TableIcon className={iconClassName} aria-hidden="true" />;
  }

  return <KanbanIcon className={iconClassName} aria-hidden="true" />;
}

function getViewTabDragOrder(
  orderedViewIds: readonly string[],
  sourceViewId: string,
  dropIndex: number,
) {
  const remainingViewIds = orderedViewIds.filter((viewId) => viewId !== sourceViewId);
  const boundedDropIndex = Math.min(Math.max(dropIndex, 0), remainingViewIds.length);

  return [
    ...remainingViewIds.slice(0, boundedDropIndex),
    sourceViewId,
    ...remainingViewIds.slice(boundedDropIndex),
  ];
}

function isViewContextMenuTarget(target: EventTarget | null) {
  return isWorkspaceMenuSurfaceTarget(target, viewContextMenuSurfaceSelector);
}

export function WorkspaceViewTabs({
  actionsHidden = false,
  projectTabs,
  projectActive = false,
  onShowView,
  activeViewId,
  views,
  onActiveViewChange,
  onCreateView,
  onDuplicateView,
  onRenameView,
  onDeleteView,
  onReorderViews,
  dismissSignal,
  properties,
  selectValues,
  statusValues,
  onTogglePropertyVisibility,
  onToggleValueFilter,
  boardColumnWidthMax,
  onBoardColumnWidthPreview,
  onBoardColumnWidthCommit,
  onReorderViewProperties,
  onRenameProperty,
  onDeleteProperty,
}: WorkspaceViewTabsProps) {
  const { t } = useI18n();
  const activeView = views.find((view) => view.id === activeViewId) || views[0] || null;
  const [viewTabDragState, setViewTabDragState] = useState<ViewTabPointerDragState | null>(null);
  const [contextMenuViewId, setContextMenuViewId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingViewName, setEditingViewName] = useState("");
  const [openCreateViewMenu, setOpenCreateViewMenu] = useState(false);
  const editingViewInputRef = useRef<HTMLInputElement | null>(null);
  const cancelViewRenameRef = useRef(false);
  const suppressViewClickRef = useRef<string | null>(null);
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
    setViewTabDragState(null);
    suppressViewClickRef.current = null;
  }, [dismissSignal]);

  useEffect(() => {
    if (!contextMenuViewId) {
      return undefined;
    }

    function closeViewContextMenuOnOutsidePointerDown(event: PointerEvent) {
      blockOutsideWorkspaceMenuPointerDown(event, viewContextMenuSurfaceSelector, () => {
        setContextMenuViewId(null);
      });
    }

    function closeViewContextMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenuViewId(null);
      }
    }

    document.addEventListener("pointerdown", closeViewContextMenuOnOutsidePointerDown, true);
    document.addEventListener("keydown", closeViewContextMenuOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeViewContextMenuOnOutsidePointerDown, true);
      document.removeEventListener("keydown", closeViewContextMenuOnEscape);
    };
  }, [contextMenuViewId]);

  useEffect(() => {
    if (!openCreateViewMenu) {
      return undefined;
    }

    function closeViewDropdownMenusOnOutsidePointerDown(event: PointerEvent) {
      blockOutsideWorkspaceMenuPointerDown(event, viewDropdownMenuSurfaceSelector, () => {
        setOpenCreateViewMenu(false);
      });
    }

    document.addEventListener("pointerdown", closeViewDropdownMenusOnOutsidePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", closeViewDropdownMenusOnOutsidePointerDown, true);
    };
  }, [openCreateViewMenu]);

  function startRenameView(view: WorkspaceView) {
    cancelViewRenameRef.current = false;
    setContextMenuViewId(null);
    setEditingViewId(view.id);
    setEditingViewName(view.name);
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
    if (window.confirm(t("confirm.deleteView", { name: view.name }))) {
      onDeleteView(view.id);
    }
    setContextMenuViewId(null);
  }

  function getViewTabDragPreviewItems() {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-view-tab-id]"))
      .map((tab) => {
        const viewId = tab.dataset.viewTabId;
        const rect = tab.getBoundingClientRect();

        if (!viewId) {
          return null;
        }

        return {
          viewId,
          left: rect.left,
          width: rect.width,
        };
      })
      .filter((tab): tab is ViewTabDragPreviewItem => tab !== null);
  }

  function findViewTabDragTarget(clientX: number, tabs: readonly ViewTabDragPreviewItem[]) {
    let dropIndex = 0;

    for (const tab of tabs) {
      if (clientX >= tab.left + tab.width / 2) {
        dropIndex += 1;
      }
    }

    return dropIndex;
  }

  function findViewTabDropIndex(
    clientX: number,
    tabs: readonly ViewTabDragPreviewItem[],
    sourceViewId: string,
  ) {
    return findViewTabDragTarget(
      clientX,
      tabs.filter((tab) => tab.viewId !== sourceViewId),
    );
  }

  function getViewTabDragLefts(
    orderedViewIds: readonly string[],
    tabs: readonly ViewTabDragPreviewItem[],
  ) {
    const lefts = new Map<string, number>();

    orderedViewIds.forEach((viewId, index) => {
      const tab = tabs[index];
      if (tab) {
        lefts.set(viewId, tab.left);
      }
    });

    return lefts;
  }

  function getViewTabDragStyle(viewId: string): CSSProperties | undefined {
    if (!viewTabDragState) {
      return undefined;
    }

    const orderedViewIds = views.map((view) => view.id);
    const currentTab = viewTabDragState.tabs.find((tab) => tab.viewId === viewId);

    if (!currentTab || !orderedViewIds.includes(viewId)) {
      return undefined;
    }

    if (viewId === viewTabDragState.viewId) {
      return {
        transform: `translateX(${viewTabDragState.currentX - viewTabDragState.startX}px)`,
        transitionDuration: "0ms",
        zIndex: 30,
      };
    }

    const previewOrder = getViewTabDragOrder(
      orderedViewIds,
      viewTabDragState.viewId,
      viewTabDragState.dropIndex,
    );
    const previewLefts = getViewTabDragLefts(previewOrder, viewTabDragState.tabs);
    const previewLeft = previewLefts.get(viewId);

    if (previewLeft === undefined) {
      return undefined;
    }

    const offset = previewLeft - currentTab.left;

    if (Math.abs(offset) < 0.5) {
      return undefined;
    }

    return {
      transform: `translateX(${offset}px)`,
      transitionDuration: "180ms",
    };
  }

  function startPointerViewTabDrag(event: ReactPointerEvent<HTMLButtonElement>, viewId: string) {
    if (event.button !== 0 || editingViewId === viewId) {
      return;
    }

    const viewTabDragPreviewItems = getViewTabDragPreviewItems();
    if (viewTabDragPreviewItems.length <= 1) {
      return;
    }

    event.stopPropagation();

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    let frameId = 0;
    let pendingClientX = event.clientX;
    let moved = false;

    setContextMenuViewId(null);
    setOpenCreateViewMenu(false);
    setViewTabDragState({
      viewId,
      startX: event.clientX,
      currentX: event.clientX,
      dropIndex: findViewTabDropIndex(event.clientX, viewTabDragPreviewItems, viewId),
      tabs: viewTabDragPreviewItems,
    });

    function updateDraggedViewTab() {
      frameId = 0;

      const dropIndex = findViewTabDropIndex(
        pendingClientX,
        viewTabDragPreviewItems,
        viewId,
      );

      setViewTabDragState((currentDrag) => {
        if (!currentDrag || currentDrag.viewId !== viewId) {
          return currentDrag;
        }

        return {
          ...currentDrag,
          currentX: pendingClientX,
          dropIndex,
        };
      });
    }

    function moveViewTab(pointerEvent: PointerEvent) {
      pendingClientX = pointerEvent.clientX;
      moved ||= Math.abs(pointerEvent.clientX - event.clientX) > 4;

      if (frameId === 0) {
        frameId = window.requestAnimationFrame(updateDraggedViewTab);
      }
    }

    function finishViewTabDrag(pointerEvent: PointerEvent) {
      const dropIndex = findViewTabDropIndex(
        pointerEvent.clientX,
        viewTabDragPreviewItems,
        viewId,
      );
      const orderedViewIds = viewTabDragPreviewItems.map((tab) => tab.viewId);
      const nextViewIds = getViewTabDragOrder(orderedViewIds, viewId, dropIndex);

      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", moveViewTab);
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointerup", finishViewTabDrag);
      setViewTabDragState(null);

      if (!moved) {
        return;
      }

      suppressViewClickRef.current = viewId;
      window.setTimeout(() => {
        if (suppressViewClickRef.current === viewId) {
          suppressViewClickRef.current = null;
        }
      }, 0);

      if (nextViewIds.join("\0") !== views.map((view) => view.id).join("\0")) {
        onReorderViews(nextViewIds);
      }
    }

    window.addEventListener("pointermove", moveViewTab);
    window.addEventListener("pointerup", finishViewTabDrag, { once: true });
  }

  function handleViewTabClick(event: ReactMouseEvent<HTMLButtonElement>, viewId: string) {
    if (suppressViewClickRef.current !== viewId) {
      onShowView?.();
      return;
    }

    suppressViewClickRef.current = null;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div className="relative flex min-w-0 items-center justify-between gap-2">
      <div className="relative z-40 flex min-w-0 flex-1 items-center gap-3">
      <Tabs value={projectActive ? "" : activeViewId} onValueChange={onActiveViewChange} className="min-w-0 max-w-[50%] shrink-0 overflow-hidden">
        <TabsList
          aria-label={t("view.actions")}
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
                    aria-label={t("view.renameInput")}
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
                data-view-tab-id={view.id}
                className={[
                  "h-7 flex-none cursor-grab rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-transform ease-out active:cursor-grabbing data-active:border-border data-active:bg-background data-active:text-foreground dark:data-active:border-border dark:data-active:bg-background/60",
                ].join(" ")}
                style={getViewTabDragStyle(view.id)}
                onPointerDown={(event) => startPointerViewTabDrag(event, view.id)}
                onClick={(event) => handleViewTabClick(event, view.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenuViewId(view.id);
                  setContextMenuPosition({ x: event.clientX, y: event.clientY });
                }}
              >
                {renderViewIcon(view)}
                <span className="truncate">{view.name}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      {projectTabs}
      </div>
      <div aria-hidden={actionsHidden || undefined} inert={actionsHidden || undefined} className={`flex shrink-0 items-center gap-0.5 ${actionsHidden ? "invisible" : ""}`}>
        <WorkspaceViewFilterMenu
          view={activeView}
          dismissSignal={dismissSignal}
          properties={properties}
          selectValues={selectValues}
          statusValues={statusValues}
          boardColumnWidthMax={boardColumnWidthMax}
          onTogglePropertyVisibility={onTogglePropertyVisibility}
          onToggleValueFilter={onToggleValueFilter}
          onBoardColumnWidthPreview={onBoardColumnWidthPreview}
          onBoardColumnWidthCommit={onBoardColumnWidthCommit}
          onReorderViewProperties={onReorderViewProperties}
          onRenameProperty={onRenameProperty}
          onDeleteProperty={onDeleteProperty}
        />
        <DropdownMenu open={openCreateViewMenu} onOpenChange={setOpenCreateViewMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("view.addAria")}
              title={t("view.add")}
            >
              <PlusIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-workspace-view-create-menu="true"
            align="end"
            className={`${workspaceMenuContentClassName} min-w-56`}
          >
            <DropdownMenuLabel className={workspaceMenuLabelClassName}>{t("view.add")}</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem className={workspaceMenuItemClassName} onSelect={() => onCreateView("board")}>
                <KanbanIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                {t("view.newBoard")}
              </DropdownMenuItem>
              <DropdownMenuItem className={workspaceMenuItemClassName} onSelect={() => onCreateView("table")}>
                <TableIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                {t("view.newTable")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {contextMenuView ? (
        <div
          data-workspace-view-context-menu="true"
          className={`fixed z-50 min-w-56 ${workspaceMenuContentClassName}`}
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
          role="menu"
        >
          <button
            type="button"
            className={workspaceMenuItemClassName}
            onClick={() => {
              onDuplicateView(contextMenuView.id);
              setContextMenuViewId(null);
            }}
          >
            <PlusIcon className={workspaceMenuIconClassName} aria-hidden="true" />
            {t("detail.duplicateTab")}
          </button>
          <button
            type="button"
            className={workspaceMenuItemClassName}
            onClick={() => startRenameView(contextMenuView)}
          >
            <PencilIcon className={workspaceMenuIconClassName} aria-hidden="true" />
            {t("view.rename")}
          </button>
          <button
            type="button"
            className={workspaceMenuDangerItemClassName}
            disabled={views.length <= 1}
            onClick={() => deleteView(contextMenuView)}
          >
            <Trash2Icon className={workspaceMenuDangerIconClassName} aria-hidden="true" />
            {t("view.delete")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
