import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GripVerticalIcon } from "@/lib/lucide-icons";
import type { WorkspaceMockProject, WorkspaceMockVisibleProperty } from "@/workspaceMockData";

type WorkspaceTableProjection = {
  readonly rows: readonly WorkspaceMockProject[];
};

type WorkspaceTableViewProps = {
  readonly projection: WorkspaceTableProjection;
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

export function WorkspaceTableView({ projection, visibleProperties, onProjectOpen }: WorkspaceTableViewProps) {
  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden gap-3 pl-4 pr-0 pt-4 pb-0" aria-labelledby="workspace-table-heading">
      <div>
        <h2 id="workspace-table-heading" className="text-sm font-semibold">
          Table
        </h2>
        <p className="text-xs text-muted-foreground">Rows use the same mock project set as the Board projection.</p>
      </div>
      <div className="min-h-0 w-full flex-1 overflow-auto rounded-lg border border-border">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-9" aria-label="Row reorder" />
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
              <TableRow
                key={project.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => onProjectOpen(project)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onProjectOpen(project);
                  }
                }}
              >
                <TableCell className="w-9 text-muted-foreground">
                  <GripVerticalIcon className="size-4" aria-hidden="true" />
                </TableCell>
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
