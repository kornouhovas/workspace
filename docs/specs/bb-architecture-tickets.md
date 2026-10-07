# Workspace architecture issue breakdown

Status: issue size, blocking edges, and verification boundary approved. Issues #2–3 are implemented, verified and reviewed on the dedicated branch. Issue #4 remains open. The [specification](bb-architecture.md) covers the renderer session stage; integration remains pending.

The architecture parent is [Issue #1](https://github.com/kornouhovas/workspace/issues/1). Documentation cleanup has its own issue because it is outside the session code scope.

## 1. Session commands for project tabs and panes — Issue #2

[GitHub Issue #2](https://github.com/kornouhovas/workspace/issues/2).

Blocked by: None. Use the explicit committed baseline and reconcile unfinished source-checkout work before integration.

Delivery: current tab open/close/reopen, split, focus, maximize/restore, and Workspace/Settings navigation use one session owner. Preserve appearance and behavior. Existing restoration adapters remain operational in this intermediate slice.

- [x] The model exposes explicit commands and a coherent snapshot; React connects them to existing components.
- [x] DOM/platform effects remain outside the pure model.
- [x] Closing an active tab/pane selects the current fallback and retains other panes.
- [x] Workspaces retain independent tabs and layouts.
- [x] Persistence/restoration remain operational; relevant behavior tests, typecheck, renderer build, and desktop action/layout checks pass.

Implementation: [ADR-010](../adr/010-renderer-session-command-owner.md). [Verification and review](session-commands-verification.md) record the preserved interface, delayed-response regression check and pre-existing full-suite limitation. The original checkout remains unmerged.

## 2. Session restoration and asynchronous preview lifecycle — Issue #3

[GitHub Issue #3](https://github.com/kornouhovas/workspace/issues/3).

Dependency: completed [Issue #2](https://github.com/kornouhovas/workspace/issues/2), represented by a native GitHub dependency.

Delivery: restart and Workspace/view transitions restore tabs, panes, and preview through an explicit storage adapter. Delayed responses leave the currently selected screen unchanged.

- [x] Retain existing session keys/versions and read previously saved sessions.
- [x] Scope preview requests by Workspace/view identity; reject responses after a new selection or closing.
- [x] Storage failures and malformed data leave the UI usable; unavailable projects leave no empty visible shell.
- [x] Session lifecycle owns persistence/restoration; requests use the current service client.
- [x] The root component consumes snapshot/commands while CRUD and product mutation queues retain their behavior.
- [x] Restart/race tests, architecture boundary checks, software checks, and isolated Electron before/after checks pass.

Implementation: [ADR-011](../adr/011-renderer-session-lifecycle.md). [Verification and review](session-lifecycle-verification.md) record storage compatibility/recovery, request races, native behavior and the pre-existing full-suite limitation. The original checkout remains unmerged.

## 3. Documentation reconciliation and cleanup — Issue #4

[GitHub Issue #4](https://github.com/kornouhovas/workspace/issues/4).

Blocked by: no code dependency. Deletion requires review of the exact file list and incoming links; this scope is independent of issues #2–3.

Delivery: concise active instructions consistent with accepted contracts, while preserving history and verification evidence.

| Material | Proposed disposition | Condition |
| --- | --- | --- |
| [AGENTS](../../AGENTS.md), [rules](../development/rules.md), [product](../development/product.md) | Reconcile the old Status drag prohibition with ADR-007/008 | Preserve accepted entry points and filesystem safeguards |
| [Quality gates](../workflow/quality-gates.md) | Reduce duplicate requirements to a current-policy pointer | Preserve incoming links |
| [Chat workflow](../workflow/codex-chat-workflow.md), [task lifecycle](../workflow/task-lifecycle.md), [review protocol](../workflow/review-agent-protocol.md), [Symphony readiness](../workflow/symphony-readiness.md) | Remove historical obligations from active reading; retain history | Some files are already marked historical; verify the benefit of further edits |
| [Templates](../templates/) | Identify unused templates and duplicated instructions | Inspect backlinks and documentation tests before moving/deleting |
| [Legacy plans](../superpowers/plans/), [compact handoff](../design/compact-redesign-handoff.md), [matrix](../design/compact-edge-matrix.md), [review](../design/compact-implementation-review.md) | Separate completed history from current pointers | Preserve provenance, evidence, and links from unfinished tasks |
| [work](../../work/), [outputs](../../outputs/) | Inventory completed runs/fixtures and active references | Preserve unrelated untracked material and incomplete acceptance evidence |
| [Documentation test](../../test/documentation.test.js) | Update discoverability checks after approved cleanup | Retain useful license and navigation checks |

Retain current product documents, data model, API contracts, accepted ADRs, security/license material, and unfinished verification evidence. Finalize the deletion list after backlink inspection. The original checkout's `docs/superpowers` directory was removed externally during preparation; that deletion is outside this branch. This proposal reflects the isolated baseline and must be reconciled before application.

- [ ] Every affected path has a reason, disposition, and verified incoming links.
- [ ] Active rules agree with product contracts and accepted ADRs.
- [ ] History is preserved; local links and the documentation check pass.
- [ ] Commit only approved changes; `git diff --check` passes.

## Separate future specifications

The getbb.app-inspired marketing site, server/web/mobile, AI/skills/plugins, and possible Go-store integration are outside issues #2–4. Workspace is the current working name; website positioning and content still need to be agreed.
