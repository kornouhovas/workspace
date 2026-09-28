# ADR-006: Independent Workspace source bindings

Status: Accepted for workspace-9s1.
Date: 2026-09-28.

## Decision

Settings edits the selected Workspace’s source and folder roles. Workspaces can share a source or choose independent roots. This supersedes the single shared source product assumption in ADR-001; it does not change the target any-store architecture or the running transport.

The active Electron runtime continues to use JSON settings/views/property adapters behind WorkspaceServiceClient and sandboxed preload IPC. Add a backward-compatible `workspaceSources` map keyed by existing opaque Workspace IDs. Each binding stores a root locator and role snapshots keyed by root. Legacy siblings inherit the former shared source and roles before a binding changes. Retain the legacy fields and source-scoped project/property namespaces, IDs, values and history. A binding change moves no user files and deletes no metadata. Updating the current view document’s source reference preserves its ID and views.

Capture the target Workspace before opening a native picker. Serialize settings mutations, not picker interaction or filesystem reads. Filesystem requests accept the explicit Workspace ID so a delayed read cannot resolve against another active source. A missing root remains recoverable in Settings. Unknown historical paths are not reconstructed from hashes or replaced by another Workspace’s path.

Renderer session state stores a preview project ID independently of expanded tabs. The internal `workspace.getProject` operation refreshes it independently from saved-view filters, using the same backend discovery and property data. Only sidebar width becomes device-global; all other pane/session state remains per Workspace. An accepted load replaces the visible Workspace snapshot atomically and ignores superseded requests.

## Consequences

Existing Workspaces sharing a root continue sharing source-scoped project values; assigning different roots isolates their source data. Returning to a previous root recovers its retained roles and values. This is a compatible transitional adapter change, not a source/project identity migration or a Go/SQLite schema change. Durable target-store integration remains separate work.
