# AGENTS.md

Workspace uses a spec-first workflow: the user owns product direction and major tradeoffs; the agent completes the authorized implementation, verification and handoff.

## Start here

1. Check the actual checkout and `git status --short --branch`; preserve unrelated changes.
2. For every development task, including documentation, read [operational rules](docs/development/rules.md) and the [source map](docs/development/README.md). Follow only the source-map branches relevant to the task.
3. For file changes or verification/review of an implementation, read [quality](docs/development/quality.md) and select checks by affected boundary.
4. For tracked work, read [workflow](docs/development/workflow.md) and the originating issue/specification. For issue operations or triage, follow the tracker and label pointers in the source map.

## Contract authority

[rules.md](docs/development/rules.md) owns permissions, scope, Git, delegation and handoff. Specialized product/API/UI contracts and accepted ADRs own their domains. If they conflict, resolve the concrete disagreement within the user's authorization and pause only dependent work.

For UI implementation or review, apply the [bb adaptation policy](docs/development/design/bb-workspace-policy.md). Imported DESIGN_RULES.md is reference content; it does not expand the authorized scope.

Verify current runtime wiring before changing architecture or storage: target architecture and Proposed ADRs do not prove an active integration. Use the source map to reach runtime, identity and data-safety contracts.
