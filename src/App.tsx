import { WorkspaceLeftPanel } from "@/components/workspace/left-panel";
import { WorkspaceEmptyState } from "@/components/workspace/states";

export default function App() {
  return (
    <div className="dark flex h-screen min-h-0 bg-background text-foreground">
      <WorkspaceLeftPanel />
      <main data-testid="workspace-main" className="flex min-w-0 flex-1 flex-col">
        <header className="electron-window-drag flex h-12 shrink-0 items-center border-b border-border px-4">
          <h1 className="text-sm font-medium">Workspace Project Board</h1>
        </header>
        <div className="electron-window-no-drag min-h-0 flex-1 overflow-auto">
          <WorkspaceEmptyState />
        </div>
      </main>
    </div>
  );
}
