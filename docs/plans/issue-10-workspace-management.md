# Issue #10: Manage Multiple Workspace Configurations


## Overview Complete T03 by adding workspace rename, persistent ordering, safe configuration removal and shared-source notifications to the existing desktop lifecycle. Multiple workspaces over one canonical root keep distinct workspace/view identities and independent presentation records. Removing a workspace retains its source and external files, including after the last reference is removed. Plan destination: docs/plans/issue-10-workspace-management.md.


## Context

- Requirements: work/ralphex/issue-10/task.md and docs/specs/workspace-0.1.0-tickets/03-manage-multiple-workspace-configurations-over-shared-roots.md.
- GitHub requirement owner: https://github.com/kornouhovas/workspace/issues/10.
- Linked Beads execution step: workspace-31i.3.
- Existing branch: codex/issue-10-workspace-management.
- Fixed review base for every phase: dd9c42d880cf312a8a685587920c4c837c6574d6.
- Related contracts: docs/product.md, docs/decisions.md D07/D16/D17/D20/D23/D26, docs/architecture.md, GLOSSARY.md, accepted ADRs 0001–0005 and docs/specs/workspace-0.1.0.md.
- Existing service and persistence: src/service/workspaces.ts, src/service/settings.ts, src/service/entry.ts and src/service/db/.
- Existing transport: src/contracts/, src/desktop/backend-controller.ts, src/desktop/main.ts and src/desktop/preload.ts.
- Existing UI: src/renderer/App.tsx, workspace-service-client.ts, localization.ts, app.css and components/bb-foundation.stories.tsx.
- Existing verification: tests/workspaces-service.test.mjs, tests/backend-lifecycle.test.mjs, tests/renderer-app.test.tsx, tests/build-smoke.test.mjs and scripts/smoke-runtime.mjs.
- Follow existing ServiceResult errors, real SQLite fixtures, canonicalization/access checks, localized controls and bounded Electron lifecycle helpers.
- No new production dependency is expected. Use accessible native reorder controls without adding a drag-and-drop library.

## Development Approach

- Testing approach: TDD for service mutations, validation and notifications; extend interaction and runtime tests alongside each working slice.
- Complete tasks sequentially. Every task includes new or updated tests, and all tests must pass before starting the next task.
- Verify behavior through meaningful service, transaction rollback, event/IPC, UI, upgrade and actual-runtime tests. No quantitative coverage target is required; do not add dependencies merely to measure coverage.
- Install dependencies before execution with PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm ci.
- Explicitly prepend that PATH before every Node/npm/npx command, including commands issued by any outer-review agents.
- Use gpt-6.1-sol:high throughout. Do not change global configuration or launch nested Ralphex processes.
- Keep policy and transactions in the backend; React consumes typed commands, results and events.
- Use disposable databases and temporary roots containing sentinel files. Never use live project folders.
- Preserve renderer isolation, machine-local database placement, canonical-source matching, retained Windows locators and existing source IDs.
- Commit each completed, verified task in English, staging only its explicit files.
- Coordinator owns tracker mutations, push, integration, release and final acceptance.
- Exclude discovery, project/property schemas, external watchers/reconciliation, Board/general view management, synchronization, AI, remote access, website and legacy import.

## Settled Implementation Choices

- Rename accepts a workspace UUID and nonblank name. Preserve authored text, including surrounding spaces, consistently with creation. Duplicate names remain allowed; commands use IDs.
- Reorder submits the complete desired workspace-ID permutation. Reject duplicates, unknown IDs and lists missing current configurations. A list made stale by creation/removal fails without writes.
- Store an integer workspace position. Upgrade existing workspaces in their previous insertion order; append new workspaces and load using explicit deterministic ordering.
- Management mutations return a committed WorkspaceLoad snapshot.
- Removing an inactive workspace leaves the active selection unchanged. Removing the active workspace selects the first remaining workspace in saved order and its existing Table view. Removing the final workspace clears selection and returns the creation state.
- Removal deletes only the selected workspace and its owned view/presentation records. It never deletes a source or performs filesystem deletion.
- Source availability remains observed runtime state. Add a real refresh-source command exposed by a localized retry action; use the existing canonicalization and access rules.
- Source-change events identify the source, its referencing workspace IDs, canonical root and availability. Emit only observed changes and successful committed locator changes; failed operations emit no committed-change event.
- Use the current owned Table records to prove presentation independence. Do not introduce later view-management features or placeholder project/property tables.

## Implementation Steps


### Task 1: Rename workspaces through the service and localized UI


Files:

- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/contracts/service-protocol.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: src/service/entry.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify: src/renderer/App.tsx
- Modify: src/renderer/localization.ts
- Modify: src/renderer/app.css
- Modify: tests/workspaces-service.test.mjs
- Modify: tests/backend-lifecycle.test.mjs
- Modify: tests/renderer-app.test.tsx

- [x] Add failing tests for active/inactive rename, duplicate names, verbatim authored text, restart persistence and unchanged source/view identities.
- [x] Add workspace.rename with workspaceId and name, returning ServiceResult<WorkspaceLoad>; validate exact payload keys and UUID/entity existence at the backend boundary.
- [x] Implement the rename and resulting snapshot transactionally. Blank names, malformed/unknown commands and removed IDs leave all records unchanged; injected storage failure rolls back.
- [x] Expose rename through the typed desktop API/client and add an EN/RU rename form with save/cancel, keyboard submission, pending state and actionable errors. Failed saves retain the actual name and entered draft.
- [x] Extend IPC/client/UI tests, including sibling workspaces over the same source, different roots and failures without false success.
- [x] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test and npm run typecheck with the same explicit PATH prefix; commit the verified slice.

### Task 2: Persist workspace ordering and expose accessible reorder controls


Files:

- Modify: src/service/db/schema.ts
- Create: src/service/db/migrations/0002_workspace_order.sql
- Modify: src/service/db/migrations/meta/_journal.json
- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: src/service/entry.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify: src/renderer/App.tsx
- Modify: src/renderer/localization.ts
- Modify: src/renderer/app.css
- Modify: tests/workspaces-service.test.mjs
- Modify: tests/backend-lifecycle.test.mjs
- Modify: tests/renderer-app.test.tsx
- Modify: tests/build-smoke.test.mjs
- Modify: tests/settings-service.test.mjs
- Modify: tests/artifact-smoke.test.mjs
- Modify: scripts/check-artifact.mjs

- [x] Add an upgrade fixture using the existing two migrations and populated workspace/view/selection records. Assert insertion-order backfill, unchanged IDs/data and successful repeated reopen.
- [x] Add workspace positions, append-on-create and explicitly ordered loads. Ship the new migration through the existing migration-copy/build mechanism.
- [x] Add workspace.reorder with workspaceIds, returning ServiceResult<WorkspaceLoad>. Validate the exact current permutation before changing positions in one transaction; preserve active selection and owned views.
- [x] Add a saved-workspace management list with labeled Move up/Move down buttons, disabled boundary/pending states and stable keyboard focus. Refresh the switcher from successful committed results.
- [x] Test restart order, identity/presentation preservation, duplicate/omitted/unknown IDs, stale lists after create/remove, injected rollback and EN/RU keyboard operation.
- [x] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test and npm run typecheck with the same explicit PATH prefix; commit the verified slice.

### Task 3: Remove configurations atomically while retaining sources and files


Files:

- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: src/service/entry.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify: src/renderer/App.tsx
- Modify: src/renderer/localization.ts
- Modify: src/renderer/app.css
- Modify: tests/workspaces-service.test.mjs
- Modify: tests/backend-lifecycle.test.mjs
- Modify: tests/renderer-app.test.tsx

- [x] Add failing tests for inactive, active, last-reference and final-workspace removal across shared and different roots. Snapshot source records, surviving view records and sentinel file bytes.
- [x] Add workspace.remove with workspaceId, returning ServiceResult<WorkspaceLoad>. Validate existence before mutation; update/clear selection, delete only owned views and the workspace, and maintain ordering in one transaction.
- [x] Implement deterministic fallback to the first remaining saved configuration and its existing Table view, including an unavailable source. Invalid/stale removal and injected transaction failures preserve the previous selection and all unrelated data.
- [x] Prove retained-source reuse after last-reference removal and restart: creating a workspace over that root reuses sourceId while receiving new workspace/view IDs. Preserve any existing source-owned metadata; add no project schema solely for this test.
- [x] Add EN/RU removal confirmation naming the configuration and explicitly explaining that project files and source metadata are retained. Support cancel, keyboard operation, pending/error states, focus recovery and the useful final-workspace creation state.
- [x] Extend service/IPC/UI regressions for repeated removal, surviving presentation records and file retention; run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test and npm run typecheck with the same explicit PATH prefix; commit.

### Task 4: Deliver source-scoped notifications through the real backend and client


Files:

- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/service-protocol.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: src/service/entry.ts
- Modify: src/desktop/backend-controller.ts
- Modify: src/desktop/main.ts
- Modify: src/desktop/preload.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify: src/renderer/App.tsx
- Modify: src/renderer/localization.ts
- Modify: tests/workspaces-service.test.mjs
- Modify: tests/backend-lifecycle.test.mjs
- Modify: tests/renderer-app.test.tsx

