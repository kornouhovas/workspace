# Tracked-work workflow

Read this guide for implementation or continuation of a tracked task. [rules.md](rules.md) owns authorization, Git and handoff; [quality.md](quality.md) owns verification.

Before implementation, read the originating GitHub issue and relevant versioned specification. Identify the requested outcome, scope, acceptance criteria and blocking dependencies. For tracker operations and Beads continuation notes, follow [issue tracker](../agents/issue-tracker.md).

## Task states

Use these states as bookkeeping within the existing authorization:

- Backlog / Ready: establish a sufficiently clear goal, scope and verification approach; a conversation can supply these without a new template.
- Agent Working / Agent Review: implement the authorized scope, then review and verify the combined result.
- Human Review: a reviewable result is ready and user acceptance is the next agreed step.
- Done: the requested outcome and required checks are complete, including human acceptance when the agreed process requires it.
- Blocked: a concrete required decision, access or conflict prevents progress after safe alternatives have been checked. Continue independent work when possible; unrelated dirty files or optional tools are not automatically blockers.
