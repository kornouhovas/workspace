# Workspace desktop experience

Status: product decisions Q1–Q19 and the default-name spelling are incorporated;
the owner requested publication and ticket preparation. The standalone issue body
and [proposed implementation breakdown](workspace-desktop-ux-tickets/README.md)
are ready for review. Publication awaits resolution of the repository visibility
conflict recorded there. This document specifies future behavior; it does not
report an implemented UI or authorize implementation.

## Outcome and release relationship

Restore the daily working experience of `main` on `new-workspace`, using Radix
Primitives and Tailwind CSS with bb's visual language and settings organization.
The user works with projects in a full-window Board/Table and a single project
area, instead of navigating a long page of management forms.

This specification adds a mandatory acceptance gate to the
[local 0.1.0 release specification](workspace-0.1.0.md). Existing source ownership,
properties, views, archive, discovery, filesystem safety and recovery contracts
remain requirements. The new UX must compose those capabilities and retain their
observable guarantees.

[Performance #41](https://github.com/kornouhovas/workspace/issues/41) can finish
independently. Repeat its agreed measurements against the completed UI before
[release integration #42](https://github.com/kornouhovas/workspace/issues/42).
The repository records this added requirement; publication of this spec, new
implementation issues and updates to GitHub #7/#42 are still pending. No remote
tracker relationships have been changed by preparing this document.

## Authority and reference baselines

| Reference | Authority |
| --- | --- |
| Main application at `080b416c57b2869024ac62363e96b68b40f499c0` | User journeys, principal workspace areas and contextual controls, subject to the explicit changes below |
| New runtime at `d925f8b758caea6dc079061d42be1d132dcbc8a1` | Observed implementation baseline; later accepted integration work must be incorporated before implementation |
| bb at `f135a001e72942cee9118d2693208ec0725e2f18` | Visual language, shared UI patterns and settings organization |
| [Product](../product.md), [architecture](../architecture.md), accepted ADRs and typed service contracts | Domain ownership, identity, storage and filesystem guarantees |
| [Decision ledger](../decisions.md#desktop-ux-interview-decisions) and [ADR 0008](../adr/0008-desktop-experience-reference-authority.md) | Owner-approved UX decisions and deliberate exceptions to main |

The local main used during the interview was `59afdbc8`; its application sources
match the pinned remote main above. The newer local differences concern
instructions and documentation checks. References are pinned so branch changes
do not silently change the target.

## Scope and deliberate changes

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

## Working model

Use the [glossary](../../GLOSSARY.md): a workspace owns views and presentation;
its source owns projects, property definitions/values and folder interpretation.
A saved view is not a project tab. A project preview is temporary content beside
a view; a project tab is a retained opening of the project. The project area can
be beside the view or expanded. A workspace session belongs to this device and
workspace; it is not shared-source metadata.

### Shell and navigation

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

### Project preview and tab state transitions

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

### Sizes and session restoration

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

## Creating and managing workspaces

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

## Board, Table, properties and view configuration

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

### Ordinary value editing

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

### Group assignment

Retain the full parent-spec assignment matrix in both Board and Table. Text,
Number and Date assign the exact destination value; Single Select can clear;
MultiSelect replaces only the source membership (A+B from A to C becomes B+C),
while the empty group clears all. Name renames the folder; folder-backed Select
moves it. Group/row ordering remains distinct from value assignment.

Use the same commands and failure reporting for drag and accessible equivalent
controls. A filtered-out result or failed operation must not be represented by
an invented successful card/row position. Retain logical identity, source
containment and destination validation.

## Project files and filesystem operations

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

## Settings organization

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

## Component and visual foundation

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
modules under [reuse policy](../reuse.md), record exact source provenance and
ship applicable license notices; do not import unrelated chat/mobile machinery.

## Accessibility, layout and performance acceptance

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

## Acceptance matrix

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
according to [development](../development.md#verification). Use disposable roots
and isolated application data. Add behavioral checks for new session and file
commands, not assertions that merely freeze component markup or document wording.
Inspect UI evidence for complete journeys, not just isolated controls.

## Proposed implementation breakdown

The [20 proposed vertical tickets](workspace-desktop-ux-tickets/README.md) replace
the earlier six broad preparation areas. Each ticket has a complete observable
journey, scoped acceptance and immediate blocking edges. U01 delivers a working
workspace/settings journey while establishing the component foundation; subsequent
tickets adapt existing services and preserve functional entry points throughout
the migration. U20 verifies the composed UX01–UX20 matrix and renewed performance
after #41. The graph is a proposal awaiting owner review, not published work or
another live tracker. An attractive empty shell or isolated checks do not complete
this specification.

## Primary reference map

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
- Runtime: [workspace commands](../../src/contracts/workspaces.ts),
  [source creation/discovery](../../src/service/workspaces.ts),
  [Number contract](../plans/issue-23-number-properties.md),
  [recovery](../recovery.md), [reuse and attribution](../reuse.md).
