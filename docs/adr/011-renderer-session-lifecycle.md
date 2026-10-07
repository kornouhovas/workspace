# ADR 011: Renderer session lifecycle and injected adapters

Status: Accepted for the approved Issue #3 implementation slice.
Date: 2026-10-07.

## Context

[ADR-010](010-renderer-session-command-owner.md) introduced one owner for session commands while retaining restoration, screen memory and preview request guards in React. [Issue #3](https://github.com/kornouhovas/workspace/issues/3) completes that lifecycle extraction while preserving the current desktop interface and backend.

## Decision

Compose the pure [session owner](../../src/workspaceSession.js) inside [workspaceSessionLifecycle.js](../../src/workspaceSessionLifecycle.js). The lifecycle owns saved Workspace/view screen memory, startup and pending-Workspace restoration, preview request freshness, and persistence. React subscribes to the existing snapshot and submits commands. A restoration command applies project, tab, presentation and preview-host state together.

Inject the current WorkspaceServiceClient and the [session storage adapter](../../src/workspaceSessionStorage.js). The browser composition root supplies deferred `getItem`/`setItem` access, so even a failing localStorage getter is caught by the existing defensive readers/writers. Keep `workspace.project-tabs.v1` (read versions 1/2, write version 2), `workspace.pane-layout.v1` (version 1) and `workspace.sidebar-width.v1`. No durable data migration or new IPC contract is introduced.

Persist chrome independently of projection readiness. Capture active screen memory only when the source/view is ready; retain outgoing memory while a destination is pending. Read saved preview projects through the service independently of projection filters. Missing previews clear their remembered identity and close the host. Expanded tabs retain existing cached-project behavior and opaque tab identities. Closed-tab history stays transient.

Preview lookup and file-tree requests carry Workspace/view identity and a selection generation. Navigation, explicit closure and subsequent project selection invalidate earlier responses; stale errors are suppressed as well. Projection adapters prepare destination preview data alongside the general projection request, then accept both in the same React batch. The existing general-load and mutation version guards remain in the composition root.

The lifecycle and pure owner import no React, browser globals, Node or Electron implementations. Service and storage effects use injected adapters; DOM focus, keyboard/background gestures, localization and notifications remain UI adapters. CRUD, product mutation queues, source discovery and projection normalization retain their existing responsibilities.

## Consequences

Restart, storage recovery, independent screen memory and preview races can be tested through session commands/snapshots with temporary storage and controlled service responses. An architecture check covers the lifecycle's transitive imports. The small reader correction for prototype-like Workspace IDs prevents an unrelated empty screen from discarding valid saved tabs.

The own backend, active Electron JSON adapters, filesystem safeguards, visual components/CSS and Electron security settings are preserved. Server/web/mobile, AI, plugins and Go-store integration remain separate stages. Integration with the original checkout's unfinished changes remains pending in the draft PR.
