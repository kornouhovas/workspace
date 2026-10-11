# Issue 18: Windows graphical fixture acceptance

## Scope and evidence

Repair the test-driver failures in [Actions 38163577161](https://github.com/kornouhovas/workspace/actions/runs/38163577161) at `2e1136dcc06ba24d46a734f45e14945d90b1b643`. Read actual checkout AGENTS.md, development/architecture, GLOSSARY and ADRs 0006/0007. Use Matt Pocock implement, diagnosing-bugs and TDD at the existing renderer/service and graphical-driver lifecycle seams. The coordinator owns trackers, independent review, push and actual Windows acceptance.

Evidence is retained under ignored `work/issue-18/ci-38163577161/`. Both Windows hosts failed the production Name/lost-response renderer test. Its successful-rename fixture supplies a trailing-space basename, rejected by the existing Windows policy. A temporary copy exercising the same real service with Windows filesystem policy reproduced the exact missing-confirmation symptom; changing only the authored basename to retain leading spaces but omit trailing spaces passed all EN/RU direct/grouped cases. Logs: `windows-policy-repro.log` and `windows-policy-valid-input.log`. Callback assertions are caught as promise rejections by the product; they cannot alone prove the injected response-loss precondition.

All four actual Windows dev/packaged rename fixtures also failed `readBackendPids` with zero matches. The driver reads metrics immediately after Electron launch, before its existing first-window/interface readiness. Creation's successful driver reads the same metrics filter after interface readiness. Five unmodified local macOS launch samples matched a backend immediately and after readiness (`metrics-loop.json`); historical Windows timing/filter attribution remains unproven.

A separate Windows2022 ready-parent read-only resolver timed out at 10020ms before fixture creation/native intent. Three later independent samples passed, without rescuing the original. This plan changes neither resolver nor its deadline; retain `ready-parent-diagnosis.json` as unproven. A legitimate new reviewed fixture-repair SHA must rerun the original mandatory scenario in CI. Recurrence requires its own diagnostic stage, not unchanged automatic reruns.

## Boundaries

Only renderer test fixtures, rename graphical driver and focused test-driver lifecycle helpers/controls may change. No production rename policy, service contracts/storage/native adapters, dependencies, runtime resources, renderer privilege, OS settings, native retries, normal-quit deadline increases or weakened acceptance. Preserve exact authored text/UUID/category/history and source boundaries. No Issue #44 attribution or closure. Keep failed/unreached evidence and primary failure/cleanup precedence. Use owned disposable fixtures only. No tracker changes, push, merge or publication by the executor.

Use Node22.21.1 in every shell, via `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin`. Report task/check activity in Russian at least every60seconds. Work one red/green behavior at a time; no numeric coverage gate or unrelated refactor. Commit each completed verified task explicitly.

## Executable tasks

### Task 1: Correct the successful Windows Name fixture

- [ ] Retain the actual failing logs and reproduce the real-service Windows-policy input rejection at the existing renderer/service seam. Capture the original service result outside the callback so caught assertion failures cannot masquerade as the intended lost successful response.
- [ ] Use an explicitly authored Windows-valid successful basename retaining leading whitespace and Unicode; preserve the POSIX trailing-whitespace case. Assert the exact authored name consistently in UI, filesystem enumeration, receipt/history, source sibling and restart checks. Do not trim input or weaken Windows invalid-name coverage.
- [ ] Lock down the successful response-loss/remount/status precondition through a meaningful existing-seam regression that also exercises Windows policy on macOS. Preserve UUID/Text/category, exactly one mutation and one explicit status query. Run affected renderer/rename service controls, typecheck, lint and docs/diff checks. Record original red and repaired green with platform limits.

### Task 2: Require existing startup readiness before backend ownership

- [ ] Build a minimal actual Electron or driver-lifecycle feedback loop for the observed zero-metrics launch. Prefer a controlled delayed backend startup using the same orchestration seam; distinguish injected timing from historical Windows cause. Retain the unmodified five green macOS samples. Present ranked falsifiable hypotheses before causal probes; do not claim timing attribution without evidence.
- [ ] Make rename-driver startup read backend ownership after its existing first-window/interface readiness, preserving the existing bounds and strict nonempty valid PID requirement. Keep ownership uncertainty sticky until positively established, register owned children before waits, and preserve cleanup on every failure. This can be a bounded repair for the observed premature ownership assertion; describe its causal limit truthfully. No sleeps, repeated native actions, guessed PIDs, success from empty metrics or additional product waiting budgets.
- [ ] Add focused behavioral controls at the actual driver-lifecycle seam for delayed readiness, no backend after readiness, readiness/metrics failure, ownership registration and primary failure/cleanup. Preserve shutdown's independent strict backend-exit verification. Avoid source-string assertions or a broad generic abstraction.
- [ ] Run affected lifecycle/rename/renderer tests, lint, typecheck and one final full `npm test`, then docs and diff checks. After the final build, run one actual macOS focused `WORKSPACE_SMOKE_EVIDENCE_DIR=work/issue-18/windows-ui-fixtures/mac-dev npm run smoke:runtime -- dev --rename`, retaining all required native/normal-quit/backend/owned-cleanup evidence. A failed invocation remains failed; do not repeat unchanged graphical commands merely for green.
- [ ] Record concise English verification evidence and remaining actual Windows gates in this plan or the existing Issue18 UI report. Commit verified changes. Archive only after executable work is complete; ensure links remain valid.

## Coordinator acceptance after execution

Separate Matt Pocock Standards/Spec review against last reviewed `2e1136dc` precedes authorized task-branch push. Inspect exact-SHA completed Actions, all mandatory jobs and actual Windows development/packaged rename evidence. The Windows-policy simulation and controlled startup regression are not actual Windows acceptance or proof of historical host timing. Inspect the unchanged resolver original scenario independently. Local macOS Actions at `2e1136dc` has dev/packaged rename evidence passed and valid grouped creation Reveal receipts; preserve those exact-revision results. Keep Issue18 open until all acceptance/delivery gates pass; no remote merge/release or Issue44 closure.
