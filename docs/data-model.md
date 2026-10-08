# Data Model: Workspace Project Board

## Purpose

This document defines the target local product data model for Workspace Project Board MVP. It is the storage contract for `any local` / `any-store` documents and the baseline for future API contracts, migrations, and `any sync`.

The model follows the architecture decisions in `docs/architecture.md` and ADR-001:

- the filesystem remains the source of project files;
- product metadata is local-first and document-oriented;
- React UI never reads or writes storage directly;
- Workspaces are saved configurations with a selected project source folder per Workspace;
- project ids are stable local ids, while relative paths are locators.

## Current runtime and target scope

The entity examples and collection/index definitions below describe the target durable model. Electron currently uses JSON adapters behind preload IPC, as accepted in [ADR-006](adr/006-workspace-source-bindings.md). Standalone Go operations are not proof of active integration.

| Data | Current Electron scope and storage | Target/integration qualification |
| --- | --- | --- |
| Workspace source and roles | settings.json `workspaceSources[workspaceId]`, with retained `rulesByRoot` snapshots | Independent bindings; preserve legacy fields and previous-root recovery |
| Workspace and saved views | views.json, per opaque Workspace/view ID | Go Workspace/View documents exist; view-field parity remains incomplete |
| Project identities | Source-scoped discovery IDs plus verified explicit-move `projectLocators` | A general durable registry is Proposed ADR-004, not implemented acceptance |
| Property definitions, options, values, history and derived Status colors | properties.json, keyed by source identity; same-root Workspaces share data | Workspace-scoped target examples require a separately agreed compatibility/migration decision |
| Tabs, panes, previews, last screen | Renderer storage, per Workspace and saved-view/session identity | UI state remains distinct from durable project metadata |
| Sidebar width, locale, appearance, property-section preferences | Device-local renderer preferences | Keep existing keys/formats; not synced product documents |

`workspaceId` in UI requests identifies the selected Workspace. In legacy property documents the same field can hold the resolved source scope; do not reinterpret it as the request Workspace or rewrite records to match the target examples. IDs remain opaque references. Values and history follow their retained IDs.

Current fallback project IDs are generated from discovery locators. Explicit Status moves preserve known IDs through verified path/device/inode aliases. External arbitrary moves/renames are not covered by a complete reconciler; keep ADR-004 Proposed. Target examples such as `project:<uuid>` and `discoveryState: missing` are requirements for that future registry, not claims about every current scan.

## Document Conventions

- Documents are JSON-shaped records stored through `any-store`.
- Every persisted document has an `id`, `type`, `schemaVersion`, `createdAt`, and `updatedAt`.
- Timestamps use ISO 8601 UTC strings.
- Document ids are stable strings with a type prefix.
- References store ids, not embedded copies of related documents.
- Relative paths always use `/` as the separator in stored product data.
- Absolute paths are allowed only on the project source folder document.
- Soft deletion uses `deletedAt` when preserving history matters.
- Hard deletion is allowed only for non-historical UI configuration documents when explicitly safe.

Example base fields:

```json
{
  "id": "workspace:local:main",
  "type": "workspace",
  "schemaVersion": 1,
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z"
}
```

## Collections

Logical collection names:

- `project_source_folders`
- `workspaces`
- `views`
- `folder_roles`
- `projects`
- `property_definitions`
- `select_values`
- `property_values`
- `property_history`
- `migrations`

The physical `any-store` collection names should match these names unless a migration ADR changes them.

## Device-Local Renderer Preferences

Interface locale is presentation state, not product metadata. It is stored locally by the renderer under the versioned preference key `workspace.interfaceLocale.v1` and is not written to `any-store`, Workspace documents, View documents, project folders, or `any sync`.

Supported values are `en` and `ru`. Missing or invalid values normalize to `en`.

## Entity: Project Source Folder

Represents the selected root folder that contains project folders.

Collection: `project_source_folders`

Fields:

- `id`: stable id, usually `projectSource:default` for MVP.
- `type`: `projectSourceFolder`.
- `schemaVersion`: number.
- `absolutePath`: selected local absolute path.
- `name`: display name, usually the source folder basename.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.
- `lastScannedAt`: nullable timestamp.
- `deletedAt`: nullable timestamp.

Business rules:

- Each Workspace selects one active project source folder; multiple Workspaces can share the same source.
- The source folder path is a runtime boundary, not a project identity.
- Changing the source folder changes what projects can be discovered.
- Workspaces reference this document through `sourceFolderId`.
- Filesystem operations must validate paths against `absolutePath`.

