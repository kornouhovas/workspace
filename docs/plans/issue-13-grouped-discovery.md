# Issue #13: Grouped Discovery and Folder-backed Categories

## Overview

Implement GitHub #13 as four bounded vertical slices: review grouped discovery, apply it atomically and display required categories in Table, rename the category property label, and complete regression fixtures, local graphical checks and verification documentation.

An unconfigured source can choose direct or grouped interpretation before Apply. Configured sources can rescan their current mode; changing that mode remains T09/#16.

Target plan file: docs/plans/issue-13-grouped-discovery.md.

## Context

- Requirements: work/ralphex/issue-13/task.md and work/ralphex/issue-13/coordinator-findings.md.
- Product references: docs/product.md, docs/decisions.md, docs/specs/workspace-0.1.0.md and T06.
- Boundary references: T07–T09 and T12–T15, docs/architecture.md, accepted ADRs 0001–0005, GLOSSARY.md and docs/reuse.md.
- Workflow and release references: docs/development.md and docs/releases.md.
- Tracking: GitHub #13; coordinator-owned Beads step workspace-31i.6.
- Checkout: codex/issue-13-grouped-discovery.
- Fixed diff base: d1a00f6df2820362bf205bde48869b6799dd9145.
- Existing implementation: read-only direct preview, token-bound atomic Apply, source-owned projects/Text data, independent discovery/property revisions, production message-port notifications and sandboxed React.
- Dependencies: existing committed dependencies only; no coverage dependency or quota. npm ci has already completed with exit 0 in this checkout.
- Files involved: workspace contracts, discovery/service modules, schema/migrations, entry/desktop/client boundaries, discovery/Table components, localization, service/renderer/IPC tests, Ladle/runtime fixtures, build/artifact checks and CHANGELOG.md.

## Development Approach

- Testing approach: TDD for service invariants, transactional failures and race regressions; extend interaction tests alongside each UI change.
- Complete and verify each task before starting the next.
- Every code-changing task includes new or updated behavioral tests.
- Run the full project test suite, lint and typecheck at each task checkpoint. All must pass before the next task.
- Use real disposable SQLite databases and filesystem roots through the typed public Workspace service. UI fixtures complement this seam.
- Keep React thin, preserve the production IPC route and existing renderer isolation.
- Commit each completed and verified task using explicit task paths and an English commit message.
- Coordinator reviews this plan before execution. This phase writes no implementation.

## Global Constraints

- Executor and reviewers use or inherit gpt-6.1-sol with high reasoning.
- Explicitly prepend /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin for every Node/npm/npx/tsx invocation, including reviewers and login shells.
- Use the committed dependency resolution; no Node downloads, new coverage tooling or global dependency upgrades.
- No nested Ralphex, tracker mutation, executor push, remote merge, release or global configuration changes.
- Keep logs, screenshots and failed attempts below work/ralphex/issue-13.
- Preserve unrelated files, settings, selection, view IDs, source/project identities and authored Text data.
- Never use live-user fixtures or alter project files.
- No physical category editing, ordinary Select/MultiSelect, reassociation, watchers, configured-source mode switching, archive selection/mutations, backup/import, new views, grouping/filtering/dragging, synchronization, AI, remote access or website.
- Record provenance and retain applicable notices if any new upstream code is copied.
- Native macOS27 shutdown #44 remains independent: preserve failures and the unchanged ten-second normal-quit bound. No blind retries, timeout increases or forced-exit passing claims.
- Execute the authorized local graphical checks in Task 4 and record actual outcomes before committing. Their execution does not establish final platform acceptance.
- Actual Windows evidence and final platform/product acceptance belong to the coordinator.

## Settled Interpretation and Contracts

### Discovery

