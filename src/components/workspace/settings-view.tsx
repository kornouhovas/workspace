import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { WorkspaceFolderRoleNode } from "@/workspaceAppState";

type WorkspaceSourceFolder = {
  readonly name: string;
  readonly path: string;
  readonly state: string;
};

type WorkspaceSettingsViewProps = {
  readonly sourceFolder: WorkspaceSourceFolder;
  readonly folderRoleTree: readonly WorkspaceFolderRoleNode[];
  readonly onSelectFolder: () => void;
  readonly onCloseSettings: () => void;
  readonly selectingFolder?: boolean;
};

const roleOptions = ["group", "status", "project"] as const;

function FolderRoleNode({ node, depth = 0 }: { readonly node: WorkspaceFolderRoleNode; readonly depth?: number }) {
  return (
    <li>
      <div
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
        style={{ marginLeft: `${depth * 1.25}rem` }}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{node.name}</span>
            <Badge variant="outline">{node.status}</Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{node.relativePath}</p>
        </div>
        <ToggleGroup
          aria-label={`Role for ${node.name}`}
          defaultValue={node.role}
          size="sm"
          type="single"
          variant="outline"
        >
          {roleOptions.map((role) => (
            <ToggleGroupItem key={role} aria-label={`Set ${node.name} as ${role}`} value={role}>
              {role}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {node.children.length > 0 ? (
        <ul className="mt-2 grid gap-2">
          {node.children.map((child) => (
            <FolderRoleNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WorkspaceSettingsView({
  sourceFolder,
  folderRoleTree,
  onSelectFolder,
  onCloseSettings,
  selectingFolder = false,
}: WorkspaceSettingsViewProps) {
  return (
    <section className="grid gap-3 px-4 py-4 lg:grid-cols-[20rem_minmax(0,1fr)]" aria-labelledby="workspace-settings-heading">
      <div className="flex items-center justify-between gap-3 lg:col-span-2">
        <div className="min-w-0">
          <h2 id="workspace-settings-heading" className="text-sm font-semibold">
            Settings
          </h2>
          <p className="truncate text-xs text-muted-foreground">Workspace source and folder roles</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCloseSettings}>
          Back to workspace
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <h3 className="text-sm font-semibold">Source</h3>
          <Badge variant="secondary">Local only</Badge>
        </div>
        <Separator />
        <div className="grid gap-3 p-3">
          <div className="grid gap-1">
            <p className="text-xs font-medium text-muted-foreground">Source folder</p>
            <p className="truncate text-sm font-medium">{sourceFolder.name}</p>
            <p className="truncate text-xs text-muted-foreground">{sourceFolder.path}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            disabled={selectingFolder}
            onClick={onSelectFolder}
          >
            {selectingFolder ? "Selecting..." : "Select folder"}
          </Button>
        </div>
      </div>
      <div className="min-w-0 rounded-lg border border-border bg-muted/20">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Folder role tree</h3>
            <p className="truncate text-xs text-muted-foreground">{sourceFolder.path}</p>
          </div>
          <Badge variant="outline">{folderRoleTree.length} roots</Badge>
        </div>
        <Separator />
        <ul className="grid max-h-80 gap-2 overflow-auto p-3">
          {folderRoleTree.map((node) => (
            <FolderRoleNode key={node.id} node={node} />
          ))}
        </ul>
      </div>
    </section>
  );
}
