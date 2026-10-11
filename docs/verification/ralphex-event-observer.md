# Ralphex observer verification

Status: local implementation, controlled measurement, independent Astra review and fresh final checks complete. The adoption gates below remain explicit. No live issue pilot, deployment, push or CI dispatch has occurred.

## Scope and sources

The [accepted implementation plan](../plans/ralphex-event-observer.md) specializes the cost-reduction plan approved on 2026-10-11. This tooling branch starts at `4f9f11f785c63a65585ea6f33f167fc438272c64` (`new-workspace`). Product code, global models and active Issue #19 are outside its mutation scope.

Issue #19 baseline: the frozen report at `/Users/aleksandersk/Documents/Codex/2026-10-11/task-7/issue19-token-report.md` records five waiting/checking coordinator requests between 20:27 and 20:29 UTC: 565,174 input, of which 561,792 cached and 3,382 uncached. This is a source interval, not a predicted saving or a directly comparable workload.

## Baseline and transport reproduction

On Node 22.21.1, the six existing runner behavior tests passed before changes (`work/observer-evidence/baseline-tests.tap`). Their fixtures use disposable Git repositories and injected Ralphex invocation; no real executor or tracker is started.

Two actual Codex tool invocations used the same owned Node fixture: no output for 40 seconds, then one completion record and normal exit. Initial exec yield was 1 second, followed by a 45-second exec-session wait inside `functions.exec`.

| Outer wrapper | Observed wall time inside wrapper | Model-visible tool calls | Additional `functions.wait` |
| --- | ---: | ---: | ---: |
| Default 30-second yield | 40.390 s | 2 | 1 |
| Explicit 60-second yield | 40.738 s | 1 | 0 |

Both fixtures exited zero with the same finite completion record. The default wrapper yielded while its inner wait was still pending; the explicit wrapper returned only the completed result. Evidence: `work/observer-evidence/transport-before-after.json` and this task's real tool trace. This verifies the transport cause and a reduction by one model-visible call for this single quiet window. It is not yet the observer measurement and does not establish money, token or subscription savings. Mandatory progress messages remain outside this count and must still be delivered before the 60-second deadline.

## Observer-through-tools measurement

Both variants launch the committed [disposable fixture](../../tests/fixtures/ralphex-observer-benchmark.mjs), which runs an owned child quietly for 40 seconds through the real runner's injected invocation boundary, then exits. Both start the same observer with a 50-second budget and 250 ms poll interval, await it internally and reap the actual launcher. Only the outer wrapper yield differs. No real Ralphex executor or tracker is used.

| Outer wrapper | Total wall time including setup/reap | Observer wait | Internal polls | Model-visible tool calls | Terminal detection latency | Observer JSON bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default 30-second yield | 41.056 s | 34.924 s | 139 | 2 | 183 ms | 1,467 |
| Explicit 60-second yield | 40.612 s | 34.962 s | 139 | 1 | 105 ms | 1,473 |

These measurements use the project's Node 22.21.1. Evidence: `work/observer-evidence/observer-before-after-node22.json`, full per-variant tool results alongside it, and the actual task tool trace. An earlier paired measurement on the shell's Node 26.11.1 also returned two versus one calls (40.931/40.921 seconds; 205/226 ms reaction), retained separately in `observer-before-after.json`. The project-version repeat resolves that initial environment mismatch; neither result is discarded. The different observer wait lengths reflect launch/approval overhead, while both fixture waits and wrapper end-to-end durations remain equal. Both observer and runner exited zero, reported `awaiting_review`, and kept `acceptance: not_established`. Detection latency is the event timestamp minus the fixture child's recorded exit timestamp, including the runner's post-exit Git checks.

A post-review confirmation on the corrected streaming/identity code also completed with **one** model-visible call and no additional wait: 40.634 seconds including setup/reap, 141 internal polls, 107 ms terminal detection and 1,531 output bytes; both actual exits were zero. Exact source hashes and the result are retained in `final-tool-confirmation.json`. The subsequent final code delta only adds `current.json.tmp` to the reserved-path exclusion; its regression and full 68-test run verify that change separately. The original pair and this confirmation are different measurements, not a synthetic before/after assembled from different scenarios.

One additional `functions.wait` was eliminated: two versus one model-visible tool calls for this controlled window (approximately 2.92 versus 1.48 calls/minute when normalized to the measured window). This is a transport result, not a measured reduction of unique model responses/tokens for a complete issue. Required progress reporting, setup, handoff, failures and recovery still consume model calls. Messages were sent before and after each bounded window; exact UI delivery timestamps were not instrumented, so no measured maximum conversation gap is claimed.

