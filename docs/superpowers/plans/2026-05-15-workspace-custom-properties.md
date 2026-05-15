# Workspace Custom Properties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Notion-like custom project properties for `Text`, `Numbers`, `Date`, `Select`, and `Multi-select` across backend, `any-store`, Electron IPC, Board, Table, Settings, and Project Detail Panel.

**Architecture:** React remains a thin renderer and calls `WorkspaceServiceClient` through the preload bridge. Backend/domain modules own validation, projection, and filesystem-safe project identity. Durable property definitions, select values, property values, and property history live in the local `any-store` sidecar; transitional `.workspace/properties.json` is migration input, not the final write path.

**Tech Stack:** Electron, React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Node test runner, Go sidecar, `any-store` over SQLite.

---

## Execution Model

Use subagent-driven development unless the user explicitly chooses inline execution.

- One worker per task.
- Workers must not revert edits from other workers.
- Each worker owns only the files listed in its task.
- Each task ends with focused tests, diff review, and a commit.
- Frontend tasks are not complete until the Electron app is opened and visually checked.
- Final frontend acceptance requires screenshots or equivalent visual evidence for Settings, Board, Table, and Project Detail Panel.

## Relevant Specs

- `docs/prd.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/api/workspace-properties.md`
- `docs/api/workspace-views.md`
- `docs/interface.md`
- `docs/ui-guidelines.md`
- `docs/backlog/workspace-custom-properties.md`
- `docs/adr/001-local-first-workspace-storage.md`
- `docs/adr/002-electron-preload-ipc-bridge.md`
- `AGENTS.md`

## File Structure

Planned files and responsibilities:

- `src/workspaceProperties.js`: property type normalization, property definition normalization, select value normalization, property value normalization, validation helpers.
- `src/workspacePropertyStore.js`: Node-side use-case helpers for property documents, usage counts, and history orchestration.
- `src/workspaceViews.js`: view validation and projection using custom properties and select values.
- `src/workspaceObjects.js`: project identity and conversion of discovered folders to project objects.
- `src/workspaceBackend.js`: UI-facing backend responses and projection orchestration.
- `src/workspaceServiceClient.js`: UI-facing service methods.
- `src/workspaceSidecarClient.js`: local sidecar route mapping for property document families.
- `electron/preload.cjs`: allowed workspace property methods.
- `electron/workspaceIpc.js`: dispatch property methods and projection with persisted custom properties.
- `internal/workspacestore/store.go`: `any-store` document persistence for property definitions, select values, property values, history.
- `cmd/workspace-sidecar/main.go`: local HTTP handlers for property storage operations.
- `src/workspaceAppState.ts`: renderer state updates after property mutations.
- `src/components/workspace/settings-view.tsx`: property and select value management surfaces.
- `src/components/workspace/project-detail-panel.tsx`: type-specific property value editors.
- `src/components/workspace/board-view.tsx`: custom property display on cards.
- `src/components/workspace/table-view.tsx`: custom property columns.
- `src/components/workspace/view-tabs.tsx`: entry point for view property visibility/value filter controls if used there.
- `src/components/workspace/property-controls.tsx`: shared property menu/editor controls when UI complexity justifies extraction.
- `test/workspaceProperties.test.js`: pure property schema/value tests.
- `test/workspaceViews.test.js`: value filter/projection tests.
- `test/workspaceBackend.test.js`: backend service use cases.
- `test/workspaceServiceClient.test.js`: client forwarding tests.
- `test/sidecarClient.test.js`: sidecar route tests.
- `test/workspaceAppState.test.js`: renderer state update tests.
- `test/dashboardStructure.test.js`: product UI structure tests.
- `internal/workspacestore/store_test.go`: Go persistence tests.

## Backend Plan

### Task 1: Service Contract Boundary

**Files:**

- Modify: `src/workspaceServiceClient.js`
- Modify: `electron/preload.cjs`
- Modify: `test/workspaceServiceClient.test.js`
- Modify: `test/runtimeMode.test.js`

- [ ] **Step 1: Write failing service-client tests**

Add assertions that `WorkspaceServiceClient` forwards:

