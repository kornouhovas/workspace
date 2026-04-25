# Folder Kanban MVP Design

## Goal

Build a fast browser MVP that lets the user choose a local parent folder and view only its direct child folders as kanban-style cards. The visual language should be adapted from the existing dark kanban reference, while replacing task/project concepts with local workspace folder concepts.

## Scope

- Move the existing prototype files into `referens/` and keep them as design reference material.
- Initialize git and develop the MVP on a new feature branch.
- Provide a left sidebar that can collapse and expand from a button.
- Provide a distinct folder selection button.
- Persist the selected folder handle when browser support permits it.
- Render only direct subfolders of the selected folder as cards.
- Include search and refresh controls for quick validation.

## Non-Goals

- Recursive folder traversal.
- File contents preview.
- Backend service, Electron, or Tauri packaging.
- Cross-browser filesystem support beyond browsers that implement the File System Access API.

## Architecture

The MVP is a static web app with `index.html`, `styles.css`, and `app.js`.

`app.js` owns browser capability detection, folder selection, persisted handle storage, directory scanning, filtering, and rendering. Folder handle persistence uses IndexedDB because File System Directory Handles can be stored there in Chromium-based browsers. If persistence is unavailable or permission is revoked, the app falls back to an empty state asking the user to choose the folder again.

## UI

The layout keeps the reference direction: a dark app shell, compact typography, a left navigation surface, top actions, and kanban-like cards. The sidebar includes workspace metadata and collapses with a toggle button. The main area contains the folder picker, current root name, subfolder count, search, refresh, and a responsive grid of folder cards.

Each card represents one direct child folder. A card shows the folder name, a folder type tag, and compact metadata suitable for MVP validation. Cards are not draggable in the first version because there is only one folder-derived collection, not workflow columns.

## Data Flow

1. User clicks "Choose folder".
2. Browser prompts for a directory.
3. The app stores the handle in memory and IndexedDB where possible.
4. The app scans the directory handle with async iteration.
5. Entries with `kind === "directory"` become folder card view models.
6. Search filters the in-memory folder list.
7. Refresh re-runs the direct child scan.

## Error Handling

The app shows explicit empty and unsupported states:

- Unsupported browser: explain that folder selection requires File System Access API.
- No folder selected: prompt the user to choose a folder.
- Permission denied or lost: ask the user to choose the folder again.
- Scan failure: show a retryable error and keep the picker available.

## Testing

Use Node's built-in test runner for pure folder-scanning and filtering logic with fake directory handles. Browser-specific picker and permission behavior will be manually verified in a Chromium browser after implementation.
