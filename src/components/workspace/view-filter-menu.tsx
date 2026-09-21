import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Columns3Icon,
  EyeIcon,
  EyeOffIcon,
  ListFilterIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "@/lib/lucide-icons";
import {
  workspaceMenuCheckboxClassName,
  workspaceMenuContentClassName,
  workspaceMenuDangerIconClassName,
  workspaceMenuDangerItemClassName,
  workspaceMenuIconClassName,
  workspaceMenuItemClassName,
  workspaceMenuSeparatorClassName,
} from "@/components/workspace/menu-styles";
import { blockOutsideWorkspaceMenuPointerDown } from "@/components/workspace/menu-dismissal";
import { useI18n } from "@/i18n";
import { getStatusDisplayName } from "@/i18n/status";
import type {
  WorkspacePropertyDefinitionState,
  WorkspaceProjectionResponse,
  WorkspaceSelectValueState,
  WorkspaceViewState,
} from "@/workspaceAppState";
import {
  mergeFixedIdsWithReorderedIds,
  reorderIdsByDropIndex,
} from "@/workspaceDrag";
import {
  BOARD_COLUMN_WIDTH_MIN,
  normalizeBoardColumnWidth,
} from "@/workspaceBoardLayout.js";

type WorkspaceViewFilterMenuProps = {
  readonly view: WorkspaceViewState | null;
  readonly dismissSignal?: number;
  readonly properties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly statusValues: WorkspaceProjectionResponse["statusValues"];
  readonly boardColumnWidthMax: number;
  readonly onTogglePropertyVisibility: (propertyId: string, visible: boolean) => void;
  readonly onToggleValueFilter: (propertyId: string, valueId: string, included: boolean) => void;
  readonly onBoardColumnWidthPreview: (columnWidth: number) => void;
  readonly onBoardColumnWidthCommit: (columnWidth: number, previousColumnWidth: number) => void;
  readonly onReorderViewProperties: (orderedPropertyIds: readonly string[]) => void;
  readonly onRenameProperty: (propertyId: string, name: string) => void;
  readonly onDeleteProperty: (propertyId: string) => void;
};

type WorkspaceFilterValue = {
  readonly id: string;
  readonly name: string;
};

type PropertyDragPreviewRow = {
  readonly propertyId: string;
  readonly top: number;
  readonly height: number;
};

type PropertyPointerDragState = {
  readonly propertyId: string;
  readonly startY: number;
  readonly currentY: number;
  readonly dropIndex: number;
  readonly rows: readonly PropertyDragPreviewRow[];
};

function isSystemProperty(propertyId: string) {
  return propertyId === "property:name" || propertyId === "property:status";
}

function isRequiredViewProperty(propertyId: string) {
  return propertyId === "property:name";
}

function canRenameProperty(property: WorkspacePropertyDefinitionState) {
  return property.id === "property:name" || property.id === "property:status" || !isSystemProperty(property.id);
}

function isFilterableProperty(property: WorkspacePropertyDefinitionState) {
  return property.id === "property:status"
    || property.propertyType === "select"
    || property.propertyType === "multi-select";
}

function getFilterValues(
  property: WorkspacePropertyDefinitionState,
  selectValues: readonly WorkspaceSelectValueState[],
  statusValues: WorkspaceProjectionResponse["statusValues"],
  t: (key: string) => string,
): readonly WorkspaceFilterValue[] {
  if (property.id === "property:status") {
    return statusValues.map((statusValue) => ({
      id: statusValue.id,
      name: getStatusDisplayName(t, statusValue),
    }));
  }

  return selectValues
    .filter((selectValue) => selectValue.propertyId === property.id && !selectValue.hidden)
    .map((selectValue) => ({
      id: selectValue.id,
      name: selectValue.name,
    }));
}

function keepDropdownOpenForActionsPopover(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (event.target instanceof Element && event.target.closest("[data-workspace-actions-popover='true']")) {
    event.preventDefault();
  }
}

