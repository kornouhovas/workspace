const workspaceStorageKey = "workspace.leftPanel.workspaces";
const selectedWorkspaceStorageKey = "workspace.leftPanel.selectedWorkspaceId";
const collapsedStorageKey = "workspace.leftPanel.sidebarCollapsed";

const defaultWorkspaces = [
  {
    id: "workspace-1",
    name: "Workspace",
    pinned: true,
  },
];

const appShell = document.getElementById("appShell");
const sidebarToggle = document.getElementById("sidebarToggle");
const newWorkspaceButton = document.getElementById("newWorkspaceButton");
const workspaceSearch = document.getElementById("workspaceSearch");
const workspaceList = document.getElementById("workspaceList");
const settingsButton = document.getElementById("settingsButton");
const contextMenu = document.getElementById("workspaceContextMenu");
const activeWorkspaceName = document.getElementById("activeWorkspaceName");

let workspaces = loadWorkspaces();
let selectedWorkspaceId = loadSelectedWorkspaceId(workspaces);
let contextWorkspaceId = "";
let draggedWorkspaceId = "";
let workspaceCounter = getNextWorkspaceCounter(workspaces);

applyStoredSidebarState();
renderWorkspaces();

sidebarToggle.addEventListener("click", () => toggleSidebar());
newWorkspaceButton.addEventListener("click", addWorkspace);
workspaceSearch.addEventListener("input", renderWorkspaces);
settingsButton.addEventListener("click", () => {
  settingsButton.blur();
});
contextMenu.addEventListener("click", handleContextMenuAction);
document.addEventListener("click", closeContextMenu);
document.addEventListener("keydown", handleKeyboardShortcut);

function loadWorkspaces() {
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

function loadSelectedWorkspaceId(items) {
  const storedId = localStorage.getItem(selectedWorkspaceStorageKey);
  if (items.some((workspace) => workspace.id === storedId)) {
    return storedId;
  }

  return items[0]?.id || defaultWorkspaces[0].id;
}

function getNextWorkspaceCounter(items) {
  const highestNumber = items.reduce((highest, workspace) => {
    const match = workspace.name.match(/^Workspace\s+(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 1);

  return highestNumber + 1;
}

function persistWorkspaces() {
  localStorage.setItem(workspaceStorageKey, JSON.stringify(workspaces));
  localStorage.setItem(selectedWorkspaceStorageKey, selectedWorkspaceId);
}

function applyStoredSidebarState() {
  const collapsed = localStorage.getItem(collapsedStorageKey) === "true";
  appShell.classList.toggle("sidebar-collapsed", collapsed);
  sidebarToggle.setAttribute("aria-pressed", String(collapsed));
}

function addWorkspace() {
  const workspace = {
    id: `workspace-${Date.now()}`,
    name: `Workspace ${workspaceCounter}`,
    pinned: false,
  };

  workspaceCounter += 1;
  workspaces.push(workspace);
  selectedWorkspaceId = workspace.id;
  workspaceSearch.value = "";
  persistWorkspaces();
  renderWorkspaces();
}

function renderWorkspaces() {
  const searchValue = workspaceSearch.value.trim().toLowerCase();
  const visibleWorkspaces = workspaces.filter((workspace) => workspace.name.toLowerCase().includes(searchValue));
  workspaceList.replaceChildren();

  if (visibleWorkspaces.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-results";
    empty.textContent = "No workspaces";
    workspaceList.append(empty);
    return;
  }

  visibleWorkspaces.forEach((workspace) => {
    workspaceList.append(createWorkspaceRow(workspace));
  });

  updateActiveWorkspaceLabel();
}

function createWorkspaceRow(workspace) {
  const row = document.createElement("button");
  row.className = "workspace-row";
  row.type = "button";
  row.draggable = true;
  row.dataset.workspaceId = workspace.id;
  row.setAttribute("role", "listitem");
  row.setAttribute("aria-label", workspace.name);

  if (workspace.id === selectedWorkspaceId) {
    row.classList.add("is-selected");
  }
  if (workspace.pinned) {
    row.classList.add("is-pinned");
  }

  const pinIcon = document.createElement("span");
  pinIcon.className = "action-icon pin-icon";
  pinIcon.innerHTML = iconSvg("pin");

  const name = document.createElement("span");
  name.className = "workspace-name";
  name.textContent = workspace.name;

  const dragHandle = document.createElement("span");
  dragHandle.className = "drag-handle";
  dragHandle.setAttribute("aria-hidden", "true");
  dragHandle.innerHTML = iconSvg("drag");

  row.append(pinIcon, name, dragHandle);
  row.addEventListener("click", () => selectWorkspace(workspace.id));
  row.addEventListener("contextmenu", (event) => openContextMenu(event, workspace.id));
  row.addEventListener("dragstart", handleWorkspaceDragStart);
  row.addEventListener("dragover", handleWorkspaceDragOver);
  row.addEventListener("dragleave", handleWorkspaceDragLeave);
  row.addEventListener("drop", handleWorkspaceDrop);
  row.addEventListener("dragend", handleWorkspaceDragEnd);

  return row;
}

function selectWorkspace(workspaceId) {
  selectedWorkspaceId = workspaceId;
  persistWorkspaces();
  renderWorkspaces();
}

function updateActiveWorkspaceLabel() {
  const activeWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) || workspaces[0];
  activeWorkspaceName.textContent = activeWorkspace?.name || "Workspace";
}

function toggleSidebar(forceCollapsed) {
  const shouldCollapse =
    typeof forceCollapsed === "boolean" ? forceCollapsed : !appShell.classList.contains("sidebar-collapsed");

  appShell.classList.toggle("sidebar-collapsed", shouldCollapse);
  sidebarToggle.setAttribute("aria-pressed", String(shouldCollapse));
  localStorage.setItem(collapsedStorageKey, String(shouldCollapse));
}

function openContextMenu(event, workspaceId) {
  event.preventDefault();
  event.stopPropagation();
  if (selectedWorkspaceId !== workspaceId) {
    selectedWorkspaceId = workspaceId;
    persistWorkspaces();
    renderWorkspaces();
  }
  contextWorkspaceId = workspaceId;

  const pinItem = contextMenu.querySelector('[data-action="pin"]');
  const deleteItem = contextMenu.querySelector('[data-action="delete"]');
  const workspace = workspaces.find((item) => item.id === workspaceId);

  pinItem.lastChild.textContent = workspace?.pinned ? "Unpin workspace" : "Pin workspace";
  deleteItem.disabled = workspaces.length <= 1;

  contextMenu.hidden = false;
  const menuRect = contextMenu.getBoundingClientRect();
  const x = Math.min(event.clientX, window.innerWidth - menuRect.width - 8);
  const y = Math.min(event.clientY, window.innerHeight - menuRect.height - 8);
  contextMenu.style.left = `${Math.max(8, x)}px`;
  contextMenu.style.top = `${Math.max(8, y)}px`;
}

function closeContextMenu() {
  contextMenu.hidden = true;
  contextWorkspaceId = "";
}

function handleContextMenuAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled || !contextWorkspaceId) {
    return;
  }

  event.stopPropagation();
  const action = button.dataset.action;
  if (action === "rename") {
    renameWorkspace(contextWorkspaceId);
  }
  if (action === "pin") {
    pinWorkspace(contextWorkspaceId);
  }
  if (action === "delete") {
    deleteWorkspace(contextWorkspaceId);
  }
  closeContextMenu();
}

function renameWorkspace(workspaceId) {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace) {
    return;
  }

  const nextName = window.prompt("Rename workspace", workspace.name);
  const trimmedName = nextName?.trim();
  if (!trimmedName) {
    return;
  }

  workspace.name = trimmedName;
  persistWorkspaces();
  renderWorkspaces();
}

