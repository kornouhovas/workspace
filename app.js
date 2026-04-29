import { filterFolders, flattenAccessTreeCards } from "./src/folderModel.js";

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
const boardColumnMenuStatuses = document.querySelector("#boardColumnMenuStatuses");
const restoreButton = document.querySelector("#restoreButton");
const searchInput = document.querySelector("#searchInput");
const boardSurface = document.querySelector(".kanban-board");
const folderGrid = document.querySelector("#folderGrid");
const emptyState = document.querySelector("#emptyState");
const statusLine = document.querySelector("#statusLine");
const cardPlacePanel = document.querySelector("#cardPlacePanel");
const cardPlaceResizeHandle = document.querySelector("#cardPlaceResizeHandle");
const cardPlaceFolderOpenButton = document.querySelector("#cardPlaceFolderOpenButton");
const cardPlaceTitle = document.querySelector("#cardPlaceTitle");
const cardPlaceStatus = document.querySelector("#cardPlaceStatus");
const cardPlaceTextLabel = document.querySelector('[for="cardPlaceText"]');
const cardPlaceText = document.querySelector("#cardPlaceText");
const cardPlaceFolderList = document.querySelector("#cardPlaceFolderList");
const cardPlaceCloseButton = document.querySelector("#cardPlaceCloseButton");
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
const boardViewIds = ["overview", "board", "table"];
const addableBoardViewTypes = ["board", "table"];
const tableColumnIds = ["name", "status", "text"];
const tableColumnLabels = {
  name: "Name",
  status: "Status",
  text: "Text",
};
const folderRoleIds = ["status", "card", "group"];
const folderRoleLabels = {
  status: "Status",
  card: "Card",
  group: "Group",
};
const defaultTableColumnWidths = {
  name: 34,
  status: 18,
  text: 21,
};
const tableColumnWidthVersion = 2;
const tableColumnWidthLimits = {
  name: { min: 24, max: 78 },
  status: { min: 12, max: 36 },
  text: { min: 12, max: 42 },
};
const maxTableColumnTotalWidth = 94;
const boardScrollbarHotZoneSize = 56;
const boardScrollbarIdleDelay = 900;
const minCardPlaceWidth = 320;
const maxCardPlaceWidthRatio = 0.82;

let selectedRoot = null;
let folders = [];
let folderAccessTree = [];
let folderAccessRules = {};
let activeView = "workspace";
let boardView = "overview";
let draggedStatus = null;
let draggedBoardColumnMenuStatus = null;
let draggedBoardColumnMenuProperty = null;
let draggedTableMenuStatus = null;
let draggedTableColumn = null;
let boardColumnMenuPointerDragState = null;
let tableStatusMenuPointerDragState = null;
let tableColumnPointerDragState = null;
let boardViewPointerDragState = null;
let tableResizeState = null;
let cardPlaceResizeState = null;
let boardColumnDragImage = null;
let boardColumnMenuDragImage = null;
let tableColumnDragImage = null;
let tableStatusDragImage = null;
let boardViewDragImage = null;
let workspacePointerDragState = null;
let workspaceDragImage = null;
let workspaceSuppressClick = false;
let workspaceSuppressClickTimer = null;
let boardColumnMenuSuppressClick = false;
let boardColumnMenuSuppressClickTimer = null;
let boardViewSuppressClick = false;
let boardViewSuppressClickTimer = null;
let tableStatusSuppressClick = false;
let tableStatusSuppressClickTimer = null;
let boardScrollbarHideTimer = null;
let tableStatusMenuOpen = false;
let tableTextMenuOpen = false;
let selectedCardPath = null;
let cardPlaceEntries = [];
let cardPlaceEntriesState = "idle";
let cardPlaceExpandedPaths = new Set();
let cardPlaceChildrenByPath = new Map();
let cardPlaceLoadingPaths = new Set();
let cardPlaceFailedPaths = new Set();
let cardPlaceEntriesRequest = 0;
let folderPropertySaveTimers = new Map();
let workspaceSequence = 1;
let workspaces = [
  {
    id: "workspace-1",
    name: "Workspace",
    boardView: "overview",
    boardViews: createDefaultBoardViews(),
    cardPlaceWidth: normalizeCardPlaceWidth(),
  },
];
let activeWorkspaceId = "workspace-1";

async function initializeApp() {
  loadWorkspaceState();
  loadFolderAccessRules();
  loadBoardSnapshot();
  boardView = loadBoardView();
  setSidebarCollapsed(loadSidebarState(), false);
  renderWorkspaceTabs();
  renderBoardViewSwitcher();
  bindEvents();

  try {
    const root = await fetchWorkspaceRoot();
    if (!root) {
      restoreButton.hidden = true;
      renderFolders();
      return;
    }

    selectedRoot = root;
    updateRoot(root.name);
    if (selectedCardPath) {
      loadCardPlaceEntries(findFolderByPath(selectedCardPath));
    }

    restoreButton.hidden = true;
    await scanSelectedFolder();
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
    if (boardViewSuppressClick) {
      boardViewSuppressClick = false;
      window.clearTimeout(boardViewSuppressClickTimer);
      boardViewSuppressClickTimer = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const statusVisibilityButton = event.target.closest(".board-column-menu-status-visibility");
    if (statusVisibilityButton) {
      handleBoardColumnMenuClick(event);
      return;
    }

    const tablePropertyVisibilityButton = event.target.closest(".table-property-visibility");
    if (tablePropertyVisibilityButton) {
      handleTablePropertyMenuClick(event);
      return;
    }

    const addOption = event.target.closest("[data-add-board-view-type]");
    if (addOption) {
      addBoardView(addOption.dataset.addBoardViewType);
      return;
    }

    const addButton = event.target.closest("#boardAddViewButton");
    if (addButton) {
      toggleAddBoardViewMenu();
      return;
    }

    const menuAction = event.target.closest("[data-board-view-action]");
    if (menuAction) {
      handleBoardViewMenuAction(menuAction.dataset.boardViewAction);
      return;
    }

    const button = event.target.closest("[data-board-view-id]");
    if (button) {
      if (button.dataset.boardViewId === getActiveBoardViewId()) {
        toggleBoardViewMenu(button);
        return;
      }

      setBoardView(button.dataset.boardViewId);
    }
  });
  boardViewSwitcher.addEventListener("pointerdown", handleBoardViewPointerDragStart);
  boardViewSwitcher.addEventListener("pointerdown", handleBoardColumnMenuPointerDragStart);
  boardColumnMenuButton.addEventListener("click", handleBoardColumnMenuToggle);
  boardColumnMenuPopover.addEventListener("click", handleBoardColumnMenuClick);
  boardColumnMenuPopover.addEventListener("pointerdown", handleBoardColumnMenuPointerDragStart);
  document.addEventListener("click", handleBoardColumnMenuOutsideClick);
  document.addEventListener("click", handleTableStatusMenuOutsideClick);
  document.addEventListener("click", handleTableTextMenuOutsideClick);
  document.addEventListener("click", handleCardPlaceOutsideClick);
  document.addEventListener("keydown", handleBoardColumnMenuKeydown);
  document.addEventListener("keydown", handleTableStatusMenuKeydown);
  document.addEventListener("keydown", handleTableTextMenuKeydown);
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
  folderGrid.addEventListener("click", handleTableTextMenuClick);
  folderGrid.addEventListener("pointerdown", handleTableColumnResizeStart);
  folderGrid.addEventListener("pointerdown", handleTableStatusMenuPointerDragStart);
  folderGrid.addEventListener("pointerdown", handleTableColumnPointerDragStart);
  folderGrid.addEventListener("click", handleSettingsTreeClick);
  folderGrid.addEventListener("click", handleCardPlaceClick);
  folderGrid.addEventListener("mousedown", handleTableColumnResizeStart);
  cardPlaceFolderList.addEventListener("click", handleCardPlaceEntryClick);
  cardPlaceFolderOpenButton.addEventListener("click", handleCardPlaceFolderOpen);
  cardPlaceFolderOpenButton.addEventListener("keydown", handleCardPlaceFolderOpenKeydown);
  cardPlaceText.addEventListener("input", handleCardPlaceTextInput);
  cardPlaceText.addEventListener("pointerdown", clearCardPlaceTextPlaceholder);
  cardPlaceText.addEventListener("click", clearCardPlaceTextPlaceholder);
  cardPlaceText.addEventListener("focus", handleCardPlaceTextFocus);
  cardPlaceText.addEventListener("blur", handleCardPlaceTextBlur);
  cardPlaceCloseButton.addEventListener("click", closeCardPlace);
  cardPlaceResizeHandle.addEventListener("pointerdown", handleCardPlaceResizeStart);
  window.addEventListener("pointermove", handleTableColumnResizeMove);
  window.addEventListener("pointermove", handleCardPlaceResizeMove);
  window.addEventListener("pointermove", handleBoardColumnMenuPointerDragMove);
  window.addEventListener("pointermove", handleTableStatusMenuPointerDragMove);
  window.addEventListener("pointermove", handleTableColumnPointerDragMove);
  window.addEventListener("pointermove", handleBoardViewPointerDragMove);
  window.addEventListener("pointermove", handleWorkspacePointerDragMove);
  window.addEventListener("mousemove", handleTableColumnResizeMove);
  window.addEventListener("pointerup", handleTableColumnResizeEnd);
  window.addEventListener("pointerup", handleCardPlaceResizeEnd);
  window.addEventListener("pointerup", handleBoardColumnMenuPointerDragEnd);
  window.addEventListener("pointerup", handleTableStatusMenuPointerDragEnd);
  window.addEventListener("pointerup", handleTableColumnPointerDragEnd);
  window.addEventListener("pointerup", handleBoardViewPointerDragEnd);
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
  const nextView = getBoardViewById(nextBoardView);
  if (!nextView) {
    return;
  }

  saveBoardViewScrollPosition(boardView);
  boardView = nextView.id;
  closeAddBoardViewMenu();
  closeBoardViewMenu();
  saveBoardView();
  renderBoardViewSwitcher();
  renderFolders();
}

