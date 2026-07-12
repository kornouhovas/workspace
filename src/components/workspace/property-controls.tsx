import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { getStatusDisplayName } from "@/i18n/status";
import type {
  WorkspaceProjectionResponse,
  WorkspaceSelectValueState,
} from "@/workspaceAppState";

export type WorkspaceCustomPropertyType = "text" | "number" | "date" | "select" | "multi-select";

type WorkspacePropertyControlsProps = {
  readonly statusValues: WorkspaceProjectionResponse["statusValues"];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly onColorStatusValue: (statusValueId: string, color: string) => void;
};

const valueColorOptions = ["gray", "red", "orange", "yellow", "green", "blue", "purple"] as const;

function getStatusValueColor(
  statusValue: WorkspaceProjectionResponse["statusValues"][number],
  selectValuesById: ReadonlyMap<string, WorkspaceSelectValueState>,
) {
  return statusValue.color || selectValuesById.get(statusValue.id)?.color || "gray";
}

export function WorkspacePropertyControls({
  statusValues,
  selectValues,
  onColorStatusValue,
}: WorkspacePropertyControlsProps) {
  const { t } = useI18n();
  const statusValueColorById = useMemo(() => {
    const byId = new Map<string, WorkspaceSelectValueState>();
    for (const selectValue of selectValues) {
      if (selectValue.propertyId === "property:status") {
        byId.set(selectValue.id, selectValue);
      }
    }

    return byId;
  }, [selectValues]);

  const sortedStatusValues = useMemo(
    () => [...statusValues].sort((left, right) => (
      left.source === "no-status" && right.source !== "no-status"
        ? 1
        : right.source === "no-status" && left.source !== "no-status"
          ? -1
          : left.name.localeCompare(right.name)
    )),
    [statusValues],
  );

  return (
    <section className="rounded-lg border border-border bg-card" aria-labelledby="workspace-properties-heading">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <h3 id="workspace-properties-heading" className="text-sm font-semibold">{t("property.properties")}</h3>
          <p className="truncate text-xs text-muted-foreground">{t("settings.statusValuesDescription")}</p>
        </div>
        <Badge variant="outline">{t("settings.values", { count: sortedStatusValues.length })}</Badge>
      </div>
      <div className="grid gap-2 border-t border-border p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{t("table.status")}</span>
              <Badge variant="secondary">{t("value.select")}</Badge>
              <Badge variant="outline">{t("property.system")}</Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {t("settings.statusValuesDescription")}
            </p>
          </div>
        </div>
        {sortedStatusValues.length > 0 ? (
          <ul className="grid gap-1 rounded-lg border border-border/70 bg-background/60 p-2">
            {sortedStatusValues.map((statusValue) => {
              const color = getStatusValueColor(statusValue, statusValueColorById);
              return (
                <li
                  key={statusValue.id}
                  className="grid grid-cols-[minmax(0,1fr)_10rem] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground" data-color={color} aria-hidden="true" />
                    <span className="truncate text-sm font-medium">{getStatusDisplayName(t, statusValue)}</span>
                  </div>
                  <Select
                    value={color}
                    onValueChange={(nextColor) => onColorStatusValue(statusValue.id, nextColor)}
                  >
                    <SelectTrigger size="sm" className="w-full" aria-label={t("value.color")}>
                      <SelectValue placeholder={t("value.color")} />
                    </SelectTrigger>
                    <SelectContent>
                      {valueColorOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          <span className="inline-flex items-center gap-2">
                            <span className="size-2 rounded-full" data-color={option} aria-hidden="true" />
                            {t(`color.${option}`)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
            {t("settings.noStatusValues")}
          </p>
        )}
      </div>
    </section>
  );
}
