import { useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import {
  Activity,
  Bell,
  Check,
  CircleHelp,
  Command,
  Folder,
  GitBranch,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SquarePen,
  Trash2,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Workspace = {
  id: string;
  name: string;
  branch: string;
  status: "Active" | "Idle" | "Review";
};

type WorkspaceState = {
  workspaces: Workspace[];
  selectedWorkspaceId: string;
};

const workspaceStorageKey = "workspace.dashboard.workspaces";
const selectedWorkspaceStorageKey = "workspace.dashboard.selectedWorkspaceId";

const defaultWorkspaces: Workspace[] = [
  { id: "workspace-project-folder", name: "project_folder", branch: "app-redesign", status: "Active" },
  { id: "workspace-neovimbanner", name: "NeoVimBanner", branch: "main", status: "Review" },
  { id: "workspace-markdown-le", name: "markdown-le", branch: "content-pass", status: "Idle" },
  { id: "workspace-new-electric", name: "new-electric", branch: "prototype", status: "Idle" },
];

const workspaceMetrics = [
  { label: "Open tasks", value: "18", tone: "default" },
  { label: "Branches", value: "6", tone: "secondary" },
  { label: "Reviews", value: "3", tone: "outline" },
] as const;

function App() {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(loadInitialWorkspaceState);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [activeActionsWorkspaceId, setActiveActionsWorkspaceId] = useState<string | null>(null);
  const [pendingDeleteWorkspaceId, setPendingDeleteWorkspaceId] = useState<string | null>(null);

  const { workspaces, selectedWorkspaceId } = workspaceState;
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) || workspaces[0],
    [selectedWorkspaceId, workspaces],
  );
  const visibleWorkspaces = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return normalizedSearch
      ? workspaces.filter((workspace) => workspace.name.toLowerCase().includes(normalizedSearch))
      : workspaces;
  }, [searchTerm, workspaces]);

  useEffect(() => {
    localStorage.setItem(workspaceStorageKey, JSON.stringify(workspaces));
    localStorage.setItem(selectedWorkspaceStorageKey, selectedWorkspaceId);
  }, [selectedWorkspaceId, workspaces]);

  function addWorkspace() {
    const workspace: Workspace = {
      id: `workspace-${Date.now()}`,
      name: "Workspace",
      branch: "new-branch",
      status: "Active",
    };

    setSearchTerm("");
    setEditingWorkspaceId(null);
    setPendingDeleteWorkspaceId(null);
    setActiveActionsWorkspaceId(null);
    setWorkspaceState((current) => ({
      workspaces: [...current.workspaces, workspace],
      selectedWorkspaceId: workspace.id,
    }));
  }

  function selectWorkspace(workspaceId: string) {
    setEditingWorkspaceId(null);
    setPendingDeleteWorkspaceId(null);
    setWorkspaceState((current) => ({
      ...current,
      selectedWorkspaceId: workspaceId,
    }));
  }

  function renameWorkspace(workspaceId: string) {
    setPendingDeleteWorkspaceId(null);
    setActiveActionsWorkspaceId(null);
    setEditingWorkspaceId(workspaceId);
  }

  function commitWorkspaceRename(workspaceId: string, nextName: string) {
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      setEditingWorkspaceId(null);
      return;
    }

    setWorkspaceState((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) => (item.id === workspaceId ? { ...item, name: trimmedName } : item)),
    }));
    setEditingWorkspaceId(null);
  }

  function deleteWorkspace(workspaceId: string) {
    if (workspaces.length <= 1) {
      return;
    }

    setEditingWorkspaceId(null);
    setActiveActionsWorkspaceId(null);
    setPendingDeleteWorkspaceId(workspaceId);
  }

  function confirmDeleteWorkspace(workspaceId: string) {
    if (workspaces.length <= 1) {
      return;
    }

    setPendingDeleteWorkspaceId(null);
    setWorkspaceState((current) => {
      const nextWorkspaces = current.workspaces.filter((item) => item.id !== workspaceId);
      return {
        workspaces: nextWorkspaces,
        selectedWorkspaceId:
          current.selectedWorkspaceId === workspaceId ? nextWorkspaces[0].id : current.selectedWorkspaceId,
      };
    });
  }

  function toggleActions(event: ReactMouseEvent<HTMLButtonElement>, workspaceId: string) {
    event.stopPropagation();
    setPendingDeleteWorkspaceId(null);
    setEditingWorkspaceId(null);
    setActiveActionsWorkspaceId((current) => (current === workspaceId ? null : workspaceId));
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <div
          className="dashboard-shell dark"
          onClick={() => {
            setPendingDeleteWorkspaceId(null);
            setActiveActionsWorkspaceId(null);
          }}
        >
          <DashboardSidebar
            workspaces={workspaces}
            visibleWorkspaces={visibleWorkspaces}
            selectedWorkspaceId={selectedWorkspaceId}
            searchTerm={searchTerm}
            editingWorkspaceId={editingWorkspaceId}
            activeActionsWorkspaceId={activeActionsWorkspaceId}
            pendingDeleteWorkspaceId={pendingDeleteWorkspaceId}
            onSearchChange={setSearchTerm}
            onAddWorkspace={addWorkspace}
            onSelectWorkspace={selectWorkspace}
            onRenameWorkspace={renameWorkspace}
            onRenameCommit={commitWorkspaceRename}
            onRenameCancel={() => setEditingWorkspaceId(null)}
            onDeleteWorkspace={deleteWorkspace}
            onDeleteConfirm={confirmDeleteWorkspace}
            onActionsToggle={toggleActions}
          />
          <SidebarInset className="dashboard-inset">
            <WindowToolbar />
            <WorkspaceContent activeWorkspace={activeWorkspace} workspaceCount={workspaces.length} />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

type DashboardSidebarProps = {
  workspaces: Workspace[];
  visibleWorkspaces: Workspace[];
  selectedWorkspaceId: string;
  searchTerm: string;
  editingWorkspaceId: string | null;
  activeActionsWorkspaceId: string | null;
  pendingDeleteWorkspaceId: string | null;
  onSearchChange: (value: string) => void;
  onAddWorkspace: () => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onRenameWorkspace: (workspaceId: string) => void;
  onRenameCommit: (workspaceId: string, nextName: string) => void;
  onRenameCancel: () => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onDeleteConfirm: (workspaceId: string) => void;
  onActionsToggle: (event: ReactMouseEvent<HTMLButtonElement>, workspaceId: string) => void;
};

function DashboardSidebar({
  workspaces,
  visibleWorkspaces,
  selectedWorkspaceId,
  searchTerm,
  editingWorkspaceId,
  activeActionsWorkspaceId,
  pendingDeleteWorkspaceId,
  onSearchChange,
  onAddWorkspace,
  onSelectWorkspace,
  onRenameWorkspace,
  onRenameCommit,
  onRenameCancel,
  onDeleteWorkspace,
  onDeleteConfirm,
  onActionsToggle,
}: DashboardSidebarProps) {
  return (
    <Sidebar collapsible="icon" variant="sidebar" className="dashboard-sidebar">
      <SidebarHeader className="dashboard-sidebar-header">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="workspace-switcher" tooltip="Command center">
              <span className="workspace-logo">
                <Command />
              </span>
              <span className="workspace-switcher-copy">
                <span className="workspace-switcher-title">Command center</span>
                <span className="workspace-switcher-subtitle">{workspaces.length} workspaces</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="dashboard-search">
          <Search className="dashboard-search-icon" aria-hidden="true" />
          <Input
            id="workspaceSearch"
            type="search"
            placeholder="Search workspaces"
            autoComplete="off"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Button id="newWorkspaceButton" type="button" variant="secondary" size="sm" onClick={onAddWorkspace}>
          <Plus data-icon="inline-start" />
          New Workspace
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu id="workspaceList" aria-label="Workspace">
              {visibleWorkspaces.length > 0 ? (
                visibleWorkspaces.map((workspace) => (
                  <WorkspaceMenuRow
                    key={workspace.id}
                    workspace={workspace}
                    isSelected={workspace.id === selectedWorkspaceId}
                    isEditing={workspace.id === editingWorkspaceId}
                    showActions={workspace.id === activeActionsWorkspaceId}
                    isDeletePending={workspace.id === pendingDeleteWorkspaceId}
                    canDelete={workspaces.length > 1}
                    onSelect={onSelectWorkspace}
                    onRename={onRenameWorkspace}
                    onRenameCommit={onRenameCommit}
                    onRenameCancel={onRenameCancel}
                    onDelete={onDeleteWorkspace}
                    onDeleteConfirm={onDeleteConfirm}
                    onActionsToggle={onActionsToggle}
                  />
                ))
              ) : (
                <SidebarMenuItem>
                  <div className="empty-results">No workspace</div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Signals</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Activity">
                  <Activity />
                  <span>Activity</span>
                  <Badge variant="secondary" className="ml-auto">
                    Live
                  </Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Branches">
                  <GitBranch />
                  <span>Branches</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton id="settingsButton" tooltip="Settings">
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="sidebar-account">
          <Avatar className="size-7">
            <AvatarFallback>WS</AvatarFallback>
          </Avatar>
          <div className="sidebar-account-copy">
            <span>Workspace</span>
            <span>Local session</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

type WorkspaceMenuRowProps = {
  workspace: Workspace;
  isSelected: boolean;
  isEditing: boolean;
  showActions: boolean;
  isDeletePending: boolean;
  canDelete: boolean;
  onSelect: (workspaceId: string) => void;
  onRename: (workspaceId: string) => void;
  onRenameCommit: (workspaceId: string, nextName: string) => void;
  onRenameCancel: () => void;
  onDelete: (workspaceId: string) => void;
  onDeleteConfirm: (workspaceId: string) => void;
  onActionsToggle: (event: ReactMouseEvent<HTMLButtonElement>, workspaceId: string) => void;
};

function WorkspaceMenuRow({
  workspace,
  isSelected,
  isEditing,
  showActions,
  isDeletePending,
  canDelete,
  onSelect,
  onRename,
  onRenameCommit,
  onRenameCancel,
  onDelete,
  onDeleteConfirm,
  onActionsToggle,
}: WorkspaceMenuRowProps) {
  const handleRenameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("workspaceName") as HTMLInputElement | null;
    onRenameCommit(workspace.id, input?.value || "");
  };
  const handleRenameKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onRenameCancel();
    }
  };

  return (
    <SidebarMenuItem>
      {isEditing ? (
        <form className="workspace-rename-form" onSubmit={handleRenameSubmit}>
          <Folder aria-hidden="true" />
          <Input
            className="workspace-name-input"
            name="workspaceName"
            aria-label={`Rename ${workspace.name}`}
            defaultValue={workspace.name}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => onRenameCommit(workspace.id, event.currentTarget.value)}
            onKeyDown={handleRenameKeyDown}
          />
        </form>
      ) : (
        <SidebarMenuButton
          type="button"
          isActive={isSelected}
          tooltip={workspace.name}
          onClick={() => onSelect(workspace.id)}
        >
          <Folder />
          <span>{workspace.name}</span>
          <Badge variant={workspace.status === "Active" ? "default" : "secondary"} className="workspace-status">
            {workspace.status}
          </Badge>
        </SidebarMenuButton>
      )}

      {isDeletePending ? (
        <SidebarMenuAction
          type="button"
          aria-label={`Confirm delete ${workspace.name}`}
          className="workspace-confirm-action"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteConfirm(workspace.id);
          }}
        >
          <Check />
        </SidebarMenuAction>
      ) : (
        <SidebarMenuAction
          type="button"
          aria-label={`Workspace actions for ${workspace.name}`}
          showOnHover
          onClick={(event) => onActionsToggle(event, workspace.id)}
        >
          <MoreHorizontal />
        </SidebarMenuAction>
      )}

      {showActions ? (
        <div className="workspace-inline-actions" onClick={(event) => event.stopPropagation()}>
          <Button type="button" variant="ghost" size="xs" onClick={() => onRename(workspace.id)}>
            <SquarePen data-icon="inline-start" />
            Rename
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="xs"
            disabled={!canDelete}
            onClick={() => onDelete(workspace.id)}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      ) : null}
    </SidebarMenuItem>
  );
}

