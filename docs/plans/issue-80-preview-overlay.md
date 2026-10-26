# Issue 80: project preview overlay

Base: `ec427055b0e639f54ba66320ee84a8ed0d7b0488` (`new-workspace`).
Tracker: [#80](https://github.com/kornouhovas/workspace/issues/80).

The saved view remains mounted at full width; the right project host overlays it,
with the existing resize control and session/navigation controllers. The expanded
host still replaces the view. Main `080b416c` and the existing #54 handoff supply
composition; the issue's overlay requirement supersedes its split width.

## Scenarios and coverage

- Retain the #54 renderer navigation, editor, retry and session tests; the existing
  public boundaries still exercise unique tabs, per-view state and late reads.
- Adapt the native navigation journey to measure Table and Board view/card width,
  position and scroll before and after opening/closing. The baseline Table check
  failed with 775px becoming 410px. Board virtualized total height is not a stable
  geometry measure while rows are being measured; visible card geometry is checked.
- Retain native EN/RU, light/dark, 1024/1440, expansion/return, width and scroll
  checks. Loading, unavailable/recovery, overlay menu layering, draft navigation,
  supported-host CI and integrated acceptance remain required gates.

## Local evidence

Node 22.21.1 on macOS: build and typecheck passed; project-navigation renderer
suite passed 16 tests. The native navigation journey passed with 32 visual
variants and Table/Board geometry checks. One earlier native attempt stopped at
an existing tab drag ordering assertion; a repeat passed, with cause unproven.
Lint and documentation links passed. These results do not replace the remaining
acceptance gates or the required final full suite and independent review.

Commands and artifacts (macOS, source candidate `388e1ee7`, with the later
native test-driver adjustment in the working tree):

- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run check:docs`.
- `node --import tsx --test tests/project-navigation-ui.test.tsx` (16 passed).
- `node scripts/smoke-project-navigation.mjs` with
  `WORKSPACE_SMOKE_EVIDENCE_DIR=/tmp/issue80-menu`: Table and Board,
  filtered and grouped views, replacement with nonzero vertical scroll, 32 captures
  and normal cleanup.
  The baseline red receipt is `/tmp/issue80-baseline-evidence/report.json`.
- `node scripts/smoke-scalar-drafts.mjs`, `node scripts/smoke-workspace-sessions.mjs`,
  `node scripts/smoke-retained-recovery.mjs dev`, and
  `node scripts/smoke-contextual-projects.mjs`; their receipts and captures are
  respectively under `/tmp/issue80-drafts`, `/tmp/issue80-sessions`,
  `/tmp/issue80-recovery`, and `/tmp/issue80-contextual`.

The independent Standards review requested this provenance; the Spec review
identified native overlay layer and supported-host CI evidence as outstanding;
filtered/grouped geometry was subsequently checked. Existing recovery and contextual journeys cover
additional states but do not by themselves establish every overlay layer case.

The local full `npm run test:all` on the application candidate completed with
3950 passing, one failure and 27 skips (`/tmp/issue80-full-suite.log`). The
failed `property-editor-driver` case applied its 100ms subject deadline to a
subsequent read-only observation. The test-only repair restores the ordinary
1000ms deadline after the expected timeout, without changing the subject deadline
or assertions. The complete affected file passed 14/14 after repair
(`/tmp/issue80-driver-repair.log`); application, build, dependency and runtime
inputs did not change. The original full run remains failed; its independently
passing cases retain their original provenance, subject to the evidence-reuse
policy and supported-host acceptance.

The final macOS native navigation run (`/tmp/issue80-group-scroll/report.json`)
checks filtered and grouped geometry, replacement content and nonzero grouped
horizontal scroll, plus overlay hit testing, intersecting view popover, project
menu and Escape. All 32 appearance variants and cleanup completed. Earlier
native attempts failed a tab-drag assertion and a resize assertion respectively;
their precise causes remain unproved and their reports remain failed.

## Actions failure and focused repair

Navigation run [40400890006](https://github.com/kornouhovas/workspace/actions/runs/40400890006)
at `5a4621c0` failed: both Windows hosts stopped at the new grouped-Board
nonzero-scroll assertion; macOS passed navigation and stopped in `smoke:views`
expecting `No value (1)` for the retained category group. Its failure capture
shows `No status (1)`. The original views command reproduced that same timeout
locally (`/tmp/issue80-views-baseline.log`); the fixture now expects the current
EN/RU status labels and retains identity, recovery and edit assertions. The
complete local views command passed (`/tmp/issue80-views-repair.log`).

The Windows screenshots show the first groups at the failed assertion, but do
not establish why scrolling was unavailable. The navigation driver now waits
for the rendered visible groups to match the service projection and for actual
horizontal overflow before setting nonzero scroll; it records bounded group and
width diagnostics on a readiness failure. The earlier failure's precise cause
remains unproved. The updated original navigation command passed locally
(`/tmp/issue80-wait-repair/report.json`). Both original CI failures remain failed;
focused affected-host renewal and its artifacts are required before acceptance.

The `desktop-ux` profile `navigation-repair` renews only the original failed
consumers: `smoke-project-navigation.mjs` on Windows latest/2022 and
`smoke:views -- dev` on macOS, after the same install/build prerequisites.
The existing navigation and full profiles retain their inventories. The route
selection tests passed 35/35 (`/tmp/issue80-routing.log`); focused Actions
receipts and artifact inspection remain open.

Focused run [40403482210](https://github.com/kornouhovas/workspace/actions/runs/40403482210)
at `d0392a3c` passed the original macOS views consumer; Windows 2022 again
failed the nonzero grouped-scroll assertion despite the new projection/overflow
readiness gate. Thus that gate alone does not explain the failure. The separate
`navigation-probe` profile runs only Windows 2022 with bounded failure-only
scroll observations and a `diagnosticOnly` report; it has its own concurrency
group and cannot supply acceptance. Compare immediate versus post-paint scroll,
direction and dimensions before choosing a repair. The unchanged original
assertion and wait bounds remain in place.

The failure-only [Windows diagnostic](https://github.com/kornouhovas/workspace/actions/runs/40404087348)
at `827bb7e9` observed an immediate scrollLeft of 160, then 0 after two
frames while `data-scroll-restoring` was true (scrollWidth 2784, clientWidth
800, LTR). The local real-Electron hook control demonstrates the mechanism with
an injected content mutation: pending restoration resets 160 to the saved 120;
after restoration, 160 remains. This control does not prove the exact historical
Windows event order. The original navigation driver now waits until restoration
finishes before its programmatic scroll; the required nonzero and geometry checks
remain. The focused control (`/tmp/issue80-scroll-control2.log`) and original
local navigation (`/tmp/issue80-restoration-repair/report.json`) pass. Both
Windows original consumers still need ordinary, non-diagnostic renewal.

## Acceptance evidence and integration handoff

- macOS navigation at `5a4621c0`: the original navigation step in failed
  [40400890006](https://github.com/kornouhovas/workspace/actions/runs/40400890006)
  passed and its `issue-54-navigation/report.json` records all 8 theme/language/
  size combinations, navigation checks, normal shutdown and cleanup. Its later
  views step failed and is not presented as a passing job.
- macOS original views at `d0392a3c`: focused
  [40403482210](https://github.com/kornouhovas/workspace/actions/runs/40403482210)
  passed; the inspected `issue-27-views-runtime/evidence.json` records EN/RU
  scenarios, status-group recovery, normal quit/backend exit and cleanup.
- Windows latest and Windows 2022 navigation at `7ade1320`: ordinary
  [40404533964](https://github.com/kornouhovas/workspace/actions/runs/40404533964)
  passed on both hosts. Inspected reports record 8 theme/language/size
  combinations, grouped and filtered geometry, layer and Escape checks,
  `diagnosticOnly: false`, process exit and owned cleanup. The Windows latest
  RU dark 1024 preview was visually inspected against the accepted composition.
- The driver repair was separately renewed at `5a4621c0`: macOS
  [40400102087](https://github.com/kornouhovas/workspace/actions/runs/40400102087)
  and Windows latest [40400404344](https://github.com/kornouhovas/workspace/actions/runs/40400404344)
  each passed 14/14, with inspected artifacts. The failed local full run and
  its individually renewed failed case remain documented above.

Reuse rationale: the entire subsequent diff from `5a4621c0` to `7ade1320`
contains only test/smoke drivers, CI route selection, tests and this plan;
renderer, services, persistence, native resources, dependencies, packaging and
runtime configuration are unchanged. Changed consumers and route tests were
renewed as recorded. Diagnostic run `40404087348` is evidence of a mechanism,
not acceptance; cancelled and failed runs retain their original statuses.
Broader #67 and release acceptance, including installer requirements, remain
separate; issue 80 authorizes neither release nor merge to `main`.
