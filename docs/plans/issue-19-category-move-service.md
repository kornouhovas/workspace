# Issue #19: Recoverable folder-backed category moves — service stage

## Overview

Implement a typed service command that moves one active grouped project into an existing category of the same source, retaining its basename, logical identity and ordinary values. Include durable operation history, explicit recovery, source coordination, production IPC and focused actual macOS Electron service verification. Stop at this service checkpoint. Category editing UI, actual Windows execution and full issue acceptance remain subsequent coordinator work.

## Context

- Requirements: work/issue-19/task.md, issue.json, parent.json and docs/specs/workspace-0.1.0-tickets/12-move-projects-by-editing-folder-backed-select.md.
- Project guidance: AGENTS.md, docs/development.md, product.md, decisions.md, architecture.md, GLOSSARY.md and ADRs 0004, 0006 and 0007.
- Existing patterns: project-rename.ts, project-creation.ts, project-filesystem.ts, project-rename-reservations.ts, source observation, typed transport and rename service/crash/Electron fixtures.
- Storage: implemented TypeScript service with SQLite, Drizzle and migrations through 0009.
- Branch: codex/issue-19-category-move. Preserve the immutable issue base recorded as 4f9f11f7.
- Execution tracking: workspace-31i.12. Coordinator alone owns trackers, run state and external permissions.
- Plan destination after acceptance: docs/plans/issue-19-category-move-service.md.
- Dependencies: reuse the existing native renameNoReplace adapter and installed dependencies. Add no packages, native primitives or global configuration changes.

## Development Approach

- Testing approach: TDD at the already confirmed typed Workspace application-service boundary, using real temporary SQLite and filesystem fixtures.
- Work in red → green vertical slices. Do not write all tests before implementation or test private call sequences.
- Every task includes new or updated tests. Complete its affected tests and typecheck before beginning the next task; all required checks must pass.
- Use narrowly bounded filesystem/native and storage failure injection to exercise uncertainty. Label injected evidence separately from actual OS behavior.
- Verify returned results, subsequent public queries, reopen behavior, identities and sentinel bytes. Use direct SQL only for migration, integrity and fault-injection fixtures.
- Announce each task and its checks. Commit every completed, verified file-changing task with English messages and explicit task-path staging.
- Run the full suite at final verification. Use the repository runner for later execute and separate review phases; this planning session starts neither.
- Preserve renderer isolation, independent revisions, historical receipts and source/workspace ownership.

## Service Contract and Journal Decision

- Add workspace.moveProjectCategory with exactly workspaceId, projectId, operationId, destinationCategoryId and expectedRevision, plus its type discriminator.
- Resolve the root, basename, categories, paths and native evidence inside the service. Accept no caller path, name, native evidence or adapter choice.
- Add listProjectCategoryMoves, getProjectCategoryMove, previewProjectCategoryMoveRecovery and recoverProjectCategoryMove.
- Results distinguish completed, unchanged, rejected and recoverable, with finite problems. Public snapshots exclude absolute paths and native evidence.
- A current-category assignment is unchanged only after fresh ownership, revision, policy, reservations and filesystem validation. It produces an immutable receipt without a native effect, revision increment or project event.
- Use a dedicated project_category_move_operations journal. Extending migration 0009 would change its enforced same-parent/name semantics and existing recovery contract; a dedicated journal preserves those guarantees without introducing a general mutation framework.
- Bind both category IDs, both parent locators and identities, root/project identity, basename, original/requested placement, source policy, initiating workspace and original request immutably.
- Stages are intent, destination_recorded, uncertain, completed and failed. A cross-parent move retains its basename and needs no staging hop.
- Commit intent before the native effect, verified destination evidence before completion, and project category/locator, receipt and one discoveryRevision increment atomically.
- Reuse renameNoReplace without ordinary rename, copy/delete or overwrite fallback.
- Explicit recovery offers only retry_original, complete_destination or keep_original when freshly reviewed evidence permits that action. Never replay on startup, queries, reconnect or unfinished original-request retry.
- Retain historical initiating workspace IDs. A currently authorized sibling or recreated workspace over the retained source may recover.
- Repeated checks detect observed substitutions; they do not establish atomic filesystem confinement, rollback or coordinated power-loss durability.

