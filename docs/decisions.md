# Decision ledger

This ledger records the product interview. Accepted choices are separate from proposed implementations. The roadmap remains provisional where its prerequisites are open.

Design tracking: [GitHub #6](https://github.com/kornouhovas/workspace/issues/6). Archived execution IDs: foundation `workspace-ty8`, local-release design `workspace-1n8`. Current tracking follows [GitHub-only policy](issue-tracker.md); retained IDs are historical correlation.

## Accepted

| ID | Decision |
| --- | --- |
| D01 | Rebuild on `new-workspace` in the same repository, preserving Git history. Replace the working tree and write fresh documentation; retain the previous implementation on its prior branch. |
| D02 | Start with clean application data; no legacy import is required. Existing external user data remains untouched. |
| D03 | Use SQLite and Drizzle for structured data; selectively adapt bb architecture/modules and its UI foundations. |
| D04 | First release is local desktop with preserved view/property capabilities, new folder configuration and EN/RU; shared-folder collaboration, AI and remote hosting follow. |
| D05 | Updated by the owner on 2026-10-12: GitHub Issues is the sole tracker for requirements, dependencies, checkpoints and completion. Use Matt Pocock by default; a new Ralphex run requires explicit selection under [development](development.md#executor-selection). This supersedes the former Beads execution policy while retaining archived history. |
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

## Desktop UX interview decisions

Accepted after D41:

| ID | Decision |
| --- | --- |
| D42 | Restore main's desktop working cycle on new-workspace: navigation, saved-view/project tabs, project preview, file tree, session restoration and appearance choice. D50 explicitly replaces main's split panels. Detailed behavior is resolved in the [desktop UX spec](specs/workspace-desktop-ux.md). |
| D43 | Main supplies working scenarios and principal layout; Radix UI and Tailwind CSS with bb's visual language supply the component foundation. Preserve new-workspace's domain and safety contracts. See [ADR 0008](adr/0008-desktop-experience-reference-authority.md). |
| D44 | Desktop UX acceptance is required for the first local 0.1.0 release. Keep a separate linked spec and implementation slices; final integration acceptance must include the new UI. Performance issue 41 may proceed independently, with renewed measurements on the finished UI. |
| D45 | Use bb's settings organization as the reference. Q4 accepts General, Appearance, Workspaces, Sources, Backup and recovery, and About; sidebar/contextual entry and return to the prior work area; per-preference saving and explicit review/application for consequential operations. Everyday Archive/Restore remains in the work area. |
| D46 | Show a real project file tree; external default-app opening works on macOS and Windows and is distinct from Reveal. Embedded content viewers/editors are outside the desktop UX spec. |
| D47 | Retain the workspace session per device/workspace and include it in application-data backups. Reload current project data and verify availability when resuming or restoring. |
| D48 | Preserve open project tabs across verified moves, archive, exclusion, missing projects and unavailable sources; display actual state and applicable recovery/editing actions. |
| D49 | Provide keyboard/menu alternatives for tab ordering, opening the project area, resizing allowed boundaries and returning from expanded mode, with explicit focus and acceptance coverage. D50 excludes arbitrary panel placement and splitting. |
| D50 | Display only one project in the right-hand project area, with an option to expand it into the work area. Exclude nested splits and any division inside the project. Session/layout commands must preserve this simpler model; D51–D53 settle its tabs and transitions. |
| D51 | Retain multiple project tabs per workspace but show only the selected project, with at most one tab per project. Reopening reuses that tab; duplicate-project tabs are excluded. |
| D52 | Open from Board/Table in the single right-hand area; another selection replaces its content. Expand replaces the view and retains sidebar navigation. Return-right restores the view beside the project; Close removes the project and returns from expanded mode to Board/Table. Preserve view filters, grouping and scroll; an empty right-hand area occupies no space. |
| D53 | Support pointer/keyboard resizing and persistence of sidebar/project-area widths. Expanded mode uses the work area; return-right restores the prior project width. |
| D54 | Use compact ordinary-property editors consistently in Table, Board and project details. Text commits on Cmd/Ctrl+Enter or blur, with Enter for newline; Number/manual Date commit on Enter or blur. Escape cancels uncommitted drafts. Calendar/Single Select choices and each MultiSelect toggle commit immediately; dismissing menus does not undo them. |
| D55 | Before switching project/workspace or closing a project area, save valid uncommitted input. Invalid drafts or failed saves retain the editor and block the transition until correction or explicit cancellation. Preserve pending/revision/ownership protections. |
| D56 | Keep Number expression input with result-only persistence. Reopening `10 + 5` after commit shows `15`; persisting the source expression is outside this UX spec. |
| D57 | Minimum desktop window is 1024x720; also require visual acceptance at 1440x960 for Board, Table, project preview/expanded and settings in EN/RU and light/dark. Work areas scroll independently inside the viewport-bound shell. |
| D58 | A row/card click requests a right-hand preview. Expand creates or activates the unique project tab. Return-right removes that project's tab and leaves its preview; other tabs remain. Closing a preview does not close retained tabs. |
| D59 | Automatically name a new workspace Workspace (owner-confirmed spelling), with rename after creation. Choose a folder first; reuse configured sources immediately, or offer discovery preview/exclusions/Apply and Set up later for an unconfigured source. Deferring setup preserves the already-created workspace. |
| D60 | Place project creation in view actions and applicable rename/move/archive/restore/Reveal in contextual project menus. Use compact dialogs for required consequence review and contextual status with Details/Recover for interrupted operations or unavailable sources; display actual outcomes. |
| D61 | On 2026-10-19 the owner confirmed kornouhovas/workspace is public, authorized publishing the desktop UX specification and approved U01–U20 breakdown, and replaced the application-repository private-only rule. Normal publication within an authorized task no longer requires a repeated visibility confirmation. Other repositories, private data and release permissions retain their existing boundaries. |

## Desktop UX correction decisions

Accepted on 2026-10-20; applied after completion of the independently owned #52:

| ID | Decision |
| --- | --- |
| D62 | Main defines interface composition and daily work with sidebars, tabs, views and workspaces. bb defines typography, component styling and the common visual language. Preserve D50–D58's deliberate exceptions. |
| D63 | Establish a coherent principal interface as the next delivery milestone, including explicit corrections to completed surfaces and reference-based visual acceptance, before remaining behavioral refinements. Green functional tests do not establish visual fidelity. |
| D64 | For subsequent UI work, require appearance evidence and affected-behavior checks per issue. Run broad platform/installer acceptance at agreed integration milestones or when the relevant boundary changes. Preserve data-safety coverage, report failures and retain evidence provenance. Do not retrospectively change #52's acceptance gates. |
| D65 | For the owner's “undo/redo as in main” request, preserve main's actual Back/Forward navigation: visited workspaces/settings, current-run history, end-of-history disabled states and localized hints. Inspection of current remote main confirms this is not Undo/Redo of saved mutations. Keep navigation, Cancel/Escape and persisted workspace sessions distinct; do not infer a new mutation-reversal feature from the label. |

## Folder-role correction

The owner-confirmed correction in [#74](https://github.com/kornouhovas/workspace/issues/74)
extends D08/D21/D27: workspace settings configure shared group/status/project roles
and exclusions; discovery stops at projects and uses the nearest status ancestor.
No-status projects are valid. Explicit descendant overrides survive parent edits.
The Sources navigation entry moves into the selected workspace detail; independent
views, reviewed impact and metadata retention remain required. This is the accepted
product contract; its delivery status belongs to the issue checkpoint.

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
| O15 | Before website: settle product name/domain, downloads, changelog rendering/localization and publication workflow. The application repository is public under D61; a separate future website repository remains private unless explicitly changed. |
| O16 | For future roadmap milestones, decide when to publish scoped GitHub issues; reconcile archived tasks through [the retirement checkpoint](beads-retirement.md) without silently importing legacy scope. The local-release tickets are already published; Beads is retired. |

## Decision tree

Source/workspace ownership → folder interpretation and identity → folder-backed Select commands and archive recovery → schema/service contracts → preserved UI behavior → first local release.

The local model then supports three later branches: shared-folder metadata exchange; AI context and execution; remotely hosted service access. These branches require their own product contracts and failure scenarios before implementation. Versioning, attribution, localization and task tracking apply throughout.

## Implemented T08 matching and observation

D25/D26 now have the bounded local implementation described in [architecture](architecture.md#implemented-external-reconciliation-and-observation): Refresh, nonrecursive root/category notification hints and startup rescans match only uniquely evidenced stored active associations under the unchanged verified source. The lossless dev/ino/positive birthtime tuple, repeated complete scans, exact case spelling, current/historical conflict checks and atomic category-before-project mappings are operational checks, not proof of permanent uniqueness. Cross-volume/copy/replacement/ambiguous or insufficient evidence retains metadata for recovery; persisted retained states are not automatically repaired.

A needed-category exception creates only genuinely new eligible categories required by accepted known-project moves, sharing one UUID per destination within the locator transaction. It creates no project ID and does not enroll unrelated children, other new categories or empty new categories. Existing conflicting/unavailable category associations remain explicit recovery cases. Discovery Apply, configured mode/exclusions/archive, exact Text/labels and independent revisions/views keep their existing ownership.

Notification degradation is visible in EN/RU with explicit Refresh. Windows holds native watches only on source roots and checks eligible grouped sources through complete validated scans every five seconds; macOS retains root/category watches. This bounded platform choice avoids nested handles during external parent moves and does not rely on category timestamps. A current-status read handles late renderer mount and backend restart; it does not replay mutations. Final-reference removal/service close releases watchers and timers without deleting source data. Whole-source relocation/merge, further filesystem editing, portable cross-computer identity and sharing remain separate scope. This resolves the local external-change portion of O06 and O04; it does not settle their remaining product questions or platform acceptance. See [T08 acceptance evidence](verification/issue-15-external-reconciliation.md).


## Implemented T09 mode-change contract

D16/D21/D25/D26/D27 now have a metadata-only configured-source mode switch through reviewed preview/Apply. Project effects distinguish new targets, continuous associations, no-longer-recognized projects and already-retained metadata. Cancel persists nothing; Apply changes configuration and associations atomically, preserving files, IDs, exact Text, settings, archive designation and workspace-owned views. Mode is shared by source siblings and survives restart and source reuse.

Migration 0007 preserves project/category history with a separate mode_inactive flag and replaces the original configured-mode/direct-history prohibitions. Dormant projects remain editable and require explicit reviewed target-depth reassociation; previous-mode return and automatic observation never reactivate them. Historical reservations prevent duplicate enrollment, and a project/category role change never transfers project values. Dormant categories may resume only through grouped Apply with previously active/excluded state and unchanged same-path/native/root evidence; unresolved, missing, replaced or conflicting history keeps existing recovery restrictions.

Authored exclusions retain their exact one/two-component paths. Two-component exclusions are inactive in direct mode rather than parent-expanded; one-component exclusions apply literally with their target role disclosed in preview. Category-property identity, label/revision and hidden label drafts survive direct mode while the active property is absent. Discovery/Text/label revisions stay independent, including delayed sibling results.

These bounded choices resolve the implemented mode-round-trip portion of O03 and O06; whole-source relocation/merge, archive commands, physical category editing, portable identity and release/platform acceptance remain separate. See [architecture](architecture.md#implemented-configured-discovery-mode-changes) and [T09 evidence](verification/issue-16-discovery-mode.md).

## Implemented T10 creation and Reveal contract

D23/D25/D26/D27 now have project creation in configured direct sources and existing active grouped categories, explicit durable recovery and ID-only native Reveal. Category creation, project rename/moves, archive/restore and deletion remain separate work. [ADR 0006](adr/0006-recoverable-project-creation.md) records the focused journal, four process-interruption boundaries, reserved UUID and explicit recovery decisions. It chooses the supported Node adapter with documented ancestor/substitution TOCTOU windows rather than claiming atomic confinement or rollback. Power-loss durability across SQLite/filesystem is not established.

Only unfinished operations add destination reservations; completed history and original receipt retries remain immutable while actual project/history policy supplies current reservations. A lost creation response keeps the exact original request for explicit same-ID retry; reconnect and status/list reads never replay it. Reveal reauthorizes current policy/evidence through the private backend/main route. macOS uses Electron shell.showItemInFolder, including directory packages; Windows uses a bounded fixed-resource ready-view adapter with one parent Open and one SelectItem after fresh authorization and synchronous identity validation at its sole permit. Dispatched acknowledges completion of the native adapter, while observed Finder/Explorer selected items and normal Electron shutdown are separate evidence. The Windows script route uses a session-only application-code Bypass option without persistent settings or enforced Group Policy override; actual Windows desktop policy controls and exact-code product acceptance remain unverified. No additional bb code or native dependency was adopted. [T10 verification](verification/issue-17-create-reveal.md) separates local evidence, conservative immediate-Reveal feedback watchpoint and coordinator target-OS acceptance; #44 remains an independent release prerequisite. These command details implement the bounded creation/Reveal portion of O08; actual target-OS acceptance remains open alongside its remaining folder actions.


## Implemented T15 archive contract

For issue #22, the owner confirmed explicit default `Archive` designation, safe source-contained alternatives, and empty-only designation changes without bulk relocation. Restore retains its original path and mode: collisions require removing the conflict or explicitly selecting another basename under the original parent; a missing parent requires explicit creation; an incompatible discovery mode requires returning to the original mode. These choices refine D19/D24 and the archive-selection portion of O05. See [architecture](architecture.md#implemented-source-archive-and-restore) and [verification](verification/issue-22-archive-restore.md) for implementation boundaries and pending platform acceptance.

## Issue 38 backup policy

The owner approved a startup due check plus a 24-hour running timer, retaining the
seven latest verified automatic snapshots beside local application data. Separate
verified pre-migration snapshots are protected from automatic cleanup (including after
success). Older-schema recovery uses the matching app version and existing explicit
restore; see [recovery](recovery.md#automatic-backups-and-updates). For this issue the
owner explicitly authorized normal publication to the currently public repository.


## Issue 70 durable folder evidence

On 2026-10-23 the owner accepted [ADR 0009](adr/0009-durable-folder-evidence.md): durable volume/folder evidence is separate from current-mount authorization; legacy and scope-unverified associations need explicit review; staged backend capability gates protect filesystem consumers. The accepted design preserves retained metadata and immutable operation history, including the documented availability limits for insufficient evidence and unprovable unfinished journals. This is a design decision, not an implemented storage change or authorization to repair live data. The [handoff plan](plans/issue-70-durable-identity.md) assigns implementation and verification to #71/#72.
