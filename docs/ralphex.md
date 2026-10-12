# Ralphex execution and continuation

Use the installed `do-task-ralphex` skill for a selected, claimed Beads task. GitHub owns requirements; the coordinator owns tracker writes, platform acceptance and authorized delivery. These changes do not start Issue #18.

## Separate phases and verified continuation

Use Node 22.21.1 and prepend its bin directory to PATH. The repository runner creates a run-local Codex profile using gpt-6.1-sol (medium for task execution, high for planning/review), disables notifications/finalization and preserves global settings.

```sh
node scripts/ralphex-run.mjs init --dir work/ralphex/example --issue https://github.com/owner/repo/issues/123 --beads example-123 --base HEAD
node scripts/ralphex-run.mjs execute --dir work/ralphex/example --plan docs/plans/example.md
node scripts/ralphex-run.mjs review --dir work/ralphex/example
```

These are templates: substitute the actual selected task, immutable base and reviewed plan. Initialize only once. `execute` uses `--tasks-only`, so finishing implementation cannot start an automatic whole-branch review. `review` uses `--review`; the first pass collects all five perspectives, subsequent invocations compare changes after the last successful review with quality/implementation perspectives. Each invocation runs once. A failure returns nonzero and records `failed`; it never retries itself.

The coordinator invokes review explicitly after successful execution, inspecting evidence and confirming current ownership first. This version does not add an automatic `run` transition: a separate observer cannot prevent a synchronous combined runner from starting review after the observer detects lease loss. Keeping the phase boundary explicit preserves that decision while technical waits still avoid unchanged model polls.

Redirect full stdout/stderr to a new run log and retain the launcher's actual exec-session and exit status. Use the observer below to await events; do not create another model chat to perform polling. A runner completion snapshot must be followed by inspection/reaping of the actual launcher result.

`issueBaseSha` never changes. `lastReviewedSha` advances only after a zero exit, clean worktree and preserved ancestry. A review of that unchanged HEAD reuses its receipt. A change to a shared contract may require a wider review: initialize a separate review run against the original issue base and retain both receipts. A full issue diff and final acceptance remain coordinator responsibilities. Ralphex's own completed-plan move is retained in the snapshot.

Plans contain only executable tasks before the next external checkpoint. Keep CI/manual acceptance outside executable Task checkboxes. Required unperformed checks stay pending; optional skips retain their reason and never become acceptance. A completed execution/review phase does not close an issue or establish Windows acceptance.

## Waiting and resuming

```sh
node scripts/ralphex-run.mjs wait --dir work/ralphex/example --reason "Await Windows CI" --next "Inspect the completed result"
node scripts/ralphex-run.mjs resume --dir work/ralphex/example --evidence https://example.invalid/ci/123 --next "Review the corrected delta"
node scripts/ralphex-run.mjs show --dir work/ralphex/example
```

`wait` and `resume` never launch an executor. Evidence is a pointer, not automatic proof that a gate passed: inspect it and preserve failed/skipped/unreached outcomes. The subsequent phase is an explicit invocation. Do not resume because a timeout elapsed.

The exclusive `executor.lock` prevents simultaneous phases and coordinator writes during a live executor. After a killed launcher, inspect the recorded PID and owned child before removing a stale lock or repairing a `running` snapshot. Never steal a live lock. The runner requires a clean committed worktree and performs no staging, tracker mutation, push, merge or release.

## Compact source of current state

`current.json` holds only task references, worktree, fixed/review SHAs, phase/status, plan, last exit, next action and up to ten evidence pointers. It is atomically replaced at each transition. Read it first on continuation. `events.jsonl` retains historical snapshots; consult only events relevant to the current failure. Put detailed evidence in separate files and reference their paths/SHAs instead of appending old instructions to the snapshot.

Existing Issue #17 logs are retained unchanged. New runs use this format; historical `task.md`, `resume.md` and findings are conditional evidence, not additional live instructions.

## Bounded observation without a model call per poll

```sh
node scripts/ralphex-observe.mjs runner \
  --dir work/ralphex/example \
  --log work/ralphex/example/full.log \
  --cursor work/ralphex/example/observer.json \
  --budget-ms 50000 --poll-ms 250
```

