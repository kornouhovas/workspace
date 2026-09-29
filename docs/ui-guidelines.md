# UI Guidelines: Workspace Project Board

## Purpose

This document defines UI implementation rules for Workspace Project Board. It should be read before building or reviewing UI for Settings, Workspaces, Board view, Table view, Project Detail Panel, properties, values, and local file browsing.

The shell and shared chrome follow the pinned bb 0.44.0 reference. Workspace supplies the working data and product functions; visual acceptance requires equivalent states and measured geometry (see [reference matrix](../work/bb-interface-1wx/reference-matrix.md)).

## UI Stack

- Framework: React with TypeScript and Vite.
- Styling: Tailwind CSS v4 in `src/styles.css`.
- Component system: shadcn/ui with `radix-nova` style.
- Primitive base: Radix UI primitives through shadcn components.
- Icons: bb stroke-rounded Hugeicons through `src/lib/workspace-icons.tsx`; remaining product-specific glyphs use the existing lucide exports.
- Font: Inter Variable from `@fontsource-variable/inter` (SIL Open Font License).
- Desktop chrome uses 48px headers, 28px tabs/navigation rows, 12px tab labels with 16px line height, and 13px navigation labels. The sidebar starts at 320px and resizes from 240px to 460px; width is a shared device preference, while visibility and right-panel state remain per Workspace. Shared neutral colours come from bb 0.44.0.
- Table rows start at 36px; expanded project property rows use 48px; file tree rows start at 28px and board cards grow with content. Wrapped text and additional properties must expand naturally rather than be clipped.
- Theme: Light, Dark and System in Settings use bb neutral ink/canvas, hover/active and seam tokens in `src/styles.css`. Status and Select colours still come from project data.
- Notifications: `sonner`.
- Runtime: Electron desktop shell loading the built renderer.

## Product UI Character

Workspace Project Board is an operational desktop app for SMB teams working with local project folders. It should feel quiet, dense, and work-focused.

The UI should prioritize:

- scanning many projects quickly;
- comparing projects across properties;
- changing view settings without losing context;
- opening project files and folders quickly;
- clear filesystem safety states;
- predictable navigation and panels.

Avoid:

- marketing-page composition;
- decorative hero sections;
- oversized typography inside tool surfaces;
- nested cards;
- decorative gradients or background blobs;
- UI text that explains obvious features instead of presenting controls.

## Core Surfaces

### Left Panel

Contains:

- Add Workspace action;
- Search;
- Workspaces list;
- Settings entry.

Rules:

- Keep navigation compact and stable.
- Workspace rows should support rename, delete, and reorder affordances without visual noise.
- Use icon buttons for repeated tools such as rename, delete, settings, and reorder.
- Search should be visually tied to the active Workspace scope.
- Do not show project source folder selection in each Workspace row; it belongs in the row’s Workspace settings screen.

### Main Area

Contains active Workspace content:

- Board view;
- Table view;
- view tabs or equivalent view switcher;
- view-level controls for properties and value filters.

Rules:

- The first screen after selecting a Workspace should be the working surface, not a landing page.
- Board and Table must share the same active project set.
- Switching views must not imply data changes.
- View controls should sit close to the view tabs and use familiar icon actions where possible.
- Keep view tabs, project tabs, and their existing actions in one top row: 48px for Board/Table and expanded project details. Tabs keep text and scroll horizontally when they overflow; actions remain visible at the right.
- `Add View` and `Customize Columns` are icon-only actions with accessible names and tooltips. Hover does not add a background; keyboard focus stays visible.
- Keep primary content full-width and unframed; avoid wrapping entire page sections in cards.

### Board View

Rules:

- Board columns represent primary `Status` groups.
- Include `No status` when projects are outside status folders.
- Do not implement drag and drop between primary status groups in MVP.
- Cards should show `Name` and selected visible properties. `Status` is visible by default and may be hidden in the active view.
- Standard property rename menus apply to the display labels for `Name` and `Status`, while delete, type changes, and stored value editing stay unavailable for those system properties.
- Cards should be compact and predictable in height.
- Long project names and property values must truncate or wrap without resizing the whole board unexpectedly.
- Status columns use a stable fixed width. Removing filtered-out columns shifts the remaining columns but must not widen their cards.
- Board `Customize Columns` uses a compact slider for column width and shows the current pixel value. New width selection starts at `288px` and is limited to one third of the current working area; an already selected width remains fixed when the window becomes narrower, with horizontal scrolling used instead of resizing columns.
- Use Badge for status/value chips instead of custom styled spans.
- Empty status columns should show a compact empty state, not disappear.

