import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from "react";

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

type WorkspaceDragState = {
  workspaceId: string;
  pointerId: number;
  startY: number;
  currentY: number;
  listTop: number;
  listBottom: number;
  rowLeft: number;
  rowWidth: number;
  rowHeight: number;
  active: boolean;
};

type WorkspaceDropPlacement = "before" | "after";

type WorkspaceDropIntent = {
  workspaceId: string;
  placement: WorkspaceDropPlacement;
};

type IconName =
  | "arrow-left"
  | "arrow-right"
  | "dots"
  | "folder"
  | "panel-left"
  | "rename"
  | "search"
  | "settings"
  | "square-pen"
  | "trash";

const workspaceStorageKey = "workspace.leftPanel.workspaces";
const selectedWorkspaceStorageKey = "workspace.leftPanel.selectedWorkspaceId";
const collapsedStorageKey = "workspace.leftPanel.sidebarCollapsed";
const contextMenuWidth = 224;
const contextMenuHeight = 104;
const screenPadding = 14;
const dragStartThreshold = 4;

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
      <circle cx="5" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  folder: (
    <path d="M3.25 6.75A2.25 2.25 0 0 1 5.5 4.5h4.04c.64 0 1.25.28 1.68.76l1.06 1.23c.43.49 1.04.76 1.68.76h4.54a2.25 2.25 0 0 1 2.25 2.25v7.25A2.25 2.25 0 0 1 18.5 19H5.5a2.25 2.25 0 0 1-2.25-2.25z" />
  ),
  "panel-left": (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9.5 4v16" />
    </>
  ),
  rename: (
    <>
      <path d="M12 20h8" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7.25 18.75 3.5 20.5l1.75-3.75z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.2 16.2 3.8 3.8" />
    </>
  ),
  settings: (
    <>
      <path d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
      <path d="M19.25 13.5c.08-.49.08-1.01 0-1.5l1.57-1.22-1.5-2.6-1.85.74a7.43 7.43 0 0 0-1.3-.75L15.9 6.2h-3l-.27 1.97c-.45.2-.88.45-1.29.75l-1.86-.74-1.5 2.6L9.55 12a7.9 7.9 0 0 0 0 1.5l-1.57 1.22 1.5 2.6 1.86-.74c.4.3.84.55 1.29.75l.27 1.97h3l.27-1.97c.46-.2.9-.45 1.3-.75l1.85.74 1.5-2.6z" />
    </>
  ),
  "square-pen": (
    <>
      <path d="M12 4H5.75A1.75 1.75 0 0 0 4 5.75v12.5C4 19.22 4.78 20 5.75 20h12.5c.97 0 1.75-.78 1.75-1.75V12" />
      <path d="M18.25 3.75a2.12 2.12 0 0 1 3 3L12 16l-4 1 1-4z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.5h16" />
      <path d="M9 6.5v-1A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v1" />
      <path d="m18.5 6.5-.8 12.1A2 2 0 0 1 15.7 20h-7.4a2 2 0 0 1-2-1.4L5.5 6.5" />
      <path d="M10 10.5v5.5" />
      <path d="M14 10.5v5.5" />
    </>
  ),
};

