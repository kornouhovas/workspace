# Current runtime and architectural boundaries

Use [architecture](../architecture.md) for layer ownership and target integration, [data model](../data-model.md#current-runtime-and-target-scope) for current/target scopes, and the relevant [API](../api/) for operations. Read accepted ADRs for the affected boundary; ADR-004 remains Proposed.

## Active Electron path

```text
React -> WorkspaceServiceClient -> renderer transport
  -> sandboxed preload IPC -> Electron dispatcher
    -> domain/backend -> JSON settings/views/property adapters
```

Trace [client](../../src/workspaceServiceClient.js), [transport](../../src/workspaceRendererTransport.ts), [preload](../../electron/preload.cjs), [main](../../electron/main.js) and [dispatcher](../../electron/workspaceIpc.js). Normal metadata uses .workspace; development uses an isolated checkout profile described in [bb stack/dev guide](../design/bb-stack-design.md).

Filesystem validation, discovery, roles, property normalization and projections belong to backend/domain modules. React composes presentation and current service actions. Retain contextIsolation, sandbox and disabled nodeIntegration; renderer has no Node/storage/sidecar imports. Workspace deletion changes app metadata, not project files.

[workspaceSession](../../src/workspaceSession.js) owns pure tab/pane/selection commands and subscribed snapshots ([ADR-010](../adr/010-renderer-session-command-owner.md)). [workspaceSessionLifecycle](../../src/workspaceSessionLifecycle.js) adds injected storage/current service adapters for persistence, restoration and request freshness ([ADR-011](../adr/011-renderer-session-lifecycle.md)). General loading, CRUD queues and DOM effects remain composition adapters.

## Target store and bounded filesystem helper

[ADR-001](../adr/001-local-first-workspace-storage.md) retains Go/any-store/SQLite as the durable target. Standalone [sidecar](../../cmd/workspace-sidecar/main.go) and [store](../../internal/workspacestore/store.go) implement document operations; Electron neither starts their HTTP server nor replaces its JSON adapters. Running sidecar separately does not change app storage.

The [integration gap list](../architecture.md#storage--sidecar-layer) covers view-field parity, scope compatibility, migration/recovery and lifecycle. [ADR-006](../adr/006-workspace-source-bindings.md) preserves independent roots and source-scoped compatibility data; target examples do not authorize a namespace rewrite.

Project creation uses a confined CLI mode of the existing Go binary, distinct from storage/HTTP. Its contract and platform limits are in [creation helper](../api/workspace-views.md#confined-directory-helper) and [ADR-009](../adr/009-project-creation-os-guard.md). Current Status moves retain their [recovery contract](../api/workspace-status-move.md); a general identity registry and original-checkout rename changes are separate work.
