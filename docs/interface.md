# Interface Specification: Workspace Project Board

## Purpose

This document defines how the Workspace Project Board interface should look and behave at the screen level.

Use it together with:

- `docs/ui-guidelines.md` for general UI rules;
- `docs/flows/settings-source-folder-and-roles.md` for Settings behavior;
- `docs/flows/board-table-views.md` for Board/Table behavior;
- `docs/prd.md` for product requirements.

This document is the source of truth for screen composition, navigation, and expected controls. If implementation differs from this document, update the document or fix the implementation in the same task.

## Global Shell

The app opens as an Electron desktop app with:

- a left sidebar;
- a main content area;
- an optional right panel with fixed Workspace Navigation and a project preview; the main header has no separate right-panel toggle. Choosing a project still opens its preview.
- an ordered centre split tree for the working view and multiple Project Detail areas. Pane chrome follows bb 0.44.0 ([reference matrix](../work/bb-interface-1wx/reference-matrix.md)).

On initial app open:

- the right Project Detail Panel is closed;
- no project is selected by default;
- the main area shows the active Workspace working surface, or an empty state if the source folder or Workspace is missing.

The app must not open with mock project details visible.

## Left Sidebar

The left sidebar contains:

- native traffic lights with back/forward history;
- collapse/expand toggle;
- Add Workspace action;
- Search input;
- Workspaces list;
- Settings entry at the bottom.

Layout requirements:

