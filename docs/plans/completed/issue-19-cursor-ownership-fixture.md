# Issue #19: Deterministic cursor ownership fixture

## Overview

Replace only the arbitrary 20 ms competing-lock timer in
the failing ownership fixture with a scoped filesystem
intervention after owned token publication. Preserve
completed Issue #19 work and all production behavior.

## Context

- Plan destination:
docs/plans/issue-19-cursor-ownership-fixture.md.
- Modify: tests/ralphex-observe.test.mjs.
- Evidence/documentation: this plan and its eventual
completed archive only; execution logs belong under
ignored work/issue-19/cursor-ownership-fixture-repair/.
- Read-only references: scripts/ralphex-observe.mjs,
docs/ralphex.md, docs/development.md.
- Starting HEAD and failed Actions SHA:
1c44ee960b2449bf522a0e76ae4a9754e437bc78.
- Retained diagnosis:
work/issue-19/actions-38256883847-failure/diagnosis.json,
startup-red.log, ownership-control.log and
cursor-ownership-probe.mjs.
- Actions 38256883847, attempt 1, windows-latest job
114837123234 failed npm test with Missing expected
rejection in “losing cursor ownership cannot publish or
remove a competing observer cursor”.
- startup-red.log records reached=true,
foreignWritten=true and ownedPublicationAfterForeign=true;
rejection was missing, cursor was published and foreign
lock was not preserved. Runner inputs and mock restoration
checks passed.
- ownership-control.log records confirmed
post-publication intervention, expected rejection, absent
cursor, preserved foreign lock and unchanged runner
inputs/restored mocks.
- Controlled startup race is proven. Historical Windows
interleaving and timing cause remain unproven. The
unchanged observer correctly rejects the demonstrated
post-publication ownership loss.
- Dependencies: existing Node 22.21.1, node:test and
installed lint tooling. No new dependencies. Executor
profile: gpt-6.1-sol/high.

## Development Approach

Use focused public-boundary fixture tests. The ownership
control already passes against unchanged production; do
not claim this fixture repair requires a production fix.
Keep budgetMs=90, pollMs=10 and real host time. Follow
existing sequential scoped builtin-mock patterns. No
private observer hooks, production mutations, sleeps,
retries, deadline increases or relaxed assertions.
Only the test file and plan/archive may change. Preserve
completed plans, tracker history, production
observer/source/runner/diagnostic files, dependencies,
workflows, readiness, service, renderer and runtime/layout
fixtures.

## Implementation Steps

