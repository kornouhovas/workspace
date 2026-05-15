import { useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { GripVerticalIcon, MoreHorizontalIcon, PlusIcon } from "@/lib/lucide-icons";
import type { WorkspaceCustomPropertyType } from "@/components/workspace/property-controls";
import type { WorkspaceMockProject, WorkspaceMockVisibleProperty } from "@/workspaceMockData";
import type { WorkspacePropertyDefinitionState, WorkspaceSelectValueState } from "@/workspaceAppState";

type WorkspaceTableProjection = {
  readonly rows: readonly WorkspaceMockProject[];
};

type PropertyTypeOption = {
  readonly value: WorkspaceCustomPropertyType;
  readonly label: string;
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
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "multi-select", label: "Multi-select" },
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

  function reorderColumnFromTo(sourcePropertyId: string, targetPropertyId: string) {
    if (sourcePropertyId === targetPropertyId) {
      return;
    }

    const orderedPropertyIds = visibleProperties.map((property) => property.id);
    const fromIndex = orderedPropertyIds.indexOf(sourcePropertyId);
    const toIndex = orderedPropertyIds.indexOf(targetPropertyId);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    const nextPropertyIds = [...orderedPropertyIds];
    const [draggedId] = nextPropertyIds.splice(fromIndex, 1);
    nextPropertyIds.splice(toIndex, 0, draggedId);
    onReorderViewProperties(nextPropertyIds);
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

  function startPointerColumnDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    propertyId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();

    let lastTargetPropertyId = propertyId;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    function movePointerDraggedColumn(pointerEvent: PointerEvent) {
      const targetColumn = document
        .elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
        ?.closest<HTMLElement>("[data-property-column-id]");
      const targetPropertyId = targetColumn?.dataset.propertyColumnId;

      if (targetPropertyId && targetPropertyId !== lastTargetPropertyId) {
        lastTargetPropertyId = targetPropertyId;
        reorderColumnFromTo(propertyId, targetPropertyId);
      }
    }

    function finishPointerDraggedColumn() {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", movePointerDraggedColumn);
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
                    className="group/column relative border-r border-border/50 pl-8"
                    data-property-column-id={property.id}
                    style={{ width: propertyColumnWidth }}
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="group relative flex h-8 w-full min-w-0 cursor-grab items-center rounded-md text-left hover:bg-muted active:cursor-grabbing"
                            aria-label={`${property.name} property actions`}
                          >
                            <span className="block min-w-0 truncate pr-7">{property.name}</span>
                            <MoreHorizontalIcon className="absolute right-1 top-1/2 size-3.5 -translate-y-1/2 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
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
                      className="absolute left-1 top-1/2 z-20 flex size-5 -translate-y-1/2 cursor-grab items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                      aria-label={`Drag ${property.name} column`}
                      onPointerDown={(event) => startPointerColumnDrag(event, property.id)}
                    >
                      <GripVerticalIcon className="size-3.5" aria-hidden="true" />
                    </button>
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
                  <DropdownMenuContent align="end" className="w-52 p-1">
                    <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Add property</p>
                    {propertyTypeOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onSelect={() => createPropertyFromType(option)}
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                    {hiddenViewProperties.length > 0 ? (
                      <>
                        <DropdownMenuSeparator />
                        <div className="grid gap-1">
                          <p className="px-1 text-xs font-medium text-muted-foreground">Hidden in this view</p>
                          {hiddenViewProperties.map((property) => (
                            <DropdownMenuItem
                              key={property.id}
                              onSelect={() => onTogglePropertyVisibility(property.id, true)}
                            >
                              Show {property.name}
                            </DropdownMenuItem>
                          ))}
                        </div>
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
