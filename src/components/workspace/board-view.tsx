import { useBoardWrapLayout } from "./use-board-wrap-layout";
import { BoardColumnActions } from "./board-column-actions";
import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from "react";

import { useBoardColumnOrder } from "./use-board-column-order";
import { ProjectStatusPicker } from "./project-status-picker";
import { ProjectStatusDragSurface, StatusDragCard, StatusDropColumn, type ProjectStatusActions } from "./project-status-drag";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { getStatusDisplayName } from "@/i18n/status";
import type { WorkspaceMockProject, WorkspaceMockVisibleProperty } from "@/workspaceMockData";
import type { WorkspaceProjectionResponse, WorkspaceSelectValueState } from "@/workspaceAppState";
import { normalizeBoardColumnWidth, packBoardCards } from "@/workspaceBoardLayout.js";
import { formatDateForDisplay } from "@/formatDateForDisplay.js";
import { ProjectTablePropertyValueEditor } from "./table-view";

type WorkspaceBoardColumn = {
  readonly statusValueId: string;
  readonly name: string;
  readonly color?: string;
  readonly collapsed?: boolean;
  readonly count?: number;
  readonly projects: readonly WorkspaceMockProject[];
};

type WorkspaceBoardProjection = {
  readonly groupingNotice?: string;
  readonly capabilities: {
    readonly canMoveBetweenStatuses: boolean;
  };
  readonly columns: readonly WorkspaceBoardColumn[];
};

type BoardEditingProps = Pick<ComponentProps<typeof ProjectTablePropertyValueEditor>,
  "onProjectPropertyValueChange" | "onCreateSelectValue" | "onRenameSelectValue" | "onColorSelectValue" | "onDeleteSelectValue">;

