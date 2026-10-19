# Workspace 0.1.0 — Local desktop release

Part of [product and architecture issue #6](https://github.com/kornouhovas/workspace/issues/6). Scope: roadmap milestones M1–M4. This is a specification for planned behavior, not a report of implemented features.

Published specification: [GitHub #7](https://github.com/kornouhovas/workspace/issues/7), labeled `ready-for-agent`.

Owner-approved release extension: the [desktop experience specification](workspace-desktop-ux.md)
is an additional 0.1.0 acceptance requirement. It restores main's daily workflows
using Radix Primitives/Tailwind and bb-style settings, with one project area,
unique tabs, session recovery and the explicit simplifications recorded there.
This local amendment and the new spec await synchronization with GitHub #7/#42
under publication authorization; their preparation has not changed remote issue
dependencies or started implementation.

## Problem Statement

People organize real project folders on their computers but need richer ways to describe, find and review those projects than a directory tree provides. They need typed properties and saved Board/Table views without losing control of the underlying files. Different working contexts may need different views of the same projects, while their properties and folder interpretation remain consistent.

The previous Workspace provides useful property and view behavior, but its implementation and persistence are being replaced. The new application must preserve those user capabilities, make folder interpretation explicit, and handle moves, archives and unavailable folders without losing associated metadata. A documentation scaffold or a screen that looks complete is not a usable local release.

## Solution

Deliver a local desktop application for macOS and Windows. A user selects a project source, previews how its folders become projects, and creates one or more workspace configurations over that source. Each workspace has its own saved views; projects, property definitions and values belong to the source.

Initially support two discovery modes: immediate child folders as projects, or projects beneath one level of category folders. In the latter mode, a folder-backed Select represents category placement. Explicit category changes move folders; ordinary properties change metadata. Archiving moves a project beneath the source's chosen archive folder and preserves its properties and original relative location for restoration.

The release includes Board/Table views, all accepted property types, group-to-group dragging, English/Russian UI, durable local SQLite storage through Drizzle, and application-data backup and recovery. It starts with clean application data and uses selected bb architecture and UI foundations. Synchronization, AI, remote clients and the product website belong to later releases.

## User Stories

1. As a desktop user, I want to install and launch Workspace on macOS or Windows, so that I can manage projects on my own computer.
2. As a user, I want core workspace operations to work locally without an account or network service, so that my local workflow remains available offline.
3. As a user, I want to create a workspace automatically named Workspace by selecting a project source and rename it afterward, so that the application works with the folders I choose without requiring a name during creation.
4. As a user, I want to select, rename and reorder workspaces, so that I can organize my working contexts.
5. As a user, I want multiple workspaces over the same source, so that I can use different views without duplicating project properties.
6. As a user, I want a property edit to appear in other workspaces over the same source, so that all presentations describe the same project.
7. As a user, I want workspace views and display settings to remain independent, so that one working context does not rearrange another.
8. As a user, I want to remove a workspace configuration without deleting project folders, so that reorganizing the application does not destroy files.
9. As a user, I want workspaces and their settings to survive restart, so that I can resume my work.
10. As a user, I want to choose direct discovery of child folders as projects, so that a flat project directory works without artificial categories.
11. As a user, I want to choose grouped discovery one level beneath category folders, so that my existing folder organization becomes a folder-backed Select.
12. As a user, I want to preview discovered projects before applying a source configuration, so that I can verify the interpretation.
13. As a user, I want to exclude folders from discovery, so that unrelated folders do not appear as projects.
14. As a user, I want archive folders, service folders and symbolic links excluded from ordinary discovery, so that internal or indirect locations do not become accidental projects.
15. As a user, I want discovery to stop at each recognized project, so that its internal folders do not become nested projects.
16. As a user, I want to preview a discovery-mode change without moving files, so that I understand its effect before applying it.
17. As a user, I want metadata retained when a mode change stops recognizing a project, so that I can recover or reassociate that project.
18. As a user, I want source interpretation and archive location shared across its workspaces, so that the same folders have consistent meaning.
19. As a user, I want to create a project folder in the selected source, so that I can start a project from Workspace.
20. As a user in grouped mode, I want to choose a category when creating a project, so that its folder is placed in a valid location.
21. As a user, I want to rename a project and reveal its folder in the system file manager, so that application names and real folders stay connected.
22. As a user, I want invalid names and occupied destinations explained without overwriting files, so that failed operations leave my work safe.
23. As a user, I want application-driven moves and renames to preserve project identity and properties, so that organizing folders does not create unrelated project records.
24. As a user, I want unambiguous external folder moves and renames reconciled, so that file-manager changes do not unnecessarily disconnect metadata.
25. As a user, I want a missing or ambiguous folder to retain its project data and offer reassociation, so that I can restore the connection myself.
26. As a user, I want an unavailable root shown as an unavailable source, so that a disconnected drive is not interpreted as mass project deletion.
27. As a user, I want operations confined to the selected source and recoverable after failures, so that the application does not silently affect unrelated folders.
28. As a user, I want to rename the folder-backed Select's display label independently of folders, so that the category can represent my own terminology.
29. As a user, I want changing a folder-backed category to move the project to that category folder, so that metadata reflects actual placement.
30. As a user, I want the effect of renaming a category option shown before its folder is renamed, so that I understand the filesystem change.
31. As a user, I want to select a destination for projects before removing an occupied category, so that removing a category never implicitly deletes projects.
32. As a user, I want ordinary Select properties to remain independent of folder placement, so that I can categorize projects without moving them.
33. As a user, I want to choose an archive folder inside my source, so that archived projects remain within the managed root.
34. As a user, I want Archive to preserve a project's original relative path and properties, so that it can be restored meaningfully.
35. As a user, I want to switch between Active and Archived projects, so that completed work does not clutter active views but remains accessible.
36. As a user, I want to edit ordinary properties while a project is archived, so that I can maintain its metadata without restoring it.
37. As a user, I want the archived folder-backed category retained until restoration, so that its former placement is not confused with the archive folder.
38. As a user, I want Restore to return a project to its former location, so that it resumes its previous organization.
39. As a user, I want an explicit recovery choice when restoration finds an occupied path or missing parent, so that files are never overwritten or relocated by guesswork.
40. As a user, I want Text, Number, Date, Single Select and MultiSelect properties alongside project Name and applicable folder categorization, so that I can describe projects in useful ways.
41. As a user, I want to create, rename, order, hide and remove custom properties, so that the property set matches my workflow.
42. As a user, I want property types fixed after creation, so that existing values are not silently reinterpreted.
43. As a user, I want to edit typed project values and enter arithmetic for Number values, so that data entry is convenient and validated.
44. As a user, I want to create, rename, color, hide, reorder and delete Select options with existing usages handled explicitly, so that options remain useful without leaving broken values.
45. As a user, I want optional ordinary properties to support empty values, so that incomplete project information is represented honestly.
46. As a user, I want to create and activate Board and Table views, so that I can choose the presentation appropriate to my task.
47. As a user, I want to rename, reorder and delete views while retaining at least one, so that each workspace remains usable and organized.
48. As a user, I want to duplicate a view with independent settings, so that I can adjust a copy without changing the original.
49. As a user, I want to search by project name and save typed filters including empty-value conditions per view, so that I can focus on relevant projects.
50. As a user, I want to group Board and Table by supported properties or use no grouping, so that I can inspect projects from different perspectives.
51. As a user, I want default, ascending, descending and manual group ordering, so that groups appear in an intentional sequence.
52. As a user, I want to hide or collapse groups and hide empty groups, so that I can reduce visual clutter.
53. As a user, I want a MultiSelect project visible in each applicable group, so that all its memberships are represented without duplicating the project itself.
54. As a user, I want manual Table row order, property order, column widths and text wrapping, so that the table fits my work.
55. As a user, I want Board column order, visibility, width and content wrapping, so that the board fits my work.
56. As a user, I want view settings restored after restart, so that I do not repeatedly rebuild my presentation.
57. As a user, I want to drag projects between groups in both Board and Table for every supported property type, so that I can edit the grouping value directly.
58. As a user, I want dragging between ordinary Text, Number and Date groups to assign the exact destination value, so that the operation has a predictable result.
59. As a user, I want dragging an ordinary Single Select to its empty group to clear the value, so that I can remove a selection directly.
60. As a user, I want a MultiSelect drag to replace only the source membership and keep the others, so that moving one membership does not discard unrelated classifications.
61. As a user, I want dragging a MultiSelect project to the empty group to clear all options and dragging from empty to assign the target option, so that empty-group behavior is explicit.
62. As a user, I want dragging between Name groups to rename the real folder with normal validation, so that a Name change is not merely a display alias.
63. As a user, I want dragging between folder-backed Select groups to perform the same validated physical move as editing that property, so that different controls obey the same rules.
64. As a user, I want a failed drag to explain the failure and retain the actual state, so that the UI does not imply a move or edit succeeded when it did not.
65. As a user, I want English by default and Russian selectable in settings, so that I can use the interface in either supported language.
66. As a user, I want my language preference stored on this device without translating project names, property names or paths, so that authored data stays unchanged.
67. As a user, I want clear empty, loading, unavailable and error states with usable keyboard interactions, so that I can understand and operate the application beyond pointer dragging.
68. As a user, I want automatic backups of application data and a backup before schema migration, so that application updates and data failures have a recovery path.
69. As a user, I want to export and restore the new application-data format, so that I can intentionally recover properties, views and settings.
70. As a user, I want backup and restore clearly distinguished from project-file backup, so that I know which data I must protect separately.
71. As a user, I want installation, supported-environment and recovery instructions, so that I can operate and troubleshoot the local release.
72. As a user, I want identifiable versioned builds and understandable release notes, so that I know which application I am running and what changed.
73. As a maintainer, I want behavioral checks across the service, real persistence and isolated folders, so that refactoring does not weaken the product contract.
74. As a maintainer, I want each implemented capability traceable to GitHub requirements and verified execution work, so that an issue is not considered complete on appearance alone.
75. As a maintainer, I want copied bb modules to retain license notices and provenance, so that reuse remains attributable and maintainable.

## Implementation Decisions

### Release and adoption boundary

- Build on the fresh `new-workspace` foundation with Git history preserved. Begin with clean application data; do not import legacy application settings or metadata. Existing user project folders remain real external data and must not be reset as part of the rebuild.
- Target local Electron desktop on macOS and Windows. Core operations need no hosted account, external synchronization provider or AI service.
- Adopt selected bb modules deliberately. The UI reference is React, TypeScript, Vite, Tailwind, shadcn/Radix and Hugeicons, with React Router, TanStack Query, Jotai, drag-and-drop, virtualization and resizable-panel foundations where needed. The reference component-preview tool is Ladle. Exact compatible versions and module extractions are implementation choices; this is not a claim that dependencies are installed.
- Preserve required user capabilities rather than legacy JSON formats or a fixed property called Status. The configurable folder-backed Select carries the folder-placement meaning.

### Service and persistence boundaries

- Desktop owns the lifecycle of a separate local TypeScript backend process. The backend owns product rules, SQLite access and Drizzle migrations. The renderer remains thin and uses a typed application-service client through a narrow Electron preload boundary.
- Preserve renderer isolation: context isolation enabled, renderer Node integration disabled and sandboxing enabled. Renderer code has no direct filesystem or database access. Local transport must not inadvertently expose an unauthenticated service to other devices.
- The application service provides commands and queries for workspace/source configuration, discovery preview/application, project resolution and folder operations, properties/options/values, view settings/projections, and application settings/recovery. Change notifications update affected presentations, including sibling workspaces over the same source.
- Commands validate entity ownership, property types, source scope and destination state on the backend. Queries and command errors expose meaningful unavailable, validation, conflict and recovery states. UI completion is based on the actual command result; a transport or backend failure must not appear as a successful edit.
- Keep the working SQLite database in local application storage outside externally synchronized project folders. SQLite plus Drizzle replaces the earlier Go/any-store direction. No hidden-folder exchange store is introduced in this release.
- Model durable source, workspace, project, property-definition, property-value, Select-option, view and device-setting records with logical identifiers and explicit ownership. Exact physical tables, indexes, driver and database partitioning are selected during M1; they must preserve these domain scopes.
- Use versioned schema migrations from the initial new format onward. SQLite transactions protect application-data consistency; filesystem operations and database transactions have different failure boundaries and require explicit recovery design. Do not claim a filesystem rename and database commit are a single atomic transaction.
- Development and tests use separate disposable data locations. Starting a development build must not silently migrate or overwrite another installation's real application data.

### Ownership and workspace lifecycle

| Entity or setting | Scope and contract |
| --- | --- |
| Project source | One selected root; owns discovery mode, project records, property definitions/values and archive location |
| Workspace | References one source; owns its saved view set and presentation settings |
| Project | Logical record associated with a real folder; identifier remains distinct from path and native filesystem identity |
| View | Belongs to one workspace; owns filtering, grouping, ordering, visibility and layout configuration |
| Language preference | Device-local; English default/fallback and Russian selectable |

- Several workspace configurations may reference the same source. Do not deduplicate away the user's requested workspace merely because its root is already used. Resolve it to the shared source with a distinct workspace configuration.
- Shared-source property or folder changes must be reflected in every referencing workspace. Changing a view in one workspace must not change another workspace's view settings.
- Removing a workspace removes its configuration, not project files. Do not interpret removing the last workspace as authorization to delete external folders or silently discard retained project metadata.

### Discovery and folder identity

- Direct mode recognizes immediate child directories as projects. Grouped mode recognizes one level of category directories and their immediate child directories as projects. Discovery stops at a project; arbitrary recursive interpretation is excluded.
- Preview discovery before applying configuration and allow manual folder exclusions. Exclude the designated archive, hidden service folders and symbolic links from normal discovery. Preview and execution use the same source-bound interpretation rules.
- Mode changes show affected folders and projects before application. They do not move files. Metadata for a project no longer recognized remains available for explicit removal or reassociation rather than being silently deleted.
- Associate logical project records with local folders using paths and native filesystem identity. Do not write permanent project-ID marker files in project folders. Filesystem IDs are evidence local to a filesystem, not portable or permanently unique project IDs.
- Preserve logical identity through application-driven rename, category move, archive and restore. Reconcile external changes only when evidence is unambiguous; never attach old properties to a copied or replaced folder solely because its path or a reused native ID matches.
- Missing or ambiguous folders retain project records and properties and expose manual reassociation. An unavailable whole root exposes source unavailability. Neither situation triggers automatic metadata deletion.
- The filesystem adapter verifies containment in the selected source and rechecks current source/destination conditions before mutation. Traversal, symbolic-link escapes, stale paths and collisions cannot authorize an operation outside that boundary.

### Folder-backed Select and native operations

- Grouped mode has a required folder-backed category for every active project, including newly created ones. There is no empty category destination. Direct mode has no folder-backed Select; ordinary nullable Select properties are available in both modes.
- Renaming the property display label does not rename folders. Renaming a category option renames the corresponding folder after showing the effect. Changing a project's category, including by drag, explicitly moves its folder.
- Removing an occupied folder-backed option requires an explicit destination for the affected projects. It never implies project deletion. Define the multi-project failure/recovery behavior before implementing this operation.
- Initially support create project folder, rename, reveal in the native file manager, category move, archive and restore. In-app deletion of project files is excluded.
- Reject invalid names, occupied destinations and out-of-source operations with useful errors. Do not silently overwrite files, choose replacement names or assume filesystem case behavior is the same on all supported platforms.
- File-operation outcomes, partial failures and interrupted operations must be observable and recoverable without losing project metadata. Details such as operation journaling, reconciliation scheduling and platform adapters are implementation choices to validate at the service boundary.

### Archive and restoration

- Archive is a separate project state, not a Select option. The archive destination is a selected folder within the source and is excluded from active discovery.
- Archive preserves the original relative path beneath the archive folder. A project formerly beneath a category retains that category segment beneath the archive; a direct-mode project retains its direct relative location.
- Retain project identity, ordinary values and original placement. Active/Archived switching exposes the appropriate projects. Archived ordinary properties remain editable; the folder-backed category retains its pre-archive value and cannot be changed until restoration.
- Restore targets the original location. If the path is occupied or a required parent is missing, request an explicit recovery choice and do not overwrite. Archive-time collisions also require a defined non-overwriting outcome before the archive implementation is accepted.
- Selecting/changing the archive location, handling mixed-depth roots and coordinating archived records with later mode changes need bounded implementation contracts consistent with these invariants; the spec does not authorize automatic bulk relocation.

### Properties, views and dragging

- Preserve Name, folder categorization where applicable, Text, Number, Date, Single Select and MultiSelect. Custom property types are immutable after creation. Definitions support rename/order/removal; presentation supports hide/show and visible order. Values are validated by type, and Number input supports arithmetic expressions.
- Select options support create, rename, color, hide, reorder and delete. Define usage handling before deletion; do not leave dangling references or silently convert a metadata option operation into a folder operation.
- Views support Board/Table, creation, activation, rename, reordering, independent duplication and deletion while retaining at least one. Duplication copies settings rather than sharing mutable configuration with the original.
- Preserve project-name search and per-view typed filters including empty values. Preserve grouping by supported properties or none; default/ascending/descending/manual group order; hidden, collapsed and hidden-empty groups. A MultiSelect project can appear in several groups while remaining one project.
- Preserve Table manual row ordering, visible-property ordering, column widths and Text wrapping. Preserve Board column ordering, visibility, width and content wrapping. Persist settings across restart in their owning view/workspace.
- Group-to-group dragging changes the grouping property in both Board and Table for every supported property type. This is an intentional extension of the previous product. Distinguish changing a value from reordering groups or Table rows.

| Grouping property | Successful drop result |
| --- | --- |
| Ordinary Text, Number or Date | Assign the exact destination value; no range or calendar-bucket inference |
| Ordinary Single Select | Assign destination option; the empty destination clears it |
| MultiSelect | Replace source option with target while retaining other options; A+B from A to C becomes B+C; keep set semantics if C was already selected |
| MultiSelect empty destination | Clear all options; moving from empty to C assigns C |
| Name | Rename the real project folder to the destination group name; reject invalid names or occupied same-parent destinations; no empty-name destination |
| Folder-backed Select | Perform the validated physical category move; no empty destination in grouped mode; archived category is fixed |

- Ordinary property edits and drops do not move project folders. Name and folder-backed Select use the same filesystem commands as their explicit editing controls.
- A failed drop preserves the actual value/location and explains the failure. Filtered/sorted projections must reflect the resulting data rather than leaving a fabricated success state. Define the detailed interaction feedback and remaining empty-value validation in the relevant implementation slice.

### Localization, recovery and release preparation

- English is the default and fallback UI language; Russian is selectable in settings. Persist the device-local preference. Translate application UI, not user-authored workspace/project/property/option names or filesystem paths.
- Provide clear empty, loading, validation, unavailable and recovery states. Include keyboard and accessible interaction acceptance in UI work; pointer dragging alone is not sufficient for basic editing and navigation.
- Provide automatic application-data backups, a backup before schema migration, and manual export/restore of the new format. Preserve workspace/source configuration, project metadata, properties, views and settings needed to recover the application state.
- Application-data backup does not back up project-file contents. Restore must make that distinction clear, validate its input and protect the current application data if restoration fails. Missing project folders remain subject to normal reassociation rather than being recreated from metadata.
- Select and document backup schedule, retention, destination, consistent SQLite snapshot method and restore/recovery mechanics before accepting backup implementation. Do not promise these as already implemented.
- Use SemVer with the first target version 0.1.0, English release notes with an Unreleased section and immutable release tags. Establish one canonical product version and checks that build/package versions agree. The future app/site changelog surfaces use the same release-note source; a website is not required here.
- Provide tested installable macOS and Windows artifacts, supported-environment documentation, and installation/recovery guidance. Minimum OS versions, CPU architectures, signing, distribution and update strategy must be selected before release acceptance.
- Preserve applicable bb copyright/license notices and record provenance for copied modules. Describe Workspace as inspired by bb's code and ideas; attribution prose alone does not replace notices required for copied code. The inspected reference revision is f135a001e72942cee9118d2693208ec0725e2f18.

## Testing Decisions

### Primary test seam

The user confirmed the typed Workspace application-service API as the primary behavioral test boundary, backed by a real temporary SQLite database and isolated real filesystem fixtures. Exercise commands and queries as a client would, and reopen the service against the same fixture data to verify persistence. This follows the existing service-client concept without preserving old transport or JSON implementation details.

Use a small additional set of renderer interaction, Electron IPC/security and packaged-installation checks for behavior the service seam cannot prove. Actual macOS and Windows runs are required for platform acceptance; mocks or one operating system cannot demonstrate both.

Good tests assert observable returned state, errors, persisted state and filesystem outcomes. They do not freeze internal function calls, SQL layout, component internals or exact documentation wording. Use deterministic injected failures where needed to exercise recovery, while still checking real database and folder state. Never use live user projects as destructive test fixtures.

### Acceptance matrix

| Area | Required observable scenarios |
| --- | --- |
| Foundation and lifecycle | Launch a packaged development app on each target platform; create/reopen an empty workspace; persist settings; show backend failures without false success |
| Renderer boundary | Verify typed preload access, renderer isolation and absence of direct Node/filesystem/database access; reject malformed or out-of-scope commands at the backend |
| Ownership | Two workspaces over one root share project values and source interpretation but have independent views; unrelated roots remain isolated; workspace removal preserves files and retained metadata |
| Discovery | Direct/grouped fixtures produce previewed projects; exclusions, archive/service directories, symlinks and nested project content are handled as specified; mode changes move no files and retain unmatched metadata |
| Identity | App-driven rename/move/archive/restore retains the same logical project after restart; unambiguous external changes reconcile; ambiguous/copy/replacement cases retain data for reassociation; unavailable root is not mass deletion |
| Native operations | Create, rename, reveal and category changes route through the intended boundary; invalid names, collisions, permissions and escaping paths fail usefully; interruption/restart exposes a recoverable state without silent overwrite |
| Folder-backed Select | Required category in grouped mode; absent in direct mode; property-label rename leaves folders alone; option rename previews filesystem effect; occupied-option removal requires destination and preserves projects |
| Archive | Archive mirrors original relative placement and preserves values/identity; active discovery excludes it; ordinary archived values editable, category fixed; occupied/missing-parent restore never overwrites or guesses |
| Properties | Every accepted type validates and persists values; Number arithmetic input; immutable definition type; option operations with usages; custom property deletion and view-reference cleanup follow their explicit slice contract |
| View lifecycle | Both view types support all lifecycle actions; final view cannot be removed; duplicate settings are independent; source edits appear consistently without leaking presentation changes |
| Projection and layout | Name search, typed/empty filters, exact-value grouping, MultiSelect memberships, all accepted ordering/visibility/wrapping/width settings and persistence after restart |
| Drag semantics | Run the full assignment table in Board and Table; include MultiSelect A+B to B+C, target already selected, empty transitions, Name collision, invalid/empty category and failed-command feedback |
| Localization/accessibility | Switch EN/RU and restart; fallback works; authored text and paths unchanged; key workflows are keyboard operable; empty/loading/error states and narrow layouts remain usable |
| Backup and migration | New-format reopen/upgrade; automatic and pre-migration backups; export/restore round trip; invalid or interrupted restore protects existing data; missing project files are not claimed to be restored |
| Release | Real installations on supported macOS/Windows targets; package/version consistency; agreed scale/performance scenarios; notices/provenance and installation/recovery instructions verified |
| Desktop experience extension | Complete the linked UX matrix: sidebar/views, unique project tabs, one preview/expanded project area, files, bb-style settings, editor/navigation rules and backed-up sessions; verify both sizes/languages/themes and renew scale checks on the integrated UI |

### Prior art and verification reporting

- The preserved implementation has a typed service-client test boundary and IPC tests. Its filesystem tests use temporary roots and exercise category moves, project rename/create, restart, collisions and containment. Reuse their scenario ideas and fixture discipline rather than importing the old JSON architecture or fixed Status model.
- Existing view-duplication, grouping, property, row-order, width and wrapping tests provide useful behavior examples. Reconcile them with new ownership and all-type drag decisions; historical tests are evidence about the baseline, not authority over this spec.
- Introduce type checking, builds and targeted CI with the scaffold. Each capability requires evidence matching its boundary; a visible control or a passing unit test alone does not satisfy end-to-end acceptance.
- Record the scenario, platform and actual result when closing implementation work. At specification time, this branch contains documentation/tool configuration only; none of the new application acceptance checks has run yet.

## Out of Scope

- Shared-folder metadata exchange, external provider synchronization integration, multiwriter merge/conflict resolution and portable cross-device project identity. Synchronizing the live SQLite database is not a supported substitute.
- Private/shared-view collaboration and Internet-public views. The local release has workspace-owned local views, not participant accounts or sharing permissions.
- AI providers, API keys, project chats, Codex execution and agent permissions. Parallel-agent isolation and result application remain explicitly deferred to AI implementation design; no default shared-directory or worktree policy is selected here.
- Remote hosting, owner-device enrollment, browser/mobile clients, remote file access, authentication and offline command replay. A separate local backend is not itself a remote-access feature.
- Product website, domain, public downloads site and site publication automation. Release metadata foundations are included; public publication is a separate action.
- Linux support, multi-root aggregation within one workspace, arbitrary recursive folder interpretation and additional discovery modes.
- Legacy application-data import, in-app project-file deletion, project-content backups, range/date-bucket grouping and changing custom property types after creation.
- A complete historical audit/undo system: this is not an inherited guarantee from the old runtime. Required operation recovery and application-data backups remain in scope.
- Copying the whole bb application or its chat/terminal/mobile feature set. Only justified foundations and modules are adopted.

## Further Notes

### Milestones and completion

| Milestone | Deliverable and exit criteria |
| --- | --- |
| M1 — Application and persistence foundation | Desktop shell, typed service boundary, separate backend, SQLite/Drizzle migrations, service validation/errors/notifications, EN/RU settings, bb-based UI/component preview, CI and data-isolation/recovery design. A packaged development app on both targets creates/reopens an empty workspace with persisted settings and verified renderer/backend boundary. |
| M2 — Sources and safe folder operations | Discovery previews/modes/exclusions, multiple workspaces over a root, identity/reassociation, folder-backed Select, create/rename/reveal, archive/restore and failure recovery. Accepted scenarios preserve identity/metadata across restart and stay within the selected source. |
| M3 — Properties and views | Complete typed properties/options and view lifecycle; Board/Table filtering/grouping/layout, all-type drag and accessible feedback. Every preservation-baseline capability has an observable acceptance scenario, including shared-source ownership and persistence. M3 domain work depends on M1; filesystem-backed behavior also depends on M2. |
| M4 — Local release 0.1.0 | Installable target-platform builds, selected distribution/signing approach, scale checks, EN/RU verification, new-format migrations/backups/export/restore, version/release-note checks, notices and user guidance. Both platforms pass the acceptance matrix. Creating a release tag or publishing artifacts requires release authorization. |

The specification defines the release outcome; it does not authorize treating M1–M4 as one unbounded implementation run. Break work into measurable GitHub issues before implementation, with dependencies and acceptance criteria. GitHub is the sole tracker for execution checkpoints and dependencies; archived Beads IDs retain provenance only. Ralphex may execute a reviewed bounded plan only when explicitly selected or continuing an already authorized run under [executor selection](../development.md#executor-selection). Writing this spec does not run Ralphex or implement the application.

### Refinements required before dependent work

These are explicit implementation-design gates, not additional accepted product features. Resolve consequential alternatives in their bounded issues; continue independent work in the meantime.

| Gate | Decisions to settle |
| --- | --- |
| M1 persistence/process contracts | SQLite driver/partitioning, initial schema and typed contracts, local transport/lifecycle, migration and consistent-backup mechanics, development-data isolation |
| M2 discovery/identity | Canonical source matching, external move/copy/replacement and native-ID reuse rules, filesystem case differences, watcher/reconciliation strategy, mixed-depth folders and reassociation validation |
| M2 category/archive commands | Option creation and empty categories, external category renames, occupied-option operation recovery, archive selection/default and collisions, changed-mode/archived-record interactions, explicit restore recovery choices |
| M3 data/interaction detail | Property/option deletion usages and view cleanup, exact filter/operator validation, remaining empty-drop rules, filtered/sorted-drop feedback, keyboard and accessibility behavior |
| M4 recovery/distribution | Backup schedule/retention/destination, supported OS versions/architectures, signing/install/update strategy, representative scale and performance targets, release/support/privacy guidance |

No quantitative performance target, backup retention period, package version or minimum OS version has been agreed merely by writing this specification. The corresponding implementation/release issue must make its acceptance measurable before it is considered ready to complete.

### Traceability and maintenance

- Derived from the accepted product interview, Product preservation baseline, decision ledger D01–D32, roadmap M1–M4, architecture and glossary. Later decisions D33–D41 inform exclusions rather than local-release requirements.
- Respects accepted ADRs: SQLite and Drizzle; separation of local database from future folder exchange; separate local backend; local folder identity without permanent markers.
- The GitHub specification issue owns tracked release requirements/status. This document is its versioned source snapshot; requirement revisions must update both deliberately rather than creating an independent backlog.
- Keep documentation, issues, plans, commits and release notes in English. Product discussion with the owner remains in Russian.
- Issue #6 remains the parent product/architecture context. Publication of this specification does not mean either the release or the first implementation slice is complete.