function pinWorkspace(workspaceId) {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace) {
    return;
  }

  workspace.pinned = !workspace.pinned;
  persistWorkspaces();
  renderWorkspaces();
}

function deleteWorkspace(workspaceId) {
  if (workspaces.length <= 1) {
    return;
  }

  const workspace = workspaces.find((item) => item.id === workspaceId);
  const confirmed = window.confirm(`Delete ${workspace?.name || "workspace"}?`);
  if (!confirmed) {
    return;
  }

  workspaces = workspaces.filter((item) => item.id !== workspaceId);
  if (selectedWorkspaceId === workspaceId) {
    selectedWorkspaceId = workspaces[0].id;
  }

  persistWorkspaces();
  renderWorkspaces();
}

function handleWorkspaceDragStart(event) {
  const row = event.currentTarget;
  draggedWorkspaceId = row.dataset.workspaceId;
  row.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedWorkspaceId);
}

function handleWorkspaceDragOver(event) {
  const targetWorkspaceId = event.currentTarget.dataset.workspaceId;
  if (!draggedWorkspaceId || draggedWorkspaceId === targetWorkspaceId) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  event.currentTarget.classList.add("is-drop-target");
}

function handleWorkspaceDragLeave(event) {
  event.currentTarget.classList.remove("is-drop-target");
}

function handleWorkspaceDrop(event) {
  event.preventDefault();
  const targetWorkspaceId = event.currentTarget.dataset.workspaceId;
  event.currentTarget.classList.remove("is-drop-target");
  if (!draggedWorkspaceId || draggedWorkspaceId === targetWorkspaceId) {
    return;
  }

  reorderWorkspaces(draggedWorkspaceId, targetWorkspaceId);
  persistWorkspaces();
  renderWorkspaces();
}

function handleWorkspaceDragEnd() {
  draggedWorkspaceId = "";
  workspaceList.querySelectorAll(".workspace-row").forEach((row) => {
    row.classList.remove("is-dragging", "is-drop-target");
  });
}

function reorderWorkspaces(sourceId, targetId) {
  const sourceIndex = workspaces.findIndex((workspace) => workspace.id === sourceId);
  const targetIndex = workspaces.findIndex((workspace) => workspace.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }

  const [source] = workspaces.splice(sourceIndex, 1);
  workspaces.splice(targetIndex, 0, source);
}

function handleKeyboardShortcut(event) {
  const isSidebarShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b";
  if (isSidebarShortcut) {
    event.preventDefault();
    toggleSidebar();
  }

  if (event.key === "Escape") {
    closeContextMenu();
  }
}

function iconSvg(name) {
  const icons = {
    pin: '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="m6.5 3.5 6 6" /><path d="m13 4 3 3-5 5v3l-1 1-3.5-3.5L3 9l1-1h3z" /></svg>',
    drag: '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="M8 6h.01" /><path d="M12 6h.01" /><path d="M8 10h.01" /><path d="M12 10h.01" /><path d="M8 14h.01" /><path d="M12 14h.01" /></svg>',
  };

  return icons[name] || "";
}
