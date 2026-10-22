# Issue 58: contextual property management

Issue: https://github.com/kornouhovas/workspace/issues/58
Baseline: `fba398960b534b56a898930c132066e855f71a45` (accepted #57).
Live CI/integration acceptance and exact delivered SHA: GitHub checkpoint.

## Scope and appearance

One Radix creator supplies name/type. Table headers, Board property controls and
project detail labels use the same definition editor; types remain immutable.
Ordinary option management exposes reviewed removal both here and within value
editors. Source mutation and reviewed cleanup services are unchanged; hiding and
field presentation keep their workspace/view ownership.

Main `080b416c` remains the composition authority; bb `f135a001` supplies styling.
Compared whole-screen output against the accepted principal reference roles and
[Table](issue-69-evidence/table-1440.png),
[Board](issue-69-evidence/board-1024.png) and
[project preview](issue-69-evidence/preview-tree-1024.png).
Sidebar, tabs, density, one project area, real properties/tree and Inter tokens
remain. No permanent per-type creation stack or duplicate detail property list.

Early inspection exposed missing popover surface styling and a clipped Russian
review. Shared semantic background/border/shadow, portaled owner tagging,
available-height scrolling and sticky actions corrected those differences.
The final matrix includes Table/Board/details, EN/RU, light/dark and
1024x720/1440x960: 24 screen combinations, 48 whole-screen captures. It additionally
creates/deletes all five types on each surface in both languages (30 cases),
checks source siblings, exact project bytes and equality after restart, with normal
quit and owned-process cleanup. Final selected captures:

- [Table review](issue-58-evidence/Table-en-light-1024-review.png)
- [RU dark Board review, including Cancel](issue-58-evidence/Board-ru-dark-1024-review.png)
- [Contextual detail rename](issue-58-evidence/Details-en-light-1440-rename.png)
- [RU dark detail review](issue-58-evidence/Details-ru-dark-1024-review.png)

[Report](issue-58-evidence/report.json) and [hash manifest](issue-58-evidence/manifest.json)
identify local host and artifacts. This local working-candidate receipt is separate
from exact-commit hosted CI evidence; it is not relabelled as a hosted run.

## Affected behavior and retained guarantees

TDD at the issue-preagreed public service and renderer seams covers contextual
create/rename/cancel/stale review/deletion across surfaces and languages, current
option clear/replacement reviews, and explicit failed-option cancellation.
The simultaneous Table/details regression delays Apply's reply after the actual
service deletion notification and requires focus in the initiating Details.
Pending review owns navigation/Escape; failed/unknown Apply requires a new review,
not mutation replay. Existing real SQLite service/IPC tests retain transactional
cleanup, sibling views, retained/archived projects, reopening and unchanged files.

Inherited test decisions:

- **Adapt** creation button callers and native creator readiness to Add property
  plus type selection; retain failed drafts, pending prevention and focus.
- **Adapt** ordinary option tests/drivers to the contextual definition/value editor;
  retain names/colors/order, hiding, hidden chosen values and sibling notifications.
- **Adapt** metadata native entry points to header/property menus. The superseded
  360px check is replaced by the accepted 1024x720 and 1440x960 desktop matrix
  (mobile is outside #47); overflow, review, focus and cleanup assertions remain.
- **Retain** metadata-removal service/IPC, view/filter/group/layout, immutable type,
  source identity, archive/retained, isolation and filesystem preservation coverage.
- **Add** failure Cancel/Escape and event-before-reply focus regressions. No current
  data-safety requirement or failing old-UI scenario is deferred or retired.

## Standards

Independent review found two focus risks: workspace-wide fallback could target a
background surface; deletion observation could unmount the editor before its
completion callback. Same-surface fallback refs and open-controller unmount
restoration fix both. The reviewer reran the new public renderer suite (13/13).
Follow-up: zero unresolved findings.

## Spec

Independent review found failed option hide/reorder incorrectly blocked explicit
Cancel/Escape. Nonbusy cancellation now exits without another mutation, while
pending actions retain ownership. Four regressions cover hide/reorder and both
exit routes. Follow-up: zero unresolved findings; no scope creep identified.

## Verification status

Node 22.21.1, local macOS 27.0 arm64. Typecheck/lint pass. Focused checks include
50 affected renderer/service/route cases before review and 35 property/selection/
scalar cases after repairs. The new native property flow passes 54 checks and
restart/normal cleanup; original Select and MultiSelect flows each pass EN/RU
with restart and normal cleanup. Final hosted receipts follow in the issue checkpoint.

The full `npm test` ran once on the completed application candidate: **3,326
passed, 27 platform-skipped, 26 failed** (3,379 total). Six inherited Board/Number/
Date UI failures were repaired by adapting only entry points and the portaled
textbox scope; all 12 affected scenarios pass. The subsequent renderer/property/
CI routing run passes 138 tests, and typecheck/lint were renewed. Application
inputs remain unchanged, so passing full-run scenarios and native appearance
receipts retain their evidence under the test-only renewal policy.

One Ladle failure was caused by the task worktree initially sharing another
worktree's `node_modules` through a symlink, outside Vite's allow list. A local
copy of the same dependencies removes that environmental difference without
changing the application or test contract; its original failure is retained.
The focused Ladle renewal passes (1/1).
Nineteen other failures are native fixture quit timeouts (one cleanup assertion
follows that timeout). They are not a passing full run. The runtime lifecycle
helper and these unchanged fixture shutdown boundaries were not repaired by
this issue; hosted candidate acceptance remains required. The original log is
`work/issue-58/local-verification/full-suite.log`.

Earlier focused local creator/lifecycle fixture runs also retain five 10-second Electron quit
failures, consistent with the separately recorded #57 local quit watchpoint.
They are not a passing fixture run or an inferred repair. Required hosted evidence
must resolve actual candidate acceptance; original failure artifacts remain local.
Runtime dependencies, database schema, filesystem/native commands and installer
inputs are unchanged; broader performance/release gates remain #67/#42.

## First hosted candidate and driver renewal

Run [39840737080](https://github.com/kornouhovas/workspace/actions/runs/39840737080),
at `619b4b125587949604e7f79397d75374b7edc805`, retained the original failures:

- macOS: 285 tests pass; the property smoke sampled the old Board owning trigger
  while Table activation was completing. No property interaction/capture passed
  in that command. A controlled delayed view switch reproduces `saved-board`
  after the original single click. Waiting for selected tab, associated visible
  panel, actual layout and loaded fields fixes that red regression.
- Windows latest: 284 tests and the property/selection/Select/MultiSelect flows
  pass. Original Views then loses its newly opened selection editor to delayed
  Grouping focus return. The failure screenshot retains the old A+B value and
  focus in Grouping. Controlled EN/RU layer-closure regressions reproduce the
  still-open parent. Waiting for both layer focus returns before opening the
  selection editor fixes those regressions without changing selection assertions.
- Windows 2022: the complete original scoped profile passes, including Views.

The repair is confined to test drivers, regressions, routing and documentation.
`src`, schema/migrations, native resources, dependencies, lockfile, build and
packaging inputs remain unchanged from `619b4b12`. Grouping readiness is scoped
specifically to the selection-edit journey; the shared presentation/performance
helper remains unchanged. The property flow also observes creator/fallback focus
return before opening the next tool, using the existing focus-return regression.
No action is replayed, deadline widened, product assertion removed or failure
counted as a pass.

The controlled repair run passes 3 native regressions; routing passes 20 tests;
typecheck/lint pass. The original local Views command passes all six journeys
with normal shutdown/cleanup. Both independent follow-up review axes report zero
findings in the test-only repair and its two-phase consumer mapping.
Exact focused/tail SHA/run/artifact receipts remain in the GitHub checkpoint;
missing or unreached commands remain acceptance gates until those runs finish.

The first focused run
[39843034740](https://github.com/kornouhovas/workspace/actions/runs/39843034740)
at `8465786c` failed before either original command: both fresh hosts started
Electron's lazy download/extraction from two parallel native workers, and the
view-entry worker reported `Process failed to launch!`; the two grouping
regressions passed. The repair profile now completes `require('electron')`
serially before parallel native regression workers, matching the existing
`test-suites.mjs` cold-install contract. This is a preparation failure, not a
failed property assertion or passing original-command receipt. Original logs
remain retained; the exact same two-host gate must pass before tail acceptance.


## Deferred creator focus repair

The cold-install repair run [39843876212](https://github.com/kornouhovas/workspace/actions/runs/39843876212)
at `397021f9` completes Electron preparation. macOS passes the three controlled
native regressions, then the original property smoke loses creator focus after
its second creation. Windows passes view-entry and RU grouping regressions but
fails EN fixture `setContent` waiting for `load` within the interaction budget;
its original Views command is unreached. These are failed receipts.

A renderer regression demonstrates a specific application defect: a newer source
notification starts a read; the older successful creation reply closes the
creator while its trigger remains disabled. Its one-shot animation-frame focus
return is lost before the read re-enables the trigger. The corrected UUID fixture
fails precisely on the final focus assertion (`ci-focus-loading-red3.log`). The
first two fixture attempts were invalid and do not establish that cause. This
controlled reproduction proves the defect, but does not by itself prove the
same timing caused the hosted macOS failure.

The owning property surface now retains its focus request until the trigger is
usable, retaining same-owner fallback and Retry behavior. Follow-up review found
that such a deferred request must yield to a newer user focus choice. A second
regression fails before that cancellation is added (`focus-intent-red.log`), then
both scenarios pass. The combined focused renderer/removal suite passes 19 tests
and typecheck. Existing deletion unmount and background Table/Details ownership
regressions remain green. Bounded smoke failure metadata records active control,
creator disabled/hidden/owner state and panel loading if hosted failure recurs.

The grouping fixture now waits explicitly for DOMContentLoaded with a separate
15-second preparation budget. Its original one-second interaction deadline,
100ms delayed focus, final parent closure and checkbox assertions are unchanged.
The focused three native regressions pass locally. This repairs setup rather
than accepting the failed Windows command.

Unlike the preceding driver-only repairs, this changes application source.
After both original focused commands pass, renew the entire `properties` profile
on all three hosts at the repaired SHA; the earlier test-only tail reuse is no
longer sufficient for this candidate. Exact receipts remain in the issue
checkpoint. A failed or unreached command remains unresolved.

## MultiSelect reopen sequencing renewal

Full scoped run [39846560532](https://github.com/kornouhovas/workspace/actions/runs/39846560532)
at `d4c6206a` passes macOS's 287 tests, property smoke, selection-editor smoke and
original Single Select. Original MultiSelect passes EN, then RU times out at its
existing 15-second focus-return wait following Clear, Close, immediate reopening
and Escape. Normal shutdown and owned cleanup pass; Views is unreached. Its
original screenshot, evidence and logs are retained. Both Windows results must
be reconciled separately before acceptance.

The unchanged original MultiSelect command passes locally. A controlled native
reproduction demonstrates that the existing Close-to-reopen gap admits delayed
focus return from the previous menu, dismissing the newly opened editor. The
old sequence fails with zero editors instead of one; the revised driver observes
both actual dismissal and exact initiating trigger focus before reopening once.
This proves the timing hazard, not the exact historical actor in the hosted
failure. Failure-only bounded focus history and trigger state remain available
if the original command fails again. Product values, hidden-option/persistence/
file assertions, Escape and final focus expectations remain unchanged, with no
replayed action or widened deadline.

Six native driver regressions, lint, and both local original MultiSelect journeys
pass with normal quit/cleanup. Both review axes report no findings. Renew the
failed macOS original command with existing `selection-focus`. Since only the
MultiSelect driver consumes the new helper, follow focused success with changed
Windows MultiSelect consumers and unreached macOS Views; app/build/dependency
inputs and earlier passing property/selection/Single Select receipts remain at
`d4c6206a`. Exact renewed results belong in the issue checkpoint.
