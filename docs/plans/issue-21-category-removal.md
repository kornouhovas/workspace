# Issue 21: Category removal

Source: [GitHub #21](https://github.com/kornouhovas/workspace/issues/21).
Base: verified `new-workspace` at `22613c372ac2d06c333477f6add214fb2d19f8b2`.
Executor: Matt Pocock `implement`; no Ralphex run.
Worktree: `.worktrees/issue-21-category-removal`.

## Boundaries and checks

Use the typed Workspace service over disposable real SQLite and source folders as the primary behavioral seam, as required by the issue. UI/IPC checks cover request routing, keyboard operation, EN/RU and recovery feedback. Preserve current source ownership, opaque project identities, ordinary values and renderer isolation. Reuse the accepted no-replace category-move service; introduce no recursive deletion, copy/delete move fallback or permanent identity marker.

## Product decision awaiting the owner

The issue explicitly requires resolving partial-failure/retry semantics before implementing the dependent mutations. Proposed behavior: stop at the first unsuccessful project move; keep successful moves and expose the result of every project; after repair, explicitly retry only remaining work. Do not automatically roll back or replay operations. Alternative: continue attempting other projects after a failure. The owner was asked to choose; no response has been received yet. Mutating category-removal implementation is pending that decision.

## Preview milestone

- [x] Resolve the native blocker (#20 closed), parent and current implementation.
- [x] Add an exact typed `workspace.previewCategoryRemoval` query through service entry, preload API types and client.
- [x] Resolve category/destination from the selected workspace source; reject same, foreign, inactive, excluded, archive, linked or unavailable parents.
- [x] Require a destination for occupied categories; allow an empty category preview without one.
- [x] Show every project placement and destination collision. Unexpected category entries, including hidden files and untracked project folders, block cleanup.
- [x] Exercise previews without filesystem or project mutation using real SQLite/filesystem fixtures.

## Remaining implementation after the decision

1. Bind a fresh preview to source configuration, full project/category identities, current placements and directory entries. Cancel is read-only; stale previews cannot apply.
2. Journal the bulk operation and per-project attempts before effects. Integrate durable reservations with discovery/reconciliation and conflicting mutations. Reuse private category-move commands without accepting caller-authored paths.
3. Expose truthful partial outcomes, explicit fresh retry/recovery and read-only status after restart or a lost response. Never duplicate completed moves or overwrite destinations.
4. Remove only the verified empty category directory using a nonrecursive primitive. Recheck identity, containment, unexpected entries and project ownership immediately before cleanup. Preserve historical category IDs/receipts and values. An empty category needs no project destination.
5. Add EN/RU preview, Apply, partial result, explicit retry/recovery and unknown-status UI with keyboard controls and loading/empty/error states.
6. Verify collisions, new arrivals, permissions, source/destination replacement, external changes and process exits at project/cleanup stages. Verify sibling workspace notifications and restart projections.
7. Run focused checks during implementation, typecheck regularly, full suite at completion, two-axis Matt Pocock review, native UI inspection and required platform checks. Commit verified milestones; integrate only after full issue acceptance.

This preview milestone does not fulfill or close Issue 21 and does not authorize removing any category directory.

## Verified preview checkpoint (2026-10-13)

The first preview test failed against the baseline and passed after implementation. Focused service/category-option regression checks passed. The final full `npm test` run passed 2,630 tests with zero failures and 21 skips: 20 existing platform skips plus the planned-alias case on the normal case-insensitive fixture filesystem. All six removal-preview tests, including planned aliases, separately passed against real SQLite and folders on a disposable case-sensitive HFSX disk image; that image was detached and deleted afterward. The typed-client/preload/production-entry route rejects caller-supplied paths and routes the valid query to the real service. Typecheck, lint, renderer/desktop/backend builds, documentation links and diff checks passed.

Final Matt Pocock review: Standards — zero remaining findings; Spec — zero remaining preview-milestone findings. The review identified and the implementation corrected planned-alias collision reporting and overly broad destination-child policy checks. Full-issue deferred requirements remain as listed above. No category-removal mutation, UI, Windows acceptance, push or integration was performed.
