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


## CI run 40090391119/1

Owner authorized push/Actions in the continuation conversation. Published
`81a3381d5d533aed6dd3f3eef96ed55d9f7e77d9`; [original run](https://github.com/kornouhovas/workspace/actions/runs/40090391119).
macOS latest passed the complete3534-test inventory:3507 passed,0 failed/cancelled,
27 existing skips. Production dev and packaged Sources both passed all eight
capture states, logical IDs/native denial, normal shutdown and asserted cleanup.
Inspected report SHA/run/attempt, packagehash and narrow RU/light screenshot.
Runner kernel25.6.0; release app.asar SHA256:
`09b75935cac00aabf9762ef5a2b856d590f769c33efe39d6512eab1395e64c96`.
This clean-host success does not change the failed local macOS27 receipts.

Both Windows latest and Windows2022 main batches completed3553 tests:3506
passed,33 failed,0 cancelled,14 existing skips. Two preceding isolated batches
added65 passing tests, so each full Windows command totalled3618 tests/3571 passed. Failures match in five files. Seven native/binding/
upgrade controls expose8.3 temp paths from legacy `realpathSync`; fixtures now
prepare their canonical paths through `realpathSync.native`, matching production.
Old-row preservation and strict native rejection assertions remain unchanged.
Twenty-six Windows rename diagnostic failures stop at setup with coarse unknown
error codes; their exact cause remains under diagnosis. A bounded temporary setup
trace and focused original-five-file route are prepared. Windows dev/package
steps were unreached, not passed. Local affected-family control:110 tests,
107 passed/3 existing platform skips; route controls68/68.

Application/migrations/native/build/dependency/package inputs are unchanged by
this fixture/diagnostic-route repair. Retain passing original macOS and unrelated
Windows cases at their actual81a3381d provenance under CI evidence reuse. Renew
failed Windows families and every missing dev/package journey before acceptance.


Focused run40092057085/1 atf1ca8c9d confirmed the seven native-canonical fixture
repairs on both Windows hosts:83 passed,26 failed,1 existing skip. Run40092344125/1
atb462d986 added the actual long-Unicode native evidence control. Both hosts
returned `disconnected` for an existing descendant, while Node's canonical lstat
succeeded; totals83 passed/27 failed/1 skip in111 tests. Finite command traces
identified `workspace.applyDiscovery` / `invalid_input` for the diagnostic setup.
The remaining diagnostic scenarios did not reach their external rename yet.

The private evidence adapter now converts only the Windows native syscall operand
with Node's `toNamespacedPath`. Canonical locators, before/after stat/realpath
checks, durable tuples, containment, reparse rejection and storage are unchanged.
A long-junction negative control accompanies the regression. This removes reliance
on host long-path policy for raw Win32 calls; [Microsoft's path documentation](https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation)
describes the extended namespace. Actual Windows green evidence remains required;
no individual failing Win32 API is asserted from a coarse failure code.

This is an application adapter change, so successful focused Windows evidence
must precede renewed full acceptance on the repaired candidate. Temporary setup
traces remain diagnostic and must be removed before that full candidate.


## Confirmed Windows repair and renewed full candidate

[Focused run40092827817/1](https://github.com/kornouhovas/workspace/actions/runs/40092827817)
at`dfa6b62c34ae092eeb6a18685a801d19fa79fc53` passed on both Windows latest and
Windows2022:111 tests,110 passed,0 failed/cancelled,1 existing platform skip each.
Inspected both original logs: sufficient evidence for long Unicode descendants,
long-link rejection and every original rename diagnostic invariant passed. This
red/green evidence confirms the missing native operand namespace, without claiming
an unobserved individual Win32 syscall error. No rejection, deadline or retained
journal/metadata/tree assertion was relaxed.

Temporary DEBUG-71 command/setup traces and their workflow environment selection
are removed from the final candidate. The original diagnostic script's source is
restored byte-for-byte to81a3381d. Its cases and finite failure protocol remain.
A renewed complete three-host source-access route is required for this application
adapter repair, including previously unreached Windows production dev and packaged
Sources. Earlier receipts retain their original SHAs. Acceptance stays open until
that result and all required artifacts are inspected.


## Sharing-policy review before acceptance

[Run40093275559/1](https://github.com/kornouhovas/workspace/actions/runs/40093275559)
at2bc9a52f passed all three hosts and production dev/package Sources, with normal
exit/cleanup. Inspected complete log batches: macOS3536 tests/3509 passed/27 existing
skips; each Windows host3620 tests/3606 passed/14 existing skips, including isolated
51+14 batches before the3555-test main batch. All failures/cancellations were zero.
Reports pin SHA/run/attempt/kernel and actual package hashes. Earlier Windows
checkpoint counts described only main batches; the isolated65 passes must also
be included when reporting full-command totals.

Acceptance nevertheless remains open: further call-path review found that new
folder evidence still called Windows `realpathSync.native` on descendants, an API
exposure deliberately avoided by discovery. The [pinned Node/libuv source](https://raw.githubusercontent.com/nodejs/node/v22.21.1/deps/uv/src/win/fs.c)
and the retained Windows differential in [issue17 evidence](issue-17-create-reveal.md)
document native child opens conflicting with parent rename. This is a concrete
sharing-policy regression, not claimed as a cause of any current CI failure.
Green finite runs do not establish absence of that temporary handle exposure.

The evidence adapter now uses the same non-exclusive Windows route resolver as
discovery before/after the native observation. Source/scanner native ROOT
canonicalization, exact resolved-route equality, before/after lstat, namespaced
native operands, reparse and sufficient-volume checks remain. A portable policy
control went red with1 unwanted native child open, then green after the repair.
Actual-host native evidence/call counters and paired link/identity substitution
during resolution supplement scanner root/containment controls. Local20/20 targeted
and stable130-test affected renewal127 passed/3 existing skips. This is not actual
Windows acceptance for the new change.

Independent Spec review found no remaining root/link/alias defect in the repair.
One reviewer attempt overlapped an artifact-producing build and returned provider
unavailable failures; that attempt is invalid build-overlap evidence, not a native
provider flake or acceptance. Stable post-build renewal is recorded separately.
Focused Windows renewal now includes discovery-canonicalization alongside the
original five files. After it passes and artifacts are inspected, renew the complete
trace-free candidate again before integration. No old receipt is relabelled as
execution of this sharing-policy repair.
