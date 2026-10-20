# Issue tracker: GitHub

Workspace uses Issues in [kornouhovas/workspace](https://github.com/kornouhovas/workspace) as its sole task tracker. GitHub owns specifications, acceptance criteria, issue dependencies, and completion status. On 2026-10-19 the owner confirmed that this application repository is public and authorized normal scoped publication to it (D61). Verify the target repository before writes; its public visibility is expected and does not require repeated confirmation. Existing task authorization still governs issue writes, pushes, merges and releases. This does not change the visibility policy for another repository or authorize publishing secrets, user data or raw recovery archives.

## Operations

- Read: `gh issue view <number> --repo kornouhovas/workspace --json number,title,body,labels,comments`.
- Create an issue or specification: `gh issue create --repo kornouhovas/workspace --title "..." --body-file <file>`.
- Find ready issues: `gh issue list --repo kornouhovas/workspace --label ready-for-agent --state open`.
- Attach an approved child: `gh api --method POST repos/kornouhovas/workspace/issues/<parent>/sub_issues -F sub_issue_id=<child-database-id>`. If unavailable, put `Part of #<parent>` in the child body and link it from the parent.
- Add a blocking edge: `gh api --method POST repos/kornouhovas/workspace/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-database-id>`. Resolve database IDs with `gh api repos/kornouhovas/workspace/issues/<number> --jq .id`. If native dependencies are unavailable, use `Blocked by: #<number>`; every blocker must be completed before implementation.
- Link implementation PRs to their issues. Close an issue after its acceptance criteria and required checks are satisfied. Keep the parent specification open until integration is verified.

PRs as a request surface: no.

## Execution and continuation

Read the issue and comments, then resolve its blockers and parent under [Dependencies](#dependencies). Keep scope and acceptance criteria in the issue body; add concise execution checkpoints as comments with the branch/worktree, commit, observed checks, remaining gate and next action. Check existing ownership and any executor lock before claiming or resuming work.

Use versioned plans and local run snapshots for execution evidence, not as another backlog. A snapshot may retain legacy IDs for historical correlation; those fields do not require a local tracker or lease. Issue closure requires the accepted criteria and delivery checks, including agreed human acceptance.

## Dependencies

Before implementation or when building a dependency graph:

1. Read native blocking dependencies and the parent relationship, plus textual `Blocked by: #<number>` and `Part of #<parent>` fallbacks in the issue body/comments. Native API availability does not retire existing fallbacks.
2. Resolve every referenced blocker to its current GitHub state. Combine native and textual edges, deduplicating identical edges. If representations disagree, retain the unresolved blocker until its removal or completion is evidenced; clarify only the affected dependency.
3. Establish eligibility: every blocker is closed, scope is ready and no other coordinator owns the task. A readiness label alone does not establish eligibility. If native dependency access fails, use recorded fallbacks and report discovery limitations; eligibility remains unverified while dependency discovery is incomplete. An API failure is not evidence of zero blockers.

For a graph, fetch candidates with `gh issue list --repo kornouhovas/workspace --state open --limit 1000 --json number,title,body,assignees,labels`, read comments with the issue-view command above, and fetch native blockers with `gh api --paginate repos/kornouhovas/workspace/issues/<number>/dependencies/blocked_by`. Include referenced closed blockers when needed to explain readiness. Every candidate must have its native and fallback relationships accounted for, or an explicit discovery limitation.

## Legacy migration

Beads is retired from this project's execution policy. Its full database and issue export are retained outside the repository for recovery; archived IDs and historical reports remain evidence, not live status. See the [migration record](beads-retirement.md) for reconciliation and continuation boundaries. New work and status updates use GitHub only.

Apply [executor selection](development.md#executor-selection) before starting any new run. For an already authorized Ralphex run, preserve its existing `current.json`, event history, review SHAs, executor lock, plan and worktree. Use the snapshot's GitHub issue as task identity. Keep an existing `beads` field or older `--beads` initialization argument only as an inert compatibility identifier; omit the observer's opt-in `--heartbeat` option and all `bd` lease/claim/close commands. Continue execute/review and exact-SHA Actions under the existing authorization. If an older skill assumes Beads, apply this project-specific tracker policy instead; the migration does not authorize another executor, a new run, changed model settings or release.

## Task preparation and implementation

Publish specifications and approved issues with acceptance criteria and blocking relationships to GitHub. Implementation starts from the selected issue and fulfills its acceptance criteria under the [development rules](development.md) and [verification policy](development.md#verification). Use skills available in the current session when they fit the task; tracker operations do not depend on a particular skill being installed.

## Verification policy in issues

Every new or revised implementation issue links to [requirement-based test retention](development.md#inherited-test-coverage) and [CI evidence reuse](ci.md#evidence-reuse-after-test-only-repairs). These policies also apply when resuming existing issues. Keep scenario-specific acceptance in the issue; reference the shared policies rather than copying a mandatory full-rerun rule into each ticket. Update older conflicting verification instructions when encountered, retaining product, data-safety, platform and release requirements.

The owner applied this policy to all 22 open issues on 2026-10-20: #6, #7, #42, #47 and #50–#67. Closed issue reports remain historical evidence. New issues inherit the same policy through this tracker rule and AGENTS.md.

For subsequent #47 UI issues after #52, also link the owner-approved
[desktop UX verification matrix](desktop-ux-verification.md). Its scoped checks
and early/final integration milestones supersede blanket full-run wording for
bounded UI changes. Keep explicit visual evidence, affected behavior and retained
product guarantees separate. Preserve #52's existing acceptance and all final
release gates. Synchronize native and textual dependency changes and assign an
explicit owner to any scope transferred between UI issues.
