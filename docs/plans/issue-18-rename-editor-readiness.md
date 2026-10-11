# Issue 18: strict rename editor readiness

## Scope and retained evidence

Continue [Issue18](https://github.com/kornouhovas/workspace/issues/18) from reviewed `3d222423b5fd4eb34fa502d32b13007b2b62084a`. Read checkout AGENTS/development/architecture/GLOSSARY, ADR0006/0007, installed Matt diagnosing-bugs and TDD. The existing renderer/service and graphical-driver readiness seams are authorized. No Superpowers. The coordinator owns trackers, independent review, delivery and actual Windows acceptance.

[Actions38166185612](https://github.com/kornouhovas/workspace/actions/runs/38166185612) passed all three full test suites and seven supporting jobs. Both actual macOS dev/packaged rename records passed all assertions and92 total normal shutdowns. Windows latest packaged rename passed46 sessions. Three Windows rename invocations failed the immediate combined focus/one-label assertion at `scripts/smoke-project-rename-ui.mjs:227`, called during rejections: latest dev grouped, Windows2022 dev/release direct. Owned cleanup passed. Initial individual focus/label/disabled operands were not retained; historical cause remains unproven. Original logs/artifact JSON and `diagnosis.json` are under ignored `work/issue-18/ci-38166185612/`. Prior Windows-input and startup repairs stay complete; don't replay their plans.

The current driver waits for visible input then immediately asserts focus AND exactly one associated label. Production performs focus through React effects. Documentation supports that visibility and completion of effect state updates are distinct, but does not prove historical timing: [React useEffect](https://react.dev/reference/react/useEffect), [Playwright locator waitFor](https://playwright.dev/docs/api/class-locator#locator-wait-for), [page waitForFunction](https://playwright.dev/docs/api/class-page#page-wait-for-function).

## Bounds

Change only the rename graphical driver, a small focused editor-readiness helper if needed, behavioral controls and this verification plan. No production renderer/service/storage/IPC/native/dependency/resource changes, CI rearrangement, manual focus, fixed sleeps, native retries, deadline increases, weakened labels/focus/visibility/editability assertions or Issue44 attribution. Replace the old visible-input15s allowance with one total readiness allowance at most15000ms; do not stack another15s budget. Retain original failure, finite operand observations and owned cleanup. Unknown, never-focused, disabled, absent or multiply/unlabelled inputs cannot pass. Do not record names, IDs, paths, arbitrary DOM, raw errors or environment in readiness telemetry.

Use Node22.21.1 via `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin` in every shell. Russian progress every60seconds. Commit verified task paths only. No executor push, tracker edits, merge, release or publication.

## Executable task

### Task 1: Wait for actual editor readiness within the existing budget

- [ ] Establish a tight red-capable loop at the actual driver readiness seam before causal hypotheses. A controlled real Playwright/Electron page may reveal a labelled input before app-owned delayed focus; keep this explicitly injected timing, not historical Windows attribution. Retain the old failing predicate and fixture/source hashes. Present3–5 ranked falsifiable hypotheses before probes; distinguish visibility-before-focus, wrong labels, disabled input and genuine focus loss. Retain unknown historical cause if not independently proven.
- [ ] Write a meaningful red-before-green readiness regression, then make the existing `edit` driver await the strict intended state: visible enabled Name input, actual focus and exactly one associated label. Use one existing15000ms total allowance, automatic predicate observation and no manual focus or mutation. Bound and dispose observation handles. Keep subsequent exact draft/message/keyboard and failure cleanup assertions.
- [ ] Retain finite initial/final readiness operands and classified failure without altering primary failure or delaying cleanup beyond the same allowance. Verify delayed-focus success, already-ready success, missing/hidden/disabled/unfocused/wrong-label failure and a real readiness timeout. Test the same serializable predicate/helper the actual driver uses; avoid source-string tests or a broad framework. Ensure evidence failures cannot turn a failure into pass or swallow its primary cause.
- [ ] Run focused readiness/runtime/renderer controls, lint, typecheck, one final full `npm test`, docs/diff checks. After final build, run the original focused actual macOS `WORKSPACE_SMOKE_EVIDENCE_DIR=work/issue-18/editor-readiness/mac-dev npm run smoke:runtime -- dev --rename` once. Keep every stage/native/normal-quit/backend/owned-cleanup result; no unchanged repeat merely for green. Simulations are not actual Windows acceptance.
- [ ] Record red/green, actual platform/input identity and truthful causal limits in this plan, commit verified changes and archive only after all executable work completes. Required unperformed checks remain pending.

## External acceptance

Separate Matt Standards/Spec review compares against last reviewed3d222423. Then the coordinator performs the authorized task-branch push and monitors exact-SHA Actions to completion. Inspect actual Windows dev/packaged editor focus/labels, rename/case/recovery/native/shutdown/cleanup and all mandatory jobs. Keep Issue18 open until acceptance passes. Original resolver and startup historical causes stay unproven even when their original scenarios pass. No remote merge/release or Issue44 closure.