```js
await client.listProperties({ workspaceId: "workspace:ops" });
await client.createProperty({ workspaceId: "workspace:ops", name: "Priority", type: "select" });
await client.updateProperty({ workspaceId: "workspace:ops", propertyId: "property:priority", patch: { name: "Urgency" } });
await client.reorderProperties({ workspaceId: "workspace:ops", orderedPropertyIds: ["property:name", "property:status", "property:priority"] });
await client.deleteProperty({ workspaceId: "workspace:ops", propertyId: "property:priority", confirmDeleteValues: true });
await client.createSelectValue({ workspaceId: "workspace:ops", propertyId: "property:priority", name: "High", color: "red" });
await client.updateSelectValue({ workspaceId: "workspace:ops", selectValueId: "selectValue:priority:high", patch: { name: "Critical" } });
await client.reorderSelectValues({ workspaceId: "workspace:ops", propertyId: "property:priority", orderedSelectValueIds: ["selectValue:priority:high"] });
await client.deleteSelectValue({ workspaceId: "workspace:ops", selectValueId: "selectValue:priority:high", confirmDeleteUsages: true });
await client.updateProjectPropertyValue({ workspaceId: "workspace:ops", projectId: "project:alpha", propertyId: "property:priority", value: "selectValue:priority:high" });
```

- [ ] **Step 2: Run failing test**

```bash
node --test test/workspaceServiceClient.test.js
```

Expected: fails because methods do not exist.

- [ ] **Step 3: Add service methods and preload allowlist**

Implement methods in `src/workspaceServiceClient.js` and add the same method names to `electron/preload.cjs` allowed methods.

- [ ] **Step 4: Verify**

```bash
node --test test/workspaceServiceClient.test.js test/runtimeMode.test.js
git --no-pager diff --check
```

- [ ] **Step 5: Commit**

```bash
git add src/workspaceServiceClient.js electron/preload.cjs test/workspaceServiceClient.test.js test/runtimeMode.test.js
git commit -m "Add workspace property service methods"
```

### Task 2: Property Domain Normalization

**Files:**

- Modify: `src/workspaceProperties.js`
- Modify: `test/workspaceProperties.test.js`

- [ ] **Step 1: Write failing tests for supported property types**

Add tests for:

- `text` normalizes null to `""`;
- `number` normalizes empty string to `null` and rejects `NaN`;
- `date` accepts only valid `YYYY-MM-DD`;
- `select` accepts one non-empty select value id or `null`;
- `multi-select` deduplicates ids and removes empty values;
- property definitions reject unsupported types;
- system properties are marked immutable by helper output.

- [ ] **Step 2: Run failing test**

```bash
node --test test/workspaceProperties.test.js
```

Expected: fails for helpers not yet implemented or exported.

- [ ] **Step 3: Implement pure helpers**

Extend `src/workspaceProperties.js` with exported helpers:

```js
export const customPropertyTypeIds = ["text", "number", "date", "select", "multi-select"];
export const systemPropertyIds = ["property:name", "property:status"];
export function normalizePropertyDefinition(input, context) {}
export function normalizeSelectValue(input, context) {}
export function normalizeProjectPropertyValue({ property, value, selectValues }) {}
export function isSystemPropertyId(propertyId) {}
```

The implementation must be pure and must not import filesystem, Electron, React, or sidecar code.

- [ ] **Step 4: Verify**

```bash
node --test test/workspaceProperties.test.js
git --no-pager diff --check
```

- [ ] **Step 5: Commit**

```bash
git add src/workspaceProperties.js test/workspaceProperties.test.js
git commit -m "Add custom property normalization helpers"
```

### Task 3: any-store Property Documents

**Files:**

- Modify: `internal/workspacestore/store.go`
- Modify: `internal/workspacestore/store_test.go`

- [ ] **Step 1: Write failing Go persistence tests**

Add tests for:

- upsert/list active property definitions by `workspaceId`;
- soft-delete property definition;
- upsert/list active select values by `propertyId`;
- soft-delete select value;
- upsert/list property values by `workspaceId`;
- append/list property history by `workspaceId`;
- deleted documents are excluded from active list methods.

- [ ] **Step 2: Run failing Go tests**

```bash
go test ./internal/workspacestore
```

Expected: fails because document structs and store methods do not exist.

- [ ] **Step 3: Implement Go document structs**

Add structs:

```go
type PropertyDefinitionDocument struct {}
type SelectValueDocument struct {}
type PropertyHistoryDocument struct {}
```

Keep existing `PropertyValueDocument` compatible, adding fields only if existing tests are updated intentionally.

- [ ] **Step 4: Implement store methods**