Example:

```json
{
  "id": "projectSource:default",
  "type": "projectSourceFolder",
  "schemaVersion": 1,
  "absolutePath": "/Users/aleksandersk/Documents/Projects",
  "name": "Projects",
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "lastScannedAt": null,
  "deletedAt": null
}
```

## Entity: Workspace

Represents a saved working configuration over the project source folder.

Collection: `workspaces`

Fields:

- `id`: stable id, for example `workspace:<uuid>`.
- `type`: `workspace`.
- `schemaVersion`: number.
- `sourceFolderId`: reference to `project_source_folders.id`.
- `name`: user-visible Workspace name.
- `order`: number for Left Panel ordering.
- `activeViewId`: nullable reference to `views.id`.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.
- `deletedAt`: nullable timestamp.

Business rules:

- A Workspace can select its own root folder; changing the binding preserves the Workspace ID and its views.
- Workspaces may share a source or bind independent roots; an unbound Workspace retains its ID/views until source selection.
- Deleting a Workspace deletes only app metadata, never project files.
- A Workspace must keep at least one active view after setup.

Example:

```json
{
  "id": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "type": "workspace",
  "schemaVersion": 1,
  "sourceFolderId": "projectSource:default",
  "name": "Operations",
  "order": 10,
  "activeViewId": "view:board:main",
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "deletedAt": null
}
```

## Entity: View

Represents a Board or Table view inside one Workspace.

Collection: `views`

Fields:

- `id`: stable id, for example `view:<uuid>`.
- `type`: `view`.
- `schemaVersion`: number.
- `workspaceId`: reference to `workspaces.id`.
- `name`: user-visible view name.
- `viewType`: `board` or `table`.
- `order`: number for Workspace view ordering.
- `visiblePropertyIds`: ordered array of `property_definitions.id`.
- `hiddenPropertyIds`: array of `property_definitions.id`.
- `propertyOrder`: object mapping property id to order number.
- `valueVisibility`: object keyed by property id, with view-level value filter settings.
- `propertyLayout`: object keyed by property id, with view-level display settings such as `wrapContent` for custom Text properties.
- `columnOrder`: Board-only ordered array of unique opaque Status IDs; unavailable IDs retain slots and new IDs append in stable catalog order.
- `boardLayout`: Board-only display settings: preferred `columnWidth` and optional boolean `wrapContent` (missing/false means ordinary shared vertical scrolling).
- `rowOrder`: Table-only unique opaque project rank, retaining unavailable IDs and applying consistently to Multi-select occurrences.
- `hiddenColumnIds`: legacy Status-Board visibility preference, independent of search and manual rank.
- `tableColumnWidths`: Table property-ID width map, minimum 132px with no finite product maximum; partial patches merge.
- `grouping`: nullable typed grouping settings; Group by, sort, manual/hidden/collapsed groups and hideEmpty are independent per view.
- `groupingNotice`: optional property-removed recovery notice.
- `boardGroupingVersion`: version 1 distinguishes explicit None from legacy missing/null Board grouping, which restores Status.

- `createdAt`: timestamp.
- `updatedAt`: timestamp.
- `deletedAt`: nullable timestamp.

