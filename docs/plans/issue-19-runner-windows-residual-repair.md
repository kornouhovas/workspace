# Issue #19: Bounded Windows Observer Residual Repair

## Overview Repair heartbeat repository canonicalization and physical CRLF wrapped-progress handling, then add bounded consistency handling for a running snapshot followed by terminal publication and executor-lock removal. Intended plan path: docs/plans/issue-19-runner-windows-residual-repair.md. Exactly two executable tasks. This invocation produces a draft only; it does not write files, implement changes, commit, or update snapshots or trackers.

## Context

- Branch: codex/issue-19-category-move; inspected worktree is clean.

- HEAD and lastReviewedSha: d11bd8c6e39e6a72156ef9593fa0acf73afa2ae4.

- Immutable issueBaseSha: 4f9f11f785c63a65585ea6f33f167fc438272c64.

- Preserve the existing gpt-6.1-sol/high planning, execution and review configuration.

- Runner import, category-move service, observer source-path repair and diagnostic preload repair are completed stages. Do not replay them.

- Primary diagnosis: work/issue-19/windows-observer-residual-repair/diagnosis.json.

- Original Windows failure: https://github.com/kornouhovas/workspace/actions/runs/38182558831, attempt 1, at the inspected HEAD; diagnosis records jobs 114598044002 and 114598044004.

- Exact retained logs: work/issue-19/actions-38182558831-observer-latest-clean.log and work/issue-19/actions-38182558831-observer-2022-clean.log.

- Exact artifacts: work/issue-19/actions-38182558831-observer-artifacts/. Both focused_tests documents identify the exact SHA, run, attempt, platform and Node 22.21.1, with status failed and exitCode 1.

- windows-latest passed 82/89 tests; windows-2022 passed 81/89. Both had zero skips. Five heartbeat tests failed with “Heartbeat task/repository must match the selected runner”; two wrapped-progress tests received deadline instead of progress. Windows 2022 additionally received ownership_unknown instead of failed in the real runner/process failure test.

- Both Windows diagnostic documents collected ordinary current_process and owned_child cases: identified ownership, deadline outcome, allowed PID probes, unchanged inputs and successful fixture/child cleanup. The preload timeout regression passed on both targets. Retain these completed receipts.

- Earlier macOS evidence reproduces the same terminal assertion symptom: work/issue-19/observer-diagnostics-task1/focused-tests-unexpected-red.log, lines 104–128. Neither that log nor the Windows assertion retains the historical state/lock interleaving.

- Relevant files: scripts/ralphex-observe-sources.mjs, scripts/ralphex-observe.mjs, tests/ralphex-observe.test.mjs and docs/ralphex.md.

- Existing inputs and regressions: scripts/ralphex-run.mjs, tests/ralphex-run.test.mjs, scripts/windows-observer-diagnostics.mjs, tests/windows-observer-diagnostics.test.mjs and tests/fixtures/ralphex-progress-formatted.txt.

- heartbeatConfig still uses asynchronous realpath; runner worktree publication and observer source selection use realpathSync. Actual Windows artifacts retain synchronous/asynchronous string inequality.

- scanLog currently retains CR before LF while assembling wrapped JSON. The captured fixture has LF in the inspected local checkout. Saved Windows artifacts do not contain its raw checked-out bytes; historical CRLF attribution is therefore unproven.

- Runner terminal publication precedes owned-lock removal. Separate observer snapshot/lock reads permit the proposed interleaving, but source inspection establishes a possible mechanism, not its historical occurrence.

- Follow AGENTS.md, docs/development.md, docs/ralphex.md, do-task-ralphex and its issue-flow reference. Use Matt Pocock TDD at the already authorized public observe boundary.

- Dependencies: Node 22.21.1 and existing dependencies only. The existing independent Windows matrix needs no workflow edit.

## Development Approach

- Use one public behavioral regression, observed red, minimal implementation and observed green per slice.

- Use disposable runner fixtures and intercepted heartbeat transport; never invoke heartbeat against the live issue or another real task.

- Tests call public observe. Do not export private parser/ownership helpers or add production injection hooks.

- Complete Task 1 and its affected regressions before Task 2. Run the combined three-file Node suite once after both tasks.

- Preserve all existing assertions and original failed receipts. An unexpected failure remains evidence requiring diagnosis; do not retry unchanged inputs toward green.

- Controlled CRLF and terminal interleaving establish their mechanisms only. Keep historical attribution unproven unless exact evidence supports it.

- Exclude product builds, npm test, native/service/UI matrices, framework changes, dependencies, global configuration and workflow edits.

## Implementation Steps

### Task 1: Repair heartbeat canonicalization and physical CRLF wrapped progress

Files:

- Modify: scripts/ralphex-observe-sources.mjs.

- Modify: scripts/ralphex-observe.mjs.

- Modify: tests/ralphex-observe.test.mjs.

- Modify: docs/ralphex.md.

- Reuse unchanged: tests/fixtures/ralphex-progress-formatted.txt and scripts/ralphex-run.mjs.

- [ ] Add a public observe heartbeat regression using a disposable synchronously published runner worktree and a physical directory alias. Establish a controlled synchronous/asynchronous representation mismatch through a narrowly scoped built-in filesystem mock when necessary for deterministic local red evidence. Restore the mock and synchronize ESM exports afterward. Intercept every heartbeat command; assert canonical repository selection, exact fixture task and unchanged runner inputs.

- [ ] Change heartbeat repository selection to the same physical realpathSync representation used by runner publication. Preserve strict task/repository comparisons, opt-in behavior, supported-capability checks and lease bounds. Retain wrong-task and genuinely different-repository controls requiring zero heartbeat transport calls; do not canonicalize recorded foreign ownership metadata into acceptance.

