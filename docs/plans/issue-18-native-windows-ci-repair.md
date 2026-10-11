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

- [ ] Reproduce the unequal-buffer diagnostic growth in a bounded child process and trace Node/Electron loading, acknowledgment, exit and cleanup stages before fixes. Compare with archived failures; distinguish established DLL ownership from unresolved Electron timeout and userData cleanup hypotheses. Retain bounded stage/code evidence without raw paths, exception text or binary dumps.
- [ ] Move deletion of copied loaded adapters to a supervisor after confirmed loader-process exit. Give the outer supervisor ownership of Electron userData and packaged fixture cleanup after Electron exits. Preserve actual missing/corrupt and valid fixed-location checks, independent-of-cwd loading and existing no-replace scenarios. Check exit status and termination; on failure, clean only after confirmed shutdown and report unverified cleanup truthfully.
- [ ] Add lifecycle regressions covering successful loading, injected failure, missing acknowledgment or abnormal exit, existing timeout handling and supervisor cleanup ordering. Exercise actual Node and Electron development/ASAR routes; retain bounded failure evidence without increasing deadlines.
- [ ] After confirming the artifact cause, replace assertion formatting that expands native buffers with exact byte comparison and bounded failure diagnostics. Add meaningful same-length byte corruption and differing-length regressions in a bounded child, checking normal rejection, finite output, valid-artifact acceptance and unchanged unpacked/substitution protections. Do not increase heap limits.
- [ ] Add allowlisted bounded result context to emptyFixture applyDiscovery, grouped empty-root completion and competing-mkdir assertions. Preserve expected outcomes and sentinel checks. Keep diagnostics simple and bounded, then run existing grouped/category and parent-revalidation controls. Record any unreproduced Windows2022 failure as pending; do not change production behavior speculatively.
- [ ] Run `npm run build`, then `node --import tsx --test tests/project-rename-native.test.mjs tests/artifact-smoke.test.mjs tests/project-creation-service.test.mjs tests/grouped-discovery-service.test.mjs` with fresh ignored native evidence. Run `npm test` once after repairs, `npm run lint`, `npm run typecheck` and `npm run check:docs`. Check working, staged and immutable-base diffs with `git diff --check`. Investigate failures without whole-suite retry loops.
- [ ] Record confirmed causes, actual commands/results, platform skips and unresolved findings in this plan and ignored run evidence; keep chronological CI history out of the development guide. Stage only explicit task paths and commit completed verified changes with an English message. Report the commit and limitations in Russian, then stop without implementation continuation, push, tracker writes, merge or release.

## Post-Completion: Coordinator Windows Checkpoint

- Coordinator obtains separate successful review before pushing the task branch for Actions.
- Require exact repair-SHA results on windows-latest and windows-2022: focused native loading/lifecycle, bounded corrupt-artifact rejection, existing creation controls, early product checks and unchanged full platform matrices.
- Inspect all loading, Electron development/ASAR, cleanup and creation outcomes. Preserve failures, skips and unreached stages; local macOS passes cannot establish Windows acceptance.
- Unresolved Windows2022 creation results remain pending at this checkpoint. Further product implementation requires coordinator authorization after reviewing actual Windows evidence.