### Table View

Rules:

- Table rows represent projects.
- Columns represent visible properties in the active view.
- `Name` remains visible as the required identity column; `Status` can be hidden or shown like other view columns.
- Table, Customize Columns, and Project Detail property menus should expose the same rename affordance for system `Name` and `Status` labels as for custom properties, but system-only restrictions still apply to delete/type/value mutation.
- Use the existing shadcn `Table` component and existing table patterns before custom markup.
- Column visibility and ordering are view settings.
- `Text` property values should preserve manual line breaks in stored values. In Table, `Text` columns should stay compact and truncate by default; compact editing opens a cell-width popover editor instead of growing the row. A Text column menu can enable `Wrap content` to preserve line breaks visually, wrap inside stable column widths, and allow row height to expand. Non-text values stay compact and truncate where needed.
- Table row click opens the Project Detail Panel.
- Do not duplicate edit controls in every cell if that makes the table noisy; prefer focused inline controls or the detail panel.
- Empty `Date`, `Select`, and `Multi-select` values should render as blank cells, not as `Empty` placeholder text.
- Clicking a visible `Select` or `Multi-select` value chip opens that value's direct menu for rename, delete, and color actions. Re-clicking the same chip closes its direct menu. Clicking the rest of the cell closes any direct value menu and opens the normal value picker.

### Project Detail Panel

Rules:

- Selecting an expanded project tab displays its full working screen immediately, without slide-in or intermediate preview width. Expanded screens suppress the right panel; returning to any saved view hides the right host while preserving tabs and the saved split tree.
- Expand/restore controls use bb Hugeicons ExpandIcon/CollapseIcon at 13px in 28px hit areas. Sidebar history and toggle retain fixed positions, with toggle to the right of both arrows, reserving native traffic-light space in both states. The leading header inset animates with sidebar width. Native no-drag exclusions must follow overlapping pane drag regions; verify sidebar restoration with OS pointer events, since CDP input does not exercise macOS titlebar routing.
- Right-preview card actions belong to its own header. Omit the duplicate main-header actions and the right-header new-tab plus; retain the main Add Board/Table button.
- Workspace settings stacks full-width Source, Folder role tree and Properties sections in one column; folder labels and role controls remain readable beside Navigation.
- Project Detail composes into the right panel, a project tab, or the centre split. Its dialog retains the project name as an accessible label in every host. Keep its property/file logic independent of pane chrome.
- Identify the project in the host tab; omit the duplicate content heading and its spacing above Properties. Partial preview tabs have no hover close icon or title shift. Keep header Hide/Expand and keyboard controls. Do not repeat `Name` inside the Properties table.
- Side panel open/close transitions change occupied width smoothly, retaining outgoing content and making hidden controls inert immediately. Respect reduced motion and rapid reversal. Pointer resize has no easing; reaching the full available workspace width expands the project during drag and Restore uses the partial width at drag start.
- Properties should appear before file structure.
- `Status` should appear in the Properties table by default and may be hidden or shown from the Project Detail property menu as a panel-local visibility preference, not as a system property definition mutation.
- Properties must include editable custom properties for `Text`, `Numbers`, `Date`, `Select`, and `Multi-select`.
- Project Detail Panel may create a new custom property from the Properties table through a compact `Add property` row using the same property types and service path as Table view.
- Hidden properties in Project Detail Panel should keep the same row affordances as visible properties: property-name menu, rename/delete/show actions, value editing, and drag reorder within the hidden group.
- Use autosizing multiline text controls for `Text`, text-like inline inputs for `Numbers` so arithmetic expressions can start with `=`, date-native input or date picker for dates, `Select` for single select, and checkbox/menu composition for multi-select.
- Use `Badge` for select and multi-select values, including value colors.
- Empty `Date`, `Select`, and `Multi-select` values should keep their editable row affordance but render visually blank instead of showing `Empty`.
- `Select` and `Multi-select` value chips should expose the same direct value menu as Table cells: rename value, delete value, and change value color. Re-clicking the same chip closes its direct menu. Clicking the row value area outside a chip closes any direct value menu and opens the normal value picker.
- Do not duplicate full property management controls inside every Board card or Table cell; use Settings or a focused property menu for definition/value administration.
- Board cards should display only the custom properties enabled for the active view.
- Table should display custom properties as stable-width columns in active view order.
- File structure should clearly distinguish folders from files.
- Opening a file or folder must look like an explicit user action.
- File and folder rows must show disabled/error states when the item no longer exists.
- The panel should preserve context when switching between Board and Table.

### Settings

