# Folder Kanban MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static browser MVP that selects a local parent folder and displays only direct child folders as kanban-style cards.

**Architecture:** The app is plain HTML, CSS, and JavaScript. Pure folder transformation and filtering logic lives in `src/folderModel.js` so it can be tested with Node's built-in test runner, while `app.js` owns DOM, IndexedDB, and File System Access API integration.

**Tech Stack:** HTML, CSS, vanilla JavaScript modules, File System Access API, IndexedDB, Node `node:test`.

---

## File Structure

- Create `index.html`: application shell and static markup.
- Create `styles.css`: dark reference-inspired responsive UI.
- Create `src/folderModel.js`: pure folder list and filter helpers.
- Create `test/folderModel.test.js`: Node tests for direct-child scanning and search filtering.
- Create `app.js`: browser integration, persistence, UI rendering, and events.
- Create `package.json`: local test script.

### Task 1: Folder Model

**Files:**
- Create: `src/folderModel.js`
- Test: `test/folderModel.test.js`
- Create: `package.json`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { filterFolders, listDirectFolders } from "../src/folderModel.js";

function fakeDirectoryHandle(entries) {
  return {
    async *values() {
      for (const entry of entries) {
        yield entry;
      }
    },
  };
}

test("listDirectFolders returns only direct directory entries sorted by name", async () => {
  const folders = await listDirectFolders(
    fakeDirectoryHandle([
      { kind: "file", name: "notes.md" },
      { kind: "directory", name: "zeta" },
      { kind: "directory", name: "Alpha" },
    ]),
  );

  assert.deepEqual(folders, [
    { id: "folder-alpha", name: "Alpha", kind: "directory" },
    { id: "folder-zeta", name: "zeta", kind: "directory" },
  ]);
});

test("filterFolders matches folder names case-insensitively", () => {
  const folders = [
    { id: "folder-app", name: "app", kind: "directory" },
    { id: "folder-docs", name: "docs", kind: "directory" },
  ];

  assert.deepEqual(filterFolders(folders, "DO"), [
    { id: "folder-docs", name: "docs", kind: "directory" },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because `src/folderModel.js` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
export async function listDirectFolders(directoryHandle) {
  const folders = [];

  for await (const entry of directoryHandle.values()) {
    if (entry.kind === "directory") {
      folders.push({
        id: createFolderId(entry.name),
        name: entry.name,
        kind: entry.kind,
      });
    }
  }

  return folders.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

export function filterFolders(folders, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return folders;
  }

  return folders.filter((folder) => folder.name.toLowerCase().includes(normalizedQuery));
}

function createFolderId(name) {
  return `folder-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS with 2 tests.

### Task 2: Static App UI

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `app.js`

- [ ] **Step 1: Create markup**

Create a dark application shell with a collapsible sidebar, folder picker button, refresh button, search input, status region, and card grid.

- [ ] **Step 2: Create CSS**

Adapt the reference visual style with compact dark surfaces, responsive layout, fixed sidebar collapse behavior, and cards that do not shift when content changes.

- [ ] **Step 3: Create browser integration**

Implement support detection, `showDirectoryPicker()`, IndexedDB handle storage, permission checks, direct folder scanning via `listDirectFolders`, search via `filterFolders`, rendering, refresh, and sidebar toggle.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS with folder model tests still green.

### Task 3: Manual Browser Verification

**Files:**
- Modify: none unless verification finds an issue.

- [ ] **Step 1: Start local server**

Run: `npm run dev`
Expected: a local static server URL.

- [ ] **Step 2: Verify in browser**

Open the URL in a Chromium browser. Choose a parent folder. Confirm only direct child folders render as cards, search filters cards, refresh re-scans, and sidebar collapse toggles layout without overlap.

- [ ] **Step 3: Final git status**

Run: `git status --short --branch`
Expected: working tree contains only intentional MVP changes.
