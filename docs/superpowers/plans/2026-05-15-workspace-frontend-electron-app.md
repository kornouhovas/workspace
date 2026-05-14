# Workspace Frontend Electron App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard template with the Workspace Project Board Electron frontend and connect React to workspace services through the accepted preload IPC bridge.

**Architecture:** React remains a thin renderer. It calls `WorkspaceServiceClient` through a renderer IPC transport exposed by preload as `window.workspace.request(method, payload)`. Electron main dispatches service methods to backend/local services; React never imports filesystem, backend, sidecar, or storage modules directly.

**Tech Stack:** Electron, React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Node test runner, Go sidecar with any-store.

---

## Relevant Specs

- `docs/prd.md`
- `docs/architecture.md`
- `docs/ui-guidelines.md`
- `docs/flows/board-table-views.md`
- `docs/flows/settings-source-folder-and-roles.md`
- `docs/api/workspace-views.md`
- `docs/adr/002-electron-preload-ipc-bridge.md`
- `docs/backlog/workspace-frontend-electron-app.md`

## File Structure

Planned files and responsibilities:

- `electron/main.js`: create BrowserWindow, load preload, register workspace IPC dispatcher.
- `electron/preload.js`: expose safe `window.workspace.request`.
- `src/types/workspace-api.d.ts`: renderer global type for `window.workspace`.
- `src/workspaceRendererTransport.ts`: transport adapter used by `WorkspaceServiceClient` in React.
- `src/workspaceAppState.ts`: app-level state reducer and view models for UI.
- `src/workspaceMockData.ts`: deterministic projection-shaped data for UI tests and unavailable-backend empty states.
- `src/App.tsx`: product app shell only.
- `src/components/workspace/left-panel.tsx`: Add Workspace, Search, Workspace list, Settings entry.
- `src/components/workspace/settings-view.tsx`: source folder and folder role UI surface.
- `src/components/workspace/view-tabs.tsx`: Board/Table saved view switcher and view actions.
- `src/components/workspace/board-view.tsx`: Board projection renderer.
- `src/components/workspace/table-view.tsx`: Table projection renderer.
- `src/components/workspace/project-detail-panel.tsx`: right Sheet for project properties and file tree.
- `src/components/workspace/view-filter-menu.tsx`: visible property and value filter controls.
- `src/components/workspace/states.tsx`: loading, empty, and error states.
- `test/runtimeMode.test.js`: Electron runtime/preload assertions.
- `test/dashboardStructure.test.js`: replace dashboard assertions with product UI structure assertions.
- `test/rendererBoundary.test.js`: assert React files do not import backend, sidecar, or Node modules.
- `test/workspaceRendererTransport.test.js`: renderer transport behavior.

## Task 1: Fix Frontend Quality Gate Baseline

**Files:**

- Inspect: `package.json`
- Inspect: `tsconfig.json`
- Inspect: `vite.config.ts`
- Inspect: `src/**/*.ts`
- Inspect: `src/**/*.tsx`
- Modify only if needed after diagnosis.

- [ ] **Step 1: Reproduce current frontend command behavior**

Run:

```bash
npm run typecheck
```

Expected today: command may hang without diagnostics. If it hangs longer than 90 seconds, stop it and record the process tree.

Run:

```bash
npm run build:renderer
```

Expected today: command may hang without diagnostics. If it hangs longer than 90 seconds, stop it and record the process tree.

- [ ] **Step 2: Diagnose the smallest cause**

Run:

```bash
npm exec tsc -- --version
npm exec tsc -- --noEmit --listFilesOnly
npm exec vite -- --debug build
```

Expected: identify whether the hang is TypeScript resolution, Vite plugin startup, dependency resolution, or an existing source issue.

- [ ] **Step 3: Add a focused regression test if the fix changes project config**

If the fix changes `tsconfig.json`, `vite.config.ts`, or package scripts, update `test/runtimeMode.test.js` with a concrete assertion for the intended config. Example:

```js
assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
assert.equal(packageJson.scripts["build:renderer"], "vite build");
```

If the fix is only dependency cache/environmental, do not change tests.

- [ ] **Step 4: Verify frontend gates**

Run:

