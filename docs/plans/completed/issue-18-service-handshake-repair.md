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

- [x] Preserve references to the original Windows positive and negative artifacts and the red-capable commands npm run smoke:rename:service and npm run test:rename:early. Inspect the existing emitted inputs and record whether a targeted refresh is necessary before running fixtures.

- [x] Create a disposable finite Node-parent/actual-Electron-main ready/result/ack/exit probe. Test ranked predictions separately: an early listener still times out if the Windows main stdin route is unusable; moving the listener alone repairs loss if listener timing is causal; finite parent write callbacks/errors and receiver observations expose delivery failure independently of service execution. Record the actual host and leave unperformed Windows comparisons pending.

- [x] Strengthen the positive real-service regression before changing transport. Require ordered result, ack_sent, ack_received, exit_sent and main_exit, exactly one handshake, exit code zero, no signal or timeout, valid protocol, all 16 named scenarios passed, both mounted-case observations, observed successful utility exits, confirmed shutdown and removed fixtures.

- [x] Replace fixture stdin control with fixed ack and exit records beneath the supervisor-owned temporary root. Publish each through a same-directory temporary file and rename; accept only exact bounded commands in the legal sequence. Start receiver polling before main_ready, publish acknowledgment only after receiving the actual result, emit ack_received only after consuming that acknowledgment, and publish exit only after observing ack_received.

- [x] Keep publication, polling and errors finite under the existing overall deadline. Catch asynchronous publication/read failures, stop polls on every terminal path, retain sticky failure outcomes and sanitized diagnostics, and remove fixture data only after shutdown is confirmed. Missing acknowledgment must still reach a genuine bounded timeout.

- [x] Include tests/fixtures/project-rename-service-control.cjs in inputDigest in this task when introducing it. Add focused regression coverage proving the executable helper contributes to the digest without creating a broad hashing abstraction or mutating live fixture inputs.

- [x] Add tests for incomplete publication visibility, exact command/size limits, invalid/out-of-order/duplicate commands, publication/read failure and deadline disposal. Run node --test tests/project-rename-fixture.test.mjs against valid emitted inputs; all affected tests must pass before Task 2.

The replacement removes dependence on main stdin. Its success alone does not prove which stdin hypothesis caused the historical Windows failure.

**Task 1 execution evidence (2026-10-11, local only)**

- Host: macOS arm64; supervisor Node 22.21.1; actual Electron 44.7.0 with embedded Node 24.21.0. No Windows probe was executed. Windows listener-timing/route comparisons and historical stdin causality remain pending outside executable tasks.
- Original CI evidence remains unchanged under `work/issue-18/ci-38132376699/`. `work/issue-18/service-handshake-repair/original-windows-references.json` indexes both Windows standalone artifacts and every positive/negative control artifact, retaining the red-capable `npm run smoke:rename:service` and `npm run test:rename:early` commands. Both historical positive controls passed all 16 scenarios but timed out after ack_sent; the historical failure, malformed, missing-assertion, skipped and cleanup controls also timed out.
- `work/issue-18/service-handshake-repair/build-inspection.json` records byte-equal in-memory esbuild comparisons for controller, service entry, settings and both wrappers; all migrations/journal match. Existing native outputs postdate their unchanged sources; source/binary SHA-256 values are retained. No refresh, build, clean or dependency change was necessary. Actual final fixture execution loaded the retained native/service inputs successfully.
- Disposable stdin probes and ranked predictions are retained in `work/issue-18/service-handshake-repair/stdin-probe.json` and its two scratch scripts. Rank 1 predicts an unusable main stdin route times out with either listener placement; rank 2 predicts listener timing alone distinguishes late failure from early success; rank 3 predicts write callback/error observations separate parent failure from receiver silence. On this host both early and late listeners completed ready/result/ack/exit. Disabling the receiver timed out despite a successful write callback; closing the parent pipe reported write failure and timed out. Every experiment had finite parent/receiver deadlines. These observations do not identify the Windows cause.
- Before transport replacement, the strengthened positive regression passed locally with evidence under `work/issue-18/service-handshake-repair/baseline/success/`. Its mandatory ordered handshake would reject the retained Windows positive lifecycle; no local reproduction of the historical Windows failure is claimed.
- Final affected check: `WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR=work/issue-18/service-handshake-repair/task1-verified node --test tests/project-rename-fixture.test.mjs`, with Node 22.21.1 prepended to PATH: 16 passed, zero failures/skips. Log: `work/issue-18/service-handshake-repair/task1-verified-tests.log`. This includes exact/oversized/invalid/early/out-of-order/duplicate commands, incomplete publication, publication/read failures, stalled-callback publication expiry, receiver disposal and helper digest regression against disposable input copies.
- Final positive evidence: `work/issue-18/service-handshake-repair/task1-verified/success/service-checkpoint.json`; all 16 scenarios passed, both mounted-case observations were self_alias_staged, one ordered result/ack_sent/ack_received/exit_sent/main_exit handshake, main exit 0 without signal/timeout, valid protocol, five successful utility exits, independently confirmed shutdown and removed fixtures. Final executable inputSha256: `6021e5a7f6791596f6d1467ce26e5ada0f47f596a7696be5464b2347a8bfb9f1` (includes the new control helper).
- Inspected the final missing-ack artifact: all scenarios completed, result preceded a genuine supervisor timeout, no ack/exit instruction was sent, shutdown was confirmed and fixtures were removed. The current executable digest was independently compared with the final positive artifact and matched.
- ESLint passed for the four changed executable/test files; `npm run check:docs` checked 81 Markdown files; `git diff --check` passed. Task 2's precise negative-control acceptance and Task 3's broader focused/native checks, standalone smoke and documentation remain unperformed by this iteration. No production, native, dependency, build or CI input was changed.