- The app title must not overlap the macOS traffic-light window controls.
- The title area should be vertically offset enough for the hidden-inset titlebar.
- The sidebar opens and closes with a 220ms width transition (disabled for reduced motion and direct pointer resize). Hidden sidebar content is inert. The sidebar can be collapsed with a toggle icon. Native pointer clicks must both hide and show it: the toggle no-drag exclusion is rendered after all pane drag regions so macOS does not consume the restore click.
- Collapsed mode hides the sidebar body; the visible toggle and back/forward history remain accessible in reserved header space clear of native traffic lights. The toggle restores the sidebar. `Cmd/Ctrl+\` toggles the sidebar. The sidebar resizes between 240px and 460px (default 320px). Its width is shared by every Workspace and survives restart; visibility and right-panel state remain per Workspace.
- Settings must look like navigation, not a passive label.
- Clicking Settings opens the Settings screen in the main area.
- Clicking a Workspace opens that Workspace working surface.

Workspace row requirements:

- The active Workspace is visually selected.
- Workspace rows should later support rename, delete, and drag reorder actions.
- These row actions should be compact icon actions, not large text buttons.

Search requirements:

- Search is scoped to the active Workspace.
- MVP search is by project `Name` only.
- Search should filter the active view without changing source folder or role settings.

## Settings Screen

Settings is a separate main screen. It is not embedded above Board or Table.

Entry points:

- Settings item in the left sidebar;
- empty state action when no source folder is selected.

Exit:

- Settings has a clear `Back to workspace` action.
- Clicking a Workspace in the sidebar also leaves Settings and opens that Workspace.

Settings contains:

- Light, Dark and System appearance, persisted in the renderer session;

- Language section;
- Source folder section;
- Folder role tree section;
- Status values section for the system `Status` property.

### Language Section

The Language section shows an `Interface language` control with `English` and `Русский`.

- Changing language updates application-owned text immediately without reloading Workspace data.
- The selected language persists as a device-local preference and applies to every Workspace.
- English is the default and fallback locale.
- User-created names, values, filenames, and paths are not translated.

### Source Folder Section

The Source folder section shows:

- selected Workspace name;
- current selected folder name;
- current selected folder path;
- Select folder button.

Behavior:

- Select folder opens the native Electron folder picker.
- After selection, the backend validates that the path exists and is a directory.
- On success, Settings refreshes that Workspace’s folder role tree. Other Workspaces retain their source, roles and data. Cancellation preserves the source. A delayed picker result remains bound to the Workspace that opened it.
- On failure, show a non-blocking error and keep the previous selected folder visible.
- Source folder selection appears only in Settings.
- The main Board/Table screen must not show Select folder controls.

### Folder Role Tree

The Folder role tree shows the selected source folder structure for role configuration.

### Status Values Section

The Status values section shows only the system `Status` property.

- Status values are derived from folders marked as `status` in the folder role tree.
- Each status value shows its display name and current dot color.
- The user can change the dot color for each status value.
- The user cannot create, rename, delete, hide, or reorder custom properties in Settings.
- Custom property management stays in Table, Project Detail Panel, `Customize Columns`, and property menus.

Initial tree display:

- Show only first-level folders by default.
- Do not render the entire folder hierarchy expanded on first load.
- First-level folders are expanded only after the user opens them.

Tree navigation:

- Each folder row that has children has an expand/collapse control.
- Expanding a folder reveals its direct child folders.
- Collapsing a folder hides its descendants.
- The tree must visually show parent/child relationships through indentation and disclosure icons.
- Long folder names may wrap; paths truncate with their full value available on hover. Neither may push role controls outside the host.

Default role rules:

- First-level folders default to role `status`.
- Folders inside a first-level status folder default to role `project`.
- Folders inside a project are not shown as active project discovery targets by default, but they should still be reachable in Settings when the user expands the project folder.
- The user can change any visible folder role to `group`, `status`, or `project`.

Role semantics:

- `status`: creates a primary status column/group for Board and Table grouping.
- `project`: marks this folder as a project.
- `group`: transparent container; the app continues looking inside it.

MVP constraints:

- Nested status groups are not supported as primary Board lanes in MVP.
- Drag and drop projects between statuses is not supported in MVP.
- Role controls may use segmented controls or compact select controls. Settings columns respond to the available host width, including when Navigation is open. Folder roles wrap onto a separate row and remain reachable without horizontal clipping.
- Role changes should save to local storage for the active Workspace.
- Changing roles refreshes Board/Table project discovery.

Empty and error states:

- If no source folder is selected, do not show role controls.
- If the folder has no visible folders, show an empty tree state.
- If scan fails, show an inline tree error and retry action.
- Hidden dotfolders are ignored in MVP.

## Workspace Main Screen

The Workspace main screen is the working surface.

It contains:

- view tabs or view switcher;
- view toolbar actions;
- one active view surface at a time;
- optional Project Detail Panel after project selection.

The main screen must not show Settings source folder controls.

## View Tabs And View Management

The view switcher shows saved views for the active Workspace.

Required behavior:

- Only one view is active at a time.
- View tabs should sit in the main surface without extra horizontal divider lines above or below the switcher.
- View tabs show their view type with a compact icon, such as Board or Table.
- The main header contains view tabs on the left and closely spaced, borderless `Customize Columns` and `Add View` icon buttons on the right, with a small top inset. History arrows and the sidebar toggle stay at fixed positions clear of the macOS controls, with the toggle always to the right of both arrows. The leading tab inset interpolates with the sidebar width. The workspace title and separate toolbar row are omitted. Icon buttons retain accessible labels and tooltips.
- View duplicate/rename/delete actions are available from the tab context menu; there is no separate three-dot view menu. Duplicating preserves the view type and display settings, persists a separate view immediately to the right of the source, and activates the copy.
- Board and Table start at the same top offset below the header. Board has no movement-disabled badge; moving projects between statuses remains unavailable.
- Board cards show populated property values below the project name, without visible property labels. System Status participates in this list and follows the view's property order and visibility instead of being pinned beside the name. Empty values add no rows or spacing. Dates and colored value chips match the project detail display.
- Populated custom Board values can be edited directly using the same text, number, date and selection editors as Table. Editing a value does not open project details; the card name/background still opens details. System Status remains read-only, and empty properties remain omitted.
- Switching a view changes the main content to that view type.
- Switching views does not change project data or folder roles.
- The `+` action creates a new view.
- New view creation should create a real persisted view through the Workspace service.
- New view becomes active after creation.

Each view needs a menu with:

- Duplicate Tab;
- Rename View;
- Delete View.

View menu rules:

- Deleting a view deletes only app metadata, never files or projects.
- Deleting the last remaining view is blocked.
- Rename should update the view name in the tab and persist locally.
- View order should support drag reorder by dragging the view tab; the order persists locally.

## Board View

When the active view type is Board:

- show only the Board surface;
- do not show the Table surface below it;
- show one column per status group;
- include `No status` when projects exist outside status folders;
- render project cards inside status columns.

Board cards:

- show project `Name`;
- show project `Status`;
- show selected visible properties for that view;
- clicking a card opens the right Project Detail Panel.

Board constraints:

- No drag and drop between primary status columns in MVP.
- Board may horizontally scroll when there are many statuses.
- Board status columns use a stable fixed width; hiding a filtered-out status must not widen the remaining columns.
- `Customize Columns` for a Board view includes a bottom `Column width` slider. It updates all status columns together for that view.
- Board column width defaults to `384px` and cannot go below `288px`. The slider limits new selections to one third of the current Workspace working area, but resizing the window does not change an already selected width; narrower windows use horizontal scrolling.
- Without an active value filter or search query, empty status columns stay visible with a compact empty state.
- While a value filter or search query is active, status columns with no matching projects are hidden and the remaining columns shift together without empty gaps.

## Empty Property Values

For editable project values in Table view and the Project Detail Panel:

- empty `Text` and `Numbers` values render as blank content;
- empty `Date`, `Select`, and `Multi-select` values also render blank, not as `Empty` placeholder text;
- the blank cell or property row remains clickable and opens the same editor as a filled value.

## Table View

When the active view type is Table:

- show only the Table surface;
- do not show the Board surface above or below it;
- show one row per project;
- show visible properties as columns.
- keep `Name` visible as the required identity column; `Status` is visible by default but can be hidden for the current view.

Table requirements:

- Rows remain compact for short values.
- `Text` property values preserve stored manual line breaks, but Table shows them compactly in one line by default.
- Empty and populated editable Table controls have accessible names containing the property and project; empty text/number cells remain identifiable without a displayed value.
- In compact one-line `Text` mode, editing opens a popover editor anchored to the cell so the row height does not expand while typing longer text.
- The Text column property menu includes `Wrap content`; when enabled for that view, the column preserves manual line breaks visually, wraps long text inside the stable column width, and lets row height expand.
- Clicking a row opens the right Project Detail Panel.
- Table should render as a compact bordered grid with subtle row separators and vertical dividers aligned between headers and values.
- Header vertical dividers should visually match the body dividers instead of fading on the first table row.
- The last visible table row should keep its bottom separator after search or value filtering.
- Status values should use compact chips with a small dot, matching the Project Detail Panel status/value chip styling.
- Table should not show a dedicated row drag-handle column while row ordering is not persisted.
- The add-property column should stretch to the right edge when visible property columns do not fill the viewport.
- Column property menus for `Status`, `Select`, and `Multi-select` should include `Value filters` for the current property, using the same view-level `valueVisibility` settings as `Customize Columns`.
- The Customize Columns menu should allow hiding `Status` from the active view while keeping `Name` required.
- When a column has active value filters, the header shows a compact filter indicator next to the property action menu.
- Clicking a visible `Select` or `Multi-select` value chip opens the value-specific menu for rename, delete, and color actions. Re-clicking the same chip closes that menu. Clicking elsewhere in the cell closes any value-specific menu and opens the normal select value picker.
- While any Table dropdown, popover, or context menu is open, the first click outside the menu closes it and must not activate the cell, header, view tab, or control underneath that click.

## Project Detail Panel

The right Project Detail Panel opens only after the user selects a project from Board or Table.

Panel behavior:

- Clicking the same Board/Table project again closes its preview; the next click opens it. Clicking another project replaces preview content without removing expanded tabs.
- Returning to a Workspace restores its own preview project and fresh contents (including projects excluded by current view filters); a previously closed host stays closed. This differs from selecting Board/Table after an expanded tab, which hides preview. Missing projects close the host with an unavailable message.
- Workspace activation retains the coherent outgoing screen until the destination snapshot is ready, then replaces root, views, properties, preview and layout together. Superseded async loads cannot paint another Workspace’s contents.
- Opens in the right preview host with a 220ms width transition; closing releases the same space smoothly while retaining the outgoing content. Closed hosts are immediately inert. Expanded tab selection remains immediate without slide-in. Panel transitions respect reduced motion and reverse cleanly when toggled quickly.
- Dragging the left preview boundary follows the pointer without easing. Reaching the left edge of the available workspace expands the project during the drag, using the existing expanded-tab mode. Restore returns to the partial width captured when that drag began; an ordinary completed resize establishes the next partial width. This width survives restart, including an explicit 560px width; older sessions whose 560px value represented automatic half-width keep that automatic behavior. The sidebar, when visible, is excluded from the available width.
- Does not open on initial app load.
- Can be closed without changing active view.
- Closing the active expanded project tab, using either Close or its context menu, selects the immediately preceding project tab in the current tab order. If no project tab is to its left, return to the selected Board/Table view. Closing an inactive tab preserves the current screen.
- Preserves the current Board/Table context.
- Expand/Restore uses bb 0.44.0 Hugeicons `ExpandIcon` / `CollapseIcon`, 13px glyphs in 28px controls. Expand fills the working area up to the visible sidebar and suppresses the right Navigation/launcher host, including pointer and keyboard interaction. Restore returns to the side preview.
- The panel background reaches the top of the window; its content starts below the workspace header, while Close and Expand/Restore stay aligned with the top controls. View settings/add buttons remain available while a right preview is open; only the full working-area project screen replaces them with Restore/Close. Both tab groups remain above the panel background.
- Expanded projects have a separate, horizontally scrollable tab group immediately after the saved-view tabs. Selecting a saved view hides the right host and releases its width without removing project tabs or its saved split tree; selecting a project tab immediately returns to its expanded screen, including a tab also present in a saved split. Board/Table remains reachable and the split tree is preserved underneath.
- Duplicate tab inserts the new instance immediately to the right of the source tab and activates it.
- Each project tab has its own identity, separate from the project ID. Clicking a project in Board/Table always opens an independent side panel, even if that project has expanded tabs. Expanding the side panel reuses an existing tab for that project when available, otherwise it creates a tab; reaching the edge during resize uses the same operation. The tab context menu includes Duplicate tab, which creates and selects another expanded tab for the same project. Closing/restoring a tab removes only that instance; closing the independent side panel removes no tabs. Project property changes are shared across all instances. Duplicate tabs, their order and the active instance persist across restarts; older saved tabs migrate automatically.
- Project tabs share the saved-view tab styling, support drag reorder within their Workspace, and expose Restore view / Close view through a right-click menu. These actions affect the clicked project, including an inactive tab, and match the panel's Restore and Close buttons.
- Dragging project tabs translates them without scaling their width or height. On returning to a Workspace, restore its last selected saved view and, if it was showing an expanded project, reopen that project after the Workspace data is ready. Returning to a Workspace left on Board/Table must not reopen an inactive project tab.
- Multiple expanded project tabs, their order, and the last active screen are saved locally per Workspace and restored after restarting the application. Close removes the active project tab; Restore removes its tab and keeps its side panel open. Changing Workspace or visiting Settings does not discard the tabs. Startup restores the active expanded project after loading its Workspace; file trees are loaded again instead of persisted. Invalid stored data is ignored safely.

Panel content order:

Project identity remains in the host tab and in the dialog accessible name. There is no duplicate name or reserved heading space above Properties. The partial preview tab does not add a close icon on hover; its header Hide control and keyboard close paths remain available.

1. Project properties and values.
2. File/folder structure for the project folder.

Properties section behavior:

- Properties and Hidden properties collapse independently through their heading rows. Their chevrons appear on hover or keyboard focus without shifting the heading text. The two expanded/collapsed preferences are shared across project cards on this device and persist across closing cards and restarting the app.
- When both property sections are collapsed, their heading rows have no extra gap. Project tabs share the available width, shrinking from 176px down to 40px as the window narrows or more tabs open; narrow tabs show only their icon, with the full name retained in the tooltip and accessible label. Horizontal scrolling is used only after the minimum widths no longer fit.
- Keep `Name` in the host tab and accessible dialog label. Show `Status` by default.
- Show every active custom property that belongs to the active Workspace.
- Render properties as a compact two-column table: drag handle and property name on the left, editable value on the right, row separators, and a vertical divider between name and value.
- Supported custom property types are `Text`, `Numbers`, `Date`, `Select`, and `Multi-select`.
- `Text` values use a compact text input or textarea depending on configured display density.
- `Numbers` values use a text-like inline editor so users can enter either plain numbers or arithmetic expressions that start with `=`. The closed value shows the computed result, while the editor reopens with the original expression.
- `Date` values use a date input or date picker and store `YYYY-MM-DD`.
- `Select` values use a single-value menu with colored value badges.
- `Multi-select` values use a multi-value menu with removable colored badges.
- Clicking a visible select value badge opens the value-specific menu for rename, delete, and color actions. Re-clicking the same badge closes that menu. Clicking elsewhere in the value area closes any value-specific menu and opens the normal select value picker.
- Hidden properties, when expanded, use the same compact bordered table styling and editable value controls as visible properties.
- Do not place horizontal divider lines between visible properties, hidden properties, and the file tree section.
- Editing a value saves through Workspace service methods, not component-local persistence.
- Saved value changes refresh Board/Table projection and keep the panel open.
- Failed saves keep the old value visible and show a non-blocking error.

File tree behavior:

- Folders and files use distinct icons.
- Folder/file rows use compact spacing; folders and known file types may use color-coded icons for faster scanning.
- Folder/file rows are clickable actions.
- Opening a file or folder goes through Workspace service methods.
- Unavailable files/folders show disabled/error state.
- Navigation inside project folders should be explicit and reversible.

## Loading, Empty, And Error States

Loading:

- Keep layout stable.
- Use skeletons for Board, Table, and Settings tree.
- Disable controls that are currently saving or loading.

Empty states:

- No source folder: show action to open Settings.
- No Workspace: show action to add Workspace.
- No projects: show action to open Settings folder roles.
- No search results: show scoped search empty state.

Errors:

- Service bridge errors appear as a visible non-blocking banner.
- Source folder unavailable errors appear in Settings.
- Folder scan errors appear near the Folder role tree.
- View create/rename/delete errors appear near view controls or as `sonner` errors.

Errors must not silently fall back to mock data in a way that hides the real problem during normal Electron runtime.

## Current Implementation Gaps To Fix

The current app implementation must be reviewed against this list:

- Left sidebar title must be moved below macOS traffic-light controls.
- Sidebar collapse/expand toggle must be restored.
- Settings must show collapsed first-level folder tree by default.
- Folder role defaults must be first level `status`, second level `project`.
- Board view must render only Board when active.
- Table view must render only Table when active.
- Table row drag handle must be restored.
- View `+` must create a real view.
- View menu must support Rename View and Delete View.
- Project card/row click must open the right Project Detail Panel.

## Acceptance Criteria

- App starts without an open Project Detail Panel.
- Settings can be opened from the left sidebar.
- Settings can be exited through `Back to workspace` or by selecting a Workspace.
- Selecting a source folder refreshes the role tree without showing stale mock tree data.
- Folder role tree initially shows first-level folders only.
- User can expand folders to configure deeper roles.
- First-level folders default to `status`.
- Second-level folders default to `project`.
- Board and Table never render simultaneously.
- Board cards open Project Detail Panel.
- Table rows open Project Detail Panel.
- Table row drag handle is visible.
- View add creates and activates a new saved view.
- View menu includes Rename View and Delete View.
- Sidebar title does not overlap macOS window controls.
- Sidebar can collapse and expand.

## Pane session and keyboard

Renderer session chrome stores layout under `workspace.pane-layout.v1`, keyed by opaque Workspace ID. Project snapshots retain the existing `workspace.project-tabs.v1` format. The optional `screens[workspaceId].fullScreen` boolean distinguishes an explicitly selected expanded tab from a focused split leaf on restart; older snapshots default to false and retain their layout. UI preferences do not replace the active service transport, JSON adapters or Go sidecar store. See [ADR 005](adr/005-bb-pane-session-chrome.md).

Project tabs expose a leading close control on hover/keyboard focus, middle-click close, close-other/close-right, reopen and drag reorder. Closing multiple tabs chooses a surviving neighbour before the active view fallback. Project tabs dropped over a pane use left/right/top/bottom edge zones to split and the centre to replace content. Drops outside panes or over titlebars do not create a split. Existing pane titles may be moved to an edge or swapped at the centre. Primary-status project drag remains restricted.

`Cmd/Ctrl+J` toggles the right panel, `Cmd/Ctrl+T` opens its deduplicated empty launcher, `Cmd/Ctrl+W` closes the focused content tab, `Shift+Cmd/Ctrl+T` reopens a closed content tab and `Shift+Cmd/Ctrl+E` maximizes/restores the focused pane. Input, textarea, select, contenteditable and menu focus retain editing shortcuts. Empty launchers are excluded from reopen history. The fixed Workspace Navigation survives closing the last empty launcher.

There is no Open in split button or menu command. Drag/drop splitting and saved split layouts remain supported. Opening a project from Board/Table while a split exists opens an independent right preview, preserving the existing panes and tab identities. Close pane collapses its branch and focuses a surviving neighbour. Navigation restores/focuses the Workspace host while preserving other leaves; Settings remains reachable after its previous host was closed or replaced. Split and right-panel separators support pointer resize and keyboard arrows/Home/End.

The right-preview header owns its expand/close controls; the main header does not duplicate them to the left of the divider. The right header has no new-tab plus button. Existing right tabs and keyboard commands remain supported; the main Add Board/Table control is retained. Independent split pane controls are unchanged.
