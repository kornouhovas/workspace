# API Contract: Workspace Views

## Overview

This contract defines the UI-facing service methods for Workspace views: listing views, creating Board or Table views, switching the active view, updating view settings, deleting views, and loading the filtered Board/Table projection.

These are application service contracts exposed through `WorkspaceServiceClient`. They are not public web API endpoints. React UI must call service methods and must not read `any-store`, sidecar HTTP routes, filesystem state, or workspace backend modules directly.

Related specs:

- `docs/prd.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/flows/board-table-views.md`
- `docs/api/workspace-properties.md`

## Authentication / Authorization

MVP has no authentication or authorization.

All operations are local to the desktop runtime and constrained by the selected project source folder and local storage availability.

## Common Conventions

- Service method names use the `workspace.<action>` prefix.
- Request payloads are JSON objects.
- Responses are JSON objects.
- Service methods return product data on success.
- Service methods throw a structured workspace service error on failure.
- Timestamps are ISO 8601 UTC strings.
- UI-facing payloads use stable ids, not absolute filesystem paths.
- Relative project paths are locators and must not be treated as primary ids.
- View operations never delete or move files on disk.

## Common Error Shape

```json
{
  "code": "VIEW_NOT_FOUND",
  "message": "View was not found.",
  "field": "viewId"
}
```

Required error codes:

- `SOURCE_FOLDER_MISSING`: no project source folder is configured.
- `SOURCE_FOLDER_UNAVAILABLE`: configured source folder is not accessible.
- `WORKSPACE_NOT_FOUND`: workspace id does not resolve to an active Workspace.
- `VIEW_NOT_FOUND`: view id does not resolve to an active view in the Workspace.
- `LAST_VIEW_DELETE_BLOCKED`: delete would remove the last active view.
- `INVALID_VIEW_TYPE`: view type is not `board` or `table`.
- `INVALID_PROPERTY_REFERENCE`: visible property id is missing, deleted, or outside the Workspace.
- `INVALID_VALUE_REFERENCE`: value filter references an invalid select or status value.
- `VALIDATION_FAILED`: request payload is structurally invalid.
- `STORAGE_UNAVAILABLE`: local `any-store` sidecar or storage backend is unavailable.
- `PROJECT_SCAN_FAILED`: project discovery failed while building a projection.

## Data Types

### View

```json
{
  "id": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f",
  "type": "view",
  "schemaVersion": 1,
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "name": "Board",
  "viewType": "board",
  "order": 10,
  "visiblePropertyIds": ["property:name", "property:status", "property:priority"],
  "hiddenPropertyIds": [],
  "propertyOrder": {
    "property:name": 10,
    "property:status": 20,
    "property:priority": 30
  },
  "valueVisibility": {
    "property:priority": {
      "mode": "include",
      "valueIds": ["selectValue:priority:high"],
      "includeEmpty": false
    }
  },
  "propertyLayout": {
    "property:notes": {
      "wrapContent": true
    }
  },
  "boardLayout": {
    "columnWidth": 384
  },
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "deletedAt": null
}
```

Rules:

- `viewType` is `board` or `table`.
- `viewType` is immutable in MVP; create another view to switch type.
- `visiblePropertyIds` stores the properties displayed in this view.
- `property:name` is required in `visiblePropertyIds` for Board and Table views in MVP.
- `property:status` is included by default in new views, remains filterable through `valueVisibility`, and can be hidden from a specific view.
- `hiddenPropertyIds` is retained for compatibility with UI controls, but `visiblePropertyIds` is the source of display order.
- `propertyOrder` mirrors `visiblePropertyIds` for stable ordering and migration safety.
- `valueVisibility` filters projects in this view only.
- `propertyLayout` stores view-level display settings. `propertyLayout.<customTextPropertyId>.wrapContent: true` enables wrapped Text cells in Table view; missing settings keep Text cells compact and single-line.
- `boardLayout.columnWidth` stores the fixed Board status-column width in pixels. Missing values default to `384`; persisted values are limited to `288..1600`. The renderer does not rewrite or reduce this value during window resizing; the one-third working-area limit applies only while selecting a new width.

### Value Visibility

```json
{
  "mode": "include",
  "valueIds": ["selectValue:priority:high", "selectValue:priority:medium"],
  "includeEmpty": false
}
```

Rules:

- Missing property key means all values are visible for that property.
- `mode: "include"` means only listed values are visible.
- For `select`, `valueIds` contains `selectValue` ids.
- For `multi-select`, a project matches when at least one selected project value is included.
- For `multi-select`, projects with no value match only when `includeEmpty` is true.
- For `select`, projects with no value match only when `includeEmpty` is true.
- For system `Status`, `valueIds` contains derived status value ids such as `statusValue:folderRole:workspace-main:active` and `statusValue:no-status`.
- `includeEmpty` is ignored for system `Status`; use `statusValue:no-status` to include projects outside status folders.

### Status Value

Status values are derived response values. Optional `color` metadata may be stored locally for display, but status identity, name, and membership remain derived from folder roles.

```json
{
  "id": "statusValue:folderRole:workspace-main:active",
  "name": "Active",
  "relativePath": "Active",
  "source": "folderRole",
  "color": "orange"
}
```

The `No status` value is represented as:

```json
{
  "id": "statusValue:no-status",
  "name": "No status",
  "relativePath": null,
  "source": "no-status"
}
```

### Project Summary

```json
{
  "id": "project:a65b1cc4-0c9d-43cb-a43d-9736c902f13a",
  "name": "Project Alpha",
  "currentRelativePath": "Active/Project Alpha",
  "status": {
    "id": "statusValue:folderRole:workspace-main:active",
    "name": "Active",
    "relativePath": "Active",
    "source": "folderRole"
  },
  "propertyValues": {
    "property:name": "Project Alpha",
    "property:status": "statusValue:folderRole:workspace-main:active",
    "property:priority": "selectValue:priority:high"
  }
}
```

Custom properties:

- `propertyValues` must include values for custom properties returned in `visibleProperties`.
- Board cards and Table rows consume the same `propertyValues` object.
- Project Detail Panel may request or receive all active custom properties, even if some are hidden in the active view.
- `Select` and `Multi-select` display requires `selectValues` metadata from the property API/projection.

## Service Methods

### `workspace.listViews`

Lists active views for one Workspace.

Request:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b"
}
```

Response:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "activeViewId": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f",
  "views": []
}
```

Validation:

- `workspaceId` is required.
- Deleted views are excluded.
- Views are sorted by `order`, then `createdAt`.

### `workspace.createView`

Creates a Board or Table view in a Workspace and makes it active.

Request:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "viewType": "board",
  "name": "Board"
}
```

Response:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "activeViewId": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f",
  "view": {
    "id": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f",
    "type": "view",
    "schemaVersion": 1,
    "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
    "name": "Board",
    "viewType": "board",
    "order": 30,
    "visiblePropertyIds": ["property:name", "property:status"],
    "hiddenPropertyIds": [],
    "propertyOrder": {
      "property:name": 10,
      "property:status": 20
    },
    "valueVisibility": {},
    "propertyLayout": {},
    "createdAt": "2026-05-14T00:00:00.000Z",
    "updatedAt": "2026-05-14T00:00:00.000Z",
    "deletedAt": null
  }
}
```

Validation:

- `workspaceId` is required.
- `viewType` must be `board` or `table`.
- Empty `name` falls back to `Board` or `Table`.
- New views start with `Name` and `Status` visible.
- New view order is after the last active view.
- The new view becomes `workspace.activeViewId`.

### `workspace.setActiveView`

Sets the active view for a Workspace.

Request:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "viewId": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f"
}
```

Response:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "activeViewId": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f"
}
```

Validation:

- `viewId` must belong to the Workspace.
- `viewId` must not be deleted.
- Switching views does not change project data.

### `workspace.updateView`

Updates view metadata and view settings.

