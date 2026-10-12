# Development documentation

[AGENTS.md](../../AGENTS.md) is the mandatory entry point. [rules.md](rules.md) owns operational policy; [quality](quality.md) owns verification requirements; [workflow](workflow.md) covers tracked-work bookkeeping. Specialized product/API/UI contracts and accepted ADRs own their respective domains. Proposed decisions and target architecture are not proof of current runtime wiring.

## Required reading

For each development task, including documentation, read [rules](rules.md) and select the relevant branches below. Read quality for file changes or implementation verification/review; read workflow for tracked work. Historical reports/plans are conditional context and add no current process gate.

| Task/question | Sources |
| --- | --- |
| Product scope and supported behavior | [Product guide](product.md), [PRD](../prd.md), [Vision](../vision.md), relevant [flow](../flows/) |
| Runtime wiring, layers, target-store integration | [Runtime guide](architecture.md), [architecture](../architecture.md), relevant accepted [ADR](../adr/) |
| Identity, storage, compatibility and migration | [Data model and scope table](../data-model.md#current-runtime-and-target-scope), relevant API/ADR |
| Service operations | [Sources/lifecycle/filesystem](../api/workspace-session-sources.md), [views](../api/workspace-views.md), [properties](../api/workspace-properties.md), [Status moves](../api/workspace-status-move.md), [project rename](../api/workspace-project-rename.md) |
| UI implementation/review | [UI reading route](#ui-reading-route), mandatory [bb adaptation policy](design/bb-workspace-policy.md) |
| Checks and evidence | [Quality](quality.md); actual commands in [package.json](../../package.json) |
| Tracked implementation or continuation | [Workflow](workflow.md), originating GitHub issue and relevant versioned specification |
| Issue operations and execution dependencies | [GitHub tracker](../agents/issue-tracker.md) |
| Issue triage | [Triage labels](../agents/triage-labels.md) |
| Code/domain exploration, specification synthesis or issue drafting | [Domain pointers](../agents/domain.md) |

## UI reading route

For every UI task, read the bb adaptation policy and the shared [UI Stack](../ui-guidelines.md#ui-stack), [Accessibility](../ui-guidelines.md#accessibility) and [Review Checklist](../ui-guidelines.md#review-checklist). Then read the affected screen/component sections in [Interface](../interface.md) and [UI guidelines](../ui-guidelines.md), plus the corresponding action, failure/recovery and acceptance sections of its flow. Completion of context selection means every changed surface, shared primitive and service operation has its applicable contract identified.

| Affected boundary | Additional sections |
| --- | --- |
| Shell, tabs, panes, shortcuts or project close | [Global Shell](../interface.md#global-shell), [pane/session behavior](../interface.md#pane-session-and-keyboard), [Project Detail](../interface.md#project-detail-panel), [ADR-005](../adr/005-bb-pane-session-chrome.md) as amended by [ADR-012](../adr/012-project-close-and-preview-only-right-host.md) |
| Board/Table behavior | The affected view and feature headings in Interface/UI guidelines and [Board/Table flow](../flows/board-table-views.md); [view API](../api/workspace-views.md) for settings/persistence changes |
| Settings, source or roles | [Settings screen](../interface.md#settings-screen), [Settings flow](../flows/settings-source-folder-and-roles.md), relevant source/property API |
| Property editing | [Forms and editing](../ui-guidelines.md#forms-and-editing), affected [property API](../api/workspace-properties.md) operations and flow |
| Filesystem mutation | [Status move](../api/workspace-status-move.md), [project rename](../api/workspace-project-rename.md), or [creation helper](../api/workspace-views.md#confined-directory-helper), including safety/recovery/platform limits |
| Shared tokens, menus or primitives | Applicable Styling/Icons/Component/States sections of UI guidelines and the affected consumers' contracts |

Interface owns composition, flows own interaction/recovery, UI guidelines own visual/component/accessibility rules, and APIs own wire validation/results. Expand reading when a shared dependency or cross-surface behavior is affected. Read imported [bb source](DESIGN_RULES.md) sections only under the adaptation policy's conditions.

## Historical task evidence

The first session architecture stage is recorded in the [specification](../specs/bb-architecture.md) and [issue breakdown](../specs/bb-architecture-tickets.md). Documentation reconciliation is tracked in [Issue #4](https://github.com/kornouhovas/workspace/issues/4): the [baseline audit](../specs/documentation-audit.md) preserves findings, and the [cleanup delivery](../specs/documentation-cleanup.md) records applied changes, unfinished acceptance and integration exceptions. These records are conditional task evidence, not a new mandatory checklist for unrelated work.
