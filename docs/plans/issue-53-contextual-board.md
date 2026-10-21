# Issue 53: contextual grouped Boards

Base: `de84812b` on `new-workspace`. Tracker: [#53](https://github.com/kornouhovas/workspace/issues/53).

## Implementation handoff

Main `080b416c`, `src/components/workspace/board-view.tsx`, supplies the horizontal
column/header/card composition, quiet value labels, contextual column actions and
inline property editing. bb `f135a001e72942cee9118d2693208ec0725e2f18` supplies the
Inter typography, semantic neutral surfaces, compact headers and bordered cards,
as already adapted by #68. Keep the current typed services and loaded local font.

Use ordinary project names and real typed values, then multiline/long EN/RU
content. Inspect the complete Electron window at 1024x720 and 1440x960 in both
themes/languages. Retain new-workspace's exact scalar groups, multiple MultiSelect
memberships, 180–800px per-group widths and default wrapping. Main's column packing
and old status persistence are not imported. The single-project-area exception
remains unchanged.

## Scenarios and established seams

The issue selects renderer interactions and the public typed Workspace service
with disposable real SQLite/folder fixtures; these are the agreed TDD seams.

- Move Board field visibility/wrapping and definition access into contextual
  controls; keep Name visible, existing typed editors and project actions.
- Group by none/Name/Text/Number/Date/Select/category/MultiSelect. Retain exact
  scalar and empty/hidden groups and multiple memberships. Contextual grouping
  retains default/ascending/descending/manual order, hide/collapse/restore and
  hide-empty. Column order must never change project data.
- Width controls in column headers and Board settings save within the view;
  retain property/group-specific widths through hide/collapse and switching.
- Keyboard/pointer opening, Escape/focus return, portal positioning, independent
  scrolling, long content, pending/error/retry/reset and stale-reply ownership.
- Retain saved-view lifecycle/filtering/isolation and cancel/return routes.

## Coverage decisions and verification

Adapt `board-layout-ui` from details to contextual popovers, retaining persistence,
keyboard widths, hidden properties, wrapping, mutation separation, failed reads,
failed saves/reset and late-reply protection. Retain grouping/Board-layout service,
view lifecycle/filter/group assignment and viewport suites; adapt their entry
paths only where needed. No inherited product requirement is retired.

Run focused renderer/service tests during slices and regular typecheck. Review
both standards and spec against the immutable base. On the completed candidate,
run lint/docs/build and the full suite once, plus Electron Board visual/interaction
smoke and retained relevant runtime checks. Record exact results and remaining
platform/integration gates in the tracker. No storage, IPC, dependencies or
installer change is planned; broad release/platform acceptance remains #69/#67.

## Implementation checkpoint

The contextual Board and header width controls are implemented without storage,
IPC, dependency or installer changes. Shared Popover focus fallback now selects
the visible settings entry if a removed column's fallback lives in closed tools.
Definition editing and its drafts live in the existing always-mounted Properties
tools, separately from Board card presentation. This preserves category-label
mutation lifetimes when tools close; the form owns Cancel/Escape before its
containing ContextTools closes.

Early local evidence (macOS arm64, Node 22.21.1): 86 affected UI/service scenarios
passed; Board smoke covered 16 populated/long and eight each filtered-empty and
source-unavailable variants. Saved-view development runtime passed six scenario
groups with normal shutdown and fixture cleanup. The final Escape correction
passed 13 focused Board/context tests. These are pre-review observations, not
an exact-SHA final acceptance receipt.

Appearance inspection against the handoff: horizontal columns and header counts,
quiet labels, bordered cards, shared Inter and neutral light/dark tokens match
the selected main composition/bb styling roles. The old top management stack,
assignment explanation and bottom card action row were removed/relocated after
early inspection. Long content wraps inside saved column widths; header popovers
stay within both viewports and unavailable sources retain readable saved values.
New-workspace's default widths, exact grouping and wrapping deliberately remain.

Coverage also adapts `runtime-board-layout` to contextual entry and retained exact
value editing, and adds shared hidden-fallback and nested draft Escape checks.
No safety or supported-platform requirement is retired. The bounded `board` CI
profile selects affected renderer/service suites, the new native Board matrix and
retained saved-view runtime on the existing desktop hosts. Final review, full
suite and exact-candidate Actions/integration receipts belong to the issue.


## Review repairs

Standards review found one issue: a rejected Electron launch could leave process
ownership unverified while empty PID sets permitted fixture cleanup. The Board
smoke now tracks `launchUnverified` through backend discovery and preserves its
fixture whenever termination is unproven. Existing lifecycle tests retain this
policy; the Board CI selection includes that suite.

Spec review found one issue: definition controllers nested inside the Board Radix
popover were unmounted on dismissal, losing pending category-rename feedback.
Definitions now live in the existing always-mounted Properties tools. A real
SQLite/renderer regression with a deferred typed rename verifies pending state,
no duplicate submission, rejected-response feedback and draft/cancel preservation
across close/reopen. Fourteen focused Board/context scenarios pass after repair.

Both independent reviewers confirmed their findings resolved, with no new
concrete findings. The Spec reviewer independently ran the deferred-category
regression successfully. Latest focused Board/context/CI/lifecycle run: 53 pass,
zero fail; typecheck, lint, docs links and whitespace checks pass. The normal
build succeeds with Node 22.21.1. Final full/native/Actions receipts remain in the
GitHub checkpoint to preserve the tested code SHA.

The complete local suite on `2d540d3` passed: 3,201 passed, zero failed, 26
platform/case-sensitive-fixture skips (3,227 total). A later native-driver-only
repair replaced a strict single-element disappearance wait with an all-cards
absence predicate and retained cleanup receipts on failure; unchanged suite
inputs justify retaining that result for `f9cf4d0`.

Final screenshot inspection then exposed an actual shared portal stacking defect:
view popovers at layer 30 were occluded by their owning tools at layer 40.
The native bounds helper was extended with corner/center hit-testing; the old
CSS deterministically failed that check. Presentation/filter portals now use
layer 50. Board appearance/interaction and shared desktop-shell native journeys
pass with the stronger check, including the Properties draft/Cancel route.
Both independent reviewers accepted this repair without new findings. The Board
profile now includes shell smoke for shared Table/filter consumers. Because CSS
changed, final build, full suite and exact-candidate native/CI are renewed; prior
cancelled/superseded workflow runs do not establish acceptance.

The `d3f8ad7` full renewal exposed 11 standalone native fixture failures (3,190
passed/26 skipped). The application-independent fixture, transitive helpers,
Electron version, launch inputs and native resources match the issue base;
these tests do not import the application/CSS. A two-file concurrent reproduction
yielded 27 pass/one shutdown timeout; the same 28 scenarios serially passed.
Experimental Darwin isolation on `45d5e90` still failed a view-readiness
shutdown diagnostic and an independent normal-quit fixture (3,199 pass/two fail/
26 skipped across all batches). Isolation is therefore not a sufficient repair
and is reverted, including its tests/selector changes. The native cause remains
unresolved; a post-close `app.process()` error can obscure the initial failure.
Both review axes accepted reverting this unproven extension and retaining the
unchanged harness failures separately under the desktop UX matrix. #69 owns
these broad-harness gates; no full-suite or milestone pass is claimed.

Scoped acceptance on `d3f8ad7`: Actions run 39616533635, attempt 1, Board profile,
success on macOS latest, Windows latest and Windows 2022. Artifact reports match
the SHA/profile/host, 16 populated/long screen variants plus eight each empty and
unavailable variants, saved presentation/keyboard/membership/retry controls,
28 shared-shell checks and six saved-view scenario groups, with normal shutdown
and cleanup. The final documentation/reversion follow-up restores code, tests,
route, dependency and build inputs to this exact scoped candidate. Its runtime
receipts are inherited explicitly; final tracker checkpoint owns delivery SHA,
local negative logs and representative-scale diagnostic results.

Representative development diagnostic on the unchanged application inputs:
1,000 projects/20 properties/10 views per direct and grouped source, 1,000 Name
groups, successful far-edge column menu/keyboard resize/focus. Observed startup
2,088.7/1,195.5 ms, menu 90.6/82.2 ms, driver-observed width completion
309.0/298.3 ms, working-set sums 880,508,928/871,038,976 bytes. These raw local
numbers are not packaged strict performance acceptance. The unchanged native
harness negatives and future broad/performance gates have an explicit
[#69 ownership receipt](https://github.com/kornouhovas/workspace/issues/69#issuecomment-6318741523).