The observer uses local timers and reads while that single call is pending. It returns a compact JSON observation on a meaningful transition, diagnostic, completion or budget deadline. It coalesces ordinary stdout and reads only new bytes; `RALPHEX_PROGRESS {"task":"Task 2/3: short title"}` announces advisory task/review progress. It recognizes raw markers and Ralphex's timestamped output, including wrapped JSON continued under the same timestamp. Log text cannot forge runner completion. New bytes are scanned in bounded chunks; incomplete lines, bounded wrapped markers and unread ranges remain in the source-bound cursor for the next invocation. Progress bursts return a short list and `progressTotal`, with the full ordered records in `progressEvidence`. Full output remains in the selected file. A deadline is a request to update/reassess, not a failed executor or permission to resume a dependency.

For physical CRLF logs, the parser removes only the CR immediately before an encountered LF from the completed line used to assemble wrapped JSON. Embedded CR stays intact. Pending line bytes, source logs, cursor offsets and progress record `from`/`to` positions retain the original bytes, including both EOL bytes; CR/LF split reads, observer restart and split UTF-8 characters use the same byte continuity contract. The existing 4096-byte physical-line limit (including CR, excluding LF), 4096-byte assembled-message limit, malformed rejection and bounded summaries remain unchanged.

Controlled macOS Node 22.21.1 public-observer regressions reproduced `deadline` instead of `progress` for explicitly written CRLF wrapped input, then delivered both advisory tasks after the framing repair. This establishes the controlled CRLF mechanism. The retained failed Windows artifacts do not contain the original checked-out fixture bytes, so historical CRLF attribution remains unproven; actual Windows acceptance remains coordinator-owned.

CI envelopes exceeding 12 KiB retain their full job/step/artifact evidence in an observer-owned `<cursor>.details-<uuid>.json` file and return a bounded summary with `detailEvidence`. Large errors retain their full text in a diagnostic evidence file.

The observer owns only its cursor/evidence. It never edits runner state/events/lock, starts/retries an executor, changes acceptance, kills processes or clears locks. Cursor identity binds the run, execution and log; replacement/truncation or a foreign cursor is a diagnostic. Quiet stdout and a live PID do not prove progress or a hang. If the launcher disappears while its snapshot still says running, ownership remains uncertain; retain the lock and investigate its owned children before any recovery. Cancelling the observer leaves execution alone. A restricted sandbox can reject the read-only PID probe with `EPERM` even when matching runner/lock identities exist. This also returns `ownership_unknown`; it is not evidence that the process died. Use permitted observation of the explicitly selected owned run, or fall back to a bounded wait on the original known exec-session inside the same 60-second outer wrapper, then inspect its actual exit and source evidence. Do not weaken ownership checks or acquire broader process control. Keep the cursor and its evidence under the ignored run directory so observation cannot dirty the task checkout.

When a running snapshot's ownership becomes uncertain, the observer may read `current.json` once more within the existing observation budget. It accepts only a version-1 terminal publication (`failed`, `awaiting_review` or `awaiting_verification`) with the same run, execution, canonical run directory and worktree as the initially read snapshot and any invocation-bound cursor. Selected log identity and byte continuity still apply. A foreign, malformed or still-running publication retains ownership uncertainty; there is no retry loop, sleep, lock cleanup or runner write. Existing cursor mismatches remain diagnostics and unresolved ownership blocks every heartbeat transport call.

An isolated public-observer filesystem mock reproduced the exact controlled sequence: retain running snapshot bytes, publish same-execution failure, remove the fixture executor lock, then return the retained bytes. Before the consistency repair it returned `ownership_unknown`; afterward it retained the terminal exit/signal evidence for fresh and bound observations. This is bounded consistency handling for the observed symptom. Original failed Windows and macOS receipts remain unchanged; neither retains the historical snapshot/lock interleaving, so historical causation remains unproven and actual Windows acceptance remains coordinator-owned.

New snapshots retain version 1 with additive `runId`, canonical `runDirectory` and per-launch `executionId`; lock metadata retains PID and adds identity/token. Old snapshots/locks remain readable with limited ownership confidence, without being rewritten by observation. Start a new cursor and log for each execution/CI identity after inspecting the previous evidence. A lost cursor can reconstruct current state, but cannot prove that old events were delivered. Never point a cursor at runner-managed files or another owner's cursor.

