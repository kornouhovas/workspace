# Session commands verification

Issue: [#2](https://github.com/kornouhovas/workspace/issues/2). Refactor baseline: `bb00ac9`.

Status: Issue #2 implemented, verified and reviewed on the dedicated branch. Integration into the original checkout and Issue #3 lifecycle extraction remain pending.

## Completed checks

- 59 targeted Node checks passed: session commands, subscriptions, tab/pane fallback, independent Workspace maps, existing serializers/preview guards and renderer/pure-model boundaries.
- TypeScript typecheck and production renderer build passed.
- Built the unchanged local Go helper required by the existing project-creation tests; those four tests passed.
- Twelve native Electron checks passed before and after the refactor at actual 1440x960 and 1024x720: close fallback, keyboard reopen, Control-drag split, maximize/restore, pane close, bulk close, Settings navigation, restoration after reload and independent tabs/splits when switching between Workspaces sharing a source.
- The delayed-IPC Table-projection scenario preserves the outgoing split when Duplicate is requested during loading. It fails against implementation checkpoint `06da337` (the duplicate replaces the split with a full-screen project), passes after the `d90c286` correction, and passes against the original `bb00ac9` behavior.
- Ten before/after screenshots cover Board, expanded project, split, restored tabs and a split restored after Workspace switching at both sizes. Nine pairs have identical pixels. The remaining pair differs in 24 pixels, with maximum RGB channel difference 1, within the file-tree count glyph; geometry and CSS are unchanged.
- Existing Electron security preferences remained `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

## Baseline limitations

The full Node suite reports 409 passed and one failed. The failure is the existing `dashboardStructure.test.js` assertion for `h-6 min-w-6 justify-center rounded-full px-2`; the unchanged filter-menu badges use the previously committed geometry. Running that test from an exported `bb00ac9` checkout reproduces the same failure. The refactor removes only the obsolete assertion that selection must use a React `useState` declaration; public session and Electron behavior now cover that boundary.

Ordinary drag from an inactive project tab can select its full-screen surface before the drag starts. The characterization driver uses the existing Control-drag gesture to keep the Workspace host mounted. Tab closure uses the context menu because the original close-button hit area is overlapped. These pre-existing interactions are preserved in this slice.

## Standards

The independent Standards review found one pending-surface guard violation. It is resolved by the shared user-command adapter in `d90c286`, including load/focus effects. No documented-standard violations remain. One nonblocking possible Duplicated Code observation remains: a few commands repeat their selection tuple; the commands have different semantics, so further extraction is deferred.

## Spec

The independent Spec review found the same pending-surface selection regression. The delayed-response regression check confirms its correction. No unresolved Spec findings or scope creep remain. Complete session lifecycle ownership stays in Issue #3.

Review totals: Standards 0 unresolved violations and 1 nonblocking heuristic; Spec 0 unresolved findings.

## Reproduction

Build the renderer and local helper, then run `node scripts/verify-session.mjs`. It uses temporary project folders and isolated Electron user data. Evidence defaults to the ignored `.workspace-dev/session-commands/electron` directory. Set `WORKSPACE_SESSION_EVIDENCE` to choose another evidence directory; `WORKSPACE_ELECTRON_EXECUTABLE` can select an already installed binary.

This run used an existing Electron 41.5.0 binary because dependency installation in the isolated worktree left the Electron package incomplete. The source and built renderer under test still came from the dedicated worktree.

Local evidence is retained under `.workspace-dev/session-commands/{before,after}`, with pixel comparison and SHA256 records in `comparison.json`. These generated artifacts are ignored by Git; this document records the verification result.
