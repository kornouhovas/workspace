<!-- workspace-desktop-ux:spec -->

## Problem Statement

The new local runtime preserves substantial domain and filesystem functionality,
but its management-form interface does not provide main's daily desktop working
experience. Users need contextual project work, saved views, predictable editing,
project navigation and usable settings before the first local 0.1.0 release.

## Solution

Restore main's journeys on the new runtime with Radix Primitives and Tailwind CSS,
using bb's visual language and settings organization. Display one project area,
beside the view or expanded, while retaining source ownership, project identity,
operation recovery and renderer isolation.

## User Stories

1. As a desktop user, I want to open a saved workspace into a full-window Table or Board, so that I can work with my projects immediately.
2. As a desktop user, I want to create a workspace from a folder picker with the automatic name Workspace, so that I can start without entering a name.
3. As a desktop user, I want to rename, reorder and remove workspace configurations, so that I can organize navigation without deleting project folders.
4. As a desktop user, I want to reuse a configured source in another workspace, so that I can retain shared data and separate view settings.
5. As a desktop user, I want to preview direct/grouped discovery and exclusions before Apply, so that I can understand the effect on projects.
6. As a desktop user, I want to postpone source setup and return later, so that I can retain my saved workspace.
7. As a desktop user, I want to navigate through the sidebar, saved views and Back/Forward, so that I can return to previous working context.
8. As a desktop user, I want to create, duplicate, rename, reorder and remove saved views, so that I can keep independent presentations and at least one view.
9. As a desktop user, I want to search project names and save typed/empty-value filters, so that I can find relevant projects.
10. As a desktop user, I want to group and order by supported properties, so that I can use exact values and correct MultiSelect membership.
11. As a desktop user, I want to configure Table rows, columns, widths, visibility and wrapping, so that I can adapt each view to my work.
12. As a desktop user, I want to configure Board columns, widths, visibility and wrapping, so that I can adapt cards and groups to my work.
13. As a desktop user, I want to open a row or card as one right-hand preview, so that I can inspect a project alongside the view.
14. As a desktop user, I want to edit a row or card without opening its preview, so that I can change values without unexpected navigation.
15. As a desktop user, I want to expand a preview while keeping the sidebar, so that I can focus on one project.
16. As a desktop user, I want to retain multiple project tabs with at most one per project, so that I can switch projects without duplicates or splits.
17. As a desktop user, I want to return an expanded project to the right and remove its tab, so that I can resume the prior view while keeping other tabs.
18. As a desktop user, I want to close a preview without closing retained tabs, so that I can reclaim view width.
19. As a desktop user, I want to reorder, close and reopen project tabs with pointer or keyboard, so that I can manage my session accessibly.
20. As a desktop user, I want to resize the sidebar and project area with pointer or keyboard, so that I can keep controls usable at my window size.
21. As a desktop user, I want to resume my device/workspace session after restart, so that I can recover tabs, active content and allowed area sizes.
22. As a desktop user, I want to retain tabs for missing, excluded, archived or unavailable-source projects, so that I can understand their state and recover safely.
23. As a desktop user, I want to see verified moves update the same project identity, so that I can retain its values and open context.
24. As a desktop user, I want to edit multiline Text, arithmetic Number and manual/calendar Date consistently, so that I can commit or cancel drafts predictably.
25. As a desktop user, I want to choose Single Select and MultiSelect values with immediate save feedback, so that I can retain each accepted choice.
26. As a desktop user, I want to keep invalid or save-failed drafts when navigation is attempted, so that I can correct or cancel without losing work.
27. As a desktop user, I want to manage properties/options with the correct source/workspace/view scope, so that I can avoid changing unrelated presentation.
28. As a desktop user, I want to review affected projects and views before metadata removal, so that I can understand the intended cleanup.
29. As a desktop user, I want to assign groups by drag or an accessible equivalent, so that I can change the correct value or folder location.
30. As a desktop user, I want to browse real project files and Open them in the default external application, so that I can work with content on macOS and Windows.
31. As a desktop user, I want to use a distinct Reveal action in Finder or Explorer, so that I can locate an item without confusing Reveal with Open.
32. As a desktop user, I want to create, rename, move, archive and restore through contextual controls, so that I can perform daily actions in the work area.
33. As a desktop user, I want to review filesystem consequences and uncertain outcomes, so that I can recover without overwrites or blind command replay.
34. As a desktop user, I want to open categorized settings and return to my workspace, so that I can configure the app while retaining working context.
35. As a desktop user, I want to change English/Russian and Light/Dark/System preferences per control, so that I can use a consistent readable interface.
36. As a desktop user, I want to manage discovery and archive location with affected-workspace information, so that I can understand shared consequences.
37. As a desktop user, I want to export/restore application data including sessions, so that I can recover metadata without assuming project-file contents are backed up.
38. As a desktop user, I want to read version and license information in About, so that I can identify the app and applicable notices.
39. As a desktop user, I want to use principal surfaces at both supported sizes in EN/RU and light/dark, so that I can keep actions accessible.
40. As a desktop user, I want to complete daily workflows with keyboard focus and predictable Escape, so that I can work without pointer-only actions.
41. As a desktop user, I want to use the packaged app at the agreed representative scale, so that I can retain responsiveness and safe persistence.

