# Issue #18 Runtime Source-Disconnect Diagnosis and Repair

## Overview

Repair the disposable runtime fixture’s single-attempt source disconnect/restore operation without weakening application assertions or changing production filesystem policy. Use the explicitly selected mattpocock-skills:diagnosing-bugs route: retain the existing red feedback loop, distinguish established findings from hypotheses, write a regression before repair, verify the original runtime scenarios, and remove temporary probes.

Target plan path: docs/plans/issue-18-runtime-source-disconnect-repair.md.

Planning does not authorize automatic implementation.

## Context

- Requirements: work/ralphex/issue-18/task.md.

- GitHub: https://github.com/kornouhovas/workspace/issues/18 remains open.

- Beads: workspace-31i.11 remains owned and in progress.

- Branch: codex/issue-18-project-rename.

- Immutable issue base: a5728daa64caab6b90700854ad5e27417fcf683e.

- Current clean checkpoint and subsequent repair-review base: 2e6444d0e200c9df73081042671731af463eb199.

- Prior service, native and handshake plans are complete and must not be re-executed.

- Coordinator owns tracker updates, run state, review interpretation, push and CI orchestration.

Files involved:

- scripts/smoke-runtime.mjs: source disconnects and restores currently near lines 529, 555, 566 and 569.

- scripts/runtime-lifecycle.mjs and tests/runtime-lifecycle.test.mjs: existing shutdown, ownership and cleanup contracts.

- scripts/windows-rename-diagnostics.mjs, scripts/windows-rename-diagnostics.ps1, scripts/windows-rename-node-worker.mjs and scripts/windows-rename-realpath-worker.mjs: existing bounded single-attempt controls.

- src/service/source-observer.ts and relevant discovery/canonicalization code: read-only diagnostic context.

- New scripts/runtime-source-disconnect.mjs and tests/runtime-source-disconnect.test.mjs: narrowly scoped fixture helper and regressions.

- New tests/fixtures/runtime-source-disconnect-holder.ps1: dedicated Windows sharing control if existing fixed-path controls cannot exercise the selected-root seam safely.

- docs/development.md and a new docs/verification/issue-18-runtime-source-disconnect-repair.md: verified behavior and limitations.

- .github/workflows/desktop-ci.yml: inspection only; its existing npm test invocation discovers new test files.

### Established evidence

CI run https://github.com/kornouhovas/workspace/actions/runs/38136094122 failed only in Windows Server 2022 development runtime smoke. The second disconnect, after stopSmokeChanges, rejected fs.promises.rename with EPERM, errno -4048. The first disconnect/restore completed. Failure cleanup passed. Packaged runtime on the same runner, macOS verification, Windows Latest verification and all early service jobs passed.

Retained evidence:

- work/issue-18/ci-38136094122/run.json

- work/issue-18/ci-38136094122/windows-2022-job.log

- work/issue-18/ci-38136094122/windows-2022-runtime-artifacts/ci-runtime-dev/dev-observations.json

- work/issue-18/ci-38136094122/windows-2022-runtime-artifacts/ci-runtime-release/release-observations.json

- work/issue-18/ci-38136094122/category-diagnostic/rename-observations.json

- work/issue-18/runtime-disconnect-diagnosis/windows-sharing-comparison.json

The minimized replay extracts the actual second-disconnect callsite, injects the captured EPERM at its rename seam, and otherwise uses real temporary directories and sentinel bytes:

PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH node --test work/issue-18/runtime-disconnect-diagnosis/source-disconnect-replay.test.mjs

Original retained result: 0 passed, 1 failed, EPERM, approximately 58 ms total. Planning rerun: 0 passed, 1 failed, EPERM, approximately 57 ms total.

This establishes propagation of a transient failure through the fixture’s one-shot operation. It does not reproduce or identify the historical Windows lock owner.

Existing same-checkpoint Windows controls show parent rename failures with concurrent descendant realpath.native, despite the service being closed: native stress failed 4/4; idle, legacy realpath and production scan comparisons succeeded 4/4 each. Controlled descendant handles also blocked parent moves. These establish a possible sharing mechanism, not attribution of the failed smoke operation.

### Ranked hypotheses and diagnostic limits

These hypotheses were already presented to the user; preserve their order and test only distinctions still needed for the repair:

1. If concurrent descendant canonicalization causes blocking, native canonicalization overlap should increase blocked moves compared with quiescent operation. Existing controlled evidence supports this mechanism.

2. If the first restore outruns completed source refresh, awaiting actual refresh completion should change failure frequency. A heading disappearing alone does not establish quiescence.

