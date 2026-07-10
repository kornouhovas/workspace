# UX Flow: Board And Table Views

## Goal

Allow the user to work with projects from the active Workspace through Board and Table views, switch between saved views, scan project status groups, compare visible properties, apply view-level value filters, search by project name, and open a project in the Project Detail Panel.

This is the primary daily workflow after the project source folder and folder roles are configured.

## Entry Point

- User selects a Workspace in the Left Panel.
- User returns from Settings after configuring source folder and folder roles.
- User switches to another saved view inside the active Workspace.
- User opens a project from search results.

## Preconditions

- A project source folder is selected in Settings.
- At least one Workspace exists.
- The active Workspace has at least one saved view.
- Folder roles have been configured enough to discover projects.
- Project discovery has completed or is loading.

## Assumptions

- Board and Table are view types inside a Workspace.
- Board and Table operate on the same discovered project set for the active Workspace.
- View settings are stored per Workspace.
- Project `Status` is derived from folder roles.
- Projects outside status folders appear in `No status`.
- Search in MVP uses project `Name` only.
- MVP does not support drag and drop between primary status groups.

## Steps

1. User selects a Workspace from the Left Panel.
2. Main Area loads the active view for that Workspace.
3. App loads the project source folder and active Workspace settings.
4. App discovers projects using the active Workspace folder roles.
5. App applies the active view settings: view type, visible properties, property order, hidden properties, and visible property values.
6. App renders the active view as Board or Table.
7. User can switch between saved views using view tabs or an equivalent view switcher.
8. User can add a new Board or Table view.
9. User can rename, reorder, or delete a view when more than one view remains.
10. User can adjust visible properties for the active view.
11. User can adjust visible select values for the active view to filter projects.
12. User can search projects by project `Name`.
13. User selects a card or row.
14. App opens the Project Detail Panel for the selected project.

## Board Path

1. User selects a Board view.
2. Board shows one column per primary status group.
3. Projects inside status folders appear in their status column.
4. Projects outside status folders appear in the `No status` column.
5. Each card shows `Name` and visible properties for the view. `Status` is visible by default and can be hidden in view settings.
6. Value visibility filters hide projects whose selected property values are excluded by the active view.
7. User clicks a card to open the Project Detail Panel.

Rules:

- Board columns are status groups, not draggable lanes in MVP.
- Project cards are not draggable between primary statuses in MVP.
- Empty status columns remain visible with a compact empty state when no value filter or search query is active.
- While filtering or searching, status columns with no matching projects are hidden and the remaining columns shift together.
- Board supports horizontal scrolling when there are many statuses.

## Table Path

1. User selects a Table view.
2. Table shows one row per project.
3. Columns show `Name` and visible properties for the view. `Status` is visible by default and can be hidden in view settings.
4. Value visibility filters hide projects whose selected property values are excluded by the active view.
5. User clicks a row to open the Project Detail Panel.
6. User can open a Text column property menu and toggle `Wrap content`.

Rules:

- Table columns are controlled by active view settings.
- Table view should keep rows compact for short values.
- `Text` values are compact and single-line by default; editing a compact Text cell opens a popover editor anchored to the cell so the row height stays stable. When `Wrap content` is enabled for that Text property in the active view, manual line breaks are preserved visually and long text wraps inside the column, allowing row height to expand.
- Horizontal scrolling is allowed when columns exceed viewport width.

## View Management Path

1. User opens the view menu or view tab actions.
2. User chooses to add a Board or Table view.
3. App creates the view with default visible properties: `Name`, `Status`, and other Workspace defaults.
4. New view becomes active.
5. User renames the view if needed.
6. User reorders views by dragging view tabs if needed.
7. User deletes a view only if at least one other view remains.

Rules:

- Deleting a view does not delete projects, properties, values, or folder roles.
- The app must prevent deleting the last view.
- View changes persist after restart.
- View tab order persists per Workspace and does not change project data.

## View Property And Value Filter Path

1. User opens view settings from the active view.
2. User shows or hides properties for this view.
3. User changes property order for this view.
4. User opens value visibility controls for a select or multi-select property.
5. User selects which values should remain visible in this view.
6. App applies the filter to the current project list.
7. App persists the view settings.

Rules:

- Hiding a property in one view does not delete the property.
- `Name` is required in every view; `Status` is a system property that can be hidden or shown per view.
- Hiding a select value in one view does not delete the value.
- Value visibility is a filter for the active view.
- `Wrap content` for Text properties is a display setting for the active view and does not change stored property values.
- Filters do not change project property values.

## Search Path

1. User enters a query in Search.
2. App searches projects by project `Name` within the active Workspace.
3. Board or Table shows matching projects, or a no-results state.
4. User clears Search.
5. View returns to normal active filter state.

Rules:

- Search in MVP does not search property values.
- Search is scoped to the active Workspace.
- Search combines with active view filters.