## Implementation Steps


### Task 1: Establish the durable contract through a validated no-op slice

Files:

- Create: src/contracts/project-category-move.ts
- Create: src/service/project-category-move.ts
- Create: src/service/db/migrations/0010_project_category_move.sql
- Create: tests/project-category-move-service.test.mjs
- Create: tests/project-category-move-journal.test.mjs
- Modify: src/service/db/schema.ts
- Modify: src/service/db/migrations/meta/_journal.json
- Modify: src/service/settings.ts
- Modify: src/service/workspaces.ts
- Modify: tests/settings-service.test.mjs
- Modify: tests/project-creation-service.test.mjs, tests/project-rename-journal.test.mjs, tests/discovery-mode-service.test.mjs, tests/grouped-discovery-service.test.mjs and tests/external-reconciliation-service.test.mjs (existing upgrade expectations for migration 0010)
- [x] Start with failing public-service tests for exact request validation, grouped active-project authorization and a freshly validated current-category no-op; implement only enough contract, dispatch and service behavior to pass.
- [x] Add the dedicated journal with immutable request/evidence, same-source category/project ownership, legal transitions, terminal receipts, retained history and protection against DELETE/REPLACE.
- [x] Implement durable no-op receipts and read-only status/list queries. Identical original requests return their receipt; changed bindings fail. Unimplemented physical moves must fail closed.
- [x] Add populated upgrade/reopen tests preserving existing creation/rename receipts, outstanding rename recovery, IDs, values and independent revisions; verify migration failure rolls back.
- [x] Add integrity tests for invalid bindings, altered evidence, illegal transitions and terminal-history replacement, asserting semantic protection rather than exact SQL wording.
- [x] Build with npm run build; run the new service/journal tests and tests/settings-service.test.mjs using node --import tsx --test, then npm run typecheck. Commit after all affected checks pass.

Task 1 verification (Node 22.21.1, local macOS):

- Initial public no-op regression failed before implementation; its green result and durable reopen behavior were verified. Evidence: `work/issue-19/task-1-red.log` and `task-1-noop-green.log`.
- `npm run build` passed; compiled service outputs are used by the new service/journal tests. Evidence: `work/issue-19/task-1-build.log`.
- `node --import tsx --test tests/discovery-mode-service.test.mjs tests/project-category-move-service.test.mjs tests/project-category-move-journal.test.mjs tests/settings-service.test.mjs` passed all 69 tests, including 25 move-service and eight move-contract/journal cases, without skips. Evidence: `work/issue-19/task-1-final-focus.log`.
- Existing creation, rename service/journal, grouped discovery and external reconciliation checks passed against the same built inputs. Earlier combined runs exposed obsolete migration counts and the new empty table in an upgrade inventory; those assertions were updated and their affected suites rerun. Evidence: `work/issue-19/task-1-affected.log`, `task-1-final-affected.log` and `task-1-final-focus.log`; failed historical results are retained.
- `npm run lint`, `npm run typecheck`, `npm run check:docs` and `git diff --check` passed. Evidence logs remain under ignored `work/issue-19/`.
- Only the current-category no-op and read-only list/status are executable. Physical moves fail closed with `unsupported`; recovery execution, shared move reservations, IPC and actual Electron/platform acceptance remain later tasks/gates.

### Task 2: Coordinate move reservations with existing source operations

Files:

