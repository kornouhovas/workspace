# Feature: Workspace Custom Properties

## Goal

Implement Notion-like custom project properties for Workspace Project Board across backend, local `any-store` storage, Electron IPC, React UI, Board, Table, and Project Detail Panel.

The supported custom property types are:

- `Text`
- `Numbers`
- `Date`
- `Select`
- `Multi-select`

## Context

Read before implementation:

- `docs/prd.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/api/workspace-properties.md`
- `docs/api/workspace-views.md`
- `docs/interface.md`
- `docs/ui-guidelines.md`
- `docs/flows/board-table-views.md`
- `docs/flows/settings-source-folder-and-roles.md`
- `docs/adr/001-local-first-workspace-storage.md`
- `docs/adr/002-electron-preload-ipc-bridge.md`
- `AGENTS.md`

Relevant current code:

- `electron/workspaceIpc.js`
- `electron/preload.cjs`
- `src/workspaceServiceClient.js`
- `src/workspaceSidecarClient.js`
- `src/workspaceBackend.js`
- `src/workspaceProperties.js`
- `src/workspaceViews.js`
- `src/workspaceObjects.js`
- `src/workspaceAppState.ts`
- `src/components/workspace/board-view.tsx`
- `src/components/workspace/table-view.tsx`
- `src/components/workspace/project-detail-panel.tsx`
- `src/components/workspace/settings-view.tsx`
- `internal/workspacestore/store.go`
- `cmd/workspace-sidecar/main.go`

## Current State

The target data model already defines property definitions, select values, property values, and property history.

Implementation is incomplete:

- `any-store` sidecar currently persists only a minimal `property_values` document family.
- `property_definitions`, `select_values`, and `property_history` are not fully implemented in the sidecar.
- Electron IPC currently returns only default `Name` and `Status` properties for projection.
- `workspace.listPropertyValues` in Electron IPC currently returns an empty list.
- `workspace.saveProperty` currently does not persist the new Notion-like custom property model.
- React UI currently displays projected visible properties but does not provide full property definition/value management.

## User Value

The user can model project metadata inside the app without maintaining a separate spreadsheet:

- add a `Text` property such as `Comment`;
- add a `Numbers` property such as `Budget`;
- add a `Date` property such as `Deadline`;
- add a `Select` property such as `Priority`;
- add a `Multi-select` property such as `Tags`;
- configure select values;
- show/hide properties per view;
- filter projects by visible values;
- edit values inside Project Detail Panel;
- see the same values on Board cards and Table columns.

## Scope

Backend and storage:

- Implement `property_definitions`, `select_values`, `property_values`, and `property_history` in local `any-store`.
- Add service methods documented in `docs/api/workspace-properties.md`.
- Keep system `Name` and `Status` derived and non-editable as stored custom values.
- Normalize and validate values for `text`, `number`, `date`, `select`, and `multi-select`.
- Persist create, update, delete, hide/show, and reorder operations.
- Persist value updates and append property history records.
- Include custom properties and values in `workspace.getViewProjection`.
- Keep legacy `workspace.saveProperty` / `workspace.listPropertyValues` behavior as compatibility aliases until migration is complete.

Frontend:

- Add Settings property management UI.
- Add Select/Multi-select value management UI.
- Add value editors in Project Detail Panel.
- Render custom properties on Board cards when enabled in the active view.
- Render custom properties as Table columns when enabled in the active view.
- Add view-level property visibility controls.
- Add view-level value filter controls for `Select`, `Multi-select`, and system `Status`.
- Show loading/saving/error states for property operations.

## Out Of Scope

- Cloud sync or `any sync`.
- Collaborative editing.
- Formula, relation, rollup, person, file, checkbox, URL, email, phone, or status-as-custom-property types.
- Drag and drop projects between filesystem status folders.
- Editing project files inside the app.
- Full visual redesign unrelated to property workflows.

## Acceptance Criteria

- User can create custom properties of all five MVP types: `Text`, `Numbers`, `Date`, `Select`, `Multi-select`.
- User can rename, delete, hide, show, and reorder custom properties.
- User cannot delete or rename system `Name` and `Status`.
- User can add, rename, recolor, delete, hide, show, and reorder select values.
- Deleting a property with existing values requires confirmation and creates history records.
- Deleting a select value in use requires confirmation and updates affected project values.
- User can edit custom property values in Project Detail Panel.
- `Text` values persist as strings.
- `Numbers` values persist as finite numbers or `null`.
- `Date` values persist as valid `YYYY-MM-DD` strings or `null`.
- `Select` values persist as one select value id or `null`.
- `Multi-select` values persist as an ordered array of unique select value ids.
- Board cards display visible custom properties in active view order.
- Table displays visible custom properties as columns in active view order.
- Project Detail Panel displays all active custom properties for the selected project.
- View-level property visibility updates Board and Table without deleting stored values.
- View-level value filters hide non-matching projects.
- Search remains Name-only in MVP and composes with property value filters.
- Restarting the Electron app does not lose property definitions, select values, property values, or history.
- React components do not import backend, filesystem, sidecar, or storage modules.
- UI does not call sidecar HTTP routes directly.

## Test Plan

Backend/domain tests:

- `test/workspaceProperties.test.js` for schema and value normalization.
- New or updated tests for property definition, select value, property value, and history use cases.
- `test/workspaceViews.test.js` for value visibility with custom select and multi-select properties.
- `test/workspaceBackend.test.js` or dedicated service tests for list/create/update/delete/reorder operations.
- `test/workspaceServiceClient.test.js` for service method forwarding.
- `test/sidecarClient.test.js` for sidecar transport route mapping.

Go sidecar tests:

- `internal/workspacestore/store_test.go` for `property_definitions`, `select_values`, `property_values`, and `property_history`.
- Persistence tests must cover soft delete, list active, usage counts, and append-only history.

Frontend tests:

- `test/dashboardStructure.test.js` or replacement product UI tests for Settings property management, Board card property display, Table columns, and Project Detail Panel editors.
- `test/rendererBoundary.test.js` must continue to reject direct backend/storage imports.
- `test/workspaceAppState.test.js` for projection updates after property mutations.
- Component-level structure tests should assert type-specific editor controls exist.

Manual/visual verification:

- Run `npm run build:renderer`.
- Open Electron with `npm run electron`.
- Verify Settings property management.
- Verify Board card property display.
- Verify Table custom property columns.
- Verify Project Detail Panel value editing.
- Verify app restart persistence.
- Capture screenshots or equivalent visual evidence at 1440x960 and 1024x720.

## Quality Gates

Run before backend slices are accepted:

```bash
npm test
go test ./...
GOFLAGS=-buildvcs=false npm run build:sidecar
git --no-pager diff --check
```

Run before frontend slices are accepted:

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
GOFLAGS=-buildvcs=false npm run build:sidecar
git --no-pager diff --check
```

Visual gate for frontend slices:

```bash
npm run electron
```

The task is not complete until the app has been opened and visually checked after the frontend change.

## Implementation Plan

Use `docs/superpowers/plans/2026-05-15-workspace-custom-properties.md`.

Implementation should run task-by-task with review between tasks. Backend/storage work should be completed before frontend work that depends on persisted property documents.
