import { useEffect, useState } from "react";

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
import { ChevronDownIcon, ChevronRightIcon, Columns3Icon, MoreHorizontalIcon } from "@/lib/lucide-icons";
import type {
  WorkspacePropertyDefinitionState,
  WorkspaceProjectionResponse,
  WorkspaceSelectValueState,
  WorkspaceViewState,
} from "@/workspaceAppState";

type WorkspaceViewFilterMenuProps = {
  readonly view: WorkspaceViewState | null;
  readonly dismissSignal?: number;
  readonly properties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly statusValues: WorkspaceProjectionResponse["statusValues"];
  readonly onTogglePropertyVisibility: (propertyId: string, visible: boolean) => void;
  readonly onToggleValueFilter: (propertyId: string, valueId: string, included: boolean) => void;
  readonly onRenameProperty: (propertyId: string, name: string) => void;
  readonly onDeleteProperty: (propertyId: string) => void;
};

type WorkspaceFilterValue = {
  readonly id: string;
  readonly name: string;
};

function isSystemProperty(propertyId: string) {
  return propertyId === "property:name" || propertyId === "property:status";
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

function keepDropdownOpenForActionsPopover(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (event.target instanceof Element && event.target.closest("[data-workspace-actions-popover='true']")) {
    event.preventDefault();
  }
}

function stopActionMenuEvent(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

export function WorkspaceViewFilterMenu({
  view,
  dismissSignal,
  properties,
  selectValues,
  statusValues,
  onTogglePropertyVisibility,
  onToggleValueFilter,
  onRenameProperty,
  onDeleteProperty,
}: WorkspaceViewFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingPropertyName, setEditingPropertyName] = useState("");
  const [actionsPropertyId, setActionsPropertyId] = useState<string | null>(null);
  const [expandedFilterPropertyIds, setExpandedFilterPropertyIds] = useState<ReadonlySet<string>>(() => new Set());
  const visiblePropertyIds = new Set(view?.visiblePropertyIds || properties.map((property) => property.id));
  const valueVisibility = view?.valueVisibility || {};
  const filterableProperties = properties.filter(isFilterableProperty);

  useEffect(() => {
    setOpen(false);
    setActionsPropertyId(null);
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
    if (isSystemProperty(property.id)) {
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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="View property visibility and filters">
          <Columns3Icon className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 p-0"
        onInteractOutside={keepDropdownOpenForActionsPopover}
      >
        <div className="grid gap-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Visible properties</p>
              <p className="text-xs text-muted-foreground">Choose fields for this view</p>
            </div>
            <Badge variant="outline">{visiblePropertyIds.size}</Badge>
          </div>
          <div className="grid max-h-52 gap-1 overflow-auto pr-1">
            {properties.map((property) => {
              const checked = visiblePropertyIds.has(property.id);
              const disabled = isSystemProperty(property.id);

              return (
                <div key={property.id} className="grid min-w-0 gap-1">
                  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_minmax(5.75rem,auto)_1.75rem] items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      aria-label={`${property.name} visible`}
                      onCheckedChange={(value) => onTogglePropertyVisibility(property.id, value === true)}
                    />
                    {editingPropertyId === property.id ? (
                      <Input
                        value={editingPropertyName}
                        autoFocus
                        aria-label="Rename property"
                        className="h-7 min-w-0"
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
                      <span className="truncate">{property.name}</span>
                    )}
                    <div className="flex min-w-0 justify-end">
                      {disabled ? <Badge variant="outline">Required</Badge> : null}
                    </div>
                    <div className="flex size-7 items-center justify-center">
                      {disabled ? null : (
                        <Popover
                          open={actionsPropertyId === property.id}
                          onOpenChange={(nextOpen) => setActionsPropertyId(nextOpen ? property.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring/40"
                              aria-label={`${property.name} property actions`}
                              onClick={stopActionMenuEvent}
                              onPointerDown={stopActionMenuEvent}
                            >
                              <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            data-workspace-actions-popover="true"
                            role="menu"
                            aria-label={`${property.name} property actions`}
                            side="right"
                            align="start"
                            sideOffset={8}
                            className="w-44 p-1"
                            onOpenAutoFocus={(event) => event.preventDefault()}
                            onClick={stopActionMenuEvent}
                            onPointerDown={stopActionMenuEvent}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
                              onClick={(event) => {
                                event.stopPropagation();
                                beginRenameProperty(property);
                              }}
                            >
                              Rename property
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:text-destructive focus-visible:outline-none"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActionsPropertyId(null);
                                if (window.confirm(`Delete property "${property.name}"?`)) {
                                  onDeleteProperty(property.id);
                                }
                              }}
                            >
                              Delete property
                            </button>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Separator />
        <div className="grid gap-3 p-3">
          <div>
            <p className="text-sm font-medium">Value filters</p>
            <p className="text-xs text-muted-foreground">Limit visible projects by select values</p>
          </div>
          <div className="grid max-h-60 gap-3 overflow-auto pr-1">
            {filterableProperties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No select properties</p>
            ) : filterableProperties.map((property) => {
              const selectedValueIds = new Set(valueVisibility[property.id]?.valueIds || []);
              const propertyValues = getFilterValues(property, selectValues, statusValues);
              const expanded = expandedFilterPropertyIds.has(property.id);

              return (
                <div key={property.id} className="grid gap-1">
                  <button
                    type="button"
                    className="flex h-7 min-w-0 items-center gap-1.5 rounded-md px-1 text-left text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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
                    <div className="grid gap-1 pl-6">
                      {propertyValues.length > 0 ? propertyValues.map((selectValue) => (
                        <label key={selectValue.id} className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-muted/40">
                          <Checkbox
                            checked={selectedValueIds.has(selectValue.id)}
                            onCheckedChange={(value) =>
                              onToggleValueFilter(property.id, selectValue.id, value === true)
                            }
                          />
                          <span className="truncate">{selectValue.name}</span>
                        </label>
                      )) : (
                        <p className="px-1 py-0.5 text-xs text-muted-foreground">No values</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
