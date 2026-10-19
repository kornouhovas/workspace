# Issue 41 verification

GitHub [#41](https://github.com/kornouhovas/workspace/issues/41) owns current
acceptance and integration. [The plan](../plans/issue-41-performance.md) records
owner-approved counts and targets. No performance acceptance is claimed yet.

## Measurement boundary

`npm run smoke:performance` prepares disposable real direct/grouped sources and
a SQLite database through public Workspace commands. Each source has 1,000
projects, 20 ordinary properties (25% filled, all five types), 10 views, empty
values and overlapping MultiSelect memberships. The packaged distribution is
copied outside the checkout, preserving relative framework links. Its own
backend, preload, renderer and database execute the measured operations. The
installer itself remains covered by issues 39/40.

The report records Git source SHA, tracked source-diff digest for local dirty
experiments, harness digest, application ASAR digest, actual kernel/architecture,
CPU/RAM, CI run/attempt, raw samples, process memory, normal shutdown and cleanup.
Only exact committed candidates can supply final CI provenance. Untracked local
source is not covered by the tracked-diff digest; ASAR hashes identify those
exploratory binaries.

Startup includes Electron launch through usable saved-view projection. UI timing
starts at the renderer's actual keyboard/change/drop event and ends after the
committed projection plus two animation frames. Locator preparation is outside
that clock. Membership/order and durable values are independently checked through
the typed service. No forced GC or reduced property count is used. Memory sums
Electron's process working sets (including backend, renderer and GPU); shared
pages may be counted more than once. Raw process peaks are retained separately.
These are observed working-set samples, not a claim of continuous peak sampling.
Electron documents its units in [MemoryInfo](https://www.electronjs.org/docs/latest/api/structures/memory-info).

## Retained local exploration

Local host: Apple M1 Pro, 16 GiB RAM, arm64, Darwin 27.0.0. `diskutil info
/System/Volumes/Data` reports Solid State: Yes. Each report still identifies its
own observed environment; hosted Windows results must name their actual OS.

- Immutable baseline `d925f8b7`: direct startup 12.5–12.8 s, filters 2.35–2.98 s,
  cell saves 5.7–6.3 s, refresh 10.4–10.6 s. An initial bundle-copy error and an
  incorrect grouped startup order expectation were harness failures, not product
  performance measurements. A later baseline normal-close timeout remains failed;
  forced cleanup does not establish normal quit.
- Indexed-row/value experiment: direct refresh 2.93 s; other targets remained
  missed. Concurrent focused-test load affected its startup sample, so it is not
  an acceptance comparison.
- Lazy editor experiment: both sources and normal shutdown completed, but startup,
  several interactions and memory still missed targets. A renderer CPU profile
  was collected during part of this run; those affected samples are diagnostic.
- First viewport experiment: both sources and normal shutdown completed. Direct
  filter samples were 154–167 ms; startup remained 10.22/7.75 s (direct/grouped),
  group dragging 573–1,161 ms and sampled total memory reached 1.50 GB. Source
  busy state was incorrectly materializing offscreen fields. A focused regression
  failed on that behavior, then passed after busy state only retained already
  loaded fields.
- Displayed-source read experiment: filters 35–68 ms, edits 58–76 ms and direct
  drags 205–219 ms. Grouped drags still took 805–818 ms. Startup was 6.77 s on
  first launch and 2.31–2.48 s on subsequent launches. All four normal shutdowns,
  persistence and owned cleanup passed in that run; previous shutdown timeouts
  remain retained and their native cause is unproven. Conservative summed
  process peak upper bound reached 935 MB. The RU refresh clock in these older
  experiments did not wait for the outer source-refresh busy state; those scan
  samples are diagnostic only. The final harness waits for every busy region.

The implementation's explicit read projection is described in
[Architecture](../architecture.md#implemented-view-search-and-typed-filters).
It is checked against stale revisions, incomplete/duplicate/foreign membership,
current filter/value reads and restart. Name/category commands retain fresh disk
authorization; no public assignment payload accepts a projection hint. Candidate
identity indexes retain every ambiguous match and the original alias/reservation
checks. The latest focused service run passed 356 cases; the EN/RU Table/Board
filter and viewport run passed 11 cases. Typecheck, lint and documentation links
also passed before review. Final candidate evidence remains pending.

## Independent review

Two read-only Matt Pocock review agents examined `d925f8b7...46e3dfe4` separately.
Standards reported no confirmed hard violation and two advisory duplication
findings: lazy editor lifecycle state and source/project validation. The stored
route's discovery-revision validity check was aligned with the original path;
the distinct editor implementations remain explicit to preserve their existing
draft/save semantics. Spec reported one P2: identity skeletons alone did not prove
visible fields usable. The harness now requires actual controls on every visible
row/card, all outer/inner busy states clear, and rechecks after layout before the
final paint. The same reviewer inspected that repair and confirmed it addressed
the finding. Review did not substitute for runtime or platform acceptance.

The completed reviewed candidate passed `npm run test:all` on Node 22.21.1/macOS:
3,100 passed, zero failed, 26 explicit platform skips (3,126 total). The fresh
build, typecheck, lint and 22 focused filter/viewport/IPC regressions also passed.
Platform-specific skips require their real-platform CI routes. Final packaged
comparison, exact-SHA CI and integration remain governed by the GitHub checkpoint.

The retained reports/screens are under ignored `work/issue-41-performance/` in
the task checkout. Earlier failures are not replaced by later successes. Final
before/after comparison requires the same final harness on baseline and candidate
on each measured platform. Required local full-suite, review, platform CI and
integration evidence remain pending in the GitHub checkpoint.

## Follow-up scan repair verification

The original Windows failures remain retained. Diagnostic run `39284967766`
measured complete grouped scans at 1.46–1.51 seconds and confirmed native
filesystem work in the periodic observer. Its original strict performance step
still failed. Runtime-driver repair run `39287168431` at `5e41765b` passed the
original `smoke:runtime -- dev` command on macOS, Windows latest and Windows
2022; its observation artifacts include rename/category/recovery/shutdown
proofs. These results precede the worker repair and do not accept that repair.

The follow-up implementation adds explicit observed UI reads and asynchronous
filesystem-only observation. Focused real SQLite/filesystem, lifecycle, stale
result, built IPC, build and artifact checks passed 93 tests before adding four
worker-package rejection cases. Typecheck/build/lint passed. Initial focused
failures exposed a host path fixture/canonicalization mismatch; those were
corrected without weakening scanner or artifact assertions. Fresh review, full
suite, packaged execution and exact-SHA platform performance remain required.

## Owner-directed integration of stopped work

The owner stopped implementation and closed #41 as `not_planned`, then explicitly
requested integration into `new-workspace`. This integration preserves the
current implementation; it does not assert that #41's performance criteria
passed. Earlier negative measurements remain valid evidence. No renewed
performance campaign or platform CI acceptance is inferred from this request.

The first worker full-suite attempt was stopped after exposing fake-clock
transport/coordination assumptions and UI test subclasses overriding the existing
`listProjects` client seam. The final client keeps that seam with an explicit
optional observed-read argument. Clock-driven fixtures inject the unchanged
complete native scanner at the scheduling seam; native observation controls and
worker tests still exercise the production worker. All 573 affected transport,
coordination, category, rename and recovery UI tests passed. The final Standards
and Spec delta reviews reported no blocking finding. Exact integrated SHA and
remaining verification limits are recorded in the closed GitHub issue.

Final integration verification on Node 22.21.1/macOS passed the fresh build,
typecheck, lint, documentation links and full `test:all`: **3,113 passed, zero
failed, 26 platform skips (3,139 total)**. The additional 226 focused creation,
App and CI-route fixture tests passed after reconciling asynchronous scheduling
and the existing `viewport-runtime` route. Final delta review found no blocking
Standards or Spec finding.

The preceding full attempt had 3,102 passes, 11 failures and 26 skips. Nine
failures were fixture/CI-contract mismatches repaired above; two were 10-second
native Electron fixture shutdown timeouts. The final run passed those controls
with unchanged deadlines, but does not diagnose or claim a native shutdown
repair. The earlier failure log remains `/tmp/issue41-integration-full.log` and
the final report is `/tmp/issue41-integration-full-final.log` in the execution
host. New packaged worker execution and exact-SHA platform/performance acceptance
were not completed before this owner-directed integration. Earlier platform
successes are attributed only to their recorded preceding SHAs.
