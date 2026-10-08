# Product direction

## Purpose and release boundary

Workspace organizes real project folders and makes them usable through views and typed properties. Later, the same project context can support collaboration and AI-assisted work.

The first target, 0.1.0, is a complete local desktop release for macOS and Windows. It includes the preserved view/property capabilities, new folder configuration, archive/restore and English/Russian localization. Linux, shared-folder collaboration, AI and remotely hosted access follow later. Development starts with clean application data; legacy data import is not required. Existing user folders and the previous application's data are not erased by that decision.

## Workspaces and folders

- Users can create multiple saved workspaces, including different workspaces over the same selected root.
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

The old product's `Status` represented folder placement. The new configurable folder-backed Select replaces that fixed assumption. The new product also adds value changes when dragging between ordinary Select groups; those changes affect metadata, while folder-backed Select changes move folders. Layout/type coverage, MultiSelect and empty destinations still need explicit interaction contracts. Full historical change tracking and transactional cascades were not guaranteed by the previous JSON runtime and must not be described as preserved implemented guarantees.

## Later collaboration and AI

Properties are shared within the collaborative dataset; views can be private or shared. Shared means available to folder participants, not an Internet-public URL. Trusted folder access is the initial sharing boundary. Exact identity and ownership scopes remain to be designed.

External providers deliver the shared folder while Workspace merges logical metadata changes. A fresh computer must be able to reconstruct shared properties and shared views. Concurrent same-field conflicts retain alternatives and offer nonblocking review. Project-file conflicts need a separate contract; metadata merging alone does not resolve file contents.

A later mode lets a computer host the application service for other computers and mobile clients. AI work uses workspace/project file context; chat ownership, execution location, providers, credentials and write permissions are still open product choices.