- [ ] Add an explicit physical CRLF wrapped-progress fixture through public observe, independent of checkout newline conversion. Reproduce deadline instead of progress before the parser change. Assert the existing two advisory task values, running status and acceptance not_established; separately exercise restart during a partial continuation.

- [ ] If the controlled regression confirms CRLF framing as the mechanism, remove only the physical CR immediately preceding an encountered LF before wrapped-message assembly. Preserve original input bytes, cursor offsets and progress record from/to positions. Do not strip embedded CR, normalize arbitrary content or change runner completion interpretation.

- [ ] Extend public controls for a CR/LF chunk boundary, observer restart, UTF-8 continuity and the existing 4096-byte bounds. Preserve malformed-message rejection and recovery at the next valid marker, duplicate suppression, byte/inode continuity and bounded summaries. Assert offsets against the actual CRLF byte buffer, including both EOL bytes.

- [ ] Run affected heartbeat, canonical ownership, formatted/wrapped progress, chunk/restart, UTF-8, malformed and bounded-stream regressions under Node 22.21.1. Retain each red/green result and command in fresh ignored evidence. Update docs/ralphex.md with the physical canonical representation and CRLF framing behavior, explicitly distinguishing controlled mechanism evidence from unproven historical attribution.

### Task 2: Handle same-execution terminal publication after ownership uncertainty

Files:

- Modify: scripts/ralphex-observe.mjs.

- Modify: tests/ralphex-observe.test.mjs.

- Modify: docs/ralphex.md.

- Exercise unchanged: scripts/ralphex-run.mjs, tests/ralphex-run.test.mjs and tests/windows-observer-diagnostics.test.mjs.

- [ ] Add a deterministic public observe regression for the exact interleaving: read and retain running current.json bytes; publish a failed terminal snapshot with the same run/execution/directory/worktree; remove the fixture executor lock; return the retained running bytes to the pending read. Use an isolated fs.promises.readFile mock plus syncBuiltinESMExports, forwarding unrelated reads to the original function and restoring/synchronizing the mock in finally. Assert the interleaving was reached and baseline ownership_unknown was observed. Add no private production hook.

- [ ] Introduce at most one additional snapshot read, only after running ownership becomes uncertain. Accept that reread only when it is a valid terminal snapshot of the same initially read and invocation-bound run, execution, canonical directory and worktree. Preserve selected source/log binding and existing cursor mismatch behavior. Keep the operation within the existing observation bounds; add no retry loop, sleep or relaxed ownership comparison.

- [ ] Verify public terminal failure reporting retains the actual exit/signal evidence and source identity, including continuation from an already bound cursor and a fresh invocation. Assert that observation does not mutate runner state, events, log or executor lock, and does not perform runner cleanup.

- [ ] Add rejection controls for a different-execution terminal snapshot, changed run identity, mismatched directory/worktree, unchanged running state with a foreign lock and still-running state with missing/dead/invalid PID or missing/mismatched ownership token. Preserve existing denied PID-probe controls. For unresolved ownership, assert zero heartbeat transport calls and no runner state writes or lock cleanup; observer-owned cursor cleanup remains governed by its existing contract.

- [ ] Run the affected public terminal, real runner/process failure, source-binding, heartbeat-ownership and fail-closed regressions under Node 22.21.1. Retain controlled red/green evidence. Document the change as bounded consistency handling for the observed symptom unless independent historical evidence proves causation; retain the original failed Windows and macOS receipts.

- [ ] With both tasks complete, run once: node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs. Then run npm run lint, npm run typecheck, npm run check:docs and git diff --check. Record actual commands, platform, exit statuses and any failures/skips. Do not add a product build, npm test or unrelated acceptance gate.

## Local Verification Commands Select the installed Node 22.21.1 before every local command: export PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" node --version For each TDD slice, use node --test --test-name-pattern with the selected behavioral test names in tests/ralphex-observe.test.mjs. After both tasks, run the exact combined suite and checks listed in Task 2.

## Post-Completion: Coordinator-Owned Gates These are outside executable Task checkboxes.

- Perform the separate review against lastReviewedSha d11bd8c6e39e6a72156ef9593fa0acf73afa2ae4; keep issueBaseSha fixed. Review identity guards, bounded reread semantics, physical byte offsets, mock restoration and diagnosis claims.

- Complete verified local commits and the already authorized task-branch push through the coordinator delivery flow. No main merge is authorized.

- Monitor the existing windows-latest/windows-2022 matrix for the exact delivered SHA, run and attempt. Inspect original job logs and diagnostic/test-status artifacts, including actual test exits, completeness, unchanged inputs and cleanup.

- Require both actual Windows focused suites to pass with the original assertions retained. Local controlled regressions do not establish Windows acceptance or historical attribution.

- Preserve every original failed receipt. Update diagnosis, coordinator snapshot and trackers only in the coordinator phase, recording reproduction kind, red/green evidence, actual platform verification and remaining attribution limits.

- Keep category-move UI, deferred service-fixture diagnostics and whole-issue completion outside this repair stage.

## Completion Criteria

- Exactly two executable tasks with public-boundary TDD and proportionate verification.

- Heartbeat uses the runner’s physical canonical representation while strict repository/task guards remain intact.

- Physical CRLF wrapped progress survives chunk boundaries and restart with actual byte continuity, bounded parsing and malformed rejection.

- One bounded ownership-uncertainty reread can recognize only the same bound execution’s terminal snapshot; foreign or unresolved running ownership remains rejected.

- Historical terminal cause and CRLF attribution remain explicitly unproven where evidence is absent.

- Actual Windows acceptance, review and delivery remain coordinator-owned gates.
