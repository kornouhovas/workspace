import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { WorkspaceTextValueTextarea } from "@/components/workspace/text-value-editor";
import {
  CalendarIcon,
  CircleDotIcon,
  EyeIcon,
  EyeOffIcon,
  HashIcon,
  ListChecksIcon,
  ListFilterIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TypeIcon,
} from "@/lib/lucide-icons";
import {
  workspaceMenuCheckboxClassName,
  workspaceMenuContentClassName,
  workspaceMenuDangerIconClassName,
  workspaceMenuDangerItemClassName,
  workspaceMenuDescriptionClassName,
  workspaceMenuIconClassName,
  workspaceMenuItemClassName,
  workspaceMenuLabelClassName,
  workspaceMenuOptionItemClassName,
  workspaceMenuSeparatorClassName,
} from "@/components/workspace/menu-styles";
import type { WorkspaceCustomPropertyType } from "@/components/workspace/property-controls";
import type { WorkspaceMockProject, WorkspaceMockVisibleProperty } from "@/workspaceMockData";
import type {
  WorkspaceProjectionResponse,
  WorkspacePropertyDefinitionState,
  WorkspaceSelectValueState,
  WorkspaceViewState,
} from "@/workspaceAppState";

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

type PropertyMenuAnchorState = {
  readonly left: number;
  readonly top: number;
};

type WorkspaceFilterValue = {
  readonly id: string;
  readonly name: string;
};