### Task 1: Replace the timer and verify fixture sensitivity and restoration
Files:
- Modify: tests/ralphex-observe.test.mjs.
- [x] Record starting HEAD, Node/platform, allowlisted
file identities and relevant unchanged input hashes in
ignored evidence. Retain the diagnosis and both actual
probe logs with their probe identity and recorded exits.
Keep historical failure, injected mechanism and passing
ownership control distinct.
- [x] Replace the timer with a minimal scoped
fsPromises.readFile wrapper synchronized through
syncBuiltinESMExports. Intervene exactly once for this
fixture’s canonical cursor-lock path. Read and validate
the actual published owned token and PID through the
original filesystem operation before writing the foreign
token; then forward the guarded read to the real
filesystem so it returns the foreign token. Assert that
the boundary was reached and takeover occurred. Forward
unrelated operations unchanged.
- [x] Retain the public observe call and require the
exact Observer cursor ownership lost message, ENOENT for
the cursor, and the exact retained foreign-lock payload.
Add byte-for-byte before/after assertions for
current.json, executor.lock and full.log. Do not accept
EEXIST, an injected exception or an assertion failure as
the ownership rejection.
- [x] Restore fsPromises.readFile and synchronized named
builtin exports in finally before invariant assertions,
including rejected observation and thrown-check paths.
Await observation settlement before restoring. Verify
restored function identities, then perform an independent
public observe using a fresh fixture/cursor, requiring
identified ownership, expected healthy outcome and normal
owned-lock cleanup. Independently recheck the original
foreign lock.
- [x] Add tight restoration controls for successful
observation, ownership rejection and a deliberately thrown
assertion after observation settles. Require the
appropriate exact outcome for each control and an
independent public observation after restoration.
- [x] Demonstrate red/green sensitivity using a
disposable standalone copy of the exact repaired fixture.
With takeover disabled, confirm the same boundary sees the
owned token but no foreign write occurs: the
ownership-rejection assertion must fail with Missing
expected rejection and exit nonzero. Enable only the
takeover and require exit zero, exact ownership rejection,
absent cursor, preserved foreign lock and unchanged runner
inputs. Both runs must restore builtins. Retain complete
logs, commands and actual exits; the deliberately red
invocation must remain red. Do not mutate production or
treat the retained pre-publication race probe as a failing
production regression.
- [x] Run the repaired test alone with node --test
--test-name-pattern="^losing cursor ownership cannot
publish or remove a competing observer cursor$"
tests/ralphex-observe.test.mjs. Then run the original focused
integration command node --test
tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs
tests/windows-observer-diagnostics.test.mjs. Record
failures, skips and cancellations honestly; all applicable
ordinary checks must pass.
- [x] Run npx --no-install eslint
tests/ralphex-observe.test.mjs --max-warnings=0 and
inspect the complete allowlisted diff. Verify unchanged
budgets, polling, production inputs and completed Issue
#19 work before proceeding.
### Task 2: Record bounded evidence and validate documentation
Files:
- Modify:
docs/plans/issue-19-cursor-ownership-fixture.md.
- Archive the completed plan through the existing Ralphex workflow after all executable checks pass.
- [x] Add concise execution evidence to the plan: actual
commands/exits, red/green boundary markers, focused test
totals, restoration/invariant results, starting revision,
input identities and ignored full-log pointers. Preserve
the historical cause as unproven and actual Windows
verification as pending.
- [x] Run npm run check:docs and git diff --check after
final documentation or archival changes. Inspect the final
diff and confirm only the allowed test and plan/archive
paths changed. Reuse the verified focused test evidence
when only prose/archive paths changed.

## Execution evidence

Task 1 started at `e940d96783558cccbd5771ad52e8d01ff64a0a3e`
and was committed as `beb4d95e54eda0de0aab332690bc0cd72cd15e82`.
Task 2 starts at that implementation commit. The fixed issue base remains
`1c44ee960b2449bf522a0e76ae4a9754e437bc78`. Task 1 ran with Node
22.21.1 on darwin arm64, OS release 27.0.0; documentation checks use the
same installed Node version through a process-local PATH.

All evidence paths below are repository-relative ignored files beneath
`work/issue-19/cursor-ownership-fixture-repair/`; they are local evidence,
not published artifacts. `task1/starting-inputs.json` records the initial
allowlisted hashes and 321 unchanged input identities. Task 2 independently
verified all 321 hashes and the repaired test hash
`fb4b15bca78f980c8f259338fe994712ace5380e7dfdabc53fb822cbda062a49`,
retaining the result in `task2/input-continuity.json`. No production,
dependency, workflow, completed Issue #19 plan or runtime fixture input changed.
The fixture still uses real host time, `budgetMs=90` and `pollMs=10`.

Task 1 commands and actual results (full logs and command/exit JSON are
retained under `task1/`):

| Command | Exit | Result | Full log |
| --- | --- | --- | --- |
| `node work/issue-19/cursor-ownership-fixture-repair/task1/exact-repaired-fixture.mjs red` | 1 | Expected deliberate red: Missing expected rejection | `task1/sensitivity-red.log` |
| `node work/issue-19/cursor-ownership-fixture-repair/task1/exact-repaired-fixture.mjs green` | 0 | Exact Observer cursor ownership lost rejection | `task1/sensitivity-green.log` |
| `node --test --test-name-pattern="^losing cursor ownership cannot publish or remove a competing observer cursor$" tests/ralphex-observe.test.mjs` | 0 | 1 passed; 0 failed, skipped, cancelled or todo | `task1/focused-test.log` |
| `node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs` | 0 | 124 passed; 0 failed, skipped, cancelled or todo | `task1/focused-integration.log` |
| `npx --no-install eslint tests/ralphex-observe.test.mjs --max-warnings=0` | 0 | No lint errors or warnings | `task1/lint.log` |

