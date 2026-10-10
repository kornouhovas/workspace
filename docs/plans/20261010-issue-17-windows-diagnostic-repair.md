# Issue 17: Targeted Windows Diagnostics and Evidence-Driven Repair

## Overview

Deliver a small committed Windows diagnostic stage first. Obtain coordinator-supplied exact-SHA Windows results before dependent repairs. Resolve established selection, external category rename and controlled-fixture defects without replacing completed implementation or weakening acceptance.

## Context

- Authority: `work/ralphex/issue-17/windows-repair-task.md`, `task.md` and latest `coordinator-findings.md`.
- Tracking: GitHub #17 / Beads `workspace-31i.10`; coordinator owns both.
- Starting HEAD: `df949ae36c54c70ad83e42924d1eadeef4fcf2ff`.
- Fixed implementation/review base for every phase and resume: `4ac402620dd8139bdef9ff03625aae64bf60e132`.
- Preserve completed plans, implementation and historical evidence with their original revisions.
- Latest evidence: CI 38056817534 macOS matrix succeeds; Windows full runtimes succeed, direct DEV product selection remains negative, isolated zero-child experiment observes selection at 3360ms, and controlled COM fixture times out. Earlier CI 38054955248 proves packaged external category rename EPERM. Neither native intermittency nor EPERM cause is established.
- Existing boundaries: `scripts/file-manager-evidence.mjs`, `scripts/windows-native-selection.*`, `scripts/smoke-project-creation.mjs`, `src/service/source-observer.ts`, `discovery.ts`, `workspaces.ts` and `src/desktop/project-reveal.ts`.
- Dependencies: committed repository dependencies, Node 22.21.1, Electron and system Windows PowerShell; no new packages or vendor tools.
- Accepted plan destination: `docs/plans/20261010-issue-17-windows-diagnostic-repair.md`.

## Development Approach

- **Testing approach**: Regular, with controlled regressions reproducing established defects before repair.
- Every task adds or updates meaningful tests; applicable tests must pass before the next task. Windows skips remain unverified.
- Every Node/npm/npx/tsx invocation explicitly prepends `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin` to PATH. CI also selects Node 22.21.1.
- Complete and commit verified milestones using explicit task paths. English files/commits; Russian handoffs.
- Preserve backend authorization, containment, identity and lifetime guards, one native dispatch, strict exact selection, existing ten-second observation/normal-quit deadlines, restart and live observation.
- No unchanged native retry, forced selection, speculative production API replacement, swallowed EPERM, assertion weakening, coverage tooling, global changes or unrelated cleanup.

## Implementation Steps

### Task 1: Add independent owned-window selection evidence

**Files:**
- Modify: `scripts/file-manager-evidence.mjs`, `scripts/smoke-project-creation.mjs`, `tests/file-manager-evidence.test.mjs`.
- Create: `scripts/windows-selection-diagnostics.ps1` and `tests/windows-selection-diagnostics.test.mjs`.

- [x] Add bounded read-only UI Automation evidence for the exact owned Explorer parent and target immediately after one actual product Reveal. Verify the owned window and exact target before inspecting selection; never enumerate or retain unrelated UI content.
- [x] Keep COM observation, independent UI selection, dispatch acknowledgment and observation-unavailable results separate. Supplement existing strict acceptance without converting unavailable evidence into success.
- [x] Run observation within the existing ten-second budget; bound subprocesses, output and cleanup. No prewarming, second dispatch or input manipulation.
- [x] Reproduce controlled COM timeout handling and make its fixture reliable, for example by batching controlled cases in one bounded PowerShell process. Preserve actual observer-script checks and timeout/protocol classification; leave product deadlines unchanged.
- [x] Add tests for selected/unselected/disagreeing/unavailable evidence, wrong-window rejection, Unicode transport, privacy, timeout and owned cleanup. Run focused suites and lint; commit verified changes.

Task 1 local verification (macOS, Node 22.21.1): the focused `file-manager-evidence`, `windows-selection-diagnostics` and `windows-native-selection` suites reported 56 tests, 50 passed, 6 Windows-only skips, 0 failures. `npm run lint`, `npm run typecheck`, `npm run check:docs`, working diff and fixed-base `git diff --check` passed. The batched controlled COM fixture keeps a separate 30-second test-process bound; product subprocess/observation limits remain five/ten seconds. COM, UIA, agreement/unavailability and interrupted partial COM evidence are retained separately. Cleanup revalidates the exact disposable parent/target and rejects shared tabbed windows before closing.

