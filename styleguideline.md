# Style Guideline

## Purpose

This document is the source of truth for UI, UX, visual style, component reuse, behavior, and terminology in the Electron desktop renderer.

Before changing UI, UX, navigation, layout, renderer components, or app shell behavior, read this document and follow the patterns here. If a new stable component, state, restriction, or design rule appears during development, update this document in the same change.

## Product Direction

The app is a local workspace dashboard for project folders and development workflows. The interface should feel like a focused desktop productivity tool built with a modern shadcn dashboard/sidebar system.

The current permanent direction is a full shadcn/ui dashboard shell, not a custom native Electron sidebar clone. The UI may keep Electron window integration where useful, but shadcn composition, Tailwind CSS v4 tokens, and lucide-react icons are the primary interface system.

## Framework Rules

- Use [shadcn/ui](https://ui.shadcn.com) as the default React UI framework.
- Use source components under `src/renderer/components/ui`.
- Use `components.json` as the shadcn project contract.
- Use Tailwind CSS v4 in `src/renderer/renderer.css`.
- Use semantic tokens such as `bg-background`, `text-muted-foreground`, `border-border`, `bg-sidebar`, and `text-sidebar-foreground`.
- Do not introduce a second component framework for core UI.
- Do not hand-roll a component when an installed shadcn component can be composed.
- Use local CSS only for app shell layout, fixed dashboard surfaces, and product-specific composition.
- Keep custom CSS class names stable and descriptive.

## Installed UI Components

Current shadcn components:

- `Sidebar`
- `Button`
- `Input`
- `Badge`
- `Separator`
- `Tooltip`
- `Avatar`
- `Sheet`
- `Skeleton`

Use full shadcn composition:

- Dashboard shell: `SidebarProvider`, `Sidebar`, `SidebarInset`.
- Sidebar layout: `SidebarHeader`, `SidebarContent`, `SidebarFooter`.
- Sidebar groups: `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`.
- Sidebar navigation: `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`.
- Tooltips: `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`.

## Icon Rules

- Use `lucide-react` for icons.
- Import icons directly from `lucide-react`.
- Do not maintain custom SVG path maps in React.
- Do not pass icon names as strings.
- Buttons with text place icons with `data-icon="inline-start"` or `data-icon="inline-end"`.
- Icon-only buttons must have `aria-label`.
- Do not add manual sizing classes to icons inside shadcn buttons unless a local component explicitly requires it.

## Typography

- Use the shadcn/Tailwind font token `--font-sans`.
- The current font stack is `Geist Variable`, `OpenAI Sans`, system UI, and platform sans fallbacks.
- Body text defaults to 16px browser sizing.
- Sidebar labels use compact shadcn menu sizing.
- Dashboard headings may be larger, but only in the main workspace content area.
- Do not use negative letter spacing.
- Do not scale normal control text with viewport width.

## Color And Theme

- The renderer is dark by default.
- Tokens live in `src/renderer/renderer.css`.
- Use OKLCH CSS variables for theme tokens.
- Do not hardcode Tailwind palette classes such as `bg-blue-500` for app surfaces.
- Use semantic colors and shadcn variants first.
- The palette should stay mostly neutral with restrained green and multi-color signal accents.
- Avoid decorative gradient orbs and marketing-style background effects.

## Dashboard Shell

The root renderer shell is the shadcn dashboard:

- `.dashboard-shell`: full viewport background and dark theme scope.
- `.dashboard-sidebar`: shadcn `Sidebar` customization.
- `.dashboard-inset`: shadcn `SidebarInset` main surface.
- `.window-drag-region`: top toolbar and Electron drag area.
- `.workspace-content`: main workspace body.

The main screen should show the actual workspace tool immediately. Do not replace it with a landing page or marketing hero.

## Dashboard Sidebar Guidelines

The sidebar is now a shadcn `Sidebar`, not the previous custom `Left Panel`.

Rules:

- Use `SidebarProvider` at the top of the renderer app.
- Use `Sidebar` with `collapsible="icon"` for dashboard behavior.
- Use `SidebarTrigger` for collapse behavior.
- Keep `Command+B` / `Ctrl+B` behavior provided by shadcn sidebar.
- Use `SidebarMenuButton` for selectable workspace rows.
- Use `SidebarMenuAction` for row actions.
- Use `Badge` for compact row status.
- Keep workspace names truncatable.
- Empty search state says `No workspace`.
- Settings remains in `SidebarFooter`.

Allowed workspace row states:

- Normal
- Hover
- Active selected workspace
- Inline rename
- Inline delete confirmation
- Disabled delete when only one workspace remains

Removed legacy rules:

- Workspace reorder by custom Pointer Events is no longer required.
- FLIP row animation is no longer required.
- Native Electron context menu for workspace items is no longer required.
- DOM-free context actions are no longer required.
- `--codex-sidebar-glass` and transparent Electron vibrancy sidebar styling are no longer part of the design system.

## Window Integration

The app still runs in Electron and may use a hidden title bar window.

Current window integration rules:

- Top toolbar uses `.window-drag-region` with `-webkit-app-region: drag`.
- Buttons inside `.window-drag-region` use `-webkit-app-region: no-drag`.
- Do not add custom traffic light controls.
- Do not put critical controls under the macOS traffic light area.

Electron-specific UI constraints from the old sidebar design should not block shadcn dashboard/sidebar composition unless the user explicitly asks to restore them.

## Workspace Behavior

Workspace data is renderer-local state persisted to `localStorage`.

Current keys:

- `workspace.dashboard.workspaces`
- `workspace.dashboard.selectedWorkspaceId`

Behavior:

- New workspace name is `Workspace`.
- New workspace becomes selected.
- Search filters workspace names case-insensitively.
- Inline rename saves on submit or blur.
- Empty rename is ignored.
- `Escape` cancels inline rename.
- Delete requires inline confirmation.
- Delete is disabled when only one workspace remains.
- Deleting the selected workspace selects the first remaining workspace.

Do not use:

- `window.prompt`
- `window.confirm`
- HTML `draggable`
- `onDragStart`
- `onDrop`

## Accessibility

- Main content has `aria-label="Workspace surface"`.
- Search input has stable id `workspaceSearch`.
- Workspace list has stable id `workspaceList`.
- Icon-only buttons must have `aria-label`.
- Active workspace display uses `aria-live="polite"` where appropriate.
- Inline rename input must have an `aria-label`.
- Tooltips should describe unfamiliar icon-only controls.

## Testing Expectations

After UI changes, run:

- `npm test`
- `npm run typecheck`
- `npm run build:renderer`

Structural tests should verify:

- shadcn configuration exists.
- Tailwind CSS v4 is wired through Vite.
- `@/*` alias resolves to `src/renderer`.
- Renderer imports shadcn components from `@/components/ui`.
- Renderer imports icons from `lucide-react`.
- Old custom icon maps, native workspace context menu calls, and custom Pointer Events drag handlers do not return unless deliberately reintroduced.
