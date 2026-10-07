# Session lifecycle verification

Issue: [#3](https://github.com/kornouhovas/workspace/issues/3). Refactor baseline: `24736b1`. Implementation: `9400e87`; review correction: `881b5cb`.

The dedicated branch implements session persistence/restoration and preview request ownership through [ADR-011](../adr/011-renderer-session-lifecycle.md). Integration into the original checkout remains pending in draft PR #5.

## Completed checks

- 108 targeted Node checks passed, including 15 lifecycle checks, the existing session/reducer/serializer checks, general app-state transitions and the transitive renderer/lifecycle architecture checks.
- TypeScript typecheck, production renderer build, Go tests and local helper build passed.
- Full Node suite: 424 passed, one failed, 425 total. The sole failure is the previously recorded filter-badge class assertion in `dashboardStructure.test.js:325`, reproduced on the earlier baseline; see [Issue #2 evidence](session-commands-verification.md). The changed slice introduces no additional full-suite failures.
- Native Electron: the twelve original checks passed on baseline `24736b1`; the expanded twenty-two checks passed after extraction at actual 1440x960 and 1024x720, with no renderer errors. The new scenarios cover independent saved-view previews across reload, reversal while a preview lookup is delayed, unavailable project cleanup, malformed session storage and a throwing localStorage getter.
- Ten original-state screenshot comparisons: nine are pixel-identical; `split-1024x720.png` differs in 24 pixels by at most one RGB channel level within the file-tree count glyph. CSS asset and geometry remain unchanged. Additional partial-preview screenshots were inspected.
- Local documentation links and whitespace checks passed. Lint reported only existing unused declarations/parameter and spread-fallback warnings in App and the serializer; no new warnings in the lifecycle/storage/driver modules.

## Regression evidence

Tests were added before their corresponding implementations for restart presentation, fresh filtered-out preview restoration, stale Workspace restoration, selection/closure races, rapid saved-view reversal, file-tree freshness, chrome persistence without a ready source, prototype-like Workspace IDs, malformed project responses and failed Workspace activation.

The first expanded native run showed that the existing card-width preference reader/writers still crashed when localStorage access itself failed. Defensive card preference access corrected that failure; the same native scenario now opens and closes the preview successfully. Card preference formats and available-storage behavior are unchanged.

Expanded tabs intentionally retain cached project behavior; missing independent previews close their host and clear memory. Ordinary inactive-tab drag and its overlapping close-button hit area retain the pre-existing limitations recorded in Issue #2. The driver uses the existing Control-drag and context-menu gestures.

Opening Settings while a Workspace preview lookup is pending must preserve Settings and still complete destination adoption. Independent review reproduced rejection on `9400e87`; the public regression fails there and passes with `881b5cb`. Surface navigation no longer invalidates Workspace restoration's selection generation; the existing general-load and visible-surface cancellation guards remain authoritative.

## Standards

Independent review found the Settings-during-restoration violation above. It is corrected by `881b5cb` and covered by the public regression. A nonblocking possible Duplicated Code observation remains: React rendering and lifecycle screen capture both derive expanded/full-screen presentation from selection and pane membership; the selectors currently agree. Further extraction is deferred.

## Spec

Independent review found the same Settings-during-restoration failure, corrected by `881b5cb`. No additional missing requirements, incorrect behavior or scope creep were identified. CRUD and source-recovery transitions were included in the review.

Review totals: Standards 0 unresolved documented violations and 1 nonblocking heuristic; Spec 0 unresolved findings.

## Reproduction

Build the renderer and local helper, then run `node scripts/verify-session.mjs`. It uses temporary source folders, isolated metadata and Electron user data. `WORKSPACE_SESSION_EVIDENCE` selects the output directory; `WORKSPACE_ELECTRON_EXECUTABLE` can select an installed binary.

This run used the existing Electron 41.5.0 binary, with source/build output from the dedicated worktree, because the isolated dependency installation left its Electron package incomplete. Native before/after reports, screenshots and `comparison.json` are retained in the ignored `.workspace-dev/session-lifecycle` directory of that worktree.
