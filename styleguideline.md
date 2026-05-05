# Style Guideline

## Purpose

This document is the source of truth for UI, UX, visual style, component reuse, behavior, and terminology in the Electron renderer.

Before changing UI, UX, navigation, layout, renderer components, or app shell behavior, read this file. If a stable component, state, restriction, or design rule changes during development, update this file in the same change.

## Current Interface Source

The renderer uses the official shadcn/ui `dashboard-01` block installed with:

```bash
npx shadcn@latest add dashboard-01
```

This block is the baseline interface. Do not recreate a parallel dashboard shell, sidebar, table, chart, toolbar, or navigation system by hand while `dashboard-01` provides the pattern.

The renderer app composition is:

- `src/renderer/App.tsx`
- `src/renderer/components/app-sidebar.tsx`
- `src/renderer/components/site-header.tsx`
- `src/renderer/components/section-cards.tsx`
- `src/renderer/components/chart-area-interactive.tsx`
- `src/renderer/components/data-table.tsx`
- `src/app/dashboard/data.json`

## Framework Rules

- Use [shadcn/ui](https://ui.shadcn.com) as the React UI framework.
- Use source components under `src/renderer/components/ui`.
- Use `components.json` as the shadcn project contract.
- Use Tailwind CSS v4 in `src/renderer/renderer.css`.
- Use `lucide-react` icons from the block or direct imports.
- Use semantic tokens such as `bg-background`, `text-muted-foreground`, `border-border`, `bg-sidebar`, and `text-sidebar-foreground`.
- Do not introduce a second UI framework for core renderer UI.
- Do not hand-roll components when the block or installed shadcn components already provide them.

## Installed Block Components

Use these `dashboard-01` components directly:

- `AppSidebar`
- `SiteHeader`
- `SectionCards`
- `ChartAreaInteractive`
- `DataTable`
- `NavMain`
- `NavDocuments`
- `NavSecondary`
- `NavUser`

Use the block structure as installed:

- `SidebarProvider`
- `AppSidebar variant="inset"`
- `SidebarInset`
- `SiteHeader`
- `SectionCards`
- `ChartAreaInteractive`
- `DataTable`

## Installed UI Components

Current shadcn UI components include:

- `Avatar`
- `Badge`
- `Breadcrumb`
- `Button`
- `Card`
- `Chart`
- `Checkbox`
- `Drawer`
- `DropdownMenu`
- `Input`
- `Label`
- `Select`
- `Separator`
- `Sheet`
- `Sidebar`
- `Skeleton`
- `Sonner`
- `Table`
- `Tabs`
- `Toggle`
- `ToggleGroup`
- `Tooltip`

When adding UI, compose these components first. Add new shadcn components through the CLI instead of writing raw equivalents.

## Visual System

- The renderer is dark by default.
- Theme tokens live in `src/renderer/renderer.css`.
- Keep the CSS file focused on Tailwind imports, shadcn tokens, base rules, and the minimal `.dashboard-01-shell`.
- Do not reintroduce custom `.dashboard-sidebar`, `.workspace-hero`, `.workspace-grid`, `.workspace-panel`, or other parallel shell classes.
- Do not add decorative gradient orbs or marketing-style backgrounds.
- Do not scale normal text with viewport width.
- Cards, charts, tables, tabs, and sidebars should use the classes provided by the block unless there is a specific product reason to change them.

## Icon Rules

- Use `lucide-react`.
- Keep block-provided icon imports unless replacing labels with product-specific navigation.
- Do not maintain custom SVG path maps.
- Do not pass icon names as strings.
- Icon-only buttons must have accessible labels or screen-reader text.

## Electron Integration

The app still runs in Electron, but `dashboard-01` controls the renderer UI.

Current Electron rules:

- Do not add custom traffic light controls.
- Keep `titleBarStyle: "hiddenInset"` in the main process unless the user asks to change the window chrome.
- Do not rebuild the old transparent native sidebar material system around the dashboard block.
- Keep renderer imports and UI code independent from direct Electron APIs.

## Removed Legacy Renderer Patterns

These patterns must not return unless explicitly requested:

- Custom `DashboardSidebar` in `App.tsx`.
- Custom `WorkspaceContent` in `App.tsx`.
- Custom workspace localStorage sidebar state.
- Custom `workspace.dashboard.*` storage keys.
- Custom SVG icon map.
- Native workspace context menu calls from renderer.
- Custom Pointer Events reorder implementation.
- HTML `draggable`, `onDragStart`, or `onDrop` for renderer shell navigation.
- `window.prompt`.
- `window.confirm`.

## Data And Interaction

The current dashboard data source is `src/app/dashboard/data.json`, installed by `dashboard-01`.

`DataTable` owns its local row order and table state. If product data replaces the fixture later, keep the `dashboard-01` component API intact and pass data through props instead of embedding unrelated local state in `App.tsx`.

## Accessibility

- Keep shadcn component accessibility structure intact.
- Drawer, dropdown, select, tabs, and sidebar components must use their provided primitives.
- Icon-only controls must have `aria-label` or `sr-only` text.
- Keep table controls keyboard-accessible.

## Verification

After UI changes, run:

- `npm test`
- `npm run typecheck`
- `npm run build:renderer`

Structural tests should verify that:

- `dashboard-01` block files exist.
- `App.tsx` composes the installed block components.
- Tailwind CSS v4 is wired through Vite.
- `@/*` alias resolves to `src/renderer`.
- Old local hybrid shell patterns do not return.