- Introduce DiscoveryMode = direct | grouped.
- Extend workspace.previewDiscovery with optional mode. Omission uses the configured mode, or direct for an unconfigured source.
- Reject a different explicit mode for a configured source at the service boundary.
- DiscoveryPreview includes the exact reviewed mode and entries discriminated as category or project. A project entry identifies its enclosing category path.
- Grouped interpretation is exactly Root/Category/Project. Root directories are categories, including direct-looking folders; only immediate real directory children become projects.
- Ordinary files are ignored. Discovered project contents are never enumerated.
- Eligible empty categories remain visible and are persisted by Apply. The preview explicitly explains empty categories and the mixed-depth consequence.
- Manual exclusions use source-relative paths with one component for a category or two for a grouped project. Validate components using the current OS basename rules; retain safe POSIX colon/backslash names.
- Excluded categories suppress child enumeration. Automatic hidden/service/link/archive exclusions are decided before excluded targets are opened.
- A persisted archive at category depth excludes that category. An archive deeper beneath a category excludes its containing immediate project candidate. Direct mode retains its conservative containing-child exclusion. Null means no archive designation; names never imply Archive.

### Persistence and Table

- Add focused migration 0006_grouped_discovery.sql; preserve migrations 0000–0005.
- Store source-owned category records with opaque IDs, relative paths, native evidence and conservative association states.
- Reuse category IDs only for continuously matching same-path/native-evidence associations beneath the verified source root. No cross-path matching or metadata transfer to replacement IDs.
- Associate grouped projects with a same-source category ID. Every active grouped project requires a valid active category; direct projects have no category value.
- Store one focused folder-backed property identity and nullable authored display label per grouped source. Null displays the localized default Category/Категория; authored labels remain unchanged.
- Extend ProjectList with mode, category records and category-property metadata carrying an independent categoryPropertyRevision. Extend ProjectSummary with categoryId; grouped project names are their native project basename.
- Expose category values read-only in the existing Table. No clear/change/option-edit control or value mutation command is added.
- Discovery changes increment discoveryRevision and use workspace.projectsChanged. Metadata-only label changes increment categoryPropertyRevision and use workspace.categoryPropertyChanged.
- Label changes leave Text propertyRevision and discoveryRevision unchanged and do not invalidate discovery tokens.
- Extend list/save guards to compare discovery and category-property revisions independently; an older list cannot overwrite a newer label.

### Label Command

- Add workspace.renameCategoryProperty with exactly type, workspaceId, propertyId and name.
- WorkspaceService.renameCategoryProperty(input: unknown) returns ServiceResult<CategoryPropertySnapshot>.
- WorkspaceServiceClient.renameCategoryProperty(workspaceId, propertyId, name) submits the typed command.
- CategoryPropertySnapshot carries workspaceId, sourceId, propertyId, name and revision.
- Validate UUIDs, existence, grouped mode, source ownership and nonblank names. Preserve authored spelling/whitespace and permit duplicate display labels.
- Identical assignments succeed without revision changes or events.
- Publish committed label events to actual referencing workspaces through the existing notification queue and production ports/main/preload/client.

## Review Focus

- Category replacement or link swap while scanning children must reject unstable review/Apply without reading an excluded target or transferring metadata: Tasks 1–2.
- Malformed paths, wrong modes and foreign tokens/IDs must leave configuration unchanged: Tasks 1–3.
- Empty categories and direct-looking roots must show their exact grouped meaning before Apply: Tasks 1–2.
- Delayed preview/list/Apply/label responses must respect selection, removal, newer events, backend generation and cleanup while accepting own event-before-response success: Tasks 1–3.
- Migration, restart and last-workspace removal must preserve identities, authored values and independent views without filesystem writes: Tasks 2–4.

## Implementation Steps

### Task 1: Review grouped interpretation through the production UI and service

Files:

- Modify: src/contracts/workspaces.ts
- Modify: src/service/discovery.ts and src/service/workspaces.ts
- Modify: src/service/entry.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify: src/renderer/components/DiscoveryPanel.tsx
- Modify: src/renderer/localization.ts and src/renderer/app.css
- Modify: tests/workspaces-service.test.mjs and tests/renderer-app.test.tsx
- Modify: tests/settings-service.test.mjs and tests/backend-lifecycle.test.mjs where boundary fixtures require extension
- Create: tests/grouped-discovery-service.test.mjs
- Modify: docs/architecture.md and docs/development.md

Interfaces:

- Produce the mode-aware preview contract, discriminated category/project entries and complete reviewed scan snapshot.
- Preserve the existing Apply payload; mode is bound inside the reviewed token.

