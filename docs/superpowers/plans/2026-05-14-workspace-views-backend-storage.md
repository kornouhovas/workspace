# Workspace Views Backend And Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend and local storage foundation for Workspace Board/Table views, including service methods, view validation, persistence, filtering, and Board/Table projection helpers.

**Architecture:** Keep React thin: UI-facing calls go through `WorkspaceServiceClient`, domain rules live in backend/pure modules, and durable local data lives behind the `any-store` sidecar. Implement view logic as testable pure helpers first, then wire storage and backend orchestration around those helpers.

**Tech Stack:** Node.js ESM, Node test runner, Electron local backend modules, Go sidecar, `any-store` over SQLite.

---

## Specs To Keep Open

- `docs/backlog/workspace-views-backend-storage.md`
- `docs/api/workspace-views.md`
- `docs/data-model.md`
- `docs/architecture.md`
- `docs/flows/board-table-views.md`
- `AGENTS.md`

## File Structure

Create:

- `src/workspaceViews.js` - pure view normalization, validation, filtering, and projection helpers.
- `test/workspaceViews.test.js` - focused tests for view helper behavior.

Modify:

- `src/workspaceServiceClient.js` - add UI-facing view service methods.
- `src/workspaceSidecarClient.js` - map storage-backed view methods to local sidecar routes if the implementation uses this transport.
- `src/workspaceBackend.js` - add backend response/use-case wrappers for view operations.
- `test/workspaceServiceClient.test.js` - verify method forwarding.
- `test/sidecarClient.test.js` - verify route mappings for any new sidecar transport methods.
- `test/workspaceBackend.test.js` - verify backend view use cases.
- `internal/workspacestore/store.go` - add Workspace/View document persistence methods.
- `internal/workspacestore/store_test.go` - verify persistence and compatibility with `workspace:root`.
- `cmd/workspace-sidecar/main.go` - add local HTTP handlers for view document storage if needed.

Do not modify:

- React components.
- UI styling.
- Folder role semantics.
- Project folder files on disk.

## Task 1: Add WorkspaceServiceClient View Methods

**Files:**

- Modify: `test/workspaceServiceClient.test.js`
- Modify: `src/workspaceServiceClient.js`

- [ ] **Step 1: Write the failing forwarding assertions**

Add these calls to the existing `WorkspaceServiceClient sends named service methods through transport` test after `listPropertyValues` and before `reveal`:

```js
  assert.deepEqual(await client.listViews({ workspaceId: "workspace:root" }), {
    method: "workspace.listViews",
    payload: { workspaceId: "workspace:root" },
  });
  assert.deepEqual(await client.createView({
    workspaceId: "workspace:root",
    viewType: "board",
    name: "Board",
  }), {
    method: "workspace.createView",
    payload: {
      workspaceId: "workspace:root",
      viewType: "board",
      name: "Board",
    },
  });
  assert.deepEqual(await client.setActiveView({
    workspaceId: "workspace:root",
    viewId: "view:board",
  }), {
    method: "workspace.setActiveView",
    payload: { workspaceId: "workspace:root", viewId: "view:board" },
  });
  assert.deepEqual(await client.updateView({
    workspaceId: "workspace:root",
    viewId: "view:board",
    patch: { name: "Priority Board" },
  }), {
    method: "workspace.updateView",
    payload: {
      workspaceId: "workspace:root",
      viewId: "view:board",
      patch: { name: "Priority Board" },
    },
  });
  assert.deepEqual(await client.reorderViews({
    workspaceId: "workspace:root",
    orderedViewIds: ["view:board", "view:table"],
  }), {
    method: "workspace.reorderViews",
    payload: {
      workspaceId: "workspace:root",
      orderedViewIds: ["view:board", "view:table"],
    },
  });
  assert.deepEqual(await client.deleteView({
    workspaceId: "workspace:root",
    viewId: "view:board",
  }), {
    method: "workspace.deleteView",
    payload: { workspaceId: "workspace:root", viewId: "view:board" },
  });
  assert.deepEqual(await client.getViewProjection({
    workspaceId: "workspace:root",
    viewId: "view:table",
    searchQuery: "alpha",
  }), {
    method: "workspace.getViewProjection",
    payload: {
      workspaceId: "workspace:root",
      viewId: "view:table",
      searchQuery: "alpha",
    },
  });
```

Also add the same method/payload pairs to the final `transport.calls` assertion.

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
node --test test/workspaceServiceClient.test.js
```

Expected: fail with `client.listViews is not a function`.

- [ ] **Step 3: Add minimal client methods**

Add these methods to `src/workspaceServiceClient.js`:

```js
  listViews(payload) {
    return this.request("workspace.listViews", payload);
  }

  createView(payload) {
    return this.request("workspace.createView", payload);
  }

  setActiveView(payload) {
    return this.request("workspace.setActiveView", payload);
  }

  updateView(payload) {
    return this.request("workspace.updateView", payload);
  }

  reorderViews(payload) {
    return this.request("workspace.reorderViews", payload);
  }

  deleteView(payload) {
    return this.request("workspace.deleteView", payload);
  }

  getViewProjection(payload) {
    return this.request("workspace.getViewProjection", payload);
  }
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```bash
node --test test/workspaceServiceClient.test.js
```

Expected: all tests in `test/workspaceServiceClient.test.js` pass.

- [ ] **Step 5: Commit**

```bash
git add src/workspaceServiceClient.js test/workspaceServiceClient.test.js
git commit -m "Add workspace view service client methods"
```

## Task 2: Add Pure View Defaults And Validation

**Files:**

- Create: `src/workspaceViews.js`
- Create: `test/workspaceViews.test.js`

- [ ] **Step 1: Write failing tests for default views and required fields**

Create `test/workspaceViews.test.js` with:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultView,
  normalizeViewDocument,
  validateViewPatch,
  WorkspaceViewError,
} from "../src/workspaceViews.js";

