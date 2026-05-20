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
- an optional right Project Detail Panel that opens only after the user selects a project.

On initial app open:

- the right Project Detail Panel is closed;
- no project is selected by default;
- the main area shows the active Workspace working surface, or an empty state if the source folder or Workspace is missing.

The app must not open with mock project details visible.

## Left Sidebar

The left sidebar contains:

- app title and product icon;
- collapse/expand toggle;
- Add Workspace action;
- Search input;
- Workspaces list;
- Settings entry at the bottom.

Layout requirements:

- The app title must not overlap the macOS traffic-light window controls.
- The title area should be vertically offset enough for the hidden-inset titlebar.
- The sidebar can be collapsed with a toggle icon.
- In collapsed mode, keep icon-only navigation with accessible labels and tooltips.
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

- Source folder section;
- Folder role tree section;
- Status values section for the system `Status` property.

### Source Folder Section

The Source folder section shows:

- current selected folder name;
- current selected folder path;
- Select folder button.

Behavior:

- Select folder opens the native Electron folder picker.
- After selection, the backend validates that the path exists and is a directory.
- On success, Settings refreshes the folder role tree.
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
- Long folder names and paths must truncate without breaking layout.

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
- Role controls may use segmented controls or compact select controls.
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
- View-level actions should follow the framework toolbar pattern: segmented view tabs on the left, labeled outline buttons such as `Customize Columns` and `Add View` on the right.
- Switching a view changes the main content to that view type.
- Switching views does not change project data or folder roles.
- The `+` action creates a new view.
- New view creation should create a real persisted view through the Workspace service.
- New view becomes active after creation.

Each view needs a menu with:

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
- Empty status columns stay visible with compact empty state.

## Table View

When the active view type is Table:

- show only the Table surface;
- do not show the Board surface above or below it;
- show one row per project;
- show visible properties as columns.
- keep `Name` visible as the required identity column; `Status` is visible by default but can be hidden for the current view.

Table requirements:

- Rows remain compact for short values.
- `Text` property values preserve manual line breaks and wrap inside stable column widths when the value is multiline or longer than the column.
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

## Project Detail Panel

The right Project Detail Panel opens only after the user selects a project from Board or Table.

Panel behavior:

- Opens from the right as a Sheet.
- Does not open on initial app load.
- Can be closed without changing active view.
- Preserves the current Board/Table context.

Panel content order:

1. Project identity: project `Name`.
2. Project properties and values.
3. File/folder structure for the project folder.

Properties section behavior:

- Always show system `Name` and `Status`.
- Show every active custom property that belongs to the active Workspace.
- Render properties as a compact two-column table: drag handle and property name on the left, editable value on the right, row separators, and a vertical divider between name and value.
- Supported custom property types are `Text`, `Numbers`, `Date`, `Select`, and `Multi-select`.
- `Text` values use a compact text input or textarea depending on configured display density.
- `Numbers` values use a numeric input and preserve empty value as `null`.
- `Date` values use a date input or date picker and store `YYYY-MM-DD`.
- `Select` values use a single-value menu with colored value badges.
- `Multi-select` values use a multi-value menu with removable colored badges.
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
