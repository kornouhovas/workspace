import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WorkspacePropertyControls } from "@/components/workspace/property-controls";
import { ChevronDownIcon, ChevronRightIcon } from "@/lib/lucide-icons";
import type {
  WorkspaceFolderRoleNode,
  WorkspaceProjectionResponse,
  WorkspaceSelectValueState,
} from "@/workspaceAppState";

type WorkspaceSourceFolder = {
  readonly name: string;
  readonly path: string;
  readonly state: string;
};

type WorkspaceSettingsViewProps = {
  readonly sourceFolder: WorkspaceSourceFolder;
  readonly folderRoleTree: readonly WorkspaceFolderRoleNode[];
  readonly statusValues: WorkspaceProjectionResponse["statusValues"];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly onSelectFolder: () => void;
  readonly onCloseSettings: () => void;
  readonly onFolderRoleChange: (node: WorkspaceFolderRoleNode, role: WorkspaceFolderRoleNode["role"]) => void;
  readonly onColorStatusValue: (statusValueId: string, color: string) => void;
  readonly selectingFolder?: boolean;
};

const roleOptions = ["group", "status", "project"] as const;

function FolderRoleNode({
  node,
  depth = 0,
  expandedFolderIds,
  onToggleFolderExpanded,
  onFolderRoleChange,
}: {
  readonly node: WorkspaceFolderRoleNode;
  readonly depth?: number;
  readonly expandedFolderIds: ReadonlySet<string>;
  readonly onToggleFolderExpanded: (nodeId: string) => void;
  readonly onFolderRoleChange: (node: WorkspaceFolderRoleNode, role: WorkspaceFolderRoleNode["role"]) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedFolderIds.has(node.id);

  return (
    <li>
      <div
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
        style={{ marginLeft: `${depth * 1.25}rem` }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!hasChildren}
          aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          onClick={() => onToggleFolderExpanded(node.id)}
        >
          {expanded ? (
            <ChevronDownIcon className="size-4" aria-hidden="true" />
          ) : (
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          )}
        </Button>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{node.name}</span>
            <Badge variant="outline">{node.status}</Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{node.relativePath}</p>
        </div>
        <ToggleGroup
          aria-label={`Role for ${node.name}`}
          value={node.role}
          onValueChange={(value) => {
            if (value === "group" || value === "status" || value === "project") {
              onFolderRoleChange(node, value);
            }
          }}
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
      {hasChildren && expanded ? (
        <ul className="mt-2 grid gap-2">
          {node.children.map((child) => (
            <FolderRoleNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedFolderIds={expandedFolderIds}
              onToggleFolderExpanded={onToggleFolderExpanded}
              onFolderRoleChange={onFolderRoleChange}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WorkspaceSettingsView({
  sourceFolder,
  folderRoleTree,
  statusValues,
  selectValues,
  onSelectFolder,
  onCloseSettings,
  onFolderRoleChange,
  onColorStatusValue,
  selectingFolder = false,
}: WorkspaceSettingsViewProps) {
  const [expandedFolderIds, setExpandedFolderIds] = useState<ReadonlySet<string>>(() => new Set());

  function toggleFolderExpanded(nodeId: string) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      return next;
    });
  }

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
            <FolderRoleNode
              key={node.id}
              node={node}
              expandedFolderIds={expandedFolderIds}
              onToggleFolderExpanded={toggleFolderExpanded}
              onFolderRoleChange={onFolderRoleChange}
            />
          ))}
        </ul>
      </div>
      <div className="lg:col-span-2">
        <WorkspacePropertyControls
          statusValues={statusValues}
          selectValues={selectValues}
          onColorStatusValue={onColorStatusValue}
        />
      </div>
    </section>
  );
}