function renderBoardViewSwitcher() {
  const searchControl = boardViewSwitcher.querySelector(".board-view-search");
  const settingsControl = boardViewSwitcher.querySelector(".board-view-settings");
  boardViewSwitcher
    .querySelectorAll(".board-view-option, .board-view-add-button, .board-add-view-menu, .board-view-menu-popover")
    .forEach((element) => element.remove());

  getActiveBoardViews().forEach((view) => {
    const button = document.createElement("button");
    button.className = "board-view-option";
    button.type = "button";
    button.dataset.boardViewId = view.id;
    button.dataset.boardViewType = view.type;
    button.textContent = view.name;
    const isActive = view.id === getActiveBoardViewId();
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    boardViewSwitcher.insertBefore(button, searchControl);
  });

  const addButton = document.createElement("button");
  addButton.className = "board-view-add-button";
  addButton.id = "boardAddViewButton";
  addButton.type = "button";
  addButton.setAttribute("aria-label", "Add view");
  addButton.textContent = "+";
  boardViewSwitcher.insertBefore(addButton, searchControl);

  const addMenu = document.createElement("div");
  addMenu.className = "board-add-view-menu";
  addMenu.id = "boardAddViewMenu";
  addMenu.hidden = true;
  addMenu.replaceChildren(
    ...addableBoardViewTypes.map((type) => {
      const option = document.createElement("button");
      option.className = "board-add-view-option";
      option.type = "button";
      option.dataset.addBoardViewType = type;
      option.textContent = getBoardViewTypeLabel(type);
      return option;
    }),
  );
  boardViewSwitcher.insertBefore(addMenu, searchControl);

  const viewMenu = createBoardViewMenu();
  boardViewSwitcher.insertBefore(viewMenu, searchControl);

  if (settingsControl) {
    settingsControl.hidden = true;
  }

  boardViewSwitcher.querySelectorAll(".board-view-option").forEach((button) => {
    const isActive = button.dataset.boardViewId === getActiveBoardViewId();
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  renderBoardColumnMenu();
}

function handleBoardViewPointerDragStart(event) {
  const button = event.target.closest(".board-view-option");
  if (
    !button ||
    button.dataset.boardViewType === "overview" ||
    event.target.closest(".board-view-menu-popover, .board-add-view-menu, .board-view-search") ||
    boardViewPointerDragState
  ) {
    return;
  }

  const sourceRect = button.getBoundingClientRect();
  boardViewPointerDragState = {
    viewId: button.dataset.boardViewId,
    startX: event.clientX,
    startY: event.clientY,
    dragOffsetX: event.clientX - sourceRect.left,
    dragOffsetY: event.clientY - sourceRect.top,
    sourceButton: button,
    targetButton: button,
    isDragging: false,
  };
  try {
    button.setPointerCapture?.(event.pointerId);
  } catch (error) {
    // Synthetic pointer events used in tests do not always create an active pointer.
  }
}

function handleBoardViewPointerDragMove(event) {
  if (!boardViewPointerDragState) {
    return;
  }

  const dragDistance = Math.hypot(
    event.clientX - boardViewPointerDragState.startX,
    event.clientY - boardViewPointerDragState.startY,
  );
  if (!boardViewPointerDragState.isDragging && dragDistance < 4) {
    return;
  }

  event.preventDefault();
  const startsDragging = !boardViewPointerDragState.isDragging;
  boardViewPointerDragState.isDragging = true;
  boardViewPointerDragState.sourceButton.classList.add("is-board-view-drag-source");
  closeAddBoardViewMenu();
  closeBoardViewMenu();
  if (startsDragging) {
    createBoardViewDragImage(boardViewPointerDragState.sourceButton, event);
  } else {
    moveBoardViewDragImage(event);
  }

  const targetButton = document.elementFromPoint(event.clientX, event.clientY)?.closest(".board-view-option");
  if (!targetButton || !boardViewSwitcher.contains(targetButton) || targetButton.dataset.boardViewType === "overview") {
    return;
  }

  boardViewPointerDragState.targetButton = targetButton;
  applyBoardViewOrderPreview(getBoardViewPreviewOrder(event, targetButton));
}

function handleBoardViewPointerDragEnd(event) {
  if (!boardViewPointerDragState) {
    return;
  }

  const { isDragging, targetButton } = boardViewPointerDragState;
  if (!isDragging || !targetButton) {
    boardViewPointerDragState = null;
    clearBoardViewDragState();
    removeBoardViewDragImage();
    return;
  }

  event.preventDefault();
  suppressNextBoardViewClick();
  const boardViewIds = getBoardViewPreviewOrder(event, targetButton);
  saveBoardViewOrder(boardViewIds);
  boardViewPointerDragState = null;
  clearBoardViewDragState();
  removeBoardViewDragImage();
  renderBoardViewSwitcher();
}

function suppressNextBoardViewClick() {
  boardViewSuppressClick = true;
  window.clearTimeout(boardViewSuppressClickTimer);
  boardViewSuppressClickTimer = window.setTimeout(() => {
    boardViewSuppressClick = false;
    boardViewSuppressClickTimer = null;
  }, 0);
}

function createBoardViewDragImage(sourceButton, event) {
  removeBoardViewDragImage();
  const sourceRect = sourceButton.getBoundingClientRect();
  const dragImage = sourceButton.cloneNode(true);
  dragImage.className = `${sourceButton.className} board-view-drag-image`;
  dragImage.classList.remove(
    "is-board-view-drag-source",
    "is-board-view-preview-left",
    "is-board-view-preview-right",
  );
  dragImage.style.width = `${sourceRect.width}px`;
  dragImage.style.height = `${sourceRect.height}px`;
  document.body.append(dragImage);
  boardViewDragImage = dragImage;
  moveBoardViewDragImage(event);
}

function moveBoardViewDragImage(event) {
  if (!boardViewDragImage) {
    return;
  }

  const offsetX = boardViewPointerDragState?.dragOffsetX ?? 0;
  const offsetY = boardViewPointerDragState?.dragOffsetY ?? 0;
  boardViewDragImage.style.transform = `translate(${event.clientX - offsetX}px, ${event.clientY - offsetY}px)`;
}

function removeBoardViewDragImage() {
  boardViewDragImage?.remove();
  boardViewDragImage = null;
}

function getBoardViewPreviewOrder(event, targetButton) {
  const viewIds = getActiveBoardViews().map((view) => view.id);
  const movedViewId = boardViewPointerDragState?.viewId;
  const targetViewId = targetButton.dataset.boardViewId;
  const targetView = getBoardViewById(targetViewId);
  if (!movedViewId || !targetViewId || movedViewId === targetViewId || targetView?.type === "overview") {
    return viewIds;
  }

  const draggedIndex = viewIds.indexOf(movedViewId);
  const targetIndex = viewIds.indexOf(targetViewId);
  const targetRect = targetButton.getBoundingClientRect();
  if (draggedIndex < 0 || targetIndex < 0) {
    return viewIds;
  }

  const insertAfterTarget =
    draggedIndex < targetIndex
      ? event.clientX > targetRect.left + targetRect.width * 0.25
      : event.clientX > targetRect.right - targetRect.width * 0.25;

  const reorderedIds = moveStatusNearTarget(viewIds, movedViewId, targetViewId, insertAfterTarget);
  const overviewId = getActiveBoardViews().find((view) => view.type === "overview")?.id;
  if (!overviewId) {
    return reorderedIds;
  }

  return [overviewId, ...reorderedIds.filter((viewId) => viewId !== overviewId)];
}

function applyBoardViewOrderPreview(previewViewIds) {
  const buttons = [...boardViewSwitcher.querySelectorAll(".board-view-option")];
  const switcherGap = Number.parseFloat(getComputedStyle(boardViewSwitcher).columnGap) || 0;
  buttons.forEach((button, currentIndex) => {
    const previewIndex = previewViewIds.indexOf(button.dataset.boardViewId);
    const shiftDistance = `${button.getBoundingClientRect().width + switcherGap}px`;
    button.classList.remove("is-board-view-preview-left", "is-board-view-preview-right");
    button.style.setProperty("--board-view-shift", shiftDistance);

    if (button.dataset.boardViewId === boardViewPointerDragState?.viewId) {
      button.classList.add("is-board-view-drag-source");
      return;
    }

    if (button.dataset.boardViewType === "overview" || previewIndex < 0) {
      return;
    }

    if (previewIndex < currentIndex) {
      button.classList.add("is-board-view-preview-left");
    } else if (previewIndex > currentIndex) {
      button.classList.add("is-board-view-preview-right");
    }
  });
}

function clearBoardViewDragState() {
  boardViewSwitcher.querySelectorAll(".board-view-option").forEach((button) => {
    button.classList.remove(
      "is-board-view-drag-source",
      "is-board-view-preview-left",
      "is-board-view-preview-right",
    );
    button.style.removeProperty("--board-view-shift");
  });
}

function saveBoardViewOrder(viewIds) {
  workspaces = workspaces.map((workspace) => {
    if (workspace.id !== activeWorkspaceId) {
      return workspace;
    }

    const views = normalizeBoardViews(workspace);
    const viewById = new Map(views.map((view) => [view.id, view]));
    const overview = views.find((view) => view.type === "overview");
    const orderedViews = viewIds.map((viewId) => viewById.get(viewId)).filter(Boolean);
    const missingViews = views.filter((view) => !viewIds.includes(view.id));
    const nextViews = [...orderedViews, ...missingViews];

    return {
      ...workspace,
      boardViews: overview ? [overview, ...nextViews.filter((view) => view.id !== overview.id)] : nextViews,
    };
  });
  saveWorkspaceState();
}

function createBoardViewMenu() {
  const activeViewConfig = getActiveBoardViewConfig();
  const canDuplicate = activeViewConfig?.type !== "overview";
  const canDelete = activeViewConfig?.type !== "overview" && getActiveBoardViews().length > 1;
  const menu = document.createElement("div");
  menu.className = "board-view-menu-popover";
  menu.id = "boardViewMenu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  menu.append(
    createBoardViewMenuAction("rename", "Rename", createMenuIcon("rename"), true),
    createBoardViewMenuAction("duplicate", "Duplicate view", createMenuIcon("duplicate"), canDuplicate),
    createBoardViewMenuAction("delete", "Delete view", createMenuIcon("delete"), canDelete),
    createBoardViewMenuSeparator(),
    ...(activeViewConfig?.type === "table" ? [createTablePropertyMenuSection(), createBoardViewMenuSeparator()] : []),
    createBoardViewMenuStatusSection(),
  );

  return menu;
}

function createTablePropertyMenuSection() {
  const section = document.createElement("div");
  section.className = "table-property-menu-section";

  const title = document.createElement("div");
  title.className = "table-property-menu-section-title board-column-menu-section-title";
  title.textContent = "Property visibility in table";

  const list = document.createElement("div");
  list.className = "table-property-menu-list";
  list.id = "tablePropertyMenuList";

  section.append(title, list);
  renderTablePropertyMenu(list);

  return section;
}

function renderTablePropertyMenu(list = boardViewSwitcher.querySelector("#tablePropertyMenuList")) {
  if (!list) {
    return;
  }

  const hiddenColumns = new Set(getActiveTableHiddenColumns());
  list.replaceChildren(
    ...getActiveTableColumnOrder().map((columnId) =>
      createTablePropertyMenuItem(columnId, hiddenColumns.has(columnId)),
    ),
  );
}

function createTablePropertyMenuItem(columnId, hidden) {
  const item = document.createElement("div");
  item.className = "table-property-menu-item";
  item.dataset.tableColumn = columnId;
  item.setAttribute("role", "menuitem");

  const label = document.createElement("span");
  label.className = "board-column-menu-status-label";
  label.textContent = getTableColumnLabel(columnId);

  item.append(createTableStatusDragHandle(), label);

  if (columnId === "name") {
    const spacer = document.createElement("span");
    spacer.setAttribute("aria-hidden", "true");
    item.append(spacer);
    return item;
  }

  const button = document.createElement("button");
  button.className = "table-property-visibility";
  button.type = "button";
  button.dataset.tableColumn = columnId;
  button.setAttribute("aria-label", hidden ? `Show ${getTableColumnLabel(columnId)} property` : `Hide ${getTableColumnLabel(columnId)} property`);
  button.setAttribute("aria-pressed", String(hidden));
  button.append(createEyeIcon(hidden));
  item.append(button);

  return item;
}

function createBoardViewMenuAction(action, label, icon, enabled) {
  const button = document.createElement("button");
  button.className = "board-view-menu-action";
  button.type = "button";
  button.dataset.boardViewAction = action;
  button.disabled = !enabled;
  button.append(icon, document.createTextNode(label));

  return button;
}

function createBoardViewMenuSeparator() {
  const separator = document.createElement("div");
  separator.className = "board-view-menu-separator";
  separator.setAttribute("role", "separator");

  return separator;
}

function createBoardViewMenuStatusSection() {
  const section = document.createElement("div");
  section.className = "board-view-menu-status-section";

  const title = document.createElement("div");
  title.className = "board-column-menu-section-title";
  title.textContent = "Status";

  const list = document.createElement("div");
  list.className = "board-column-menu-status-list";
  list.id = "boardViewMenuStatuses";

  section.append(title, list);

  return section;
}

function createMenuIcon(type) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("view-menu-icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");

  const paths = {
    rename: ["M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z", "M13.5 6.5l4 4"],
    duplicate: ["M8 8h10v10H8z", "M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"],
    delete: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 14h10l1-14", "M9 7V4h6v3"],
    wrap: ["M4 7h16", "M4 12h10", "M4 17h12", "M16 12h2a2 2 0 0 1 0 4h-2", "M17 14l-2 2 2 2"],
  };

  (paths[type] || []).forEach((pathData) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    icon.append(path);
  });

  return icon;
}