- [x] Document and test exact depth, visible empty categories, mixed-depth roots, ignored files and stopping at projects before enabling grouped Apply.
- [x] Implement a bounded grouped scanner that verifies source/category containment and native observations around child enumeration; include root/category/project interpretation in repeated snapshot comparisons.
- [x] Apply both-level automatic/manual exclusions and the settled archive policy; reject traversal, malformed depths, duplicates and unselectable new exclusions while preserving native basename rules and saved exclusions.
- [x] Extend preview/token validation and production request routing; reject configured-source mode switching. Until Task 2 supplies persistence, reject grouped Apply explicitly and disable its UI action.
- [x] Add EN/RU initial mode selection and category/project preview hierarchy, explicit interpretation guidance, keyboard/focus behavior and empty/loading/validation/error states. Guard cancelled, superseded and delayed requests.
- [x] Add real service tests for read-only preview, inaccessible excluded targets, category/link swaps, case/archive behavior and unchanged inventories/bytes; add production IPC/client and EN/RU interaction regressions.
- [x] Run the task checkpoint and commit explicit task paths as feat: preview grouped discovery safely.

Task 1 execution evidence (2026-10-09):

- Implemented optional reviewed mode, discriminated category/project preview, exact two-level grouped scan, both-level exclusions and EN/RU initial mode selection/hierarchy. Grouped Apply is explicitly rejected by the service and disabled in the UI; direct Apply remains verified.
- Disposable real SQLite/filesystem tests cover empty/mixed-depth roots, ignored files, no project-content enumeration, excluded metadata access, category replacement/link swaps, repeated snapshot changes, native basename rules, archive casing/designation, root failures and token/mode ownership. Production message-port routing and client-backed EN/RU keyboard/focus/race/error recovery tests passed.
- Final checkpoint: PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test passed 188 tests (0 failures, 0 skips), including a fresh production build. npm run lint, npm run typecheck and npm run check:docs all exited 0 with the same explicit PATH prefix; documentation check covered 60 Markdown files. git diff d1a00f6df2820362bf205bde48869b6799dd9145 --check passed.
- Logs: work/ralphex/issue-13/evidence/task-1/npm-test-final.log, lint-final.log, typecheck-final.log and check-docs-final.log. Earlier successful checkpoints are retained as npm-test-1.log and npm-test-2.log. The initial targeted test invocation found no dist/service/settings.mjs; after building the baseline, all six initial grouped tests failed as expected because mode was not implemented. During development, the category-swap spy was corrected to use the canonical macOS fixture path, and TypeScript caught an incorrect mock status argument before it was fixed.
- Existing direct Ladle fixtures were updated only to conform to the discriminated contract; grouped graphical fixtures/checks remain Task 4. No Electron graphical runtime, packaged runtime, Windows or platform acceptance is claimed in this checkpoint. Full review, coordinator acceptance, tracker/integration actions and independent #44 remain pending outside actionable checkboxes.

### Task 2: Apply grouped discovery atomically and show required categories in Table

Files:

- Modify: src/service/db/schema.ts
- Create: src/service/db/migrations/0006_grouped_discovery.sql
- Modify: src/service/db/migrations/meta/_journal.json
- Modify: src/service/discovery.ts and src/service/workspaces.ts
- Modify: src/contracts/workspaces.ts
- Modify: src/renderer/components/DiscoveryPanel.tsx
- Modify: src/renderer/components/TextPropertiesTable.tsx
- Modify: src/renderer/localization.ts and src/renderer/app.css
- Modify: tests/grouped-discovery-service.test.mjs, tests/workspaces-service.test.mjs and tests/text-properties-service.test.mjs
- Modify: tests/renderer-app.test.tsx
- Modify: scripts/check-artifact.mjs, tests/build-smoke.test.mjs and tests/artifact-smoke.test.mjs
- Modify: docs/architecture.md and docs/development.md

Interfaces:

- Produce persisted category IDs, grouped ProjectList/category metadata and same-source project/category associations.
- Preserve discovery revision/event semantics and the existing Text contracts.