The observer selects the run directory, log and cursor using the same `realpathSync` representation that runner initialization and lock publication record. Missing output paths use that representation for their existing ancestors. Recorded snapshot, lock and cursor identities still require strict equality; observation does not resolve or normalize foreign metadata into authorization. Signal-0, token, execution, worktree and log byte/inode continuity checks remain required. Output collision protection also checks filesystem identities and case aliases on supported platforms, protecting `current.json`, `current.json.tmp`, `events.jsonl`, `executor.lock` and the selected log, including collisions from derived observer outputs. Its case normalization applies only to rejecting output collisions.

Output-validation stat reads use `{ bigint: true }` and compare complete device/inode strings. Controlled distinct inode IDs `9007199254740992n` and `9007199254740993n` preserve foreign cursor-lock EEXIST refusal and reach terminal publication with foreign cursor identities; equal full-width identities and real hardlink/symlink aliases remain rejected. Only output validation changed. Log stat, opened-file stat and persisted version-1 `logIdentity` retain Number semantics and existing cursor continuation without migration. Rounded log identity continuity is outside this repair. Historical filesystem identities were not retained, so these controls do not attribute the failed Windows run or establish Windows acceptance.

### Isolated Windows observer evidence

The pure-Node [observer diagnostic](../scripts/windows-observer-diagnostics.mjs) reproduces the existing synchronous fixture setup and selects it through the real asynchronous `observe` API. It runs two fixed cases, `current_process` and one ready `owned_child`, under disposable running-state/lock/log roots. It requires no npm install, tsx, Electron, database, native build or Ralphex installation.

With Node 22.21.1 selected, use a new ignored evidence directory:

```sh
node scripts/windows-observer-diagnostics.mjs prepare --output work/observer-example
node scripts/windows-observer-diagnostics.mjs diagnostic --output work/observer-example/diagnostic.json
node scripts/windows-observer-diagnostics.mjs tests --output work/observer-example/test-status.json
node scripts/windows-observer-diagnostics.mjs validate --output work/observer-example
```

Run the tests command even when the diagnostic returns nonzero. It launches exactly `node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs`, preserving the numeric test-process exit or explicit `unavailable` and `passed`, `failed`, `timed_out` or `unreached` status. Tests have a 90-second process deadline; a timeout remains failed. Timeout cleanup targets the owned test process group on POSIX or the owned supervisor tree through Windows `taskkill`, with a three-second Windows cleanup bound and a 1.5-second close wait. Cleanup failures remain failed timeouts with finite errno evidence; no unrelated process is selected. `prepare` initializes honest unreached records. `validate` requires both documents, matching checkout provenance and reached outcomes; missing, malformed or unreached evidence fails. Validation of a finite failed result does not change its original command failure.

The public CLI timeout regression shortens only the fixture deadline to 1.5 seconds through a preload passed as `pathToFileURL(preload).href`. Its real filename contains spaces and `#`, exercising URL encoding as well as Windows drive-path compatibility. Before reading any PID marker, it records finite launcher exit/signal/error-code, bounded stderr size/code and artifact/marker availability. Readiness requires both the actual Node test child and its owned Node descendant; the regression requires a strict finite `timed_out` artifact, nonzero CLI exit, nonzero or unavailable child exit, and independently confirms both processes have stopped within the cleanup bound. Missing startup, malformed evidence or failed cleanup fails the regression.

Task 2's macOS Node 22.21.1 control reproduced a pre-CLI `ERR_UNSUPPORTED_ESM_URL_SCHEME` with a drive-shaped raw preload argument and no status artifact or PID marker. Changing only that argument to a file URL reached the timeout and stopped the child. A separate real-file `#` regression failed with `ERR_MODULE_NOT_FOUND` before the argument repair and passed afterward. Private probe stderr remains in ignored local evidence under `work/issue-19/windows-observer-path-repair/task2/`; uploaded schemas and production supervision/deadlines are unchanged. These controls support the fixture repair but do not attribute the historical Windows missing-marker failure. Actual Windows startup/tree cleanup by exact SHA remains a coordinator-owned gate, and the historical terminal-state race remains unproven.