function getBoardViewTypeLabel(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function toggleAddBoardViewMenu() {
  const menu = boardViewSwitcher.querySelector("#boardAddViewMenu");
  if (!menu) {
    return;
  }

  closeBoardViewMenu();
  const shouldOpen = menu.hidden;
  menu.hidden = !shouldOpen;
  if (shouldOpen) {
    const button = boardViewSwitcher.querySelector("#boardAddViewButton");
    if (button) {
      positionBoardViewMenu(button, menu);
    }
  }
}

function closeAddBoardViewMenu() {
  const menu = boardViewSwitcher.querySelector("#boardAddViewMenu");
  if (menu) {
    menu.hidden = true;
  }
}

function addBoardView(type) {
  if (!addableBoardViewTypes.includes(type)) {
    return;
  }

  const view = createBoardViewConfig(type, createBoardViewId(), getNextBoardViewName(type));
  workspaces = workspaces.map((workspace) =>
    workspace.id === activeWorkspaceId
      ? {
          ...workspace,
          boardView: view.id,
          boardViews: [...getActiveBoardViews(), view],
        }
      : workspace,
  );
  boardView = view.id;
  saveWorkspaceState();
  renderBoardViewSwitcher();
  renderFolders();
}

function createBoardViewId() {
  let index = 1;
  let viewId = `view-${index}`;
  const existingIds = new Set(getActiveBoardViews().map((view) => view.id));
  while (existingIds.has(viewId)) {
    index += 1;
    viewId = `view-${index}`;
  }

  return viewId;
}

function getNextBoardViewName(type) {
  const baseName = getBoardViewTypeLabel(type);
  const names = new Set(getActiveBoardViews().map((view) => view.name));
  if (!names.has(baseName)) {
    return baseName;
  }

  let index = 2;
  while (names.has(`${baseName} ${index}`)) {
    index += 1;
  }

  return `${baseName} ${index}`;
}

function toggleBoardViewMenu(button) {
  const menu = boardViewSwitcher.querySelector("#boardViewMenu");
  if (!menu) {
    return;
  }

  closeAddBoardViewMenu();
  const shouldOpen = menu.hidden;
  menu.hidden = !shouldOpen;
  if (shouldOpen) {
    renderBoardColumnMenu();
    positionBoardViewMenu(button, menu);
  }
}

function closeBoardViewMenu() {
  const menu = boardViewSwitcher.querySelector("#boardViewMenu");
  if (menu) {
    menu.hidden = true;
  }
}

function positionBoardViewMenu(button, menu) {
  const switcherRect = boardViewSwitcher.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  menu.style.left = `${Math.max(0, buttonRect.left - switcherRect.left)}px`;
  menu.style.top = `${buttonRect.bottom - switcherRect.top + 6}px`;
}

function handleBoardViewMenuAction(action) {
  if (action === "rename") {
    renameActiveBoardView();
    return;
  }

  if (action === "duplicate") {
    duplicateActiveBoardView();
    return;
  }

  if (action === "delete") {
    deleteActiveBoardView();
  }
}

function renameActiveBoardView() {
  const activeViewConfig = getActiveBoardViewConfig();
  if (!activeViewConfig) {
    return;
  }

  const nextName = window.prompt("Rename view", activeViewConfig.name)?.trim();
  if (!nextName) {
    return;
  }

  updateActiveBoardViewConfig((view) => ({ ...view, name: nextName }));
  renderBoardViewSwitcher();
  renderFolders();
}

function duplicateActiveBoardView() {
  const activeViewConfig = getActiveBoardViewConfig();
  if (!activeViewConfig || activeViewConfig.type === "overview") {
    return;
  }

  const duplicatedView = {
    ...structuredCloneBoardView(activeViewConfig),
    id: createBoardViewId(),
    name: getDuplicateBoardViewName(activeViewConfig.name),
  };
  workspaces = workspaces.map((workspace) =>
    workspace.id === activeWorkspaceId
      ? {
          ...workspace,
          boardView: duplicatedView.id,
          boardViews: [...getActiveBoardViews(), duplicatedView],
        }
      : workspace,
  );
  boardView = duplicatedView.id;
  saveWorkspaceState();
  renderBoardViewSwitcher();
  renderFolders();
}

function deleteActiveBoardView() {
  const activeViewConfig = getActiveBoardViewConfig();
  if (!activeViewConfig || activeViewConfig.type === "overview" || getActiveBoardViews().length <= 1) {
    return;
  }

  const nextViews = getActiveBoardViews().filter((view) => view.id !== activeViewConfig.id);
  const nextActiveView = nextViews[0];
  workspaces = workspaces.map((workspace) =>
    workspace.id === activeWorkspaceId
      ? {
          ...workspace,
          boardView: nextActiveView.id,
          boardViews: nextViews,
        }
      : workspace,
  );
  boardView = nextActiveView.id;
  saveWorkspaceState();
  renderBoardViewSwitcher();
  renderFolders();
}

function structuredCloneBoardView(view) {
  return {
    ...view,
    statusOrder: [...view.statusOrder],
    hiddenStatuses: [...view.hiddenStatuses],
    scrollPosition: { ...view.scrollPosition },
    tableColumnOrder: [...view.tableColumnOrder],
    tableHiddenColumns: [...view.tableHiddenColumns],
    tableColumnLabels: { ...view.tableColumnLabels },
    tableWrappedColumns: [...view.tableWrappedColumns],
    tableColumnWidthVersion: view.tableColumnWidthVersion,
    tableColumnWidths: { ...view.tableColumnWidths },
  };
}

function getDuplicateBoardViewName(name) {
  const baseName = `${name} copy`;
  const names = new Set(getActiveBoardViews().map((view) => view.name));
  if (!names.has(baseName)) {
    return baseName;
  }

  let index = 2;
  while (names.has(`${baseName} ${index}`)) {
    index += 1;
  }

  return `${baseName} ${index}`;
}

function renderBoardColumnMenu() {
  const visibleFolders = filterFolders(folders, searchInput.value);
  const statuses = getOrderedStatuses(visibleFolders);
  const hiddenStatuses = new Set(getActiveHiddenStatuses());
  const statusList = getBoardColumnMenuStatusList();
  if (!statusList) {
    return;
  }

  statusList.replaceChildren(
    ...statuses.map((status) => createBoardColumnMenuStatusItem(status, hiddenStatuses.has(status))),
  );
  renderTablePropertyMenu();
}

function getBoardColumnMenuStatusList() {
  return boardViewSwitcher.querySelector("#boardViewMenuStatuses") || boardColumnMenuStatuses;
}

function getActiveBoardColumnMenu() {
  return boardViewSwitcher.querySelector("#boardViewMenu") || boardColumnMenuPopover;
}

function createBoardColumnMenuStatusItem(status, hidden) {
  const item = document.createElement("div");
  item.className = "board-column-menu-status-item";
  item.dataset.status = status;
  item.setAttribute("role", "menuitem");

  const label = document.createElement("span");
  label.className = "board-column-menu-status-label";
  label.textContent = status;

  const button = document.createElement("button");
  button.className = "board-column-menu-status-visibility";
  button.type = "button";
  button.dataset.status = status;
  button.setAttribute("aria-label", hidden ? `Show ${status} column` : `Hide ${status} column`);
  button.setAttribute("aria-pressed", String(hidden));
  button.append(createEyeIcon(hidden));

  item.append(createTableStatusDragHandle(), label, button);

  return item;
}

function handleBoardColumnMenuToggle(event) {
  event.stopPropagation();
  setBoardColumnMenuOpen(boardColumnMenuPopover.hidden);
}

function handleBoardColumnMenuClick(event) {
  if (boardColumnMenuSuppressClick) {
    boardColumnMenuSuppressClick = false;
    window.clearTimeout(boardColumnMenuSuppressClickTimer);
    boardColumnMenuSuppressClickTimer = null;
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const button = event.target.closest(".board-column-menu-status-visibility");
  if (!button) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  toggleStatusVisibility(button.dataset.status);
  renderBoardColumnMenu();
}

function handleTablePropertyMenuClick(event) {
  const button = event.target.closest(".table-property-visibility");
  if (!button) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  toggleTableColumnVisibility(button.dataset.tableColumn);
  renderTablePropertyMenu();
}

function handleBoardColumnMenuPointerDragStart(event) {
  if (event.target.closest(".board-column-menu-status-visibility, .table-property-visibility")) {
    return;
  }

  const item = event.target.closest(".board-column-menu-status-item, .table-property-menu-item");
  if (!item) {
    return;
  }
  const isPropertyItem = item.classList.contains("table-property-menu-item");

  const sourceRect = item.getBoundingClientRect();
  boardColumnMenuPointerDragState = {
    type: isPropertyItem ? "property" : "status",
    status: item.dataset.status,
    property: item.dataset.tableColumn,
    startX: event.clientX,
    startY: event.clientY,
    dragOffsetX: event.clientX - sourceRect.left,
    dragOffsetY: event.clientY - sourceRect.top,
    sourceItem: item,
    targetItem: item,
    isDragging: false,
  };
  draggedBoardColumnMenuStatus = isPropertyItem ? null : item.dataset.status;
  draggedBoardColumnMenuProperty = isPropertyItem ? item.dataset.tableColumn : null;
  try {
    item.setPointerCapture?.(event.pointerId);
  } catch (error) {
    // Synthetic pointer events used in tests do not always create an active pointer.
  }
}

function handleBoardColumnMenuPointerDragMove(event) {
  if (!boardColumnMenuPointerDragState) {
    return;
  }

  const dragDistance = Math.hypot(
    event.clientX - boardColumnMenuPointerDragState.startX,
    event.clientY - boardColumnMenuPointerDragState.startY,
  );
  if (!boardColumnMenuPointerDragState.isDragging && dragDistance < 4) {
    return;
  }

  event.preventDefault();
  const startsDragging = !boardColumnMenuPointerDragState.isDragging;
  boardColumnMenuPointerDragState.isDragging = true;
  boardColumnMenuPointerDragState.sourceItem.classList.add("is-board-column-menu-drag-source");
  if (startsDragging) {
    createBoardColumnMenuDragImage(boardColumnMenuPointerDragState.sourceItem, event);
  } else {
    moveBoardColumnMenuDragImage(event);
  }

  const targetSelector =
    boardColumnMenuPointerDragState.type === "property" ? ".table-property-menu-item" : ".board-column-menu-status-item";
  const targetItem = document.elementFromPoint(event.clientX, event.clientY)?.closest(targetSelector);
  const menu = boardColumnMenuPointerDragState.sourceItem.closest(".board-view-menu-popover, .board-column-menu-popover");
  if (!targetItem || !menu?.contains(targetItem)) {
    return;
  }

  boardColumnMenuPointerDragState.targetItem = targetItem;
  applyBoardColumnMenuPreview(getBoardColumnMenuPreviewOrder(event, targetItem));
}

function handleBoardColumnMenuPointerDragEnd(event) {
  if (!boardColumnMenuPointerDragState) {
    return;
  }

  const { isDragging, targetItem } = boardColumnMenuPointerDragState;
  if (!isDragging || !targetItem) {
    boardColumnMenuPointerDragState = null;
    draggedBoardColumnMenuStatus = null;
    draggedBoardColumnMenuProperty = null;
    clearBoardColumnMenuDragState();
    removeBoardColumnMenuDragImage();
    return;
  }

  event.preventDefault();
  suppressNextBoardColumnMenuClick();
  const reorderedItems = getBoardColumnMenuPreviewOrder(event, targetItem);
  if (boardColumnMenuPointerDragState.type === "property") {
    saveTableColumnOrder(reorderedItems);
    renderTablePropertyMenu();
  } else {
    const reorderedStatuses = reorderedItems;
    saveStatusOrder(reorderedStatuses);
  }
  boardColumnMenuPointerDragState = null;
  draggedBoardColumnMenuStatus = null;
  draggedBoardColumnMenuProperty = null;
  clearBoardColumnMenuDragState();
  removeBoardColumnMenuDragImage();
  renderFolders();
}

function suppressNextBoardColumnMenuClick() {
  boardColumnMenuSuppressClick = true;
  window.clearTimeout(boardColumnMenuSuppressClickTimer);
  boardColumnMenuSuppressClickTimer = window.setTimeout(() => {
    boardColumnMenuSuppressClick = false;
    boardColumnMenuSuppressClickTimer = null;
  }, 0);
}

function createBoardColumnMenuDragImage(sourceItem, event) {
  removeBoardColumnMenuDragImage();
  const sourceRect = sourceItem.getBoundingClientRect();
  const dragImage = sourceItem.cloneNode(true);
  dragImage.className = "board-column-menu-drag-image";
  dragImage.style.width = `${sourceRect.width}px`;
  dragImage.style.height = `${sourceRect.height}px`;
  document.body.append(dragImage);
  boardColumnMenuDragImage = dragImage;
  moveBoardColumnMenuDragImage(event);
}

function moveBoardColumnMenuDragImage(event) {
  if (!boardColumnMenuDragImage) {
    return;
  }

  const offsetX = boardColumnMenuPointerDragState?.dragOffsetX ?? 0;
  const offsetY = boardColumnMenuPointerDragState?.dragOffsetY ?? 0;
  boardColumnMenuDragImage.style.transform = `translate(${event.clientX - offsetX}px, ${event.clientY - offsetY}px)`;
}

function removeBoardColumnMenuDragImage() {
  boardColumnMenuDragImage?.remove();
  boardColumnMenuDragImage = null;
}

function getBoardColumnMenuPreviewOrder(event, targetItem) {
  if (boardColumnMenuPointerDragState?.type === "property") {
    return getTablePropertyMenuPreviewOrder(event, targetItem);
  }

  const visibleFolders = filterFolders(folders, searchInput.value);
  const statusOrder = getOrderedStatuses(visibleFolders);
  const targetStatus = targetItem.dataset.status;
  if (!draggedBoardColumnMenuStatus || !targetStatus || targetStatus === draggedBoardColumnMenuStatus) {
    return statusOrder;
  }

  const draggedIndex = statusOrder.indexOf(draggedBoardColumnMenuStatus);
  const targetIndex = statusOrder.indexOf(targetStatus);
  const targetRect = targetItem.getBoundingClientRect();
  if (draggedIndex < 0 || targetIndex < 0) {
    return statusOrder;
  }

  const insertAfterTarget =
    draggedIndex < targetIndex
      ? event.clientY > targetRect.top + targetRect.height * 0.25
      : event.clientY > targetRect.bottom - targetRect.height * 0.25;

  return moveStatusNearTarget(statusOrder, draggedBoardColumnMenuStatus, targetStatus, insertAfterTarget);
}

function getTablePropertyMenuPreviewOrder(event, targetItem) {
  const columnOrder = getActiveVisibleTableColumnOrder();
  const targetColumn = targetItem.dataset.tableColumn;
  if (!draggedBoardColumnMenuProperty || !targetColumn || targetColumn === draggedBoardColumnMenuProperty) {
    return columnOrder;
  }

  const draggedIndex = columnOrder.indexOf(draggedBoardColumnMenuProperty);
  const targetIndex = columnOrder.indexOf(targetColumn);
  const targetRect = targetItem.getBoundingClientRect();
  if (draggedIndex < 0 || targetIndex < 0) {
    return columnOrder;
  }

  const insertAfterTarget =
    draggedIndex < targetIndex
      ? event.clientY > targetRect.top + targetRect.height * 0.25
      : event.clientY > targetRect.bottom - targetRect.height * 0.25;

  return moveStatusNearTarget(columnOrder, draggedBoardColumnMenuProperty, targetColumn, insertAfterTarget);
}

function applyBoardColumnMenuPreview(previewStatuses) {
  const menu = getActiveBoardColumnMenu();
  const isPropertyDrag = boardColumnMenuPointerDragState?.type === "property";
  const list = isPropertyDrag ? menu?.querySelector("#tablePropertyMenuList") : getBoardColumnMenuStatusList();
  const itemSelector = isPropertyDrag ? ".table-property-menu-item" : ".board-column-menu-status-item";
  const items = [...(menu?.querySelectorAll(itemSelector) || [])];
  const menuGap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
  items.forEach((item, currentIndex) => {
    const itemId = isPropertyDrag ? item.dataset.tableColumn : item.dataset.status;
    const previewIndex = previewStatuses.indexOf(itemId);
    const shiftDistance = `${item.getBoundingClientRect().height + menuGap}px`;
    item.classList.remove("is-board-column-menu-preview-up", "is-board-column-menu-preview-down");
    item.style.setProperty("--board-column-menu-status-shift", shiftDistance);

    if (itemId === (isPropertyDrag ? draggedBoardColumnMenuProperty : draggedBoardColumnMenuStatus)) {
      item.classList.add("is-board-column-menu-drag-source");
      return;
    }

    if (previewIndex < 0) {
      return;
    }

    if (previewIndex < currentIndex) {
      item.classList.add("is-board-column-menu-preview-up");
    } else if (previewIndex > currentIndex) {
      item.classList.add("is-board-column-menu-preview-down");
    }
  });
}

function clearBoardColumnMenuDragState() {
  getActiveBoardColumnMenu()?.querySelectorAll(".board-column-menu-status-item, .table-property-menu-item").forEach((item) => {
    item.classList.remove(
      "is-board-column-menu-drag-source",
      "is-board-column-menu-preview-up",
      "is-board-column-menu-preview-down",
    );
    item.style.removeProperty("--board-column-menu-status-shift");
  });
}

function handleBoardColumnMenuOutsideClick(event) {
  if (event.target.closest("#boardViewSwitcher")) {
    return;
  }

  setBoardColumnMenuOpen(false);
  closeAddBoardViewMenu();
  closeBoardViewMenu();
}

function handleBoardColumnMenuKeydown(event) {
  if (event.key === "Escape") {
    setBoardColumnMenuOpen(false);
    closeAddBoardViewMenu();
    closeBoardViewMenu();
  }
}

function setBoardColumnMenuOpen(open) {
  if (open) {
    renderBoardColumnMenu();
  }

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
    boardViews: createDefaultBoardViews(),
    cardPlaceWidth: normalizeCardPlaceWidth(),
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

  saveBoardViewScrollPosition();
  activeWorkspaceId = workspaceId;
  boardView = loadBoardView();
  selectedCardPath = null;
  renderCardPlacePanel();
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

function createDefaultBoardViews(legacyWorkspace = {}) {
  const viewScrollPositions = normalizeViewScrollPositions(legacyWorkspace.viewScrollPositions);
  const baseViewSettings = {
    statusOrder: legacyWorkspace.statusOrder,
    hiddenStatuses: legacyWorkspace.hiddenStatuses,
    showHiddenStatuses: legacyWorkspace.showHiddenStatuses,
  };

  return boardViewIds.map((type) =>
    createBoardViewConfig(type, type, getBoardViewTypeLabel(type), {
      ...baseViewSettings,
      scrollPosition: viewScrollPositions[type],
      tableColumnOrder: legacyWorkspace.tableColumnOrder,
      tableHiddenColumns: legacyWorkspace.tableHiddenColumns,
      tableColumnLabels: legacyWorkspace.tableColumnLabels,
      tableWrappedColumns: legacyWorkspace.tableWrappedColumns,
      tableColumnWidths: normalizeTableColumnWidths(legacyWorkspace.tableColumnWidths, legacyWorkspace.tableNameWidth),
    }),
  );
}

function createBoardViewConfig(type, id = type, name = getBoardViewTypeLabel(type), settings = {}) {
  const normalizedType = normalizeBoardView(type);

  return {
    id: typeof id === "string" && id.trim() ? id : createBoardViewId(),
    type: normalizedType,
    name: typeof name === "string" && name.trim() ? name.trim() : getBoardViewTypeLabel(normalizedType),
    statusOrder: normalizeStatusList(settings.statusOrder),
    hiddenStatuses: normalizeStatusList(settings.hiddenStatuses),
    showHiddenStatuses: settings.showHiddenStatuses === true,
    scrollPosition: normalizeScrollPosition(settings.scrollPosition),
    tableColumnOrder: normalizeTableColumnOrder(settings.tableColumnOrder),
    tableHiddenColumns: normalizeTableHiddenColumns(settings.tableHiddenColumns),
    tableColumnLabels: normalizeTableColumnLabels(settings.tableColumnLabels),
    tableWrappedColumns: normalizeTableWrappedColumns(settings.tableWrappedColumns),
    tableColumnWidthVersion,
    tableColumnWidths: normalizeBoardViewTableColumnWidths(settings),
  };
}

function normalizeBoardViews(workspace) {
  const sourceViews = Array.isArray(workspace?.boardViews) ? workspace.boardViews : null;
  const normalizedViews = [];
  const usedIds = new Set();

  if (sourceViews) {
    sourceViews.forEach((view) => {
      const normalizedView = normalizeBoardViewConfig(view);
      if (usedIds.has(normalizedView.id)) {
        normalizedView.id = createUniqueBoardViewId(usedIds);
      }
      usedIds.add(normalizedView.id);
      normalizedViews.push(normalizedView);
    });
  } else {
    createDefaultBoardViews(workspace).forEach((view) => {
      usedIds.add(view.id);
      normalizedViews.push(view);
    });
  }

  if (!normalizedViews.some((view) => view.type === "overview")) {
    const overviewView = createBoardViewConfig("overview", "overview", "Overview", workspace);
    overviewView.id = usedIds.has(overviewView.id) ? createUniqueBoardViewId(usedIds) : overviewView.id;
    normalizedViews.unshift(overviewView);
  }

  return normalizedViews;
}

function normalizeBoardViewConfig(view) {
  const fallbackType = normalizeBoardView(view?.type || view?.id);

  return createBoardViewConfig(fallbackType, view?.id || fallbackType, view?.name || getBoardViewTypeLabel(fallbackType), view);
}

function createUniqueBoardViewId(usedIds) {
  let index = 1;
  let viewId = `view-${index}`;
  while (usedIds.has(viewId)) {
    index += 1;
    viewId = `view-${index}`;
  }

  return viewId;
}

function getActiveBoardViews() {
  return normalizeBoardViews(getActiveWorkspace());
}

function getActiveBoardViewConfig() {
  return getBoardViewById(getActiveBoardViewId()) || getActiveBoardViews()[0];
}

function getActiveBoardViewId() {
  const workspace = getActiveWorkspace();
  const views = normalizeBoardViews(workspace);

  return normalizeActiveBoardViewId(boardView || workspace?.boardView, views);
}

function getBoardViewById(viewId) {
  return getActiveBoardViews().find((view) => view.id === viewId);
}

function getActiveBoardView() {
  return getActiveBoardViewConfig()?.type || "overview";
}

function getActiveStatusOrder() {
  const statusOrder = getActiveBoardViewConfig()?.statusOrder;

  return Array.isArray(statusOrder) ? statusOrder.filter((status) => typeof status === "string") : [];
}

function getActiveHiddenStatuses() {
  const hiddenStatuses = getActiveBoardViewConfig()?.hiddenStatuses;

  return Array.isArray(hiddenStatuses) ? hiddenStatuses.filter((status) => typeof status === "string") : [];
}

function getActiveShowHiddenStatuses() {
  return getActiveBoardViewConfig()?.showHiddenStatuses === true;
}

function getActiveTableColumnOrder() {
  return normalizeTableColumnOrder(getActiveBoardViewConfig()?.tableColumnOrder);
}

function getActiveVisibleTableColumnOrder() {
  const hiddenColumns = new Set(getActiveTableHiddenColumns());
  const visibleColumns = getActiveTableColumnOrder().filter((columnId) => !hiddenColumns.has(columnId));

  return visibleColumns.length > 0 ? visibleColumns : ["name"];
}

function getActiveTableHiddenColumns() {
  return normalizeTableHiddenColumns(getActiveBoardViewConfig()?.tableHiddenColumns);
}

function getActiveTableColumnLabels() {
  return normalizeTableColumnLabels(getActiveBoardViewConfig()?.tableColumnLabels);
}

function getTableColumnLabel(columnId) {
  return getActiveTableColumnLabels()[columnId] || tableColumnLabels[columnId] || columnId;
}

function getTextPropertyLabel() {
  return getTableColumnLabel("text");
}

function getActiveTableWrappedColumns() {
  return normalizeTableWrappedColumns(getActiveBoardViewConfig()?.tableWrappedColumns);
}

function isTableTextWrapped() {
  return getActiveTableWrappedColumns().includes("text");
}

function getActiveTableNameWidth() {
  return getActiveTableColumnWidths().name;
}

function getActiveTableColumnWidths() {
  const activeViewConfig = getActiveBoardViewConfig();

  return normalizeTableColumnWidths(activeViewConfig?.tableColumnWidths, activeViewConfig?.tableNameWidth);
}

function normalizeBoardView(boardView) {
  return boardViews.has(boardView) ? boardView : "overview";
}

function normalizeActiveBoardViewId(viewId, views = getActiveBoardViews()) {
  if (views.some((view) => view.id === viewId)) {
    return viewId;
  }

  const legacyTypeMatch = views.find((view) => view.type === viewId);
  if (legacyTypeMatch) {
    return legacyTypeMatch.id;
  }

  return views.find((view) => view.type === "overview")?.id || views[0]?.id || "overview";
}

function normalizeStatusList(statuses) {
  return Array.isArray(statuses) ? statuses.filter((status) => typeof status === "string") : [];
}

function normalizeCardPlaceWidth(width) {
  const parsedWidth = Number(width);
  const fallbackWidth = Math.round(window.innerWidth / 2);
  const maxWidth = Math.max(minCardPlaceWidth, Math.round(window.innerWidth * maxCardPlaceWidthRatio));
  const nextWidth = Number.isFinite(parsedWidth) ? parsedWidth : fallbackWidth;

  return Math.min(maxWidth, Math.max(minCardPlaceWidth, Math.round(nextWidth)));
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

function normalizeTableHiddenColumns(hiddenColumns) {
  if (!Array.isArray(hiddenColumns)) {
    return [];
  }

  return hiddenColumns.filter((columnId) => tableColumnIds.includes(columnId) && columnId !== "name");
}

function normalizeTableColumnLabels(labels) {
  const textLabel = typeof labels?.text === "string" ? labels.text.trim() : "";

  return textLabel ? { text: textLabel } : {};
}

function normalizeTableWrappedColumns(wrappedColumns) {
  if (!Array.isArray(wrappedColumns)) {
    return [];
  }

  return wrappedColumns.filter((columnId) => columnId === "text");
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

function normalizeBoardViewTableColumnWidths(settings = {}) {
  const normalizedWidths = normalizeTableColumnWidths(settings.tableColumnWidths, settings.tableNameWidth);
  if (settings.tableColumnWidthVersion !== tableColumnWidthVersion && Number(settings.tableColumnWidths?.text) === 42) {
    normalizedWidths.text = defaultTableColumnWidths.text;
  }

  return normalizedWidths;
}

function normalizeResizedTableColumnWidth(columnId, width, currentWidths) {
  const siblingWidth = getActiveVisibleTableColumnOrder()
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
      boardViews: normalizeBoardViews(workspace),
      cardPlaceWidth: normalizeCardPlaceWidth(workspace.cardPlaceWidth),
    }));
    workspaces = workspaces.map((workspace, index) => ({
      ...workspace,
      boardView: normalizeActiveBoardViewId(storedState.workspaces[index]?.boardView, workspace.boardViews),
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
  return normalizeActiveBoardViewId(getActiveWorkspace()?.boardView, getActiveBoardViews());
}

function saveBoardView() {
  workspaces = workspaces.map((workspace) =>
    workspace.id === activeWorkspaceId ? { ...workspace, boardView } : workspace,
  );
  saveWorkspaceState();
}

function saveStatusOrder(statusOrder) {
  updateActiveBoardViewConfig((view) => ({ ...view, statusOrder: normalizeStatusList(statusOrder) }));
}

function createDefaultViewScrollPositions() {
  return boardViewIds.reduce((positions, view) => {
    positions[view] = { top: 0, left: 0 };
    return positions;
  }, {});
}

function normalizeViewScrollPositions(viewScrollPositions) {
  const defaultPositions = createDefaultViewScrollPositions();
  if (!viewScrollPositions || typeof viewScrollPositions !== "object") {
    return defaultPositions;
  }

  boardViewIds.forEach((view) => {
    const position = viewScrollPositions[view];
    defaultPositions[view] = {
      top: Number.isFinite(position?.top) ? Math.max(0, position.top) : 0,
      left: Number.isFinite(position?.left) ? Math.max(0, position.left) : 0,
    };
  });

  return defaultPositions;
}

function normalizeScrollPosition(position) {
  return {
    top: Number.isFinite(position?.top) ? Math.max(0, position.top) : 0,
    left: Number.isFinite(position?.left) ? Math.max(0, position.left) : 0,
  };
}

function getActiveViewScrollPosition(viewId = getActiveBoardViewId()) {
  const view = getBoardViewById(viewId);
  return normalizeScrollPosition(view?.scrollPosition);
}

function saveBoardViewScrollPosition(viewId = getActiveBoardViewId()) {
  if (!getBoardViewById(viewId)) {
    return;
  }

  const nextPosition = {
    top: boardSurface.scrollTop,
    left: boardSurface.scrollLeft,
  };

  updateBoardViewConfig(viewId, (view) => ({ ...view, scrollPosition: nextPosition }));
}

function restoreBoardViewScrollPosition(viewId = getActiveBoardViewId()) {
  const position = getActiveViewScrollPosition(viewId);
  boardSurface.scrollTo({
    top: position.top,
    left: position.left,
    behavior: "instant",
  });
}

function saveHiddenStatuses(hiddenStatuses) {
  updateActiveBoardViewConfig((view) => ({ ...view, hiddenStatuses: normalizeStatusList(hiddenStatuses) }));
}

function setShowHiddenStatuses(showHiddenStatuses) {
  updateActiveBoardViewConfig((view) => ({ ...view, showHiddenStatuses }));
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
  updateActiveBoardViewConfig((view) => ({ ...view, tableColumnOrder: normalizeTableColumnOrder(tableColumnOrder) }));
}

function saveTableHiddenColumns(tableHiddenColumns) {
  updateActiveBoardViewConfig((view) => ({ ...view, tableHiddenColumns: normalizeTableHiddenColumns(tableHiddenColumns) }));
}

function saveTableColumnLabel(columnId, label) {
  if (columnId !== "text") {
    return;
  }

  const normalizedLabel = typeof label === "string" ? label.trim() : "";
  updateActiveBoardViewConfig((view) => ({
    ...view,
    tableColumnLabels: normalizeTableColumnLabels({
      ...view.tableColumnLabels,
      [columnId]: normalizedLabel || tableColumnLabels[columnId],
    }),
  }));
}

function saveTableWrappedColumns(tableWrappedColumns) {
  updateActiveBoardViewConfig((view) => ({
    ...view,
    tableWrappedColumns: normalizeTableWrappedColumns(tableWrappedColumns),
  }));
}

function toggleTableColumnVisibility(columnId) {
  if (!tableColumnIds.includes(columnId) || columnId === "name") {
    return;
  }

  const hiddenColumns = new Set(getActiveTableHiddenColumns());
  if (hiddenColumns.has(columnId)) {
    hiddenColumns.delete(columnId);
  } else {
    hiddenColumns.add(columnId);
  }

  saveTableHiddenColumns([...hiddenColumns]);
  renderFolders();
}

function toggleTableTextWrap() {
  const wrappedColumns = new Set(getActiveTableWrappedColumns());
  if (wrappedColumns.has("text")) {
    wrappedColumns.delete("text");
  } else {
    wrappedColumns.add("text");
  }

  saveTableWrappedColumns([...wrappedColumns]);
  refreshCurrentTableRows();
  updateTableTextMenuItems();
}

function saveTableNameWidth(tableNameWidth) {
  saveTableColumnWidth("name", tableNameWidth);
}

function saveTableColumnWidth(columnId, width) {
  if (!tableColumnIds.includes(columnId)) {
    return;
  }

  updateActiveBoardViewConfig((view) => ({
    ...view,
    tableColumnWidthVersion,
    tableColumnWidths: {
      ...normalizeTableColumnWidths(view.tableColumnWidths, view.tableNameWidth),
      [columnId]: normalizeTableColumnWidth(columnId, width),
    },
  }));
}

function updateActiveBoardViewConfig(updater) {
  updateBoardViewConfig(getActiveBoardViewId(), updater);
}

function updateBoardViewConfig(viewId, updater) {
  workspaces = workspaces.map((workspace) => {
    if (workspace.id !== activeWorkspaceId) {
      return workspace;
    }

    const boardViews = normalizeBoardViews(workspace).map((view) => (view.id === viewId ? updater(view) : view));
    return {
      ...workspace,
      boardViews,
    };
  });
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

function loadBoardSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(boardSnapshotStorageKey));
    if (!isStoredBoardSnapshot(snapshot)) {
      return;
    }

    folders = snapshot.folders.map((folder) => ({
      id: typeof folder.id === "string" ? folder.id : folder.name,
      name: folder.name,
      kind: "directory",
      status: folder.status,
      path: typeof folder.path === "string" ? folder.path : folder.name,
      text: typeof folder.text === "string" ? folder.text : "",
    }));
  } catch (error) {
    localStorage.removeItem(boardSnapshotStorageKey);
  }
}

function isStoredBoardSnapshot(snapshot) {
  return (
    snapshot &&
    typeof snapshot.rootName === "string" &&
    Array.isArray(snapshot.folders) &&
    snapshot.folders.every((folder) => typeof folder.name === "string" && typeof folder.status === "string")
  );
}

function saveFolderAccessRules() {
  localStorage.setItem(folderAccessRulesStorageKey, JSON.stringify(folderAccessRules));
  localStorage.setItem(folderAccessRulesVersionStorageKey, folderAccessRulesVersion);
}

function clearFolderAccessState() {
  folderAccessRules = {};
  searchInput.value = "";
  localStorage.removeItem(folderAccessRulesStorageKey);
  localStorage.removeItem(folderAccessRulesVersionStorageKey);
  localStorage.removeItem(boardSnapshotStorageKey);
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
  try {
    setStatus("Choosing workspace root...", "idle");
    const data = await postJson("/api/select-root", {});
    selectedRoot = data.root;
    clearFolderAccessState();
    folders = [];
    folderAccessTree = [];
    updateRoot(selectedRoot.name);
    updateActionStates();
    restoreButton.hidden = true;
    await scanSelectedFolder();
  } catch (error) {
    setStatus("Could not choose that folder. Try choosing it again.", "error");
  }
}

async function restoreAccess() {
  restoreButton.hidden = true;
  await scanSelectedFolder();
}

async function scanSelectedFolder() {
  if (!selectedRoot) {
    setStatus("Choose a folder to build the board.", "idle");
    renderFolders();
    return;
  }

  setStatus("Scanning status folders...", "idle");

  try {
    const data = await postJson("/api/scan", { rules: folderAccessRules });
    selectedRoot = data.root;
    folderAccessTree = data.tree;
    folders = data.folders;
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
  renderBoardColumnMenu();

  if (activeView === "settings") {
    selectedCardPath = null;
    renderCardPlacePanel();
    renderSettingsView();
    return;
  }

  if (!folderViews.has(activeView)) {
    selectedCardPath = null;
    renderCardPlacePanel();
    renderPlaceholder(views[activeView].emptyTitle, views[activeView].emptyDescription);
    return;
  }

  const visibleFolders = filterFolders(folders, searchInput.value);
  renderActiveBoardView(visibleFolders);
  renderCardPlacePanel();

  const hasCards = visibleFolders.length > 0;
  emptyState.hidden = hasCards;

  if (!selectedRoot) {
    emptyState.querySelector("h2").textContent = "No folder selected";
    emptyState.querySelector("p").textContent = views[activeView].emptyDescription;
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
  const activeBoardViewId = getActiveBoardViewId();
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
    restoreBoardViewScrollPosition(activeBoardViewId);
    return;
  }

  if (activeBoardView === "table") {
    renderTableView(visibleFolders);
    restoreBoardViewScrollPosition(activeBoardViewId);
    return;
  }

  renderOverviewView(visibleFolders);
  restoreBoardViewScrollPosition(activeBoardViewId);
}

function renderOverviewView(visibleFolders) {
  folderGrid.className = "folder-grid";
  folderGrid.replaceChildren(...getOverviewFolders(visibleFolders).map((folder) => createFolderCard(folder)));
}

function handleCardPlaceClick(event) {
  if (activeView === "settings") {
    return;
  }

  if (getActiveBoardView() === "table") {
    const nameCell = event.target.closest('.folder-table-row:not(.folder-table-head) .folder-table-cell[data-table-column="name"]');
    if (!nameCell || !folderGrid.contains(nameCell)) {
      return;
    }

    const row = nameCell.closest(".folder-table-row");
    const folder = findFolderByPath(row?.dataset.folderPath);
    if (folder) {
      event.stopPropagation();
      openCardPlace(folder);
    }
    return;
  }

  const card = event.target.closest(".folder-card");
  if (!card || !folderGrid.contains(card)) {
    return;
  }

  const folder = findFolderByPath(card.dataset.folderPath);
  if (folder) {
    event.stopPropagation();
    openCardPlace(folder);
  }
}

function handleCardPlaceOutsideClick(event) {
  if (!selectedCardPath || event.target.closest(".card-place-panel")) {
    return;
  }

  closeCardPlace();
}

function openCardPlace(folder) {
  selectedCardPath = getFolderPath(folder);
  renderCardPlacePanel();
  loadCardPlaceEntries(folder);
}

function closeCardPlace() {
  selectedCardPath = null;
  resetCardPlaceEntries("idle", true);
  renderCardPlacePanel();
}

function handleCardPlaceFolderOpen() {
  if (!selectedCardPath) {
    return;
  }

  revealCardPlaceEntry(selectedCardPath, "directory");
}

function handleCardPlaceFolderOpenKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  handleCardPlaceFolderOpen();
}

function handleCardPlaceTextInput() {
  if (!selectedCardPath) {
    return;
  }

  resizeTextareaToContent(cardPlaceText);
  updateFolderText(selectedCardPath, cardPlaceText.value);
}

function handleCardPlaceTextFocus() {
  clearCardPlaceTextPlaceholder();
}

function clearCardPlaceTextPlaceholder() {
  cardPlaceText.placeholder = "";
}

function handleCardPlaceTextBlur() {
  if (!cardPlaceText.value) {
    cardPlaceText.placeholder = getTextPropertyLabel();
  }
}

function renderCardPlacePanel() {
  const selectedCard = selectedCardPath ? findFolderByPath(selectedCardPath) : null;
  if (selectedCardPath && !selectedCard) {
    selectedCardPath = null;
  }

  cardPlacePanel.style.setProperty("--card-place-width", `${getActiveCardPlaceWidth()}px`);
  cardPlacePanel.classList.toggle("is-open", Boolean(selectedCard));
  cardPlacePanel.setAttribute("aria-hidden", String(!selectedCard));
  cardPlaceFolderOpenButton.tabIndex = selectedCard ? 0 : -1;
  cardPlaceFolderOpenButton.setAttribute("aria-disabled", String(!selectedCard));
  cardPlaceTextLabel.textContent = getTextPropertyLabel();
  cardPlaceTextLabel.title = getTextPropertyLabel();
  cardPlaceTitle.textContent = "";
  cardPlaceStatus.textContent = "";
  cardPlaceText.value = "";
  cardPlaceText.placeholder = getTextPropertyLabel();
  cardPlaceText.disabled = !selectedCard;
  if (selectedCard) {
    cardPlaceTitle.textContent = selectedCard.name;
    cardPlaceStatus.textContent = selectedCard.status;
    cardPlaceText.value = getFolderText(selectedCard);
  }
  resizeTextareaToContent(cardPlaceText);
  renderCardPlaceEntries();
}

function resizeTextareaToContent(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  textarea.style.height = `${getTextareaSingleLineHeight(textarea)}px`;
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function getTextareaSingleLineHeight(textarea) {
  const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight);
  return Number.isFinite(lineHeight) ? Math.ceil(lineHeight) : 20;
}

function getFolderText(folder) {
  return typeof folder?.text === "string" ? folder.text : "";
}

function updateFolderText(path, text) {
  const normalizedText = typeof text === "string" ? text : "";
  folders = folders.map((folder) => (
    getFolderPath(folder) === path ? { ...folder, text: normalizedText } : folder
  ));

  if (selectedCardPath === path && cardPlaceText.value !== normalizedText) {
    cardPlaceText.value = normalizedText;
  }

  saveBoardSnapshot();
  scheduleFolderTextSave(path, normalizedText);
}

function scheduleFolderTextSave(path, text) {
  window.clearTimeout(folderPropertySaveTimers.get(path));
  const timer = window.setTimeout(() => {
    folderPropertySaveTimers.delete(path);
    saveFolderText(path, text);
  }, 350);
  folderPropertySaveTimers.set(path, timer);
}

async function saveFolderText(path, text) {
  try {
    await postJson("/api/properties", { path, text });
  } catch (error) {
    setStatus("Could not save text property.", "error");
  }
}

async function loadCardPlaceEntries(folder) {
  const requestId = cardPlaceEntriesRequest + 1;
  cardPlaceEntriesRequest = requestId;
  cardPlaceEntries = [];
  cardPlaceExpandedPaths = new Set();
  cardPlaceChildrenByPath = new Map();
  cardPlaceLoadingPaths = new Set();
  cardPlaceFailedPaths = new Set();

  if (!folder || !selectedRoot) {
    cardPlaceEntriesState = "access";
    renderCardPlaceEntries();
    return;
  }

  cardPlaceEntriesState = "loading";
  renderCardPlaceEntries();

  try {
    const { entries } = await postJson("/api/list-entries", { path: getFolderPath(folder) });
    if (requestId !== cardPlaceEntriesRequest) {
      return;
    }

    cardPlaceEntries = entries;
    cardPlaceEntriesState = entries.length > 0 ? "ready" : "empty";
  } catch (error) {
    if (requestId !== cardPlaceEntriesRequest) {
      return;
    }

    cardPlaceEntries = [];
    cardPlaceEntriesState = "error";
  }

  renderCardPlaceEntries();
}

async function loadCardPlaceChildEntries(entry) {
  if (!selectedRoot || entry.kind !== "directory" || cardPlaceChildrenByPath.has(entry.path)) {
    return;
  }

  cardPlaceLoadingPaths.add(entry.path);
  cardPlaceFailedPaths.delete(entry.path);
  renderCardPlaceEntries();

  try {
    const { entries } = await postJson("/api/list-entries", { path: entry.path });
    cardPlaceChildrenByPath.set(entry.path, entries);
  } catch (error) {
    cardPlaceFailedPaths.add(entry.path);
  }

  cardPlaceLoadingPaths.delete(entry.path);
  renderCardPlaceEntries();
}

function renderCardPlaceEntries() {
  cardPlaceFolderList.replaceChildren();

  if (!selectedCardPath) {
    return;
  }

  if (cardPlaceEntriesState === "ready") {
    cardPlaceFolderList.replaceChildren(...createCardPlaceEntryRows(cardPlaceEntries));
    return;
  }

  const messages = {
    access: "Restore folder access",
    empty: "No files or folders",
    error: "Could not load folder contents",
    idle: "",
    loading: "Loading...",
  };
  const message = messages[cardPlaceEntriesState] || "";
  if (message) {
    const row = document.createElement("div");
    row.className = "card-place-entry-message";
    row.textContent = message;
    cardPlaceFolderList.append(row);
  }
}

function createCardPlaceEntryRows(entries, depth = 0) {
  return entries.flatMap((entry) => {
    const rows = [createCardPlaceEntryRow(entry, depth)];
    if (entry.kind === "directory" && cardPlaceExpandedPaths.has(entry.path)) {
      if (cardPlaceLoadingPaths.has(entry.path)) {
        rows.push(createCardPlaceEntryMessage("Loading...", depth + 1));
      } else if (cardPlaceFailedPaths.has(entry.path)) {
        rows.push(createCardPlaceEntryMessage("Could not load folder contents", depth + 1));
      } else {
        rows.push(...createCardPlaceEntryRows(cardPlaceChildrenByPath.get(entry.path) || [], depth + 1));
      }
    }

    return rows;
  });
}

function createCardPlaceEntryRow(entry, depth) {
  const row = document.createElement("button");
  row.className = "card-place-entry";
  row.type = "button";
  row.dataset.kind = entry.kind;
  row.dataset.path = entry.path;
  row.style.setProperty("--entry-depth", String(depth));

  const rowItems = [];
  if (entry.kind === "directory") {
    const chevron = document.createElement("span");
    chevron.className = "card-place-entry-chevron";
    chevron.setAttribute("aria-hidden", "true");
    row.setAttribute("aria-expanded", String(cardPlaceExpandedPaths.has(entry.path)));
    const icon = document.createElement("span");
    icon.className = "card-place-entry-icon is-directory";
    icon.setAttribute("aria-hidden", "true");
    rowItems.push(chevron, icon);
  }

  const name = document.createElement("span");
  name.className = "card-place-entry-name";
  name.textContent = entry.name;

  row.append(...rowItems, name);

  return row;
}

function createCardPlaceEntryMessage(message, depth) {
  const row = document.createElement("div");
  row.className = "card-place-entry-message";
  row.style.setProperty("--entry-depth", String(depth));
  row.textContent = message;

  return row;
}

function handleCardPlaceEntryClick(event) {
  const row = event.target.closest(".card-place-entry");
  if (!row || !cardPlaceFolderList.contains(row)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  if (row.dataset.kind === "directory") {
    if (!event.target.closest(".card-place-entry-chevron")) {
      revealCardPlaceEntry(row.dataset.path, "directory");
      return;
    }

    toggleCardPlaceDirectory(row.dataset.path);
    return;
  }

  openCardPlaceFile(row.dataset.path);
}

function toggleCardPlaceDirectory(path) {
  const entry = findCardPlaceEntryByPath(path);
  if (!entry || entry.kind !== "directory") {
    return;
  }

  if (cardPlaceExpandedPaths.has(path)) {
    cardPlaceExpandedPaths.delete(path);
    renderCardPlaceEntries();
    return;
  }

  cardPlaceExpandedPaths.add(path);
  renderCardPlaceEntries();
  loadCardPlaceChildEntries(entry);
}

async function openCardPlaceFile(path) {
  if (!selectedRoot || !path) {
    return;
  }

  try {
    if (!isPreviewableFilePath(path)) {
      revealCardPlaceEntry(path, "file");
      return;
    }

    window.open(`/api/file?path=${encodeURIComponent(path)}`, "_blank", "noopener");
  } catch (error) {
    setStatus("Could not open file.", "error");
  }
}

async function revealCardPlaceEntry(path, kind) {
  if (!path || (kind !== "directory" && kind !== "file")) {
    return;
  }

  try {
    const response = await fetch("/api/reveal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, kind }),
    });

    if (!response.ok) {
      throw new Error("Reveal request failed.");
    }
  } catch (error) {
    setStatus("Could not open local item. Check local workspace root.", "error");
  }
}

function isPreviewableFilePath(path) {
  const previewType = getPreviewMimeType(path);
  return (
    previewType.startsWith("image/") ||
    previewType.startsWith("text/") ||
    previewType.startsWith("audio/") ||
    previewType.startsWith("video/") ||
    previewType === "application/pdf" ||
    previewType === "application/json" ||
    previewType === "application/xml"
  );
}

function getPreviewMimeType(fileName) {
  const extension = fileName.toLowerCase().split(".").pop();
  const mimeTypes = {
    avif: "image/avif",
    css: "text/css",
    csv: "text/csv",
    gif: "image/gif",
    htm: "text/html",
    html: "text/html",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    js: "text/javascript",
    json: "application/json",
    md: "text/markdown",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    pdf: "application/pdf",
    png: "image/png",
    svg: "image/svg+xml",
    txt: "text/plain",
    webm: "video/webm",
    webp: "image/webp",
    xml: "application/xml",
  };

  return mimeTypes[extension] || "";
}

function findCardPlaceEntryByPath(path) {
  if (!path) {
    return null;
  }

  const searchEntries = (entries) => {
    for (const entry of entries) {
      if (entry.path === path) {
        return entry;
      }

      if (entry.kind === "directory") {
        const childEntry = searchEntries(cardPlaceChildrenByPath.get(entry.path) || []);
        if (childEntry) {
          return childEntry;
        }
      }
    }

    return null;
  };

  return searchEntries(cardPlaceEntries);
}

function resetCardPlaceEntries(state = "idle", invalidateRequests = false) {
  cardPlaceEntries = [];
  cardPlaceEntriesState = state;
  cardPlaceExpandedPaths = new Set();
  cardPlaceChildrenByPath = new Map();
  cardPlaceLoadingPaths = new Set();
  cardPlaceFailedPaths = new Set();
  if (invalidateRequests) {
    cardPlaceEntriesRequest += 1;
  }
}

function handleCardPlaceResizeStart(event) {
  event.preventDefault();
  cardPlaceResizeState = {
    startX: event.clientX,
    startWidth: getActiveCardPlaceWidth(),
  };

  cardPlacePanel.classList.add("is-resizing");
  try {
    cardPlaceResizeHandle.setPointerCapture?.(event.pointerId);
  } catch (error) {
    // Synthetic pointer events used in tests do not always create an active pointer.
  }
}

function handleCardPlaceResizeMove(event) {
  if (!cardPlaceResizeState) {
    return;
  }

  const nextWidth = normalizeCardPlaceWidth(cardPlaceResizeState.startWidth + cardPlaceResizeState.startX - event.clientX);
  cardPlacePanel.style.setProperty("--card-place-width", `${nextWidth}px`);
}

function handleCardPlaceResizeEnd() {
  if (!cardPlaceResizeState) {
    return;
  }

  const panelWidth = Number.parseFloat(cardPlacePanel.style.getPropertyValue("--card-place-width"));
  saveCardPlaceWidth(panelWidth);
  cardPlaceResizeState = null;
  cardPlacePanel.classList.remove("is-resizing");
}

function getActiveCardPlaceWidth() {
  return normalizeCardPlaceWidth(getActiveWorkspace()?.cardPlaceWidth);
}

function saveCardPlaceWidth(width) {
  const cardPlaceWidth = normalizeCardPlaceWidth(width);
  workspaces = workspaces.map((workspace) =>
    workspace.id === activeWorkspaceId ? { ...workspace, cardPlaceWidth } : workspace,
  );
  saveWorkspaceState();
}

function findFolderByPath(folderPath) {
  return folders.find((folder) => getFolderPath(folder) === folderPath) || null;
}

function getFolderPath(folder) {
  return folder?.path || folder?.id || folder?.name || "";
}

function getOverviewFolders(visibleFolders) {
  const hiddenStatuses = new Set(getActiveHiddenStatuses());
  const showHiddenStatuses = getActiveShowHiddenStatuses();
  const statusOrder = getOrderedStatuses(visibleFolders);

  return visibleFolders
    .filter((folder) => showHiddenStatuses || !hiddenStatuses.has(folder.status))
    .map((folder, index) => ({ folder, index }))
    .sort((left, right) => compareFoldersByStatusOrder(left, right, statusOrder))
    .map(({ folder }) => folder);
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
  saveBoardViewScrollPosition();
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
  const columnOrder = getActiveVisibleTableColumnOrder();
  const hiddenStatuses = new Set(getActiveHiddenStatuses());
  const textWrapped = isTableTextWrapped();
  const tableFolders = getTableFolders(visibleFolders);
  const table = document.createElement("div");
  table.className = "folder-table-surface";
  setTableGridTemplate(table);

  const header = document.createElement("div");
  header.className = "folder-table-row folder-table-head";
  header.append(...columnOrder.map(createTableHeaderCell));

  table.append(
    header,
    ...tableFolders.map((folder) =>
      createTableRow(folder, columnOrder, { hidden: hiddenStatuses.has(folder.status), textWrapped }),
    ),
  );

  folderGrid.className = "folder-table";
  folderGrid.replaceChildren(table);
  restoreTableStatusMenuOpenState();
}

function getTableFolders(visibleFolders) {
  const hiddenStatuses = new Set(getActiveHiddenStatuses());
  const showHiddenStatuses = getActiveShowHiddenStatuses();
  const statusOrder = getOrderedStatuses(visibleFolders);

  return visibleFolders
    .filter((folder) => showHiddenStatuses || !hiddenStatuses.has(folder.status))
    .map((folder, index) => ({ folder, index }))
    .sort((left, right) => compareFoldersByStatusOrder(left, right, statusOrder))
    .map(({ folder }) => folder);
}

function compareFoldersByStatusOrder(left, right, statusOrder) {
  const leftStatusIndex = statusOrder.indexOf(left.folder.status);
  const rightStatusIndex = statusOrder.indexOf(right.folder.status);

  if (leftStatusIndex !== rightStatusIndex) {
    return leftStatusIndex - rightStatusIndex;
  }

  return left.index - right.index;
}

function setTableGridTemplate(tableElement) {
  const columnOrder = getActiveVisibleTableColumnOrder();
  const tableColumnWidths = getActiveTableColumnWidths();
  const columnTracks = columnOrder.map((columnId) =>
    `minmax(${columnId === "name" ? "180px" : "110px"}, var(--table-${columnId}-column-width))`,
  );

  tableColumnIds.forEach((columnId) => {
    tableElement.style.setProperty(`--table-${columnId}-column-width`, `${tableColumnWidths[columnId]}%`);
  });
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
  const canUseFolderBoard = folderViews.has(activeView) || activeView === "settings";
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

  if (!selectedRoot) {
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
  title.textContent = selectedRoot?.name || "No folder selected";
  const path = document.createElement("p");
  path.textContent = selectedRoot
    ? `Backend workspace root: ${selectedRoot.name}`
    : "Choose a folder to configure workspace access.";

  copy.append(eyebrow, title, path);

  const actions = document.createElement("div");
  actions.className = "settings-root-actions";
  const rescanButton = document.createElement("button");
  rescanButton.className = "ghost-button";
  rescanButton.type = "button";
  rescanButton.textContent = "Refresh";
  rescanButton.disabled = !selectedRoot;
  rescanButton.addEventListener("click", scanSelectedFolder);

  const changeButton = document.createElement("button");
  changeButton.className = "primary-button";
  changeButton.type = "button";
  changeButton.textContent = selectedRoot ? "Change" : "Choose folder";
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
  title.textContent = "No folder selected";
  const description = document.createElement("p");
  description.textContent = "Choose a workspace root to review folder access.";

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
  folders = flattenAccessTreeCards(folderAccessTree, { rootStatus: selectedRoot?.name || "Client Projects" });
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
  if (
    !cell ||
    event.target.closest(".table-resize-handle") ||
    event.target.closest(".table-status-menu, .table-text-menu") ||
    getActiveBoardView() !== "table"
  ) {
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
    event.target.closest(".table-status-menu, .table-text-menu") ||
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
  const columnOrder = getActiveVisibleTableColumnOrder();
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
  row.dataset.folderPath = folder.path || folder.name;
  row.classList.toggle("is-hidden-status-row", Boolean(options.hidden));
  row.classList.toggle("is-text-wrapped", Boolean(options.textWrapped) && hasMultilineTableText(folder));
  row.append(...columnOrder.map((columnId) => createTableCell(folder, columnId, options)));

  return row;
}

function hasMultilineTableText(folder) {
  return getFolderText(folder).includes("\n");
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
  label.textContent = getTableColumnLabel(columnId);
  cell.append(label);

  if (columnId === "status") {
    cell.classList.add("has-table-status-menu");
    cell.setAttribute("aria-haspopup", "menu");
    cell.setAttribute("aria-expanded", "false");
    cell.append(createTableStatusMenu(getOrderedStatuses(folders), getActiveHiddenStatuses()));
  }

  if (columnId === "text") {
    cell.classList.add("has-table-text-menu");
    cell.setAttribute("aria-haspopup", "menu");
    cell.setAttribute("aria-expanded", "false");
    cell.append(createTableTextMenu());
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
      item.draggable = false;

      const label = document.createElement("span");
      label.className = "table-status-menu-label";
      label.textContent = status;

      item.append(createTableStatusDragHandle(), label, createTableStatusVisibilityButton(status, hiddenStatusSet.has(status)));

      return item;
    }),
  );

  return menu;
}

function createTableTextMenu() {
  const menu = document.createElement("div");
  menu.className = "table-text-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  menu.replaceChildren(
    createTableTextMenuAction("rename", "Rename", createMenuIcon("rename")),
    createTableTextMenuAction("hide", "Hide", createEyeIcon(true)),
    createTableTextMenuAction("wrap", isTableTextWrapped() ? "Unwrap text" : "Wrap text", createMenuIcon("wrap")),
  );

  return menu;
}

function createTableTextMenuAction(action, label, icon) {
  const button = document.createElement("button");
  button.className = "table-text-menu-action";
  button.type = "button";
  button.dataset.tableTextAction = action;
  button.setAttribute("role", "menuitem");
  button.append(icon, document.createTextNode(label));

  return button;
}

function createTableStatusVisibilityButton(status, hidden) {
  const button = document.createElement("button");
  button.className = "table-status-visibility";
  button.type = "button";
  button.dataset.status = status;
  button.setAttribute("aria-label", hidden ? `Show ${status} section` : `Hide ${status} section`);
  button.setAttribute("aria-pressed", String(hidden));
  button.append(createEyeIcon(hidden));

  return button;
}

function createTableStatusDragHandle() {
  const handle = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  handle.setAttribute("class", "table-status-drag-handle");
  handle.setAttribute("viewBox", "0 0 24 24");
  handle.setAttribute("aria-hidden", "true");

  ["M8 7h8", "M8 12h8", "M8 17h8"].forEach((pathData) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", pathData);
    handle.append(line);
  });

  return handle;
}

function handleTableStatusMenuPointerDragStart(event) {
  if (event.target.closest(".table-status-visibility")) {
    return;
  }

  const item = event.target.closest(".table-status-menu-item");
  if (!item || getActiveBoardView() !== "table") {
    return;
  }

  const sourceRect = item.getBoundingClientRect();
  tableStatusMenuPointerDragState = {
    status: item.dataset.status,
    startX: event.clientX,
    startY: event.clientY,
    dragOffsetX: event.clientX - sourceRect.left,
    dragOffsetY: event.clientY - sourceRect.top,
    sourceItem: item,
    targetItem: item,
    isDragging: false,
  };
  draggedTableMenuStatus = item.dataset.status;
  try {
    item.setPointerCapture?.(event.pointerId);
  } catch (error) {
    // Synthetic pointer events used in tests do not always create an active pointer.
  }
}

function handleTableStatusMenuPointerDragMove(event) {
  if (!tableStatusMenuPointerDragState) {
    return;
  }

  const dragDistance = Math.hypot(
    event.clientX - tableStatusMenuPointerDragState.startX,
    event.clientY - tableStatusMenuPointerDragState.startY,
  );
  if (!tableStatusMenuPointerDragState.isDragging && dragDistance < 4) {
    return;
  }

  event.preventDefault();
  const startsDragging = !tableStatusMenuPointerDragState.isDragging;
  tableStatusMenuPointerDragState.isDragging = true;
  tableStatusMenuPointerDragState.sourceItem.classList.add("is-table-status-drag-source");
  if (startsDragging) {
    createTableStatusDragImage(tableStatusMenuPointerDragState.sourceItem, event);
  } else {
    moveTableStatusDragImage(event);
  }

  const targetItem = document.elementFromPoint(event.clientX, event.clientY)?.closest(".table-status-menu-item");
  const menu = tableStatusMenuPointerDragState.sourceItem.closest(".table-status-menu");
  if (!targetItem || !menu?.contains(targetItem)) {
    return;
  }

  tableStatusMenuPointerDragState.targetItem = targetItem;
  applyTableStatusMenuPreview(getTableStatusMenuPreviewOrder(event, targetItem));
}

function handleTableStatusMenuPointerDragEnd(event) {
  if (!tableStatusMenuPointerDragState) {
    return;
  }

  const { isDragging, targetItem } = tableStatusMenuPointerDragState;
  if (!isDragging || !targetItem) {
    tableStatusMenuPointerDragState = null;
    draggedTableMenuStatus = null;
    clearTableStatusMenuDragState();
    removeTableStatusDragImage();
    return;
  }

  event.preventDefault();
  suppressNextTableStatusMenuClick();
  const reorderedStatuses = getTableStatusMenuPreviewOrder(event, targetItem);
  saveStatusOrder(reorderedStatuses);
  tableStatusMenuPointerDragState = null;
  draggedTableMenuStatus = null;
  clearTableStatusMenuDragState();
  removeTableStatusDragImage();
  tableStatusMenuOpen = true;
  renderFolders();
}

function suppressNextTableStatusMenuClick() {
  tableStatusSuppressClick = true;
  window.clearTimeout(tableStatusSuppressClickTimer);
  tableStatusSuppressClickTimer = window.setTimeout(() => {
    tableStatusSuppressClick = false;
    tableStatusSuppressClickTimer = null;
  }, 0);
}

function createTableStatusDragImage(sourceItem, event) {
  removeTableStatusDragImage();
  const sourceRect = sourceItem.getBoundingClientRect();
  const dragImage = sourceItem.cloneNode(true);
  dragImage.className = "table-status-drag-image";
  dragImage.style.width = `${sourceRect.width}px`;
  dragImage.style.height = `${sourceRect.height}px`;
  document.body.append(dragImage);
  tableStatusDragImage = dragImage;
  moveTableStatusDragImage(event);
}

function moveTableStatusDragImage(event) {
  if (!tableStatusDragImage) {
    return;
  }

  const offsetX = tableStatusMenuPointerDragState?.dragOffsetX ?? 0;
  const offsetY = tableStatusMenuPointerDragState?.dragOffsetY ?? 0;
  tableStatusDragImage.style.transform = `translate(${event.clientX - offsetX}px, ${event.clientY - offsetY}px)`;
}

function removeTableStatusDragImage() {
  tableStatusDragImage?.remove();
  tableStatusDragImage = null;
}

function getTableStatusMenuPreviewOrder(event, targetItem) {
  const statusOrder = getOrderedStatuses(folders);
  const targetStatus = targetItem.dataset.status;
  if (!draggedTableMenuStatus || !targetStatus || targetStatus === draggedTableMenuStatus) {
    return statusOrder;
  }

  const draggedIndex = statusOrder.indexOf(draggedTableMenuStatus);
  const targetIndex = statusOrder.indexOf(targetStatus);
  const targetRect = targetItem.getBoundingClientRect();
  if (draggedIndex < 0 || targetIndex < 0) {
    return statusOrder;
  }

  const insertAfterTarget =
    draggedIndex < targetIndex
      ? event.clientY > targetRect.top + targetRect.height * 0.25
      : event.clientY > targetRect.bottom - targetRect.height * 0.25;

  return moveStatusNearTarget(statusOrder, draggedTableMenuStatus, targetStatus, insertAfterTarget);
}

function applyTableStatusMenuPreview(previewStatuses) {
  const items = [...folderGrid.querySelectorAll(".table-status-menu-item")];
  const menuGap = Number.parseFloat(getComputedStyle(items[0]?.closest(".table-status-menu")).rowGap) || 0;
  items.forEach((item, currentIndex) => {
    const previewIndex = previewStatuses.indexOf(item.dataset.status);
    const shiftDistance = `${item.getBoundingClientRect().height + menuGap}px`;
    item.classList.remove("is-table-status-preview-up", "is-table-status-preview-down");
    item.style.setProperty("--table-status-menu-item-shift", shiftDistance);

    if (item.dataset.status === draggedTableMenuStatus) {
      item.classList.add("is-table-status-drag-source");
      return;
    }

    if (previewIndex < 0) {
      return;
    }

    if (previewIndex < currentIndex) {
      item.classList.add("is-table-status-preview-up");
    } else if (previewIndex > currentIndex) {
      item.classList.add("is-table-status-preview-down");
    }
  });
}

function clearTableStatusMenuDragState() {
  folderGrid.querySelectorAll(".table-status-menu-item").forEach((item) => {
    item.classList.remove(
      "is-table-status-drag-source",
      "is-table-status-preview-up",
      "is-table-status-preview-down",
    );
    item.style.removeProperty("--table-status-menu-item-shift");
  });
}

function handleTableStatusMenuClick(event) {
  if (tableStatusSuppressClick) {
    tableStatusSuppressClick = false;
    window.clearTimeout(tableStatusSuppressClickTimer);
    tableStatusSuppressClickTimer = null;
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const visibilityButton = event.target.closest(".table-status-visibility");
  if (visibilityButton) {
    event.preventDefault();
    event.stopPropagation();
    toggleTableStatusVisibility(visibilityButton.dataset.status);
    return;
  }

  if (event.target.closest(".table-status-menu-item, .table-status-menu")) {
    event.preventDefault();
    event.stopPropagation();
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

function handleTableTextMenuClick(event) {
  const actionButton = event.target.closest("[data-table-text-action]");
  if (actionButton) {
    event.preventDefault();
    event.stopPropagation();
    const headerCell = actionButton.closest('.folder-table-head .folder-table-cell[data-table-column="text"]');
    handleTableTextMenuAction(actionButton.dataset.tableTextAction, headerCell);
    return;
  }

  if (event.target.closest(".table-text-menu")) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const textHeader = event.target.closest('.folder-table-head .folder-table-cell[data-table-column="text"]');
  if (!textHeader || event.target.closest(".table-resize-handle") || getActiveBoardView() !== "table") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  toggleTableTextMenu(textHeader);
}

function handleTableTextMenuAction(action, headerCell) {
  if (action === "rename") {
    closeTableTextMenus();
    startTableColumnRename("text", headerCell);
    return;
  }

  if (action === "hide") {
    closeTableTextMenus();
    toggleTableColumnVisibility("text");
    return;
  }

  if (action === "wrap") {
    toggleTableTextWrap();
  }
}

function toggleTableStatusMenu(statusHeader) {
  const isOpen = statusHeader.classList.contains("is-table-status-menu-open");
  closeTableStatusMenus();
  closeTableTextMenus();
  if (isOpen) {
    return;
  }

  tableStatusMenuOpen = true;
  statusHeader.classList.add("is-table-status-menu-open");
  statusHeader.setAttribute("aria-expanded", "true");
  statusHeader.querySelector(".table-status-menu").hidden = false;
}

function toggleTableTextMenu(textHeader) {
  const isOpen = textHeader.classList.contains("is-table-text-menu-open");
  closeTableStatusMenus();
  closeTableTextMenus();
  if (isOpen) {
    return;
  }

  tableTextMenuOpen = true;
  textHeader.classList.add("is-table-text-menu-open");
  textHeader.setAttribute("aria-expanded", "true");
  textHeader.querySelector(".table-text-menu").hidden = false;
}

function startTableColumnRename(columnId, headerCell) {
  if (columnId !== "text" || !headerCell) {
    return;
  }

  const label = headerCell.querySelector(".table-header-label");
  if (!label) {
    return;
  }

  const input = document.createElement("input");
  input.className = "table-header-rename-input";
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = getTableColumnLabel(columnId);
  label.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = (save) => {
    if (finished) {
      return;
    }

    finished = true;
    const nextLabel = input.value.trim() || tableColumnLabels[columnId];
    if (save) {
      saveTableColumnLabel(columnId, nextLabel);
    }
    renderBoardViewSwitcher();
    renderFolders();
  };

  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("blur", () => finish(true), { once: true });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
}

function restoreTableStatusMenuOpenState() {
  if (!tableStatusMenuOpen) {
    return;
  }

  const statusHeader = folderGrid.querySelector('.folder-table-head .folder-table-cell[data-table-column="status"]');
  const menu = statusHeader?.querySelector(".table-status-menu");
  if (!statusHeader || !menu) {
    tableStatusMenuOpen = false;
    return;
  }

  statusHeader.classList.add("is-table-status-menu-open");
  statusHeader.setAttribute("aria-expanded", "true");
  menu.hidden = false;
}

function updateTableTextMenuItems() {
  const action = folderGrid.querySelector('[data-table-text-action="wrap"]');
  if (action) {
    action.replaceChildren(createMenuIcon("wrap"), document.createTextNode(isTableTextWrapped() ? "Unwrap text" : "Wrap text"));
  }
}

function toggleTableStatusVisibility(status) {
  const hiddenStatuses = new Set(getActiveHiddenStatuses());
  if (hiddenStatuses.has(status)) {
    hiddenStatuses.delete(status);
  } else {
    hiddenStatuses.add(status);
  }

  saveHiddenStatuses([...hiddenStatuses]);
  refreshCurrentTableRows();
  updateTableStatusMenuItems();
}

function refreshCurrentTableRows() {
  const table = folderGrid.querySelector(".folder-table-surface");
  const header = table?.querySelector(".folder-table-head");
  if (!table || !header) {
    renderFolders();
    return;
  }

  const columnOrder = getActiveVisibleTableColumnOrder();
  const hiddenStatuses = new Set(getActiveHiddenStatuses());
  const textWrapped = isTableTextWrapped();
  const tableFolders = getTableFolders(filterFolders(folders, searchInput.value));
  table.replaceChildren(
    header,
    ...tableFolders.map((folder) => createTableRow(folder, columnOrder, { hidden: hiddenStatuses.has(folder.status), textWrapped })),
  );
}

function updateTableStatusMenuItems() {
  const hiddenStatuses = new Set(getActiveHiddenStatuses());
  folderGrid.querySelectorAll(".table-status-menu-item").forEach((item) => {
    const visibilityButton = item.querySelector(".table-status-visibility");
    const hidden = hiddenStatuses.has(item.dataset.status);
    visibilityButton?.setAttribute("aria-label", hidden ? `Show ${item.dataset.status} section` : `Hide ${item.dataset.status} section`);
    visibilityButton?.setAttribute("aria-pressed", String(hidden));
    visibilityButton?.replaceChildren(createEyeIcon(hidden));
  });
}

function closeTableStatusMenus() {
  tableStatusMenuOpen = false;
  folderGrid.querySelectorAll(".has-table-status-menu").forEach((cell) => {
    cell.classList.remove("is-table-status-menu-open");
    cell.setAttribute("aria-expanded", "false");
    const menu = cell.querySelector(".table-status-menu");
    if (menu) {
      menu.hidden = true;
    }
  });
}

function closeTableTextMenus() {
  tableTextMenuOpen = false;
  folderGrid.querySelectorAll(".has-table-text-menu").forEach((cell) => {
    cell.classList.remove("is-table-text-menu-open");
    cell.setAttribute("aria-expanded", "false");
    const menu = cell.querySelector(".table-text-menu");
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

function handleTableTextMenuOutsideClick(event) {
  if (event.target.closest(".has-table-text-menu")) {
    return;
  }

  closeTableTextMenus();
}

function handleTableStatusMenuKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  closeTableStatusMenus();
}

function handleTableTextMenuKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  closeTableTextMenus();
}

function createTableResizeHandle(columnId) {
  const handle = document.createElement("span");
  handle.className = "table-resize-handle";
  handle.dataset.tableColumn = columnId;
  handle.setAttribute("aria-hidden", "true");

  return handle;
}

function createTableCell(folder, columnId, options = {}) {
  const cell = document.createElement("span");
  cell.className = "folder-table-cell";
  cell.dataset.tableColumn = columnId;

  if (columnId === "text") {
    cell.append(createTableTextControl(folder, Boolean(options.textWrapped)));
    return cell;
  }

  cell.textContent = getTableCellText(folder, columnId);

  return cell;
}

function createTableTextControl(folder, wrapped) {
  const control = document.createElement(wrapped ? "textarea" : "input");
  control.className = "table-text-input";
  control.autocomplete = "off";
  control.spellcheck = false;
  control.value = getTableCellText(folder, "text");
  control.addEventListener("click", (event) => event.stopPropagation());
  control.addEventListener("input", () => {
    updateFolderText(folder.path || folder.name, control.value);
    if (wrapped) {
      resizeTextareaToContent(control);
    }
  });

  if (wrapped) {
    control.rows = 1;
    control.classList.add("is-wrapped");
    requestAnimationFrame(() => resizeTextareaToContent(control));
    return control;
  }

  control.type = "text";
  return control;
}

function getTableCellText(folder, columnId) {
  if (columnId === "status") {
    return folder.status;
  }

  if (columnId === "text") {
    return getFolderText(folder);
  }

  return folder.name;
}

function createFolderCard(folder, options = {}) {
  const card = document.createElement("article");
  card.className = "folder-card";
  card.dataset.folderPath = folder.path || folder.name;

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
  if (!selectedRoot) {
    localStorage.removeItem(boardSnapshotStorageKey);
    return;
  }

  const snapshot = {
    rootName: selectedRoot.name,
    folders: folders.map((folder) => ({
      name: folder.name,
      path: folder.path,
      status: folder.status,
      text: getFolderText(folder),
    })),
  };

  localStorage.setItem(boardSnapshotStorageKey, JSON.stringify(snapshot));
}

async function fetchWorkspaceRoot() {
  const data = await fetchJson("/api/root");
  return data.root || null;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function postJson(url, body) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
}

function setStatus(message, tone) {
  statusLine.textContent = message;
  statusLine.dataset.tone = tone;
}

initializeApp();
