# workspace-jqv: diagnostic checkpoint

Status: incomplete; live reference inspection is awaiting manual Mac unlock.

## Checkout and runtime

- Repository: `/Users/aleksandersk/Documents/programming/Projects/project_folder`.
- Initial branch: `codex/workspace-6fh-design-application`; HEAD `d38568272f5a64a320eceedf8944689646b6aeac`.
- Dedicated branch created before evidence edits: `codex/workspace-jqv-live-bb-visual`.
- Foreign `.ralphex/`, `work/task-loop/**`, and `work/workspace-6fh/reviewer/committed-acceptance.*` changes are preserved.
- Process inventory shows live `/Applications/bb.app/Contents/MacOS/bb`, PID 9542. `CFBundleShortVersionString` is `0.44.0`.
- No running Workspace, repository Electron, or Vite process was found. This does **not** establish that the user's earlier screenshot came from an outdated runtime. The previously visible Workspace version has not yet been identified.
- `electron/main.js` loads `dist/renderer/index.html` in normal mode and an explicit development URL in opt-in development mode. The current renderer build exists, timestamp October 1 00:13 local. No application was launched or rebuilt during this checkpoint.
- Active `electron/workspaceIpc.js` registers the JSON-backed adapters and property file store; `src/workspaceRendererTransport.ts` calls the preload request bridge. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` are present.
- Installed packages verified using `npm ls --depth=0`: `tailwindcss@4.2.4`, `radix-ui@1.4.3`. No dependencies changed.

## Live inspection limitation

The initial `cua.getState()` returned native apps `[]` and:

> The Mac is locked and automatic unlock could not unlock it. Ask the user to unlock the Mac manually before continuing.

Both browser surfaces returned no tabs. There is no inventoried browser tab containing bb that provides an alternative live inspection path. Process/bundle reads confirm bb is running, but cannot establish its visible theme, geometry, menus or current screen. The user has been asked to unlock via the coordinating chat. No further live interaction is attempted until an unlock response is received. No lock bypass, bb settings change or bb content/file action was performed.

## Sources inspected

Mandatory development README/rules/workflow/quality, UI guidelines, Interface, PRD, Board/Table and source/role flows, accepted ADR-005/006, and bb adaptation policy were read. The policy's previous claim that live bb was not inspected remains true for this checkpoint; old geometry is not new evidence for this task.

The local bb source checkout is `/Users/aleksandersk/Documents/Codex/2026-09-28/https-github-com-get-bb-bb/work/bb`, HEAD `af72bb8167da292198bfa73b1c35ae3ac080bfca`. Its shared dropdown primitive and application menu overrides were inspected. Their relationship to the running bb bundle still needs live verification. Shared defaults alone cannot supply app-specific menu widths or visible shell decisions.

Official documentation opened:

- [Tailwind theme](https://tailwindcss.com/docs/theme): `@theme` defines the utility token API; ordinary variables can remain in root/theme selectors.
- [Tailwind states](https://tailwindcss.com/docs/hover-focus-and-other-states): focus/disabled/data/ARIA variants support explicit component states.
- [Tailwind dark mode](https://tailwindcss.com/docs/dark-mode): custom selector variant supports the existing application theme class.
- [Tailwind padding](https://tailwindcss.com/docs/padding): spacing utilities derive from the spacing variable and permit explicit measured values.
- [Radix styling](https://www.radix-ui.com/primitives/docs/guides/styling): primitives are unstyled; presentation and functional sizing remain the application's responsibility; state is exposed through data attributes.
- [Radix dropdown menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu): portal, highlight/disabled state, focus and keyboard behavior, collision handling and available-size CSS variables.
- [Radix context menu](https://www.radix-ui.com/primitives/docs/components/context-menu).
- [Radix popover](https://www.radix-ui.com/primitives/docs/components/popover).
- [Radix dialog](https://www.radix-ui.com/primitives/docs/components/dialog).
- [Radix select](https://www.radix-ui.com/primitives/docs/components/select).
- [Radix tooltip](https://www.radix-ui.com/primitives/docs/components/tooltip).

Tailwind online docs identify themselves as v4.3; the checkout has v4.2.4. Only compatible v4 concepts above are considered; no version upgrade is proposed. Radix accessibility guide request returned Internal Error; component keyboard/focus documentation is available. The libraries do not define the desired bb appearance.

## Resume point

After confirmed unlock, inventory again, select the actual open bb and Workspace surfaces, capture bb theme/shell and safe menus/settings navigation, then derive the concrete bb → current Workspace → correction → verified Workspace matrix. Use isolated fixture data for Workspace before/after Electron captures at 1440×960 and 1024×720 in both themes. Menu geometry and shell/component spacing changes must follow observed bb rather than historical policy values or Radix examples.

`work/workspace-6fh/reviewer/native-gate-diagnostic.md`, referenced in the execution request, is absent in this checkout. The older `work/workspace-6fh/native-capture.mjs` and capture helpers exist; their capture approach must be checked against current Computer Use instructions before use.

## Acceptance state

1. Partial: running bb/version and dependency/runtime facts confirmed; live theme/screens/menus and historical user Workspace runtime unresolved.
2. Unstarted: no live measurements or before/after comparison; no visual changes made.
3. Unstarted: no new Electron screenshot or interaction verification.
4. Source/data/security unchanged. Required implementation tests, typecheck and build have not run because implementation has not started.
5. Independent visual acceptance and implementation commit pending. This checkpoint is not completion evidence.
