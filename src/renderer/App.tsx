import { useEffect, useMemo, useState } from "react";
import type { DragEvent, MouseEvent, ReactNode } from "react";

type Workspace = {
  id: string;
  name: string;
};

type WorkspaceState = {
  workspaces: Workspace[];
  selectedWorkspaceId: string;
  workspaceCounter: number;
};

type ContextMenuState = {
  workspaceId: string;
  x: number;
  y: number;
};

type IconName =
  | "arrow-left"
  | "arrow-right"
  | "dots"
  | "folder"
  | "folder-plus"
  | "layout"
  | "rename"
  | "search"
  | "settings"
  | "trash";

const workspaceStorageKey = "workspace.leftPanel.workspaces";
const selectedWorkspaceStorageKey = "workspace.leftPanel.selectedWorkspaceId";
const collapsedStorageKey = "workspace.leftPanel.sidebarCollapsed";

const defaultWorkspaces: Workspace[] = [
  { id: "workspace-project-folder", name: "project_folder" },
  { id: "workspace-neovimbanner", name: "NeoVimBanner" },
  { id: "workspace-markdown-le", name: "markdown-le" },
  { id: "workspace-new-electric", name: "new-electric" },
];

const iconPaths: Record<IconName, ReactNode> = {
  "arrow-left": <path d="m15 18-6-6 6-6" />,
  "arrow-right": <path d="m9 18 6-6-6-6" />,
  dots: (
    <>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 7.75A2.75 2.75 0 0 1 6.25 5h4.2l2 2.25h5.3a2.75 2.75 0 0 1 2.75 2.75v6.25A2.75 2.75 0 0 1 17.75 19H6.25a2.75 2.75 0 0 1-2.75-2.75z" />
      <path d="M3.5 10h17" />
    </>
  ),
  "folder-plus": (
    <>
      <path d="M3.5 7.75A2.75 2.75 0 0 1 6.25 5h4.2l2 2.25h5.3a2.75 2.75 0 0 1 2.75 2.75v6.25A2.75 2.75 0 0 1 17.75 19H6.25a2.75 2.75 0 0 1-2.75-2.75z" />
      <path d="M3.5 10h17" />
      <path d="M12 12.25v4.5" />
      <path d="M9.75 14.5h4.5" />
    </>
  ),
  layout: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M9.5 5v14" />
    </>
  ),
  rename: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  settings: (
    <>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.37.36.87.56 1.4.56H21a2 2 0 0 1 0 4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
};

