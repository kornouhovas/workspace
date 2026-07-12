# Architecture: Workspace Project Board

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Radix UI primitives.
- Desktop shell: Electron loading the built renderer from `dist/renderer`.
- Local backend: Node.js workspace backend modules in `src/`.
- Local storage: `any local` through the local `any-store` sidecar.
- Sidecar: Go HTTP process backed by `any-store` on SQLite.
- Auth: none in MVP.
- Deployment: local desktop runtime; renderer is built before Electron launch.
- Testing: Node test runner, TypeScript typecheck, Vite build, Go tests.

## Architecture Style

The product is a local-first desktop application with a thin UI and a testable workspace domain/backend layer.

React components are responsible for presentation and user interaction. They must not own filesystem traversal, path validation, storage schema, folder role resolution, project discovery, property normalization, view filtering, or local persistence rules.

Workspace backend modules own the product rules. The sidecar owns durable local document storage through `any-store`. Filesystem access is allowed only through backend/local runtime boundaries that validate paths against the selected project source folder.

High-level flow:

```text
React UI
  -> WorkspaceServiceClient
    -> workspace backend / use cases
      -> safe filesystem access
      -> any-store sidecar
        -> SQLite-backed local store
```

## Product Architecture Decisions

- Settings stores one `project source folder`.
- Workspaces in the Left Panel are saved working configurations over the selected `project source folder`.
- A Workspace is not a separate root folder in MVP.
- Different Workspaces can define different views, property visibility, value filters, ordering, and working configuration over the same project folders.
- Project `Status` is derived from a folder with role `status`.
- Projects outside a status folder use `No status`.
- MVP supports one level of status folders.
- MVP does not support drag and drop between primary status groups.
- Project primary identity must be a stable local id.
- The relative path inside `project source folder` is a locator, not the primary id.
- Absolute paths must not be used as stable project ids.
- Local product data must be structured so future `any sync` can sync documents without rewriting UI state.

## Layers

### UI Layer

Owned by React components under `src/App.tsx`, `src/components/`, `src/hooks/`, and `src/styles.css`.

Responsibilities:

- render Left Panel, Settings, Board view, Table view, and Project Detail Panel;
- resolve application-owned text through renderer localisation catalogs and persist the device-local interface locale;
- use Tailwind CSS and shadcn/ui for layout and controls;
- collect user actions and call workspace service methods;
- show loading, empty, error, and success states;
- keep temporary UI-only state local to components.

Rules:

- UI must not access Node filesystem APIs.
- UI must not call `any-store` or sidecar storage directly.
- UI must not implement folder role traversal or project discovery rules.
- UI must not create product ids ad hoc.
- UI-only state must not be persisted as product data.
- Interface locale is a renderer-owned device preference, not Workspace metadata and not `any sync` data.

### Application / Service Client Layer

Owned by `src/workspaceServiceClient.js` and future service clients next to it.

Responsibilities:

- expose stable named operations to UI;
- normalize request payloads;
- hide transport details from React;
- preserve a consistent service-method vocabulary such as `workspace.scan`, `workspace.listEntries`, and `workspace.saveProperty`.

Rules:

- Public service method changes require docs and tests.
- Service methods should map to product use cases, not individual UI widgets.
- Transport selection must remain replaceable so Electron/local backend and sidecar-backed calls can evolve independently.

### Workspace Domain / Backend Layer

Owned by:

- `src/workspaceBackend.js`
- `src/folderModel.js`
- `src/workspaceObjects.js`
- `src/workspaceProperties.js`
- future modules near these files for views, workspace settings, history, and migrations.

Responsibilities:

- validate the selected project source folder;
- scan visible directories;
- apply folder roles: `group`, `status`, `project`;
- derive project objects from folders;
- assign `No status` when a project is outside a status folder;
- enforce one level of status folders for MVP;
- normalize property schemas and property values;
- compute view projections and value filters;
- create and resolve stable local project ids;
- prepare product data for persistence;
- keep migration behavior explicit and tested.

Rules:

- Business logic must live here, not in React components.
- Backend modules must be importable and testable without launching Electron.
- New domain concepts require tests before UI wiring.
- Path validation must happen before file listing, preview, or open operations.

### Local Runtime / Filesystem Layer

Owned by `src/localOpen.js` and filesystem helpers in backend modules.

Responsibilities:

- resolve relative project paths against the project source folder;
- reject absolute paths from callers;
- reject `..` traversal outside the project source folder;
- open or reveal local files and folders only after validation;
- restrict preview endpoints to supported file types;
- hide dotfiles and hidden folders from project traversal unless a future ADR changes this.

