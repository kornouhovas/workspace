# Issue 30 verification

Contract/scenarios: [plan](../plans/issue-30-option-grouping.md).
Exact-SHA CI, acceptance and integration: [GitHub #30](https://github.com/kornouhovas/workspace/issues/30).

## Local behavior and review

Environment: macOS arm64, Node 22.21.1; disposable filesystem and real SQLite fixtures.
No user project data is used and no new dependency or bb code is copied.

- Ordinary selection service tests failed before supporting selection grouping;
  category tests failed before supporting the folder-backed property; occurrence UI
  tests failed before selections were exposed in the grouping control.
- Latest focused grouping/filter service/UI/IPC plus the affected category-move UI
  file: **253 passed**, zero failures. Typecheck, lint, documentation links and
  `git diff --check` pass after the fixture reconciliation.
- Scenarios cover stable option IDs/current names, A+B memberships with one logical
  project ID, unused/source-hidden options, ordinary empty groups, source/default,
  ascending/descending/manual order, filtered empties, view-owned visibility and
  collapse, independent duplicates, source siblings and restart. Category rename,
  physical move and archive retain identity; ordinary selection edits leave physical
  placement unchanged. Both EN/RU layouts share edited metadata across occurrences.
- The owner selected a conditional No value group for uncategorized retained records
  after Direct → Grouped, never an active-project category/destination. The service
  regression failed before this repair, then passed with exact IDs, presentation
  settings and restart. EN/RU Table/Board tests verify keyboard Locate activation and
  editing preserved metadata from that recovery group.
- Independent Standards review found zero hard violations and one optional duplicated
  supported-type list, resolved with a shared constant. Key validation inventories
  and default option-order lookups are indexed. Independent Spec review reproduced
  the retained-record omission and confirmed its repair. Both follow-up axes report
  **zero remaining findings**.

## Real Electron and baseline shutdown limitation

The existing `npm run smoke:views -- dev` route includes selection, category and
retained-record grouping through real renderer/preload/IPC/service. The initial
selection/category candidate passed the full route, including normal quit/backend
exit and cleanup. After the retained extension, both languages completed Table/Board
UI scenarios, typed membership/readback, keyboard edits and screenshots; the final
normal-close gate failed. These later executions are not reported as overall passes.

Inspected narrow/wide EN/RU selection/category/recovery screenshots at 360, 1024 and
1440 where applicable. Page overflow assertions pass; Table scrolling stays contained.
The recovery group retains metadata and Locate controls. A first new fixture expected
an incorrect Russian Locate label; it was corrected to the existing `Найти папку`.

A normal Electron close timed out at the unchanged ten-second limit, including in
an isolated original run. Four existing native quit/editor controls passed in a
focused run. A minimized empty-database launch/close reproduces without projects or
grouping. The same minimized command against baseline `new-workspace` (`7db74028`)
passed three closes then reproduced the timeout. Removing the window-all-closed
handler did not remove it. Quit events precede the eventual forced parent exit;
these observations do not identify the historical cause. No lifecycle workaround,
retry, timeout extension or weakened normal-quit/cleanup assertion was introduced.
Original failure and baseline-comparison evidence is retained locally under ignored
`work/issue-30-option-grouping-failures/` and `work/issue-30-quit-diagnosis/`.

## Complete local inventory

Ran every file selected by `selectTestFiles(..., 'all')`, with
`node --import tsx --test --test-concurrency=1`: **95 files, 2943 tests; 2915 passed,
3 failed, 25 conditional platform skips**. Nothing was excluded.

Two failures were the EN/RU category-move fixture querying `Portfolio` across the
whole screen after the grouping selector added a second legitimate occurrence.
Its assertion now targets the named column header; all existing category/Text
selection and save assertions remain. The complete affected file and grouping/filter
service/UI/IPC set then passed all 253 checks. The third failure was the unchanged
`runtime-electron-quit` native shutdown test described above; no local full-green
claim is made. The complete exact-SHA remote matrix, original development/packaged
views routes, required artifacts and delivered SHA remain tracked in GitHub.

## CI coverage

New scenarios extend existing platform service/UI/IPC files and the shared
`smoke:views` helper used by both development and packaged macOS/Windows routes.
The ordinary full matrix and its test inventory, deadlines, normal shutdown and
cleanup requirements remain unchanged. There is no migration or new CI selector.
