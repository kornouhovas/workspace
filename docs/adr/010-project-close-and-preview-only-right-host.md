# ADR 010: Close active projects to the saved view; right host is preview only

Status: Accepted by the user, 2026-10-08.
Supersedes: the standalone right Navigation/launcher and active-project close fallback in [ADR 005](005-bb-pane-session-chrome.md).

## Context

Closing the last fullscreen project removed its tab but retained right-host visibility. The empty host then displayed Workspace Navigation. The user requested real close behavior, removal of standalone right Navigation, preservation of partial previews and split panes, and return to the saved view when closing an active project even if other project tabs remain.

## Decision

- Closing the active expanded project tab returns to the selected Board/Table view. Remove only the requested tab instances; other tabs remain available and inactive. Closing an inactive tab preserves the current selection.
- Clear the selected project and per-view preview intent, invalidate pending preview responses, hide the right host, and restore/focus the Workspace host. Preserve surviving split leaves and their ratios; remove only leaves referencing closed tabs.
- The right host displays actual project preview content only. No standalone Navigation, empty launcher, right-tab lifecycle or Cmd/Ctrl+J / Cmd/Ctrl+T opener remains. A saved open host without a project is hidden and occupies zero width.
- Ignore legacy right-tab fields when reading pane layouts. Retain the existing pane-layout and project-session keys/versions, opaque Workspace/project/tab IDs, preview widths, sidebar preferences and valid split trees.
- Restore is distinct from Close: it removes that expanded tab and keeps its partial project preview. Independent preview close removes no expanded tabs. Split-pane close remains scoped to its leaf.
- Cmd/Ctrl+W closes the focused project preview or content; Shift+Cmd/Ctrl+T reopens a closed project tab. Editing/menu ownership and drag Escape cancellation remain unchanged.

## Consequences

Workspace/view navigation and Settings remain available through their existing primary/left controls. No backend, IPC, filesystem operation, durable data or Electron security setting changes. Regression checks cover active/inactive closes, obsolete commands, legacy session normalization, preview retention and actual desktop behavior at both supported verification sizes.
