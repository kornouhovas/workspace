import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Columns3Icon } from "@/lib/lucide-icons";
import type {
  WorkspacePropertyDefinitionState,
  WorkspaceSelectValueState,
  WorkspaceViewState,
} from "@/workspaceAppState";

type WorkspaceViewFilterMenuProps = {
  readonly view: WorkspaceViewState | null;
  readonly properties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly onTogglePropertyVisibility: (propertyId: string, visible: boolean) => void;
  readonly onToggleValueFilter: (propertyId: string, valueId: string, included: boolean) => void;
};

function isSystemProperty(propertyId: string) {
  return propertyId === "property:name" || propertyId === "property:status";
}

function isFilterableProperty(property: WorkspacePropertyDefinitionState) {
  return property.propertyType === "select" || property.propertyType === "multi-select";
}

export function WorkspaceViewFilterMenu({
  view,
  properties,
  selectValues,
  onTogglePropertyVisibility,
  onToggleValueFilter,
}: WorkspaceViewFilterMenuProps) {
  const visiblePropertyIds = new Set(view?.visiblePropertyIds || properties.map((property) => property.id));
  const valueVisibility = view?.valueVisibility || {};
  const filterableProperties = properties.filter(isFilterableProperty);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="View property visibility and filters">
          <Columns3Icon className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="grid gap-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Visible properties</p>
              <p className="text-xs text-muted-foreground">Choose fields for this view</p>
            </div>
            <Badge variant="outline">{visiblePropertyIds.size}</Badge>
          </div>
          <div className="grid max-h-52 gap-2 overflow-auto pr-1">
            {properties.map((property) => {
              const checked = visiblePropertyIds.has(property.id);
              const disabled = isSystemProperty(property.id);

              return (
                <label key={property.id} className="flex min-w-0 items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(value) => onTogglePropertyVisibility(property.id, value === true)}
                  />
                  <span className="truncate">{property.name}</span>
                  {disabled ? <Badge variant="outline">Required</Badge> : null}
                </label>
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
              const propertyValues = selectValues.filter((selectValue) => (
                selectValue.propertyId === property.id && !selectValue.hidden
              ));

              return (
                <div key={property.id} className="grid gap-2">
                  <p className="truncate text-xs font-medium text-muted-foreground">{property.name}</p>
                  {propertyValues.map((selectValue) => (
                    <label key={selectValue.id} className="flex min-w-0 items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedValueIds.has(selectValue.id)}
                        onCheckedChange={(value) =>
                          onToggleValueFilter(property.id, selectValue.id, value === true)
                        }
                      />
                      <span className="truncate">{selectValue.name}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
