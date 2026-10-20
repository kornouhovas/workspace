# Development workflow

## Scope and sources

Start from [AGENTS.md](../AGENTS.md), the actual checkout and relevant product/architecture decisions. This branch is a fresh implementation foundation. Historical code can answer factual questions; it does not silently override new decisions. Ask about unresolved consequential behavior and continue independent authorized work.

Use an isolated task branch based on `new-workspace` for implementation. Preserve unrelated files and existing task ownership. Commit completed, verified file changes in coherent English commits; stage explicit task paths. Push, merge and publication require corresponding authorization.

## Integration branch

`new-workspace` is the integration branch for every issue. Start a new issue branch from its latest verified tip. Once the selected issue's acceptance criteria, review and required checks pass (including agreed human acceptance), merge the verified issue branch into `new-workspace`, verify the integrated result and record the delivered SHA. The owner has authorized this issue-by-issue integration route. It does not select/start the next issue or authorize release or merge into `main`.

Current issue ownership, waiting states and unresolved acceptance gates belong to its GitHub checkpoint. Verify that checkpoint when resuming; historical issue-specific instructions do not establish current readiness.

## Implementation sequence

Apply this sequence to the affected boundaries; small documentation changes need only their documented checks.

1. Resolve the selected issue's blockers and consequential open decisions. Record a compact scenario list in the existing plan or GitHub checkpoint: each acceptance criterion, failure/recovery case, persistence/ownership boundary and required platform/UI route has a check or an explicit unresolved gate.
2. Implement in vertical slices at the agreed public seams. Add regression scenarios while implementing their behavior; update the scenario list when evidence expands the scope.
3. Before the final review/full run, reconcile all changed contracts with existing fixtures and checks. For a migration, inspect the source journal and find every dependent migration count/tag, schema inventory, build/package fixture and upgrade/reopen test. Run `npm run test:migrations` and fix each affected failure while retaining data-preservation and rejection assertions. Extend this focused command when a new migration fixture boundary is introduced; its selected files are defined in `package.json`.
4. Finish the scoped implementation and scenario coverage, then review against the issue and project standards. Apply review repairs and rerun their affected checks. The resulting source, tests, fixtures and CI routes form the candidate for final verification.
5. Run the required full suite once on that completed candidate. Reuse an unchanged verified build with `npm run test:all`; use `npm test` when a fresh build is needed. Run artifact-producing builds and their consumers sequentially. A new failure or required code/test change reopens affected verification; record which final evidence was renewed. For later test-only or documentation repairs, apply the [CI evidence reuse policy](ci.md#evidence-reuse-after-test-only-repairs) to renew affected consumers and retain justified passing results.
6. Commit the complete candidate, including relevant contracts and the observed local verification report. Keep CI/integration acceptance in the GitHub checkpoint, with a pointer from the versioned plan. Select CI routes under [CI checks](ci.md); report which checks were inherited and which were added for this issue.
7. Inspect the candidate's CI results and required artifacts, follow the integration route, and record the tested/delivered SHA and remaining limits in GitHub.

Final acceptance requires passing evidence for every required scenario in step 1; recording an unresolved gate does not satisfy it. A newly discovered required case goes back through implementation/review and the affected verification; it is not added after a final pass without updating that evidence.

## Progress updates

Report changed acceptance gates, findings, failures and decisions. Coalesce CI polling into these updates instead of repeating the full job list. During an unchanged wait, send only the short heartbeat required by the conversation's update cadence; keep detailed polling output in the local log/checkpoint.

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

A failed GitHub Actions check during authorized execution enters the mandatory [diagnosis and acceptance renewal loop](ci.md#failed-actions-loop). Continue that loop across windows/context resets without waiting for the user to invoke the skill again.

### Inherited test coverage

This policy and [CI evidence reuse](ci.md#evidence-reuse-after-test-only-repairs) apply to all current and future issues, including resumed tasks and older worktrees. Read the current integration-branch policy before choosing checks; reconcile older issue/plan wording with it. Issue-specific product requirements, supported platforms, release acceptance and human gates remain authoritative in their domains.

Preserve coverage of current accepted requirements, not every inherited test or historical interaction. For affected inherited scenarios, record one decision in the existing plan or checkpoint: retain, adapt, replace or retire. Replace a test when a better public-boundary check covers the same contract; retire it when the behavior is explicitly superseded by an accepted requirement or when another identified check already covers the same scenario, failure mode and required platform boundary. Cite the governing requirement and replacement check, or the accepted reason the behavior no longer applies.

Data preservation, identity/ownership, recovery, isolation and supported-platform requirements remain covered wherever still applicable. A test failure or maintenance cost alone does not retire its requirement. Changing a product contract or supported-platform promise requires the owner's corresponding decision. Coverage preservation governs observable guarantees; it does not freeze test counts, locators, suite structure or the frequency of full CI runs.

Select actual commands from package.json and the affected tests. Verify observable behavior and data safety; documentation checks verify links/anchors and consistency.

Use temporary data for destructive and recovery checks. Never use live user project folders as test fixtures. Report completed checks, limitations and the actual commit at handoff; distinguish a written design from an implemented capability.

## Conditional references

- For CI selection, scheduling changes or exact-SHA failure diagnosis, read [CI checks and diagnostics](ci.md).
- For runtime operation details or continuation of its acceptance, read only the affected [implementation checkpoint](verification/development-checkpoints.md). Historical local results do not establish current platform acceptance.
- For plan selection/progress and the distinction between executable completion and issue acceptance, read [plan status](plans/README.md).