The initial negative control returned `ownership_unknown` because the sandbox denied a cross-exec-session `kill(pid, 0)` probe with `EPERM`. It also deliberately retained the original runner; the misplaced fixture cursor outside its ignored `work/` directory then made that fixture's clean-tree gate fail. This attempt is preserved separately and excluded from the paired result. Both valid variants use the same narrowly approved read-only observer process probe and put the cursor inside ignored run evidence. This is a real deployment constraint: permitted process observation or the documented original-exec-session wait fallback is required; EPERM is never treated as a dead process or successful ownership.

To reproduce in Codex, select the project Node 22.21.1 binary explicitly and choose two different nonexistent directories under `work/observer-evidence/`. In one awaited `functions.exec`, launch `node tests/fixtures/ralphex-observer-benchmark.mjs <new-directory>` using `exec_command` with an initial 1-second yield. Immediately launch `node scripts/ralphex-observe.mjs runner --dir <new-directory>/work/run --log <new-directory>/work/run/full.log --cursor <new-directory>/work/run/observer.json --budget-ms 50000 --poll-ms 250`. Await its returned session internally with a bounded `write_stdin`, then reap the fixture session and capture both actual exits. Baseline uses the default outer yield; the second invocation adds `// @exec: {"yield_time_ms":60000,"max_output_tokens":2500}`. Count the real outer `functions.wait` calls, retain source hashes and `exit.json` timestamps, and reserve the progress deadline. Any required sandbox approval belongs only to the selected owned fixture. A new observer cursor alone is insufficient if its source is another execution.

## Behavior and live adapter evidence

The final fresh Node 22.21.1 focused suite passed **68/68**, including the original six runner controls. Twenty-six recorded red→green slices and raw TAP files are retained in `work/observer-evidence/tdd.md` and the adjacent evidence. Controls exercise unchanged/quiet/noisy observation, terminal success/nonzero/throwing invocation, cancellation without executor termination, access loss, competing cursor/runner ownership, missing launcher, replacement/truncation/regrowth, repeated observation/restart, wrong run/attempt/SHA, required missing/skipped/failed jobs or steps, timeout, explicit lease loss, and bounded reports retaining full evidence. Tests use public seams and injected external transport, not a live tracker.

