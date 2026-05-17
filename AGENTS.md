# AGENTS.md

## Project Role

This repository is developed with Codex in a spec-first, agent-ready workflow.

The human owns product direction, architecture approval, scope, tradeoffs, final review, and release decisions.

Codex owns repository inspection, documentation preparation, implementation, tests, visual verification, self-review, and handoff summaries.

## Start Here

Before changing files, read the files relevant to the task.

Always read:

- `WORKFLOW.md`
- `docs/architecture.md`
- `docs/prd.md`
- `docs/ui-guidelines.md` for UI work
- `docs/data-model.md` for storage/data work
- the relevant `docs/api/*` contract for service/API work
- the relevant `docs/flows/*` file for user-flow work
- the relevant `docs/backlog/*` item or `docs/superpowers/plans/*` plan when one exists

For architecture-changing work, read existing ADRs in `docs/adr/`.

## Workflow Evidence

For every project task, Codex must infer the request mode before acting:

- `Feature Intake` for new capabilities or product behavior.
- `Bug Diagnosis` for broken behavior, regressions, or "does not work" reports.
- `Implementation Slice` for an existing backlog item or plan.
- `Review` for review, audit, or "check whether this is correct" requests.

If the request is ambiguous, state the most likely mode and ask only the blocking clarification. Do not ask the user to choose the mode when the wording and repository context make it clear.

Every non-trivial project response must include a `Workflow Evidence` block:

```text
Workflow Evidence:
- Mode:
- Docs read:
- Branch:
- Acceptance criteria or expected behavior:
- Quality gates:
- Handoff state:
```

Update the block as work moves through `Backlog`, `Ready`, `Agent Working`, `Agent Review`, `Human Review`, `Done`, or `Blocked`.

## Current Product Boundaries

The app is a local-first Electron desktop app:

- renderer: React, TypeScript, Vite, Tailwind CSS, shadcn/ui;
- shell: Electron loading the built renderer;
- service boundary: `WorkspaceServiceClient`;
- privileged bridge: Electron preload IPC;
- domain/backend modules: workspace modules under `src/`;
- durable local store: Go sidecar using `any-store` on SQLite.

React must stay thin. Product rules, filesystem safety, storage behavior, project discovery, folder roles, property normalization, and view projection do not belong in React components.

## Forbidden Without Explicit Approval

Do not do these without asking first and, when appropriate, preparing an ADR:

- add npm or Go dependencies;
- change storage technology away from `any-store`;
- change project identity strategy;
- expose sidecar routes as public UI/API contracts;
- let React import Node builtins, backend modules, sidecar clients, SQLite, or `any-store`;
- change Electron security posture (`contextIsolation`, `nodeIntegration`, `sandbox`);
- change folder role semantics;
- add drag/drop between primary status groups;
- add authentication, cloud sync, multi-user collaboration, or external PM integrations;
- delete, move, or rename user project files on disk;
- use absolute paths as stable project ids.

## Request Modes

### Feature Intake

Use when the user says "хочу фичу", "добавь функционал", or describes a new capability.

Default behavior:

1. Inspect current docs and code boundaries.
2. Ask only necessary product/architecture questions.
3. Prepare or update docs before code:
   - backlog item;
   - API contract when a service boundary changes;
   - UX flow when user behavior changes;
   - ADR when architecture, dependency, storage, IPC, identity, or release policy changes.
4. Propose small implementation slices.
5. Wait for implementation approval unless the user explicitly asked to implement.

### Bug Diagnosis

Use when the user says "баг", "сломалось", "не открывается", "не работает", or describes a regression.

Default behavior:

1. Reproduce or localize the failure.
2. Compare actual behavior against docs/flows/contracts.
3. Identify root cause before changing code.
4. Add or update a regression test.
5. Apply the smallest fix that preserves architecture.
6. Run focused checks, then broader checks if the blast radius requires it.

### Implementation Slice

Use when a backlog item or plan already exists.

Default behavior:

1. Read the backlog item and related docs.
2. Execute only the requested slice.
3. Keep changes narrowly scoped.
4. Add tests at the closest useful boundary.
5. Run quality gates.
6. Summarize changed files, verification, risks, and follow-ups.
7. Do not move to the next slice without user approval when the user requested slice-by-slice work.

### Review

Use when the user asks for review.

Default behavior:

1. Read the diff and relevant docs.
2. Lead with findings ordered by severity.
3. Cite concrete files/lines.
4. Focus on bugs, regressions, missing tests, spec mismatches, architecture violations, and user-facing risks.
5. Do not rewrite code unless the user asks for fixes.

## Required Proof Of Work

Every completed code change must report:

- what changed;
- files touched;
- tests/checks run and exact outcome;
- known risks;
- any docs updated;
- any follow-up tasks.

For UI changes, also verify the Electron app visually when feasible:

```bash
npm run build:renderer
npm run electron
```

Check desktop layouts at 1440x960 and 1024x720 when the UI surface changed.

## Quality Gates

Default full verification:

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
git --no-pager diff --check
```

Backend/local-storage focused loop:

```bash
npm test
go test ./...
npm run build:sidecar
git --no-pager diff --check
```

Frontend focused loop:

```bash
npm test
npm run typecheck
npm run build:renderer
git --no-pager diff --check
```

Use focused tests first while iterating, but do not claim completion without appropriate broader verification.

## Git Rules

The repository may be dirty because another agent or the user is working.

- Never revert changes you did not make unless explicitly requested.
- Inspect `git status --short --branch` before starting implementation.
- If unrelated changes exist, leave them alone.
- If related files have user/agent edits, read carefully and work with them.
- Do not use destructive commands such as `git reset --hard` or `git checkout --`.
- Commit only when the user asked for commits or the current workflow explicitly requires it.

## Documentation Rules

Docs are source-of-truth artifacts, not decoration.

Update docs in the same task when behavior changes:

- product scope: `docs/prd.md`;
- architecture: `docs/architecture.md` and possibly `docs/adr/*`;
- storage/data: `docs/data-model.md`;
- UI behavior: `docs/interface.md`, `docs/ui-guidelines.md`, `docs/flows/*`;
- service contracts: `docs/api/*`;
- work item scope: `docs/backlog/*`;
- execution plan: `docs/superpowers/plans/*`.

Avoid stale docs. If implementation and docs disagree, either fix the implementation or update the docs in the same change.

## Implementation Rules

- Prefer existing patterns and helpers.
- Keep React components presentational and service-driven.
- Keep product logic in backend/domain modules.
- Keep filesystem operations constrained to the selected project source folder.
- Keep sidecar routes local implementation details.
- Add tests before or with behavior changes.
- Do not broaden scope while fixing nearby code.
- Do not introduce abstractions unless they reduce real duplication or clarify a boundary.
