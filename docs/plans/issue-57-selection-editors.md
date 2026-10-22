# Issue 57: immediate ordinary selections

Issue: https://github.com/kornouhovas/workspace/issues/57
Baseline: `e6de28fb` (accepted #56 integration). Executor: Matt Pocock implement/TDD.

## Scope and scenarios

- Reuse #68/#69 compact Inter/Radix controls; one ordinary selection editor in Table, Board and project details. Main composition reference remains `080b416c`; no principal-screen redesign.
- Single Select commits on choice, including empty; MultiSelect commits each toggle serially and stays open. Escape/Close never rolls back committed values.
- Keep set semantics and hidden chosen values removable; exclude hidden unselected options from new choices.
- Preserve failed desired selection, validation/busy/error feedback, explicit retry/cancellation, identity/revision ownership and no automatic retry. Navigation waits for the queue, then blocks on failure through #56's shared guard.
- Expose existing create/rename/color/reorder/workspace hiding controls inside each editor. Keep current reviewed deletion route (#58 owns its replacement). Folder-backed Select remains on filesystem commands.
- Retain source-wide sibling updates and workspace-local hiding, field/view ownership, restart/persistence, isolation and performance contracts through existing public service checks.

## Test seams and retention

The issue pre-agrees typed Workspace service with disposable real SQLite/folders, renderer user interactions and actual Electron flows. TDD uses those seams.

- Adapt `single-select-ui` and `multi-select-ui` and their native smoke drivers: manual Save/cancel-of-uncommitted-set is superseded by immediate choice/toggle. Preserve option lifecycle, failed save, hidden selection, sibling update, keyboard/focus and empty cases.
- Add `selection-editors-ui` for delayed rapid-toggle serialization and failed-navigation/no-blind-retry behavior; exercise all surfaces/languages through the real Table/Board/details consumer.
- Adapt `view-grouping-ui` and `runtime-view-grouping`: immediate choices replace manual Save; preserve repeated-project identity and assert MultiSelect retains its original editor until Escape. Run the consumer with the same draft provider as App. Adapt Board wrapping measurement to identify Tags explicitly now that Single Select shares chip markup.
- Retain existing select service/IPC suites for source/workspace ownership, set validation, persistence and delayed snapshots.
- Retain scalar drafts/navigation checks for the shared guard; preserve existing safe deletion and folder-backed command suites.

## Verification selection

Typecheck/lint/build; focused renderer/service/IPC and guard/navigation suites; full suite once after review per implement skill. Inspect real Electron open menus in Table/Board/details at 1024x720 and 1440x960, EN/RU, light/dark. Compare controls with #68 and the retained principal composition. Adapt native select/MultiSelect smoke consumers and run them on the candidate. Installer, native filesystem adapter, persistence schema and runtime dependencies are unchanged; broad release/platform gates remain #67/#42.

Current implementation/acceptance status is recorded in the GitHub issue checkpoint.
