# ADR 005: bb pane chrome as renderer session state

Status: Accepted for workspace-1wx implementation.
Date: 2026-09-28.

The standalone right Navigation/launcher and active-project close selection are superseded by [ADR 012](012-project-close-and-preview-only-right-host.md). Other pane/session decisions remain accepted.

## Context

The requested interface is bb 0.44.0 over Workspace data and functions. The active Electron runtime uses WorkspaceServiceClient/preload IPC with transitional JSON adapters; the Go sidecar remains a separate target store. Importing bb's plugin, chat, terminal or Git backend would change the product and storage architecture.

## Decision

Implement pane chrome and tab transitions as a pure UI module (`workspacePaneLayout.js`) with validated renderer session storage keyed by opaque Workspace IDs. This state contains tab references, visibility, widths and split ratios; it contains no filesystem paths, project values or durable product metadata. Project snapshots keep the existing session reader/writer. React composes the working Board/Table, Project Detail and Settings with these presentation hosts.

Use Inter Variable and Hugeicons stroke-rounded glyphs at the versions used by the reference. Their packages are presentation-only. Native traffic-light placement follows bb; contextIsolation, sandbox and nodeIntegration remain unchanged.

File rows call the existing `workspace.reveal` method through WorkspaceServiceClient. Its backend path/kind/existence/symlink validation remains authoritative. No new IPC contract or storage path is introduced.

## Consequences

Layout is local UI state; malformed or unavailable session storage does not block startup. Split projects are normal content tabs, so restarting can restore the existing project snapshot and then refresh its file tree. Validated pane focus and maximization restore with the tree. Closed-tab history is transient. Fixed Workspace Navigation and a deduplicated empty launcher supply useful actions without introducing bb-only controls.

Visual fidelity still requires the reference matrix and runtime comparisons. The pure reducer tests establish transition semantics, not pixel acceptance. The centre layout is an ordered n-ary tree with horizontal or vertical branches and project-tab identities as leaves. Its eight-pane limit, equal sizing after insertion/removal, pair resize bounds and close-collapse behavior follow bb source operations. Moving an existing pane to an edge removes its former leaf; dropping on a centre swaps leaves. Open-in-split focuses content already present. No IDE backend is introduced.

Workspace and Settings share the fixed primary host. If that host was closed or replaced, navigating to either surface replaces the current surviving content host with Workspace instead of discarding the entire tree. Other leaves and fractions survive. This is a product adaptation to Workspace's global settings/view functions; direct bb content-navigation equivalence remains unverified.
