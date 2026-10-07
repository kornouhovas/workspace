# Product boundaries

Workspace is a local Electron app for projects that already exist as folders on disk. Board and Table show discovered projects, retain properties and view settings, and expose files through project detail. See [Vision](../vision.md) and [PRD](../prd.md).

Each Workspace configuration binds its own project source and folder roles. Workspaces may share a source or use separate roots; project values remain shared for a shared source. Accepted [ADR-006](../adr/006-workspace-source-bindings.md) refines the early shared-source model in Vision/PRD.

Roles `group`, `status` and `project` govern discovery. Status derives from a status folder; projects outside one retain `No status`. One level of status folders is supported. [ADR-007](../adr/007-board-table-status-moves.md) and [ADR-008](../adr/008-table-row-order.md) permit explicit Status pickers, Board Status-column drops and Table row crossings into visible explicit Status groups. All use the existing safe [Status move API](../api/workspace-status-move.md). Custom-property crossings and `No status` destinations are unavailable; a project originating in `No status` may move to an available Status. Table same-group reorder changes only view rank.

## Flows

- [Source and folder roles](../flows/settings-source-folder-and-roles.md): Workspace settings, folder selection and discovery.
- [Board and Table](../flows/board-table-views.md): views, search, filters and project detail.
- [Interface language](../flows/language-selection.md): local device preference.

Authentication, cloud sync, collaboration, public web access and a file editor remain outside the current MVP. Future `any sync` is a direction, not a wired feature. Check product changes against PRD and accepted ADRs; verify current implementation separately in code/runtime.
