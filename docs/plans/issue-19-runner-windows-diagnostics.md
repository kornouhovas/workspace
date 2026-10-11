# Issue #19: Bounded Windows Observer and Category Fixture Diagnostics

## Overview

Prepare two diagnostic slices before the next actual Windows result: an isolated pure-Node observer diagnostic with focused Windows CI, and sanitized failure evidence for the disposable category-move fixture. Gather evidence that distinguishes hypotheses without changing production ownership or recovery policy. Intended plan path: docs/plans/issue-19-runner-windows-diagnostics.md.

## Context

  - Worktree: existing codex/issue-19-category-move checkout.
  - Issue base: 4f9f11f785c63a65585ea6f33f167fc438272c64.
  - HEAD and lastReviewedSha: 6750b2700f6abc007dc49dc1147cf48bbe5e0149.
  - Runner 3b074061 was imported in 6efb4757; formatted-progress repair 6750b270 is committed, reviewed and pushed. These stages are complete.
  - Current coordinator snapshot: work/ralphex/issue-19/current.json. Read as context; this plan does not modify it or trackers.
  - Diagnosis records: work/issue-19/windows-observer-diagnosis/diagnosis.json and work/issue-19/diagnose-ci-fixture/diagnosis.json. Both causes remain unproven.
  - Windows failure: run 38178502063, attempt 1, at HEAD, recorded 28 observer failures in npm run test:windows:early. The first observer assertion expected deadline and received ownership_unknown. Exact excerpt: work/issue-19/actions-38178502063-windows-diagnostic-clean.log, lines 2206–2228.
  - Windows hypotheses: synchronous/asynchronous canonical-path mismatch, denied signal-0 probe, or inconsistent fixture identity fields. None is established.
  - macOS failure: the malformed-result control expected exitCode 0 but received 1. Exact excerpt: work/issue-19/actions-38178502063-macos-clean.log, lines 647–672.
  - Its retained service-checkpoint.json under work/issue-19/actions-38178502063-artifacts/ci-category-move-service-controls/malformed-result/ records grouped.keep_original failed, grouped.recovery_restart unreached, three utility starts/exits, a valid handshake and removed cleanup. The fixture swallowed the original throw; the later malformed-result mutation was not reached.
  - Captured-input reproduction: work/issue-19/diagnose-ci-fixture/captured-red.log. It proves the retained control result violates its assertion, not the historical cause.
  - Original service Windows early matrix passed. Existing 68/71 runner checks and product receipts remain historical evidence, not replay tasks.
  - Relevant code: scripts/ralphex-observe.mjs, scripts/ralphex-observe-sources.mjs, scripts/ralphex-run.mjs, tests/ralphex-observe.test.mjs, tests/ralphex-run.test.mjs, scripts/smoke-project-category-move.mjs, tests/fixtures/project-category-move-service-electron.cjs and tests/project-category-move-fixture.test.mjs.
  - Existing patterns: Node test runner, disposable owned fixtures, bounded result/control protocol, sanitized service-checkpoint evidence, strict handshake/shutdown/cleanup acceptance.
  - Dependencies: Node 22.21.1 and existing checkout/setup-node/upload-artifact Actions. Task 1 requires no npm install, tsx, Electron, database, native module, product build or Ralphex installation. Task 2 uses existing fixture dependencies only.

## Development Approach

  - Testing approach: Matt Pocock TDD, one failing behavioral regression followed by minimal implementation per slice.
  - User-approved seams: public observe API/diagnostic CLI and public superviseCategoryMoveService result plus persisted checkpoint. Tests verify observable outcomes and evidence privacy rather than private observer functions or service internals.
  - Complete Task 1 and its focused local regressions before Task 2. New diagnostic regressions and applicable local checks must pass. Required Windows outcomes remain pending until the coordinator inspects actual CI evidence.
  - Preserve failed, skipped, timed-out and unreached outcomes. Diagnostic completeness never establishes product acceptance.
  - Preserve observer ownership comparisons and signal-0 guards. Do not normalize paths, bypass probes, loosen assertions, retry toward green or change production service policy based on a hypothesis.
  - Each task includes tests and proportionate documentation. No full product suite, renderer build, packaging, graphical smoke matrix or coverage target belongs to this stage.
  - Planning emits this draft only. Execution, review, commit/delivery phases and tracker writes remain outside this planning invocation.

