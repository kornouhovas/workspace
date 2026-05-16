import { useMemo, useState } from "react";

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
import { CircleDotIcon, PlusIcon, XIcon } from "@/lib/lucide-icons";
import type {
  WorkspacePropertyDefinitionState,
  WorkspaceSelectValueState,
} from "@/workspaceAppState";

type WorkspaceSelectValueEditorProps = {
  readonly property: Pick<WorkspacePropertyDefinitionState, "id" | "name" | "propertyType">;
  readonly value: unknown;
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly triggerClassName?: string;
  readonly onValueChange: (value: unknown) => void;
  readonly onCreateSelectValue: (
    propertyId: string,
    input: { readonly name: string; readonly color: string },
  ) => Promise<WorkspaceSelectValueState | null>;
};

function stopSelectionEditorActivation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
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

function getSelectValueLabel({
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
    return selectedValues.length > 0
      ? selectedValues.map((valueId) => getSelectValueName(selectValues, valueId)).join(", ")
      : "Empty";
  }

  return selectedValueId ? getSelectValueName(selectValues, selectedValueId) : "Empty";
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function WorkspaceSelectValueEditor({
  property,
  value,
  selectValues,
  triggerClassName,
  onValueChange,
  onCreateSelectValue,
}: WorkspaceSelectValueEditorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
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
  const label = getSelectValueLabel({
    isMultiSelect,
    selectedValueId,
    selectedValues,
    selectValues: values,
  });

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

  return (
    <div onClick={stopSelectionEditorActivation} onPointerDown={stopSelectionEditorActivation}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={triggerClassName || "h-8 w-full min-w-0 justify-start px-2 font-normal"}
            aria-label={`${property.name} select value`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <CircleDotIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-64"
          onClick={stopSelectionEditorActivation}
          onPointerDown={stopSelectionEditorActivation}
        >
          <DropdownMenuLabel>{property.name}</DropdownMenuLabel>
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
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {!isMultiSelect && selectedValueId ? (
              <DropdownMenuItem onSelect={clearSingleSelectValue}>
                <XIcon className="size-3.5" aria-hidden="true" />
                Clear selection
              </DropdownMenuItem>
            ) : null}
            {filteredValues.map((selectValue) => {
              const selected = isMultiSelect
                ? selectedValues.includes(selectValue.id)
                : selectedValueId === selectValue.id;

              if (isMultiSelect) {
                return (
                  <DropdownMenuCheckboxItem
                    key={selectValue.id}
                    checked={selected}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) => toggleMultiValue(selectValue.id, checked === true)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary" className="size-2.5 rounded-full p-0" data-color={selectValue.color || "gray"} />
                      <span className="truncate">{selectValue.name}</span>
                    </span>
                  </DropdownMenuCheckboxItem>
                );
              }

              return (
                <DropdownMenuItem key={selectValue.id} onSelect={() => selectSingleValue(selectValue.id)}>
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge variant="secondary" className="size-2.5 rounded-full p-0" data-color={selectValue.color || "gray"} />
                    <span className="truncate">{selectValue.name}</span>
                  </span>
                </DropdownMenuItem>
              );
            })}
            {filteredValues.length === 0 && !canCreateValue ? (
              <DropdownMenuItem disabled>No matching values</DropdownMenuItem>
            ) : null}
            {canCreateValue ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={creating}
                  onSelect={(event) => {
                    event.preventDefault();
                    void createValueFromSearch();
                  }}
                >
                  <PlusIcon className="size-3.5" aria-hidden="true" />
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
