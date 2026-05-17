import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkspaceDateValueEditor } from "@/components/workspace/date-value-editor";
import { WorkspaceSelectValueEditor } from "@/components/workspace/select-value-editor";
import {
  CalendarIcon,
  CircleDotIcon,
  GripVerticalIcon,
  HashIcon,
  ListChecksIcon,
  MoreHorizontalIcon,
  PlusIcon,
  TypeIcon,
} from "@/lib/lucide-icons";
import type { WorkspaceCustomPropertyType } from "@/components/workspace/property-controls";
import type { WorkspaceMockProject, WorkspaceMockVisibleProperty } from "@/workspaceMockData";
import type { WorkspacePropertyDefinitionState, WorkspaceSelectValueState } from "@/workspaceAppState";

type WorkspaceTableProjection = {
  readonly rows: readonly WorkspaceMockProject[];
};

type PropertyTypeOption = {
  readonly value: WorkspaceCustomPropertyType;
  readonly label: string;
  readonly description: string;
};

type ColumnDragPreviewColumn = {
  readonly propertyId: string;
  readonly left: number;
  readonly width: number;
};

type ColumnDragState = {
  readonly propertyId: string;
  readonly startX: number;
  readonly currentX: number;
  readonly dropIndex: number;
  readonly columns: readonly ColumnDragPreviewColumn[];
};

type WorkspaceTableViewProps = {
  readonly projection: WorkspaceTableProjection;
  readonly visibleProperties: readonly WorkspaceMockVisibleProperty[];
  readonly properties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly onProjectOpen: (project: WorkspaceMockProject) => void;
  readonly onCreateProperty: (input: { name: string; type: WorkspaceCustomPropertyType }) => void;
  readonly onRenameProperty: (propertyId: string, name: string) => void;
  readonly onDeleteProperty: (propertyId: string) => void;
  readonly onDismissFloatingMenus: () => void;
  readonly onReorderViewProperties: (orderedPropertyIds: readonly string[]) => void;
  readonly onTogglePropertyVisibility: (propertyId: string, visible: boolean) => void;
  readonly onProjectPropertyValueChange: (projectId: string, propertyId: string, value: unknown) => void;
  readonly onCreateSelectValue: (
    propertyId: string,
    input: { readonly name: string; readonly color: string },
  ) => Promise<WorkspaceSelectValueState | null>;
  readonly onRenameSelectValue: (selectValueId: string, name: string) => void;
  readonly onColorSelectValue: (selectValueId: string, color: string) => void;
  readonly onDeleteSelectValue: (selectValueId: string) => void;
};

const propertyTypeOptions: readonly PropertyTypeOption[] = [
  { value: "text", label: "Text", description: "Short notes or free text" },
  { value: "number", label: "Number", description: "Numeric values and counts" },
  { value: "date", label: "Date", description: "Deadlines and calendar dates" },
  { value: "select", label: "Select", description: "One option from a list" },
  { value: "multi-select", label: "Multi-select", description: "Several options from a list" },
];

const rowHandleColumnWidth = 40;
const addPropertyColumnWidth = 48;
const minimumPropertyColumnWidth = 132;
const maximumPropertyColumnWidth = 520;
const defaultCustomPropertyColumnWidth = 180;

function getDefaultPropertyColumnWidth(property: WorkspaceMockVisibleProperty) {
  if (property.id === "property:name") {
    return 260;
  }

  if (property.id === "property:status") {
    return 180;
  }

  return defaultCustomPropertyColumnWidth;
}

function clampPropertyColumnWidth(width: number) {
  return Math.min(maximumPropertyColumnWidth, Math.max(minimumPropertyColumnWidth, width));
}

function getPropertyValue(project: WorkspaceMockProject, property: WorkspaceMockVisibleProperty) {
  const backendProject = project as WorkspaceMockProject & { readonly folderStatus?: string };

  if (property.id === "property:name") {
    return project.name;
  }

  if (property.id === "property:status") {
    return project.status?.name
      || backendProject.folderStatus
      || project.propertyValues?.["property:status"]
      || "";
  }

  return project.propertyValues[property.id as keyof typeof project.propertyValues] ?? "";
}

