# Documentation reconciliation and cleanup

Status: inventory and non-deleting instruction reconciliation delivered; the exact reduction list below awaits user review. [GitHub Issue #4](https://github.com/kornouhovas/workspace/issues/4) stays open until the reviewed cleanup is applied and verified.

## Baseline and method

Inventory baseline: `5981cf971bea0a202ba5e9e3bf395d67d3d32afd` on `codex/bb-architecture-workflow`. The private Git repository preserves the original bytes at this revision. Scanned 191 tracked Markdown files: 74 under `docs/`, 108 under `work/`, 3 under `outputs/`, 5 at the root and 1 under `.beads/`. The 74 documentation files contain 14,529 lines.

Incoming-reference inspection covers relative Markdown links and exact repository-path literals in tracked Markdown, JS/TS, JSON/JSONL, YAML and TOML. Line numbers below refer to the baseline. Links and literals are both listed; zero detected references is not proof of disuse. External issues, closed Beads records, unqualified filenames and untracked files are outside this textual scan. Existing local Beads ownership and open tasks were inspected separately.

The baseline has 47 unresolved relative-link occurrences (44 distinct targets), all in historical `work/` snapshots/evidence; no missing local Markdown path was found in `docs/` or active entry instructions. Preserve those snapshots rather than rewriting or deleting evidence. This inventory is not a claim that every repository link or historical acceptance check passes.

## Applied now: instructions, without removing historical bodies

| Path | Reconciliation |
| --- | --- |
| [AGENTS.md](../../AGENTS.md) | Replace the obsolete primary-Status drag prohibition with accepted ADR/API pointers; preserve data and source safeguards. |
| [docs/backlog/README.md](../backlog/README.md) | Mark earlier items as historical context, not a second backlog or evidence of current completion. |
| [docs/development/product.md](../development/product.md) | Describe permitted Status moves and same-group Table rank accurately; preserve current product/backend boundaries. |
| [docs/development/rules.md](../development/rules.md) | Use current contracts and originating issues/specifications; read legacy plans conditionally. Align Status actions with ADR-007/008 and existing safeguards. |
| [docs/development/workflow.md](../development/workflow.md) | Point to the single operational policy and GitHub tracker; retain auxiliary Beads and commit/authorization boundaries. |
| [docs/superpowers/plans/README.md](../superpowers/plans/README.md) | Keep old plans discoverable while replacing their process defaults with current policy. |
| [docs/superpowers/specs/README.md](../superpowers/specs/README.md) | Retain the old location as a pointer to current versioned specifications and policy. |
| [docs/development/README.md](../development/README.md) | Make the exact inventory discoverable from the source map. |
| [docs/specs/bb-architecture-tickets.md](bb-architecture-tickets.md) | Link the concrete list and distinguish delivered preparation from pending cleanup. |

All existing paths remain. Product/API behavior, runtime code and historical plan bodies are unchanged. These instruction corrections do not declare unfinished product work complete.

## Proposed exact reduction list: 14 bodies, no path deletion

The following files contain 4,723 baseline lines. Replace each body with a short English compatibility pointer identifying its historical/optional status, the current authoritative rules/tracker, and its full original version at the pinned baseline. Git retains the complete original body; do not rewrite Git history. Keep paths usable for existing links. This reduces active instructions without creating a second physical archive or moving files with relative links.

Approval covers only these 14 body reductions and the documentation-test adjustment described below. It does not approve deletion of product requirements, unresolved evidence, or files from the original checkout.

| Original path / preserved full version | Reason | Baseline lines | Incoming references at baseline |
| --- | --- | ---: | --- |
| [docs/superpowers/plans/2026-05-14-workspace-views-backend-storage.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/superpowers/plans/2026-05-14-workspace-views-backend-storage.md) | Historical executable plan; current policy replaces process defaults. Preserve requirements and unchecked steps in the pinned version. | 1706 | None detected |
| [docs/superpowers/plans/2026-05-15-workspace-custom-properties.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/superpowers/plans/2026-05-15-workspace-custom-properties.md) | Historical executable plan; current policy replaces process defaults. Preserve requirements and unchecked steps in the pinned version. | 823 | `docs/backlog/workspace-custom-properties.md:201` (literal); `docs/workflow/codex-chat-workflow.md:44` (literal) |
| [docs/superpowers/plans/2026-05-15-workspace-frontend-electron-app.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/superpowers/plans/2026-05-15-workspace-frontend-electron-app.md) | Historical executable plan; current policy replaces process defaults. Preserve requirements and unchecked steps in the pinned version. | 800 | `docs/backlog/workspace-frontend-electron-app.md:167` (literal) |
| [docs/superpowers/plans/2026-07-13-russian-localization.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/superpowers/plans/2026-07-13-russian-localization.md) | Historical executable plan; current policy replaces process defaults. Preserve requirements and unchecked steps in the pinned version. | 94 | None detected |
| [docs/superpowers/plans/2026-09-18-audit-seven-fixes.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/superpowers/plans/2026-09-18-audit-seven-fixes.md) | Historical executable plan; current policy replaces process defaults. Preserve requirements and unchecked steps in the pinned version. | 504 | `docs/backlog/audit-seven-fixes.md:58` (link) |
| [docs/workflow/codex-chat-workflow.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/workflow/codex-chat-workflow.md) | Historical process/orchestration guidance; superseded by current rules and tracker. | 143 | `docs/development/workflow.md:21` (link); `docs/development/workspace-460-report.md:22` (link); `docs/specs/bb-architecture-tickets.md:52` (link); `test/documentation.test.js:36` (literal) |
| [docs/workflow/task-lifecycle.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/workflow/task-lifecycle.md) | Historical process/orchestration guidance; superseded by current rules and tracker. | 94 | `docs/development/workflow.md:21` (link); `docs/development/workspace-460-report.md:22` (link); `docs/specs/bb-architecture-tickets.md:52` (link) |
| [docs/workflow/symphony-readiness.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/workflow/symphony-readiness.md) | Historical process/orchestration guidance; superseded by current rules and tracker. | 87 | `docs/development/workspace-460-report.md:24` (link); `docs/specs/bb-architecture-tickets.md:52` (link) |
| [docs/templates/backlog-item.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/templates/backlog-item.md) | Optional legacy form duplicating current intake/execution guidance; no default requirement to fill it. | 81 | `docs/backlog/README.md:47` (literal) |
| [docs/templates/bug-intake.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/templates/bug-intake.md) | Optional legacy form duplicating current intake/execution guidance; no default requirement to fill it. | 102 | `test/documentation.test.js:38` (literal) |
| [docs/templates/feature-intake.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/templates/feature-intake.md) | Optional legacy form duplicating current intake/execution guidance; no default requirement to fill it. | 94 | `test/documentation.test.js:37` (literal) |
| [docs/templates/implementation-plan.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/templates/implementation-plan.md) | Optional legacy form duplicating current intake/execution guidance; no default requirement to fill it. | 96 | None detected |
| [docs/templates/review-request.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/templates/review-request.md) | Optional legacy form duplicating current intake/execution guidance; no default requirement to fill it. | 40 | None detected |
| [docs/templates/session-handoff.md](https://github.com/kornouhovas/workspace/blob/5981cf971bea0a202ba5e9e3bf395d67d3d32afd/docs/templates/session-handoff.md) | Optional legacy form duplicating current intake/execution guidance; no default requirement to fill it. | 59 | `docs/development/workspace-460-report.md:25` (link) |

The existing documentation test names the old chat workflow and feature/bug templates at `test/documentation.test.js:36–38`. After approval, change its discoverability targets to current development rules, verification and tracker instructions. Retain the useful license/security-boundary assertions. Existing path pointers still resolve; avoid tests that require exact prose or a template for every task.

Incoming links from current readers should point to current policy when appropriate. Frozen historical reports and evidence must remain unchanged. A pointer must not imply that the old plan was completed; the pinned version preserves any unresolved requirement for task-specific reconciliation.

## Retained material and exceptions

- `docs/workflow/quality-gates.md` is already a five-line compatibility pointer; retain it without claiming a new gate reduction.
- `docs/workflow/review-agent-protocol.md` remains optional review guidance under current rules; do not make it a mandatory workflow.
- `docs/templates/adr.md` and `docs/templates/release-checklist.md` remain optional, useful forms. Keeping the release form does not authorize a release.
- Retain product, flows, data model, API, accepted/proposed ADRs, bb design sources/policy, security and license material. ADR-004 remains Proposed; it does not establish sidecar wiring.
- Retain all six historical backlog item bodies and `docs/plans/completed/20260923-project-security-audit.md`; old status fields do not prove completion.
- Retain `docs/design/compact-redesign-handoff.md`, `docs/design/compact-edge-matrix.md`, `docs/design/compact-implementation-review.md`, `design-qa.md` and `docs/development/workspace-460-report.md` in place. They contain provenance, evidence links and unresolved acceptance context.
- Retain all tracked `work/` artifacts (2,191 files in 15 top-level groups) and `outputs/` artifacts (31 files in 3 groups), including fixtures and screenshots. No deletion or move allowlist exists for these directories.
- Preserve original-checkout untracked/unfinished work. Open legacy Beads task `workspace-ub5` references ADR-009, the views API and `work/workspace-la8/run-20261003-201334/`; those paths are not cleanup candidates.

The original checkout already has external deletions of five legacy plans and both `docs/superpowers` indexes. This branch preserves all seven paths. Reconcile that separate change before integration; do not silently adopt it or restore it over the user’s checkout.

## Complete documentation inventory at baseline

Disposition codes: **C** = instruction/index correction applied above; **P** = proposed body reduction, not applied; **R** = retain current contract/reference/history/evidence. Reference counts count inspected source-line/kind occurrences, not independent users.

| Tracked documentation path | Disposition | Lines | Incoming references |
| --- | --- | ---: | ---: |
| `docs/adr/001-local-first-workspace-storage.md` | R | 123 | 5 |
| `docs/adr/002-electron-preload-ipc-bridge.md` | R | 163 | 9 |
| `docs/adr/003-renderer-localisation-catalogs.md` | R | 59 | 0 |
| `docs/adr/004-project-identity-and-audit-migrations.md` | R | 75 | 4 |
| `docs/adr/005-bb-pane-session-chrome.md` | R | 24 | 4 |
| `docs/adr/006-workspace-source-bindings.md` | R | 18 | 11 |
| `docs/adr/007-board-table-status-moves.md` | R | 16 | 3 |
| `docs/adr/008-table-row-order.md` | R | 14 | 3 |
| `docs/adr/009-project-creation-os-guard.md` | R | 44 | 1 |
| `docs/adr/010-renderer-session-command-owner.md` | R | 30 | 4 |
| `docs/adr/011-renderer-session-lifecycle.md` | R | 26 | 5 |
| `docs/agents/domain.md` | R | 7 | 2 |
| `docs/agents/issue-tracker.md` | R | 28 | 2 |
| `docs/agents/triage-labels.md` | R | 11 | 1 |
| `docs/api/workspace-properties.md` | R | 546 | 22 |
| `docs/api/workspace-session-sources.md` | R | 15 | 2 |
| `docs/api/workspace-status-move.md` | R | 54 | 11 |
| `docs/api/workspace-views.md` | R | 682 | 35 |
| `docs/architecture.md` | R | 426 | 37 |
| `docs/backlog/README.md` | C | 47 | 1 |
| `docs/backlog/audit-seven-fixes.md` | R | 96 | 1 |
| `docs/backlog/board-column-width-control.md` | R | 50 | 0 |
| `docs/backlog/russian-localization.md` | R | 65 | 0 |
| `docs/backlog/workspace-custom-properties.md` | R | 203 | 2 |
| `docs/backlog/workspace-frontend-electron-app.md` | R | 167 | 1 |
| `docs/backlog/workspace-views-backend-storage.md` | R | 200 | 2 |
| `docs/data-model.md` | R | 680 | 45 |
| `docs/design/bb-stack-design.md` | R | 42 | 7 |
| `docs/design/compact-edge-matrix.md` | R | 86 | 86 |
| `docs/design/compact-implementation-review.md` | R | 83 | 38 |
| `docs/design/compact-redesign-handoff.md` | R | 98 | 178 |
| `docs/development/DESIGN_RULES.md` | R | 1547 | 10 |
| `docs/development/README.md` | C | 27 | 9 |
| `docs/development/architecture.md` | R | 27 | 9 |
| `docs/development/design/README.md` | R | 15 | 7 |
| `docs/development/design/bb-workspace-policy.md` | R | 39 | 14 |
| `docs/development/product.md` | C | 15 | 5 |
| `docs/development/quality.md` | R | 24 | 15 |
| `docs/development/rules.md` | C | 101 | 21 |
| `docs/development/workflow.md` | C | 21 | 11 |
| `docs/development/workspace-460-report.md` | R | 65 | 1 |
| `docs/flows/board-table-views.md` | R | 405 | 16 |
| `docs/flows/language-selection.md` | R | 33 | 2 |
| `docs/flows/settings-source-folder-and-roles.md` | R | 265 | 13 |
| `docs/interface.md` | R | 470 | 29 |
| `docs/plans/completed/20260923-project-security-audit.md` | R | 197 | 0 |
| `docs/prd.md` | R | 314 | 31 |
| `docs/security/20260923-project-security-audit.md` | R | 981 | 9 |
| `docs/specs/bb-architecture-tickets.md` | C | 67 | 2 |
| `docs/specs/bb-architecture.md` | R | 72 | 3 |
| `docs/specs/session-commands-verification.md` | R | 39 | 4 |
| `docs/specs/session-lifecycle-verification.md` | R | 40 | 3 |
| `docs/superpowers/plans/2026-05-14-workspace-views-backend-storage.md` | P | 1706 | 0 |
| `docs/superpowers/plans/2026-05-15-workspace-custom-properties.md` | P | 823 | 2 |
| `docs/superpowers/plans/2026-05-15-workspace-frontend-electron-app.md` | P | 800 | 1 |
| `docs/superpowers/plans/2026-07-13-russian-localization.md` | P | 94 | 0 |
| `docs/superpowers/plans/2026-09-18-audit-seven-fixes.md` | P | 504 | 1 |
| `docs/superpowers/plans/README.md` | C | 28 | 1 |
| `docs/superpowers/specs/README.md` | C | 21 | 1 |
| `docs/templates/adr.md` | R | 55 | 0 |
| `docs/templates/backlog-item.md` | P | 81 | 1 |
| `docs/templates/bug-intake.md` | P | 102 | 1 |
| `docs/templates/feature-intake.md` | P | 94 | 1 |
| `docs/templates/implementation-plan.md` | P | 96 | 0 |
| `docs/templates/release-checklist.md` | R | 58 | 0 |
| `docs/templates/review-request.md` | P | 40 | 0 |
| `docs/templates/session-handoff.md` | P | 59 | 1 |
| `docs/ui-guidelines.md` | R | 458 | 50 |
| `docs/vision.md` | R | 178 | 8 |
| `docs/workflow/codex-chat-workflow.md` | P | 143 | 4 |
| `docs/workflow/quality-gates.md` | R | 5 | 4 |
| `docs/workflow/review-agent-protocol.md` | R | 61 | 2 |
| `docs/workflow/symphony-readiness.md` | P | 87 | 2 |
| `docs/workflow/task-lifecycle.md` | P | 94 | 3 |

## Verification and next step

Observed results: `node --test test/documentation.test.js` passed both checks; the 10 changed/new files had 90 valid local path links and no fragment links; all 18 template/workflow/legacy plan bodies remained byte-identical to baseline; no `work/` or `outputs/` evidence changed; `git diff --check` passed. The baseline inventory checked documentation path targets and original-file SHA-256 values. No Electron/Go build was run for these prose changes.

After review of the exact list, apply only approved reductions, recheck links/anchors and documentation tests, commit verified changes and update Issue #4. Keep the architecture PR draft; integration and unresolved native acceptance remain separate.
