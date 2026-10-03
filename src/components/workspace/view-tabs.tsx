import { createPortal } from "react-dom";
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
  Columns2Icon,
  KanbanIcon,
  PencilIcon,
  PlusIcon,
  CopyIcon,
  TableIcon,
  Trash2Icon,
} from "@/lib/workspace-icons";
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
  readonly actionsDisabled?: boolean;
  readonly pendingViewId?: string | null;
  readonly projectActions?: ReactNode;
  readonly projectTabs?: ReactNode;
  readonly projectActive?: boolean;
  readonly onShowView?: () => void;
  readonly activeViewId: string;
  readonly views: readonly WorkspaceView[];
  readonly onActiveViewChange: (viewId: string) => void;
  readonly onCreateView: (viewType: "board" | "table") => void;
  readonly onDuplicateView: (viewId: string) => void;
  readonly onRenameView: (viewId: string, name: string) => boolean | void | Promise<boolean | void>;
  readonly onDeleteView: (viewId: string) => void;
  readonly onReorderViews: (orderedViewIds: readonly string[]) => void;
  readonly dismissSignal?: number;
  readonly properties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly statusValues: WorkspaceProjectionResponse["statusValues"];
  readonly onTogglePropertyVisibility: (propertyId: string, visible: boolean) => void;
  readonly onToggleValueFilter: (propertyId: string, valueId: string, included: boolean) => void;
  readonly onToggleColumnVisibility?: (statusValueId: string, visible: boolean) => void;
  readonly boardColumnWidthMax: number;
  readonly onBoardColumnWidthPreview: (columnWidth: number) => void;
  readonly onBoardColumnWidthCommit: (columnWidth: number, previousColumnWidth: number) => void;
  readonly onReorderViewProperties: (orderedPropertyIds: readonly string[]) => void;
  readonly onRenameProperty: (propertyId: string, name: string) => void;
  readonly onDeleteProperty: (propertyId: string) => void;
  readonly groupOptions?: readonly import("@/workspaceAppState").WorkspaceTableGroup[];
  readonly onGroupingChange?: (mutation: import("@/workspaceGroupingMutations").GroupingMutation) => void;
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
  const iconClassName = "size-4 shrink-0";

  if (view.viewType === "table") {
    return <TableIcon className={iconClassName} aria-hidden="true" />;
  }

  return <Columns2Icon className={iconClassName} aria-hidden="true" />;
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
  actionsDisabled = false,
  pendingViewId,
  projectActions,
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
  onToggleColumnVisibility,
  onBoardColumnWidthPreview,
  onBoardColumnWidthCommit,
  onReorderViewProperties,
  onRenameProperty,
  onDeleteProperty,
  groupOptions = [],
  onGroupingChange,
}: WorkspaceViewTabsProps) {
  const { t } = useI18n();
  const activeView = views.find((view) => view.id === activeViewId) || views[0] || null;
  const actionsDisabledRef = useRef(actionsDisabled);
  actionsDisabledRef.current = actionsDisabled;
  const [viewTabDragState, setViewTabDragState] = useState<ViewTabPointerDragState | null>(null);
  const [contextMenuViewId, setContextMenuViewId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingViewName, setEditingViewName] = useState("");
  const [openCreateViewMenu, setOpenCreateViewMenu] = useState(false);
  const editingViewInputRef = useRef<HTMLInputElement | null>(null);
  const viewTabListRef = useRef<HTMLDivElement | null>(null);
  const cancelViewRenameRef = useRef(false);
  const renameAttemptRef = useRef(0);
  const renameSavingRef = useRef(false);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState("");
  const suppressViewClickRef = useRef<string | null>(null);
  const contextMenuView = views.find((view) => view.id === contextMenuViewId) || null;

  useEffect(() => {
    if (editingViewId) {
      editingViewInputRef.current?.focus();
      editingViewInputRef.current?.select();
    }
  }, [editingViewId]);

  useEffect(() => {
    const list = viewTabListRef.current;
    const scroller = list?.parentElement;
    if (!scroller || projectActive) return;
    const revealActiveTab = () => {
      list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    revealActiveTab();
    const resizeObserver = new ResizeObserver(revealActiveTab);
    resizeObserver.observe(scroller);
    return () => resizeObserver.disconnect();
  }, [activeViewId, projectActive, views]);

  useEffect(() => {
    setContextMenuViewId(null);
    setOpenCreateViewMenu(false);
    setViewTabDragState(null);
    suppressViewClickRef.current = null;
  }, [dismissSignal]);

  useEffect(() => {
    if (!actionsDisabled) return;
    setContextMenuViewId(null);
    setOpenCreateViewMenu(false);
    setViewTabDragState(null);
    cancelViewRename();
  }, [actionsDisabled]);

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
    if (actionsDisabledRef.current) return;
    renameAttemptRef.current += 1;
    renameSavingRef.current = false;
    setRenameSaving(false);
    setRenameError("");
    cancelViewRenameRef.current = false;
    setContextMenuViewId(null);
    setEditingViewId(view.id);
    setEditingViewName(view.name);
  }

  async function submitViewRename(view: WorkspaceView) {
    if (actionsDisabledRef.current || cancelViewRenameRef.current || renameSavingRef.current) return;
    const nextName = editingViewName.trim();
    if (!nextName || nextName === view.name) {
      cancelViewRenameRef.current = true;
      setEditingViewId(null);
      return;
    }
    const attempt = renameAttemptRef.current;
    renameSavingRef.current = true;
    setRenameSaving(true);
    setRenameError("");
    let saved = false;
    try { saved = (await onRenameView(view.id, nextName)) !== false; } catch { /* App provides detailed error feedback. */ }
    if (attempt !== renameAttemptRef.current) return;
    renameSavingRef.current = false;
    setRenameSaving(false);
    if (saved) {
      cancelViewRenameRef.current = true;
      setEditingViewId(null);
      setEditingViewName("");
    } else {
      setRenameError(t("toast.viewRenameFailed"));
    }
  }

  function cancelViewRename() {
    renameAttemptRef.current += 1;
    renameSavingRef.current = false;
    setRenameSaving(false);
    setRenameError("");
    cancelViewRenameRef.current = true;
    setEditingViewId(null);
    setEditingViewName("");
  }

  function deleteView(view: WorkspaceView) {
    if (actionsDisabledRef.current) return;
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
    if (actionsDisabledRef.current || event.button !== 0 || editingViewId === viewId) {
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

      if (actionsDisabledRef.current || !moved) {
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
      if (pendingViewId && viewId === activeViewId) onActiveViewChange(viewId);
      return;
    }

    suppressViewClickRef.current = null;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div className="relative flex min-w-0 items-center justify-between gap-1">
      <div className="relative z-40 flex min-w-0 flex-1 items-center gap-0">
      <Tabs value={projectActive ? "" : activeViewId} onValueChange={onActiveViewChange} className="workspace-tab-scroll min-w-0 max-w-[70%] shrink-0 overflow-x-auto overflow-y-hidden">
        <TabsList
          ref={viewTabListRef}
          aria-label={t("view.actions")}
          className="!h-7 w-max max-w-none flex-nowrap justify-start gap-1 rounded-none bg-transparent p-0 shadow-none"
        >
          {views.map((view) => {
            if (editingViewId === view.id) {
              return (
                <form
                  key={view.id}
                  className="h-8 min-w-24"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitViewRename(view);
                  }}
                >
                  <input
                    ref={editingViewInputRef}
                    aria-label={t("view.renameInput")}
                      readOnly={renameSaving}
                      aria-busy={renameSaving || undefined}
                      aria-invalid={Boolean(renameError)}
                      aria-describedby={renameError ? "view-rename-error" : undefined}
                    className="h-full w-full rounded-md border border-ring bg-background px-2 text-sm font-normal text-foreground outline-none ring-2 ring-ring/30"
                    value={editingViewName}
                    onChange={(event) => setEditingViewName(event.currentTarget.value)}
                    onBlur={() => submitViewRename(view)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || renameSavingRef.current)) {
                        event.preventDefault();
                        return;
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        const list = event.currentTarget.closest("[role=tablist]");
                        cancelViewRename();
                        requestAnimationFrame(() => list?.querySelector<HTMLButtonElement>("[role=tab][aria-selected=true]")?.focus());
                      }
                    }}
                  />
                {renameError ? createPortal(
                    <p id="view-rename-error" role="alert"
                      className="electron-window-no-drag fixed z-50 max-w-[min(320px,calc(100vw-24px))] rounded-md border border-border bg-popover px-3 py-2 text-xs text-destructive-text shadow-sm"
                      style={{ left: Math.max(12, Math.min(editingViewInputRef.current?.getBoundingClientRect().left ?? 12, window.innerWidth - 332)), top: (editingViewInputRef.current?.getBoundingClientRect().bottom ?? 40) + 8 }}>
                      {renameError}
                    </p>, document.body,
                  ) : null}
                  </form>
              );
            }

            return (
              <TabsTrigger
                key={view.id}
                value={view.id}
                data-view-tab-id={view.id}
                aria-busy={view.id === pendingViewId || undefined}
                title={view.name}
                aria-label={view.name}
                className={[
                  "h-7 max-w-[210px] min-w-0 flex-none cursor-grab rounded-md pl-1.5 pr-2 text-sm font-normal text-muted-foreground transition-transform ease-out active:cursor-grabbing data-active:border-transparent data-active:bg-accent data-active:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                ].join(" ")}
                style={getViewTabDragStyle(view.id)}
                onPointerDown={(event) => startPointerViewTabDrag(event, view.id)}
                onClick={(event) => handleViewTabClick(event, view.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (actionsDisabledRef.current) return;
                  setContextMenuViewId(view.id);
                  setContextMenuPosition({
                    x: Math.max(8, Math.min(event.clientX, window.innerWidth - 232)),
                    y: Math.max(8, Math.min(event.clientY, window.innerHeight - 144)),
                  });
                }}
              >
                {renderViewIcon(view)}
                <span className="truncate">{view.name}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      <div aria-hidden="true" className="mx-2 h-5 w-px shrink-0 bg-border" />
      {projectTabs}
      </div>
      <div className="flex shrink-0 items-center gap-1" inert={actionsDisabled}>
        {actionsHidden ? projectActions : <>
        <DropdownMenu open={openCreateViewMenu} onOpenChange={setOpenCreateViewMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="workspace-top-action"
              aria-label={t("view.addAria")}
              title={t("view.add")}
            >
              <PlusIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-workspace-view-create-menu="true"
            align="end"
            className={`${workspaceMenuContentClassName} min-w-44`}
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
        <WorkspaceViewFilterMenu
          view={activeView}
          groupOptions={groupOptions}
          onGroupingChange={onGroupingChange}
          dismissSignal={dismissSignal}
          properties={properties}
          selectValues={selectValues}
          statusValues={statusValues}
          onToggleColumnVisibility={onToggleColumnVisibility}
          boardColumnWidthMax={boardColumnWidthMax}
          onTogglePropertyVisibility={onTogglePropertyVisibility}
          onToggleValueFilter={onToggleValueFilter}
          onBoardColumnWidthPreview={onBoardColumnWidthPreview}
          onBoardColumnWidthCommit={onBoardColumnWidthCommit}
          onReorderViewProperties={onReorderViewProperties}
          onRenameProperty={onRenameProperty}
          onDeleteProperty={onDeleteProperty}
        />
        </>}
      </div>
      {contextMenuView && !actionsDisabled ? (
        <div
          data-workspace-view-context-menu="true"
          className={`fixed z-50 min-w-44 ${workspaceMenuContentClassName}`}
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
          role="menu"
        >
          <button
            type="button"
            className={workspaceMenuItemClassName}
            onClick={() => {
              if (actionsDisabledRef.current) return;
              onDuplicateView(contextMenuView.id);
              setContextMenuViewId(null);
            }}
          >
            <CopyIcon className={workspaceMenuIconClassName} aria-hidden="true" />
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
