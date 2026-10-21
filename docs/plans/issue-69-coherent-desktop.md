# Issue 69: Early coherent desktop interface

Tracker and current execution checkpoint: [#69](https://github.com/kornouhovas/workspace/issues/69).
Immutable issue-start: `86ec752714c860662d4b1da0c25c2e5b71606bff`.
Executor: Matt Pocock implement. All native/textual blockers #68/#53/#54/#64
are closed. This milestone does not close #47/#67/#42 or publish a release.

## Reference and public boundaries

Main `080b416c57b2869024ac62363e96b68b40f499c0` owns composition and
working journeys; bb `f135a001e72942cee9118d2693208ec0725e2f18` owns
typography, semantic styles and controls. Retain the accepted single project
area, unique project tabs, service ownership and filesystem safety. Compare
whole windows, not isolated controls. Reuse the bundled Inter, local icons,
Hint and pinned Radix controls; no new dependency or copied module is planned.

The owner confirmed all three seams: public Workspace service with disposable
SQLite/folders; UI through user interactions; actual Electron and packaged
runtime. Tests at each boundary establish only its observable guarantees.

## Acceptance scenario map

| Requirement | Evidence to produce | Status |
| --- | --- | --- |
| One candidate: populated Table/Board/preview/expanded real tree/settings | Actual whole-window captures compared to pinned main/bb, ordinary and long data | Pending |
| Empty/loading/error/unavailable states | Existing state scenarios plus real changed-flow inspection | Pending |
| Sidebar collapse/discoverable restore/pointer and keyboard resize | Original shell/navigation journeys, focus and released-width assertions | Pending |
| Preview close/reopen, expand/return, unique tabs | Original navigation journey; view/filter/selection/scroll/focus retained | Pending |
| View create/rename/duplicate/reorder/switch/delete/cancel/last-view | Original saved-view journey and service/UI lifecycle scenarios | Pending |
| Back/Forward, branch truncation, end states, fresh history | Original navigation journey; settings/workspace return and removed destinations | Pending |
| Icons/hints/state/keyboard/Escape/popup bounds | EN/RU x light/dark x 1024x720/1440x960 inventory | Pending |
| Broad regression/native termination | Final completed-candidate full suite; retained standalone failure diagnosis | Pending |
| Supported platforms and packages | Full desktop routes, actual artifacts and exact SHA/run/host | Pending |
| Strict representative scale | Original packaged 1,000-project direct/grouped scenarios and approved limits | Pending |
| Installation | Compare current installer inputs with receipts; renew changed inputs | Pending |
| Compact final acceptance map | Appearance, behavior, safety and later issue ownership per principal surface | Pending |

## Retention and diagnosis

Retain all accepted service, identity, recovery, isolation, native Open/Reveal,
shutdown and cleanup requirements. Adapt/replace/retire inherited tests only
with a named requirement and replacement under
[test retention](../development.md#inherited-test-coverage). No requirement is
retired at task start. Reuse evidence only under the
[unchanged-input policy](../ci.md#evidence-reuse-after-test-only-repairs).

#53/#54/#64 recorded standalone property-editor, view-readiness and deferred-quit
normal-shutdown failures, including a secondary discarded-handle diagnostic
and an unbounded rename-fixture close. These are required #69 gates, not
application-cause evidence. Preserve original deadlines and ownership checks;
reproduce/minimize before selecting a repair. Local initial reproduction was
invalidated by concurrent lazy Electron extraction in a fresh dependency tree;
prepare the binary serially before native workers. Raw logs stay in
`work/issue-69/` and do not establish acceptance by their existence.

## Verification and delivery

Run focused files and typecheck during vertical slices. Complete independent
Standards/Spec review against the immutable start, repair findings, then run
the full completed-candidate suite once. Record exact failures and renew affected
consumers after repairs. Inspect required CI artifacts before integration;
skipped, diagnostic, failed and unexecuted scenarios are not passes. Current
CI/integration status belongs in the linked GitHub checkpoint.

## First vertical slice: restore compact daily composition

The original foundation command failed on the integrated base: Table top 84px,
view-strip bottom 42px (42px gap, accepted maximum 24px). #54's independent
scroll host had separated Source tools, creation and Active/Archived from the
strip. Compare the pinned main Table capture at
`docs/research/desktop-experience-evidence/main-table-1440.png` and accepted
#68 correction. This is a material regression, not a new visual baseline.

Move only entry controls through a local daily-strip target; forms, controllers,
pending receipts and error/recovery surfaces retain their original lifetimes.
Hide the relocated controls while a project is expanded. The public UI regression
failed with Source tools absent from Views, then passed with source-menu Escape
focus, creation/archive entries and expand/return identity preservation. No new
service command, dependency, native resource or storage change.

Observed local checks on Node 22.21.1/macOS arm64:

- 241 affected navigation/context/creation/archive/App/Views tests passed.
- Typecheck, lint, renderer build, documentation links and whitespace passed.
- Ten focused lifecycle/deadline/forced-cleanup tests passed.
- Original real-Electron foundation command reached all 16 populated/long and
  24 empty variants with loaded Inter Latin/Cyrillic, bounds/interaction/font
  assertions intact. Table top 54px, strip bottom 42px in all 16 variants.
  The command **failed** normal 10-second shutdown; cleanup remains unaccepted.
  Captures are appearance evidence only, not a passing complete runtime receipt.

The original three-file native reproduction reported 29 tests: 16 pass/13 fail.
Two failures masked shutdown through discarded `app.process()` handles. Capture
the owned child before close and preserve a prior scenario error separately.
Renewal exposes the original 10-second timeout instead of that secondary
TypeError (15 tests: four pass/11 fail); it does not repair native termination.
The rename fixture now uses the existing bounded close helper rather than
unbounded `app.close()`, retaining normal exit/profile-removal assertions.

The original property scenario minimized to one property-creator interaction
failed three of three sequential native launches. Disabling GPU failed three of
three too; GPU disablement is not adopted. An asynchronously scheduled sole quit
also failed and is not adopted. A native stack sample and blank-window controls
are retained locally; symbol coverage is insufficient to name a native cause.
No normal deadline, deferred-cleanup, ownership or forced-cleanup assertion is
weakened. Native diagnosis and all remaining milestone evidence remain gates.