Add methods:

```go
UpsertPropertyDefinition(ctx context.Context, doc PropertyDefinitionDocument) error
ListPropertyDefinitions(ctx context.Context, workspaceID string) ([]PropertyDefinitionDocument, error)
UpsertSelectValue(ctx context.Context, doc SelectValueDocument) error
ListSelectValues(ctx context.Context, workspaceID string, propertyID string) ([]SelectValueDocument, error)
AppendPropertyHistory(ctx context.Context, doc PropertyHistoryDocument) error
ListPropertyHistory(ctx context.Context, workspaceID string) ([]PropertyHistoryDocument, error)
```

- [ ] **Step 5: Verify**

```bash
go test ./internal/workspacestore
go test ./...
git --no-pager diff --check
```

- [ ] **Step 6: Commit**

```bash
git add internal/workspacestore/store.go internal/workspacestore/store_test.go
git commit -m "Persist workspace custom property documents"
```

### Task 4: Sidecar HTTP Routes And JS Transport

**Files:**

- Modify: `cmd/workspace-sidecar/main.go`
- Modify: `src/workspaceSidecarClient.js`
- Modify: `test/sidecarClient.test.js`

- [ ] **Step 1: Write failing sidecar transport tests**

Add route assertions for:

- `workspace.listProperties` -> `GET /workspace/properties?workspaceId=...`
- `workspace.createProperty` -> `POST /workspace/properties`
- `workspace.updateProperty` -> `PATCH /workspace/properties`
- `workspace.deleteProperty` -> `DELETE /workspace/properties`
- `workspace.createSelectValue` -> `POST /workspace/select-values`
- `workspace.updateSelectValue` -> `PATCH /workspace/select-values`
- `workspace.deleteSelectValue` -> `DELETE /workspace/select-values`
- `workspace.updateProjectPropertyValue` -> `PUT /workspace/property-values`

- [ ] **Step 2: Run failing Node test**

```bash
node --test test/sidecarClient.test.js
```

Expected: fails with unsupported sidecar methods.

- [ ] **Step 3: Add sidecar route mapping**

Extend `src/workspaceSidecarClient.js` route mapping without changing React-facing contracts.

- [ ] **Step 4: Add local HTTP handlers**

Add handlers in `cmd/workspace-sidecar/main.go` that decode request JSON, call `workspacestore.Store`, and return JSON.

- [ ] **Step 5: Verify**

```bash
node --test test/sidecarClient.test.js
go test ./...
GOFLAGS=-buildvcs=false npm run build:sidecar
git --no-pager diff --check
```

- [ ] **Step 6: Commit**

```bash
git add cmd/workspace-sidecar/main.go src/workspaceSidecarClient.js test/sidecarClient.test.js
git commit -m "Add custom property sidecar routes"
```

### Task 5: Backend Use Cases And Projection

**Files:**

- Create: `src/workspacePropertyStore.js`
- Modify: `src/workspaceBackend.js`
- Modify: `src/workspaceViews.js`
- Modify: `electron/workspaceIpc.js`
- Modify: `test/workspaceBackend.test.js`
- Modify: `test/workspaceViews.test.js`
- Modify: `test/workspaceIpc.test.js`

- [ ] **Step 1: Write failing backend tests**

Add tests that:

- create a `Text` property and list it;
- create a `Numbers` property and update a project value to `42`;
- create a `Date` property and reject an invalid date;
- create `Select` values and update a project value;
- create `Multi-select` values and update a project with two values;
- include custom properties in `workspace.getViewProjection`;
- filter projections by `Select` and `Multi-select` value visibility;
- reject system property value updates.

- [ ] **Step 2: Run failing tests**

```bash
node --test test/workspaceBackend.test.js test/workspaceViews.test.js test/workspaceIpc.test.js
```

Expected: fails because use cases and projection wiring are missing.

- [ ] **Step 3: Implement backend use-case module**

Create `src/workspacePropertyStore.js` with use-case functions:

```js
export async function listWorkspaceProperties(context) {}
export async function createWorkspaceProperty(context) {}
export async function updateWorkspaceProperty(context) {}
export async function deleteWorkspaceProperty(context) {}
export async function createWorkspaceSelectValue(context) {}
export async function updateWorkspaceSelectValue(context) {}
export async function deleteWorkspaceSelectValue(context) {}
export async function updateProjectPropertyValue(context) {}
```

