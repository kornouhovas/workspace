import { filterFolders, listStatusCards } from "./src/folderModel.js";

const dbName = "folder-kanban-mvp";
const storeName = "handles";
const selectedRootKey = "selected-root";
const workspaceStorageKey = "workspaces-state";
const sidebarStorageKey = "sidebar-state";
const boardSnapshotStorageKey = "folder-board-snapshot";

const appShell = document.querySelector("#appShell");
const sidebarToggle = document.querySelector("#sidebarToggle");
const sidebarReturn = document.querySelector("#sidebarReturn");
const addWorkspaceButton = document.querySelector("#addWorkspaceButton");
const workspaceTabs = document.querySelector("#workspaceTabs");
const boardViewSwitcher = document.querySelector("#boardViewSwitcher");
const chooseFolderButton = document.querySelector("#chooseFolderButton");
const restoreButton = document.querySelector("#restoreButton");
const searchInput = document.querySelector("#searchInput");
const boardSurface = document.querySelector(".kanban-board");
const folderGrid = document.querySelector("#folderGrid");
const emptyState = document.querySelector("#emptyState");
const statusLine = document.querySelector("#statusLine");
const pageTitle = document.querySelector(".topbar h1");
const workspaceTitleRow = document.querySelector(".workspace-title-row");
const workspaceTitleButton = document.querySelector("#workspaceTitleButton");
const workspaceTitleEditButton = document.querySelector("#workspaceTitleEditButton");
const workspaceTitleInput = document.querySelector("#workspaceTitleInput");
const sidebarRootName = document.querySelector("#sidebarRootName");
const sidebarFolderCount = document.querySelector("#sidebarFolderCount");

const views = {
  workspace: {
    title: "Workspace folders",
    emptyTitle: "No folder selected",
    emptyDescription: "Pick a root folder from the top action to show folders grouped by status tags.",
  },
  folders: {
    title: "Folders",
    emptyTitle: "No folder selected",
    emptyDescription: "Choose a root folder to populate this folder board.",
  },
  recent: {
    title: "Recent",
    emptyTitle: "No recent folders",
    emptyDescription: "Recent folder activity will appear here after the workspace workflow is validated.",
  },
  settings: {
    title: "Settings",
    emptyTitle: "Settings are not configured",
    emptyDescription: "Workspace settings will be added after the folder board MVP is validated.",
  },
};

const folderViews = new Set(["workspace", "folders"]);
const boardViews = new Set(["overview", "board", "table"]);
const tableColumnIds = ["name", "status"];
const tableColumnLabels = {
  name: "Name",
  status: "Status",
};
const defaultTableColumnWidths = {
  name: 46,
  status: 22,
};
const tableColumnWidthLimits = {
  name: { min: 24, max: 78 },
  status: { min: 12, max: 36 },
};
const maxTableColumnTotalWidth = 94;

let selectedHandle = null;
let folders = [];
let supportsDirectoryPicker = "showDirectoryPicker" in window;
let activeView = "workspace";
let boardView = "overview";
let draggedStatus = null;
let draggedTableColumn = null;
let tableColumnPointerDragState = null;
let tableResizeState = null;
let boardColumnDragImage = null;
let tableColumnDragImage = null;
let workspacePointerDragState = null;
let workspaceDragImage = null;
let workspaceSuppressClick = false;
let workspaceSuppressClickTimer = null;
let workspaceSequence = 1;
let workspaces = [
  {
    id: "workspace-1",
    name: "Workspace",
    boardView: "overview",
    statusOrder: [],
    tableColumnOrder: [...tableColumnIds],
    tableColumnWidths: { ...defaultTableColumnWidths },
  },
];
let activeWorkspaceId = "workspace-1";

async function initializeApp() {
  loadWorkspaceState();
  boardView = loadBoardView();
  setSidebarCollapsed(loadSidebarState(), false);
  renderWorkspaceTabs();
  renderBoardViewSwitcher();
  bindEvents();

  try {
    if (!supportsDirectoryPicker) {
      setStatus("Folder selection requires a Chromium browser with File System Access API.", "error");
      chooseFolderButton.disabled = true;
      updateActionStates();
      renderFolders();
      return;
    }

    const storedHandle = await getStoredHandle();
    if (!storedHandle) {
      renderFolders();
      return;
    }

    selectedHandle = storedHandle;
    updateRoot(storedHandle.name);

    if (await hasPermission(storedHandle, false)) {
      await scanSelectedFolder();
      return;
    }

    restoreButton.hidden = false;
    setStatus("Saved folder found. Restore access to scan it again.", "idle");
    renderFolders();
  } finally {
    finishInitialLayout();
  }
}

function bindEvents() {
  sidebarToggle.addEventListener("click", () => {
    setSidebarCollapsed(true);
  });

  sidebarReturn.addEventListener("click", () => setSidebarCollapsed(false));
  addWorkspaceButton.addEventListener("click", addWorkspace);
  workspaceTitleButton.addEventListener("click", startWorkspaceRename);
  workspaceTitleEditButton.addEventListener("click", startWorkspaceRename);
  workspaceTitleInput.addEventListener("keydown", handleWorkspaceTitleKeydown);
  workspaceTitleInput.addEventListener("blur", commitWorkspaceRename);
  workspaceTabs.addEventListener("pointerdown", handleWorkspacePointerDragStart);
  workspaceTabs.addEventListener("click", (event) => {
    if (workspaceSuppressClick) {
      workspaceSuppressClick = false;
      window.clearTimeout(workspaceSuppressClickTimer);
      workspaceSuppressClickTimer = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const deleteButton = event.target.closest(".workspace-delete");
    if (deleteButton) {
      deleteWorkspace(deleteButton.dataset.workspaceId);
      return;
    }

    const workspaceButton = event.target.closest("[data-workspace-id]");
    if (workspaceButton) {
      setActiveWorkspace(workspaceButton.dataset.workspaceId);
    }
  });

  boardViewSwitcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-board-view]");
    if (button) {
      setBoardView(button.dataset.boardView);
    }
  });
  chooseFolderButton.addEventListener("click", chooseFolder);
  restoreButton.addEventListener("click", restoreAccess);
  searchInput.addEventListener("input", renderFolders);
  folderGrid.addEventListener("dragstart", handleBoardColumnDragStart);
  folderGrid.addEventListener("dragstart", handleTableColumnDragStart);
  folderGrid.addEventListener("dragover", handleBoardColumnDragOver);
  folderGrid.addEventListener("dragover", handleTableColumnDragOver);
  folderGrid.addEventListener("dragleave", handleBoardColumnDragLeave);
  folderGrid.addEventListener("dragleave", handleTableColumnDragLeave);
  folderGrid.addEventListener("drop", handleBoardColumnDrop);
  folderGrid.addEventListener("drop", handleTableColumnDrop);
  folderGrid.addEventListener("dragend", handleBoardColumnDragEnd);
  folderGrid.addEventListener("dragend", handleTableColumnDragEnd);
  folderGrid.addEventListener("pointerdown", handleTableColumnResizeStart);
  folderGrid.addEventListener("pointerdown", handleTableColumnPointerDragStart);
  folderGrid.addEventListener("mousedown", handleTableColumnResizeStart);
  window.addEventListener("pointermove", handleTableColumnResizeMove);
  window.addEventListener("pointermove", handleTableColumnPointerDragMove);
  window.addEventListener("pointermove", handleWorkspacePointerDragMove);
  window.addEventListener("mousemove", handleTableColumnResizeMove);
  window.addEventListener("pointerup", handleTableColumnResizeEnd);
  window.addEventListener("pointerup", handleTableColumnPointerDragEnd);
  window.addEventListener("pointerup", handleWorkspacePointerDragEnd);
  window.addEventListener("mouseup", handleTableColumnResizeEnd);
  window.addEventListener("keydown", handleSidebarShortcut);
}