Request:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "viewId": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f",
  "patch": {
    "name": "Priority Board",
    "visiblePropertyIds": ["property:name", "property:status", "property:priority"],
    "propertyOrder": {
      "property:name": 10,
      "property:status": 20,
      "property:priority": 30
    },
    "valueVisibility": {
      "property:priority": {
        "mode": "include",
        "valueIds": ["selectValue:priority:high", "selectValue:priority:medium"],
        "includeEmpty": false
      }
    },
    "propertyLayout": {
      "property:notes": {
        "wrapContent": true
      }
    },
    "boardLayout": {
      "columnWidth": 384
    }
  }
}
```

Response:

```json
{
  "view": {
    "id": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f",
    "name": "Priority Board",
    "viewType": "board",
    "visiblePropertyIds": ["property:name", "property:status", "property:priority"],
    "valueVisibility": {
      "property:priority": {
        "mode": "include",
        "valueIds": ["selectValue:priority:high", "selectValue:priority:medium"],
        "includeEmpty": false
      }
    },
    "propertyLayout": {
      "property:notes": {
        "wrapContent": true
      }
    },
    "boardLayout": {
      "columnWidth": 384
    },
    "updatedAt": "2026-05-14T00:00:00.000Z"
  }
}
```

Validation:

- `workspaceId` and `viewId` are required.
- `patch` must not include `id`, `workspaceId`, `type`, `schemaVersion`, `createdAt`, or `deletedAt`.
- `viewType` cannot be changed in MVP.
- `property:name` must remain in `visiblePropertyIds` in MVP. `property:status` is visible by default but can be hidden per view.
- `visiblePropertyIds` must reference active property definitions in the same Workspace.
- `propertyOrder` keys must be a subset of `visiblePropertyIds`.
- `valueVisibility` keys must reference `select`, `multi-select`, or system `Status` properties.
- `propertyLayout` keys must reference active custom properties; `wrapContent` is accepted only for custom Text properties.
- `boardLayout.columnWidth` must be a finite number in the persisted range `288..1600`.
- Invalid value references reject the whole update.
- Updating view settings does not create property history records.

### `workspace.reorderViews`

Persists the order of views inside a Workspace.

Request:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "orderedViewIds": [
    "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f",
    "view:table:main"
  ]
}
```

Response:

```json
{
  "views": [
    {
      "id": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f",
      "order": 10
    },
    {
      "id": "view:table:main",
      "order": 20
    }
  ]
}
```

Validation:

- `orderedViewIds` must contain every active view for the Workspace exactly once.
- Reordering views does not change the active view.

### `workspace.deleteView`

Deletes a view from app metadata.

Request:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "viewId": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f"
}
```

Response:

```json
{
  "deletedViewId": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f",
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "activeViewId": "view:table:main"
}
```

Validation:

- Deleting the last active view returns `LAST_VIEW_DELETE_BLOCKED`.
- Deleting the active view selects the next view by order.
- Deleting a view never deletes projects, properties, values, folder roles, or files.
- Hard deletion is allowed only when no history requirement is introduced for view documents.

### `workspace.getViewProjection`

Loads the active project projection for a Board or Table view.

Request:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "viewId": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f",
  "searchQuery": "alpha"
}
```

