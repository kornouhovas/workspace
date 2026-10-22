# Issue 60 contextual project operation verification

Baseline: `8b490e5e8801ffe7c2e52302d72cd6258b4443a5` after #59 closed.
Scope and retained coverage: [plan](../plans/issue-60-contextual-projects.md).
Hosted acceptance and delivered SHA belong to the [GitHub checkpoint](https://github.com/kornouhovas/workspace/issues/60).

## Candidate evidence

Local host: macOS 27 arm64; Node 22.21.1, Electron 44.7.0.

- Targeted public service/SQLite/folder/crash/IPC, renderer/navigation and CI route
  run: 939 passed, 7 platform-conditional skips, zero failed (946 total).
- Creation/rename renderer suite: 296 passed before adding explicit stale-name
  review; its new regression then failed before implementation and passes after.
- Typecheck, lint, renderer/full build, version consistency, local Markdown links
  and diff whitespace checks have passed during development.
- Real Electron early candidate: 18 journeys and 32 whole-screen captures pass,
  covering direct creation, Cancel before submission, Table/Board rename from
  list/preview/expanded details, occupied targets, exact project IDs, retained
  tabs, sentinel bytes and Text metadata. Includes explicit current-name review
  after live source observations. Normal application/backend exits and asserted
  owned-fixture cleanup pass. Files: `work/issue-60-projects-attempt5/`.

These are observed development receipts, not final exact-SHA/hosted acceptance.
The initial checkpoint preceded the full local suite, independent review and
hosted acceptance. Their actual receipts and remaining gates are recorded below.

## Appearance

Compared actual Table screens with the accepted #59/#69 shell/row foundation;
main `080b416c` remains the contextual composition authority and bb `f135a001`
the Inter/semantic component reference. The new centered operation window keeps
that shell, source/view navigation and row/card composition. At 1024x720 the
Rename window and its visible focus, paths and Cancel remain within the viewport;
light/dark text and borders use existing semantic roles. Early inspection found
Create's old browser-default input inconsistent with Rename; both now use the
existing rounded `bb-input` style. Both supported sizes, languages and themes
are captured separately for Create and Rename in the native matrix.

Dialogs are deliberately nonmodal: independent accepted Text-editing guarantees
remain usable during an operation. Pointer/focus outside the dialog does not
silently dismiss it. Explicit Cancel/Escape closes the editor, while operation
controllers, status and recovery remain mounted. Rename feedback is outside the
saved-view host so expanded-project mode cannot hide an uncertain receipt.

## Diagnostics and repairs

Early native attempts remain nonpassing evidence in the task worktree:

- Attempt 1 exposed a live source observation after collision and an intentionally
  stale editor. Collision/no-overwrite remained visible; it was not a successful
  rename receipt.
- Attempt 2 found the test driver closed preview before attempting Expand. The
  driver now enters preview through its actual public control for each journey.
- Attempts 3/4 exposed observation between opening and typing. Added explicit
  current-name review at the UI seam with a failing-then-passing regression. The
  native driver invokes that visible user action before submission; it never
  resubmits a filesystem command automatically.
- Early DOM setup lacked browser globals used by Radix, and old tests searched
  for a category select inside the former inline region. Adapted the browser
  setup and named-dialog scope without dropping draft/focus/recovery assertions.

Every completed native attempt records normal shutdown/backend exit and owned
cleanup; failures are not relabeled as passing. No service, journal, IPC or native
filesystem safety contract was rewritten for this UI change.

## Independent review and Escape repair

At `dbd439b2`, Standards review found no actionable violation; Spec review found
one P2 Escape-ownership defect in Radix Dialog.Content's capture listener. A
browser-first DOM regression reproduced five failures (independent/nested editors
and actual ContextTools menus), with ordinary dialog Escape passing. Replaced
only the surface with public Radix FocusScope 1.2.0 inside Dialog Root/Portal/Title
and moved fallback Escape to window bubble, after existing editor/menu owners.
All six regression cases then pass. This changes no service or mutation contract.
Follow-up review found zero issues; the renewed native/platform receipts below
include the repaired surface.

## Full local suite and test-only renewal

One complete `npm test` at application candidate `e6fb69ca`: **3,376 passed /
27 skipped / 6 failed / 3,409 tests**. The original receipt is retained at
`work/issue-60-projects-local-tests/full-local.log`; no green full-suite claim.

Two failures in `project-category-move-ui.test.tsx` reached the new creation
dialog through inherited scenarios whose browser setup lacked `getComputedStyle`.
Added the same browser globals used by the affected creation/rename tests,
without changing any scenario/assertion. The file then passes **209/209**.
The explicit contextual regression-renewal profile (creation, rename, operation
Escape, category move, routing and suite controls) passes **601/601** locally,
with typecheck and lint. This is a test-environment/CI-selection repair only.

The other four original failures remain nonpassing native fixture receipts:

- `property-editor-driver.test.mjs`: Create Single Select and keyboard Discovery
  Apply fixtures exceed the unchanged 10-second Electron shutdown deadline.
- `runtime-view-readiness.test.mjs`: the explicit scheduling diagnostic exceeds
  that deadline; its recorded forced cleanup confirms process absence.
- `view-scroll-native.test.mjs`: native scroll restoration fixture shutdown
  exceeds that deadline.

These fixture/test/driver source files and their deadline inputs are unchanged
from the accepted baseline. The inherited native-quit watchpoint also exists in
#58/#59 reports; that history does not turn these new observations into passes or
prove one unique cause. No deadline was raised, test disabled, full suite retried
or product acceptance inferred from a forced cleanup. Broader native/full-release
acceptance remains with #67/#42; scoped original application quit/cleanup still
requires its own actual receipts.

Test-only renewal changes the category-move browser setup and adds it to the
future contextual profile. All runtime/dependency/native/build inputs and original
native drivers remain identical to `e6fb69ca`. Inspect actual hosted native and
package results at that SHA; renew the changed tests with
`contextual-project-regressions` after the active run completes. Do not cancel a
useful running acceptance or replay unchanged passing native consumers solely
because the regression inventory expanded.

## Hosted native and package acceptance

[Run 39856828141](https://github.com/kornouhovas/workspace/actions/runs/39856828141),
attempt 1, application `e6fb69caf7cddda3ac20dd8d453865bbf12309c3`, profile
`contextual-projects`: every selected job succeeded. Downloaded each artifact,
asserted its SHA/run/attempt/host, inspected reports and representative whole-screen
captures against the early local matrix and accepted composition.

| Host | Job | Artifact | Regression result |
| --- | --- | --- | --- |
| macOS latest | 120097091475 | [12460282154](https://github.com/kornouhovas/workspace/actions/runs/39856828141/artifacts/12460282154) | 945 passed, 7 platform skips, zero failed |
| Windows latest | 120097091712 | [12459888286](https://github.com/kornouhovas/workspace/actions/runs/39856828141/artifacts/12459888286) | 989 passed, 2 platform skips, zero failed |
| Windows 2022 | 120097091358 | [12460571370](https://github.com/kornouhovas/workspace/actions/runs/39856828141/artifacts/12460571370) | 989 passed, 2 platform skips, zero failed |

Each host passed:

- Contextual Create/Rename and independent Text/menu Escape journeys in development
  and packaged applications: 22 per mode on macOS, 20 per mode on Windows (the
  additional macOS entries record explicit source-observation review). Every mode
  includes all 12 language/layout/location rename combinations and four creation
  and Cancel cases; exact project/tab IDs, sentinel bytes and Text values survive.
- 32 whole-screen EN/RU/light/dark/1024x720/1440x960 Create/Rename captures per mode,
  64 per host, with the supported layout/visible focus/paths/actions inspected.
- Original native rename in direct/grouped modes, case-only/mounted-name behavior,
  collision/rejection, sibling data, exact Finder/Explorer selected-target evidence,
  restart and all seven interruption/recovery checkpoints per mode in dev/package.
- Original direct and grouped creation after durable evidence, explicit interrupted
  recovery, restart persistence, native Reveal acknowledgment and observed exact
  selected target in dev/package.
- Package/resource/font/license verification, normal application/backend shutdown,
  native helper completion and asserted owned-fixture cleanup. Unselected discovery
  modes in a bounded creation report remain unreached, not accepted scenarios;
  the separate direct and grouped receipts together cover the required matrix.

The inspected summaries are retained as `inspection.json` beside each downloaded
artifact in `work/issue-60-projects-ci-{macos,windowslatest,windows2022}/`.
The test-only `c6deb95b` renewal is
[run 39858559747](https://github.com/kornouhovas/workspace/actions/runs/39858559747),
profile `contextual-project-regressions`. Every selected job passed 601 tests,
zero skipped/failed. Native/package reuse applies only to the reviewed unchanged
inputs; actual integration checks and delivered SHA are recorded in GitHub.

## Standards

Independent review of the baseline-to-candidate diff found no actionable documented
violations or maintainability defects. Follow-ups at `e6fb69ca` and `c6deb95b`
confirm public Radix APIs, explicit runtime dependencies, unchanged typed service/
filesystem boundaries, retained assertions and honest test-only evidence reuse.

## Spec

Initial review at `dbd439b2` found one P2: capture-phase Escape also dismissed an
unrelated dialog. The browser-first reproduction, public FocusScope repair and
six passing ownership regressions resolve it. Independent follow-up at `e6fb69ca`
found no new correctness defect or scope creep; `c6deb95b` retains every affected
scenario and makes no claim that the full local suite passed.

Final review findings: Standards **0**, Spec **0**. Hosted renewal and integration
receipts remain separate from these review conclusions.

## Hosted test-only renewal and delivery handoff

Run `39858559747`, attempt 1, at
`c6deb95b23202595afb713cc073aa7538d6ed61e` completed successfully. Downloaded
and checked every provenance artifact and original job log. Each host renewed
**601 passed / zero skipped / zero failed**, including the repaired category-move
consumer and original assertion set.

| Host | Job | Provenance artifact |
| --- | --- | --- |
| macOS latest | 120103001396 | [12461096870](https://github.com/kornouhovas/workspace/actions/runs/39858559747/artifacts/12461096870) |
| Windows latest | 120103001285 | [12459748794](https://github.com/kornouhovas/workspace/actions/runs/39858559747/artifacts/12459748794) |
| Windows 2022 | 120103000941 | [12461351612](https://github.com/kornouhovas/workspace/actions/runs/39858559747/artifacts/12461351612) |

`e6fb69ca` and `c6deb95b` share source tree
`3527178f3574111ef2ad2ed0649732af53526885`; package manifests/lockfile, build,
native and original smoke inputs are identical. The latter changes only the
reviewed test environment, regression routing and documentation. This report's
final update is documentation only, so it does not replace those actual tested
SHAs with an untested runtime claim. No failed/unreached scenario is accepted
through reuse. Normal full routes remain available and the four original local
native-quit fixture failures remain explicit.

The scoped #60 appearance/behavior/data-preservation/native/package gates are
satisfied. Follow the authorized fast-forward integration route, renew build,
type/static/docs and affected regression checks in `new-workspace`, and record
that checkout's delivered SHA in the GitHub checkpoint before closure. This does
not accept final #67/#42, Windows 11 manual release gates or an installer change;
no release or main-branch merge is part of #60.