Global Settings owns device interface language and Light/Dark/System appearance selection. Workspace settings, opened from the target row menu or its keyboard trigger, owns:

- project source folder selection;
- folder tree role configuration;
- Workspace-level configuration when relevant;
- color configuration for derived `Status` values.

Rules:

- Interface language uses a compact `Select` with `English` and `Русский`; option labels remain self-identifying in both locales.
- Locale changes update visible UI without blanking, reloading, or rescanning the active Workspace.
- Source folder selection appears in Workspace settings, with the target Workspace name in the heading. Global Settings contains only device preferences.
- Folder role controls should use clear segmented or select controls for `group`, `status`, and `project`.
- Settings tree must make parent/child relationships clear.
- Role changes should show loading and error states because they affect project discovery.
- Settings property controls should show only system `Status` and its derived values from folder roles.
- Settings may change colors for `Status` values; it must not create, rename, delete, hide, or reorder custom properties.
- Custom property creation, rename, delete, hide/show, reorder, select value management, and view-level value filters belong to the Table/Project Detail property menus and `Customize Columns`.
- Settings must not imply that deleting a Workspace deletes files on disk.

## Component Rules

Use existing components first:

- `Button`
- `Input`
- `Select`
- `DropdownMenu`
- `Checkbox`
- `Toggle`
- `ToggleGroup`
- `Separator`
- `Table`
- `Sidebar`
- `Badge`
- `Avatar`
- `Breadcrumb`
- `Tooltip`
- `Drawer`
- `Sheet`
- `Card`
- `Tabs`
- `Skeleton`
- `sonner`

Rules:

- Do not create custom `Button`, `Input`, `Select`, `Table`, `Sheet`, or `Tabs` components unless existing components cannot satisfy the flow.
- Compose feature-specific components from `components/ui`.
- If a needed shadcn component is missing, propose adding it with `npx shadcn@latest add <component>` before implementing.
- Do not re-add or overwrite existing shadcn components without reviewing the diff.
- Use built-in component variants before custom class overrides.
- Use `Separator` instead of raw `<hr>` or border-only divider elements.
- Use `Skeleton` for loading placeholders.
- Use `Badge` for status, select values, and small state indicators.
- Use `sonner` for non-blocking success and error notifications.
- Use `Tooltip` for icon-only actions whose meaning is not immediately obvious.
- Workspace dropdowns, popovers, and context menus must use the shared menu tokens from `src/components/workspace/menu-styles.ts`; action rows should include a leading lucide icon, destructive actions should use the destructive menu style, and property-type menus should include a short secondary description.
- Workspace menu checklist controls should use the shared circular checkbox token from `src/components/workspace/menu-styles.ts`; full form surfaces may keep the default square shadcn checkbox.
- Workspace dropdowns, popovers, and context menus should treat the first outside pointer/click as an inactive dismiss zone: close the open menu and do not activate, select, focus, or open controls underneath that click.

## shadcn Composition Rules

- `TabsTrigger` must be inside `TabsList`.
- `SelectItem` must be inside `SelectGroup`.
- `DropdownMenuItem` must be inside `DropdownMenuGroup` where grouping is used.
- `Sheet`, `Drawer`, and future `Dialog` components must include accessible titles.
- `Card` should use `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter` when a card is appropriate.
- Avoid cards inside cards.
- Do not dump full screen sections into `CardContent`.
- Buttons do not have `isLoading` or `isPending` props; compose disabled state with icon/spinner patterns.
- `Avatar` must include fallback if used.

## Styling Rules

Use Tailwind for layout and spacing, not for overriding shadcn component internals.

Rules:

- Use semantic tokens such as `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`, `bg-muted`.
- Avoid raw color utilities for product state such as `text-green-500` or `bg-blue-500`.
- Do not add manual `dark:` color overrides unless changing the theme itself.
- Use `gap-*`, not `space-x-*` or `space-y-*`.
- Use `size-*` when width and height are equal.
- Use `truncate` instead of manually combining overflow classes.
- Use the project `cn()` helper for conditional classes.
- Avoid manual `z-index` on shadcn overlays.
- Keep border radii aligned with the current design tokens; avoid pill-shaped surfaces unless the component pattern already uses them.
- Do not scale font size with viewport width.
- Letter spacing should remain normal unless matching an existing local component pattern.

## Icons

Rules:

