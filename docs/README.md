# Documentation

These documents are written for the new implementation. The previous documentation remains in Git history; its implementation contracts are not automatically requirements for this branch.

| Document | Purpose |
| --- | --- |
| [Product](product.md) | Accepted direction and capabilities to preserve |
| [Glossary](../GLOSSARY.md) | Domain terminology |
| [Decisions](decisions.md) | Accepted choices and unresolved design branches |
| [Architecture](architecture.md) | Boundaries, stack and implementation status |
| [Roadmap](roadmap.md) | Outcomes, dependencies and completion criteria |
| [Workspace 0.1.0 specification](specs/workspace-0.1.0.md) | Local-release requirements and acceptance for M1–M4 |
| [Workspace 0.1.0 implementation tickets](specs/workspace-0.1.0-tickets/README.md) | Published vertical slices, historical IDs and blocking edges |
| [Development](development.md) | GitHub-only workflow, executor selection, integration and verification |
| [CI](ci.md) | Conditional CI routes and scheduling |
| [Runtime checkpoints](verification/development-checkpoints.md) | Conditional operation details and retained verification evidence |
| [Releases](releases.md) | Versions, changelog and future distribution |
| [Reuse](reuse.md) | bb reference, attribution and adaptation rules |
| [ADRs](adr/) | Significant accepted tradeoffs |
| [Plans](plans/README.md) | Bounded implementation plans |

Product discovery is ongoing. Accepted decisions may be implemented only within the authorized implementation scope; proposed details remain questions. A roadmap entry does not prove that code exists.

## Task-specific reading

Read development's scope, integration, tracker, executor-selection and verification rules for development tasks. Select product/architecture sections by the changed boundary; current runtime and accepted ADRs take precedence over historical plans. Read deep verification checkpoints only for the affected operation or continuing acceptance work.

| Task | Relevant contracts |
| --- | --- |
| Service, storage or filesystem changes | Affected sections in [architecture](architecture.md), [ADRs](adr/) and typed contracts in `src/shared/`; inspect the active service wiring |
| Custom property/ordinary option deletion | [Contract/scenarios](plans/issue-36-metadata-removal.md), typed reviewed metadata commands and [verification](verification/issue-36-metadata-removal.md) |
| Name/category group assignment | [Contract/scenarios](plans/issue-35-folder-drag.md), existing safe filesystem commands and [verification](verification/issue-35-folder-drag.md) |
| MultiSelect group assignment | [Contract/scenarios](plans/issue-34-multiselect-drag.md), typed group-assignment command and [verification](verification/issue-34-multiselect-drag.md) |
| Scalar and Single Select group assignment | [Contract/scenarios](plans/issue-33-group-drag.md), typed group-assignment command and [verification](verification/issue-33-group-drag.md) |
| Board columns and card presentation | [Contract/scenarios](plans/issue-32-board-layout.md), typed Board layout commands and [verification](verification/issue-32-board-layout.md) |
| Table columns and manual rows | [Contract/scenarios](plans/issue-31-table-layout.md), typed Table layout commands and [verification](verification/issue-31-table-layout.md) |
| Select/category grouping | [Contract/scenarios](plans/issue-30-option-grouping.md), typed grouping commands and [verification](verification/issue-30-option-grouping.md) |
| Exact scalar grouping | [Grouping contract/scenarios](plans/issue-29-scalar-grouping.md), typed grouping commands and [verification](verification/issue-29-scalar-grouping.md) |
| Search and typed filters | [Filter contract/scenarios](plans/issue-28-view-filters.md), typed query/filter commands and [verification](verification/issue-28-view-filters.md) |
| Table/Board views | [Lifecycle/scenarios](plans/issue-27-views.md), typed view commands and [verification](verification/issue-27-views.md) |
| MultiSelect | [Set contract/scenarios](plans/issue-26-multiselect.md), typed property commands and [verification](verification/issue-26-multiselect.md) |
| Ordinary Single Select | [Contract/scenarios](plans/issue-25-single-select.md), typed property commands and [verification](verification/issue-25-single-select.md) |
| Date properties | [Date contract/scenarios](plans/issue-24-date-properties.md), typed property commands and [verification](verification/issue-24-date-properties.md) |
| Number properties | [Number implementation](architecture.md#implemented-number-properties), [grammar/scenarios](plans/issue-23-number-properties.md), typed property contracts and [verification](verification/issue-23-number-properties.md) |
| Project rename | [No-replace rename ADR](adr/0007-no-replace-project-renames.md), Architecture's rename/recovery sections, [rename ticket](specs/workspace-0.1.0-tickets/11-rename-project-folders-without-losing-identity.md) and originating issue |
| Category move | Architecture's category-move/recovery sections, [move ticket](specs/workspace-0.1.0-tickets/12-move-projects-by-editing-folder-backed-select.md) and originating issue |
| UI implementation/review | [Reuse adaptation policy](reuse.md#adaptation-policy), affected product/architecture interaction, accessibility, EN/RU and failure/recovery constraints, and the issue's acceptance criteria |
| Issue operations or dependency graph | [Tracker](issue-tracker.md), including native and textual fallback relationships |

For UI, identify the contract for each changed surface, shared primitive and service action; expand to related consumers when shared behavior changes. Imported bb references apply only to the relevant component/foundation; historical source/acceptance reports are consulted for provenance or a specific continuation, not loaded as general UI rules. Inspect actual component layout and scripts rather than copying a directory or command inventory into instructions.
