# Desktop experience visual and verification audit

## Baselines and limits

Completed 2026-10-21 after [#52 delivery](https://github.com/kornouhovas/workspace/issues/52#issuecomment-6300181694)
at `663636be9d58a9b4b47a3fc2ca887291b43ba132`. The issue was closed on
2026-10-20 with its required acceptance; this audit does not reopen those gates.
Main reference: `080b416c57b2869024ac62363e96b68b40f499c0`.
bb reference: `f135a001e72942cee9118d2693208ec0725e2f18`.

This audit compares the implemented working composition with main and the
specified visual-language responsibility with bb. It does not equate the two
references or require matching main's palette. Deliberate single-project-area,
no-split and domain-model differences remain authoritative.

## Finding

Completing #48–#52 does not establish the requested coherent interface. The
original specification selected the appropriate references, but its incremental
implementation plan allowed existing management controls to remain while new
surfaces were introduced. It had no early whole-interface acceptance gate.

The inspected main application uses compact view tabs, contextual header/card
controls and a large working area. With the same three named projects, the accepted
new runtime initially displays management and recovery panels; the actual Table
and Board are below the initial viewport even at 1440x960. The accepted #52 runtime still exposes separate
property-creation buttons, persistent row actions and substantial legacy control
presentation. This is a composition gap, not a final spacing adjustment.

The gap is not proof that closed issues failed their stated acceptance: #48
retained old controls, #51 retained the existing Table/Board content hosts, and
#52 retained existing value editors. Board (#53), the project area/tabs (#54),
real tree (#64), editors (#56–#58) and contextual operations (#60–#62) still contain
substantive work. The old sequence postponed the explicit complete visual review
to #67.

## What the tests establish

The shell smoke checks language/theme/size variants, containment, independent
scrolling, popup bounds, focus/Escape and persistence. It saves screenshots. It
does not compare those images against a pinned composition/styling target.
Font-loading diagnostics alone do not prove the intended font rendered.

Service, SQLite, recovery, isolation and native tests protect accepted product
guarantees. They remain necessary where their boundaries change and at integrated
milestones. They cannot establish visual fidelity. Conversely, screenshots do
not prove data safety. Tests must answer these separate questions explicitly.

The common/platform partition classifies environment requirements; it is not an
impact selector. A test with a UI-oriented filename may exercise real SQLite,
folders or processes. Moving it to a mocked suite solely to accelerate UI work
would lose evidence. Structural assertions such as an old raw button count or
class name should be adapted/replaced when their interaction changes, retaining
any applicable user guarantee.

## Corrected delivery

1. [#68](https://github.com/kornouhovas/workspace/issues/68): correct the existing
   shell/sidebar/views/Table/settings and shared bb styling.
   Establish concrete reference/state handoffs and a verified scoped UI CI route.
2. Complete Board, project preview/expanded tabs and the real project tree on that
   foundation.
3. [#69](https://github.com/kornouhovas/workspace/issues/69): accept a coherent
   principal interface, including panel visibility/restore,
   view lifecycle, icons/tooltips, focus, cancellation and navigation.
4. Complete remaining functional contracts within that accepted composition.
5. Complete #67 and release-specific integrated checks.

The [updated specification](../specs/workspace-desktop-ux.md), issues and
[verification matrix](../desktop-ux-verification.md) own the exact
acceptance and dependency graph. The [research report](design-to-development-workflow.md) explains the first-party
practices behind the design-to-development handoff and live implementation
review; it does not impose an additional product-approval ceremony.

## Navigation clarification

Main implements Back/Forward over visited workspace/settings destinations in
memory. It does not implement product-level Undo/Redo of completed metadata or
filesystem mutations. The owner's “as in main” request therefore preserves that
navigation behavior, separately from Cancel/Escape and persisted workspace
sessions. New saved-mutation reversal is not inferred from the term Undo/Redo.

## Captured evidence

The reference was built from pinned main. The accepted runtime was built with
Node 22.21.1 in the isolated documentation branch `859b27af`; `git diff` confirms
that its application, dependencies, migration, script and build inputs are
identical to delivered #52. The first build attempt under host-default Node 26
was rejected by the existing native-build version guard; the complete build
succeeded under the required Node version. No application repair was made.

Both apps used disposable source folders and isolated application data. The
candidate was seeded through its typed preload commands. Table is ungrouped;
Board groups Active/Done. Main's Status and the new runtime's folder-backed
Category are intentionally different domain labels. The candidate's content
captures are explicitly scrolled; its initial viewport is shown separately.
These are composition comparisons, not pixel-difference scores or full UI
acceptance. EN/light at 1440x960 illustrates the gap; additional 1024 captures
were collected locally. Full EN/RU/theme/state acceptance belongs to #68/#69/#67.
Only synthetic fixture names/paths appear. [Capture metadata and hashes](desktop-experience-evidence/manifest.json).

| Surface | Pinned main | Accepted #52 runtime |
| --- | --- | --- |
| Table | [Reference](desktop-experience-evidence/main-table-1440.png) | [Initial viewport](desktop-experience-evidence/accepted-initial-1440.png), [scrolled Table](desktop-experience-evidence/accepted-table-scrolled-1440.png) |
| Board | [Reference](desktop-experience-evidence/main-board-1440.png) | [Scrolled Board](desktop-experience-evidence/accepted-board-scrolled-1440.png) |

Source evidence:

- [Initial shell acceptance and retained content](../plans/issue-48-desktop-shell.md),
  [saved-view composition](../plans/issue-51-contextual-views.md) and
  [accepted Table scope](../plans/issue-52-grouped-table.md).
- [Shell smoke](../../scripts/smoke-desktop-shell.mjs) checks layout/popup/focus and
  saves images; [presentation controls](../../scripts/runtime-presentation-controls.mjs)
  check popup bounds. Neither compares reference images or accepts whole-screen
  composition, density, fonts and icons.
- [Suite partition](../../scripts/test-suites.mjs) separates common and platform
  requirements; it does not select checks by a UI change's impact.
- Main [navigation state](https://github.com/kornouhovas/workspace/blob/080b416c57b2869024ac62363e96b68b40f499c0/src/components/workspace/left-panel.tsx#L109)
  and [Back/Forward controls](https://github.com/kornouhovas/workspace/blob/080b416c57b2869024ac62363e96b68b40f499c0/src/components/workspace/left-panel.tsx#L422).

This task changes documentation and tracker contracts. Verification consists of
reference/runtime capture and inspection, requirement and dependency review,
local Markdown links, whitespace and tracker readback. No full test, installer
or performance rerun is required solely for these prose changes; #52's accepted
runtime evidence remains separately attributed to its actual tested revision.
