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

- [x] Establish a tight red-capable loop at the actual driver readiness seam before causal hypotheses. A controlled real Playwright/Electron page may reveal a labelled input before app-owned delayed focus; keep this explicitly injected timing, not historical Windows attribution. Retain the old failing predicate and fixture/source hashes. Present3–5 ranked falsifiable hypotheses before probes; distinguish visibility-before-focus, wrong labels, disabled input and genuine focus loss. Retain unknown historical cause if not independently proven.
- [x] Write a meaningful red-before-green readiness regression, then make the existing `edit` driver await the strict intended state: visible enabled Name input, actual focus and exactly one associated label. Use one existing15000ms total allowance, automatic predicate observation and no manual focus or mutation. Bound and dispose observation handles. Keep subsequent exact draft/message/keyboard and failure cleanup assertions.
- [x] Retain finite initial/final readiness operands and classified failure without altering primary failure or delaying cleanup beyond the same allowance. Verify delayed-focus success, already-ready success, missing/hidden/disabled/unfocused/wrong-label failure and a real readiness timeout. Test the same serializable predicate/helper the actual driver uses; avoid source-string tests or a broad framework. Ensure evidence failures cannot turn a failure into pass or swallow its primary cause.
- [ ] Run focused readiness/runtime/renderer controls, lint, typecheck, one final full `npm test`, docs/diff checks. After final build, run the original focused actual macOS `WORKSPACE_SMOKE_EVIDENCE_DIR=work/issue-18/editor-readiness/mac-dev npm run smoke:runtime -- dev --rename` once. Keep every stage/native/normal-quit/backend/owned-cleanup result; no unchanged repeat merely for green. Simulations are not actual Windows acceptance.
- [ ] Record red/green, actual platform/input identity and truthful causal limits in this plan, commit verified changes and archive only after all executable work completes. Required unperformed checks remain pending.

## External acceptance

Separate Matt Standards/Spec review compares against last reviewed3d222423. Then the coordinator performs the authorized task-branch push and monitors exact-SHA Actions to completion. Inspect actual Windows dev/packaged editor focus/labels, rename/case/recovery/native/shutdown/cleanup and all mandatory jobs. Keep Issue18 open until acceptance passes. Original resolver and startup historical causes stay unproven even when their original scenarios pass. No remote merge/release or Issue44 closure.

## Task 1 execution evidence

Executed on macOS arm64 with Node 22.21.1, from clean task checkout
`194279f36e80223e6ace2dad45265e275abe86d9`; reviewed comparison remains
`3d222423b5fd4eb34fa502d32b13007b2b62084a`. No production inputs changed.

The initial loop was `node --test tests/rename-editor-readiness.test.mjs`.
Before the repair it failed with `false !== true` at the unchanged extracted
`input.waitFor()` / active-element-and-one-label predicate. The real Electron
fixture made focus app-owned and gated it until the first observation. This is
an **injected symptom**, not a replay or attribution of the historical Windows
failure. Retained originals, fixture/test hashes and red output are in
`work/issue-18/editor-readiness/{original-driver.mjs,original-readiness.mjs,red-test.mjs,red-input-hashes.txt,red.log}`.
The same delayed-focus regression then passed, with initial focus false and
final focus true (`green-delayed.log`).

Before probes, four ranked falsifiable hypotheses were presented: (1) visible
before app-owned focus, which must pass only after focus arrives; (2) absent or
multiple associated labels, which must fail even with focus; (3) disabled or
noneditable input, which must fail; (4) genuine persistent focus loss, which
must time out. Real Electron controls confirmed those predictions and also
rejected missing/hidden inputs, hidden ancestors, disabled fieldsets, readonly
inputs and duplicate inputs. The never-focused case exhausted the real default
allowance. Resource controls verified release of frame/timer observations on
success, timeout and snapshot failure. Transport and evidence failures retained
the primary error; unknown observations never passed. Finite telemetry contains
only input-count/label-count categories, booleans/null and outcome categories.

