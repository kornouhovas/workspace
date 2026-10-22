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
The full local suite, independent Spec/Standards review and three-host native and
packaged consumer results remain pending at this checkpoint.

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
Follow-up review and renewed native/platform receipts remain required.