### Task 2: Add a bounded real-service category rename diagnostic

**Files:**
- Create: `scripts/windows-rename-diagnostics.mjs`, `scripts/windows-rename-diagnostics.ps1` and `tests/windows-rename-diagnostics.test.mjs`.
- Reuse: `src/service/settings.ts`, `source-observer.ts`, `discovery.ts` and existing SQLite fixture patterns.

- [x] Compare idle, active production observation/polling and concurrent scan/rename conditions using disposable grouped sources and real SQLite. Use a separate process for external rename so synchronous service scans can overlap it.
- [x] Set finite operation counts and wall-clock limits. Each rename uses a distinct owned fixture; record every result/code without retrying a failed operation.
- [x] Include an explicitly injected no-delete-sharing handle conflict to prove detection; distinguish injected failures from real reproductions. Record finite owned watcher/process/scan state without claiming complete OS handle attribution.
- [x] Verify no overwrite, sentinel bytes, logical IDs, exact Text/history, reconciliation and observer cleanup. Escalate to actual Electron backend runtime only if needed to match the failing environment.
- [x] Add tests for scenario orchestration, injected conflict detection, negative-result retention, protocol sanitization, bounds and cleanup. Run focused service/diagnostic checks and lint; commit.

Task 2 local verification (macOS, Node 22.21.1): the diagnostic, source-observer, grouped-discovery-service, discovery-mode-service and settings-service suites reported 115 tests, 114 passed, one Windows-only skip, zero failures. The service test library build, lint, typecheck, check:docs and working/fixed-base diff checks passed. Portable tests use a genuine external Node rename process and real production service/SQLite; controlled negative responses are simulations. The actual PowerShell/Win32 bridge was not executed locally.

The diagnostic runs two distinct fixtures per condition: idle (service closed), active native observation including a five-second health callback, concurrent explicit production scans, injected no-delete-sharing conflict and occupied-destination control. Each worker has a 25-second budget, the PowerShell bridge ten seconds, termination confirmation one second, and concurrent scanning at most 128 scans/six seconds. A readiness signal puts compilation before the concurrent scan comparison; recorded wall-clock scan/rename intervals establish only timing evidence, not complete OS handle attribution. There is one nonreplacing MoveFileExW call per fixture and no failed-operation retry. Unknown worker/descendant termination or invalid worker protocol preserves the fixture and an unverified cleanup result.

After the service test library build, run the diagnostic with the required Node 22.21.1 PATH selection, `WORKSPACE_RENAME_EVIDENCE_DIR` pointing to a fresh ignored evidence directory and entry `node --import tsx scripts/windows-rename-diagnostics.mjs`. The bounded `rename-observations.json` records actual checkout SHA/runtime, per-operation native code, resource counters at rename/after close, timing intervals, invariant results and cleanup. `status: completed` means the probes completed and their safety checks held; it does not require zero real rename failures. Inspect `realRenameFailures` and every operation separately. Neither a clean run nor an injected failure diagnoses historical EPERM. Electron backend escalation remains conditional on coordinator Windows evidence.

### Task 3: Deliver isolated fast Windows CI and coordinator checkpoint

**Files:**
- Modify: `.github/workflows/desktop-ci.yml`, `scripts/smoke-project-creation.mjs` and diagnostic tests.
- Modify: `docs/verification/issue-17-create-reveal.md`.

- [x] Wire independent fresh-runner Windows selection and rename diagnostics after focused scripts/tests work. Use only necessary install/build steps; do not depend on full npm test or prior Explorer scenarios.
- [x] Invoke one narrowly selected existing product creation/Reveal scenario. Keep the existing zero-child experiment isolated; any justified comparison uses a separate fresh job/fixture.
- [x] Always preserve strict bounded artifacts containing actual checkout SHA, OS/runtime, scenario, invocation count, observation source, result/error and cleanup. Retain negative and unavailable outcomes; keep the full matrix authoritative.
- [x] Extend artifact/orchestration tests, inspect workflow isolation and upload behavior, run focused tests, lint, check:docs and working/fixed-base diff checks.
- [x] Commit the diagnostic milestone and provide the coordinator its SHA, commands, artifact interpretation and actual local checks before another whole-diff review cycle.

