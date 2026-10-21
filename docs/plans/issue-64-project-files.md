# Issue 64: real project files

Base: `3e56829342535eca004a833c416f453628915acd` (`new-workspace`).
Task branch: `codex/issue-64-project-files`; tracker: [#64](https://github.com/kornouhovas/workspace/issues/64).

## Scope and scenarios

Use the existing project authorization (workspace/source ownership, configured mode,
current identities, exclusions, pending operations). List one real directory at a
time; never follow links. Only opaque logical IDs and project-relative components
cross the renderer boundary. Open regular files externally; Reveal files/folders
separately. No file mutations or embedded viewer.

Public seams already authorized by #64: Workspace service with disposable SQLite
and real folders; renderer interactions; actual Electron/platform integration.
TDD proceeds vertically at those seams. Cover direct/grouped trees, nested/empty
directories, long EN/RU names, refresh, disappearing/replaced items, link/traversal/
foreign-ID rejection, late responses, unavailable source/project moves, native
failure and delayed authorization. Cover tree arrows/Home/End/Enter, focus,
selection, contextual Open/Reveal and preview/expanded host at both sizes/themes.

Reference: main `080b416c` project properties/tree composition and accepted single
project host; bb `f135a001` typography/icons through existing #68 tokens/controls.
No additional upstream source/dependency is planned.

## Retained coverage and verification

Retain existing reveal, identity/recovery, IPC isolation, navigation and property
editor guarantees. Adapt only renderer assertions affected by adding the real tree;
record each adaptation and replacement here. No accepted requirement is retired.
Run focused service/native/renderer tests and typecheck during slices. Complete
Standards and Spec reviews, type/lint/docs/build, full suite once on completed
candidate and required actual platform checks. Native/IPC changes expand acceptance
to supported desktop hosts; do not claim dispatch acknowledgment proves observed OS
Open/selection. Record appearance separately from behavior and safety.

## Evidence

#54 was closed with the accepted integration SHA above; #64 had no previous
owner/checkpoint. Implementation uses lazy directory reads, current logical IDs
and native permits. Archived projects retain their recorded parent chain.
No migration, dependency, copied upstream source or packaged native resource was
added. Open rejects shell shortcuts and extensionless Finder aliases; Reveal can
select a regular shortcut itself.

Appearance: compared whole-window captures against main `080b416c` project
properties/tree screenshot (`work/workspace-6fh/after/native-light-1024x720-project-preview.png`)
and `src/components/workspace/project-detail-panel.tsx`, with #68's loaded Inter,
semantic surfaces, local outline icons and Hint. Files sits below Properties in
the existing single preview/expanded host. Rows have 28px height, indentation,
selection/focus and ellipsis/title for long authored names. Added Refresh and
selection-scoped Open/Reveal controls are deliberate #64 functionality; RU
actions wrap within the narrow host. Sampled actual screenshots cover EN/RU,
light/dark and 1024x720/1440x960, expanded/preview and empty/disappeared states.
The complete native driver produces 16 preview/expanded variants.

Local evidence before the final full-suite attempt:

- Typecheck, lint, docs and whitespace checks pass; clean build uses Node 22.21.1.
  The first system-Node-26 build stopped on the existing explicit version guard;
  it was not accepted as a build or test result.
- Initial public-service tree slice failed before implementation and passed
  afterward. The shortcut regression failed with an actual unexpected dispatch
  before repair; dispatch counters and a real Finder alias now pass.
- 155 service/native/IPC checks passed after shortcut repair; subsequent focused
  service/UI/route checks passed 30/30, including actual project rename with stale
  native target rejection. New tests retain public APIs and real disposable data.
- The pre-shortcut-repair complete affected profile passed 1105 tests, skipped 7
  host-inapplicable cases, and passed real file/navigation/shell/saved-view flows.
  Final affected native/CI renewal remains required after the Open repair.
- Actual Finder selected the exact nested Unicode file; TextEdit opened that
  exact document. Driver verified arrow focus, expansion across expand/return,
  Refresh/add/disappearance, normal Electron shutdown and asserted cleanup.
  Original driver misuse of the shutdown helper is preserved in ignored local
  evidence; corrected original native journey passed.
- Standards review found a shell-shortcut Open escape; repaired and re-reviewed
  with no blockers. Spec review has no blockers. Its initial digit/NUL finding
  was withdrawn after importing the unchanged actual validator; real `v0/2026.txt`
  and actual-NUL regressions pass.

Test retention: retain all inherited identity, recovery, native Reveal, navigation,
views and editor scenarios. Extend actual entry/controller/preload/client scenarios
with file queries and distinct native commands; no old guarantee is removed.
Adapt `build-smoke.test.mjs`'s old blanket absence of `shell.openPath`: #64 now
requires Open in main. Its replacement asserts the main entry point and retains
absence of native/fs/process access in preload, alongside typed IPC/native
negative and direct/grouped transport checks. The first full-suite attempt
retains that old assertion's failure; renew only this test after its test-only
repair under the shared evidence-reuse policy.

Final full-suite result and exact-SHA hosted/native/integration receipts are
recorded in the [GitHub checkpoint](https://github.com/kornouhovas/workspace/issues/64).
Current full-suite/hosted gates remain pending until their actual results exist.


## First candidate failures and focused renewal

Original candidate `18432cc`, run39641467815: macOS passed1162 selected tests
and exact Finder selection, then TextEdit's observer was killed at its five-second
command bound (SIGTERM, empty stdout/stderr); actual document observation and
later flows were not accepted. Both Windows hosts rejected the authored long
fixture's trailing-space folder component, as the existing Windows safety contract
requires. Windows latest also timed out four unchanged COM control cases.
Artifacts/logs are retained; those failures are not relabeled passing.

Test-only repair uses valid components and asserts a path longer than260; it
preserves the same expected Open/Reveal outcomes. The original COM file runs
isolated before the selected batch to test resource competition, preserving its
original deadlines. macOS observation failure now retains bounded native desktop/
NSWorkspace/error diagnostics so an unproven cause is not disguised as a repair.

The final local affected profile passed1162 tests/skipped7, files/Open/Reveal,
navigation and shell; Views then hit a detached element while scrolling a control
after resize. A read-only helper re-resolves the control and verifies connected
viewport geometry after two frames within the original15-second bound. A real
Electron fixture replaces the first scrolled element, requiring a second read.
No filesystem mutation, keyboard action or native effect is retried. Original
Views command and full shared consumers remain required for renewal.
