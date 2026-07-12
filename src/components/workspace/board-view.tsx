import { useEffect, useRef, type CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import type { WorkspaceMockProject, WorkspaceMockVisibleProperty } from "@/workspaceMockData";
import type { WorkspaceSelectValueState } from "@/workspaceAppState";
import { normalizeBoardColumnWidth } from "@/workspaceBoardLayout.js";

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

type WorkspaceBoardViewProps = {
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
) {
  if (property.propertyType === "select") {
    return selectValues.find((selectValue) => selectValue.id === value)?.name || "";
  }

  if (property.propertyType === "multi-select" && Array.isArray(value)) {
    return value
      .map((valueId) => selectValues.find((selectValue) => selectValue.id === valueId)?.name)
      .filter(Boolean)
      .join(", ");
  }

  return value == null ? "" : String(value);
}

function renderBoardStatusValue(value: unknown) {
  const statusValue = value && typeof value === "object" && !Array.isArray(value)
    ? value as { readonly name?: unknown; readonly color?: unknown }
    : null;
  const label = statusValue ? String(statusValue.name || "") : value == null ? "" : String(value);
  const color = typeof statusValue?.color === "string" && statusValue.color ? statusValue.color : "gray";

  if (!label) {
    return null;
  }

  return (
    <Badge
      variant="secondary"
      className="h-6 max-w-full cursor-default select-none gap-1.5 rounded-md border border-border/50 bg-secondary/70 px-2 text-[13px] font-medium"
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
}: WorkspaceBoardViewProps) {
  const { t } = useI18n();
  const cardProperties = visibleProperties.filter(
    (property) => property.id !== "property:name" && property.id !== "property:status",
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
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden gap-3 pl-4 pr-0 pt-4 pb-0" aria-label={t("view.boardDefault")}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge variant="outline">{t("board.moveDisabled")}</Badge>
      </div>
      <div ref={boardViewportRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="grid h-full min-w-full w-max grid-flow-col gap-3" style={boardGridStyle}>
          {projection.columns.map((column) => (
            <section
              key={column.statusValueId}
              className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-muted/20"
              aria-label={t("board.projectsAria", { name: column.name })}
            >
              <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
                <h3 className="min-w-0 truncate text-sm font-medium">{column.name}</h3>
                <Badge variant="secondary" className="shrink-0">{column.projects.length}</Badge>
              </header>
              <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto overflow-x-hidden p-2">
                {column.projects.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    {t("board.noProjects")}
                  </div>
                ) : (
                  column.projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className="flex min-h-24 w-full min-w-0 flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-3 text-left text-card-foreground shadow-xs hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                      onClick={() => onProjectOpen(project)}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-medium leading-snug">{project.name}</h4>
                        </div>
                        <div className="max-w-28 shrink-0 overflow-hidden">{renderBoardStatusValue(project.status)}</div>
                      </div>
                      {cardProperties.length > 0 ? (
                        <dl className="grid gap-2">
                          {cardProperties.map((property) => (
                            <div key={property.id} className="grid grid-cols-[5rem_1fr] gap-2 text-xs">
                              <dt className="truncate text-muted-foreground">{property.name}</dt>
                              <dd className="truncate text-foreground">
                                {formatPropertyValue(getPropertyValue(project, property), property, selectValues)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
