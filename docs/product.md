# Product direction

## Purpose and release boundary

Workspace organizes real project folders and makes them usable through views and typed properties. Later, the same project context can support collaboration and AI-assisted work.

The first target, 0.1.0, is a complete local desktop release for macOS and Windows. It includes the preserved view/property capabilities, new folder configuration, archive/restore and English/Russian localization. Linux, shared-folder collaboration, AI and remotely hosted access follow later. Development starts with clean application data; legacy data import is not required. Existing user folders and the previous application's data are not erased by that decision.

## Workspaces and folders

The [desktop experience specification](specs/workspace-desktop-ux.md) defines an
additional 0.1.0 requirement: main's working journeys with Radix/Tailwind and bb's
visual language/settings organization. It specifies one project area with
expanded mode, unique project tabs, session backup/restoration and consistent
contextual editors. Nested splits and duplicate tabs for one project are
explicitly excluded. This is accepted product direction, not a claim that the
current runtime already implements the UI.

- Users can create multiple saved workspaces, including different workspaces over the same selected root. The desktop UX creates each with the automatic name Workspace and permits renaming afterward.
- Each workspace selects one root initially; multi-root aggregation follows later. Workspaces over the same root share projects, property definitions/values, discovery mode and archive location; their view sets and presentation settings are independent.
- Initially, folder interpretation has two modes: `Root/Project` and `Root/Select value/Project`. Additional modes may be introduced later.
- Users can change the source's discovery mode after reviewing which folders become or cease to be projects. The change does not move files; metadata for no-longer-discovered projects remains until explicit removal or reassociation.
- Discovery shows a preview, supports manual exclusions, and excludes the archive, hidden service folders and symbolic links from normal discovery. Scanning stops at a discovered project; nested projects are not discovered initially.
- In grouped mode, the intermediate folder supplies a folder-backed Select value. The property itself can be renamed independently of folders.
- Every active project in grouped mode has a folder-backed category: creation requires one and its value cannot be cleared. Direct mode has no folder-backed Select. Ordinary Select properties may be created and left empty in either mode.
- Editing the folder-backed Select explicitly moves a project; renaming an option renames its corresponding folder after showing the effect. Deleting an occupied option requires choosing where its projects go and never deletes them implicitly. Ordinary Select properties only change metadata.
- Archive is a separate project state. Archiving moves the folder into a designated archive folder inside its source; properties survive and restoration is supported.
- Archive preserves the original relative path: `Client/Project` becomes `Archive/Client/Project`. Restore returns to the previous location. An occupied path or missing parent requires a user decision; no silent overwrite occurs.
- An `Active / Archived` switch exposes archived projects. Ordinary properties remain editable in the archive; the folder-backed category retains its pre-archive value until restoration.
- Initial filesystem commands create a project folder, rename it, reveal it in the system file manager, move it through the folder-backed Select, archive it and restore it. Removing a workspace removes only its configuration; project-file deletion remains in the system file manager initially.
- Local folder tracking uses paths and system identifiers without adding permanent project-ID files inside project folders. If matching is ambiguous or a folder is missing, retain project metadata and offer to locate the folder. If the entire root is unavailable, show source unavailability without deleting project metadata.
- Remaining identity, discovery edge cases and collision behavior is tracked in [decisions](decisions.md).

## Capability preservation baseline

The following is a feature checklist derived from the previous product, not a commitment to retain its code or JSON formats. Entries describe the required user capabilities; folder-related semantics must be reconciled with the new model before implementation.