Each function must validate Workspace ownership and write history for durable mutations.

- [ ] **Step 4: Wire Electron IPC**

Dispatch the new service methods in `electron/workspaceIpc.js`. Keep React-facing payloads matching `docs/api/workspace-properties.md`.

- [ ] **Step 5: Wire projection**

Extend `workspace.getViewProjection` so `visibleProperties`, `selectValues`, and project `propertyValues` include persisted custom property data.

- [ ] **Step 6: Verify**

```bash
node --test test/workspaceBackend.test.js test/workspaceViews.test.js test/workspaceIpc.test.js
npm test
git --no-pager diff --check
```

- [ ] **Step 7: Commit**

```bash
git add src/workspacePropertyStore.js src/workspaceBackend.js src/workspaceViews.js electron/workspaceIpc.js test/workspaceBackend.test.js test/workspaceViews.test.js test/workspaceIpc.test.js
git commit -m "Wire custom properties into workspace projection"
```

### Task 6: Compatibility And Migration Guardrails

**Files:**

- Modify: `src/workspaceBackend.js`
- Modify: `electron/workspaceIpc.js`
- Modify: `test/workspaceCompatibility.test.js`
- Modify: `test/workspaceBackend.test.js`

- [ ] **Step 1: Write failing compatibility tests**

Add tests that:

- `workspace.saveProperty` aliases to `workspace.updateProjectPropertyValue` where possible;
- `workspace.listPropertyValues` still returns stored values for compatibility;
- legacy `.workspace/properties.json` can be read for migration without becoming the write path;
- corrupt current `.workspace/properties.json` is not migrated over good `any-store` data.

- [ ] **Step 2: Run failing tests**

```bash
node --test test/workspaceCompatibility.test.js test/workspaceBackend.test.js
```

- [ ] **Step 3: Implement compatibility layer**

Keep old method behavior predictable while new UI uses the new service methods.

- [ ] **Step 4: Verify**

```bash
npm test
git --no-pager diff --check
```

- [ ] **Step 5: Commit**

```bash
git add src/workspaceBackend.js electron/workspaceIpc.js test/workspaceCompatibility.test.js test/workspaceBackend.test.js
git commit -m "Preserve custom property compatibility paths"
```

## Frontend Plan

### Task 7: Renderer State For Custom Properties

**Files:**

- Modify: `src/workspaceAppState.ts`
- Modify: `src/types/workspace-service-client.d.ts`
- Modify: `test/workspaceAppState.test.js`

- [ ] **Step 1: Write failing renderer state tests**

Add tests for:

- loading `visibleProperties` with custom property definitions;
- applying an updated project property value to the active projection;
- preserving selected project panel state after value update;
- surfacing save errors without clearing Board/Table data.

- [ ] **Step 2: Run failing tests**

```bash
node --test test/workspaceAppState.test.js
```

- [ ] **Step 3: Implement app-state transitions**

Add typed state transitions for property list load, property mutation success, property mutation error, and projection refresh after save.

- [ ] **Step 4: Verify**

```bash
node --test test/workspaceAppState.test.js
npm run typecheck
git --no-pager diff --check
```

- [ ] **Step 5: Commit**

```bash
git add src/workspaceAppState.ts src/types/workspace-service-client.d.ts test/workspaceAppState.test.js
git commit -m "Add custom property renderer state"
```

### Task 8: Settings Property Management UI

**Files:**

- Modify: `src/components/workspace/settings-view.tsx`
- Create if needed: `src/components/workspace/property-controls.tsx`
- Modify: `test/dashboardStructure.test.js`

- [ ] **Step 1: Write failing UI structure tests**

Assert Settings renders:

- Add property button;
- property type menu with `Text`, `Numbers`, `Date`, `Select`, `Multi-select`;
- rename action;
- hide/show action;
- delete action;
- reorder affordance.

- [ ] **Step 2: Run failing test**

```bash
node --test test/dashboardStructure.test.js
```

- [ ] **Step 3: Implement Settings property section**

Use shadcn `Button`, `Input`, `Select`, `DropdownMenu`, `Badge`, and `Separator`. Do not call sidecar directly; use `WorkspaceServiceClient` actions passed from app shell.

- [ ] **Step 4: Verify focused tests**

```bash
node --test test/dashboardStructure.test.js
npm run typecheck
npm run build:renderer
git --no-pager diff --check
```

