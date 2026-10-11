# Issue 18: Bounded Windows Service-Fixture Handshake Repair

## Overview

Repair the private control handshake between the Node supervisor and the actual Electron main service fixture. Preserve supervisor acknowledgment of the actual result, receiver acknowledgment, explicit exit instruction, finite deadlines, owned-process shutdown and cleanup.

Limit changes to fixture supervision, fixture tests and supporting documentation. Production behavior, build inputs, UI and CI configuration remain unchanged. Planning does not authorize automatic implementation.

Target plan file: docs/plans/issue-18-service-handshake-repair.md.

## Context

- GitHub issue: https://github.com/kornouhovas/workspace/issues/18.

- Beads execution step: workspace-31i.11, already owned in_progress. The coordinator owns tracker and run-state updates.

- Immutable issue base: a5728daa64caab6b90700854ad5e27417fcf683e.

- Last reviewed HEAD: 113721caca5ae1f15a5b8f859ada5d52412e7ef0.

- Failed checkpoint: CI run 38132376699; preserve original evidence under work/issue-18/ci-38132376699/.

- Both Windows early-service jobs and both Windows full-verification jobs failed the positive actual-Electron service fixture test.

- Both Windows standalone artifacts report all 16 scenarios passed, then result, ack_sent and supervisor_timeout. Neither contains ack_received or exit_sent. Shutdown and cleanup succeeded, but lifecycle acceptance failed.

- Windows stdout parsing remained valid. One ignored blank record does not establish a cause.

- macOS completed the handshake. This does not establish why Windows failed.

- Some Windows negative controls also timed out while satisfying their current broad assertions.

- The service fixture installs its stdin listener after publishing result. This is a hypothesis to investigate, not a proven cause.

- The native Electron fixture uses main/utility postMessage acknowledgment; it does not validate supervisor-to-main stdin.

Files involved:

- Modify: scripts/smoke-project-rename.mjs.

- Modify: tests/fixtures/project-rename-service-electron.cjs.

- Modify: tests/project-rename-fixture.test.mjs.

- Create: tests/fixtures/project-rename-service-control.cjs, containing only small fixture-specific command publication/read/validation helpers.

- Modify: docs/development.md.

- Modify: docs/verification/issue-18-project-rename-service.md.

- Read as context: tests/fixtures/project-rename-native-electron.cjs, tests/fixtures/project-rename-native-protocol.cjs, tests/project-rename-native.test.mjs, docs/ralphex.md and docs/adr/0007-no-replace-project-renames.md.

Related patterns: disposable fixture roots, finite allowlisted stdout records, sticky protocol failures, independently confirmed owned-process shutdown and sanitized evidence tied to inputSha256.

Dependencies: Node.js 22.21.1, locked installed dependencies and valid existing emitted service/native inputs. No new package, privilege or network service.

## Development Approach

- Testing approach: regression first at the actual supervisor/Electron-main seam, with focused helper tests.

- Complete each task and its affected tests before starting the next. Expected failing regression runs occur within a task before repair.

- Every code-changing task includes new or updated behavioral tests; all affected tests must pass before proceeding.

- Use the diagnosing-bugs sequence: preserve the original failing evidence, minimize the actual control seam, state ranked falsifiable predictions and change one variable at a time.

- Distinguish observed local results from unperformed Windows experiments. Successful local transport repair does not prove the historical Windows stdin cause.

- Reuse the final valid existing build. Rebuild only when inspection establishes that actual emitted inputs are missing, stale or changed; refresh only the required outputs.

- Do not run npm test or impose a percentage coverage gate for this private fixture repair.

- Run npm run test:rename:early once against final executable fixture inputs and the valid build, plus relevant native protocol controls and a separate real-service smoke.

- Use fresh ignored evidence directories for invocations that produce artifacts. Preserve historical failures and do not build or clean while fixtures consume dist.

- Keep shared helpers minimal: fixed commands and bounded operations only, without a general mailbox framework, pluggable transports or stdin fallback.

- Preserve unrelated edits. Stage explicit task files and commit verified coherent changes in English.

- Do not modify production/native/UI code, dependencies, package scripts, build or CI configuration, trackers, coordinator run state or historical completed plans.

