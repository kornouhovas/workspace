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
      className="h-8 max-w-full cursor-default select-none gap-3 rounded-none border-0 bg-transparent px-0 text-base font-normal text-muted-foreground shadow-none"
    >
      <span className="size-3 rounded-full bg-muted-foreground/70" data-color={color} aria-hidden="true" />
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
      const viewportWidth = viewport.clientWidth;
      onViewportWidthChange?.(viewportWidth);
    };
    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  }, [onViewportWidthChange]);

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden pb-11 pl-7 pr-7 pt-6" aria-label={t("view.boardDefault")}>
      <div ref={boardViewportRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="grid h-full min-w-full w-max grid-flow-col gap-4" style={boardGridStyle}>
          {projection.columns.map((column) => {
            const statusColor = statusValues.find((value) => value.id === column.statusValueId)?.color || "gray";
            return (
              <section
              key={column.statusValueId}
              className="workspace-board-column flex min-h-0 min-w-0 flex-col rounded-xl bg-[#f3f6fc]"
              aria-label={t("board.projectsAria", {
                name: getStatusDisplayName(t, { id: column.statusValueId, name: column.name }),
              })}
            >
              <header className="flex h-[60px] shrink-0 items-center justify-between px-5">
                <h3 className="flex min-w-0 items-center gap-3 truncate text-lg font-medium">
                  <span className="size-3.5 shrink-0 rounded-full bg-muted-foreground/70" data-color={statusColor} aria-hidden="true" />
                  {getStatusDisplayName(t, { id: column.statusValueId, name: column.name })}
                </h3>
                <span className="sr-only">{column.projects.length}</span>
              </header>
              <div className="grid min-h-0 flex-1 auto-rows-max content-start gap-3 overflow-y-auto overflow-x-hidden px-2.5 pb-2.5">
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
                      className="workspace-board-card relative flex min-h-12 w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-xl border border-border bg-card px-3 pb-[9px] pt-[19px] text-left text-card-foreground shadow-xs hover:border-ring/60 focus-within:border-ring"
                    >
                      <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 rounded-lg" onClick={() => onProjectOpen(project)} />
                      <h4 className="relative min-w-0 text-lg font-medium leading-7">
                        <button type="button" title={project.name} className="flex h-8 w-full min-w-0 items-center rounded-lg border border-transparent px-2.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => onProjectOpen(project)}>
                          <span className="truncate">{project.name}</span>
                        </button>
                      </h4>
                      {populatedProperties.length > 0 ? (
                        <dl className="relative grid gap-0.5">
                          {populatedProperties.map(({ property, value }) => (
                          <div key={property.id} className="min-w-0 text-base">
                              <dt className="sr-only">{property.name}</dt>
                              <dd className="min-w-0 text-foreground [&_[data-workspace-select-value-trigger]]:h-auto [&_[data-workspace-select-value-trigger]]:min-h-8 [&_[data-workspace-select-value-trigger]>span]:flex-wrap">
                                {property.id === "property:status" ? (
                                  <div className="flex h-8 w-full min-w-0 items-center rounded-lg border border-transparent px-2.5">
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