3. If another runner process owns the handle, blocking should remain possible without the application service. Existing closed-service controls show that service activity is not necessary for the controlled mechanism.

Do not infer an observer defect or exact lock ownership from these observations. Additional probes must change one variable at a time and have a fixed operation/time budget. Insufficient attribution does not justify production changes.

### Primary references

- Node 22.21.1 filesystem API: https://nodejs.org/download/release/v22.21.1/docs/api/fs.html

- Microsoft MoveFileExW: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw

- Microsoft CreateFileW sharing semantics: https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew

Keep Node error codes distinct from Win32 codes. The documented fs.watch EPERM case on deletion is not evidence about this fs.rename failure.

## Development Approach

- Testing approach: TDD at the actual fixture-move seam, using the existing minimized replay as the starting regression.

- Complete each task and its affected tests before starting the next. Expected red results occur within Task 1 before repair; the task ends only after regressions and controls pass.

- Every code-changing task includes new or updated behavioral tests.

- Use Node 22.21.1 and the committed dependencies. Add no dependencies, privileges, network listeners or native mutation fallback.

- Keep repair confined to the four selected-root disconnect/restore calls. Other runtime renames, production observers, project rename policy and historical diagnostic semantics remain unchanged.

- Use only explicitly owned disposable roots. Validate containment, directory kind, identity, expected contents and destination absence before attempting a move.

- Canonicalize the owned temporary fixture root once and derive fixed child paths from it. Preserve legitimate platform temporary-directory aliases such as macOS /var to /private/var; do not mistake them for an unsafe caller-selected path. Reject unsafe source or ancestor reparses within the owned fixture boundary.

- The existing fixture intentionally contains descendant symbolic links. Inventory those links by their link text without traversing their targets; preserve and compare them across moves. Do not reject a valid fixture merely because its contents include those expected links.

- Retry only Windows EPERM from the actual rename operation. It is evidence for a bounded retry candidate, not proof of transient sharing. Other codes fail immediately unless separately justified by new evidence.

- Bound moves to at most 20 attempts over a 2,000 ms retry budget, with 100 ms spacing capped by remaining time. Never start another attempt after either bound.

- A pending Node filesystem operation cannot be cancelled by Promise.race. Await its settlement; never abandon an in-flight move or clean up concurrently with it. Record a late completion as a deadline failure.

- Revalidate ownership, source identity/content and destination absence before retrying. Permanent locks and access denial must ultimately reject; changed, foreign, linked, missing or occupied paths must fail without overwrite.

- Ordinary Node rename plus validation does not establish atomic no-replace protection against adversarial concurrent substitution. Document the disposable-fixture ownership boundary.

- Preserve the first failure, actual operation effects and finite retry observations. New evidence excludes raw paths, names, identities, file contents, PIDs, stacks and exception messages.

- Do not introduce arbitrary percentage-coverage gates or repeat unchanged full-suite runs.

## Implementation Steps

### Task 1: Lock down the failing seam and repair the owned fixture move

Files:

- Create: scripts/runtime-source-disconnect.mjs

- Create: tests/runtime-source-disconnect.test.mjs

- Modify: scripts/smoke-runtime.mjs

- [x] Reconfirm the failure location and retained evidence. Preserve the existing replay unchanged as historical diagnostic evidence; strip terminal escapes and redact paths before displaying selected CI log lines.

- [x] Extract the selected-root move into a fixture-only callable helper, initially preserving single-attempt behavior. Wire all four disconnect/restore calls through it. Establish an executable regression that reaches this shared helper with real temporary directories, a first-attempt captured EPERM and subsequent real Node rename; observe the intended red failure before repair.

- [x] Implement the bounded Windows-only EPERM policy, private dependency injection for deterministic platform/clock/rename controls, and ownership checks. Capture full root identity and a no-follow content inventory; verify unchanged source and absent destination before retry, then source absence, matching destination identity and unchanged bytes after success.

- [x] Add regressions for both move directions, first-attempt success, transient EPERM recovery, non-Windows single-attempt failure, immediate nonretryable failure, attempt/deadline exhaustion, permanent EPERM/access-denial behavior, missing or substituted source, links/junctions, changed bytes and occupied destinations.

- [x] Add false-success and late-completion controls: a rename callback that resolves without moving cannot pass; unexpected or late effects remain failures and never trigger blind replay or rollback. Confirm unrelated paths remain intact.

- [x] Run node --test tests/runtime-source-disconnect.test.mjs. Require the previously red behavioral regression and all portable negative controls to pass. Confirm runtime callsites invoke the tested helper; source-text checks may supplement, but cannot replace, execution.

Task 1 verification (local macOS, Node 22.21.1, starting checkpoint `82434841`):

