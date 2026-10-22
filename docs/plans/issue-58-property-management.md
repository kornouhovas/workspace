# Issue 58: contextual property management

Issue: https://github.com/kornouhovas/workspace/issues/58
Baseline: `fba398960b534b56a898930c132066e855f71a45` (accepted #57).
Executor: Matt Pocock implement/TDD. Live acceptance/checkpoints: GitHub issue.

## Scenario and design handoff

Use main `080b416c` for whole-screen composition and bb `f135a001` for compact
Inter/semantic tokens, retaining #68/#69's established foundation. Target Table
headers, Board property controls and project details. One Add property popover
contains name and type; existing definitions expose rename, immutable type,
ordinary options and reviewed removal in the same Radix surface. No permanent
per-type creation forms. Keep current source-wide mutation services and independent
workspace hiding/view presentation. Reuse existing layout controls.

- Create all five custom types; rename from every surface without changing type.
- Review property or ordinary option usages including retained/archived projects
  and sibling workspace saved views; choose clear/replacement before reviewing.
- Stale review, preview/save failure and cancellation preserve actual data;
  require fresh review after failure, never replay an uncertain mutation.
- Pending work owns dismissal/navigation; Cancel/Escape returns focus to the
  initiating control, with a surviving property/add control after deletion.
- Shared definitions/values/ordinary options and independent workspace/view
  presentation survive reopening. No filesystem mutation is introduced.
- Inspect real Electron in EN/RU, light/dark, 1024x720 and 1440x960; compare whole
  screens and open menus with accepted reference roles separately from behavior.

## Test seams and retention

Issue-preagreed seams: public typed Workspace service with temporary real SQLite
and folders, renderer interactions, actual Electron changed-flow smoke. Retain
metadata-removal service/IPC/UI scenarios, select service ownership, immutable
types and archived/retained cleanup. Adapt old creation and removal entry-point
UI/native drivers to one contextual creator and property menus. Preserve each
underlying assertion; add contextual keyboard/cancel/error/focus tests. Existing
Table/Board layout and scalar/selection guard guarantees remain covered.

## Verification selection

Focused renderer/service/IPC tests during slices, typecheck/lint/build, early
Electron appearance comparison, native changed-flow checks and full test suite
once on the reviewed candidate (implement skill). No schema, dependency, native
filesystem or installer boundary is planned; broaden checks if that changes.
Exact candidate/host/command/artifact receipts and remaining acceptance gates
belong in the GitHub checkpoint.

## Candidate handoff

Implementation, two-axis review, visual comparison and test-retention results are
recorded in [the verification report](../verification/issue-58-property-management.md).
Both independent review axes have zero unresolved findings after three repairs.
Current CI/integration state remains in the GitHub issue checkpoint.
