# Feature: Workspace Views Backend And Storage

## Goal

Implement the backend and local storage foundation for Workspace views so the UI can later manage Board and Table views through documented service methods without owning view validation, filtering, project projection, filesystem traversal, or persistence logic.

This backlog item is the first implementation slice for Workspace views. It focuses on backend/local behavior and intentionally excludes React UI work.

## Context

Read before implementation:

- `docs/prd.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/api/workspace-views.md`
- `docs/flows/board-table-views.md`
- `docs/flows/settings-source-folder-and-roles.md`
- `AGENTS.md`

Relevant existing modules:

- `src/workspaceServiceClient.js`
- `src/workspaceSidecarClient.js`
- `src/workspaceBackend.js`
- `src/folderModel.js`
- `src/workspaceObjects.js`
- `src/workspaceProperties.js`
- `internal/workspacestore/store.go`
- `cmd/workspace-sidecar/main.go`

## User Value

The user can eventually create and switch saved Board/Table views inside one Workspace, and the app can persist each view's visible properties, value filters, order, and active view state locally.

This enables the product promise that one project source folder can support multiple Workspace configurations and multiple saved views.

## Scope

Implement UI-facing service method support for:

- `workspace.listViews`
- `workspace.createView`
- `workspace.setActiveView`
- `workspace.updateView`
- `workspace.reorderViews`
- `workspace.deleteView`
- `workspace.getViewProjection`

Implement backend/domain behavior for:

- normalizing view documents;
- creating default Board/Table views with `property:name` and `property:status`;
- validating `viewType`;
- validating visible property references;
- keeping `property:name` and `property:status` visible in MVP;
- validating `valueVisibility` for `select`, `multi-select`, and system `Status`;
- preventing deletion of the last active view;
- selecting the next active view when deleting the active view;
- applying view value filters to a project set;
- applying search by project `Name` only;
- returning Board and Table projections from the same filtered project set;
- representing `No status` as `statusValue:no-status`;
- keeping Board statuses non-draggable in the returned capability model.

Implement local storage behavior for:

- persisting view documents in the `views` collection;
- listing active views by `workspaceId`;
- reading one view by `viewId`;
- creating or upserting a view document;
- deleting or soft-deleting a view document according to the data model;
- updating `workspace.activeViewId` without leaving a Workspace with no active view;
- preserving existing sidecar root and property-value behavior.

## Acceptance Criteria

- `WorkspaceServiceClient` forwards all new Workspace view service methods with normalized object payloads.
- The backend can create a Board view and a Table view for a Workspace.
- Newly created views include `property:name` and `property:status` in `visiblePropertyIds`.
- New views become the Workspace active view.
- The backend can list active views sorted by `order`, then creation time.
- The backend can switch the active view only to a view owned by the same Workspace.
- The backend rejects unknown `viewType` values.
- The backend rejects updates that remove `property:name` or `property:status` from `visiblePropertyIds`.
- The backend rejects `valueVisibility` references to deleted, missing, or wrong-property select values.
- The backend accepts system `Status` filters using derived status value ids and `statusValue:no-status`.
- Deleting the last active view returns a typed error and leaves storage unchanged.
- Deleting the active view selects the next active view by order.
- View deletion never deletes projects, properties, select values, folder roles, files, or folders.
- `workspace.getViewProjection` returns Board and Table projections from the same filtered project set.
- Search in `workspace.getViewProjection` matches project `Name` only.
- Board projection includes `No status` when matching projects have no status.
- Existing tests for root selection, project scan, properties, path safety, and sidecar property values keep passing.

## Constraints

- Follow the module boundaries in `docs/architecture.md`.
- Do not put view filtering or projection rules in React components.
- Do not let React call sidecar HTTP routes directly.
- Do not introduce new npm or Go dependencies without approval.
- Do not expose sidecar HTTP routes as public API.
- Do not change folder role semantics.
- Do not add drag and drop between primary statuses.
- Do not move, rename, or delete project folders on disk.
- Do not use absolute paths as project ids.
- Do not mix UI-only state into product storage documents.
- Public service method behavior must match `docs/api/workspace-views.md`.

## Out Of Scope

- React UI for view tabs, menus, Board, or Table.
- Project Detail Panel changes.
- Editing property definitions or select values.
- Drag and drop between status columns.
- `any sync`.
- Multi-user collaboration.
- Authentication.
- Packaged sidecar lifecycle changes.
- Full migration from transitional `.workspace` JSON files to all target document families.

## Implementation Notes

Suggested code shape:

- Add a pure `src/workspaceViews.js` module for view normalization, validation, filtering, and projection helpers.
- Extend `src/workspaceServiceClient.js` with the new UI-facing methods.
- Extend `src/workspaceSidecarClient.js` only for storage-backed methods that actually cross into sidecar persistence.
- Keep orchestration in `src/workspaceBackend.js` or a nearby backend module; do not make UI components compose projections.
- Add `ViewDocument` and related store methods in `internal/workspacestore/store.go`.
- Add sidecar handlers in `cmd/workspace-sidecar/main.go` only as local implementation endpoints for the service transport.
- Preserve the existing root document behavior while introducing target `views` storage; avoid id collisions with the current `workspace:root` document.

Projection details:

- Board and Table must share the same filtered project list before rendering-specific grouping.
- `Status` values are derived from folder roles and scan output.
- `No status` is a derived status value, not a stored select value.
- `valueVisibility` filters display only and must not mutate project property values.
- `multi-select` filters match when at least one project value is included.
- Empty custom select values match only when `includeEmpty` is true.

## Test Plan

Add or update Node tests:

- `test/workspaceServiceClient.test.js` for method forwarding.
- A new `test/workspaceViews.test.js` for pure normalization, validation, filtering, and projection behavior.
- `test/workspaceBackend.test.js` for view create/update/delete/projection use cases.
- `test/sidecarClient.test.js` for any added sidecar transport route mappings.

Add or update Go tests:

- `internal/workspacestore/store_test.go` for view document persistence.
- Sidecar route tests if the project already has or adds HTTP handler test coverage.

Required test scenarios:

- default Board view creation;
- default Table view creation;
- invalid view type rejection;
- preserving required `Name` and `Status` properties;
- invalid property reference rejection;
- invalid select value reference rejection;
- system `Status` filter with `statusValue:no-status`;
- prevent deleting the last view;
- deleting active view selects another view;
- Board/Table projection uses one filtered project set;
- search by `Name` only.

## Quality Gates

Run before completion:

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
```

For a smaller local loop while implementing backend-only code, start with:

```bash
npm test
go test ./...
```

## Risks

- The current sidecar stores the existing root document in the `workspaces` collection, while the target data model also uses `workspaces` for Workspace documents. The implementation must avoid collisions and may need a small compatibility layer.
- Partial storage writes could leave `workspace.activeViewId` pointing at a missing view if not handled carefully.
- `Status` filters can be confused with select values; implementation must keep derived status values separate from `select_values`.
- Projection code can drift from `workspace.scan` behavior if folder role traversal is duplicated instead of reused.
- Overbuilding UI concerns into backend responses could make later UI changes harder; keep responses aligned with the API contract and current MVP.

## Ready For Implementation

This item is ready when assigned as a backend/local-storage task. The implementation agent should not make product scope changes; if a contract mismatch appears, update `docs/api/workspace-views.md` and tests in the same change.
