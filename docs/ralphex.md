# Ralphex execution and continuation

Use the installed `do-task-ralphex` skill for a selected, claimed Beads task. GitHub owns requirements; the coordinator owns tracker writes, platform acceptance and authorized delivery. These changes do not start Issue #18.

## One invocation per phase

Use Node 22.21.1 and prepend its bin directory to PATH. The repository runner creates a run-local Codex profile using gpt-6.1-sol/high, disables notifications/finalization and preserves global settings.

```sh
node scripts/ralphex-run.mjs init --dir work/ralphex/example --issue https://github.com/owner/repo/issues/123 --beads example-123 --base HEAD
node scripts/ralphex-run.mjs execute --dir work/ralphex/example --plan docs/plans/example.md
node scripts/ralphex-run.mjs review --dir work/ralphex/example
```

These are templates: substitute the actual selected task, immutable base and reviewed plan. Initialize only once. `execute` uses `--tasks-only`, so finishing implementation cannot start an automatic whole-branch review. `review` uses `--review`; the first pass collects all five perspectives, subsequent invocations compare changes after the last successful review with quality/implementation perspectives. Each invocation runs once. A failure returns nonzero and records `failed`; it never retries itself.

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

## Early Windows feedback

The independent `windows-product-selection-diagnostic` job runs `npm run test:windows:early` immediately after install/build and before its one actual Reveal. This exercises real creation/recovery policy, React/service and IPC routing, the phase runner, and Windows bridge/module/argument controls. Run this job at the first working filesystem/native slice; inspect its result before expanding the implementation or repeating full reviews. A local macOS skip is not Windows execution.

The native step runs only after those controls pass. Its exact-target, one-command, normal-quit/restart and cleanup requirements are unchanged. If native execution was attempted, its strict artifact is uploaded even on failure; a preflight failure skips native execution/upload and retains the failing test in the job log.

Full macOS/latest Windows/Windows2022 checks, packaged scenarios and release gates remain unchanged. The early job is faster feedback, not a replacement for final acceptance. Legacy API/CLI comparisons remain manual diagnostics. See [desktop CI](../.github/workflows/desktop-ci.yml).

## Skill source

The versioned [skill](../.agents/skills/do-task-ralphex/SKILL.md) is the source for this workflow's installed skill. After reviewing an update, copy it to the existing `~/.codex/skills/do-task-ralphex/SKILL.md`, preserve its UI metadata and retain the previous file outside tracked product files. Other projects without this runner use the explicit CLI phases described by the skill.
