# Issue 73: immediate status-grouped folder opening

Baseline: `dcc09dd0` on `new-workspace`. Tracker: [#73](https://github.com/kornouhovas/workspace/issues/73).

## Scope and scenarios

- The folder-first desktop creation command opts into immediate initialization for a genuinely new source: grouped discovery, ordinary Archive status, Status property and category-grouped default Table. No initial name or review wizard.
- Existing configured or unconfigured sources are reused without changing shared interpretation, archive, exclusions, identities or properties. Legacy source review remains explicit.
- Reopen preserves projects and grouping; sibling views can change grouping independently.
- Disposable Root/Archive/cpp and Root/Projects/draw discover cpp/draw, stop at projects, exclude hidden/link/service folders and preserve file contents.
- Failed/unstable initialization rolls back workspace/source creation. Unsupported evidence never bypasses identity safety.
- EN/RU folder selection and cancellation are checked through the UI, with real service integration for the successful route.

## Test retention and verification

Owner confirmed public service and creation UI seams. Retain existing reviewed discovery/mode-change tests: their low-level workspace.create command continues supporting explicitly staged setup; only the desktop folder-first client selects immediate initialization. Existing sources are never silently initialized. Add public-boundary tests for the immediate route, restart, source reuse, independent grouping and failure/containment. Retain legacy identity and archive tests unchanged.

Run focused service/UI tests and typecheck while implementing; run lint/docs checks, full suite once after review, and real Electron changed-flow smoke. Platform/package evidence follows the affected service/renderer boundary, separately from appearance. CI and integration progress is recorded in the issue checkpoint. No release or main merge.

## Local implementation evidence

The fresh-source regression failed before implementation, then passed with
persisted grouped discovery and Table grouping. The sibling-grouping regression
failed before its repair. The real-service EN/RU UI regression failed until the
client selected immediate initialization. The first native run exposed the IPC
exact-key guard rejecting `initialize`; after its repair the native journey passed.

Observed locally on macOS arm64 / Node 22.21.1: 108 focused service/renderer tests
passed; typecheck, lint, build, Markdown links and diff whitespace checks passed.
The native immediate-opening journey passed cancellation, Archive/cpp and
Projects/draw, EN/RU light/dark at 1024x720 and 1440x960, restart, source reuse,
file bytes and owned-process cleanup. Inspected EN light 1440 and RU dark 1024
captures show the expected grouped Table with no initial setup wizard. Other
appearance captures remain in the local evidence directory. Full suite, parallel
standards/spec review and three-host dev/package CI are the next acceptance gates.

## Review repair: localized default label

Both independent review axes identified the generated English Status label in RU.
A failing RU header assertion reproduced it. Migration0032 now preserves legacy
Category defaults and authored names while recording a separate Status default for
fresh sources. Headers, grouping and filters use one shared localized name helper;
a later authored rename remains exact. The public UI regression verifies Статус
and an authored rename, and the service regression upgrades a real prior schema
with null and authored category labels without changing their public properties.

Inherited migration count/latest-tag/package inventories and positional category
fixture inserts are adapted to the additive column; the shared historical-row
expectations add only default_label=category, and rewind fixtures remove that
column before replay. Their original data, rejection and identity assertions are
retained. The immediate-opening suite is included in test:migrations. The first
migration run exposed outdated count/rewind fixtures; 43 focused original/repair
checks then passed. The complete migration run and final full-suite result remain
tracked separately, without relabeling the initial failed attempt as passing.

The review's possible duplication heuristic is retained as a bounded tradeoff:
fresh initialization has its own atomic creation orchestration, while scanning,
planning, durable evidence, reservations and enrollment use the existing helpers.

## Broad-run compatibility repairs

The first local full run retained 40 failures and 33 cancellations (3751 passes,
27 platform skips). Its direct/setup IPC scenarios exposed the typed client's
new implicit initialization default. A one-scenario production-port reproduction
failed; making initialization an explicit argument selected only by App's
folder-first flow restored all 94 backend/rename/category-move IPC checks without
changing their assertions. Both staged API callers and immediate desktop opening
now retain their intended semantics.

The same run found a missing common-job exclusion for the new CI selector; the
existing route guards caught it and the selector/options assertions were adapted.
The local shared node_modules symlink caused Ladle's documented serving-boundary
403; it was replaced with a worktree-local dependency copy, without changing app
or Vite configuration. Several unchanged native fixtures also timed out during
shutdown in the broad concurrent run. A single original property-editor control
passed in isolation; this does not establish the historical timeout's cause.
Original native deadlines and cleanup assertions are retained for focused renewal
and final/CI verification. Failed broad-run evidence is not acceptance.