## Loading State

Show loading states for:

- loading Workspaces;
- loading active view settings;
- scanning projects after source folder or folder role changes;
- applying view settings;
- saving view settings.

UI expectations:

- Board uses stable skeleton columns and card placeholders.
- Table uses skeleton rows and columns.
- View tabs remain visible when possible.
- Workspace switching keeps the current Workspace surface visible and non-interactive until the next Workspace projection is ready; it must not blank, dim, scale, or show a skeleton when a previous ready surface exists.
- Avoid layout jumps between loading and loaded states.

## Empty State

### No Workspace

Show:

- clear action to create a Workspace;
- secondary path to Settings if source folder is missing.

### No Source Folder

Show:

- action to open Settings and select source folder.

### No Projects Found

Show:

- active Workspace name;
- action to open Settings folder roles;
- note that hidden dotfolders are ignored in MVP.

### Empty Status Group

Show:

- compact empty state inside the Board column;
- do not remove the status column when no value filter or search query is active;
- hide the status column while filtering or searching if it has no matching projects.

### No Search Results

Show:

- query-aware no-results state;
- clear search action.

## Error State

### Source Folder Unavailable

Show:

- error state in Main Area;
- action to open Settings;
- do not delete Workspace metadata.

### Project Scan Failed

Show:

- error state with retry action;
- link/action to Settings if folder roles may be the cause.

### View Load Failed

Show:

- fallback error state;
- action to retry;
- action to open another view if available.

### View Save Failed

Show:

- inline error near view setting control;
- non-blocking `sonner` error;
- previous persisted settings remain active.

## Success State

- Active view loads and displays projects.
- View switch completes without changing project data.
- View setting changes persist locally.
- New view appears in the view switcher and becomes active.
- Deleted view disappears and another view becomes active.
- Search clears back to the full filtered project set.

## Validation Rules

- A Workspace must have at least one non-deleted view.
- View type must be `board` or `table`.
- Visible property ids must reference existing property definitions.
- Value visibility settings must reference select values for the same property.
- Search query is text-only and applies to project `Name`.
- Board must include `No status` when matching projects have no status.
- Board must not allow drag and drop between primary statuses in MVP.
- View deletion is blocked when it would remove the last view.

## Accessibility Requirements

- Workspace selection in the Left Panel must be keyboard reachable.
- View tabs or switcher must be keyboard operable.
- Active view must be announced visually and programmatically where practical.
- Icon-only view actions need accessible names and tooltips.
- Cards and table rows that open the Project Detail Panel must support keyboard activation.
- Search input must have a label.
- Board columns must have accessible names.
- Table columns must have headers.
- Filter controls must expose selected state.
- Error states must not rely on color alone.

## Responsive Behavior

- Primary target is desktop width from 1024px upward.
- Board supports horizontal scrolling for many status columns.
- Board columns should keep stable width.
- Table supports horizontal scrolling for many property columns.
- View actions collapse into menus when space is limited.
- Project Detail Panel should not cover the full workspace on desktop unless viewport width is narrow.
- Text must not overflow cards, table cells, tabs, or buttons.

## Screens / Components Involved

- Left Panel Workspace list.
- Search.
- Main Area view switcher.
- Board view.
- Table view.
- View settings menu.
- Property visibility controls.
- Value visibility filters.
- Project Detail Panel trigger.
- Empty/error/loading states.
- `sonner` notifications.

Preferred components:

- `Sidebar`
- `Input`
- `Tabs`
- `Button`
- `DropdownMenu`
- `ToggleGroup`
- `Checkbox`
- `Table`
- `Badge`
- `Sheet`
- `Skeleton`
- `Tooltip`
- `Separator`
- `sonner`

## Acceptance Criteria

- User can select a Workspace from the Left Panel.
- Main Area loads the active saved view for that Workspace.
- User can switch between Board and Table views.
- Board view groups projects by `Status`.
- Board view includes `No status` for projects outside status folders.
- Board view does not support drag and drop between primary status groups in MVP.
- Table view shows the same active project set as rows.
- View switch does not change project data.
- User can add a Board view.
- User can add a Table view.
- User can rename, reorder, and delete views.
- User cannot delete the last remaining view.
- Active view stores visible properties and property order.
- Active view stores visible select values as filters.
- Hiding properties or values in one view does not delete them.
- Search finds projects by `Name`.
- Search does not use property values in MVP.
- Clicking a project card or row opens the Project Detail Panel.
- Loading, empty, error, and success states are represented where applicable.
- UI follows `docs/ui-guidelines.md`.
- UI does not put filesystem, storage, or project discovery logic in React components.

## Review Notes

When reviewing implementation, verify against:

- `docs/prd.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/ui-guidelines.md`
- `docs/flows/settings-source-folder-and-roles.md`

The most important behavioral check is that Board and Table are projections of the same active Workspace project set, while view settings affect display and filtering only.
