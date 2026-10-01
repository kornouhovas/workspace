# ADR-007: Explicit Status moves from Board and Table

Status: Accepted for workspace-d9h by the user's explicit scope.
Date: 2026-10-01.

## Decision

Extend the existing explicit Status operation to Board card and Table cell pickers, Board card drops into Status columns, and Table internal handle drops into explicit Status zones. This supersedes the previous primary-status drag prohibition for these actions. All entry points call the existing WorkspaceServiceClient methods and sandboxed preload IPC; React provides interaction and display only.

Table zones come from fresh project Status options, independently of grouping, search, filtering, hidden Status and Multi-select display occurrences. Targets are stable derived Status IDs; custom values and view settings are unchanged. The handle also opens an accessible picker. Escape, current Status and outside drops are no-ops; shared pending blocks repeats.

## Consequences

Folder-derived Status, selected source validation, no-clobber, opaque identity/values/history preservation and existing journal/recovery remain governed by [Status move API](../api/workspace-status-move.md). No dependencies, storage migration, filesystem protocol or row-sort operation are added. Existing JSON adapters remain active under ADR-006.
