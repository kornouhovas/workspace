# Issue #19: Bounded runner startup fixture repair

## Overview

Create docs/plans/issue-19-runner-startup-fixture.md with
one executable task. Repair runningFixture startup
observation so a healthy delayed worker can start within a
bounded test-only wait. Detect worker launch errors,
premature exits and stalled readiness with useful
diagnostics and finite cleanup.

## Context

  - Issue:
https://github.com/kornouhovas/workspace/issues/19; linked
Beads step: workspace-31i.12.
  - HEAD: f1fd515ce552c798e533fccdea58939c4852cbf4.
  - Issue base: 4f9f11f785c63a65585ea6f33f167fc438272c64.
  - Last reviewed SHA:
e37625b366640b157d1fb2689b52abf00767bf54.
  - Modify tests/ralphex-observe.test.mjs. Modify
tests/fixtures/ralphex-observer-worker.mjs only if needed
for actual-process regression controls.
  - Follow existing disposable Git fixtures, actual worker
spawning, public runner state and observer/CLI assertions.
  - Retained evidence:
work/issue-19/runner-startup-diagnosis/diagnosis.json,
delay-worker.mjs, delayed-start-red.log and
ordinary-probe.log.
  - Windows run 38290828362 failed the quiet fixture
readiness assertion after 2500 ms. Injecting a 2800 ms
worker startup delay reproduces that assertion locally;
the ordinary focused command passes.
  - Historical Windows startup-versus-exit attribution
remains unproven.
  - work/ralphex/issue-19/current.json describes the
preceding workflow repair. Preserve it; the coordinator
owns current phase reconciliation, delivery, trackers and
CI observation.
  - Dependencies: existing Node 22.21.1, Git and installed
ESLint. No new dependency.

## Development Approach

  - Testing approach: TDD at the actual worker startup
readiness seam.
  - Complete this single task, including new regressions
and all affected checks, before handoff.
  - Use a minimal test-local helper and controlled process
timing. Keep every readiness and cleanup wait finite.
  - Preserve actual runner/process execution, state
identity, ownership, locks, exit evidence, CLI behavior
and cleanup assertions.
  - Preserve deliberate failure/throw scenarios as
explicit expected failures; never classify their terminal
failures as healthy startup.
  - Change no production observer/runner deadline,
polling, concurrency, ownership or policy. Preserve CI
scheduling reduction and existing changes.
  - Do not disable tests or use unchanged reruns as proof.
  - Do not run unchanged native, layout, packaging or full
application checks for this fixture-only repair.
  - Execution uses gpt-6.1-sol:medium; planning and
separate review use high.

## Implementation Steps

### Task 1: Repair and verify bounded actual-worker startup observation
Files:
  - Modify: tests/ralphex-observe.test.mjs.
  - Modify if necessary:
tests/fixtures/ralphex-observer-worker.mjs.
  - Include:
docs/plans/issue-19-runner-startup-fixture.md.
  - Retain ignored evidence under
work/issue-19/runner-startup-diagnosis/.
  - [x] Record starting SHA and hashes of the test,
worker, executor, retained preload and relevant
runner/observer/diagnostic inputs. Preserve existing red
and ordinary-probe logs. Add actual-process regressions
for healthy startup beyond 2500 ms, premature worker exit,
launch error and a worker stalled in ready. Capture the
new regression failures before repairing runningFixture;
avoid tests that merely mirror helper internals.
  - [x] Replace the fixed 2500 ms assertion with bounded
test-only startup observation that tolerates the retained
2800 ms healthy delay. Register worker error and exit
observation immediately after spawn, detect those failures
promptly and retain elapsed time, last state, exit
code/signal, launch error and a bounded worker-log
excerpt. Require valid published startup or an explicitly
interpreted terminal outcome; ready, stalled and failed
workers must never establish healthy startup.
  - [x] Make failure and teardown paths finite, including
spawn errors that never emit exit. Reap only owned fixture
processes before removing their disposable roots. Test
cleanup for delayed success, early exit/error and
stalled-ready timeout. Preserve worker/executor ownership
and existing lock/state/CLI assertions; cleanup failure
remains failure.
  - [x] Run the new focused regressions and the retained
preload command: node --import
./work/issue-19/runner-startup-diagnosis/delay-worker.mjs
--import tsx --test --test-name-pattern="real
runner/process quiet preserves"
tests/ralphex-observe.test.mjs. Require green results
after the repair and retain actual commands, numeric exits
and logs alongside their red evidence. Verify ordinary
quiet, noisy, failure and throw modes, observer
cancellation and dead-launcher behavior.
  - [x] Run the complete affected pure-Node suite once
against the repaired inputs: node --test
tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs
tests/windows-observer-diagnostics.test.mjs. Require exit
zero, zero failures and zero skips. Preserve any
unexpected failure and diagnose it before another
invocation.
  - [x] Run targeted ESLint on changed test/fixture files
with --max-warnings=0, npm run check:docs and git diff
--check. Update the ignored diagnosis with hashes,
platform/Node/SHA, red/green controls, cleanup results,
actual commands and remaining gates. Keep historical cause
unproven and original Windows verification pending. Record
completion evidence in the plan; no unrelated
documentation changes are needed.
  - [x] Inspect the final diff for test-only scope and
preserved CI scheduling. Stage only verified task files
and this plan, create an English local commit and report
Task 1/1 progress, checks, evidence and actual commit. Do
not push, write trackers, change global configuration or
begin implementation beyond this task.

## Post-Completion

The coordinator performs separate review against the
recorded review base, authorized delivery and exact-SHA
Windows acceptance. Local injected regressions establish
fixture robustness, not the cause of the historical
Windows failure or completion of Issue #19. These external
gates remain outside executable task checkboxes.


## Direct Execution Verification

The user stopped Ralphex and requested direct diagnosis, repair and focused CI before full acceptance. No Ralphex review receipt is claimed.

- The actual worker delayed by 2800 ms failed the former 2500 ms readiness assertion before repair. The new real-process regression and original preload now pass.
- Fixture startup waits at most ten seconds, observes launch error/close, retains bounded state/exit/log evidence, and reaps the owned worker before root removal. Early exit, ENOENT and bounded ready-state expiry remain failures. Production observer/runner deadlines and ownership are unchanged.
- Local affected checks: 256 passed, zero failures/skips; targeted ESLint and documentation links passed. Full logs are under `work/issue-19/actions-diagnosis/` and `work/issue-19/runner-startup-diagnosis/`.
- Historical Windows worker delay versus premature failure remains unproven. Actual Windows focused acceptance is pending.
- Separate authorized CI work adds manual failed-check scheduling and existing privacy-safe typed Reveal receipt capture to the rename driver. The macOS Actions rejection remains unproven; a local attempt acknowledged Reveal successfully and separately failed Electron shutdown. Neither result is waived.
- Coordinator owns focused Actions, receipt inspection, any remaining repair and full CI only after focused success.