## Implementation Steps

### Task 1: Add isolated observer evidence and focused Windows CI

Files:
  - Create: scripts/windows-observer-diagnostics.mjs.
  - Create: tests/windows-observer-diagnostics.test.mjs.
  - Modify: .github/workflows/desktop-ci.yml.
  - Modify: docs/ralphex.md.
  - Exercise unchanged: scripts/ralphex-observe.mjs, scripts/ralphex-run.mjs and their existing tests.
  - [ ] Write a failing public diagnostic regression using a disposable running-state/lock/log fixture and the real observe API. Verify finite evidence, honest ownership_unknown reporting, unchanged runner inputs and cleanup. Include privacy and invalid/error-result cases; never make the diagnostic regression depend on Windows returning deadline.
  - [ ] Implement a pure-Node diagnostic reproducing the existing synchronous fixture setup and asynchronous observer selection. Use at most two fixed cases: current-process ownership and one ready, owned Node child. Compare synchronous/asynchronous canonical paths and every ownership-relevant state/lock/source identity field using equality/validity booleans only. Record signal-0 results for current PID and owned child, bounded numeric errno/process exit codes or explicit unavailable values, and allowlisted public observer reason/ownership/diagnostic code. Keep tokens, identity values, PIDs, raw paths, environment contents, exception messages, stacks and full observer objects out of output.
  - [ ] Bound each observe call to two seconds and the diagnostic process to fifteen seconds, with cleanup limited to its own disposable files and child. Emit one schema-validated JSON document capped at 12 KiB, including exact commit SHA, run ID, attempt, matrix label, platform and Node version. Distinguish successful evidence collection from an anomalous observer outcome; retain errors and timeouts without inferring their cause.
  - [ ] Add an independent windows-latest/windows-2022 matrix job pinned to Node 22.21.1, with fail-fast false and a five-minute job limit. Run the diagnostic and node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs as separate bounded steps, allowing the focused tests to run after diagnostic failure. Preserve each actual exit status and failed job conclusion; do not use continue-on-error, skipped assertions or altered expectations to obtain success.
  - [ ] Upload only explicitly selected finite diagnostic and test-status JSON using always(), finite retention, and artifact names containing OS, exact SHA, run ID and attempt. Include numeric test-process exit and passed/failed/timed-out/unreached status; exclude raw stdout/stderr and fixture directories from artifacts. Missing evidence must remain an error, with original test failures retained in CI.
  - [ ] Run the focused Node tests locally, then npm run lint, npm run typecheck, npm run check:docs and git diff --check. Document the diagnostic command, schema/privacy bounds and pending Windows gate in docs/ralphex.md. Record actual local results and platform without replaying historical receipts or claiming Windows acceptance.

### Task 2: Expose the exact disposable fixture failure seam

