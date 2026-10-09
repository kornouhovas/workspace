# Discovery Mode Changes — GitHub #16 Implementation Plan

## Overview

Implement a reviewed, metadata-only switch between Root/Project and Root/Category/Project for an existing source. Preview added, retained and no-longer-recognized projects, category-property availability and effective exclusions. Apply changes source configuration and associations atomically; Cancel leaves persisted state untouched. Preserve project metadata, historical categories and independent workspace views.

Save the accepted plan to docs/plans/issue-16-discovery-mode.md. Coordinator reviews before execution.

## Context

- Requirement: [GitHub #16](https://github.com/kornouhovas/workspace/issues/16); linked Beads execution step: workspace-31i.9.
- Authority: work/ralphex/issue-16/task.md, coordinator-findings.md, work/ralphex/issue-16/plan-review-01.md, docs/specs/workspace-0.1.0.md stories 16–18, accepted decisions D16/D21/D25/D26/D27 and ADRs 0001–0005.
- Checkout: codex/issue-16-discovery-mode. Implementation and every review/resume use fixed base 59d4407bf5364020428b9a736dc3844824c177a5.
- Existing boundaries: src/contracts/workspaces.ts; src/service/workspaces.ts, discovery.ts, project-recovery.ts, external-reconciliation.ts and source-observer.ts; production entry/controller/preload/client; DiscoveryPanel and TextPropertiesTable.
- Persistence: migration 0006 prohibits configured mode changes and direct-mode category history. Current projection, recovery and reconciliation validators also assume every stored record belongs to the current interpretation.
- Follow the existing reviewed-token, repeated-scan, transactional commit, source-event and independent-revision patterns.
- Dependencies: existing SQLite/Drizzle/Electron/React tooling only. No new runtime dependencies or global upgrades.

## Development Approach

- Testing approach: TDD at the typed Workspace service boundary, with focused transport/UI regressions.
- Complete each task and its checks before starting the next. Every implementation task includes new or updated behavioral tests.
- Run the full project test suite after each code task; all tests must pass before proceeding. Diagnose failures and preserve evidence.
- Commit each completed, verified slice with explicit task-path staging and an English commit message.
- Every Node/npm/npx/tsx invocation explicitly prepends /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin to PATH. Do not rely on shell initialization.
- Use the committed lockfile with npm ci. No coverage quota or coverage tooling.
- Product files, plans, documentation and commits use English. UI supports English and Russian; discussion uses Russian.
- Executors do not change trackers, push, merge, integrate, sign, tag, publish or release. No CLAUDE.md, global configuration or automatic finalization changes.

## Behavior and Matching Contract

- Extend workspace.previewDiscovery and workspace.applyDiscovery; retain the token-only Apply payload. The renderer cannot submit associations or inferred project IDs.
- Distinguish newly added targets, continuously retained project associations and previously recognized projects that cease to be recognized. Include already-retained metadata separately so the review does not imply that it will be deleted.
- Introduce a persisted mode_inactive flag on project and category associations. Preserve their UUIDs, paths, native evidence, prior association states and category references. This distinguishes interpretation changes from filesystem disappearance, replacement and user exclusion.
- A project paused by a mode change remains retained and editable. Discovery, Refresh, observation and startup never reactivate it automatically. Explicit reviewed reassociation preserves its UUID and exact Text values.
- Historical project path/native reservations remain effective. Returning to a previous mode does not create duplicate projects over reserved folders or silently restore old values.
- Category history is dormant in direct mode. Direct projection exposes no active categories or folder-backed property, while preserving the property UUID, authored label and revision.
- Explicit grouped Apply may resume a dormant category only when its previous association was continuously active/excluded and reviewed same-category path, native evidence and source-root checks succeed. Missing, unresolved, replaced or conflicting categories retain existing recovery restrictions. Project recovery does not repair a category as a side effect.
- Changing a folder’s role between project and category never transfers project values or merges identities across the two roles. Depth changes do not authorize cross-path matching.
- Persist authored exclusions at either supported depth. Compute target-mode effective exclusions separately; preserve and display inactive exclusions. A two-component grouped exclusion does not expand to its parent in direct mode. A one-component exclusion applies literally, with its target-mode scope explained in preview.
- Preserve the archive designation and existing containment policy. Archive selection and commands remain outside this slice.
- Mode Apply increments discoveryRevision once and preserves Text/category-label revisions unless their own commands change them. No-op Apply emits no discovery event.
- Preserve exact Text and category-label drafts through source refreshes and mode transitions. Hidden category-label drafts must survive returning to grouped mode; pending saves remain subject to current mode and response-lifetime guards.

## Review Focus

- Same physical folder changes role: fresh role identities receive no inherited project values; historical records remain recoverable. Tasks 1–3.
- Returning to an earlier mode: reservations prevent duplicate enrollment, retained projects require explicit recovery and category history remains usable under conservative checks. Tasks 2–3.
- Grouped exclusions become inactive in direct mode: saved paths survive, scope does not silently expand and archive containment remains intact. Tasks 1–3.
- A sibling changes mode while preview/recovery/save responses are delayed: obsolete results cannot overwrite current mode, revisions or drafts. Tasks 3–4.
- Shutdown or observation fails during graphical verification: record completed and unreached stages honestly without weakening native checks. Tasks 5–6.

## Implementation Steps

### Task 1: Preview a configured mode change without persistent writes

**Files:**

- Modify: `src/contracts/workspaces.ts`
- Modify: `src/service/discovery.ts`
- Modify: `src/service/workspaces.ts`
- Create: `tests/discovery-mode-service.test.mjs`
- Update: `tests/grouped-discovery-service.test.mjs`

**Interfaces:**

- Extend DiscoveryPreview with currentMode, project effects, category-availability effects and inactiveExcludedRelativePaths.
- Keep previewDiscovery’s optional target mode and existing Apply command shape.

**Steps:**

- [x] Add service-boundary tests for configured direct-to-grouped and grouped-to-direct previews, empty/mixed roots, retained metadata and exact SQLite/filesystem equality before and after preview.
- [x] Add target-role interpretation and depth-aware exclusion projection. Preserve historical project reservations without treating direct projects as grouped children or classifying them as replacements solely because they lack a category.
- [x] Produce effects from the same planned interpretation later used by Apply. Distinguish additions without UUIDs, retained existing IDs, no-longer-recognized IDs and already-retained metadata.
- [x] Bind the preview token to current source configuration, target mode, complete target snapshot and stored project/category state. Keep returned objects independent of token state; label/Text edits retain their existing independent revision behavior.
- [x] Test invalid modes, foreign IDs, traversal/depth errors, links, archive containment, unavailable/unreadable/changed roots and identity conflicts. Unsafe reviews have no applicable token.
- [x] Run PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test and the affected type/lint checks. Commit the verified read-only preview slice.

### Task 2: Apply mode changes atomically while retaining history

**Files:**

- Create: `src/service/db/migrations/0007_discovery_mode_changes.sql`
- Modify: `src/service/db/migrations/meta/_journal.json`
- Modify: `src/service/db/schema.ts`
- Modify: `src/service/workspaces.ts`
- Modify: `src/service/discovery.ts`
- Modify: `src/service/project-recovery.ts`
- Modify: `src/service/external-reconciliation.ts`
- Modify: `src/contracts/workspaces.ts`
- Update: `tests/discovery-mode-service.test.mjs`
- Update: `tests/grouped-discovery-service.test.mjs`
- Update: `tests/workspaces-service.test.mjs`

**Interfaces:**

- Persist mode_inactive on projects/categories, defaulting to false for existing data.
- Expose a mode-change retention reason in ProjectAssociationSummary.
- Keep ProjectList’s active category/property projection dependent on current source mode.

**Steps:**

- [x] Add populated upgrade fixtures built from the actual migrations 0000–0006. Preserve settings, source/project/category/property IDs, exact Text values, authored labels, selection and independent view IDs.
- [x] Add migration 0007 without editing historical migrations or resetting data. Replace affected triggers so inactive history is permitted while operational direct projects have no category and operational grouped projects require a same-source active category at the correct depth.
- [x] Implement ordered mode Apply: retire incompatible operational associations, change source configuration, establish validated target categories, then establish target projects. Preserve historical records and inactive exclusions in the same transaction.
- [x] Revalidate token ownership, source/root identity, configuration revision, stored associations and complete target snapshot before writes and after writes. Storage failures and observed races roll back every write and emit no committed event.
- [x] Update projection and minimum recovery/reconciliation validation so startup, lists and Refresh accept mixed historical records immediately. Direct projection hides category history; inactive projects remain retained with ordinary Text editing.
- [x] Test both switch directions, unchanged Apply, role changes without inherited values, injected partial-write failures, reopen and final-workspace removal/source reuse. Compare full inventories and sentinel bytes.
- [x] Run PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test, lint and typecheck. Commit the verified persistence slice.

### Task 3: Preserve recovery and observation across mode round trips

**Files:**

- Modify: `src/service/project-recovery.ts`
- Modify: `src/service/external-reconciliation.ts`
- Modify: `src/service/source-observer.ts`
- Modify: `src/service/workspaces.ts`
- Update: `tests/discovery-mode-service.test.mjs`
- Update: `tests/project-recovery-service.test.mjs`
- Update: `tests/external-reconciliation-service.test.mjs`
- Update: `tests/source-observer.test.mjs`

**Interfaces:**

- Existing previewProjectRecovery/reassociateProject commands operate on mode-retained records and current target-depth candidates.
- Existing source events continue carrying actual referencing workspace IDs and committed revisions.

**Steps:**

- [x] Test direct-to-grouped-to-direct and grouped-to-direct-to-grouped, including restart between switches. Original project IDs/values stay retained until explicit recovery; unchanged category history resumes only under the stated reviewed contract.
- [x] Extend recovery eligibility for mode-retained associations while preserving exclusion, reserved-path, native-conflict, category-availability and containment rules. Explicit successful recovery clears mode inactivity only for the chosen project.
- [x] Cover target-depth reassociation, own historical-path recovery, occupied/reserved targets, old-path replacement, wrong-depth inputs and stale recovery after sibling mode Apply. Retain metadata on every rejected operation.
- [x] Restrict automatic reconciliation to operational associations in the configured interpretation. Refresh, watch hints, startup and missed-notification recovery cannot revive dormant projects or enroll unrelated children.
- [x] Retarget observation after committed mode changes and invalidate discovery/recovery reviews for all source siblings. Preserve macOS root/category watches and Windows root-only watches with five-second full grouped polling.
- [x] Test same-source fanout, different-source isolation, observer deduplication, degraded/unavailable/changed-root retention, obsolete callbacks and final-reference/service-close cleanup. Native watcher fixtures keep production observation active.
- [x] Run PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test, lint and typecheck. Commit the verified recovery/observation slice.

### Task 4: Deliver the configured-mode review through IPC and localized UI

**Files:**

- Modify as needed: `src/service/entry.ts`
- Modify as needed: `src/contracts/service-protocol.ts`
- Modify as needed: `src/desktop/backend-controller.ts`
- Modify as needed: `src/desktop/preload.ts`
- Modify: `src/renderer/workspace-service-client.ts`
- Modify: `src/renderer/components/DiscoveryPanel.tsx`
- Modify: `src/renderer/components/TextPropertiesTable.tsx`
- Modify: `src/renderer/components/CategoryPropertyHeader.tsx`
- Modify: `src/renderer/localization.ts`
- Modify: `src/renderer/app.css`
- Update: `tests/backend-lifecycle.test.mjs`
- Update: `tests/renderer-app.test.tsx`
- Update: `tests/project-recovery-ui.test.tsx`

**Steps:**

- [ ] Add production entry/controller/port/preload/client tests for configured-mode preview, Apply and category disappearance/return. Verify event-before-response ordering, malformed payload rejection and listener cleanup.
- [ ] Enable the configured-source mode selector and show project effects, shared-source scope, category availability and effective/inactive exclusions before Apply.
- [ ] Provide EN/RU loading, empty, unavailable, stale, validation and storage-error states. Cancel abandons the draft without persisted mutation; stale refresh requires another explicit Apply.
- [ ] Keep retained projects visible with Text editing, previous-path/mode-change feedback and valid recovery controls. Direct mode renders no category property.
- [ ] Preserve Text and category-label drafts by logical source/project/property identity across switching. Keep discovery/category-label revision merging independent so delayed lists cannot resurrect the category column in direct mode.
- [ ] Test keyboard selection, Apply/Cancel, focus restoration and pending prevention in both languages. Cover delayed preview/Apply/recovery/label responses after sibling changes, cancellation, selection/removal, source loss and backend restart, including confirmed delayed success without replay.
- [ ] Run PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test, lint and typecheck. Commit the verified UI/transport slice.

### Task 5: Extend permanent graphical and Electron scenarios

**Files:**

- Modify: `src/renderer/components/bb-foundation.stories.tsx`
- Modify: `scripts/smoke-discovery-layouts.mjs`
- Modify: `scripts/smoke-runtime.mjs`
- Update: `tests/components.test.tsx`
- Update: `tests/runtime-lifecycle.test.mjs` where changed scenario/evidence behavior requires it

**Steps:**

- [ ] Add permanent EN/RU Ladle states for configured-mode effects, inactive exclusions, category disappearance/return and mode-retained editable rows, including empty/loading/stale/failure states.
- [ ] Extend layout assertions at 1440×960, 1024×720 and 420×800 for long paths, wrapped effects, reachable controls, focus and document overflow.
- [ ] Extend the permanent dev/package Electron scenario through production UI/IPC: Cancel, both switch directions, stale review and explicit re-Apply, sibling sharing, unrelated-source isolation and target-depth recovery.
- [ ] Compare settings, exact Text/labels, logical IDs, independent views, authored exclusions, archive designation and file inventory/bytes. Verify restart and final-removal/source reuse only after a successful normal quit.
- [ ] Record mode-change stages separately from shutdown, restart and source-reuse stages. Retain failure evidence and regression-test any changed stage reporting without altering normal-quit policy.
- [ ] Run PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test and npm run build:ladle as separate prefixed commands. Run affected layout/runtime checks in distinct ignored evidence directories; do not build or clean while a fixture uses dist.
- [ ] Commit verified fixtures and report observed graphical results accurately. Preserve #44, the unchanged ten-second normal-quit assertion and forced-cleanup-as-failure behavior.

### Task 6: Verify delivery artifacts and document acceptance evidence

**Files:**

- Modify: `scripts/check-artifact.mjs`
- Update: `tests/artifact-smoke.test.mjs`
- Update: `tests/build-smoke.test.mjs`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/development.md`
- Modify: `docs/decisions.md`
- Modify: `CHANGELOG.md`
- Create: `docs/verification/issue-16-discovery-mode.md`

**Steps:**

- [ ] Add build/artifact regressions requiring migration 0007 and its journal entry, including rejection of an artifact missing the migration.
- [ ] Document implemented mode-change, history, exclusion and round-trip behavior; replace obsolete configured-mode prohibitions. Add an accurate Unreleased entry without changing version 0.1.0.
- [ ] Run each command separately with PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH prepended: npm test; npm run lint; npm run typecheck; npm run check:docs; npm run build; npm run build:ladle.
- [ ] Run affected graphical checks sequentially. Create a fresh local Mac artifact with PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac, then run the packaged scenario with a separate evidence directory.
- [ ] Inspect git diff --check and the entire diff from 59d4407bf5364020428b9a736dc3844824c177a5. Check scope, renderer isolation, migration packaging and absence of unintended filesystem writes.
- [ ] Write criterion-mapped evidence with actual commands, SHA/platform, passed/failed/unreached stages and remaining limitations. Label reused unchanged historical evidence with its original milestone.
- [ ] Commit the verified artifact/documentation slice with explicit staging. Hand off the existing commits and evidence in Russian; leave platform acceptance, trackers and integration to the coordinator.

## Post-Completion

- Ralphex executes and collects all five first-review perspectives for coordinator inspection: quality, implementation, testing, simplification and documentation. Batches of three plus two are permitted under thread limits; collect every result before repairs.
- Reviewers inherit gpt-6.1-sol with high reasoning and use fixed base 59d4407bf5364020428b9a736dc3844824c177a5. Reuse or close completed reviewers as needed.
- Ralphex repairs confirmed findings within scope, reruns affected checks and commits verified repairs. Second reviews use only the quality/implementation pair for critical/major findings.
- Coordinator independently verifies, owns authorized CI push and observed exact-SHA macOS/Windows acceptance, updates trackers and performs verified local integration.
- Local macOS evidence does not establish Windows acceptance. Physical macOS 27/Electron 44.7.0 issue #44 remains an independent release prerequisite. No unchanged native retries, weakened assertions, forced-exit shortcuts or global upgrades.

## Scope Exclusions

- Filesystem create/rename/move/archive/restore commands; project deletion; source relocation/merge.
- General views, new property types, synchronization, AI, remote access, website and legacy import.
- Version bumps, signing, tags, publication, release and unrelated cleanup.
