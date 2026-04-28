import {
  filterFolders,
  listFolderAccessTree,
  flattenAccessTreeCards,
} from "./src/folderModel.js";

const dbName = "folder-kanban-mvp";
const storeName = "handles";
const selectedRootKey = "selected-root";
const workspaceStorageKey = "workspaces-state";
const sidebarStorageKey = "sidebar-state";
const boardSnapshotStorageKey = "folder-board-snapshot";
const folderAccessRulesStorageKey = "folder-access-rules";
const folderAccessRulesVersionStorageKey = "folder-access-rules-version";
const folderAccessRulesVersion = "2";

const appShell = document.querySelector("#appShell");
const sidebarToggle = document.querySelector("#sidebarToggle");
const sidebarReturn = document.querySelector("#sidebarReturn");
const addWorkspaceButton = document.querySelector("#addWorkspaceButton");
const settingsNavButton = document.querySelector("#settingsNavButton");
const workspaceTabs = document.querySelector("#workspaceTabs");
const boardViewSwitcher = document.querySelector("#boardViewSwitcher");
const settingsViewSwitcher = document.querySelector("#settingsViewSwitcher");
const boardColumnMenuButton = document.querySelector("#boardColumnMenuButton");
const boardColumnMenuPopover = document.querySelector("#boardColumnMenuPopover");
const toggleHiddenColumnsButton = document.querySelector("#toggleHiddenColumnsButton");
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
const folderRoleIds = ["status", "card", "group"];
const folderRoleLabels = {
  status: "STATUS",
  card: "CARD",
  group: "GROUP",
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
const boardScrollbarHotZoneSize = 56;
const boardScrollbarIdleDelay = 900;

let selectedHandle = null;
let folders = [];
let folderAccessTree = [];
let folderAccessRules = {};
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
let boardScrollbarHideTimer = null;
let reopenTableStatusMenuAfterRender = false;
let workspaceSequence = 1;
let workspaces = [
  {
    id: "workspace-1",
    name: "Workspace",
    boardView: "overview",
    statusOrder: [],
    hiddenStatuses: [],
    showHiddenStatuses: false,
    tableColumnOrder: [...tableColumnIds],
    tableColumnWidths: { ...defaultTableColumnWidths },
  },
];
let activeWorkspaceId = "workspace-1";

async function initializeApp() {
  loadWorkspaceState();
  loadFolderAccessRules();
  boardView = loadBoardView();
  setSidebarCollapsed(loadSidebarState(), false);
  renderWorkspaceTabs();
  renderBoardViewSwitcher();
  bindEvents();

  try {
    if (!supportsDirectoryPicker) {
      setStatus("Folder selection requires a Chromium browser with File System Access API.", "error");
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
  settingsNavButton.addEventListener("click", () => setActiveView("settings"));
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
      activeView = "workspace";
      setActiveWorkspace(workspaceButton.dataset.workspaceId);
    }
  });

  boardViewSwitcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-board-view]");
    if (button) {
      setBoardView(button.dataset.boardView);
    }
  });
  boardColumnMenuButton.addEventListener("click", handleBoardColumnMenuToggle);
  toggleHiddenColumnsButton.addEventListener("click", handleToggleHiddenColumns);
  document.addEventListener("click", handleBoardColumnMenuOutsideClick);
  document.addEventListener("click", handleTableStatusMenuOutsideClick);
  document.addEventListener("keydown", handleBoardColumnMenuKeydown);
  document.addEventListener("keydown", handleTableStatusMenuKeydown);
  restoreButton.addEventListener("click", restoreAccess);
  searchInput.addEventListener("input", renderFolders);
  boardSurface.addEventListener("pointermove", handleBoardSurfacePointerMove);
  boardSurface.addEventListener("pointerleave", hideBoardScrollbar);
  boardSurface.addEventListener("scroll", handleBoardSurfaceScroll);
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
  folderGrid.addEventListener("click", handleBoardColumnVisibilityClick);
  folderGrid.addEventListener("click", handleTableStatusMenuClick);
  folderGrid.addEventListener("pointerdown", handleTableColumnResizeStart);
  folderGrid.addEventListener("pointerdown", handleTableColumnPointerDragStart);
  folderGrid.addEventListener("click", handleSettingsTreeClick);
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
  renderBoardColumnMenu();
}

