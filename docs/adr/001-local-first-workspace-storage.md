# ADR-001: Local-First Workspace Storage With any-store

## Status

Accepted

Date: 2026-05-14

## Context

Workspace Project Board is a desktop app that works with existing project folders on the local filesystem. The product must save Workspaces, views, folder roles, properties, property values, value filters, and history without requiring authentication, a cloud backend, or network access in MVP.

The product direction is local-first:

- the selected project source folder remains the source of project files;
- product metadata is stored locally;
- Workspaces are saved configurations over the selected source folder;
- future `any sync` should synchronize product metadata without replacing the local model.

The repository already includes a Go sidecar under `cmd/workspace-sidecar` and `internal/workspacestore`, using `any-store` over SQLite. Current storage capabilities include workspace root and property value persistence. Existing project instructions also focus backend/local work on the local `any-store` sidecar and SQLite-backed workspace storage.

## Decision

Use `any local` through the local `any-store` sidecar as the durable product data store for MVP.

The app will keep a local-first storage boundary:

- React UI calls service methods and never accesses storage directly.
- Workspace backend modules own product rules and validation.
- The sidecar owns durable document persistence through `any-store`.
- SQLite remains an implementation detail behind `any-store`.
- Product data is stored as document-shaped records that can later be synchronized by `any sync`.

The local store is responsible for:

- project source folder metadata;
- Workspace documents;
- View documents and view settings;
- folder role documents;
- property definition documents;
- select value documents;
- property value documents;
- property value and property definition history;
- migration version documents.

Project identity must use stable local ids. Relative paths inside the project source folder are locators and may change when folders are renamed or moved. Absolute paths are runtime configuration inputs, not primary ids for projects.

## Alternatives Considered

### Option A: JSON files under `.workspace`

Pros:

- simple to inspect and edit manually;
- already used for some legacy and transitional settings;
- easy to test with filesystem fixtures.

Cons:

- weaker fit for document-level sync;
- harder to evolve safely as Workspaces, views, values, and history grow;
- more manual migration logic;
- higher risk of mixing UI state and product data in large JSON blobs.

### Option B: Direct SQLite access from Node backend

Pros:

- mature local storage model;
- explicit schema and indexes;
- easy to query with SQL.

Cons:

- bypasses the existing `any-store` direction;
- creates a larger future migration if `any sync` becomes the sync layer;
- adds more schema coupling to the Node backend;
- makes document-oriented product data less explicit.

### Option C: `any-store` sidecar over SQLite

Pros:

- matches the repository's current sidecar direction;
- keeps local storage document-oriented and sync-ready;
- isolates durable persistence behind a local service boundary;
- avoids direct database access from React and most Node modules;
- allows backend/domain logic to stay testable separately from storage.

Cons:

- adds sidecar lifecycle and local HTTP transport concerns;
- requires clear contracts between Node workspace services and sidecar endpoints;
- document validation and migration discipline must be maintained in application code;
- some simple MVP operations are more verbose than writing one JSON file.

## Consequences

Positive:

- MVP works offline and without authentication.
- The UI remains storage-agnostic.
- Product data has a clear path to future `any sync`.
- Storage-specific code stays isolated in the sidecar and sidecar client.
- Backend modules can be tested without launching Electron.
- Filesystem project data and app metadata remain separate.

Negative / trade-offs:

- Sidecar process management must be solved before packaged release.
- New storage document families require explicit migrations and tests.
- Local HTTP endpoints need clear contracts even though they are not public web APIs.
- Debugging storage issues may require inspecting `any-store` documents instead of simple JSON files.
- Stable project identity is more complex than using folder paths as ids.

## Follow-up Actions

- Define exact document shapes, ids, and indexes in `docs/data-model.md`.
- Add API contracts for Workspaces, views, folder roles, properties, values, and history before implementing them.
- Extend `internal/workspacestore` with document families beyond root and property values.
- Define migration versioning for local storage.
- Define Electron-side sidecar lifecycle for packaged runtime before release.
- Add tests for every new sidecar document family and migration.