function setSidebarCollapsed(collapsed, persist = true) {
  appShell.classList.toggle("sidebar-collapsed", collapsed);
  const label = collapsed ? "Показать меню" : "Скрыть меню";
  sidebarToggle.setAttribute("aria-label", label);
  sidebarToggle.title = label;
  if (persist) {
    saveSidebarState(collapsed);
  }
}

function setBoardView(nextBoardView) {
  const normalizedBoardView = normalizeBoardView(nextBoardView);
  if (normalizedBoardView !== nextBoardView) {
    return;
  }

  boardView = normalizedBoardView;
  saveBoardView();
  renderBoardViewSwitcher();
  renderFolders();
}

function renderBoardViewSwitcher() {
  boardViewSwitcher.querySelectorAll("[data-board-view]").forEach((button) => {
    const isActive = button.dataset.boardView === boardView;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function handleSidebarShortcut(event) {
  if (isEditableShortcutTarget(event.target)) {
    return;
  }

  if (event.key.toLowerCase() !== "b" && event.code !== "KeyB") {
    return;
  }

  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
    return;
  }

  event.preventDefault();
  setSidebarCollapsed(!appShell.classList.contains("sidebar-collapsed"));
}

function isEditableShortcutTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable
  );
}

function addWorkspace() {
  const workspace = {
    id: createWorkspaceId(),
    name: `Workspace ${getNextWorkspaceNumber()}`,
    boardView: "overview",
    statusOrder: [],
    tableColumnOrder: [...tableColumnIds],
    tableColumnWidths: { ...defaultTableColumnWidths },
  };

  workspaces.push(workspace);
  activeWorkspaceId = workspace.id;
  boardView = workspace.boardView;
  saveWorkspaceState();
  renderWorkspaceTabs();
  renderBoardViewSwitcher();
  renderFolders();
}

function deleteWorkspace(workspaceId) {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace || isDefaultWorkspace(workspace)) {
    return;
  }

  const removedIndex = workspaces.findIndex((item) => item.id === workspaceId);
  workspaces = workspaces.filter((item) => item.id !== workspaceId);

  if (activeWorkspaceId === workspaceId) {
    activeWorkspaceId = workspaces[Math.max(0, removedIndex - 1)].id;
  }

  boardView = loadBoardView();
  saveWorkspaceState();
  renderWorkspaceTabs();
  renderBoardViewSwitcher();
  renderFolders();
}

function setActiveWorkspace(workspaceId) {
  if (!workspaces.some((workspace) => workspace.id === workspaceId)) {
    return;
  }

  activeWorkspaceId = workspaceId;
  boardView = loadBoardView();
  saveWorkspaceState();
  renderWorkspaceTabs();
  renderBoardViewSwitcher();
  renderFolders();
}

function isDefaultWorkspace(workspace) {
  return workspace.id === "workspace-1";
}

function renderWorkspaceTabs() {
  workspaceTabs.replaceChildren(...workspaces.map(createWorkspaceTab));
}

function handleWorkspacePointerDragStart(event) {
  const sourceTab = event.target.closest(".workspace-tab");
  const workspaceButton = event.target.closest("[data-workspace-id]");
  if (
    !sourceTab ||
    !workspaceButton ||
    event.target.closest(".workspace-delete") ||
    workspacePointerDragState ||
    workspaces.length < 2
  ) {
    return;
  }

  const sourceRect = sourceTab.getBoundingClientRect();
  workspacePointerDragState = {
    workspaceId: workspaceButton.dataset.workspaceId,
    startX: event.clientX,
    startY: event.clientY,
    dragOffsetX: event.clientX - sourceRect.left,
    dragOffsetY: event.clientY - sourceRect.top,
    sourceTab,
    targetTab: sourceTab,
    isDragging: false,
  };
  try {
    sourceTab.setPointerCapture?.(event.pointerId);
  } catch (error) {
    // Synthetic pointer events used in tests do not always create an active pointer.
  }
}

function handleWorkspacePointerDragMove(event) {
  if (!workspacePointerDragState) {
    return;
  }

  const dragDistance = Math.hypot(
    event.clientX - workspacePointerDragState.startX,
    event.clientY - workspacePointerDragState.startY,
  );
  if (!workspacePointerDragState.isDragging && dragDistance < 4) {
    return;
  }

  event.preventDefault();
  const startsDragging = !workspacePointerDragState.isDragging;
  workspacePointerDragState.isDragging = true;
  workspacePointerDragState.sourceTab.classList.add("is-workspace-drag-source");
  if (startsDragging) {
    createWorkspaceDragImage(
      getWorkspaceById(workspacePointerDragState.workspaceId),
      workspacePointerDragState.sourceTab,
      event,
    );
  } else {
    moveWorkspaceDragImage(event);
  }

  const targetTab = document.elementFromPoint(event.clientX, event.clientY)?.closest(".workspace-tab");
  if (!targetTab || !workspaceTabs.contains(targetTab)) {
    return;
  }

  workspacePointerDragState.targetTab = targetTab;
  applyWorkspaceOrderPreview(getWorkspacePreviewOrder(event, targetTab));
}