- Do not push, dispatch CI, merge, publish, release or automatically continue after planning.

## Implementation Steps

### Task 1: Diagnose the main control seam and repair the bounded handshake

Files:

- Modify: scripts/smoke-project-rename.mjs.

- Modify: tests/fixtures/project-rename-service-electron.cjs.

- Modify: tests/project-rename-fixture.test.mjs.

- Create: tests/fixtures/project-rename-service-control.cjs.

- Diagnostic scratch files only: work/issue-18/service-handshake-repair/.

- [ ] Preserve references to the original Windows positive and negative artifacts and the red-capable commands npm run smoke:rename:service and npm run test:rename:early. Inspect the existing emitted inputs and record whether a targeted refresh is necessary before running fixtures.

- [ ] Create a disposable finite Node-parent/actual-Electron-main ready/result/ack/exit probe. Test ranked predictions separately: an early listener still times out if the Windows main stdin route is unusable; moving the listener alone repairs loss if listener timing is causal; finite parent write callbacks/errors and receiver observations expose delivery failure independently of service execution. Record the actual host and leave unperformed Windows comparisons pending.

- [ ] Strengthen the positive real-service regression before changing transport. Require ordered result, ack_sent, ack_received, exit_sent and main_exit, exactly one handshake, exit code zero, no signal or timeout, valid protocol, all 16 named scenarios passed, both mounted-case observations, observed successful utility exits, confirmed shutdown and removed fixtures.

- [ ] Replace fixture stdin control with fixed ack and exit records beneath the supervisor-owned temporary root. Publish each through a same-directory temporary file and rename; accept only exact bounded commands in the legal sequence. Start receiver polling before main_ready, publish acknowledgment only after receiving the actual result, emit ack_received only after consuming that acknowledgment, and publish exit only after observing ack_received.

- [ ] Keep publication, polling and errors finite under the existing overall deadline. Catch asynchronous publication/read failures, stop polls on every terminal path, retain sticky failure outcomes and sanitized diagnostics, and remove fixture data only after shutdown is confirmed. Missing acknowledgment must still reach a genuine bounded timeout.

- [ ] Include tests/fixtures/project-rename-service-control.cjs in inputDigest in this task when introducing it. Add focused regression coverage proving the executable helper contributes to the digest without creating a broad hashing abstraction or mutating live fixture inputs.

- [ ] Add tests for incomplete publication visibility, exact command/size limits, invalid/out-of-order/duplicate commands, publication/read failure and deadline disposal. Run node --test tests/project-rename-fixture.test.mjs against valid emitted inputs; all affected tests must pass before Task 2.

The replacement removes dependence on main stdin. Its success alone does not prove which stdin hypothesis caused the historical Windows failure.

### Task 2: Make negative controls prove their intended failures

Files:

- Modify: tests/project-rename-fixture.test.mjs.

- Modify: tests/fixtures/project-rename-service-electron.cjs.

- Modify: tests/fixtures/project-rename-service-control.cjs.

- Modify: scripts/smoke-project-rename.mjs.

- [ ] Replace broad failure-only assertions with precise scenario and lifecycle expectations. The failure control must report the intended failed scenario, complete the handshake and exit main with code one. Missing-assertion and skipped controls must preserve their intended scenario status, complete the handshake and exit zero while supervisor acceptance remains false.

- [ ] Require malformed-output control to retain a sticky protocol failure while completing its otherwise valid handshake and normal exit. Require cleanup control to complete a successful handshake and normal main exit before reporting cleanup failed. Reject unrelated timeout, acknowledgment loss or signal termination in these controls.

- [ ] Require missing-ack control to complete the scenarios and reach result, send neither acknowledgment nor exit instruction, genuinely time out, confirm shutdown and remove fixtures. Require worker-timeout control to reach its live-worker checkpoint and time out before result. Avoid platform-specific signal or termination-code assumptions.

- [ ] Add bounded transport-failure and premature-main-exit controls at the repaired seam. Assert their specific failure observations and shutdown/cleanup outcomes; unrelated protocol, delivery or termination failures must not satisfy an expected negative-control result.

