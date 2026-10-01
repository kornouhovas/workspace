import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { getStatusDisplayName } from "@/i18n/status";
import type { WorkspaceMockProject, WorkspaceMockVisibleProperty } from "@/workspaceMockData";
import type { WorkspaceProjectionResponse, WorkspaceSelectValueState } from "@/workspaceAppState";
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
  readonly statusValues: WorkspaceProjectionResponse["statusValues"];
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
      className="h-6 max-w-full cursor-default select-none gap-1.5 rounded-none border-0 bg-transparent px-0 text-sm font-normal text-muted-foreground shadow-none"
    >
      <span className="size-2 rounded-full bg-muted-foreground/70" data-color={color} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Badge>
  );
}

export function WorkspaceBoardView({
  projection,
  statusValues,
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
      const content = viewport.firstElementChild;
      const style = content ? getComputedStyle(content) : null;
      const contentInset = style ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) : 0;
      const viewportWidth = Math.max(0, viewport.clientWidth - contentInset);
      onViewportWidthChange?.(viewportWidth);
    };
    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  }, [onViewportWidthChange]);

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden pt-3" aria-label={t("view.boardDefault")}>
      <div ref={boardViewportRef} className="workspace-board-scroll min-h-0 flex-1 overflow-auto">
        <div className="grid min-h-full min-w-full w-max grid-flow-col items-start gap-3 px-4 pb-4" style={boardGridStyle}>
          {projection.columns.map((column) => {
            const statusColor = statusValues.find((value) => value.id === column.statusValueId)?.color || "gray";
            return (
              <section
              key={column.statusValueId}
              className="workspace-board-column flex min-w-0 self-start flex-col"
              aria-label={t("board.projectsAria", {
                name: getStatusDisplayName(t, { id: column.statusValueId, name: column.name }),
              })}
            >
              <header className="flex h-9 shrink-0 items-center justify-between gap-2 px-1">
                <h3 className="flex min-w-0 items-center gap-2 truncate text-sm font-medium">
                  <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground/70" data-color={statusColor} aria-hidden="true" />
                  {getStatusDisplayName(t, { id: column.statusValueId, name: column.name })}
                </h3>
                <span
                  data-workspace-column-count
                  aria-label={t("board.visibleCount", { count: column.projects.length })}
                  className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-background/75 px-1.5 text-xs tabular-nums text-muted-foreground"
                >
                  {column.projects.length}
                </span>
              </header>
              <div className="grid auto-rows-max content-start gap-3 pb-2">
                {column.projects.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
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
                      className="workspace-board-card relative flex min-h-10 w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-lg border border-border bg-card px-2 py-2 text-left text-card-foreground shadow-xs hover:border-ring/30 focus-within:border-ring"
                    >
                      <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 rounded-lg" onClick={() => onProjectOpen(project)} />
                      <h4 className="relative min-w-0 text-sm font-normal leading-5">
                        <button type="button" title={project.name} className="flex h-7 w-full min-w-0 items-center rounded-md border border-transparent px-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => onProjectOpen(project)}>
                          <span className="truncate">{project.name}</span>
                        </button>
                      </h4>
                      {populatedProperties.length > 0 ? (
                        <dl className="relative grid gap-0.5">
                          {populatedProperties.map(({ property, value }) => (
                          <div key={property.id} className="min-w-0 text-sm">
                              <dt className="sr-only">{property.name}</dt>
                              <dd className="min-w-0 text-foreground [&_[data-workspace-select-value-trigger]]:h-auto [&_[data-workspace-select-value-trigger]]:min-h-8 [&_[data-workspace-select-value-trigger]>span]:flex-wrap">
                                {property.id === "property:status" ? (
                                  <div className="flex h-7 w-full min-w-0 items-center rounded-md border border-transparent px-2">
                                    {renderBoardStatusValue(project.status, t)}
                                  </div>
                                ) : property.system ? <span className="block truncate">{value}</span> : (
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