- Re-read retained run metadata and sanitized Windows Server 2022 log lines: second disconnect at the historical line 566 rejected Node rename with EPERM, errno -4048. Historical owner attribution remains unproven; no production policy changed.
- Before extraction, the unchanged ignored historical replay failed as expected: 0 passed, 1 EPERM failure, approximately 50 ms. After extraction and before repair, `node --test tests/runtime-source-disconnect.test.mjs` reached the same callable helper through the actual second-disconnect callsite and failed as expected: 0 passed, 1 EPERM failure, approximately 52 ms.
- After repair, `node --test tests/runtime-source-disconnect.test.mjs` passed all 51 tests (33 top-level cases), with no skips. The final affected rerun with `--test-reporter=dot` also passed. All four extracted runtime calls execute the helper with actual temporary-directory moves; this does not claim Electron/UI runtime acceptance.
- Scoped ESLint for both scripts and the new test, Node syntax checks for both scripts, and `git diff --check` passed. No dependencies, production service files, historical diagnostics, trackers or CI gates changed.
- Only owned fixture moves may retry Windows EPERM, at most 20 attempts within a 2,000 ms budget, spacing up to 100 ms. Verified contents include expected descendant link texts without traversing targets. In-flight operations are awaited; late or unexpected effects fail without replay or rollback. Ordinary Node rename retains the documented adversarial substitution/no-replace limitation.
- Actual Windows sharing controls, persisted scenario evidence/lifecycle controls and full development/packaged runtime smoke checks belong to Tasks 2–4 and remain unperformed in this iteration.

### Task 2: Preserve runtime assertions and finite failure evidence

Files:

- Modify: scripts/smoke-runtime.mjs

- Modify: scripts/runtime-source-disconnect.mjs

- Modify: tests/runtime-source-disconnect.test.mjs

- Modify: tests/runtime-lifecycle.test.mjs

- [x] Record a bounded outcome for each of the four moves, including direction/scenario identifier, attempts, elapsed time, first allowlisted error code, final status and verified-effect booleans. Persist failure observations before propagating failure.

- [x] Retain real unavailable/restored UI checks, the first subscription’s two actual workspace.sourceChanged events, and the second cycle’s unsubscribe assertion. Do not synthesize events, skip disconnects or disable native observation.

- [x] Verify root bytes/inventory and retained project, workspace, source, view and Text state across disconnect/restore. Preserve sibling notification routing and unrelated-source isolation.

- [x] Add evidence regressions proving missing effects, incomplete verification, exhausted budgets and skipped/unreached operations cannot become success; reject private fields and bound output size.

- [x] Add lifecycle controls showing a source-move failure remains primary through evidence collection, normal quit attempts and independently verified cleanup. Cleanup success or forced process termination cannot promote the scenario to passed.

- [x] Run node --import tsx --test tests/runtime-source-disconnect.test.mjs tests/runtime-lifecycle.test.mjs tests/windows-rename-diagnostics.test.mjs. Require all applicable controls to pass; record Windows-only skips as pending platform verification.

Task 2 verification (local macOS, Node 22.21.1, starting checkpoint `2f63025978d9ac430dfcdd83b9489853d1f1ff30`):

- The four actual runtime callsites use the tested evidence wrapper and shared move helper. Fixed subscribed/unsubscribed disconnect/restore records carry status, attempts, elapsed time, first allowlisted error code, final finite code and effect/verification booleans. Unreached operations remain explicit; snapshots cannot mutate the ledger. Failure evidence is awaited before propagation. Missing effects, incomplete verification, expired/exhausted budgets, malformed/private fields and pending persistence cannot complete the scenario. Serialized move records stay below the tested 4 KiB bound; new records contain no paths, names, identities, bytes, PIDs, stacks or raw exception messages.
- Executed the runtime's extracted state assertions against a disposable real SQLite service and actual helper moves in both cycles. Project/retained projections, workspace/source/view identities, exact Text and revisions, no-follow root inventory, unrelated source and external-link target bytes remained unchanged. Real service subscriptions produced two source availability events routed to the two referencing workspaces, then no additional subscription events after unsubscribe. The original graphical unavailable/restored checks, event assertions and native observer configuration remain in place; this service-level control does not establish Electron/UI acceptance.
- Executed the runtime's actual failure/finally wiring with an injected missing-effect fixture move, real owned child processes, normal and forced shutdown controls, successful and failing evidence collection, and independent filesystem/process probes. The original move error remained primary; final scenario evidence stayed failed, unreached moves stayed unreached, fixture removal was verified and an unrelated directory survived. Forced termination was never treated as normal shutdown or scenario success.
- Final `node --import tsx --test tests/runtime-source-disconnect.test.mjs tests/runtime-lifecycle.test.mjs tests/windows-rename-diagnostics.test.mjs` passed: 149 tests, 146 passed, zero failures, 3 Windows-only skips. The skipped actual Windows bridge, PowerShell GENERIC_READ binding and fixed-target holder rejection controls remain pending actual Windows execution by the coordinator. The final corrected implementation inputs were rerun; the later retained-project/Text extension also passed its affected test. Earlier affected iterations exposed and corrected symbol-key rejection and the distinction between workspace summaries and active workspace identities.
- Scoped ESLint for the two scripts and two tests, Node syntax checks for both scripts, documentation links and `git diff --check` passed. No production service, historical diagnostics, dependencies, CI gates, tracker or run-state files changed. Full development/packaged Electron smoke, actual Windows sharing acceptance and the independent #44 shutdown issue remain outside this iteration, owned by Tasks 3–4 and coordinator acceptance.