### Task 2: Make negative controls prove their intended failures

Files:

- Modify: tests/project-rename-fixture.test.mjs.

- Modify: tests/fixtures/project-rename-service-electron.cjs.

- Modify: tests/fixtures/project-rename-service-control.cjs.

- Modify: scripts/smoke-project-rename.mjs.

- [x] Replace broad failure-only assertions with precise scenario and lifecycle expectations. The failure control must report the intended failed scenario, complete the handshake and exit main with code one. Missing-assertion and skipped controls must preserve their intended scenario status, complete the handshake and exit zero while supervisor acceptance remains false.

- [x] Require malformed-output control to retain a sticky protocol failure while completing its otherwise valid handshake and normal exit. Require cleanup control to complete a successful handshake and normal main exit before reporting cleanup failed. Reject unrelated timeout, acknowledgment loss or signal termination in these controls.

- [x] Require missing-ack control to complete the scenarios and reach result, send neither acknowledgment nor exit instruction, genuinely time out, confirm shutdown and remove fixtures. Require worker-timeout control to reach its live-worker checkpoint and time out before result. Avoid platform-specific signal or termination-code assumptions.

- [x] Add bounded transport-failure and premature-main-exit controls at the repaired seam. Assert their specific failure observations and shutdown/cleanup outcomes; unrelated protocol, delivery or termination failures must not satisfy an expected negative-control result.

- [x] Extend evidence tests to compare the persisted sanitized final outcome with the returned outcome, retain evidence-write-failure cleanup guarantees, and reject leaked mailbox paths, raw errors or private command data. Preserve existing scenario/path/native-identity privacy checks and unchanged stdout protocol limits.

- [x] Run node --test tests/project-rename-fixture.test.mjs and the relevant native protocol controls using node --test --test-name-pattern='supervisor parser|CRLF framing|stdout cannot pass' tests/project-rename-native.test.mjs. Cover LF/CRLF/whitespace and chunk boundaries, malformed/unknown/truncated records, byte/message limits and actual Electron protocol failure after acknowledgment. All selected tests must pass before Task 3.

**Task 2 execution evidence (2026-10-11, local only)**