function App() {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(loadInitialWorkspaceState);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(loadInitialCollapsedState);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [draggedWorkspaceId, setDraggedWorkspaceId] = useState("");
  const [dropTargetWorkspaceId, setDropTargetWorkspaceId] = useState("");

  const { workspaces, selectedWorkspaceId, workspaceCounter } = workspaceState;
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

  useEffect(() => {
    localStorage.setItem(collapsedStorageKey, String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isSidebarShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b";
      if (isSidebarShortcut) {
        event.preventDefault();
        setIsCollapsed((current) => !current);
      }

      if (event.key === "Escape") {
        setContextMenu(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function addWorkspace() {
    const workspace: Workspace = {
      id: `workspace-${Date.now()}`,
      name: `workspace-${workspaceCounter}`,
    };

    setSearchTerm("");
    setWorkspaceState((current) => ({
      workspaces: [...current.workspaces, workspace],
      selectedWorkspaceId: workspace.id,
      workspaceCounter: current.workspaceCounter + 1,
    }));
  }

  function selectWorkspace(workspaceId: string) {
    setWorkspaceState((current) => ({
      ...current,
      selectedWorkspaceId: workspaceId,
    }));
  }

  function toggleSidebar() {
    setIsCollapsed((current) => !current);
  }

  function openContextMenu(event: MouseEvent<HTMLElement>, workspaceId: string) {
    event.preventDefault();
    event.stopPropagation();
    selectWorkspace(workspaceId);
    setContextMenu({
      workspaceId,
      x: Math.max(10, Math.min(event.clientX, window.innerWidth - 236)),
      y: Math.max(10, Math.min(event.clientY, window.innerHeight - 118)),
    });
  }

  function renameWorkspace(workspaceId: string) {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return;
    }

    const nextName = window.prompt("Rename workspace", workspace.name);
    const trimmedName = nextName?.trim();
    if (!trimmedName) {
      return;
    }

    setWorkspaceState((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) => (item.id === workspaceId ? { ...item, name: trimmedName } : item)),
    }));
  }

  function deleteWorkspace(workspaceId: string) {
    if (workspaces.length <= 1) {
      return;
    }

    const workspace = workspaces.find((item) => item.id === workspaceId);
    const confirmed = window.confirm(`Delete ${workspace?.name || "workspace"}?`);
    if (!confirmed) {
      return;
    }

    setWorkspaceState((current) => {
      const nextWorkspaces = current.workspaces.filter((item) => item.id !== workspaceId);
      return {
        ...current,
        workspaces: nextWorkspaces,
        selectedWorkspaceId:
          current.selectedWorkspaceId === workspaceId ? nextWorkspaces[0].id : current.selectedWorkspaceId,
      };
    });
  }

  function handleWorkspaceDragStart(event: DragEvent<HTMLDivElement>, workspaceId: string) {
    setDraggedWorkspaceId(workspaceId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", workspaceId);
    event.dataTransfer.setDragImage(event.currentTarget, 18, event.currentTarget.offsetHeight / 2);
  }

  function handleWorkspaceDragOver(event: DragEvent<HTMLDivElement>, workspaceId: string) {
    if (!draggedWorkspaceId || draggedWorkspaceId === workspaceId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetWorkspaceId(workspaceId);
  }

  function handleWorkspaceDrop(event: DragEvent<HTMLDivElement>, targetWorkspaceId: string) {
    event.preventDefault();
    if (!draggedWorkspaceId || draggedWorkspaceId === targetWorkspaceId) {
      return;
    }

    setWorkspaceState((current) => ({
      ...current,
      workspaces: reorderWorkspaces(current.workspaces, draggedWorkspaceId, targetWorkspaceId),
    }));
    setDraggedWorkspaceId("");
    setDropTargetWorkspaceId("");
  }

  return (
    <div
      id="appShell"
      className={`app-shell${isCollapsed ? " sidebar-collapsed" : ""}`}
      onClick={() => setContextMenu(null)}
    >
      <aside id="leftPanel" className="left-panel" aria-label="Workspace navigation">
        <div className="window-strip">
          <button
            id="sidebarToggle"
            className="window-icon-button"
            type="button"
            aria-label="Toggle sidebar (Command+B)"
            aria-pressed={isCollapsed}
            title="Toggle sidebar (Command+B)"
            onClick={(event) => {
              event.stopPropagation();
              toggleSidebar();
            }}
          >
            <Icon name="layout" />
          </button>
          <button className="window-icon-button" type="button" aria-label="Back" title="Back">
            <Icon name="arrow-left" />
          </button>
          <button className="window-icon-button" type="button" aria-label="Forward" title="Forward">
            <Icon name="arrow-right" />
          </button>
        </div>

        <div className="panel-top">
          <button id="newWorkspaceButton" className="utility-row" type="button" onClick={addWorkspace}>
            <span className="utility-icon" aria-hidden="true">
              <Icon name="folder-plus" />
            </span>
            <span className="utility-label">New Workspace</span>
          </button>

          <label className="utility-row search-field" htmlFor="workspaceSearch">
            <span className="utility-icon" aria-hidden="true">
              <Icon name="search" />
            </span>
            <input
              id="workspaceSearch"
              type="search"
              placeholder="Search"
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>

        <section className="workspace-section" aria-labelledby="workspaceSectionTitle">
          <h2 id="workspaceSectionTitle" className="nav-section-title">
            Workspace
          </h2>
          <div id="workspaceList" className="workspace-list" role="list" aria-label="Workspace">
            {visibleWorkspaces.length > 0 ? (
              visibleWorkspaces.map((workspace) => (
                <WorkspaceRow
                  key={workspace.id}
                  workspace={workspace}
                  isSelected={workspace.id === selectedWorkspaceId}
                  isDragging={workspace.id === draggedWorkspaceId}
                  isDropTarget={workspace.id === dropTargetWorkspaceId}
                  onSelect={selectWorkspace}
                  onMenuOpen={openContextMenu}
                  onDragStart={handleWorkspaceDragStart}
                  onDragOver={handleWorkspaceDragOver}
                  onDrop={handleWorkspaceDrop}
                  onDragLeave={() => setDropTargetWorkspaceId("")}
                  onDragEnd={() => {
                    setDraggedWorkspaceId("");
                    setDropTargetWorkspaceId("");
                  }}
                />
              ))
            ) : (
              <div className="empty-results">No workspace</div>
            )}
          </div>
        </section>

        <div className="panel-footer">
          <button id="settingsButton" className="settings-button" type="button">
            <span className="utility-icon settings-icon" aria-hidden="true">
              <Icon name="settings" />
            </span>
            <span className="settings-label">Settings</span>
          </button>
        </div>
      </aside>

      <main className="main-surface" aria-label="Workspace surface">
        <div className="workspace-preview" aria-live="polite">
          <span className="workspace-preview-label">Current workspace</span>
          <h1 id="activeWorkspaceName">{activeWorkspace?.name || "project_folder"}</h1>
        </div>
      </main>

      {contextMenu ? (
        <div
          id="workspaceContextMenu"
          className="context-menu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" data-action="rename" onClick={() => renameWorkspace(contextMenu.workspaceId)}>
            <span className="menu-icon" aria-hidden="true">
              <Icon name="rename" />
            </span>
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            data-action="delete"
            className="danger-item"
            disabled={workspaces.length <= 1}
            onClick={() => deleteWorkspace(contextMenu.workspaceId)}
          >
            <span className="menu-icon" aria-hidden="true">
              <Icon name="trash" />
            </span>
            Delete workspace
          </button>
        </div>
      ) : null}
    </div>
  );
}

type WorkspaceRowProps = {
  workspace: Workspace;
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onSelect: (workspaceId: string) => void;
  onMenuOpen: (event: MouseEvent<HTMLElement>, workspaceId: string) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, workspaceId: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, workspaceId: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, workspaceId: string) => void;
  onDragLeave: () => void;
  onDragEnd: () => void;
};

function WorkspaceRow({
  workspace,
  isSelected,
  isDragging,
  isDropTarget,
  onSelect,
  onMenuOpen,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
  onDragEnd,
}: WorkspaceRowProps) {
  const className = [
    "workspace-row",
    isSelected ? "is-selected" : "",
    isDragging ? "is-dragging" : "",
    isDropTarget ? "is-drop-target" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      draggable
      data-workspace-id={workspace.id}
      role="listitem"
      onContextMenu={(event) => onMenuOpen(event, workspace.id)}
      onDragStart={(event) => onDragStart(event, workspace.id)}
      onDragOver={(event) => onDragOver(event, workspace.id)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, workspace.id)}
      onDragEnd={onDragEnd}
    >
      <button className="workspace-select-button" type="button" onClick={() => onSelect(workspace.id)}>
        <span className="project-icon" aria-hidden="true">
          <Icon name="folder" />
        </span>
        <span className="workspace-name">{workspace.name}</span>
      </button>
      <button
        className="workspace-menu-button"
        type="button"
        aria-label={`Open menu for ${workspace.name}`}
        onClick={(event) => onMenuOpen(event, workspace.id)}
      >
        <Icon name="dots" />
      </button>
    </div>
  );
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {iconPaths[name]}
    </svg>
  );
}

function loadInitialWorkspaceState(): WorkspaceState {
  const workspaces = loadWorkspaces();
  return {
    workspaces,
    selectedWorkspaceId: loadSelectedWorkspaceId(workspaces),
    workspaceCounter: getNextWorkspaceCounter(workspaces),
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

function loadInitialCollapsedState() {
  return localStorage.getItem(collapsedStorageKey) === "true";
}

function getNextWorkspaceCounter(workspaces: Workspace[]) {
  const highestNumber = workspaces.reduce((highest, workspace) => {
    const match = workspace.name.match(/^workspace-(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 1);

  return highestNumber + 1;
}

function reorderWorkspaces(workspaces: Workspace[], sourceId: string, targetId: string) {
  const sourceIndex = workspaces.findIndex((workspace) => workspace.id === sourceId);
  const targetIndex = workspaces.findIndex((workspace) => workspace.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return workspaces;
  }

  const reordered = [...workspaces];
  const [source] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, source);
  return reordered;
}

export default App;
