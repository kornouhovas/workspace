# Electron Workspace sources, lifecycle and filesystem contracts

These are implemented internal operations behind WorkspaceServiceClient → renderer transport → workspace:request preload IPC → Electron dispatcher. They define no public HTTP routes and do not connect Go storage. Current adapters/namespaces follow [ADR-006](../adr/006-workspace-source-bindings.md) and the [scope table](../data-model.md#current-runtime-and-target-scope).

Implementation: [dispatcher](../../electron/workspaceIpc.js), [client](../../src/workspaceServiceClient.js), [backend](../../src/workspaceBackend.js), [local open](../../src/localOpen.js). IDs are opaque; item paths are source-relative locators. This contract includes current compatibility limits; it does not promise unimplemented validation, atomicity or security remediation.

Names below are WorkspaceServiceClient methods; their IPC method names use the `workspace.<method>` prefix.

## Request targeting and errors

Payloads are objects; non-object payloads normalize to an empty object. Optional workspaceId defaults to the active nondeleted Workspace, then the first listed Workspace. Filesystem callers should pass their captured Workspace ID so later activation cannot redirect a read. Explicit unknown/deleted targets reject with WORKSPACE_NOT_FOUND.

Success returns the result directly. Failures are service exceptions with message and, when provided, code/field. Common dispatcher codes:

- VALIDATION_FAILED: unsupported method, missing required string or invalid role/order.
- WORKSPACE_NOT_FOUND: absent/deleted target or failed source ownership check.
- SOURCE_FOLDER_MISSING: no root envelope resolves.
- SOURCE_FOLDER_UNAVAILABLE: resolved path is unavailable/not a directory; an unbound Workspace's empty locator also reaches this guard for source-dependent methods.
- LAST_WORKSPACE_DELETE_BLOCKED: removing the final live Workspace.
- WORKSPACE_STORAGE_CORRUPT: current JSON adapter cannot parse storage.

Backend failures without a code currently map to VALIDATION_FAILED with their message. Missing items, unsupported preview formats and unsupported reveal platforms therefore lack distinct transport codes. Raw filesystem/storage exceptions may escape too. Improving/sanitizing this boundary is separate implementation work; current errors are not a stable public web API.

## Workspace lifecycle

A list item is `{ id, name, order }`, not a complete source/document. Default views and properties have [views](workspace-views.md) and [properties](workspace-properties.md) contracts.

| Method/input | Success | Behavior and limits |
| --- | --- | --- |
| listWorkspaces({}) | `{ activeWorkspaceId, workspaces }` | Nondeleted records across bindings, ordered by adapter. Missing remembered selection falls back to first or null. No available source required. |
| createWorkspace({ name?, workspaceId? }) | `{ activeWorkspaceId, workspace }` | Persists Workspace/default Board and Table views and activates it. Optional workspaceId identifies the source to inherit; ordinary omission uses current binding. Blank name defaults to Workspace. Works without selected/available source. Empty sourceFolderId/locator stays valid until selection. |
| setActiveWorkspace({ workspaceId }) | `{ activeWorkspaceId }` | Persists an existing nondeleted target. Unavailable/unbound source is allowed for Settings recovery. Retains bindings, views and session metadata. |
| updateWorkspace({ workspaceId, patch: { name? } }) | `{ workspace }` | Saves trimmed nonblank name; blank/missing retains old name, other patch fields are ignored. Current dispatcher requires target source availability. |
| reorderWorkspaces({ orderedWorkspaceIds }) | `{ workspaces }` | Saves all live ranks as 10, 20, … . Trims string IDs and filters nonstrings before validating every live ID exactly once; unknown/duplicate/incomplete normalized order rejects. Resolved active source availability still required. |
| deleteWorkspace({ workspaceId }) | `{ activeWorkspaceId, deletedWorkspaceId }` | Soft-deletes target record; last live Workspace is protected. Active deletion selects first remaining item. Requires available target source today. Does not remove project folders, shared property data/history or retained view/session bytes. |

Lifecycle saves several adapter/settings records sequentially. Serialization is not a multi-record transaction; failures can leave partial updates. Preserve explicit recovery/error handling rather than treating documentation changes as atomicity fixes.

## Source binding

### getRoot

getRoot({ workspaceId? }) returns null when no Workspace/root resolves, otherwise `{ root: { id, workspaceId, rootPath, path, name } }`. Configured rootPath/path are native absolute locators; name is the source basename. An unbound Workspace returns its own id/name with empty paths. An unavailable configured path remains visible for Settings recovery. Envelope presence is not availability; hashes cannot reconstruct lost source paths.

### setRoot

setRoot({ workspaceId? }) captures the target before opening the native picker. Cancel returns null without a source change. A chosen source must be a readable directory; failure retains its predecessor. First selection with no Workspace creates the initial one. Success returns the root envelope.

Only the captured binding changes. Workspace/view IDs, sibling sources, previous-root roles and source-scoped values/history remain. Returning to an earlier root recovers retained data. No project files move and metadata adapters do not switch. A target deleted while the picker waits cannot acquire a new binding.

### updateFolderRole

updateFolderRole({ workspaceId?, path, role }) saves the selected binding's role snapshot and returns `{ path, role, folderRules }`. path is the relative Settings key; role accepts group/status/project, with legacy card normalized to project in the response. The current handler checks a nonempty key and supported role and writes metadata; this is not a confined filesystem mutation or folder rename permission. Discovery owns role interpretation.

## Discovery and project lookup

| Method | Success | Contract |
| --- | --- | --- |
| scan({ workspaceId?, rules?, includeCardChildren? }) | `{ root, tree, folders, workspace }` | Uses bound source/saved roles unless explicit rules are supplied. includeCardChildren includes project-child traversal. workspace is the source-scoped object projection, not a Workspace list item; retain selected Workspace identity independently. |
| getProject({ workspaceId?, projectId }) | `{ project }` or `{ project: null }` | Fresh discovery/source-scoped properties, independent of view/search filters. No-longer-discovered ID returns null; unavailable source rejects. Explicit-move aliases are verified before adopting identity. |

File trees load separately through listProjectFileTree. Creation and moves use the [creation](workspace-views.md#board-column-actions-workspace-rei) and [Status recovery](workspace-status-move.md) contracts. Arbitrary project rename is an original-checkout change set, absent from this branch's implemented methods.

## Filesystem reads and local opening

These methods require an available resolved source. Existing path resolution rejects absolute item paths, traversal and detected symlink escape; it is not an atomic snapshot or lock on external writers. Preview extension acceptance is not a complete active-content security policy.

| Method | Success | Details |
| --- | --- | --- |
| listEntries({ workspaceId?, path? }) | `{ entries }` | Empty path lists source. Direct visible entries expose id/name/kind (directory/file)/source-relative path. Missing/non-directory target rejects. |
| listProjectFileTree({ workspaceId?, path }) | `{ path, fileTree }` | Nonempty existing directory required. Recursive visible nodes contain id/name/kind (folder/file)/relativePath/available, plus children for folders. Refresh rather than persist as authoritative session data. |
| previewFile({ workspaceId?, path }) | `{ filePath, contentType }` | Existing file and current extension allowlist required. IPC returns a native absolute filePath, not bytes, stream or public download URL. No web-viewer feature is implied. |
| reveal({ workspaceId?, path, kind }) | `{ ok: true }` | kind directory/file must match item. Current implementation invokes macOS open; other platforms reject. Name does not promise Finder selection or equivalent OS behavior. |

Legacy saveProperty/listPropertyValues remain compatibility surfaces. New custom-value editing uses [updateProjectPropertyValue/listProperties](workspace-properties.md). Current saveProperty validates locator/property key and returns an old folder-property envelope; it is not a working alias for the new write operation.

## Queue and renderer adoption

Picker waits occur outside the mutation queue. Current dispatcher source migration/recovery and request handling share the queue, including get/list/scan/preview/reveal reads. Those reads wait for and occupy the serialized path; do not describe them as independent nonblocking scans. Concurrent duplicate Status requests for one project reject before queue admission.

The barrier prevents partial move-location publication and recovers before normal handling; it does not make all lifecycle/value-history saves transactional. UI adoption follows the [activation flow](../flows/board-table-views.md#board-and-table-visual-refinement-workspace-zlj) and [ADR-011](../adr/011-renderer-session-lifecycle.md): capture Workspace/view/project identity, retain outgoing confirmed surface, ignore superseded responses and adopt ready destination projection/preview together. Missing projects, storage failure and closed preview cannot reopen stale content. Web transport/authentication/sanitization require a separate specification.
