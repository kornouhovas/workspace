# Shadcn Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Electron-specific left panel screen with a shadcn-style React dashboard/sidebar implementation.

**Architecture:** Keep the current Vite/Electron renderer entrypoint and workspace state model, but move visual structure to shadcn source components, lucide icons, Tailwind CSS, and semantic CSS variables. Update tests so the new shadcn dashboard/sidebar structure is verified.

**Tech Stack:** React 19, Vite, Electron, shadcn/ui, Tailwind CSS, lucide-react, node:test.

---

### Task 1: Renderer Structure Tests

**Files:**
- Modify: `test/leftPanelStructure.test.js`

- [ ] **Step 1: Write the failing test**

Replace old Electron-sidebar assertions with checks for `components.json`, Tailwind imports, shadcn UI imports, lucide direct imports, `DashboardSidebar`, `WorkspaceContent`, `SidebarProvider`, `Sidebar`, `SidebarMenuButton`, `Button`, `Input`, `Badge`, and the absence of the old native context menu and Pointer Events drag functions.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/leftPanelStructure.test.js`
Expected: FAIL because shadcn files and imports do not exist yet.

### Task 2: Shadcn Project Setup

**Files:**
- Create: `components.json`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`
- Modify: `src/renderer/renderer.css`
- Create: `src/renderer/lib/utils.ts`
- Create: `src/renderer/components/ui/*.tsx`

- [ ] **Step 1: Install dependencies**

Run: `npm install tailwindcss @tailwindcss/vite class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-slot @radix-ui/react-tooltip @radix-ui/react-dialog`

- [ ] **Step 2: Initialize shadcn metadata and components**

Run: `npx shadcn@latest init --template vite --base-color neutral --yes`
Run: `npx shadcn@latest add sidebar button input badge separator tooltip avatar`

- [ ] **Step 3: Ensure Vite and TypeScript aliases resolve**

Set Vite alias `@` to `src/renderer` and TypeScript `baseUrl`/`paths` to the same renderer root.

### Task 3: Dashboard Renderer

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/renderer.css`

- [ ] **Step 1: Replace custom SVG icon map**

Use direct lucide-react imports such as `PanelLeft`, `Search`, `Folder`, `Plus`, `Settings`, `MoreHorizontal`, `Bell`, `Command`, `Activity`, and `GitBranch`.

- [ ] **Step 2: Compose shadcn dashboard**

Use `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarFooter`, `SidebarInset`, `SidebarTrigger`, `Button`, `Input`, `Badge`, `Separator`, `TooltipProvider`, `Tooltip`, `TooltipContent`, `TooltipTrigger`, and `Avatar`.

- [ ] **Step 3: Preserve useful workspace behavior**

Keep localStorage-backed workspace list, selected workspace, search filtering, inline rename, inline delete confirmation, and current workspace preview.

### Task 4: Structural Documentation Cleanup

**Files:**
- Modify: relevant project documentation

- [ ] **Step 1: Remove stale renderer guidance**

Remove stale source-of-truth wording after the renderer structure is covered by tests.

### Task 5: Verification And Commit

**Files:**
- All changed project files

- [ ] **Step 1: Run checks**

Run: `npm test`
Run: `npm run typecheck`
Run: `npm run build:renderer`

- [ ] **Step 2: Commit**

Run: `git status --short`
Run: `git add .`
Run: `git commit -m "feat: redesign renderer with shadcn dashboard"`
