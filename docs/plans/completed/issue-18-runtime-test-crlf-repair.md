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

- [x] Add an explicit CRLF normal-quit/saved-evidence case before changing extraction. Run `node --test --test-name-pattern='runtime source-move failure remains primary' tests/runtime-lifecycle.test.mjs` and retain the nonzero result at the existing assertion. Reference the historical four-case red log.
- [x] Apply the smallest test-local extraction repair, canonicalizing CRLF before locating both fragment boundaries. Retain the extraction guard and execute the actual smoke fragment. Rerun the same behavioral regression and retain green evidence.
- [x] Extend the existing matrix to LF/CRLF × normal/forced quit × saved/failed evidence with identifiable names and all eight combinations. Construct both formats before extraction so CRLF exercises the repaired boundary.
- [x] Preserve the identical original missing_effects error, one quit attempt, backend exit verification, truthful shutdown/forced-cleanup outcomes, failed final evidence, failed first move and unreached remaining moves. Verify owned-child termination, fixture removal and unrelated-directory preservation for each combination.
- [x] Run the focused matrix, then `node --test tests/runtime-lifecycle.test.mjs` with existing outputs, requiring all eight selected cases to pass without skips. Run `npx --no-install eslint tests/runtime-lifecycle.test.mjs --max-warnings=0`, `npm run check:docs` for this plan and `git diff --check`. No full-suite, Electron/native rebuild or graphical runtime repeat is required for this test-only repair.
- [x] Save actual commands, input identity and red/green results under `work/issue-18/runtime-test-crlf-repair/` and add a concise verification record here. Keep original Windows `npm test` pending and independent native-selection/readiness and creation/shutdown failures unresolved.
- [x] Inspect the bounded diff, stage only the test and plan, run `git diff --cached --check` and commit the verified task in English. Report checks and remaining platform gates in Russian.

## Task 1 Verification

Executed on macOS arm64 with Node 22.21.1 selected through the per-command PATH, starting at `d1bfd74583886761ba6de61281917f19ab5a38ba`. Existing packages and emitted service/native outputs were reused without rebuilding. Only the test and this plan changed; the tracked smoke script retained its original bytes.

Evidence is retained under ignored `work/issue-18/runtime-test-crlf-repair/`. Each named `.json` records the actual command, exit code, runtime, starting HEAD and SHA-256 input manifest; the matching `.log` contains its output. Manifests include the test, scripts, package resolution, installed SQLite files and reused service/native outputs.

| Evidence | Actual command | Result |
| --- | --- | --- |
| `red.json`, `red.log` | `node --test --test-name-pattern='runtime source-move failure remains primary' tests/runtime-lifecycle.test.mjs` | Exit 1: four LF cases passed; explicit CRLF normal-quit/saved-evidence case failed at the existing `tail.startsWith` extraction assertion. |
| `green.json`, `green.log` | Same focused command after extraction repair | Exit 0: all five cases passed, zero skips. |
| `matrix.json`, `matrix.log` | Same focused command after completing the matrix | Exit 0: all eight LF/CRLF × quit × evidence cases passed, zero skips. |
| `lifecycle.json`, `lifecycle.log` | `node --test tests/runtime-lifecycle.test.mjs` | Exit 0: all 31 tests passed, zero skips, using existing outputs. |
| `eslint.json`, `eslint.log` | `npx --no-install eslint tests/runtime-lifecycle.test.mjs --max-warnings=0` | Exit 0, zero warnings. |
| `docs.json`, `docs.log` | `npm run check:docs` | Exit 0: local Markdown links checked in 84 files. |
| `diff.json`, `diff.log` | `git diff --check` | Exit 0. |

The final tested file SHA-256 is `2664b7bd3558c467ecfe6f52b84a294e924420ed821354db47c9c89919152f29`; matrix and lifecycle input digest is `199ee219fd8e7c648f73c77083cf6c7714134a7d13cf139875f5f93fbf958479`. The manifests identify the plan before this verification record was added; exercised code and build inputs remain unchanged. Historical four-case CRLF reproduction remains at `work/issue-18/ci-38141686024/crlf-red.log` with its diagnosis in the same directory. Both source formats are now constructed in memory before extraction, and the real smoke catch/finally fragment executes in every matrix case.

The original Windows `npm test` acceptance remains pending for windows-latest and windows-2022. Native-selection/readiness, creation/shutdown failures, separate review and exact-SHA Actions interpretation remain unresolved coordinator gates. No full suite, graphical runtime, Electron/native rebuild, push or tracker update was performed.

## Post-Completion: Coordinator-Owned Gates

Inspect the repair, obtain separate review, push within existing authorization and monitor exact-SHA Actions. Inspect original `npm test` on windows-latest and windows-2022. Local CRLF regression success does not establish Windows acceptance or resolve the independent failures. Issue #18 remains open; Name/recovery UI and final acceptance are separate.