Task 3 local verification (macOS arm64, Node 22.21.1): production build and the six focused diagnostic/lifecycle suites passed (104 tests, 97 passed, seven Windows-only skips, zero failures). Lint, typecheck, smoke-script syntax, check:docs and working/fixed-base diff checks passed. The YAML orchestration test verifies independent fresh-runner jobs, one direct DEV/after_evidence product scenario, no prior Explorer scenario, minimal build commands, unsuppressed failures and mandatory always-upload behavior. Targeted product result.json contains only bounded allowlisted metadata/stages, separate COM/UIA/count evidence and cleanup; the rename artifact explicitly distinguishes flags=0 from historical Node flags=1. Commands and interpretation are recorded in docs/verification/issue-17-create-reveal.md. No real Windows, native graphical or packaging verification was performed locally.

At the Task 3 handoff, the external checkpoint was unmet. The coordinator subsequently supplied exact 7031665 fast Windows artifacts from CI 38062987376. The receipt gate is satisfied; product cause and acceptance are not. The results require diagnostic correctness/fidelity work before dependent repairs. Skipped fixtures and local simulations remain unverified. Latest coordinator-reported a85ce35 macOS grouped DEV UI-acknowledgment failure remains separate and unresolved.

## Coordinator checkpoint before Task 4

Satisfied by coordinator-supplied CI 38062987376, exact code 7031665fbe5e10ffe1a6063de4bf8a714052c82c, Windows 10.0.26100 x64, Node 22.21.1, Electron 44.7.0 / embedded Node 24.21.0. One product dispatch/exact owned target and localized acknowledgment passed; COM repeatedly found parent/target but not selection, with zero errors. Independent UIA first timed out, then returned ambiguous_target with windowVerified=true. The controlled selected-reader test threw an unidentified exception. All elapsedMs values were null. Scenario normal shutdown/restart were unreached; failure/fixture cleanup passed, and one window-close request completed without verified closure.

All six real-service non-control renames passed, including IDs/Text/history/reconciliation/restart/cleanup. Each concurrent fixture recorded only two scans and broad interval overlap. Both injected metadata-handle controls failed to block rename; occupied-destination controls returned code 183 without overwrite. realRenameFailures=0 does not establish historical Node EPERM sensitivity or cause. The flags=0 bridge differs from historical Node flags=1.

Coordinator-authorized adjustment: split the original Task 4 into a locally verifiable diagnostic correction milestone and a subsequent evidence-dependent repair task. Original production-cause and final acceptance requirements are retained below; none is completed by a diagnostic pass.

### Task 4: Correct diagnostic evidence and historical-operation fidelity

**Files:**
- Modify: scripts/windows-selection-diagnostics.ps1, scripts/file-manager-evidence.mjs, scripts/windows-product-diagnostics.mjs and their focused tests.
- Modify: scripts/windows-rename-diagnostics.mjs, scripts/windows-rename-diagnostics.ps1, connected bounded worker/tests and docs/verification/issue-17-create-reveal.md.

- [x] Map supplied exact-code findings and collect all five initial perspectives (quality, implementation, testing, simplification and documentation) against the fixed base before changes.
- [x] Expose bounded synthetic-only UIA exception/collection diagnostics and distinguish exact-owned-window view/item query outcomes using finite counts/allowlisted provider markers. Preserve unknown/ambiguous results and original selection assertions; defer unsupported targeting adaptations until actual provider evidence.
- [x] Preserve bounded finite fractional elapsed timings with a red-before/green-after regression; retain integer-only counts and unchanged observation deadlines.
- [x] Add exact external Node fs.promises.rename fidelity with the historical long Unicode fixture shape and a documented explicit-access sharing-control candidate. Keep occupied-destination nonreplacing control, negative results, ownership, IDs/Text/history, process bounds and cleanup. Actual Windows control validity remains a separate coordinator gate.
- [x] Run focused diagnostic/service suites, lint, typecheck, check:docs and working/fixed-base diff checks. Collect quality/implementation follow-up reviews until no critical/major actionable findings remain; commit the bounded diagnostic milestone and record actual checks/limitations.

