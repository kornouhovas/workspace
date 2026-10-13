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
- [ ] Local commit, exact-SHA platform Actions and integration when acceptance passes.

Use the already agreed typed Workspace service seam. Native rename remains ADR 0007's bounded no-replace operation; no new dependency, recursive file mutation or rollback guarantee. Uncertain creation without recorded native identity cannot adopt an existing folder. Reads/restart never replay effects. Category deletion, archive and ordinary Select are out of scope.

## Local verification checkpoint

- `npm test`: 2623 passed, zero failed, 20 unchanged platform skips (final full run after fixture/discriminator repairs).
- `npm run lint`, `npm run typecheck`, `npm run check:docs`, `git diff --check`: passed.
- macOS arm64 development and packaged category-options runtime: nine checks each; EN/RU 1440×960 and 1024×720 captures, create/associate/rename/presentation/IPC/restart, ordinary shutdown and owned cleanup passed. Artifact resource check passed.
- Matt Pocock Standards and Spec: zero findings for `93c8480b` → frozen tree `0c0d3e99`, and for final safety/test delta → `e6d6c69e`. The missing-archive ancestor regression reproduced red then passed with the explicit policy-prefix guard.
- Focused category service/UI checks, including stable-order service/keyboard regressions: 28 passed, zero failed.
- Remaining: final local commit, exact-SHA macOS/Windows Actions, integration verification.