Schema version 1 uses strict keys and allowlisted finite values, rejecting extra fields and documents above 12 KiB. Validation requires kind `observer_diagnostic` in `diagnostic.json` and `focused_tests` in `test-status.json`; duplicate or swapped document kinds fail. Each document carries the full checkout commit SHA, run ID, attempt, matrix label, platform and Node version. The checkout SHA must match `GITHUB_SHA` when present; local invocations use run ID/matrix `local` and attempt 1. CI uses the actual GitHub run/attempt and `OBSERVER_MATRIX` runner label. The diagnostic emits exactly one sanitized JSON document and persists that same document.

Per-case `identity` contains equality/validity booleans for synchronous/asynchronous canonical directory/log paths, state/lock run and execution identities, directories, worktree, lock token/PID validity, the owned PID comparison and every public observer source identity field. `probe` records signal-0 `allowed`, `denied` or `unavailable`, plus numeric errno bounded to absolute value 65,535 or `unavailable`. `observer` retains collection status, allowlisted public reason/ownership/diagnostic code, bounded numeric exit/errno or `unavailable`, without copying the full observer object. `inputsUnchanged` checks state/lock/log bytes. Cleanup records removal, owned-child exit and its bounded exit code. No tokens, identity values, PIDs, raw paths, environment contents, exception messages/stacks or raw log excerpts enter these documents.

`directorySyncAsyncEqual` and `logSyncAsyncEqual` remain raw synchronous/asynchronous string comparisons. They may honestly be false on Windows while observer ownership is identified. `stateDirectoryMatchesSource`, `lockDirectoryMatchesSource`, `observerSourceDirectoryEqual` and `observerSourceLogEqual` now compare against the synchronous canonical observer representation. An ordinary diagnostic requires the remaining identity booleans, allowed probe and identified deadline outcome; raw inequality alone is not anomalous. Validation continues to accept finite anomalous failure evidence without converting it into success. Historical artifacts retain their original comparison semantics and results.

Each observe call is aborted/raced at two seconds, with at most 200 ms afterward for its own cursor-lock cleanup. The diagnostic supervisor bounds worker collection to ten seconds, reaps only its worker and removes its own disposable parent; the owned Node child has a seven-second self-expiry and normally exits through an explicit stop. Provenance lookup is limited to two seconds and worker reaping to 1.5 seconds, keeping the diagnostic process within fifteen seconds. Collection errors, invalid results, timeouts and unreached cases remain explicit. `collection: complete` means evidence was collected and inputs/cleanup checked; an `outcome: anomalous` such as honest `ownership_unknown` still returns exit 1. No observation infers a cause or changes ownership/probe policy.

The original `verify` full-suite collector call also retains one fixed `collector.json` before its first collection assertion when `WORKSPACE_OBSERVER_CALL_EVIDENCE_DIR` is set. Run `node scripts/windows-observer-diagnostics.mjs validate-call --output <directory>` to validate that single regular file, bounded to 12 KiB, against the actual checkout SHA, platform, Node version, run, attempt and `OBSERVER_MATRIX`. Absent, malformed, private, foreign or unreached evidence fails validation. A strictly validated failed collection remains uploadable evidence; validation does not pass its original test. The existing full-suite job validates with `always()` and uploads only that exact file after successful validation, with seven-day retention and OS/SHA/run/attempt in the artifact name. Dedicated diagnostic success cannot replace original full-suite acceptance.

The [bounded residual plan](plans/issue-19-residual-acceptance.md) retains the Windows-latest collection failure from run 38278860195 at `1ab9270062cec490c928ab7d50420aaa8bd05532`. Its original per-call document is missing. Four labeled injected controls distinguish readiness, case access, child exit and file removal failures; duration alone cannot identify the historical cause. The final three-suite local macOS check exited 0 with 130 passed and no skips. Red/green results, exact inputs and full logs are under `work/issue-19/residual-acceptance/observer/`; consolidated continuity and remaining coordinator gates are in `work/issue-19/residual-acceptance/handoff.json`. No ownership policy, deadline, concurrency or original npm test result changed.

The independent `windows-observer-diagnostic` job runs on `windows-latest` and `windows-2022`, pinned to Node 22.21.1, with fail-fast disabled and a five-minute limit. Diagnostic and focused tests are separate bounded steps; focused tests run after diagnostic failure. Two `always()` uploads select only `diagnostic.json` and `test-status.json`, retain them for seven days, fail on missing files and name artifacts with OS, full SHA, run ID and attempt. Raw stdout/stderr and fixture directories are excluded. Original failed steps retain their failed job conclusion; there is no `continue-on-error`.

