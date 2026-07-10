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
- `boardLayout.columnWidth` stores the preferred Board status-column width in pixels. Missing values default to `384`; persisted values are limited to `288..1600`, while the renderer caps the effective width at one third of the current Workspace working area.

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
      "canMoveBetweenStatuses": false
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
- Board projection must not expose a move-between-status operation in MVP.
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
