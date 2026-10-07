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

No code dependency. The user requested an exact list and history preservation before removal. The [documentation inventory and cleanup proposal](documentation-cleanup.md) records all 74 earlier baseline paths, incoming references, protected evidence and original-checkout exceptions. The subsequent [full semantic audit](documentation-audit.md) assesses all 75 current baseline documents and the original-only rename contract, identifies active-contract drift, and recommends reconciliation before historical reductions.

- [x] Reconcile active Status instructions with accepted ADR-007/008 and the existing safe API.
- [x] Make GitHub the primary tracker in active workflow/index guidance; read legacy material conditionally.
- [x] Inventory historical bodies and incoming links; preserve product contracts and unfinished evidence.
- [x] Assess every documentation file semantically; compare consequential runtime claims, original-checkout variants, local links/anchors and repeated prose.
- [ ] Reconcile the active product/API/UI contradictions identified by the full audit without changing product behavior.
- [ ] Review the historical reductions and optional template treatment with the user, then apply only the approved scope.
- [ ] Update documentation discoverability checks after the approved reductions and verify the resulting links.

The quality-gates file is already a short policy pointer; it needs no duplicate cleanup. No historical body, evidence artifact or path has been deleted or moved by this preparation. Keep Issue #4 open until reviewed cleanup is applied and verified. The original checkout remains unmerged.

## Separate future specifications

The getbb.app-inspired marketing site, server/web/mobile, AI/skills/plugins, and possible Go-store integration are outside issues #2–4. Workspace is the current working name; website positioning and content still need to be agreed.