function handleWorkspacePointerDragEnd(event) {
  if (!workspacePointerDragState) {
    return;
  }

  const { isDragging, targetTab } = workspacePointerDragState;

  if (!isDragging || !targetTab) {
    workspacePointerDragState = null;
    removeWorkspaceDragImage();
    clearWorkspaceDragState();
    return;
  }

  event.preventDefault();
  suppressNextWorkspaceClick();
  const workspaceIds = getWorkspacePreviewOrder(event, targetTab);
  saveWorkspaceOrder(workspaceIds);
  workspacePointerDragState = null;
  clearWorkspaceDragState();
  removeWorkspaceDragImage();
  renderWorkspaceTabs();
}

function suppressNextWorkspaceClick() {
  workspaceSuppressClick = true;
  window.clearTimeout(workspaceSuppressClickTimer);
  workspaceSuppressClickTimer = window.setTimeout(() => {
    workspaceSuppressClick = false;
    workspaceSuppressClickTimer = null;
  }, 0);
}

function getWorkspaceById(workspaceId) {
  return workspaces.find((workspace) => workspace.id === workspaceId);
}

function saveWorkspaceOrder(workspaceIds) {
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const orderedWorkspaces = workspaceIds.map((workspaceId) => workspaceById.get(workspaceId)).filter(Boolean);
  const missingWorkspaces = workspaces.filter((workspace) => !workspaceIds.includes(workspace.id));
  workspaces = [...orderedWorkspaces, ...missingWorkspaces];
  saveWorkspaceState();
}

function getWorkspacePreviewOrder(event, targetTab) {
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const movedWorkspaceId = workspacePointerDragState?.workspaceId;
  const targetWorkspaceId = targetTab.querySelector("[data-workspace-id]")?.dataset.workspaceId;
  if (!movedWorkspaceId || !targetWorkspaceId || movedWorkspaceId === targetWorkspaceId) {
    return workspaceIds;
  }

  const insertAfterTarget = getWorkspaceInsertAfterTarget(event, workspaceIds, targetWorkspaceId, targetTab);

  return moveWorkspaceNearTarget(workspaceIds, movedWorkspaceId, targetWorkspaceId, insertAfterTarget);
}

function getWorkspaceInsertAfterTarget(event, workspaceIds, targetWorkspaceId, targetTab) {
  const draggedIndex = workspaceIds.indexOf(workspacePointerDragState.workspaceId);
  const targetIndex = workspaceIds.indexOf(targetWorkspaceId);
  const targetRect = targetTab.getBoundingClientRect();
  if (draggedIndex < 0 || targetIndex < 0) {
    return false;
  }

  if (draggedIndex < targetIndex) {
    return event.clientY > targetRect.top + targetRect.height * 0.25;
  }

  return event.clientY > targetRect.bottom - targetRect.height * 0.25;
}

function moveWorkspaceNearTarget(workspaceIds, movedWorkspaceId, targetWorkspaceId, insertAfterTarget) {
  const withoutMoved = workspaceIds.filter((workspaceId) => workspaceId !== movedWorkspaceId);
  const targetIndex = withoutMoved.indexOf(targetWorkspaceId);
  if (targetIndex < 0) {
    return workspaceIds;
  }

  const insertIndex = targetIndex + (insertAfterTarget ? 1 : 0);
  return [...withoutMoved.slice(0, insertIndex), movedWorkspaceId, ...withoutMoved.slice(insertIndex)];
}

function applyWorkspaceOrderPreview(previewWorkspaceIds) {
  const tabs = [...workspaceTabs.querySelectorAll(".workspace-tab")];
  const rowGap = Number.parseFloat(getComputedStyle(workspaceTabs).rowGap) || 0;
  tabs.forEach((tab, currentIndex) => {
    const workspaceId = tab.querySelector("[data-workspace-id]")?.dataset.workspaceId;
    const previewIndex = previewWorkspaceIds.indexOf(workspaceId);
    const shiftDistance = `${tab.getBoundingClientRect().height + rowGap}px`;
    tab.classList.remove("is-workspace-preview-up", "is-workspace-preview-down");
    tab.style.setProperty("--workspace-tab-shift", shiftDistance);

    if (workspaceId === workspacePointerDragState?.workspaceId) {
      tab.classList.add("is-workspace-drag-source");
      return;
    }

    if (previewIndex < 0) {
      return;
    }

    if (previewIndex < currentIndex) {
      tab.classList.add("is-workspace-preview-up");
    } else if (previewIndex > currentIndex) {
      tab.classList.add("is-workspace-preview-down");
    }
  });
}

function clearWorkspaceDragState() {
  workspaceTabs.querySelectorAll(".workspace-tab").forEach((tab) => {
    tab.classList.remove("is-workspace-drag-source", "is-workspace-preview-up", "is-workspace-preview-down");
    tab.style.removeProperty("--workspace-tab-shift");
  });
}

function createWorkspaceDragImage(workspace, sourceTab, event) {
  removeWorkspaceDragImage();
  const sourceRect = sourceTab.getBoundingClientRect();
  const dragImage = sourceTab.cloneNode(true);
  dragImage.className = "workspace-drag-image";
  dragImage.style.width = `${sourceRect.width}px`;
  dragImage.style.height = `${sourceRect.height}px`;
  dragImage.querySelector(".workspace-delete")?.remove();
  dragImage.querySelector(".nav-item")?.classList.toggle("active", workspace?.id === activeWorkspaceId);
  document.body.append(dragImage);
  workspaceDragImage = dragImage;
  moveWorkspaceDragImage(event);
}

function moveWorkspaceDragImage(event) {
  if (!workspaceDragImage) {
    return;
  }

  const offsetX = workspacePointerDragState?.dragOffsetX ?? 0;
  const offsetY = workspacePointerDragState?.dragOffsetY ?? 0;
  workspaceDragImage.style.transform = `translate(${event.clientX - offsetX}px, ${event.clientY - offsetY}px)`;
}

function removeWorkspaceDragImage() {
  workspaceDragImage?.remove();
  workspaceDragImage = null;
}

function getActiveWorkspace() {
  return workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0];
}

function getActiveBoardView() {
  return normalizeBoardView(getActiveWorkspace()?.boardView);
}

function getActiveStatusOrder() {
  const statusOrder = getActiveWorkspace()?.statusOrder;

  return Array.isArray(statusOrder) ? statusOrder.filter((status) => typeof status === "string") : [];
}

function getActiveTableColumnOrder() {
  return normalizeTableColumnOrder(getActiveWorkspace()?.tableColumnOrder);
}

function getActiveTableNameWidth() {
  return getActiveTableColumnWidths().name;
}