- [x] Add the focused schema/migration with same-source category constraints, stable property identity and independent label revision. Protect required active grouped categories and direct-mode absence at persistence/service boundaries.
- [x] Extend conservative interpretation for categories and projects. Retain excluded/missing/unresolved/replaced records and Text values; category replacement cannot silently reattach old project metadata.
- [x] Revalidate token ownership, exact mode, configuration, root/category evidence, exclusions and the complete reviewed interpretation before and during one SQLite Apply transaction. Include empty-category changes in committed discovery revisions.
- [x] Persist categories, project associations and source mode atomically; publish only changed committed snapshots. Reject stale reviews and roll back injected failures without events. Preserve configured-source mode-switch rejection.
- [x] Enable grouped Apply and add the read-only category column to the existing Table without remounting Text editors. Display mode and saved categories for sibling workspaces, including zero-project grouped sources; keep direct Tables free of the category property.
- [x] Test actual populated 0000–0005 upgrades, injected rollback, stale category/project snapshots, malicious ownership/mode/token inputs, no-op events, sibling/unrelated isolation, reopen, source reuse and unchanged filesystem inventories/bytes. Update migration build/artifact checks and EN/RU Apply/race tests.
- [x] Run the task checkpoint and commit explicit task paths as feat: persist grouped projects and required categories.

Task 2 execution evidence (2026-10-09):

- Added focused migration 0006 without modifying 0000–0005. Categories, stable nullable-label property identity and categoryPropertyRevision belong to the source; project foreign keys and SQLite triggers enforce same-source category ownership, required active grouped categories and direct-source absence. The actual populated six-migration upgrade preserves settings, authored Text values, logical IDs, independent views and selection through repeated reopen.
- Grouped Apply now revalidates mode/token ownership, configuration, stored category/project snapshots and complete root/category/project observations before and inside one transaction, including before and after writes. Rollback tests preserve all records/configuration and emit no event after injected project insertion failures or category/link swaps during persistence. Category-only additions increment discoveryRevision; unchanged rescans emit nothing.
- Conservative category/project interpretation retains excluded/missing/unresolved/replaced records and old Text values. Replacement category IDs cannot inherit project metadata; cross-path moves stay unresolved. Empty categories, required read-only Table values, native project basenames, sibling visibility, reopen and retained-source reuse are covered with real disposable SQLite/filesystem tests and unchanged inventories/bytes.
- Addressed coordinator Finding 1 within this task: selecting a category removes its child exclusions from the UI draft. Real-service and EN/RU production-client regressions exercise child-then-parent selection, refresh, reinclusion and explicit Apply without accessing excluded targets. Unselectable redundant new child inputs remain rejected; the service never opens excluded categories to validate them.
- Production entry/ports/controller/client tests cover grouped Apply, shared category/property snapshots, token ownership, committed event-before-response ordering, no-op notifications and unrelated-source isolation. EN/RU interactions verify keyboard/focus, zero-project sibling categories, direct-column absence, preservation of the same Text editor/draft across grouped rescan and independent discovery/category-property guards for delayed Apply responses. Existing direct Ladle fixtures only gained the required projection fields; permanent grouped graphical fixtures remain Task 4.
- Final checkpoint: PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test passed 203 tests (0 failures, 0 skips), including a fresh production build. npm run lint, npm run typecheck and npm run check:docs exited 0 with the same explicit PATH prefix; documentation links covered 60 Markdown files. git diff d1a00f6df2820362bf205bde48869b6799dd9145 --check passed.
- Final logs: work/ralphex/issue-13/evidence/task-2-test-final.log, task-2-lint-final.log, task-2-typecheck-final.log and task-2-docs-final.log. Earlier attempts remain retained: the initial three persistence tests failed against the temporary grouped-Apply rejection; intermediate checkpoints exposed obsolete rejection/migration expectations and TypeScript caught missing projection fields and un-narrowed test results. A focused red regression identified cross-source updates of categories with retained inactive projects; the migration now protects those associations as well as active ones.
- Category-label mutation remains Task 3. No graphical Electron/Ladle run, unsigned package execution, Windows evidence, platform/product acceptance, tracker mutation or push occurred in this task. Full review and coordinator gates remain pending; independent native shutdown #44 and its unchanged ten-second bound are untouched.