function renderBoardColumnMenu() {
  toggleHiddenColumnsButton.textContent = getActiveShowHiddenStatuses()
    ? "Hide hidden columns"
    : "Show hidden columns";
}

function handleBoardColumnMenuToggle(event) {
  event.stopPropagation();
  setBoardColumnMenuOpen(boardColumnMenuPopover.hidden);
}

function handleToggleHiddenColumns(event) {
  event.stopPropagation();
  setShowHiddenStatuses(!getActiveShowHiddenStatuses());
  setBoardColumnMenuOpen(false);
}

function handleBoardColumnMenuOutsideClick(event) {
  if (event.target.closest(".board-view-settings")) {
    return;
  }

  setBoardColumnMenuOpen(false);
}

function handleBoardColumnMenuKeydown(event) {
  if (event.key === "Escape") {
    setBoardColumnMenuOpen(false);
  }
}

function setBoardColumnMenuOpen(open) {
  boardColumnMenuPopover.hidden = !open;
  boardColumnMenuButton.setAttribute("aria-expanded", String(open));
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
    hiddenStatuses: [],
    showHiddenStatuses: false,
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

function getActiveHiddenStatuses() {
  const hiddenStatuses = getActiveWorkspace()?.hiddenStatuses;

  return Array.isArray(hiddenStatuses) ? hiddenStatuses.filter((status) => typeof status === "string") : [];
}

function getActiveShowHiddenStatuses() {
  return getActiveWorkspace()?.showHiddenStatuses === true;
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

function normalizeFolderAccessRules(rules, options = {}) {
  return Object.fromEntries(
    Object.entries(rules)
      .filter(([path, rule]) => typeof path === "string" && rule && typeof rule === "object")
      .map(([path, rule]) => [
        path,
        {
          ...rule,
          role: normalizeFolderRole(
            options.migrateLegacyGroups && rule.role === "group" ? "status" : rule.role,
          ),
        },
      ]),
  );
}

function normalizeFolderRole(role) {
  return folderRoleIds.includes(role) ? role : "card";
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
      hiddenStatuses: Array.isArray(workspace.hiddenStatuses)
        ? workspace.hiddenStatuses.filter((status) => typeof status === "string")
        : [],
      showHiddenStatuses: workspace.showHiddenStatuses === true,
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

function saveHiddenStatuses(hiddenStatuses) {
  workspaces = workspaces.map((workspace) =>
    workspace.id === activeWorkspaceId
      ? { ...workspace, hiddenStatuses: hiddenStatuses.filter((status) => typeof status === "string") }
      : workspace,
  );
  saveWorkspaceState();
}

function setShowHiddenStatuses(showHiddenStatuses) {
  workspaces = workspaces.map((workspace) =>
    workspace.id === activeWorkspaceId ? { ...workspace, showHiddenStatuses } : workspace,
  );
  saveWorkspaceState();
  renderBoardColumnMenu();
  renderFolders();
}

function toggleStatusVisibility(status) {
  const hiddenStatuses = new Set(getActiveHiddenStatuses());
  if (hiddenStatuses.has(status)) {
    hiddenStatuses.delete(status);
  } else {
    hiddenStatuses.add(status);
  }

  saveHiddenStatuses([...hiddenStatuses]);
  renderFolders();
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

function loadFolderAccessRules() {
  try {
    const storedRules = JSON.parse(localStorage.getItem(folderAccessRulesStorageKey));
    if (!storedRules || typeof storedRules !== "object") {
      folderAccessRules = {};
      return;
    }

    const shouldMigrateLegacyGroups =
      localStorage.getItem(folderAccessRulesVersionStorageKey) !== folderAccessRulesVersion;
    folderAccessRules = normalizeFolderAccessRules(storedRules, { migrateLegacyGroups: shouldMigrateLegacyGroups });
    localStorage.setItem(folderAccessRulesVersionStorageKey, folderAccessRulesVersion);
  } catch (error) {
    folderAccessRules = {};
    localStorage.removeItem(folderAccessRulesStorageKey);
    localStorage.removeItem(folderAccessRulesVersionStorageKey);
  }
}

function saveFolderAccessRules() {
  localStorage.setItem(folderAccessRulesStorageKey, JSON.stringify(folderAccessRules));
  localStorage.setItem(folderAccessRulesVersionStorageKey, folderAccessRulesVersion);
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
  button.classList.toggle("active", activeView !== "settings" && workspace.id === activeWorkspaceId);
  if (activeView !== "settings" && workspace.id === activeWorkspaceId) {
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
    folderAccessTree = await listFolderAccessTree(selectedHandle, { rules: folderAccessRules });
    folders = flattenAccessTreeCards(folderAccessTree, { rootStatus: selectedHandle.name });
    setStatus("Folder board updated.", "success");
  } catch (error) {
    folders = [];
    folderAccessTree = [];
    setStatus("Could not scan that folder. Choose it again.", "error");
  }

  renderFolders();
}

function renderFolders() {
  pageTitle.textContent = getActiveWorkspace().name;
  renderActiveNavigation();
  workspaceTitleButton.disabled = activeView === "settings";
  workspaceTitleEditButton.hidden = activeView === "settings";
  updateActionStates();

  if (activeView === "settings") {
    renderSettingsView();
    return;
  }

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

  saveBoardSnapshot();
}

function renderActiveBoardView(visibleFolders) {
  const activeBoardView = getActiveBoardView();
  const usesHorizontalScroll = activeBoardView === "board";
  boardViewSwitcher.hidden = false;
  settingsViewSwitcher.hidden = true;
  boardSurface.classList.toggle("board-mode", activeBoardView === "board");
  boardSurface.classList.toggle("table-mode", activeBoardView === "table");
  boardSurface.classList.toggle("horizontal-scroll-mode", usesHorizontalScroll);
  boardSurface.classList.remove("settings-mode");
  if (!usesHorizontalScroll) {
    hideBoardScrollbar();
  }

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
  const statuses = getBoardStatuses(visibleFolders);
  const hiddenStatuses = new Set(getActiveHiddenStatuses());

  folderGrid.className = "folder-board-view";
  folderGrid.replaceChildren(
    ...statuses.map((status) =>
      createBoardColumn(
        status,
        visibleFolders.filter((folder) => folder.status === status),
        { hidden: hiddenStatuses.has(status) },
      ),
    ),
  );
}

function getBoardStatuses(visibleFolders) {
  const hiddenStatuses = new Set(getActiveHiddenStatuses());
  const showHiddenStatuses = getActiveShowHiddenStatuses();

  return getOrderedStatuses(visibleFolders).filter((status) => showHiddenStatuses || !hiddenStatuses.has(status));
}

function getOrderedStatuses(visibleFolders) {
  const currentStatuses = [...new Set(visibleFolders.map((folder) => folder.status))];
  const currentStatusSet = new Set(currentStatuses);
  const savedStatuses = getActiveStatusOrder().filter((status) => currentStatusSet.has(status));
  const newStatuses = currentStatuses.filter((status) => !savedStatuses.includes(status));

  return [...savedStatuses, ...newStatuses];
}

function handleBoardSurfacePointerMove(event) {
  if (!canShowBoardScrollbar()) {
    hideBoardScrollbar();
    return;
  }

  const boardRect = boardSurface.getBoundingClientRect();
  if (boardRect.bottom - event.clientY <= boardScrollbarHotZoneSize) {
    showBoardScrollbar();
    return;
  }

  scheduleHideBoardScrollbar();
}

function handleBoardSurfaceScroll() {
  if (!canShowBoardScrollbar()) {
    hideBoardScrollbar();
    return;
  }

  showBoardScrollbar();
  scheduleHideBoardScrollbar();
}

function showBoardScrollbar() {
  if (!canShowBoardScrollbar()) {
    hideBoardScrollbar();
    return;
  }

  window.clearTimeout(boardScrollbarHideTimer);
  boardScrollbarHideTimer = null;
  boardSurface.classList.add("is-board-scrollbar-visible");
}

function scheduleHideBoardScrollbar() {
  window.clearTimeout(boardScrollbarHideTimer);
  boardScrollbarHideTimer = window.setTimeout(hideBoardScrollbar, boardScrollbarIdleDelay);
}

function hideBoardScrollbar() {
  window.clearTimeout(boardScrollbarHideTimer);
  boardScrollbarHideTimer = null;
  boardSurface.classList.remove("is-board-scrollbar-visible");
}

function canShowBoardScrollbar() {
  return boardSurface.classList.contains("horizontal-scroll-mode") && boardSurface.scrollWidth > boardSurface.clientWidth;
}

function renderTableView(visibleFolders) {
  const columnOrder = getActiveTableColumnOrder();
  const hiddenStatuses = new Set(getActiveHiddenStatuses());
  const tableFolders = getTableFolders(visibleFolders);
  const table = document.createElement("div");
  table.className = "folder-table-surface";
  setTableGridTemplate(table);

  const header = document.createElement("div");
  header.className = "folder-table-row folder-table-head";
  header.append(...columnOrder.map(createTableHeaderCell));

  table.append(
    header,
    ...tableFolders.map((folder) => createTableRow(folder, columnOrder, { hidden: hiddenStatuses.has(folder.status) })),
  );

  folderGrid.className = "folder-table";
  folderGrid.replaceChildren(table);
  reopenTableStatusMenuIfNeeded();
}

function getTableFolders(visibleFolders) {
  const hiddenStatuses = new Set(getActiveHiddenStatuses());
  const showHiddenStatuses = getActiveShowHiddenStatuses();

  return visibleFolders.filter((folder) => showHiddenStatuses || !hiddenStatuses.has(folder.status));
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
  boardViewSwitcher.hidden = false;
  settingsViewSwitcher.hidden = true;
  boardSurface.classList.remove("settings-mode", "horizontal-scroll-mode");
  folderGrid.className = "folder-grid";
  folderGrid.replaceChildren();
  emptyState.hidden = false;
  emptyState.querySelector("h2").textContent = title;
  emptyState.querySelector("p").textContent = description;
  setStatus(`${views[activeView].title} is available as a navigation state in this MVP.`, "idle");
}

function setActiveView(view) {
  activeView = views[view] ? view : "workspace";

  renderWorkspaceTabs();
  renderFolders();
}

function updateActionStates() {
  const canUseFolderBoard = supportsDirectoryPicker && (folderViews.has(activeView) || activeView === "settings");
  searchInput.disabled = !canUseFolderBoard;
}

function renderActiveNavigation() {
  settingsNavButton.classList.toggle("active", activeView === "settings");
  if (activeView === "settings") {
    settingsNavButton.setAttribute("aria-current", "page");
  } else {
    settingsNavButton.removeAttribute("aria-current");
  }
}

function renderSettingsView() {
  pageTitle.textContent = "Settings";
  boardViewSwitcher.hidden = true;
  settingsViewSwitcher.hidden = false;
  boardSurface.classList.remove("board-mode", "table-mode", "horizontal-scroll-mode");
  boardSurface.classList.add("settings-mode");
  folderGrid.className = "settings-view";
  emptyState.hidden = true;

  const rootCard = createSettingsRootCard();
  const toolbar = createSettingsToolbar();

  if (!selectedHandle) {
    folderGrid.replaceChildren(rootCard, createSettingsEmptyTree());
    return;
  }

  folderGrid.replaceChildren(rootCard, toolbar, createSettingsAccessTree(folderAccessTree));
}

function createSettingsRootCard() {
  const rootCard = document.createElement("section");
  rootCard.className = "settings-root-card";

  const copy = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Workspace root";
  const title = document.createElement("h2");
  title.textContent = selectedHandle?.name || "No folder selected";
  const path = document.createElement("p");
  path.textContent = selectedHandle
    ? `Browser folder handle: ${selectedHandle.name}`
    : "Choose a folder to configure workspace access.";

  copy.append(eyebrow, title, path);

  const actions = document.createElement("div");
  actions.className = "settings-root-actions";
  const rescanButton = document.createElement("button");
  rescanButton.className = "ghost-button";
  rescanButton.type = "button";
  rescanButton.textContent = "Refresh";
  rescanButton.disabled = !selectedHandle;
  rescanButton.addEventListener("click", scanSelectedFolder);

  const changeButton = document.createElement("button");
  changeButton.className = "primary-button";
  changeButton.type = "button";
  changeButton.textContent = selectedHandle ? "Change" : "Choose folder";
  changeButton.addEventListener("click", chooseFolder);

  const summary = document.createElement("span");
  summary.className = "settings-root-summary";
  summary.textContent = `${folders.length} visible folders · ${countAccessGroups(folderAccessTree)} groups`;

  actions.append(rescanButton, changeButton, summary);
  rootCard.append(copy, actions);

  return rootCard;
}

function createSettingsToolbar() {
  const toolbar = document.createElement("section");
  toolbar.className = "settings-access-toolbar";

  const title = document.createElement("h2");
  title.textContent = "Folder access tree";

  const actions = document.createElement("div");
  actions.className = "settings-access-actions";
  const includeAllButton = document.createElement("button");
  includeAllButton.type = "button";
  includeAllButton.textContent = "All on";
  includeAllButton.addEventListener("click", () => setAllFolderAccess(true));

  const hideAllButton = document.createElement("button");
  hideAllButton.type = "button";
  hideAllButton.textContent = "All off";
  hideAllButton.addEventListener("click", () => setAllFolderAccess(false));

  actions.append(includeAllButton, hideAllButton);
  toolbar.append(title, actions);

  return toolbar;
}

function createSettingsEmptyTree() {
  const empty = document.createElement("section");
  empty.className = "settings-empty-tree";

  const icon = document.createElement("span");
  icon.className = "empty-icon";
  icon.setAttribute("aria-hidden", "true");
  const title = document.createElement("h2");
  title.textContent = supportsDirectoryPicker ? "No folder selected" : "Browser unsupported";
  const description = document.createElement("p");
  description.textContent = supportsDirectoryPicker
    ? "Choose a workspace root to review folder access."
    : "Open this app in a Chromium browser to choose local folders.";

  empty.append(icon, title, description);

  return empty;
}

function createSettingsAccessTree(tree) {
  const section = document.createElement("section");
  section.className = "settings-access-tree";

  const legend = document.createElement("div");
  legend.className = "settings-tree-legend";
  legend.append(
    createSettingsLegendItem("settings-tree-checkbox is-checked", "visible in workspace"),
    createSettingsLegendItem("settings-tree-checkbox", "hidden"),
    createSettingsRoleLegend(),
  );

  const table = document.createElement("div");
  table.className = "settings-tree-table";

  const head = document.createElement("div");
  head.className = "settings-tree-head";
  head.append(
    createSettingsHeadCell("Folder"),
    createSettingsHeadCell("Type"),
    createSettingsHeadCell("Access"),
  );

  const rows = document.createElement("div");
  rows.className = "settings-tree-rows";
  const filteredTree = filterSettingsTree(tree, searchInput.value);
  rows.replaceChildren(...filteredTree.flatMap((node) => createSettingsTreeRows(node, 0)));

  table.append(head, rows);
  section.append(legend, table);

  return section;
}

function createSettingsLegendItem(boxClassName, labelText) {
  const item = document.createElement("span");
  item.className = "settings-legend-item";

  const box = document.createElement("span");
  box.className = boxClassName;
  box.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.textContent = labelText;

  item.append(box, label);

  return item;
}

function createSettingsRoleLegend() {
  const item = document.createElement("span");
  item.className = "settings-legend-item settings-legend-role";

  const tags = document.createElement("span");
  tags.className = "settings-tree-role-options settings-tree-role-legend-options";
  for (const role of folderRoleIds) {
    const tag = document.createElement("span");
    tag.className = `settings-tree-role-option is-${role}`;
    tag.textContent = folderRoleLabels[role];
    tags.append(tag);
  }

  const copy = document.createElement("span");
  copy.textContent = "status, project card, or storage group";

  item.append(tags, copy);

  return item;
}

function createSettingsHeadCell(text) {
  const cell = document.createElement("span");
  cell.textContent = text;

  return cell;
}

function createSettingsTreeRows(node, depth) {
  const rows = [createSettingsTreeRow(node, depth)];
  if (node.expanded) {
    rows.push(...(node.children || []).flatMap((child) => createSettingsTreeRows(child, depth + 1)));
  }

  return rows;
}

function createSettingsTreeRow(node, depth) {
  const row = document.createElement("div");
  row.className = "settings-tree-row";
  row.dataset.path = node.path;
  row.style.setProperty("--tree-depth", String(depth));
  row.classList.toggle("is-hidden", !node.access);

  const nameCell = document.createElement("div");
  nameCell.className = "settings-tree-name";

  const button = document.createElement("button");
  button.className = "settings-tree-chevron";
  button.type = "button";
  button.dataset.action = "toggle-expanded";
  button.disabled = (node.children || []).length === 0;
  button.setAttribute("aria-label", `${node.expanded ? "Collapse" : "Expand"} ${node.name}`);
  button.classList.toggle("is-expanded", node.expanded);

  const input = document.createElement("input");
  const isLockedInsideCard = isAccessNodeInsideCard(node.path);
  input.className = "settings-tree-checkbox";
  input.type = "checkbox";
  input.dataset.action = "toggle-access";
  input.checked = node.access;
  input.disabled = isLockedInsideCard;
  input.setAttribute("aria-label", `Show ${node.name} in workspace`);

  const icon = document.createElement("span");
  icon.className = "settings-tree-folder-icon";
  icon.setAttribute("aria-hidden", "true");

  const name = document.createElement("span");
  name.className = "settings-tree-label";
  name.textContent = node.name;

  nameCell.append(button, input, icon, name);

  const roleOptions = createSettingsRoleOptions(node, isLockedInsideCard);

  const access = document.createElement("span");
  access.className = "settings-tree-access";
  access.textContent = node.access ? "Included" : "Hidden";

  row.append(nameCell, roleOptions, access);

  return row;
}

function createSettingsRoleOptions(node, isLockedInsideCard) {
  const roleOptions = document.createElement("div");
  const selectedRole = normalizeFolderRole(node.role);
  roleOptions.className = "settings-tree-role-options";
  roleOptions.setAttribute("role", "group");
  roleOptions.setAttribute("aria-label", `Type for ${node.name}`);

  for (const role of folderRoleIds) {
    const roleButton = document.createElement("button");
    const isSelected = selectedRole === role;
    roleButton.className = "settings-tree-role-option";
    roleButton.type = "button";
    roleButton.dataset.action = "set-role";
    roleButton.dataset.role = role;
    roleButton.disabled = isLockedInsideCard;
    roleButton.textContent = folderRoleLabels[role];
    roleButton.classList.toggle(`is-${role}`, isSelected);
    roleButton.setAttribute("aria-pressed", String(isSelected));
    roleButton.setAttribute("aria-label", `Mark ${node.name} as ${folderRoleLabels[role].toLowerCase()}`);
    roleOptions.append(roleButton);
  }

  return roleOptions;
}

function handleSettingsTreeClick(event) {
  if (activeView !== "settings") {
    return;
  }

  const row = event.target.closest(".settings-tree-row");
  if (!row) {
    return;
  }

  const node = findAccessNode(row.dataset.path);
  if (!node) {
    return;
  }

  const action = event.target.dataset.action;
  if ((action === "toggle-access" || action === "set-role") && isAccessNodeInsideCard(node.path)) {
    return;
  }

  if (action === "toggle-expanded") {
    setFolderAccessRule(node.path, { expanded: !node.expanded });
    return;
  }

  if (action === "toggle-access") {
    setFolderAccessRule(node.path, { access: event.target.checked });
    return;
  }

  if (action === "set-role") {
    setFolderAccessRule(node.path, { role: normalizeFolderRole(event.target.dataset.role) });
  }
}

function setFolderAccessRule(path, rule) {
  const nextRules = { ...folderAccessRules };
  const currentRule = folderAccessRules[path] || {};
  nextRules[path] = {
    ...currentRule,
    ...rule,
  };

  if (typeof rule.access === "boolean") {
    const node = findAccessNode(path);
    walkAccessTree(node?.children || [], (child) => {
      nextRules[child.path] = {
        ...(nextRules[child.path] || {}),
        access: rule.access,
      };
    });
  }

  folderAccessRules = nextRules;
  saveFolderAccessRules();
  applyFolderAccessRules();
  renderFolders();
}

function setAllFolderAccess(access) {
  const nextRules = { ...folderAccessRules };
  walkAccessTree(folderAccessTree, (node) => {
    nextRules[node.path] = {
      ...(nextRules[node.path] || {}),
      access,
    };
  });
  folderAccessRules = nextRules;
  saveFolderAccessRules();
  applyFolderAccessRules();
  renderFolders();
}

function applyFolderAccessRules() {
  applyRulesToAccessTree(folderAccessTree);
  folders = flattenAccessTreeCards(folderAccessTree, { rootStatus: selectedHandle?.name || "Client Projects" });
  saveBoardSnapshot();
}

function applyRulesToAccessTree(nodes) {
  nodes.forEach((node) => {
    const rule = folderAccessRules[node.path] || {};
    node.access = rule.access !== false;
    node.role = normalizeFolderRole(rule.role);
    node.expanded = rule.expanded === true;
    applyRulesToAccessTree(node.children || []);
  });
}

function findAccessNode(path) {
  let foundNode = null;
  walkAccessTree(folderAccessTree, (node) => {
    if (node.path === path) {
      foundNode = node;
    }
  });

  return foundNode;
}

function isAccessNodeInsideCard(path) {
  const pathParts = path.split("/");
  if (pathParts.length < 2) {
    return false;
  }

  let nodes = folderAccessTree;
  let currentPath = "";
  for (const pathPart of pathParts.slice(0, -1)) {
    currentPath = currentPath ? `${currentPath}/${pathPart}` : pathPart;
    const ancestor = nodes.find((node) => node.path === currentPath);
    if (!ancestor) {
      return false;
    }

    if (normalizeFolderRole(ancestor.role) === "card") {
      return true;
    }

    nodes = ancestor.children || [];
  }

  return false;
}

function walkAccessTree(nodes, callback) {
  nodes.forEach((node) => {
    callback(node);
    walkAccessTree(node.children || [], callback);
  });
}

function countAccessGroups(tree) {
  let count = 0;
  walkAccessTree(tree, (node) => {
    if (node.role === "group") {
      count += 1;
    }
  });

  return count;
}

function filterSettingsTree(tree, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return tree;
  }

  return tree
    .map((node) => filterSettingsNode(node, normalizedQuery))
    .filter(Boolean);
}

function filterSettingsNode(node, query) {
  const children = (node.children || []).map((child) => filterSettingsNode(child, query)).filter(Boolean);
  if (node.name.toLowerCase().includes(query) || children.length > 0) {
    return {
      ...node,
      expanded: children.length > 0 ? true : node.expanded,
      children,
    };
  }

  return null;
}

function createBoardColumn(status, statusFolders, options = {}) {
  const column = document.createElement("section");
  column.className = "board-column";
  column.dataset.status = status;
  column.classList.toggle("is-hidden-column", Boolean(options.hidden));

  const title = document.createElement("h2");
  title.className = "board-column-title";
  title.draggable = true;
  title.textContent = status;

  const button = document.createElement("button");
  button.className = "board-column-visibility";
  button.classList.toggle("is-hidden-status", Boolean(options.hidden));
  button.type = "button";
  button.dataset.status = status;
  button.setAttribute("aria-label", options.hidden ? `Show ${status} column` : `Hide ${status} column`);
  button.setAttribute("aria-pressed", String(Boolean(options.hidden)));
  button.title = options.hidden ? `Show ${status} column` : `Hide ${status} column`;

  button.append(createEyeIcon(Boolean(options.hidden)));

  const cards = document.createElement("div");
  cards.className = "board-column-cards";
  cards.replaceChildren(...statusFolders.map((folder) => createFolderCard(folder, { showStatus: false })));

  column.append(title, button, cards);

  return column;
}

function createEyeIcon(hidden) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("eye-icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");

  const outline = document.createElementNS("http://www.w3.org/2000/svg", "path");
  outline.setAttribute(
    "d",
    "M2.2 12s3.6-6.3 9.8-6.3S21.8 12 21.8 12 18.2 18.3 12 18.3 2.2 12 2.2 12Z",
  );

  const pupil = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  pupil.setAttribute("cx", "12");
  pupil.setAttribute("cy", "12");
  pupil.setAttribute("r", "3.2");

  icon.append(outline, pupil);

  if (hidden) {
    icon.classList.add("is-hidden-status");
    const slash = document.createElementNS("http://www.w3.org/2000/svg", "path");
    slash.classList.add("eye-slash");
    slash.setAttribute("d", "M4.5 4.5 19.5 19.5");
    icon.append(slash);
  }

  return icon;
}

function handleBoardColumnVisibilityClick(event) {
  const button = event.target.closest(".board-column-visibility");
  if (!button || getActiveBoardView() !== "board") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  toggleStatusVisibility(button.dataset.status);
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
  const statuses = getBoardStatuses(filterFolders(folders, searchInput.value));
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

function createTableRow(folder, columnOrder = getActiveTableColumnOrder(), options = {}) {
  const row = document.createElement("div");
  row.className = "folder-table-row";
  row.classList.toggle("is-hidden-status-row", Boolean(options.hidden));
  row.append(...columnOrder.map((columnId) => createTableCell(getTableCellText(folder, columnId), columnId)));

  return row;
}

function createTableHeaderCell(columnId) {
  const cell = document.createElement("div");
  cell.className = "folder-table-cell";
  cell.setAttribute("role", "button");
  cell.tabIndex = 0;
  cell.draggable = false;
  cell.dataset.tableColumn = columnId;

  const label = document.createElement("span");
  label.className = "table-header-label";
  label.textContent = tableColumnLabels[columnId];
  cell.append(label);

  if (columnId === "status") {
    cell.classList.add("has-table-status-menu");
    cell.setAttribute("aria-haspopup", "menu");
    cell.setAttribute("aria-expanded", "false");
    cell.append(createTableStatusMenu(getOrderedStatuses(folders), getActiveHiddenStatuses()));
  }

  cell.append(createTableResizeHandle(columnId));

  return cell;
}

function createTableStatusMenu(statuses, hiddenStatuses) {
  const hiddenStatusSet = new Set(hiddenStatuses);
  const menu = document.createElement("div");
  menu.className = "table-status-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  menu.replaceChildren(
    ...statuses.map((status) => {
      const item = document.createElement("span");
      item.className = "table-status-menu-item";
      item.dataset.status = status;
      item.setAttribute("role", "menuitem");
      item.tabIndex = 0;

      const label = document.createElement("span");
      label.className = "table-status-menu-label";
      label.textContent = status;

      item.append(label, createEyeIcon(hiddenStatusSet.has(status)));

      return item;
    }),
  );

  return menu;
}

function handleTableStatusMenuClick(event) {
  const item = event.target.closest(".table-status-menu-item");
  if (item) {
    event.preventDefault();
    event.stopPropagation();
    reopenTableStatusMenuAfterRender = true;
    toggleStatusVisibility(item.dataset.status);
    return;
  }

  const statusHeader = event.target.closest('.folder-table-head .folder-table-cell[data-table-column="status"]');
  if (!statusHeader || event.target.closest(".table-resize-handle") || getActiveBoardView() !== "table") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  toggleTableStatusMenu(statusHeader);
}

function reopenTableStatusMenuIfNeeded() {
  if (!reopenTableStatusMenuAfterRender || getActiveBoardView() !== "table") {
    reopenTableStatusMenuAfterRender = false;
    return;
  }

  reopenTableStatusMenuAfterRender = false;
  const statusHeader = folderGrid.querySelector('.folder-table-head .folder-table-cell[data-table-column="status"]');
  if (statusHeader) {
    toggleTableStatusMenu(statusHeader);
  }
}

function toggleTableStatusMenu(statusHeader) {
  const isOpen = statusHeader.classList.contains("is-table-status-menu-open");
  closeTableStatusMenus();
  if (isOpen) {
    return;
  }

  statusHeader.classList.add("is-table-status-menu-open");
  statusHeader.setAttribute("aria-expanded", "true");
  statusHeader.querySelector(".table-status-menu").hidden = false;
}

function closeTableStatusMenus() {
  folderGrid.querySelectorAll(".has-table-status-menu").forEach((cell) => {
    cell.classList.remove("is-table-status-menu-open");
    cell.setAttribute("aria-expanded", "false");
    const menu = cell.querySelector(".table-status-menu");
    if (menu) {
      menu.hidden = true;
    }
  });
}

function handleTableStatusMenuOutsideClick(event) {
  if (event.target.closest(".has-table-status-menu")) {
    return;
  }

  closeTableStatusMenus();
}

function handleTableStatusMenuKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  closeTableStatusMenus();
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
