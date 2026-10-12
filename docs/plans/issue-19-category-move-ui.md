# Issue 19: Remaining category move UI vertical slice

## Overview

Implement category editing, explicit status and recovery in the production Table UI using the completed typed service. Add EN/RU interaction and production-component layout coverage; disposable Electron development/package acceptance remains the following runtime stage. This reviewed candidate covers the local category editing/status/recovery and presentation slice. Actual graphical runtime acceptance follows only after separate review and early Windows feedback.

## Context

- Requirement: GitHub https://github.com/kornouhovas/workspace/issues/19; linked Beads step workspace-31i.12.

- Planning brief: work/issue-19/category-move-ui-planning.md.

- Current issue contract: work/issue-19/issue-current.json.

- Project contracts: AGENTS.md, docs/development.md, docs/product.md, docs/decisions.md, docs/architecture.md, docs/adr/0007-no-replace-project-renames.md, docs/reuse.md and GLOSSARY.md.

- Production UI: src/renderer/components/TextPropertiesTable.tsx, DiscoveryPanel.tsx and ProjectRenamePanel.tsx.

- Existing API: src/contracts/project-category-move.ts and src/renderer/workspace-service-client.ts.

- Presentation: src/renderer/localization.ts, src/renderer/app.css, src/renderer/components/bb-foundation.stories.tsx and scripts/smoke-discovery-layouts.mjs.

- Runtime patterns: scripts/smoke-runtime.mjs, smoke-project-rename-ui.mjs, runtime-evidence.mjs, runtime-startup.mjs, runtime-lifecycle.mjs and runtime-layout.mjs.

- Existing interruption preparation: tests/fixtures/project-category-move-crash-worker.mjs.

- Coordinator state: work/ralphex/issue-19/current.json. Reviewed HEAD and lastReviewedSha are 1eb5b4f1e1b6dd21f911a1b49760f70c6402ebfd; issueBaseSha remains 4f9f11f785c63a65585ea6f33f167fc438272c64. The coordinator must inspect the current lastReviewedSha again before launch.

- No new dependencies or copied bb modules are expected.

## Scope boundaries

- Reuse completed service, native adapter, migration/journal, IPC/client, runner, fixture diagnostics and sanitized full-suite checkpoint transport.

- Do not replay completed prerequisite plans, dedicated service acceptance runs or historical diagnostics to populate a new report.

- Preserve coordinator state, receipts, trackers and completed evidence. External CI gates remain coordinator owned.

- Exclude category creation/rename/deletion, archive/restore, dragging, generic mutation frameworks, new renderer filesystem policy, publication and main-branch integration.

- Existing path-substitution, filesystem/SQLite atomicity and power-loss limitations remain unchanged. Controlled interruptions do not prove historical OS failure causes.

- Finder/Explorer selected-item release acceptance and Issue #44 remain separate where outside Issue19 scope.

## Development Approach

- Testing approach: TDD, using the installed Matt Pocock tdd skill and one behavior slice at a time.

- Approved seams: production React interactions through WorkspaceServiceClient, existing Ladle production-component fixtures, and actual Electron UI with disposable real SQLite/filesystem fixtures.

- Test observable commands, feedback, focus, persisted state and filesystem effects; avoid private-helper tests and implementation mirroring.

- Every code-changing task includes new or updated behavioral tests. Complete its focused checks before starting the next task.

- Run focused UI tests and typecheck during implementation; run full npm test once at final acceptance. No numeric coverage target is introduced.

- Keep React responsible for presentation and operation binding. The service authorizes placements and filesystem effects.

- Commit each completed, verified task with explicit task paths and an English message. Executor push, tracker writes, Actions dispatch and external monitoring are excluded.

## Implementation Steps

### Task 1: Add explicit grouped category editing

Files:

- Create: src/renderer/components/ProjectCategoryMovePanel.tsx.

- Create: tests/project-category-move-ui.test.tsx.

- Modify: src/renderer/components/TextPropertiesTable.tsx.

- Modify: src/renderer/components/DiscoveryPanel.tsx.

- Modify: src/renderer/localization.ts.

- Modify: src/renderer/app.css.

- Modify: tests/components.test.tsx.

- [ ] Add a category edit trigger only for active, resolved grouped projects. Keep retained rows read-only and direct-mode rows without category controls; preserve category-label editing and ordinary Text behavior.

- [ ] Add a labeled native select of existing categories, including the current category and eligible empty categories, with no clear option. Show current and destination source-relative placement and explain the physical folder move. Derived display paths provide no authorization.

- [ ] Submit exactly one moveProjectCategory command per explicit submission with workspaceId, projectId, a fresh operationId, destinationCategoryId and expectedRevision. Selecting the current category still submits for service-validated no-op.

- [ ] Handle completed, unchanged, rejected and recoverable results; preserve exact project names and Text, reload actual state and retain confirmed event-before-response success. Distinguish collision, stale and unavailable feedback.

- [ ] Add EN/RU behavioral tests for payloads, duplicate submission, no clearing, retained/direct restrictions, validated no-op, result/error handling, metadata independence, keyboard submission and Escape dismissal with focus restoration.

- [ ] Run node --import tsx --test tests/project-category-move-ui.test.tsx tests/components.test.tsx tests/project-rename-ui.test.tsx, npm run typecheck and git diff --check; commit after passing.

