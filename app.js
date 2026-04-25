import { filterFolders, listDirectFolders } from "./src/folderModel.js";

const dbName = "folder-kanban-mvp";
const storeName = "handles";
const selectedRootKey = "selected-root";

const appShell = document.querySelector("#appShell");
const sidebarToggle = document.querySelector("#sidebarToggle");
const chooseFolderButton = document.querySelector("#chooseFolderButton");
const refreshButton = document.querySelector("#refreshButton");
const restoreButton = document.querySelector("#restoreButton");
const searchInput = document.querySelector("#searchInput");
const folderGrid = document.querySelector("#folderGrid");
const emptyState = document.querySelector("#emptyState");
const statusLine = document.querySelector("#statusLine");
const pageTitle = document.querySelector(".topbar h1");
const totalFolders = document.querySelector("#totalFolders");
const rootLabel = document.querySelector("#rootLabel");
const sidebarRootName = document.querySelector("#sidebarRootName");
const sidebarFolderCount = document.querySelector("#sidebarFolderCount");
const navButtons = [...document.querySelectorAll("[data-view]")];

const views = {
  workspace: {
    title: "Workspace folders",
    emptyTitle: "No folder selected",
    emptyDescription: "Pick a parent folder from the top action to show its direct subfolders as cards.",
  },
  folders: {
    title: "Folders",
    emptyTitle: "No folder selected",
    emptyDescription: "Choose a parent folder to populate this folder board.",
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

let selectedHandle = null;
let folders = [];
let supportsDirectoryPicker = "showDirectoryPicker" in window;
let activeView = "workspace";

async function initializeApp() {
  bindEvents();

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
}

function bindEvents() {
  sidebarToggle.addEventListener("click", () => {
    const collapsed = appShell.classList.toggle("sidebar-collapsed");
    const label = collapsed ? "Показать меню" : "Скрыть меню";
    sidebarToggle.setAttribute("aria-label", label);
    sidebarToggle.title = label;
  });

  chooseFolderButton.addEventListener("click", chooseFolder);
  refreshButton.addEventListener("click", scanSelectedFolder);
  restoreButton.addEventListener("click", restoreAccess);
  searchInput.addEventListener("input", renderFolders);
  navButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view));
  });
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

  setStatus("Scanning direct subfolders...", "idle");

  try {
    folders = await listDirectFolders(selectedHandle);
    setStatus(`Showing ${folders.length} direct subfolders from ${selectedHandle.name}.`, "success");
  } catch (error) {
    folders = [];
    setStatus("Could not scan that folder. Refresh or choose it again.", "error");
  }

  renderFolders();
}

function renderFolders() {
  pageTitle.textContent = views[activeView].title;
  updateActionStates();

  if (!folderViews.has(activeView)) {
    renderPlaceholder(views[activeView].emptyTitle, views[activeView].emptyDescription);
    return;
  }

  const visibleFolders = filterFolders(folders, searchInput.value);
  folderGrid.replaceChildren(...visibleFolders.map(createFolderCard));

  const hasCards = visibleFolders.length > 0;
  emptyState.hidden = hasCards;

  if (!selectedHandle) {
    emptyState.querySelector("h2").textContent = supportsDirectoryPicker ? "No folder selected" : "Browser unsupported";
    emptyState.querySelector("p").textContent = supportsDirectoryPicker
      ? views[activeView].emptyDescription
      : "Open this app in a Chromium browser to choose local folders.";
  } else if (folders.length === 0) {
    emptyState.querySelector("h2").textContent = "No direct subfolders";
    emptyState.querySelector("p").textContent = "This parent folder has no direct child folders to display.";
  } else {
    emptyState.querySelector("h2").textContent = "No matches";
    emptyState.querySelector("p").textContent = "Clear search to show the folder cards again.";
  }

  totalFolders.textContent = String(folders.length);
  sidebarFolderCount.textContent = String(folders.length);
}

function renderPlaceholder(title, description) {
  folderGrid.replaceChildren();
  emptyState.hidden = false;
  emptyState.querySelector("h2").textContent = title;
  emptyState.querySelector("p").textContent = description;
  setStatus(`${views[activeView].title} is available as a navigation state in this MVP.`, "idle");
}

function setActiveView(view) {
  activeView = views[view] ? view : "workspace";

  navButtons.forEach((button) => {
    const isActive = button.dataset.view === activeView;
    button.classList.toggle("active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (folderViews.has(activeView)) {
    setStatus(selectedHandle ? `Showing ${folders.length} direct subfolders from ${selectedHandle.name}.` : "Choose a folder to build the board.", "idle");
  }

  renderFolders();
}

function updateActionStates() {
  const canUseFolderBoard = supportsDirectoryPicker && folderViews.has(activeView);
  refreshButton.disabled = !selectedHandle || !canUseFolderBoard;
  searchInput.disabled = !canUseFolderBoard;
}

function createFolderCard(folder, index) {
  const card = document.createElement("article");
  card.className = "folder-card";

  card.innerHTML = `
    <div class="card-age">Direct child ${index + 1}</div>
    <h2>${escapeHtml(folder.name)}</h2>
    <div class="folder-note">Saved from the selected parent folder. Nested folders are not scanned in this MVP.</div>
    <div class="card-meta">
      <span class="mini-folder" aria-hidden="true">F</span>
      <span class="folder-tag">Folder</span>
    </div>
  `;

  return card;
}

function updateRoot(name) {
  const label = name || "No root selected";
  rootLabel.textContent = label;
  sidebarRootName.textContent = name || "No folder";
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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

initializeApp();
