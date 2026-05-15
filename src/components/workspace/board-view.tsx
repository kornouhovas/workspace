import { Badge } from "@/components/ui/badge";
import type { WorkspaceMockProject, WorkspaceMockVisibleProperty } from "@/workspaceMockData";

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
  readonly visibleProperties: readonly WorkspaceMockVisibleProperty[];
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

export function WorkspaceBoardView({ projection, visibleProperties, onProjectOpen }: WorkspaceBoardViewProps) {
  const cardProperties = visibleProperties.filter(
    (property) => property.id !== "property:name" && property.id !== "property:status",
  );

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden gap-3 pl-4 pr-0 pt-4 pb-0" aria-labelledby="workspace-board-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="workspace-board-heading" className="text-sm font-semibold">
            Board
          </h2>
          <p className="text-xs text-muted-foreground">
            Status columns are fixed for the MVP; cross-status drag and drop is disabled.
          </p>
        </div>
        <Badge variant="outline">Move disabled</Badge>
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="grid h-full w-full auto-cols-[minmax(20rem,1fr)] grid-flow-col gap-3">
          {projection.columns.map((column) => (
            <section
              key={column.statusValueId}
              className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-muted/20"
              aria-label={`${column.name} projects`}
            >
              <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
                <h3 className="min-w-0 truncate text-sm font-medium">{column.name}</h3>
                <Badge variant="secondary" className="shrink-0">{column.projects.length}</Badge>
              </header>
              <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto overflow-x-hidden p-2">
                {column.projects.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    No projects
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
                          <p className="mt-1 truncate text-xs leading-snug text-muted-foreground">
                            {project.currentRelativePath}
                          </p>
                        </div>
                        <Badge variant="outline" className="max-w-28 shrink-0 truncate">{project.status.name}</Badge>
                      </div>
                      {cardProperties.length > 0 ? (
                        <dl className="grid gap-2">
                          {cardProperties.map((property) => (
                            <div key={property.id} className="grid grid-cols-[5rem_1fr] gap-2 text-xs">
                              <dt className="truncate text-muted-foreground">{property.name}</dt>
                              <dd className="truncate text-foreground">{getPropertyValue(project, property)}</dd>
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
