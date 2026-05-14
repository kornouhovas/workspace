# ADR-002: Electron Preload IPC Bridge For Workspace UI

## Status

Accepted

Date: 2026-05-15

## Context

Workspace Project Board runs as an Electron desktop app. The current Electron window is configured with:

- `contextIsolation: true`;
- `nodeIntegration: false`;
- `sandbox: true`.

These settings are correct for the product because React UI must not access Node filesystem APIs, local storage internals, or sidecar HTTP routes directly.

The backend and local-storage slice has been implemented around service methods and local backend modules:

- `WorkspaceServiceClient` exposes UI-facing operations;
- workspace backend modules own filesystem safety, validation, view projection, and product rules;
- the Go sidecar owns durable `any-store` persistence;
- sidecar HTTP routes are local implementation details, not public UI contracts.

The renderer now needs to become the actual Workspace Project Board UI. Without an explicit runtime bridge, React has no safe way to call workspace service methods from the sandboxed renderer.

## Decision

Use an Electron preload IPC bridge as the runtime boundary between React UI and local workspace services.

The bridge exposes a narrow API on `window.workspace`:

```ts
window.workspace.request(method, payload)
```

React UI must call workspace service methods through `WorkspaceServiceClient` and a renderer transport that delegates to `window.workspace.request`.

The main process owns the privileged side of the bridge:

- validate the service method name;
- dispatch to workspace backend or sidecar-backed service handlers;
- return JSON-shaped responses or structured errors;
- keep filesystem, sidecar, and Node APIs outside React.

The preload script owns only safe IPC exposure:

- no product rules;
- no filesystem traversal;
- no storage access;
- no sidecar HTTP calls;
- no arbitrary IPC channel exposure.

## Service Boundary

Allowed direction:

```text
React components
  -> WorkspaceServiceClient
    -> renderer IPC transport
      -> window.workspace.request(method, payload)
        -> Electron main service dispatcher
          -> workspace backend and sidecar clients
```

Forbidden direction:

```text
React components
  -> node:fs / node:path
  -> workspaceBackend.js direct imports
  -> workspaceSidecarClient.js direct sidecar HTTP calls
  -> any-store / SQLite
```

## Alternatives Considered

### Option A: Enable Node Integration In Renderer

Pros:

- fastest to wire during prototyping;
- React can call backend modules directly.

Cons:

- violates the existing Electron security posture;
- lets UI import filesystem and storage code;
- makes architecture reviews harder;
- increases blast radius of renderer bugs.

Rejected.

### Option B: React Calls Sidecar HTTP Directly

Pros:

- avoids IPC wiring for storage-backed methods;
- reuses sidecar routes.

Cons:

- violates `docs/api/workspace-views.md`, where sidecar routes are local implementation details;
- leaks storage transport concerns into UI;
- bypasses backend/domain rules for operations that combine filesystem scan, view projection, and persistence.

Rejected.

### Option C: Preload IPC Bridge With Service Dispatcher

Pros:

- preserves Electron security settings;
- keeps React thin and service-oriented;
- keeps backend and storage rules outside UI components;
- allows the main process to manage sidecar lifecycle later;
- provides one testable runtime boundary for frontend integration.

Cons:

- requires a preload script and main-process dispatcher;
- introduces IPC error-shape handling;
- packaged sidecar lifecycle remains a future follow-up.

Accepted.

## Consequences

Positive:

- Frontend can be implemented without weakening Electron security.
- UI remains aligned with `WorkspaceServiceClient` and documented service contracts.
- Backend modules stay testable without React.
- Sidecar routes remain internal implementation details.
- Future packaged sidecar lifecycle can be added behind the same bridge.

Negative / trade-offs:

- Frontend work must include IPC tests and renderer bridge type declarations.
- The main process gains service-dispatch responsibility.
- IPC error mapping must stay consistent with workspace service errors.
- Long-running operations such as scans need loading and error states in UI.

## Implementation Rules

- `preload` must expose only the workspace request API.
- Renderer code must not import Node builtins.
- Renderer code must not import `src/workspaceBackend.js`.
- Renderer code must not import or call `src/workspaceSidecarClient.js` directly.
- Public method names must match docs under `docs/api/`.
- New IPC channels require docs and tests.
- New sidecar lifecycle behavior requires a future ADR before release packaging.

## Follow-up Actions

- Add a preload script and renderer type declaration.
- Add an Electron main service dispatcher for workspace methods.
- Add a renderer transport for `WorkspaceServiceClient`.
- Replace the dashboard template UI with Workspace Project Board surfaces.
- Add tests that enforce renderer import boundaries.
- Diagnose and fix current `npm run typecheck` and `npm run build:renderer` timeouts before accepting frontend implementation.
