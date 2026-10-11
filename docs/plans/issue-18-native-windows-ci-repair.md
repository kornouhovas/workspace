# Issue #18: Bounded Native Windows CI Repair

## Overview

Repair the native test lifecycle and artifact rejection diagnostics, and add targeted diagnostics to existing creation assertions. Deliver one locally verified repair commit, then stop for coordinator review and actual Windows validation. Do not implement during planning.

## Context

- Plan destination: `docs/plans/issue-18-native-windows-ci-repair.md`.
- Authority: `work/ralphex/issue-18/ci-repair.md`.
- Tracking: https://github.com/kornouhovas/workspace/issues/18; Beads `workspace-31i.11` remains claimed. Coordinator owns tracker writes and delivery.
- Reviewed starting SHA: `eee79ab269099eab1d4a017ba8294cdb8ff2660a`.
- Immutable issue base: `a5728daa64caab6b90700854ad5e27417fcf683e`.
- Evidence: CI `38086767954`, `work/issue-18/ci-38086767954/failed.log`, `native/native-adapter.json` and `buffer-diagnostic-summary.json`. The referenced `buffer-diagnostic-reproduction.log` is currently empty.
- Windows Node primitive scenarios passed, including late-empty collision and actual case-alias behavior. Loading and both Electron routes failed; artifact checks exhausted memory. Two Windows2022 creation failures lack sufficient structured context. These results do not establish Windows acceptance.
- Dependencies: existing installed dependencies and toolchains, Node 22.21.1 and Electron 44.7.0. Retain the existing run-local gpt-6.1-sol/high configuration.

## Development Approach

- **Testing approach**: Regular, with root-cause reproduction before fixes and meaningful updated regressions.
- Use disposable fixtures exclusively. Preserve fixed-location loading, exact byte equality, collision assertions, checked process exits and existing deadlines.
- Every task must include new or updated tests; all applicable tests must pass before completion.
- Prepend `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin` to PATH for local Node/npm commands.
- No dependencies, installs, native API or production service/UI changes, global configuration, timeout or heap increases, assertion weakening, skips or retry masking.
- Preserve the completed original stage and deferred rename journal/service/UI scope.

## Implementation Steps

### Task 1: Repair native fixture ownership and bounded artifact rejection

**Files:**
- Modify: `tests/project-rename-native.test.mjs`.
- Modify: `tests/fixtures/project-rename-native-electron.cjs`.
- Modify: `scripts/check-artifact.mjs`.
- Modify: `tests/artifact-smoke.test.mjs`.
- Modify: `tests/project-creation-service.test.mjs`.

- [x] Reproduce the unequal-buffer diagnostic growth in a bounded child process and trace Node/Electron loading, acknowledgment, exit and cleanup stages before fixes. Compare with archived failures; distinguish established DLL ownership from unresolved Electron timeout and userData cleanup hypotheses. Retain bounded stage/code evidence without raw paths, exception text or binary dumps.
- [x] Move deletion of copied loaded adapters to a supervisor after confirmed loader-process exit. Give the outer supervisor ownership of Electron userData and packaged fixture cleanup after Electron exits. Preserve actual missing/corrupt and valid fixed-location checks, independent-of-cwd loading and existing no-replace scenarios. Check exit status and termination; on failure, clean only after confirmed shutdown and report unverified cleanup truthfully.
- [x] Add lifecycle regressions covering successful loading, injected failure, missing acknowledgment or abnormal exit, existing timeout handling and supervisor cleanup ordering. Exercise actual Node and Electron development/ASAR routes; retain bounded failure evidence without increasing deadlines.
- [x] After confirming the artifact cause, replace assertion formatting that expands native buffers with exact byte comparison and bounded failure diagnostics. Add meaningful same-length byte corruption and differing-length regressions in a bounded child, checking normal rejection, finite output, valid-artifact acceptance and unchanged unpacked/substitution protections. Do not increase heap limits.
- [x] Add allowlisted bounded result context to emptyFixture applyDiscovery, grouped empty-root completion and competing-mkdir assertions. Preserve expected outcomes and sentinel checks. Keep diagnostics simple and bounded, then run existing grouped/category and parent-revalidation controls. Record any unreproduced Windows2022 failure as pending; do not change production behavior speculatively.
- [x] Run `npm run build`, then `node --import tsx --test tests/project-rename-native.test.mjs tests/artifact-smoke.test.mjs tests/project-creation-service.test.mjs tests/grouped-discovery-service.test.mjs` with fresh ignored native evidence. Run `npm test` once after repairs, `npm run lint`, `npm run typecheck` and `npm run check:docs`. Check working, staged and immutable-base diffs with `git diff --check`. Investigate failures without whole-suite retry loops.
- [x] Record confirmed causes, actual commands/results, platform skips and unresolved findings in this plan and ignored run evidence; keep chronological CI history out of the development guide. Stage only explicit task paths and commit completed verified changes with an English message. Report the commit and limitations in Russian, then stop without implementation continuation, push, tracker writes, merge or release.

## Task 1 Local Verification Record

Verified on macOS arm64 with Node 22.21.1 and Electron 44.7.0. The actual checkout started at `f33e14d8`; the reviewed implementation SHA and immutable issue base above were preserved. Only the five listed implementation/test files and this plan belong to the repair commit. No production service/UI/native API, dependencies, deadlines, heap increases, global configuration or tracker changes were made.

### Confirmed findings and repair