### Task 3: Add actual Windows release and persistent-block controls

Files:

- Modify: tests/runtime-source-disconnect.test.mjs

- Create if required: tests/fixtures/runtime-source-disconnect-holder.ps1

- [x] Reuse existing bounded process orchestration and sharing-control patterns. If a dedicated holder is necessary, restrict it to fixed descendants of a generated disposable runtime fixture; reject caller-selected paths, aliases, reparses and occupied destinations. Preserve historical single-attempt diagnostic workers.

- [x] Add a Windows-only release control that establishes actual holder readiness before moving the selected source root through the shared helper, requires at least one real blocked Node rename, releases the descendant handle through a bounded handshake, and requires a subsequent actual move with unchanged identity and bytes. Actual Windows execution remains coordinator acceptance below.

- [x] Add a Windows-only persistent-block control that keeps the handle open until the helper exhausts its budget, requires rejection, unchanged source and absent destination, then releases the handle during teardown. Add a no-holder positive control. Actual Windows execution remains coordinator acceptance below.

- [x] Bound subprocess lifetime and output; verify holder exit before fixture removal. Missing readiness, release, expected blocking, process termination or cleanup must fail the control. Do not rely solely on sleeps to establish overlap.

- [x] Run the portable focused suite locally. Guard actual OS sharing cases with an explicit Windows-only condition and report them as pending on macOS. Confirm existing npm test discovery includes them without changing CI gates.

- [x] Require all locally executable tests to pass before Task 4. Retain the exact Windows command and expected assertions for coordinator-run CI; do not claim observed Windows success from local skips.

Task 3 verification (local macOS, Node 22.21.1, starting checkpoint `d329c3482f7a5b694ddfc33e744a448d9fe2a915`):

- Reused the unchanged `runBoundedProcess` runner with a 10,000 ms holder deadline, 1,000 ms termination-confirmation bound and 4,096-byte combined output limit. The existing diagnostic holder targets another layout, so the new test-only PowerShell holder opens only `SelectedProjectRoot/nested` beneath a canonical generated `workspace-runtime-*` immediate child of the platform temp directory. It rejects extra path arguments, foreign roots, fixture aliases, reparses, wrong directory kinds and occupied destinations; stdout carries only a finite version/stage/opened/released protocol. Historical single-attempt diagnostics, production code, dependencies and CI gates remain unchanged.
- The Windows release test requires actual readiness and a real Node `rename` EPERM before the stdin release handshake. It awaits explicit handle-release evidence and normal holder exit before the helper retries; success requires matching identity, inventory and bytes, followed by a real restore. The persistent test retains the handle through attempt/deadline exhaustion, checks unchanged source/absent destination and releases only afterward. A separate no-holder control requires successful real disconnect and restore. These are implemented assertions, not observed Windows results.
- Portable controls executed the same test orchestration and production helper with deterministic blocking seams and real temporary-directory moves. They verified release ordering, 20-attempt persistent rejection, readiness/release/timeout/termination/missing-block/wrong-code rejection, no cleanup before move settlement or confirmed process exit, and rejection of missing cleanup effects. A late actual move was awaited after a simulated holder timeout and remained a failure without replay or rollback.
- Actual owned Node subprocesses exercised the reused runner's stdin readiness/release handshake, normal exit, missing readiness, missing release and output-limit termination. Independent process probes confirmed those children exited before verified fixture removal; unrelated sentinel bytes remained intact. These subprocess controls do not emulate Windows sharing semantics.
- Final `node --import tsx --test tests/runtime-source-disconnect.test.mjs tests/runtime-lifecycle.test.mjs tests/windows-rename-diagnostics.test.mjs` passed: 167 tests, 160 passed, zero failures, 7 explicit Windows-only skips. Retained local output: `work/issue-18/runtime-disconnect-repair-task3-tests.log` (ignored). Scoped ESLint, `node --check tests/runtime-source-disconnect.test.mjs`, documentation links and `git diff --check` passed. The existing `npm test` glob includes this test file, and the unchanged desktop CI runs `npm test` on macOS, Windows Latest and Windows Server 2022. No full build or graphical runtime check was performed in Task 3.

