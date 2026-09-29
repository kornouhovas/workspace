# Electron Workspace source and session operations

These operations use the existing `workspace:request` preload channel and WorkspaceServiceClient. They are internal Electron service contracts; no sidecar routes change.

- `workspace.getRoot({ workspaceId? })`: returns the selected Workspace’s stored root envelope, or the active Workspace’s root when omitted. A configured unavailable path is still returned so Settings can show and replace it; filesystem reads report availability errors without deleting metadata.
- `workspace.setRoot({ workspaceId? })`: captures the target before opening the native picker, validates the selected directory and updates only its binding. Omission targets the active Workspace; first selection creates the initial Workspace. Returns its root envelope. Cancellation returns `null` and performs no source change.
- `workspace.scan`, `workspace.listProjectFileTree`, `workspace.updateFolderRole`, and other filesystem/data operations accept `workspaceId` to resolve the source independently of subsequent activation. Existing omission defaults to the active Workspace.
- `workspace.getProject({ workspaceId, projectId })`: returns `{ project }` with current discovered properties, independent of view/search/value filters; returns `{ project: null }` when that ID is no longer discovered. File tree loading uses `workspace.listProjectFileTree`.
- `workspace.listWorkspaces` lists saved nondeleted Workspaces across source bindings. Activation preserves the source mapping and succeeds even if the selected directory is currently unavailable, allowing Settings recovery.

Paths are backend-validated against the resolved source. IDs remain opaque references. Settings mutations are serialized; picker waits and filesystem scans do not hold that queue. Renderer code ignores superseded loads and applies ready source/view/property/preview snapshots together.

- `workspace.createWorkspace({ name? })` works without a configured or available source. It persists a Workspace and its default Board/Table views. With no source, the binding has an empty locator; `getRoot` returns its Workspace envelope with empty path, allowing a targeted picker. Creating alongside a configured Workspace retains the existing shared-root default. Selecting a source later preserves Workspace and view IDs.
