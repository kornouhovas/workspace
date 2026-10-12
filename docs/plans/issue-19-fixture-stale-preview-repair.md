# Issue #19: Bounded stale-preview fixture repair

## Overview

Repair the category-move service fixture so it can explicitly review and perform its chosen recovery action once after a proven no-effect stale_preview rejection. Keep production recovery policy, real observation, assertions, process ownership and sanitized diagnostics intact. This reviewed plan is executed only through the repository runner's explicit execute phase; separate review and delivery remain coordinator-owned.

## Context

- Issue: https://github.com/kornouhovas/workspace/issues/19

- Linked execution step: workspace-31i.12.

- Planning source: work/issue-19/fixture-recovery-request-diagnosis/planning.md.

- Diagnosis: work/issue-19/fixture-recovery-request-diagnosis/diagnosis.json.

- Runner snapshot: work/ralphex/issue-19/current.json.

- Repair/review baseline: e31936265a8e0f098fef059299e7f69604a2952c.

- Immutable issueBaseSha: 4f9f11f785c63a65585ea6f33f167fc438272c64.

- Original Actions run 38216688273, attempt 1: early macOS success and missing-ack controls failed at grouped.keep_original/recovery_request; the original full-suite control-read checkpoint failed at the same seam. All three retained three utility processes, confirmed shutdown/removal and an unreached recovery_restart.

- Twenty instrumented unchanged runs passed. Ten controlled runs with a 250ms boundary delay failed with stale_preview at the same seam. These demonstrate a possible mechanism; the original CI rejected response code was not retained, so historical attribution remains unproven.

- Existing patterns: disposable SQLite/filesystem fixtures, public service requests, controllable observer dependencies, finite checkpoints and strict lifecycle/privacy assertions.

- Dependencies: existing installed tools and verified production build outputs; no new packages.

## Files involved

- tests/fixtures/project-category-move-service-electron.cjs

- tests/project-category-move-fixture.test.mjs

- tests/project-category-move-coordination.test.mjs

- docs/development.md

- docs/verification/issue-19-category-move-service.md Read production service/contracts, source-observer code and scripts/smoke-project-category-move.mjs for context and verification only.

## Development Approach

- Testing approach: TDD, one controlled failing regression followed by the smallest fixture repair and passing verification.

- Use the already authorized disposable fixture/public production-service seam.

- Complete each task, including its new or updated tests, before proceeding.

- All affected tests must pass before the next task.

- Keep recovery branching local to this fixture. Do not introduce a general retry helper, timing sleep, wait-to-green loop or automatic service replay.

- Preserve original failures and all skipped/unreached outcomes.

- Exclude production policy, UI implementation/replanning, runner repair, CI transport changes, packaging and broad full-suite replay.

## Implementation Steps

### Task 1: Prove invalidation and repair one explicit fixture recovery

Files:

- Modify: tests/fixtures/project-category-move-service-electron.cjs

- Modify: tests/project-category-move-fixture.test.mjs

- Modify: tests/project-category-move-coordination.test.mjs

- [x] Add a deterministic controlled regression at the recovery preview/request boundary. Use existing observer dependencies and public production service calls to deliver an actual sourceObserved invalidation after preview; prove event delivery instead of directly clearing tokens, fabricating stale_preview or inserting a timing sleep. Cover the existing Windows grouped-observation fallback through the controllable dependency seam.

- [x] Retain a failing fixture regression before repairing its request handling. Separately prove that the stale token returns exactly stale_preview with unchanged public receipt, durable operation, source/project state, directory identities, placements, sentinel bytes, Text/settings/views and no recovery effect.

- [x] Replace the unconditional successful-result assertion at the affected recovery boundary with explicit finite branching. Preserve the ordinary one-request success path.

- [x] Permit fresh review only after an exact stale_preview response and successful no-effect/state-equality checks. Fetch one fresh preview; verify the same workspace/source/operation, current safe placements, unchanged recovery-relevant state, a distinct nonempty token and advertisement of the previously chosen action. Submit that action exactly once with the fresh token.

- [x] Fail on another stale response, any other/unknown error, changed evidence, missing action, failed preview or malformed response. Add controlled negative regressions proving those cases cannot trigger another recovery action or loop.

- [x] Preserve all existing completed/kept-original, event, consumed-token, retention and restart assertions. Label controlled invalidation tests and evidence separately from original production-service runs without expanding uploaded diagnostics or exposing private fields.

- [x] Run node --import tsx --test tests/project-category-move-fixture.test.mjs tests/project-category-move-coordination.test.mjs against verified unchanged production outputs; retain red/green logs and checkpoints. All affected tests must pass before Task 2.

