# Issue 51: contextual saved views

Issue: [#51](https://github.com/kornouhovas/workspace/issues/51), scoped UX02,
UX12, UX16 and UX18 from #47. Baseline `53a87519`; implementation branch
`codex/issue-51-contextual-views`. Integrated UX acceptance remains in #67.

## Implemented behavior

Saved Table/Board views use manually activated Radix tabs. The active view's
Dropdown Menu exposes edit/rename/layout, duplicate, reorder and confirmed delete;
the last view cannot be deleted. Activation retains tab focus; menu actions and
editor dismissal restore their originating control, including reorder immediately
after creation. Tabs identify the current active/archived content panel.

Project-name search stays in the working toolbar. The Radix filter Popover exposes
all existing typed operators, selection operands and empty-value conditions.
Apply/Clear use the existing per-view service commands; dismissal preserves an
authored draft and does not save it. Rejected commands retain the draft and error
feedback. Pending/read failures retain explicit loading, disabled and retry states.

The existing real Table/Board hosts, live source updates, SQLite persistence,
source/workspace ownership and renderer isolation are retained. There is no
migration or backend/IPC contract change. The mounted workspace retains view
selection, scroll and focus through settings entry/return.

## Scenario coverage and review

[The plan](../plans/issue-51-contextual-views.md) records inherited scenario
retention/adaptation. Existing service tests cover lifecycle, independent duplicate
settings, final-view rejection, workspace ownership and reopen; filter tests retain
typed/empty operators, persistence, current values and rejection cases. Renderer
tests adapt the replaced select to tabs and contextual controls, retaining archive,
source sharing, metadata cleanup, stale responses and error recovery scenarios.
No accepted data-safety or platform requirement was retired.

Independent Standards and Spec source reviews found tab-focus restoration,
tab/panel relationships, required contextual primitives and an inherited select
locator. These were repaired. A follow-up Standards review caught stale creation
focus after reorder; a create/earlier/later regression reproduced it before repair.
Both final reviews report zero remaining findings. Native driver readiness now
recognizes both HTML-disabled controls and ARIA-disabled Radix menu items.

## Local evidence

Host: macOS 27.0 arm64; required Node 22.21.1. Checks run against the working
candidate committed with this report. Generated logs/screenshots remain local
under `/tmp/issue51-*` and the task's ignored `work/` evidence directories.

- Focused renderer scenarios: 16 passed, including EN/RU, keyboard activation,
  consecutive tab switches, final-view protection, focus return, filters and errors.
- Typecheck, ESLint and Markdown link validation passed during implementation.
- Development view journey passed all six EN/RU Table/Board, lifecycle, filtering,
  grouping, layout/drag, metadata removal, restart, normal-quit and cleanup checks.
- Development shell journey passed 28 checks, including contextual menu/Popover
  inspection, collision bounds, Escape/focus, settings return, workspace switching
  and restart at 1024x720/1440x960 in EN/RU and light/dark.

The full `npm test` run built the final application and executed 3,172 tests:
3,135 passed, 26 platform skips and 11 failures. The original run remains failed.
Two failures were stale exact expectations in `test-suites.test.mjs`: the existing
#50 workflow already includes `source-fixture`/`source-runtime`. Updated those
expectations without changing the workflow or matrix; all 48 routing tests pass.
This is a test-only repair; application/build inputs remain those of the full run.

The other nine failures were seven property-fixture normal-close timeouts, one
minimal native quit timeout and one native drag-start assertion. Sequential
unchanged-file renewals passed the quit and drag checks (1/1 each). The property
file passed 8/13 and retained five normal-close failures. Its baseline whole-file
comparison passed 10/13 and retained three of the same normal-close failures. The same failure was
then reproduced on unchanged `new-workspace` at `53a87519`; the fixture loads only
minimal HTML, not the application. Electron executable/package, Playwright
package/loader, lifecycle helper and property driver match the baseline byte for
byte. This establishes baseline reproduction, not the unique native cause.
No deadline, quit assertion, native gesture or platform requirement is weakened.
Required passing supported-host receipts remain acceptance gates.

The final Ladle build, fresh arm64 directory package and artifact/resource check
passed. Renewed `smoke:shell` passed all 28 checks with the final input/menu styles;
inspected EN/RU light/dark screenshots at both required sizes. An earlier native
assertion read focus before Radix finished asynchronous restoration. It now waits
for the originating trigger within the original deadline before asserting focus;
one Escape is sent and no focus is forced. Independent review accepted the repair.

The packaged views journey failed its first normal-close gate after emitting quit
receipts; owned forced cleanup passed. Its checks array is empty, so no completed
packaged lifecycle/restart acceptance is claimed. Local package creation and
resource validation do not substitute for that missing runtime evidence.

The strict 1,000-project/20-property/10-view packaged performance run also failed:
initial direct startup 5,657.6ms exceeded 5,000ms and direct Table filtered group
assignment 531.4ms exceeded 300ms. A later grouped Board assignment timed out in
the unchanged complete-projection readiness check. All three actual normal
shutdowns and owned cleanup passed. Other completed filter samples were within
300ms; unreached cases are not passing evidence. A fresh detached baseline (`/private/tmp/workspace-issue51-baseline`, clean
`53a87519`, own dependencies/build/package) reproduced initial startup above
5,000ms (5,860.2ms) and the same unchanged readiness failure at `ready()` after
Board group assignment, on its direct source. Its source shutdowns and owned
cleanup passed. Baseline and candidate use the same dataset, limits, readiness
assertions and original harness, apart from the necessary select-to-tabs view
activation adaptation. This demonstrates that those failure patterns occur without
#51; it does not establish their unique cause or waive any target. Candidate's
531.4ms direct Table assignment remains a separately recorded target miss.
Raw baseline evidence: `/tmp/issue51-baseline-performance/report.json`.

The only changes after the full application run are documentation and the two
inherited CI-selector expectations plus native focus-observation waits. No
application, dependency, migration, build/package or runtime-configuration input
has changed since that full-run candidate. Renewed routing and shell consumers
are recorded above; the original failures are not relabelled successful.

## Acceptance gates

Required supported-platform CI and installer receipts have not yet been renewed
for the changed application/dependency inputs. Issue #51 remains open; no delivery
or integration is claimed. The current repository is public while the tracker
policy requires private application sources. Publication awaits the owner's
resolution under [tracker policy](../issue-tracker.md); no issue write or push has
been made during this task.