## Implementation Decisions

### Authority and reference baselines
| Reference | Authority |
| --- | --- |
| Main application at `080b416c57b2869024ac62363e96b68b40f499c0` | User journeys, principal workspace areas and contextual controls, subject to the explicit changes below |
| New runtime at `d925f8b758caea6dc079061d42be1d132dcbc8a1` | Observed implementation baseline; later accepted integration work must be incorporated before implementation |
| bb at `f135a001e72942cee9118d2693208ec0725e2f18` | Visual language, shared UI patterns and settings organization |
| [Product](https://github.com/kornouhovas/workspace/blob/d925f8b758caea6dc079061d42be1d132dcbc8a1/docs/product.md), [architecture](https://github.com/kornouhovas/workspace/blob/d925f8b758caea6dc079061d42be1d132dcbc8a1/docs/architecture.md), accepted ADRs and typed service contracts | Domain ownership, identity, storage and filesystem guarantees |
| Decision ledger (decisions incorporated here) and ADR 0008 (decisions incorporated here) | Owner-approved UX decisions and deliberate exceptions to main |

The local main used during the interview was `59afdbc8`; its application sources
match the pinned remote main above. The newer local differences concern
instructions and documentation checks. References are pinned so branch changes
do not silently change the target.

### Scope and deliberate changes
Include sidebar navigation, Board/Table and project tabs, project properties and
file tree, a right-hand project area with expanded mode, workspace session
restoration, theme selection, contextual editing/actions and bb-style settings.

The owner deliberately changes the main baseline as follows:

- Display only one project at a time. Exclude nested splits, multiple simultaneous
  project panes, division inside a project and drag-to-split targets.
- Keep at most one tab for a project within each workspace. Reuse an existing tab
  when expanding that project; omit duplicate-project-tab commands.
- Automatically name a new workspace **Workspace**. Rename it after creation.
- Escape cancels uncommitted ordinary-property input; it does not save text as
  main's blur-based Escape handling did.
- Accept Number arithmetic input but persist only its result, matching the new
  service: entering `10 + 5` stores `15` and reopens as `15`.
- Open project files through the default external application on macOS and
  Windows. Main's project preview was properties plus a file tree, not an
  embedded content viewer.

Embedded file viewers/editors, original formula persistence, legacy data/session
import, arbitrary project-content mutation, shared-folder synchronization, AI,
remote/mobile clients and Linux are outside this work. Existing release
exclusions remain in force. This is a local desktop UX specification.

### Working model
Use the glossary (decisions incorporated here): a workspace owns views and presentation;
its source owns projects, property definitions/values and folder interpretation.
A saved view is not a project tab. A project preview is temporary content beside
a view; a project tab is a retained opening of the project. The project area can
be beside the view or expanded. A workspace session belongs to this device and
workspace; it is not shared-source metadata.

#### Shell and navigation

- Fit the shell to the window. Keep sidebar navigation, a central work area and
  an optional right-hand project area. Each area owns its scrolling.
- The sidebar supports workspace creation, selection, rename, reorder, removal,
  contextual workspace settings and entry to application settings. Preserve
  main's Back/Forward navigation and project-name search behavior without
  changing the accepted per-view search/filter persistence contract.
- Keep Board/Table view tabs and retained project tabs available in the work
  area's navigation. Selecting a project tab shows that project expanded;
  selecting a saved view shows its Board/Table. At most one project is displayed.
- Keep the sidebar available when a project is expanded. Sidebar collapse and
  width controls remain usable with pointer and keyboard.
- Preserve main's contextual tab actions that remain meaningful: reorder, close,
  close others, close to the right and reopen closed. Omit duplicate and split
  actions. Reopening a closed project must respect the one-tab-per-project rule.
- A right-hand area with no project occupies no space. Board/Table uses the
  released width; no empty navigation or project placeholder pane remains.

#### Project preview and tab state transitions

The following distinction resolves preview versus retained-tab reopening:
clicking a row/card requests a preview; expanding or selecting a tab requests a
retained expanded project. A preview does not create another project tab.

| Action | Required result |
| --- | --- |
| Click a project name or non-editor area in Board/Table | Show that project in the right-hand area; choosing another replaces the preview |
| Edit a property in a row/card | Edit the value without also activating the project's preview |
| Expand the preview | Create its project tab if absent, otherwise activate the existing tab; replace Board/Table with that project and keep the sidebar |
| Select a retained project tab | Display that project expanded; other tabs remain available but their projects are not displayed |
| Return the expanded project to the right | Remove that project's tab, restore the previous Board/Table and show the project beside it; keep other tabs |
| Close the expanded project tab | Remove that tab and return to the previous Board/Table; keep other tabs |
| Close the right-hand preview | Remove the preview; leave retained tabs unchanged and release the right-hand width |
| Close an inactive tab | Remove only that tab; do not change the displayed project/view |
| Return to a saved view | Restore its saved presentation and relevant session context |

Preserve view filters, grouping and scroll through expand/return/close
transitions. Retain per-view preview context as in main, subject to current
project availability and the single-project-area rule. Late responses from a
previous selection must not reopen or overwrite the current project.

#### Sizes and session restoration

Sidebar and right-hand project-area widths can be changed with pointer and
keyboard and are saved. Expanded mode occupies the available work area;
returning right restores the former project width. Implement sensible minimums
and maximums within the supported window sizes rather than allowing controls to
become unreachable.

Persist the workspace's retained project tabs/order, active view or project,
preview context, expanded state and allowed area sizes/collapse state. Preserve
scroll for view transitions and return from settings. Include the saved session
in application-data backups/export and restore. Load fresh project properties
and file trees and validate availability on restart/restore; cached content must
not masquerade as live data. Backup still does not contain project-file contents.

Missing, excluded, archived and unavailable-source projects keep their retained
tabs with an explanation and applicable actions. A verified rename or move
updates the locator while preserving logical identity. Archived ordinary
properties remain editable under the existing archive contract.

### Creating and managing workspaces
1. Invoke Add workspace from the sidebar or empty state and choose a root folder
   with the native picker. No name entry is required; creation uses **Workspace**.
2. Create the saved workspace with its default Table view. The existing service
   already accepts non-unique workspace names; separate IDs retain identity.
   Offer rename after creation through the workspace menu/settings.
3. If the root already has a configured source, reuse its interpretation,
   projects and properties and open the workspace. Do not reset or automatically
   reconfigure the source because another workspace references it.
4. For an unconfigured source, show a clear unfinished setup state: choose
   direct/grouped interpretation, preview folders, choose exclusions and Apply.
5. Set up later retains the created workspace. Resuming returns to source setup.
   Cancelling the native picker before creation creates nothing. Cancelling
   source setup after creation does not claim to roll back workspace creation.

Creation and reviewed discovery application remain separate service commits.
A stale preview requires a fresh review. Source changes identify all affected
workspaces. Removing a workspace deletes its configuration/session and views,
not project files or retained source metadata; removal of the last workspace
continues to obey existing retention rules.

### Board, Table, properties and view configuration
Preserve all accepted 0.1.0 capabilities, including independent view duplication,
final-view protection, typed/empty-value filters, exact grouping, manual/default/
ascending/descending group order, hide/collapse/hide-empty, MultiSelect multiple
group membership, Table row/column order and widths, and Board column settings.

Use main's contextual organization with the new shared component foundation:

- View tabs provide activation, lifecycle actions and access to view settings.
  Use toolbar/popover menus for grouping, filters and visible properties.
- Table column headers expose relevant rename, visibility, wrapping and filter
  actions. Resize/reorder columns and provide add/show-property controls.
- Board column controls expose relevant creation, visibility and wrapping
  actions. Properties can be edited directly on cards.
- Project details show the same typed values and editors plus the project file
  tree and applicable property-management actions.
- Property definitions, ordinary option names/colors/order and assigned values
  are source-wide. Ordinary option hiding is workspace-local under the accepted
  Single Select/MultiSelect contracts. Field/group visibility, order and layout
  remain scoped to the owning view. Do not make hiding an option or field affect
  unrelated workspaces/views or delete its values.
- Preserve create/rename/color/hide/reorder/delete for applicable options, typed
  validation, immutable property types and empty-value semantics. Already chosen
  hidden options remain visible/removable without becoming ordinary new choices.
- Preserve metadata-removal impact review and view-reference cleanup. Show the
  affected projects/views and require a current review before application.
- Keep main's contextual editing organization without reintroducing its fixed
  Status interpretation or superseded persistence model.

#### Ordinary value editing

| Input | Commit | Cancel/dismissal |
| --- | --- | --- |
| Text | Cmd/Ctrl+Enter or leaving the field; Enter inserts a newline | Escape cancels the uncommitted draft |
| Number or manually entered Date | Enter or leaving the field | Escape cancels the uncommitted draft |
| Calendar Date or Single Select | A selected value commits immediately | Dismissal does not undo a committed choice |
| MultiSelect | Each membership change commits; the menu stays open | Dismissal does not undo committed changes |

Apply these rules consistently in Table, Board cards and project details.
Preserve current Date validation and timezone behavior. Number arithmetic is
validated by the service; only the result persists. Text empty string and absent
value remain distinct; clearing uses the existing typed empty-value command.

Invalid input or a failed save keeps the draft and explains the error. Before
switching project/workspace or closing the project area, commit valid pending
input. Invalid input or failed persistence prevents the transition until the
user corrects or explicitly cancels it. Avoid duplicate blur/Enter submissions,
late-response overwrites and silent retry of uncertain mutations. Restore focus
to the editor or its appropriate trigger after completion/dismissal.

These triggers apply to ordinary metadata. Name and folder-backed Select use
existing filesystem commands and their status/recovery semantics. Leaving a
control does not cancel a filesystem command already accepted by the backend.

#### Group assignment

Retain the full parent-spec assignment matrix in both Board and Table. Text,
Number and Date assign the exact destination value; Single Select can clear;
MultiSelect replaces only the source membership (A+B from A to C becomes B+C),
while the empty group clears all. Name renames the folder; folder-backed Select
moves it. Group/row ordering remains distinct from value assignment.

Use the same commands and failure reporting for drag and accessible equivalent
controls. A filtered-out result or failed operation must not be represented by
an invented successful card/row position. Retain logical identity, source
containment and destination validation.

### Project files and filesystem operations
Show the real folder/file tree for the displayed project, with loading, empty,
unavailable and error states. Folder expansion navigates the tree; file Open
uses the operating system's default external application. Offer a distinct
Reveal in Finder/Explorer action. Keep external opening separate from revealing
and from the excluded embedded file-viewer capability.

Tree reads and file opening require typed service/native boundaries with current
project identity, containment and availability checks. The renderer does not
receive general filesystem access. Native names/paths and authored data are not
translated. Check actual behavior on both macOS and Windows.

Place Create project in the view action area. In grouped mode it requests a
valid category; preserve existing creation validation and recovery. Expose
Rename, Move, Archive, Restore and Reveal from applicable project menus in rows,
cards and the project area. Availability depends on the project's actual state.

Use compact dialogs for required consequence review: origin/destination paths,
affected projects and blockers. Keep fresh review tokens, non-overwrite rules,
operation identity, pending states and status checking. A lost response or an
interrupted operation is not a reason to automatically replay a mutation.

Show source/project problems in their working context with an actionable status
and Details/Recover entry. Put recovery detail in the relevant dialog or source
settings; do not hide the only indication of an unresolved problem there.
Unavailable sources must not prevent opening settings or data recovery.

### Settings organization
Settings is a separate application mode inspired by bb. The sidebar switches to
setting categories and offers Back to workspace; the main area displays grouped
controls with headings/descriptions. Limit content width for reading while the
workspace itself uses the available width. On a constrained width, setting rows
can stack controls beneath labels without hiding actions.

| Section | Contents and scope |
| --- | --- |
| General | Device-local EN/RU language |
| Appearance | Device-local Light/Dark/System; System responds to OS changes |
| Workspaces | List to detail: workspace name and its source reference; contextual workspace entry opens the matching page |
| Sources | List to detail: root/availability, discovery mode and exclusions, archive location, and affected workspaces; configuration is shared across those workspaces |
| Backup and recovery | Existing automatic/pre-migration backups, export and explicitly reviewed restore; session state is included in app data |
| About | Product version and applicable licenses/attribution |

Enter settings from the sidebar footer or a workspace context menu. Preserve the
working session while settings is open; Back restores the prior work area,
selection and scroll and returns focus to a useful point. Follow bb's in-session
memory of the last settings section; a fresh application start returns to the
workspace session rather than forcing the user into settings.

Simple preferences save per control with pending/error feedback. Discovery,
archive-location changes, data restore and consequential operations retain their
own explicit review/application workflow. There is no whole-page Save that
implicitly applies unrelated source/filesystem operations. Active/Archived
switching and everyday Archive/Restore remain workspace actions.

### Component and visual foundation
Implement reusable Workspace components on **Radix Primitives + Tailwind CSS**.
The inspected bb foundation uses Tailwind 4, shadcn-style `radix-mira` wrappers,
neutral semantic variables, Inter and Hugeicons. Select compatible pinned
versions during the foundation slice. Radix Themes is not the selected visual
system.

Use semantic tokens for surfaces, text, borders, focus, selection, hover,
disabled and errors, with light/dark counterparts. Apply one typography, density,
spacing, radius and icon treatment across shell, menus, editors and settings.
Use bb's inspected tokens as the starting visual baseline and verify EN/RU
readability and desktop interaction. Avoid per-screen palettes and native-looking
controls that diverge from the shared component system.

| Surface | Component approach |
| --- | --- |
| Actions and fields | Shared Button/Input/Textarea/Label wrappers with consistent states |
| Menus and picker surfaces | Radix DropdownMenu, ContextMenu, Popover, Select and related primitives as appropriate |
| Consequence/recovery dialogs | Radix Dialog/AlertDialog with deliberate focus, dismissal and pending behavior |
| Checkbox/toggle/tab controls | Radix primitives where their semantics match; retained project tabs need the application session model |
| Tooltips and scroll areas | Shared primitives with keyboard access, portal ownership and clipping tests |
| Table, Board, project tree | Workspace-specific composition and existing service semantics |
| Resize boundaries and dragging | Focused compatible helpers where needed; these behaviors are not supplied by Radix alone |

Retain Ladle examples for shared controls and meaningful complete states. Verify
nested menus, outside clicks, Escape ownership, focus return, drag cancellation,
scroll ownership and popup positioning in real Electron. Reuse selected bb
modules under [reuse policy](https://github.com/kornouhovas/workspace/blob/d925f8b758caea6dc079061d42be1d132dcbc8a1/docs/reuse.md), record exact source provenance and
ship applicable license notices; do not import unrelated chat/mobile machinery.

## Testing Decisions

Retain the agreed typed Workspace application-service API as the primary
behavioral seam, with temporary real SQLite databases and isolated filesystem
fixtures. Reopen the same data to verify persistence. Extend this public boundary
for saved sessions and contained project-file queries/Open; keep renderer access
behind the existing typed preload/IPC route.

Use focused renderer interactions for editor drafts, navigation guards, tabs,
focus, keyboard alternatives and response ordering. Use real Electron and
packaged-platform checks for portals/layout, native Open versus Reveal, renderer
isolation, installation and performance. Existing property, views, grouping,
filesystem/recovery and backup tests, plus runtime/installer smoke scenarios,
are the prior art. Service tests cannot establish visual or native acceptance.

Assert observable state, errors, persistence and filesystem outcomes rather than
private calls, markup or exact documentation text. Reuse these agreed seams;
publication does not introduce a new test architecture.

### Regression inheritance and migration

Tests from completed new-workspace issues are already part of the integration
branch. Preserve valid service, real-SQLite/migration, filesystem, recovery,
IPC/security and native regressions. Do not clone a new test suite for each issue
or import main's historical suite wholesale; use main to identify missing user
scenarios and adapt them to the accepted runtime and deliberate UX differences.

Each implementation slice inventories affected existing scenarios as retained,
adapted, replaced or retired. UI interactions, fixtures, locators and smoke drivers
must move with the new controls in that same slice. Tests of obsolete markup or
superseded behavior may be replaced/removed with a documented reason and coverage
replacement for still-required behavior. Disabling failures, weakening safety or
performance assertions, or postponing broken old-UI tests until U20 is not acceptance.

The scenario mapping includes current tests introduced by issues #8–#40 and
accepted additions from #41. Reconcile suite/CI inventory, native/package fixtures
and migration counts when they change. Run focused checks while developing and
the required full suite on the completed candidate. Historical standalone
investigations are not an automatic per-ticket checklist: select a focused route
only for a matching failure while preserving ordinary regression/platform coverage.

### Accessibility, layout and performance acceptance
- Supported minimum window: **1024x720**; second required size: **1440x960**.
  Inspect Board, Table, preview, expanded project and settings at both sizes in
  EN/RU and light/dark. Verify System appearance separately.
- Keep each area independently scrollable within the viewport-bound shell.
  Long names/paths, populated views and open menus must not obscure critical
  actions. Width limits keep sidebar/view/project controls usable.
- Provide keyboard alternatives for project-area opening, expansion/return,
  tab reorder, width changes and relevant drag operations. Preserve meaningful
  main shortcuts with platform-appropriate modifiers and no split shortcuts.
- Escape belongs first to the active editor/menu/dialog/drag; text input must
  not trigger unrelated workspace shortcuts. Show visible focus and restore it
  after closures. Accessible labels distinguish actions and states.
- Expose loading, empty, unavailable, validation, pending and recovery states in
  both languages. Show user-authored names and paths unchanged.
- Reuse issue 41's agreed scale: direct and grouped sources with 1,000 projects
  each, 20 ordinary properties and 10 views per source. Recheck saved-view startup
  and full scan <=5,000 ms, relevant filter/group/edit interaction <=300 ms, and
  the approved conservative process-memory limit of 1,000,000,000 bytes. Include
  the new project-area/editor flows without weakening established measurements.
  Record actual OS/hardware, raw samples and limitations; hosted Windows Server
  evidence does not become Windows 11 evidence.

### Acceptance matrix
Every row needs an observable scenario and evidence linked to the implemented
issue and exact candidate. Service-only tests cannot prove native interaction or
visual quality; a screenshot cannot prove mutation safety or persistence.

| ID | Required observable evidence |
| --- | --- |
| UX01 | Create with automatic Workspace name; rename later; cancel picker; postpone/revisit new-source setup; reuse a configured root without resetting shared data |
| UX02 | Sidebar navigation, workspace lifecycle and Back/Forward; independent workspace sessions and no project deletion on workspace removal |
| UX03 | Open A then B as preview; only B displays; property editing does not open preview |
| UX04 | Expand creates/reuses one tab; multiple project tabs remain available; selection shows one project; duplicate/split commands are absent |
| UX05 | Return-right removes that tab and preserves others; Close returns to saved view; close-preview leaves retained tabs and releases width |
| UX06 | Reorder/close/reopen tabs with keyboard and pointer; no duplicates after reopen, restore or rapid interaction |
| UX07 | Persist widths, active content and allowed session state; expand/return preserves view filter/group/scroll; restart and backup restore revalidate current project state |
| UX08 | Retain missing/excluded/archived/unavailable-source tabs with correct actions; verified external moves keep identity; stale requests cannot reopen old content |
| UX09 | All ordinary editors in Table, Board and project details follow commit/cancel rules; multiline Text, arithmetic Number, manual/calendar Date and immediate selections work |
| UX10 | Invalid/save-failed draft blocks navigation and remains editable; explicit cancel permits transition; Enter+blur and rapid MultiSelect changes do not duplicate/lose mutations |
| UX11 | Source-wide values/definitions/option names/colors/order appear consistently across workspaces; option hiding remains workspace-local and field/group visibility/layout view-local; metadata/option removal retains impact review and cleans view references |
| UX12 | Full Board/Table lifecycle, filtering, grouping, membership, visibility, ordering, widths and wrapping remain usable and persist |
| UX13 | Parent-spec all-type assignment matrix through Board/Table, including empty transitions, collision/invalid destinations, filtered results and accessible alternatives |
| UX14 | Real tree loading/refresh/unavailable states and external Open versus Reveal on macOS and Windows through contained service/native boundaries |
| UX15 | Create/rename/move/archive/restore from contextual controls retains no-overwrite, pending, uncertain-outcome and restart/recovery behavior |
| UX16 | Settings categories, direct contextual entry and Back restore workspace context; immediate preferences and independently reviewed operations behave as specified |
| UX17 | Both sizes/languages/themes across all principal surfaces; long content, popovers, menus and resize extremes remain usable; inspect System-theme switching |
| UX18 | Keyboard-only daily workflow and visible focus; correct Escape ownership, editor/menu dismissal and no empty project host |
| UX19 | Real database upgrade, session export/restore and invalid/interrupted restore protect existing data; no claim to restore project-file contents |
| UX20 | Actual packaged app and supported-platform evidence; retained renderer isolation, notices/version checks, renewed issue-41 performance and integrated release matrix |

Run existing affected service/real-SQLite/filesystem regressions, targeted editor
and session interactions, lint/typecheck/build and actual-platform/package checks
according to [development](https://github.com/kornouhovas/workspace/blob/d925f8b758caea6dc079061d42be1d132dcbc8a1/docs/development.md#verification). Use disposable roots
and isolated application data. Add behavioral checks for new session and file
commands, not assertions that merely freeze component markup or document wording.
Inspect UI evidence for complete journeys, not just isolated controls.

## Out of Scope

Nested splits, simultaneous project panes, duplicate tabs for one project,
embedded file viewers/editors, original Number-expression persistence,
legacy data/session import, arbitrary project-content mutation, project-file
backups, shared-folder synchronization, AI, remote/mobile clients and Linux.
The parent release exclusions remain in force. Publication does not start
implementation or authorize a release.

## Further Notes

The owner confirmed kornouhovas/workspace is public on 2026-10-19 and authorized
publication of this specification and its approved implementation tickets. Public
visibility is expected; existing task, data and release boundaries still apply.

Part of #7. Desktop UX acceptance is a mandatory prerequisite of release
integration #42. Performance #41 remains independently owned and can proceed;
repeat its agreed measurements against the completed UI before release acceptance.
Keep #7 and #42 open until their actual gates pass. A readiness label or published
document does not establish implementation completion.

The owner approved the product decisions during the desktop UX interview,
including the standard automatic name Workspace. The owner approved the 20-ticket implementation breakdown and public publication
on 2026-10-19. Publish the tickets as sub-issues with the approved dependencies. GitHub Issues owns
requirements, blockers and delivery checkpoints. Local documents are publication
snapshots, not another live tracker.

Reference authority: main provides journeys subject to the deliberate exceptions;
bb provides visual/settings patterns; new-workspace provides domain, identity,
storage and filesystem-safety contracts. Copying either app wholesale is outside
scope. Inspect the latest verified integration state before implementation;
pinned references describe the inspected baseline.

### Primary reference map
- Main: [shell](https://github.com/kornouhovas/workspace/blob/080b416c/src/App.tsx#L2930),
  [project tabs](https://github.com/kornouhovas/workspace/blob/080b416c/src/components/workspace/project-tabs.tsx),
  [close/preview ADR](https://github.com/kornouhovas/workspace/blob/080b416c/docs/adr/012-project-close-and-preview-only-right-host.md),
  [session lifecycle](https://github.com/kornouhovas/workspace/blob/080b416c/src/workspaceSessionLifecycle.js),
  [Table](https://github.com/kornouhovas/workspace/blob/080b416c/src/components/workspace/table-view.tsx),
  [Board](https://github.com/kornouhovas/workspace/blob/080b416c/src/components/workspace/board-view.tsx).
- bb: [component configuration](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/components.json),
  [theme](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/src/components/ui/theme.css),
  [settings navigation](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/src/components/settings/SettingsSidebar.tsx),
  [settings sections](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/src/components/ui/settings-section.tsx),
  [route memory](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/src/hooks/useAppSettingsRouteMemory.ts).
- Runtime: [workspace commands](https://github.com/kornouhovas/workspace/blob/d925f8b758caea6dc079061d42be1d132dcbc8a1/src/contracts/workspaces.ts),
  [source creation/discovery](https://github.com/kornouhovas/workspace/blob/d925f8b758caea6dc079061d42be1d132dcbc8a1/src/service/workspaces.ts),
  [Number contract](https://github.com/kornouhovas/workspace/blob/d925f8b758caea6dc079061d42be1d132dcbc8a1/docs/plans/issue-23-number-properties.md),
  [recovery](https://github.com/kornouhovas/workspace/blob/d925f8b758caea6dc079061d42be1d132dcbc8a1/docs/recovery.md), [reuse and attribution](https://github.com/kornouhovas/workspace/blob/d925f8b758caea6dc079061d42be1d132dcbc8a1/docs/reuse.md).
