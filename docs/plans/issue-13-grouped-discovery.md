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

- [ ] Add the focused schema/migration with same-source category constraints, stable property identity and independent label revision. Protect required active grouped categories and direct-mode absence at persistence/service boundaries.
- [ ] Extend conservative interpretation for categories and projects. Retain excluded/missing/unresolved/replaced records and Text values; category replacement cannot silently reattach old project metadata.
- [ ] Revalidate token ownership, exact mode, configuration, root/category evidence, exclusions and the complete reviewed interpretation before and during one SQLite Apply transaction. Include empty-category changes in committed discovery revisions.
- [ ] Persist categories, project associations and source mode atomically; publish only changed committed snapshots. Reject stale reviews and roll back injected failures without events. Preserve configured-source mode-switch rejection.
- [ ] Enable grouped Apply and add the read-only category column to the existing Table without remounting Text editors. Display mode and saved categories for sibling workspaces, including zero-project grouped sources; keep direct Tables free of the category property.
- [ ] Test actual populated 0000–0005 upgrades, injected rollback, stale category/project snapshots, malicious ownership/mode/token inputs, no-op events, sibling/unrelated isolation, reopen, source reuse and unchanged filesystem inventories/bytes. Update migration build/artifact checks and EN/RU Apply/race tests.
- [ ] Run the task checkpoint and commit explicit task paths as feat: persist grouped projects and required categories.

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

- [ ] Implement exact-payload, grouped-mode and ownership validation in the focused metadata service; commit label/snapshot/revision atomically and suppress failed/no-op notifications.
- [ ] Route the typed command and validated event through production entry, ports, main, preload and client while preserving isolation and listener cleanup.
- [ ] Add a focused EN/RU header-label editor with Enter/save, Escape/cancel, restored focus, validation, pending, failure, saved and sibling-change feedback. Retain recoverable drafts and require explicit save after a sibling change.
- [ ] Merge list/label snapshots using independent revision guards. Handle selection/removal, backend generations, cleanup and newer events; accept own event-before-response success without presenting an older label as current.
- [ ] Test foreign/missing IDs, direct sources, blank/long authored labels, rollback, no-op/reentrant events, sibling/unrelated isolation and reopen. Assert that label saves leave directories, bytes, logical IDs, Text revisions/drafts and valid discovery previews unchanged.
- [ ] Add production IPC and EN/RU keyboard/race regressions for delayed saves/lists, backend restarts and same-source refreshes; verify category values have no editing or clearing control.
- [ ] Run the task checkpoint and commit explicit task paths as feat: rename folder-backed category labels.

### Task 4: Complete permanent fixtures, execute local graphical checks and document outcomes

Files:

- Modify: src/renderer/components/bb-foundation.stories.tsx
- Modify: scripts/smoke-discovery-layouts.mjs and scripts/smoke-runtime.mjs
- Modify: tests/components.test.tsx, tests/renderer-app.test.tsx and relevant existing smoke tests
- Modify: docs/architecture.md, docs/development.md, README.md and CHANGELOG.md
- Modify: docs/reuse.md only if new upstream material was copied
- Modify: docs/plans/issue-13-grouped-discovery.md with actual execution evidence
- Record ignored evidence below: work/ralphex/issue-13/evidence/

- [ ] Extend permanent Ladle fixtures for EN/RU grouped preview, empty/mixed roots, applied categories and all label-editor states. Exercise long category/project/label strings at 1440×960, 1024×720 and 420×800 with wrapping, bounded Table scrolling and accessible controls.
- [ ] Extend permanent Electron scenarios using disposable roots and production IPC: preview/cancel, both-level exclusions, stale review requiring explicit Apply, grouped Table, sibling visibility, metadata-only label rename and unrelated-source isolation.
- [ ] Add restart and final-workspace-removal/source-reuse assertions for mode, category/property/project IDs, authored labels/Text values, settings and independent view IDs; compare file bytes/inventories and preserve direct regression scenarios. Retain separate feature, shutdown, restart and retained-source-reuse evidence stages with honest failed/unreached reporting and the unchanged ten-second normal-quit assertion.
- [ ] Update documentation and CHANGELOG.md Unreleased to describe the implemented grouped preview, persisted required read-only category values and metadata-only category-property label rename. Remove grouped discovery from Planned while retaining later reconciliation/archive work; do not claim configured-source mode switching, folder moves, physical category editing or release completion.
- [ ] Run the final automated checkpoint listed below, including a fresh production build followed by the Ladle build. Require passing tests, lint, typecheck, build, documentation links, Ladle build and full-base whitespace checks before the local graphical checks.
- [ ] Execute the Ladle layout check once after those fresh builds using the command below. Record its actual exit status, EN/RU screenshots, three layouts and interaction/layout assertions.
- [ ] Execute the development runtime check once against the fresh production build using the command below. Record actual feature, shutdown, restart and retained-source-reuse outcomes separately, including any failed or unreached stage.
- [ ] Produce a fresh unsigned macOS development package and execute its artifact check using the commands below. Record actual package/artifact outcomes and artifact identity; use only this newly produced, successfully checked artifact for the packaged runtime check.
- [ ] Execute the packaged runtime check once against that fresh artifact using the command below. Record actual feature, shutdown, restart and retained-source-reuse outcomes separately. Preserve an observed #44 failure without blind retries, quit-semantic changes, forced-exit passing claims or claims that unreached stages passed.
- [ ] Record the commands, actual results, logs/screenshots and remaining coordinator gates in the plan and verification documentation before committing. Resolve confirmed in-scope feature defects with regression tests and fresh affected verification; retain an independent observed #44 failure as failed evidence. Commit explicit verified task paths as test: verify grouped discovery across service and desktop.

The local-check checkboxes record execution and truthful outcome recording, not platform acceptance. A failed result remains failed even when its execution-recording item is complete. If fresh packaging/artifact validation fails, the packaged runtime item remains incomplete until a valid fresh artifact is available; do not substitute an older artifact. Known #44 shutdown failure does not authorize repeated attempts or mark dependent restart stages complete.

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

Coordinator gates remain pending until observed:

- Plan approval before execution.
- Complete review reports and resolution of confirmed in-scope findings.
- Inspection and acceptance of actual local macOS development/package evidence, including retained failures and unreached stages.
- Actual Windows CI/runtime/package evidence.
- Tracker updates, authorized pushes, integration and GitHub acceptance.
- Independent #44 resolution required for final release readiness.

Handoff reports in Russian the implemented result, existing commits, actual checks, retained evidence and remaining limitations. Checked tasks alone do not establish GitHub #13 completion or release readiness.
