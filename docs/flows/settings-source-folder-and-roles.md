# UX Flow: Settings Source Folder And Folder Roles

## Goal

Allow the user to choose the shared project source folder in Settings, inspect its folder tree, assign folder roles, and produce a project set that Board and Table views can render for the active Workspace.

This flow establishes the source of projects for the app. Without it, Workspaces cannot reliably show project cards, statuses, or project file structure.

## Entry Point

- Left Panel: user opens `Settings`.
- Empty Workspace state: user selects the action to choose a project source folder.
- Error state: user opens Settings after the previous project source folder became unavailable.

## Preconditions

- The app is running in the Electron desktop runtime.
- User has local filesystem access to the intended project source folder.
- `any local` / `any-store` storage is available.
- If folder roles are being edited, an active Workspace exists.

## Assumptions

- The project source folder is app-level Settings data.
- Folder role configuration is Workspace-scoped.
- If no Workspace exists yet, Settings lets the user choose the source folder but prompts them to create a Workspace before assigning roles.
- MVP supports one level of status folders.
- MVP does not support drag and drop between primary status groups.

## Steps

1. User opens Settings from the Left Panel.
2. Settings shows the current project source folder state.
3. If no source folder is selected, the user chooses `Select folder`.
4. The app opens the native folder picker.
5. User selects a local folder.
6. Backend validates that the selected path exists and is a directory.
7. App stores the project source folder document.
8. Settings scans the visible folder tree under the selected source folder.
9. If no Workspace exists, Settings shows a create Workspace action before role editing.
10. User selects or creates the active Workspace.
11. Settings shows the folder tree for the active Workspace.
12. User assigns roles to relevant folders: `group`, `status`, or `project`.
13. Role changes are saved to local storage for the active Workspace.
14. The app refreshes project discovery for the active Workspace.
15. Board and Table receive the updated project set.
16. Projects inside status folders appear under those statuses.
17. Projects outside status folders appear under `No status`.

## Primary Path

The standard happy path:

1. No source folder is selected.
2. User selects a folder containing status folders and project folders.
3. User creates or selects a Workspace.
4. User marks first-level folders such as `Active`, `Paused`, and `Done` as `status`.
5. User marks project folders as `project` where needed.
6. User leaves structural container folders as `group`.
7. App saves roles and refreshes discovery.
8. User navigates back to Board view and sees grouped project cards.

## Loading State

Show loading states for:

- opening native folder picker;
- validating selected folder;
- scanning folder tree;
- saving folder role changes;
- refreshing discovered projects.

UI expectations:

- Use `Skeleton` for the folder tree while scanning.
- Keep the Settings layout stable during loading.
- Disable role controls while their save operation is pending.
- Avoid blocking the whole app unless source folder validation is in progress.

## Empty State

### No Source Folder Selected

Show:

- clear Settings section for project source folder;
- primary action to select a folder;
- short state text indicating no project source folder is selected.

Do not show:

- Board columns;
- Table rows;
- role assignment controls.

### Source Folder Has No Visible Folders

Show:

- selected source folder name/path;
- empty folder tree state;
- note that hidden dotfolders are ignored in MVP;
- action to choose a different folder.

### No Workspace Exists

Show:

- selected source folder state;
- action to create first Workspace;
- explanation that folder roles are saved per Workspace.

## Error State

### Source Folder Unavailable

Trigger:

- source folder was moved, renamed, deleted, or disconnected.

Show:

- error state in Settings;
- stored source folder path;
- action to choose a new folder;
- no destructive action against app metadata unless user explicitly chooses it.

### Invalid Selection

Trigger:

- selected path is not a directory;
- selected folder cannot be read.

Show:

- validation error near source folder control;
- option to retry.

### Scan Failed

Trigger:

- filesystem read error;
- permission issue;
- path validation failure.

Show:

- error state in the folder tree area;
- retry action;
- source folder remains visible.

### Save Failed

Trigger:

- local storage or sidecar write failure.

Show:

- inline error near the changed role control;
- non-blocking `sonner` error;
- role control returns to previous persisted state.

## Success State

After selecting a source folder:

- Settings shows the selected folder name and path.
- Folder tree begins loading or appears.
- A subtle success toast can confirm the folder was saved.

After changing folder roles:

- role control reflects the saved value;
- project discovery refreshes;
- Board/Table update the project set;
- avoid toast spam for every role change unless the save happens in a batch.

## Validation Rules

- Source folder must be an existing local directory.
- Project item paths sent from UI must be relative after source folder selection.
- Folder role must be one of `group`, `status`, or `project`.
- Role changes are saved for the active Workspace.
- A folder with role `project` stops traversal below that folder.
- A folder with role `status` defines a primary status group.
- Nested status folders are not supported in MVP.
- Projects outside status folders resolve to `No status`.
- Hidden dotfolders are not shown in MVP.

## Accessibility Requirements

- Settings entry must be keyboard reachable from the Left Panel.
- Source folder selection button must have an accessible label.
- Folder tree must expose hierarchy through labels and indentation.
- Role controls must be keyboard operable.
- Role controls must have labels that include the folder name.
- Save and error states must be announced or visible near the affected control.
- Focus should remain stable after a role is saved.
- Error messages must not rely on color alone.

## Responsive Behavior

- Primary target is desktop width from 1024px upward.
- Settings content uses a two-area layout when space allows: source folder summary and folder role tree.
- At narrower widths, stack the source folder section above the folder tree.
- Folder tree should scroll inside its region instead of forcing the whole app to overflow horizontally.
- Long folder paths truncate from the middle or end without breaking layout.

## Screens / Components Involved

- Left Panel Settings entry.
- Settings main screen.
- Project source folder section.
- Native folder picker trigger.
- Folder tree.
- Folder role controls.
- Workspace create/select state when no active Workspace exists.
- Board view refresh.
- Table view refresh.
- `sonner` notifications.

Preferred components:

- `Button`
- `Input` or read-only path display
- `Badge`
- `Select` or `ToggleGroup` for role selection
- `Skeleton`
- `Tooltip`
- `Separator`
- `sonner`

## Acceptance Criteria

- User can open Settings from the Left Panel.
- User can select a project source folder.
- App validates that the selected source folder exists and is readable.
- App stores the selected source folder locally.
- Settings displays the selected source folder name and path.
- Settings displays a visible folder tree for the selected source folder.
- If no Workspace exists, Settings prompts the user to create a Workspace before role assignment.
- User can assign `group`, `status`, and `project` roles to folders for the active Workspace.
- Role changes persist after app restart.
- Folders marked as `project` stop deeper project discovery.
- Folders marked as `status` become Board/Table status groups.
- Projects outside status folders appear under `No status`.
- Nested status folders are not supported in MVP.
- Board and Table refresh after role changes.
- Source folder unavailable state is handled without deleting user files.
- UI follows `docs/ui-guidelines.md`.
- UI does not put filesystem or storage logic in React components.

## Review Notes

When reviewing implementation, verify against:

- `docs/prd.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/ui-guidelines.md`

The most important behavioral check is that source folder selection is app-level, while folder roles are active-Workspace configuration.