- Host: macOS arm64; supervisor Node 22.21.1; actual Electron 44.7.0 with embedded Node 24.21.0. No Windows execution or historical stdin-causality claim. The original Windows artifacts remain untouched.
- Reused Task 1's valid emitted-input evidence because production/native/build sources and dependencies remain unchanged from `3419172b`. Checked emitted files exist and retained native/source SHA-256 values still match; no refresh/build/clean was needed. Reuse observations: `work/issue-18/service-handshake-repair/task2-build-reuse.json`.
- Regression first: `node --test --test-name-pattern='specific control-seam failure' tests/project-rename-fixture.test.mjs` failed all three new controls before fault injection was implemented, because each incorrectly returned success. Red log/artifacts: `work/issue-18/service-handshake-repair/task2-red-tests.log` and `task2-red/` beneath that directory.
- Final affected check, with Node 22.21.1 prepended to PATH: `WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR=work/issue-18/service-handshake-repair/task2-final node --test tests/project-rename-fixture.test.mjs`: 19 passed, zero failures/skips. Log: `work/issue-18/service-handshake-repair/task2-final-tests.log`. Every persisted control artifact equals its returned sanitized final outcome, including cleanup; occupied-file evidence failure still confirms shutdown/removal and preserves the occupied bytes. Privacy checks include mailbox paths/records and raw filesystem/helper errors. Valid ignored whitespace remains acceptable.
- Inspected all 11 final positive/control artifacts under `task2-final/`. Positive: all 16 scenarios passed, both mounted-case observations present, exactly one ordered result/ack_sent/ack_received/exit_sent/main_exit lifecycle, normal main exit 0, five successful utility exits, valid protocol, confirmed shutdown and removed fixtures. Failure: only direct.rename failed, all later scenarios unreached, complete handshake and main exit 1. Missing-assertion/skipped: only direct.rename has its intended exceptional status, complete handshake and main exit 0. Malformed: exactly one sticky malformed-record failure, all scenarios passed, complete handshake and main exit 0. Cleanup: all scenarios/handshake passed and main exited 0 before the injected cleanup-report failure. None of these controls timed out or lost acknowledgment.
- Missing-ack: all scenarios passed and result arrived, neither ack nor exit instruction was sent, then a genuine supervisor timeout occurred. Worker timeout: one utility reached worker_started before timeout, with no result and all scenarios unreached. Both confirm shutdown/removal without platform-specific signal or termination-code expectations.
- New bounded seam controls: occupied ack temporary record causes the real bounded publisher to report control_publish_failed with controlFailure=publish, without ack/exit publication or timeout; an exit-record directory causes the actual main receiver to report only the finite startup_failed/controlFailure=receive observation, exit 1 and no receiver acknowledgment/exit instruction. Both preserve passed scenarios and successful worker exits, valid stdout protocol, confirmed shutdown and removal. Premature main exit occurs after five successful worker exits but before result publication: main exit 7, no result/handshake, supervisor scenarios remain unreached, no protocol/control error or timeout, confirmed shutdown/removal. No raw receiver error is published; the existing stdout stage allowlist and byte/message limits are unchanged.
- All final control artifacts match the independently recomputed executable inputSha256 `74a218f1fb4ffe53da795793a59bba1cc76f2ca670712840f5f7bedc141f1039`, including the unchanged control helper.
- Relevant native check: `WORKSPACE_RENAME_NATIVE_EVIDENCE_DIR=work/issue-18/service-handshake-repair/task2-native-protocol node --test --test-name-pattern='supervisor parser|CRLF framing|stdout cannot pass' tests/project-rename-native.test.mjs`: 10 selected tests passed, zero failures/skips. Log: `work/issue-18/service-handshake-repair/task2-native-protocol-tests.log`; evidence: `task2-native-protocol/native-adapter.json`. Covers LF/CRLF/whitespace/chunk boundaries, malformed/unknown/truncated records, unchanged byte/message limits, actual development/ASAR Electron CRLF handshake and actual Electron protocol rejection despite acknowledged success. Exercised native/protocol inputs remained unchanged after this run.
- Targeted ESLint for the three changed executable/test files, `npm run check:docs` and `git diff --check` passed. Task 3's final focused suite, standalone service smoke, broader lint/type checks and development/report updates remain pending for the next iteration. No production, native, helper, dependency, build or CI file was changed; no tracker or coordinator state was edited.

### Task 3: Verify final inputs, document the repair and commit

Files:

- Modify: docs/development.md.

- Modify: docs/verification/issue-18-project-rename-service.md.

- Verify the updated fixture tests and executable files from Tasks 1–2.

- [x] Remove temporary diagnostic instrumentation and obsolete scratch probes before final verification. Confirm production/build inputs remain unchanged and the existing emitted outputs remain valid; refresh affected outputs only if inspection establishes a real need.

- [x] Run npm run test:rename:early once against final executable inputs with WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR set to a fresh ignored directory, retaining separate control artifacts. Require all focused tests to pass and inspect the positive and negative lifecycle evidence.

- [x] Retain passing relevant native protocol controls from Task 2 when their exercised inputs remain unchanged. Rerun only affected controls if subsequent changes invalidate that evidence.

- [x] Run npm run lint, npm run typecheck, npm run check:docs and git diff --check. Do not introduce a full-suite or percentage coverage requirement.

- [x] Against the same valid build and final fixture inputs, run npm run smoke:rename:service with WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR pointing to another fresh ignored directory. Verify all 16 scenarios, both mounted-case observations, complete handshake, normal positive main exit, successful owned-utility exits, confirmed shutdown, valid protocol and removed fixtures. Confirm evidence identifies the final executable helper through inputSha256.

