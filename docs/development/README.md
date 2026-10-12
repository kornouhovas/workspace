# Development documentation

[AGENTS.md](../../AGENTS.md) is the mandatory entry point. [rules.md](rules.md) owns operational policy; [quality](quality.md) owns verification requirements; [workflow](workflow.md) covers tracked-work bookkeeping. Specialized product/API/UI contracts and accepted ADRs own their respective domains. Proposed decisions and target architecture are not proof of current runtime wiring.

## Required reading

For each development task, including documentation, read [rules](rules.md) and select the relevant branches below. Read quality for file changes or implementation verification/review; read workflow for tracked work. Historical reports/plans are conditional context and add no current process gate.

| Task/question | Sources |
| --- | --- |
| Product scope and supported behavior | [Product guide](product.md), [PRD](../prd.md), [Vision](../vision.md), relevant [flow](../flows/) |
| Runtime wiring, layers, target-store integration | [Runtime guide](architecture.md), [architecture](../architecture.md), relevant accepted [ADR](../adr/) |
| Identity, storage, compatibility and migration | [Data model and scope table](../data-model.md#current-runtime-and-target-scope), relevant API/ADR |
| Service operations | [Sources/lifecycle/filesystem](../api/workspace-session-sources.md), [views](../api/workspace-views.md), [properties](../api/workspace-properties.md), [Status moves](../api/workspace-status-move.md) |
| UI implementation/review | [Interface](../interface.md), [UI guidelines](../ui-guidelines.md), affected flow and mandatory [bb adaptation policy](design/bb-workspace-policy.md) |
| Checks and evidence | [Quality](quality.md); actual commands in [package.json](../../package.json) |
| Tracked implementation or continuation | [Workflow](workflow.md), originating GitHub issue and relevant versioned specification |
| Issue operations and execution dependencies | [GitHub tracker](../agents/issue-tracker.md) |
| Issue triage | [Triage labels](../agents/triage-labels.md) |
| Code/domain exploration, specification synthesis or issue drafting | [Domain pointers](../agents/domain.md) |

For UI, Interface owns screen composition, flows own ordered interaction/recovery, UI guidelines own visual/component/accessibility rules, and APIs own wire validation/results. Read the full imported [bb source](DESIGN_RULES.md) only for relevant source sections under the adaptation policy. Its instructions do not expand Workspace features or replace accepted geometry.

The first session architecture stage is recorded in the [specification](../specs/bb-architecture.md) and [issue breakdown](../specs/bb-architecture-tickets.md). Documentation reconciliation is tracked in [Issue #4](https://github.com/kornouhovas/workspace/issues/4): the [baseline audit](../specs/documentation-audit.md) preserves findings, and the [cleanup delivery](../specs/documentation-cleanup.md) records applied changes, unfinished acceptance and integration exceptions. These records are conditional task evidence, not a new mandatory checklist for unrelated work.
