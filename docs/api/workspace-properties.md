# API Contract: Workspace Custom Properties

## Overview

This contract defines UI-facing service methods for Notion-like custom project properties in Workspace Project Board.

React UI must use `WorkspaceServiceClient` methods exposed through Electron preload. React must not read or write `any-store`, sidecar HTTP routes, transitional `.workspace` JSON files, filesystem state, or backend modules directly.

Related specs:

- `docs/prd.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/interface.md`
- `docs/ui-guidelines.md`
- `docs/api/workspace-views.md`

## Supported Property Types

UI labels:

- `Text`
- `Numbers`
- `Date`
- `Select`
- `Multi-select`

Canonical service/storage type ids:

- `text`
- `number`
- `date`
- `select`
- `multi-select`

Rules:

- `property:name` and `property:status` are system properties.
- System properties are returned by property list methods. Their display labels can be renamed, but their ids, types, order, derived values, delete behavior, and stored-value behavior remain locked.
- `property:status` may persist color metadata for derived status values through `workspace.updateStatusValueColor`; the status values themselves remain derived from folder roles.
- Requests identify the target Workspace; its source binding resolves the current property storage scope.
- Current JSON definitions, select values, project values and history are source-scoped and shared by Workspaces bound to the same root. Per-Workspace views remain independent. The [scope/compatibility table](../data-model.md#current-runtime-and-target-scope) owns this distinction.
- `Select` and `Multi-select` options are stored as `selectValue` documents.
- The active Electron dispatcher persists properties through the JSON adapter. Go/any-store is the target durable store; it is not wired into this runtime (ADR-006).
- Service responses use `type` for compatibility with current renderer/view code. Storage documents may persist the same concept as `propertyType`; backend must normalize both names.

## Common Error Codes

- `SOURCE_FOLDER_MISSING`: no project source folder is configured.
- `WORKSPACE_NOT_FOUND`: workspace id does not resolve to an active Workspace.
- `PROJECT_NOT_FOUND`: project id does not resolve to an active project.
- `PROPERTY_NOT_FOUND`: property id does not resolve to an active property in the Workspace.
- `PROPERTY_SYSTEM_LOCKED`: attempted to mutate a system property in a forbidden way.
- `INVALID_PROPERTY_TYPE`: a select-option operation targets a nonselect property; creation/type normalization can instead reject with `VALIDATION_FAILED`.
- `SELECT_VALUE_NOT_FOUND`: select value id does not resolve to an active value for the property.
- `STATUS_VALUE_NOT_FOUND`: status value id does not resolve to a derived status value in the current Workspace projection.
- `SELECT_VALUE_IN_USE`: delete requires confirmation because the value is used by at least one project.
- `SYSTEM_PROPERTY_READONLY`: a custom-value/definition operation targets a protected system property.
- Invalid value normalization currently rejects with `VALIDATION_FAILED`, field `value`; do not rely on a separate `PROPERTY_VALUE_INVALID` code.
- `VALIDATION_FAILED`: request payload is structurally invalid.
- `STORAGE_UNAVAILABLE`: local `any-store` sidecar or storage backend is unavailable.

Current code also emits duplicate/in-use codes such as PROPERTY_ALREADY_EXISTS, PROPERTY_IN_USE and SELECT_VALUE_ALREADY_EXISTS. Storage exceptions need not be normalized to STORAGE_UNAVAILABLE today. The operation sections specify expected service behavior; the current JSON path does not guarantee full definition/option lifecycle history, transactional cascades, or one atomic value-plus-history commit. Preserve those target requirements and verify remediation separately rather than declaring them implemented from these examples.

## Data Types

### Property Definition

```json
{
  "id": "property:priority",
  "type": "select",
  "workspaceId": "workspace:ops",
  "name": "Priority",
  "system": false,
  "hidden": false,
  "order": 30,
  "config": {},
  "createdAt": "2026-05-15T00:00:00.000Z",
  "updatedAt": "2026-05-15T00:00:00.000Z",
  "deletedAt": null
}
```

Validation:

- `name` must be a non-empty string after trimming.
- `type` must be one of `text`, `number`, `date`, `select`, or `multi-select`.
- `system` is assigned by backend and cannot be supplied for custom properties.
- `order` is assigned by backend unless a reorder method is used.
- `hidden` is global Workspace visibility; view-level visibility remains on `View.visiblePropertyIds` and `View.hiddenPropertyIds`.

### Select Value

```json
{
  "id": "selectValue:priority:high",
  "workspaceId": "workspace:ops",
  "propertyId": "property:priority",
  "name": "High",
  "color": "red",
  "hidden": false,
  "order": 10,
  "createdAt": "2026-05-15T00:00:00.000Z",
  "updatedAt": "2026-05-15T00:00:00.000Z",
  "deletedAt": null
}
```

Validation:

- `propertyId` must reference an active `select` or `multi-select` property in the same Workspace.
- `name` must be a non-empty string after trimming.
- `color` is an optional token from the app's supported color palette.
- Hidden values remain valid for existing project values and history.

### Project Property Value

```json
{
  "id": "propertyValue:project-a65b:property-priority",
  "workspaceId": "workspace:ops",
  "projectId": "project:a65b1cc4-0c9d-43cb-a43d-9736c902f13a",
  "propertyId": "property:priority",
  "type": "select",
  "value": "selectValue:priority:high",
  "createdAt": "2026-05-15T00:00:00.000Z",
  "updatedAt": "2026-05-15T00:00:00.000Z",
  "deletedAt": null
}
```

Value rules:

- `text`: string; empty value is `""`.
- `number`: finite number, `null`, or a number expression object such as `{ "expression": "=2+2", "value": 4 }`.
  Expressions must start with `=`, preserve the user-entered expression, and support simple arithmetic `+`, `-`, `*`, `/`, parentheses, decimals, and unary signs. Invalid expressions and division by zero are rejected by the current dispatcher as `VALIDATION_FAILED` (field `value`).
- `date`: valid `YYYY-MM-DD` string or `null`.
- `select`: one active select value id for the same property, or `null`.
- `multi-select`: ordered array of unique active select value ids for the same property.

## Service Methods

### `workspace.listProperties`

Lists active system and custom properties, select values, and optional usage counts for one Workspace.

Request:

```json
{
  "workspaceId": "workspace:ops",
  "includeUsage": true
}
```

Response:

```json
{
  "workspaceId": "workspace:ops",
  "properties": [],
  "selectValues": [],
  "usage": {
    "property:priority": 12,
    "selectValue:priority:high": 4
  }
}
```

Validation:

- `workspaceId` is required.
- Deleted properties and deleted select values are excluded unless a future history view requests them explicitly.
- Results are sorted by `order`, then `createdAt`.

### `workspace.createProperty`

Creates a custom property definition in a Workspace.

Request:

```json
{
  "workspaceId": "workspace:ops",
  "name": "Priority",
  "type": "select"
}
```

Response:

```json
{
  "workspaceId": "workspace:ops",
  "property": {
    "id": "property:priority",
    "type": "select",
    "name": "Priority",
    "system": false,
    "hidden": false,
    "order": 30
  },
  "selectValues": []
}
```

Validation:

- `workspaceId`, `name`, and `type` are required.
- New custom properties are added after existing active properties.
- Newly created properties are visible in default Workspace settings and can be added to views.
- Creating a property writes a `propertyHistory` record.

### `workspace.updateProperty`

Renames, hides, shows, or updates custom property configuration. For system properties, only the display label `name` may be renamed.

Request:

```json
{
  "workspaceId": "workspace:ops",
  "propertyId": "property:priority",
  "patch": {
    "name": "Urgency",
    "hidden": false
  }
}
```

Response:

```json
{
  "workspaceId": "workspace:ops",
  "property": {
    "id": "property:priority",
    "name": "Urgency",
    "type": "select"
  }
}
```

Validation:

- `workspaceId`, `propertyId`, and `patch` are required.
- System properties accept only `patch.name`; hide, delete, type, order, and config changes are rejected with `PROPERTY_SYSTEM_LOCKED`.
- `type` cannot be changed after creation in MVP.
- Updating a property writes a `propertyHistory` record.

### `workspace.reorderProperties`

Persists global Workspace property order.

Request:

```json
{
  "workspaceId": "workspace:ops",
  "orderedPropertyIds": ["property:name", "property:status", "property:priority"]
}
```

Response:

```json
{
  "workspaceId": "workspace:ops",
  "properties": []
}
```

Validation:

- `orderedPropertyIds` must contain every active property exactly once.
- `property:name` and `property:status` remain first and second in MVP.
- Reordering writes a `propertyHistory` record for changed custom properties.

### `workspace.deleteProperty`

Soft-deletes a custom property after confirmation.

Request:

```json
{
  "workspaceId": "workspace:ops",
  "propertyId": "property:priority",
  "confirmDeleteValues": true
}
```

Response:

```json
{
  "workspaceId": "workspace:ops",
  "propertyId": "property:priority",
  "deleted": true
}
```

Validation:

- System properties cannot be deleted.
- If current values exist and `confirmDeleteValues` is not `true`, backend returns `VALIDATION_FAILED` with usage count.
- Delete soft-deletes the property and current values.
- Delete removes the property from active views.
- Delete writes history records for the property and deleted current values.

### `workspace.createSelectValue`

Creates a value for `select` or `multi-select`.

Request:

```json
{
  "workspaceId": "workspace:ops",
  "propertyId": "property:priority",
  "name": "High",
  "color": "red"
}
```

Response:

```json
{
  "workspaceId": "workspace:ops",
  "selectValue": {
    "id": "selectValue:priority:high",
    "propertyId": "property:priority",
    "name": "High",
    "color": "red",
    "hidden": false,
    "order": 10
  }
}
```

### `workspace.updateSelectValue`

Renames, recolors, hides, or shows a select value.

Request:

```json
{
  "workspaceId": "workspace:ops",
  "selectValueId": "selectValue:priority:high",
  "patch": {
    "name": "Critical",
    "color": "orange",
    "hidden": false
  }
}
```

Response:

```json
{
  "workspaceId": "workspace:ops",
  "selectValue": {
    "id": "selectValue:priority:high",
    "name": "Critical",
    "color": "orange"
  }
}
```

### `workspace.updateStatusValueColor`

Recolors a derived system `Status` value. This method only persists UI color metadata; it does not create, rename, delete, hide, or reorder status values.

Request:

```json
{
  "workspaceId": "workspace:ops",
  "statusValueId": "statusValue:folderRole:workspace-main:active",
  "color": "orange"
}
```

Response:

```json
{
  "workspaceId": "workspace:ops",
  "statusValue": {
    "id": "statusValue:folderRole:workspace-main:active",
    "name": "Active",
    "relativePath": "Active",
    "source": "folderRole",
    "color": "orange"
  }
}
```

Validation:

- `workspaceId`, `statusValueId`, and `color` are required.
- `statusValueId` must match a derived status value from the current Workspace source folder and folder roles.
- `color` must be one of the supported select/status color tokens.
- The persisted metadata is stored locally with `propertyId: "property:status"` and `id` equal to the derived status value id.

### `workspace.reorderSelectValues`

Persists select value order for one property.

Request:

```json
{
  "workspaceId": "workspace:ops",
  "propertyId": "property:priority",
  "orderedSelectValueIds": ["selectValue:priority:high", "selectValue:priority:medium"]
}
```

Response:

```json
{
  "workspaceId": "workspace:ops",
  "propertyId": "property:priority",
  "selectValues": []
}
```

### `workspace.deleteSelectValue`

Soft-deletes a select value after confirmation when used.

Request:

```json
{
  "workspaceId": "workspace:ops",
  "selectValueId": "selectValue:priority:high",
  "confirmDeleteUsages": true
}
```

Response:

```json
{
  "workspaceId": "workspace:ops",
  "selectValueId": "selectValue:priority:high",
  "deleted": true
}
```

Validation:

- If the value is used and `confirmDeleteUsages` is not `true`, backend returns `SELECT_VALUE_IN_USE`.
- Delete removes the value from current `select` / `multi-select` project values.
- Delete writes history records for the select value and affected property values.

### `workspace.updateProjectPropertyValue`

Updates one custom property value for one project.

Request:

```json
{
  "workspaceId": "workspace:ops",
  "projectId": "project:a65b1cc4-0c9d-43cb-a43d-9736c902f13a",
  "propertyId": "property:priority",
  "value": "selectValue:priority:high"
}
```

Response:

```json
{
  "workspaceId": "workspace:ops",
  "projectId": "project:a65b1cc4-0c9d-43cb-a43d-9736c902f13a",
  "propertyValue": {
    "id": "propertyValue:project-a65b:property-priority",
    "propertyId": "property:priority",
    "type": "select",
    "value": "selectValue:priority:high"
  },
  "project": {
    "id": "project:a65b1cc4-0c9d-43cb-a43d-9736c902f13a",
    "propertyValues": {
      "property:priority": "selectValue:priority:high"
    }
  }
}
```

Validation:

- `workspaceId`, `projectId`, and `propertyId` are required.
- System properties reject stored value updates.
- Value must normalize according to the active property type.
- Updating a value writes one current property value document and one append-only history document.

Backward compatibility:

- New UI calls `workspace.updateProjectPropertyValue`; current legacy saveProperty returns its old folder-property envelope and is not a working write alias. See [compatibility behavior](workspace-session-sources.md#filesystem-reads-and-local-opening).
- Existing `workspace.listPropertyValues` may remain for storage migration tests, but UI should call `workspace.listProperties` and consume view projection responses.

## Projection Requirements

`workspace.getViewProjection` must include:

- `visibleProperties` with system and custom properties enabled in the active view;
- `selectValues` needed to render visible `Select` and `Multi-select` properties;
- each project `propertyValues` object with custom property values keyed by property id;
- Board card data for visible custom properties;
- Table row data for visible custom properties;
- Project Detail Panel data with all active custom properties for editing.

Board, Table, and Project Detail Panel must render the same saved property values after projection reload.

## Storage Requirements

The active backend uses the file property adapter behind preload IPC. The target Go/any-store implementation defines these document families:

- `property_definitions`
- `select_values`
- `property_values`
- `property_history`

The transitional `.workspace/properties.json` is the current read/write path. It will become a migration input only when a separately reviewed Go-store integration switches adapters. Preserve source-scoped namespaces, values and history; target Workspace-scoped examples do not authorize a scope migration.

## Quality Requirements

Select checks by the affected boundary under [quality.md](../development/quality.md). Property normalization and service changes need meaningful behavior/regression checks; Go checks apply when its store/contract changes. Renderer/native checks apply to actual UI changes. Documentation reconciliation does not require rerunning every historical implementation gate.

## Explicit system Status selection

Project Detail can select an existing derived Status through [the filesystem Status move operation](workspace-status-move.md). This is not an editable stored system property value. `updateProjectPropertyValue` continues to reject system values; only the explicit move changes the folder location and hence derived Status.
