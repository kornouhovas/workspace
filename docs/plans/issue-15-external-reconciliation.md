# Issue #15: External Folder Reconciliation

## Overview

Implement GitHub #15 / Beads workspace-31i.8: reconcile unambiguous external project and category changes through explicit Refresh, bounded filesystem notifications and startup rescanning. Preserve logical IDs, exact Text, property/category labels, source configuration and independent workspace views. A uniquely identified active project may move into a genuinely new eligible category; atomically create only the category record needed for that placement. Uncertain associations retain metadata and use the existing recovery flow. Coordinator reviews this plan before execution. Save the accepted plan at docs/plans/issue-15-external-reconciliation.md.

## Context

- Fixed implementation and review base for every phase/resume: fde04b850b779b6839eca2231f7ee66549eea71c.
- Checkout: codex/issue-15-external-reconciliation; current HEAD equals the fixed base and the working tree is clean.
- Requirements: work/ralphex/issue-15/task.md, research-preparation.md, coordinator-findings.md, plan-review-01.md, docs/specs/workspace-0.1.0.md and ticket 08.
- Accepted boundaries: AGENTS.md, docs/development.md, product.md, decisions.md, architecture.md, reuse.md, releases.md, GLOSSARY.md and ADRs 0001–0005.
- Service: src/service/workspaces.ts, discovery.ts, project-recovery.ts, settings.ts and entry.ts.
- T07 precedent: project-recovery.ts validates category eligibility, source/depth/containment, native evidence, reserved paths, repeated snapshots and transactional post-write state. It already creates a needed category atomically without Discovery Apply or sibling enrollment.
- Persistence constraints: migrations 0004 and 0006 reserve non-replaced paths and require active same-source categories for active grouped projects.
- Transport: src/contracts/workspaces.ts, service-protocol.ts, desktop-api.ts; src/desktop/backend-controller.ts, main.ts and preload.ts; src/renderer/workspace-service-client.ts.
- UI: src/renderer/App.tsx, components/DiscoveryPanel.tsx, ProjectRecoveryPanel.tsx, TextPropertiesTable.tsx, localization.ts and app.css.
- Follow existing real temporary SQLite/folder fixtures, production IPC/client tests, independent revision guards, EN/RU interactions and permanent Ladle/Electron scenarios.
- No new dependencies, schema migration, permanent folder markers or copied upstream modules are expected.

## Development Approach

- Testing approach: TDD at the typed Workspace service boundary, supplemented by deterministic watcher/scheduler tests, IPC tests and UI/runtime checks.
- Complete one task and its verification before starting the next. Every code-changing task includes new or updated behavioral tests; all project tests must pass before proceeding.
- Install the committed lockfile with PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm ci.
- Every Node/npm/npx/tsx invocation must explicitly prepend /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin to PATH.
- No coverage quota or coverage tooling. Assert observable identities, values, errors, revisions, rollback and filesystem outcomes.
- Keep domain rules, scanning, watch ownership and persistence in the backend. Preserve renderer isolation and the narrow preload boundary.
- Commit each completed, verified slice in English, including its plan progress, using explicit task paths. Preserve unrelated changes.
- Coordinator owns trackers, CI pushes, local integration and platform acceptance. Executor performs no push, remote merge, release, signing, tagging, publication, global configuration changes or automatic finalization.
- Preserve gpt-6.1-sol high for execution/review and the fixed base across every resume.

## Matching Contract