The actual driver and controls share `observeRenameEditor` /
`waitForRenameEditor`. Automatic read-only frame observation replaces the old
visible-only wait; the host allowance is capped at 15000 ms and includes
transport, with at most 50 ms reserved inside it to return evidence. No manual
focus, fixed sleep, mutation or additional readiness allowance was added.
There are no retained element handles; browser frame/timer resources are
bounded and disposed. Subsequent exact draft, message, Enter/Escape, native,
shutdown and owned-cleanup assertions remain unchanged. The helper was added
to the graphical smoke input digest.

Focused command:
`node --import tsx --test tests/rename-editor-readiness.test.mjs tests/runtime-readiness.test.mjs tests/runtime-lifecycle.test.mjs tests/rename-runtime-startup.test.mjs tests/project-rename-runtime.test.mjs tests/runtime-source-disconnect.test.mjs tests/project-rename-ui.test.tsx tests/project-creation-ui.test.tsx tests/project-recovery-ui.test.tsx tests/renderer-app.test.tsx tests/components.test.tsx`.
Result: 606 tests, 602 passed, 4 actual-Windows controls skipped on macOS,
0 failed (`focused.log`). Those skips establish no Windows acceptance.
Final lint and typecheck passed (`lint.log`, `typecheck.log`).
Final `npm test` (including the final build) passed: 1920 tests, 1900 passed,
20 platform controls skipped, 0 failed; exit 0 (`full-test.log`). No build or
code change followed this build before the original smoke command.

The required command was invoked **once**:
`WORKSPACE_SMOKE_EVIDENCE_DIR=work/issue-18/editor-readiness/mac-dev npm run smoke:runtime -- dev --rename`.
It exited 1 at the first normal Electron shutdown: `Electron shutdown timed out
after 10000ms`. All five reached editor-readiness observations passed. One
actual macOS initial snapshot was visible but disabled/unfocused; its final
snapshot became enabled/focused with exactly one associated label. This is
new local operand evidence, not proof of the earlier Windows cause.

Direct submission, rejections, mounted case, sibling propagation, native Reveal
invocation/acknowledgment, exact file-manager outcome and file-manager cleanup
passed. Normal shutdown failed (0/1 successful sessions). Forced cleanup
confirmed parent termination, and independent owned parent/backend/native
termination checks allowed fixture cleanup to pass (`processesStopped: true`).
The normal-shutdown backend-exit assertion was not reached; forced cleanup is
not normal shutdown acceptance. Direct restart persistence, every recovery
stage and the entire grouped scenario remained unreached. No unchanged retry
was performed, no shutdown deadline was increased and no cause was attributed
to Issue 44.

Every original stage/native/shutdown/cleanup outcome remains in
`work/issue-18/editor-readiness/mac-dev/dev-rename-observations.json`;
`mac-dev-smoke.log` retains the failure and `mac-dev-summary.json` retains the
stage and finite operand summary. The actual input identity is darwin/arm64,
Node v22.21.1, source revision `194279f36e80223e6ace2dad45265e275abe86d9`
plus the task working-tree changes, with runtime input digest
`01bfadf90e77f9a4afd4e880f32149b3168eee80a50e7578fe3aabb81c3eb64b`.
The unchanged injected fixture SHA-256 is
`b5504947196498ac42a1edd6d93e4ea8804ec657585340af1900229ca3f5d49c`;
full task-source SHA-256 values are retained in `diagnosis.json`.

The first three Task items are verified. The remaining two stay unchecked:
required original-scenario acceptance failed and executable work is therefore
not complete. Verified code/tests and this truthful plan are committed for
coordinator inspection. The plan is not archived. Coordinator interpretation
of the preserved normal-shutdown failure and required original-scenario
acceptance is the next dependency; it is not another authorized executor
repair or an external-acceptance checkbox.

The full diagnostic record is
`work/issue-18/editor-readiness/diagnosis.json`. Historical cause remains
**unproven**: the original Windows failure did not retain separate focus,
label or disabled operands. This repair adds bounded robustness for the
observed symptom; it does not attribute timing or focus theft to Windows,
resolve Issue 44 or complete external acceptance. Independent Standards/Spec
review and exact-SHA actual Windows acceptance remain coordinator-owned.
