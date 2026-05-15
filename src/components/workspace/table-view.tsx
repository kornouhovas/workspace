import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

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
  readonly targetPropertyId: string;
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
  readonly onReorderViewProperties: (orderedPropertyIds: readonly string[]) => void;
  readonly onTogglePropertyVisibility: (propertyId: string, visible: boolean) => void;
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

export function WorkspaceTableView({
  projection,
  visibleProperties,
  properties,
  selectValues,
  onProjectOpen,
  onCreateProperty,
  onRenameProperty,
  onDeleteProperty,
  onReorderViewProperties,
  onTogglePropertyVisibility,
}: WorkspaceTableViewProps) {
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingPropertyName, setEditingPropertyName] = useState("");
  const [openPropertyMenuId, setOpenPropertyMenuId] = useState<string | null>(null);
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

  function getReorderedPropertyIds(sourcePropertyId: string, targetPropertyId: string) {
    if (sourcePropertyId === targetPropertyId) {
      return null;
    }

    const orderedPropertyIds = visibleProperties.map((property) => property.id);
    const fromIndex = orderedPropertyIds.indexOf(sourcePropertyId);
    const toIndex = orderedPropertyIds.indexOf(targetPropertyId);

    if (fromIndex === -1 || toIndex === -1) {
      return null;
    }

    const nextPropertyIds = [...orderedPropertyIds];
    const [draggedId] = nextPropertyIds.splice(fromIndex, 1);
    nextPropertyIds.splice(toIndex, 0, draggedId);
    return nextPropertyIds;
  }

  function reorderColumnFromTo(sourcePropertyId: string, targetPropertyId: string) {
    const nextPropertyIds = getReorderedPropertyIds(sourcePropertyId, targetPropertyId);

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
    if (columns.length === 0) {
      return null;
    }

    let targetPropertyId = columns[0].propertyId;

    for (const column of columns) {
      if (clientX >= column.left + column.width / 2) {
        targetPropertyId = column.propertyId;
      }
    }

    return targetPropertyId;
  }

  function findColumnDragTargetFromPoint(clientX: number, clientY: number, sourcePropertyId: string) {
    for (const element of document.elementsFromPoint(clientX, clientY)) {
      const column = element.closest<HTMLElement>("[data-property-column-id]");
      const targetPropertyId = column?.dataset.propertyColumnId;

      if (targetPropertyId && targetPropertyId !== sourcePropertyId) {
        return targetPropertyId;
      }
    }

    return null;
  }

  function getColumnHeaderDragStyle(propertyId: string): CSSProperties | undefined {
    if (!columnDrag) {
      return undefined;
    }

    const sourceIndex = visibleProperties.findIndex((property) => property.id === columnDrag.propertyId);
    const targetIndex = visibleProperties.findIndex((property) => property.id === columnDrag.targetPropertyId);
    const currentIndex = visibleProperties.findIndex((property) => property.id === propertyId);
    const sourceColumnWidth = columnDrag.columns.find((column) => (
      column.propertyId === columnDrag.propertyId
    ))?.width ?? visiblePropertyWidths[columnDrag.propertyId] ?? defaultCustomPropertyColumnWidth;

    if (sourceIndex === -1 || targetIndex === -1 || currentIndex === -1) {
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

    if (sourceIndex < targetIndex && currentIndex > sourceIndex && currentIndex <= targetIndex) {
      return {
        transform: `translateX(${-sourceColumnWidth}px)`,
        transitionDuration: "160ms",
      };
    }

    if (sourceIndex > targetIndex && currentIndex >= targetIndex && currentIndex < sourceIndex) {
      return {
        transform: `translateX(${sourceColumnWidth}px)`,
        transitionDuration: "160ms",
      };
    }

    return undefined;
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

    setOpenPropertyMenuId(null);
    setColumnDrag({
      propertyId,
      startX: event.clientX,
      currentX: event.clientX,
      targetPropertyId: propertyId,
      columns: columnDragPreviewColumns,
    });

    function movePointerDraggedColumn(pointerEvent: PointerEvent) {
      const targetPropertyId = findColumnDragTargetFromPoint(
        pointerEvent.clientX,
        pointerEvent.clientY,
        propertyId,
      ) ?? findColumnDragTarget(pointerEvent.clientX, columnDragPreviewColumns) ?? propertyId;

      setColumnDrag((currentColumnDrag) => {
        if (!currentColumnDrag || currentColumnDrag.propertyId !== propertyId) {
          return currentColumnDrag;
        }

        return {
          ...currentColumnDrag,
          currentX: pointerEvent.clientX,
          targetPropertyId,
        };
      });
    }

    function finishPointerDraggedColumn(pointerEvent: PointerEvent) {
      const targetPropertyId = findColumnDragTargetFromPoint(
        pointerEvent.clientX,
        pointerEvent.clientY,
        propertyId,
      ) ?? findColumnDragTarget(pointerEvent.clientX, columnDragPreviewColumns);

      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", movePointerDraggedColumn);
      setColumnDrag(null);

      if (targetPropertyId && Math.abs(pointerEvent.clientX - event.clientX) > 4) {
        reorderColumnFromTo(propertyId, targetPropertyId);
      }
    }

    window.addEventListener("pointermove", movePointerDraggedColumn);
    window.addEventListener("pointerup", finishPointerDraggedColumn, { once: true });
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden gap-3 pl-4 pr-4 pt-4 pb-0" aria-labelledby="workspace-table-heading">
      <div>
        <h2 id="workspace-table-heading" className="text-sm font-semibold">
          Table
        </h2>
        <p className="text-xs text-muted-foreground">Rows use the same project set as the Board projection.</p>
      </div>
      <div className="min-h-0 w-full flex-1 overflow-auto">
        <Table className="table-fixed" style={{ width: tableWidth }}>
          <colgroup>
            <col style={{ width: rowHandleColumnWidth }} />
            {visibleProperties.map((property) => (
              <col key={property.id} style={{ width: visiblePropertyWidths[property.id] }} />
            ))}
            <col style={{ width: addPropertyColumnWidth }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" aria-label="Row reorder" />
              {visibleProperties.map((property) => {
                const propertyColumnWidth = visiblePropertyWidths[property.id];

                return (
                  <TableHead
                    key={property.id}
                    className={[
                      "group/column relative border-r border-border/50",
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
                            className="flex h-8 min-w-0 flex-1 cursor-grab items-center rounded-md text-left hover:bg-muted active:cursor-grabbing"
                            aria-label={`Drag ${property.name} column`}
                            onPointerDown={(event) => startPointerColumnDrag(event, property.id)}
                          >
                            <span className="block min-w-0 truncate pr-7">{property.name}</span>
                          </button>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
              <TableHead className="w-12 border-l border-border bg-background">
                <DropdownMenu>
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
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => onProjectOpen(project)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onProjectOpen(project);
                  }
                }}
              >
                <TableCell className="w-10 text-muted-foreground">
                  <GripVerticalIcon className="size-4" aria-hidden="true" />
                </TableCell>
                {visibleProperties.map((property) => (
                  <TableCell
                    key={property.id}
                    className="truncate border-r border-border/40"
                    style={{ width: visiblePropertyWidths[property.id] }}
                  >
                    {formatPropertyValue(getPropertyValue(project, property), property, selectValues)}
                  </TableCell>
                ))}
                <TableCell className="border-l border-border bg-background" aria-hidden="true" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
