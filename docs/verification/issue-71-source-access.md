# Issue 71: Implementation candidate, acceptance still open

Issue: https://github.com/kornouhovas/workspace/issues/71.
Branch: `codex/issue-71-source-access`; integration baseline `649b2347`.
No owner database or project folders were repaired. This report records observed
local evidence, not Windows, integration or release acceptance.

## Implemented boundaries

- Fixed private N-API observations: APFS UUID/persistent ID/creation and NTFS
  GUID/handle serial/full 128-bit ID/creation, finite failures, fresh mount checks.
  Zero/partial mount attributes fail closed. NTFS ownership vetoes normalize GUID
  casing; full continuity remains an exact sufficient-evidence comparison.
- Installation anchor outside SQLite/backups; additive migration 0024 retains
  legacy triples, UUIDs, properties, views, sessions and immutable journal bytes.
- Durable foreground/background continuity, accepted observed-display snapshots
  with independently current metadata, and transactional needed-category evidence.
- Explicit root/category/project review. Existing unconfigured legacy roots also
  require review; only explicit new-source creation enrolls its new root. Root-only
  approval never enrolls descendants or reactivates excluded legacy records.
- Binding tokens include fresh scan/evidence, configuration, ownership, generation,
  siblings and reservations. Cancel revokes authority; before/in/after transaction
  checks roll back source/association changes. Verified mappings cannot bypass
  deferred relocation. Global root aliases reject creation, binding and restore.
- Original legacy history and durable aliases remain vetoes. Dormant mode-role
  exceptions cannot infer continuity from synthesized aliases or override known
  creation contradictions. Scope renewal validates the old saved relationship
  separately from current physical evidence, preserving explicit lost-anchor review.
- Typed IPC/preload and EN/RU Sources/recovery UI. Unconverted filesystem/native
  effects are denied in the backend until #72; original immutable terminal retries
  remain receipts. Creation/Reveal explain safety denial. Definite initial denial
  preserves the draft without inventing uncertainty; older uncertain operations
  retain their status and reservations. Metadata remains usable.
- Backup validation checks versions, parent/root volume consistency and global
  ownership. Old envelopes remain readable; local authority is never restored.

## Requirement-based retention

