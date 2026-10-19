# Issue 41: Representative-scale responsiveness

GitHub #41 owns requirements and execution checkpoints. Baseline: `d925f8b7`.
Executor: Matt Pocock implement. The owner approved issue-scoped push, checkpoints
and CI in the currently public repository. All six blocking issues are closed.

## Approved targets and measurement

Each of two disposable sources contains 1,000 projects: direct and grouped (10
categories). Each source has 20 ordinary properties (four of each supported type),
10 views (five Table/five Board), deterministic populated and empty values and
overlapping MultiSelect memberships. Project contents include a preservation marker.
Use local temporary disk and record OS, CPU, RAM, architecture and exact source SHA.

Owner-approved limits: saved-view startup <=5,000 ms, full source scan <=5,000 ms,
filter/group/edit interaction <=300 ms, total app-process resident memory <=1 GB (1,000,000,000 bytes).
Report raw samples and worst observed sample; do not describe hosted Windows Server
as Windows 11 or infer storage medium from a path. Measure packaged production
backend/IPC/React; fixture setup is excluded from interaction timing. Startup ends
only when the saved view's expected rows/cards are usable. Interaction includes
command and observable committed projection. Record actual OS/hardware and disk
limitations; performance evidence is bounded to those environments.

## Scenarios and seams

Use the issue's specified public typed Workspace service with real temporary
SQLite/filesystem fixtures and packaged Electron UI/IPC. Apply TDD at those public
seams for demonstrated behavior repairs; no private-method timing assertions.

| Scenario | Evidence |
| --- | --- |
| Deterministic direct/grouped scale and all property types | Public service setup; exact count/value/view assertions |
| Startup/reopen, scan, Table/Board filter/group/edit | Packaged runtime timings, exact membership/order assertions |
| Filtered group assignment | Existing reviewed command and UI route; destination membership, other values and logical ID retained |
| External rename and refresh | Disposable filesystem rename; same project ID, values and accepted edits retained |
| Loading/error/retry and edits during refresh | Relevant UI regressions and actual packaged states in EN/RU, keyboard and narrow/wide layouts |
| Memory | Electron process metrics summed across main/renderer/GPU/backend processes, raw units recorded |
| Before/after | Same fixture/harness on baseline and repaired candidate, raw report provenance |
| Regression and delivery | Focused affected files, lint/typecheck, final full local suite, two-axis review, CI and integration |

Optimize only measured bottlenecks. Preserve exact filter/group memberships,
manual ordering, source/workspace ownership, filesystem safety and renderer
isolation. No new storage architecture, release, signing or download publication.
GitHub checkpoint owns current platform/integration acceptance; this plan is not
an assertion that performance targets have passed.

## Windows scan repair after measured CI failures

Run `39284967766` measured complete grouped scans at 1.46–1.51 seconds; its
five-second native observer pass spent about 1.1 seconds in `lstat`/`realpath`.
Ordinary displayed-view reads took 28–36 ms. The original strict packaged run
still showed 1.5-second interaction stalls and a 10-second refresh. Preserve
those negatives; do not relax the polling interval, targets or native checks.

First, add an explicit observed-project UI read. It reuses the last fully
validated scan only while canonical root, mode, discovery revision, exclusions,
archive policy and applied identity still match. Project/category metadata is
projected afresh from SQLite; default service reads and filesystem commands
remain fresh. Missing/stale evidence falls back to a complete scan. Verify this
at the public typed service and built IPC with real folders/SQLite, including
external rename, explicit refresh, stale config, ownership and reopen.

Then move background filesystem scanning off the backend command thread while
retaining the same complete scanner. SQLite stays solely in the owning service;
scan results cannot authorize filesystem mutations. A source/config/version
change or closed lifetime must discard an in-flight result. Reconciliation
retains its fresh transactional recheck before locator writes. Shutdown must
confirm scanning has stopped before releasing owned resources; no deadline or
cleanup waiver. Startup still reconciles configured sources before readiness.
Renew source-observer concurrency/lifecycle, identity/reconciliation and actual
Windows performance evidence before full acceptance.

## Owner stop and integration direction

The owner closed #41 as `not_planned` before performance acceptance, then
explicitly requested integrating the preserved work into `new-workspace`.
This delivery does not certify the numerical targets or reopen performance
implementation. The closed issue records the delivered SHA, actual local
verification and unresolved packaged/platform performance evidence. Original
negative measurements are retained in the verification report/checkpoints.
