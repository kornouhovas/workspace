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
- Desktop chrome uses 48px headers, 28px tabs/navigation rows, 12px tab labels with 16px line height, and 13px navigation labels. The sidebar starts at 320px and resizes from 240px to 460px; width is a shared device preference, while visibility and right-panel state remain per Workspace. The chrome geometry remains the accepted bb 0.44.0 adaptation; neutral and semantic roles now follow the pinned af72bb81 design source (see [application policy](development/design/bb-workspace-policy.md)).
- Table rows start at 32px; expanded project property rows start at 32px and grow with wrapped values; file tree rows start at 28px and board cards grow with content. Wrapped text and additional properties must expand naturally rather than be clipped.
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
- Use the shared Status move operation for Board column drops and Table row-handle drops across explicit Status groups.
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

- Partial previews remember selection and explicit closed state per saved view within each Workspace. Ordinary Board/Table switches restore the destination’s project after lookup; no visible empty shell or stale project is shown. Keep the previous preview inert while the requested view awaits its projection and lookup; discard retained exit content when that destination activates; explicit close in the same view keeps the outgoing card during width release. A completed primary click on free Board/Table background closes preview and returns focus to Workspace. Protect editable cells, cards/rows, headers/groups, menus, toolbar, tabs and pane chrome; menu dismissal consumes the first outside click, and drag/scroll/selection/context gestures do not close preview.
- Selecting an expanded project tab displays its full working screen immediately, without slide-in or intermediate preview width. Expanded screens suppress the right panel; returning to any saved view hides the right host while preserving tabs and the saved split tree.
- Expand/restore controls use bb Hugeicons ExpandIcon/CollapseIcon at 13px in 28px hit areas. Sidebar toggle sits immediately after native traffic lights; history stays at the sidebar’s trailing edge and moves beside the toggle when collapsed. Reserve native traffic-light space in both states. The leading header inset animates with sidebar width. Native no-drag exclusions must follow overlapping pane drag regions; verify sidebar restoration with OS pointer events, since CDP input does not exercise macOS titlebar routing.
- Right-preview card actions belong to its own header. Omit the duplicate main-header actions and the right-header new-tab plus; retain the main Add Board/Table button.
- Workspace settings stacks Source, Folder role tree and Properties in a centered column capped at 768px, with 24px outer padding (16px horizontal at compact desktop widths); folder labels and role controls remain readable beside Navigation.
- Project Detail composes into the right panel, a project tab, or the centre split. Its dialog retains the project name as an accessible label in every host. Keep its property/file logic independent of pane chrome.
- Identify the project in the host tab; omit the duplicate content heading and its spacing above Properties. Partial preview tabs have no hover close icon or title shift. Keep header Hide/Expand and keyboard controls. Do not repeat `Name` inside the Properties rows.
- Side panel open/close transitions change occupied width smoothly, retaining outgoing content and making hidden controls inert immediately. Respect reduced motion and rapid reversal. Pointer resize has no easing; reaching the full available workspace width expands the project during drag and Restore uses the partial width at drag start.
- Properties should appear before file structure. Visible, hidden and Add property rows are borderless, with aligned label/value columns, 32px minimum height and accessible hover/focus editing. Do not add an outer table frame or cell/row grid.
- Customize Columns and Group use compact 12px menu rows and muted section descriptions; Group by and Sort use borderless 28px Radix Select triggers with a trailing value and chevron. Preserve disabled, selection, keyboard and portal dismissal behavior.
- `Status` should appear in the Properties rows by default and may be hidden or shown from the Project Detail property menu as a panel-local visibility preference, not as a system property definition mutation.
- Properties must include editable custom properties for `Text`, `Numbers`, `Date`, `Select`, and `Multi-select`.
- Project Detail Panel may create a new custom property from the Properties rows through a compact `Add property` row using the same property types and service path as Table view.
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

Table grouping uses the common dropdown/submenu/Button primitives and existing compact menu styles. Group by and Sort are independently named keyboard controls. Section toggle buttons expose `aria-expanded` and a localized action plus full group name; long section names truncate with a full title. Each non-empty group has a left drag handle available under every sort; Arrow Up/Down on the handle provides the keyboard alternative; visibility controls are named Show/Hide group. Expanded non-empty sections repeat their own column header on a shared column grid and horizontal scroll, with a compact 20px gap between sections. Collapsed and empty sections retain only their heading.

## Applied shared design foundation

The imported [DESIGN_RULES](development/DESIGN_RULES.md) is reference material. The [complete applicability matrix](../work/workspace-6fh/applicability.md) records each section and the Workspace adaptations.