| Area | Capabilities to preserve |
| --- | --- |
| Workspaces | Create, select, rename, reorder and remove a saved configuration without deleting project folders |
| Working environment | Sidebar, saved-view/project tabs, one right-hand project area with expansion, real file tree/external opening, session restoration and Light/Dark/System; detailed behavior and intentional main exceptions follow the desktop UX spec |
| Views | Board and Table; create, activate, rename, reorder, duplicate and delete; retain at least one view; independent settings on duplication |
| Property types | Project name, the folder-derived categorization capability, Text, Number, Date, Single Select and MultiSelect |
| Property definitions | Rename, hide/show, order and delete custom properties; preserve the existing restriction against changing a property's type after creation unless explicitly redesigned |
| Values and options | Edit project values; arithmetic entry for Number; create/rename/color/hide/reorder/delete Select options with defined handling of existing usages |
| Filtering | Project-name search; per-view typed filters, including empty values |
| Grouping | Board/Table grouping by supported properties or no grouping; default, ascending, descending and manual group order; hide/collapse/hide-empty; membership in multiple MultiSelect groups |
| Table layout | Manual row order, visible property order, column widths and text wrapping |
| Board layout | Column order, visibility and width; content wrapping |
| Filesystem actions | Create/rename/reveal a project folder, explicit folder-backed category moves, archive/restore and source-bound safety; deleting a workspace does not delete project files |
| Localization | English default/fallback, English/Russian setting, device-local preference; user names and paths remain unchanged |

The old product's `Status` represented folder placement. The new configurable folder-backed Select replaces that fixed assumption. Board and Table now require value changes through dragging between groups for all property types. Ordinary property changes affect metadata; folder-backed Select changes move folders. Dragging Single Select into its empty-value group clears it, while folder-backed Select has no empty destination.

Number, Text and Date retain exact-value grouping from the previous product; dropping into a group assigns its corresponding value. Range and calendar-bucket grouping are not part of that baseline. For MultiSelect, a drop replaces the source option with the target and preserves all other options: A+B dragged from A to C becomes B+C. Dropping into the empty group clears the entire selection; moving from empty to C assigns C.

Dragging between Name groups renames the project folder to the destination group's name. Invalid names or names already occupied in the same parent cause rejection with an explanation. Empty names are unavailable as destinations. This command must use the filesystem rename boundary rather than only changing a display label.

Full historical change tracking and transactional cascades were not guaranteed by the previous JSON runtime and must not be described as preserved implemented guarantees.

## Application-data recovery

The local release includes automatic backups of application data, a backup before schema migrations, and manual export/restoration of the new data format. The scope includes properties, views, settings and the device/workspace session specified in the desktop UX spec. Session restoration reloads current project data and validates folder availability. Users back up project files separately; restoring metadata must not be presented as restoring missing project files. The implemented backup policy is recorded in [recovery](recovery.md#automatic-backups-and-updates); adding session coverage requires its own migration and recovery verification.

## Later collaboration and AI

Properties are shared within the collaborative dataset; views can be private or shared. Shared means available to folder participants, not an Internet-public URL. Trusted folder access is the initial sharing boundary. Exact identity and ownership scopes remain to be designed.

External providers deliver the shared folder while Workspace merges logical metadata changes. A fresh computer must be able to reconstruct shared properties and shared views. Concurrent same-field conflicts retain alternatives and offer nonblocking review. Project-file conflicts need a separate contract; metadata merging alone does not resolve file contents.

A later mode lets a computer host the application service for its owner's other devices. Phone access starts with a responsive browser interface for views/properties, chats with host-side agent execution, and viewing/downloading project files. A full mobile file editor, a native mobile client and invitations for other users come later.

Remote operations require a connected host. When disconnected, the client shows connection loss and does not accumulate changes or commands for automatic replay. It reconnects and reloads current state when the host returns. Recovery of commands already accepted by the host must distinguish their actual state from unsent commands.

The first AI stage provides personal project-scoped chats using Codex with an API key. Agent processes and project commands run on the user's own computer; model processing uses the provider API. Shared chats, other providers, subscription login and execution on a separate remote host are later capabilities.

AI offers two modes: Discussion does not change files; Work on project can read/edit project files and run commands. Routine edits in Work on project do not require approval for each file. Expanded access and operations needing additional permissions require separate confirmation; exact enforcement/tool/network policies must be specified before implementation.

Multiple personal chats and parallel editing agents within the same project are required. Their working-file isolation, conflict handling and result-application workflow remain open; neither serialized runs nor unrestricted concurrent writes should be silently assumed.
