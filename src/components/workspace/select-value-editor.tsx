import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MoreHorizontalIcon,
  PaletteIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "@/lib/lucide-icons";
import {
  workspaceMenuContentClassName,
  workspaceMenuDangerIconClassName,
  workspaceMenuDangerItemClassName,
  workspaceMenuIconClassName,
  workspaceMenuItemClassName,
  workspaceMenuLabelClassName,
  workspaceMenuSeparatorClassName,
} from "@/components/workspace/menu-styles";
import type {
  WorkspacePropertyDefinitionState,
  WorkspaceSelectValueState,
} from "@/workspaceAppState";

type WorkspaceSelectValueEditorProps = {
  readonly property: Pick<WorkspacePropertyDefinitionState, "id" | "name" | "propertyType">;
  readonly value: unknown;
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly dismissSignal?: number;
  readonly triggerClassName?: string;
  readonly onValueChange: (value: unknown) => void;
  readonly onCreateSelectValue: (
    propertyId: string,
    input: { readonly name: string; readonly color: string },
  ) => Promise<WorkspaceSelectValueState | null>;
  readonly onRenameSelectValue: (selectValueId: string, name: string) => void;
  readonly onColorSelectValue?: (selectValueId: string, color: string) => void;
  readonly onDeleteSelectValue: (selectValueId: string) => void;
};

const valueColorOptions = ["gray", "red", "orange", "yellow", "green", "blue", "purple"] as const;

function stopSelectionEditorActivation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function keepDropdownOpenForActionsPopover(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (event.target instanceof Element && event.target.closest("[data-workspace-actions-popover='true']")) {
    event.preventDefault();
  }
}

function keepSelectValueActionsPopoverOpen(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (
    event.target instanceof Element
    && event.target.closest("[data-workspace-select-value-menu='true'], [data-workspace-actions-popover='true']")
  ) {
    event.preventDefault();
  }
}

function getSelectValuesForProperty(
  selectValues: readonly WorkspaceSelectValueState[],
  propertyId: string,
) {
  return selectValues
    .filter((selectValue) => selectValue.propertyId === propertyId && !selectValue.hidden)
    .sort((left, right) => (
      Number(left.order || 0) - Number(right.order || 0) || left.id.localeCompare(right.id)
    ));
}

