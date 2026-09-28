import { WorkspaceBoardView } from "../components/workspace/board-view";
import { WorkspaceSettingsView } from "../components/workspace/settings-view";
import { workspaceMockProjection, workspaceMockSettings } from "../workspaceMockData";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { WorkspaceEmptyState } from "../components/workspace/states";
import { WorkspaceLeftPanel } from "../components/workspace/left-panel";

export const Controls = () => (
  <div className="grid max-w-xl gap-6">
    <div className="flex flex-wrap items-center gap-3">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button disabled>Saving…</Button>
      <Button variant="destructive">Delete</Button>
    </div>
    <Input aria-label="Project name" placeholder="Project name" />
    <div className="flex gap-2">
      <Badge variant="secondary">In progress</Badge>
      <Badge variant="outline">Local folder</Badge>
    </div>
    <p className="text-sm text-muted-foreground">
      Tab through the controls to inspect focus; hover and press to compare state fills.
    </p>
  </div>
);

export const Surfaces = () => (
  <div className="grid max-w-3xl grid-cols-3 gap-4">
    {["sidebar", "recessed", "raised"].map((surface) => (
      <div
        key={surface}
        className="rounded-lg border border-border p-4"
        style={{ background: `var(--surface-${surface})` }}
      >
        <strong>{surface}</strong>
        <p className="mt-2 text-sm text-muted-foreground">
          Neutral surfaces, readable secondary text and quiet seams.
        </p>
      </div>
    ))}
    <div className="workspace-board-column col-span-3 rounded-lg p-3">
      <div className="workspace-board-card rounded-lg border bg-card p-4">
        <h3 className="font-medium">Project folder</h3>
        <p className="mt-2 text-sm text-muted-foreground">Board card on a recessed lane</p>
      </div>
    </div>
  </div>
);

export const Sidebar = () => {
  const [active, setActive] = useState<string | null>("design");
  const [query, setQuery] = useState("");
  return (
    <div className="workspace-sidebar w-64 rounded-lg border border-border p-3">
      <WorkspaceLeftPanel
        activeSurface="workspace"
        activeWorkspaceId={active}
        workspaces={[
          { id: "design", name: "Design projects" },
          { id: "delivery", name: "Delivery" },
        ]}
        searchQuery={query}
        onSearchQueryChange={setQuery}
        onWorkspaceOpen={setActive}
        onAddWorkspace={() => {}}
        onRenameWorkspace={() => {}}
        onDeleteWorkspace={() => {}}
        onReorderWorkspaces={() => {}}
        onOpenSettings={() => {}}
      />
    </div>
  );
};
export const NoSource = () => <WorkspaceEmptyState onOpenSettings={() => {}} />;

// The catalog uses explicit presentation fixtures and never connects to filesystem IPC.
export const Board = () => {
  const [selected, setSelected] = useState("");
  return (
    <div className="h-[32rem]">
      <WorkspaceBoardView
        projection={workspaceMockProjection.projection}
        statusValues={workspaceMockProjection.statusValues}
        visibleProperties={workspaceMockProjection.visibleProperties}
        selectValues={[]}
        onProjectOpen={(project) => setSelected(project.name)}
        onProjectPropertyValueChange={() => {}}
        onCreateSelectValue={async () => null}
        onRenameSelectValue={() => {}}
        onColorSelectValue={() => {}}
        onDeleteSelectValue={() => {}}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {selected
          ? `Selected fixture: ${selected}`
          : "Select a project to inspect its action state."}
      </p>
    </div>
  );
};

export const Settings = () => (
  <WorkspaceSettingsView
    sourceFolder={{ ...workspaceMockSettings.sourceFolder, path: "/catalog/temporary-projects" }}
    folderRoleTree={workspaceMockSettings.folderRoleTree}
    statusValues={workspaceMockProjection.statusValues}
    selectValues={[]}
    onSelectFolder={() => {}}
    onFolderRoleChange={() => {}}
    onColorStatusValue={() => {}}
  />
);
