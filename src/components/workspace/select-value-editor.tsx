import { useEffect, useMemo, useRef, useState } from "react";

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
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MoreHorizontalIcon,
  PaletteIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "@/lib/workspace-icons";
import {
  workspaceMenuContentClassName,
  workspaceMenuDangerIconClassName,
  workspaceMenuDangerItemClassName,
  workspaceMenuIconClassName,
  workspaceMenuItemClassName,
  workspaceMenuLabelClassName,
  workspaceMenuSeparatorClassName,
} from "@/components/workspace/menu-styles";
import { blockOutsideWorkspaceMenuPointerDown } from "@/components/workspace/menu-dismissal";
import { useI18n } from "@/i18n";
import type {
  WorkspacePropertyDefinitionState,
  WorkspaceSelectValueState,
} from "@/workspaceAppState";

type WorkspaceSelectValueEditorProps = {
  readonly property: Pick<WorkspacePropertyDefinitionState, "id" | "name" | "propertyType">;
  readonly value: unknown;
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly dismissSignal?: number;
  readonly containerClassName?: string;
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

type SelectValueActionSource = "chip" | "picker";
type SelectValueActionState = {
  readonly selectValueId: string;
  readonly source: SelectValueActionSource;
} | null;

const valueColorOptions = ["gray", "red", "orange", "yellow", "green", "blue", "purple"] as const;
const selectValueMenuSurfaceSelector =
  "[data-workspace-select-value-menu='true'], [data-workspace-actions-popover='true']";

function stopSelectionEditorActivation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function stopSelectValueChipTriggerActivation(event: { preventDefault: () => void; stopPropagation: () => void }) {
  event.preventDefault();
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
    && event.target.closest("[data-workspace-actions-popover='true']")
  ) {
    event.preventDefault();
  }
}

