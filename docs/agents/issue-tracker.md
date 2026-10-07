# Issue tracker: GitHub

Workspace uses Issues in the private [kornouhovas/workspace](https://github.com/kornouhovas/workspace) repository as its primary tracker. GitHub owns specifications, acceptance criteria, issue dependencies, and completion status. Use `gh`; verify `isPrivate` before the first write to a new repository. Application and future marketing-site sources remain private; a public website does not change repository visibility.

## Operations

- Read: `gh issue view <number> --repo kornouhovas/workspace --json number,title,body,labels,comments`.
- Create an issue or specification: `gh issue create --repo kornouhovas/workspace --title "..." --body-file <file>`.
- Find ready issues: `gh issue list --repo kornouhovas/workspace --label ready-for-agent --state open`.
- Attach an approved child: `gh api --method POST repos/kornouhovas/workspace/issues/<parent>/sub_issues -F sub_issue_id=<child-database-id>`. If unavailable, put `Part of #<parent>` in the child body and link it from the parent.
- Add a blocking edge: `gh api --method POST repos/kornouhovas/workspace/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-database-id>`. Resolve database IDs with `gh api repos/kornouhovas/workspace/issues/<number> --jq .id`. If native dependencies are unavailable, use `Blocked by: #<number>`; every blocker must be completed before implementation.
- Link implementation PRs to their issues. Close an issue after its acceptance criteria and required checks are satisfied. Keep the parent specification open until integration is verified.

PRs as a request surface: no.

## Beads as a local execution aid

Beads stores local steps, execution dependencies, and continuation notes for a selected GitHub issue. New records link to that issue; create them when local execution detail is useful. Read product backlog and completion status from GitHub. Closing a Beads step does not close its GitHub issue. Bidirectional synchronization is not configured.

Existing Beads records retain the previous workflow's history. Read status, ownership, criteria, and dependencies before changing them. Reconcile unfinished legacy tasks before importing them into GitHub to avoid duplicates or lost requirements. Keep the existing local Dolt database; a code branch is not an independent copy of its state.

## Matt skill integration

`to-spec` publishes specifications to GitHub; `to-tickets` publishes approved issues and blocking relationships; `implement` reads an issue and fulfills its acceptance criteria. Use the current [development rules](../development/rules.md) and [verification policy](../development/quality.md) for implementation and review. The bb architecture program uses `codex/bb-architecture-workflow`; independent features get their own branches.

## Language

Discuss work with the user in Russian. Write new specifications, documentation, issue titles/bodies, acceptance criteria, and PR descriptions in technical English where practical. Preserve canonical product and API identifiers. Translate existing material when it is changed within an authorized task; a language preference does not authorize a repository-wide rewrite.
