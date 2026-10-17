# Issue 30 verification

Contract/scenarios: [plan](../plans/issue-30-option-grouping.md).
CI, acceptance and integration: [GitHub #30](https://github.com/kornouhovas/workspace/issues/30).

## Candidate evidence

Environment: macOS arm64, Node 22.21.1; disposable filesystem and real SQLite fixtures.

- Ordinary selection service regression failed before supporting selection grouping;
  category service regression failed before supporting the folder-backed property;
  UI occurrence tests failed before exposing selections in the grouping control.
- Focused grouping/filter service/UI and production IPC: 41 passed at the first
  complete slice. Additional EN/RU Single Select UI scenarios pass in both layouts.
  Coverage includes stable rename identity, A+B membership, unused/hidden options,
  default/label/manual order, view-owned visibility/collapse/hide-empty, filters,
  independent duplicates, source siblings, restart, category rename/move/archive,
  and ordinary selection edits preserving physical placement.
- Typecheck, lint, documentation links and diff whitespace checks passed for the
  initial candidate. Final post-review checks are recorded below when available.
- Existing real Electron development views route passed EN/RU Table/Board selection
  grouping, keyboard edit from the B occurrence, typed readback of repeated logical
  IDs, width 360/1024/1440 screenshots, existing view/filter/restart/archive routes,
  normal quit/backend exit and fixture cleanup. Screenshots inspected for narrow
  Board and wide Russian Table; table scrolling stays contained. Category runtime
  visual coverage is being renewed in that same route.

Retained uncategorized presentation, independent review, full local inventory and
exact-SHA remote acceptance remain open. No final acceptance is claimed here.
