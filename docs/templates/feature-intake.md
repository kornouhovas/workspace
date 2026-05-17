# Feature Intake Template

Use this template when the user describes a new capability.

## Workflow Evidence

- Mode: Feature Intake
- Docs read:
- Branch:
- Acceptance criteria:
- Quality gates:
- Handoff state: Backlog

## Status

Backlog

## Short Request

Record the user's original request in plain language.

## Interpreted Goal

State what the feature should enable in one or two sentences.

## User Value

Explain why this matters to the user.

## Questions

List only questions that are necessary before implementation.

Examples:

- Which screen owns this action?
- Should this persist locally?
- Should this affect current filters/search/view settings?
- Should this work in Electron only?
- Does this need export/save/open dialog behavior?

## Existing Docs To Read

- `AGENTS.md`
- `WORKFLOW.md`
- `docs/vision.md`
- `docs/prd.md`
- `docs/architecture.md`
- `docs/ui-guidelines.md`
- `docs/data-model.md`

Add relevant API/flow/ADR docs.

## Scope Proposal

Define what is included.

## Out Of Scope

Define what is not included.

## Architecture Impact

State whether this changes:

- data model;
- service/API contract;
- Electron IPC;
- sidecar/storage;
- React UI;
- filesystem safety;
- dependencies;
- release/package behavior.

## Docs Needed

- Backlog item: yes/no.
- API contract: yes/no.
- UX flow: yes/no.
- ADR: yes/no.
- Implementation plan: yes/no.

## Proposed Implementation Slices

1. Smallest backend/domain slice.
2. Storage/sidecar slice if needed.
3. Electron IPC slice if needed.
4. Renderer state slice if needed.
5. UI slice if needed.
6. Visual verification slice if needed.

## Recommended Next Step

State the next safe action.