function getActiveTableColumnWidths() {
  const workspace = getActiveWorkspace();

  return normalizeTableColumnWidths(workspace?.tableColumnWidths, workspace?.tableNameWidth);
}

function normalizeBoardView(boardView) {
  return boardViews.has(boardView) ? boardView : "overview";
}

function normalizeTableColumnOrder(columnOrder) {
  if (!Array.isArray(columnOrder)) {
    return [...tableColumnIds];
  }

  const normalizedColumns = columnOrder.filter((columnId) => tableColumnIds.includes(columnId));
  const missingColumns = tableColumnIds.filter((columnId) => !normalizedColumns.includes(columnId));

  return [...normalizedColumns, ...missingColumns];
}

function normalizeTableNameWidth(width) {
  return normalizeTableColumnWidth("name", width);
}

function normalizeTableColumnWidth(columnId, width) {
  const parsedWidth = Number(width);
  if (!Number.isFinite(parsedWidth)) {
    return defaultTableColumnWidths[columnId];
  }

  const limits = tableColumnWidthLimits[columnId];

  return Math.min(limits.max, Math.max(limits.min, Math.round(parsedWidth)));
}

function normalizeTableColumnWidths(widths, legacyNameWidth) {
  const normalizedWidths = tableColumnIds.reduce((nextWidths, columnId) => {
    const width = widths?.[columnId] ?? (columnId === "name" ? legacyNameWidth : undefined);
    nextWidths[columnId] = normalizeTableColumnWidth(columnId, width);

    return nextWidths;
  }, {});
  const totalWidth = tableColumnIds.reduce((total, columnId) => total + normalizedWidths[columnId], 0);

  if (totalWidth > maxTableColumnTotalWidth) {
    const overflow = totalWidth - maxTableColumnTotalWidth;
    normalizedWidths.name = normalizeTableColumnWidth("name", normalizedWidths.name - overflow);
  }

  return normalizedWidths;
}

function normalizeResizedTableColumnWidth(columnId, width, currentWidths) {
  const siblingWidth = tableColumnIds
    .filter((tableColumnId) => tableColumnId !== columnId)
    .reduce((total, tableColumnId) => total + currentWidths[tableColumnId], 0);
  const maxWidth = maxTableColumnTotalWidth - siblingWidth;

  return Math.min(maxWidth, normalizeTableColumnWidth(columnId, width));
}

function getNextWorkspaceNumber() {
  const numberedNames = workspaces
    .map((workspace) => workspace.name.match(/^Workspace\s+(\d+)$/)?.[1])
    .filter(Boolean)
    .map(Number);

  return numberedNames.length > 0 ? Math.max(...numberedNames) + 1 : 1;
}

function createWorkspaceId() {
  do {
    workspaceSequence += 1;
  } while (workspaces.some((workspace) => workspace.id === `workspace-${workspaceSequence}`));

  return `workspace-${workspaceSequence}`;
}

function renameWorkspace(workspaceId, name) {
  const nextName = name.trim();
  if (!nextName) {
    return;
  }

  workspaces = workspaces.map((workspace) =>
    workspace.id === workspaceId ? { ...workspace, name: nextName } : workspace,
  );
  saveWorkspaceState();
  renderWorkspaceTabs();
  renderFolders();
}

function startWorkspaceRename() {
  const workspace = getActiveWorkspace();
  const titleWidth = workspaceTitleButton.getBoundingClientRect().width;
  workspaceTitleInput.value = workspace.name;
  workspaceTitleInput.style.width = `${titleWidth}px`;
  workspaceTitleInput.hidden = false;
  workspaceTitleRow.classList.add("is-editing");
  workspaceTitleInput.focus();
  workspaceTitleInput.select();
}

function commitWorkspaceRename() {
  if (workspaceTitleInput.hidden) {
    return;
  }

  renameWorkspace(activeWorkspaceId, workspaceTitleInput.value);
  closeWorkspaceRename();
}

function cancelWorkspaceRename() {
  closeWorkspaceRename();
}

function closeWorkspaceRename() {
  workspaceTitleInput.hidden = true;
  workspaceTitleRow.classList.remove("is-editing");
}

function handleWorkspaceTitleKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    commitWorkspaceRename();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelWorkspaceRename();
  }
}

function loadWorkspaceState() {
  try {
    const storedState = JSON.parse(localStorage.getItem(workspaceStorageKey));
    if (!isStoredWorkspaceState(storedState)) {
      return;
    }

    workspaces = storedState.workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      boardView: normalizeBoardView(workspace.boardView),
      statusOrder: Array.isArray(workspace.statusOrder)
        ? workspace.statusOrder.filter((status) => typeof status === "string")
        : [],
      tableColumnOrder: normalizeTableColumnOrder(workspace.tableColumnOrder),
      tableColumnWidths: normalizeTableColumnWidths(workspace.tableColumnWidths, workspace.tableNameWidth),
    }));
    activeWorkspaceId = workspaces.some((workspace) => workspace.id === storedState.activeWorkspaceId)
      ? storedState.activeWorkspaceId
      : workspaces[0].id;
    workspaceSequence = Math.max(
      storedState.workspaceSequence,
      ...workspaces.map((workspace) => Number(workspace.id.replace("workspace-", "")) || 1),
    );
  } catch (error) {
    localStorage.removeItem(workspaceStorageKey);
  }
}

function loadSidebarState() {
  return localStorage.getItem(sidebarStorageKey) === "collapsed";
}

function loadBoardView() {
  return getActiveBoardView();
}

function saveBoardView() {
  workspaces = workspaces.map((workspace) =>
    workspace.id === activeWorkspaceId ? { ...workspace, boardView } : workspace,
  );
  saveWorkspaceState();
}

function saveStatusOrder(statusOrder) {
  workspaces = workspaces.map((workspace) =>
    workspace.id === activeWorkspaceId ? { ...workspace, statusOrder } : workspace,
  );
  saveWorkspaceState();
}

function saveTableColumnOrder(tableColumnOrder) {
  workspaces = workspaces.map((workspace) =>
    workspace.id === activeWorkspaceId
      ? { ...workspace, tableColumnOrder: normalizeTableColumnOrder(tableColumnOrder) }
      : workspace,
  );
  saveWorkspaceState();
}

function saveTableNameWidth(tableNameWidth) {
  saveTableColumnWidth("name", tableNameWidth);
}

