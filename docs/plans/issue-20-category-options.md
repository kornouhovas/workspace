# Issue 20: folder-backed category options

Executor: Matt Pocock. Base: `93c8480b` on `new-workspace`.

## Accepted refinements

The owner accepted new empty category folders, explicit association of eligible existing folders after preview, and persistence of empty categories. Color, hidden state and ordering belong to the workspace; folder identity/name belongs to the source. Public GitHub is intentional for Actions and the owner authorized continued publication.

## Scope and checks

- [x] Typed preview/apply/status/recovery and presentation contracts, exact transport validation.
- [x] Durable category journal and workspace presentation migration; shared reservation integration.
- [x] New folder creation, reviewed association and no-replace category rename preserving IDs/Text, sibling projections and restart state.
- [x] EN/RU keyboard UI for options, preview/cancel and explicit recovery.
- [x] Public service fixtures: SQLite/filesystem, stale previews, collisions, containment, external changes, interruption and restart.
- [x] UI/IPC checks, typecheck/build, full suite once; Standards/Spec code review.
- [x] Local commit, exact-SHA platform Actions and verified fast-forward integration into `new-workspace`.

Use the already agreed typed Workspace service seam. Native rename remains ADR 0007's bounded no-replace operation; no new dependency, recursive file mutation or rollback guarantee. Uncertain creation without recorded native identity cannot adopt an existing folder. Reads/restart never replay effects. Category deletion, archive and ordinary Select are out of scope.

## Local verification checkpoint

- `npm test`: 2623 passed, zero failed, 20 unchanged platform skips (final full run after fixture/discriminator repairs).
- `npm run lint`, `npm run typecheck`, `npm run check:docs`, `git diff --check`: passed.
- macOS arm64 development and packaged category-options runtime: nine checks each; EN/RU 1440×960 and 1024×720 captures, create/associate/rename/presentation/IPC/restart, ordinary shutdown and owned cleanup passed. Artifact resource check passed.
- Matt Pocock Standards and Spec: zero findings for `93c8480b` → frozen tree `0c0d3e99`, and for final safety/test delta → `e6d6c69e`. The missing-archive ancestor regression reproduced red then passed with the explicit policy-prefix guard.
- Focused category service/UI checks, including stable-order service/keyboard regressions: 28 passed, zero failed.
- Implementation `26084663beccceac388db535a2cc773d6c0fd669` passed full platform Actions and was fast-forward integrated into `new-workspace`; the integrated implementation SHA/tree was verified identical. The final documentation-only handoff records acceptance without changing implementation or fixtures.

## Platform acceptance

[Full Actions run 38364448912](https://github.com/kornouhovas/workspace/actions/runs/38364448912) passed all four ordinary jobs on implementation SHA `26084663beccceac388db535a2cc773d6c0fd669`. macOS platform tests: 2141 passed, 20 existing skips. Each Windows platform: 2238 passed, six existing skips. All six development/packaged category-options evidence files were inspected: nine passed checks per route, correct SHA, two normal shutdown/backend-exit confirmations and passed owned-fixture cleanup. EN/RU captures at both target widths were retained; representative macOS and Windows captures were visually inspected. Standards and Spec reviews remain zero findings. No release to `main`.