A narrowly approved read-only historical GitHub probe selected `kornouhovas/workspace`, [run 38132376699](https://github.com/kornouhovas/workspace/actions/runs/38132376699), attempt **1**, SHA **113721caca5ae1f15a5b8f859ada5d52412e7ef0**. An initial 2-second `gh run view` probe failed and was retained. The revised exact-attempt REST adapter completed in 2.998 seconds, preserved required job outcomes `success`, `failure` and `skipped`, returned `needs_decision` with `candidate: false`, and never established acceptance. Evidence: `historical-ci-observation-v2.json`, its raw metadata/jobs and the earlier failed probe. This was neither a write nor a CI dispatch. No artifact requirement was configured for that historical probe: artifact provenance is covered by fixtures, not real artifact retrieval.

## Review, final checks and adoption gates

- Independent Standards and Spec reviews used separate fresh `gpt-6-astra/high` agents. All four Spec findings are resolved: receipt reuse preserves failure, identity binds within an invocation, derived paths cannot overlap runner files, and streamed progress survives large deltas. The Standards heuristic overlapped receipt reuse; its follow-up also caught the runner temporary snapshot `current.json.tmp`, now covered by the same reserved-path guard and a four-case regression. Both axes finished with no open findings. Spec independently reran 67/67 before the final path exclusion; Standards independently verified the final temporary-snapshot regression. The coordinator then reran all 68 tests.
- Fresh final checks: 68/68 focused tests, affected ESLint (runner, observer, adapters and all related tests/fixtures), all 94 Markdown files checked for local links, versioned skill validation and staged/unstaged diff checks passed. Raw final evidence is retained under `work/observer-evidence/`. No product build or unrelated application suite was claimed; product code/build inputs are unchanged.
- Actual Windows process/file controls remain a gate before Windows adoption. Adding the focused observer suite to the existing early Windows command does not mean that command ran.
- No live Beads ownership/TTL refresh was tested. Opt-in use requires the selected task/actor/repository and actual configured TTL; an ownership failure blocks the next explicit phase.
- No supervisor, descendant cancellation, automatic reclaim/restart or AI continuation after client exit was added. Execution and review remain explicit separate phases.
- A separately authorized next-run pilot must measure comparable coordinator/executor/reviewer usage, cached and uncached input, output, progress gaps, reaction latency, failures and quality. This change provides no price, subscription-limit or whole-issue savings estimate.
- Global skill installation, current Issue #19 adoption, push and merge remain outside this delivery. Integrate the reviewed local commit into the intended next-run checkout, run applicable platform checks, then synchronize the versioned skill through the existing backup/validation procedure before selecting a new run.

## External contracts

GitHub's documented [attempt jobs endpoint](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt) and [attempt metadata endpoint](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run-attempt) provide the read-only identity boundaries. [Workflow-run artifact metadata](https://docs.github.com/en/rest/actions/artifacts#list-workflow-run-artifacts) alone must not be treated as proof of attempt ownership.

Installed `bd heartbeat --help` confirms the supported operation refreshes only the current in-progress owner's node-local lease and fails after reclaim/closure. Help inspection is not proof of a real task's ownership or TTL. No live heartbeat is executed by these checks.


## Next-run measurement contract

Use a new issue chat and the already reviewed issue/Beads handoff when appropriate; do not reset an executing run to produce a better token number. Record the exact integrated commit, Node/platform, actual executor/reviewer model and effort, source identities, heartbeat configuration source and start/end of each wait interval.

For a comparable next issue, report unique coordinator responses per minute of waiting, outer `functions.wait` returns, actual tool-output bytes, maximum user-visible progress gap, terminal reaction latency, source/ownership diagnostics and recoveries. Record total/cached/uncached input and output separately for non-overlapping coordinator, direct-agent and external-executor groups, including setup and handoff. Cached input is part of total input; do not add overlapping wait buckets to totals. Preserve the benefits of stable cached context and measure cold-start input before attributing savings to a new chat.

Success requires fewer avoidable waiting returns while retaining every required check, independent review and real platform gate, progress no later than 60 seconds, correct lease failure handling and no observer-induced executor interruption or fabricated acceptance. Investigate missed transitions, repeated diagnostics or unusable output before adopting broadly. There is no numeric issue-wide saving target: task complexity, cache behavior and failure work differ. Billable cost and subscription allowance need their actual applicable accounting; this delivery supplies neither a guessed price nor a proxy allowance estimate.


## Final verification commands and isolation

The actual project runtime was `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin/node`. With that runtime selected:

```sh
node --test tests/ralphex-run.test.mjs tests/ralphex-observe.test.mjs
node node_modules/eslint/bin/eslint.js scripts/ralphex-run.mjs scripts/ralphex-observe.mjs scripts/ralphex-observe-sources.mjs tests/ralphex-run.test.mjs tests/ralphex-observe.test.mjs tests/fixtures/ralphex-observer-worker.mjs tests/fixtures/ralphex-observer-executor.mjs tests/fixtures/ralphex-observer-benchmark.mjs
node scripts/check-doc-links.mjs
git diff --check
git diff --cached --check
```

The installed skill-creator `quick_validate.py` also returned `Skill is valid!` for `.agents/skills/do-task-ralphex`. ESLint read existing dependencies through a temporary local symlink, removed before the task commit; no dependency installation or source checkout mutation was required. Static SHA-256 checks confirmed the active Issue #19 runner/skill and both installed global skill files were unchanged. No current issue runtime state, lease, lock or log was used as a fixture. The observer's successful historical CI read and every process experiment were scoped to the explicitly selected historical run or newly created disposable fixture.

## Follow-up formatted-output integration repair

The review of imported tooling commit `6efb4757` against the last successful Issue #19 review `fbbc07b3` collected independent quality and requirements perspectives. Requirements review confirmed one major integration defect: Ralphex v1.7.0 prefixes stdout lines with timestamps and wraps marker JSON, while the initial parser recognized only complete raw marker lines. The bounded deadline still worked, but task/review transitions were consumed without a progress event.

A read-only capture of the owned review output supplied the original scenario. It was replayed only inside a disposable fixture; no active runner state, lock, log or lease was modified. The captured-input probe consumed all 1,167 bytes and returned `deadline`, zero progress and no task; a raw-marker control returned progress. The permanent regression uses the exact four formatted marker lines in [the captured fixture](../../tests/fixtures/ralphex-progress-formatted.txt) and failed before the parser repair.

The parser now strips the known timestamp prefix and reconstructs bounded wrapped advisory JSON from same-timestamp continuations. Incomplete marker state survives cursor restart and retains the original raw byte ranges. Malformed or oversized messages cannot swallow a subsequent valid marker. Runner snapshots retain authority over completion and acceptance.

On macOS with Node 22.21.1, the runner/observer suites passed **71/71**, with no failures or skips. Replaying the full captured original scenario returned two ordered progress records across all 1,167 bytes; a repeated observation delivered zero duplicates. A separate quality re-review found no confirmed new defect. Red/green TAP, original capture/probe, full replay results and both review reports remain under ignored `work/issue-19/followup-review-6efb4757/`. Windows execution, live heartbeat and adoption gates remain as stated above; this repair supplies no new platform or token-cost acceptance.