function saveTableColumnWidth(columnId, width) {
  if (!tableColumnIds.includes(columnId)) {
    return;
  }

  workspaces = workspaces.map((workspace) =>
    workspace.id === activeWorkspaceId
      ? {
          ...workspace,
          tableColumnWidths: {
            ...normalizeTableColumnWidths(workspace.tableColumnWidths, workspace.tableNameWidth),
            [columnId]: normalizeTableColumnWidth(columnId, width),
          },
        }
      : workspace,
  );
  saveWorkspaceState();
}

function saveSidebarState(collapsed) {
  localStorage.setItem(sidebarStorageKey, collapsed ? "collapsed" : "expanded");
}

function finishInitialLayout() {
  document.documentElement.classList.remove("app-loading", "sidebar-saved-collapsed");
}

function saveWorkspaceState() {
  const nextState = JSON.stringify({
    workspaces,
    activeWorkspaceId,
    workspaceSequence,
  });
  localStorage.setItem(workspaceStorageKey, nextState);
}

function isStoredWorkspaceState(state) {
  return (
    state &&
    Array.isArray(state.workspaces) &&
    state.workspaces.length > 0 &&
    state.workspaces.every((workspace) => typeof workspace.id === "string" && typeof workspace.name === "string") &&
    typeof state.activeWorkspaceId === "string" &&
    Number.isInteger(state.workspaceSequence)
  );
}

function createWorkspaceTab(workspace) {
  const tab = document.createElement("div");
  tab.className = "workspace-tab";
  tab.dataset.workspaceId = workspace.id;

  const button = document.createElement("button");
  button.className = "nav-item";
  button.type = "button";
  button.dataset.view = "workspace";
  button.dataset.workspaceId = workspace.id;
  button.title = workspace.name;
  button.classList.toggle("active", workspace.id === activeWorkspaceId);
  if (workspace.id === activeWorkspaceId) {
    button.setAttribute("aria-current", "page");
  }

  const icon = document.createElement("span");
  icon.className = "nav-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "W";

  const label = document.createElement("span");
  label.className = "nav-label";
  label.textContent = workspace.name;

  const deleteButton = document.createElement("button");
  deleteButton.className = "icon-button workspace-delete";
  deleteButton.type = "button";
  deleteButton.dataset.workspaceId = workspace.id;
  deleteButton.setAttribute("aria-label", `Удалить ${workspace.name}`);
  deleteButton.title = `Удалить ${workspace.name}`;
  deleteButton.textContent = "×";
  deleteButton.disabled = isDefaultWorkspace(workspace);

  button.append(icon, label);
  tab.append(button, deleteButton);

  return tab;
}

async function chooseFolder() {
  if (!supportsDirectoryPicker) {
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: "read" });
    selectedHandle = handle;
    folders = [];
    updateRoot(handle.name);
    updateActionStates();
    await storeHandle(handle);
    restoreButton.hidden = true;
    await scanSelectedFolder();
  } catch (error) {
    if (error.name !== "AbortError") {
      setStatus("Could not open that folder. Try choosing it again.", "error");
    }
  }
}

async function restoreAccess() {
  if (!selectedHandle) {
    return;
  }

  if (await hasPermission(selectedHandle, true)) {
    restoreButton.hidden = true;
    await scanSelectedFolder();
    return;
  }

  setStatus("Access was not granted. Choose the folder again.", "error");
}

async function scanSelectedFolder() {
  if (!selectedHandle) {
    setStatus("Choose a folder to build the board.", "idle");
    renderFolders();
    return;
  }

  if (!(await hasPermission(selectedHandle, true))) {
    restoreButton.hidden = false;
    setStatus("Folder permission is missing. Restore access or choose the folder again.", "error");
    renderFolders();
    return;
  }

  setStatus("Scanning status folders...", "idle");

  try {
    folders = await listStatusCards(selectedHandle);
    setStatus("Folder board updated.", "success");
  } catch (error) {
    folders = [];
    setStatus("Could not scan that folder. Choose it again.", "error");
  }

  renderFolders();
}

function renderFolders() {
  pageTitle.textContent = getActiveWorkspace().name;
  updateActionStates();

  if (!folderViews.has(activeView)) {
    renderPlaceholder(views[activeView].emptyTitle, views[activeView].emptyDescription);
    return;
  }

  const visibleFolders = filterFolders(folders, searchInput.value);
  renderActiveBoardView(visibleFolders);

  const hasCards = visibleFolders.length > 0;
  emptyState.hidden = hasCards;

  if (!selectedHandle) {
    emptyState.querySelector("h2").textContent = supportsDirectoryPicker ? "No folder selected" : "Browser unsupported";
    emptyState.querySelector("p").textContent = supportsDirectoryPicker
      ? views[activeView].emptyDescription
      : "Open this app in a Chromium browser to choose local folders.";
  } else if (folders.length === 0) {
    emptyState.querySelector("h2").textContent = "No folders in statuses";
    emptyState.querySelector("p").textContent = "Create folders inside the root status folders to display them as cards.";
  } else {
    emptyState.querySelector("h2").textContent = "No matches";
    emptyState.querySelector("p").textContent = "Clear search to show the folder cards again.";
  }

  sidebarFolderCount.textContent = String(folders.length);
  saveBoardSnapshot();
}

function renderActiveBoardView(visibleFolders) {
  const activeBoardView = getActiveBoardView();
  boardSurface.classList.toggle("board-mode", activeBoardView === "board");
  boardSurface.classList.toggle("table-mode", activeBoardView === "table");

  if (activeBoardView === "board") {
    renderBoardView(visibleFolders);
    return;
  }

  if (activeBoardView === "table") {
    renderTableView(visibleFolders);
    return;
  }

  renderOverviewView(visibleFolders);
}

function renderOverviewView(visibleFolders) {
  folderGrid.className = "folder-grid";
  folderGrid.replaceChildren(...visibleFolders.map((folder) => createFolderCard(folder)));
}

function renderBoardView(visibleFolders) {
  const statuses = getOrderedStatuses(visibleFolders);

  folderGrid.className = "folder-board-view";
  folderGrid.replaceChildren(
    ...statuses.map((status) =>
      createBoardColumn(
        status,
        visibleFolders.filter((folder) => folder.status === status),
      ),
    ),
  );
}

function getOrderedStatuses(visibleFolders) {
  const currentStatuses = [...new Set(visibleFolders.map((folder) => folder.status))];
  const currentStatusSet = new Set(currentStatuses);
  const savedStatuses = getActiveStatusOrder().filter((status) => currentStatusSet.has(status));
  const newStatuses = currentStatuses.filter((status) => !savedStatuses.includes(status));

  return [...savedStatuses, ...newStatuses];
}

