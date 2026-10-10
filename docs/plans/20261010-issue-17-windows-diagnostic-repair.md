# Issue 17: Targeted Windows Diagnostics and Evidence-Driven Repair

## Overview

Deliver a small committed Windows diagnostic stage first. Obtain coordinator-supplied exact-SHA Windows results before dependent repairs. Resolve established selection, external category rename and controlled-fixture defects without replacing completed implementation or weakening acceptance.

## Context

- Authority: `work/ralphex/issue-17/windows-repair-task.md`, `task.md` and latest `coordinator-findings.md`.
- Tracking: GitHub #17 / Beads `workspace-31i.10`; coordinator owns both.
- Starting HEAD: `df949ae36c54c70ad83e42924d1eadeef4fcf2ff`.
- Fixed implementation/review base for every phase and resume: `4ac402620dd8139bdef9ff03625aae64bf60e132`.
- Preserve completed plans, implementation and historical evidence with their original revisions.
- Initial evidence when this plan was created: CI 38056817534 macOS matrix succeeds; Windows full runtimes succeed, direct DEV product selection remains negative, isolated zero-child experiment observes selection at 3360ms, and controlled COM fixture times out. Earlier CI 38054955248 proves packaged external category rename EPERM. Neither native intermittency nor EPERM cause is established.
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

The receipt gate is satisfied by coordinator-supplied exact c8b4af6d1734c2508ffe548dabcb81685125db6a, CI 38066435677, both isolated artifacts and complete logs. Controlled UIA is Windows-green (37 passed); real COM and UIA agree the exact owned item is unselected. All 28 rename fixtures retained their results and cleanup: native child realpath stress reproduced exact Node parent-rename EPERM in three of four fixtures, while idle and legacy each passed four of four. Category DELETE-shared controls passed; both child DELETE-shared controls returned EPERM, invalidating their expected-success assertion. The rename suite reported 33 passed/two failed, not a green diagnostic. This supports a narrow Windows discovery-descendant canonicalization repair while leaving native selection and original runtime/platform acceptance open.

Coordinator-authorized Task 6 scope includes the confirmed full-runtime fixture boundary: exact f753 full DEV normal quit timed out at ten seconds, and unconditional fixture removal then masked it with journal EBUSY. Preserve the primary shutdown error and separately record cleanup; never remove the fixture without verified owned-process termination. This is evidence handling, not a shutdown cause/fix or a resolution of #44. A separate relative-child native comparison remains a possible coordinator investigation; no production native replacement is supported by current evidence.

### Task 6: Repair established product causes after the child/provider checkpoint

**Files:**
- Modify only evidence-implicated files: `src/service/discovery.ts`, Windows rename diagnostic/worker scripts, `scripts/smoke-runtime.mjs`, `scripts/runtime-lifecycle.mjs`, connected regression tests and `docs/verification/issue-17-create-reveal.md`. Root normalization, native dispatch, creation/Reveal authorization and watcher policy remain outside this supported repair.

- [x] Map corrected coordinator artifacts to confirmed findings and unresolved hypotheses. Obtain all five initial perspectives—quality, implementation, testing, simplification and documentation—before new product repairs, using gpt-6.1-sol high and the fixed base; batches 3+2 are permitted.
- [x] Implement the smallest supported repair at the native, resource-ownership, filesystem or fixture boundary. Verify primary native documentation before any justified API adaptation. An occasional experimental pass alone authorizes no replacement.
- [x] Add focused red-before/green-after regressions for each repair. Preserve one user-intent dispatch, useful errors, live observation and rename/reconciliation invariants.
- [x] Run affected suites, then quality/implementation critical-major follow-up reviews until clean. Commit verified repairs. If evidence remains insufficient, retain the unresolved gate instead of speculative changes.