- Reconcile only configured sources under unchanged, sufficient applied-root evidence. An unavailable, unreadable, incomplete or conflicting root never causes mass association changes.
- Paths are locators, not identities. Match a stored active association to exactly one eligible observation using unchanged, lossless dev/ino/birthtimeNs evidence. Require sufficient stored and observed evidence, stable repeated scans and no competing current or historical native evidence.
- Positive birthtime is an operational prerequisite, not proof of permanent uniqueness. Changed, absent or demonstrably substituted evidence cannot establish a move. mtime/ctime support scan stability only.
- Cross-path automatic matching applies to stored active records. Stored missing, unresolved or replaced records continue through explicit recovery. Excluded records retain existing exclusion behavior and are not followed across paths.
- A temporarily absent active folder keeps its stored association and evidence; observed missing/unresolved/replaced resolution remains separate. A later complete scan may recognize its unique eligible destination. Discovery Apply may persist retained states under its existing explicit contract.
- Match categories before grouped projects. Support category renames, project renames and moves between verified tracked active categories, including categories renamed in the same observation.
- Also support a uniquely matched active project's move into a genuinely new eligible destination category. Apply T07 category validation with the reconciliation contract's current/historical conflict checks: the destination must be an immediate real category directory under the verified source, eligible under saved exclusions/archive rules, with sufficient stable evidence across repeated complete scans.
- A new category must have no current or historical record at its destination path and no competing current/historical category or native evidence. Resolve existing category mappings first so a renamed tracked category is reused rather than duplicated. Existing unavailable, unresolved, excluded, replaced or conflicting category associations remain explicit recovery cases; matching child evidence alone cannot repair them.
- Create only the category records required by accepted known-project mappings. Create one UUID per needed destination category, shared by all accepted moves into it, in the same transaction as those project updates. Preserve existing category IDs and the shared category-property ID, authored label and independent revisions. Never create a project ID through reconciliation.
- Do not enroll unrelated projects in the needed new category, other new categories or empty new categories. Leave the prior tracked category retained if it becomes empty. Repeated successful scans reuse the created category and produce no duplicate records, revisions or events.
- Compute the complete mapping before judging old-path replacement. A moved tracked folder may keep its ID even when an unrelated new folder occupies its old path. That new folder remains undiscovered until explicit Apply and receives no old Text.
- Accept occupied-path permutations only when all displaced current owners participate in a unique verified mapping. An unmatched reserved destination blocks the conflicting mapping; never overwrite, merge or transfer metadata.
- Reject ambiguous native aliases and conflicting historical/replaced evidence for cross-path matches. Preserve the existing exception for continuously matching same-path associations explicitly established by recovery.
- A move must preserve the prior folder's volume-associated evidence within the same verified source. Cross-volume changes, copies, unsupported depth, excluded/archive/link targets and insufficient evidence retain metadata for recovery.
- Preserve exact directory-entry spelling. Case-only changes require the same unique evidence checks; never globally case-fold paths or infer identity from casing.
- Reconciliation updates database locators/category associations and, only where required above, creates a needed category record. It does not move files, enroll unrelated folders, change discovery mode/exclusions/archive, or increment Text/category-label revisions.
- Commit each changed mapping batch, including any needed category insertions, with one discoveryRevision increment. No-op scans leave persisted revisions unchanged.
- Revalidate filesystem and stored configuration before and after transactional writes. Observed races or storage failures roll back all category/project changes and the discovery revision. This does not provide a filesystem lock or detect indistinguishable reuse of the entire evidence tuple.

## Notification and Observation Contract

- Use Node fs.watch with recursive:false and persistent:false: one root watcher per referenced configured source, plus watchers for eligible immediate category directories in grouped mode. Never watch or enumerate project contents, excluded targets or source parents.
- Event names and filenames, including null filenames, are hints only. Every hint schedules the same complete validated source reconciliation used by explicit Refresh.
- Coalesce hints in one 100 ms scheduled pass per source without continually postponing it. Changes arriving during a pass request at most one following pass.
- Maintain one unreferenced five-second health/retry timer per source. Probe root availability/evidence and retry degraded observation/watch setup; perform a full scan when necessary. Healthy operation does not periodically traverse all projects.
- Synchronize watcher targets after validated scans and discovery/recovery commits. Close obsolete category/root watchers before replacement, verify installation targets, and rescan to cover the installation window.
- Watching a newly observed eligible category does not enroll it or its children. A moved known project may require its category record; the same no-extra-discovery rules apply to watcher, startup and explicit-refresh reconciliation.
- Reconcile referenced configured sources on service startup and after restart; explicit Refresh remains available for missed notifications. Root relocation and source merging are excluded.
- Add a runtime workspace.sourceObserved event carrying sourceId, actual workspaceIds, observationRevision, scan state and automaticUpdates status active/degraded. Its revision is service-local and independent of persisted discovery/property/category-label revisions.
- Publish observation changes only when meaningful topology, resolution, scan status or automatic-update status changes. Ignore timestamp-only noise. Locator/category commits additionally publish workspace.projectsChanged after commit, before command responses.
- Changed observations invalidate source discovery/recovery reviews even without a locator commit. Failed transactions emit no committed project event.
- Close all watchers/timers and reject late callbacks after final source-reference removal or service close. Retained source data stays available for later reuse.
- Preserve current-generation response guards, actual referencing-workspace fanout and same-source Text/category-label drafts. Never automatically replay a recovery or discovery mutation.

## Primary-source basis

The bounded watcher strategy and matching rules above are implementation choices informed by these documented limits:

- Node notifications vary by platform, filenames may be absent, recreated watched directories can require reattachment, and birthtime may be unavailable or altered. [Node 22.21.1 filesystem documentation](https://nodejs.org/download/release/v22.21.1/docs/api/fs.html#caveats).
- Windows file identifiers are volume-associated, filesystem-specific and reusable over time; the documented 64-bit identifier is not universally unique. [Microsoft file information](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information).
- Case behavior has filesystem exceptions; spelling alone cannot establish identity. [Microsoft filename rules](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file).

## Implementation Steps

### Task 1: Reconcile direct projects through explicit service refresh

**Files:**

- Create: `src/service/external-reconciliation.ts`
- Create: `tests/external-reconciliation-service.test.mjs`
- Modify: `src/service/workspaces.ts`
- Modify: `src/service/discovery.ts`
- Modify: `tests/workspaces-service.test.mjs`
- Modify: `tests/project-recovery-service.test.mjs`

- [x] Add public-service tests for external direct rename, case-only rename where supported, rename followed by old-path replacement, copied folders, reused dev/ino with changed birthtime, ambiguous evidence and cross-volume evidence.
- [x] Implement the bounded mapping contract in external-reconciliation.ts using existing scans and stored associations; extend workspace.refreshSource to invoke it while preserving its existing WorkspaceSourceState response and input validation.
- [x] Validate saved exclusions before matching and avoid accessing suppressed targets. Leave unrelated folders for explicit Preview/Apply; keep listProjects and preview queries free of reconciliation writes.
- [x] Commit locator mappings atomically with one discoveryRevision increment. Support verified direct path swaps by temporarily releasing affected reservations inside the transaction, preserving UUIDs and restoring final states before commit.
- [x] Revalidate source configuration, records, root and scan before/after writes; test injected storage/race failures, unchanged snapshots, no-op events, unavailable roots, source containment and unchanged inventories/bytes.
- [x] Verify exact Text/property/source/workspace/view retention, actual sibling fanout, stale discovery/recovery rejection and successful manual recovery for uncertain cases.
- [x] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test; run lint and typecheck with the same explicit PATH prefix; commit verified explicit task paths and plan progress.

Verification (Task 1): Node 22.21.1 lockfile install, npm test (322 passed, including production build and existing regressions), lint, typecheck and git diff --check passed. New service fixtures ran on local macOS; Windows and graphical acceptance remain later/coordinator-owned gates. The initial failing test run is retained under work/ralphex/issue-15/task-1-npm-test.txt; passing results are under task-1-npm-test-green.txt, task-1-lint.txt and task-1-typecheck.txt.

### Task 2: Reconcile grouped categories and project placement atomically

**Files:**

- Modify: `src/service/external-reconciliation.ts`
- Modify: `src/service/workspaces.ts`
- Modify: `src/service/discovery.ts`
- Modify: `src/service/project-recovery.ts`
- Modify: `tests/external-reconciliation-service.test.mjs`
- Modify: `tests/grouped-discovery-service.test.mjs`
- Modify: `tests/project-recovery-service.test.mjs`

- [ ] Add service tests for nonempty/empty category renames, category-name swaps, project renames, moves between tracked categories, simultaneous category/project changes and moves of uniquely identified active projects into genuinely new eligible categories.
- [ ] Resolve category identity before project identity. Reuse verified tracked active categories; otherwise validate a genuinely new destination using T07 source/depth/category safety rules, repeated complete snapshots and stricter current/historical reconciliation conflict checks. Preserve category/property UUIDs, authored labels and independent revisions.
- [ ] Apply grouped permutations under existing indexes/triggers: temporarily deactivate/release affected project reservations, then category reservations; establish final categories, inserting only needed new category records, before restoring final active projects. Make every intermediate state transaction-local and increment discoveryRevision once for the whole changed batch.
- [ ] Test unresolved parents, occupied unmatched paths, current/historical category/path/native conflicts, insufficient or changing category evidence, both-depth exclusions, archive suppression, links/junctions and forbidden project-content access. Existing unavailable/conflicting categories must remain manual recovery cases even when child evidence matches.
- [ ] Verify a needed new category containing the moved known project and another unrelated project creates only one category UUID and no project UUIDs. Include unrelated nonempty and empty new categories; repeated scans must add nothing further. Test multiple known projects sharing one needed category, preservation of the old empty tracked category, unchanged source configuration/category-property ID/label/Text revisions, and explicit Discovery Apply remaining available for unrelated folders.
- [ ] Inject failures after category insertion, partial category/project updates and filesystem swaps during pre/post-write validation; assert full rollback including inserted categories and discoveryRevision, no committed events, preserved exact Text/labels/views and populated 0000–0006 reopen without schema reset. Keep T07 explicit recovery behavior and regressions intact.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test; run lint and typecheck with the same explicit PATH prefix; commit verified explicit task paths and plan progress.

### Task 3: Deliver bounded backend observation through production events

**Files:**

- Create: `src/service/source-observer.ts`
- Create: `tests/source-observer.test.mjs`
- Modify: `src/service/workspaces.ts`
- Modify: `src/service/settings.ts`
- Modify: `src/contracts/workspaces.ts`
- Modify: `src/contracts/service-protocol.ts`
- Modify: `src/renderer/components/DiscoveryPanel.tsx`
- Modify: `tests/external-reconciliation-service.test.mjs`
- Modify: `tests/backend-lifecycle.test.mjs`
- Modify: `tests/renderer-app.test.tsx`

- [ ] Add injectable watcher/scheduler seams with native production defaults; keep them test dependencies rather than user settings or alternate product paths.
- [ ] Implement source-deduplicated watchers, coalescing, root health/retry, startup reconciliation, validated watcher replacement and final-reference/service-close cleanup under the observation contract.
- [ ] Add and validate workspace.sourceObserved through the existing entry/controller/main/preload/client event route. Update consumers to discriminate it safely and invalidate/reload affected projections with observation/lifetime guards.
- [ ] Test duplicate/coalesced/null-filename hints, hostile filenames, watcher creation/callback errors, category replacement, missing roots/reconnection, stale callbacks and hints arriving during a pass.
- [ ] Verify observer-only missing/replaced resolution and degraded observation become visible without database state changes; no-op/timestamp noise does not churn revisions or events. For moves into new categories, verify watcher reconciliation creates only the needed category, does not enroll unrelated children/categories, updates watcher targets safely and remains idempotent across repeated hints.
- [ ] Exercise real SQLite/folders with controlled scheduling for startup/shutdown-missed changes, including moves into a new category with unrelated children; refreshed source ownership, sibling deduplication, unrelated-source isolation, event-before-response, malformed event rejection, conflict/race rollback and cleanup without keepalive.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test; run lint and typecheck with the same explicit PATH prefix; commit verified explicit task paths and plan progress.

### Task 4: Provide usable EN/RU Refresh and observation feedback

**Files:**

- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/DiscoveryPanel.tsx`
- Modify: `src/renderer/components/ProjectRecoveryPanel.tsx`
- Modify: `src/renderer/localization.ts`
- Modify: `src/renderer/app.css`
- Modify: `src/renderer/components/bb-foundation.stories.tsx`
- Modify: `tests/renderer-app.test.tsx`
- Modify: `tests/project-recovery-ui.test.tsx`
- Modify: `tests/components.test.tsx`
- Modify: `scripts/smoke-discovery-layouts.mjs`

- [ ] Expose a keyboard-accessible Refresh action for an available selected source as well as existing unavailable-source retry. Distinguish source refresh from discovery preview refresh and Apply.
- [ ] Show localized pending/error feedback and degraded automatic-update guidance with explicit Refresh. Retain metadata and existing recovery controls for missing, ambiguous and conflicting associations.
- [ ] Guard refresh/event/list responses against newer observations, selection/removal, cancellation and backend generations; accept an initiating commit event before its successful response.
- [ ] Preserve Text and category-label drafts, stable logical row keys and editor focus across reconciled names/categories, including placement into a newly created needed category. Invalidate discovery/recovery reviews while retaining applicable exclusion choices and requiring explicit reselection/save.
- [ ] Add EN/RU production-client interaction tests for available/empty/unavailable sources, duplicate submission prevention, error retry, observer-only resolution, sibling changes and delayed response races. Verify explicit Refresh and observer events project a known project's new category without Apply, keep the shared category-property ID/authored label and independent revisions, omit unrelated projects/categories, and retain recovery for conflicting existing categories.
- [ ] Extend permanent Ladle states/layout interactions for Refresh, pending/error/degraded feedback, new-category placement and retained recovery; check keyboard/focus and long paths at 1440×960, 1024×720 and 420×800 without weakening existing assertions.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test and PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run build:ladle; run lint and typecheck with the same explicit PATH prefix; commit verified explicit task paths and plan progress.

### Task 5: Verify runtime behavior and document acceptance evidence

**Files:**

- Modify: `scripts/smoke-runtime.mjs`
- Modify: `tests/runtime-lifecycle.test.mjs`
- Modify: `tests/backend-lifecycle.test.mjs`
- Modify: `tests/external-reconciliation-service.test.mjs`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/development.md`
- Modify: `docs/decisions.md`
- Modify: `CHANGELOG.md`
- Create: `docs/verification/issue-15-external-reconciliation.md`

- [ ] Extend permanent production Electron scenarios for direct/grouped automatic reconciliation, category rename/move projection, explicit Refresh, ambiguous recovery and unavailability/containment. Include a known project's move into a genuinely new category containing an unrelated project, with other unrelated/empty new categories; assert only the needed category record is created and no unrelated project/category appears before explicit Apply. Modify only disposable fixtures and compare IDs, exact values, category-property ID/label, revisions, source configuration, views, inventories and bytes.
- [ ] Add shutdown-missed changes between successful normal quit and restart, including placement into a new category; verify startup reconciliation before Discovery Apply and repeated-refresh idempotence. Add bounded real fs.watch fixture waits for macOS/Windows and assert actual notification-driven results separately from explicit-refresh results.
- [ ] Preserve meaningful recovery regressions when formerly path-local rename examples become automatically reconcilable; use genuinely uncertain or persisted unresolved scenarios to continue testing manual recovery, including existing unavailable/conflicting destination categories.
- [ ] Run all final commands below and inspect git diff --check plus the full diff against fde04b850b779b6839eca2231f7ee66549eea71c. Record actual results and keep failures.
- [ ] Execute relevant Ladle, development and fresh unsigned packaged graphical fixtures in distinct ignored evidence directories. Preserve the unchanged ten-second normal-quit assertion and forced-cleanup failure reporting; record failed/unreached stages without blind retries.
- [ ] Update English user/developer documentation, local matching decisions and Unreleased. Explain the narrow needed-category exception, explicit discovery for unrelated folders, manual recovery for conflicting existing categories, watcher fallbacks, native-evidence limitations and primary-source links; create an acceptance matrix separating local evidence from coordinator-owned platform gates.
- [ ] Commit verified explicit task paths and plan progress. Report the existing commit, actual checks and remaining limitations in Russian without finalizing trackers or integration.

## Final automated commands

- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test
- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run lint
- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run typecheck
- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run check:docs
- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run build
- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run build:ladle
- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" node scripts/smoke-discovery-layouts.mjs
- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run smoke:runtime -- dev
- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac
- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run smoke:runtime -- release
- git diff --check
- git diff fde04b850b779b6839eca2231f7ee66549eea71c...HEAD

Graphical commands require distinct WORKSPACE_SMOKE_EVIDENCE_DIR values. Reuse prior evidence only when the exercised code/fixture is unchanged and label it accurately. A newly changed scenario requires new evidence. If #44 blocks normal shutdown, preserve the failed run and report dependent stages as unreached; do not weaken assertions or blindly rerun.

## Post-Completion

- Coordinator independently reviews the final fixed-base diff, acceptance matrix, screenshots and check evidence.
- First implementation review collects quality, implementation, testing, simplification and documentation perspectives, in batches of three plus two when required by available slots. All reviewers inherit gpt-6.1-sol high and the fixed base.
- Verify findings before repairs, retain evidence and commit verified fixes. Second review uses only quality and implementation for critical/major findings.
- Coordinator arranges exact-SHA macOS/Windows CI and actual-platform acceptance. Local macOS evidence cannot establish Windows behavior.
- Coordinator owns authorized branch push, verified local integration and tracker completion.
- Native shutdown #44 remains an independent final-release prerequisite. No app.exit, self-SIGKILL, timeout relaxation, OS/global dependency upgrades, signing, tags or publication are included.

## Success Criteria

- Supported external direct/grouped changes preserve logical project/category identities and authored metadata through Refresh, notifications and restart.
- A uniquely identified active project can move into a genuinely new eligible nonconflicting category; only the needed category UUID is created atomically with the placement.
- Unrelated children, other new categories and empty new categories remain explicit discovery choices. Repeated scans create no additional records or revision churn.
- Copied/replaced/ambiguous/cross-volume evidence never receives old values solely from a path or native-ID alias.
- Unavailable or conflicting sources/categories retain all metadata and offer usable recovery/refresh feedback.
- Configured mode, exclusions, archive, shared category-property ID/authored label and independent revisions are preserved; each changed reconciliation batch increments discoveryRevision once.
- Watchers/timers stay bounded to referenced sources and permitted scan depths, and are fully cleaned up.
- Automated and graphical evidence is recorded honestly; outstanding platform or #44 gates remain explicit.

## Exclusions

Application-driven filesystem mutations, root relocation/merge, new discovery modes, automatic enrollment beyond the category records strictly required for verified known-project placement, synchronization, remote access, AI, legacy import, general view/property work, version bumps, CLAUDE.md creation and release finalization.
