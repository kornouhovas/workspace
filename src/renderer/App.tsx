import { useEffect, useMemo, useState } from "react";
import type { DragEvent, MouseEvent, ReactNode } from "react";

type Workspace = {
  id: string;
  name: string;
  pinned: boolean;
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

type IconName = "drag" | "layout" | "pin" | "plus" | "rename" | "search" | "settings" | "trash";

const workspaceStorageKey = "workspace.leftPanel.workspaces";
const selectedWorkspaceStorageKey = "workspace.leftPanel.selectedWorkspaceId";
const collapsedStorageKey = "workspace.leftPanel.sidebarCollapsed";

const defaultWorkspaces: Workspace[] = [
  {
    id: "workspace-1",
    name: "Workspace",
    pinned: true,
  },
];

const iconPaths: Record<IconName, ReactNode> = {
  drag: (
    <>
      <path d="M8 6h.01" />
      <path d="M12 6h.01" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
    </>
  ),
  layout: (
    <>
      <path d="M3.5 4.5h13v11h-13z" />
      <path d="M8 4.5v11" />
      <path d="M12.5 8 10.5 10l2 2" />
    </>
  ),
  pin: (
    <>
      <path d="m6.5 3.5 6 6" />
      <path d="m13 4 3 3-5 5v3l-1 1-3.5-3.5L3 9l1-1h3z" />
    </>
  ),
  plus: (
    <>
      <path d="M10 4.5v11" />
      <path d="M4.5 10h11" />
    </>
  ),
  rename: (
    <>
      <path d="M4.5 15.5h3l8-8a2.12 2.12 0 0 0-3-3l-8 8z" />
      <path d="m11.5 5.5 3 3" />
    </>
  ),
  search: (
    <>
      <circle cx="9" cy="9" r="4.5" />
      <path d="m12.5 12.5 3 3" />
    </>
  ),
  settings: (
    <>
      <path d="M8.7 3.5h2.6l.45 2.1c.45.16.86.4 1.23.72l2-.68 1.3 2.25-1.56 1.42c.04.23.07.46.07.69s-.03.46-.07.69l1.56 1.42-1.3 2.25-2-.68c-.37.32-.78.56-1.23.72l-.45 2.1H8.7l-.45-2.1a5.1 5.1 0 0 1-1.23-.72l-2 .68-1.3-2.25 1.56-1.42A4 4 0 0 1 5.21 10c0-.23.03-.46.07-.69L3.72 7.89l1.3-2.25 2 .68c.37-.32.78-.56 1.23-.72z" />
      <circle cx="10" cy="10" r="2.1" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6h11" />
      <path d="M8 6V4.5h4V6" />
      <path d="M6 6.5 6.7 16h6.6l.7-9.5" />
      <path d="M8.5 9v4.5" />
      <path d="M11.5 9v4.5" />
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
  const contextWorkspace = contextMenu
    ? workspaces.find((workspace) => workspace.id === contextMenu.workspaceId)
    : undefined;

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
      name: `Workspace ${workspaceCounter}`,
      pinned: false,
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

  function openContextMenu(event: MouseEvent<HTMLButtonElement>, workspaceId: string) {
    event.preventDefault();
    event.stopPropagation();
    selectWorkspace(workspaceId);
    setContextMenu({
      workspaceId,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 158)),
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

  function pinWorkspace(workspaceId: string) {
    setWorkspaceState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId ? { ...workspace, pinned: !workspace.pinned } : workspace,
      ),
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

  function handleWorkspaceDragStart(event: DragEvent<HTMLButtonElement>, workspaceId: string) {
    setDraggedWorkspaceId(workspaceId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", workspaceId);
  }

  function handleWorkspaceDragOver(event: DragEvent<HTMLButtonElement>, workspaceId: string) {
    if (!draggedWorkspaceId || draggedWorkspaceId === workspaceId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetWorkspaceId(workspaceId);
  }

  function handleWorkspaceDrop(event: DragEvent<HTMLButtonElement>, targetWorkspaceId: string) {
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
        <div className="panel-top">
          <button
            id="sidebarToggle"
            className="icon-button sidebar-toggle"
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

          <button id="newWorkspaceButton" className="panel-action" type="button" onClick={addWorkspace}>
            <span className="action-icon" aria-hidden="true">
              <Icon name="plus" />
            </span>
            <span className="panel-action-label">New workspace</span>
          </button>

          <label className="search-field" htmlFor="workspaceSearch">
            <Icon name="search" />
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
          <h2 id="workspaceSectionTitle" className="workspace-section-title">
            Workspace
          </h2>
          <div id="workspaceList" className="workspace-list" role="list" aria-label="Workspaces">
            {visibleWorkspaces.length > 0 ? (
              visibleWorkspaces.map((workspace) => (
                <WorkspaceRow
                  key={workspace.id}
                  workspace={workspace}
                  isSelected={workspace.id === selectedWorkspaceId}
                  isDragging={workspace.id === draggedWorkspaceId}
                  isDropTarget={workspace.id === dropTargetWorkspaceId}
                  onSelect={selectWorkspace}
                  onContextMenu={openContextMenu}
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
              <div className="empty-results">No workspaces</div>
            )}
          </div>
        </section>

        <button id="settingsButton" className="settings-button" type="button">
          <span className="action-icon" aria-hidden="true">
            <Icon name="settings" />
          </span>
          <span className="settings-label">Settings</span>
        </button>
      </aside>

      <main className="main-surface" aria-label="Workspace surface">
        <div className="workspace-preview" aria-live="polite">
          <span className="workspace-preview-label">Current workspace</span>
          <h1 id="activeWorkspaceName">{activeWorkspace?.name || "Workspace"}</h1>
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
          <button type="button" role="menuitem" data-action="pin" onClick={() => pinWorkspace(contextMenu.workspaceId)}>
            <span className="menu-icon" aria-hidden="true">
              <Icon name="pin" />
            </span>
            {contextWorkspace?.pinned ? "Unpin workspace" : "Pin workspace"}
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
  onContextMenu: (event: MouseEvent<HTMLButtonElement>, workspaceId: string) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, workspaceId: string) => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>, workspaceId: string) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>, workspaceId: string) => void;
  onDragLeave: () => void;
  onDragEnd: () => void;
};

function WorkspaceRow({
  workspace,
  isSelected,
  isDragging,
  isDropTarget,
  onSelect,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
  onDragEnd,
}: WorkspaceRowProps) {
  const className = [
    "workspace-row",
    isSelected ? "is-selected" : "",
    workspace.pinned ? "is-pinned" : "",
    isDragging ? "is-dragging" : "",
    isDropTarget ? "is-drop-target" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={className}
      type="button"
      draggable
      data-workspace-id={workspace.id}
      role="listitem"
      aria-label={workspace.name}
      onClick={() => onSelect(workspace.id)}
      onContextMenu={(event) => onContextMenu(event, workspace.id)}
      onDragStart={(event) => onDragStart(event, workspace.id)}
      onDragOver={(event) => onDragOver(event, workspace.id)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, workspace.id)}
      onDragEnd={onDragEnd}
    >
      <span className="action-icon pin-icon" aria-hidden="true">
        <Icon name="pin" />
      </span>
      <span className="workspace-name">{workspace.name}</span>
      <span className="drag-handle" aria-hidden="true">
        <Icon name="drag" />
      </span>
    </button>
  );
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
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
          name: workspace.name.trim() || "Workspace",
          pinned: Boolean(workspace.pinned),
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
    const match = workspace.name.match(/^Workspace\s+(\d+)$/);
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
