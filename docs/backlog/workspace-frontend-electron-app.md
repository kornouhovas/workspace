# Feature: Workspace Frontend Electron App

## Goal

Replace the current shadcn dashboard template with the Workspace Project Board Electron frontend, using React, Tailwind CSS, shadcn/ui, and the accepted preload IPC bridge.

The frontend must render the product surfaces from `docs/prd.md`: Left Panel, Settings, Board view, Table view, and Project Detail Panel. It must call workspace service methods instead of owning filesystem, storage, or project-discovery rules.

## Context

Read before implementation:

- `docs/vision.md`
- `docs/prd.md`
- `docs/architecture.md`
- `docs/interface.md`
- `docs/ui-guidelines.md`
- `docs/data-model.md`
- `docs/api/workspace-views.md`
- `docs/flows/board-table-views.md`
- `docs/flows/settings-source-folder-and-roles.md`
- `docs/adr/001-local-first-workspace-storage.md`
- `docs/adr/002-electron-preload-ipc-bridge.md`
- `AGENTS.md`

Relevant current code:

- `electron/main.js`
- `src/App.tsx`
- `src/main.tsx`
- `src/styles.css`
- `src/workspaceServiceClient.js`
- `src/workspaceBackend.js`
- `src/workspaceViews.js`
- `src/workspaceSidecarClient.js`
- `src/components/ui/`
- `test/dashboardStructure.test.js`
- `test/runtimeMode.test.js`

## Current State

The backend/local-storage slice is implemented for Workspace views and related storage:

- UI-facing service methods exist in `WorkspaceServiceClient`;
- view normalization, validation, filtering, and projection helpers exist;
- backend use cases exist for view create/list/reorder/activate/update/delete/projection;
- sidecar storage exists for view documents and workspace active view state;
- Go reorder writes are transactional.

The frontend product UI is not implemented yet. `src/App.tsx` still composes the shadcn `dashboard-01` template with sample dashboard data.

## User Value

The user can run the Electron app and work with a real Workspace Project Board interface instead of a placeholder dashboard:

- select or inspect project source folder state;
- create/select Workspaces;
- view projects as Board or Table;
- switch and manage saved views;
- search projects by name;
- open a project detail panel;
- inspect project files and properties;
- see loading, empty, and error states.

## Scope

Implement frontend and runtime integration for:

- Electron preload IPC bridge for workspace service calls;
- renderer `WorkspaceServiceClient` transport;
- product app shell replacing dashboard template;
- Left Panel with Add Workspace, Search, Workspace list, Settings;
- Settings source folder and folder role surface;
- Board view surface from workspace projection data;
- Table view surface from workspace projection data;
- view switcher and view management controls;
- value filter and visible property controls at an MVP level;
- Project Detail Panel with properties and file structure;
- loading, empty, and error states defined in UX flows;
- tests for renderer structure, service boundaries, and critical user flows.

## Out Of Scope

- Authentication.
- Cloud sync or `any sync`.
- Drag and drop projects between primary status columns.
- Full packaged sidecar lifecycle and distribution.
- Mobile UI.
- External PM integrations.
- Editing files inside the app.
- Replacing backend data contracts without docs and tests.

## Constraints

- Follow `docs/adr/002-electron-preload-ipc-bridge.md`.
- React UI must not import Node filesystem APIs.
- React UI must not import `workspaceBackend.js`.
- React UI must not call sidecar routes directly.
- React UI must use `WorkspaceServiceClient`.
- Use existing shadcn/ui components before creating custom primitives.
- Use Tailwind CSS and existing design tokens.
- No new dependencies without approval.
- No public contract changes without docs and tests.
- MVP must not implement drag and drop between status groups.
- Existing backend/local tests must keep passing.

## Acceptance Criteria

- Electron renderer no longer shows the dashboard template as the primary app.
- App renders Workspace Project Board shell: Left Panel, Main Area, and right Project Detail Panel.
- Left Panel includes Add Workspace, Search, Workspaces, and Settings.
- Settings includes project source folder state and folder role tree surface.
- Active Workspace can show Board and Table views from projection-shaped data.
- Board columns represent status groups and include `No status` when present in projection data.
- Board exposes no status drag/drop behavior.
- Table shows the same filtered project set as Board for the same view filters.
- Search filters by project name and combines with view filters.
- View switcher can show, activate, create, rename, reorder, and delete views through service methods.
- Deleting the last view is blocked through backend error handling.
- Project Detail Panel opens from Board card or Table row.
- Project Detail Panel shows project identity, properties, and file tree area.
- File/folder open actions go through service methods.
- Loading, empty, and error states exist for source folder missing, no projects, no search results, and service errors.
- Renderer service calls go through the preload IPC bridge.
- Tests prevent React from importing backend, sidecar, or Node filesystem modules directly.
- `npm run typecheck` and `npm run build:renderer` complete successfully before frontend work is accepted.

## Test Plan

Update or add Node tests:

- `test/runtimeMode.test.js` for preload, Electron security settings, and no Node integration.
- `test/dashboardStructure.test.js` should be replaced by product UI structure tests.
- New renderer boundary tests to reject direct imports of backend/sidecar/Node modules from React components.
- Service transport tests for renderer IPC request behavior.
- Component structure tests for Left Panel, Settings, Board, Table, view controls, and Project Detail Panel.

Manual/visual verification:

- Build renderer and open Electron app.
- Capture desktop screenshot.
- Verify no overlapping text or broken layout at 1440x960 and 1024x720.
- Verify Board, Table, Settings, and Detail Panel states are visible and usable.

Quality gates:

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
GOFLAGS=-buildvcs=false npm run build:sidecar
```

## Risks

- `npm run typecheck` and `npm run build:renderer` currently time out after 90 seconds without diagnostics. Frontend work must diagnose and fix this before acceptance.
- Some MVP data families are not fully implemented in storage yet, especially Workspaces, folder roles, property definitions, select values, and history.
- Building the full MVP UI in one step is too large; implementation should be split into thin, testable slices.
- Electron IPC can become too broad if method validation is not strict.
- UI may accidentally reimplement backend projection/filter logic if service boundaries are not reviewed.

## Ready For Implementation

This item is ready for implementation after the team accepts `docs/adr/002-electron-preload-ipc-bridge.md`.

Implementation should use `docs/superpowers/plans/2026-05-15-workspace-frontend-electron-app.md` and run as small reviewed tasks. If a task needs new backend capabilities, document the gap and create a separate backend backlog item instead of embedding storage logic in React.
