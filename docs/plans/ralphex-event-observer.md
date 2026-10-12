# Ralphex event observation

Status: executable checklist complete; this is retained execution evidence, not whole-issue acceptance. Coordinator review, required platform/Actions results and integration must be established from current evidence. The path is retained for existing references and run snapshots. Historical Beads IDs/instructions describe the prior process; current tracking and executor selection follow [development](../development.md).

The user approved implementation of the existing cost-reduction plan on 2026-10-11. This slice changes execution tooling in an isolated branch based on `new-workspace`; it does not modify or pilot the active Issue #19 run.

## Problem and accepted boundary

Issue #19's measured 20:27–20:29 UTC interval contained five coordinator model requests for waiting/checking: 565,174 input, including 561,792 cached and 3,382 uncached. Full executor output was already redirected to files. Default outer tool yielding caused additional model returns while an inner process wait continued. Reducing the size of `tail` alone does not address those calls.

Keep synchronous Ralphex execution and separate independent review. Add a bounded observer process that performs technical polls without a model call per unchanged poll, then returns a compact meaningful event or a progress deadline. Existing process-improvements code was inspected, but no combined `run` transition is adopted: an independent observer cannot prevent that synchronous transition after detecting lease loss. Keep the coordinator's explicit ownership check between phases. Never merge the unrelated product history of that branch.

## Authorized seams and acceptance

| Public boundary | Required behavior | Does not establish |
| --- | --- | --- |
| Runner exports and CLI | Execute/review remain distinct explicit invocations; exclusive ownership; failed execution does not review; preserve receipts, clean tree, ancestry and archived plans | Product or platform acceptance |
| Bounded observer CLI/API | Internal unchanged polling, finite events, source-bound cursor, log delta/coalescing, cancellation/deadline/restart; never write runner state or kill/restart execution | Descendant ownership, automatic crash recovery or proof of progress from a PID |
| Read-only GitHub adapter | Exact repository/run/attempt/SHA; required jobs/steps/artifacts retain failure, skipped, unreached and unverified provenance | Approval of acceptance from workflow status alone |
| Optional Beads heartbeat adapter | Explicit existing owner/task/context and actual TTL; only supported heartbeat; finite failure stops observation with an ownership diagnostic | Claim, reclaim, tracker closure or cross-machine lease guarantees |
| Actual Codex tool transport | Compare equal quiet fixtures through the real outer wrapper; count model-visible calls and residual progress, not just internal polls | Token prices, money, subscription allowance or whole-issue savings |

Tests use disposable repositories, owned temporary processes/files and mocked external API/CLI transports. Cover unchanged state, successful/nonzero/throwing completion, observer cancellation, lost access, quiet/noisy output, concurrent ownership, wrong CI identity, repeated invocation, timeout, cursor/log discontinuity and recovery after observer restart. A printed child marker cannot forge a successful runner result.

## Implementation

- [x] Preserve the six baseline runner tests; add run/launch identities and release-only-owned-lock regressions before implementation.
- [x] Add bounded observation and identity/cursor behavior through public seams, one red/green behavior at a time.
- [x] Add fail-closed CI and optional supported heartbeat adapters with external-boundary fixtures.
- [x] Align the Ralphex guide, versioned skill/reference and relevant task/review output instructions with actual commands.
- [x] Record local behavior tests and the real tool-boundary measurement; obtain independent Astra review, remediate and freshly verify before a task-only local commit.

## Ownership, delivery and limits

The runner remains the sole writer of `current.json`, runner events and executor lock. The observer writes only its own cursor/evidence and, when explicitly configured, refreshes the already-owned Beads lease. It never retries execution, resumes checkpoints, closes trackers, dispatches CI, pushes, merges or modifies active runs. Unknown ownership is retained as unknown. A timeout is an observation deadline, never success or a reason to terminate a quiet executor.

This runtime has no verified event subscription for arbitrary Ralphex processes or automatic user-visible conversation progress. Use an outer `functions.exec` yield of 60 seconds and await the bounded observer's exec-session internally. Reserve time to report to the user before the 60-second deadline; required model-written updates remain a real cost. No detached AI continuation after client exit is promised.

Actual Windows process/file behavior requires Windows evidence before adopting the workflow there. Local macOS fixtures and mocked API data do not satisfy that gate. No live Beads heartbeat or current-issue pilot belongs to this slice. Artifact metadata without attempt provenance remains unverified. Global skill deployment is a separate next-run step, retaining backup and metadata.

## Verification and rollback

Run the focused runner/observer Node 22.21.1 suites, affected lint, documentation link check and `git diff --check`. Keep raw red/green and transport evidence in ignored `work/observer-evidence/`. Record a compact reproducible report in `docs/verification/ralphex-event-observer.md`.

Adopt only for a new safe run after integration/review and the applicable platform checks. Roll back by selecting the previous tested runner/skill for a subsequent run, preserving evidence; never replace an executing process or rewrite its state on the fly.