Task 1 verification (local macOS arm64, Node 22.21.1):

- Controlled red: six public-service regressions delivered real `sourceObserved` invalidation and proved exact `stale_preview`/no effect before the fixture's unconditional success assertion failed. Retained log and pre-repair diff: `work/issue-19/fixture-recovery-request-diagnosis/task1/red-fixture.log` and `red-fixture.patch`.
- Final affected command: `node --import tsx --test tests/project-category-move-fixture.test.mjs tests/project-category-move-coordination.test.mjs`, exit 0, 81 passed, 0 failed/skipped. Log: `work/issue-19/fixture-recovery-request-diagnosis/task1/green-final.log`; persisted original Electron control checkpoints: `task1/final-checkpoints/` under the same diagnosis directory. Controlled observer/response cases remain separately labeled in the tests/log, without new uploaded diagnostic fields.
- Affected ESLint command passed (exit 0); log: `work/issue-19/fixture-recovery-request-diagnosis/task1/lint-final.log`. Production source/build and migration byte identity passed without writing `dist`; receipt: `work/issue-19/fixture-recovery-request-diagnosis/task1/production-inputs.json`.
- The polling dependency control exercises the Windows grouped-observation fallback locally; it does not establish actual Windows acceptance or the cause of the historical CI failure. Task 2, Task 3 and coordinator gates remain pending.

### Task 2: Verify the bounded repair and record its evidence limits

Files:

- Modify: tests/project-category-move-fixture.test.mjs

- Modify: docs/development.md

- Modify: docs/verification/issue-19-category-move-service.md

- Update ignored local evidence under work/issue-19/fixture-recovery-request-diagnosis/.

- [ ] Extend checkpoint regressions for the new controlled cases using the existing strict privacy, persisted-result, handshake and lifecycle assertions. Require four successful utility exits for successful runs; failed controls must retain their actual reached/unreached outcomes. Keep the finite diagnostic schema and sanitized transport unchanged.

- [ ] Verify production source/build inputs and migration bytes before reusing dist. Record this identity separately from the changed fixture digest; previous fixture smoke receipts cannot establish acceptance of the repaired fixture. Do not rebuild while a fixture consumes dist.

- [ ] Run npm run test:category-move:early and npm run smoke:category-move:service with distinct ignored evidence directories. Require the original fixture controls to reach their intended seams, all required success scenarios, ordered acknowledgment/exit, owned shutdown and removal.

- [ ] Run npm run lint, npm run typecheck, npm run check:docs and git diff --check. Retain actual commands, exit statuses, platform, revision and evidence pointers. Do not replay the 2,125-test product suite or 103-test runner suite.

- [ ] Document the single fresh-review/action fixture behavior and actual controlled regression results. Preserve original Actions failures, the 20 passing probes, the 10 controlled timing failures and explicitly unproven historical attribution. Record original-scenario CI verification as pending.

- [ ] Review the final bounded diff and commit only completed, verified task changes in English. Stop after the local handoff; do not execute review, push, dispatch CI, mutate trackers, implement UI or publish.

### Task 3: Repair the existing shared-CI behavior regression

Files:

- Modify: tests/windows-product-diagnostics.test.mjs.

- [ ] Read work/issue-19/fixture-ci-evidence/ci-shape-diagnosis.json and retained original Actions38216688273 selection-job failure. Reuse the already captured local red for the exact full-product OS comparison test; its cause is proven independently of stale-preview attribution.
- [ ] Update the existing test to assess OS-neutral run commands/conditions without forbidding OS-specific evidence directories. Preserve exact shared command sequence, fail-fast/continue-on-error rules and original evidence/package requirements. Find uploads by their purpose instead of frozen positions/counts; accommodate the legitimate sanitized full-suite artifact with unique per-OS provenance. Do not change workflow commands or add implementation-mirroring tests.
- [ ] Run the complete tests/windows-product-diagnostics.test.mjs file and the affected test:windows:early command, retaining actual results. Run affected lint and git diff --check; commit the verified test repair. No broad full-product or runner suite replay.

## Post-Completion — coordinator-owned gates

- Separate focused review against the recorded successful review baseline, with explicit assessment of no-effect proof, finite recovery behavior and historical cause claims.

- After separately authorized delivery, inspect exact-SHA original early and full-suite CI outcomes and artifacts on macos-latest, windows-latest and windows-2022.

- Local controlled regressions do not establish original CI causation, Windows acceptance or completion of Issue #19.

- The preserved category-move UI draft and remaining product acceptance stay outside this repair.