Task 4 local verification (macOS arm64, Node 22.21.1): service test-library build; six focused diagnostic/lifecycle suites (114 tests, 106 passed, eight Windows-only skips, zero failures); four connected service suites (95 passed, zero failures/skips); repository lint, typecheck, check:docs and working/fixed-base whitespace checks passed. The timing regression failed before repair and passed afterward. All five initial perspectives preceded changes; the final quality/implementation pair found no remaining critical/major actionable issues after the unsigned PowerShell access-argument correction. No actual Windows, graphical product, package or full npm test/build verification is claimed. The synthetic UIA failure/provider query and stronger sharing controls still require the new coordinator checkpoint; this completed diagnostic milestone does not complete the product-cause or external acceptance requirements.

## New coordinator checkpoint before Task 5

The coordinator pushes the corrected diagnostic milestone and supplies exact-code Windows artifacts and complete controlled-test logs from the isolated fresh jobs. Stop before Task 5 until these arrive. In particular, inspect the synthetic reader's finite exception/collection diagnostics, exact owned provider counts/markers, exact Node operation codes and whether the stronger sharing controls actually block rename. A candidate control or a skipped Windows fixture is not a verified repair. If the faithful baseline remains negative, assess bounded distinct-fixture stress or Electron-backend escalation from those results; do not change production canonicalization/watchers or native dispatch speculatively.

The receipt gate above is satisfied by exact f753e5b8f440f9bd4a1fe8d715376f2859b24556, CI 38064260689 attempt 2, both isolated jobs and complete controlled logs. Selection still fails: COM exact parent/target are present but unselected; UIA finds no AutomationId ItemsView view but exactly one List/UIItemsView/other candidate. Synthetic tests fail at PropertyCondition.Value comparisons. All six real Node renames pass with only one scan per concurrent fixture. Category sharing controls now block with EBUSY, DELETE-shared contrasts pass, collisions return 183. This validates the category control, not historical EPERM causality.

Coordinator-authorized Task 5 adjustment: complete a bounded diagnostic correction/child-comparison milestone before another mandatory Windows checkpoint. The original product-cause Task 5 and final-verification Task 6 are retained as Tasks 6 and 7 below, with their requirements unchecked. No product acceptance is completed by this split.

### Task 5: Correct owned-provider diagnostics and sharpen child rename comparisons

**Files:**
- Modify: scripts/windows-selection-diagnostics.ps1 and tests/windows-selection-diagnostics.test.mjs.
- Modify: scripts/windows-rename-diagnostics.mjs, scripts/windows-rename-diagnostics.ps1, connected bounded workers/tests and docs/verification/issue-17-create-reveal.md.

- [x] Map exact f753 coordinator selection/rename artifacts and complete logs to confirmed defects and unresolved hypotheses. Collect all five initial perspectives against the fixed base before changes.
- [x] Correct the exact owned-HWND view query to List plus ClassName UIItemsView and synthetic PropertyCondition.Value assertions to documented ControlType.Id. Preserve strict COM acceptance, collection assertions, single view/item, privacy and unchanged dispatch/deadlines; extend controlled regressions using actual Windows red evidence.
- [x] Add bounded distinct-fixture category/child sharing comparisons and native/legacy/idle child realpath stress with one exact external Node rename per fixture. Retain every code, finite counts/timing, identical stress service state, invariant checks and verified process/observer cleanup; no speculative production repair.
- [x] Run focused diagnostic/service tests, lint, typecheck, check:docs and working/fixed-base diff checks. Collect quality/implementation follow-up reviews until no critical/major actionable findings remain; commit the diagnostic milestone and document actual local checks and external gates.

Task 5 local verification (macOS arm64, Node 22.21.1): service test-library build passed; six diagnostic/lifecycle suites reported 124 tests, 115 passed, nine Windows-only skips, zero failures. Four connected service suites reported 95 passed, no failures/skips. Lint, typecheck, check:docs and working/fixed-base diff checks passed. Two new orchestration regressions failed before implementation and passed afterward; exact f753 logs remain the Windows UIA red evidence. All five initial perspectives preceded changes, and the final quality/implementation pair found no remaining critical/major actionable issues. No new actual Windows, graphical/native, packaged artifact, full npm test or production build verification is claimed. The diagnostic milestone does not complete product causes or external acceptance; stop at the mandatory checkpoint below.

