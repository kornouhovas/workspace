# Workspace renderer session architecture

Status: scope, verification boundary, and issue breakdown approved. Issue #2 is implemented, verified and reviewed on the dedicated branch; the complete lifecycle extraction in Issue #3 has not started.

Primary tracker specification: [GitHub Issue #1](https://github.com/kornouhovas/workspace/issues/1). This file is the versioned specification snapshot; update the issue when its scope changes.

## Problem Statement

Workspace already provides a working desktop interface, but its root React component coordinates pane layout, project tabs, previews, session persistence, data loading, and rendering. This coupling makes changes difficult and obstructs preparation for a future web client. The user wants bb's architectural lessons applied while preserving Workspace's current appearance and its own backend.

## Solution

Introduce one owner of renderer session state behind a small snapshot-and-commands interface. Existing components consume it; current pane/tab reducers and serialization rules remain authoritative. The implementation benefits the current desktop product. Future web/mobile, server, AI, skills, and plugins receive clear boundaries but are separate delivery stages.

## User Stories

1. As a user, I want the interface to retain its appearance and interactions after the refactor.
2. As a user, I want to preview a project and expand it into a tab with the current behavior.
3. As a user, I want to open projects in split panes and retain their arrangement.
4. As a user, I want to focus, maximize, and restore panes using the existing actions.
5. As a user, I want closing tabs and panes to select the same fallback content as before.
6. As a user, I want to reopen closed project tabs during the current session.
7. As a user, I want to return to Workspace or Settings while retaining other open panes.
8. As a user, I want each Workspace to retain its independent session when switching.
9. As a user, I want returning to a saved view to restore its preview, including a project outside the current filter.
10. As a user, I want a restart to restore panes, tabs, and selection.
11. As a user, I want unavailable or malformed session storage to leave the application usable.
12. As a user, I want delayed responses to leave the newly selected Workspace or view unchanged.
13. As a user, I want project properties, history, and files preserved throughout internal UI changes.
14. As a developer, I want to verify session transitions without Electron or DOM access.
15. As a developer, I want platform effects and service requests separated from state transitions.

## Implementation Decisions

- Renderer session state owns panes, project tabs, focus, preview selection, per-Workspace screen memory, and restoration. React connects commands to existing interactions and renders the snapshot.
- Preserve existing reducers, pane limits, close-selection fallback, distinct tab identities, per-Workspace state, and device-global sidebar width.
- Use explicit commands and coherent state updates. Moving the existing effects into one large hook does not satisfy the ownership boundary.
- The pure model imports no React, DOM, Node, Electron, or backend implementations. React subscriptions, DOM focus, keyboard listeners, and service requests remain adapters.
- Inject session storage. Retain existing keys and formats, validation, and malformed-data handling. Do not migrate durable project data.
- Preserve Workspace/view identity and request-freshness checks for asynchronous previews. Requests use the current service client; accepted responses apply coherently.
- Introduce the owner in compatible increments. The first slice retains current restoration adapters; the second moves the complete session lifecycle.
- The first increment is implemented by [ADR-010](../adr/010-renderer-session-command-owner.md); see its [verification evidence](session-commands-verification.md).
- Leave CRUD, product mutation queues, and general data-loading lifecycle outside this slice. No new state library or monorepo is required.
- Preserve Workspace APIs, opaque IDs, sources, property values/history, folder roles, and accepted Status moves. Electron security and active JSON adapters remain unchanged.
- Use a dedicated branch. Preserve pre-existing uncommitted changes and unfinished tasks. Establish an explicit, verifiable implementation baseline and keep unrelated changes out of refactor commits.

## Testing Decisions

The approved primary seam is observable session behavior through commands and snapshots with temporary in-memory storage. Existing reducer and serialization tests remain useful. Assertions target user behavior rather than line counts, hook names, or effect placement.

- Open, close, reopen, split, focus, maximize/restore, and fallback after closing the selected pane.
- Workspace/view switching and independent screen memory, including filtered-out preview projects.
- Restart using existing formats, malformed storage, and read/write failures; closed-tab history remains transient.
- Delayed responses after Workspace/view switching, closing, or a new selection; rejected responses do not change the active session.
- An automated architecture check detects browser, React, Node, and backend imports in the pure model.
- Real Electron wiring checks use isolated fixtures. Compare before/after layout at 1440x960 and 1024x720.
- Run Node tests, typecheck, and renderer build according to project policy. Run the full software checks after integration when cross-layer boundaries are affected. Build success does not establish runtime or visual correctness.

## Out of Scope

Visual redesign, new bb product features, HTTP/auth transport, server deployment, mobile shell/native app, cloud sync, AI/skills/plugins, replacing JSON with Go/any-store, filesystem-model changes, mass formatting, and documentation deletion.

## Further Notes

- Agreed constraints: preserve appearance; retain and develop our own backend; use GitHub Issues as the primary tracker and Beads for local execution; keep application/site sources private while the marketing website is public; prepare a reviewed cleanup list and preserve history.
- Subsequent stages: documentation reconciliation, data-loading/composition-root separation when justified, a marketing site with original content and demonstrations, then web/server/AI/plugin decisions. Future capabilities are not shipping claims.
- Research reference: [bb repository overview](https://github.com/get-bb/bb/blob/fe3d743ca2d27e8102a30765f49f08328b9364ef/docs/repository-overview.md), [client-core](https://github.com/get-bb/bb/tree/fe3d743ca2d27e8102a30765f49f08328b9364ef/packages/client-core/src), and [no-DOM boundary check](https://github.com/get-bb/bb/blob/fe3d743ca2d27e8102a30765f49f08328b9364ef/packages/client-core/test/no-dom.test.ts). Source inspection was completed; bb runtime was not tested.
- Workspace references: [ADR-005](../adr/005-bb-pane-session-chrome.md), [ADR-006](../adr/006-workspace-source-bindings.md), [ADR-007](../adr/007-board-table-status-moves.md), [ADR-008](../adr/008-table-row-order.md), [runtime architecture](../development/architecture.md), [bb adaptation](../design/bb-stack-design.md), and [bb policy](../development/design/bb-workspace-policy.md).
- [Approved issue breakdown and cleanup proposal](bb-architecture-tickets.md): session commands [#2](https://github.com/kornouhovas/workspace/issues/2), lifecycle [#3](https://github.com/kornouhovas/workspace/issues/3), and independent documentation work [#4](https://github.com/kornouhovas/workspace/issues/4).

Branch: `codex/bb-architecture-workflow`. The isolated worktree starts from committed baseline `596325d`. The original checkout retains uncommitted rename/property UI changes and externally deleted legacy docs; they are not included here. Verify compatibility with that unfinished work before integrating the refactor.
