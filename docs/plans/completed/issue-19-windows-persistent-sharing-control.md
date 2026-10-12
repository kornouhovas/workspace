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

- [x] Add deterministic controls using createRuntimeSourceDisconnect and heldSourceControl without copying the helper. Cover expiry before the next loop, after validation before the next rename, and after completed effect verification. Retain at least one blocked attempt in each control.
- [x] Establish the post-validation regression as red against the current assertion. Require exact expected blocked-attempt counts, finite observations, deadline failure, confirmed holder exit and settled move; verify before-loop/post-effects controls retain completed effect verification.
- [x] Replace the unconditional persistent verificationComplete assertion with strict boolean validation and exhaustion-specific requirements. Attempts exhaustion must retain 20 blocked attempts and completed effect verification. Deadline exhaustion must retain existing elapsed-time and blocked-attempt bounds while allowing incomplete effect verification; it remains a failed move.
- [x] Independently capture and compare source identity and the complete no-follow tree before execution and after confirmed holder exit. Verify exact entries and bytes/link texts, unchanged unrelated data, and absent destination, without relying on helper observation flags.
- [x] Add focused negative regressions proving changed identity, placement/content, or malformed observations cannot pass the revised control. Verify a failed helper rejects another move without additional rename calls; retain settlement and cleanup protections. Add no sleeps or increased bounds.
- [x] With Node 22.21.1, run node --import tsx --test tests/runtime-source-disconnect.test.mjs, then node --import tsx --test tests/runtime-lifecycle.test.mjs tests/windows-rename-diagnostics.test.mjs. Reuse built inputs only after verifying relevant input continuity; defer checks requiring stale outputs until rebuilding is safe.
- [x] Run targeted ESLint for tests/runtime-source-disconnect.test.mjs, npm run check:docs and git diff --check. Inspect the scoped diff; record exact commands, exits, evidence paths, input identities and platform skips in work/issue-19/windows-persistent-sharing-repair/. Commit only completed verified task paths and archive this plan with valid links.

## Local Task 1 evidence

Implemented only [the shared holder controls](../../../tests/runtime-source-disconnect.test.mjs); the production helper, holder script, retry limits and real default clock are unchanged. The three deterministic deadline controls each retain exactly one blocked rename, elapsedMs 2000, confirmed simulated holder exit, settled failed move and rejection of another move without replay. Only the post-validation boundary has verificationComplete false. Attempts exhaustion retains exactly 20 blocked renames, elapsedMs 1900 and completed effect verification.

Independent pre-execution/post-holder captures compare source dev/ino/birthtimeNs and the complete fixture tree, including exact entries, literal bytes, link texts and unrelated data; destination absence is checked separately. Negative controls mutate identity with an identical tree, placement, nested binary bytes, added/removed entries, link text and unrelated bytes after helper settlement. Malformed observations and uncertain failure codes remain rejected. Existing readiness, release, no-holder, timeout, settlement and cleanup controls remain present.

All evidence is retained beneath `/Users/aleksandersk/Documents/programming/Projects/project_folder/.worktrees/issue-19-category-move/work/issue-19/windows-persistent-sharing-repair/`. Commands below used `PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH` on macOS:

| Command | Actual exit and result | Evidence file |
| --- | --- | --- |
| `node --import tsx --test --test-name-pattern='persistent deadline after validation' tests/runtime-source-disconnect.test.mjs` | 1 before repair: exact false !== true at the original persistent verificationComplete assertion; 0 after repair: 1 passed | `red.log`, `green-validation.log` |
| `node --import tsx --test --test-name-pattern='persistent deadline\|persistent observations\|persistent post-holder\|portable .* holder orchestration' tests/runtime-source-disconnect.test.mjs` | 0; 13 passed, no skips | `green-controls.log` |
| `node work/issue-19/windows-persistent-sharing-repair/verify-inputs.mjs` | 0; current-source in-memory esbuild bundle exactly equals existing dist/service/settings.mjs; all 12 migration files and names match; no dist writes | `input-continuity-final.log`, `input-identities.json`, `verify-inputs.mjs` |
| `node --import tsx --test tests/runtime-source-disconnect.test.mjs` | 0; 107 passed, 4 Windows-only skips, no failures | `source-disconnect-final.log` |
| `node --import tsx --test tests/runtime-lifecycle.test.mjs tests/windows-rename-diagnostics.test.mjs` | 0; 69 passed, 3 Windows-only skips, no failures | `lifecycle-diagnostics.log` |
| `node node_modules/eslint/bin/eslint.js tests/runtime-source-disconnect.test.mjs` | 0 | `eslint.log` |
| `npm run check:docs` | 0; 106 Markdown files checked, including archived plan links | `docs-final.log` |
| `git diff --check` | 0; scoped test/plan diff inspected | `diff-final.log`, `scoped-final.diff` |

The input identity record covers 136 bundled source inputs plus emitted settings, migrations, dependency resolution, installed SQLite prebuild/native resources, relevant scripts, tests and holder. The first continuity command assumed an absent legacy SQLite build path and exited 1; `input-continuity-path-error.log` preserves that tooling error. The corrected command identifies the actual installed platform prebuild and passes. `source-disconnect.log` retains an earlier passing full affected run; the final run includes the junction-safe identity-copy control.

These portable injected controls prove the deadline/assertion mechanism and local repair only. Historical Windows scheduling and handle ownership remain unproven. Actual Windows controls were skipped locally and remain external acceptance gates.

## Follow-up review repair

Both independent follow-up perspectives confirmed that the new attempts-exhaustion `elapsedMs < 2000` assertion exceeded the unchanged helper contract. The helper checks the deadline before classifying exhaustion, then samples elapsed again when recording the failure; that final observation may cross 2000 ms. Removed this assertion and its malformed-observation expectation while retaining exactly 20 blocked attempts, completed effect verification, finite nonnegative elapsed, failed move and independent unchanged-state checks. The production helper and all retry/holder bounds remain unchanged.

Added a deterministic control through the same real helper/holder seam: only the failure-observation clock read crosses 2000 ms after 20 blocked attempts. It verifies settled attempts exhaustion, completed effects, confirmed simulated holder exit and rejection of replay. With Node 22.21.1 on macOS, this regression exited 1 before the assertion repair (`regression-red.log`); the complete affected suite then exited 0 with 108 passed and 4 Windows-only skips (`source-disconnect-green.log`). Targeted ESLint exited 0 (`eslint.log`). Evidence and both full review reports are retained under `work/issue-19/windows-persistent-sharing-review/`.

All 184 previously identified inputs matched before repair (`prior-check-continuity.log`). After repair, only the affected test input changed; the other 183 input hashes still match (`reused-check-inputs.log`). Reuse the prior lifecycle/diagnostics result (69 passed, 3 Windows-only skips) and current-source/built-output continuity evidence for those unchanged inputs. Documentation links and diff whitespace are checked again after this plan update. This injected regression proves the assertion defect; historical Windows scheduling/handle ownership and original-scenario acceptance remain unproven and coordinator-owned.

## Coordinator-owned gates

Perform separate review of assertion strictness, independent filesystem checks, regression evidence and cause-claim limits. Push only under existing authorization after review. Obtain a new reviewed exact-SHA Windows-2022 original npm test result and inspect the persistent-sharing control outcome; inspect required Windows-latest results separately. Original-scenario verification stays pending until actual Windows evidence passes. Portable injected controls and platform skips establish no Windows acceptance.

The in-flight UI Actions remains independently monitored. Actual graphical category runtime work follows only after inspecting actual Windows UI feedback. No issue closure or main merge from this stage.