function App() {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(loadInitialWorkspaceState);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(loadInitialCollapsedState);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dragState, setDragState] = useState<WorkspaceDragState | null>(null);
  const dragStateRef = useRef<WorkspaceDragState | null>(null);
  const leftPanelRef = useRef<HTMLElement | null>(null);
  const workspaceListRef = useRef<HTMLDivElement | null>(null);
  const suppressNextWorkspaceSelectRef = useRef(false);

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
  const dragOverlay =
    dragState?.active && workspaces.find((workspace) => workspace.id === dragState.workspaceId)
      ? {
          state: dragState,
          workspace: workspaces.find((workspace) => workspace.id === dragState.workspaceId),
        }
      : null;
  const dragOverlayStyle = dragOverlay?.workspace
    ? ({
        "--drag-left": `${dragOverlay.state.rowLeft}px`,
        "--drag-top": `${clamp(
          dragOverlay.state.currentY - dragOverlay.state.rowHeight / 2,
          dragOverlay.state.listTop,
          dragOverlay.state.listBottom - dragOverlay.state.rowHeight,
        )}px`,
        "--drag-width": `${dragOverlay.state.rowWidth}px`,
      } as CSSProperties)
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
        clearWorkspaceDrag();
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
    if (suppressNextWorkspaceSelectRef.current) {
      suppressNextWorkspaceSelectRef.current = false;
      return;
    }

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
    clearWorkspaceDrag();
    setWorkspaceState((current) => ({
      ...current,
      selectedWorkspaceId: workspaceId,
    }));
    const panelRect = leftPanelRef.current?.getBoundingClientRect();
    const minX = panelRect ? panelRect.left + screenPadding : screenPadding;
    const maxX = panelRect
      ? panelRect.right - contextMenuWidth - screenPadding
      : window.innerWidth - contextMenuWidth - screenPadding;
    setContextMenu({
      workspaceId,
      x: clamp(event.clientX, minX, maxX),
      y: clamp(event.clientY, screenPadding, window.innerHeight - contextMenuHeight - screenPadding),
    });
  }

  function renameWorkspace(workspaceId: string) {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return;
    }

    setContextMenu(null);
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

    setContextMenu(null);
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

  function setNextDragState(nextState: WorkspaceDragState | null) {
    dragStateRef.current = nextState;
    setDragState(nextState);
  }

  function clearWorkspaceDrag() {
    setNextDragState(null);
  }

  function handleWorkspacePointerDown(event: PointerEvent<HTMLDivElement>, workspaceId: string) {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".workspace-menu-button")) {
      return;
    }

    const listRect = workspaceListRef.current?.getBoundingClientRect();
    if (!listRect) {
      return;
    }

    const rowRect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    setNextDragState({
      workspaceId,
      pointerId: event.pointerId,
      startY: event.clientY,
      currentY: clamp(event.clientY, listRect.top + rowRect.height / 2, listRect.bottom - rowRect.height / 2),
      listTop: listRect.top,
      listBottom: listRect.bottom,
      rowLeft: rowRect.left,
      rowWidth: rowRect.width,
      rowHeight: rowRect.height,
      active: false,
    });
  }

  function handleWorkspacePointerMove(event: PointerEvent<HTMLDivElement>) {
    const currentDragState = dragStateRef.current;
    if (!currentDragState || currentDragState.pointerId !== event.pointerId) {
      return;
    }

    const currentY = clamp(
      event.clientY,
      currentDragState.listTop + currentDragState.rowHeight / 2,
      currentDragState.listBottom - currentDragState.rowHeight / 2,
    );
    const isActive = currentDragState.active || Math.abs(event.clientY - currentDragState.startY) > dragStartThreshold;
    const nextDragState = { ...currentDragState, currentY, active: isActive };
    setNextDragState(nextDragState);

    if (!isActive) {
      return;
    }

    event.preventDefault();
    suppressNextWorkspaceSelectRef.current = true;
    setContextMenu(null);

    const dropIntent = getWorkspaceDropIntentAtPoint(currentDragState.rowLeft + currentDragState.rowWidth / 2, currentY);
    if (!dropIntent || dropIntent.workspaceId === currentDragState.workspaceId) {
      return;
    }

    setWorkspaceState((current) => ({
      ...current,
      workspaces: reorderWorkspaces(
        current.workspaces,
        currentDragState.workspaceId,
        dropIntent.workspaceId,
        dropIntent.placement,
      ),
    }));
  }

  function handleWorkspacePointerEnd(event: PointerEvent<HTMLDivElement>) {
    const currentDragState = dragStateRef.current;
    if (!currentDragState || currentDragState.pointerId !== event.pointerId) {
      return;
    }

    if (currentDragState.active) {
      event.preventDefault();
      suppressNextWorkspaceSelectRef.current = true;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clearWorkspaceDrag();
  }

  return (
    <div
      id="appShell"
      className={`app-shell${isCollapsed ? " sidebar-collapsed" : ""}`}
      onClick={() => setContextMenu(null)}
    >
      <div className="window-strip">
        <button
          id="sidebarToggle"
          className="window-icon-button"
          type="button"
          aria-label="Toggle sidebar (Command+B)"
          aria-pressed={isCollapsed}
          onClick={(event) => {
            event.stopPropagation();
            toggleSidebar();
          }}
        >
          <Icon name="panel-left" />
        </button>
        <button className="window-icon-button" type="button" aria-label="Back">
          <Icon name="arrow-left" />
        </button>
        <button className="window-icon-button" type="button" aria-label="Forward">
          <Icon name="arrow-right" />
        </button>
      </div>

      <aside id="leftPanel" ref={leftPanelRef} className="left-panel" aria-label="Workspace navigation">
        <div className="panel-top">
          <button id="newWorkspaceButton" className="utility-row" type="button" onClick={addWorkspace}>
            <span className="utility-icon" aria-hidden="true">
              <Icon name="square-pen" />
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
              placeholder={isSearchFocused ? "" : "Search"}
              autoComplete="off"
              value={searchTerm}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>

        <section className="workspace-section" aria-labelledby="workspaceSectionTitle">
          <h2 id="workspaceSectionTitle" className="nav-section-title">
            Workspace
          </h2>
          <div id="workspaceList" ref={workspaceListRef} className="workspace-list" role="list" aria-label="Workspace">
            {visibleWorkspaces.length > 0 ? (
              visibleWorkspaces.map((workspace) => (
                <WorkspaceRow
                  key={workspace.id}
                  workspace={workspace}
                  isSelected={workspace.id === selectedWorkspaceId}
                  isDragging={dragState?.workspaceId === workspace.id && dragState.active}
                  onSelect={selectWorkspace}
                  onMenuOpen={openContextMenu}
                  onPointerDown={handleWorkspacePointerDown}
                  onPointerMove={handleWorkspacePointerMove}
                  onPointerEnd={handleWorkspacePointerEnd}
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

      {dragOverlay?.workspace && dragOverlayStyle ? (
        <div className="workspace-drag-overlay" style={dragOverlayStyle} aria-hidden="true">
          <span className="project-icon">
            <Icon name="folder" />
          </span>
          <span className="workspace-name">{dragOverlay.workspace.name}</span>
          <span className="workspace-menu-button is-visible">
            <Icon name="dots" />
          </span>
        </div>
      ) : null}

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
  onSelect: (workspaceId: string) => void;
  onMenuOpen: (event: MouseEvent<HTMLElement>, workspaceId: string) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>, workspaceId: string) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerEnd: (event: PointerEvent<HTMLDivElement>) => void;
};

function WorkspaceRow({
  workspace,
  isSelected,
  isDragging,
  onSelect,
  onMenuOpen,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
}: WorkspaceRowProps) {
  const className = ["workspace-row", isSelected ? "is-selected" : "", isDragging ? "is-dragging" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      data-workspace-id={workspace.id}
      role="listitem"
      onContextMenu={(event) => onMenuOpen(event, workspace.id)}
      onPointerDown={(event) => onPointerDown(event, workspace.id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
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
    <svg className={`icon icon-${name}`} aria-hidden="true" viewBox="0 0 24 24" strokeWidth={1.7}>
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

function reorderWorkspaces(
  workspaces: Workspace[],
  sourceId: string,
  targetId: string,
  placement: WorkspaceDropPlacement = "before",
) {
  const sourceIndex = workspaces.findIndex((workspace) => workspace.id === sourceId);
  const targetIndex = workspaces.findIndex((workspace) => workspace.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return workspaces;
  }

  const reordered = [...workspaces];
  const [source] = reordered.splice(sourceIndex, 1);
  const nextTargetIndex = reordered.findIndex((workspace) => workspace.id === targetId);
  const insertionIndex = placement === "after" ? nextTargetIndex + 1 : nextTargetIndex;
  reordered.splice(insertionIndex, 0, source);
  return reordered;
}

function getWorkspaceDropIntentAtPoint(x: number, y: number): WorkspaceDropIntent | null {
  const target = document.elementFromPoint(x, y);
  const row = target?.closest("[data-workspace-id]") as HTMLElement | null;
  if (!row?.dataset.workspaceId) {
    return null;
  }

  const rowRect = row.getBoundingClientRect();
  return {
    workspaceId: row.dataset.workspaceId,
    placement: y > rowRect.top + rowRect.height / 2 ? "after" : "before",
  };
}

function clamp(value: number, min: number, max: number) {
  const upperBound = Math.max(min, max);
  return Math.min(Math.max(value, min), upperBound);
}

export default App;
