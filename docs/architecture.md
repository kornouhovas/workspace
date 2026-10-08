# Architecture: Workspace Project Board

## Current Runtime And Document Status

The active Electron path is React → WorkspaceServiceClient → renderer transport → sandboxed preload IPC → main dispatcher → domain/backend with transitional JSON settings/views/property adapters. See [ADR-002](adr/002-electron-preload-ipc-bridge.md), [ADR-006](adr/006-workspace-source-bindings.md) and the [development map](development/architecture.md). Electron does not currently start or wire the Go sidecar as its store; any-store remains the target durable architecture described below.

References below to sidecar persistence/data flows describe that target, not evidence that every running operation uses it. Preload IPC is already implemented under ADR-002. Verification and approval defaults follow [AGENTS.md](../AGENTS.md), rather than older blanket defaults in this document.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Radix UI primitives.
- Desktop shell: Electron loading the built renderer from `dist/renderer`; explicit development mode loads validated loopback Vite with isolated checkout metadata/userData. See [development boundaries](design/bb-stack-design.md).
- Local backend: Node.js workspace backend modules in `src/`.
- Current Electron storage: transitional JSON adapters; target durable storage: local `any-store` sidecar.
- Sidecar: Go HTTP process backed by `any-store` on SQLite.
- Auth: none in MVP.
- Deployment: local desktop runtime; renderer is built before Electron launch.
- Testing: Node test runner, TypeScript typecheck, Vite build, Go tests.

## Architecture Style

The product is a local-first desktop application with a thin UI and a testable workspace domain/backend layer.

React components are responsible for presentation and user interaction. They must not own filesystem traversal, path validation, storage schema, folder role resolution, project discovery, property normalization, view filtering, or local persistence rules.

Workspace backend modules own the product rules. Current metadata uses JSON adapters; the standalone Go sidecar implements the target any-store durable store, without active Electron wiring. Filesystem access is allowed only through backend/local runtime boundaries that validate paths against the selected project source folder.

High-level flow:

```text
React UI
  -> WorkspaceServiceClient
    -> renderer transport -> sandboxed preload IPC
      -> Electron dispatcher / domain use cases
        -> validated filesystem operations
        -> JSON settings/views/property adapters

Target, not wired: backend storage adapter -> Go sidecar -> any-store/SQLite
```

## Product Architecture Decisions

