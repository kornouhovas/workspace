import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WorkspaceMockProject, WorkspaceMockVisibleProperty } from "@/workspaceMockData";

type WorkspaceTableProjection = {
  readonly rows: readonly WorkspaceMockProject[];
};

type WorkspaceTableViewProps = {
  readonly projection: WorkspaceTableProjection;
  readonly visibleProperties: readonly WorkspaceMockVisibleProperty[];
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

export function WorkspaceTableView({ projection, visibleProperties }: WorkspaceTableViewProps) {
  return (
    <section className="flex min-h-0 flex-col gap-3 px-4 pb-4" aria-labelledby="workspace-table-heading">
      <div>
        <h2 id="workspace-table-heading" className="text-sm font-semibold">
          Table
        </h2>
        <p className="text-xs text-muted-foreground">Rows use the same mock project set as the Board projection.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleProperties.map((property) => (
                <TableHead key={property.id} className="min-w-36">
                  {property.name}
                </TableHead>
              ))}
              <TableHead className="min-w-56">Path</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projection.rows.map((project) => (
              <TableRow key={project.id}>
                {visibleProperties.map((property) => (
                  <TableCell key={property.id} className="max-w-56 truncate">
                    {getPropertyValue(project, property)}
                  </TableCell>
                ))}
                <TableCell className="max-w-72 truncate text-muted-foreground">
                  {project.currentRelativePath}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