- [ ] **Step 5: Open app and visually verify Settings**

Run:

```bash
npm run electron
```

Verify:

- Settings opens from the Left Panel.
- Property management is visible in Settings, not on the main Board surface.
- Type menu labels fit.
- Rename/delete/hide/reorder controls are reachable.
- No text overlap at desktop size.

Capture a Settings screenshot or equivalent visual evidence.

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace/settings-view.tsx src/components/workspace/property-controls.tsx test/dashboardStructure.test.js
git commit -m "Add settings custom property controls"
```

### Task 9: Select Value Management UI

**Files:**

- Modify: `src/components/workspace/property-controls.tsx`
- Modify: `src/components/workspace/settings-view.tsx`
- Modify: `test/dashboardStructure.test.js`

- [ ] **Step 1: Write failing UI tests**

Assert Settings supports:

- add select value;
- rename select value;
- color menu;
- hide/show select value;
- delete select value;
- reorder select values.

- [ ] **Step 2: Run failing test**

```bash
node --test test/dashboardStructure.test.js
```

- [ ] **Step 3: Implement select value controls**

Use colored `Badge` previews and compact controls. Hide select value management for non-select property types.

- [ ] **Step 4: Verify**

```bash
node --test test/dashboardStructure.test.js
npm run typecheck
npm run build:renderer
git --no-pager diff --check
```

- [ ] **Step 5: Open app and visually verify select values**

Run:

```bash
npm run electron
```

Verify:

- Select and Multi-select properties expose value management.
- Text, Numbers, and Date properties do not show value-option controls.
- Color badges render clearly.
- Delete confirmation appears for destructive value actions.

Capture a Settings select-value screenshot or equivalent visual evidence.

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace/property-controls.tsx src/components/workspace/settings-view.tsx test/dashboardStructure.test.js
git commit -m "Add select value management controls"
```

### Task 10: Project Detail Panel Value Editors

**Files:**

- Modify: `src/components/workspace/project-detail-panel.tsx`
- Modify: `test/dashboardStructure.test.js`

- [ ] **Step 1: Write failing UI tests**

Assert Project Detail Panel includes type-specific editors:

- text input for `text`;
- number input for `number`;
- date input for `date`;
- single-value select menu for `select`;
- multi-value controls for `multi-select`.

- [ ] **Step 2: Run failing test**

```bash
node --test test/dashboardStructure.test.js
```

- [ ] **Step 3: Implement editors**

Editors must call `workspace.updateProjectPropertyValue` through app callbacks. Keep `Name` and `Status` read-only.

- [ ] **Step 4: Verify**

```bash
node --test test/dashboardStructure.test.js
npm run typecheck
npm run build:renderer
git --no-pager diff --check
```

- [ ] **Step 5: Open app and visually verify Project Detail Panel**

Run:

```bash
npm run electron
```

Verify:

- Clicking a Board card opens the panel.
- Clicking a Table row opens the panel.
- All five custom property editor types render.
- Saving a value keeps the panel open.
- Failed save shows non-blocking error.
- File tree remains below Properties and stays usable.