test("createDefaultView creates Board and Table views with required system properties", () => {
  const board = createDefaultView({
    workspaceId: "workspace:root",
    viewType: "board",
    name: "Board",
    id: "view:board",
    order: 10,
    now: "2026-05-14T00:00:00.000Z",
  });
  const table = createDefaultView({
    workspaceId: "workspace:root",
    viewType: "table",
    name: "",
    id: "view:table",
    order: 20,
    now: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(board.viewType, "board");
  assert.equal(board.name, "Board");
  assert.deepEqual(board.visiblePropertyIds, ["property:name", "property:status"]);
  assert.deepEqual(board.propertyOrder, {
    "property:name": 10,
    "property:status": 20,
  });
  assert.equal(table.viewType, "table");
  assert.equal(table.name, "Table");
  assert.deepEqual(table.visiblePropertyIds, ["property:name", "property:status"]);
});

test("createDefaultView rejects invalid view types", () => {
  assert.throws(
    () => createDefaultView({
      workspaceId: "workspace:root",
      viewType: "calendar",
      id: "view:bad",
      now: "2026-05-14T00:00:00.000Z",
    }),
    (error) => error instanceof WorkspaceViewError && error.code === "INVALID_VIEW_TYPE",
  );
});

test("normalizeViewDocument preserves known fields and required system properties", () => {
  const view = normalizeViewDocument({
    id: "view:board",
    workspaceId: "workspace:root",
    name: "Priority Board",
    viewType: "board",
    order: "40",
    visiblePropertyIds: ["property:priority", "property:name", "property:status", "property:priority"],
    valueVisibility: {
      "property:priority": {
        mode: "include",
        valueIds: ["selectValue:high", "selectValue:medium", "selectValue:high"],
        includeEmpty: false,
      },
    },
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:00.000Z",
  });

  assert.deepEqual(view.visiblePropertyIds, ["property:name", "property:status", "property:priority"]);
  assert.equal(view.order, 40);
  assert.deepEqual(view.valueVisibility["property:priority"], {
    mode: "include",
    valueIds: ["selectValue:high", "selectValue:medium"],
    includeEmpty: false,
  });
});

test("validateViewPatch rejects removal of required system properties", () => {
  assert.throws(
    () => validateViewPatch({
      patch: {
        visiblePropertyIds: ["property:name", "property:priority"],
      },
      propertyDefinitions: [
        { id: "property:name", type: "text", system: true },
        { id: "property:status", type: "select", system: true },
        { id: "property:priority", type: "select", system: false },
      ],
      selectValues: [],
      statusValues: [{ id: "statusValue:no-status" }],
    }),
    (error) => error instanceof WorkspaceViewError && error.code === "INVALID_PROPERTY_REFERENCE",
  );
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
node --test test/workspaceViews.test.js
```

Expected: fail because `src/workspaceViews.js` does not exist.

- [ ] **Step 3: Implement minimal view defaults and validation**

Create `src/workspaceViews.js` with these exports:

```js
import { randomUUID } from "node:crypto";

export const PROPERTY_NAME_ID = "property:name";
export const PROPERTY_STATUS_ID = "property:status";
export const NO_STATUS_VALUE_ID = "statusValue:no-status";
export const viewTypeIds = ["board", "table"];

export class WorkspaceViewError extends Error {
  constructor(code, message, field) {
    super(message);
    this.name = "WorkspaceViewError";
    this.code = code;
    this.field = field;
  }
}

export function createDefaultView({
  workspaceId,
  viewType,
  name,
  id = `view:${randomUUID()}`,
  order = 10,
  now = new Date().toISOString(),
} = {}) {
  if (!viewTypeIds.includes(viewType)) {
    throw new WorkspaceViewError("INVALID_VIEW_TYPE", "View type must be board or table.", "viewType");
  }

  const normalizedName = normalizeString(name).trim() || (viewType === "board" ? "Board" : "Table");
  return normalizeViewDocument({
    id,
    type: "view",
    schemaVersion: 1,
    workspaceId: normalizeRequiredString(workspaceId, "workspaceId"),
    name: normalizedName,
    viewType,
    order,
    visiblePropertyIds: [PROPERTY_NAME_ID, PROPERTY_STATUS_ID],
    hiddenPropertyIds: [],
    propertyOrder: {
      [PROPERTY_NAME_ID]: 10,
      [PROPERTY_STATUS_ID]: 20,
    },
    valueVisibility: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

export function normalizeViewDocument(view = {}) {
  const viewType = viewTypeIds.includes(view.viewType) ? view.viewType : "board";
  const visiblePropertyIds = normalizeVisiblePropertyIds(view.visiblePropertyIds);

  return {
    id: normalizeString(view.id),
    type: "view",
    schemaVersion: Number.isFinite(Number(view.schemaVersion)) ? Number(view.schemaVersion) : 1,
    workspaceId: normalizeString(view.workspaceId),
    name: normalizeString(view.name).trim() || (viewType === "board" ? "Board" : "Table"),
    viewType,
    order: normalizeOrder(view.order),
    visiblePropertyIds,
    hiddenPropertyIds: normalizeStringArray(view.hiddenPropertyIds).filter((id) => !visiblePropertyIds.includes(id)),
    propertyOrder: normalizePropertyOrder(view.propertyOrder, visiblePropertyIds),
    valueVisibility: normalizeValueVisibility(view.valueVisibility),
    createdAt: normalizeString(view.createdAt),
    updatedAt: normalizeString(view.updatedAt),
    deletedAt: view.deletedAt == null ? null : normalizeString(view.deletedAt),
  };
}

export function validateViewPatch({ patch = {}, propertyDefinitions = [], selectValues = [], statusValues = [] } = {}) {
  if (!isPlainObject(patch)) {
    throw new WorkspaceViewError("VALIDATION_FAILED", "View patch must be an object.", "patch");
  }

  const forbiddenKeys = ["id", "workspaceId", "type", "schemaVersion", "createdAt", "deletedAt"];
  for (const key of forbiddenKeys) {
    if (Object.hasOwn(patch, key)) {
      throw new WorkspaceViewError("VALIDATION_FAILED", `View patch cannot update ${key}.`, key);
    }
  }

  if (Object.hasOwn(patch, "viewType")) {
    throw new WorkspaceViewError("INVALID_VIEW_TYPE", "View type cannot be changed in MVP.", "viewType");
  }

  const propertyIds = new Set(propertyDefinitions.filter((item) => !item.deletedAt).map((item) => item.id));
  const visiblePropertyIds = Object.hasOwn(patch, "visiblePropertyIds")
    ? normalizeVisiblePropertyIds(patch.visiblePropertyIds)
    : [PROPERTY_NAME_ID, PROPERTY_STATUS_ID];

  for (const requiredId of [PROPERTY_NAME_ID, PROPERTY_STATUS_ID]) {
    if (!visiblePropertyIds.includes(requiredId)) {
      throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", `${requiredId} is required in MVP.`, "visiblePropertyIds");
    }
  }

  for (const propertyId of visiblePropertyIds) {
    if (!propertyIds.has(propertyId)) {
      throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", "Visible property does not exist.", "visiblePropertyIds");
    }
  }

  validateValueVisibilityReferences({
    valueVisibility: patch.valueVisibility,
    propertyDefinitions,
    selectValues,
    statusValues,
  });
}
```

Add local helper functions in the same file:

```js
function normalizeVisiblePropertyIds(value) {
  const ids = normalizeStringArray(value);
  return uniqueStrings([PROPERTY_NAME_ID, PROPERTY_STATUS_ID, ...ids]);
}

function normalizeValueVisibility(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([propertyId, setting]) => typeof propertyId === "string" && isPlainObject(setting))
      .map(([propertyId, setting]) => [
        propertyId,
        {
          mode: "include",
          valueIds: uniqueStrings(normalizeStringArray(setting.valueIds)),
          includeEmpty: setting.includeEmpty === true,
        },
      ])
      .filter(([, setting]) => setting.valueIds.length > 0 || setting.includeEmpty),
  );
}

function validateValueVisibilityReferences({ valueVisibility, propertyDefinitions, selectValues, statusValues }) {
  const normalized = normalizeValueVisibility(valueVisibility);
  const propertiesById = new Map(propertyDefinitions.filter((item) => !item.deletedAt).map((item) => [item.id, item]));
  const selectValuesByProperty = new Map();
  for (const value of selectValues.filter((item) => !item.deletedAt)) {
    const values = selectValuesByProperty.get(value.propertyId) || new Set();
    values.add(value.id);
    selectValuesByProperty.set(value.propertyId, values);
  }
  const statusValueIds = new Set(statusValues.map((item) => item.id));

  for (const [propertyId, setting] of Object.entries(normalized)) {
    const property = propertiesById.get(propertyId);
    if (!property) {
      throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", "Filter property does not exist.", "valueVisibility");
    }

    if (propertyId === PROPERTY_STATUS_ID) {
      for (const valueId of setting.valueIds) {
        if (!statusValueIds.has(valueId)) {
          throw new WorkspaceViewError("INVALID_VALUE_REFERENCE", "Status filter value does not exist.", "valueVisibility");
        }
      }
      continue;
    }

    if (property.type !== "select" && property.type !== "multi-select") {
      throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", "Only select properties can be filtered by value.", "valueVisibility");
    }

    const allowedValues = selectValuesByProperty.get(propertyId) || new Set();
    for (const valueId of setting.valueIds) {
      if (!allowedValues.has(valueId)) {
        throw new WorkspaceViewError("INVALID_VALUE_REFERENCE", "Select filter value does not exist for property.", "valueVisibility");
      }
    }
  }
}

function normalizePropertyOrder(value, visiblePropertyIds) {
  const input = isPlainObject(value) ? value : {};
  return Object.fromEntries(visiblePropertyIds.map((propertyId, index) => [
    propertyId,
    normalizeOrder(input[propertyId], (index + 1) * 10),
  ]));
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? uniqueStrings(value.map(normalizeString).filter(Boolean)) : [];
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value !== ""))];
}

function normalizeString(value) {
  return value == null ? "" : String(value);
}

function normalizeRequiredString(value, field) {
  const text = normalizeString(value).trim();
  if (!text) {
    throw new WorkspaceViewError("VALIDATION_FAILED", `${field} is required.`, field);
  }
  return text;
}

function normalizeOrder(value, fallback = 0) {
  const order = Number(value);
  return Number.isFinite(order) ? order : fallback;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```bash
node --test test/workspaceViews.test.js
```

Expected: all tests in `test/workspaceViews.test.js` pass.

- [ ] **Step 5: Commit**

```bash
git add src/workspaceViews.js test/workspaceViews.test.js
git commit -m "Add workspace view defaults and validation"
```

## Task 3: Add Pure Filtering And Projection Helpers

**Files:**

- Modify: `src/workspaceViews.js`
- Modify: `test/workspaceViews.test.js`

- [ ] **Step 1: Write failing tests for filters, search, Board, and Table**

Update the existing import from `../src/workspaceViews.js` in `test/workspaceViews.test.js` so it also imports:

```js
  createViewProjection,
  filterProjectsForView,
```

Then append these tests:

```js
test("filterProjectsForView applies search by Name only and select value filters", () => {
  const view = normalizeViewDocument({
    id: "view:board",
    workspaceId: "workspace:root",
    viewType: "board",
    visiblePropertyIds: ["property:name", "property:status", "property:priority"],
    valueVisibility: {
      "property:priority": {
        mode: "include",
        valueIds: ["selectValue:high"],
        includeEmpty: false,
      },
    },
  });
  const projects = [
    {
      id: "project:alpha",
      name: "Alpha Launch",
      status: { id: "statusValue:active", name: "Active" },
      propertyValues: {
        "property:name": "Alpha Launch",
        "property:status": "statusValue:active",
        "property:priority": "selectValue:high",
        "property:notes": "do not search me",
      },
    },
    {
      id: "project:beta",
      name: "Beta",
      status: { id: "statusValue:active", name: "Active" },
      propertyValues: {
        "property:name": "Beta",
        "property:status": "statusValue:active",
        "property:priority": "selectValue:low",
        "property:notes": "Alpha hidden text",
      },
    },
  ];

  assert.deepEqual(
    filterProjectsForView({ projects, view, searchQuery: "alpha" }).map((project) => project.id),
    ["project:alpha"],
  );
});

test("filterProjectsForView supports system Status filters and No status", () => {
  const view = normalizeViewDocument({
    id: "view:board",
    workspaceId: "workspace:root",
    viewType: "board",
    valueVisibility: {
      "property:status": {
        mode: "include",
        valueIds: ["statusValue:no-status"],
      },
    },
  });

  const projects = [
    {
      id: "project:active",
      name: "Active Project",
      status: { id: "statusValue:active", name: "Active" },
      propertyValues: { "property:status": "statusValue:active" },
    },
    {
      id: "project:none",
      name: "No Status Project",
      status: { id: "statusValue:no-status", name: "No status" },
      propertyValues: { "property:status": "statusValue:no-status" },
    },
  ];

  assert.deepEqual(
    filterProjectsForView({ projects, view }).map((project) => project.id),
    ["project:none"],
  );
});

test("createViewProjection returns board columns and table rows from the same filtered project set", () => {
  const visibleProperties = [
    { id: "property:name", name: "Name", type: "text", system: true },
    { id: "property:status", name: "Status", type: "select", system: true },
  ];
  const statusValues = [
    { id: "statusValue:active", name: "Active", relativePath: "Active", source: "folderRole" },
    { id: "statusValue:no-status", name: "No status", relativePath: null, source: "no-status" },
  ];
  const projects = [
    { id: "project:alpha", name: "Alpha", status: statusValues[0], propertyValues: {} },
    { id: "project:none", name: "Loose", status: statusValues[1], propertyValues: {} },
  ];

  const boardView = normalizeViewDocument({ id: "view:board", workspaceId: "workspace:root", viewType: "board" });
  const tableView = normalizeViewDocument({ id: "view:table", workspaceId: "workspace:root", viewType: "table" });

  assert.deepEqual(
    createViewProjection({ view: boardView, projects, visibleProperties, statusValues }).projection.columns.map((column) => [
      column.statusValueId,
      column.projects.map((project) => project.id),
    ]),
    [
      ["statusValue:active", ["project:alpha"]],
      ["statusValue:no-status", ["project:none"]],
    ],
  );
  assert.deepEqual(
    createViewProjection({ view: tableView, projects, visibleProperties, statusValues }).projection.rows.map((row) => row.id),
    ["project:alpha", "project:none"],
  );
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
node --test test/workspaceViews.test.js
```

Expected: fail because `filterProjectsForView` and `createViewProjection` are not exported.

- [ ] **Step 3: Implement filtering and projection exports**

Add to `src/workspaceViews.js`:

```js
export function filterProjectsForView({ projects = [], view, searchQuery = "" } = {}) {
  const normalizedView = normalizeViewDocument(view);
  const query = normalizeString(searchQuery).trim().toLocaleLowerCase();

  return projects.filter((project) => {
    const name = normalizeString(project.name ?? project.propertyValues?.[PROPERTY_NAME_ID]).toLocaleLowerCase();
    if (query && !name.includes(query)) {
      return false;
    }
    return matchesValueVisibility(project, normalizedView.valueVisibility);
  });
}

export function createViewProjection({
  view,
  projects = [],
  visibleProperties = [],
  statusValues = [],
  searchQuery = "",
} = {}) {
  const normalizedView = normalizeViewDocument(view);
  const filteredProjects = filterProjectsForView({ projects, view: normalizedView, searchQuery });

  const response = {
    workspaceId: normalizedView.workspaceId,
    view: {
      id: normalizedView.id,
      name: normalizedView.name,
      viewType: normalizedView.viewType,
    },
    visibleProperties,
    statusValues,
  };

  if (normalizedView.viewType === "table") {
    return {
      ...response,
      projection: {
        type: "table",
        rows: filteredProjects,
      },
    };
  }

  return {
    ...response,
    projection: {
      type: "board",
      capabilities: {
        canMoveBetweenStatuses: false,
      },
      columns: statusValues.map((statusValue) => ({
        statusValueId: statusValue.id,
        name: statusValue.name,
        projects: filteredProjects.filter((project) => project.status?.id === statusValue.id),
      })),
    },
  };
}

function matchesValueVisibility(project, valueVisibility) {
  for (const [propertyId, setting] of Object.entries(valueVisibility)) {
    const value = propertyId === PROPERTY_STATUS_ID
      ? project.status?.id ?? project.propertyValues?.[PROPERTY_STATUS_ID] ?? NO_STATUS_VALUE_ID
      : project.propertyValues?.[propertyId];

    if (propertyId === PROPERTY_STATUS_ID) {
      if (!setting.valueIds.includes(value)) {
        return false;
      }
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        if (!setting.includeEmpty) {
          return false;
        }
        continue;
      }
      if (!value.some((item) => setting.valueIds.includes(item))) {
        return false;
      }
      continue;
    }

    if (!value) {
      if (!setting.includeEmpty) {
        return false;
      }
      continue;
    }

    if (!setting.valueIds.includes(value)) {
      return false;
    }
  }

  return true;
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```bash
node --test test/workspaceViews.test.js
```

Expected: all tests in `test/workspaceViews.test.js` pass.

- [ ] **Step 5: Commit**

```bash
git add src/workspaceViews.js test/workspaceViews.test.js
git commit -m "Add workspace view filtering and projections"
```

## Task 4: Persist Workspace And View Documents In The Go Store

**Files:**

- Modify: `internal/workspacestore/store.go`
- Modify: `internal/workspacestore/store_test.go`

- [ ] **Step 1: Write failing Go persistence tests**

Add a new test to `internal/workspacestore/store_test.go`:

```go
func TestStorePersistsWorkspaceViewsWithoutBreakingRootDocument(t *testing.T) {
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), "workspace.db")

	store, err := Open(ctx, dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	if err := store.SetRoot(ctx, RootDocument{
		ID:       "workspace:other",
		RootPath: "/tmp/workspace-root",
		Name:     "workspace-root",
	}); err != nil {
		t.Fatal(err)
	}

	workspace := WorkspaceDocument{
		ID:           "workspace:ops",
		Type:         "workspace",
		SchemaVersion: 1,
		SourceFolderID: "projectSource:default",
		Name:         "Operations",
		Order:        10,
		ActiveViewID: "view:board",
		CreatedAt:    "2026-05-14T00:00:00.000Z",
		UpdatedAt:    "2026-05-14T00:00:00.000Z",
	}
	if err := store.UpsertWorkspace(ctx, workspace); err != nil {
		t.Fatal(err)
	}

	view := ViewDocument{
		ID:                 "view:board",
		Type:               "view",
		SchemaVersion:      1,
		WorkspaceID:        "workspace:ops",
		Name:               "Board",
		ViewType:           "board",
		Order:              10,
		VisiblePropertyIDs: []string{"property:name", "property:status"},
		HiddenPropertyIDs:  []string{},
		PropertyOrder:      map[string]int{"property:name": 10, "property:status": 20},
		ValueVisibility:    map[string]ValueVisibilityDocument{},
		CreatedAt:          "2026-05-14T00:00:00.000Z",
		UpdatedAt:          "2026-05-14T00:00:00.000Z",
	}
	if err := store.UpsertView(ctx, view); err != nil {
		t.Fatal(err)
	}

	views, err := store.ListViews(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 1 || views[0].ID != "view:board" {
		t.Fatalf("expected one active view, got %#v", views)
	}

	savedWorkspace, err := store.GetWorkspace(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if savedWorkspace.ActiveViewID != "view:board" {
		t.Fatalf("expected active view to persist, got %#v", savedWorkspace)
	}

	root, err := store.GetRoot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if root.ID != "workspace:root" || root.RootPath != "/tmp/workspace-root" {
		t.Fatalf("expected root document compatibility, got %#v", root)
	}
}
```

- [ ] **Step 2: Run focused Go tests and verify failure**

Run:

```bash
go test ./internal/workspacestore
```

Expected: fail because `WorkspaceDocument`, `ViewDocument`, and new store methods are undefined.

- [ ] **Step 3: Implement Workspace and View persistence**

Add these structs to `internal/workspacestore/store.go`:

```go
type WorkspaceDocument struct {
	ID             string  `json:"id"`
	Type           string  `json:"type"`
	SchemaVersion  int     `json:"schemaVersion"`
	SourceFolderID string  `json:"sourceFolderId"`
	Name           string  `json:"name"`
	Order          int     `json:"order"`
	ActiveViewID   string  `json:"activeViewId"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
	DeletedAt      *string `json:"deletedAt"`
}

type ValueVisibilityDocument struct {
	Mode         string   `json:"mode"`
	ValueIDs     []string `json:"valueIds"`
	IncludeEmpty bool     `json:"includeEmpty"`
}

type ViewDocument struct {
	ID                 string                             `json:"id"`
	Type               string                             `json:"type"`
	SchemaVersion      int                                `json:"schemaVersion"`
	WorkspaceID        string                             `json:"workspaceId"`
	Name               string                             `json:"name"`
	ViewType           string                             `json:"viewType"`
	Order              int                                `json:"order"`
	VisiblePropertyIDs []string                           `json:"visiblePropertyIds"`
	HiddenPropertyIDs  []string                           `json:"hiddenPropertyIds"`
	PropertyOrder      map[string]int                     `json:"propertyOrder"`
	ValueVisibility    map[string]ValueVisibilityDocument `json:"valueVisibility"`
	CreatedAt          string                             `json:"createdAt"`
	UpdatedAt          string                             `json:"updatedAt"`
	DeletedAt          *string                            `json:"deletedAt"`
}
```

Add these methods:

```go
func (s *Store) UpsertWorkspace(ctx context.Context, workspace WorkspaceDocument) error {
	if workspace.Type == "" {
		workspace.Type = "workspace"
	}
	if workspace.SchemaVersion == 0 {
		workspace.SchemaVersion = 1
	}
	return s.upsertJSON(ctx, "workspaces", workspace)
}

func (s *Store) GetWorkspace(ctx context.Context, id string) (WorkspaceDocument, error) {
	coll, err := s.db.Collection(ctx, "workspaces")
	if err != nil {
		return WorkspaceDocument{}, err
	}
	doc, err := coll.FindId(ctx, id)
	if err != nil {
		if errors.Is(err, anystore.ErrDocNotFound) {
			return WorkspaceDocument{}, nil
		}
		return WorkspaceDocument{}, err
	}
	var workspace WorkspaceDocument
	if err := json.Unmarshal([]byte(doc.Value().String()), &workspace); err != nil {
		return WorkspaceDocument{}, err
	}
	return workspace, nil
}

func (s *Store) UpsertView(ctx context.Context, view ViewDocument) error {
	if view.Type == "" {
		view.Type = "view"
	}
	if view.SchemaVersion == 0 {
		view.SchemaVersion = 1
	}
	if view.HiddenPropertyIDs == nil {
		view.HiddenPropertyIDs = []string{}
	}
	if view.PropertyOrder == nil {
		view.PropertyOrder = map[string]int{}
	}
	if view.ValueVisibility == nil {
		view.ValueVisibility = map[string]ValueVisibilityDocument{}
	}
	return s.upsertJSON(ctx, "views", view)
}

func (s *Store) GetView(ctx context.Context, id string) (ViewDocument, error) {
	coll, err := s.db.Collection(ctx, "views")
	if err != nil {
		return ViewDocument{}, err
	}
	doc, err := coll.FindId(ctx, id)
	if err != nil {
		if errors.Is(err, anystore.ErrDocNotFound) {
			return ViewDocument{}, nil
		}
		return ViewDocument{}, err
	}
	var view ViewDocument
	if err := json.Unmarshal([]byte(doc.Value().String()), &view); err != nil {
		return ViewDocument{}, err
	}
	return view, nil
}

func (s *Store) ListViews(ctx context.Context, workspaceID string) ([]ViewDocument, error) {
	coll, err := s.db.Collection(ctx, "views")
	if err != nil {
		return nil, err
	}
	iter, err := coll.Find(map[string]any{"workspaceId": workspaceID}).Iter(ctx)
	if err != nil {
		return nil, err
	}
	var views []ViewDocument
	for iter.Next() {
		doc, err := iter.Doc()
		if err != nil {
			_ = iter.Close()
			return nil, err
		}
		var view ViewDocument
		if err := json.Unmarshal([]byte(doc.Value().String()), &view); err != nil {
			_ = iter.Close()
			return nil, err
		}
		if view.DeletedAt == nil {
			views = append(views, view)
		}
	}
	if err := iter.Err(); err != nil {
		_ = iter.Close()
		return nil, err
	}
	if err := iter.Close(); err != nil {
		return nil, err
	}
	sort.SliceStable(views, func(i, j int) bool {
		if views[i].Order == views[j].Order {
			return views[i].CreatedAt < views[j].CreatedAt
		}
		return views[i].Order < views[j].Order
	})
	return views, nil
}
```

Add `sort` to the imports.

- [ ] **Step 4: Run focused Go tests and verify pass**

Run:

```bash
go test ./internal/workspacestore
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add internal/workspacestore/store.go internal/workspacestore/store_test.go
git commit -m "Add workspace view persistence"
```

## Task 5: Add Sidecar Route Mapping For View Storage

**Files:**

- Modify: `src/workspaceSidecarClient.js`
- Modify: `test/sidecarClient.test.js`
- Modify: `cmd/workspace-sidecar/main.go`

- [ ] **Step 1: Write failing JS route mapping tests**

Add these requests to `test/sidecarClient.test.js` inside `createSidecarHttpTransport maps service methods to sidecar routes`:

```js
  await transport.request("workspace.listViews", { workspaceId: "workspace:root" });
  await transport.request("workspace.upsertView", {
    id: "view:board",
    workspaceId: "workspace:root",
    viewType: "board",
  });
  await transport.request("workspace.setWorkspaceActiveView", {
    workspaceId: "workspace:root",
    activeViewId: "view:board",
  });
```

Add expected calls:

```js
    {
      url: "http://127.0.0.1:5000/workspace/views?workspaceId=workspace%3Aroot",
      method: "GET",
      headers: undefined,
      body: null,
    },
    {
      url: "http://127.0.0.1:5000/workspace/views",
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: {
        id: "view:board",
        workspaceId: "workspace:root",
        viewType: "board",
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/active-view",
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:root",
        activeViewId: "view:board",
      },
    },
```

- [ ] **Step 2: Run focused JS test and verify failure**

Run:

```bash
node --test test/sidecarClient.test.js
```

Expected: fail with unsupported sidecar method.

- [ ] **Step 3: Implement route mapping**

Add mappings in `src/workspaceSidecarClient.js`:

```js
  if (method === "workspace.listViews") {
    const workspaceId = typeof payload.workspaceId === "string" ? payload.workspaceId : "";
    return {
      httpMethod: "GET",
      path: "/workspace/views",
      query: `?workspaceId=${encodeURIComponent(workspaceId)}`,
    };
  }
  if (method === "workspace.upsertView") {
    return { httpMethod: "PUT", path: "/workspace/views" };
  }
  if (method === "workspace.setWorkspaceActiveView") {
    return { httpMethod: "PUT", path: "/workspace/active-view" };
  }
```

- [ ] **Step 4: Add sidecar HTTP handlers**

In `cmd/workspace-sidecar/main.go`, add handlers that decode `workspacestore.ViewDocument` and `workspacestore.WorkspaceDocument`:

```go
	mux.HandleFunc("/workspace/views", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			workspaceID := r.URL.Query().Get("workspaceId")
			if workspaceID == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspaceId is required"})
				return
			}
			views, err := store.ListViews(r.Context(), workspaceID)
			if views == nil {
				views = []workspacestore.ViewDocument{}
			}
			writeResult(w, map[string]any{"views": views}, err)
			return
		}
		if r.Method != http.MethodPut {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		var view workspacestore.ViewDocument
		if err := json.NewDecoder(r.Body).Decode(&view); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		writeResult(w, map[string]any{"ok": true}, store.UpsertView(r.Context(), view))
	})
```

Add active view handler:

```go
	mux.HandleFunc("/workspace/active-view", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		var payload struct {
			WorkspaceID  string `json:"workspaceId"`
			ActiveViewID string `json:"activeViewId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		workspace, err := store.GetWorkspace(r.Context(), payload.WorkspaceID)
		if err != nil {
			writeResult(w, nil, err)
			return
		}
		workspace.ID = payload.WorkspaceID
		workspace.Type = "workspace"
		workspace.SchemaVersion = 1
		workspace.ActiveViewID = payload.ActiveViewID
		writeResult(w, map[string]any{"ok": true}, store.UpsertWorkspace(r.Context(), workspace))
	})
```

- [ ] **Step 5: Run focused tests and build sidecar**

Run:

```bash
node --test test/sidecarClient.test.js
go test ./...
npm run build:sidecar
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/workspaceSidecarClient.js test/sidecarClient.test.js cmd/workspace-sidecar/main.go
git commit -m "Add workspace view sidecar routes"
```

## Task 6: Add Backend View Use Cases

**Files:**

- Modify: `src/workspaceBackend.js`
- Modify: `test/workspaceBackend.test.js`

- [ ] **Step 1: Write failing backend tests with an in-memory view store**

Append to `test/workspaceBackend.test.js`:

```js
// Add these names to the existing import from "../src/workspaceBackend.js".
  createCreateViewResponse,
  createDeleteViewResponse,
  createListViewsResponse,
  createSetActiveViewResponse,
  createUpdateViewResponse,

function createMemoryViewStore({ workspaceId = "workspace:root", views = [], activeViewId = null } = {}) {
  const state = {
    workspace: { id: workspaceId, activeViewId },
    views: new Map(views.map((view) => [view.id, view])),
  };
  return {
    state,
    async getWorkspace(id) {
      return id === state.workspace.id ? state.workspace : null;
    },
    async saveWorkspace(workspace) {
      state.workspace = { ...state.workspace, ...workspace };
      return state.workspace;
    },
    async listViews(id) {
      return [...state.views.values()]
        .filter((view) => view.workspaceId === id && !view.deletedAt)
        .sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt));
    },
    async getView(id) {
      return state.views.get(id) || null;
    },
    async saveView(view) {
      state.views.set(view.id, view);
      return view;
    },
  };
}

test("createCreateViewResponse creates a default active Board view", async () => {
  const viewStore = createMemoryViewStore();
  const response = await createCreateViewResponse({
    body: {
      workspaceId: "workspace:root",
      viewType: "board",
      name: "Board",
    },
    viewStore,
    idFactory: () => "view:board",
    now: () => "2026-05-14T00:00:00.000Z",
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.activeViewId, "view:board");
  assert.deepEqual(response.payload.view.visiblePropertyIds, ["property:name", "property:status"]);
  assert.equal(viewStore.state.workspace.activeViewId, "view:board");
});

test("createDeleteViewResponse blocks deleting the last active view", async () => {
  const viewStore = createMemoryViewStore({
    activeViewId: "view:board",
    views: [{
      id: "view:board",
      workspaceId: "workspace:root",
      name: "Board",
      viewType: "board",
      order: 10,
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:00.000Z",
    }],
  });

  const response = await createDeleteViewResponse({
    body: { workspaceId: "workspace:root", viewId: "view:board" },
    viewStore,
    now: () => "2026-05-14T00:00:01.000Z",
  });

  assert.equal(response.status, 409);
  assert.equal(response.payload.code, "LAST_VIEW_DELETE_BLOCKED");
  assert.equal(viewStore.state.views.get("view:board").deletedAt, undefined);
});
```

- [ ] **Step 2: Run focused backend tests and verify failure**

Run:

```bash
node --test test/workspaceBackend.test.js
```

Expected: fail because the new exported response creators do not exist.

- [ ] **Step 3: Implement backend wrappers using `workspaceViews.js`**

In `src/workspaceBackend.js`, import helpers:

```js
import {
  WorkspaceViewError,
  createDefaultView,
  normalizeViewDocument,
  validateViewPatch,
} from "./workspaceViews.js";
```

Add response creators:

```js
export async function createListViewsResponse({ body, viewStore }) {
  try {
    const workspaceId = requireBodyString(body, "workspaceId");
    const workspace = await requireWorkspace(viewStore, workspaceId);
    const views = await viewStore.listViews(workspaceId);
    return createJsonResponse(200, {
      workspaceId,
      activeViewId: workspace.activeViewId || null,
      views: views.map(normalizeViewDocument),
    });
  } catch (error) {
    return createWorkspaceViewErrorResponse(error);
  }
}

export async function createCreateViewResponse({ body, viewStore, idFactory = crypto.randomUUID, now = () => new Date().toISOString() }) {
  try {
    const workspaceId = requireBodyString(body, "workspaceId");
    await requireWorkspace(viewStore, workspaceId);
    const existingViews = await viewStore.listViews(workspaceId);
    const timestamp = now();
    const rawId = idFactory();
    const id = String(rawId).startsWith("view:") ? String(rawId) : `view:${rawId}`;
    const view = createDefaultView({
      workspaceId,
      viewType: body?.viewType,
      name: body?.name,
      id,
      order: nextViewOrder(existingViews),
      now: timestamp,
    });
    await viewStore.saveView(view);
    await viewStore.saveWorkspace({ id: workspaceId, activeViewId: view.id, updatedAt: timestamp });
    return createJsonResponse(200, { workspaceId, activeViewId: view.id, view });
  } catch (error) {
    return createWorkspaceViewErrorResponse(error);
  }
}
```

When adding the default `idFactory`, import `randomUUID` from `node:crypto` or reuse the existing `node:crypto` import:

```js
import { createHash, randomUUID } from "node:crypto";
```

Add helper functions:

```js
function requireBodyString(body, field) {
  const value = typeof body?.[field] === "string" ? body[field].trim() : "";
  if (!value) {
    throw new WorkspaceViewError("VALIDATION_FAILED", `${field} is required.`, field);
  }
  return value;
}

async function requireWorkspace(viewStore, workspaceId) {
  const workspace = await viewStore.getWorkspace(workspaceId);
  if (!workspace) {
    throw new WorkspaceViewError("WORKSPACE_NOT_FOUND", "Workspace was not found.", "workspaceId");
  }
  return workspace;
}

function nextViewOrder(views) {
  return views.length === 0 ? 10 : Math.max(...views.map((view) => Number(view.order) || 0)) + 10;
}

function createWorkspaceViewErrorResponse(error) {
  if (error instanceof WorkspaceViewError) {
    const status = error.code === "LAST_VIEW_DELETE_BLOCKED" ? 409 : 400;
    return createJsonResponse(status, {
      code: error.code,
      message: error.message,
      field: error.field,
    });
  }
  return createJsonResponse(400, {
    code: "VALIDATION_FAILED",
    message: error.message || "Workspace view operation failed.",
  });
}
```

Implement the remaining wrappers with the same pattern:

- `createSetActiveViewResponse` validates workspace and view ownership, then saves `activeViewId`.
- `createUpdateViewResponse` loads the view, calls `validateViewPatch`, merges patch, normalizes, and saves.
- `createDeleteViewResponse` blocks one-view deletion, soft-deletes with `deletedAt`, and selects next active view when needed.

- [ ] **Step 4: Run focused backend tests and verify pass**

Run:

```bash
node --test test/workspaceBackend.test.js
```

Expected: backend tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/workspaceBackend.js test/workspaceBackend.test.js
git commit -m "Add workspace view backend use cases"
```

## Task 7: Wire View Projection Response

**Files:**

- Modify: `src/workspaceBackend.js`
- Modify: `test/workspaceBackend.test.js`

- [ ] **Step 1: Write failing projection integration tests**

Add tests that call `createViewProjectionResponse` with:

- a Workspace id;
- a Board view and a Table view;
- a project list containing one status project and one `No status` project;
- `searchQuery: "alpha"`;
- a priority filter that hides low priority projects.

Use this expected assertion shape:

```js
assert.equal(boardResponse.status, 200);
assert.equal(boardResponse.payload.projection.type, "board");
assert.deepEqual(
  boardResponse.payload.projection.columns.map((column) => [
    column.statusValueId,
    column.projects.map((project) => project.id),
  ]),
  [
    ["statusValue:active", ["project:alpha"]],
    ["statusValue:no-status", []],
  ],
);

assert.equal(tableResponse.status, 200);
assert.deepEqual(
  tableResponse.payload.projection.rows.map((row) => row.id),
  ["project:alpha"],
);
```

- [ ] **Step 2: Run focused backend tests and verify failure**

Run:

```bash
node --test test/workspaceBackend.test.js
```

Expected: fail because `createViewProjectionResponse` does not exist.

- [ ] **Step 3: Implement projection response by delegating to pure helper**

In `src/workspaceBackend.js`, import `createViewProjection` and add:

```js
export async function createViewProjectionResponse({
  body,
  viewStore,
  projectProvider,
  propertyProvider,
}) {
  try {
    const workspaceId = requireBodyString(body, "workspaceId");
    const workspace = await requireWorkspace(viewStore, workspaceId);
    const viewId = typeof body?.viewId === "string" && body.viewId.trim()
      ? body.viewId.trim()
      : workspace.activeViewId;
    if (!viewId) {
      throw new WorkspaceViewError("VIEW_NOT_FOUND", "Active view was not found.", "viewId");
    }
    const view = await requireView(viewStore, workspaceId, viewId);
    const projects = await projectProvider({ workspaceId });
    const { visibleProperties, statusValues } = await propertyProvider({ workspaceId, view });
    return createJsonResponse(200, createViewProjection({
      view,
      projects,
      visibleProperties,
      statusValues,
      searchQuery: body?.searchQuery,
    }));
  } catch (error) {
    return createWorkspaceViewErrorResponse(error);
  }
}
```

Add `requireView`:

```js
async function requireView(viewStore, workspaceId, viewId) {
  const view = await viewStore.getView(viewId);
  if (!view || view.workspaceId !== workspaceId || view.deletedAt) {
    throw new WorkspaceViewError("VIEW_NOT_FOUND", "View was not found.", "viewId");
  }
  return view;
}
```

- [ ] **Step 4: Run focused backend tests and verify pass**

Run:

```bash
node --test test/workspaceBackend.test.js
```

Expected: backend tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/workspaceBackend.js test/workspaceBackend.test.js
git commit -m "Add workspace view projection response"
```

## Task 8: Full Verification And Contract Review

**Files:**

- Modify docs only if implementation behavior intentionally changes a documented contract.

- [ ] **Step 1: Run Node tests**

Run:

```bash
npm test
```

Expected: `# fail 0`.

- [ ] **Step 2: Run TypeScript typecheck**

Run:

```bash
npm run typecheck
```

Expected: command exits with code 0.

- [ ] **Step 3: Build renderer**

Run:

```bash
npm run build:renderer
```

Expected: Vite build exits with code 0.

- [ ] **Step 4: Run Go tests**

Run:

```bash
go test ./...
```

Expected: all Go packages pass.

- [ ] **Step 5: Build sidecar**

Run:

```bash
npm run build:sidecar
```

Expected: Go build exits with code 0 and writes `workspace-sidecar`.

- [ ] **Step 6: Review contracts**

Check:

```bash
rg -n "workspace\\.listViews|workspace\\.createView|workspace\\.setActiveView|workspace\\.updateView|workspace\\.reorderViews|workspace\\.deleteView|workspace\\.getViewProjection" docs/api/workspace-views.md src test
git diff --check
git status --short
```

Expected:

- service method names match `docs/api/workspace-views.md`;
- no whitespace errors;
- only intended files changed.

- [ ] **Step 7: Final commit if any verification/documentation adjustments were needed**

```bash
git add docs src test internal cmd
git commit -m "Verify workspace views backend implementation"
```

Skip this commit only if there are no changes after Task 7.

## Implementation Order Summary

1. Service client forwarding.
2. Pure view defaults and validation.
3. Pure filtering and projection.
4. Go sidecar persistence.
5. Sidecar transport/HTTP routes.
6. Backend use cases.
7. Backend projection response.
8. Full verification.

## Risk Controls

- Keep `workspace:root` compatibility tests in Go before touching sidecar `workspaces` collection behavior.
- Treat system `Status` filters as derived values, not `select_values`.
- Keep `property:name` and `property:status` required in `visiblePropertyIds`.
- Keep view deletion metadata-only; no filesystem operations.
- Reuse scan/project data shapes instead of duplicating folder traversal when wiring projection to real scan output.

## Final Review Checklist

- [ ] All acceptance criteria in `docs/backlog/workspace-views-backend-storage.md` map to a test or implementation task.
- [ ] No new dependencies were added.
- [ ] React components do not import backend/storage modules.
- [ ] Sidecar routes remain local implementation details.
- [ ] Workspace deletion and view deletion do not touch project files.
- [ ] Board/Table projection uses one filtered project set.
- [ ] `No status` is represented as `statusValue:no-status`.
- [ ] Quality gates pass.
