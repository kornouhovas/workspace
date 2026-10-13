# Issue 21: Category removal

Source: [GitHub #21](https://github.com/kornouhovas/workspace/issues/21).
Base: verified `new-workspace` at `22613c372ac2d06c333477f6add214fb2d19f8b2`.
Executor: Matt Pocock `implement`; no Ralphex run.
Worktree: `.worktrees/issue-21-category-removal`.

## Boundaries and checks

Use the typed Workspace service over disposable real SQLite and source folders as the primary behavioral seam, as required by the issue. UI/IPC checks cover request routing, keyboard operation, EN/RU and recovery feedback. Preserve current source ownership, opaque project identities, ordinary values and renderer isolation. Reuse the accepted no-replace category-move service; introduce no recursive deletion, copy/delete move fallback or permanent identity marker.

## Accepted partial-failure behavior (2026-10-13)

The owner confirmed: stop at the first unsuccessful project move, retain completed moves and expose the result of every project. After repair, explicitly retry only remaining work. Do not automatically roll back or replay operations. The original category directory can be removed only after every reviewed project is verified at its destination and the original category is verified empty. Empty-category removal needs no destination. Unexpected files or new projects block cleanup rather than being deleted or silently added to the batch.

## Preview milestone

- [x] Resolve the native blocker (#20 closed), parent and current implementation.
- [x] Add an exact typed `workspace.previewCategoryRemoval` query through service entry, preload API types and client.
- [x] Resolve category/destination from the selected workspace source; reject same, foreign, inactive, excluded, archive, linked or unavailable parents.
- [x] Require a destination for occupied categories; allow an empty category preview without one.
- [x] Show every project placement and destination collision. Unexpected category entries, including hidden files and untracked project folders, block cleanup.
- [x] Exercise previews without filesystem or project mutation using real SQLite/filesystem fixtures.

## Implementation scenario checklist

1. Bind a fresh preview to source configuration, full project/category identities, current placements and directory entries. Cancel is read-only; stale previews cannot apply.
2. Journal the bulk operation and per-project attempts before effects. Integrate durable reservations with discovery/reconciliation and conflicting mutations. Reuse private category-move commands without accepting caller-authored paths.
3. Expose truthful partial outcomes, explicit fresh retry/recovery and read-only status after restart or a lost response. Never duplicate completed moves or overwrite destinations.
4. Remove only the verified empty category directory using a nonrecursive primitive. Recheck identity, containment, unexpected entries and project ownership immediately before cleanup. Preserve historical category IDs/receipts and values. An empty category needs no project destination.
5. Add EN/RU preview, Apply, partial result, explicit retry/recovery and unknown-status UI with keyboard controls and loading/empty/error states.
6. Verify collisions, new arrivals, permissions, source/destination replacement, external changes and process exits at project/cleanup stages. Verify sibling workspace notifications and restart projections.
7. Run focused checks during implementation, typecheck regularly, full suite at completion, two-axis Matt Pocock review, native UI inspection and required platform checks. Commit verified milestones; integrate only after full issue acceptance.

The historical preview checkpoint below is retained as milestone evidence. The subsequent owner confirmation authorizes the dependent mutation scope; final issue acceptance remains subject to the complete scenario matrix and reviewed candidate checks.

## Verified preview checkpoint (2026-10-13)

The first preview test failed against the baseline and passed after implementation. Focused service/category-option regression checks passed. The final full `npm test` run passed 2,630 tests with zero failures and 21 skips: 20 existing platform skips plus the planned-alias case on the normal case-insensitive fixture filesystem. All six removal-preview tests, including planned aliases, separately passed against real SQLite and folders on a disposable case-sensitive HFSX disk image; that image was detached and deleted afterward. The typed-client/preload/production-entry route rejects caller-supplied paths and routes the valid query to the real service. Typecheck, lint, renderer/desktop/backend builds, documentation links and diff checks passed.

Final Matt Pocock review: Standards — zero remaining findings; Spec — zero remaining preview-milestone findings. The review identified and the implementation corrected planned-alias collision reporting and overly broad destination-child policy checks. Full-issue deferred requirements remain as listed above. No category-removal mutation, UI, Windows acceptance, push or integration was performed.

## Mutation candidate scenario matrix

| Boundary / criterion | Scenario and evidence route |
| --- | --- |
| Valid preview and explicit destination | Typed service fixtures: occupied category requires a distinct same-source destination; empty category needs none; preview/cancel are read-only; malformed paths/IDs and stale/restarted tokens cannot Apply |
| Collision safety | Existing target entries, retained records, planned aliases and a target inserted inside the native operation are blocked; original/destination bytes are preserved; case-sensitive fixture check runs separately on macOS |
| Identity/values/source siblings | Successful occupied removal retains opaque project IDs, exact Text and sentinel bytes across sibling reads and restart; final category association becomes missing without deleting historical metadata |
| First failure and explicit retry | Three-project fixture stops at the second native denial with completed/rejected/pending outcomes; sibling retry skips the completed project; original-request replay is read-only |
| Uncertain child | Native-response interruption and abrupt exit after intent/effect/evidence require reviewed child completion/retry; no duplicate physical move or overwrite |
| Cleanup safety | Hidden files, new projects arriving before Apply or between moves, late arrivals at rmdir, changed identity and denied cleanup prevent unsafe removal; only nonrecursive empty-directory removal is available |
| Empty category | Service and production Electron UI remove an empty category without a destination, preserving other project bytes |
| Process interruption | Separate child processes exit at batch intent, child intent, physical move, destination evidence, first completed child, cleanup intent and cleanup effect; reads/restart do not replay; explicit sibling recovery preserves IDs/bytes |
| Coordination | Durable batch/child reservations block conflicting discovery Apply, project creation and category operations; authorized exact child assignments alone use the parent reservation |
| Journal/migration | Immutable bindings, attempts, terminal receipts and cross-operation IDs; populated real 0011-to-0012 upgrade/reopen preserves existing data/presentation/history; build/ASAR inventories include migration 0012 |
| UI and transport | EN/RU keyboard preview/cancel/Apply, partial results, fresh recovery and unknown-response status checks; typed client/preload/production query validation; actual Electron UI routes inherited by the three-platform CI matrix |
| Native/package acceptance | Development and packaged Electron EN/RU previews at 1440x960 and 1024x720; collision/cancel/Apply, sibling preservation, empty removal, restart, normal quit/backend exit and owned-fixture cleanup |

Local implementation and review are complete. The repaired candidate passed the full suite (2,656 passed, zero failures, 21 skips), migration checks (282 passed), all 27 service cases on a disposable case-sensitive filesystem, and development/packaged macOS Electron (16 checks each). The double-activation/lost-response regression was reproduced, repaired and included in renewed full verification. See [verification](../verification/issue-21-category-removal.md). Exact-SHA Windows/platform CI, artifact inspection and integration remain required; GitHub owns their live checkpoint. No new bb module or dependency was copied.

The first full CI run exposed an inherited macOS editor-readiness assertion mismatch between renderer timeout and host delivery deadline. The scoped deterministic test repair and focused route are recorded in [verification](../verification/issue-21-category-removal.md#retained-first-ci-failure-and-repair). Production deadlines remain unchanged. GitHub tracks focused acceptance before renewed full CI and integration.
