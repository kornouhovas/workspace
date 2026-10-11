# Issue 18 control receiver deadline repair

## Overview

Correct expired first-poll classification in the disposable service fixture. An active receiver whose first poll starts after its deadline must report exactly one timeout, consume no command and stop further callbacks. Real filesystem and protocol failures remain errors.

Create this one-task plan at docs/plans/issue-18-control-deadline-repair.md. Planning does not start implementation.

## Context

- Issue: https://github.com/kornouhovas/workspace/issues/18. Linked execution step: workspace-31i.11; tracker updates belong to the coordinator.
- Owned files: tests/fixtures/project-rename-service-control.cjs, tests/project-rename-fixture.test.mjs and this plan.
- Task snapshot: work/issue-18/ci-38150033449/control-repair-task.md.
- Diagnosis: control-diagnosis.json, late-control-red.log and control-probes.json in that ignored directory.
- Actions run 38150033449 at 49fcc6683c3ddbde16debf8b2001ea3408bad31b failed macOS npm test because the fixture expected timeout and observed error.
- The original ignored late-control-poll-repro.mjs exercises the actual receiver in an empty real temporary directory. A bounded 45ms real-clock event-loop stall reproduces the classification defect.
- Proven defect: beforeDeadline at poll entry throws into generic onError; expiry detected after reads invokes onTimeout. Historical CI scheduling/filesystem attribution remains unproven.
- Related patterns: withControlRoot, receive, bounded callback observations, disposable command records, strict fixture failure assertions and executable input digests.
- Dependencies: Node.js 22.21.1, installed locked dependencies, tsx and valid existing Electron/native/emitted inputs. No new dependencies.
- Skill sources: installed Matt Pocock diagnosing-bugs and tdd under ~/.codex/plugins/cache/mattpocock/mattpocock-skills/1.3.1/skills/engineering, plus ~/.codex/skills/do-task-ralphex/SKILL.md and references/issue-flow.md.

## Development Approach

- Testing approach: TDD at the already agreed actual startControlReceiver orchestration boundary.
- Add and observe the behavioral regression failing before changing the helper. Exercise callbacks and real disposable command records.
- Complete the single task fully; all required checks must pass before completion.
- Every code-changing task includes new or updated behavioral tests.
- Preserve finite deadline validation, existing timeout values, atomic publication and ack/exit ordering. All expiry outcomes remain failed fixture outcomes.
- Use bounded controlled clock/timer advancement or the established real event-loop delay. Restore mocks, dispose receivers and remove temporary roots even on failure.
- Reuse unchanged valid build inputs for focused checks. Record why reuse is valid; never build or clean while fixtures consume dist.
- Use run-local gpt-6.1-sol/high only. Change no global configuration and enable no notifications or automatic finalization.
- Preserve docs/plans/issue-18-project-rename-ui.md committed in 8f041fda. Production/runtime, UI, native Reveal, unrelated shutdown, dependencies and CI configuration are outside scope.
- Do not introduce generic scheduler/process abstractions, retries, deadline increases, duplicate callbacks or permissive failure assertions.

## Implementation Steps

### Task 1: Repair expired poll entry and verify strict control outcomes

**Files:**
- Modify: tests/fixtures/project-rename-service-control.cjs.
- Modify: tests/project-rename-fixture.test.mjs.
- Create/update: docs/plans/issue-18-control-deadline-repair.md.
- Ignored evidence only: work/issue-18/ci-38150033449/.

- [x] Inspect actual checkout, status, Node version and required existing build inputs; preserve unrelated changes. Run node work/issue-18/ci-38150033449/late-control-poll-repro.mjs before the repair and capture its red timeout-versus-error assertion without overwriting historical evidence.
- [x] Add a bounded behavioral regression through actual startControlReceiver that dispatches its first poll after expiry. Cover an empty real root and a ready command record; require exactly one timeout, no ack/exit/error, unchanged command bytes and no later callbacks after disposal or further timer advancement. Capture the new regression failing against the unchanged helper.
- [x] Make the smallest explicit expired-entry correction before command reads. Guard disposed callbacks, dispose the active receiver before reporting timeout and return immediately. Preserve invalid-deadline handling and the existing generic error path; never classify arbitrary caught errors as timeout solely because time elapsed.
- [x] Preserve or extend behavioral filesystem/read/protocol negative controls, including an active read that starts before expiry but rejects after clock advancement, to prove genuine failures still report error rather than being reclassified. Retain strict atomic publication, ordered acknowledgment/exit, single callbacks and disposal assertions. Run the new regression green and rerun the unchanged original 45ms repro green.
- [x] With Node 22.21.1 selected, run node --import tsx --test tests/project-rename-fixture.test.mjs against valid retained outputs, capturing fresh WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR artifacts beneath the ignored evidence directory. Run node --test --test-name-pattern='supervisor parser|CRLF framing|stdout cannot pass' tests/project-rename-native.test.mjs. Require selected protocol/supervisor tests and all supported fixture controls to pass, preserving their precise failure expectations.
- [x] After focused checks pass, run npm test once against final helper code for integration; it performs the build and full suite. Run ./node_modules/.bin/eslint tests/fixtures/project-rename-service-control.cjs tests/project-rename-fixture.test.mjs --max-warnings=0, npm run check:docs and git diff --check. Record failures and platform skips truthfully; resolve affected failures within the owned scope before completion.
- [x] Record finite commands, versions, input identity, red/green results and remaining gates under the ignored evidence directory. Inspect final callback/control artifacts and the scoped diff, update this plan with actual execution evidence, rerun documentation/diff checks after plan edits and commit only the three explicit owned paths. Report the existing commit and actual checks in Russian.