function renderTableView(visibleFolders) {
  const columnOrder = getActiveTableColumnOrder();
  const table = document.createElement("div");
  table.className = "folder-table-surface";
  setTableGridTemplate(table);

  const header = document.createElement("div");
  header.className = "folder-table-row folder-table-head";
  header.append(...columnOrder.map(createTableHeaderCell));

  table.append(header, ...visibleFolders.map((folder) => createTableRow(folder, columnOrder)));

  folderGrid.className = "folder-table";
  folderGrid.replaceChildren(table);
}

function setTableGridTemplate(tableElement) {
  const columnOrder = getActiveTableColumnOrder();
  const tableColumnWidths = getActiveTableColumnWidths();
  const columnTracks = columnOrder.map((columnId) =>
    `minmax(${columnId === "name" ? "180px" : "110px"}, var(--table-${columnId}-column-width))`,
  );

  tableElement.style.setProperty("--table-name-column-width", `${tableColumnWidths.name}%`);
  tableElement.style.setProperty("--table-status-column-width", `${tableColumnWidths.status}%`);
  tableElement.style.setProperty("--table-columns", columnTracks.join(" "));
}

function renderPlaceholder(title, description) {
  folderGrid.className = "folder-grid";
  folderGrid.replaceChildren();
  emptyState.hidden = false;
  emptyState.querySelector("h2").textContent = title;
  emptyState.querySelector("p").textContent = description;
  setStatus(`${views[activeView].title} is available as a navigation state in this MVP.`, "idle");
}

function setActiveView(view) {
  activeView = views[view] ? view : "workspace";

  renderFolders();
}

function updateActionStates() {
  const canUseFolderBoard = supportsDirectoryPicker && folderViews.has(activeView);
  searchInput.disabled = !canUseFolderBoard;
}

function createBoardColumn(status, statusFolders) {
  const column = document.createElement("section");
  column.className = "board-column";
  column.dataset.status = status;

  const title = document.createElement("h2");
  title.className = "board-column-title";
  title.draggable = true;
  title.textContent = status;

  const cards = document.createElement("div");
  cards.className = "board-column-cards";
  cards.replaceChildren(...statusFolders.map((folder) => createFolderCard(folder, { showStatus: false })));

  column.append(title, cards);

  return column;
}

function handleBoardColumnDragStart(event) {
  const title = event.target.closest(".board-column-title");
  const column = title?.closest(".board-column");
  if (!title || !column || getActiveBoardView() !== "board") {
    return;
  }

  draggedStatus = column.dataset.status;
  const dragImage = createBoardColumnDragImage(draggedStatus);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedStatus);
  event.dataTransfer.setDragImage(dragImage, 12, 12);
  requestAnimationFrame(() => title.classList.add("is-drag-source-title"));
}

function handleBoardColumnDragOver(event) {
  const targetColumn = event.target.closest(".board-column");
  if (!draggedStatus || !targetColumn) {
    return;
  }

  event.preventDefault();
  applyBoardColumnTitlePreview(getPreviewStatusOrder(event, targetColumn));
}

function handleBoardColumnDragLeave(event) {
  if (!folderGrid.contains(event.relatedTarget)) {
    clearBoardColumnShiftPreview();
  }
}

function handleBoardColumnDrop(event) {
  const targetColumn = event.target.closest(".board-column");
  if (!draggedStatus || !targetColumn) {
    return;
  }

  event.preventDefault();
  const reorderedStatuses = getPreviewStatusOrder(event, targetColumn);
  saveStatusOrder(reorderedStatuses);
  draggedStatus = null;
  clearBoardColumnDragState();
  removeBoardColumnDragImage();
  renderFolders();
}

function handleBoardColumnDragEnd() {
  draggedStatus = null;
  clearBoardColumnDragState();
  removeBoardColumnDragImage();
}

function createBoardColumnDragImage(status) {
  removeBoardColumnDragImage();
  const dragImage = document.createElement("div");
  dragImage.className = "board-column-drag-image";
  dragImage.textContent = status;
  document.body.append(dragImage);
  boardColumnDragImage = dragImage;

  return dragImage;
}

function removeBoardColumnDragImage() {
  boardColumnDragImage?.remove();
  boardColumnDragImage = null;
}

function getPreviewStatusOrder(event, targetColumn) {
  const statuses = getOrderedStatuses(filterFolders(folders, searchInput.value));
  const targetStatus = targetColumn.dataset.status;
  if (!draggedStatus || !targetStatus || targetStatus === draggedStatus) {
    return statuses;
  }

  const insertAfterTarget = getColumnInsertAfterTarget(event, statuses, targetColumn);

  return moveStatusNearTarget(statuses, draggedStatus, targetStatus, insertAfterTarget);
}

function getColumnInsertAfterTarget(event, statuses, targetColumn) {
  const draggedIndex = statuses.indexOf(draggedStatus);
  const targetIndex = statuses.indexOf(targetColumn.dataset.status);
  const targetRect = targetColumn.getBoundingClientRect();
  if (draggedIndex < 0 || targetIndex < 0) {
    return false;
  }

  if (draggedIndex < targetIndex) {
    return event.clientX > targetRect.left + targetRect.width * 0.25;
  }

  return event.clientX > targetRect.right - targetRect.width * 0.25;
}

function moveStatusNearTarget(statuses, movedStatus, targetStatus, insertAfterTarget) {
  const withoutMoved = statuses.filter((status) => status !== movedStatus);
  const targetIndex = withoutMoved.indexOf(targetStatus);
  if (targetIndex < 0) {
    return statuses;
  }

  const insertIndex = targetIndex + (insertAfterTarget ? 1 : 0);
  return [...withoutMoved.slice(0, insertIndex), movedStatus, ...withoutMoved.slice(insertIndex)];
}

function applyBoardColumnTitlePreview(previewStatuses) {
  const columns = [...folderGrid.querySelectorAll(".board-column")];
  const columnGap = Number.parseFloat(getComputedStyle(folderGrid).columnGap) || 0;
  columns.forEach((column, currentIndex) => {
    const title = column.querySelector(".board-column-title");
    const previewIndex = previewStatuses.indexOf(column.dataset.status);
    const shiftDistance = `${column.getBoundingClientRect().width + columnGap}px`;
    title.classList.remove("is-preview-shift-left", "is-preview-shift-right");
    title.style.setProperty("--board-title-shift", shiftDistance);

    if (column.dataset.status === draggedStatus) {
      title.classList.add("is-drag-source-title");
      return;
    }

    if (previewIndex < 0) {
      return;
    }

    if (previewIndex < currentIndex) {
      title.classList.add("is-preview-shift-left");
    } else if (previewIndex > currentIndex) {
      title.classList.add("is-preview-shift-right");
    }
  });
}

