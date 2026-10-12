# Tracked-work workflow

Read this guide for implementation or continuation of a tracked task. [rules.md](rules.md) owns authorization, Git and handoff; [quality.md](quality.md) owns verification.

Before implementation, read the originating GitHub issue and relevant versioned specification. Identify the requested outcome, scope, acceptance criteria and blocking dependencies. For tracker operations, ownership and execution checkpoints, follow [issue tracker](../agents/issue-tracker.md).

## Integration branch

`new-workspace` is the integration branch for issue delivery. Start each new issue branch from the latest verified `new-workspace`. After the selected issue satisfies its acceptance criteria, review and required checks (including agreed human acceptance), merge its verified branch into `new-workspace` and verify the integrated result before considering delivery complete. This owner-authorized route applies to each issue; it does not select or start the next issue or authorize release to `main`.

The current issue-19 branch first receives the completed agent-workflow changes. Its later merge into `new-workspace` remains conditional on successful issue-19 completion; existing waiting state and unresolved platform/Actions acceptance remain in force.

## Task states

Use these states as bookkeeping within the existing authorization:

- Backlog / Ready: establish a sufficiently clear goal, scope and verification approach; a conversation can supply these without a new template.
- Agent Working / Agent Review: implement the authorized scope, then review and verify the combined result.
- Human Review: a reviewable result is ready and user acceptance is the next agreed step.
- Done: the requested outcome and required checks are complete, including human acceptance when the agreed process requires it.
- Blocked: a concrete required decision, access or conflict prevents progress after safe alternatives have been checked. Continue independent work when possible; unrelated dirty files or optional tools are not automatically blockers.