Task 6 local verification (macOS arm64, Node 22.21.1): service test-library build passed; seven diagnostic/lifecycle/canonicalization suites reported 145 tests, 136 passed, nine Windows-only skips, zero failures. Eight connected service/authorization/recovery suites reported 497 passed, zero failures/skips. Lint, typecheck, smoke-script syntax, check:docs and working/fixed-base diff checks passed. Twelve scanner seam/safety regressions produced eight failures before repair and all passed afterward; child-control and runtime-close/ownership regressions also failed before their repairs. All five initial perspectives preceded edits. The final quality/implementation pair found no remaining critical/major actionable issues after both identified cleanup ownership gaps were repaired and re-reviewed. The existing isolated diagnostic now retains four actual-production scanner comparisons in addition to the original 28 operations. No full npm test, production/Electron build, graphical/native run, package or actual Windows green is claimed. Native selection and original Windows category-rename/runtime/normal-quit acceptance remain external coordinator gates; this milestone repairs supported scan and fixture causes without claiming #17 completion. Task 7 is untouched and remains pending.

### Task 7: Compare isolated native selection call forms

Coordinator-authorized insertion after Task 6: the original integrated verification is retained below as Task 8. Exact c8b4af6 COM/UIA agrees the owned item is unselected; no production native replacement is established. Task 6 repair revision is daab694a6628ef1d79fb442e2a569d2d8ff97024. All five initial perspectives (quality, implementation, testing, simplification and documentation) were collected before this milestone's edits using gpt-6.1-sol high and the fixed base.

**Files:** scripts/windows-native-selection.mjs/.ps1, tests/windows-native-selection.test.mjs, tests/windows-product-diagnostics.test.mjs, .github/workflows/desktop-ci.yml and docs/verification/issue-17-create-reveal.md.

- [x] Verify primary signatures/ownership and implement allowlisted electron_absolute, relative_child and zero_child forms in one bridge, with identical parent/target preparation and one selection call per fresh owned Unicode fixture. Keep production dispatch unchanged.
- [x] Extend finite mode-bound protocol and controlled regressions for actual call arguments, parent/target/borrowed-child ownership, failures, privacy, bounds and exact observation. Preserve negative/unavailable evidence and historical v1 artifacts.
- [x] Wire three separate fresh Windows matrix jobs with identical steps, no install/build/prewarming, no fail-fast cancellation, unique artifacts and unconditional uploads. Retain the full product matrix.
- [x] Run focused suites, lint, typecheck, check:docs, local C# compilation where available and working/fixed-base diff checks. Obtain clean quality/implementation follow-up reviews; commit and document actual checks and external limitations.

