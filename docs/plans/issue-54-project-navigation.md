# Issue 54: project navigation

Base: `49d19ac412b23ba362f523c54a6e75dd253e557c` (`new-workspace`).
Tracker: [#54](https://github.com/kornouhovas/workspace/issues/54).
Task branch: `codex/issue-54-project-navigation`.

## Handoff and scope

Main `080b416c`, project-tabs, left-panel and project-area composition supplies
saved-view/project navigation, a right preview and expanded project. The accepted
single-project and unique-tab exceptions supersede its splits/duplicate commands.
Use #68's loaded Inter, semantic surfaces, compact icons/Hint and pinned Radix
menus. Ordinary fixtures: Atlas, Beacon and Cedar with real Text/Number/Date and
selection values; include long English/Russian names and multiline notes.

Implement session-only project/view navigation, per-view preview and scroll,
unique retained tabs and close/reopen/reorder commands; sidebar collapse/resize,
project width and current-run workspace/settings Back/Forward. Keep existing
property editors and typed services. Persistence is #55; unified draft guards
are #56; real file tree/native Open is #64. No tree placeholder counts as #64
or #69 acceptance. No storage, IPC, dependency or installer changes are planned.

## Scenarios and agreed seams

The issue authorizes renderer interaction and public Workspace service tests
with temporary real SQLite/folder fixtures, plus actual Electron flow checks.
Implement vertical red/green slices at those seams:

- Non-editor row/card/name activates one preview, B replaces A; editors do not.
- Preview details use live values/editors; errors, retry and superseded reads.
- Expand/select creates/reuses one workspace-owned tab and shows one project.
- Return removes only that tab and restores view/preview/width; close-active
  restores the view, close-inactive preserves active content; preview-close
  releases the host without changing tabs.
- Reorder, close others/right, reopen closed, rapid duplicate protection and
  pointer/keyboard alternatives; focus remains usable after removal.
- Saved-view filter/group/scroll/preview restoration, workspace isolation and
  source invalidation; late reads never reopen or overwrite selection.
- Sidebar pointer/keyboard bounds, collapse/discoverable restore and project
  resizing at 1024x720 and 1440x960.
- Back/Forward visits workspace/settings, disabled endpoints, forward truncation,
  removed/unavailable destinations, keyboard and EN/RU labels.

## Coverage and verification selection

Retain service/property/identity/isolation/recovery requirements. Adapt affected
renderer and runtime journeys from passive names to preview buttons; replace
old layout assumptions with observable single-project/unique-tab behavior.
Retain view/filter/group/layout and editor cancellation contracts. Record any
further per-scenario adaptations here; no accepted requirement is retired.

During implementation run focused renderer tests and typecheck regularly.
Before final acceptance: independent Standards/Spec review, lint/docs/build,
full suite once on the completed candidate, Electron navigation plus shared
shell/views flows, whole-window EN/RU light/dark at both sizes. Select an actual
scoped CI route covering changed navigation and existing service guarantees on
supported desktop hosts; inspect artifacts and exact SHA. Known unchanged native
harness failures from #53 remain owned by #69, never relabeled passing.

Appearance requires comparison with the pinned composition/token mapping above,
separately from behavior. #64's real tree and #69/#67 broader platform/package,
performance and release acceptance remain independent gates. Current checks,
review, CI and delivery receipts will be recorded here and in GitHub checkpoints.

## Implementation and coverage reconciliation

Implemented a workspace-owned in-memory tab/preview session with unique IDs,
reopen history and retained names; no new persisted schema. Existing active view
selection remains service-owned. Table and Board non-editor/name activation
opens a single project host. Archive rows use the same route and their retained
ordinary-value editors. Existing property cells own drafts, pending/error and
revision checks; project selection keys their read lifetime.

View controllers remain mounted during expansion; per-view controllers are keyed
on saved-view changes. `useViewScroll` retains independent parent and nested Table/
Board horizontal positions and restores after asynchronous projection paint.
User scrolling interrupts restoration. The right width is bounded by actual
available work-area width and reserves usable view space. Collapsed sidebar
removes its resize tab stop and returns focus to the restore control.

| Inherited scenario | Decision and replacement |
| --- | --- |
| Exact authored Name assertions in rename UI and production renderer cases | Adapt `td span` to the visible preview button, retaining exact whitespace/text, identity, operation receipt/recovery, delayed result and focus assertions. No rename requirement removed. |
| Shared shell independent scrolling and settings return | Adapt measurement from outer desktop host to the new saved-view scroll owner; retain viewport/sidebar geometry, inert/hidden content, row readiness, keyboard/focus and exact scroll return. |
| Saved view, filter, grouping, Table/Board layout and viewport/value editors | Retain focused suites; key view projections to avoid previous-view scroll/content during asynchronous selection. Existing source refresh retains same-view editors. |
| Session/history/resize/late response | Add public renderer journeys and actual Electron pointer/keyboard/geometry/scroll checks. Retain removed/unavailable destination explanations and Settings access before backend readiness. |

## Review and appearance repair

Independent Standards and Spec reviews used the immutable base above. First
review identified sidebar focus/zero-width tab-stop, late Back dismissing a newer
Settings visit, and inherited horizontal scroll on a new view. Repairs retain
collapse/restore focus, disable competing navigation only during traversal, and
restore/reset each selected view's nested scroll areas after its own projection.
A removed-history-destination red/green regression also prevents a same-current
history traversal from remaining pending. Renewed reviews found no remaining
blocking findings; final native evidence remains a separate gate.

Inspected the whole Electron window against main's committed
`outputs/compact-toolbar-2026-09-21/02-compact-expanded.png` and
`outputs/quiet-precision-tabs-2026-09-21/source-expanded-workspace-two-tabs.png`
at `080b416c`, plus its shell/tab sources and the existing #68 bb Inter/token
mapping. Corrected a crowded minimum-width sidebar heading and added the
expanded project title/properties hierarchy and framed property rows. The
neutral colors/compact controls follow bb rather than main's older accent
palette. No file-tree placeholder substitutes for #64. Visual capture covers
ordinary/long authored content, preview/expanded, EN/RU/light/dark/both sizes.

Native driver repairs preserve the observed requirement: wait for the actual
Radix arrow-key focus target before Enter; scroll a windowed row into view before
looking for its preview button. Neither changes production deadlines or removes
behavior assertions. The initial failing receipts remain local evidence.

The longer native fixture exposed an actual 48px vertical scroll drift when
Chromium anchoring adjusted windowed rows after restoration. Restoration now
suppresses native anchoring only while its own coordinates settle, restarts its
settling frames on row mutations, then restores ordinary anchoring. The smoke
waits for the restoration marker to clear and checks settled coordinates again.
It also waits for that completion before simulating the next scroll. These are
separate product and driver repairs; earlier transient coordinate matches alone
are not acceptance.

Observed local candidate evidence (macOS arm64, Node 22.21.1): navigation renderer
10/10, adapted production renderer/rename 300/300, contextual view/layout focused
25/25 and archive/navigation 20/20 passed at their recorded stages. Typecheck,
lint, local docs links and whitespace checks pass. Final Electron navigation
passed 32 ordinary/long preview/expanded variants; actual independent vertical/
horizontal view scroll, expand/return width/scroll, pointer project resize,
keyboard bounded widths, sidebar focus/collapse/restore, inactive-close/reopen,
pointer tab reorder, keyboard project selection, actual workspace Back/Forward
and Board preview. Its report verifies normal shutdown and fixture cleanup.
Shared shell and six saved-view runtime groups passed with the changed scroll
owner. Final complete-suite and exact-SHA hosted receipts remain pending below.

Further reproduction distinguished the scroll cause from the anchoring hypothesis:
`save Table160 → restore/settle160 → save208 → restore Table208`. Creating a view
published `workspace.listChanged`; the outgoing filter's loading panel changed
geometry before the selected-view reply arrived. The hook was accepting that
browser scroll as a new outgoing position. `ViewsPanel.onWillLoad` now suspends
capture before read/mutation, preserving one outgoing position through repeated
requests. Only an accepted current selection resumes restoration, including
same-view refreshes. Temporary diagnostic logging was removed. The original
native reproduction then passed with settled coordinates and all 32 captures.

A complete local run before final repairs yielded 3,190 pass / 22 fail / 26 skip.
Twenty failures were exact authored-Name selectors in category move scenarios;
these now target the preview button while preserving every value/identity/
recovery assertion. Ladle's one 403 was caused by this task's temporary external
node_modules symlink, not source configuration; the task now has an isolated
copy of the identical dependency tree. Both boundaries pass in the 217-scenario
renewal. The remaining negative was the unchanged standalone property-creator
fixture's ten-second native shutdown after quit/node-exit; it belongs to the
already documented #69 harness gate, and this run is not relabeled green.

Additional EN/RU red/green cases prevent editor-label clicks from opening a
preview and restore focus to the preview button after a non-editor row click.
The final row event guard excludes the entire existing property-editor subtree.
The focused selected view/filter/layout/navigation renewal passes 37 scenarios;
typecheck and lint pass. Final native confirms both click/focus cases as well.

## Exact-SHA Actions failure and repair

Candidate `22b5e7a4`, run [39626354180](https://github.com/kornouhovas/workspace/actions/runs/39626354180)
attempt 1: Windows latest and Windows 2022 passed the complete navigation profile;
macOS passed all selected renderer/service tests but the native flow timed out
opening the long project after expand/return. Only five macOS artifact files
were produced; later shell/views consumers there were not reached.

The original native driver scrolled a windowed row before the previous view's
restoration finished; that restoration could move it away and evict its fields.
`openPreview` now waits for the selected projection's busy/restoration state to
finish before programmatic scrolling. No deadline, product assertion or shutdown
requirement changes. A new shorter-filter projection check also locks down an
observed boundary: a saved offset beyond the new content extent must clamp and
release restoration. The hook now clamps to current bounds once the projection
is ready. The local original native command passes all 32 variants and that
additional scenario; focused navigation/viewport/views/route regressions pass.

The dedicated `desktop_ux_navigation_only` route defaults false and renews only
the original failed macOS native command and affected regressions, with build
prerequisites and exact provenance. The complete three-host navigation profile
must then be renewed because the scroll-bound repair changes application input.
Original failures, Windows successes and their separate SHA provenance remain
recorded; no skipped/unreached stage is counted as passing evidence.