function clearBoardColumnTitlePreview() {
  clearBoardColumnDragState();
}

function clearBoardColumnShiftPreview() {
  folderGrid.querySelectorAll(".board-column-title").forEach((title) => {
    title.classList.remove("is-preview-shift-left", "is-preview-shift-right");
    title.style.removeProperty("--board-title-shift");
  });
}

function clearBoardColumnDragState() {
  clearBoardColumnShiftPreview();
  folderGrid.querySelectorAll(".board-column-title").forEach((title) => {
    title.classList.remove("is-drag-source-title");
  });
}

function handleTableColumnResizeStart(event) {
  const handle = event.target.closest(".table-resize-handle");
  const tableElement = handle?.closest(".folder-table-surface");
  if (!handle || !tableElement || tableResizeState || getActiveBoardView() !== "table") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const startColumnWidths = getActiveTableColumnWidths();
  tableResizeState = {
    columnId: handle.dataset.tableColumn,
    startX: event.clientX,
    startWidth: startColumnWidths[handle.dataset.tableColumn],
    startColumnWidths,
    tableWidth: tableElement.getBoundingClientRect().width,
    tableElement,
  };
  tableElement.classList.add("is-resizing-table");
  if ("pointerId" in event) {
    handle.setPointerCapture?.(event.pointerId);
  }
}

function handleTableColumnResizeMove(event) {
  if (!tableResizeState) {
    return;
  }

  const deltaWidth = ((event.clientX - tableResizeState.startX) / tableResizeState.tableWidth) * 100;
  const tableColumnWidth = normalizeResizedTableColumnWidth(
    tableResizeState.columnId,
    tableResizeState.startWidth + deltaWidth,
    tableResizeState.startColumnWidths,
  );
  tableResizeState.tableElement.style.setProperty(
    `--table-${tableResizeState.columnId}-column-width`,
    `${tableColumnWidth}%`,
  );
}

function handleTableColumnResizeEnd(event) {
  if (!tableResizeState) {
    return;
  }

  const deltaWidth = ((event.clientX - tableResizeState.startX) / tableResizeState.tableWidth) * 100;
  const tableColumnWidth = normalizeResizedTableColumnWidth(
    tableResizeState.columnId,
    tableResizeState.startWidth + deltaWidth,
    tableResizeState.startColumnWidths,
  );
  const { columnId } = tableResizeState;
  tableResizeState.tableElement.classList.remove("is-resizing-table");
  tableResizeState = null;
  saveTableColumnWidth(columnId, tableColumnWidth);
}

function handleTableColumnDragStart(event) {
  const cell = event.target.closest(".folder-table-head .folder-table-cell");
  if (!cell || event.target.closest(".table-resize-handle") || getActiveBoardView() !== "table") {
    return;
  }

  draggedTableColumn = cell.dataset.tableColumn;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedTableColumn);
  requestAnimationFrame(() => cell.classList.add("is-table-drag-source"));
}

function handleTableColumnDragOver(event) {
  const targetCell = event.target.closest(".folder-table-head .folder-table-cell");
  if (!draggedTableColumn || !targetCell) {
    return;
  }

  event.preventDefault();
  applyTableColumnPreview(getTablePreviewColumnOrder(event, targetCell));
}

function handleTableColumnDragLeave(event) {
  if (!folderGrid.contains(event.relatedTarget)) {
    clearTableColumnShiftPreview();
  }
}

function handleTableColumnDrop(event) {
  const targetCell = event.target.closest(".folder-table-head .folder-table-cell");
  if (!draggedTableColumn || !targetCell) {
    return;
  }

  event.preventDefault();
  const tableColumnOrder = getTablePreviewColumnOrder(event, targetCell);
  saveTableColumnOrder(tableColumnOrder);
  draggedTableColumn = null;
  clearTableColumnDragState();
  removeTableColumnDragImage();
  renderFolders();
}

function handleTableColumnDragEnd() {
  draggedTableColumn = null;
  clearTableColumnDragState();
  removeTableColumnDragImage();
}

function handleTableColumnPointerDragStart(event) {
  const cell = event.target.closest(".folder-table-head .folder-table-cell");
  if (
    !cell ||
    event.target.closest(".table-resize-handle") ||
    tableResizeState ||
    tableColumnPointerDragState ||
    getActiveBoardView() !== "table"
  ) {
    return;
  }

  event.preventDefault();
  tableColumnPointerDragState = {
    columnId: cell.dataset.tableColumn,
    startX: event.clientX,
    startY: event.clientY,
    sourceCell: cell,
    targetCell: cell,
    isDragging: false,
  };
  try {
    cell.setPointerCapture?.(event.pointerId);
  } catch (error) {
    // Synthetic pointer events used in tests do not always create an active pointer.
  }
}

function handleTableColumnPointerDragMove(event) {
  if (!tableColumnPointerDragState) {
    return;
  }

  const dragDistance = Math.hypot(
    event.clientX - tableColumnPointerDragState.startX,
    event.clientY - tableColumnPointerDragState.startY,
  );
  if (!tableColumnPointerDragState.isDragging && dragDistance < 4) {
    return;
  }

  event.preventDefault();
  const startsDragging = !tableColumnPointerDragState.isDragging;
  tableColumnPointerDragState.isDragging = true;
  draggedTableColumn = tableColumnPointerDragState.columnId;
  tableColumnPointerDragState.sourceCell.classList.add("is-table-drag-source");
  if (startsDragging) {
    createTableColumnDragImage(tableColumnPointerDragState.columnId, event);
  } else {
    moveTableColumnDragImage(event);
  }

  const targetCell = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest(".folder-table-head .folder-table-cell");
  if (!targetCell) {
    return;
  }

  tableColumnPointerDragState.targetCell = targetCell;
  applyTableColumnPreview(getTablePreviewColumnOrder(event, targetCell));
}

function handleTableColumnPointerDragEnd(event) {
  if (!tableColumnPointerDragState) {
    return;
  }

  const { isDragging, targetCell } = tableColumnPointerDragState;
  tableColumnPointerDragState = null;

  if (!isDragging || !targetCell) {
    removeTableColumnDragImage();
    return;
  }

  event.preventDefault();
  const tableColumnOrder = getTablePreviewColumnOrder(event, targetCell);
  saveTableColumnOrder(tableColumnOrder);
  draggedTableColumn = null;
  clearTableColumnDragState();
  removeTableColumnDragImage();
  renderFolders();
}