Coordinator acceptance pending outside executable Task checkboxes:

- On both actual Windows Server 2022 and Windows Latest, with Node 22.21.1 and built service inputs, run `node --import tsx --test tests/runtime-source-disconnect.test.mjs tests/runtime-lifecycle.test.mjs tests/windows-rename-diagnostics.test.mjs`. Require zero failures and no Windows-only skips; the release control must observe EPERM followed by a verified actual move, the persistent control must reject at its finite bound with unchanged source/absent destination, and the no-holder control must move successfully. Require holder input-rejection controls, normal holder release/exit and independently verified fixture cleanup. The three pre-existing Windows-only diagnostic controls also remain pending actual execution.
- PowerShell/Win32 holder execution and actual OS sharing were not available on this macOS host. Local portable passes and platform skips establish neither Windows acceptance nor historical lock-owner attribution. Full development/packaged runtime verification belongs to Task 4; exact-SHA external CI interpretation remains coordinator-owned.

### Task 4: Verify original runtime scenarios and document the repair

Files:

- Modify: docs/development.md

- Create: docs/verification/issue-18-runtime-source-disconnect-repair.md

- Modify only if verification exposes an in-scope defect: Task 1–3 files

- [ ] Inspect production outputs and the packaged macOS artifact for missing or stale inputs. Rebuild only when necessary, with no running fixture using dist; use the documented development packaging path if the artifact requires refresh.

- [ ] Against valid outputs, run the focused suite from Task 2, npm run lint, npm run typecheck, npm run check:docs and git diff --check. Reuse unchanged passing results where appropriate; corrections require affected reruns.

- [ ] Run the original full npm run smoke:runtime -- dev and npm run smoke:runtime -- release on local macOS, using distinct fresh WORKSPACE_SMOKE_EVIDENCE_DIR directories beneath work/issue-18/runtime-disconnect-repair. Require all reached acceptance stages, normal quit, backend exit and independently confirmed cleanup.

- [ ] Preserve each failed attempt and its unreached stages. Investigate failures without blind reruns, relaxed shutdown assertions or conversion of skipped scenarios to success. A failure outside the bounded repair becomes a documented blocker, not added product scope.

- [ ] Document commands, actual results, input checkpoint/digest, retry bounds, sanitized evidence, regression-before-fix results and limitations. State the proven one-shot fixture defect and controlled sharing mechanism separately from unproven historical ownership. Reference the active plan as a plain code path; recheck documentation after archival.

- [ ] Remove tagged temporary probes and throwaway implementation harnesses, retaining clearly marked ignored historical diagnosis evidence. Run docs/diff checks, inspect the final scope, and commit only completed verified task files with an English message stating the finding and its limits. Leave tracker/run-state files untouched.

## Acceptance Criteria

- The regression reaches the same helper invoked by the second runtime disconnect and demonstrates red before repair and green afterward.

- Both disconnect/restore cycles still perform actual filesystem moves and retain their original UI/event assertions.

- Retry policy is Windows-only, finite and limited to the owned fixture seam.

- Persistent blocking, access denial, unsafe paths, occupied destinations and missing effects remain failures.

- New observations retain first-failure information without leaking private data.

- Local development and packaged runtime results are recorded accurately, with normal shutdown and independent cleanup.

- Production service behavior and historical diagnostic controls remain unchanged.

- Verified changes are locally committed; unresolved platform gates remain explicit.

## Post-Completion

The executor stops after local repair, verification and commits. It does not push, dispatch Actions, merge, release, update trackers or continue to Name/recovery UI.

The coordinator separately reviews changes from 2e6444d0e200c9df73081042671731af463eb199, then performs the already authorized task-branch push and interprets fresh exact-SHA Actions results. Acceptance requires actual Windows Server 2022 and Windows Latest sharing controls and full development/packaged runtime results; historical passing jobs and local skips are insufficient.

GitHub #18 remains open. Name/recovery UI, unresolved-to-excluded projection coverage, broader graphical rename acceptance and final issue completion remain outside this repair. The independent macOS shutdown issue #44 is not resolved by a passing individual run.
