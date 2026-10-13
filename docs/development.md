# Development workflow

## Scope and sources

Start from [AGENTS.md](../AGENTS.md), the actual checkout and relevant product/architecture decisions. This branch is a fresh implementation foundation. Historical code can answer factual questions; it does not silently override new decisions. Ask about unresolved consequential behavior and continue independent authorized work.

Use an isolated task branch based on `new-workspace` for implementation. Preserve unrelated files and existing task ownership. Commit completed, verified file changes in coherent English commits; stage explicit task paths. Push, merge and publication require corresponding authorization.

## Integration branch

`new-workspace` is the integration branch for every issue. Start a new issue branch from its latest verified tip. Once the selected issue's acceptance criteria, review and required checks pass (including agreed human acceptance), merge the verified issue branch into `new-workspace`, verify the integrated result and record the delivered SHA. The owner has authorized this issue-by-issue integration route. It does not select/start the next issue or authorize release or merge into `main`.

Issue 19 receives the completed agent-workflow changes now. Its merge into `new-workspace` remains conditional on successful completion: the current waiting state, residual native/platform gates and exact-SHA Actions acceptance remain unresolved until evidenced. A completed local documentation merge is not issue acceptance.

## GitHub tracker

GitHub Issues is the sole tracker for requirements, acceptance, dependencies and completion. Read the selected issue and comments; resolve both native and textual fallback dependencies under [tracker policy](issue-tracker.md#dependencies). Keep execution checkpoints with branch/worktree, commit, actual checks, remaining gate and next action in issue comments. Check existing ownership before continuation.

[Beads retirement](beads-retirement.md) preserves the database archive, unfinished mapping and pending publication. Historical GitHub bodies, versioned tickets and run snapshots may still carry Beads IDs; these are correlation evidence, not instructions to run `bd`. Preserve unique notes without restoring another live tracker.

## Executor selection

Use Matt Pocock directly for ordinary implementation requests. Select a new Ralphex run only when the user explicitly requests Ralphex or invokes `$do-task-ralphex`. A generic issue request, `$implement`, readiness label, plan, CI failure or installed `.ralphex` configuration does not select it. Finishing one issue does not select an executor or authorize starting the next.

Continue an already authorized run only within its existing scope, ownership and permissions. A waiting snapshot remains waiting until its recorded dependency and user instructions permit continuation. Preserve the run snapshot, issue/review baselines, lock and evidence; this policy neither launches nor stops the executor.

## Ralphex

For explicitly selected tasks or an already authorized continuation, read [the Ralphex run guide](ralphex.md) and the installed `do-task-ralphex` skill with its issue-flow reference. Apply the GitHub-only tracker policy before historical skill/plan defaults. Omit observer heartbeat and `bd` lease/claim/close operations; older `beads` metadata or `--beads` arguments are inert compatibility IDs.

Use bounded English task snapshots/plans with scope, fixtures, acceptance and exclusions. Review the plan against settled decisions, retain the immutable issue-start SHA, and review the resulting diff and actual evidence. Follow-up review receipts retain their separate SHA. The existing configuration selects `new-workspace` and disables automatic finalization; configuration is not launch or delivery authorization.

## Verification

| Change | Required evidence |
| --- | --- |
| Documentation/configuration foundation | Local links/anchors, consistency with accepted choices, configuration inspection and `git diff --check` |
| Domain/service | Behavioral tests at public boundaries, validation/error cases and transaction behavior |
| Persistence/migration | Disposable real SQLite databases; restart, migration and relevant recovery scenarios |
| Filesystem | Isolated temporary roots; containment, collisions, permissions, interruption/recovery and platform behavior |
| UI | Relevant interaction tests, type/build checks and inspection of changed screens, including narrow layouts and both languages |
| Release | Full integrated checks, platform packages, version consistency, migration/recovery and release acceptance matrix |

A failed GitHub Actions check during authorized execution enters the mandatory [diagnose, focused checks, then full CI loop](ci.md#failed-actions-loop). Continue that loop across windows/context resets without waiting for the user to invoke the skill again.

Select actual commands from package.json and the affected tests. Verify observable behavior and data safety; documentation checks verify links/anchors and consistency.

Use temporary data for destructive and recovery checks. Never use live user project folders as test fixtures. Report completed checks, limitations and the actual commit at handoff; distinguish a written design from an implemented capability.

## Conditional references

- For CI selection, scheduling changes or exact-SHA failure diagnosis, read [CI checks and diagnostics](ci.md).
- For runtime operation details or continuation of its acceptance, read only the affected [implementation checkpoint](verification/development-checkpoints.md). Historical local results do not establish current platform acceptance.
- For plan selection/progress and the distinction between executable completion and issue acceptance, read [plan status](plans/README.md).