- [x] Update the development guide and verification report with the bounded fixture-repair verification commands, actual host/runtime/results, final input digest, precise negative-control expectations and retained Windows failure. Keep the earlier full-service verification history intact and Windows causality/acceptance explicitly pending.

- [x] Recheck documentation links and git diff --check after documentation edits. Inspect the complete diff, stage only repair files and create an English local commit. Report actual checks, evidence, limitations and commit in Russian; leave tracker ownership and issue completion to the coordinator.

**Task 3 execution evidence (2026-10-11, local only)**

- Final executable inputs remain those committed in `3419172b` and `6c803c02`; this task changes only the development guide, verification report and this plan. Inspected fixture supervision and receiver code: permanent bounded fault controls remain, with no temporary stdin/probe instrumentation. Removed obsolete ignored `stdin-parent.mjs`, `stdin-main.cjs` and `inspect-build.mjs` scratch scripts before final verification; retained original Windows artifacts, probe results, references and historical logs unchanged.
- Host: macOS 27.0 (26A428), arm64; supervisor Node 22.21.1 selected through its existing PATH; actual Electron 44.7.0 / embedded Node 24.21.0. Repeated byte-equal in-memory esbuild comparisons for controller, entry, settings and both wrappers; all migrations/journal match. Native source/binary SHA-256 values match Task 1; production/native/dependency/build/CI inputs remain unchanged from `113721ca`. No build, clean, refresh or install was necessary. Inspection/reuse records: `work/issue-18/service-handshake-repair/task3-build-inspection.json` and `task3-reuse.json`.
- Ran `WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR=work/issue-18/service-handshake-repair/task3-early npm run test:rename:early` once against final executable inputs and retained valid outputs: 309 passed, zero failures/skips/cancellations. Log: `task3-early-tests.log` beneath that repair evidence directory. Inspected all 11 separate positive/control artifacts in `task3-early/`: the positive lifecycle and every specific negative expectation passed. Failure/missing-assertion/skipped/malformed/cleanup complete the handshake without unrelated timeouts/signals; missing-ack and live-worker controls genuinely time out at their intended checkpoint; publication/read failures and premature exit retain only their intended finite observations. Shutdown is confirmed throughout; cleanup is removed except the intentional cleanup-report failure.
- Retained Task 2's 10 passing selected native protocol controls, with zero failures/skips, rather than repeating them. Verified exercised native/protocol fixtures/tests/build inputs and binaries remain unchanged. Original evidence/log: `task2-native-protocol/native-adapter.json` and `task2-native-protocol-tests.log`; reuse record retains the artifact SHA-256. No subsequent executable input changed.
- `npm run lint` (zero warnings), `npm run typecheck`, `npm run check:docs` (81 Markdown files) and `git diff --check` passed. Logs: `task3-lint.log`, `task3-typecheck.log`, `task3-docs-initial.log` and `task3-docs-final.log`. Rechecked documentation links and whitespace after final documentation/plan edits; inspected the complete task diff. No full suite or percentage coverage gate was run.
- Separate `WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR=work/issue-18/service-handshake-repair/task3-standalone npm run smoke:rename:service` passed against the same build and final fixture inputs. Log: `task3-standalone-smoke.log`; artifact: `task3-standalone/service-checkpoint.json`. Both final positives passed all 16 scenarios, observed self_alias_staged in direct/grouped modes, exactly one ordered result/ack_sent/ack_received/exit_sent/main_exit handshake, main exit 0 without signal/timeout, five successful utility exits, valid protocol, independently confirmed shutdown and removed fixtures.
- Independently recomputed inputSha256 `74a218f1fb4ffe53da795793a59bba1cc76f2ca670712840f5f7bedc141f1039` matched standalone and all focused artifacts; the executable control helper is included. Evidence inspection record: `task3-evidence-inspection.json`. Updated development commands, transport guarantees, precise negative expectations, actual results/digest and pending Windows acceptance in the maintained report while preserving earlier full-service history.
- Only the three explicit documentation/plan paths belong in this local commit. Original Windows run 38132376699 remains failed; no Windows probe, root-cause conclusion or exact-reviewed-SHA platform acceptance is claimed. Separate review/external CI remain coordinator-owned gates outside executable Task checkboxes; no tracker/run-state mutation, push, CI dispatch, merge, signing, release or publication was performed.

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
