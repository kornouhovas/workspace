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
