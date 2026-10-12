# Continuous issue execution

## Entry and resume

Enter this flow only after explicit Ralphex selection or to continue an already authorized Ralphex run. Apply [executor selection](../../../../docs/development.md#executor-selection) and [tracker policy](../../../../docs/issue-tracker.md) first. A generic GitHub issue request uses Matt Pocock directly. Within the selected run, follow its reviewed plan with Matt Pocock `tdd` at the agreed behavior boundaries and `do-task-ralphex` for planning/execution. Use Matt Pocock `code-review` for the separate review. Read only skills actually present in the installed package; a missing routing name does not define a command. Superpowers skills, including `using-superpowers`, are opt-in only when the user explicitly requests them.

Read each selected skill from the installed Matt Pocock package when present, otherwise the inspected local copy. Record the actual source in the task snapshot. Reuse unchanged instructions available in the active context; reload missing or changed content, not the whole skill at every transition or poll. `ask-matt` is optional routing for ambiguity; a clear implementation request selects ordinary Matt Pocock work; this Ralphex route still requires explicit selection or existing run authorization.

After a context reset or new session, inspect the actual worktree, GitHub issue/checkpoint and executor ownership, `current.json`, recorded executor PID/lock, HEAD and existing evidence. Resume the current stage instead of initializing another run or replaying completed tasks. Existing authorization remains valid; scope and publication boundaries still apply.

After the current issue is accepted and integrated into `new-workspace`, prepare a compact handoff. Start another issue or create a chat only when requested; use the newly integrated base and the user's executor selection. Within an issue, transfer only at a justified phase boundary after verifying and handing over ownership, including any live executor. Account for context reconstruction and cache warm-up before expecting savings; a new chat need not lose the shared stable prefix, nor repay cumulative historical input. Avoid frequent manual compaction or resets by message/token count.

## Continuous coordinator ownership

1. Inspect or create a bounded plan. Inspect the repository runner's actual commands and semantics. Invoke execute then review explicitly in the same active coordinator turn, confirming current ownership before each launch. This observer does not control the executor, so it cannot guard an automatic execute-to-review transition after ownership loss. Use raw CLI phases only if no repository runner exists.
2. Monitor the owned process through completion. A live background executor does not constitute a handoff. Preserve the selected executor lock and read stage output without launching a competing executor. At each progress check inspect the last tool/output or file activity as well as process liveness. Select finite executor idle/session bounds from the installed CLI, independently of product/test deadlines. If activity stops, inspect owned child processes and any active long-running tool before stopping; retain the PID, last activity, partial diff and evidence. Reap the owned executor and verify its lock is released before resuming the first unfinished task from preserved work. A live PID alone is not evidence of progress.
3. On successful execution, proceed immediately to separate review. On successful review, inspect the actual diff, receipt and checks, then perform the already authorized task-branch push and identify the Actions run by exact SHA. If delivery is not authorized, finish the concrete reviewable result before requesting the missing permission.
4. Monitor Actions to a completed result and inspect required job/artifact outcomes. `waiting` describes an external dependency; it does not require a user status request to resume monitoring. Continue independent authorized work while CI runs.
5. On Actions failure, apply Matt Pocock `diagnosing-bugs`, preserve the failed result, establish the diagnostic loop below, then use Ralphex for the bounded repair, separate `code-review`, and a new exact-SHA Actions run. This is diagnosis and repair, not automatic retry of unchanged code.
6. Stop dependent work only for a concrete missing decision/access, user pause, or unresolved external blocker. Record the exact dependency and next action. A green intermediate checkpoint does not complete the whole issue. Cost pressure or arbitrary launch/turn/token caps do not establish completion or waive review and acceptance.

Keep the coordinator turn active across authorized transitions. If the runtime interrupts or ends the session, persist the actual phase, owned process and next action before losing control; the next session resumes from that evidence. These instructions and the runner do not create a detached AI service after the client exits.

Use event/process waits only for supported entities; agent/thread waits do not automatically cover an external Ralphex CLI. A runner `wait` records a checkpoint, not a subscription. Without a supported observer, use exec-session waits and output deltas, reserving time before the next 60-second progress deadline. Check activity and owned children, not PID alone. Unchanged internal polls should not each require a model call when the available tool can wait, but model-written progress still costs calls. Do not silently install an observer, abandon monitoring, or resume a dependency just because time elapsed.

If `scripts/ralphex-observe.mjs` exists, read the checkout's `docs/ralphex.md` once for supported options. Keep its bounded CLI and any exec-session waits inside one awaited `functions.exec` with outer yield 60000; a default outer 30-second yield can create an extra model call despite a longer inner wait. Choose the observer budget from the remaining progress deadline with transport margin, rather than always spending a fresh minute. Use a fresh cursor for a new execution or CI identity; retain previous evidence. Observe without `--heartbeat`. Historical tracker IDs require no lease. An ownership/access failure blocks the next explicit phase until ownership is confirmed again; it does not authorize termination or reclaim. The observer cannot accept CI gates or provide detached AI continuation. Keep its cursor under ignored run evidence. If sandbox restrictions deny the PID probe, `ownership_unknown` does not mean the executor died: use permitted observation of that owned run or bounded waits on the original known exec-session; retain all locks and source evidence.

## Progress in the current conversation

Announce each actual transition: planning, Task N/M and title, affected checks, review pass and collected/expected perspectives, push, Actions and artifact inspection. During ongoing work, give a concise update at least every 60 seconds. Use observed milestones, not invented percentages. Include the current commit or run link when it changes. Answer status requests briefly and keep the authorized task running.

Executor task prompts announce the section being executed, verified completion and the next section. Review prompts announce the pass, requested perspectives, received reports, confirmed repairs and final result. Coordinator messages translate that output into Russian for the user. Chat progress does not authorize external messaging services.

Capture large command/log output to run evidence before it enters model context, preserving the actual exit status. This includes diagnostic reads: even failed-job logs can be large. Return command, exit, SHA/run/attempt, relevant status/error excerpt and full-log pointer; retain failed, skipped and unreached outcomes. Search the saved log, then read exact relevant ranges, widening when needed. A concise final summary does not undo an earlier full dump.

Executor/reviewer handoffs contain scope/acceptance, current plan/task, worktree and issue/review/HEAD SHAs, relevant contracts, evidence, pending gates and next action. Coordinator handoffs also include ownership/lock state. Link full reports instead of copying parent transcripts; reviewers still inspect the required diff and surrounding contracts. Keep the independent first whole-issue review and widen follow-ups for shared-contract changes.

## Diagnostic evidence and cause claims

Before a repair, retain an ignored `diagnosis.json` referenced from run evidence. It records:

- `failedRun`: URL, exact commit SHA, job and command;
- `reproduction`: command, evidence path, observed red result and kind (`original`, `captured-input`, or `injected-symptom`);
- `hypotheses`: ranked falsifiable predictions and individual probe results;
- `cause`: status (`proven` or `unproven`), claim and supporting evidence;
- `repair`: whether it fixes a proven cause or adds bounded robustness for an observed symptom;
- `verification`: regression before/after and original-scenario rerun, each with command, evidence and status (`passed`, `failed`, or `pending`), platform and commit.

A test injecting EPERM proves handling of EPERM; it does not identify the historical handle owner. Captured-input replay proves behavior for that input; it does not alone establish how production generated it. Controlled Windows sharing demonstrates a mechanism, not attribution to the original failing process. Local platform simulations/skips do not establish actual Windows acceptance.

Keep the cause explicitly unproven when attribution is missing. A bounded symptom repair can proceed within authorized scope, but the reviewer must assess the claim and its limits. Keep the original-scenario verification pending until the real command completes on the required platform. Never mark the whole diagnosis or issue complete from an injected regression alone. Report the proven finding, unresolved cause and required gate separately.

The evidence record contains finite results and pointers, not raw secrets, output dumps or user filesystem data. It is operational evidence, not a second copy of the issue requirements.

When evaluating a workflow change, record a baseline and pilot on the next comparable issue with the same acceptance and model/effort. Measure total/cached/uncached input and output separately across nonoverlapping coordinator, direct-agent and external-executor groups, counting each response once. Compare unchanged-wait calls, reaction/progress latency, cold-start overhead, review quality and rework. Include new monitoring/handoff costs. Token reduction is not a measured money or allowance reduction; report those only when the applicable billing/usage evidence supports them, noting account-wide activity as a confound.