Capture a Project Detail Panel screenshot or equivalent visual evidence.

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace/project-detail-panel.tsx test/dashboardStructure.test.js
git commit -m "Add project custom property editors"
```

### Task 11: Board, Table, View Visibility, And Value Filters

**Files:**

- Modify: `src/components/workspace/board-view.tsx`
- Modify: `src/components/workspace/table-view.tsx`
- Modify: `src/components/workspace/view-tabs.tsx`
- Create if needed: `src/components/workspace/view-filter-menu.tsx`
- Modify: `test/dashboardStructure.test.js`
- Modify: `test/workspaceAppState.test.js`

- [ ] **Step 1: Write failing tests**

Assert:

- Board cards render enabled custom properties;
- Table renders custom properties as columns;
- property visibility controls update active view;
- value filters can include select values;
- hidden properties are not shown in Board/Table but remain visible in Project Detail Panel.

- [ ] **Step 2: Run failing tests**

```bash
node --test test/dashboardStructure.test.js test/workspaceAppState.test.js
```

- [ ] **Step 3: Implement Board custom property display**

Cards should remain compact. Long text and values must truncate without resizing columns.

- [ ] **Step 4: Implement Table custom property columns**

Columns should follow active view property order and keep stable widths.

- [ ] **Step 5: Implement view property visibility and value filters**

Use `workspace.updateView` and existing view contracts. Do not mutate stored project values when changing view filters.

- [ ] **Step 6: Verify**

```bash
node --test test/dashboardStructure.test.js test/workspaceAppState.test.js
npm run typecheck
npm run build:renderer
git --no-pager diff --check
```

- [ ] **Step 7: Open app and visually verify Board/Table**

Run:

```bash
npm run electron
```

Verify:

- Board cards show selected custom properties.
- Board cards do not overflow column width.
- Table shows custom property columns.
- Table keeps right padding and no unwanted bottom/right gaps.
- View filter menu changes visible projects without full-screen flicker.
- Search remains Name-only and composes with value filters.

Capture Board and Table screenshots or equivalent visual evidence.

- [ ] **Step 8: Commit**

```bash
git add src/components/workspace/board-view.tsx src/components/workspace/table-view.tsx src/components/workspace/view-tabs.tsx src/components/workspace/view-filter-menu.tsx test/dashboardStructure.test.js test/workspaceAppState.test.js
git commit -m "Show custom properties in workspace views"
```

### Task 12: End-To-End Verification And Polish

**Files:**

- Modify only files required by defects discovered during final verification.

- [ ] **Step 1: Run full automated gates**

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
GOFLAGS=-buildvcs=false npm run build:sidecar
git --no-pager diff --check
```

Expected: all commands exit with code 0.

- [ ] **Step 2: Open Electron app**

```bash
npm run electron
```

- [ ] **Step 3: Execute manual scenario**

Use a local source folder with at least two status folders and several projects:

1. Open Settings.
2. Create `Text` property `Comment`.
3. Create `Numbers` property `Budget`.
4. Create `Date` property `Deadline`.
5. Create `Select` property `Priority` with values `High`, `Medium`, `Low`.
6. Create `Multi-select` property `Tags` with values `Design`, `Build`, `Waiting`.
7. Return to Board.
8. Open a project card.
9. Edit all five custom property values.
10. Confirm Board card updates visible properties.
11. Switch to Table.
12. Confirm custom property columns render.
13. Use view controls to hide one property.
14. Confirm hidden property disappears from Board/Table but remains in Project Detail Panel.
15. Add a select value filter.
16. Confirm non-matching projects are hidden.
17. Restart the Electron app.
18. Confirm definitions, select values, project values, and view settings persist.

- [ ] **Step 4: Capture visual evidence**

Capture screenshots or equivalent visual evidence for:

- Settings property management;
- Settings select value management;
- Board with custom properties;
- Table with custom property columns;
- Project Detail Panel editors.

Check at 1440x960 and 1024x720.

- [ ] **Step 5: Fix any visual defects**

If there is overlap, truncation failure, layout jump, or unusable control, write a focused failing test when practical, patch the UI, and repeat Steps 1-4.

- [ ] **Step 6: Final commit**

If polish fixes changed files:

```bash
git add <changed-files>
git commit -m "Polish custom property workflows"
```

If no files changed, do not create a commit.

## Final Acceptance Checklist

- [ ] Backend persists property definitions in `any-store`.
- [ ] Backend persists select values in `any-store`.
- [ ] Backend persists current property values in `any-store`.
- [ ] Backend appends property history records.
- [ ] Electron IPC exposes documented property methods.
- [ ] React calls `WorkspaceServiceClient`, not sidecar routes.
- [ ] Settings supports full property CRUD, hide/show, and reorder.
- [ ] Settings supports full select value CRUD, color, hide/show, and reorder.
- [ ] Board displays visible custom properties.
- [ ] Table displays visible custom properties.
- [ ] Project Detail Panel displays and edits custom property values.
- [ ] View filters support `Select` and `Multi-select` values.
- [ ] Automated quality gates pass.
- [ ] Electron app was opened and visually verified.
- [ ] Screenshots or equivalent visual evidence were captured.

## Self-Review

Spec coverage:

- The plan covers all five requested property types.
- Backend, sidecar, Electron IPC, renderer state, Settings UI, Board, Table, and Project Detail Panel are represented as separate tasks.
- Tests and verification are required at each slice.
- Frontend tasks explicitly require opening the Electron app before completion.

Known dependency:

- Backend/storage tasks must land before frontend tasks that depend on durable property documents. If frontend starts earlier, it may use deterministic mock projection only for UI structure tests, not as product persistence.