- [ ] Extend evidence tests to compare the persisted sanitized final outcome with the returned outcome, retain evidence-write-failure cleanup guarantees, and reject leaked mailbox paths, raw errors or private command data. Preserve existing scenario/path/native-identity privacy checks and unchanged stdout protocol limits.

- [ ] Run node --test tests/project-rename-fixture.test.mjs and the relevant native protocol controls using node --test --test-name-pattern='supervisor parser|CRLF framing|stdout cannot pass' tests/project-rename-native.test.mjs. Cover LF/CRLF/whitespace and chunk boundaries, malformed/unknown/truncated records, byte/message limits and actual Electron protocol failure after acknowledgment. All selected tests must pass before Task 3.

### Task 3: Verify final inputs, document the repair and commit

Files:

- Modify: docs/development.md.

- Modify: docs/verification/issue-18-project-rename-service.md.

- Verify the updated fixture tests and executable files from Tasks 1–2.

- [ ] Remove temporary diagnostic instrumentation and obsolete scratch probes before final verification. Confirm production/build inputs remain unchanged and the existing emitted outputs remain valid; refresh affected outputs only if inspection establishes a real need.

- [ ] Run npm run test:rename:early once against final executable inputs with WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR set to a fresh ignored directory, retaining separate control artifacts. Require all focused tests to pass and inspect the positive and negative lifecycle evidence.

- [ ] Retain passing relevant native protocol controls from Task 2 when their exercised inputs remain unchanged. Rerun only affected controls if subsequent changes invalidate that evidence.

- [ ] Run npm run lint, npm run typecheck, npm run check:docs and git diff --check. Do not introduce a full-suite or percentage coverage requirement.

- [ ] Against the same valid build and final fixture inputs, run npm run smoke:rename:service with WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR pointing to another fresh ignored directory. Verify all 16 scenarios, both mounted-case observations, complete handshake, normal positive main exit, successful owned-utility exits, confirmed shutdown, valid protocol and removed fixtures. Confirm evidence identifies the final executable helper through inputSha256.

- [ ] Update the development guide and verification report with the bounded fixture-repair verification commands, actual host/runtime/results, final input digest, precise negative-control expectations and retained Windows failure. Keep the earlier full-service verification history intact and Windows causality/acceptance explicitly pending.

- [ ] Recheck documentation links and git diff --check after documentation edits. Inspect the complete diff, stage only repair files and create an English local commit. Report actual checks, evidence, limitations and commit in Russian; leave tracker ownership and issue completion to the coordinator.

## Completion Criteria

Local work is complete when the actual-Electron positive control and every negative control meet their precise lifecycle assertions, the required focused checks and standalone smoke pass against valid final inputs, sanitized evidence covers the executable helper, documentation states remaining limits, and verified changes are committed.

A timeout, skipped/unreached scenario, protocol error, missing acknowledgment, unconfirmed shutdown or failed cleanup cannot become positive acceptance. Local completion does not establish Windows acceptance or complete Issue #18.

## Post-Completion: External Windows Checkpoint

These coordinator-owned gates remain outside executable Task checkboxes:

- Inspect the implementation and perform separate follow-up review from 113721caca5ae1f15a5b8f859ada5d52412e7ef0 before an authorized task-branch push or CI run.

- Observe the existing macOS, windows-latest and windows-2022 early-service jobs and corresponding full verification at the exact reviewed commit.

- Inspect every control artifact and standalone service artifact. Windows acceptance requires all 16 scenarios, the complete result/ack_sent/ack_received/exit_sent/main_exit lifecycle, normal positive exit, expected control-specific failures, confirmed owned-process shutdown and cleanup.

- Preserve historical CI run 38132376699 as the original Windows failure. If no Windows stdin probe was executed, keep the historical stdin root cause unproven.

- Stop execution at this checkpoint. Failed or absent external evidence remains failed or pending; no automatic continuation is authorized.

## Exclusions

Production rename policy, storage, native adapter, renderer/preload contracts, Name editing/recovery UI, discovery retained-state repair, graphical Reveal, packaged rename acceptance, normal graphical Electron quit and Issue #44 remain outside this repair. No production, UI or CI configuration changes. Do not close Issue #18 or re-execute the completed service plan.
