import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { getStatusDisplayName } from "@/i18n/status";
import type { WorkspaceMockProject, WorkspaceMockVisibleProperty } from "@/workspaceMockData";
import type { WorkspaceSelectValueState } from "@/workspaceAppState";
import { normalizeBoardColumnWidth } from "@/workspaceBoardLayout.js";
import { formatDateForDisplay } from "@/formatDateForDisplay.js";
import { ProjectTablePropertyValueEditor } from "./table-view";

type WorkspaceBoardColumn = {
  readonly statusValueId: string;
  readonly name: string;
  readonly projects: readonly WorkspaceMockProject[];
};

type WorkspaceBoardProjection = {
  readonly capabilities: {
    readonly canMoveBetweenStatuses: boolean;
  };
  readonly columns: readonly WorkspaceBoardColumn[];
};

type BoardEditingProps = Pick<ComponentProps<typeof ProjectTablePropertyValueEditor>,
  "onProjectPropertyValueChange" | "onCreateSelectValue" | "onRenameSelectValue" | "onColorSelectValue" | "onDeleteSelectValue">;

type WorkspaceBoardViewProps = BoardEditingProps & {
  readonly projection: WorkspaceBoardProjection;
  readonly columnWidth?: number;
  readonly onViewportWidthChange?: (viewportWidth: number) => void;
  readonly visibleProperties: readonly WorkspaceMockVisibleProperty[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly onProjectOpen: (project: WorkspaceMockProject) => void;
};

function getPropertyValue(project: WorkspaceMockProject, property: WorkspaceMockVisibleProperty) {
  if (property.id === "property:name") {
    return project.name;
  }

  if (property.id === "property:status") {
    return project.status.name;
  }

  return project.propertyValues[property.id as keyof typeof project.propertyValues] ?? "";
}

function formatPropertyValue(
  value: unknown,
  property: WorkspaceMockVisibleProperty,
  selectValues: readonly WorkspaceSelectValueState[],
  locale: string,
) {
  if (property.propertyType === "date") return formatDateForDisplay(value, locale);
  if (property.propertyType === "select") {
    return selectValues.find((selectValue) => selectValue.id === value)?.name || (typeof value === "string" ? value : "");
  }

  if (property.propertyType === "multi-select" && Array.isArray(value)) {
    return value
      .map((valueId) => selectValues.find((selectValue) => selectValue.id === valueId)?.name || (typeof valueId === "string" ? valueId : ""))
      .filter(Boolean)
      .join(", ");
  }

  return value == null ? "" : String(value);
}

function renderBoardStatusValue(value: unknown, t: (key: string) => string) {
  const statusValue = value && typeof value === "object" && !Array.isArray(value)
    ? value as {
        readonly id?: string;
        readonly name?: string;
        readonly source?: string;
        readonly color?: unknown;
      }
    : null;
  const label = statusValue ? getStatusDisplayName(t, statusValue) : value == null ? "" : String(value);
  const color = typeof statusValue?.color === "string" && statusValue.color ? statusValue.color : "gray";

  if (!label) {
    return null;
  }

  return (
    <Badge
      variant="secondary"
      className="h-6 max-w-full cursor-default select-none gap-1.5 rounded-md border border-border/50 bg-secondary/70 px-2 text-[13px] font-normal"
    >
      <span className="size-2 rounded-full bg-muted-foreground/70" data-color={color} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Badge>
  );
}

export function WorkspaceBoardView({
  projection,
  columnWidth,
  onViewportWidthChange,
  visibleProperties,
  selectValues,
  onProjectOpen,
  ...editingProps
}: WorkspaceBoardViewProps) {
  const { t, locale } = useI18n();
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const cardProperties = visibleProperties.filter(
    (property) => property.id !== "property:name",
  );
  const preferredColumnWidth = normalizeBoardColumnWidth(columnWidth);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const boardGridStyle = {
    "--workspace-board-column-width": `${preferredColumnWidth}px`,
    gridAutoColumns: "var(--workspace-board-column-width)",
  } as CSSProperties;

  useEffect(() => {
    const viewport = boardViewportRef.current;
    if (!viewport) {
      return;
    }

    const updateWidth = () => {
      const viewportWidth = viewport.clientWidth;
      onViewportWidthChange?.(viewportWidth);
    };
    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  }, [onViewportWidthChange]);

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden pl-4 pr-0 pt-4 pb-0" aria-label={t("view.boardDefault")}>
      <div ref={boardViewportRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="grid h-full min-w-full w-max grid-flow-col gap-3" style={boardGridStyle}>
          {projection.columns.map((column) => (
            <section
              key={column.statusValueId}
              className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-muted/20"
              aria-label={t("board.projectsAria", {
                name: getStatusDisplayName(t, { id: column.statusValueId, name: column.name }),
              })}
            >
              <header className="flex h-9 shrink-0 items-center justify-between border-b border-border px-2.5">
                <h3 className="min-w-0 truncate text-sm font-medium">
                  {getStatusDisplayName(t, { id: column.statusValueId, name: column.name })}
                </h3>
                <Badge variant="secondary" className="shrink-0">{column.projects.length}</Badge>
              </header>
              <div className="grid min-h-0 flex-1 auto-rows-max content-start gap-2 overflow-y-auto overflow-x-hidden p-2">
                {column.projects.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    {t("board.noProjects")}
                  </div>
                ) : (
                  column.projects.map((project) => {
                    const populatedProperties = cardProperties.map((property) => ({
                      property,
                      value: formatPropertyValue(getPropertyValue(project, property), property, selectValues, locale),
                    })).filter(({ property, value }) => value.trim() !== "" || editingCellId === `${project.id}:${property.id}`);
                    return (
                    <article
                      key={project.id}
                      className="relative flex min-h-12 w-full min-w-0 flex-col gap-2 overflow-hidden rounded-lg border border-border bg-card p-2.5 text-left text-card-foreground shadow-xs hover:border-ring/60 focus-within:border-ring"
                    >
                      <button type="button" className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" aria-label={project.name} onClick={() => onProjectOpen(project)} />
                      <h4 className="pointer-events-none relative min-w-0 truncate text-sm font-normal leading-5">{project.name}</h4>
                      {populatedProperties.length > 0 ? (
                        <dl className="relative grid gap-2">
                          {populatedProperties.map(({ property, value }) => (
                            <div key={property.id} className="min-w-0 text-xs">
                              <dt className="sr-only">{property.name}</dt>
                              <dd className="min-w-0 text-foreground [&_[data-workspace-select-value-trigger]]:h-auto [&_[data-workspace-select-value-trigger]]:min-h-8 [&_[data-workspace-select-value-trigger]>span]:flex-wrap">
                                {property.id === "property:status" ? renderBoardStatusValue(project.status, t) : property.system ? <span className="block truncate">{value}</span> : (
                                  <ProjectTablePropertyValueEditor
                                    {...editingProps}
                                    project={project}
                                    property={property}
                                    selectValues={selectValues}
                                    wrapContent={false}
                                    editing={editingCellId === `${project.id}:${property.id}`}
                                    dismissSignal={0}
                                    onStartEditingCell={setEditingCellId}
                                    onStopEditingCell={() => setEditingCellId(null)}
                                  />
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </article>
                    );
                  })
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
