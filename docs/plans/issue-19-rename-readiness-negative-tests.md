# Issue #19: Bounded rename-readiness negative-test repair

## Overview

Separate actual renderer operand rejection from host transport expiration in the existing negative tests. Preserve production readiness policy, finite privacy evidence, strict deadlines and owned cleanup.

## Context

- Issue: https://github.com/kornouhovas/workspace/issues/19; Beads workspace-31i.12.
- Reviewed baseline: 1ee8788a0cd05405276f9aa053d1bade9035dc5a.
- Immutable issue base: 4f9f11f785c63a65585ea6f33f167fc438272c64.
- Ralphex planning source: work/ralphex/issue-19/rename-readiness-planning.log, timestamped PLAN_DRAFT through END.
- Diagnosis and controlled probe: work/issue-19/rename-readiness-diagnosis/diagnosis.json and probe-results.json.
- Original Actions 38216688273 attempt 1 at e31936265a8e0f098fef059299e7f69604a2952c: readonly and focus-loss subtests expected renderer timeout but received host deadline expiration during npm test.
- An actual Electron readonly observation delivered immediately retained timed_out/not_editable; controlled 80ms transport delay with the same 200ms allowance reached observation_failed/unknown. This proves the mechanism; historical CI timing attribution remains unproven.
- Existing Node 22.21.1, node:test, Playwright Core and Electron; no new dependencies.

## Development Approach

Use TDD at existing public observeRenameEditor/waitForRenameEditor seams. Actual Electron establishes operand values; deterministic delivery establishes host behavior. Complete each task and affected checks before the next task. Modify only tests/rename-editor-readiness.test.mjs and this plan (including its completed archive). Read scripts/rename-editor-readiness.mjs, tests/fixtures/rename-editor-readiness-electron.cjs and existing timer-control examples without modifying them.

Keep production/helper/fixture/lifecycle/runner/CI/application/dependencies unchanged. Preserve the 15000ms default and finite test allowances: no retries, deadline increases, stacked budgets, arbitrary sleeps or regex widening that treats unknown as operand proof. Preserve finite evidence privacy and existing exit-before-removal rules. Completed service/runner/fixture repairs and preserved UI planning are outside this slice.

## Implementation Steps

### Task 1: Separate operand rejection from transport deadline behavior

- [x] Record starting HEAD, platform, Node/Electron versions, input hashes, commands and exits under ignored work/issue-19/rename-readiness-test-repair/. Preserve original evidence. Retain a controlled red: holding an actual readonly Electron response past the host deadline defeats the old renderer-timeout expectation. Label controlled evidence separately from historical reproduction.
- [x] Have the operand matrix obtain real initial/final observations through observeRenameEditor in Electron. A test-only adapter may supply an already-expired renderer deadline, forwarding the real callback without fabricating snapshots or replacing its predicate. Classify the returned observation through unchanged waitForRenameEditor within its existing 200ms host allowance. Host expiration or unknown classification must fail the operand case.
- [x] Preserve all ten literal cases: missing/duplicate input => input_count; hidden input/ancestor => hidden; disabled input/fieldset => disabled; readonly => not_editable; focus loss => unfocused; absent/multiple labels => label_count. Assert relevant real operands in initial/final observations, timed_out status, timeout failure and exact finite evidence shape.
- [x] Capture an actual Electron outcome before mocking host time. Use deferred response and test-scoped timer controls: delivery before expiration retains operand classification; withholding through the unchanged deadline rejects with deadline exceeded and observation_failed/timeout/unknown. Release the late response and prove no outcome change or second record. Restore clocks and release deferred work in finally.
- [x] Preserve the never-returning transport control at 30ms, full unknown evidence and exactly one recording; primary transport-error identity, secondary evidence-error handling and invalid allowances. Check timer disposal after success, renderer rejection, transport error and deadline with controlled time.
- [x] Preserve actual waitForRenameEditor integration for ready success, fixture-owned delayed focus and never-focused default allowance. Preserve browser frame/timer cleanup on success, renderer timeout and observation error; use the prompt renderer-observation seam for the short negative cleanup case. Keep normal-quit/fixture cleanup controls unchanged.
- [x] Run node --test tests/rename-editor-readiness.test.mjs with Node 22.21.1. Require every applicable test and operand subtest to pass without skips. Save red/green outputs and exact input identities; do not repeat unchanged runs merely to obtain green.