- Both themes use ink/canvas semantic roles. Raised surfaces mix ink 2.5% with transparency; selection mixes primary 16% in light and 12% in dark. Dark input borders use ink 32.6%. File and folder glyphs use `file-accent`; status and Select dots retain source data colours. Errors use `destructive-text`, with separate destructive fill/foreground roles.
- Generic Button/Input/Select defaults are 36px high with 6px radius and 1px focus ring. Button foreground/background colours are distinct from the primary role. Input stays transparent. Workspace toolbar, tree, tab and inline editor density remains 24–32px where its existing row contract requires it. Tables use muted/50 hover; menus use state-hover. Existing search, rename, tab and cell controls retain their stronger 2px focus treatment.
- Base text is 15/22px; small text is 13px with the source inherited line ratio, extra-small is 12/16px. Root remains 16px so rem-based geometry is stable. Existing explicit 20px editor leading is a local readability adaptation.
- Menus remember the last pointer-hovered item until keyboard navigation takes ownership. Tooltips wait 250ms, wrap multiline content and fit within available width up to 320px. Portals remain outside native titlebar drag regions. Workspace dropdowns intercept the first outside pointer in capture phase so underlying controls cannot activate or gain focus; nested menu portals remain interactive.
- Rename keeps its draft and an associated error until storage acknowledges success. Composing Enter does not submit; pending requests prevent duplicate Enter/blur saves; Escape restores focus and ignores late acknowledgements. A failed view rename shows an associated error in a bounded portal below its input, outside the clipped tab strip. Grouped Table retains empty group headings while announcing the search query and providing Clear search.
- Loading uses an announced status, errors stay visible, and recovery uses the shared focusable Button. Toasts use neutral semantic colours, 4-second duration and a close action. Hidden sidebar content remains inert; reduced-motion skips animation.

Native Electron evidence and measured styles are recorded in [workspace-6fh](../work/workspace-6fh/). Renderer screenshots are supplementary diagnostics. These measurements do not claim a live bb comparison or a complete VoiceOver audit.

Locale changes update visible labels without projection reloads, folder rescans or property writes. Subsequent legitimate workspace loads use the current locale.

Explicit Status selection in preview/expanded details uses existing chips, folder-derived labels/colors, keyboard focus and radio selection. Disabled destinations include a textual reason. Move activity occupies one 28px header control immediately after Sidebar, exposes from/to/project/state details, remains visible with the sidebar hidden, and respects reduced motion. No percentage or artificial production delay is shown. Board/card and Table/cell Status pickers use the same operation. Table has a compact internal left hover/focus handle for vertical row reorder; the whole row moves and neighbouring rows shift by its captured height to expose the future insertion gap. A drop across explicit Status groups uses the existing safe move; other-property group crossings are unavailable. No separate Status panel appears. Hover/focus/drag do not change widths. Name has no separate hover background inside the general card/row highlight; keyboard focus and editor/Status states remain visible. Board targets use available/active background fills without new outlines. No status is hidden only from picker/drop choices, keeping derived labels, groups and projects accessible. See [Status move contract](api/workspace-status-move.md).


### Board and Table visual refinement (workspace-zlj)

Board captures an inert visual snapshot of the complete rendered card at drag activation, retaining its exact border-box width/height, property content, wrapping and padding until drop or cancellation, including scrolling and different target-column widths. Each column uses `px-1` (4px from the existing spacing scale) on both sides inside its saved total width; cards therefore occupy saved width minus 8px. Existing saved widths are never rewritten. Compact content-height backgrounds and available/active background fills retain the same geometry.

Saved-view activation keeps the previous complete service surface, its selected tab and partial preview visible and inert until the destination projection and saved preview are ready together. The waiting surface retains its previous view identity; the requested tab is marked busy, and navigation can supersede the request. The first destination frame contains its authoritative grouping, columns and filters, without a skeleton, fabricated flat rows or empty intermediate screen. Returning to the still-ready retained view can activate it immediately. Other targets are read freshly from the service; confirmed data changes invalidate retained readiness, and superseded requests cannot activate a newer intent. First load without a previous ready surface retains announced loading. Grouping, sort/manual order, hidden/collapsed groups, hide-empty and project ranks remain per-view settings; search remains scoped to the Workspace.

Table drag previews the future insertion gap by moving intervening rows using their measured layout and the captured dragged-row height, including section headings/headers/gaps on allowed Status crossings. The dragged row preserves its height and column grid. Ordinary thin separators and keyboard focus remain; there is no thick underline, insertion line or preview shadow. Scroll compensation uses the captured layout, avoiding target feedback from animated rows. Reduced-motion removes displacement animation. Escape, pointer cancellation and outside drops restore the original layout without a write; successful drops synchronously convert the preview into a provisional in-table placement while the existing rank and safe Status-move services confirm it. Neighbours retain their preview positions through release and successful responses; no original-order frame or second displacement animation appears. Status previews account for repeated headers appearing in an empty destination or disappearing from an emptied source. Pending blocks repeat actions and retains the common move indicator; save/move errors explicitly return to the confirmed projection. View changes discard the local provisional placement, and late responses cannot replace a different active view. No success is announced before service confirmation.

### Board column ordering (workspace-fns)

Column names are keyboard reachable reorder handles with visible focus, full accessible labels, truncation and help for Alt + Left/Right and Escape. Preview moves only header name/colour/count; bodies and their content-height backgrounds stay fixed until drop. Preserve the fixed width, shared scrolling, details preview and card Status interactions. Saving blocks conflicting drags; failure restores a coherent confirmed order with localized feedback. Edge scrolling reaches offscreen columns. Displacement is immediate and remains understandable under reduced motion. See [Board column order](flows/board-table-views.md#board-column-order-workspace-fns).
