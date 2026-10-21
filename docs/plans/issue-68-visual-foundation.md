# Issue 68: existing desktop visual foundation

Issue: https://github.com/kornouhovas/workspace/issues/68
Start: `a6622b4a`; accepted #52 runtime: `663636be9d58a9b4b47a3fc2ca887291b43ba132`.
Main composition: `080b416c57b2869024ac62363e96b68b40f499c0`.
bb styling: `f135a001e72942cee9118d2693208ec0725e2f18`.
Execution checkpoint and CI acceptance remain in the issue.

## Screen and flow handoff

Use the [audited captures](../research/desktop-experience-audit.md#captured-evidence)
and pinned source references in the [desktop specification](../specs/workspace-desktop-ux.md#primary-reference-map).
Main owns the compact left workspace navigation, saved-view strip, contextual
controls and unobstructed project work area. bb owns Inter typography, neutral
semantic surfaces, fine borders, compact controls, muted secondary text, rounded
menus and section-based settings. Do not copy main's palette or split layout.

| Confirmed mismatch | Concrete target and component | Verification / owner |
| --- | --- | --- |
| Repeated workspace heading, path and switcher above daily work | Single compact workspace heading; sidebar switches workspace; path remains available | Whole-screen ordinary/long captures; #68 |
| Discovery/category/archive management stack | Compact contextual source tools; Active/Archived remains immediately available; operation forms open on demand | Real commands, recovery/error access and Escape; #68 presentation, #60–62 new operation flows |
| Five property creation buttons and option management | One contextual properties surface containing existing commands | Creation/cancellation and unchanged service tests; #68 |
| Persistent row movement/rename/reveal controls | One row actions surface with named commands and keyboard entry | Interaction, focus and native consumers; #68 presentation |
| Oversized headers/rows and cells | Compact headings and cells, contextual column affordance, bounded long content | Both themes/languages/sizes; #68 |
| Declared but unloaded font and mixed glyph icons | Packaged Latin/Cyrillic Inter, consistent outline icons and localized hover/focus hints | Actual font load, icon/control inspection; #68 |
| Settings lacks hierarchy | bb-like section heading, descriptions and compact rows/cards | All settings sections and return path; #68 |

Fixtures: ordinary projects `Brand refresh`, `Customer portal`, `Release checklist`;
long-content fixture adds authored English/Russian labels and multiline values.
Capture whole screens at 1024x720 and 1440x960, EN/RU, light/dark. Inspect menus,
value editor, settings, loading/empty/error/pending states. Record actual font
faces and geometry separately from visual comparison. Preserve the mounted
workspace, scroll, service revisions, pending/uncertain operations and errors.
No split/project-area behavior is added; #54 owns panels/history, #53 owns Board.
Existing Board remains functional. #56/#57 retain commit/cancel lifecycle work.

## Agreed seams and scenario coverage

The owner approved React UI, typed service and real Electron smoke seams.
Retain service/SQLite/filesystem/native tests unchanged unless a presentation
entry point needs adaptation. Retain all saved-view lifecycle, last-view,
workspace management, source/recovery, isolation and value editor semantics.
Adapt interaction drivers to enter compact contextual surfaces; replace raw
structural control-count assertions only with the corresponding reachable action.

- Visual: ordinary and long-content before/after, eight locale/theme/size variants.
- UI: saved views create/rename/duplicate/reorder/switch/delete/fallback/last-view,
  cancel/Escape/focus; property and source controls remain reachable.
- Service: affected views/layout/properties/workspace source consumers; no schema changes.
- Runtime: shell, views, workspace/source management, value editing, native consumers.
- CI: explicit bounded desktop-UX profile on supported hosts, exact SHA artifacts,
  deliberate failure propagation, retained full/platform/release routes.
- Final: type/lint/build, focused tests, independent Standards/Spec reviews,
  full suite once; broaden package/asset checks for the bundled font.

## Progress

Implementation and independent reviews are complete. Hosted platform acceptance
and scoped-route failure propagation remain pending in the issue checkpoint.
See the [local verification report](../verification/issue-68-visual-foundation.md).

## Requirement retention decisions

| Affected inherited scenario | Decision and retained guarantee |
| --- | --- |
| Workspace dropdown in daily area and duplicate Add action | Replace daily entry with the existing sidebar; settings retains its selector. App/native tests activate stable workspace IDs through real sidebar controls, retaining activation failure, selection/removal races and identical names. |
| Property creation/options/metadata management | Adapt entry through Properties. Keep the original service receipts, cancellation, validation, hidden usages, sibling/source ownership and deletion safety assertions. |
| Row rename/category move/reveal/order | Adapt entry through Project actions. Cancel returns to that row's outer actions trigger; reopening explicitly selects the command again. Pending/unknown bindings and disabled replacement commands stay covered. |
| Group-assignment drag/keyboard controls | Retain in the project occurrence so dragging and focus remain bound to its actual group. Use compact named icons; no group payload or service semantics change. |
| Archive/location/recovery | Adapt daily management entry; retain settings' inline location disclosure. Existing review/Apply/Cancel/Escape and uncertain-operation tests remain. An active operation handles Escape before its containing tools. |
| Raw Name/Reveal header and category-cell button structure | Replace obsolete placement assertions with Name/Project actions columns and a reachable category command in the same stable project row. Authored Name/category text, counts and identity remain asserted. |
| Saved-view lifecycle | Retain create/rename/duplicate/order/switch/delete/active fallback/last-view/cancel coverage through existing Radix controls and real Electron views suite. |
| Hidden settings workspace and tool portals | Strengthen isolation: tools stay under the owning workspace's visibility/inert boundary. Add a regression for settings ownership. |
| Tooltip Escape and header property rename | Add regressions at the agreed React seam and renew real Electron focus/cancel evidence. Hints neither take focus nor consume Escape. |
| Renderer resources and license fixtures | Extend real ASAR fixtures to include CSS-referenced fonts and complete OFL; retain migration/native/SQLite/version/Windows path failures and add missing-font rejection. |

No accepted data-safety, supported-platform or editor-lifecycle requirement is
retired. Later #56/#57 still own their complete commit/cancel/draft/navigation
behavior; #68 supplies shared presentation only. No mutation is replayed by an
adapter, and readiness/shutdown deadlines remain unchanged.

## Review and verification checkpoint

Independent Matt Pocock Standards/Spec reviews found header-rename visibility,
portal ownership, archive Escape priority and row hints. Repairs have regression
coverage. A second review identified stale native dropdown and inner-menu focus
assumptions; adapters now follow the existing sidebar/context entry points.
The real hint/menu Escape reproduction also demonstrated that a tooltip
DismissableLayer consumed Escape before tools; the local noninteractive hint
resolves this without changing editor cancellation.

The focused UI/interaction selection passed **837/837** locally under Node
22.21.1. The complete candidate run and its failures are recorded in the
[verification report](../verification/issue-68-visual-foundation.md). No full-suite
success is claimed. Hosted exact-candidate acceptance remains in GitHub.