The [plan's scenario inventory](../plans/issue-71-source-access.md#inherited-scenario-decisions-during-continuation)
records retain/adapt/replace decisions. Historical successful commands remain
covered through explicitly named real production command-engine factories, SQLite,
triggers, crash workers and native adapters. Their separate `.application` remains
gated; a dedicated separation check rejects implicit evidence enrollment.

Historical SQL fixtures now seed their actual old schema and compare every old
row with exact additive NULL-evidence/generation-zero defaults. Archived metadata
arrangement returns to current application reads. Current-App old effect journeys
are replaced by real EN/RU no-effect, metadata/draft/reopen assertions under ADR0009
and #72; terminal receipts and uncertain reservations remain covered.

Real Electron rename/category-move engine reports identify their test boundary.
The private test entry is excluded from packages; artifact inspection rejects any
ASAR containing it. It cannot select a production runtime/provider via environment
or IPC. Explicit invalidation in independent engine fixtures does not claim to
verify current application observer wiring. Actual source-observer/binding tests
retain that boundary. No failing scenario was newly skipped.

## Observed local evidence

Host: macOS arm64, Node 22.21.1.

| Check | Observed result and provenance |
| --- | --- |
| Renewed `npm run test:migrations` | 719 tests: 718 passed, zero failed, one existing skip; `/tmp/issue71-migrations-final.log`. Later dormant-role repair renews its affected family separately. |
| Final source association/observed/evidence/runtime/CI-route set | 79/79, including paired mixed legacy/durable and lost-scope controls; `/tmp/issue71-safety-final-green.log`. Subsequent journal-preservation assertion renewal: 26/26 runtime cases, `/tmp/issue71-runtime-final.log`. |
| Actual Electron retained engine families | 74/74; `/tmp/issue71-electron-engine-families.log`. These prove engine safety, not current application availability. |
| Creation UI | 110/110; `/tmp/issue71-creation-ui-renewed.log`. |
| Real-App EN/RU conflict review and capability denial | 2/2; `/tmp/issue71-current-app-gates.log`. |
| CI selector, supported-host inventory and failure propagation | 69/69; `/tmp/issue71-ci-route.log`. |
| Development Sources smoke | Passed eight EN/RU/light/dark/1024/1440 states, Cancel, explicit mapping, Apply, retained ID and blocked native dispatch; `/tmp/issue71-source-dev-final.log`. Normal exit and owned cleanup passed. |

Typecheck, lint, build, docs links (216 Markdown files) and diff checks have passing
focused receipts; their final renewals also passed after the scope and fixture repairs.
Narrow Russian/light and wide English/dark source-review captures were visually
inspected: authored paths/names preserved, wrapping without horizontal overflow,
controls reachable by scrolling. Local artifacts are under ignored
`work/issue-71-source-association/`.

## Review and remaining acceptance

Independent Standards/Spec reviews drove concrete ownership, raw-history,
transaction, scope, cancellation and migration repairs. The last Spec review
identified mixed NULL/durable dormant-role handling and lost-anchor availability;
paired matching/contradictory and matching/conflicting-scope controls passed.
Independent Spec follow-up passed all five relevant controls and found no remaining
defect in the repair. Standards follow-up required complete journal comparison
around denied recovery; `recoveryState` now checks it after each request, with
26/26 runtime cases passing. The exact late pre-settlement observer hook is
explicitly deferred to #72 rather than equated with binding-generation coverage.

Historical failures remain evidence, not acceptance: the initial migration run
had 361 passing/320 failing/one skipped; the initial full attempt had 2,351 passing,
1,089 failing, 33 cancelled and 27 skipped (3,500 tests). A later broad run (`/tmp/issue71-full-final.log`) began before final scope-review
completion and is diagnostic, not final acceptance. It found additional historical
category driver/IPC expectations and a missing TS loader in the crash-worker fork;
these are repaired and their focused consumers renewed. Its input-digest mismatch
coincided with editing digest-covered source during the run, so it cannot supply
immutable-candidate evidence. Existing strict digest checks remain intact.

The diagnostic run also reproduced native Electron shutdown failures and hung
unbounded native fixture closes. It was interrupted; recorded owned descendants
were stopped explicitly. No summary/pass claim is manufactured for that interrupted
run. Final full-suite acceptance still requires a clean CI host and unchanged
candidate; source changes during review never establish exact-candidate evidence.

One earlier Sources run completed UI checks but exceeded the unchanged ten-second
normal-shutdown deadline. Owned forced cleanup was confirmed; three isolated
repetitions and a later renewed run passed normal exit/cleanup. Cause remains
unproven; later passing results do not declare it fixed.

The registered `source-access` CI selection retains complete suites on macOS latest,
Windows latest and Windows 2022, production development Sources, package/resource
checks and packaged Sources with SHA/run/attempt/kernel and app.asar hash. Ordinary
CI defaults remain unchanged. No missing or unreached row establishes acceptance.
Windows native/runtime/package receipts, final full-candidate results, inspected
CI artifacts and conditional integration remain open. The issue stays open and
`new-workspace` integration is not yet ready. No `main` merge or release is authorized.


## Latest macOS package and shutdown diagnosis

The unchanged candidate was packaged with `npx electron-builder --dir` and passed
`npm run check:artifact -- release`, including exclusion of the engine-test entry.
Actual production packaged Sources completed all eight capture states, review,
Cancel, explicit Apply, logical ID preservation and native denial. The run then
**failed** its unchanged 10-second normal-shutdown deadline; owned forced cleanup
and fixture removal passed. It is not a packaged acceptance pass. Report/captures:
`work/issue-71-source-association-package/`; app.asar SHA-256:
`38a456e409d6152bf452a766ee0e5f997ded69f9c27e81cac37153854f247e8e`.
The packaged narrow RU/light capture was also inspected; text wraps and controls
remain scroll-reachable.

On this host (macOS 27.0, kernel 27.0.0), a minimal Electron BrowserWindow/quit
program **without Playwright or this application's backend** also failed to exit
within ten seconds after before-quit/will-quit/node-exit/quit. A Playwright fixture
control failed too. Separately disabling saved-state restoration with per-process
`-ApplePersistenceIgnoreState YES`, and removing the extra window-all-closed quit
listener, did not repair the control. These are falsified hypotheses, not fixes.
Debugger removal cannot alone explain the minimal non-Playwright failure. Native
sampling of an owned fixture and finite raw probe receipts are under `/tmp/issue71-*`
and ignored `work/issue-71-diagnose/`. No user defaults, installed Electron version,
production quit lifecycle or verification deadline was changed.

An [upstream Electron quit report](https://github.com/electron/electron/issues/52582)
describes a related post-teardown hang, but this candidate's exact cause remains
unproven. Passing fresh-host platform receipts are still required. No retry-until-
green or forced termination is counted as normal shutdown acceptance.
