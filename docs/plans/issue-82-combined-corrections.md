# Issue 82: Combined desktop correction acceptance

Baseline: `7187635b` on `new-workspace`. Tracker: [#82](https://github.com/kornouhovas/workspace/issues/82). The accepted scenario definitions are in the [Main/new-workspace correction specification](https://github.com/kornouhovas/workspace/blob/ebf427cd/docs/specs/main-new-workspace-parity.md#acceptance-scenarios). All native and textual blockers #71–#81 are closed and integrated. This issue checks their composition; it does not accept #67 or a release.

## Scenario and evidence selection

| Scenario | Implementing issue | Observable check on the combined candidate |
| --- | --- | --- |
| A01 | #73 | Fresh disposable example root immediately opens in status-grouped Table; child projects, names and folder bytes survive restart. |
| A02 | #73, #74 | Picker cancellation creates nothing; a second workspace reuses source roles and data. |
| A03 | #74 | Explicit group/status/project roles, nearest status and project stop boundary; parent edits preserve explicit child roles. |
| A04 | #74, #75 | No status project remains visible; same-name statuses retain distinct path identities and move choices. |
| A05 | #77 | Settings and group menus edit the same workspace-local color; reopen preserves it without filesystem changes. |
| A06 | #72, #75 | Allowed whole-folder move preserves ID/values/bytes; collision, No status and nested-status refusal have no effects. |
| A07 | #76 | Ordinary Archive stays an active status; first special archive designation and later reuse preserve distinct roles. |
| A08 | #74, #78 | General combines language/theme; Workspaces owns folder configuration/shared impact; Settings/Back restores context. |
| A09 | #79 | Actual macOS controls share top strip and retain drag/minimize/close/fullscreen behavior. |
| A10 | #80 | Project A→B preview overlay preserves view geometry/scroll/grouping; close and expand/return preserve retained tabs. |
| A11 | #81 | + menu creates default-named Board/Table immediately; duplicate names work. |
| A12 | #81 | Context/right-click and accessible menu actions retain rename/duplicate/delete and last-view protection. |
| A13 | #81 | Pointer and menu reorder agree after restart; grouping remains view-local. |
| A14 | #71, #72 | Durable same-folder evidence remains valid across device-number drift at the public service seam. |
| A15 | #71, #72 | Replacement, wrong volume, link, unavailable and insufficient legacy evidence fail closed with retained data and truthful recovery. |
| A16 | #71, #72, #74 | Disposable real SQLite upgrade/restart/recovery retains IDs, values, views, roles and sessions; affected mutation boundaries remain safe. |

## Verification boundary

Run focused real SQLite/filesystem tests and selected actual Electron journeys on the same source tree. Inspect the 1024×720 and 1440×960 EN/RU light/dark captures and System-theme behavior. Run typecheck during verification and one final complete suite. The source-identity and storage changes have already been accepted per issue with actual macOS/Windows receipts; cite them by source SHA and artifact rather than relabeling them as exact-candidate results. Renew cross-correction behavior, native appearance and affected migration/regression/performance evidence where inputs have changed. Capture missing platform checks and inherited #67 failures as open gates. Use temporary roots and databases only; no live reassociation.

Review the versioned report against both the issue and project standards before committing. Push and integrate into `new-workspace` only after the scoped acceptance gates pass. The final #67, #42, #47 and #7 gates remain separate.
