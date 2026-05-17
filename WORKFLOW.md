# WORKFLOW.md

This file defines how Codex should work in this repository.

It is intentionally operational. Product and architecture details live in `docs/`; this file defines how to move work through the system.

## Workflow States

Use these states for backlog items, external boards, or future orchestration:

```text
Backlog
Ready
Agent Working
Agent Review
Human Review
Done
Blocked
```

### Backlog

The idea exists but may not have enough detail.

Allowed actions:

- inspect docs/code;
- ask questions;
- prepare feature/bug intake;
- draft backlog/spec/API/flow/ADR updates.

Do not implement from `Backlog` unless the user explicitly asks for a quick spike.

### Ready

The task has enough detail for implementation.

Required:

- clear goal;
- scope and non-goals;
- acceptance criteria;
- relevant docs listed;
- quality gates listed;
- known risks stated.

### Agent Working

Codex is implementing one approved slice.

Rules:

- keep changes scoped;
- add tests close to the changed behavior;
- update docs when behavior changes;
- do not expand scope without approval;
- do not proceed to the next slice if the user asked for checkpoints.

### Agent Review

Codex self-reviews its own work before handoff.

Required checks:

- compare diff against backlog/spec/acceptance criteria;
- check architecture boundaries;
- check tests and visual evidence;
- check docs changed when needed;
- run appropriate quality gates.

### Human Review

The user reviews the result.

Codex must provide:

- summary;
- files changed;
- verification results;
- risks;
- follow-up suggestions;
- whether commit/merge/release is recommended.

### Done

The work is accepted and no immediate action remains.

### Blocked

Use when implementation cannot safely continue.

Blocking examples:

- missing product decision;
- required secret/access unavailable;
- architecture conflict;
- failing unrelated tests caused by existing changes;
- active agent edits conflict with the requested work.

## Default Request Handling

### New Feature

When the user describes a new feature, Codex should:

1. Restate the intent in one sentence.
2. Inspect relevant docs and code.
3. Ask only necessary questions.
4. Decide whether docs need updates before code.
5. Prepare a backlog item and contracts/flows/ADR when needed.
6. Propose small implementation slices.
7. Wait for approval before code unless the user explicitly asked to implement.

### Bug Fix

When the user reports a bug, Codex should:

1. Identify the expected behavior from docs or ask for it.
2. Reproduce or localize the issue.
3. Find root cause.
4. Add or update a regression test.
5. Apply the smallest safe fix.
6. Run focused checks and appropriate quality gates.
7. Summarize cause, fix, verification, and residual risk.

### Existing Plan

When the user points to a plan or backlog item, Codex should:

1. Read the referenced file.
2. Read the listed context docs.
3. Execute only the requested task/slice.
4. Update checkboxes or task status only when working inside a plan file and the user asked for it.
5. Stop at the requested checkpoint.

### Review

When the user asks for review, Codex should:

1. Read current diff.
2. Read relevant docs.
3. Report findings first.
4. Avoid summaries before findings.
5. Avoid code changes unless requested.

## Task Sizing

Prefer small tasks that can be completed and verified independently.

Good task:

```text
Add backend validation and tests for deleting the last view.
```

Too broad:

```text
Finish custom properties.
```

If a task touches more than one major boundary, split it:

- domain/backend;
- sidecar storage;
- Electron IPC;
- renderer state;
- UI surface;
- visual verification.

## Documentation Triggers

Prepare or update docs before implementation when a task changes:

- product behavior: `docs/prd.md`;
- screen behavior: `docs/interface.md` or `docs/flows/*`;
- API/service behavior: `docs/api/*`;
- data model: `docs/data-model.md`;
- architecture: `docs/architecture.md`;
- major decisions: `docs/adr/*`;
- work scope: `docs/backlog/*`;
- implementation sequence: `docs/superpowers/plans/*`.

## ADR Triggers

Create or update an ADR before:

- adding a dependency;
- changing Electron security settings;
- introducing a new IPC channel family;
- exposing sidecar routes as public contracts;
- changing project identity strategy;
- changing storage technology;
- adding sync/collaboration/auth;
- changing folder role semantics;
- changing release/package architecture.

## Quality Gates

Use focused checks while iterating.

Use full checks before claiming completion:

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
git --no-pager diff --check
```

For UI changes, also open the Electron app and check the changed surface:

```bash
npm run build:renderer
npm run electron
```

## Handoff Format

Final handoff for completed work:

```markdown
Done: <one sentence>

Changed:
- <file or area>

Verified:
- <command>: <result>

Notes:
- <risk or follow-up, if any>
```

For bugs:

```markdown
Root cause: <one sentence>
Fix: <one sentence>
Regression coverage: <test>
Verified: <commands>
```

## Future Symphony Compatibility

This workflow is intentionally compatible with a future orchestrator.

Minimum future task contract:

- issue title;
- issue body using a backlog template;
- state;
- dependencies/blockers;
- allowed scope;
- quality gates;
- handoff state;
- proof-of-work requirements.

The future orchestrator should guarantee:

```text
for every Ready task, run one agent in an isolated workspace until it reaches Human Review, Done, or Blocked.
```