function getSelectedValues(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getSelectValueName(selectValues: readonly WorkspaceSelectValueState[], valueId: string) {
  return selectValues.find((selectValue) => selectValue.id === valueId)?.name || valueId;
}

function getSelectedSelectValueItems({
  isMultiSelect,
  selectedValueId,
  selectedValues,
  selectValues,
}: {
  readonly isMultiSelect: boolean;
  readonly selectedValueId: string | null;
  readonly selectedValues: readonly string[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
}) {
  if (isMultiSelect) {
    return selectedValues.map((valueId) => (
      selectValues.find((selectValue) => selectValue.id === valueId) || {
        id: valueId,
        propertyId: "",
        name: valueId,
        color: "gray",
      }
    ));
  }

  if (!selectedValueId) {
    return [];
  }

  return [
    selectValues.find((selectValue) => selectValue.id === selectedValueId) || {
      id: selectedValueId,
      propertyId: "",
      name: selectedValueId,
      color: "gray",
    },
  ];
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function WorkspaceSelectValueEditor({
  property,
  value,
  selectValues,
  dismissSignal,
  triggerClassName,
  onValueChange,
  onCreateSelectValue,
  onRenameSelectValue,
  onColorSelectValue,
  onDeleteSelectValue,
}: WorkspaceSelectValueEditorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingSelectValueId, setEditingSelectValueId] = useState<string | null>(null);
  const [editingSelectValueName, setEditingSelectValueName] = useState("");
  const [actionsSelectValueId, setActionsSelectValueId] = useState<string | null>(null);
  const isMultiSelect = property.propertyType === "multi-select";
  const values = useMemo(
    () => getSelectValuesForProperty(selectValues, property.id),
    [property.id, selectValues],
  );
  const selectedValues = getSelectedValues(value);
  const selectedValueId = typeof value === "string" && value ? value : null;
  const normalizedQuery = normalizeSearchText(searchQuery);
  const filteredValues = normalizedQuery
    ? values.filter((selectValue) => normalizeSearchText(selectValue.name).includes(normalizedQuery))
    : values;
  const exactValueExists = normalizedQuery
    ? values.some((selectValue) => normalizeSearchText(selectValue.name) === normalizedQuery)
    : false;
  const canCreateValue = normalizedQuery.length > 0 && !exactValueExists;
  const selectedValueItems = getSelectedSelectValueItems({
    isMultiSelect,
    selectedValueId,
    selectedValues,
    selectValues: values,
  });

  useEffect(() => {
    setOpen(false);
    setActionsSelectValueId(null);
    setEditingSelectValueId(null);
    setEditingSelectValueName("");
  }, [dismissSignal]);

  function clearSingleSelectValue() {
    onValueChange(null);
    setOpen(false);
  }

  function selectSingleValue(valueId: string) {
    onValueChange(valueId);
    setOpen(false);
  }

  function toggleMultiValue(valueId: string, checked: boolean) {
    const nextValues = checked
      ? [...selectedValues, valueId].filter((item, index, valuesList) => valuesList.indexOf(item) === index)
      : selectedValues.filter((selectedValue) => selectedValue !== valueId);

    onValueChange(nextValues);
  }

  async function createValueFromSearch() {
    const name = searchQuery.trim();
    if (!name || creating) {
      return;
    }

    setCreating(true);
    const createdValue = await onCreateSelectValue(property.id, {
      name,
      color: "gray",
    });
    setCreating(false);

    if (!createdValue) {
      return;
    }

    setSearchQuery("");

    if (isMultiSelect) {
      const nextValues = [...selectedValues, createdValue.id].filter((item, index, valuesList) => (
        valuesList.indexOf(item) === index
      ));
      onValueChange(nextValues);
      return;
    }

    onValueChange(createdValue.id);
    setOpen(false);
  }

  function beginRenameSelectValue(selectValue: WorkspaceSelectValueState) {
    setActionsSelectValueId(null);
    setEditingSelectValueId(selectValue.id);
    setEditingSelectValueName(selectValue.name);
  }

  function commitRenameSelectValue(selectValue: WorkspaceSelectValueState) {
    const name = editingSelectValueName.trim();
    setEditingSelectValueId(null);
    setEditingSelectValueName("");

    if (name && name !== selectValue.name) {
      onRenameSelectValue(selectValue.id, name);
    }
  }

  function commitActiveRenameSelectValue() {
    const selectValue = values.find((valueOption) => valueOption.id === editingSelectValueId);

    if (selectValue) {
      commitRenameSelectValue(selectValue);
      return;
    }

    setEditingSelectValueId(null);
    setEditingSelectValueName("");
  }

  function deleteSelectValue(selectValue: WorkspaceSelectValueState) {
    setActionsSelectValueId(null);
    if (window.confirm(`Delete value "${selectValue.name}"?`)) {
      onDeleteSelectValue(selectValue.id);
    }
  }

  function renderSelectValueActions(selectValue: WorkspaceSelectValueState) {
    return (
      <Popover
        open={actionsSelectValueId === selectValue.id}
        onOpenChange={(nextOpen) => setActionsSelectValueId(nextOpen ? selectValue.id : null)}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring/40"
            aria-label={`${selectValue.name} value actions`}
            onClick={stopSelectionEditorActivation}
            onPointerDown={stopSelectionEditorActivation}
          >
            <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          data-workspace-actions-popover="true"
          role="menu"
          aria-label={`${selectValue.name} value actions`}
          side="right"
          align="start"
          sideOffset={8}
          className={`${workspaceMenuContentClassName} w-56`}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={keepSelectValueActionsPopoverOpen}
          onInteractOutside={keepSelectValueActionsPopoverOpen}
          onClick={stopSelectionEditorActivation}
          onPointerDown={stopSelectionEditorActivation}
        >
          <button
            type="button"
            role="menuitem"
            className={workspaceMenuItemClassName}
            onClick={(event) => {
              event.stopPropagation();
              beginRenameSelectValue(selectValue);
            }}
          >
            <PencilIcon className={workspaceMenuIconClassName} aria-hidden="true" />
            Rename value
          </button>
          <button
            type="button"
            role="menuitem"
            className={workspaceMenuDangerItemClassName}
            onClick={(event) => {
              event.stopPropagation();
              deleteSelectValue(selectValue);
            }}
          >
            <Trash2Icon className={workspaceMenuDangerIconClassName} aria-hidden="true" />
            Delete value
          </button>
          {onColorSelectValue ? (
            <>
              <div className={workspaceMenuSeparatorClassName} />
              <div className={`${workspaceMenuLabelClassName} flex items-center gap-2`}>
                <PaletteIcon className="size-3.5" aria-hidden="true" />
                Color
              </div>
              <div className="grid grid-cols-7 gap-1 px-1 pb-1">
                {valueColorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Color ${color}`}
                    title={color}
                    className="flex size-6 items-center justify-center rounded-md hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                    onClick={(event) => {
                      event.stopPropagation();
                      onColorSelectValue(selectValue.id, color);
                      setActionsSelectValueId(null);
                    }}
                  >
                    <span className="size-3 rounded-full" data-color={color} />
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div onClick={stopSelectionEditorActivation} onPointerDown={stopSelectionEditorActivation}>
      <DropdownMenu
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && editingSelectValueId) {
            commitActiveRenameSelectValue();
          }
          setOpen(nextOpen);
          if (!nextOpen) {
            setActionsSelectValueId(null);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={triggerClassName || "h-8 w-full min-w-0 justify-start px-2 font-normal"}
            aria-label={`${property.name} select value`}
            data-empty-value={selectedValueItems.length > 0 ? undefined : "true"}
          >
            {selectedValueItems.length > 0 ? (
              <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                {selectedValueItems.map((selectValue) => (
                  <span
                    key={selectValue.id}
                    className="workspace-table-value-chip workspace-table-select-value-chip inline-flex h-5 min-w-0 max-w-28 shrink items-center gap-1 rounded-md bg-secondary px-1.5 text-xs text-secondary-foreground"
                  >
                    <span className="size-2 shrink-0 rounded-full" data-color={selectValue.color || "gray"} />
                    <span className="truncate">{selectValue.name}</span>
                  </span>
                ))}
              </span>
            ) : (
              <span className="workspace-table-empty-value min-h-5 flex-1" aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          data-workspace-select-value-menu="true"
          align="start"
          className={`${workspaceMenuContentClassName} w-64`}
          onInteractOutside={keepDropdownOpenForActionsPopover}
          onClick={stopSelectionEditorActivation}
          onPointerDown={stopSelectionEditorActivation}
        >
          <DropdownMenuLabel className={workspaceMenuLabelClassName}>{property.name}</DropdownMenuLabel>
          <div className="p-1">
            <Input
              value={searchQuery}
              autoFocus
              placeholder="Search values"
              aria-label="Search values"
              className="h-8"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter" && canCreateValue) {
                  event.preventDefault();
                  void createValueFromSearch();
                }
              }}
            />
          </div>
          <DropdownMenuSeparator className={workspaceMenuSeparatorClassName} />
          <DropdownMenuGroup>
            {!isMultiSelect && selectedValueId ? (
              <DropdownMenuItem className={workspaceMenuItemClassName} onSelect={clearSingleSelectValue}>
                <XIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                Clear selection
              </DropdownMenuItem>
            ) : null}
            {filteredValues.map((selectValue) => {
              const selected = isMultiSelect
                ? selectedValues.includes(selectValue.id)
                : selectedValueId === selectValue.id;

              if (editingSelectValueId === selectValue.id) {
                return (
                  <div key={selectValue.id} className="px-1 py-1">
                    <Input
                      value={editingSelectValueName}
                      autoFocus
                      aria-label="Rename value"
                      className="h-8"
                      onChange={(event) => setEditingSelectValueName(event.target.value)}
                      onPointerMove={stopSelectionEditorActivation}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitRenameSelectValue(selectValue);
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setEditingSelectValueId(null);
                          setEditingSelectValueName("");
                        }
                      }}
                    />
                  </div>
                );
              }

              if (isMultiSelect) {
                return (
                  <div key={selectValue.id} className="grid gap-1">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center">
                      <DropdownMenuCheckboxItem
                        checked={selected}
                        className="min-w-0"
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) => toggleMultiValue(selectValue.id, checked === true)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge variant="secondary" className="size-2.5 rounded-full p-0" data-color={selectValue.color || "gray"} />
                          <span className="truncate">{selectValue.name}</span>
                        </span>
                      </DropdownMenuCheckboxItem>
                      {renderSelectValueActions(selectValue)}
                    </div>
                  </div>
                );
              }

              return (
                <div key={selectValue.id} className="grid gap-1">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center">
                    <DropdownMenuItem
                      className={`${workspaceMenuItemClassName} min-w-0`}
                      onSelect={() => selectSingleValue(selectValue.id)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge variant="secondary" className="size-2.5 rounded-full p-0" data-color={selectValue.color || "gray"} />
                        <span className="truncate">{selectValue.name}</span>
                      </span>
                    </DropdownMenuItem>
                    {renderSelectValueActions(selectValue)}
                  </div>
                </div>
              );
            })}
            {filteredValues.length === 0 && !canCreateValue ? (
              <DropdownMenuItem className={workspaceMenuItemClassName} disabled>
                No matching values
              </DropdownMenuItem>
            ) : null}
            {canCreateValue ? (
              <>
                <DropdownMenuSeparator className={workspaceMenuSeparatorClassName} />
                <DropdownMenuItem
                  className={workspaceMenuItemClassName}
                  disabled={creating}
                  onSelect={(event) => {
                    event.preventDefault();
                    void createValueFromSearch();
                  }}
                >
                  <PlusIcon className={workspaceMenuIconClassName} aria-hidden="true" />
                  Create "{searchQuery.trim()}"
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