Task 1 local verification ran on macOS 27.0 arm64 with Node 22.21.1. The final focused invocation returned exit 1: 78 of 79 tests passed without skips, including all eight new diagnostic regressions. The unchanged `real runner/process failure preserves terminal source and real CLI exit` assertion expected `failed` but received `ownership_unknown`; its cause remains unproven. The failed test-process exit is preserved in `test-status.json` and the full log is retained as `focused-tests-unexpected-red.log`; no unchanged rerun was used to obtain success. Lint, typecheck, documentation links and diff whitespace checks passed. The diagnostic collected both cases with ordinary outcomes and removed its fixtures/child. Full local evidence is retained under `work/issue-19/observer-diagnostics-task1/`; the [diagnostic plan](plans/completed/issue-19-runner-windows-diagnostics.md) records commands and results. Actual Windows results and artifact inspection by exact SHA/run/attempt remain coordinator-owned gates. Local diagnostic completeness establishes neither Windows acceptance nor the cause of the historical Windows failure.

### Lease maintenance

Heartbeat is opt-in through `--heartbeat` JSON with `task`, `actor`, `repo`, `ttlMs` and `intervalMs`. Here `repo` is selected through the physical `realpathSync` representation used by runner worktree publication, including when supplied through a directory alias.

Task and recorded worktree comparisons remain strict; foreign or aliased recorded ownership metadata is never canonicalized into acceptance. A controlled disposable fixture with an isolated asynchronous filesystem mock reproduced the retained Windows sync/async representation mismatch and verified the heartbeat repair locally; this is separate from actual Windows acceptance.

The physical-repository alias regression uses a scoped test clock with the original 90 ms observation budget. It holds time through valid capability verification and renewal, then advances to the deadline after the second actual snapshot read. Exact `bd` arguments, identified ownership and runner source bytes remain asserted. A separate control advances 120 ms after valid help and requires `lease_lost` with zero renewal calls; a nonzero renewal reply must also lose the lease. Success, rejected observation and thrown-assertion controls restore `Date.now`, filesystem mocks and builtin exports in `finally`, then verify an independent public observation. These tests change no production lease, request deadline or polling policy. Controlled expiry reproduces the observed failure mechanism; historical macOS scheduling was not retained, so original attribution remains unproven and exact-SHA CI remains coordinator-owned.

The checkout belongs to the already claimed Beads task; TTL must come from its actual supported configuration. Use an interval below that TTL with command/transport margin. The adapter verifies installed heartbeat support and uses only `bd --actor <actor> -C <repo> --sandbox heartbeat <task>`, with bounded calls. It does not claim, reclaim, close or change task requirements. Never use the live current issue as a fixture.

Without this option, the coordinator still owns lease renewal and must shorten its observation budget to the next renewal deadline. With it, renewals run technically inside the bounded observation even while status is unchanged. The option does not transfer task ownership to the observer or provide renewal after the client/process exits.

Lease failure returns immediately for investigation. Do not launch the next execute/review phase until the supported mechanism confirms the same selected task/actor/repository again. Retain the existing executor, lock and evidence; continue read-only observation without renewing a lease that is no longer yours. Check ownership immediately before every new phase, including after successful execution. This is a point-in-time check, not an atomic Beads-plus-process transaction.

### Exact CI observation

```sh
node scripts/ralphex-observe.mjs ci \
  --host github.com --repo owner/repo --run 123456 --attempt 1 \
  --sha aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --jobs '["Windows acceptance","macOS acceptance"]' \
  --steps '{"Windows acceptance":["Runtime scenario","Package verification","Cleanup"]}' \
  --artifacts '["windows-evidence"]' \
  --cursor work/ralphex/example/ci-observer.json --budget-ms 50000
```

These values are templates, not an executed run. Supply the actual required job matrix/names, required steps where absence matters, and artifacts. Arrays/maps are JSON so names may contain commas. Identity is the explicit host/repository/run/attempt/full SHA; there is no latest-run fallback. Read-only API calls retain job/step outcomes and fail closed on mismatch, lost access, malformed responses or unavailable evidence. Polling is internal; CI observation does not mutate the waiting checkpoint or rerun Actions.