## Completion Criteria

The original reproduction and new receiver regression pass; expired entry emits one timeout without consuming commands or invoking later callbacks. Genuine read/protocol failures retain their error outcomes. Focused checks, final npm test, scoped ESLint and documentation/diff checks pass, and verified owned changes are locally committed.

No percentage coverage gate or additional documentation task is introduced for this bounded fixture repair.

## Task 1 execution evidence

- Executed on macOS arm64 with Node v22.21.1, selected through a command-local PATH prefix. Starting HEAD was 96d81ea3ae042e1017329b70259b166133c23a00; the checkout was clean. The issue base remains a5728daa64caab6b90700854ad5e27417fcf683e. The inspected run-local profile uses gpt-6.1-sol/high with notifications and finalization disabled; global configuration was unchanged.
- Fresh ignored evidence is under work/issue-18/ci-38150033449/control-deadline-executor/. Historical diagnosis and reproduction logs were preserved. checks.json records finite commands, exit codes and test counts; execution-context.json retains scope, fixed SHAs and external gates.
- Before repair, the unchanged 45ms reproduction failed with exactly `error` instead of `timeout` (original-red.log). Both new first-poll regressions also failed on that same assertion against the unchanged helper (regression-red.tap). After repair, both pass (regression-green.tap), and the unchanged reproduction reports exactly `timeout` (original-green.log).
- The controlled clock/timer regressions use real disposable roots, including exact ready command bytes. They verify one timeout, no consumption and no later callbacks after timer advancement or disposal. The new real ENOTDIR read control starts before expiry, rejects after clock advancement and reports exactly one error. All ten selected control tests pass (control-green.tap), including existing atomic publication, protocol ordering and disposal controls.
- Focused fixture verification passed 23/23 with no skips (fixture-focused.tap); selected supervisor/parser and actual Electron development/ASAR framing controls passed 10/10 with no skips (protocol-focused.tap). Fresh focused artifacts retain every precise failure expectation; a `skipped` scenario remains a failed fixture outcome.
- Retained build inputs were reused only for focused checks: relevant production sources predate the inspected outputs and no production source, contract, native source or locked dependency changed. inputs-before.json records hashes and timestamps. The initial executable digest was 13cfad80d285f823dcca4192f6044c2e1fef5e686b339fd64272251519855848; after the helper repair, focused artifacts record 6f5e86efea1ba5b501978b26b185979548064227f11d4e64efdd4e2d4e326144. No build or cleanup overlapped those fixtures.
- A single final `npm test` rebuilt all outputs and passed: 1623 tests, 1603 passed, zero failed/cancelled, 20 Windows-only platform skips (npm-test.log). Those skips do not establish Windows acceptance. inputs-final.json confirms unchanged production inputs and final executable digest fa6dc0f1a40ae51b8f6f512a55d54aee5d6cbd127154845a93b26408c3e64035. All eleven inspected integration artifacts share that digest and confirm shutdown; cleanup fails only for its deliberate negative control (integration-artifact-summary.json).
- Scoped ESLint passed with zero warnings (eslint.log). Documentation links and diff whitespace checks passed before plan edits and were rerun after this evidence update (docs-final.log, diff-final.log). Only the three owned paths are included in the local task commit; its SHA is reported at handoff and retained in the ignored evidence receipt.
- Separate review, task-branch publication, exact-SHA Actions rerun and CI artifact interpretation remain coordinator-owned gates. No tracker, push, merge, release, signing or global configuration action was performed. Historical CI scheduling/filesystem attribution remains unproven.

## Post-Completion

The coordinator owns separate Matt/Ralphex review, task-branch push, exact-SHA Actions rerun, artifact interpretation and tracker updates. The executor performs none of those actions.

Historical Actions run 38150033449 remains failed. Its original cause remains unproven, and actual CI verification remains pending until the coordinator observes the rerun. Local repair evidence establishes the expired-entry behavior only.