Both standalone sensitivity runs reached the actual published owned token
and restored builtins. Red disabled only takeover: `reached=true`,
`ownedTokenRead=true`, `foreignWritten=false`, observed `deadline`,
`cursorAbsent=false`, `foreignLockPreserved=false`, `inputsUnchanged=true`
and `builtinsRestored=true`. Green enabled takeover: `reached=true`,
`ownedTokenRead=true`, `foreignWritten=true`, exact ownership rejection,
`cursorAbsent=true`, `foreignLockPreserved=true`, `inputsUnchanged=true`
and `builtinsRestored=true`. `task1/sensitivity-inputs.json` identifies the
standalone probe SHA-256 as
`3b398cb4da2c7a5b6f5fa45474c9efe10ad083ef856150347a01167a46ba739a`
and records the exact copied fixture/helper/test identities.

The focused integration passed all three restoration controls: successful
observation, exact ownership rejection and a deliberately thrown assertion
after observation settlement. Each checks restored promise/named builtin
function identities, byte-for-byte unchanged `current.json`, `executor.lock`
and `full.log`, and an independent public observation with identified ownership,
expected progress and normal owned-lock cleanup. Takeover paths require ENOENT
for the original cursor and the exact foreign payload both before and after
that independent observation. These checks exercise unchanged production.

Historical evidence stays distinct. `task1/diagnosis.json`,
`task1/startup-red.log`, `task1/ownership-control.log` and
`task1/cursor-ownership-probe.mjs` are byte-identical retained diagnosis/probes
from `work/issue-19/actions-38256883847-failure/`. Probe SHA-256 is
`01ca6eaedf8357b2db84e276d225f62477d3c0093022f1b946ad20d1ce1c8073`.
The recorded `node work/issue-19/actions-38256883847-failure/cursor-ownership-probe.mjs startup`
exit was 1: intervention preceded owned publication, rejection was missing,
the cursor was published and the foreign lock was not preserved.
The corresponding `ownership` invocation exited 0 with confirmed
post-publication intervention, rejection, absent cursor and retained foreign
lock. Both retained unchanged inputs and restored mocks. This proves a
controlled startup race and passing ownership-loss behavior; historical
Windows interleaving and timing cause remain unproven. Actual Windows focused
results and original Actions `npm test` verification remain pending.

Task 2 reuses the focused evidence only after the input continuity check.
After archival, `npm run check:docs` exited 0 (110 Markdown files), and
`git diff --check` exited 0. Full logs and command/exit records are
`task2/archive-docs.log`, `task2/archive-docs.json`,
`task2/archive-diff-check.log` and `task2/archive-diff-check.json`.
The same checks after the final evidence/checkbox update are retained in
`task2/docs.log`, `task2/docs.json`, `task2/diff-check.log` and
`task2/diff-check.json`. Only the allowed plan/archive paths changed in Task 2;
the repaired test and all previously verified inputs remain unchanged.
The final allowlisted diff is retained as `task2/allowlisted.diff`;
the archive destination is
`docs/plans/completed/issue-19-cursor-ownership-fixture.md`.
Review and external acceptance remain coordinator-owned.

## Post-Completion

The executor commits each completed and verified file-changing task.
Separate review, tracker writes and authorized delivery remain coordinator work outside executable tasks. Actual
Windows observer/focused results and original npm test
Actions verification on the exact reviewed SHA remain
external gates; inspect both Windows matrix results and
retained artifacts before claiming platform acceptance.
No implementation, tests, tracker writes, commits, push,
merge, Actions dispatch or global changes occur during
plan creation. The eventual bounded repair runs no
unrelated suites, product builds, runtime smoke, packaging
or layout replays because their inputs remain unchanged.
Existing graphical/runtime and whole-Issue #19 gates
remain pending independently.
