# Feature: Board Column Width Control

> Historical requirements snapshot. Current scope/status belongs to GitHub Issues; current behavior follows accepted contracts/ADRs. Old Current State, execution gates and checkboxes below are historical, not evidence of present completion. Preserve unmet criteria using the [carry-forward map](../specs/documentation-cleanup.md#legacy-acceptance-carry-forward).

## Goal

Allow each Board view to persist a shared status-column width and expose it through a compact slider at the bottom of `Customize Columns`.

## Context

Read:

- `docs/prd.md`
- `docs/architecture.md`
- `docs/interface.md`
- `docs/ui-guidelines.md`
- `docs/data-model.md`
- `docs/api/workspace-views.md`
- `docs/flows/board-table-views.md`

## Acceptance Criteria

- The control appears only for a Board view and sits at the bottom of `Customize Columns`.
- Moving the slider previews the new width without refreshing the projection or closing the menu.
- Releasing the slider persists `boardLayout.columnWidth` through `workspace.updateView`.
- Width is shared by all columns in that Board view and remains stable when columns are filtered out.
- Preferred width defaults to `384px`, has a minimum of `288px`, and the UI maximum for a new selection equals one third of the current Workspace working area.
- Resizing the window keeps the selected width fixed and uses horizontal Board scrolling when needed.
- Table views are unaffected.

## Constraints

- No new dependency or service method.
- React remains service-driven; normalization and persisted-range validation stay in the View domain module.
- Existing view documents without `boardLayout` remain compatible.

## Implementation Plan

1. Add Board layout normalization and validation to View documents and tests.
2. Extend renderer View state and optimistic update handling.
3. Add the slider using the installed Radix primitives and measure the Workspace toolbar width with `ResizeObserver`.
4. Apply the width through a CSS custom property in Board.
5. Run focused tests, frontend quality gates, and Electron verification.

## Quality Gates

```bash
npm test
npm run typecheck
npm run build:renderer
git --no-pager diff --check
```