- Before edits, disposable child processes with a reduced 64 MiB heap reproduced differing-length Buffer assertion expansion: 4 KiB produced 28,988 message characters, 16 KiB produced 115,005, and 256 KiB exceeded the five-second child deadline and was terminated. A one-byte same-length difference alone did not reproduce that expansion. The retained coordinator measurements independently show the same growth. Exact `Buffer.equals` checks now assert a boolean, preserving every-byte and length equality without formatting native buffers; external native script comparisons use the same bounded approach.
- The original four native tests passed locally, with no skips. Pre-edit instrumentation traced copied-module loading and loader-owned deletion, main result receipt and utility exit, and userData deletion before main exit. A further instrumented copy of the original HEAD fixture explicitly retained acknowledgment send/receipt and main exit request as well. These baseline traces use disposable copies and retain only stages and numeric exits. The archived Windows Node EPERM identifies deletion of a still-loaded copied DLL; deleting require.cache cannot unload it. Local macOS success does not reproduce Windows locking.
- All copied loading fixtures now survive until their Node or Electron loader exits. The outer supervisor owns those copies, Electron userData and ASAR inputs/unpacked output. The worker waits for result acknowledgment, reports acknowledgment receipt, and exits only after the supervisor observes it and permits exit. Main flushes its utility-exit event before exiting. Actual process exits, finite output and cleanup ordering are checked. Cleanup is withheld and reported as unverified if shutdown cannot be confirmed; cleanup failure cannot pass a scenario. The original 20/25/30-second deadlines remain unchanged, with bounded termination confirmation and no retry masking.
- Updated regressions exercise real Node and Electron development/ASAR success, missing/corrupt fixed-location loading independently of cwd, failure after loading, abnormal exit and missing acknowledgment. The original identity, sentinel, collision, late-empty and mounted case-alias assertions remain. The missing-ack controls actually reach the existing Node supervisor and Electron utility deadlines; expected injected failures are recorded separately from successful native acceptance.
- Artifact regressions run valid, same-length byte corruption, shorter and longer native binaries in finite-output children with the reduced heap and existing ten-second deadline. Rejection remains a normal checked assertion with a message below 256 characters. Existing packed/missing-unpacked and substituted-directory protections also pass.
- Creation assertions retain only allowlisted mode, phase, result/error code, outcome, operation stage/problem and evidence-recorded status. A hostile oversized diagnostic fixture verifies the output remains bounded and excludes arbitrary names, IDs, paths and error text. EmptyFixture Apply, empty-root completion and competing-mkdir expectations and sentinel checks remain intact. The grouped/category and parent-revalidation controls pass locally in the affected/full suites.

### Commands and retained evidence

Every Node/npm command used `PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH`. Ignored evidence is under `work/issue-18/ci-repair-local/`; each native invocation used a distinct evidence directory. No build/clean overlapped a consuming fixture.

| Actual command/check | Result | Ignored evidence |
| --- | --- | --- |
| Bounded `node --input-type=module` reproduction using spawnSync children | Growth reproduced; 256 KiB child timed out as designed | `pre-fix/buffer-growth.json` |
| Original `node --test tests/project-rename-native.test.mjs` and disposable baseline lifecycle instrumentation | 4 passed, 0 skipped; baseline Node/Electron exited 0 | `pre-fix/native.tap`, `pre-fix/native-adapter.json`, `pre-fix/lifecycle-trace.json`, `pre-fix/baseline-complete-trace.json` |
| `npm run build` | Passed, including both native builds and version check | `build.log` |
| `WORKSPACE_RENAME_NATIVE_EVIDENCE_DIR=work/issue-18/ci-repair-local/final-focused node --import tsx --test tests/project-rename-native.test.mjs tests/artifact-smoke.test.mjs tests/project-creation-service.test.mjs tests/grouped-discovery-service.test.mjs` | 193 passed, 0 skipped, 0 failed | `final-focused.tap`, `final-focused/native-adapter.json` |
| `WORKSPACE_RENAME_NATIVE_EVIDENCE_DIR=work/issue-18/ci-repair-local/full npm test` (once after repairs) | 1,146 passed, 16 existing Windows-only skips, 0 failed; rebuild included | `npm-test.log`, `full/native-adapter.json` |
| `npm run lint` | Passed on final code | `final-lint.log` |
| `npm run typecheck` | Passed on final code | `final-typecheck.log` |
| `npm run check:docs` | Passed; 77 Markdown files checked, including updated plan | `final-check-docs.log` |
| Working, explicitly staged and immutable-base `git diff --check` | Passed | `checks.json` |

The full suite also verifies the final stronger exit/protocol and competing-operation-stage assertions added after the focused run. Native lifecycle tests have no platform skips locally. All 16 full-suite skips are existing actual-Windows controls; their names are retained in `checks.json` and are not acceptance. Earlier affected iterations are retained independently; no full-suite retry was performed. Packaging, Ladle, product runtime smoke and actual Windows runs were not performed by this repair task.

### Unresolved platform findings

The historical Electron timeout and userData cleanup hypotheses are not established causes. The baseline macOS trace confirms the unsafe ownership order, while the new stage/code protocol makes subsequent Windows failures attributable without raw exception output. The historical Windows2022 grouped empty-root recoverable result and competing-mkdir Apply failure remain pending actual Windows reproduction with the new bounded context. No production behavior was changed speculatively. Review and exact-repair-SHA Windows acceptance remain coordinator-owned outside executable task checkboxes.

## Post-Completion: Coordinator Windows Checkpoint

- Coordinator obtains separate successful review before pushing the task branch for Actions.
- Require exact repair-SHA results on windows-latest and windows-2022: focused native loading/lifecycle, bounded corrupt-artifact rejection, existing creation controls, early product checks and unchanged full platform matrices.
- Inspect all loading, Electron development/ASAR, cleanup and creation outcomes. Preserve failures, skips and unreached stages; local macOS passes cannot establish Windows acceptance.
- Unresolved Windows2022 creation results remain pending at this checkpoint. Further product implementation requires coordinator authorization after reviewing actual Windows evidence.