### Task 3: Rename the category property label without changing folders

Files:

- Create: src/service/category-properties.ts
- Modify: src/service/workspaces.ts and src/service/settings.ts
- Modify: src/contracts/workspaces.ts, src/contracts/desktop-api.ts and src/contracts/service-protocol.ts
- Modify: src/service/entry.ts and src/renderer/workspace-service-client.ts
- Modify: src/desktop/main.ts, src/desktop/preload.ts and src/desktop/backend-controller.ts only where existing routing/validation needs extension
- Create: src/renderer/components/CategoryPropertyHeader.tsx
- Modify: src/renderer/components/TextPropertiesTable.tsx and src/renderer/components/DiscoveryPanel.tsx
- Modify: src/renderer/localization.ts and src/renderer/app.css
- Modify: tests/grouped-discovery-service.test.mjs, tests/settings-service.test.mjs and tests/backend-lifecycle.test.mjs
- Modify: tests/renderer-app.test.tsx
- Modify: docs/architecture.md and docs/development.md

Interfaces:

- Produce renameCategoryProperty and CategoryPropertySnapshot as defined above.
- Add validated workspace.categoryPropertyChanged events using the independent label revision.

- [x] Implement exact-payload, grouped-mode and ownership validation in the focused metadata service; commit label/snapshot/revision atomically and suppress failed/no-op notifications.
- [x] Route the typed command and validated event through production entry, ports, main, preload and client while preserving isolation and listener cleanup.
- [x] Add a focused EN/RU header-label editor with Enter/save, Escape/cancel, restored focus, validation, pending, failure, saved and sibling-change feedback. Retain recoverable drafts and require explicit save after a sibling change.
- [x] Merge list/label snapshots using independent revision guards. Handle selection/removal, backend generations, cleanup and newer events; accept own event-before-response success without presenting an older label as current.
- [x] Test foreign/missing IDs, direct sources, blank/long authored labels, rollback, no-op/reentrant events, sibling/unrelated isolation and reopen. Assert that label saves leave directories, bytes, logical IDs, Text revisions/drafts and valid discovery previews unchanged.
- [x] Add production IPC and EN/RU keyboard/race regressions for delayed saves/lists, backend restarts and same-source refreshes; verify category values have no editing or clearing control.
- [x] Run the task checkpoint and commit explicit task paths as feat: rename folder-backed category labels.

Task 3 execution evidence (2026-10-09):

- Implemented the focused metadata-only workspace.renameCategoryProperty service, typed CategoryPropertySnapshot and exact command routing. UUID/existence/grouped-mode/source ownership/nonblank validation preserves authored whitespace, spelling and duplicate names. The transaction commits the label, snapshot and independent categoryPropertyRevision together; injected revision-write failure rolls back the earlier label write. Failed and identical assignments publish nothing.
- Committed workspace.categoryPropertyChanged events carry the actual source references through the existing notification queue, entry/message ports/controller/main/preload/client. Throwing and reentrant subscribers preserve committed results and event order. Production transport tests cover event-before-response success, malformed command/event rejection, unrelated-source isolation and unsubscribe/unload/shutdown cleanup. Existing main/preload/controller generic routing required no implementation changes; their bundled production path is exercised.
- Added the EN/RU category header editor with Enter/save, Escape/cancel, focus restoration, nonblank validation, pending feedback, recoverable failure, saved/newer-change feedback and retained drafts after sibling changes. Category values remain read-only; direct Tables expose no category property. Same-source refreshes retain category and Text drafts. Label events reload metadata without invalidating discovery reviews.
- Independent list/label revision guards preserve newer labels during delayed project loads and preserve current project rows when an older discovery snapshot carries a newer label. Delayed saves accept own event-before-response success and cannot overwrite newer labels; workspace switch/removal, backend generations and cleanup invalidate old responses without replay. Existing below-discovery-revision errors and Retry behavior remain covered.
- Real disposable SQLite/filesystem tests cover foreign/missing/direct/malformed inputs, long authored labels, duplicate labels, no-ops, rollback, sibling/unrelated isolation, close/reopen, retained category/property/project/view IDs and unchanged directory inventories/file bytes. Label changes preserve Text snapshots/propertyRevision, discoveryRevision and an already reviewed Apply token.
- Final checkpoint: PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test passed 212 tests (0 failures, 0 skips), including a fresh production build. npm run lint, npm run typecheck and npm run check:docs exited 0 with the same explicit PATH prefix; documentation links covered 60 Markdown files. git diff d1a00f6df2820362bf205bde48869b6799dd9145 --check passed.
- Final logs: work/ralphex/issue-13/evidence/task-3-test-final.log, task-3-lint-final.log, task-3-typecheck-final.log and task-3-docs-final.log. Red service/UI tests and intermediate attempts remain retained. The first full suite exposed two lost below-revision Retry/error regressions during independent snapshot merging; after restoring truthful discovery errors, both regressions and the complete suite passed. Intermediate TypeScript failures identified an un-narrowed request and overly broad test event union; their test annotations were corrected without changing runtime behavior.
- Architecture and development documentation describe the implemented command/event/editor and verification limits. No upstream code was copied. Grouped graphical fixtures, actual Electron/Ladle checks and fresh unsigned package execution remain Task 4. Windows evidence, full review, platform/product acceptance, tracker/integration actions and independent #44 remain coordinator gates; no tracker mutation, push or shutdown-semantic changes occurred.