- Modify: src/service/project-rename-reservations.ts
- Modify: src/service/project-category-move.ts
- Modify: src/service/project-creation.ts
- Modify: src/service/project-rename.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/external-reconciliation.ts
- Modify: src/service/project-recovery.ts
- Modify: src/service/project-reveal.ts
- Modify: src/service/db/migrations/0010_project_category_move.sql
- Create: tests/project-category-move-coordination.test.mjs
- Modify: tests/project-rename-coordination.test.mjs
- Modify: tests/project-category-move-journal.test.mjs (populate the actual prior schema without running current service code against unmigrated tables)
- [x] Add unfinished move original/destination placements and full evidence to the existing SQLite-backed reservation reader before startup observation. Use operation kind plus ID for self exceptions.
- [x] Reject new move IDs already bound in creation/rename journals and new creation/rename IDs bound to move history. Preserve existing historical creation/rename overlaps and their original receipts; test both request directions and durable insert guards.
- [x] Block conflicting source mutations during unfinished moves: creation/recovery, rename/recovery, discovery Apply, reassociation, locator reconciliation and root rebinding. Preserve reads, Text editing and unrelated-source operations.
- [x] Bind relevant reviews to complete reservation snapshots, invalidate them on move changes, and repeat checks inside metadata transactions. Observation must not enroll the destination or rewrite the project association before explicit completion.
- [x] Reject Reveal for the unresolved project and conflicting placements; retain eligible unrelated Reveal. Completed/failed move receipts add no permanent placement reservation.
- [x] Build and run new coordination tests plus affected rename coordination, creation, discovery, reconciliation, recovery, observer and Reveal tests; run npm run typecheck and commit only after they pass.

Task 2 verification (Node 22.21.1, local macOS):

- The first five public coordination regressions failed before the shared reader included moves; startup/observation rewrote pending metadata. The five cross-journal ID regressions also failed before service checks and durable insert guards. Evidence: `work/issue-19/task-2-reservations-red.log`, `task-2-reservations-green.log`, `task-2-ids-red.log` and `task-2-ids-green.log`.
- Added 28 move coordination cases covering original/destination placements in intent, destination_recorded and uncertain stages, startup/Refresh/watchers, sibling reentry, retained-source reuse, stale reviews, creation/rename recovery, transaction-local reservation insertion, root rebinding, Reveal aliases, independent Text edits, unrelated sources, immutable receipts and terminal placement release. Two additional rename coordination cases protect historical cross-journal self exceptions. The upgrade journal fixture seeds legal transitions in the actual prior SQL schema and preserves populated creation/rename ID overlaps; it no longer runs current service code against deliberately unmigrated tables.
- `npm run build` passed. Evidence: `work/issue-19/task-2-build.log`.
- `node --import tsx --test` passed all 817 tests across move coordination/service/journal, rename coordination/service/journal/crash, creation service/crash, discovery mode/grouped, external reconciliation, project recovery, source observer, Reveal and settings suites, with zero failures and zero skips. Evidence: `work/issue-19/task-2-affected.log`. Focused intermediate results are retained in `task-2-coordination-green.log` and `task-2-transaction-green.log`; earlier fixture setup failures remain in `task-2-coordination-iteration.log` and `task-2-snapshots-green.log`.
- `npm run typecheck`, `npm run lint`, `npm run check:docs` and `git diff --check` passed. Evidence: `work/issue-19/task-2-typecheck.log`, `task-2-lint.log`, `task-2-docs.log` and `task-2-diff-check.log`.
- Move placements, SQL insertion races and resolver alias changes are injected disposable-fixture evidence. Actual move execution remains fail-closed with `unsupported`; physical moves, move recovery, IPC and actual Electron/platform acceptance remain subsequent tasks/gates. No Windows move acceptance, CI, review or publication is claimed.

### Task 3: Implement one-hop moves and filesystem safety

Files:

