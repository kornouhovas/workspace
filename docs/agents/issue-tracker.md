# Issue tracker: GitHub

Workspace uses Issues in [kornouhovas/workspace](https://github.com/kornouhovas/workspace) as its sole task tracker. GitHub owns specifications, acceptance criteria, issue dependencies, and completion status. Project policy requires private application and future marketing-site sources; a public website does not change that requirement. Use `gh` and verify `isPrivate` before the first write to a repository. If actual visibility conflicts with this policy, resolve it with the owner before publishing retained private material.

## Operations

- Read: `gh issue view <number> --repo kornouhovas/workspace --json number,title,body,labels,comments`.
- Create an issue or specification: `gh issue create --repo kornouhovas/workspace --title "..." --body-file <file>`.
- Find ready issues: `gh issue list --repo kornouhovas/workspace --label ready-for-agent --state open`.
- Attach an approved child: `gh api --method POST repos/kornouhovas/workspace/issues/<parent>/sub_issues -F sub_issue_id=<child-database-id>`. If unavailable, put `Part of #<parent>` in the child body and link it from the parent.
- Add a blocking edge: `gh api --method POST repos/kornouhovas/workspace/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-database-id>`. Resolve database IDs with `gh api repos/kornouhovas/workspace/issues/<number> --jq .id`. If native dependencies are unavailable, use `Blocked by: #<number>`; every blocker must be completed before implementation.
- Link implementation PRs to their issues. Close an issue after its acceptance criteria and required checks are satisfied. Keep the parent specification open until integration is verified.

PRs as a request surface: no.

## Execution and continuation

GitHub Issues is the sole task tracker. Read the issue, comments, native blocking dependencies and parent relationship before work. Keep scope and acceptance criteria in the issue body; add concise execution checkpoints as comments with the branch/worktree, commit, observed checks, remaining gate and next action. Check existing ownership and any executor lock before claiming or resuming work.

Use versioned plans and local run snapshots for execution evidence, not as another backlog. A snapshot may retain legacy IDs for historical correlation; those fields do not require a local tracker or lease. Issue closure requires the accepted criteria and delivery checks, including agreed human acceptance.

For a dependency graph, fetch open issues with `gh issue list --repo kornouhovas/workspace --state open --limit 1000 --json number,title,assignees,labels`, then read each candidate's blockers with `gh api --paginate repos/kornouhovas/workspace/issues/<number>/dependencies/blocked_by`. A task is eligible only when all blockers are closed, its scope is ready and no other coordinator owns it. A readiness label alone does not establish eligibility.

## Legacy migration

Beads is retired from this project's execution policy. Its full database and issue export are retained outside the repository for recovery; archived IDs and historical reports remain evidence, not live status. See the [migration record](../development/beads-retirement.md) for reconciliation and continuation boundaries. New work and status updates use GitHub only.

For an already authorized Ralphex run, preserve its existing `current.json`, event history, review SHAs, executor lock, plan and worktree. Use the snapshot's GitHub issue as task identity. Keep an existing `beads` field or older `--beads` initialization argument only as an inert compatibility identifier; omit the observer's opt-in `--heartbeat` option and all `bd` lease/claim/close commands. Continue execute/review and exact-SHA Actions under the existing authorization. If an older skill assumes Beads, apply this project-specific tracker policy instead; the migration does not authorize another executor, a new run, changed model settings or release.

## Task preparation and implementation

Publish specifications and approved issues with acceptance criteria and blocking relationships to GitHub. Implementation starts from the selected issue and fulfills its acceptance criteria under the [development rules](../development/rules.md) and [verification policy](../development/quality.md). Use skills available in the current session when they fit the task; tracker operations do not depend on a particular skill being installed.
