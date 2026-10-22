# Issue 56 scalar draft verification

Issue: [#56](https://github.com/kornouhovas/workspace/issues/56).
Immutable base: `b0b19ad18e85f4d955c5bd33b62bd9fbcf8f9693`.
[Plan and inherited coverage](../plans/issue-56-scalar-drafts.md).
GitHub owns candidate CI, integration and final issue status.

## Implemented boundary

The existing scalar editor is shared by Table, Board and project details. Text
Enter preserves a newline; Cmd/Ctrl+Enter and leaving the editor commit. Number
and manual Date commit on Enter/blur. Clear submits null separately from authored
empty Text. Calendar Date selection commits immediately; dismissing its editor
cannot revert accepted values. Number expressions persist only their result.

A workspace-wide draft registry gates project/view/workspace/settings/history
transitions. A pending write is awaited once; invalid or failed writes retain
the editable draft, block transition and do not replay automatically. Editing the
draft, explicitly saving, or cancelling permits recovery. Cell identity/lifetime
and minimum snapshot revisions retain existing response ownership. Same-source
regrouping/filter projection changes wait for scalar save/cancel; values/revisions
continue updating while the editor remains mounted. Offscreen-row draft pinning
and renderer/service isolation remain in place.

## Appearance

References remain main `080b416c57b2869024ac62363e96b68b40f499c0` composition
and bb `f135a001e72942cee9118d2693208ec0725e2f18` styling, through the
[accepted #69 map](issue-69-coherent-desktop.md). Inspected actual accepted
`visual-af23242/ordinary-en-light-1024-value-editor.png` and
`files-af23242/preview-en-light-1440.png` alongside current Table/Board/details.
Retain sidebar/view strip, single project area, Inter, semantic themes, field
borders/focus rings and wrapped action buttons. New Date picker uses the existing
compact button/input styles. Only hint text changes to explain blur. No CSS,
font, icon, package, native resource or upstream source is added.

Actual local Electron capture `work/issue-56-scalars-dev/` contains 72 whole-window
Text/invalid-Number/calendar-Date screenshots across three surfaces, EN/RU,
light/dark and1024x720/1440x960. Representative Table EN light1440, Board EN
light1024, invalid details RU dark1024 and calendar details RU dark1024 were
visually inspected against those references. Shared controls and principal
composition match; narrow project details scroll inside the project area and
retain wrapping. The existing long-content/reference styling is unchanged.
Behavior assertions do not substitute for this appearance comparison.

## Development evidence

Local host: macOS arm64, pinned Node22.21.1, Electron44.7.0. These are local
candidate checks; hosted receipts retain their own SHA/run/attempt and artifacts.

- Scalar/UI service scenarios: multiline/empty/Clear, Number result, manual and
  calendar Date on all three surfaces in EN/RU; invalid/save-failed/lost reply,
  explicit retry/Cancel, duplicate Enter+blur, delayed newer sibling value,
  blocked project/workspace/settings/history and same-source regrouping.
- Selected editor/filter/grouping/layout/viewport/profile suites:71/71 pass.
- Renderer/navigation/Views suites:129/129 pass before the final regrouping
  addition; the completed full-candidate suite must renew their shared consumers.
- Typecheck, lint, documentation links and whitespace checks pass.
- Actual Electron scalar route:24 matrix scenarios/72 captures, normal app/backend
  exit and asserted owned-fixture cleanup pass. Original project-navigation route
  passes32 ordinary/long preview/expanded variants and its focus/scroll/resize/
  history/tab/Board controls. Original Number dev route passes2 checks with
  normal shutdown and owned cleanup.

The first scalar driver attempt reached all24 cases but failed a trailing test
assertion that incorrectly expected createView's response to expose viewId.
The corrected driver uses its actual ViewSnapshot contract; the complete original
route was renewed successfully. That failed attempt is not a passing receipt.

Original Date dev initially failed because the inherited driver attempted to open
Settings while retaining an invalid Date. D55 now blocks that transition. Adapted
coverage asserts blocked Settings, replaces the unreachable Settings-with-invalid-draft journey with blocked
Settings, Cancel, actual language controls and invalid-date checks in the other
language. The existing Date UI suite retains live language-rerender/draft ownership
at the component seam. Timezone extremes, invalid/restart/data/focus
and normal shutdown/cleanup assertions are retained. Renewal remains a gate until
the original command passes.

## Remaining acceptance

Independent Standards/Spec review, completed-candidate full suite, three-host
`scalars` profile and artifact inspection, then integration verification. No
installer/release acceptance or completion is claimed by this development map.
No migration, backend validation, filesystem/native or dependency inputs change;
installer and final performance/release guarantees retain their accepted milestone
owners under the [verification matrix](../desktop-ux-verification.md).

The adapted original Date route's local renewal reached the initial English
invalid-date/timezone/blocked-Settings/alternate-language assertions, then failed
the unchanged10000ms normal Electron quit before restart. Forced process cleanup
and owned fixture cleanup passed; no complete language row was recorded and
later cases remain unexecuted. Host: macOS27.0/26A428, arm64, Node22.21.1.
The historical local macOS27 native-quit class in #69 is context, not proof of this
failure's cause. No assertion/deadline/cleanup gate is weakened; complete hosted
original Date development and packaged routes remain required. An intermediate
driver experiment incorrectly assumed a renderer settings-notification API and
timed out; it was discarded, not treated as product behavior or acceptance.

## Review repair and renewed focus checks

Standards review:0 findings. Spec review:1 return-focus issue, reproduced red:
closing after a valid Number draft saved the value but left no view trigger
focused. Close/return focus are now one guarded action and redundant separate
focus calls are removed. Preview and expanded-tab regressions verify persisted15
and the original project trigger focus. Scalar/navigation renewal30/30 passes,
with typecheck/lint passing. Independent Spec follow-up finds0 remaining issues.
The native scalar route now also asserts trigger focus after Date blur+close.

## Full-run and Actions diagnosis

Local `npm test` at9d83956:3315pass/2fail/27skip,3344reported tests.
One environment failure was Ladle403 through a dependency symlink outside Vite's
serving allow-list; real local dependencies fix it without changing any serving
permission. The second failure, also the sole selected-suite failure on all3
hosts in39807241669/attempt1, is a projection defect: expected2 retained project
statuses, actual1. macOS869pass/1fail; each Windows868pass/1fail/1skip. Their
native/package tails were not reached. This run remains failed.

A scheduling-only wait did not repair it. Public service/query returned2 projects
while only the original row was visible. The reduced actual grouped-discovery
regression fails with pristine9d83956 Table source, then passes when new IDs can
join the pinned projection. Existing draft owners retain row/group position,
editor identity, exact value and focus; newly discovered rows appear immediately.
Same-source values/revisions still update; relocating/removing existing rows waits
for save/cancel. The original mode expectation remains2, with normal readiness
waiting. Temporary diagnostic tags were removed. Both independent axes reviewed
the repair and report0 remaining findings. Affected-file and original3-host
scalar/native/package renewals remain mandatory; failed full/CI runs are never
relabelled green.