Rules:

- All file and folder operations must be constrained to the selected project source folder.
- Deleting a Workspace from the app must never delete files on disk.
- Opening local items is a runtime integration, not UI logic.

### Storage / Sidecar Layer

Owned by:

- `cmd/workspace-sidecar/main.go`
- `internal/workspacestore/store.go`
- `src/workspaceSidecarClient.js`

Responsibilities:

- persist local product data through `any-store`;
- expose local HTTP endpoints for durable data operations;
- keep storage documents JSON-shaped and sync-friendly;
- isolate SQLite-backed persistence from React and domain logic;
- support future `any sync` by keeping product data document-oriented.

Current sidecar capabilities:

- get and set workspace root data;
- upsert property values;
- list property values by workspace id.

Required future capabilities:

- project source folder document;
- Workspace documents;
- View documents and view settings;
- folder role documents;
- property definition documents;
- select value documents;
- property value history documents;
- migration version documents.

Custom property work must use the contracts in `docs/api/workspace-properties.md`. React UI may render and edit custom properties, but property definition, select value, property value, and history persistence remain backend/sidecar responsibilities.

Rules:

- UI must not call sidecar routes directly.
- Storage document changes require `docs/data-model.md`, an API contract update when exposed, and tests.
- Sidecar HTTP routes are local implementation details unless documented as public app contracts.

## Module Boundaries

`src/App.tsx` and `src/components/`:

- may import UI helpers and service clients;
- must not import `node:fs`, `node:path`, `workspaceBackend.js`, or sidecar store internals.

`src/workspaceServiceClient.js`:

- may depend on abstract transports;
- must not know React component structure.

`src/workspaceBackend.js`:

- may depend on Node filesystem APIs and local domain helpers;
- must validate source folder availability and request paths;
- should coordinate scan/list/open responses for local runtime use cases.

`src/folderModel.js`:

- owns pure folder-tree traversal and role projection logic where possible.

`src/workspaceObjects.js`:

- owns conversion from discovered project folders to workspace objects and property value projections.

`src/workspaceProperties.js`:

- owns supported property types, schema normalization, select value normalization, and property value normalization.

`src/workspaceSidecarClient.js`:

- owns HTTP transport mapping for sidecar-backed operations.

`internal/workspacestore/`:

- owns Go storage documents and `any-store` collection access.

## Folder Structure Direction

Current structure remains acceptable for MVP, but new work should keep backend/local concepts grouped:

```text
src/
  App.tsx
  components/
  hooks/
  styles.css
  workspaceBackend.js
  workspaceServiceClient.js
  workspaceSidecarClient.js
  folderModel.js
  workspaceObjects.js
  workspaceProperties.js
  localOpen.js
cmd/
  workspace-sidecar/
internal/
  workspacestore/
docs/
  vision.md
  prd.md
  architecture.md
```

When the workspace backend grows, split by domain concept instead of creating large mixed modules:

```text
src/workspace/
  sourceFolder.js
  folderRoles.js
  projectDiscovery.js
  workspaceViews.js
  propertyDefinitions.js
  propertyValues.js
  propertyHistory.js
  pathSafety.js
```

This split should be introduced only when implementation pressure justifies it, and folder structure changes require approval.

## Data Flow

### Select Project Source Folder

```text
User selects folder in Settings
  -> UI calls workspace service
  -> backend validates the selected folder
  -> storage persists project source folder document
  -> UI refreshes active Workspace scan
```

### Scan Projects

```text
UI requests active Workspace scan
  -> service client sends workspace scan request
  -> backend loads project source folder and active Workspace settings
  -> backend scans visible directory tree
  -> folder roles produce project folders and statuses
  -> workspace object projection adds stable ids and property values
  -> UI renders Board or Table projection
```

### Edit Property Value

```text
User edits property value
  -> UI calls workspace service
  -> backend validates property schema and value
  -> backend records property value change
  -> sidecar stores current value and history document
  -> UI receives updated project projection
```

### Open File Or Folder

```text
User clicks file or folder in Project Detail Panel
  -> UI sends relative path and item kind
  -> backend resolves path against project source folder
  -> backend rejects absolute paths and traversal
  -> local runtime opens or previews the item
```

## Local Data Model Direction

Detailed fields belong in `docs/data-model.md`, but architecture requires these document families:

- `projectSourceFolder`: selected source folder and display name.
- `workspace`: saved configuration over the source folder.
- `view`: Board or Table view settings for one Workspace.
- `folderRole`: role assignment for a relative folder path in a Workspace.
- `project`: stable local id and current relative path locator.
- `propertyDefinition`: custom and system property schemas.
- `selectValue`: option documents for select and multi-select properties.
- `propertyValue`: current value for a project/property pair.
- `propertyValueHistory`: append-only change records for property definitions and values.
- `migration`: local schema and migration state.

Documents should prefer stable ids and relative locators. Absolute paths are runtime inputs and source-folder settings, not durable project identity.

## API And Contract Rules

- API contracts must be documented before implementation when a feature crosses UI/backend or backend/sidecar boundaries.
- Service methods should be named by use case, for example `workspace.createView`, `workspace.updateViewSettings`, `workspace.setFolderRole`, `workspace.updatePropertyValue`.
- Request payloads must carry relative paths only after a project source folder is selected.
- Responses must include explicit error states for missing source folder, missing project, invalid path, unavailable sidecar, and validation failure.
- Public contract changes require tests.

## Dependency Rules

- New npm or Go dependencies require approval.
- Prefer existing dependencies before adding new ones.
- UI should use Tailwind CSS, shadcn/ui, Radix UI primitives, and existing icon libraries.
- Domain/backend logic should prefer standard library and existing local helpers.
- Storage must continue through `any-store` unless an ADR replaces that decision.

## Migration Rules

- Existing `.workspace` data has priority over legacy `.folder-kanban` data.
- Legacy migrations must be one-way and conservative.
- Corrupt current `.workspace` files must not be overwritten by legacy data.
- New storage documents require migration tests.
- Migrations must preserve user-created Workspaces, views, folder roles, properties, values, and history.

## Filesystem Safety Rules

- Treat the selected project source folder as the security boundary.
- Never accept absolute project item paths from UI.
- Reject path traversal outside the source folder.
- Hide dotfiles and hidden directories from project scans in MVP.
- Preview only approved file types.
- Opening files and folders must be explicit user action.
- Workspace deletion in the app deletes only app metadata, never source files.

## Testing Strategy

Default verification:

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
```

Focused test expectations:

- folder role traversal and project discovery: `test/folderModel.test.js` and backend tests;
- path safety and local open behavior: `test/localOpen.test.js`;
- workspace backend responses and migration behavior: `test/workspaceBackend.test.js`;
- object identity and property value projection: `test/workspaceObjects.test.js`;
- property schemas and value normalization: `test/workspaceProperties.test.js`;
- service client contracts: `test/workspaceServiceClient.test.js`;
- sidecar transport and storage: `test/sidecarClient.test.js` and Go tests under `internal/workspacestore/`.

Every new backend/local-storage feature should include tests at the closest pure module boundary and one integration-style test where data crosses a boundary.

## Deployment And Runtime Model

- The app runs as an Electron desktop app.
- The renderer is built with Vite into `dist/renderer`.
- Electron loads `dist/renderer/index.html` with context isolation, sandboxing, and no Node integration.
- Direct browser/Vite dev mode is not the user-facing runtime.
- The Go sidecar is built separately and runs locally with a SQLite-backed `any-store` database.
- Packaging and distribution details are not part of the current MVP architecture and need a future ADR before release work.

## ADR Triggers

Create an ADR before:

- changing storage technology away from `any-store`;
- adding `any sync`;
- adding authentication or multi-user collaboration;
- changing project identity strategy;
- changing folder role semantics;
- allowing drag and drop between primary statuses;
- introducing a preload IPC contract;
- exposing sidecar routes as public contracts;
- changing folder structure boundaries;
- adding major dependencies.

## Known Trade-offs

- Keeping the UI thin adds service/domain code upfront, but it prevents storage and filesystem rules from leaking into components.
- Using stable local project ids plus relative path locators is more complex than path-only ids, but it protects metadata when folders are renamed or moved.
- One level of status folders is less flexible, but it makes project discovery and user expectations clear for MVP.
- Keeping sync out of MVP reduces scope, but document-shaped local data keeps the path open for `any sync`.
- Electron without preload IPC keeps the current runtime simple, but future native integrations may require an ADR for an explicit IPC boundary.

## Open Architecture Follow-ups

- Define the exact storage documents and indexes in `docs/data-model.md`.
- Define service/API contracts for Workspaces, views, folder roles, properties, values, and history.
- Decide how stable project ids are created and reconciled when folders move.
- Decide how sidecar lifecycle is managed by Electron for packaged builds.