## Mandatory coordinator checkpoint before Task 6

Stop after Task 5. The coordinator supplies new exact-code Windows selection/rename artifacts and complete controlled logs. Verify the actual UIA fixture/query results, exact-owned item/pattern evidence, category/child control outcomes, native/legacy/idle iteration/error counts and rename timing/codes. Local macOS skips are unverified; broad stress intervals are not proof of a child handle at rename. Negative stress cannot close historical EPERM, and a diagnostic selection pass cannot close product acceptance. No production native dispatch, canonicalization or watcher replacement without supported causal red/green and safety regressions. Preserve macOS acknowledgment, normal-quit/restart and #44 gates separately.

### Task 6: Repair established product causes after the child/provider checkpoint

**Files:**
- Modify only evidence-implicated files among `src/desktop/project-reveal.ts`, `src/service/source-observer.ts`, `discovery.ts`, `workspaces.ts`, `scripts/file-manager-evidence.mjs` and connected diagnostic/runtime tests.

- [ ] Map corrected coordinator artifacts to confirmed findings and unresolved hypotheses. Obtain all five initial perspectives—quality, implementation, testing, simplification and documentation—before new product repairs, using gpt-6.1-sol high and the fixed base; batches 3+2 are permitted.
- [ ] Implement the smallest supported repair at the native, resource-ownership, filesystem or fixture boundary. Verify primary native documentation before any justified API adaptation. An occasional experimental pass alone authorizes no replacement.
- [ ] Add focused red-before/green-after regressions for each repair. Preserve one user-intent dispatch, useful errors, live observation and rename/reconciliation invariants.
- [ ] Run affected suites, then quality/implementation critical-major follow-up reviews until clean. Commit verified repairs. If evidence remains insufficient, retain the unresolved gate instead of speculative changes.

### Task 7: Verify repairs and update the evidence handoff

**Files:**
- Modify: affected regression tests and `docs/verification/issue-17-create-reveal.md`.
- Update applicable English development/architecture/ADR documentation only when the repair changes its contract.

- [ ] Extend tests for repaired behavior and artifact interpretation, including negative/unavailable results.
- [ ] Run npm test, lint, typecheck, build, check:docs and fixed-base diff checks with the required PATH prefix. Run affected graphical/runtime scenarios sequentially in fresh ignored evidence directories; use `CSC_IDENTITY_AUTO_DISCOVERY=false` for fresh local macOS artifacts.
- [ ] Document actual checks, skips, unresolved causes, diagnostic/repair SHAs and preserved historical evidence. Update README only for user-facing changes.
- [ ] Commit verified task files and provide a Russian handoff without marking external acceptance complete.

## Post-Completion: External Coordinator Gates

- Task 1 local execution limitation: the six Windows-only fixtures were not executed on the local macOS host. Subsequent exact 7031665 Windows evidence is recorded at the checkpoint above, including the failed controlled UIA reader and unavailable real provider results. Corrected-instrument Windows execution and exact-code product selection remain required. Local controlled protocol tests are not Windows acceptance; unsupported/ambiguous providers remain unavailable. No native or shutdown cause is established by this diagnostic implementation.

- Task 2 local execution limitation: the Windows-only test was skipped on macOS. Subsequent exact 7031665 Windows evidence records successful non-control/collision probes and failed injected controls, without historical EPERM sensitivity or attribution. Corrected exact-Node/explicit-access control execution remains a new coordinator gate. Inspect every negative/unavailable outcome and scan/rename timing before deciding whether bounded stress, actual Electron-backend reproduction or repair is warranted. No external acceptance was marked complete.

- Coordinator obtains exact-code macOS/Windows acceptance for repaired direct/grouped DEV and packaged selection, external category rename, recovery, normal quit and restart.
- Failed, skipped and unreached stages remain explicit. Historical Windows shutdown uncertainty and independent issue #44 are preserved.
- Coordinator owns trackers, push, CI interpretation and local integration. Executor performs no push, merge, release, signing, tags or publication.
- Stop within #17; do not start #18.