Files:
  - Modify: tests/fixtures/project-category-move-service-electron.cjs.
  - Modify: scripts/smoke-project-category-move.mjs.
  - Modify: tests/project-category-move-fixture.test.mjs.
  - Modify: docs/verification/issue-19-category-move-service.md.
  - Reuse unchanged: tests/fixtures/project-rename-native-protocol.cjs and tests/fixtures/project-rename-service-control.cjs.
  - [ ] Add a failing controlled regression through superviseCategoryMoveService and its persisted checkpoint. Inject a bounded assertion failure at a fixed keep_original recovery seam, asserting the exact sanitized seam code, failed scenario, subsequent unreached scenario, nonzero result and preserved normal handshake/cleanup. Add a controlled lifecycle-failure case so evidence distinguishes lifecycle failure from the recovery assertion.
  - [ ] Track a fixed allowlisted seam before each relevant recovery preparation, external-return/identity assertion, receipt/status assertion, preview/action assertion, recovery-result assertion, consumed-token assertion and retained-state assertion. Distinguish stop/connect/final cleanup failures with fixed lifecycle codes. Preserve the first failure and separately report any later lifecycle failure; do not overwrite the original seam while finishing.
  - [ ] Carry a small optional diagnostic record through the existing result message and supervisor checkpoint. Validate only fixed scenario/seam/failure codes and bounded numeric codes when applicable. Reject malformed diagnostic fields without accepting the run. Do not serialize assertion actual/expected values, paths, SQL, native identities, tokens, error names/messages/stacks or arbitrary thrown properties. Keep production service code and shared protocol/control behavior unchanged.
  - [ ] Extend the existing privacy checks and public checkpoint assertions for successful runs, controlled diagnostic failures, unknown diagnostic values and persisted evidence. Retain all existing malformed-result, skipped, missing-assertion, timeout, utility-count, handshake, shutdown and cleanup expectations. A failure before malformed-result injection must remain an earlier failure, not count as successful validation of that control.
  - [ ] Run only tests/project-category-move-fixture.test.mjs through its existing Node/tsx command and the affected diagnostic regressions. Use existing verified fixture build inputs; if missing or stale, prepare only the required backend/controller, service/native test library and migrations with existing focused build commands. Preserve any unexpected red result with its checkpoint and exact seam instead of retrying blindly or changing service policy.
  - [ ] Run npm run lint, npm run typecheck, npm run check:docs and git diff --check after the changes. Document the diagnostic fields and the distinction between controlled evidence regression and pending original macOS reproduction in the service verification document, preserving historical receipts and failure records.

## Coordinator-Owned Gates After Executable Tasks

These gates are not executable Task checkboxes.
  1. Complete the separate authorized review/delivery phase for this diagnostic delta. Keep issueBaseSha fixed and use lastReviewedSha 6750b270 as the follow-up comparison baseline. Do not merge main or install global skills.
  2. Inspect the next actual windows-latest and windows-2022 job results and downloaded artifacts by exact SHA, run and attempt. Verify provenance, Node 22.21.1, completeness, privacy, real test exits and all failed/skipped/unreached outcomes.
  3. Evaluate each Windows hypothesis against the new evidence. Path inequality supports the mismatch hypothesis; matching fields plus denied probes supports probe denial; identity inequality supports inconsistent fixture setup. These observations alone do not authorize a policy change or prove attribution beyond the captured case.
  4. Inspect the next original macOS category-fixture result and its exact failure seam. A controlled failure validates evidence reporting only; a passing isolated rerun does not explain the historical concurrent failure.
  5. Keep both causes unproven until supporting evidence establishes them. If a cause is proven, create a separate bounded repair plan with public-boundary TDD and required original-scenario verification. If evidence remains ambiguous, retain the failures and choose a further bounded diagnostic stage.
  6. The coordinator owns diagnosis-record/snapshot/tracker updates and acceptance decisions. Windows/product acceptance, Issue #19 UI continuation and whole-issue completion remain pending where their required evidence is absent.

## Completion Criteria for This Diagnostic Stage

  - Two executable tasks only, with focused behavioral regressions and proportionate checks.
  - Windows diagnostic collection is independent of product/native dependencies and retains honest observer/test failures.
  - Artifacts contain bounded sanitized evidence with exact SHA/run/attempt provenance.
  - Fixture evidence identifies recovery versus lifecycle assertion seams while retaining strict failure semantics.
  - Production ownership and service recovery policy remain unchanged.
  - Actual CI inspection and any proven-cause repair remain coordinator gates.