- Use the bb stroke-rounded icon adapter for shared chrome. Use a remaining product glyph only when it has no equivalent bb affordance.
- Use icons for repeated tool actions: add, search, settings, rename, delete, hide/show, filter, columns, folder, file, open, back.
- In `Button`, icons should use `data-icon="inline-start"` or `data-icon="inline-end"`.
- Do not apply custom sizing classes to icons inside shadcn components unless the component pattern requires it.
- Icon-only buttons must have accessible labels and tooltips.
- Do not use text-only rounded rectangles where a familiar icon action is clearer.

## Forms And Editing

Rules:

- Form controls must have labels.
- Validation errors must be tied to the field they describe.
- Destructive actions need confirmation and clear consequence text.
- Property type choices should use select or segmented controls.
- Binary settings should use checkbox or toggle controls.
- Value visibility filters should use checkboxes, multi-select UI, or menu checklists depending on density.
- Numeric values should use numeric inputs.
- Date values should use a date input or date picker pattern approved by the existing component set.
- Changes that persist immediately must show a success or saved state only when useful; avoid noisy toast spam for every keystroke.

## States

Every feature surface should define applicable states before implementation.

### Loading

- Use `Skeleton` for panels, tables, and card lists.
- Do not use generic centered spinners for dense surfaces unless the whole page is blocked.
- Loading should preserve layout dimensions where possible.

### Empty

Empty states must be specific:

- no source folder selected;
- source folder empty;
- no projects found;
- no projects in this status;
- no search results;
- no custom properties;
- no files in project folder.

Empty states should include one useful next action when obvious.

### Error

Error states must be specific:

- source folder unavailable;
- path outside source folder rejected;
- file no longer exists;
- sidecar unavailable;
- storage save failed;
- validation failed;
- migration failed.

Errors involving filesystem safety should be explicit and avoid suggesting unsafe workarounds.

### Success

- Use subtle success feedback for saved settings.
- Use `sonner` for discrete events such as source folder saved, Workspace created, property deleted, or file open failed.
- Avoid persistent success banners for routine edits.

## Accessibility

Rules:

- All interactive controls must be keyboard reachable.
- Icon-only controls need accessible names.
- Overlays need accessible titles.
- Form controls need labels and validation descriptions.
- Focus should move into opened overlays and return to the trigger when closed.
- Table rows and cards that open the detail panel must support keyboard activation.
- Do not rely on color alone for status or validation.
- Maintain visible focus states from shadcn components.

## Responsive And Electron Layout

The current Electron shell has desktop-oriented minimum dimensions. The UI still needs responsive behavior for smaller windows.

Rules:

- Primary target: desktop widths from 1024px upward.
- Left Panel should collapse or compact before content becomes unusable.
- Board view should allow horizontal scrolling for many status columns.
- Table view should preserve readable columns with horizontal scrolling when needed.
- Project Detail Panel should not cover the entire app on desktop unless the viewport is narrow.
- Avoid viewport-width font scaling.
- Fixed-format elements such as board columns, toolbar buttons, and table rows need stable dimensions.

## File Browser UI

Rules:

- Folders and files must be visually distinct.
- Hidden dotfiles are not shown in MVP unless architecture changes.
- File type previewability should be clear before click when possible.
- Opening a file or folder should be explicit and reversible at the UI level.
- Paths shown to users should be relative to the project source folder unless the full path is necessary in Settings.
- Long paths must truncate from the middle or end without breaking layout.

## Review Checklist

Before a UI task is considered done, verify:

- screen follows `docs/prd.md` and relevant UX flow;
- UI follows `docs/architecture.md` layer rules;
- no filesystem or storage logic lives in React components;
- existing shadcn components are used before custom markup;
- loading, empty, error, and success states are implemented where applicable;
- keyboard access works for primary actions;
- text does not overflow buttons, cards, table cells, or panels;
- screenshots are captured for changed screens when practical;
- no unapproved dependencies were added.

## Screenshot Review

For changed screens, Codex should run the app when practical and capture screenshots for:

- default populated state;
- loading state when controllable;
- empty state;
- error state;
- narrow desktop viewport when layout risk exists.

Screenshots should be reviewed against:

- this file;
- `docs/prd.md`;
- relevant flow document under `docs/flows/`;
- acceptance criteria in the backlog item.

## Component Placement

Current project structure:

```text
src/components/
  app-sidebar.tsx
  data-table.tsx
  site-header.tsx
  ui/
src/styles.css
```

Rules:

- Shared reusable primitives stay in `src/components/ui/`.
- Product-specific components can live in `src/components/` while the app is small.
- If feature UI grows, introduce feature folders only after approval, for example `src/features/workspace/components/`.
- Do not move shadcn component files casually; updates and CLI behavior expect stable paths from `components.json`.
- Global theme tokens belong in `src/styles.css`.