### Task 2: Preserve submitted outcomes and add explicit status/recovery

Files:

- Modify: src/renderer/components/ProjectCategoryMovePanel.tsx.

- Modify: src/renderer/components/DiscoveryPanel.tsx.

- Modify: src/renderer/localization.ts.

- Modify: src/renderer/app.css.

- Modify: tests/project-category-move-ui.test.tsx.

- Modify: tests/renderer-app.test.tsx.

- Modify: tests/project-rename-ui.test.tsx and tests/project-recovery-ui.test.tsx where shared surface behavior changes. Adapt other directly affected existing UI fixture clients only to answer the newly mounted read-only category operation list; preserve their original behavioral assertions.

- [ ] Bind submitted operations to immutable source/project/initiating-workspace, basename, original/destination category IDs and relative placements, and expected revision. Retain unknown submissions across dismissal, selection/source remount and backend remount for the same client/source using presentation memory only.

- [ ] Provide explicit getProjectCategoryMove status access. Load and read-refresh unfinished source operations through listProjectCategoryMoves without replaying mutations. Keep command feedback independent from list loading/error/empty state.

- [ ] Present original/destination placement, durable stage, last verified placement and finite problem/evidence states. Offer fresh previewProjectCategoryMoveRecovery and only advertised retry_original, complete_destination and keep_original actions with their fresh token.

- [ ] Guard wrong-source, wrong-operation, changed-binding and delayed responses. Invalidate previews on newer project revision, source lifetime/observation, operation changes, refresh and backend generation. Use current authorized workspace IDs for status/recovery without rewriting the operation’s initiating workspace.

- [ ] Coordinate conflicting source UI effects with existing discovery, creation, rename and reassociation surfaces. Block duplicate effects while keeping explicit status, unrelated sources and ordinary Text usable. Dismissal must not cancel or replay submitted work; pending/stale/recovery states must restore focus intentionally.

- [ ] Add boundary tests for unknown outcomes, explicit status, remount/no replay, backend/source changes, list races, immutable-result guards, event timing, preview invalidation, unavailable/unresolved states and all three explicit actions. Run the focused UI suite including project creation, rename, recovery and renderer-app tests, then typecheck and diff checks; commit after passing.

### Task 3: Extend production-component presentation fixtures

Files:

- Modify: src/renderer/components/bb-foundation.stories.tsx.

- Modify: scripts/smoke-discovery-layouts.mjs.

- Modify: tests/project-category-move-ui.test.tsx.

- Modify: src/renderer/app.css and src/renderer/localization.ts if verified presentation fixes are needed.

- [ ] Extend existing typed Ladle fixture patterns with the production category move surface. Update existing DiscoveryWorkspace fixture clients to answer the newly mounted read-only operation list.

- [ ] Cover relevant EN/RU editing, pending, completed/no-op, rejected, unknown/status, list loading/error/empty, recovery loading/error/blocked, stale review, recovery pending/unknown and retained-original states. Include retained/direct restrictions and long names/relative paths.

- [ ] Add focused --category-move layout selection and include these states in normal discovery-layout enumeration without arbitrary story-count goals.

- [ ] Assert visible labels, native select keyboard operation, Enter submission, Escape dismissal, focus restoration, advertised-action availability and absence of duplicate mutations. Check wrapping, reachable controls and horizontal overflow at 1440×960, 1024×720 and 420×800.

- [ ] Add or update interaction regressions for presentation fixes. Run focused UI tests, npm run typecheck, npm run build:ladle and node scripts/smoke-discovery-layouts.mjs --category-move with a distinct ignored evidence directory; preserve normal-shutdown assertions and commit after passing.

## Post-Completion: Coordinator-owned gates

- This executable stage ends after Task 3. Separate review and early actual Windows feedback precede the preserved graphical runtime stage; external acceptance remains coordinator-owned.

- Before execution, the coordinator inspects live ownership, current state and external prerequisite evidence. A pending CI gate is not an executor task to retry.

- Obtain early actual Windows feedback on the first working UI slice before expanding runtime acceptance. Windows skips on macOS provide no Windows acceptance.

- Run separate follow-up review using the currently inspected lastReviewedSha; preserve issueBaseSha and widen comparison deliberately for changed shared contracts.

- Only the coordinator performs authorized push, exact-SHA Actions monitoring and artifact inspection, including Windows development/package UI and graphical shutdown outcomes.

- Preserve and diagnose unexpected red results before changing policy. Historical fixture failure causes remain unproven.

- Whole Issue19 acceptance, tracker closure, Issue #44 and release/integration decisions remain separate coordinator responsibilities.

Plan source: work/issue-19/category-move-ui-plan-draft.md. The coordinator materialized this local candidate from the existing Ralphex draft without replanning completed stages. The preserved runtime task draft is work/issue-19/category-move-ui-runtime-future.md. It is outside this executable stage. Refresh the actual lastReviewedSha and confirm lock-free ownership before materialization/execution; preserve prior repaired fixture/CI evidence.

## Execution Evidence

Pending execution.

Completed observer prerequisite: Actions 38226803150 at that exact SHA has both Windows observer suites 105/105, zero failures/skips, and four schema/provenance/ownership/cleanup-verified artifacts. Overall workflow remains pending. Historical clock attribution remains unproven. Readiness delivery and independent existing Reveal acknowledgment diagnosis are coordinator-owned; neither expands these UI tasks.