### Task 4: Complete permanent fixtures, execute local graphical checks and document outcomes

Files:

- Modify: src/renderer/components/bb-foundation.stories.tsx
- Modify: scripts/smoke-discovery-layouts.mjs and scripts/smoke-runtime.mjs
- Modify: tests/components.test.tsx, tests/renderer-app.test.tsx and relevant existing smoke tests
- Modify: docs/architecture.md, docs/development.md, README.md and CHANGELOG.md
- Modify: docs/reuse.md only if new upstream material was copied
- Modify: docs/plans/issue-13-grouped-discovery.md with actual execution evidence
- Record ignored evidence below: work/ralphex/issue-13/evidence/

- [x] Extend permanent Ladle fixtures for EN/RU grouped preview, empty/mixed roots, applied categories and all label-editor states. Exercise long category/project/label strings at 1440×960, 1024×720 and 420×800 with wrapping, bounded Table scrolling and accessible controls.
- [x] Extend permanent Electron scenarios using disposable roots and production IPC: preview/cancel, both-level exclusions, stale review requiring explicit Apply, grouped Table, sibling visibility, metadata-only label rename and unrelated-source isolation.
- [x] Add restart and final-workspace-removal/source-reuse assertions for mode, category/property/project IDs, authored labels/Text values, settings and independent view IDs; compare file bytes/inventories and preserve direct regression scenarios. Retain separate feature, shutdown, restart and retained-source-reuse evidence stages with honest failed/unreached reporting and the unchanged ten-second normal-quit assertion.
- [x] Update documentation and CHANGELOG.md Unreleased to describe the implemented grouped preview, persisted required read-only category values and metadata-only category-property label rename. Remove grouped discovery from Planned while retaining later reconciliation/archive work; do not claim configured-source mode switching, folder moves, physical category editing or release completion.
- [x] Run the final automated checkpoint listed below, including a fresh production build followed by the Ladle build. Require passing tests, lint, typecheck, build, documentation links, Ladle build and full-base whitespace checks before the local graphical checks.
- [x] Execute the Ladle layout check once after those fresh builds using the command below. Record its actual exit status, EN/RU screenshots, three layouts and interaction/layout assertions.
- [x] Execute the development runtime check once against the fresh production build using the command below. Record actual feature, shutdown, restart and retained-source-reuse outcomes separately, including any failed or unreached stage.
- [x] Produce a fresh unsigned macOS development package and execute its artifact check using the commands below. Record actual package/artifact outcomes and artifact identity; use only this newly produced, successfully checked artifact for the packaged runtime check.
- [x] Execute the packaged runtime check once against that fresh artifact using the command below. Record actual feature, shutdown, restart and retained-source-reuse outcomes separately. Preserve an observed #44 failure without blind retries, quit-semantic changes, forced-exit passing claims or claims that unreached stages passed.
- [x] Record the commands, actual results, logs/screenshots and remaining coordinator gates in the plan and verification documentation before committing. Resolve confirmed in-scope feature defects with regression tests and fresh affected verification; retain an independent observed #44 failure as failed evidence. Commit explicit verified task paths as feat: verify grouped discovery across service and desktop.