### Task 2: Verify scope and record the bounded result

- [ ] Inspect Task 1's complete affected-file result, all ten operands, controlled deadlines, actual Electron integration and cleanup. Reuse evidence only for unchanged inputs; rerun affected checks after relevant edits.
- [ ] Run npx --no-install eslint tests/rename-editor-readiness.test.mjs --max-warnings=0, npm run check:docs and git diff --check. Inspect the complete diff against the two-file allowlist. No full npm test, rebuild, coverage infrastructure or graphical application smoke in this slice.
- [ ] Record commands/exits/input identities, evidence pointers and limits below. Historical cause remains unproven; exact original full-suite CI is coordinator-owned and pending. No invented coverage percentage.
- [ ] Preserve the independent runtime diagnosis: 46 normal graphical quits passed, final owned-process termination verification failed and fixture cleanup was skipped. This task changes no lifecycle policy or acceptance of that failure.
- [ ] Commit completed verified task changes in English. Finish the bounded execution; no executor push, tracker writes, Actions, review or UI work.

## Execution Evidence

### Task 1: verified locally

- Starting HEAD: `8dd9593fca948d019002a43004b4f4bf469910bd`; immutable issue base remains `4f9f11f785c63a65585ea6f33f167fc438272c64`.
- Actual local platform: macOS arm64; host Node `22.21.1`, Electron `44.7.0` (embedded Node `24.21.0`). Runtime versions were queried from the actual Electron process.
- Evidence root: `work/issue-19/rename-readiness-test-repair/task1/` (ignored). `starting-inputs.json` retains platform and original source/dependency hashes; `verification.json` retains exact commands, exits, tested input hashes and absolute log pointers. Original diagnosis/probe evidence remains unchanged.
- Controlled red: `node --test work/issue-19/rename-readiness-test-repair/task1/controlled-red-release.test.mjs`, exit **1** as expected. The actual readonly renderer outcome was captured, held through the unchanged 200ms host deadline, then released in `finally`; the old renderer-timeout expectation failed with host `deadline exceeded` and finite `observation_failed/timeout/unknown` evidence. Full log: `controlled-red-release.log`. The preliminary control and its log are also preserved. These are injected transport controls, not historical CI reproduction.
- Green: `node --test tests/rename-editor-readiness.test.mjs`, exit **0**, **25 passed, 0 failed, 0 skipped**. Full log: `green-1.log`. Both commands used the Node 22.21.1 bin directory prepended to PATH.
- All ten operand cases now forward the real renderer callback with an already-expired renderer deadline while retaining the 200ms host allowance. Initial/final operands, exact finite evidence keys and specific rejection classifications passed. Controlled response delivery before/after 200ms, late-release immutability, exactly one recording, the 30ms never-returning transport, primary/secondary errors and invalid allowances passed.
- Real ready/delayed-focus/default never-focused integration, host timer disposal, browser frame/timer cleanup and unchanged normal-quit/profile cleanup controls passed. No production helper, fixture, lifecycle, runner, CI, application or dependency changes.
- Task 2 remains unexecuted. Historical CI timing attribution is unproven; original full-suite CI and actual Windows acceptance remain coordinator-owned and pending. The independent runtime result remains 46 successful normal graphical quits followed by failed final owned-process termination verification and skipped fixture cleanup; this task establishes no acceptance of that failure.

## Coordinator Gates

Separate Ralphex and Matt Pocock review, authorized branch push and exact-SHA Actions remain coordinator actions. Full npm test and actual Windows acceptance remain pending until inspected. The new Windows-2022 observer regression in Actions 38222572956 is diagnosed separately. Preserve work/issue-19/category-move-ui-local-candidate.md and category-move-ui-runtime-future.md; no UI replay or implementation in this plan.

