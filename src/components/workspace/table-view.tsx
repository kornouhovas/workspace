import { useMemo, useState } from "react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const propertyTypeOptions: readonly {
  readonly value: WorkspaceCustomPropertyType;
  readonly label: string;
}[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Numbers" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "multi-select", label: "Multi-select" },
];

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
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyType, setNewPropertyType] = useState<WorkspaceCustomPropertyType>("text");
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingPropertyName, setEditingPropertyName] = useState("");
  const [draggedPropertyId, setDraggedPropertyId] = useState<string | null>(null);
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

  function createProperty() {
    const name = newPropertyName.trim();
    if (!name) {
      return;
    }

    onCreateProperty({ name, type: newPropertyType });
    setNewPropertyName("");
    setNewPropertyType("text");
  }

  function reorderColumn(targetPropertyId: string) {
    if (!draggedPropertyId || draggedPropertyId === targetPropertyId) {
      setDraggedPropertyId(null);
      return;
    }

    const orderedPropertyIds = visibleProperties.map((property) => property.id);
    const fromIndex = orderedPropertyIds.indexOf(draggedPropertyId);
    const toIndex = orderedPropertyIds.indexOf(targetPropertyId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedPropertyId(null);
      return;
    }

    const nextPropertyIds = [...orderedPropertyIds];
    const [draggedId] = nextPropertyIds.splice(fromIndex, 1);
    nextPropertyIds.splice(toIndex, 0, draggedId);
    setDraggedPropertyId(null);
    onReorderViewProperties(nextPropertyIds);
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden gap-3 pl-4 pr-4 pt-4 pb-0" aria-labelledby="workspace-table-heading">
      <div>
        <h2 id="workspace-table-heading" className="text-sm font-semibold">
          Table
        </h2>
        <p className="text-xs text-muted-foreground">Rows use the same project set as the Board projection.</p>
      </div>
      <div className="min-h-0 w-full flex-1 overflow-auto rounded-lg border border-border">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-9" aria-label="Row reorder" />
              {visibleProperties.map((property) => (
                <TableHead
                  key={property.id}
                  className="min-w-36"
                  draggable
                  onDragStart={() => setDraggedPropertyId(property.id)}
                  onDragOver={(event) => {
                    if (draggedPropertyId) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={() => reorderColumn(property.id)}
                >
                  {editingPropertyId === property.id ? (
                    <Input
                      value={editingPropertyName}
                      aria-label="Rename property"
                      className="h-7 min-w-36"
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
                          className="group inline-flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md px-1 text-left hover:bg-muted"
                          aria-label={`${property.name} property actions`}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <GripVerticalIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="truncate">{property.name}</span>
                          </span>
                          <MoreHorizontalIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden="true" />
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
                </TableHead>
              ))}
              <TableHead className="sticky right-0 z-20 w-12 border-l border-border bg-card">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Add property column">
                      <PlusIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 p-3">
                    <div className="grid gap-2">
                      <p className="text-sm font-medium">New property</p>
                      <Input
                        value={newPropertyName}
                        placeholder="Property name"
                        aria-label="New property name"
                        onChange={(event) => setNewPropertyName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            createProperty();
                          }
                        }}
                      />
                      <Select
                        value={newPropertyType}
                        onValueChange={(value) => {
                          if (
                            value === "text" ||
                            value === "number" ||
                            value === "date" ||
                            value === "select" ||
                            value === "multi-select"
                          ) {
                            setNewPropertyType(value);
                          }
                        }}
                      >
                        <SelectTrigger aria-label="New property type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {propertyTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" onClick={createProperty}>
                        Add property
                      </Button>
                    </div>
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
                <TableCell className="w-9 text-muted-foreground">
                  <GripVerticalIcon className="size-4" aria-hidden="true" />
                </TableCell>
                {visibleProperties.map((property) => (
                  <TableCell key={property.id} className="max-w-56 truncate">
                    {formatPropertyValue(getPropertyValue(project, property), property, selectValues)}
                  </TableCell>
                ))}
                <TableCell className="sticky right-0 border-l border-border bg-card" aria-hidden="true" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
