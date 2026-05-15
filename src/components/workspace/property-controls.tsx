import { useMemo, useState } from "react";

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
import { GripVerticalIcon, MoreHorizontalIcon, PlusIcon } from "@/lib/lucide-icons";
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

function getPropertyTypeLabel(propertyType: string) {
  return propertyTypeOptions.find((option) => option.value === propertyType)?.label || "Text";
}

export function WorkspacePropertyControls({
  properties,
  selectValues,
  onCreateProperty,
  onRenameProperty,
  onHideProperty,
  onDeleteProperty,
  onReorderProperties,
}: WorkspacePropertyControlsProps) {
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyType, setNewPropertyType] = useState<WorkspaceCustomPropertyType>("text");
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingPropertyName, setEditingPropertyName] = useState("");
  const [draggedPropertyId, setDraggedPropertyId] = useState<string | null>(null);
  const sortedProperties = useMemo(
    () => [...properties].sort((left, right) => (
      Number(left.order || 0) - Number(right.order || 0) || left.id.localeCompare(right.id)
    )),
    [properties],
  );

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
            const propertySelectValueCount = selectValues.filter((value) => value.propertyId === property.id).length;

            return (
              <li
                key={property.id}
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
                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuItem disabled={isSystem} onSelect={() => beginRenameProperty(property)}>
                      Rename property
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isSystem}
                      onSelect={() => onHideProperty(property.id, !property.hidden)}
                    >
                      {property.hidden ? "Show property" : "Hide property"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={isSystem}
                      variant="destructive"
                      onSelect={() => onDeleteProperty(property.id)}
                    >
                      Delete property
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
