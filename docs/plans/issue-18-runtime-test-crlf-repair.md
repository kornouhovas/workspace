# Issue #18 Runtime Test CRLF Repair

## Overview

Make the existing runtime source-move cleanup tests independent of LF/CRLF source formatting. Execute the actual smoke cleanup fragment across both line endings while preserving primary-error precedence, shutdown, evidence and disposable-fixture assertions.

The coordinator inspected the Ralphex draft retained at `work/issue-18/ci-38141686024/planning.log`. Its noninteractive planning process stopped at draft acceptance with EOF; no implementation ran. This document records the accepted bounded draft under the existing repair authorization.

## Context

- GitHub: https://github.com/kornouhovas/workspace/issues/18; Beads: workspace-31i.11.
- Starting and follow-up comparison SHA: 572b11438af569f9dec78191769f3ca36e8ae7eb. Immutable issue base remains a5728daa64caab6b90700854ad5e27417fcf683e.
- Failed Actions: https://github.com/kornouhovas/workspace/actions/runs/38141686024. Both Windows `npm test` jobs fail four source-move cases at the extraction assertion.
- Diagnostic evidence: `work/issue-18/ci-38141686024/diagnosis.json` and `crlf-red.log`.
- Changing only the tracked smoke source's line endings reproduces all four assertions with CRLF; LF passes. Literal LF extraction is a proven input-handling defect. Historical checkout bytes were not captured; the replay establishes a sufficient mechanism.
- Modify only `tests/runtime-lifecycle.test.mjs` and this plan. Read `scripts/smoke-runtime.mjs`, `scripts/runtime-lifecycle.mjs` and `scripts/runtime-source-disconnect.mjs` as context.
- Existing installed Node 22.21.1, packages and emitted service outputs are prerequisites. No dependency changes or rebuilds.

## Development Approach

Use Matt Pocock TDD at the existing cleanup seam. Construct both source formats in memory; do not rewrite the tracked smoke script. Execute its real catch/finally fragment with the existing dependencies, real owned Node children and disposable directories. Preserve process ownership and emergency child cleanup. Do not add normalization-only assertions, change production/CI/timeout/shutdown policy or perform unrelated refactoring.

Executor owns the bounded test/plan changes and explicit local commits. Coordinator owns tracker updates, run state, platform interpretation, separate review and already authorized task-branch delivery. No executor push, merge, publication or global configuration changes.

## Implementation Steps

### Task 1: Repair source extraction and verify the cleanup matrix

- [ ] Add an explicit CRLF normal-quit/saved-evidence case before changing extraction. Run `node --test --test-name-pattern='runtime source-move failure remains primary' tests/runtime-lifecycle.test.mjs` and retain the nonzero result at the existing assertion. Reference the historical four-case red log.
- [ ] Apply the smallest test-local extraction repair, canonicalizing CRLF before locating both fragment boundaries. Retain the extraction guard and execute the actual smoke fragment. Rerun the same behavioral regression and retain green evidence.
- [ ] Extend the existing matrix to LF/CRLF × normal/forced quit × saved/failed evidence with identifiable names and all eight combinations. Construct both formats before extraction so CRLF exercises the repaired boundary.
- [ ] Preserve the identical original missing_effects error, one quit attempt, backend exit verification, truthful shutdown/forced-cleanup outcomes, failed final evidence, failed first move and unreached remaining moves. Verify owned-child termination, fixture removal and unrelated-directory preservation for each combination.
- [ ] Run the focused matrix, then `node --test tests/runtime-lifecycle.test.mjs` with existing outputs, requiring all eight selected cases to pass without skips. Run `npx --no-install eslint tests/runtime-lifecycle.test.mjs --max-warnings=0`, `npm run check:docs` for this plan and `git diff --check`. No full-suite, Electron/native rebuild or graphical runtime repeat is required for this test-only repair.
- [ ] Save actual commands, input identity and red/green results under `work/issue-18/runtime-test-crlf-repair/` and add a concise verification record here. Keep original Windows `npm test` pending and independent native-selection/readiness and creation/shutdown failures unresolved.
- [ ] Inspect the bounded diff, stage only the test and plan, run `git diff --cached --check` and commit the verified task in English. Report checks and remaining platform gates in Russian.

## Post-Completion: Coordinator-Owned Gates

Inspect the repair, obtain separate review, push within existing authorization and monitor exact-SHA Actions. Inspect original `npm test` on windows-latest and windows-2022. Local CRLF regression success does not establish Windows acceptance or resolve the independent failures. Issue #18 remains open; Name/recovery UI and final acceptance are separate.
