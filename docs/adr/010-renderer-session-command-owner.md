# ADR 010: One owner for renderer session commands

Status: Accepted for the approved Issue #2 implementation slice.
Date: 2026-10-07.

## Context

The [session specification](../specs/bb-architecture.md) applies bb's separation of client state and platform effects to Workspace. The existing React root coordinated project-tab identities, pane layout, selection, fallback and transient closed-tab history through separate state setters. A tab or pane operation could require several coordinated updates.

## Decision

Introduce [workspaceSession.js](../../src/workspaceSession.js) as the in-memory owner of project tabs, pane layouts, selected project/tab, expanded presentation, active surface, global sidebar width and per-Workspace closed-tab history. Its public boundary consists of commands, a cached snapshot and subscriptions. React uses `useSyncExternalStore` to render that snapshot.

Commands coordinate expansion, split placement, restoring a tab to preview, tab/pane closure, reopening and Workspace/Settings navigation. Keep the existing tab/pane reducers and their identity, fallback, pane-limit and layout rules. Reconcile saved pane references against the initial decoded tabs inside the owner.

The owner imports no React, browser globals, Node, Electron or backend implementation. Command results describe service-load and DOM-focus effects; the React adapter executes them through the existing service client and browser APIs.

The user-command adapter rejects selection-changing compound interactions while the current surface is disabled during loading. Restoration and CRUD compatibility updates continue to reach the owner; they are not user-selection requests.

This is a compatible increment. Existing serialization, screen memory, Workspace/view restoration and preview freshness guards remain in the React adapter until [Issue #3](https://github.com/kornouhovas/workspace/issues/3). Temporary selection, tab-refresh and surface commands connect those adapters to the same state owner. They are not a claim that the complete lifecycle has been extracted.

## Consequences

Session transitions can be verified without mounting React or launching Electron. Renderer subscriptions observe one snapshot for each user command; DOM focus and requests remain platform effects. Existing storage keys/formats, backend transports, durable data and Electron security settings are preserved.

No state library, HTTP transport, new bb feature or visual redesign is introduced. Compatibility with unfinished changes in the original checkout still requires review before integration.

Verification: [Issue #2 evidence](../specs/session-commands-verification.md). The previous pane rules remain defined by [ADR-005](005-bb-pane-session-chrome.md).

Follow-up: [ADR-011](011-renderer-session-lifecycle.md) completes the lifecycle extraction described above. The intermediate React restoration adapters are superseded by the injected session lifecycle.