The local-check checkboxes record execution and truthful outcome recording, not platform acceptance. A failed result remains failed even when its execution-recording item is complete. If fresh packaging/artifact validation fails, the packaged runtime item remains incomplete until a valid fresh artifact is available; do not substitute an older artifact. Known #44 shutdown failure does not authorize repeated attempts or mark dependent restart stages complete.

Task 4 execution evidence (2026-10-09):

- Extended permanent Ladle fixtures to 68 EN/RU states: direct/grouped previews (including empty and mixed-depth roots), required read-only categories, long names and category-label default/authored/no-projects/loading/editing/saving/validation/failure/sibling/saved/newer states. Added a focused long-content/read-only/localized-default Table regression. Actual layout check exited 0 with 204 screenshots at 1440×960, 1024×720 and 420×800, wrapping/bounded-scroll assertions and keyboard retry/cancel/focus checks; normal Ladle quit passed.
- Permanent disposable Electron scenarios now exercise grouped preview/cancel, both-level automatic/manual exclusions (including child-then-parent normalization), stale review requiring explicit Apply, empty/mixed roots, required category values, EN/RU metadata-only label validation/rename, source-scoped events, siblings and unrelated-source isolation. Restart and final-source removal/reuse compare mode, category/property/project IDs, authored labels/Text, settings and independent views while preserving inventories/bytes. Direct/Text scenarios remain intact.
- Automated checkpoint: PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test passed 213 tests (0 failed/skipped), including a fresh production build. npm run lint, npm run typecheck, npm run check:docs, separate npm run build and subsequent npm run build:ladle exited 0 with the same explicit PATH prefix. Final lint/docs/full-base diff checks passed after evidence edits. No new coverage dependency or upstream module copy was introduced.
- Development runtime command ran once and exited 0: pre-quit features, normal shutdown/backend exit, restart persistence, retained-source reuse and expected startup-failure handling all passed. It produced 78 EN/RU screenshots. This individual pass does not resolve #44.
- Fresh unsigned macOS 27.0/arm64 package: CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac and the explicit npm run check:artifact -- release both exited 0 with the required PATH prefix. Artifact: release/mac-arm64/Workspace.app, 0.1.0, Electron 44.7.0; app.asar SHA-256 8e46705976101662efb3b097d09d742e2a24f3028dc15df8b83c31f850115b9d. Only this fresh verified artifact was used for the packaged run.
- Packaged runtime command ran once and exited 1. Pre-quit features, initial normal shutdown/backend exit, restart persistence, final-workspace removal/source reuse, second/third normal quits and expected startup-failure UI assertions passed. Final quit after startup-failure handling timed out after the unchanged 10000ms; its following backend-exit assertion was unreached. All feature/restart/reuse stages had already completed; the overall package run remains failed. The existing helper forced cleanup and rethrew the failure, which is not normal-quit success. No retry, quit-semantic change, timeout increase or #44 resolution occurred. It produced 78 EN/RU screenshots before failure.
- Evidence logs: work/ralphex/issue-13/evidence/task-4-{test-1,lint-1,lint-final,typecheck-1,docs-1,docs-final,build-1,ladle-build-1,ladle-run-1,dev-run-1,package-1,artifact-1,package-run-1,diff-final}.log; artifact identity in task-4-artifact-identity.txt. JSON observations and screenshots remain in evidence/ladle, evidence/dev and evidence/package. The initial graphical launch fetched the installed pinned Electron binary; no Node download or dependency/configuration upgrade occurred.
- README, architecture/development docs and CHANGELOG Unreleased now describe implemented grouped discovery/read-only categories/label rename and later boundaries. Detailed commands, stage outcomes, failed/unreached evidence and coordinator gates are in docs/verification/issue-13-grouped-discovery.md. The completed execution-recording checkboxes do not turn the failed shutdown into a passed check or establish GitHub #13 completion. Windows, full review, coordinator/platform/product acceptance, tracker/integration actions and independent #44 remain pending. The current execution directive requires the local commit's feat: prefix.

