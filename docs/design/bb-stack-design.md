# bb-inspired development and visual system

Reference: [get-bb/bb](https://github.com/get-bb/bb/tree/061685c4a3198fbe83592e6993e95e7c5790ba55), inspected at commit `061685c4a3198fbe83592e6993e95e7c5790ba55`. The comparison uses root/app package manifests, `apps/app/src/components/ui/theme.css`, `apps/app/src/app.css`, and `assets/app-screenshot.png`.

## Applicable stack

Workspace already uses React 19, TypeScript, Vite, Tailwind 4 and Radix/shadcn, like bb. Its independent Node domain tests and Electron service boundary remain useful. A monorepo, pnpm/Turbo, Jotai, TanStack Query or replacing tests with Vitest would add migration cost without a demonstrated need in this single application. bb's server/Hono/Drizzle, cloud/auth and IDE functionality do not belong to this adaptation. The active Electron transport continues to use JSON adapters; Go/any-store remains the target durable store.

The implemented additions are:

| Tool | Purpose | Command |
| --- | --- | --- |
| Ladle | Fast isolated catalog using real Workspace primitives, sidebar, Board, Settings and empty state; inspect surface ramp and hover/focus/disabled states | `npm run storybook` |
| Ladle production build | Reproducible catalog under `dist/catalog` | `npm run storybook:build` |
| Oxlint | Fast JS/TS correctness checks over renderer, Electron and scripts | `npm run lint` |
| Oxfmt | Consistent formatting for the new tooling/catalog and intentionally redesigned stylesheet | `npm run format`, `npm run format:check` |
| Electron + Vite HMR | Real desktop service bridge with fast renderer updates | `npm run dev` |
| Playwright Electron | Reproducible real BrowserWindow checks with isolated fixtures | `npm run build:renderer && npm run test:desktop` |

Oxfmt's initial scope is explicit in `package.json`, avoiding a mass formatting change to existing product files. Other files can be formatted intentionally with `npx oxfmt path`. Oxlint reports pre-existing unused variables and unnecessary empty object spreads as warnings; warnings are visible and do not fail its default command. New warnings should be reviewed, and lint errors must pass. Type checking and domain tests remain separate gates.

Install with `npm ci`. The new packages are dev dependencies. Comparing the lockfile against the branch base found no version changes to existing locked packages; added transitive catalog and tooling dependencies explain the lockfile growth. The catalog is an isolated presentation sandbox with local story state, and does not fake a working filesystem service or run the complete production app in a browser.

## Isolated desktop development

`npm run dev` starts Vite on `127.0.0.1` (using an available port starting at 5173), then launches Electron with the existing preload IPC bridge. Only explicit `WORKSPACE_DEV=1` enables development overrides. The helper validates an HTTP loopback origin without credentials, alternate paths, queries or fragments before loading it. Production keeps its built `loadFile` path.

Each checkout owns `.workspace-dev/settings.json`, `views.json`, `properties.json` and `electron/` userData. The directory is gitignored. The helper refuses paths containing `.workspace` or `.folder-kanban`; development never performs legacy production metadata migration. `WORKSPACE_DEV_DATA=/absolute/isolated/path npm run dev` selects a separate fixture profile. `.workspace-dev` starts empty: selecting a source folder remains an explicit action. Use temporary source folders when exercising file operations; isolated metadata does not make edits to a deliberately selected source folder harmless.

Renderer changes use HMR. Electron, preload and backend changes require restarting `npm run dev`. Ctrl-C and closing the Electron child stop the Vite server. Electron retains `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`. The development launcher does not replace `WorkspaceServiceClient`, the filesystem validation rules, folder roles, project IDs or the restriction on moving projects between primary statuses.

## Visual adaptation

bb's screenshot shows quiet desktop chrome, small seams, muted secondary text and neutral surfaces. Its CSS derives surfaces from `canvas` and `ink`, separates translucent hover/active fills, and reserves color for meaningful content. Workspace adopts that vocabulary through `src/styles.css`: `--canvas`, `--ink`, `--state-hover`, `--state-active`, `--surface-sidebar`, `--surface-recessed`, `--surface-raised`, `--surface-selected`, and `--border-hairline`.

The previous pale purple/blue surfaces and decorative sidebar/board gradients become a neutral ramp. Sidebar selection, active tabs, Board lanes/cards, Table cells, project section headings and Settings share those tokens. Floating cards/menus use the canvas with borders and small shadows. Existing property/status dot colors remain data-driven. Scrollbars derive from ink so they stay visible on light surfaces. Focus uses the semantic ring; reduced-motion preferences disable transitions.

This is an adaptation to the approved Compact geometry: Geist Variable remains the font (bb uses Inter), existing sidebar/header widths, Board column width behavior, table/property/file row heights and primary label scales are preserved. No theme switcher or new product flow is introduced; dark token values remain available for component inspection.

## Verification evidence

`work/bb-stack-design/` contains build/test logs and the lock comparison. `npm run test:desktop` uses fresh temporary project folders, seeds them through the existing IPC handler, launches the real app through Playwright's Electron API, and saves screenshots plus `electron/report.json`. The report records actual BrowserWindow bounds and content bounds at 1440×960 and 1024×720, userData isolation and Electron security settings. It exercises properties, saved view/project tabs, search/value filters and validated file tree/preview/open operations through the real preload bridge. A failure produces `failure.png`, `failure-dom.txt` and the incomplete report instead of a passing claim. Fixture paths are recorded and retained for inspection. `work/bb-stack-design/verification.md` summarizes the observed results; `dev-loop/report.json` additionally proves actual launcher/HMR/shutdown and `catalog/report.json` proves the served catalog.
