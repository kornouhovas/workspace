# ADR-008: Table row order and explicit Status-group crossing

Status: Accepted for workspace-9bp by the user’s confirmed scope.
Date: 2026-10-01.

## Decision

Replace Table’s separate Status zones with vertical row drag from the internal left handle. Save a per-Table `rowOrder` of opaque project IDs in the existing view JSON adapter; apply canonical rank before filtering/grouping, retain hidden/unavailable identities, and deep-copy it when duplicating a view. Multi-select occurrences share one identity and rank. No dependency, migration or sidecar wiring is introduced.

Same-group drops and keyboard Arrow Up/Down change only row rank. Crossing a visible explicit Status group resolves a fresh safe Status option and invokes the existing physical move; custom-property crossings are unavailable. Persist insertion order only after a completed move. No status is omitted from Status choices/drop destinations while its labels, groups, projects and origin-to-Status actions stay accessible.

## Consequences

This supersedes ADR-007’s Table zone/handle-picker clauses. Board pickers/column moves and Table/detail pickers remain. Source validation, pending/error handling, identities, properties/history, tabs/session, no-clobber and journal/recovery retain [the Status move contract](../api/workspace-status-move.md). Group order and custom membership remain independent of project rank.