## Automated Task Checkpoint

Run after Tasks 1–3:

- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test
- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run lint
- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run typecheck
- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run check:docs
- git diff d1a00f6df2820362bf205bde48869b6799dd9145 --check

Task 4 repeats that checkpoint and then runs, in order:

- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run build
- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run build:ladle

No coverage threshold or coverage tooling is required.

## Task 4 Local Graphical Check Commands

Execute these checks in order before the Task 4 commit. These are authorized local execution steps; final review and platform acceptance remain coordinator gates.

Ladle layouts:

- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH WORKSPACE_SMOKE_EVIDENCE_DIR=work/ralphex/issue-13/evidence/ladle node scripts/smoke-discovery-layouts.mjs

Development runtime:

- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH WORKSPACE_SMOKE_EVIDENCE_DIR=work/ralphex/issue-13/evidence/dev npm run smoke:runtime -- dev

Fresh unsigned macOS package and artifact:

- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac
- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run check:artifact -- release

Packaged runtime:

- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH WORKSPACE_SMOKE_EVIDENCE_DIR=work/ralphex/issue-13/evidence/package npm run smoke:runtime -- release

package:dev:mac rebuilds production output and already includes an artifact check; retain both its result and the explicit artifact-check result. It cleans dist, so complete Ladle capture before packaging.

Preserve logs and EN/RU screenshots, including keyboard/focus and layout evidence. For runtime checks, record feature assertions, normal shutdown, restart persistence and retained-source reuse separately.

Distinguish a failed assertion from a stage that was never reached. If shutdown fails, preserve that failure and completed feature evidence; do not retry blindly, relax the ten-second bound, change quit semantics or close #44.

An individual normal quit also does not resolve #44.

## Post-Completion Review and Coordinator Gates

These gates remain outside actionable Task checkboxes.

Before review, reread work/ralphex/issue-13/coordinator-findings.md. Use the fixed base for every review diff. Full review collects quality, implementation, testing, simplification and documentation reports in slot-limited batches, such as 3+2. Follow-up collects only quality and implementation. All reviewers use or inherit gpt-6.1-sol high.

Verify findings against actual code; fix confirmed in-scope defects with tests and verified commits. Report consequential unrelated issues without expanding this ticket.

Review iteration 0 execution evidence (2026-10-09):

- Collected all five prescribed independent reviews against the fixed base in slot-limited batches. Quality, implementation, testing and documentation identified the same missing Finding 2 regression and inaccurate checkpoint attribution; simplification reported no issues. Verified the gap against the tracked tests and coordinator requirement.
- Added the permanent EN/RU event-before-opening-editor / pending-list test through production components and the typed client with disposable real SQLite/filesystem fixtures. It preserves the rendered old draft, shows the newer committed header and sibling-change notice, leaves discovery revision unchanged and restores focus on Escape. The focused test passes, fails when the original baseline bug is temporarily restored, and passes again after restoring the production file unchanged.
- Fresh npm test (with the explicit Node PATH prefix) passed 214 tests, 0 failures/skips, including production build. npm run lint and npm run typecheck exited 0. Logs and red/green evidence remain in work/ralphex/issue-13/evidence/review-0. Corrected the verification report without rewriting historical Task 4 results. No new graphical/platform check or #44 retry was performed; follow-up review and coordinator gates remain pending.

Coordinator gates remain pending until observed:

- Plan approval before execution.
- Complete review reports and resolution of confirmed in-scope findings.
- Inspection and acceptance of actual local macOS development/package evidence, including retained failures and unreached stages.
- Actual Windows CI/runtime/package evidence.
- Tracker updates, authorized pushes, integration and GitHub acceptance.
- Independent #44 resolution required for final release readiness.

Handoff reports in Russian the implemented result, existing commits, actual checks, retained evidence and remaining limitations. Checked tasks alone do not establish GitHub #13 completion or release readiness.
