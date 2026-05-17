# Task Lifecycle

This document defines how work moves from idea to done.

## States

```text
Backlog -> Ready -> Agent Working -> Agent Review -> Human Review -> Done
                         |                              |
                         v                              v
                      Blocked                        Backlog
```

## Backlog

An idea or issue exists.

Required fields before leaving Backlog:

- goal;
- user value or bug impact;
- scope;
- non-goals;
- acceptance criteria;
- relevant docs;
- quality gates.

## Ready

The task is ready for one agent run.

Ready tasks must be small enough to verify independently.

If a task includes backend, sidecar, Electron IPC, UI, and visual verification, split it unless the changes are tiny.

## Agent Working

One Codex session works on one approved slice.

Rules:

- no unrelated refactors;
- no silent scope expansion;
- no dependency changes without approval;
- tests added close to changed behavior;
- docs updated when behavior changes.

## Agent Review

Codex reviews its own work.

Checklist:

- acceptance criteria covered;
- architecture boundaries preserved;
- tests exist for changed behavior;
- quality gates run;
- UI visually checked when applicable;
- docs not stale;
- no unrelated changes.

## Human Review

The user decides whether the result is accepted.

Possible outcomes:

- accepted -> Done;
- changes requested -> Backlog or Ready;
- blocked -> Blocked;
- split needed -> create new backlog items.

## Done

Done means:

- implementation complete;
- verification complete;
- review accepted;
- follow-ups recorded if needed.

## Blocked

Blocked means Codex cannot safely proceed.

Examples:

- missing product decision;
- unresolved architecture conflict;
- permission/secret unavailable;
- active agent changed the same files;
- quality gate fails due to unrelated existing issue.