function createTableColumnDragImage(columnId, event) {
  removeTableColumnDragImage();
  const sourceRect = tableColumnPointerDragState?.sourceCell.getBoundingClientRect();
  const dragImage = document.createElement("div");
  dragImage.className = "table-column-drag-image";
  dragImage.textContent = tableColumnLabels[columnId] || columnId;
  if (sourceRect) {
    dragImage.style.width = `${sourceRect.width}px`;
    dragImage.style.height = `${sourceRect.height}px`;
  }
  document.body.append(dragImage);
  tableColumnDragImage = dragImage;
  moveTableColumnDragImage(event);
}

function moveTableColumnDragImage(event) {
  if (!tableColumnDragImage) {
    return;
  }

  tableColumnDragImage.style.transform = `translate(${event.clientX + 12}px, ${event.clientY - 18}px)`;
}

function removeTableColumnDragImage() {
  tableColumnDragImage?.remove();
  tableColumnDragImage = null;
}

function getTablePreviewColumnOrder(event, targetCell) {
  const columnOrder = getActiveTableColumnOrder();
  const targetColumn = targetCell.dataset.tableColumn;
  if (!draggedTableColumn || !targetColumn || targetColumn === draggedTableColumn) {
    return columnOrder;
  }

  const insertAfterTarget = getTableColumnInsertAfterTarget(event, columnOrder, targetCell);
  return moveStatusNearTarget(columnOrder, draggedTableColumn, targetColumn, insertAfterTarget);
}

function getTableColumnInsertAfterTarget(event, columnOrder, targetCell) {
  const draggedIndex = columnOrder.indexOf(draggedTableColumn);
  const targetIndex = columnOrder.indexOf(targetCell.dataset.tableColumn);
  const targetRect = targetCell.getBoundingClientRect();
  if (draggedIndex < 0 || targetIndex < 0) {
    return false;
  }

  if (draggedIndex < targetIndex) {
    return event.clientX > targetRect.left + targetRect.width * 0.25;
  }

  return event.clientX > targetRect.right - targetRect.width * 0.25;
}

function applyTableColumnPreview(previewColumnOrder) {
  const cells = [...folderGrid.querySelectorAll(".folder-table-head .folder-table-cell")];
  cells.forEach((cell, currentIndex) => {
    const previewIndex = previewColumnOrder.indexOf(cell.dataset.tableColumn);
    const shiftDistance = `${cell.getBoundingClientRect().width}px`;
    cell.classList.remove("is-table-preview-left", "is-table-preview-right");
    cell.style.setProperty("--table-title-shift", shiftDistance);

    if (cell.dataset.tableColumn === draggedTableColumn) {
      cell.classList.add("is-table-drag-source");
      return;
    }

    if (previewIndex < currentIndex) {
      cell.classList.add("is-table-preview-left");
    } else if (previewIndex > currentIndex) {
      cell.classList.add("is-table-preview-right");
    }
  });
}

function clearTableColumnShiftPreview() {
  folderGrid.querySelectorAll(".folder-table-head .folder-table-cell").forEach((cell) => {
    cell.classList.remove("is-table-preview-left", "is-table-preview-right");
    cell.style.removeProperty("--table-title-shift");
  });
}

function clearTableColumnDragState() {
  clearTableColumnShiftPreview();
  folderGrid.querySelectorAll(".folder-table-head .folder-table-cell").forEach((cell) => {
    cell.classList.remove("is-table-drag-source");
  });
}

function createTableRow(folder, columnOrder = getActiveTableColumnOrder()) {
  const row = document.createElement("div");
  row.className = "folder-table-row";
  row.append(...columnOrder.map((columnId) => createTableCell(getTableCellText(folder, columnId), columnId)));

  return row;
}

function createTableHeaderCell(columnId) {
  const cell = document.createElement("button");
  cell.className = "folder-table-cell";
  cell.type = "button";
  cell.draggable = false;
  cell.dataset.tableColumn = columnId;
  cell.textContent = tableColumnLabels[columnId];

  cell.append(createTableResizeHandle(columnId));

  return cell;
}

function createTableResizeHandle(columnId) {
  const handle = document.createElement("span");
  handle.className = "table-resize-handle";
  handle.dataset.tableColumn = columnId;
  handle.setAttribute("aria-hidden", "true");

  return handle;
}

function createTableCell(text, columnId) {
  const cell = document.createElement("span");
  cell.className = "folder-table-cell";
  cell.dataset.tableColumn = columnId;
  cell.textContent = text;

  return cell;
}

function getTableCellText(folder, columnId) {
  return columnId === "status" ? folder.status : folder.name;
}

function createFolderCard(folder, options = {}) {
  const card = document.createElement("article");
  card.className = "folder-card";

  const title = document.createElement("h2");
  title.textContent = folder.name;
  card.append(title);

  if (options.showStatus === false) {
    return card;
  }

  const meta = document.createElement("div");
  meta.className = "card-meta";

  const tag = document.createElement("span");
  tag.className = "folder-tag";
  tag.textContent = folder.status;

  meta.append(tag);
  card.append(meta);

  return card;
}

function updateRoot(name) {
  sidebarRootName.textContent = name || "No folder";
}

function saveBoardSnapshot() {
  if (!selectedHandle) {
    localStorage.removeItem(boardSnapshotStorageKey);
    return;
  }

  const snapshot = {
    rootName: selectedHandle.name,
    folders: folders.map((folder) => ({
      name: folder.name,
      status: folder.status,
    })),
  };

  localStorage.setItem(boardSnapshotStorageKey, JSON.stringify(snapshot));
}

async function hasPermission(handle, request) {
  const options = { mode: "read" };
  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }

  if (request && (await handle.requestPermission(options)) === "granted") {
    return true;
  }

  return false;
}

async function getStoredHandle() {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(storeName, "readonly").objectStore(storeName).get(selectedRootKey);
      request.addEventListener("success", () => resolve(request.result?.handle || null));
      request.addEventListener("error", () => reject(request.error));
    });
  } catch (error) {
    return null;
  }
}

async function storeHandle(handle) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const request = db
        .transaction(storeName, "readwrite")
        .objectStore(storeName)
        .put({ id: selectedRootKey, handle });
      request.addEventListener("success", () => resolve());
      request.addEventListener("error", () => reject(request.error));
    });
  } catch (error) {
    setStatus("Folder selected. This browser did not save it for reload.", "idle");
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore(storeName, { keyPath: "id" });
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function setStatus(message, tone) {
  statusLine.textContent = message;
  statusLine.dataset.tone = tone;
}

initializeApp();
