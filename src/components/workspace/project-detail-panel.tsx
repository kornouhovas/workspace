import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  WorkspaceMockFileTreeNode,
  WorkspaceMockProject,
  WorkspaceMockVisibleProperty,
} from "@/workspaceMockData";

type WorkspaceProjectDetailPanelProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly project: WorkspaceMockProject | null;
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

function FileTreeNode({ node, depth = 0 }: { readonly node: WorkspaceMockFileTreeNode; readonly depth?: number }) {
  const isFolder = node.kind === "folder";

  return (
    <li>
      <Button
        type="button"
        variant="ghost"
        disabled={!node.available}
        className="h-auto w-full justify-start px-2 py-1.5 text-left"
        title={node.relativePath}
      >
        <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2" style={{ paddingLeft: `${depth * 1}rem` }}>
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            {isFolder ? "Folder" : "File"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm">{node.name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{node.relativePath}</span>
          </span>
          {!node.available ? <Badge variant="destructive">Missing</Badge> : null}
        </span>
      </Button>
      {isFolder && node.children && node.children.length > 0 ? (
        <ul className="grid gap-1">
          {node.children.map((child) => (
            <FileTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WorkspaceProjectDetailPanel({
  open,
  onOpenChange,
  project,
  visibleProperties,
}: WorkspaceProjectDetailPanelProps) {
  return (
    <Sheet open={open && project !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[30rem] sm:max-w-[30rem]">
        {project ? (
          <>
            <SheetHeader>
              <SheetTitle>{project.name}</SheetTitle>
              <SheetDescription className="truncate">{project.currentRelativePath}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
              <div className="grid gap-4">
                <section className="grid gap-2" aria-labelledby="project-identity-heading">
                  <h3 id="project-identity-heading" className="text-xs font-medium text-muted-foreground">
                    Name
                  </h3>
                  <div className="grid gap-1">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{project.status.name}</Badge>
                      <span className="truncate text-xs text-muted-foreground">{project.currentRelativePath}</span>
                    </div>
                  </div>
                </section>
                <Separator />
                <section className="grid gap-2" aria-labelledby="project-properties-heading">
                  <h3 id="project-properties-heading" className="text-xs font-medium text-muted-foreground">
                    Properties
                  </h3>
                  <dl className="grid gap-2">
                    {visibleProperties.map((property) => (
                      <div key={property.id} className="grid grid-cols-[6rem_1fr] gap-3 text-sm">
                        <dt className="truncate text-muted-foreground">{property.name}</dt>
                        <dd className="truncate text-foreground">{getPropertyValue(project, property)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <Separator />
                <section className="grid gap-2" aria-labelledby="project-file-tree-heading">
                  <div className="flex items-center justify-between gap-3">
                    <h3 id="project-file-tree-heading" className="text-xs font-medium text-muted-foreground">
                      File tree
                    </h3>
                    <Badge variant="secondary">{project.fileTree.length} items</Badge>
                  </div>
                  <ul className="grid gap-1">
                    {project.fileTree.map((node) => (
                      <FileTreeNode key={node.id} node={node} />
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </>
        ) : (
          <SheetHeader>
            <SheetTitle>Project detail</SheetTitle>
            <SheetDescription>No project selected.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