```bash
npm run typecheck
npm run build:renderer
```

Expected: both commands complete with exit code 0.

- [ ] **Step 5: Commit**

If files changed:

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts test/runtimeMode.test.js
git commit -m "Fix frontend build quality gates"
```

If no files changed, do not create a commit and report the environment-only finding.

## Task 2: Add Electron Preload IPC Bridge

**Files:**

- Create: `electron/preload.js`
- Modify: `electron/main.js`
- Create: `src/types/workspace-api.d.ts`
- Modify: `test/runtimeMode.test.js`

- [ ] **Step 1: Write failing runtime test**

Update `test/runtimeMode.test.js` to assert:

```js
const preload = await readFile(new URL("../electron/preload.js", import.meta.url), "utf8");

assert.match(electronMain, /preload:\s*join\(__dirname,\s*"preload\.js"\)/);
assert.match(preload, /contextBridge/);
assert.match(preload, /ipcRenderer/);
assert.match(preload, /exposeInMainWorld\("workspace"/);
assert.match(preload, /workspace:request/);
assert.doesNotMatch(preload, /require\(/);
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test test/runtimeMode.test.js
```

Expected: FAIL because `electron/preload.js` and preload config do not exist.

- [ ] **Step 3: Create preload bridge**

Create `electron/preload.js`:

```js
import { contextBridge, ipcRenderer } from "electron";

const allowedMethods = new Set([
  "workspace.getRoot",
  "workspace.setRoot",
  "workspace.scan",
  "workspace.listEntries",
  "workspace.saveProperty",
  "workspace.listPropertyValues",
  "workspace.listViews",
  "workspace.createView",
  "workspace.setActiveView",
  "workspace.updateView",
  "workspace.reorderViews",
  "workspace.deleteView",
  "workspace.getViewProjection",
  "workspace.reveal",
  "workspace.previewFile",
]);

contextBridge.exposeInMainWorld("workspace", {
  request(method, payload = {}) {
    if (!allowedMethods.has(method)) {
      return Promise.reject(new Error(`Unsupported workspace method: ${method}`));
    }
    return ipcRenderer.invoke("workspace:request", method, payload && typeof payload === "object" ? payload : {});
  },
});
```

- [ ] **Step 4: Wire preload in BrowserWindow**

Modify `electron/main.js` `webPreferences`:

```js
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  preload: join(__dirname, "preload.js"),
},
```

- [ ] **Step 5: Add renderer global type**

Create `src/types/workspace-api.d.ts`:

```ts
export {};

declare global {
  interface Window {
    workspace: {
      request(method: string, payload?: Record<string, unknown>): Promise<unknown>;
    };
  }
}
```

- [ ] **Step 6: Verify**

Run:

```bash
node --test test/runtimeMode.test.js
npm run typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 7: Commit**

```bash
git add electron/main.js electron/preload.js src/types/workspace-api.d.ts test/runtimeMode.test.js
git commit -m "Add workspace preload IPC bridge"
```

## Task 3: Add Renderer Workspace Transport

**Files:**

- Create: `src/workspaceRendererTransport.ts`
- Create: `test/workspaceRendererTransport.test.js`

- [ ] **Step 1: Write failing transport test**

Create `test/workspaceRendererTransport.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

test("renderer workspace transport delegates to window.workspace.request", async () => {
  const { createWorkspaceRendererTransport } = await import("../src/workspaceRendererTransport.ts");
  const calls = [];
  const transport = createWorkspaceRendererTransport({
    workspace: {
      async request(method, payload) {
        calls.push({ method, payload });
        return { ok: true, method, payload };
      },
    },
  });

  assert.deepEqual(await transport.request("workspace.listViews", { workspaceId: "workspace:ops" }), {
    ok: true,
    method: "workspace.listViews",
    payload: { workspaceId: "workspace:ops" },
  });
  assert.deepEqual(calls, [
    { method: "workspace.listViews", payload: { workspaceId: "workspace:ops" } },
  ]);
});

test("renderer workspace transport rejects missing preload bridge", async () => {
  const { createWorkspaceRendererTransport } = await import("../src/workspaceRendererTransport.ts");
  const transport = createWorkspaceRendererTransport({});

  await assert.rejects(
    () => transport.request("workspace.listViews", { workspaceId: "workspace:ops" }),
    /Workspace IPC bridge is unavailable/,
  );
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test test/workspaceRendererTransport.test.js
```

Expected: FAIL because `src/workspaceRendererTransport.ts` does not exist.

- [ ] **Step 3: Implement transport**

Create `src/workspaceRendererTransport.ts`:

```ts
type WorkspaceBridgeHost = {
  workspace?: {
    request(method: string, payload?: Record<string, unknown>): Promise<unknown>;
  };
};

export function createWorkspaceRendererTransport(host: WorkspaceBridgeHost = window) {
  return {
    async request(method: string, payload: Record<string, unknown> = {}) {
      if (!host.workspace || typeof host.workspace.request !== "function") {
        throw new Error("Workspace IPC bridge is unavailable.");
      }
      return host.workspace.request(method, payload);
    },
  };
}
```

- [ ] **Step 4: Verify**

Run:

```bash
node --test test/workspaceRendererTransport.test.js
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/workspaceRendererTransport.ts test/workspaceRendererTransport.test.js
git commit -m "Add renderer workspace transport"
```

## Task 4: Replace Dashboard Template With Product App Shell

**Files:**

- Modify: `src/App.tsx`
- Create: `src/components/workspace/left-panel.tsx`
- Create: `src/components/workspace/states.tsx`
- Modify: `test/dashboardStructure.test.js`
- Create: `test/rendererBoundary.test.js`

- [ ] **Step 1: Replace dashboard structure test with product shell assertions**

Update `test/dashboardStructure.test.js` to stop asserting `dashboard-01` composition and assert the Workspace shell:

```js
assert.match(appSource, /from "@\/components\/workspace\/left-panel"/);
assert.match(appSource, /Workspace Project Board/);
assert.match(appSource, /<WorkspaceLeftPanel/);
assert.match(appSource, /data-testid="workspace-main"/);
assert.doesNotMatch(appSource, /app\/dashboard\/data\.json/);
assert.doesNotMatch(appSource, /ChartAreaInteractive/);
assert.doesNotMatch(appSource, /SectionCards/);
```

- [ ] **Step 2: Add renderer boundary test**

Create `test/rendererBoundary.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("renderer components do not import backend storage or Node runtime modules", async () => {
  const { stdout } = await execFileAsync("rg", ["--files", "src"], { cwd: new URL("..", import.meta.url) });
  const files = stdout
    .trim()
    .split("\\n")
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

  for (const file of files) {
    if (file.includes("workspaceRendererTransport")) {
      continue;
    }
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from "node:/, file);
    assert.doesNotMatch(source, /from "\\.\\/workspaceBackend|from "@\\/workspaceBackend|workspaceBackend\\.js/, file);
    assert.doesNotMatch(source, /workspaceSidecarClient/, file);
  }
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
node --test test/dashboardStructure.test.js test/rendererBoundary.test.js
```

Expected: dashboard structure test fails because App still uses dashboard template.

- [ ] **Step 4: Create app shell components**

Create `src/components/workspace/left-panel.tsx` with compact nav sections:

```tsx
import { FolderKanban, Plus, Search, Settings } from "@/lib/lucide-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function WorkspaceLeftPanel() {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="electron-window-drag flex h-12 items-center px-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FolderKanban className="size-4" aria-hidden="true" />
          <span>Workspace Project Board</span>
        </div>
      </div>
      <div className="electron-window-no-drag flex flex-1 flex-col gap-3 px-3 py-3">
        <Button className="w-full justify-start" size="sm">
          <Plus data-icon="inline-start" />
          Add Workspace
        </Button>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Search
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Project name" />
          </div>
        </label>
        <Separator />
        <div className="grid gap-1">
          <p className="px-2 text-xs font-medium text-muted-foreground">Workspaces</p>
          <Button variant="secondary" size="sm" className="justify-start">Operations</Button>
        </div>
        <div className="mt-auto">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <Settings data-icon="inline-start" />
            Settings
          </Button>
        </div>
      </div>
    </aside>
  );
}
```

Create `src/components/workspace/states.tsx`:

```tsx
import { Button } from "@/components/ui/button";

export function WorkspaceEmptyState() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 text-center">
      <div>
        <h2 className="text-lg font-semibold">No source folder selected</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Select a project source folder in Settings to load Workspaces, Board, and Table views.
        </p>
      </div>
      <Button size="sm">Open Settings</Button>
    </div>
  );
}
```

Update `src/App.tsx` to render the shell:

```tsx
import { WorkspaceLeftPanel } from "@/components/workspace/left-panel";
import { WorkspaceEmptyState } from "@/components/workspace/states";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function App() {
  return (
    <TooltipProvider>
      <div className="dark flex h-screen min-h-0 bg-background text-foreground">
        <WorkspaceLeftPanel />
        <main data-testid="workspace-main" className="flex min-w-0 flex-1 flex-col">
          <header className="electron-window-drag flex h-12 shrink-0 items-center border-b border-border px-4">
            <h1 className="text-sm font-medium">Workspace Project Board</h1>
          </header>
          <div className="electron-window-no-drag min-h-0 flex-1 overflow-auto">
            <WorkspaceEmptyState />
          </div>
        </main>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 5: Verify**

Run:

```bash
node --test test/dashboardStructure.test.js test/rendererBoundary.test.js
npm run typecheck
npm run build:renderer
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/workspace/left-panel.tsx src/components/workspace/states.tsx test/dashboardStructure.test.js test/rendererBoundary.test.js
git commit -m "Replace dashboard with workspace app shell"
```

## Task 5: Add Workspace View Surfaces

**Files:**

- Create: `src/workspaceMockData.ts`
- Create: `src/components/workspace/view-tabs.tsx`
- Create: `src/components/workspace/board-view.tsx`
- Create: `src/components/workspace/table-view.tsx`
- Modify: `src/App.tsx`
- Modify: `test/dashboardStructure.test.js`

- [ ] **Step 1: Add failing UI structure assertions**

Update `test/dashboardStructure.test.js`:

```js
assert.match(appSource, /WorkspaceBoardView/);
assert.match(appSource, /WorkspaceTableView/);
assert.match(appSource, /WorkspaceViewTabs/);
assert.match(appSource, /workspaceMockProjection/);
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test test/dashboardStructure.test.js
```

Expected: FAIL because view components do not exist.

- [ ] **Step 3: Add mock projection data**

Create `src/workspaceMockData.ts`:

```ts
export const workspaceMockProjection = {
  workspaceId: "workspace:ops",
  view: { id: "view:board", name: "Board", viewType: "board" },
  visibleProperties: [
    { id: "property:name", name: "Name", propertyType: "text", system: true },
    { id: "property:status", name: "Status", propertyType: "status", system: true },
    { id: "property:priority", name: "Priority", propertyType: "select", system: false },
  ],
  statusValues: [
    { id: "statusValue:active", name: "Active", relativePath: "Active", source: "folderRole" },
    { id: "statusValue:no-status", name: "No status", relativePath: null, source: "no-status" },
  ],
  projection: {
    type: "board",
    capabilities: { canMoveBetweenStatuses: false },
    columns: [
      {
        statusValueId: "statusValue:active",
        name: "Active",
        projects: [
          {
            id: "project:alpha",
            name: "Project Alpha",
            currentRelativePath: "Active/Project Alpha",
            status: { id: "statusValue:active", name: "Active", relativePath: "Active", source: "folderRole" },
            propertyValues: {
              "property:name": "Project Alpha",
              "property:status": "statusValue:active",
              "property:priority": "High",
            },
          },
        ],
      },
      { statusValueId: "statusValue:no-status", name: "No status", projects: [] },
    ],
  },
} as const;
```

- [ ] **Step 4: Add view tabs, board, and table components**

Use existing `Tabs`, `Badge`, and `Table` components. Components must accept projection-shaped props and not call services directly.

- [ ] **Step 5: Wire components into App**

Show Board and Table sections in Main Area with deterministic mock projection until runtime service state is added in later tasks.

- [ ] **Step 6: Verify**

Run:

```bash
node --test test/dashboardStructure.test.js test/rendererBoundary.test.js
npm run typecheck
npm run build:renderer
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/workspaceMockData.ts src/components/workspace/view-tabs.tsx src/components/workspace/board-view.tsx src/components/workspace/table-view.tsx test/dashboardStructure.test.js
git commit -m "Add workspace board and table surfaces"
```

## Task 6: Add Settings And Project Detail Panel Surfaces

**Files:**

- Create: `src/components/workspace/settings-view.tsx`
- Create: `src/components/workspace/project-detail-panel.tsx`
- Modify: `src/App.tsx`
- Modify: `test/dashboardStructure.test.js`

- [ ] **Step 1: Add failing assertions**

Assert App imports and renders:

```js
assert.match(appSource, /WorkspaceSettingsView/);
assert.match(appSource, /ProjectDetailPanel/);
```

- [ ] **Step 2: Implement settings surface**

Create a Settings surface with source folder state, folder tree role controls, and `group`/`status`/`project` labels. Use `Button`, `Badge`, `Select`, `Separator`, and `Skeleton` where appropriate.

- [ ] **Step 3: Implement Project Detail Panel**

Use `Sheet`. Ensure every `Sheet` includes `SheetTitle`. Show project name, status badge, properties, and file tree rows with folder/file icons.

- [ ] **Step 4: Verify**

Run:

```bash
node --test test/dashboardStructure.test.js test/rendererBoundary.test.js
npm run typecheck
npm run build:renderer
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/workspace/settings-view.tsx src/components/workspace/project-detail-panel.tsx test/dashboardStructure.test.js
git commit -m "Add settings and project detail surfaces"
```

## Task 7: Wire Workspace Service State

**Files:**

- Create: `src/workspaceAppState.ts`
- Modify: `src/App.tsx`
- Modify: `test/dashboardStructure.test.js`
- Create or modify focused tests for app state.

- [ ] **Step 1: Add reducer/state tests**

Create tests that cover:

- source folder missing state;
- projection loaded state;
- service error state;
- search query update;
- active view switch.

- [ ] **Step 2: Implement app state reducer**

Keep product rules out of the reducer. The reducer stores UI state and service responses only.

- [ ] **Step 3: Use `WorkspaceServiceClient` through renderer transport**

Instantiate:

```ts
const workspaceClient = new WorkspaceServiceClient(createWorkspaceRendererTransport());
```

Do not import backend modules in React.

- [ ] **Step 4: Add loading and error states**

Use `WorkspaceEmptyState`, `Skeleton`, and `sonner` for service errors.

- [ ] **Step 5: Verify**

Run:

```bash
npm test
npm run typecheck
npm run build:renderer
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/workspaceAppState.ts test
git commit -m "Wire workspace frontend state to service client"
```

## Task 8: Visual And Electron Runtime Verification

**Files:**

- Modify only if verification exposes issues.

- [ ] **Step 1: Build renderer**

Run:

```bash
npm run build:renderer
```

Expected: Vite build passes.

- [ ] **Step 2: Open Electron app**

Run:

```bash
npm run electron
```

Expected: Electron loads `dist/renderer/index.html` and shows Workspace Project Board, not dashboard template.

- [ ] **Step 3: Capture screenshots**

Use Browser plugin or Playwright if available to capture:

- 1440x960;
- 1024x720.

Check:

- no overlapping text;
- left panel stable;
- board columns visible;
- table visible;
- settings visible;
- detail panel accessible;
- no unsupported drag/drop affordance between status columns.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
GOFLAGS=-buildvcs=false npm run build:sidecar
git diff --check
git status --short
```

Expected: all commands pass and status contains only intentional changes before commit.

- [ ] **Step 5: Commit final verification fixes if needed**

If verification required changes:

```bash
git add src test electron docs
git commit -m "Verify workspace frontend app"
```

If no files changed after the last task, do not create an empty commit.

## Self-Review Checklist

- The plan implements the confirmed preload IPC architecture.
- The plan replaces dashboard template UI with Workspace Product UI.
- The plan keeps React out of backend/storage/filesystem modules.
- The plan requires typecheck and renderer build to pass before acceptance.
- The plan does not add new dependencies.
- The plan does not implement drag and drop between status columns.
- The plan splits frontend into reviewable slices instead of one giant implementation task.
