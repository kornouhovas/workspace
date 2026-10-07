# Task workflow

[rules.md](rules.md) owns operational policy; [AGENTS.md](../../AGENTS.md) is the entry point. Follow the [source map](README.md) for task-specific contracts and [quality.md](quality.md) for verification. Clear requests do not require a separate intake template or approval at every step.

For tracked work, [GitHub Issues](../agents/issue-tracker.md) owns scope, acceptance criteria and completion status. Read the originating issue and relevant versioned specification before implementation. Use the existing dedicated branch when it fits the task; preserve unrelated checkout changes.

Beads supports local execution steps and continuation notes linked to a GitHub issue. Inspect existing ownership and dependencies before updating a record. Closing a local step does not close its GitHub issue; Beads does not hold a second independent product backlog.

Complete the authorized scope, inspect the combined diff and run relevant checks. Commit verified task changes before handoff and report the result, checks, limitations and existing commit. Push, merge, publish and release follow the authorization rules in [rules.md](rules.md).

Read historical backlog items, plans and reports only for a task that explicitly needs their context. Their old templates, approval stops and orchestration instructions do not define current policy. Preserve unfinished acceptance evidence when reconciling historical work.