- Modify: src/service/project-category-move.ts
- Modify: src/service/project-filesystem.ts only if a small shared evidence helper is needed
- Modify: src/service/workspaces.ts
- Modify: tests/project-category-move-service.test.mjs
- Modify: tests/project-category-move-journal.test.mjs
- [ ] Add a failing public-service success test with two existing categories, sibling workspaces and exact Text values; implement intent → native no-replace move → destination evidence → atomic completion.
- [ ] Validate active grouped project and both same-source categories, exact parent spelling, containment, full root/parent/project identities, accessibility, exclusions/archive policy, configuration revision and reservations immediately before mutation and around evidence/completion writes.
- [ ] Reject empty, malformed, unknown, foreign, missing, replaced, linked, excluded, mode-inactive and unavailable destinations; reject direct-mode and unavailable project requests. Preserve basename exactly, including supported Unicode and platform-specific literal names.
- [ ] Test empty/nonempty occupied directories, files, links and alias conflicts. Insert an empty occupied target at the native-call boundary and prove its identity/content and project sentinel survive.
- [ ] Test permission loss and root/source-parent/destination-parent/project substitutions at meaningful boundaries. Native failures with proven no effect may terminate; possible effects and failed evidence writes remain recoverable with prior durable evidence.
- [ ] Verify both categoryId and locator change together, one source discovery event reaches actual siblings, and unrelated sources, selection, views, labels, ordinary values, native identity and independent revisions remain unchanged after reopen.
- [ ] Build, run all move tests and affected creation/rename/native regressions, run npm run typecheck, and commit after all checks pass.

### Task 4: Implement explicit recovery and abrupt-process restart coverage

Files:

- Modify: src/service/project-category-move.ts
- Modify: src/service/settings.ts
- Modify: src/service/workspaces.ts
- Modify: tests/project-category-move-service.test.mjs
- Create: tests/project-category-move-crash.test.mjs
- Create: tests/fixtures/project-category-move-crash-worker.mjs
- [ ] Add failing tests for recovery preview and the three actions. Advertise actions only for a unique matching original/destination placement under current same-source authorization; missing, replaced, linked, inaccessible or conflicting evidence remains unresolved.
- [ ] Bind opaque recovery tokens to workspace/source/operation, immutable journal/evidence, current configuration/revision, both parent observations and reservations. Reject stale, foreign, reused or unadvertised actions and caller-mutated previews.
- [ ] Invalidate tokens on replacement preview, relevant source changes, workspace removal and service close/restart. Preserve independent Text edits without inventing a shared revision.
- [ ] Parent-terminate owned child processes after intent commit, native effect, destination evidence and final commit. Require checkpoint acknowledgement and confirmed exit so cleanup cannot mask interruption.
- [ ] Reopen each fixture and prove status/list/startup/original retries do not replay; explicit recovery preserves identity, bytes and values. Cover sibling recovery, final-workspace removal/source reuse, completion rollback and failed uncertainty writes.
- [ ] Build and run move service/journal/coordination/crash tests and affected creation/rename crash regressions; run npm run typecheck and commit after they pass.

### Task 5: Wire the production typed IPC and client boundary

Files:

- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/service-protocol.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/service/entry.ts
- Modify: src/renderer/workspace-service-client.ts
- Create: tests/project-category-move-ipc.test.mjs
- Exercise existing: src/desktop/backend-controller.ts, main.ts and preload.ts
- [ ] Add command/query/result unions, exact backend entry validation and correct query classification for all five move requests.
- [ ] Add typed client methods forwarding only accepted caller fields through the existing controller/main/preload route. Add no channels, native APIs, mutation queues or automatic retries.
- [ ] Test the compiled production entry/controller/preload/client route against real temporary storage and folders: success, no-op, rejection, status, fresh-token recovery and same-source event-before-response ordering.
- [ ] Cover lost requests/responses, backend replacement and stale-generation messages. Explicit original-request retry retains its exact immutable payload; reconnect and status reload never replay.
- [ ] Reject extra paths/native evidence, malformed IDs, foreign entities and malformed recovery requests. Assert native identities and absolute/staging locators are absent from move responses and renderer-facing events; retain contextIsolation=true, nodeIntegration=false and sandbox=true.
- [ ] Build and run new IPC tests plus existing service-protocol, preload/controller/security and rename IPC regressions; run npm run typecheck and commit after they pass.