Response for Board:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "view": {
    "id": "view:9f6b0ce2-9db8-4a3a-b1b8-0a1a3c15f30f",
    "name": "Board",
    "viewType": "board"
  },
  "visibleProperties": [
    {
      "id": "property:name",
      "name": "Name",
      "propertyType": "text",
      "system": true
    },
    {
      "id": "property:status",
      "name": "Status",
      "propertyType": "select",
      "system": true
    }
  ],
  "statusValues": [
    {
      "id": "statusValue:folderRole:workspace-main:active",
      "name": "Active",
      "relativePath": "Active",
      "source": "folderRole"
    },
    {
      "id": "statusValue:no-status",
      "name": "No status",
      "relativePath": null,
      "source": "no-status"
    }
  ],
  "projection": {
    "type": "board",
    "capabilities": {
      "canMoveBetweenStatuses": true
    },
    "columns": [
      {
        "statusValueId": "statusValue:folderRole:workspace-main:active",
        "name": "Active",
        "projects": []
      },
      {
        "statusValueId": "statusValue:no-status",
        "name": "No status",
        "projects": []
      }
    ]
  }
}
```

Response for Table:

```json
{
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "view": {
    "id": "view:table:main",
    "name": "Table",
    "viewType": "table"
  },
  "visibleProperties": [],
  "statusValues": [],
  "projection": {
    "type": "table",
    "rows": []
  }
}
```

Validation:

- If `viewId` is omitted, backend uses `workspace.activeViewId`.
- Search is applied to project `Name` only.
- Search combines with active view value filters.
- Board projection must include `No status` when matching projects have no status.
- Board card moves use the existing [Status move contract](workspace-status-move.md); column order never invokes a physical move.
- Table projection uses the same filtered project set as Board for the same Workspace and filters.

## Backend / Sidecar Persistence Contract

Workspace backend owns validation and use-case behavior. The sidecar owns durable document storage.

Required storage operations:

- list active views by `workspaceId`;
- get one view by `viewId`;
- create or upsert a view document;
- delete or soft-delete a view document;
- update `workspace.activeViewId`;
- persist view order changes atomically enough that the Workspace never has duplicate active view order values after a successful operation.

Rules:

- Sidecar routes remain local implementation details unless a future ADR exposes them as public contracts.
- UI must not call sidecar routes directly.
- Storage writes must update `updatedAt`.
- New storage documents require migration tests.
- Failed storage writes must not leave a Workspace without an active view.

## Backward Compatibility Notes

- Existing service methods such as `workspace.scan`, `workspace.saveProperty`, and `workspace.listPropertyValues` remain valid.
- `workspace.getViewProjection` may internally reuse scan/project discovery, but UI should consume the projection response instead of composing Board/Table data in React.
- Transitional `.workspace` JSON data has priority over legacy `.folder-kanban` data until sidecar migration replaces it.
- Contract changes require updates to `docs/data-model.md`, relevant tests, and UI flow docs when behavior changes.

## Testing Expectations

Add tests before UI wiring for:

- `WorkspaceServiceClient` method forwarding for all view methods;
- view schema normalization and validation;
- create view default properties and active view update;
- prevent deleting the last view;
- delete active view selects the next active view;
- value filter validation for select, multi-select, and system `Status`;
- Board/Table projection uses the same filtered project set;
- search uses project `Name` only;
- sidecar/storage operations persist views and active view id;
- migration preserves existing views and `valueVisibility`.

## Acceptance Criteria

- React UI can list, create, rename, reorder, activate, update, and delete Workspace views through service methods.
- A Workspace cannot end up with zero active views.
- View settings persist locally and survive restart.
- View filters affect only display and never mutate project data.
- Board and Table projections are derived from the same Workspace project set.
- `No status` is represented consistently in filters and Board columns.
- Public service method changes are covered by tests.

## Table grouping (workspace-cjq)

`workspace.updateView` accepts an additive `grouping` field (`null` disables):

```json
{"propertyId":"property:tags","sort":"default","manualOrder":[],"hiddenGroupIds":[],"collapsedGroupIds":[],"hideEmpty":false}
```

Every existing system/custom property is eligible, including a hidden column. `sort` is `default`, `ascending`, `descending`, or `manual`. Default categories follow catalog order; default scalar values ascend. Ascending/descending compare labels for categories, numeric values for Number, saved ISO calendar dates for Date, and exact strings for Text/Name. The transient projection request `locale` selects `en` (default) or `ru`; renderer sends its interface locale. This is not persisted in the view.

Group keys are `value:<stable category ID>`, `text:<JSON string>`, `number:<normalized number>`, `date:<JSON date string>`, or `empty`. Empty always appears last, including descending/manual order. Status uses `No status`; other properties use `No value`. Manual order changes only view settings; unknown/new keys follow the saved keys in stable source/catalog order. Group arrays are independent across views and duplicated via a deep copy.

Table projection retains flat filtered `rows` and adds `groups` (displayed sections), `groupOptions` (all sections including hidden and empty), and `totalProjectCount` (unique filtered projects). Each section contains `id`, `name`, optional `color`, `empty`, `rows`, unique `count`, `hidden`, and `collapsed`. Scalar group universe comes from the original workspace projects; categories include unused catalog options. Search/value filters precede section counts. Multi-select membership is one occurrence in every selected category, with the same project ID; no project is copied or persisted by grouping.

Deleting a category prunes its manual/hidden/collapsed references and existing value filters across source sibling views. Deleting the grouping property persists `grouping: null` and `groupingNotice: "property-removed"`; Table renders an explicit recovery notice. Choosing or removing grouping clears the notice. The active Electron JSON adapter and existing Go view document preserve the additive field; transport, source identity, storage engine, filesystem and Electron security are unchanged.

### Group order interaction (workspace-dnk)

Dragging the left handle or using Arrow Up/Down on it works in every sort. A successful position change sets `sort: "manual"` and records the complete displayed `groupOptions` order, including hidden groups, excluding the immovable final `empty` group. An old retained manual order is ignored when starting from an automatic sort. Subsequent pending mutations use the latest functional queue draft for the captured workspace/view. Click, same-position drop, Escape, pointer cancellation, and outside drop do not save. Visibility, collapse, counts, and hide-empty remain independent.

Grouped Table uses a separate tbody for each section with a heading, repeated column header for expanded non-empty groups, and rows. Sections use the same colgroup and column state with one horizontal/vertical viewport; 20px gaps separate groups. Header transient controls belong to the selected section occurrence while property mutations remain shared. Flat Table retains its single sticky header.

Board `canMoveBetweenStatuses` advertises explicit Status column moves through [the Status move contract](workspace-status-move.md). It does not authorize custom property writes or arbitrary destinations.

### Table manual row order (workspace-9bp)

Optional `rowOrder: string[]` is a per-Table sequence of unique opaque project IDs in the existing JSON view document. Missing order defaults to discovery order; no migration is required. `updateView` rejects non-arrays, invalid/empty entries and duplicates. Board ignores this setting. The projection returns the complete retained sequence plus new discovered IDs, applies its rank before search/value filtering/grouping, and uses the same rank for all Multi-select occurrences. Unknown/unavailable saved IDs remain retained without producing rows. View duplication deep-copies the sequence.

A reorder replaces only the selected visible group’s slots in the canonical sequence, retaining filtered/hidden/unavailable IDs and other groups’ ranks. Group sort/manualOrder, visibility, custom values/history, folder roles and paths are independent. Manual drops target the same group; crossings between groups of custom properties are unavailable. Across explicit Status groups, a fresh verified Status option invokes the existing move; only a completed move may then save the requested insertion order. A failed move cannot save that order. Empty Status group headers accept moves; No status stays accessible as a group but never as a physical destination. Click/current-position, Escape, outside and pointer cancellation do not save. Arrow Up/Down on a focused handle reorders inside its group.

## Board column order (workspace-fns)

`workspace.updateView` accepts `patch.columnOrder: string[]` for a Board view. Entries must be unique non-empty opaque Status IDs. Invalid structure rejects the whole update with `VALIDATION_FAILED`, field `columnOrder`. Unknown/unavailable IDs are retained for source/filter recovery. This additive view field is normalized on JSON read/write, defaults to `[]`, and is copied by Duplicate Tab independently. Table views do not consume it. Width, visibility, property order and filters are preserved by a columnOrder-only patch.

`workspace.getViewProjection` returns the complete effective `view.columnOrder`: saved IDs followed by newly discovered Status IDs in catalog order. It ranks Board columns by stable `statusValueId` and leaves the response Status catalog unchanged. Empty columns remain accessible; search/value filters never alter the complete rank. Renderer search retains the complete rank. Filtered reorder changes only visible slots. Updates survive adapter restart and Workspace/view switching without writing project data, properties/history, roles or paths.

UI preview has separate header and body orders. A changed valid drop applies both synchronously, then sends exactly one update. Cancel/outside/unchanged drops send none. Pending prevents conflicting moves; storage failure restores the confirmed complete order. Navigation cancels unfinished previews and invalidates late replies; acknowledgement is scoped to Workspace, view and navigation version. Card Status drops continue targeting stable Status IDs after reorder.

## Table column widths (workspace-bja)

Table view documents and projections include `tableColumnWidths: Record<string, number>`, defaulting to `{}` for legacy views. Keys are stable property IDs (`property:name`, `property:status`, custom property IDs), scoped to the owning Workspace and view. `workspace.updateView` accepts a partial `patch.tableColumnWidths`; its entries merge into the existing map and preserve all other view settings. Keys must reference current properties, including hidden properties. Each width must be a numeric finite value at least `132` pixels; no product maximum or viewport clamp applies. Invalid patches reject atomically with `VALIDATION_FAILED` (`tableColumnWidths`); unknown property IDs use `INVALID_PROPERTY_REFERENCE`. Invalid entries in persisted legacy/corrupt maps are ignored on read. Valid wide finite numbers remain unchanged.

Visibility, property order, name/color changes and grouping never reset widths. Duplicate Tab copies widths to an independent view. Every grouped section uses the same colgroup. Renderer resize previews apply immediately; completed gestures persist through WorkspaceServiceClient and preload IPC into the active JSON view store. Pending writes are serialized with captured Workspace/view targets; session drafts cover stale projections while saves are pending. The first destination frame uses its saved widths, and late acknowledgements never refresh or activate another view. Save failure restores the confirmed width and shows a localized error. Board width rules are unchanged.