The metadata-only artifact convention is `<logical-name>-run-<run-id>-attempt-<attempt>`, together with matching artifact workflow-run ID and full SHA. Ordinary artifact names without attempt provenance remain `artifact_attempt_unverified`; expired/missing artifacts are not passing evidence. This branch does not rewrite product workflows to produce new artifact names. Existing workflows may therefore need coordinator inspection of the original artifact manifest before acceptance; a matching name is not a replacement for checking its actual contents.

A candidate successful observation still returns `acceptance: not_established`. Inspect required artifacts, original scenarios and failed/skipped/unreached checks before resuming a dependency or closing trackers. API/source errors and observation timeouts cannot turn a gate green.

### Current Codex tool fallback

The current client has no verified arbitrary-process subscription or automatic conversation-progress transport. The outer `functions.exec` default can return after 30 seconds even while its inner session wait continues. Avoid that extra model round trip by setting the outer yield explicitly and awaiting the bounded observer internally:

```js
// @exec: {"yield_time_ms": 60000, "max_output_tokens": 6000}
const started = Date.now();
let result = await tools.exec_command({
  cmd: "node scripts/ralphex-observe.mjs runner --dir work/ralphex/example --log work/ralphex/example/full.log --cursor work/ralphex/example/observer.json --budget-ms 45000",
  yield_time_ms: 1000,
  max_output_tokens: 6000
});
const chunks = [result.output];
while (result.session_id && Date.now() - started < 52000) {
  const remaining = 52000 - (Date.now() - started);
  result = await tools.write_stdin({
    session_id: result.session_id,
    chars: "",
    yield_time_ms: Math.min(10000, Math.max(1, remaining)),
    max_output_tokens: 6000
  });
  chunks.push(result.output);
}
text({ ...result, output: chunks.join("") });
```

This example assumes a fresh user-visible update immediately before observation. Subtract time already spent since the previous update and any earlier lease deadline from the observation budget. Preserve a margin for transport and the next message; report at least every 60 seconds. Unexpectedly unfinished observation must return its session and diagnostic for inspection, not silently disappear. Preserve output chunks and the actual exit code; a truncated tool result is incomplete evidence and requires reading the retained source/detail evidence. Keep promises awaited; an unawaited promise is discarded when the wrapper ends.

Required progress messages still cost model calls. `notify()` or stdout alone is not assumed to satisfy the conversation contract. On an event, act within existing authorization and continue; after client interruption, inspect real ownership/state again. This does not create a detached AI service. [Verification](verification/ralphex-event-observer.md) separates real tool-boundary measurements from simulated polls and unmeasured costs.

## Early Windows feedback

The independent `windows-product-selection-diagnostic` job runs `npm run test:windows:early` immediately after install/build and before its one actual Reveal. This exercises real creation/recovery policy, React/service and IPC routing, the phase runner, and Windows bridge/module/argument controls. Run this job at the first working filesystem/native slice; inspect its result before expanding the implementation or repeating full reviews. A local macOS skip is not Windows execution.

The native step runs only after those controls pass. Its exact-target, one-command, normal-quit/restart and cleanup requirements are unchanged. If native execution was attempted, its strict artifact is uploaded even on failure; a preflight failure skips native execution/upload and retains the failing test in the job log.

Full macOS/latest Windows/Windows2022 checks, packaged scenarios and release gates remain unchanged. The early job is faster feedback, not a replacement for final acceptance. Legacy API/CLI comparisons remain manual diagnostics. See [desktop CI](../.github/workflows/desktop-ci.yml).

## Skill source

The versioned [skill](../.agents/skills/do-task-ralphex/SKILL.md) and its [continuous flow](../.agents/skills/do-task-ralphex/references/issue-flow.md) are the source for this workflow's installed skill. This branch first incorporates the previously reviewed installed flow, then aligns it with these commands. After review and separately authorized deployment for a new safe run, copy both files to the existing `~/.codex/skills/do-task-ralphex/`, preserve UI metadata and retain previous files and hashes outside tracked product files. Do not copy into an active executor's checkout or overwrite later skill edits. Global deployment affects other projects that read this skill. Older runners must use only verified capabilities; projects without a runner use the explicit CLI phases.
