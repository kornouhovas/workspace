# Issue 59 verification

Baseline: `711eb15127bbb69bedb46cba125db9741f50f7eb`, after #58 closed.
Scope and current delivery/CI receipts: [GitHub #59](https://github.com/kornouhovas/workspace/issues/59).
Contract and visual handoff: [plan](../plans/issue-59-group-assignment.md).

## Appearance

The local production Electron run records 32 whole-screen idle/active-drag
captures: EN/RU × light/dark × Table/Board × 1024x720/1440x960. Inspect
`work/issue-59-assignment-final/report.json` and named PNGs. Reviewed representative
Table light/wide and Board Russian dark/narrow images beside the accepted #58
Board reference, with main/bb roles from the plan. Sidebar/tabs, Inter typography,
compact row/card controls and independent scrolling remain consistent. New
feedback is a semantic target outline and a viewport-contained floating hint;
it does not move or obscure the assignment source. Horizontal Board overflow
remains inside its existing work area. Whole-screen appearance is separate from
the value/identity assertions below.

## Affected behavior and retained guarantees

- 44 assignment UI/interaction cases pass, including all inherited scalar,
  Single Select and MultiSelect transitions, both layouts/languages, stale and
  lost replies, newer accepted values and filtered disappearance/focus.
- 50 focused assignment service/IPC/draft/interaction cases pass through real
  temporary SQLite and filesystem fixtures. No persistence/IPC implementation
  changed. Keep exact authored Text, Number and Date values, option identity,
  MultiSelect sets, unrelated values, source ownership and unchanged folders.
- 66 pre-review assignment/routing cases pass; 22 route checks prove the selected
  three-host CI profile and nonzero failure propagation. Typecheck/lint/docs pass.
- The completed local Electron command exercises every ordinary type in both
  layouts in EN/RU, real pointer assignment, keyboard clearing and destination
  selection, MultiSelect duplicate occurrences/merge/empty transitions, reload
  and unchanged project-file bytes. Its controlled layout check uses a DOM
  dragstart solely to measure unchanged production geometry; all-type and
  screenshot gestures still use actual native pointers. Normal app/backend
  termination and owned-fixture cleanup pass.

New renderer scenarios cover Escape/end cleanup, retained payload rejection,
active invalid drafts, pending competing edits/navigation without queuing,
late-reply focus ownership and retaining prior feedback during a new gesture.
The original assignment/service/IPC, grouping/filtering, scalar navigation and
native Views scenarios are retained. None is retired or replaced by screenshots.

## Diagnostic failures

Two early native attempts were incomplete, not passes. The first inserted drag
feedback in document flow; the second removed the previous saved result at drag
start. A controlled second-fixture probe measured source Y 216.3125 → 168.5.
This establishes the layout-shift mechanism; it does not uniquely identify all
native cancellation timing. Original attempts and the forced Browser.close /
unsettled-await exits remain in `work/issue-59/`. They do not supply normal-quit
acceptance. The completed fresh-fixture run passes original gestures and normal
shutdown/cleanup after the source-stability repair.

## Remaining delivery gates

Renew final local full-suite evidence after review, record actual failures and
focused renewals separately, inspect exact-SHA three-host CI and its artifacts,
then integrate the accepted candidate. No full-suite or hosted pass is claimed
by this intermediate report. Broader coherent/package/installer/performance and
release gates remain with #67/#42.

## Final candidate local receipts

Reviewed candidate: `306d71214df5f4083978b0fae7a6cabdca2a2445`.
Independent Spec and Standards follow-up reviews report zero findings.
`npm test` performed one fresh build and complete local inventory: **3,356 passed,
27 skipped, 12 failed / 3,395 tests**. Retain `work/issue-59/full.log` and
`full-failures.json`; this is not a passing full-suite claim.

Eleven failures are 10-second Electron fixture shutdown timeouts: category-header
layout (1), property-editor readiness (5), deferred native quit (1), projection
readiness (2) and selection-driver delayed closure (2). The remaining failure is
the readiness fixture's cleanup/error-preservation assertion. These standalone
fixture/lifecycle boundaries are unchanged; for example, the category-header
fixture bundles `CategoryPropertyHeader`, not the changed Table/Board controller.
The inherited local native-quit watchpoint also appears in #58's report. This
classification identifies the observed failure boundary, not its unique cause
or a waiver of a matching hosted failure. Preserve all original assertions;
no test was skipped, deadline raised or whole-suite retry used for acceptance.

Fresh production Electron receipt `work/issue-59-assignment-candidate/report.json`
records the exact `306d7121` SHA: **20 all-type/layout journeys**, the controlled
source-geometry regression, **32 whole-screen captures**, unchanged project-file
bytes, normal app/backend termination and asserted owned-fixture cleanup.
The earlier 32-screen local report has null SHA and supplies development
comparison only; the fresh exact-SHA receipt renews its acceptance scenarios.

| Affected inherited coverage | Decision and evidence |
| --- | --- |
| `group-assignment-service.test.mjs`, `group-assignment-ipc.test.mjs` | Retain exact values, set replacement/empty transitions, identity/ownership, rejection/reopen and unchanged folders; pass in focused/full runs |
| `group-assignment-ui.test.tsx` | Retain both layouts/languages, occurrence source, lost/stale replies, newer values and filtered projection/focus; 37 cases pass |
| New `group-assignment-interactions.test.tsx` | Extend with 7 cancel/draft/pending/focus/source-stability cases; pass |
| Grouping/filtering, Board/Table layout, scalar/selection UI | Retain their public behaviors and distinct ordering commands; selected by the scoped CI profile |
| Original Views native assignments | Retain original all-type helper and complete Views consumer; exact-SHA hosted result remains a gate |
| Standalone native fixture lifecycle checks | Retain all failure/shutdown/cleanup assertions and actual local failures; do not relabel forced cleanup as a normal exit |

Only documentation changes follow this application's reviewed candidate so far;
renew docs/links rather than replaying the full suite solely for this report.
