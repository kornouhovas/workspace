import { WorkspaceBoardView } from "@/components/workspace/board-view";
import { WorkspaceLeftPanel } from "@/components/workspace/left-panel";
import { WorkspaceTableView } from "@/components/workspace/table-view";
import { WorkspaceViewTabs } from "@/components/workspace/view-tabs";
import { workspaceMockProjection } from "@/workspaceMockData";

export default function App() {
  return (
    <div className="dark flex h-screen min-h-0 bg-background text-foreground">
      <WorkspaceLeftPanel />
      <main data-testid="workspace-main" className="flex min-w-0 flex-1 flex-col">
        <header className="electron-window-drag flex h-12 shrink-0 items-center border-b border-border px-4">
          <h1 className="text-sm font-medium">Workspace Project Board</h1>
        </header>
        <div className="electron-window-no-drag flex min-h-0 flex-1 flex-col overflow-hidden">
          <WorkspaceViewTabs
            activeViewId={workspaceMockProjection.activeViewId}
            views={workspaceMockProjection.views}
          />
          <div className="min-h-0 flex-1 overflow-auto">
            <WorkspaceBoardView
              projection={workspaceMockProjection.projection}
              visibleProperties={workspaceMockProjection.visibleProperties}
            />
            <WorkspaceTableView
              projection={workspaceMockProjection.tableProjection}
              visibleProperties={workspaceMockProjection.visibleProperties}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
