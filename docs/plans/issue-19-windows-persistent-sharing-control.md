# Issue 19: Bounded Windows persistent-sharing control repair

## Overview

Repair the persistent-holder test assertion for legitimate deadline exhaustion before effect verification. Keep uncertain outcomes as failures and independently verify unchanged filesystem state after holder exit.

## Context

- Requirement: https://github.com/kornouhovas/workspace/issues/19; Beads workspace-31i.12.
- This plan materializes the preserved read-only Ralphex draft at work/issue-19/windows-persistent-sharing-diagnosis/plan-draft.md, reviewed in reviewed-planning.json. Do not replan or repeat completed runner, service, readiness or UI work.
- Safe boundary confirmed: UI execute and separate review exited zero and were reaped; last reviewed SHA d7747967dc95497981d6f9f6b28925b1355274d4 pushed. Exact-SHA Actions 38237915838 is coordinator-owned and may run concurrently with this isolated local test repair.
- Original failure: Windows-2022 run 38226803150, attempt 1, verify job 114736201800, npm test at SHA 1eb5b4f1e1b6dd21f911a1b49760f70c6402ebfd.
- Evidence: work/issue-19/windows-persistent-sharing-diagnosis/diagnosis.json and control.log, validation-deadline.log, loop-deadline.log and effects-deadline.log.
- Controlled probes reproduce the assertion failure when the deadline crosses after validation and before another rename. They establish a mechanism; historical scheduling and handle ownership remain unproven.
- Follow scripts/runtime-source-disconnect.mjs, its existing private dependency seam, and the runtime source-disconnect section of docs/development.md. Read actual AGENTS.md and installed Matt Pocock implement/tdd.
- Use Node 22.21.1 explicitly: /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin. Nested login shells can reset PATH.
- No new dependencies.

## Development Approach

- TDD at the existing real-helper/shared-holder orchestration boundary; one executable test-only task.
- Preserve actual Windows holder readiness, real blocked EPERM rename, default real clock, 2,000 ms/20-attempt limits, awaited settlement and cleanup.
- Preserve release/no-holder positive controls and existing negative controls.
- Exclude production helper, retry/deadline, evidence-schema, CI, dependency, service and UI changes.
- Executor must not run full npm test, rebuild/clean shared dist, retry Actions, push, merge or write trackers. No new coverage target or unrelated documentation changes.

## Implementation Steps

### Task 1: Repair persistent-control assertions and verify deadline boundaries

Files:
- Modify: tests/runtime-source-disconnect.test.mjs.
- Modify this plan for checked completion and concise evidence; archive when complete.

- [ ] Add deterministic controls using createRuntimeSourceDisconnect and heldSourceControl without copying the helper. Cover expiry before the next loop, after validation before the next rename, and after completed effect verification. Retain at least one blocked attempt in each control.
- [ ] Establish the post-validation regression as red against the current assertion. Require exact expected blocked-attempt counts, finite observations, deadline failure, confirmed holder exit and settled move; verify before-loop/post-effects controls retain completed effect verification.
- [ ] Replace the unconditional persistent verificationComplete assertion with strict boolean validation and exhaustion-specific requirements. Attempts exhaustion must retain 20 blocked attempts and completed effect verification. Deadline exhaustion must retain existing elapsed-time and blocked-attempt bounds while allowing incomplete effect verification; it remains a failed move.
- [ ] Independently capture and compare source identity and the complete no-follow tree before execution and after confirmed holder exit. Verify exact entries and bytes/link texts, unchanged unrelated data, and absent destination, without relying on helper observation flags.
- [ ] Add focused negative regressions proving changed identity, placement/content, or malformed observations cannot pass the revised control. Verify a failed helper rejects another move without additional rename calls; retain settlement and cleanup protections. Add no sleeps or increased bounds.
- [ ] With Node 22.21.1, run node --import tsx --test tests/runtime-source-disconnect.test.mjs, then node --import tsx --test tests/runtime-lifecycle.test.mjs tests/windows-rename-diagnostics.test.mjs. Reuse built inputs only after verifying relevant input continuity; defer checks requiring stale outputs until rebuilding is safe.
- [ ] Run targeted ESLint for tests/runtime-source-disconnect.test.mjs, npm run check:docs and git diff --check. Inspect the scoped diff; record exact commands, exits, evidence paths, input identities and platform skips in work/issue-19/windows-persistent-sharing-repair/. Commit only completed verified task paths and archive this plan with valid links.

## Coordinator-owned gates

Perform separate review of assertion strictness, independent filesystem checks, regression evidence and cause-claim limits. Push only under existing authorization after review. Obtain a new reviewed exact-SHA Windows-2022 original npm test result and inspect the persistent-sharing control outcome; inspect required Windows-latest results separately. Original-scenario verification stays pending until actual Windows evidence passes. Portable injected controls and platform skips establish no Windows acceptance.

The in-flight UI Actions remains independently monitored. Actual graphical category runtime work follows only after inspecting actual Windows UI feedback. No issue closure or main merge from this stage.