function stopActionMenuEvent(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

const visiblePropertyRowClassName =
  "workspace-customize-property-row grid h-8 min-w-0 select-none grid-cols-[auto_minmax(0,1fr)_minmax(5rem,auto)_1.5rem] items-center gap-2 rounded-lg px-1.5 text-sm transition-colors";

const valueFilterGroupButtonClassName =
  "flex h-7 min-w-0 select-none items-center gap-1.5 rounded-lg px-1.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/55 hover:text-foreground";

const valueFilterItemClassName =
  "grid h-7 min-w-0 cursor-default select-none grid-cols-[1rem_minmax(0,1fr)] items-center gap-1.5 rounded-lg px-1.5 text-sm transition-colors hover:bg-accent/55";

const propertyDragStartThreshold = 4;
const viewFilterMenuSurfaceSelector =
  "[data-workspace-view-filter-menu='true'], [data-workspace-actions-popover='true']";

export function WorkspaceViewFilterMenu({
  view,
  dismissSignal,
  properties,
  selectValues,
  statusValues,
  boardColumnWidthMax,
  onTogglePropertyVisibility,
  onToggleValueFilter,
  onBoardColumnWidthPreview,
  onBoardColumnWidthCommit,
  onReorderViewProperties,
  onRenameProperty,
  onDeleteProperty,
}: WorkspaceViewFilterMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingPropertyName, setEditingPropertyName] = useState("");
  const [actionsPropertyId, setActionsPropertyId] = useState<string | null>(null);
  const [propertyDragState, setPropertyDragState] = useState<PropertyPointerDragState | null>(null);
  const [expandedFilterPropertyIds, setExpandedFilterPropertyIds] = useState<ReadonlySet<string>>(() => new Set());
  const [boardColumnWidthDragMax, setBoardColumnWidthDragMax] = useState<number | null>(null);
  const boardColumnWidthStartRef = useRef<number | null>(null);
  const visiblePropertyIds = new Set(view?.visiblePropertyIds || properties.map((property) => property.id));
  const visibleViewProperties = properties.filter((property) => visiblePropertyIds.has(property.id));
  const hiddenViewProperties = properties.filter((property) => !visiblePropertyIds.has(property.id));
  const valueVisibility = view?.valueVisibility || {};
  const filterableProperties = properties.filter(isFilterableProperty);
  const preferredBoardColumnWidth = normalizeBoardColumnWidth(view?.boardLayout?.columnWidth);
  const availableBoardColumnWidthMax = Math.max(
    BOARD_COLUMN_WIDTH_MIN,
    boardColumnWidthMax,
    preferredBoardColumnWidth,
  );
  const effectiveBoardColumnWidthMax = boardColumnWidthDragMax ?? availableBoardColumnWidthMax;

  useEffect(() => {
    setOpen(false);
    setActionsPropertyId(null);
    setPropertyDragState(null);
    setEditingPropertyId(null);
    setEditingPropertyName("");
    setExpandedFilterPropertyIds(new Set());
  }, [dismissSignal]);

  useEffect(() => {
    if (open) {
      setExpandedFilterPropertyIds(new Set(filterableProperties.map((property) => property.id)));
    }
  }, [open]);

  function beginRenameProperty(property: WorkspacePropertyDefinitionState) {
    if (!canRenameProperty(property)) {
      return;
    }

    setEditingPropertyId(property.id);
    setEditingPropertyName(property.name);
    setActionsPropertyId(null);
  }

  function commitRenameProperty(property: WorkspacePropertyDefinitionState) {
    const name = editingPropertyName.trim();
    setEditingPropertyId(null);
    setEditingPropertyName("");

    if (name && name !== property.name) {
      onRenameProperty(property.id, name);
    }
  }

  function commitActiveRenameProperty() {
    const property = properties.find((propertyOption) => propertyOption.id === editingPropertyId);

    if (property) {
      commitRenameProperty(property);
      return;
    }

    setEditingPropertyId(null);
    setEditingPropertyName("");
  }

  useEffect(() => {
    if (!open && !actionsPropertyId) {
      return undefined;
    }

    function closeViewFilterMenusOnOutsidePointerDown(event: PointerEvent) {
      blockOutsideWorkspaceMenuPointerDown(event, viewFilterMenuSurfaceSelector, () => {
        if (editingPropertyId) {
          commitActiveRenameProperty();
        }

        setOpen(false);
        setActionsPropertyId(null);
      });
    }

    document.addEventListener("pointerdown", closeViewFilterMenusOnOutsidePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", closeViewFilterMenusOnOutsidePointerDown, true);
    };
  }, [actionsPropertyId, editingPropertyId, editingPropertyName, open, properties]);

  function toggleFilterPropertyExpanded(propertyId: string) {
    setExpandedFilterPropertyIds((currentPropertyIds) => {
      const nextPropertyIds = new Set(currentPropertyIds);

      if (nextPropertyIds.has(propertyId)) {
        nextPropertyIds.delete(propertyId);
      } else {
        nextPropertyIds.add(propertyId);
      }

      return nextPropertyIds;
    });
  }

  function getPropertyDragPreviewRows() {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-view-property-row-id]"))
      .map((row) => {
        const propertyId = row.dataset.viewPropertyRowId;
        const rect = row.getBoundingClientRect();

        if (!propertyId) {
          return null;
        }

        return {
          propertyId,
          top: rect.top,
          height: rect.height,
        };
      })
      .filter((row): row is PropertyDragPreviewRow => row !== null);
  }

  function findPropertyDragTarget(clientY: number, rows: readonly PropertyDragPreviewRow[]) {
    let dropIndex = 0;

    for (const row of rows) {
      if (clientY >= row.top + row.height / 2) {
        dropIndex += 1;
      }
    }

    return dropIndex;
  }

  function findPropertyDropIndex(
    clientY: number,
    rows: readonly PropertyDragPreviewRow[],
    sourcePropertyId: string,
  ) {
    return findPropertyDragTarget(
      clientY,
      rows.filter((row) => row.propertyId !== sourcePropertyId),
    );
  }

  function getPropertyDragTops(
    orderedPropertyIds: readonly string[],
    rows: readonly PropertyDragPreviewRow[],
  ) {
    const tops = new Map<string, number>();

    orderedPropertyIds.forEach((propertyId, index) => {
      const row = rows[index];
      if (row) {
        tops.set(propertyId, row.top);
      }
    });

    return tops;
  }

  function getPropertyDragStyle(propertyId: string): CSSProperties | undefined {
    if (!propertyDragState) {
      return undefined;
    }

    const orderedPropertyIds = visibleViewProperties
      .filter((property) => !isRequiredViewProperty(property.id))
      .map((property) => property.id);
    const currentRow = propertyDragState.rows.find((row) => row.propertyId === propertyId);

    if (!currentRow || !orderedPropertyIds.includes(propertyId)) {
      return undefined;
    }

    if (propertyId === propertyDragState.propertyId) {
      return {
        transform: `translateY(${propertyDragState.currentY - propertyDragState.startY}px)`,
        transitionDuration: "0ms",
        zIndex: 30,
      };
    }

    const previewOrder = reorderIdsByDropIndex(
      orderedPropertyIds,
      propertyDragState.propertyId,
      propertyDragState.dropIndex,
    );
    const previewTops = getPropertyDragTops(previewOrder, propertyDragState.rows);
    const previewTop = previewTops.get(propertyId);

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

  function startPointerPropertyDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    propertyId: string,
    canDragProperty: boolean,
  ) {
    if (event.button !== 0 || !canDragProperty) {
      return;
    }

    const propertyDragPreviewRows = getPropertyDragPreviewRows();
    if (propertyDragPreviewRows.length <= 1) {
      return;
    }

    event.stopPropagation();

    let frameId = 0;
    let pendingClientY = event.clientY;
    let moved = false;
    let dragStarted = false;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    function startPropertyDragPreview(clientY: number) {
      dragStarted = true;
      pendingClientY = clientY;
      setActionsPropertyId(null);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      setPropertyDragState({
        propertyId,
        startY: event.clientY,
        currentY: clientY,
        dropIndex: findPropertyDropIndex(clientY, propertyDragPreviewRows, propertyId),
        rows: propertyDragPreviewRows,
      });
    }

    function updateDraggedProperty() {
      frameId = 0;

      if (!dragStarted) {
        return;
      }

      const dropIndex = findPropertyDropIndex(
        pendingClientY,
        propertyDragPreviewRows,
        propertyId,
      );

      setPropertyDragState((currentDrag) => {
        if (!currentDrag || currentDrag.propertyId !== propertyId) {
          return currentDrag;
        }

        return {
          ...currentDrag,
          currentY: pendingClientY,
          dropIndex,
        };
      });
    }

    function moveProperty(pointerEvent: PointerEvent) {
      pendingClientY = pointerEvent.clientY;

      if (!dragStarted && Math.abs(pointerEvent.clientY - event.clientY) <= propertyDragStartThreshold) {
        return;
      }

      if (!dragStarted) {
        startPropertyDragPreview(pointerEvent.clientY);
      }

      moved = true;

      if (frameId === 0) {
        frameId = window.requestAnimationFrame(updateDraggedProperty);
      }
    }

    function finishPropertyDrag(pointerEvent: PointerEvent) {
      const dropIndex = findPropertyDropIndex(
        pointerEvent.clientY,
        propertyDragPreviewRows,
        propertyId,
      );
      const orderedPropertyIds = propertyDragPreviewRows.map((row) => row.propertyId);
      const nextMovablePropertyIds = reorderIdsByDropIndex(orderedPropertyIds, propertyId, dropIndex);
      const previousVisiblePropertyIds = visibleViewProperties.map((property) => property.id);
      const fixedPropertyIds = previousVisiblePropertyIds.filter(isRequiredViewProperty);
      const nextPropertyIds = mergeFixedIdsWithReorderedIds(
        previousVisiblePropertyIds,
        fixedPropertyIds,
        nextMovablePropertyIds,
      );

      if (dragStarted) {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
      }
      window.removeEventListener("pointermove", moveProperty);
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointerup", finishPropertyDrag);
      setPropertyDragState(null);

      if (
        dragStarted
        && moved
        && nextPropertyIds.join("\0") !== previousVisiblePropertyIds.join("\0")
      ) {
        onReorderViewProperties(nextPropertyIds);
      }
    }

    window.addEventListener("pointermove", moveProperty);
    window.addEventListener("pointerup", finishPropertyDrag, { once: true });
  }

  function renderPropertyVisibilityRow(
    property: WorkspacePropertyDefinitionState,
    checked: boolean,
    section: "visible" | "hidden",
  ) {
    const required = isRequiredViewProperty(property.id);
    const editableDefinition = !isSystemProperty(property.id);
    const renameableDefinition = canRenameProperty(property);
    const canOpenActions = canRenameProperty(property) || !required;
    const canDragProperty = section === "visible" && !required && editingPropertyId !== property.id;

    return (
      <div key={property.id} className="grid min-w-0">
        <div
          data-view-property-row-id={canDragProperty ? property.id : undefined}
          className={`${visiblePropertyRowClassName} ${canDragProperty ? "cursor-grab active:cursor-grabbing" : ""} ${propertyDragState ? "transition-transform ease-out" : ""}`}
          style={getPropertyDragStyle(property.id)}
          onPointerDown={(event) => startPointerPropertyDrag(event, property.id, canDragProperty)}
        >
          <Checkbox
            checked={checked}
            disabled={required}
            aria-label={`${property.name}: ${t("common.show")}`}
            className={workspaceMenuCheckboxClassName}
            onPointerDown={stopActionMenuEvent}
            onCheckedChange={(value) => onTogglePropertyVisibility(property.id, value === true)}
          />
          {editingPropertyId === property.id ? (
            <Input
              value={editingPropertyName}
              autoFocus
              aria-label={t("property.rename")}
              className="h-6 min-w-0"
              onChange={(event) => setEditingPropertyName(event.target.value)}
              onBlur={() => commitRenameProperty(property)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitRenameProperty(property);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEditingPropertyId(null);
                  setEditingPropertyName("");
                }
              }}
            />
          ) : (
            <span className="truncate font-medium">{property.name}</span>
          )}
          <div className="flex min-w-0 justify-end pr-1">
            {required ? (
              <Badge variant="outline" className="h-6 rounded-full px-2 text-xs">
                {t("common.required")}
              </Badge>
            ) : null}
          </div>
          <div className="flex size-6 items-center justify-center justify-self-center">
            {canOpenActions ? (
              <Popover
                open={actionsPropertyId === property.id}
                onOpenChange={(nextOpen) => setActionsPropertyId(nextOpen ? property.id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="workspace-customize-property-action flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring/40"
                    aria-label={t("table.propertyActions", { name: property.name })}
                    onClick={stopActionMenuEvent}
                    onPointerDown={stopActionMenuEvent}
                  >
                    <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  data-workspace-actions-popover="true"
                  role="menu"
                  aria-label={t("table.propertyActions", { name: property.name })}
                  side="right"
                  align="start"
                  sideOffset={8}
                  className={`${workspaceMenuContentClassName} w-52`}
                  onOpenAutoFocus={(event) => event.preventDefault()}
                  onClick={stopActionMenuEvent}
                  onPointerDown={stopActionMenuEvent}
                >
                  {renameableDefinition ? (
                    <button
                      type="button"
                      role="menuitem"
                      className={workspaceMenuItemClassName}
                      onClick={(event) => {
                        event.stopPropagation();
                        beginRenameProperty(property);
                      }}
                    >
                      <PencilIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                      {t("property.rename")}
                    </button>
                  ) : null}
                  {!required ? (
                    <button
                      type="button"
                      role="menuitem"
                      className={workspaceMenuItemClassName}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActionsPropertyId(null);
                        onTogglePropertyVisibility(property.id, section === "hidden");
                      }}
                    >
                      {section === "hidden" ? (
                        <EyeIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                      ) : (
                        <EyeOffIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                      )}
                      {section === "hidden" ? t("property.showInView") : t("property.hideFromView")}
                    </button>
                  ) : null}
                  {editableDefinition ? (
                    <button
                      type="button"
                      role="menuitem"
                      className={workspaceMenuDangerItemClassName}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActionsPropertyId(null);
                        if (window.confirm(t("confirm.deleteProperty", { name: property.name }))) {
                          onDeleteProperty(property.id);
                        }
                      }}
                    >
                      <Trash2Icon className={workspaceMenuDangerIconClassName} aria-hidden="true" />
                      {t("property.delete")}
                    </button>
                  ) : null}
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="workspace-top-action" aria-label={t("view.customizeColumns")} title={t("view.customizeColumns")}>
          <Columns3Icon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-workspace-view-filter-menu="true"
        align="end"
        className={`${workspaceMenuContentClassName} max-h-[calc(100vh-6.5rem)] w-80 overflow-x-hidden overflow-y-auto p-0`}
        onInteractOutside={keepDropdownOpenForActionsPopover}
      >
        <div className="grid gap-2.5 p-3">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold leading-none">
                <Columns3Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                {t("view.visibleProperties")}
              </p>
              <Badge variant="outline" className="h-6 min-w-6 justify-center rounded-full px-2">
                {visibleViewProperties.length}
              </Badge>
            </div>
            <p className="pl-6 text-xs text-muted-foreground">{t("view.visiblePropertiesDescription")}</p>
          </div>
          <div className="grid max-h-52 gap-0.5 overflow-auto pr-1">
            {visibleViewProperties.map((property) => renderPropertyVisibilityRow(property, true, "visible"))}
          </div>
          {hiddenViewProperties.length > 0 ? (
            <div className="grid gap-1 border-t border-border/70 pt-2">
              <div className="flex h-7 items-center justify-between gap-2 px-1.5 text-sm font-semibold text-muted-foreground">
                <span className="flex min-w-0 items-center gap-2">
                  <EyeOffIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t("view.hiddenProperties")}</span>
                </span>
                <Badge variant="secondary" className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">
                  {hiddenViewProperties.length}
                </Badge>
              </div>
              <div className="grid max-h-32 gap-0.5 overflow-auto pr-1">
                {hiddenViewProperties.map((property) => renderPropertyVisibilityRow(property, false, "hidden"))}
              </div>
            </div>
          ) : null}
        </div>
        <Separator className={workspaceMenuSeparatorClassName} />
        <div className="grid gap-2.5 p-3">
          <div className="grid gap-1.5">
            <p className="flex items-center gap-2 text-sm font-semibold leading-none">
              <ListFilterIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              {t("view.valueFilters")}
            </p>
            <p className="pl-6 text-xs text-muted-foreground">{t("view.valueFiltersDescription")}</p>
          </div>
          <div className="grid max-h-60 gap-1 overflow-auto pr-1">
            {filterableProperties.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.noValues")}</p>
            ) : filterableProperties.map((property) => {
              const selectedValueIds = new Set(valueVisibility[property.id]?.valueIds || []);
              const propertyValues = getFilterValues(property, selectValues, statusValues, t);
              const expanded = expandedFilterPropertyIds.has(property.id);

              return (
                <div key={property.id} className="grid gap-0.5">
                  <button
                    type="button"
                    className={valueFilterGroupButtonClassName}
                    aria-expanded={expanded}
                    onClick={() => toggleFilterPropertyExpanded(property.id)}
                  >
                    {expanded ? (
                      <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">{property.name}</span>
                    {selectedValueIds.size > 0 ? (
                      <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[11px]">
                        {selectedValueIds.size}
                      </Badge>
                    ) : null}
                  </button>
                  {expanded ? (
                    <div className="grid gap-0.5">
                      {propertyValues.length > 0 ? propertyValues.map((selectValue) => (
                        <label key={selectValue.id} className={valueFilterItemClassName}>
                          <Checkbox
                            checked={selectedValueIds.has(selectValue.id)}
                            className={workspaceMenuCheckboxClassName}
                            onCheckedChange={(value) =>
                              onToggleValueFilter(property.id, selectValue.id, value === true)
                            }
                          />
                          <span className="truncate font-medium">{selectValue.name}</span>
                        </label>
                      )) : (
                        <p className="px-1.5 py-1 text-xs text-muted-foreground">{t("common.noValues")}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        {view?.viewType === "board" ? (
          <>
            <Separator className={workspaceMenuSeparatorClassName} />
            <div className="grid gap-2.5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="grid gap-1">
                  <p className="flex items-center gap-2 text-sm font-semibold leading-none">
                    <Columns3Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    {t("view.columnWidth")}
                  </p>
                  <p className="pl-6 text-xs text-muted-foreground">{t("view.columnWidthDescription")}</p>
                </div>
                <Badge variant="outline" className="h-6 min-w-14 justify-center rounded-full px-2 tabular-nums">
                  {preferredBoardColumnWidth}px
                </Badge>
              </div>
              <Slider
                aria-label={t("view.columnWidth")}
                min={BOARD_COLUMN_WIDTH_MIN}
                max={effectiveBoardColumnWidthMax}
                step={8}
                value={[preferredBoardColumnWidth]}
                onPointerDown={() => {
                  boardColumnWidthStartRef.current = preferredBoardColumnWidth;
                  setBoardColumnWidthDragMax(availableBoardColumnWidthMax);
                }}
                onKeyDown={() => {
                  boardColumnWidthStartRef.current ??= preferredBoardColumnWidth;
                  setBoardColumnWidthDragMax((currentMax) => currentMax ?? availableBoardColumnWidthMax);
                }}
                onValueChange={([columnWidth]) => {
                  if (typeof columnWidth === "number") {
                    onBoardColumnWidthPreview(columnWidth);
                  }
                }}
                onValueCommit={([columnWidth]) => {
                  if (typeof columnWidth !== "number") {
                    return;
                  }

                  const previousColumnWidth = boardColumnWidthStartRef.current ?? preferredBoardColumnWidth;
                  boardColumnWidthStartRef.current = null;
                  setBoardColumnWidthDragMax(null);
                  onBoardColumnWidthCommit(columnWidth, previousColumnWidth);
                }}
                onPointerCancel={() => {
                  boardColumnWidthStartRef.current = null;
                  setBoardColumnWidthDragMax(null);
                }}
              />
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
