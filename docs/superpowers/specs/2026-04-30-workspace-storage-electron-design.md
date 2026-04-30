# Workspace Storage and Electron Design

## Goal

Move the project from a browser page plus lightweight Node server toward a single cross-platform Electron application with a real local storage layer based on `any-store`.

The current visual language stays in place. The main change is architectural: Workspace becomes the product concept, folder scanning becomes one source of Workspace objects, and user-defined properties become typed data instead of ad hoc JSON fields.

## Scope

- Create the foundation for an Electron app that packages UI and backend together.
- Keep the existing dark Workspace UI and current workflows as the first renderer experience.
- Introduce a storage boundary that can be backed by `any-store`.
- Model Notion-like property types: `text`, `number`, `date`, `select`, and `multi-select`.
- Model system properties:
  - `Name`: title inherited from the project folder name.
  - `Status`: selected from status folders configured in Workspace settings.
- Keep folder scanning as part of the product: selected folders still produce project objects.
- Rename project terminology away from `folder-kanban` toward `Workspace` where new code touches storage, process, docs, and package naming.
- Document third-party licensing for `any-store`.

## Non-Goals

- Do not copy code from `anytype-ts`; it is only an architecture reference.
- Do not introduce `any-sync` in this MVP.
- Do not build collaborative sync, account identity, encryption, or CRDT behavior.
- Do not rewrite the whole UI into React or another framework during the storage migration.
- Do not implement gRPC as the first transport unless the JSON/IPC bridge becomes a proven bottleneck.

## External References and Licensing

`any-store` is a Go document-oriented database running on a single SQLite file. It supports Mongo-like queries, indexes, transactions, iterators, durability controls, and runs cross-platform as pure Go. It is released under the MIT License, copyright Any Association. We can use it as a dependency and should include it in third-party license documentation.

`anytype-ts` is useful only as an architecture reference for Electron plus TypeScript desktop packaging. Its client code is under the Any Source Available License 1.0, so this project must not copy source, assets, component structure, or implementation details from it.

References:

- https://github.com/anyproto/any-store
- https://pkg.go.dev/github.com/anyproto/any-store
- https://raw.githubusercontent.com/anyproto/any-store/main/LICENSE.md
- https://github.com/anyproto/anytype-ts
- https://raw.githubusercontent.com/anyproto/anytype-ts/develop/LICENSE.md

## Architecture

The app becomes one Electron application with three internal layers:

1. Renderer: the current HTML/CSS/JavaScript Workspace UI.
2. Electron main and preload: the trusted bridge for filesystem dialogs, OS open actions, and Workspace API calls.
3. Workspace storage service: a Go sidecar process that owns `any-store` and exposes a narrow local API to Electron main.

The renderer never talks directly to the sidecar or filesystem. It calls a safe preload API exposed on `window.workspace`.

Electron main starts and stops the bundled Go sidecar. From the user's perspective there is no separate backend command; the backend is part of the app lifecycle.

For MVP, Electron main talks to the Go sidecar through a local JSON transport, either loopback HTTP bound to `127.0.0.1` with an ephemeral port or stdio JSON-RPC. The implementation should hide this behind a `WorkspaceServiceClient` interface so the transport can later move to gRPC without changing renderer code.

## Transport Decision

Use Electron IPC between renderer and Electron main. This follows Electron's process model and keeps native/backend access out of the renderer.

Use JSON between Electron main and the Go sidecar for MVP. The current operations are request/response:

- get selected Workspace root;
- select/change root;
- scan folder tree;
- list files/folders for card place;
- open or preview local files;
- read/update object properties.

gRPC/protobuf is a good future fit, but it is not required for the first any-store MVP. It becomes useful when we add streaming scan progress, live update subscriptions, larger typed APIs, or any-sync integration. The MVP should define clean service method names and DTOs now, so protobuf can be introduced later as a transport replacement rather than a UI rewrite.

## Storage Model

Use `any-store` collections for document-style records. The initial logical collections are:

- `workspaces`: local Workspace configuration and selected root folder metadata.
- `objects`: project/card objects produced from folders.
- `property_schemas`: property definitions available in a Workspace.
- `property_values`: typed values attached to objects.
- `folder_rules`: access, role, expansion, and scan behavior for folder paths.

Suggested object document shape:

```json
{
  "id": "object:<workspaceId>:<folderPathHash>",
  "workspaceId": "workspace:<id>",
  "type": "project",
  "source": {
    "kind": "folder",
    "path": "Active/Project Alpha",
    "absoluteRoot": "/Users/example/Projects"
  },
  "createdAt": "2026-04-30T00:00:00.000Z",
  "updatedAt": "2026-04-30T00:00:00.000Z"
}
```