function formatPropertyValue(
  value: unknown,
  property: WorkspaceMockVisibleProperty,
  selectValues: readonly WorkspaceSelectValueState[],
) {
  if (property.id === "property:status") {
    return value == null ? "" : String(value);
  }

  if (property.propertyType === "select") {
    return selectValues.find((selectValue) => selectValue.id === value)?.name || "";
  }

  if (property.propertyType === "multi-select" && Array.isArray(value)) {
    return value
      .map((valueId) => selectValues.find((selectValue) => selectValue.id === valueId)?.name)
      .filter(Boolean)
      .join(", ");
  }

  return value == null ? "" : String(value);
}

function isSystemProperty(propertyId: string) {
  return propertyId === "property:name" || propertyId === "property:status";
}

function isEditableProperty(property: WorkspaceMockVisibleProperty) {
  return !isSystemProperty(property.id) && property.system !== true;
}

function getBodyCellClassName(property: WorkspaceMockVisibleProperty, editable: boolean) {
  if (property.id === "property:name") {
    return "h-10 border-r border-border/45 p-0.5";
  }

  return editable ? "h-10 border-r border-border/45 p-0.5" : "h-10 border-r border-border/45 truncate px-3 py-0";
}

function renderTableStatusValue(value: unknown) {
  const label = value == null ? "" : String(value);

  if (!label) {
    return "";
  }

  return (
    <Badge
      variant="secondary"
      className="h-6 max-w-full gap-1.5 rounded-md border border-border/50 bg-secondary/70 px-2 text-[13px] font-medium"
    >
      <span className="size-2 rounded-full bg-muted-foreground/70" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Badge>
  );
}

function renderPropertyTypeIcon(propertyType: WorkspaceCustomPropertyType) {
  const className = "mt-0.5 size-4 text-muted-foreground";

  if (propertyType === "number") {
    return <HashIcon className={className} aria-hidden="true" />;
  }

  if (propertyType === "date") {
    return <CalendarIcon className={className} aria-hidden="true" />;
  }

  if (propertyType === "select") {
    return <CircleDotIcon className={className} aria-hidden="true" />;
  }

  if (propertyType === "multi-select") {
    return <ListChecksIcon className={className} aria-hidden="true" />;
  }

  return <TypeIcon className={className} aria-hidden="true" />;
}

function stringifyEditableValue(value: unknown) {
  if (value == null) {
    return "";
  }

  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").join(", ")
    : String(value);
}

function getProjectPropertyCellId(projectId: string, propertyId: string) {
  return `${projectId}:${propertyId}`;
}

