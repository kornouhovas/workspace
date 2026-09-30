# Symphony Readiness

> Проектный материал для будущей оркестрации. Текущий процесс задают [rules.md](../development/rules.md) и [workflow](../development/workflow.md); схемы ниже не разрешают создавать задачи, делегировать, менять scope или выпускать изменения. Manual equivalent ниже — историческая схема.

This project can adopt a Symphony-like workflow later without adopting a full orchestrator immediately.

## Current Manual Equivalent

Manual process:

```text
User creates/request task in chat
  -> Codex prepares backlog/spec/plan
  -> User approves scope
  -> Codex implements one slice in current workspace
  -> Codex verifies
  -> User reviews
```

Future orchestrated process:

```text
Issue tracker task moves to Ready
  -> orchestrator creates isolated workspace
  -> Codex app-server runs task using AGENTS.md and the task contract
  -> agent posts proof of work
  -> task moves to Human Review
```

## Minimum Requirements Before Orchestration

- `AGENTS.md` is accurate.
- Backlog items have clear acceptance criteria.
- Implementation plans are small and executable.
- Quality gates are stable.
- UI tasks include visual verification.
- Review process is documented.
- Active work can be isolated in branches/worktrees.

## Task Contract For Future Board

Every external issue should include:

- title;
- status;
- objective;
- scope;
- out of scope;
- relevant docs;
- acceptance criteria;
- test plan;
- quality gates;
- blockers/dependencies;
- handoff requirements.

## Recommended Orchestration States

```text
Backlog
Ready
Agent Working
Agent Review
Human Review
Done
Blocked
```

## What The Orchestrator Should Not Decide

The orchestrator should not make product or architecture decisions.

It may:

- dispatch ready tasks;
- create isolated workspaces;
- run Codex;
- collect logs/status;
- retry failed runs;
- stop runs when task state changes.

It must not:

- approve its own risky actions;
- merge/release without policy;
- alter scope silently;
- expose secrets to untrusted contexts;
- bypass quality gates.
