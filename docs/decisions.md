# Decision ledger

This ledger records the product interview. Accepted choices are separate from proposed implementations. The roadmap remains provisional where its prerequisites are open.

Design tracking: [GitHub #6](https://github.com/kornouhovas/workspace/issues/6). Foundation execution step: `workspace-ty8`; continuing local-release design step: `workspace-1n8` in the shared Beads store.

## Accepted

| ID | Decision |
| --- | --- |
| D01 | Rebuild on `new-workspace` in the same repository, preserving Git history. Replace the working tree and write fresh documentation; retain the previous implementation on its prior branch. |
| D02 | Start with clean application data; no legacy import is required. Existing external user data remains untouched. |
| D03 | Use SQLite and Drizzle for structured data; selectively adapt bb architecture/modules and its UI foundations. |
| D04 | First release is local desktop with preserved view/property capabilities, new folder configuration and EN/RU; shared-folder collaboration, AI and remote hosting follow. |
| D05 | GitHub Issues owns requirements/status; Beads owns linked execution steps and dependencies. Ralphex can plan and execute bounded implementation work. |
| D06 | Write documentation, issues, plans and commits in English; communicate with the user in Russian. English is the default product language, with Russian selectable in settings. |
| D07 | Multiple workspace configurations may use the same selected root. |
| D08 | Initially support direct projects and projects grouped one level beneath Select-value folders. Expand folder interpretation modes later. |
| D09 | The folder-backed Select's display name can be renamed independently of folder names. |
| D10 | Archive moves a project into an archive folder within its source, preserves properties and supports restore; archive is distinct from a Select value. |
| D11 | Use SemVer, target 0.1.0 first, maintain English CHANGELOG.md with Unreleased and immutable release tags vX.Y.Z. Future site/app consume the same changelog. |
| D12 | First-release platforms are macOS and Windows; Linux follows later. |
| D13 | Collaboration uses shared properties plus private/shared views; a shared view is not an Internet-public link. |
| D14 | Keep a local working database; exchange logical changes/snapshots through an opt-in hidden folder delivered externally. Support independent writers, merge compatible edits and retain conflict alternatives. |
| D15 | Remote hosting is a separate later mode in which a user's computer serves other devices. Its initial ownership/client scope follows D35/D38; the first AI stage follows D33-D37. |
| D16 | Workspaces over the same root share projects, property definitions/values, discovery mode and archive location. Each workspace owns its view set and presentation settings. |
| D17 | Initially each workspace selects one root. Aggregating multiple roots in one workspace follows later. |
| D18 | Folder-backed Select changes explicitly move projects; renaming an option renames its folder after showing the effect. Deleting an occupied option requires a project destination and never implicitly deletes the projects. Ordinary Select edits metadata only. |
| D19 | Archive preserves the original relative path and restores to the former location. Occupied paths or missing parents require an explicit recovery choice; restoration never overwrites silently. |
| D20 | A separate local TypeScript backend process owns SQLite and product policy. Desktop starts it and presents the React UI. Remote exposure is a later opt-in authenticated capability. |
| D21 | Source discovery mode can change after a preview of affected folders. Changing mode does not move files; metadata for projects no longer discovered is retained until explicit removal or reassociation. |
| D22 | Discovery includes a preview and manual folder exclusions. The archive, hidden service folders and symbolic links are excluded from normal discovery; scanning stops at a discovered project rather than discovering nested projects. |
| D23 | Initial filesystem commands are create project folder, rename, reveal in the system file manager, move through folder-backed Select, archive and restore. Removing a workspace removes its configuration only. Project-file deletion remains a system file manager operation initially. |
| D24 | An Active / Archived switch exposes archived projects. Ordinary properties remain editable there; the folder-backed category retains its pre-archive value and becomes editable after restoration. |
| D25 | The local release associates project records with folders using paths and native filesystem IDs, without permanent project-ID marker files in project folders. Cross-computer identity remains a separate sharing-protocol decision. |
| D26 | Ambiguous or missing folder matches retain the project and properties and offer manual reassociation. An unavailable root is shown as source unavailability. Neither case automatically deletes metadata. |
| D27 | Grouped discovery requires a folder-backed category for every active project, including at creation; its value cannot be cleared. Direct discovery has no folder-backed Select. Ordinary Select properties may be empty in either mode. |
| D28 | Board and Table support changing grouping-property values through group-to-group dragging for all property types. This extends the previous product's behavior; folder-backed Select dragging represents a physical move. Existing Number/Text/Date groups use exact values, which provide the destination assignment. Name behavior follows D32. |
| D29 | Dragging an ordinary Single Select into its empty-value group clears that property. Folder-backed Select has no empty destination in grouped discovery because its category is required. |
| D30 | The local release includes automatic application-data backups, a backup before schema migrations, and manual export/restore of the new format. These cover properties, views and settings; project-file backups remain the user's separate responsibility. |
| D31 | MultiSelect dragging replaces the source option with the destination while preserving other options: A+B dragged from A to C becomes B+C. Dropping into the empty group clears all options; dragging from empty to C sets C. |
| D32 | Name-group dragging renames the project folder to the destination group's name. Invalid names and occupied destinations in the same parent are rejected with an explanation; an empty-name destination is unavailable. |
| D33 | The first AI stage provides personal project-scoped chats with agent execution on the user's own computer. Shared chats and remote-host execution are separate later capabilities. |
| D34 | Initially integrate Codex with API-key authentication. Other providers and subscription-based login are outside the initial AI scope. |
| D35 | Initial phone access uses a responsive browser client connected to the host computer; a native mobile application follows only if needed. |
| D36 | AI offers Discussion without file changes and Work on project with project-scoped reading, editing and commands. Routine edits in the latter do not require per-file confirmation; expanded access and operations requiring additional permissions are confirmed separately. |
| D37 | Multiple personal chats and concurrent editing agents in the same project are required in the first AI stage. A one-editing-run-per-project queue is not sufficient. Working-file isolation and result integration remain open. |
| D38 | Initial remote access is for the owner using their other devices. Multi-user invitations and separate user rights follow later; external shared-folder collaboration remains a separate mode. |
| D39 | The first mobile browser client supports views/properties, chats with agent execution on the connected host, and project-file viewing/downloading. A full mobile file editor follows later. |
| D40 | Remote operation requires a connected host. When disconnected, show connection loss and do not accumulate changes or commands for automatic replay. Reconnect and reload current state when the host returns. |
| D41 | The user explicitly deferred Q46's parallel-agent working-file policy until AI implementation design. Shared directories, Git worktrees and non-Git copies remain alternatives; none is the selected default. Resolve this before implementing concurrent editing, without blocking the earlier local release. |

## Open design branches

| ID | Question and prerequisite |
| --- | --- |
| O01 | Resolved by D16: source owns shared data/discovery/archive; workspace owns views and presentation. Detailed shared-view membership remains in O10. |
| O02 | Resolved by D17: one source per workspace initially. |
| O03 | D21 settles previewed mode changes without automatic file moves or metadata deletion. Detailed reassociation behavior depends on O06. |
| O04 | D18/D22/D27 settle bidirectional folder-backed Select, required grouped categories and discovery exclusions. Define option creation details, external renames, move collisions, empty folders and mixed-depth projects. |
| O05 | D19/D24 settle relative archive paths, explicit restore recovery and archived editing. Define archive folder selection/default and archive-time collisions. |
| O06 | D25/D26 settle local path/filesystem-ID matching without permanent project markers and non-destructive recovery. Define matching details for external moves, copied/replaced folders, reused IDs and case differences; portable replica identity remains in O11. |
| O07 | D27-D29/D31/D32 settle required folder categories, all-type drag changes in Board/Table, Single Select empty destinations, MultiSelect assignment and Name renames. Specify validation and filtered/sorted-view feedback. Range/date-bucket grouping is not in the preserved baseline. |
| O08 | D23 settles initial native folder actions and excludes in-app project-file deletion. Define command details and keyboard/accessibility acceptance. |
| O09 | D20/D30 settle the separate backend process and application-data backup scope. Choose transport/lifecycle, database partitioning/driver, migration/backup/recovery mechanics, watcher strategy and performance targets. |
| O10 | Define local ownership and storage of private views and preferences; distinguish workspace configuration from shared-source metadata. |
| O11 | Before shared-folder implementation: choose merge protocol, device/participant identity, bootstrap/disable flows, deletion handling, snapshots/GC, offline behavior and project-file conflict boundaries. |
| O12 | D33/D34/D36/D37 settle personal project chats, local Codex/API-key execution, two permission modes and parallel agents. Per D41, defer working-file isolation/result integration to M6 implementation design. Also define exact tool/network permissions, cancellation/recovery and credential lifecycle before their implementation. |
| O13 | D35/D38-D40 settle owner-only remote access, initial browser features and connected-only operation without an offline mutation queue. Define device authentication, encryption, revocation and reconciliation of runs/commands already accepted before a disconnect. |
| O14 | Before distribution: choose supported OS versions/architectures, signing, installer/update strategy, privacy/support policy and release automation. |
| O15 | Before website: settle product name/domain, downloads, changelog rendering/localization and publication workflow. Repository visibility remains private unless explicitly changed. |
| O16 | Decide when to turn roadmap milestones into GitHub issues and linked Beads steps; reconcile existing tasks without silently importing the legacy backlog. |

## Decision tree

Source/workspace ownership → folder interpretation and identity → folder-backed Select commands and archive recovery → schema/service contracts → preserved UI behavior → first local release.

The local model then supports three later branches: shared-folder metadata exchange; AI context and execution; remotely hosted service access. These branches require their own product contracts and failure scenarios before implementation. Versioning, attribution, localization and task tracking apply throughout.

## Implemented T08 matching and observation

D25/D26 now have the bounded local implementation described in [architecture](architecture.md#implemented-external-reconciliation-and-observation): Refresh, nonrecursive root/category notification hints and startup rescans match only uniquely evidenced stored active associations under the unchanged verified source. The lossless dev/ino/positive birthtime tuple, repeated complete scans, exact case spelling, current/historical conflict checks and atomic category-before-project mappings are operational checks, not proof of permanent uniqueness. Cross-volume/copy/replacement/ambiguous or insufficient evidence retains metadata for recovery; persisted retained states are not automatically repaired.

A needed-category exception creates only genuinely new eligible categories required by accepted known-project moves, sharing one UUID per destination within the locator transaction. It creates no project ID and does not enroll unrelated children, other new categories or empty new categories. Existing conflicting/unavailable category associations remain explicit recovery cases. Discovery Apply, configured mode/exclusions/archive, exact Text/labels and independent revisions/views keep their existing ownership.

Notification degradation is visible in EN/RU with explicit Refresh. A current-status read handles late renderer mount and backend restart; it does not replay mutations. Final-reference removal/service close releases watchers and timers without deleting source data. Whole-source relocation/merge, configured mode switching, filesystem editing, portable cross-computer identity and sharing remain separate scope. This resolves the local external-change portion of O06 and O04; it does not settle their remaining product questions or platform acceptance. See [T08 acceptance evidence](verification/issue-15-external-reconciliation.md).
