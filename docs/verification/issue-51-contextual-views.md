# Issue 51: contextual saved views

Issue: [#51](https://github.com/kornouhovas/workspace/issues/51), scoped UX02,
UX12, UX16 and UX18 from #47. Baseline `53a87519`; implementation branch
`codex/issue-51-contextual-views`. Integrated UX acceptance remains in #67.

## Final supported-host acceptance

All required #51 scoped acceptance rows now have inspected passing evidence.
Receipts retain their actual source SHA and attempt 1; later documentation does
not relabel them as execution on another commit.

| Boundary | Source SHA / run | Inspected result |
| --- | --- | --- |
| Full desktop Common + macOS latest / Windows latest / Windows 2022 | `23c7fb4` / [39414604470](https://github.com/kornouhovas/workspace/actions/runs/39414604470) | All suites pass; EN/RU development and packaged views, shell/settings/source journeys, restart, isolation, normal shutdown and cleanup |
| macOS 14 arm64 DMG + Windows latest x64 NSIS | `23c7fb4` / [39414604799](https://github.com/kornouhovas/workspace/actions/runs/39414604799) | Install/reopen/replacement, preserved IDs/data, EN/RU and cleanup pass |
| macOS 14 packaged strict performance | `b77d3885` / [39424627943](https://github.com/kornouhovas/workspace/actions/runs/39424627943) | Native 6/6, all 32 measurements; max interaction 225.7ms, initial startup 3177.8ms, peak 944,537,600 bytes; four normal quits/backend exits and cleanup |
| Windows latest x64 packaged strict performance | `45064815` / [39444498928](https://github.com/kornouhovas/workspace/actions/runs/39444498928) | Native 6/6, all 32 measurements; max interaction 281.5ms, startup 1751.7ms, scan 2449.7ms, peak 795,668,480 bytes; four normal quits/backend exits and cleanup |

The final Windows artifact is
`performance-windows-latest-45064815452a1089d5e29800a3b1bd1ec23e4e5e-run-39444498928-attempt-1`:
`candidate/report.json` is `passed`, `diagnostic: false`, clean source diff;
`readiness/regressions.log` passes six controls. Separate `profile/report.json`
is explicitly `diagnostic`; its 32 cases, eight nonempty CPU profiles and eight
parseable timelines with event/paint marks complete with four normal quits and
cleanup. Profiled measurements are not used as strict acceptance.

The whole delta since `23c7fb4` was reviewed, including intermediate commits:
application sources, dependency manifests/lockfile, migrations, native resources,
build/package commands and runtime configuration are unchanged. Changes affect
performance drivers/readiness/timing, diagnostics, their native regressions and
route inventory tests, plus documentation. Renewed both strict performance hosts
after the endpoint/stabilization change; renewed the later metadata/diagnostic
consumers on Windows and native controls locally on macOS. Reuse of the macOS
`b77d3885` receipt is justified by its unchanged endpoint/readiness and app inputs;
its passing filter clock conservatively included fixture preparation later moved
before the event. No missing new diagnostic fields are claimed on the old receipt.
Both review axes cleared the source and collector repair.

Historical failures below remain failed evidence. The final Windows runner reports
AMD EPYC 9V45; prior failed hosts included EPYC 9V74 and 7763. The successful
traces do not reproduce the old slow intervals, establish their historical cause
or prove an application optimization. Acceptance applies to the observed supported
runners and dataset, not all hardware. Local macOS 27 failures are retained below;
the required macOS 14 and Windows routes now pass. Integrated UX remains #67;
release/signing/native-dialog manual acceptance remains outside #51.

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

At this initial local checkpoint, changes after the full application run were documentation and the two
inherited CI-selector expectations plus native focus-observation waits. No
application, dependency, migration, build/package or runtime-configuration input
has changed since that full-run candidate. Renewed routing and shell consumers
are recorded above; the original failures are not relabelled successful.

## Publication and acceptance history

At the original local handoff, supported-platform CI and installer receipts were
still required. The owner explicitly authorized publication to the current public
repository after reviewing candidate `23c7fb4`. The final ledger above supersedes
that earlier waiting state. This does not authorize a release or another issue.


## Original CI and focused readiness repair

At `23c7fb417f5ed0544c6c4b47313edaaefb5c2e4f`, attempt 1, installer run
[39414604799](https://github.com/kornouhovas/workspace/actions/runs/39414604799)
passed both macOS/14 arm64 DMG and Windows/latest x64 NSIS installation, EN/RU,
reopen/replacement/reinstall, preserved identities/data, isolation and cleanup.
Both exact-SHA reports were downloaded and inspected. Full desktop run
[39414604470](https://github.com/kornouhovas/workspace/actions/runs/39414604470)
has passed Common/static and is still providing platform/runtime evidence.

Performance run [39414634270](https://github.com/kornouhovas/workspace/actions/runs/39414634270)
failed both original hosts at Board assignment readiness. macOS recorded startup
6,349.2ms and Table assignment 360.2ms; Windows recorded first Table filter
436.4ms and Table assignment 314.6ms. Each target miss remains failed evidence.
Normal shutdown and cleanup passed; later scenarios were unreached.

A failure-only local diagnostic found an unloaded row overlapping the window
but entirely outside its horizontal Board clip (row right=103; clip left=244).
The renderer correctly left it as a skeleton; the old window-only predicate
incorrectly classified it as visible. The extracted readonly readiness helper
now intersects ancestor clipping client boxes. It retains complete ordered IDs,
all pending checks, real editor controls and ready fields for every partially
visible row. No timeout, target, mutation, source or application behavior changes.
The temporary diagnostic packet was removed after identifying the mechanism.

A real-Electron fixture failed before repair and passed after, covering horizontal
and vertical clipping, partially visible edges, ordered membership, missing
editors and pending states. Both independent review axes report no findings.
49 routing checks pass. The focused performance workflow runs this regression
before the unchanged original strict measurement on each affected host; the
original still runs after a failed regression when packaging succeeded.

The repaired local original completed all 32 measurements and four normal
shutdowns with cleanup. It still failed strict targets: initial startup 5,546.5ms
and grouped-final conservative peak memory 1,011,630,080 bytes. This demonstrates
resolution of the clipping deadlock, not complete performance acceptance or the
unique cause of the other historical misses. Supported-host renewal remains open.

The repair changes only acceptance helpers/tests, their performance route and
documentation. Application, dependencies, migrations, native resources and
build/package source inputs remain those of `23c7fb4`; successful installation
and unaffected desktop receipts retain that actual SHA. Current CI and delivery
status belongs to the GitHub checkpoint.


## Supported-host performance renewal and baseline control compatibility

Focused run [39416296014](https://github.com/kornouhovas/workspace/actions/runs/39416296014),
attempt 1 at `cfefb0f73bc42288b57a1b56c1ae9789885b6abf`, passed macOS 14:
all 32 strict measurements, the native clipping regression, four normal shutdowns,
backend exits and cleanup. Initial startup was 3,822.4ms; conservative peak memory
was 956,710,912 bytes. This is an inspected receipt for that SHA, not a later run.

Windows latest completed all 32 functional measurements, the native regression,
four normal shutdowns, backend exits and cleanup, with no clipping deadlock.
It failed strict initial startup (34,011.8ms) and grouped Table first filter
(1,736.9ms). Its initial connection alone took 8,982.4ms; later starts were near
2,200ms. These observations separate the timing failures from clipping but do not
identify a unique host, service or renderer cause. Renew the failed Windows
original with the existing separate service profile, then the unchanged
unprofiled strict command; diagnostic profiles cannot satisfy acceptance.

A subsequent harness review found that the immutable `d925f8b7` performance
baseline still exposes the original Current view select. Runtime view activation
now selects the existing control shape and performs exactly one action: the same
exact-name tab click for the current application, or the original selectOption
for the historical baseline. There is no retry or fallback after activation.
A native fixture failed before the repair and passed both control paths afterwards
(2/2 tests including clipping), asserting single-action behavior. Independent
Standards and Spec reviewers found no actionable issues. Activation remains before
interaction timing; startup timing, readiness, limits and lifecycle are unchanged.
Application, dependency and build inputs remain those of `23c7fb4`. The inspected
macOS strict receipt above remains attributed to `cfefb0f7`; the current-app action
is equivalent. Renew the changed native regression and historical-control consumer,
and retain the separately failed Windows receipt until its original passes.


Windows-only run [39418142493](https://github.com/kornouhovas/workspace/actions/runs/39418142493),
attempt 1 at `420158b2c426ee9892f7f199a180b152ea1e3550`, passed both native
regressions and all 32 functional/lifecycle measurements, but strict interaction
targets failed: direct Table filter 871.0ms, direct Table grouping 383.4ms,
grouped Table filter 346.7ms, grouped Table assignment 397.9ms and grouped Board
grouping 375.4ms. All four startups (2,988–3,766ms), memory, normal shutdowns,
backend exits and cleanup passed. The separate service profile completed with
cleanup: displayed-view reads 23.6–36.8ms, source opening 2,237.9ms, grouped list
2,009.3ms, grouped refresh 1,774.9ms; the 6.5s native observer interval consumed
about 4.55 CPU seconds. These are diagnostic observations, not unique cause proof.

Ranked falsifiable hypotheses for the remaining interactions: cold renderer work
or GC predicts CPU stacks at first Table filtering; service/IPC delay predicts
renderer idle time; host scheduling/protocol delay predicts a large wall/CPU gap.
The next bounded diagnostic extends the existing optional renderer profile to the
actual first Table filter and grouping/assignment spans, retaining its original
Board widening sample. A same-run immutable-baseline control uses the historical
select. The original unprofiled candidate still follows independently with every
unchanged limit and correctness/lifecycle gate.

The current harness also completed a local old-select consumer against untouched
`53a87519`: all 32 functional measurements and four normal shutdowns/backend exits
and cleanup, with initial startup 5,725.5ms still above target. This validates the
control path, not supported-host target acceptance. Evidence remains at
`/tmp/issue51-baseline-control-renewal/report.json`.

Full desktop run `39414604470` at `23c7fb4`, attempt 1, completed successfully:
Common 494/494; all three platform batches had zero failures. Downloaded and
inspected each host's development and packaged views report (six EN/RU checks,
three normal quits/backend exits per report), general runtime report (15 stages,
normal and failed-startup shutdowns, cleanup), shell/management/source reports and
complete provenance-matched native observer collectors. Both development and
packaged data recovery and property/archive scenarios passed. Those receipts renew
the locally missing native/platform acceptance; historical local failures remain
retained above. Only strict Windows performance remains unresolved.

The extended diagnostic completed locally on macOS 27 with eight nonempty CPU
profiles, all 32 functional measurements, four normal shutdowns/backend exits and
cleanup. Its report is explicitly diagnostic and supplies no target acceptance.
Both independent reviews found no issues; lint/typecheck/docs, 49 routing controls
and whitespace validation passed before publication.


## Event-to-paint endpoint repair

A source review identified a distinct measurement defect: `recordUi` sampled
`performance.now()` through a new driver request after the final completion frame.
The #41 contract ends at committed projection plus frames; post-frame driver
scheduling can overstate it. A throwaway real-Electron probe executed the actual
harness functions with a readonly final-frame timestamp capture: committed work
159.4ms, observed metric 414.3ms after a deliberate 250ms driver delay. This proves
that endpoint defect, not the cause or magnitude of historical Windows misses.
The probe is retained in the ignored diagnostic work directory, not product code.

The timing helper preserves both complete readiness observations and both pairs
of frames. It captures `performance.now()` inside the final existing frame;
interaction `ms` uses that endpoint. Each record also retains `observedMs` (the old
late-read formula), `paintedMs` and `driverObservationDelayMs` for audit. Startup,
limits, interaction preparation/actions, complete projection, real fields,
pending checks, post-measurement service assertions and lifecycle are unchanged.
Invalid/missing event or paint times, stale paints and future paints fail closed.

The native timing regression failed with the previous endpoint (229.8ms became
482.1ms after driver delay) and passed with a fixed renderer endpoint. Pending
content for 120ms and real renderer work for 80ms remain included. Missing/NaN,
stale and future timestamp controls reject. A separate stabilization scenario
invalidates fields during the first frame pair: removing the second readiness
check made it fail, and restoring the check passed. All four native scenarios
pass; lint/typecheck/docs, 49 routing checks and whitespace validation pass.
Both independent source reviews accepted the scoped repair; requested negative
controls were added. The complete local strict original finished 32 measurements,
all interaction/scan/memory samples, four normal shutdowns/backend exits and
cleanup, but still failed initial startup 5,422.6ms. Observed trailing delays were
0.7–4.1ms locally; these are not estimates for remote historical samples.

This changes the measurement consumer, so renew the native controls and original
strict candidate on both macOS 14 and Windows latest. Retain earlier timing
receipts at their original metric and SHA; they do not establish acceptance for
the repaired clock. Application/dependency/native/migration/build inputs remain
unchanged, so inspected full desktop and installer receipts retain `23c7fb4`.


## In-renderer stabilization and bounded fixture repair

Old-clock comparison run `39419612547`, attempt 1 at `2d4207f5`, retained
28 immutable-baseline measurements with target misses, two normal quits/backend
exits and cleanup. Both sources then failed at the obsolete General-tab locator
in `runtime-settings`; RU refresh/reopen were unreached. This is failed diagnostic
comparison evidence, not passing baseline or current-app acceptance. Its separate
candidate CPU diagnostic completed 32 samples/eight profiles and lifecycle.
Renderer stacks include driver role/visibility work and idle spans; for example,
grouped Table grouping/assignment spent about 2,915ms of 3,296ms idle. Those broad
spans do not uniquely identify the strict interaction delays. The independent
unprofiled candidate completed all 32 cases but failed 11 interaction targets.
Its native control also failed page preparation at the fixture's 500ms timeout.

Clock-renewal run `39422590498`, attempt 1 at `90f0defe`, passed all four native
controls on both hosts. Both completed 32 samples, startup/scan/memory/lifecycle
and cleanup except the listed limits: macOS Table assignment 314.7ms; Windows
Table filters 352.2/347.1/324.9ms, Table assignments 375.1/437.5ms, Board grouping
368.1/374.0ms and grouped refresh 5,071.6ms. Windows initial startup passed.
Trailing observation delays were about 2ms at those misses, refuting that interval
as their sufficient explanation. These are retained failures under that clock.

A further native control reproduced host latency *between* readiness phases:
delaying delivery of the first driver result moved stabilization after that pause,
although the renderer was already usable. Both unchanged predicates and both
frame pairs now run together inside one renderer promise. Only the repository's
fixed owned functions are serialized; project IDs remain ordinary data arguments.
The original driver timeout remains, with a 30-second internal readiness bound.
Reports add first-painted and stabilization durations; later handle delivery and
observation cannot move captured timestamps. This removes host round trips from
stabilization, not renderer work, pending states or actual completion frames.

The field invalidation control now changes readiness after the first actual DOM
observation and restores only on another observation. Removing the second check
fails; restoring it passes. Pending/renderer-work, post-paint and intermediate
host-delay controls, invalid/stale/future endpoints, clipping/order/membership and
real-editor requirements remain. Six native controls pass; lint/typecheck and
49 routing checks pass. This demonstrates the harness defects, not a unique
historical cause for every target miss; both original strict hosts need renewal.

Fixture setup retains its ordinary 30-second allowance while activation actions
keep 500ms. A controlled 650ms resource load reproduced the preparation failure
before repair and passes after it. The performance-only language adapter retains
current Settings/General/select/Back actions and the immutable inline select,
with a single-action native control for each. No shared settings driver, product,
source/dependency/build input, target or lifecycle requirement changes.

Both independent follow-up reviews found no actionable issues. The local strict
original with in-renderer stabilization completed 32 samples, all interaction/scan
targets, four normal quits/backend exits and cleanup. It still failed initial
startup 5,278.2ms and conservative final peaks 1,005,371,392/1,015,136,256 bytes.
Those local failures are retained; neither a remote pass nor a unique historical
cause is inferred. Both supported strict candidates remain required.


## Inspected macOS acceptance and remaining Windows diagnosis

Run [39424627943](https://github.com/kornouhovas/workspace/actions/runs/39424627943),
attempt 1 at `b77d388573adcda2cd0bbc1952dda0db40191464`, passed macOS 14:
six native controls, all 32 strict samples, startup 3,177.8ms, maximum interaction
225.7ms, conservative peak 944,537,600 bytes, four normal quits/backend exits and
cleanup. Exact-SHA raw report/regression log were downloaded and inspected.

Its Windows latest original completed all 32 cases and six native controls;
startups/memory/four normal quits/backend exits/cleanup passed. Strict failures:
direct Table filter 388.7ms, direct Board grouping 366.7ms, grouped Table filters
330.0/400.4ms, grouped Table assignment 405.2ms, grouped Board grouping 346.6ms
and grouped refresh 5,124.1ms. At those misses the first paint was already late;
final stabilization took 28.1–32.5ms and late observation 4.0–5.2ms. This bounds
those intervals but does not distinguish earlier driver work from service/UI work.

Additional observation-start and initial-readiness timestamps now provide that
split without changing the readiness sequence or measured endpoint. Expected-ID
fixture computation moves before search/activation; #41 excludes preparation from
the user-event clock. It preserves the exact expected membership and user action.
The separate service diagnostic profiles real save-filter/query, save-grouping/
query and assignment with durable membership checks. Local diagnostic completed
18 nonempty CPU profiles and cleanup: assignments 25.6–27.7ms, filter saves about
2ms, projected reads about 10–16ms; these local values are not Windows evidence.
Six native controls and static checks pass. Both independent reviews have no
findings and accept Windows-only renewal with explicit macOS evidence retention.

Retain the inspected macOS strict receipt at actual `b77d3885` under evidence reuse:
application/build/runtime inputs, readiness sequence, event and final endpoint are
unchanged. Added timestamps are diagnostic; previously included fixture preparation
made the passing filter bound conservative. This does not prove future timings
must improve or provide macOS evidence for the new diagnostic fields. Their native
consumer was renewed locally on macOS. Renew the expanded service diagnostic and
original strict Windows consumer; no past Windows failure is waived.


## Windows renderer timeline diagnosis

Run `39440696066`, attempt 1 at `cf9ff85c`, completed its separate 18-profile
service diagnostic, six native controls and all 32 unprofiled functional samples,
startups/memory/four normal quits/backend exits/cleanup. Strict interaction misses
remain: direct Table filter 408.4ms, Table assignment 364.4ms, Board grouping
356.7ms; grouped Table filter 325.6ms and Board assignment 400.4ms. For the first
Table filters, observation began at 8.5/27.4ms but initial readiness took
284.8/348.6ms. For failed assignment/grouping, observation began at 312.6–338.7ms
and initial readiness then took 13.1–30.4ms. Thus a single delay explanation does
not fit all cases. Final stabilization remains about 30ms.

The independent Windows public-service diagnostic measured filter saves
3.0–15.1ms, projected filtered reads 22.4–25.6ms, grouping saves about 5ms and
assignments 55.8–69.6ms. Grouped full list/refresh were 1,586.9/2,083.4ms. It
verified filtered IDs and saved group membership, closed and cleaned up. These
separate Node timings do not include packaged IPC, concurrent backend queues or
renderer work, so they do not establish a unique cause for the UI misses.

The next opt-in renderer diagnostic retains existing CPU profiles and adds CDP
`devtools.timeline`/V8/user-timing streams around the same first Table filter,
Board widening and grouping/assignment spans. Fixed event/first-paint/final-paint
marks align native layout/paint, JS/GC and idle spans with the measured interval.
Only profiled runs create these marks/traces; the original strict branch remains
unprofiled. Stream completion is bounded, data loss rejects, handles/sessions close
and primary errors are preserved. No app/build input or strict endpoint changes.
Local diagnostic completed all 32 cases, eight CPU profiles/eight parseable
nonempty timelines with the expected event/ready markers, four normal quits and
cleanup. Six native controls and static checks passed. This is diagnostic evidence
only; the remaining Windows strict original still needs passing acceptance.

Collector review repair bounds both `Tracing.end` and its completion event in one
handled race. Local fault probes covered no completion, completion with stalled
command, command rejection, data loss and success; each detached and removed its
listener, stream cases closed their handle, and primary errors were preserved.
Both review axes have no remaining findings. Typecheck/lint/docs (174 files) and
whitespace checks passed after the repair.
