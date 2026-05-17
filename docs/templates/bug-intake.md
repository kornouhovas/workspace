# Bug Intake Template

Use this template when the user reports broken behavior.

## Workflow Evidence

- Mode: Bug Diagnosis
- Docs read:
- Branch:
- Expected behavior:
- Quality gates:
- Commit:
- Handoff state: Backlog

## Status

Backlog

## Bug Summary

State the bug in one sentence.

## User Report

Record the user's original wording.

## Expected Behavior

Use existing docs when possible. Ask the user only if the expected behavior is genuinely unclear.

## Actual Behavior

Describe what happens.

## Affected Surface

Examples:

- Settings;
- Board;
- Table;
- Project Detail Panel;
- Electron IPC;
- sidecar storage;
- project scan;
- custom properties;
- view filtering.

## Reproduction Steps

1. Step.
2. Step.
3. Step.

If not yet reproduced, say what still needs to be checked.

## Relevant Docs

- `AGENTS.md`
- `WORKFLOW.md`
- relevant `docs/flows/*`
- relevant `docs/api/*`
- `docs/architecture.md`

## Suspected Area

State the likely layer:

- UI component;
- renderer app state;
- service client;
- Electron IPC;
- backend/domain;
- sidecar/storage;
- filesystem safety;
- build/runtime config.

## Diagnostic Plan

1. Inspect relevant files.
2. Run focused test or command.
3. Reproduce/localize.
4. Identify root cause.
5. Add regression test.
6. Apply minimal fix.

## Regression Test Plan

Name the test file and behavior to cover.

## Quality Gates

List focused checks and final checks.

## Handoff Requirements

Final answer must include:

- root cause;
- fix;
- regression coverage;
- verification;
- risk.
