import { Fragment, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import {
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
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
import type {
  WorkspacePropertyDefinitionState,
  WorkspaceSelectValueState,
} from "@/workspaceAppState";

export type WorkspaceCustomPropertyType = "text" | "number" | "date" | "select" | "multi-select";

type WorkspacePropertyControlsProps = {
  readonly properties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly onCreateProperty: (input: { name: string; type: WorkspaceCustomPropertyType }) => void;
  readonly onRenameProperty: (propertyId: string, name: string) => void;
  readonly onHideProperty: (propertyId: string, hidden: boolean) => void;
  readonly onDeleteProperty: (propertyId: string) => void;
  readonly onReorderProperties: (orderedPropertyIds: readonly string[]) => void;
  readonly onCreateSelectValue: (propertyId: string, input: { name: string; color: string }) => void;
  readonly onRenameSelectValue: (selectValueId: string, name: string) => void;
  readonly onColorSelectValue: (selectValueId: string, color: string) => void;
  readonly onHideSelectValue: (selectValueId: string, hidden: boolean) => void;
  readonly onDeleteSelectValue: (selectValueId: string) => void;
  readonly onReorderSelectValues: (propertyId: string, orderedSelectValueIds: readonly string[]) => void;
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

const valueColorOptions = ["gray", "red", "orange", "yellow", "green", "blue", "purple"] as const;

function getPropertyTypeLabel(propertyType: string) {
  return propertyTypeOptions.find((option) => option.value === propertyType)?.label || "Text";
}

function isSelectProperty(property: WorkspacePropertyDefinitionState) {
  const propertyType = property.propertyType || property.type;
  return propertyType === "select" || propertyType === "multi-select";
}

export function WorkspacePropertyControls({
  properties,
  selectValues,
  onCreateProperty,
  onRenameProperty,
  onHideProperty,
  onDeleteProperty,
  onReorderProperties,
  onCreateSelectValue,
  onRenameSelectValue,
  onColorSelectValue,
  onHideSelectValue,
  onDeleteSelectValue,
  onReorderSelectValues,
}: WorkspacePropertyControlsProps) {
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyType, setNewPropertyType] = useState<WorkspaceCustomPropertyType>("text");
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingPropertyName, setEditingPropertyName] = useState("");
  const [draggedPropertyId, setDraggedPropertyId] = useState<string | null>(null);
  const [newSelectValueNames, setNewSelectValueNames] = useState<Record<string, string>>({});
  const [newSelectValueColors, setNewSelectValueColors] = useState<Record<string, string>>({});
  const [editingSelectValueId, setEditingSelectValueId] = useState<string | null>(null);
  const [editingSelectValueName, setEditingSelectValueName] = useState("");
  const [draggedSelectValueId, setDraggedSelectValueId] = useState<string | null>(null);
  const sortedProperties = useMemo(
    () => [...properties].sort((left, right) => (
      Number(left.order || 0) - Number(right.order || 0) || left.id.localeCompare(right.id)
    )),
    [properties],
  );
  const selectValuesByProperty = useMemo(() => {
    const groupedValues = new Map<string, WorkspaceSelectValueState[]>();

    for (const selectValue of selectValues) {
      const values = groupedValues.get(selectValue.propertyId) || [];
      values.push(selectValue);
      groupedValues.set(selectValue.propertyId, values);
    }

    for (const values of groupedValues.values()) {
      values.sort((left, right) => (
        Number(left.order || 0) - Number(right.order || 0) || left.id.localeCompare(right.id)
      ));
    }

    return groupedValues;
  }, [selectValues]);

  function createProperty() {
    const name = newPropertyName.trim();
    if (!name) {
      return;
    }

    onCreateProperty({ name, type: newPropertyType });
    setNewPropertyName("");
    setNewPropertyType("text");
  }

  function beginRenameProperty(property: WorkspacePropertyDefinitionState) {
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

  function reorderProperty(targetPropertyId: string) {
    if (!draggedPropertyId || draggedPropertyId === targetPropertyId) {
      setDraggedPropertyId(null);
      return;
    }

    const orderedPropertyIds = sortedProperties.map((property) => property.id);
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
    onReorderProperties(nextPropertyIds);
  }

  function createSelectValue(propertyId: string) {
    const name = (newSelectValueNames[propertyId] || "").trim();
    if (!name) {
      return;
    }

    onCreateSelectValue(propertyId, {
      name,
      color: newSelectValueColors[propertyId] || "gray",
    });
    setNewSelectValueNames((current) => ({ ...current, [propertyId]: "" }));
    setNewSelectValueColors((current) => ({ ...current, [propertyId]: "gray" }));
  }

  function beginRenameSelectValue(selectValue: WorkspaceSelectValueState) {
    setEditingSelectValueId(selectValue.id);
    setEditingSelectValueName(selectValue.name);
  }

  function commitRenameSelectValue(selectValueId: string) {
    const name = editingSelectValueName.trim();
    setEditingSelectValueId(null);
    setEditingSelectValueName("");

    if (name) {
      onRenameSelectValue(selectValueId, name);
    }
  }

  function reorderSelectValue(propertyId: string, targetSelectValueId: string) {
    const values = selectValuesByProperty.get(propertyId) || [];
    if (!draggedSelectValueId || draggedSelectValueId === targetSelectValueId) {
      setDraggedSelectValueId(null);
      return;
    }

    const orderedSelectValueIds = values.map((value) => value.id);
    const fromIndex = orderedSelectValueIds.indexOf(draggedSelectValueId);
    const toIndex = orderedSelectValueIds.indexOf(targetSelectValueId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedSelectValueId(null);
      return;
    }

    const nextSelectValueIds = [...orderedSelectValueIds];
    const [draggedId] = nextSelectValueIds.splice(fromIndex, 1);
    nextSelectValueIds.splice(toIndex, 0, draggedId);
    setDraggedSelectValueId(null);
    onReorderSelectValues(propertyId, nextSelectValueIds);
  }

  return (
    <section className="rounded-lg border border-border bg-card" aria-labelledby="workspace-properties-heading">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <h3 id="workspace-properties-heading" className="text-sm font-semibold">Properties</h3>
          <p className="truncate text-xs text-muted-foreground">Custom project fields for this Workspace</p>
        </div>
        <Badge variant="outline">{properties.length} fields</Badge>
      </div>
      <Separator />
      <div className="grid gap-3 p-3">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
          <Input
            value={newPropertyName}
            placeholder="Property name"
            aria-label="Property name"
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
            <SelectTrigger className="w-full" aria-label="Property type">
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
          <Button type="button" className="justify-center gap-2" onClick={createProperty}>
            <PlusIcon className="size-4" aria-hidden="true" />
            Add property
          </Button>
        </div>
        <ul className="grid gap-2">
          {sortedProperties.map((property) => {
            const isSystem = property.system === true;
            const isEditing = editingPropertyId === property.id;
            const propertySelectValues = selectValuesByProperty.get(property.id) || [];
            const propertySelectValueCount = propertySelectValues.length;

            return (
              <Fragment key={property.id}>
                <li
                  draggable={!isSystem}
                  onDragStart={() => setDraggedPropertyId(property.id)}
                  onDragOver={(event) => {
                    if (draggedPropertyId && !isSystem) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    reorderProperty(property.id);
                  }}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-muted/20 px-2 py-2"
                >
                  <span
                    className={[
                      "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground",
                      isSystem ? "opacity-40" : "cursor-grab hover:bg-muted",
                    ].join(" ")}
                    title={isSystem ? "System property order is fixed" : "Drag to reorder property"}
                  >
                    <GripVerticalIcon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    {isEditing ? (
                      <Input
                        value={editingPropertyName}
                        autoFocus
                        aria-label="Rename property"
                        onChange={(event) => setEditingPropertyName(event.target.value)}
                        onBlur={() => commitRenameProperty(property.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            commitRenameProperty(property.id);
                          }
                          if (event.key === "Escape") {
                            setEditingPropertyId(null);
                            setEditingPropertyName("");
                          }
                        }}
                      />
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{property.name}</span>
                        <Badge variant="secondary">{getPropertyTypeLabel(property.propertyType || property.type || "text")}</Badge>
                        {isSystem ? <Badge variant="outline">System</Badge> : null}
                        {property.hidden ? <Badge variant="outline">Hidden</Badge> : null}
                        {propertySelectValueCount > 0 ? (
                          <Badge variant="outline">{propertySelectValueCount} values</Badge>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Property actions for ${property.name}`}>
                        <MoreHorizontalIcon className="size-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className={`${workspaceMenuContentClassName} min-w-52`}>
                      <DropdownMenuItem
                        className={workspaceMenuItemClassName}
                        disabled={isSystem}
                        onSelect={() => beginRenameProperty(property)}
                      >
                        <PencilIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                        Rename property
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className={workspaceMenuItemClassName}
                        disabled={isSystem}
                        onSelect={() => onHideProperty(property.id, !property.hidden)}
                      >
                        {property.hidden ? (
                          <EyeIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                        ) : (
                          <EyeOffIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                        )}
                        {property.hidden ? "Show property" : "Hide property"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className={workspaceMenuSeparatorClassName} />
                      <DropdownMenuItem
                        className={workspaceMenuDangerItemClassName}
                        disabled={isSystem}
                        variant="destructive"
                        onSelect={() => onDeleteProperty(property.id)}
                      >
                        <Trash2Icon className={workspaceMenuDangerIconClassName} aria-hidden="true" />
                        Delete property
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
                {isSelectProperty(property) && !isSystem ? (
                  <li className="ml-9 grid gap-2 rounded-lg border border-border/70 bg-background/60 p-2">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
                      <Input
                        value={newSelectValueNames[property.id] || ""}
                        placeholder="Value name"
                        aria-label="Add select value"
                        onChange={(event) => {
                          setNewSelectValueNames((current) => ({
                            ...current,
                            [property.id]: event.target.value,
                          }));
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            createSelectValue(property.id);
                          }
                        }}
                      />
                      <Select
                        value={newSelectValueColors[property.id] || "gray"}
                        onValueChange={(color) => {
                          setNewSelectValueColors((current) => ({
                            ...current,
                            [property.id]: color,
                          }));
                        }}
                      >
                        <SelectTrigger className="w-full" aria-label="Color">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {valueColorOptions.map((color) => (
                            <SelectItem key={color} value={color}>
                              {color}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" className="justify-center" onClick={() => createSelectValue(property.id)}>
                        Add select value
                      </Button>
                    </div>
                    {propertySelectValues.length > 0 ? (
                      <ul className="grid gap-1">
                        {propertySelectValues.map((selectValue) => {
                          const isSelectValueEditing = editingSelectValueId === selectValue.id;
                          return (
                            <li
                              key={selectValue.id}
                              draggable
                              onDragStart={() => setDraggedSelectValueId(selectValue.id)}
                              onDragOver={(event) => {
                                if (draggedSelectValueId) {
                                  event.preventDefault();
                                }
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                reorderSelectValue(property.id, selectValue.id);
                              }}
                              className="grid grid-cols-[auto_minmax(0,1fr)_7rem_auto] items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/70"
                            >
                              <GripVerticalIcon className="size-4 cursor-grab text-muted-foreground" aria-hidden="true" />
                              {isSelectValueEditing ? (
                                <Input
                                  value={editingSelectValueName}
                                  autoFocus
                                  aria-label="Rename select value"
                                  onChange={(event) => setEditingSelectValueName(event.target.value)}
                                  onBlur={() => commitRenameSelectValue(selectValue.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      commitRenameSelectValue(selectValue.id);
                                    }
                                    if (event.key === "Escape") {
                                      setEditingSelectValueId(null);
                                      setEditingSelectValueName("");
                                    }
                                  }}
                                />
                              ) : (
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground" data-color={selectValue.color || "gray"} />
                                  <span className="truncate text-sm">{selectValue.name}</span>
                                  {selectValue.hidden ? <Badge variant="outline">Hidden</Badge> : null}
                                </div>
                              )}
                              <Select
                                value={selectValue.color || "gray"}
                                onValueChange={(color) => onColorSelectValue(selectValue.id, color)}
                              >
                                <SelectTrigger size="sm" className="w-full" aria-label={`Color for ${selectValue.name}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {valueColorOptions.map((color) => (
                                    <SelectItem key={color} value={color}>
                                      {color}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Select value actions for ${selectValue.name}`}>
                                    <MoreHorizontalIcon className="size-4" aria-hidden="true" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className={`${workspaceMenuContentClassName} min-w-56`}>
                                  <DropdownMenuItem
                                    className={workspaceMenuItemClassName}
                                    onSelect={() => beginRenameSelectValue(selectValue)}
                                  >
                                    <PencilIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                                    Rename select value
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className={workspaceMenuItemClassName}
                                    onSelect={() => onHideSelectValue(selectValue.id, !selectValue.hidden)}
                                  >
                                    {selectValue.hidden ? (
                                      <EyeIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                                    ) : (
                                      <EyeOffIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                                    )}
                                    {selectValue.hidden ? "Show select value" : "Hide select value"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className={workspaceMenuSeparatorClassName} />
                                  <DropdownMenuItem
                                    className={workspaceMenuDangerItemClassName}
                                    variant="destructive"
                                    onSelect={() => onDeleteSelectValue(selectValue.id)}
                                  >
                                    <Trash2Icon className={workspaceMenuDangerIconClassName} aria-hidden="true" />
                                    Delete select value
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                ) : null}
              </Fragment>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