These additive view preferences are implemented by the JSON adapter. The current Go ViewDocument/BoardLayoutDocument lacks some fields; [architecture parity gaps](architecture.md#storage--sidecar-layer) must be resolved before integration. Wire validation and compatibility belong to the [views API](api/workspace-views.md).

Business rules:

- A Workspace can have multiple views.
- Deleting a view does not delete projects, properties, or values.
- A Workspace cannot delete its last view.
- `property:name` is required in Board and Table views in MVP.
- `property:status` is visible by default in new views and can be hidden per view without changing derived project status data.
- `valueVisibility` is a view-level filter.
- View filters affect only display, not stored project values.
- For `select` and `multi-select` properties, `valueVisibility.valueIds` references `selectValue` document ids.
- For system `Status`, `valueVisibility.valueIds` references derived status value ids from folder roles plus `statusValue:no-status`.
- `includeEmpty` controls whether projects without a custom select value remain visible when an include filter is active.
- `propertyLayout.<propertyId>.wrapContent: true` makes a custom Text property wrap in Table view and allows row height to expand; missing or false means compact single-line display.
- `boardLayout.columnWidth` is normalized to the supported persisted range of `288..1600`. The renderer keeps the stored width stable across window resizing; the one-third working-area limit applies when choosing a new width, not when rendering an existing preference.
- Board card Status drops use the existing validated explicit folder move; column reorder changes only view metadata.

Example:

```json
{
  "id": "view:board:main",
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
    "property:status": {
      "mode": "include",
      "valueIds": ["statusValue:folderRole:workspace-main:active", "statusValue:no-status"]
    },
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
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "deletedAt": null
}
```

## Entity: Folder Role

Represents the meaning of a folder path inside one Workspace.

Collection: `folder_roles`

Fields:

- `id`: stable id, for example `folderRole:<workspaceId>:<pathHash>`.
- `type`: `folderRole`.
- `schemaVersion`: number.
- `workspaceId`: reference to `workspaces.id`.
- `sourceFolderId`: reference to `project_source_folders.id`.
- `relativePath`: relative path inside the source folder.
- `role`: `group`, `status`, or `project`.
- `expanded`: boolean UI preference for Settings tree.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.
- `deletedAt`: nullable timestamp.

Business rules:

- `group` means the folder is a transparent container.
- `status` means the folder defines a primary project status.
- `project` means the folder is a project and scan traversal stops there.
- MVP supports one level of `status` folders.
- A project outside a status folder gets `No status`.
- Folder roles are Workspace-scoped because different Workspaces can interpret the same source folder differently.

Example:

```json
{
  "id": "folderRole:workspace-main:active",
  "type": "folderRole",
  "schemaVersion": 1,
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "sourceFolderId": "projectSource:default",
  "relativePath": "Active",
  "role": "status",
  "expanded": true,
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "deletedAt": null
}
```

## Entity: Project

Represents the target registry record for a discovered project folder. Its stable identity/missing-state lifecycle depends on acceptance and implementation of ADR-004; current fallback/explicit-move behavior is defined in the scope section above.

Collection: `projects`

Fields:

- `id`: stable local id, for example `project:<uuid>`.
- `type`: `project`.
- `schemaVersion`: number.
- `sourceFolderId`: reference to `project_source_folders.id`.
- `currentRelativePath`: current relative folder path inside the source folder.
- `name`: display name, normally folder basename.
- `discoveryState`: `active`, `missing`, or `archived`.
- `firstDiscoveredAt`: timestamp.
- `lastSeenAt`: timestamp.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.
- `deletedAt`: nullable timestamp.

Business rules:

- The project id is the primary id for metadata.
- `currentRelativePath` is a locator and may change.
- A project is source-folder scoped, not Workspace scoped.
- Different Workspaces should reference the same project id for the same project folder.
- If a folder disappears, the project should become `missing` before metadata is deleted.
- Initial discovery may create a project for a relative path if no existing active project matches it.

Example:

```json
{
  "id": "project:a65b1cc4-0c9d-43cb-a43d-9736c902f13a",
  "type": "project",
  "schemaVersion": 1,
  "sourceFolderId": "projectSource:default",
  "currentRelativePath": "Active/Project Alpha",
  "name": "Project Alpha",
  "discoveryState": "active",
  "firstDiscoveredAt": "2026-05-14T00:00:00.000Z",
  "lastSeenAt": "2026-05-14T00:00:00.000Z",
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "deletedAt": null
}
```

## Entity: Property Definition

Represents a system or custom project property.

Collection: `property_definitions`

Fields:

- `id`: stable id, for example `property:<uuid>`, `property:name`, or `property:status`.
- `type`: `propertyDefinition`.
- `schemaVersion`: number.
- `workspaceId`: reference to `workspaces.id`.
- `name`: display name.
- `propertyType`: `text`, `number`, `date`, `select`, or `multi-select`.
- `system`: boolean.
- `hidden`: boolean default visibility flag.
- `order`: number.
- `config`: type-specific object.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.
- `deletedAt`: nullable timestamp.

Business rules:

- `property:name` and `property:status` are system properties.
- System properties cannot be deleted.
- System property display names may be renamed and persisted as property definitions, but their ids, types, order, and derived project values remain system-controlled.
- `property:name` is derived from the project folder name.
- `property:status` is derived from folder role scan output.
- Custom property values are stored in `property_values`.
- Deleting a custom property requires confirmation and creates history records.

Example:

```json
{
  "id": "property:priority",
  "type": "propertyDefinition",
  "schemaVersion": 1,
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "name": "Priority",
  "propertyType": "select",
  "system": false,
  "hidden": false,
  "order": 30,
  "config": {},
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "deletedAt": null
}
```

## Entity: Select Value

Represents one option for a `select` or `multi-select` property.

Collection: `select_values`

Fields:

- `id`: stable id, for example `selectValue:<uuid>`.
- `type`: `selectValue`.
- `schemaVersion`: number.
- `workspaceId`: reference to `workspaces.id`.
- `propertyId`: reference to `property_definitions.id`.
- `name`: display name.
- `color`: optional color token.
- `order`: number.
- `hidden`: boolean default visibility flag.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.
- `deletedAt`: nullable timestamp.

Business rules:

- Select values belong to one property.
- For system `Status`, `select_values` may store only UI color metadata for derived status values. These records use `propertyId: "property:status"`, `id` equal to the derived status value id, and a `name` mirrored from the current derived status value.
- Status value metadata does not create, rename, delete, hide, or reorder status values; status values remain derived from folder roles.
- Deleting a select value requires confirmation if used by any project.
- View-level value visibility for `select` and `multi-select` properties references select value ids.
- Hidden select values are not the same as deleted values.

Example:

```json
{
  "id": "selectValue:priority:high",
  "type": "selectValue",
  "schemaVersion": 1,
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "propertyId": "property:priority",
  "name": "High",
  "color": "red",
  "order": 10,
  "hidden": false,
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "deletedAt": null
}
```

## Entity: Property Value

Represents the current value for one project and one property.

Collection: `property_values`

Fields:

- `id`: stable id, `propertyValue:<projectId>:<propertyId>`.
- `type`: `propertyValue`.
- `schemaVersion`: number.
- `workspaceId`: reference to `workspaces.id`.
- `projectId`: reference to `projects.id`.
- `propertyId`: reference to `property_definitions.id`.
- `valueType`: `text`, `number`, `date`, `select`, or `multi-select`.
- `value`: normalized value.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.
- `deletedAt`: nullable timestamp.

Business rules:

- One active property value exists per project/property/workspace.
- `text` value is a string.
- `number` value is a finite number, null, or a number expression object `{ "expression": "=2+2", "value": 4 }`.
- `date` value is `YYYY-MM-DD` or null.
- `select` value is one select value id or null.
- `multi-select` value is an ordered array of select value ids.
- System `Name` and `Status` values are derived and should not be stored as editable custom values, even when their display labels are renamed.
- Updating a value creates a `propertyHistory` record.

Example:

```json
{
  "id": "propertyValue:project-a65b:property-priority",
  "type": "propertyValue",
  "schemaVersion": 1,
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "projectId": "project:a65b1cc4-0c9d-43cb-a43d-9736c902f13a",
  "propertyId": "property:priority",
  "valueType": "select",
  "value": "selectValue:priority:high",
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "deletedAt": null
}
```

## Entity: Property History

Represents append-only history for property definitions, select values, and property values.

Collection: `property_history`

Fields:

- `id`: stable event id, for example `propertyHistory:<uuid>`.
- `type`: `propertyHistory`.
- `schemaVersion`: number.
- `workspaceId`: reference to `workspaces.id`.
- `projectId`: nullable reference to `projects.id`.
- `propertyId`: nullable reference to `property_definitions.id`.
- `targetType`: `propertyDefinition`, `selectValue`, or `propertyValue`.
- `targetId`: id of the changed document.
- `action`: `created`, `updated`, `deleted`, `hidden`, `shown`, `reordered`, or `valueChanged`.
- `previousValue`: previous value snapshot or null.
- `nextValue`: next value snapshot or null.
- `createdAt`: timestamp.

Business rules:

- History is append-only.
- History records are product data.
- History is required for property definitions and property values.
- History should not store UI-only state changes unless they affect view-visible product data.

Example:

```json
{
  "id": "propertyHistory:8fe89e6e-7b15-45d0-bd45-a2d2f2f00b0a",
  "type": "propertyHistory",
  "schemaVersion": 1,
  "workspaceId": "workspace:3a2b9a24-3ad7-4e7e-96c0-3fdf7f774c3b",
  "projectId": "project:a65b1cc4-0c9d-43cb-a43d-9736c902f13a",
  "propertyId": "property:priority",
  "targetType": "propertyValue",
  "targetId": "propertyValue:project-a65b:property-priority",
  "action": "valueChanged",
  "previousValue": null,
  "nextValue": "selectValue:priority:high",
  "createdAt": "2026-05-14T00:00:00.000Z"
}
```

## Entity: Migration

Represents local storage schema state.

Collection: `migrations`

Fields:

- `id`: stable id, for example `migration:local-storage`.
- `type`: `migration`.
- `schemaVersion`: number.
- `currentVersion`: number.
- `applied`: array of migration ids.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.

Business rules:

- Migrations must be conservative and tested.
- Existing `.workspace` data has priority over legacy `.folder-kanban` data.
- Corrupt current `.workspace` files must not be overwritten by legacy migrations.
- New document families require migration tests.

Example:

```json
{
  "id": "migration:local-storage",
  "type": "migration",
  "schemaVersion": 1,
  "currentVersion": 1,
  "applied": ["001-local-first-storage"],
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z"
}
```

## Relationships

- One `projectSourceFolder` has many `workspaces`.
- One `projectSourceFolder` has many `projects`.
- One `workspace` has many `views`.
- One `workspace` has many `folderRoles`.
- One `workspace` has many `propertyDefinitions`.
- One `propertyDefinition` has many `selectValues` when its type is `select` or `multi-select`.
- One `project` has many `propertyValues` through a Workspace.
- One `propertyDefinition` has many `propertyValues`.
- One `propertyValue` can have many `propertyHistory` records.
- One `view` references many properties and select values for display and filtering.

## Logical Indexes

Required logical indexes:

- `project_source_folders`: unique `id`.
- `workspaces`: unique `id`; by `sourceFolderId`; by `order`.
- `views`: unique `id`; by `workspaceId`; by `workspaceId + order`.
- `folder_roles`: unique `id`; unique `workspaceId + relativePath`; by `workspaceId + role`.
- `projects`: unique `id`; by `sourceFolderId + currentRelativePath`; by `sourceFolderId + discoveryState`.
- `property_definitions`: unique `id`; by `workspaceId + order`; by `workspaceId + propertyType`.
- `select_values`: unique `id`; by `propertyId + order`.
- `property_values`: unique `id`; unique `workspaceId + projectId + propertyId`; by `workspaceId + propertyId`; by `projectId`.
- `property_history`: unique `id`; by `workspaceId + targetId`; by `projectId`; by `createdAt`.
- `migrations`: unique `id`.

These are logical access patterns. The physical `any-store` indexing strategy can be implemented incrementally as queries require it.

## Validation Rules

- `project source folder` must be an existing local directory before scans and file operations.
- Stored project item paths must be relative paths.
- Absolute paths are rejected for project, folder role, file, and project detail operations.
- Relative paths that resolve outside the source folder are rejected.
- Folder role must be `group`, `status`, or `project`.
- Property type must be `text`, `number`, `date`, `select`, or `multi-select`.
- Number values must be finite numbers, null, or number expression objects with the original expression and finite computed value.
- Date values must be valid `YYYY-MM-DD` strings or null.
- Select values must reference existing non-deleted `selectValue` documents.
- Multi-select values must be arrays of unique select value ids.
- View `valueVisibility.valueIds` must reference select values for the same custom select property, or derived status value ids for system `Status`.
- View `propertyLayout.wrapContent` may be true only for active custom Text properties.
- A Workspace must always have at least one non-deleted view.
- System properties cannot be deleted.
- Search in MVP uses project `name` only.

## Deletion And Retention Rules

- Deleting a Workspace soft-deletes Workspace metadata and related views, but never deletes files on disk.
- Deleting a view can be hard deletion if it has no history requirement, but must leave at least one view.
- Deleting a custom property soft-deletes the property definition and current values after confirmation.
- Deleting a select value soft-deletes it if it is referenced by history or current values.
- Project records should become `missing` before deletion when folders disappear from disk.
- Property history is append-only and should not be deleted in MVP.
- Migration documents are retained permanently.

## Migration Notes

- Current JSON-backed `.workspace/settings.json` and `.workspace/properties.json` are transitional storage.
- Legacy `.folder-kanban` data can be migrated only when current `.workspace` data is missing.
- Corrupt current `.workspace` data must not be overwritten by legacy data.
- Moving from transitional JSON files to sidecar documents requires a migration that preserves:
  - all Workspace source bindings and retained previous-root role snapshots;
  - Workspaces;
  - views;
  - folder roles;
  - property definitions;
  - select values;
  - property values;
  - property history.
- Migration code must be idempotent.
- Migration code must be covered by Node and/or Go tests at the boundary that owns the data.

## Sync Direction

Future `any sync` should synchronize document records, not UI component state.

Sync-ready requirements:

- stable ids for all product documents;
- timestamps for conflict inspection;
- document families that can sync independently;
- append-only property history;
- relative locators for project folders;
- no direct dependence on absolute project paths for project identity.

Conflict resolution is not part of MVP and should be specified in a future ADR before `any sync` work starts.

## Transitional Electron source bindings and renderer sessions

The active Electron IPC runtime still uses JSON adapters (ADR-006), not the target Go store. Its settings retain legacy `rootPath`/`folderRules` and add `workspaceSources[workspaceId] = { rootPath, rulesByRoot }`. On first use, current legacy siblings inherit the former source and independent copies of its roles. Changing one binding preserves other bindings and previous root roles. Existing source-scoped project IDs, definitions, values and history are retained; no namespace rewrite or file move occurs. The view document’s `sourceFolderId` tracks its current source. Unknown historical source paths cannot be inferred from IDs and never fall back to an unrelated root.

Only sidebar width is shared device-local chrome, stored at `workspace.sidebar-width.v1`. Without that key, the first validated legacy pane layout supplies the initial width, otherwise 320px. Existing layouts remain readable and retain their own collapsed/right/split states. Project session screens additionally store an optional `previewId`, independently from an expanded `tabId`; previews restore fresh data by ID outside view filtering. File trees are fetched through the backend rather than persisted in renderer sessions.

### Workspace creation before source selection

The transitional Electron adapter can persist a Workspace and its default views before choosing a directory. Its `sourceFolderId` and workspaceSources root locator are empty until selection; the opaque Workspace ID and view IDs remain stable when a validated source is bound. Other Workspaces keep their bindings and source-scoped values. The row menu opens Workspace settings; device language and appearance live in global Settings.

### Table grouping settings

View documents may contain `grouping` or `null`. The object holds `propertyId`, `sort` (`default`, `ascending`, `descending`, `manual`), independent arrays `manualOrder`, `hiddenGroupIds`, `collapsedGroupIds`, and boolean `hideEmpty`. Legacy Table views without this field load flat. Legacy Board views restore Status grouping unless `boardGroupingVersion: 1` records explicit None. Group IDs are deterministic typed value keys; category IDs remain stable across renames/colors. See [view contract](api/workspace-views.md#table-grouping-workspace-cjq). `groupingNotice: "property-removed"` records recovery after property deletion and is cleared by the next explicit grouping change. These are existing view settings, never project/property-value/history documents.

### Explicit move locator preservation

The transitional JSON settings adapter records only explicitly moved existing project IDs in source-scoped `projectLocators` with path/device/inode evidence. A `projectMove` journal covers copying, holding, locator/role commit and verified cleanup. Values/history documents are retained without rewriting IDs. Source-scoped aliases serve all Workspace bindings for that source; old locator reuse and replacement targets cannot inherit moved metadata. This is bounded explicit-move preservation, not the proposed general identity registry in ADR-004. See [Status move and recovery contract](api/workspace-status-move.md).

### Table row rank

A Table view may retain `rowOrder`, an independent sequence of unique opaque project IDs. It ranks project occurrences before grouping/filtering, retains unavailable identities, and changes no folder membership, properties/history or group order. Missing data preserves discovery order. See [Table order contract](api/workspace-views.md#table-manual-row-order-workspace-9bp).

### Board column rank

A Board view may retain `columnOrder`, independently per view and Workspace. Projection ranks complete Status columns before search/value filtering; hidden columns retain their positions, and only visible slots change during filtered reorder. No status uses its stable derived ID. Legacy views load in catalog order; duplication copies the rank independently. This display preference changes no Status catalog, roles, projects, property/history records or paths. See [view contract](api/workspace-views.md#board-column-order-workspace-fns).

### Table column widths

A Table view stores `tableColumnWidths`, an optional map of stable property IDs to finite numeric pixel widths of at least `132`. Legacy views default to an empty map and use renderer defaults. Widths belong to the Workspace/view, survive hide/show, reorder, grouping and restart, and have no product maximum. Partial width patches merge without replacing other columns or view settings. The current JSON adapter persists this field; see [Table width contract](api/workspace-views.md#table-column-widths-workspace-bja).

## Explicit folder rename locators

The active Electron JSON adapter preserves an existing opaque project ID during a physical same-parent folder rename through `projectLocators[sourceId][projectId] = { path, dev, ino }`. The folder identity remains unchanged; shared-source roles are remapped with its subtree. Property values/history, saved row ranks and session references continue using the original ID. A new occupant of the former path cannot inherit those documents. A separate `projectRename` journal prevents discovery from publishing partial physical/metadata state; see [project rename](api/workspace-project-rename.md). Linux implementation and native Windows validation remain incomplete in the current task.