function WindowToolbar() {
  return (
    <header className="window-drag-region">
      <div className="toolbar-leading">
        <SidebarTrigger id="sidebarToggle" aria-label="Toggle sidebar (Command+B)" />
        <Separator orientation="vertical" className="toolbar-separator" />
        <span className="toolbar-title">Workspace dashboard</span>
      </div>
      <div className="toolbar-actions">
        <IconTooltip label="Notifications">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Notifications">
            <Bell />
          </Button>
        </IconTooltip>
        <IconTooltip label="Help">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Help">
            <CircleHelp />
          </Button>
        </IconTooltip>
      </div>
    </header>
  );
}

function IconTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function WorkspaceContent({ activeWorkspace, workspaceCount }: { activeWorkspace?: Workspace; workspaceCount: number }) {
  return (
    <main className="workspace-content" aria-label="Workspace surface">
      <section className="workspace-hero" aria-live="polite">
        <div className="workspace-hero-copy">
          <Badge variant="outline">Current workspace</Badge>
          <h1 id="activeWorkspaceName">{activeWorkspace?.name || "project_folder"}</h1>
          <p>
            Local workspace command surface with branch status, review signals, and quick project actions in a compact
            shadcn dashboard shell.
          </p>
        </div>
        <div className="workspace-hero-actions">
          <Button type="button">
            <Command data-icon="inline-start" />
            Open command
          </Button>
          <Button type="button" variant="outline">
            <GitBranch data-icon="inline-start" />
            {activeWorkspace?.branch || "main"}
          </Button>
        </div>
      </section>

      <section className="workspace-grid" aria-label="Workspace overview">
        {workspaceMetrics.map((metric) => (
          <div className="workspace-panel" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <Badge variant={metric.tone}>Workspace</Badge>
          </div>
        ))}
        <div className="workspace-panel workspace-panel-wide">
          <span>Repository state</span>
          <strong>{activeWorkspace?.branch || "main"}</strong>
          <p>{workspaceCount} local workspaces available from the sidebar.</p>
        </div>
      </section>
    </main>
  );
}

function loadInitialWorkspaceState(): WorkspaceState {
  const workspaces = loadWorkspaces();
  return {
    workspaces,
    selectedWorkspaceId: loadSelectedWorkspaceId(workspaces),
  };
}

function loadWorkspaces(): Workspace[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(workspaceStorageKey) || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .filter((workspace) => workspace && typeof workspace.id === "string" && typeof workspace.name === "string")
        .map((workspace) => ({
          id: workspace.id,
          name: workspace.name.trim() || "project_folder",
          branch: typeof workspace.branch === "string" ? workspace.branch : "main",
          status: isWorkspaceStatus(workspace.status) ? workspace.status : "Idle",
        }));
    }
  } catch {
    localStorage.removeItem(workspaceStorageKey);
  }

  return defaultWorkspaces.map((workspace) => ({ ...workspace }));
}

function loadSelectedWorkspaceId(workspaces: Workspace[]): string {
  const storedId = localStorage.getItem(selectedWorkspaceStorageKey);
  return storedId && workspaces.some((workspace) => workspace.id === storedId) ? storedId : workspaces[0].id;
}

function isWorkspaceStatus(value: unknown): value is Workspace["status"] {
  return value === "Active" || value === "Idle" || value === "Review";
}

export default App;