type WorkspaceTableViewProps = {
  readonly projection: WorkspaceTableProjection;
  readonly view: WorkspaceViewState | null;
  readonly visibleProperties: readonly WorkspaceMockVisibleProperty[];
  readonly properties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly statusValues: WorkspaceProjectionResponse["statusValues"];
  readonly onProjectOpen: (project: WorkspaceMockProject) => void;
  readonly onCreateProperty: (input: { name: string; type: WorkspaceCustomPropertyType }) => void;
  readonly onRenameProperty: (propertyId: string, name: string) => void;
  readonly onDeleteProperty: (propertyId: string) => void;
  readonly onDismissFloatingMenus: () => void;
  readonly onReorderViewProperties: (orderedPropertyIds: readonly string[]) => void;
  readonly onTogglePropertyVisibility: (propertyId: string, visible: boolean) => void;
  readonly onToggleValueFilter: (propertyId: string, valueId: string, included: boolean) => void;
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

const addPropertyColumnWidth = 48;
const minimumPropertyColumnWidth = 132;
const maximumPropertyColumnWidth = 520;
const defaultCustomPropertyColumnWidth = 180;
const tableColumnDividerClassName = "shadow-[inset_-1px_0_0_var(--border)]";
const propertyMenuWidth = 240;
const propertyMenuOffset = 4;
const propertyMenuViewportMargin = 8;

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
    return project.status
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

function isRequiredViewProperty(propertyId: string) {
  return propertyId === "property:name";
}

function isPropertyMenuTarget(target: EventTarget | null) {
  return target instanceof Element
    && Boolean(target.closest("[data-workspace-property-menu='true'], [data-workspace-property-menu-trigger='true']"));
}

function clampPropertyMenuLeft(left: number) {
  const viewportWidth = window.innerWidth || propertyMenuWidth;
  const maxLeft = Math.max(
    propertyMenuViewportMargin,
    viewportWidth - propertyMenuWidth - propertyMenuViewportMargin,
  );

  return Math.min(Math.max(left, propertyMenuViewportMargin), maxLeft);
}

function createPropertyMenuAnchor(rect: DOMRect): PropertyMenuAnchorState {
  return {
    left: clampPropertyMenuLeft(rect.left),
    top: Math.max(rect.bottom + propertyMenuOffset, propertyMenuViewportMargin),
  };
}

function createPropertyMenuAnchorFromPoint(clientX: number, clientY: number): PropertyMenuAnchorState {
  return {
    left: clampPropertyMenuLeft(clientX),
    top: Math.max(clientY + propertyMenuOffset, propertyMenuViewportMargin),
  };
}

function isEditableProperty(property: WorkspaceMockVisibleProperty) {
  return !isSystemProperty(property.id) && property.system !== true;
}

function canRenameProperty(property: WorkspaceMockVisibleProperty) {
  return property.id === "property:name" || property.id === "property:status" || isEditableProperty(property);
}

function isFilterableProperty(property: WorkspaceMockVisibleProperty) {
  return property.id === "property:status"
    || property.propertyType === "select"
    || property.propertyType === "multi-select";
}

function getFilterValues(
  property: WorkspaceMockVisibleProperty,
  selectValues: readonly WorkspaceSelectValueState[],
  statusValues: WorkspaceProjectionResponse["statusValues"],
): readonly WorkspaceFilterValue[] {
  if (property.id === "property:status") {
    return statusValues.map((statusValue) => ({
      id: statusValue.id,
      name: statusValue.name,
    }));
  }

  return selectValues
    .filter((selectValue) => selectValue.propertyId === property.id && !selectValue.hidden)
    .map((selectValue) => ({
      id: selectValue.id,
      name: selectValue.name,
    }));
}

function hasActiveValueFilter(
  propertyId: string,
  valueVisibility: WorkspaceViewState["valueVisibility"] | undefined,
) {
  return (valueVisibility?.[propertyId]?.valueIds?.length ?? 0) > 0;
}

function getBodyCellClassName(property: WorkspaceMockVisibleProperty, editable: boolean) {
  if (property.id === "property:name") {
    return `h-10 ${tableColumnDividerClassName} p-0.5`;
  }

  if (property.id === "property:status") {
    return `h-10 ${tableColumnDividerClassName} p-0.5`;
  }

  if (property.propertyType === "text") {
    return `h-10 ${tableColumnDividerClassName} whitespace-normal align-top p-0.5`;
  }

  return editable
    ? `h-10 ${tableColumnDividerClassName} p-0.5`
    : `h-10 ${tableColumnDividerClassName} truncate px-3 py-0`;
}

function renderTableStatusValue(value: unknown) {
  const statusValue = value && typeof value === "object" && !Array.isArray(value)
    ? value as { readonly name?: unknown; readonly color?: unknown }
    : null;
  const label = statusValue ? String(statusValue.name || "") : value == null ? "" : String(value);
  const color = typeof statusValue?.color === "string" && statusValue.color ? statusValue.color : "gray";

  if (!label) {
    return "";
  }

  return (
    <div className="workspace-table-cell-control flex h-8 w-full min-w-0 items-center justify-start rounded-md px-2 transition-colors">
      <Badge
        variant="secondary"
        className="workspace-table-value-chip h-6 max-w-full cursor-default select-none gap-1.5 rounded-md border border-border/50 bg-secondary/70 px-2 text-[13px] font-medium"
      >
        <span className="size-2 rounded-full bg-muted-foreground/70" data-color={color} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </Badge>
    </div>
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
        className="workspace-table-cell-display workspace-table-cell-control flex h-8 w-full min-w-0 items-center justify-start rounded-md px-2 text-left text-sm text-foreground transition-colors focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
        onClick={startCellEditing}
        onPointerDown={stopCellActivation}
      >
        <span className="workspace-table-text-value min-w-0 truncate rounded-md px-1 py-0.5">{label}</span>
      </button>
    );
  }

  function renderTextCellDisplay(label: string) {
    return (
      <button
        type="button"
        className="workspace-table-cell-display workspace-table-cell-control flex min-h-8 w-full min-w-0 items-start justify-start rounded-md px-2 py-1 text-left text-sm text-foreground transition-colors focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
        onClick={startCellEditing}
        onPointerDown={stopCellActivation}
      >
        <span className="workspace-table-text-value block w-full min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-md px-1 py-0.5">{label}</span>
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
        triggerClassName="workspace-table-cell-control h-8 w-full min-w-0 justify-start px-2 font-normal"
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
        triggerClassName="workspace-table-cell-control h-8 w-full min-w-0 justify-start px-2 font-normal"
        onValueChange={saveValue}
        onCreateSelectValue={onCreateSelectValue}
        onRenameSelectValue={onRenameSelectValue}
        onColorSelectValue={onColorSelectValue}
        onDeleteSelectValue={onDeleteSelectValue}
      />
    );
  }

  if (!editing) {
    return renderTextCellDisplay(stringifyEditableValue(value));
  }

  return (
    <WorkspaceTextValueTextarea
      key={editorKey}
      defaultValue={stringifyEditableValue(value)}
      aria-label={`${property.name} text value`}
      autoFocus
      className="min-h-8 min-w-0 border-transparent bg-transparent px-2 shadow-none focus-visible:border-ring focus-visible:bg-background"
      onPointerDown={stopCellActivation}
      onBlur={(event) => {
        saveValue(event.target.value);
        onStopEditingCell();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function WorkspaceTableView({
  projection,
  view,
  visibleProperties,
  properties,
  selectValues,
  statusValues,
  onProjectOpen,
  onCreateProperty,
  onRenameProperty,
  onDeleteProperty,
  onDismissFloatingMenus,
  onReorderViewProperties,
  onTogglePropertyVisibility,
  onToggleValueFilter,
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
  const [hoveredPropertyMenuTriggerId, setHoveredPropertyMenuTriggerId] = useState<string | null>(null);
  const [propertyMenuAnchor, setPropertyMenuAnchor] = useState<PropertyMenuAnchorState | null>(null);
  const [openAddPropertyMenu, setOpenAddPropertyMenu] = useState(false);
  const [dropdownDismissToken, setDropdownDismissToken] = useState(0);
  const [columnDrag, setColumnDrag] = useState<ColumnDragState | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingColumn, setResizingColumn] = useState<{
    readonly propertyId: string;
    readonly startX: number;
    readonly startWidth: number;
  } | null>(null);
  const valueVisibility = view?.valueVisibility || {};
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

  useEffect(() => {
    if (!openPropertyMenuId) {
      return undefined;
    }

    function closePropertyMenuOnOutsidePointerDown(event: PointerEvent) {
      if (isPropertyMenuTarget(event.target)) {
        return;
      }

      setOpenPropertyMenuId(null);
      setPropertyMenuAnchor(null);
    }

    function closePropertyMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenPropertyMenuId(null);
        setPropertyMenuAnchor(null);
      }
    }

    document.addEventListener("pointerdown", closePropertyMenuOnOutsidePointerDown, true);
    document.addEventListener("keydown", closePropertyMenuOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closePropertyMenuOnOutsidePointerDown, true);
      document.removeEventListener("keydown", closePropertyMenuOnEscape);
    };
  }, [openPropertyMenuId]);

  function beginRenameProperty(property: WorkspaceMockVisibleProperty) {
    if (!canRenameProperty(property)) {
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

  function closePropertyMenu() {
    setOpenPropertyMenuId(null);
    setPropertyMenuAnchor(null);
  }

  function setPropertyMenuTriggerHovered(propertyId: string, hovered: boolean) {
    setHoveredPropertyMenuTriggerId((currentPropertyId) => {
      if (hovered) {
        return propertyId;
      }

      return currentPropertyId === propertyId ? null : currentPropertyId;
    });
  }

  function openPropertyMenuFromElement(propertyId: string, element: HTMLElement) {
    setOpenPropertyMenuId(propertyId);
    setPropertyMenuAnchor(createPropertyMenuAnchor(element.getBoundingClientRect()));
  }

  function openPropertyMenuFromPoint(propertyId: string, clientX: number, clientY: number) {
    setOpenPropertyMenuId(propertyId);
    setPropertyMenuAnchor(createPropertyMenuAnchorFromPoint(clientX, clientY));
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

  function dismissHeaderTransientState(event: ReactPointerEvent<HTMLElement>) {
    if (isPropertyMenuTarget(event.target)) {
      return;
    }

    blurActiveEditingCell();
    closePropertyMenu();
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

    closePropertyMenu();
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
        <Table className="min-w-full table-fixed" style={{ minWidth: tableWidth }}>
          <colgroup>
            {visibleProperties.map((property) => (
              <col key={property.id} style={{ width: visiblePropertyWidths[property.id] }} />
            ))}
            <col aria-label="Add property filler column" />
          </colgroup>
          <TableHeader
            className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
            onPointerDownCapture={dismissHeaderTransientState}
          >
            <TableRow className="h-11 hover:bg-transparent">
              {visibleProperties.map((property) => {
                const propertyColumnWidth = visiblePropertyWidths[property.id];
                const selectedValueIds = new Set(valueVisibility[property.id]?.valueIds || []);
                const propertyFilterValues = getFilterValues(property, selectValues, statusValues);
                const showValueFilters = isFilterableProperty(property);
                const valueFilterActive = hasActiveValueFilter(property.id, valueVisibility);
                const propertyMenuTriggerActive = hoveredPropertyMenuTriggerId === property.id
                  || openPropertyMenuId === property.id;

                return (
                  <TableHead
                    key={property.id}
                    className={[
                      "group/column relative cursor-default select-none bg-background/95 px-1",
                      tableColumnDividerClassName,
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
                      openPropertyMenuFromPoint(property.id, event.clientX, event.clientY);
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
                      <>
                        <div
                          className={[
                            "flex h-8 min-w-0 items-center gap-1 rounded-md px-2 transition-colors",
                            propertyMenuTriggerActive ? "" : "hover:bg-muted/60 focus-within:bg-muted/60",
                          ].filter(Boolean).join(" ")}
                        >
                          <button
                            type="button"
                            className="flex h-full min-w-0 flex-1 cursor-grab items-center text-left focus-visible:ring-1 focus-visible:ring-ring/40 active:cursor-grabbing"
                            aria-label={`Drag ${property.name} column`}
                            onPointerDown={(event) => startPointerColumnDrag(event, property.id)}
                          >
                            <span className="block min-w-0 truncate">{property.name}</span>
                          </button>
                          {valueFilterActive ? (
                            <span
                              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground"
                              aria-label={`${property.name} value filter active`}
                              title={`${property.name} value filter active`}
                            >
                              <ListFilterIcon className="size-3.5" aria-hidden="true" />
                            </span>
                          ) : null}
                          <button
                            type="button"
                            data-workspace-property-menu-trigger="true"
                            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 focus-visible:ring-1 focus-visible:ring-ring/40 group-hover/column:opacity-100 group-focus-within/column:opacity-100 data-[state=open]:opacity-100"
                            aria-label={`${property.name} property actions`}
                            data-state={openPropertyMenuId === property.id ? "open" : "closed"}
                            onPointerEnter={() => setPropertyMenuTriggerHovered(property.id, true)}
                            onPointerLeave={() => setPropertyMenuTriggerHovered(property.id, false)}
                            onFocus={() => setPropertyMenuTriggerHovered(property.id, true)}
                            onBlur={() => setPropertyMenuTriggerHovered(property.id, false)}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (openPropertyMenuId === property.id) {
                                closePropertyMenu();
                                return;
                              }

                              openPropertyMenuFromElement(property.id, event.currentTarget);
                            }}
                          >
                            <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        {openPropertyMenuId === property.id && propertyMenuAnchor ? createPortal((
                          <div
                            data-workspace-property-menu="true"
                            role="menu"
                            aria-label={`${property.name} property actions`}
                            className={`fixed z-50 w-60 ${workspaceMenuContentClassName}`}
                            style={{ left: propertyMenuAnchor.left, top: propertyMenuAnchor.top }}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="grid gap-0.5">
                              <button
                                type="button"
                                role="menuitem"
                                disabled={!canRenameProperty(property)}
                                className={workspaceMenuItemClassName}
                                onClick={() => {
                                  beginRenameProperty(property);
                                  closePropertyMenu();
                                }}
                              >
                                <PencilIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                                Rename property
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={isRequiredViewProperty(property.id)}
                                className={workspaceMenuItemClassName}
                                onClick={() => {
                                  onTogglePropertyVisibility(property.id, false);
                                  closePropertyMenu();
                                }}
                              >
                                <EyeOffIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                                Hide from view
                              </button>
                            </div>
                            {showValueFilters ? (
                              <>
                                <div className={workspaceMenuSeparatorClassName} />
                                <div className="grid gap-1" aria-label={`${property.name} value filters`}>
                                  <p className={`${workspaceMenuLabelClassName} flex items-center gap-2`}>
                                    <ListFilterIcon className="size-3.5" aria-hidden="true" />
                                    Value filters
                                  </p>
                                  <div className="grid max-h-52 gap-0.5 overflow-auto px-1 pb-1">
                                    {propertyFilterValues.length > 0 ? propertyFilterValues.map((filterValue) => {
                                      const filterValueChecked = selectedValueIds.has(filterValue.id);

                                      return (
                                        <label
                                          key={filterValue.id}
                                          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-muted/40"
                                        >
                                          <Checkbox
                                            checked={filterValueChecked}
                                            aria-label={`${filterValue.name} visible in ${property.name}`}
                                            className={workspaceMenuCheckboxClassName}
                                            onCheckedChange={(value) => onToggleValueFilter(property.id, filterValue.id, value === true)}
                                          />
                                          <span className="truncate">{filterValue.name}</span>
                                        </label>
                                      );
                                    }) : (
                                      <p className="px-1.5 py-1 text-xs text-muted-foreground">No values</p>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : null}
                            <div className={workspaceMenuSeparatorClassName} />
                            <button
                              type="button"
                              role="menuitem"
                              disabled={isSystemProperty(property.id)}
                              className={workspaceMenuDangerItemClassName}
                              onClick={() => {
                                closePropertyMenu();
                                if (window.confirm(`Delete property "${property.name}"?`)) {
                                  onDeleteProperty(property.id);
                                }
                              }}
                            >
                              <Trash2Icon className={workspaceMenuDangerIconClassName} aria-hidden="true" />
                              Delete property
                            </button>
                          </div>
                        ), document.body) : null}
                      </>
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
              <TableHead className="min-w-12 bg-background/95 shadow-[inset_1px_0_0_var(--border)]">
                <DropdownMenu
                  open={openAddPropertyMenu}
                  onOpenChange={setOpenAddPropertyMenu}
                >
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Add property column">
                      <PlusIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={`${workspaceMenuContentClassName} w-64`}>
                    <DropdownMenuLabel className={workspaceMenuLabelClassName}>Add property</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      {propertyTypeOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          className={workspaceMenuOptionItemClassName}
                          onSelect={() => createPropertyFromType(option)}
                        >
                          {renderPropertyTypeIcon(option.value)}
                          <span className="grid min-w-0 gap-0.5">
                            <span className="truncate font-medium">{option.label}</span>
                            <span className={workspaceMenuDescriptionClassName}>
                              {option.description}
                            </span>
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    {hiddenViewProperties.length > 0 ? (
                      <>
                        <DropdownMenuSeparator className={workspaceMenuSeparatorClassName} />
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className={workspaceMenuLabelClassName}>
                            Hidden in this view
                          </DropdownMenuLabel>
                          {hiddenViewProperties.map((property) => (
                            <DropdownMenuItem
                              key={property.id}
                              className={workspaceMenuItemClassName}
                              onSelect={() => onTogglePropertyVisibility(property.id, true)}
                            >
                              <EyeIcon className={workspaceMenuIconClassName} aria-hidden="true" />
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
          <TableBody className="[&_tr:last-child]:!border-b [&_tr:last-child]:!border-border/45">
            {projection.rows.map((project) => (
              <TableRow
                key={project.id}
                className="h-10 hover:bg-accent/15"
              >
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
                          className="workspace-table-cell-control flex h-8 w-full min-w-0 items-center justify-start rounded-md px-2 text-left font-medium text-foreground transition-colors focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
                          onClick={() => openProjectFromNameCell(project)}
                        >
                          <span className="workspace-table-text-value min-w-0 truncate rounded-md px-1 py-0.5">
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
                <TableCell className="h-10 min-w-12 bg-background/30 py-0 shadow-[inset_1px_0_0_var(--border)]" aria-hidden="true" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