type WorkspaceBoardViewProps = BoardEditingProps & ProjectStatusActions & {
  readonly projection: WorkspaceBoardProjection;
  readonly statusValues: WorkspaceProjectionResponse["statusValues"];
  readonly columnWidth?: number;
  readonly wrapContent?: boolean;
  readonly onWrapContentChange?: (enabled: boolean) => Promise<void>;
  readonly columnOrder?: readonly string[];
  readonly onHideColumn?: (id: string) => Promise<void>;
  readonly onCreateProject?: (id: string, name: string) => Promise<void>;
  readonly noSearchResults?: boolean;
  readonly orderScope?: string;
  readonly interactionDisabled?: boolean;
  readonly onReorderColumns?: (order: readonly string[]) => Promise<void>;
  readonly onViewportWidthChange?: (viewportWidth: number) => void;
  readonly visibleProperties: readonly WorkspaceMockVisibleProperty[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly onProjectOpen: (project: WorkspaceMockProject) => void;
};

function getPropertyValue(project: WorkspaceMockProject, property: WorkspaceMockVisibleProperty) {
  if (property.id === "property:name") {
    return project.name;
  }

  if (property.id === "property:status") {
    return project.status.name;
  }

  return project.propertyValues[property.id as keyof typeof project.propertyValues] ?? "";
}

function formatPropertyValue(
  value: unknown,
  property: WorkspaceMockVisibleProperty,
  selectValues: readonly WorkspaceSelectValueState[],
  locale: string,
) {
  if (property.propertyType === "date") return formatDateForDisplay(value, locale);
  if (property.propertyType === "select") {
    return selectValues.find((selectValue) => selectValue.id === value)?.name || (typeof value === "string" ? value : "");
  }

  if (property.propertyType === "multi-select" && Array.isArray(value)) {
    return value
      .map((valueId) => selectValues.find((selectValue) => selectValue.id === valueId)?.name || (typeof valueId === "string" ? valueId : ""))
      .filter(Boolean)
      .join(", ");
  }

  return value == null ? "" : String(value);
}

function renderBoardStatusValue(value: unknown, t: (key: string) => string) {
  const statusValue = value && typeof value === "object" && !Array.isArray(value)
    ? value as {
        readonly id?: string;
        readonly name?: string;
        readonly source?: string;
        readonly color?: unknown;
      }
    : null;
  const label = statusValue ? getStatusDisplayName(t, statusValue) : value == null ? "" : String(value);
  const color = typeof statusValue?.color === "string" && statusValue.color ? statusValue.color : "gray";

  if (!label) {
    return null;
  }

  return (
    <Badge
      variant="secondary"
      className="h-6 max-w-full cursor-default select-none gap-1.5 rounded-none border-0 bg-transparent px-0 text-sm font-normal text-muted-foreground shadow-none"
    >
      <span className="size-2 rounded-full bg-muted-foreground/70" data-color={color} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Badge>
  );
}

export function WorkspaceBoardView({
  projection,
  statusValues,
  columnWidth, wrapContent = false, onWrapContentChange, columnOrder, orderScope = "board", interactionDisabled = false, onReorderColumns,
  onViewportWidthChange, onHideColumn, onCreateProject, noSearchResults,
  visibleProperties,
  selectValues,
  onProjectOpen,
  statusMovePending, onLoadStatusOptions, onStatusChange,
  ...editingProps
}: WorkspaceBoardViewProps) {
  const { t, locale } = useI18n();
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [contextRequest, setContextRequest] = useState({id: "", sequence: 0});
  const cardProperties = visibleProperties.filter(
    (property) => property.id !== "property:name",
  );
  const preferredColumnWidth = normalizeBoardColumnWidth(columnWidth);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const geometry = useBoardWrapLayout(boardViewportRef, wrapContent, [projection, visibleProperties, selectValues, preferredColumnWidth, editingCellId].map(value => typeof value === "object" ? JSON.stringify(value) : value).join("\0"));
  const packing = new Map(projection.columns.map(column => [column.statusValueId, packBoardCards(column.collapsed ? [] : column.projects.map(project => geometry.heights[JSON.stringify([column.statusValueId, project.id])] ?? 40), geometry.height)]));
  const oversized = wrapContent && [...packing.values()].some(value => value.oversized);
  const columnIds = projection.columns.map(column => column.statusValueId);
  const movableIds = columnIds.filter(id => !["empty", "statusValue:no-status", "ungrouped"].includes(id));
  const order = useBoardColumnOrder({ order: columnOrder ?? columnIds, visibleIds: movableIds, scope: orderScope, disabled: interactionDisabled || !!statusMovePending, viewport: boardViewportRef, onReorder: onReorderColumns });
  const columnsById = new Map(projection.columns.map(column => [column.statusValueId, column]));
  const orderedColumns = [...order.bodies, ...columnIds.filter(id => !movableIds.includes(id))].flatMap(id => { const column = columnsById.get(id); return column ? [column] : []; });
  const boardGridStyle = {
    "--workspace-board-column-width": `${preferredColumnWidth}px`,
  } as CSSProperties;

  useEffect(() => {
    const viewport = boardViewportRef.current;
    if (!viewport) {
      return;
    }

    const updateWidth = () => {
      const content = viewport.firstElementChild;
      const style = content ? getComputedStyle(content) : null;
      const contentInset = style ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) : 0;
      const viewportWidth = Math.max(0, viewport.clientWidth - contentInset);
      onViewportWidthChange?.(viewportWidth);
    };
    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  }, [onViewportWidthChange]);

  return (
    <ProjectStatusDragSurface statusMovePending={!projection.capabilities.canMoveBetweenStatuses || statusMovePending || !!order.activeId || order.pending || interactionDisabled} onLoadStatusOptions={onLoadStatusOptions} onStatusChange={onStatusChange}>
    <section data-workspace-preview-surface="board" className="flex h-full min-h-0 w-full flex-col overflow-hidden pt-3" aria-label={t("view.boardDefault")} data-workspace-column-reorder={order.activeId ? "preview" : order.pending ? "saving" : undefined}
      onClickCapture={event => { if (order.suppressClick()) { event.preventDefault(); event.stopPropagation(); } }}>
      <p className="sr-only" id="workspace-board-order-help">{t("board.orderHelp")}</p>
      {order.activeId || order.pending ? <p role="status" className="sr-only">{t(order.pending ? "board.orderSaving" : "board.orderPreview")}</p> : null}
      {projection.groupingNotice ? <p role="status" className="px-4 pb-2 text-xs text-muted-foreground">{t("group.removed")}</p> : null}
      {noSearchResults ? <p role="status" className="px-4 pb-2 text-xs text-muted-foreground">{t("board.noMatchingProjects")}</p> : null}
      {orderedColumns.length === 0 ? <p role="status" className="px-4 py-6 text-sm text-muted-foreground">{t("board.allColumnsHidden")}</p> : null}
      {wrapContent ? <p role="status" title={t(oversized ? "board.wrapOversized" : "board.wrapHelp")} className="h-6 shrink-0 truncate px-4 text-xs text-muted-foreground">{t(oversized ? "board.wrapOversized" : "board.wrapHelp")}</p> : null}
      <div tabIndex={wrapContent ? 0 : undefined} aria-label={wrapContent ? t("board.wrapScroll") : undefined} data-workspace-board-wrap={wrapContent || undefined} ref={boardViewportRef} className="workspace-board-scroll min-h-0 flex-1 overflow-auto">
        <div className="flex min-h-full min-w-full w-max items-start gap-3 px-4 pb-4" style={boardGridStyle}>
          {orderedColumns.map((column) => {
            const packed = packing.get(column.statusValueId)!;
            const groupWidth = wrapContent ? packed.segments * preferredColumnWidth + (packed.segments - 1) * 12 : preferredColumnWidth;
            const columnName = column.statusValueId === "empty" ? t("group.noValue") : getStatusDisplayName(t, { id: column.statusValueId, name: column.name });
            const statusColor = column.color || statusValues.find((value) => value.id === column.statusValueId)?.color || "gray";
            return (
              <StatusDropColumn statusValueId={column.statusValueId}
              key={column.statusValueId}
              className="workspace-board-column relative flex min-w-0 shrink-0 self-start flex-col px-1"
              style={{ width: groupWidth }}
              aria-label={t("board.projectsAria", {
                name: columnName,
              })}
            >
              <header tabIndex={!movableIds.includes(column.statusValueId) ? 0 : undefined}
                onContextMenu={event => { event.preventDefault(); if (!interactionDisabled && !statusMovePending && !order.activeId && !order.pending) setContextRequest(previous => ({id: column.statusValueId, sequence: previous.sequence + 1})); }}
                onKeyDown={event => { if (event.key === "ContextMenu" || event.shiftKey && event.key === "F10") { event.preventDefault(); event.stopPropagation(); if (!interactionDisabled && !statusMovePending && !order.activeId && !order.pending) setContextRequest(previous => ({id: column.statusValueId, sequence: previous.sequence + 1})); } }}
                data-workspace-column-header={column.statusValueId} data-workspace-column-drag-active={order.activeId === column.statusValueId || undefined} style={{...order.headerStyle(column.statusValueId), width: preferredColumnWidth - 8}} className="flex h-9 shrink-0 items-center justify-between gap-2 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
                  <button type="button" data-workspace-column-order-handle aria-describedby="workspace-board-order-help" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Shift+F10" aria-label={t("board.reorderColumn", {name: columnName})} title={t("board.orderHelp")} aria-disabled={order.pending || interactionDisabled || !!statusMovePending || !onReorderColumns}
                    disabled={!movableIds.includes(column.statusValueId)} onPointerDown={event => order.onPointerDown(event, column.statusValueId)} onKeyDown={event => order.onKeyDown(event, column.statusValueId)}
                    className="flex w-full min-w-0 touch-none select-none items-center gap-2 rounded-sm text-left cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                  <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground/70" data-color={statusColor} aria-hidden="true" />
                  <span className="truncate">{columnName}</span>
                  </button>
                </h3>
                <span
                  data-workspace-column-count
                  aria-label={t("board.visibleCount", { count: column.count ?? column.projects.length })}
                  className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-background/75 px-1.5 text-xs tabular-nums text-muted-foreground"
                >
                  {column.count ?? column.projects.length}
                </span>
                <BoardColumnActions wrapContent={wrapContent} onWrapContentChange={onWrapContentChange} contextRequest={contextRequest.id === column.statusValueId ? contextRequest.sequence : 0} statusValueId={column.statusValueId} name={columnName}
                  disabled={interactionDisabled || !!statusMovePending || !!order.activeId || order.pending}
                  unavailable={!projection.capabilities.canMoveBetweenStatuses || column.statusValueId === "statusValue:no-status" || !!(statusValues.find(value => value.id === column.statusValueId) as {moveDisabledReason?: string} | undefined)?.moveDisabledReason}
                  onHide={column.statusValueId === "ungrouped" ? undefined : onHideColumn} onCreate={projection.capabilities.canMoveBetweenStatuses ? onCreateProject : undefined} />
              </header>
              <div data-workspace-wrap-body className="relative grid auto-rows-max content-start gap-3 pb-2" style={wrapContent && !column.collapsed && column.projects.length ? {height: packed.height + 8} : undefined}>
                {column.collapsed ? null : column.projects.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
                    {t("board.noProjects")}
                  </div>
                ) : (
                  column.projects.map((project, index) => {
                    const populatedProperties = cardProperties.map((property) => ({
                      property,
                      value: formatPropertyValue(getPropertyValue(project, property), property, selectValues, locale),
                    })).filter(({ property, value }) => value.trim() !== "" || editingCellId === `${project.id}:${property.id}`);
                    return (
                    <div key={project.id} data-workspace-wrap-occurrence={JSON.stringify([column.statusValueId, project.id])}
                      data-workspace-wrap-segment={wrapContent ? packed.positions[index].segment : undefined}
                      style={wrapContent ? {position: "absolute", width: preferredColumnWidth - 8, left: packed.positions[index].segment * (preferredColumnWidth + 12), top: packed.positions[index].top} : undefined}>
                    <StatusDragCard project={project}
                      className="workspace-board-card relative flex min-h-10 w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-lg border border-border bg-[var(--surface-sidebar)] px-2 py-2 text-left text-card-foreground shadow-xs hover:bg-[color-mix(in_oklab,var(--accent)_15%,var(--surface-sidebar))] hover:border-ring/30 focus-within:border-ring"
                    >
                      <button data-workspace-card-open type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 rounded-lg" onClick={() => onProjectOpen(project)} />
                      <h4 className="relative min-w-0 text-sm font-normal leading-5">
                        <button data-workspace-card-open type="button" title={project.name} className="flex h-7 w-full min-w-0 items-center rounded-md border border-transparent px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => onProjectOpen(project)}>
                          <span className="truncate">{project.name}</span>
                        </button>
                      </h4>
                      {populatedProperties.length > 0 ? (
                        <dl className="relative grid gap-0.5">
                          {populatedProperties.map(({ property, value }) => (
                          <div key={property.id} className="min-w-0 text-sm">
                              <dt className="sr-only">{property.name}</dt>
                              <dd className="min-w-0 text-foreground [&_[data-workspace-select-value-trigger]]:h-auto [&_[data-workspace-select-value-trigger]]:min-h-8 [&_[data-workspace-select-value-trigger]>span]:flex-wrap">
                                {property.id === "property:status" ? (
                                  <div className="flex h-7 w-full min-w-0 items-center rounded-md border border-transparent px-2">
                                    {onLoadStatusOptions && onStatusChange ? <ProjectStatusPicker project={project} pending={!!statusMovePending} loadOptions={onLoadStatusOptions} onSelect={onStatusChange} /> : renderBoardStatusValue(project.status, t)}
                                  </div>
                                ) : property.system ? <span className="block truncate">{value}</span> : (
                                  <ProjectTablePropertyValueEditor
                                    {...editingProps}
                                    project={project}
                                    property={property}
                                    selectValues={selectValues}
                                    wrapContent={false}
                                    editing={editingCellId === `${project.id}:${property.id}`}
                                    dismissSignal={0}
                                    onStartEditingCell={setEditingCellId}
                                    onStopEditingCell={() => setEditingCellId(null)}
                                  />
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </StatusDragCard>
                    </div>
                    );
                  })
                )}
              </div>
              </StatusDropColumn>
            );
          })}
        </div>
      </div>
    </section>
    </ProjectStatusDragSurface>
  );
}