function keepSelectValueActionsPopoverFocusInsidePicker(
  event: { target: EventTarget | null; preventDefault: () => void },
) {
  if (
    event.target instanceof Element
    && event.target.closest("[data-workspace-actions-popover='true'], [data-workspace-select-value-menu='true']")
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
  containerClassName,
  triggerClassName,
  onValueChange,
  onCreateSelectValue,
  onRenameSelectValue,
  onColorSelectValue,
  onDeleteSelectValue,
}: WorkspaceSelectValueEditorProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingSelectValueId, setEditingSelectValueId] = useState<string | null>(null);
  const [editingSelectValueName, setEditingSelectValueName] = useState("");
  const [selectValueAction, setSelectValueAction] = useState<SelectValueActionState>(null);
  const closingDropdownForSelectValueActionRef = useRef<string | null>(null);
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
    setSelectValueAction(null);
    setEditingSelectValueId(null);
    setEditingSelectValueName("");
    closingDropdownForSelectValueActionRef.current = null;
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

  function isSelectValueActionOpen(
    selectValue: WorkspaceSelectValueState,
    source: SelectValueActionSource,
  ) {
    return selectValueAction?.selectValueId === selectValue.id && selectValueAction.source === source;
  }

  function beginRenameSelectValue(selectValue: WorkspaceSelectValueState, source: SelectValueActionSource) {
    setSelectValueAction({ selectValueId: selectValue.id, source });
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

  useEffect(() => {
    if (!open && !selectValueAction) {
      return undefined;
    }

    function closeSelectValueMenusOnOutsidePointerDown(event: PointerEvent) {
      blockOutsideWorkspaceMenuPointerDown(event, selectValueMenuSurfaceSelector, () => {
        if (editingSelectValueId) {
          commitActiveRenameSelectValue();
        }

        closingDropdownForSelectValueActionRef.current = null;
        setOpen(false);
        setSelectValueAction(null);
      });
    }

    document.addEventListener("pointerdown", closeSelectValueMenusOnOutsidePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", closeSelectValueMenusOnOutsidePointerDown, true);
    };
  }, [editingSelectValueId, editingSelectValueName, open, selectValueAction, values]);

  function deleteSelectValue(selectValue: WorkspaceSelectValueState) {
    setSelectValueAction(null);
    setEditingSelectValueId(null);
    setEditingSelectValueName("");
    if (window.confirm(t("confirm.deleteValue", { name: selectValue.name }))) {
      onDeleteSelectValue(selectValue.id);
    }
  }

  function handleSelectValueActionsOpenChange(
    selectValue: WorkspaceSelectValueState,
    source: SelectValueActionSource,
    nextOpen: boolean,
  ) {
    if (!nextOpen && editingSelectValueId === selectValue.id) {
      commitRenameSelectValue(selectValue);
    }

    if (!nextOpen && closingDropdownForSelectValueActionRef.current === selectValue.id) {
      closingDropdownForSelectValueActionRef.current = null;
    }

    setSelectValueAction((currentAction) => {
      if (nextOpen) {
        return { selectValueId: selectValue.id, source };
      }

      if (currentAction?.selectValueId === selectValue.id && currentAction.source === source) {
        return null;
      }

      return currentAction;
    });
  }

  function handleSelectValuePickerOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      if (editingSelectValueId) {
        commitActiveRenameSelectValue();
      }

      closingDropdownForSelectValueActionRef.current = null;
      setOpen(true);
      setSelectValueAction(null);
      setEditingSelectValueId(null);
      setEditingSelectValueName("");
      return;
    }

    setOpen(false);

    if (closingDropdownForSelectValueActionRef.current !== null) {
      closingDropdownForSelectValueActionRef.current = null;
      return;
    }

    if (editingSelectValueId) {
      commitActiveRenameSelectValue();
    }

    setSelectValueAction(null);
  }

  function openSelectValueActionsFromChip(
    selectValue: WorkspaceSelectValueState,
    event: { preventDefault: () => void; stopPropagation: () => void },
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (isSelectValueActionOpen(selectValue, "chip")) {
      closingDropdownForSelectValueActionRef.current = null;
      setSelectValueAction(null);
      setEditingSelectValueId(null);
      setEditingSelectValueName("");
      return;
    }

    closingDropdownForSelectValueActionRef.current = selectValue.id;
    setOpen(false);
    setEditingSelectValueId(null);
    setEditingSelectValueName("");
    setSelectValueAction({ selectValueId: selectValue.id, source: "chip" });
  }

  function renderSelectValueActionsContent(
    selectValue: WorkspaceSelectValueState,
    options: {
      readonly source: SelectValueActionSource;
      readonly side?: "bottom" | "right";
      readonly sideOffset?: number;
    },
  ) {
    const renamingValue = editingSelectValueId === selectValue.id;

    return (
      <PopoverContent
        data-workspace-actions-popover="true"
        role={renamingValue ? undefined : "menu"}
        aria-label={t("value.actions", { name: selectValue.name })}
        side={options.side || "right"}
        align="start"
        sideOffset={options.sideOffset ?? 8}
        className={`${workspaceMenuContentClassName} w-56`}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={keepSelectValueActionsPopoverFocusInsidePicker}
        onInteractOutside={keepSelectValueActionsPopoverOpen}
        onClick={stopSelectionEditorActivation}
        onPointerDown={stopSelectionEditorActivation}
      >
        {renamingValue ? (
          <div className="grid gap-1 p-1">
            <div className={workspaceMenuLabelClassName}>{t("value.rename")}</div>
            <Input
              value={editingSelectValueName}
              autoFocus
              aria-label={t("value.rename")}
              className="h-8"
              onChange={(event) => setEditingSelectValueName(event.target.value)}
              onPointerMove={stopSelectionEditorActivation}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitRenameSelectValue(selectValue);
                  setSelectValueAction(null);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEditingSelectValueId(null);
                  setEditingSelectValueName("");
                  setSelectValueAction(null);
                }
              }}
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              role="menuitem"
              className={workspaceMenuItemClassName}
              onClick={(event) => {
                event.stopPropagation();
                beginRenameSelectValue(selectValue, options.source);
              }}
            >
              <PencilIcon className={workspaceMenuIconClassName} aria-hidden="true" />
              {t("value.rename")}
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
              {t("value.delete")}
            </button>
            {onColorSelectValue ? (
              <>
                <div className={workspaceMenuSeparatorClassName} />
                <div className={`${workspaceMenuLabelClassName} flex items-center gap-2`}>
                  <PaletteIcon className="size-3.5" aria-hidden="true" />
                  {t("value.color")}
                </div>
                <div className="grid grid-cols-7 gap-1 px-1 pb-1">
                  {valueColorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`${t("value.color")}: ${color}`}
                      title={`${t("value.color")}: ${color}`}
                      className="flex size-6 items-center justify-center rounded-md hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                      onClick={(event) => {
                        event.stopPropagation();
                        onColorSelectValue(selectValue.id, color);
                        setSelectValueAction(null);
                      }}
                    >
                      <span className="size-3 rounded-full" data-color={color} />
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </PopoverContent>
    );
  }

  function renderSelectValueActions(selectValue: WorkspaceSelectValueState) {
    return (
      <Popover
        open={isSelectValueActionOpen(selectValue, "picker")}
        onOpenChange={(nextOpen) => handleSelectValueActionsOpenChange(selectValue, "picker", nextOpen)}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring/40"
            aria-label={t("value.actions", { name: selectValue.name })}
            onClick={stopSelectionEditorActivation}
            onPointerDown={stopSelectionEditorActivation}
          >
            <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        {renderSelectValueActionsContent(selectValue, { source: "picker" })}
      </Popover>
    );
  }

  function renderSelectedValueChip(selectValue: WorkspaceSelectValueState) {
    return (
      <Popover
        key={selectValue.id}
        open={isSelectValueActionOpen(selectValue, "chip")}
        onOpenChange={(nextOpen) => handleSelectValueActionsOpenChange(selectValue, "chip", nextOpen)}
      >
        <PopoverAnchor asChild>
          <span
            data-workspace-select-value-chip-trigger="true"
            className="workspace-table-value-chip workspace-table-select-value-chip inline-flex h-5 min-w-0 max-w-28 shrink items-center gap-1 rounded-md bg-secondary px-1.5 text-xs text-secondary-foreground"
            onPointerDown={stopSelectValueChipTriggerActivation}
            onClick={(event) => openSelectValueActionsFromChip(selectValue, event)}
          >
            <span className="size-2 shrink-0 rounded-full" data-color={selectValue.color || "gray"} />
            <span className="truncate">{selectValue.name}</span>
          </span>
        </PopoverAnchor>
        {renderSelectValueActionsContent(selectValue, { source: "chip", side: "bottom", sideOffset: 6 })}
      </Popover>
    );
  }

  return (
    <div
      className={containerClassName}
      onClick={stopSelectionEditorActivation}
      onPointerDown={stopSelectionEditorActivation}
    >
      <DropdownMenu
        open={open}
        onOpenChange={handleSelectValuePickerOpenChange}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={triggerClassName || "h-8 w-full min-w-0 justify-start px-2 font-normal"}
            aria-label={`${property.name}: ${t(isMultiSelect ? "value.multiSelect" : "value.select")}`}
            data-workspace-select-value-trigger="true"
            data-empty-value={selectedValueItems.length > 0 ? undefined : "true"}
          >
            {selectedValueItems.length > 0 ? (
              <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                {selectedValueItems.map((selectValue) => renderSelectedValueChip(selectValue))}
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
              placeholder={t("value.search")}
              aria-label={t("value.search")}
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
                {t("value.clearSelection")}
              </DropdownMenuItem>
            ) : null}
            {filteredValues.map((selectValue) => {
              const selected = isMultiSelect
                ? selectedValues.includes(selectValue.id)
                : selectedValueId === selectValue.id;

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
                {t("common.noMatchingValues")}
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
                  {t("value.create", { name: searchQuery.trim() })}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