Suggested property schema shape:

```json
{
  "id": "property:text",
  "workspaceId": "workspace:<id>",
  "name": "Text",
  "type": "text",
  "system": false,
  "hidden": false,
  "order": 30
}
```

Suggested property value shape:

```json
{
  "id": "value:<objectId>:<propertyId>",
  "workspaceId": "workspace:<id>",
  "objectId": "object:<workspaceId>:<folderPathHash>",
  "propertyId": "property:text",
  "type": "text",
  "value": "Project note"
}
```

System properties do not need stored values unless overridden:

- `Name` reads from the folder name.
- `Status` reads from folder role/status resolution in Workspace settings.

This keeps folder-derived data refreshable while allowing user-entered values to persist independently.

## Property Types

Supported MVP property types:

- `text`: string value.
- `number`: finite numeric value or empty.
- `date`: ISO date string or empty.
- `select`: one option id or empty.
- `multi-select`: ordered array of option ids.

The schema shape must allow future types by storing `type` as a string and putting type-specific settings under a `config` object.

Select-like configs should store option ids, names, colors, and order. Values store option ids, not labels, so renaming an option updates displays without rewriting object values.

## Folder Scanning

Folder scanning remains a first-class workflow.

The scan reads the selected root folder, applies folder access rules, and writes or updates folder-backed objects in storage. A folder marked as `card` is a scan leaf: its child folders are not recursively scanned as cards or groups. A folder marked as `group` is only a storage container and does not render as a status or card. A folder marked as `status` contributes the `Status` property value for descendant card folders.

Scan output should preserve user-entered property values. Re-scanning updates folder-derived fields like name, status, source path, and existence state, but does not clear typed property values.

## Naming

New user-facing and code-facing naming should use `Workspace`, not `Folder Kanban`.

Recommended changes during implementation:

- `package.json` name: from `folder-kanban-mvp` to `workspace`.
- local app data folder: from `.folder-kanban` to `.workspace`.
- docs title: from `Folder Kanban MVP` to `Workspace`.
- backend module names should avoid `kanban` unless the feature is specifically a board view.

Existing UI terms `Board`, `Table`, and `Overview` remain valid because they describe views, not the product.

## Electron Packaging

The initial Electron app can load the existing local renderer files. A later build step can bundle assets, but the MVP should keep packaging simple:

- Electron main creates the BrowserWindow.
- Preload exposes a narrow `window.workspace` API.
- Electron main launches the Go sidecar and routes calls to it.
- Electron main owns OS-specific actions such as open folder/file and native folder selection.
- Renderer stays browser-like and does not receive Node integration.

Development prerequisites include Node and Go. The current machine does not have `go` installed, so implementation must either install Go locally or defer running Go-side tests until Go is available. The design requires Go for the real `any-store` storage service.

## Data Flow

1. User launches the Electron app.
2. Electron main starts the Workspace storage sidecar.
3. Renderer loads the existing Workspace UI.
4. Renderer calls preload API to get Workspace state.
5. Electron main forwards storage operations to the sidecar.
6. Sidecar reads/writes `any-store`.
7. Folder selection and OS open actions go through Electron main.
8. Folder scans update folder-derived object documents and preserve typed property values.
9. Renderer receives normalized view models and renders using current UI components.

## Error Handling

- If sidecar startup fails, show a blocking local storage error with a retry action.
- If selected root no longer exists, keep Workspace metadata but show a root-missing state.
- If scan fails for a specific folder, preserve existing objects and surface a scan error.
- If storage value validation fails, return field-specific errors to renderer and keep the current edit state.
- If the sidecar is unavailable during editing, queue no writes in renderer; show an error and let the user retry.

## Testing

Use TDD for implementation.

Minimum automated coverage:

- property type normalization and validation;
- folder scan to object/property projection;
- preservation of typed user values across scan refresh;
- Electron preload API shape as a structural test;
- sidecar client interface with a fake transport;
- storage license documentation check.

Go-side tests should cover actual `any-store` persistence once Go is installed. Until then, JS tests should cover DTOs and boundary behavior without pretending to test `any-store` itself.

Manual verification:

- app launches as Electron;
- current UI appearance is preserved;
- selecting a root creates/updates Workspace storage;
- Table text edits persist through refresh;
- folder/file opening still works from card place.
