# Backlog Item Template

## Status

Backlog

## Goal

State the desired outcome in one sentence.

## Context

Explain why this work exists and which existing docs/code matter.

## User Value Or Bug Impact

Describe user-facing value or impact.

## Relevant Docs

- `AGENTS.md`
- `WORKFLOW.md`
- `docs/vision.md`
- `docs/prd.md`
- `docs/architecture.md`

Add task-specific docs:

- `docs/api/...`
- `docs/flows/...`
- `docs/adr/...`
- `docs/ui-guidelines.md`
- `docs/data-model.md`

## Scope

List included behavior.

## Out Of Scope

List excluded behavior.

## Acceptance Criteria

- Criterion 1.
- Criterion 2.
- Criterion 3.

## Constraints

- Preserve architecture boundaries.
- Do not add dependencies without approval.
- Do not change public contracts without docs and tests.
- Keep React away from backend/storage/filesystem internals.

Add task-specific constraints.

## Test Plan

List focused tests and integration tests.

## Quality Gates

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
git --no-pager diff --check
```

Adjust when the slice is docs-only or backend-only.

## Risks

- Risk 1.
- Risk 2.

## Ready For Implementation

State what must be true before coding begins.