function ProjectTablePropertyValueEditor({
  project,
  property,
  selectValues,
  editing,
  onProjectPropertyValueChange,
  onCreateSelectValue,
  onRenameSelectValue,
  onColorSelectValue,
  onDeleteSelectValue,
  dismissSignal,
  onStartEditingCell,
  onStopEditingCell,
}: {
  readonly project: WorkspaceMockProject;
  readonly property: WorkspaceMockVisibleProperty;
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly editing: boolean;
  readonly dismissSignal: number;
  readonly onProjectPropertyValueChange: (projectId: string, propertyId: string, value: unknown) => void;
  readonly onCreateSelectValue: (
    propertyId: string,
    input: { readonly name: string; readonly color: string },
  ) => Promise<WorkspaceSelectValueState | null>;
  readonly onRenameSelectValue: (selectValueId: string, name: string) => void;
  readonly onColorSelectValue: (selectValueId: string, color: string) => void;
  readonly onDeleteSelectValue: (selectValueId: string) => void;
  readonly onStartEditingCell: (cellId: string) => void;
  readonly onStopEditingCell: () => void;
}) {
  const value = getPropertyValue(project, property);
  const editorKey = `${project.id}:${property.id}:${stringifyEditableValue(value)}`;
  const cellId = getProjectPropertyCellId(project.id, property.id);

  function stopCellActivation(event: { stopPropagation: () => void }) {
    event.stopPropagation();
  }

  function saveValue(nextValue: unknown) {
    onProjectPropertyValueChange(project.id, property.id, nextValue);
  }

  function startCellEditing(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    onStartEditingCell(cellId);
  }

  function renderCellDisplay(label: string) {
    return (
      <button
        type="button"
        className="workspace-table-cell-display flex h-8 w-full min-w-0 items-center justify-start rounded-md px-2 text-left text-sm text-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
        onClick={startCellEditing}
        onPointerDown={stopCellActivation}
      >
        <span className="truncate">{label}</span>
      </button>
    );
  }

  if (property.propertyType === "number") {
    if (!editing) {
      return renderCellDisplay(stringifyEditableValue(value));
    }

    return (
      <Input
        key={editorKey}
        type="number"
        defaultValue={stringifyEditableValue(value)}
        aria-label={`${property.name} number value`}
        autoFocus
        className="workspace-number-input h-8 min-w-0 border-transparent bg-transparent px-2 shadow-none focus-visible:border-ring focus-visible:bg-background"
        onPointerDown={stopCellActivation}
        onBlur={(event) => {
          const text = event.target.value.trim();
          saveValue(text === "" ? null : Number(text));
          onStopEditingCell();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    );
  }

  if (property.propertyType === "date") {
    return (
      <WorkspaceDateValueEditor
        value={value}
        dismissSignal={dismissSignal}
        triggerClassName="h-8 w-full min-w-0 justify-start px-2 font-normal"
        onValueChange={saveValue}
      />
    );
  }

  if (property.propertyType === "select" || property.propertyType === "multi-select") {
    return (
      <WorkspaceSelectValueEditor
        property={property}
        value={value}
        selectValues={selectValues}
        dismissSignal={dismissSignal}
        triggerClassName="h-8 w-full min-w-0 justify-start px-2 font-normal"
        onValueChange={saveValue}
        onCreateSelectValue={onCreateSelectValue}
        onRenameSelectValue={onRenameSelectValue}
        onColorSelectValue={onColorSelectValue}
        onDeleteSelectValue={onDeleteSelectValue}
      />
    );
  }

  if (!editing) {
    return renderCellDisplay(stringifyEditableValue(value));
  }

  return (
    <Input
      key={editorKey}
      defaultValue={stringifyEditableValue(value)}
      aria-label={`${property.name} text value`}
      autoFocus
      className="h-8 min-w-0 border-transparent bg-transparent px-2 shadow-none focus-visible:border-ring focus-visible:bg-background"
      onPointerDown={stopCellActivation}
      onBlur={(event) => {
        saveValue(event.target.value);
        onStopEditingCell();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function WorkspaceTableView({
  projection,
  visibleProperties,
  properties,
  selectValues,
  onProjectOpen,
  onCreateProperty,
  onRenameProperty,
  onDeleteProperty,
  onDismissFloatingMenus,
  onReorderViewProperties,
  onTogglePropertyVisibility,
  onProjectPropertyValueChange,
  onCreateSelectValue,
  onRenameSelectValue,
  onColorSelectValue,
  onDeleteSelectValue,
}: WorkspaceTableViewProps) {
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingPropertyName, setEditingPropertyName] = useState("");
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [openPropertyMenuId, setOpenPropertyMenuId] = useState<string | null>(null);
  const [openAddPropertyMenu, setOpenAddPropertyMenu] = useState(false);
  const [dropdownDismissToken, setDropdownDismissToken] = useState(0);
  const [columnDrag, setColumnDrag] = useState<ColumnDragState | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingColumn, setResizingColumn] = useState<{
    readonly propertyId: string;
    readonly startX: number;
    readonly startWidth: number;
  } | null>(null);
  const visiblePropertyIds = useMemo(
    () => new Set(visibleProperties.map((property) => property.id)),
    [visibleProperties],
  );
  const hiddenViewProperties = useMemo(
    () => properties.filter((property) => (
      !property.hidden &&
      !property.system &&
      !visiblePropertyIds.has(property.id)
    )),
    [properties, visiblePropertyIds],
  );
  const visiblePropertyWidths = useMemo(() => (
    Object.fromEntries(
      visibleProperties.map((property) => [
        property.id,
        columnWidths[property.id] ?? getDefaultPropertyColumnWidth(property),
      ]),
    ) as Record<string, number>
  ), [columnWidths, visibleProperties]);
  const tableWidth = useMemo(() => (
    rowHandleColumnWidth +
    addPropertyColumnWidth +
    visibleProperties.reduce((totalWidth, property) => totalWidth + visiblePropertyWidths[property.id], 0)
  ), [visibleProperties, visiblePropertyWidths]);

  useEffect(() => {
    const activeResize = resizingColumn;

    if (!activeResize) {
      return undefined;
    }

    const { propertyId, startX, startWidth } = activeResize;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function resizePropertyColumn(event: PointerEvent) {
      const nextWidth = clampPropertyColumnWidth(
        startWidth + event.clientX - startX,
      );

      setColumnWidths((currentColumnWidths) => ({
        ...currentColumnWidths,
        [propertyId]: nextWidth,
      }));
    }

    function finishPropertyColumnResize() {
      setResizingColumn(null);
    }

    window.addEventListener("pointermove", resizePropertyColumn);
    window.addEventListener("pointerup", finishPropertyColumnResize, { once: true });

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", resizePropertyColumn);
      window.removeEventListener("pointerup", finishPropertyColumnResize);
    };
  }, [resizingColumn]);

  function beginRenameProperty(property: WorkspaceMockVisibleProperty) {
    if (isSystemProperty(property.id)) {
      return;
    }

    setEditingPropertyId(property.id);
    setEditingPropertyName(property.name);
  }

  function commitRenameProperty(propertyId: string) {
    const name = editingPropertyName.trim();
    setEditingPropertyId(null);
    setEditingPropertyName("");

    if (name) {
      onRenameProperty(propertyId, name);
    }
  }

  function createPropertyFromType(option: PropertyTypeOption) {
    onCreateProperty({ name: option.label, type: option.value });
  }

  function blurActiveEditingCell() {
    if (!editingCellId) {
      return;
    }

    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      activeElement.blur();
      return;
    }

    setEditingCellId(null);
  }

  function dismissHeaderTransientState() {
    blurActiveEditingCell();
    setOpenPropertyMenuId(null);
    setOpenAddPropertyMenu(false);
    setDropdownDismissToken((currentToken) => currentToken + 1);
    onDismissFloatingMenus();
  }

  function openProjectFromNameCell(project: WorkspaceMockProject) {
    onProjectOpen(project);
  }

  function getReorderedPropertyIds(sourcePropertyId: string, dropIndex: number) {
    const orderedPropertyIds = visibleProperties.map((property) => property.id);
    const fromIndex = orderedPropertyIds.indexOf(sourcePropertyId);

    if (fromIndex === -1) {
      return null;
    }

    const nextPropertyIds = getColumnDragOrder(orderedPropertyIds, sourcePropertyId, dropIndex);

    if (nextPropertyIds.every((propertyId, index) => propertyId === orderedPropertyIds[index])) {
      return null;
    }

    return nextPropertyIds;
  }

  function reorderColumnToIndex(sourcePropertyId: string, dropIndex: number) {
    const nextPropertyIds = getReorderedPropertyIds(sourcePropertyId, dropIndex);

    if (nextPropertyIds) {
      onReorderViewProperties(nextPropertyIds);
    }
  }

  function startColumnResize(
    event: ReactPointerEvent<HTMLButtonElement>,
    property: WorkspaceMockVisibleProperty,
  ) {
    event.preventDefault();
    event.stopPropagation();

    setResizingColumn({
      propertyId: property.id,
      startX: event.clientX,
      startWidth: visiblePropertyWidths[property.id],
    });
  }

  function getColumnDragPreviewColumns() {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-property-column-id]"))
      .map((column) => {
        const propertyId = column.dataset.propertyColumnId;
        const rect = column.getBoundingClientRect();

        if (!propertyId) {
          return null;
        }

        return {
          propertyId,
          left: rect.left,
          width: rect.width,
        };
      })
      .filter((column): column is ColumnDragPreviewColumn => column !== null);
  }

  function findColumnDragTarget(clientX: number, columns: readonly ColumnDragPreviewColumn[]) {
    let dropIndex = 0;

    for (const column of columns) {
      if (clientX >= column.left + column.width / 2) {
        dropIndex += 1;
      }
    }

    return dropIndex;
  }

  function findColumnDropIndex(
    clientX: number,
    columns: readonly ColumnDragPreviewColumn[],
    sourcePropertyId: string,
  ) {
    return findColumnDragTarget(
      clientX,
      columns.filter((column) => column.propertyId !== sourcePropertyId),
    );
  }

  function getColumnDragOrder(
    orderedPropertyIds: readonly string[],
    sourcePropertyId: string,
    dropIndex: number,
  ) {
    const remainingPropertyIds = orderedPropertyIds.filter((propertyId) => propertyId !== sourcePropertyId);
    const boundedDropIndex = Math.min(Math.max(dropIndex, 0), remainingPropertyIds.length);
    return [
      ...remainingPropertyIds.slice(0, boundedDropIndex),
      sourcePropertyId,
      ...remainingPropertyIds.slice(boundedDropIndex),
    ];
  }

  function getColumnDragLefts(
    orderedPropertyIds: readonly string[],
    columns: readonly ColumnDragPreviewColumn[],
  ) {
    const columnById = new Map<string, ColumnDragPreviewColumn>();

    for (const column of columns) {
      columnById.set(column.propertyId, column);
    }

    const firstColumnLeft = columns[0]?.left ?? 0;
    const lefts = new Map<string, number>();
    let nextLeft = firstColumnLeft;

    for (const propertyId of orderedPropertyIds) {
      lefts.set(propertyId, nextLeft);
      nextLeft += columnById.get(propertyId)?.width
        ?? visiblePropertyWidths[propertyId]
        ?? defaultCustomPropertyColumnWidth;
    }

    return lefts;
  }

  function getColumnHeaderDragStyle(propertyId: string): CSSProperties | undefined {
    if (!columnDrag) {
      return undefined;
    }

    const orderedPropertyIds = visibleProperties.map((property) => property.id);
    const currentColumn = columnDrag.columns.find((column) => column.propertyId === propertyId);

    if (!currentColumn || !orderedPropertyIds.includes(propertyId)) {
      return undefined;
    }

    if (propertyId === columnDrag.propertyId) {
      return {
        transform: `translateX(${columnDrag.currentX - columnDrag.startX}px)`,
        transitionDuration: "0ms",
        pointerEvents: "none",
        zIndex: 30,
      };
    }

    const previewOrder = getColumnDragOrder(
      orderedPropertyIds,
      columnDrag.propertyId,
      columnDrag.dropIndex,
    );
    const previewLefts = getColumnDragLefts(previewOrder, columnDrag.columns);
    const previewLeft = previewLefts.get(propertyId);

    if (previewLeft === undefined) {
      return undefined;
    }

    const offset = previewLeft - currentColumn.left;

    if (Math.abs(offset) < 0.5) {
      return undefined;
    }

    return {
      transform: `translateX(${offset}px)`,
      transitionDuration: "180ms",
    };
  }

  function startPointerColumnDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    propertyId: string,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const columnDragPreviewColumns = getColumnDragPreviewColumns();
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    let frameId = 0;
    let pendingClientX = event.clientX;

    setOpenPropertyMenuId(null);
    setColumnDrag({
      propertyId,
      startX: event.clientX,
      currentX: event.clientX,
      dropIndex: findColumnDropIndex(event.clientX, columnDragPreviewColumns, propertyId),
      columns: columnDragPreviewColumns,
    });

    function updatePointerDraggedColumn() {
      frameId = 0;

      const dropIndex = findColumnDropIndex(
        pendingClientX,
        columnDragPreviewColumns,
        propertyId,
      );

      setColumnDrag((currentColumnDrag) => {
        if (!currentColumnDrag || currentColumnDrag.propertyId !== propertyId) {
          return currentColumnDrag;
        }

        return {
          ...currentColumnDrag,
          currentX: pendingClientX,
          dropIndex,
        };
      });
    }

    function movePointerDraggedColumn(pointerEvent: PointerEvent) {
      pendingClientX = pointerEvent.clientX;

      if (frameId === 0) {
        frameId = window.requestAnimationFrame(updatePointerDraggedColumn);
      }
    }

    function finishPointerDraggedColumn(pointerEvent: PointerEvent) {
      const dropIndex = findColumnDropIndex(
        pointerEvent.clientX,
        columnDragPreviewColumns,
        propertyId,
      );

      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", movePointerDraggedColumn);
      window.cancelAnimationFrame(frameId);
      setColumnDrag(null);

      if (Math.abs(pointerEvent.clientX - event.clientX) > 4) {
        reorderColumnToIndex(propertyId, dropIndex);
      }
    }

    window.addEventListener("pointermove", movePointerDraggedColumn);
    window.addEventListener("pointerup", finishPointerDraggedColumn, { once: true });
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-0 pt-4" aria-label="Workspace table">
      <div className="min-h-0 w-full flex-1 overflow-auto rounded-lg border border-border/45 bg-background/15">
        <Table className="table-fixed" style={{ width: tableWidth }}>
          <colgroup>
            <col style={{ width: rowHandleColumnWidth }} />
            {visibleProperties.map((property) => (
              <col key={property.id} style={{ width: visiblePropertyWidths[property.id] }} />
            ))}
            <col style={{ width: addPropertyColumnWidth }} />
          </colgroup>
          <TableHeader
            className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
            onPointerDownCapture={dismissHeaderTransientState}
          >
            <TableRow className="h-11 hover:bg-transparent">
              <TableHead className="w-10 border-r border-border/45 bg-background/95" aria-label="Row reorder" />
              {visibleProperties.map((property) => {
                const propertyColumnWidth = visiblePropertyWidths[property.id];

                return (
                  <TableHead
                    key={property.id}
                    className={[
                      "group/column relative border-r border-border/45 bg-background/95 px-1",
                      columnDrag ? "transition-transform ease-out" : "",
                      columnDrag?.propertyId === property.id ? "bg-card shadow-lg" : "",
                    ].filter(Boolean).join(" ")}
                    data-property-column-id={property.id}
                    style={{
                      width: propertyColumnWidth,
                      ...getColumnHeaderDragStyle(property.id),
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setOpenPropertyMenuId(property.id);
                    }}
                  >
                    {editingPropertyId === property.id ? (
                      <Input
                        value={editingPropertyName}
                        aria-label="Rename property"
                        className="h-7 w-full min-w-0 rounded-md px-1.5 text-sm"
                        autoFocus
                        onChange={(event) => setEditingPropertyName(event.target.value)}
                        onBlur={() => commitRenameProperty(property.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitRenameProperty(property.id);
                          }

                          if (event.key === "Escape") {
                            event.preventDefault();
                            setEditingPropertyId(null);
                            setEditingPropertyName("");
                          }
                        }}
                      />
                    ) : (
                      <DropdownMenu
                        open={openPropertyMenuId === property.id}
                        onOpenChange={(open) => setOpenPropertyMenuId(open ? property.id : null)}
                      >
                        <div className="flex min-w-0 items-center gap-1">
                          <button
                            type="button"
                            className="flex h-8 min-w-0 flex-1 cursor-grab items-center rounded-md px-2 text-left transition-colors hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring/40 active:cursor-grabbing"
                            aria-label={`Drag ${property.name} column`}
                            onPointerDown={(event) => startPointerColumnDrag(event, property.id)}
                          >
                            <span className="block min-w-0 truncate">{property.name}</span>
                          </button>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 focus-visible:ring-1 focus-visible:ring-ring/40 group-hover/column:opacity-100 group-focus-within/column:opacity-100 data-[state=open]:opacity-100"
                              aria-label={`${property.name} property actions`}
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
                            </button>
                          </DropdownMenuTrigger>
                        </div>
                        <DropdownMenuContent align="start" className="min-w-44">
                          <DropdownMenuItem disabled={isSystemProperty(property.id)} onSelect={() => beginRenameProperty(property)}>
                            Rename property
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isSystemProperty(property.id)}
                            onSelect={() => onTogglePropertyVisibility(property.id, false)}
                          >
                            Hide from view
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={isSystemProperty(property.id)}
                            variant="destructive"
                            onSelect={() => {
                              if (window.confirm(`Delete property "${property.name}"?`)) {
                                onDeleteProperty(property.id);
                              }
                            }}
                          >
                            Delete property
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none rounded-sm hover:bg-primary/50"
                      aria-label={`Resize ${property.name} column`}
                      onPointerDown={(event) => startColumnResize(event, property)}
                    />
                  </TableHead>
                );
              })}
              <TableHead className="w-12 border-l border-border/45 bg-background/95">
                <DropdownMenu
                  open={openAddPropertyMenu}
                  onOpenChange={setOpenAddPropertyMenu}
                >
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Add property column">
                      <PlusIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 p-1.5">
                    <DropdownMenuLabel>Add property</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      {propertyTypeOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          className="items-start gap-2 py-2"
                          onSelect={() => createPropertyFromType(option)}
                        >
                          {renderPropertyTypeIcon(option.value)}
                          <span className="grid min-w-0 gap-0.5">
                            <span className="truncate font-medium">{option.label}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    {hiddenViewProperties.length > 0 ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Hidden in this view</DropdownMenuLabel>
                          {hiddenViewProperties.map((property) => (
                            <DropdownMenuItem
                              key={property.id}
                              onSelect={() => onTogglePropertyVisibility(property.id, true)}
                            >
                              Show {property.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projection.rows.map((project) => (
              <TableRow
                key={project.id}
                className="h-10 hover:bg-accent/15"
              >
                <TableCell className="h-10 w-10 border-r border-border/45 py-0 text-muted-foreground/80">
                  <GripVerticalIcon className="size-4" aria-hidden="true" />
                </TableCell>
                {visibleProperties.map((property) => {
                  const editable = isEditableProperty(property);

                  return (
                    <TableCell
                      key={property.id}
                      className={getBodyCellClassName(property, editable)}
                      style={{ width: visiblePropertyWidths[property.id] }}
                    >
                      {editable ? (
                        <ProjectTablePropertyValueEditor
                          project={project}
                          property={property}
                          selectValues={selectValues}
                          editing={editingCellId === getProjectPropertyCellId(project.id, property.id)}
                          dismissSignal={dropdownDismissToken}
                          onProjectPropertyValueChange={onProjectPropertyValueChange}
                          onCreateSelectValue={onCreateSelectValue}
                          onRenameSelectValue={onRenameSelectValue}
                          onColorSelectValue={onColorSelectValue}
                          onDeleteSelectValue={onDeleteSelectValue}
                          onStartEditingCell={setEditingCellId}
                          onStopEditingCell={() => setEditingCellId(null)}
                        />
                      ) : property.id === "property:name" ? (
                        <button
                          type="button"
                          className="flex h-8 w-full min-w-0 items-center justify-start rounded-md px-2 text-left font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
                          onClick={() => openProjectFromNameCell(project)}
                        >
                          <span className="truncate">
                            {formatPropertyValue(getPropertyValue(project, property), property, selectValues)}
                          </span>
                        </button>
                      ) : property.id === "property:status" ? (
                        renderTableStatusValue(getPropertyValue(project, property))
                      ) : (
                        formatPropertyValue(getPropertyValue(project, property), property, selectValues)
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="h-10 border-l border-border/45 bg-background/30 py-0" aria-hidden="true" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