### Task 6: Obtain focused actual macOS Electron service evidence

Files:

- Create: scripts/smoke-project-category-move.mjs
- Create: tests/fixtures/project-category-move-service-electron.cjs
- Create: tests/project-category-move-fixture.test.mjs
- Modify: package.json
- Modify: .github/workflows/desktop-ci.yml
- Reuse: existing rename fixture control/protocol utilities where their contracts fit
- [ ] Add a disposable actual Electron utilityProcess fixture loading the production backend, migrations, SQLite and Electron native adapter. Exercise success/no-op/rejection, sentinel and identity preservation, siblings/values/restart, explicit recovery and occupied-target insertion.
- [ ] Adapt existing bounded supervisor/acknowledgement/exit/cleanup conventions. Save sanitized scenario outcomes, platform/runtime versions and input digest before cleanup; omitted required assertions, skips, timeouts or unconfirmed shutdown fail the checkpoint.
- [ ] Add fixture negative controls for assertion failure, malformed/unreached results, missing acknowledgement, timeout and cleanup/evidence-write failure. Keep injected controls distinguishable from actual service results.
- [ ] Add test:category-move:early and smoke:category-move:service scripts. Prepare an independent early service CI matrix for macos-latest, windows-latest and windows-2022 with failure-preserving evidence uploads; edit configuration without pushing or dispatching.
- [ ] Build, run focused move/fixture controls and npm run typecheck. Run smoke:category-move:service on actual macOS with evidence under ignored work/issue-19/; commit after required local scenarios and lifecycle checks pass.
- [ ] Record absent Windows results as pending. Do not expand category UI or claim Windows/product acceptance from local results.

### Task 7: Verify the stage and document the handoff

Files:

- Modify: tests/project-category-move-service.test.mjs
- Modify: docs/architecture.md
- Modify: docs/development.md
- Modify: docs/adr/0007-no-replace-project-renames.md
- Create: docs/verification/issue-19-category-move-service.md
- Modify: README.md only if its capability summary needs updating
- [ ] Add a final public-service regression proving a completed move survives reopen, releases its vacated placement for a fresh operation under current policy, and leaves previous creation/rename/move receipts immutable.
- [ ] Run npm test, npm run lint, npm run typecheck, npm run check:docs and git diff --check. Preserve command outcomes and evidence pointers.
- [ ] Run the actual macOS Electron service smoke against final built inputs. Reuse earlier platform evidence only when its input digest is unchanged; otherwise rerun the affected fixture.
- [ ] Document implemented contract, dedicated journal rationale, reservations, recovery, security boundary, actual checks and residual path/durability limitations. Update repository-owned documentation rather than creating an unrelated CLAUDE.md.
- [ ] Commit verified changes with explicit paths and record the final commit. Stop at the service checkpoint without launching review, UI work or external delivery.

## Post-Completion: Coordinator-Owned Gates

- Inspect this accepted plan before any execution. Planning acceptance does not start implementation automatically.
- After the authorized execution, perform Matt code-review and the repository runner’s separate Ralphex review against the immutable issue base.
- Obtain early actual Windows service results at the exact reviewed SHA before expanding UI or repeating full reviews. Push/Actions permission is currently absent; finish the local reviewable result before requesting it.
- Inspect required scenario outcomes and artifacts on both Windows targets. Missing, failed, skipped and unreached checks remain pending acceptance.
- Plan category editing/recovery UI separately, including explicit physical-move messaging, EN/RU, keyboard operation, loading/error/empty states and response-lifetime handling.
- Complete later development/packaged UI/platform verification and full issue acceptance separately. Preserve existing native Reveal and shutdown/#44 gates.
- This stage does not close GitHub #19, change trackers, publish, merge, release or start the next issue.