- Settings edits the selected Workspace’s project source folder (ADR-006).
- Workspaces in the Left Panel are saved working configurations with independent source bindings and folder roles.
- Workspaces may share a source or select different roots.
- Different Workspaces define their own views, property visibility, filters and ordering; existing source-scoped project identities and values remain shared when the source is shared.
- Project `Status` is derived from a folder with role `status`.
- Projects outside a status folder use `No status`.
- MVP supports one level of status folders.
- Board/card and Table/handle Status drag use the explicit validated move operation; see [ADR-007](adr/007-board-table-status-moves.md).
- Consumers use opaque project identities. Current fallback IDs and bounded explicit-move preservation differ from the proposed general registry; see [current/target identity](data-model.md#current-runtime-and-target-scope).
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
- preserve the existing vocabulary documented in [sources/lifecycle/filesystem](api/workspace-session-sources.md), [views](api/workspace-views.md), [properties](api/workspace-properties.md) and [Status moves](api/workspace-status-move.md). New property editing uses updateProjectPropertyValue; legacy saveProperty is not a guaranteed writing alias.

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
- existing `workspaceViews.js`, `workspaceGrouping.js`, `workspacePropertyStore.js`, `workspaceStatusMove.js`, `workspaceSession.js` and `workspaceSessionLifecycle.js`; store/registry integration remains separate.

Responsibilities:

- validate the selected project source folder;
- scan visible directories;
- apply folder roles: `group`, `status`, `project`;
- derive project objects from folders;
- assign `No status` when a project is outside a status folder;
- enforce one level of status folders for MVP;
- normalize property schemas and property values;
- compute view projections and value filters;
- resolve opaque discovered IDs and verified explicit-move aliases; the general registry remains Proposed ADR-004;
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

Current standalone sidecar capabilities:

- root settings, Workspace/View documents and their operations;
- property definitions, select values, values and history document operations;
- local HTTP route/client mappings and any-store collection access.

These capabilities are implemented independently; Electron does not start the HTTP sidecar or select it as its store. The confined project-creation CLI mode does not open HTTP/storage and does not change that fact.

Before target-store integration:

- reconcile the source/Workspace scope in the [data model](data-model.md#current-runtime-and-target-scope), preserving existing shared-root values/history;
- add and verify view round trips for `rowOrder`, `columnOrder`, `hiddenColumnIds`, `tableColumnWidths`, `boardGroupingVersion` and `boardLayout.wrapContent`, absent from the current Go document structs;
- define migration/recovery, retained unavailable IDs and startup/shutdown/packaging lifecycle;
- resolve project/source/role/migration document requirements not fully covered by the current target implementation. The general identity registry requires a decision on Proposed ADR-004.

Property normalization and persistence remain backend responsibilities. Current adapter behavior and target document families are defined in the [properties API](api/workspace-properties.md).

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

Keep the present module layout while it supports clear ownership. If implementation pressure requires restructuring, split by domain concept (source/roles/discovery, views/grouping, property definitions/values/history, path safety and migrations), preserving the public service boundary. A future directory illustration is not an instruction to move existing modules or establish a monorepo.

## Data Flow

### Select Project Source Folder

```text
User selects folder in Settings
  -> UI calls workspace service
  -> backend validates the selected folder
  -> JSON settings stores the target Workspace binding and retained role snapshots
  -> UI refreshes active Workspace scan
```

### Scan Projects

```text
UI requests active Workspace scan
  -> service client sends workspace scan request
  -> backend loads project source folder and active Workspace settings
  -> backend scans visible directory tree
  -> folder roles produce project folders and statuses
  -> workspace object projection resolves current IDs/explicit aliases and source-scoped property values
  -> UI renders Board or Table projection
```

### Edit Property Value

```text
User edits property value
  -> UI calls workspace service
  -> backend validates property schema and value
  -> backend records property value change
  -> current JSON property adapter stores value and history records (not one cross-record transaction)
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

The following target document families are specified in [data-model.md](data-model.md); the current scope/adapter table there distinguishes implemented compatibility behavior:

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
- Service methods are named by use case; use the implemented createView, updateView, updateFolderRole and updateProjectPropertyValue contracts, not invented aliases.
- Request payloads must carry relative paths only after a project source folder is selected.
- Responses must include explicit error states for missing source folder, missing project, invalid path, unavailable sidecar, and validation failure.
- Public contract changes require tests.

## Dependency Rules

- New npm or Go dependencies require approval.
- Prefer existing dependencies before adding new ones.
- UI should use Tailwind CSS, shadcn/ui, Radix UI primitives, and existing icon libraries.
- Domain/backend logic should prefer standard library and existing local helpers.
- Preserve the active JSON adapters and accepted any-store target; adapter integration and migrations require their own agreed scope.

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

Verification is selected by the affected boundary under [quality.md](development/quality.md); package scripts own actual command definitions. Documentation-only changes need consistency, links/anchors, applicable existing docs checks and whitespace, not a full Electron/Go build.

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
- The separately runnable Go HTTP sidecar uses SQLite-backed any-store; Electron does not launch it. Only the confined directory-creation helper invokes the Go binary in the current filesystem operation.
- Packaging and distribution details are not part of the current MVP architecture and need a future ADR before release work.

## ADR Triggers

Create an ADR before:

- changing storage technology away from `any-store`;
- adding `any sync`;
- adding authentication or multi-user collaboration;
- changing project identity strategy;
- changing folder role semantics;
- extending Status drag beyond the explicit Board/Table operation in [ADR-007](adr/007-board-table-status-moves.md) and the Table row contract in [ADR-008](adr/008-table-row-order.md);
- materially changing the accepted preload IPC boundary (ADR-002);
- exposing sidecar routes as public contracts;
- changing folder structure boundaries;
- adding major dependencies.

## Known Trade-offs

- Keeping the UI thin adds service/domain code upfront, but it prevents storage and filesystem rules from leaking into components.
- Current explicit-move locators preserve known project metadata. A complete stable registry for arbitrary folder changes is a separate proposed decision with migration costs.
- One level of status folders is less flexible, but it makes project discovery and user expectations clear for MVP.
- Keeping sync out of MVP reduces scope, but document-shaped local data keeps the path open for `any sync`.
- The accepted preload IPC bridge keeps privileged operations outside the sandboxed renderer (ADR-002).

## Open Architecture Follow-ups

- Complete target-store view-field parity and agree source-scope migration/lifecycle before any adapter switch.
- Resolve Proposed ADR-004 before implementing a general identity registry or marking audit A1 complete.
- Specify public web/server authentication/transport and packaging separately when those features are requested; existing preload contracts remain internal.

Project creation uses the existing Go binary in confined CLI mode, without opening its store/HTTP server or switching JSON metadata. The [creation contract](api/workspace-views.md#confined-directory-helper) and [ADR-009](adr/009-project-creation-os-guard.md) own platform enforcement and unverified limits.