Primary contracts checked on 2026-10-10: [selection](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shopenfolderandselectitems), [parsing](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shparsedisplayname), [borrowed last child](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-ilfindlastid), [COM initialization](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-coinitializeex), [PIDL ownership](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-ilfree), [array marshalling](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices.marshalasattribute.sizeparamindex), and [pinned Electron 44.7.0](https://github.com/electron/electron/blob/v44.7.0/shell/common/platform_util_win.cc). The absolute form matches selection arguments only: this bridge uses SHParseDisplayName rather than Electron's desktop parser. The relative child borrows target storage; managed IntPtr[] carries one pointer without independent native array ownership. All conditions parse parent then target, including zero_child; historical v1 preparation/results remain distinct.

Task 7 local verification (macOS arm64, Node 22.21.1): four focused native/product/file-manager/UIA suites reported 92 tests, 86 passed, six Windows-only skips and zero failures. Six added mode/protocol/CI regressions failed before implementation and passed afterward. Lint, typecheck, check:docs (73 files), actual bridge plus 57-case controlled C# fixture compilation with the installed .NET 6 compiler, and working/fixed-base whitespace checks passed. All five initial perspectives preceded changes; final quality/implementation reviews independently found no remaining critical/major actionable findings. No actual Windows/STA/PInvoke, graphical/native product, package, full npm test or production build verification is claimed. The three-leg comparison is a committed diagnostic milestone only; all exact-code Windows outcomes, repaired production scanner/original runtime validation, native acceptance, shutdown uncertainty and #44 remain external coordinator gates. Task 8 remains unchecked; stop at the checkpoint.

## Mandatory coordinator checkpoint before Task 8

Stop after the committed Task 7 comparison. The coordinator supplies all three exact-code fresh Windows artifacts and complete controlled logs, plus repaired production-scan/original runtime evidence where applicable. Compare actual HRESULTs, invocation counts, strict selected-target observations and cleanup without substituting a diagnostic pass for product acceptance. No production replacement follows from an occasional pass. Preserve historical f753 normal-quit failure, c8 negative selection, unresolved causes and independent #44. Task 8 stays unchecked until this checkpoint is received.

The receipt gate is satisfied by coordinator-supplied exact 36e5587e5cbb4b3a38ec7cacc2c94d03576b480f, CI 38068523263: all three fresh call forms returned S_OK after one invocation, but every completed exact COM read found the owned parent/target unselected. The controlled suites passed 62 tests per job. Exact daab694 CI 38067935441 also supplies the repaired production scanner contrast (4/4 successful parent renames while raw native contrast still reproduces EPERM in 3/4) and original full runtime/category-rename green; Windows product native selection remains negative. Historical f753 normal-quit failure and independent #44 remain preserved.

Coordinator-authorized continuation inserts a bounded evidence milestone before final verification. All five initial perspectives were collected before edits using gpt-6.1-sol high and the fixed base. A reviewed scalar-only terminal snapshot avoids the unresolved DPI/crop privacy complexity of PrintWindow. It can distinguish a busy, minimized, disabled or offscreen terminal view from its opposite; it cannot establish readiness at dispatch or the cause of lost selection.

### Task 8: Inspect exact owned terminal view state after negative selection

**Files:** scripts/windows-native-selection.mjs, new scripts/windows-native-view-diagnostics.mjs/.ps1, connected diagnostic tests, .github/workflows/desktop-ci.yml and docs/verification/issue-17-create-reveal.md.

- [x] Map the supplied exact-code findings, collect all five initial perspectives, verify primary read-only API contracts and review the bounded diagnostic plan before implementation.
- [x] Add one separate bounded terminal COM/UIA/Win32 state read after a frozen negative ten-second observation. Revalidate exact parent/target, HWND/PID and single-tab/view/item ownership before/after; retain only finite state values. Unsupported properties remain unavailable, no paths/titles/handles/process IDs/images are published, and no selection/input/navigation or product dispatch changes occur.
- [x] Add meaningful regressions for ownership changes, unavailable properties, finite protocol/privacy, late selection, invocation/order, bounds and cleanup. Use matched fresh electron_absolute CI legs on windows-latest and windows-2022 with fail-fast=false, unique OS-qualified artifacts and unconditional evidence/log preservation instead of repeating all three unchanged call forms.
- [x] Run focused suites, lint, typecheck, check:docs and working/fixed-base diff checks; obtain clean quality/implementation follow-up reviews, document actual checks/limitations and commit the milestone.

Task 8 local verification (macOS arm64, Node 22.21.1): five focused native/view/product/UIA/file-manager suites reported 105 tests, 97 passed, eight Windows-only skips, zero failures. Lint, typecheck, check:docs (73 files), actual new C# interop compilation using installed .NET 6, and working/fixed-base whitespace checks passed. Three new orchestration regressions failed before implementation and passed afterward. All five initial perspectives preceded edits; final quality/implementation re-reviews found no remaining critical/major actionable issues after correcting early-unavailable ordering, UIA default substitution, nullable runtime identity and controlled PowerShell property matching. No new actual Windows/PowerShell/UIA, graphical/native product, production build, full npm test or package verification is claimed. The original ten-second negative cannot be rescued by the terminal snapshot. Task 9 remains unchecked behind the new exact-code coordinator checkpoint.

## Mandatory coordinator checkpoint before Task 9

Stop after Task 8. Obtain both exact-code Windows terminal-state artifacts (windows-latest and windows-2022) and complete controlled logs. Keep the original negative observation separate from any later selected state. A visible style/Busy=false/ReadyState=4 is not proof of selection readiness or pixel visibility; a snapshot cannot establish conditions at dispatch. No production replacement or final acceptance follows without causal evidence. Coordinator owns push/CI/trackers/integration; #18 remains excluded.

Coordinator-required Task 8 CI correction at Task 9 entry: revision 616a3b6 contained only windows-latest because the matched-OS refinement arrived during execution. The explicit checkpoint override permits only completing that diagnostic control before stopping again. The corrected workflow runs the identical electron_absolute command on windows-latest and windows-2022, with fail-fast=false and unique OS-qualified artifacts. Existing Task 8 initial perspectives are reused for this bounded correction; quality/implementation follow-up reviews assess its delta. Task 9 remains unchecked pending both new exact-code artifacts and complete controlled logs. No native repair, final acceptance or skipped Windows pass is inferred.


Task 8 matched-OS CI correction local checks (macOS arm64, Node 22.21.1): five focused diagnostic suites passed with 105 tests, 97 passed, eight Windows-only skips and zero failures. The workflow regression failed against the single-OS job before correction and passed afterward. Lint, typecheck, check:docs (73 files) and working/fixed-base whitespace checks passed. Ignored logs: work/ralphex/issue-17/task8-os-control-*. No full npm test, production build, graphical/native scenario, packaging or Windows execution was performed for this workflow-only correction. Both exact-code Windows artifacts and complete controlled logs remain required before Task 9.

The correction’s final quality/implementation pair independently found no remaining critical/major actionable findings. Both reviewed the bounded four-file delta with the fixed base as context and independently passed the 13 product diagnostic tests and working whitespace check. No coordinator platform gate is completed by these reviews.

The matched-OS receipt is satisfied by exact bdba4011568d7592b445a1b8be021be86d9a295c, CI 38070047171. Windows-latest (10.0.26100) retains the negative ten-second exact observation and an unavailable ambiguous_view terminal snapshot; windows-2022 (10.0.20348) observed exact selection on its first read at 586.1225ms, with no terminal probe. Both controlled logs contain 91 passes and the same terminal binding failure: observed returns property_unavailable instead of verified. No field/type evidence identifies that failure yet. This is an OS-image differential, not a diagnosed cause or Electron/product acceptance.

Coordinator-authorized continuation inserts bounded synthetic evidence collection and the full Electron OS-image comparison before any repair based on the missing field evidence. The Task 8 initial five perspectives remain applicable. Do not guess a reader/mock correction from a ScriptMethod/Rect/runtime-ID hypothesis; preserve that correction as the dependent unchecked Task 10. The local macOS host cannot execute Windows PowerShell/UIA, and no new tool installation is authorized by this milestone.

### Task 9: Expose controlled binding evidence and prepare full Electron OS comparison

**Files:** tests/windows-native-view-diagnostics.test.mjs, tests/windows-product-diagnostics.test.mjs, .github/workflows/desktop-ci.yml and docs/verification/issue-17-create-reveal.md.

- [x] Map both exact bdba401 artifacts and complete controlled logs; reuse Task 8 initial perspectives without claiming the controlled failure is diagnosed.
- [x] Add bounded synthetic-only field/runtime-type and collection-shape diagnostics for every controlled binding case before strict assertions. Keep real terminal ambiguous_view/property_unavailable outcomes unchanged, unsupported/default/runtime-ID protections intact, and all original assertions failing on unsupported success cases.
- [x] Add one full windows-2022 verify leg using identical shared product checks, native calls, normal quit/restart/cleanup and packaging. Preserve windows-latest and matched standalone diagnostics, fail-fast=false, unique evidence/package artifacts and unsuppressed failures; add a workflow regression.
- [x] Run focused suites, lint, typecheck, check:docs and working/fixed-base diff checks; collect clean focused quality/implementation reviews, document actual local limits and commit the checkpoint.

Task 9 local verification (macOS arm64, explicitly selected Node 22.21.1): five focused native/view/product/UIA/file-manager suites reported 107 tests, 99 passed, eight Windows-only skips and zero failures. The two matrix assertions failed before the added verify leg and passed afterward. Repository lint, typecheck, check:docs (73 files), working and fixed-base whitespace checks passed. The focused quality/implementation pair independently reviewed the five-file delta with fixed base 4ac402620dd8139bdef9ff03625aae64bf60e132 as context and found no critical/major actionable findings; each ran the two changed suites (24 tests, 22 passed, two Windows-only skips). Task 8 initial perspectives were reused under the explicit coordinator continuation. No actual Windows PowerShell/UIA, full npm test, production build, graphical/native run or package verification was performed for this test/workflow/documentation-only checkpoint. The controlled binding defect remains unresolved, and no production correction or external acceptance is claimed. Ignored logs: work/ralphex/issue-17/task9-*. The diagnostic revision is the commit containing this receipt, reported in the executor handoff; historical exact-code evidence retains its original SHA. Stop before Task 10 for coordinator results.

## Mandatory coordinator checkpoint before Task 10

Stop after Task 9. Coordinator supplies exact-code complete controlled Windows logs with the new finite synthetic type/field reports, both standalone artifacts and full windows-2022 Electron results. Controlled failure remains a failure; no skipped Windows check or diagnostic pass is acceptance. Use actual field evidence to choose a minimal reader/mock correction. Full Electron comparison results, negative/unavailable observations, normal quit/restart/cleanup and every unreached stage retain their actual SHA. No production API replacement, tracker change, push or Issue #18 work is authorized.

Coordinator refinement at Task 10 entry: the independent controlled-fixture repair may proceed from complete exact 43f0e79c0ab55f6c6efcc9e96b4bffcb7c792eca fast logs and both artifacts (CI 38070772778). All 18 synthetic reports identify null BoundingRectangle for both observed elements, genuine Boolean properties and valid Int32[] runtime IDs; later cases contain genuine Rect values. The full windows-2022 Electron job 114267537742 remains pending and is not a prerequisite for this isolated fixture correction. Its actual results and corrected-fixture Windows validation remain external coordinator gates; neither is marked passed. Reuse applicable Task 8 initial five perspectives, obtain the focused quality/implementation pair, commit the bounded milestone and stop.

Latest coordinator receipt for the same exact code/job is complete: all four native selection steps, both crash/recovery matrices, DEV/release full runtime, package:dir and artifact checks report success. The complete authenticated log records 1032 tests: 1025 passed, one known controlled null-Rect failure, six skipped. CI lint/typecheck/build/build:ladle/layout and package artifact upload were skipped after npm test failure, not passed. Artifact 11676617629 extraction is still underway. This supplies real product OS-image differential evidence without a green full matrix or corrected-fixture validation.

Final coordinator artifact receipt: bounded extraction of 11676617629 completed with CRC/JSON validation. DEV direct/grouped JSON confirms exact COM/UIA selected agreement, normal shutdown, restart and cleanup. DEV/release runtime JSON both report passed, all 15 stages true, all four normal/failed-startup shutdown checks passed and fixture cleanup with processesStopped=true. Packaged native CI steps passed; their JSON was not in the four-file extracted subset. The OS-comparison receipt is satisfied; corrected-fixture Windows validation and latest Windows native acceptance remain open.

### Task 10: Repair the controlled binding defect from actual field evidence

- [x] Diagnose the exact failing field/type/collection from coordinator Windows reports before correcting the mock or reader; retain real owned-window ambiguity and property/runtime-ID safety.
- [x] Add a meaningful controlled Windows regression for the established defect without relaxing existing selection/property assertions; run applicable focused checks and clean quality/implementation follow-up reviews.
- [x] Record actual exact-code OS comparison outcomes and remaining external coordinator gates; commit verified repair files and stop for coordinator validation.

Task 10 local verification (macOS arm64, explicitly selected Node 22.21.1): five focused diagnostic suites reported 107 tests, 99 passed, eight Windows-only skips and zero failures. Lint, typecheck, check:docs (73 files), working/fixed-base whitespace checks passed. The exact 43f0e79 Windows reports supply the original red evidence. The fixture now explicitly loads WindowsBase before its first Rect, stops initialization errors, asserts bounds types and adds null-view/null-item-bounds rejection controls. The production reader and dispatch remain unchanged. Applicable Task 8 initial five perspectives were reused under the coordinator refinement; the focused quality/implementation pair found no critical/major actionable findings. No corrected Windows PowerShell/UIA, full npm test, production build, graphical/native run or package verification was performed locally. Actual Windows causal confirmation and final platform gates remain external; this is a locally verified fixture milestone, not a Windows green or product selection repair. Ignored logs: work/ralphex/issue-17/task10-*.

## Mandatory coordinator checkpoint before Task 11

Stop after the Task 10 commit. Coordinator supplies corrected exact-code Windows controlled logs from both images; the completed exact 43f0e79 full Windows2022 artifact receipt is recorded above. Require the first observed Rect case and null/unsupported/runtime-ID controls to pass without weakening assertions. Retain Windows-latest native negatives, skipped/unreached checks, historical shutdown uncertainty and #44. A locally skipped fixture or successful Windows2022 runtime step does not complete the failed full matrix, desktop Windows acceptance or causal native diagnosis. Task 11 remains unchecked.

The Task 10 corrected receipt is satisfied by exact f51242d01f6af7e0c5c22894cace15672bc5a02d, CI 38071517969: both complete controlled logs report 93 passes, zero failures/skips and 20 finite reports. The first observed bounds are genuine Rect values; null/unsupported/runtime-identity controls pass. The fixture correction is causally confirmed on both images. Server2022 standalone selection passes; latest-image selection remains negative. Receipt-only commit 7e7fd828ae2248f8c86b3e1e298bf59a5eb402bb preserves the published repair linearly.

Coordinator-authorized continuation inserts the alternative-dispatch diagnostic below before final verification. A CLI candidate outcome cannot replace product acceptance or establish a production fix.

Latest coordinator receipt: exact f51242d / CI 38071517969 full Windows2022 job 114269711807 and macOS job 114269711803 completed green, including standards/build/layout/native/recovery/runtime/package checks and uploads. Latest Windows retains four native failures; its full release runtime was still running. The complete Windows2022 log download remains coordinator-owned. The CLI comparison uses the identical API basename Native selection 日本語 and workspace-native-selection- root prefix in a fresh fixture, preserving rich-path transport in the separate safe-process control. No desktop acceptance or latest-image repair is inferred.

### Task 11: Compare one owned Explorer select launch across Windows images

**Files:** new scripts/windows-explorer-selection.mjs, scripts/windows-explorer-directory.ps1 and tests/windows-explorer-selection.test.mjs; shared fixture-removal export, diagnostic workflow/tests and verification handoff.

- [x] Map the corrected Windows receipt, collect all five initial perspectives on process/argument/resource boundaries and review primary contracts and the bounded design before implementation.
- [x] Launch genuine system Explorer once per internally owned Unicode fixture with one quoted /select argument, no shell/fallback/input/prewarming and unchanged strict ten-second observer starting at launch acknowledgment. Bound trusted directory resolution, keep process exit separate from selection, never kill Explorer, close only the exact owned view and preserve fixtures when direct-child termination is unknown.
- [x] Add meaningful literal-path/raw Windows argument transport, resolver, negative/unavailable observation, lifecycle/race, cleanup/privacy and matched fresh CI regressions. Keep the original native comparison and full product gates unchanged.
- [x] Run focused suites, lint, typecheck, check:docs and working/fixed-base diff checks, collect clean quality/implementation reviews, document actual limits and commit the diagnostic milestone. Stop for coordinator artifacts.

Task 11 local verification (macOS arm64, explicitly selected Node 22.21.1): six focused Explorer/native/view/product/UIA/file-manager suites reported 118 tests, 109 passed, nine Windows-only skips, zero failures. The new workflow regression failed before the separate matrix existed and passed afterward. Lint, typecheck, check:docs (73 files) and working/fixed-base whitespace checks passed. All five initial perspectives (quality, implementation, testing, simplification, documentation) preceded implementation, and the focused quality/implementation pair found no critical/major actionable findings. No actual Windows resolver/raw-argument/Explorer execution, graphical/native product, full npm test, production build or packaging was performed locally. The new Windows-only transport fixture remains unverified until coordinator execution. Ignored logs: work/ralphex/issue-17/task11-*. This diagnostic revision is the commit containing this receipt, reported in the executor handoff. Original product/native gates remain open; Task 12 stays unchecked behind the coordinator checkpoint.

## Mandatory coordinator checkpoint before Task 12

Stop after Task 11. Coordinator supplies both exact-code CLI candidate artifacts and complete controlled logs from fresh windows-latest/windows-2022 jobs. Compare actual launch, literal argument transport, exact parent/selected target, exit/termination and owned cleanup without replacing prior API negatives. CLI-only success is diagnostic evidence; any production adaptation requires a subsequent actual one-dispatch integration comparison preserving authorization, identity and security. No unknown child termination, skipped fixture or unavailable selection is a pass. Latest-image native acceptance, unresolved causes, historical shutdown uncertainty and #44 remain open. No executor push, integration, tracker change or #18 work.

### Task 12: Verify repairs and update the evidence handoff

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