- [ ] Define WorkspaceChangeEvent variants for committed workspace-list changes and source-state changes. Add validated event envelopes distinct from request/response messages.
- [ ] Implement service subscriptions returning an unsubscribe function. Publish mutation events only after successful transactions; compute source fanout from actual referencing configurations.
- [ ] Add workspace.refreshSource with workspaceId, returning the observed source state. Reuse canonical-root/access checks and observe changes during existing load/activate/create paths; unchanged observations must not generate refresh loops.
- [ ] Route events through utilityProcess message ports, BackendController, main-process forwarding, narrow preload onWorkspaceChange and WorkspaceServiceClient.onWorkspaceChange. Clean subscriptions on unsubscribe, renderer teardown and backend shutdown.
- [ ] Add a localized retry-folder-access action and apply authoritative source changes to referencing UI state. Ignore unrelated-source changes; prevent delayed reloads/events from restoring a removed or previously active workspace.
- [ ] Test actual temporary-root unavailable/recovered transitions, same-source fanout, different-source isolation, locator normalization, rollback suppression, malformed events, request/event interleaving and unsubscription through service plus IPC/client boundaries.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test and npm run typecheck with the same explicit PATH prefix; commit the verified slice.

### Task 5: Verify integrated acceptance and update capability documentation


Files:

- Modify: scripts/smoke-runtime.mjs
- Modify: tests/renderer-app.test.tsx
- Modify: tests/backend-lifecycle.test.mjs
- Modify: src/renderer/components/bb-foundation.stories.tsx
- Modify: README.md
- Modify: docs/development.md
- Modify: docs/architecture.md
- Modify: docs/reuse.md only if additional bb code is actually copied

- [ ] Extend automated Electron scenarios to create two same-root configurations and a different-root configuration, rename/reorder/select through the UI, restart, remove inactive/active/final configurations, restart empty and recreate over the retained source. Assert workspace/source/view IDs and sentinel file bytes.
- [ ] Exercise source-change subscription delivery through the actual utilityProcess/preload/client route using temporary-root availability changes and the production refresh action. Preserve strict canonical-root, language, renderer-isolation and bounded shutdown/startup-failure assertions.
- [ ] Update Ladle previews and focused UI regressions for management, confirmation, loading/error/empty states and long authored names/paths. Capture EN/RU management screens at 1440×960, 1024×720 and narrow width, with automated overflow checks.
- [ ] Update README.md, docs/development.md and docs/architecture.md to describe only implemented management/notification behavior, retained data, fallback selection and actual verification commands. Preserve notices and provenance when applicable.
- [ ] Run the full checks, each with PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" explicitly prepended: npm test, npm run lint, npm run typecheck, npm run check:docs, npm run build and npm run build:ladle. Run git diff --check.
- [ ] Run explicitly PATH-prefixed npm run smoke:runtime -- dev, npm run package:dev:mac and npm run smoke:runtime -- release against a freshly built macOS artifact. Bound packaging waits; if downloads fail, use run-local --config.electronDist=node_modules/electron/dist with installed Electron 44.7.0 without modifying canonical package/CI settings.
- [ ] Record actual commands, results, screenshots and limitations under ignored work/ralphex/issue-10. Inspect the final diff against dd9c42d880cf312a8a685587920c4c837c6574d6, commit verified task files and leave a clean worktree. Do not add an active-plan link to docs/plans/README.md.

## Acceptance Mapping

- Same-root sharing and different-root isolation: existing lifecycle regressions extended in Tasks 1–5.
- Durable names/order/selection and independent presentation: Tasks 1–3 and restart scenarios in Task 5.
- Safe removal and retained-source reuse: Task 3 and actual runtime checks in Task 5.
- Invalid/stale commands and rollback: Tasks 1–4.
- Real shared-source notification fanout and cleanup: Task 4 and actual runtime checks in Task 5.
- EN/RU, keyboard operation and useful states/layouts: every UI slice and Task 5.

## Post-Completion

- Outer Ralphex owns reviews; do not recursively invoke it.
- Coordinator assesses target-platform acceptance and independently obtains any required Windows evidence. macOS results do not establish Windows verification.
- Coordinator owns GitHub/Beads completion, integration and any authorized push/release. Keep parent #7 and epic workspace-31i open; do not start the next ticket.
- Report observed checks, remaining limitations and existing commits in Russian. Preserve valid documentation links after automatic plan archival.
