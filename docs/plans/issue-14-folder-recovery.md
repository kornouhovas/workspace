# Issue #14: Missing Folder and Source Recovery

## Overview

Keep logical project records and their Text values accessible when folders disappear or associations become ambiguous. Provide an explicit, source-contained folder selection and reassociation flow that preserves the project ID, changes only database associations, and survives restart.

Implement only GitHub #14 / Beads workspace-31i.7. Coordinator reviews this plan before execution. Save the accepted plan at docs/plans/issue-14-folder-recovery.md.

## Context

- Requirements: work/ralphex/issue-14/task.md, coordinator-findings.md, docs/specs/workspace-0.1.0.md and ticket 07.
- Boundaries: adjacent tickets 08 and 09; accepted ADRs 0001–0005.
- Fixed initial and review base: 3731c798c8739624d97160d6b48fe6f8ec244550.
- Checkout: codex/issue-14-folder-recovery; initial working tree is clean.
- Service and filesystem: src/service/workspaces.ts, discovery.ts, settings.ts and entry.ts.
- Persistence: src/service/db/schema.ts and migrations 0004–0006.
- Contracts: src/contracts/workspaces.ts, desktop-api.ts, service-protocol.ts and settings.ts.
- Renderer: src/renderer/workspace-service-client.ts, App.tsx, components/DiscoveryPanel.tsx, TextPropertiesTable.tsx, localization.ts and app.css.
- Existing test patterns: disposable real SQLite/filesystem fixtures, production IPC/client tests, EN/RU renderer interactions, Ladle and Electron runtime scenarios.
- Existing constraints: non-replaced project/category records reserve their relative paths; grouped active projects require an active same-source category.
- No new dependencies, coverage infrastructure, upstream module copying or schema migration are expected.

## Development Approach

- Testing approach: TDD at the typed Workspace service boundary, with focused IPC and UI tests for behavior that boundary cannot establish.
- Complete each task and its tests before proceeding. All project tests must pass before starting the next task.
- Every implementation task includes new or updated behavioral tests.
- Run dependency installation with the committed lockfile using npm ci. Every Node/npm/npx/tsx invocation, including reviewer commands, must explicitly prepend /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin to PATH.
- Preserve unrelated edits. Commit completed, verified changes with English messages and explicitly enumerated task paths.
- Keep policy and filesystem validation in the backend; React consumes typed results through the existing isolated preload boundary.
- Do not alter trackers, push, merge, release, invoke nested Ralphex or change global configuration.

## Recovery Rules

- Preserve stored association state separately from current observed resolution. A complete, verified scan can identify individual missing, ambiguous or replaced associations without writing during a query.
- An incomplete scan or unavailable/unreadable/conflicting root produces source-level feedback. It must not relabel every project as missing or delete metadata.
- Return accessible retained rows, including manually excluded records. Excluded records have a distinct explanation and use existing discovery controls for reinclusion.
- Offer Locate folder for observed or persisted missing, unresolved and replaced project associations. Continuously valid active projects are not recovery subjects.
- Use a keyboard-accessible list of service-validated source-relative directories. Show the selected project, previous path, target path and category before an explicit Reassociate action. Preview and cancellation write nothing.
- Recovery does not require discovery Apply. It must not create competing project IDs for candidate folders.
- Direct targets have one native basename component; grouped targets have category/project depth. Reuse existing platform basename, exclusion, archive, service-directory and link rules.
- Reject another non-replaced record's reserved target path or conflicting current native evidence. Replaced records contain historical evidence, which alone does not establish live ownership. Never overwrite, merge, delete or transfer another logical record.
- Grouped recovery reuses a continuously verified active category. A newly observed category with no conflicting current category association is inserted atomically with recovery. Missing, unresolved or conflicting existing category associations are unavailable targets in this slice.
- Successful recovery updates the selected project's path, native evidence, category and active association state in one transaction. Preserve its ID, Text values, source ownership, workspace/view IDs and independent property revisions.
- Bind recovery review to workspace/project ownership, discovery configuration and revision, project/category records, root evidence and the filesystem snapshot. Revalidate before and after writes; observed changes roll back.
- Use the existing stale_preview error for invalidated recovery reviews. Refresh requires explicit reselection and confirmation; never replay a mutation automatically.
- Filesystem observations do not provide a filesystem lock. Document the existing limit concerning later changes and indistinguishable native-evidence reuse.

## Implementation Steps

### Task 1: Expose retained metadata and current resolution

Files:

- Modify: src/contracts/workspaces.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/discovery.ts
- Modify: src/renderer/App.tsx
- Modify: src/renderer/components/DiscoveryPanel.tsx
- Modify: src/renderer/components/TextPropertiesTable.tsx
- Modify: src/renderer/localization.ts
- Modify: src/renderer/app.css
- Create: tests/project-recovery-service.test.mjs
- Modify: tests/renderer-app.test.tsx
- Modify: tests/components.test.tsx

- [ ] Add service tests showing that listProjects exposes missing, ambiguous, replaced and excluded logical records with their original IDs and accessible Text values, including an individual disappearance observed before discovery Apply.
- [ ] Extend ProjectList with retainedProjects; expose stored association state and observed resolution separately. Preserve active rows and derive individual resolution only from a complete scan under verified root evidence. Queries leave database records and revisions unchanged.
- [ ] Return historical category labels for retained rows without representing retired categories as active options. Define retainedCount consistently with the returned retained projection and update affected fixtures.
- [ ] Render active and retained rows through stable project/property keys so Text remains editable. Show source-level unavailable/unreadable/root-conflict feedback once in the normal workspace screen, retain visible metadata and reuse retry at the existing source location.
- [ ] Add EN/RU interaction tests for distinct exclusion/recovery explanations, retained Text editing, source retry, load failure and draft preservation. Assert no mass missing labels and no metadata/file mutation during failed or incomplete scans.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test; commit the verified explicit task paths.

### Task 2: Deliver explicit direct-folder reassociation through the production UI

Files:

- Create: src/contracts/project-recovery.ts
- Create: src/service/project-recovery.ts
- Create: src/renderer/components/ProjectRecoveryPanel.tsx
- Create: tests/project-recovery-ui.test.tsx
- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/contracts/service-protocol.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: src/service/entry.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify: src/renderer/components/DiscoveryPanel.tsx
- Modify: src/renderer/components/TextPropertiesTable.tsx
- Modify: src/renderer/localization.ts
- Modify: src/renderer/app.css
- Modify: tests/project-recovery-service.test.mjs
- Modify: tests/backend-lifecycle.test.mjs

Interfaces:

- workspace.previewProjectRecovery query: exact type, workspaceId and projectId.
- ProjectRecoveryPreview: workspaceId, sourceId, projectId, discovery revision, mode, source scan state, nullable previewToken and candidate directory entries.
- Candidate entries: source-relative path, native basename, nullable category path and a typed selectable/conflict status.
- workspace.reassociateProject command: exact type, workspaceId, projectId, previewToken and relativePath.
- Successful reassociation returns ProjectList.
- WorkspaceServiceClient exposes previewProjectRecovery and reassociateProject with typed ServiceResult returns.

- [ ] Write direct recovery tests: externally remove or rename a fixture folder, preview candidates without Apply, cancel without writes, explicitly recover and reopen with the identical project ID and exact Text values.
- [ ] Implement the focused recovery module and service-owned review lifecycle. Enforce exact payloads, UUIDs, existing same-source ownership, eligible recovery subject, configured mode and continuously verified accessible root evidence.
- [ ] Validate target existence, directory kind, containment, native identity, basename/depth, exclusions, archive/service rules and project ownership. Reject files, traversal, wrong depth, links/junctions, native aliases and conflicting reserved paths; do not enumerate project contents.
- [ ] Revalidate the reviewed configuration, records and filesystem inside the transaction before writes and after writes. Update only the selected association; increment discoveryRevision once, invalidate same-source reviews and publish projectsChanged only after commit.
- [ ] Route the query, command and response through settings, production entry, protocol, desktop API and typed client. Reuse the existing generic main/preload route; extend its validation only where required.
- [ ] Add Locate folder, candidate selection, target review, Reassociate, Refresh and Cancel controls with EN/RU text, keyboard/focus behavior, empty/loading/conflict/failure/pending states and truthful success feedback. Disable duplicate submission and cancellation during an accepted pending mutation.
- [ ] Add real IPC/client tests plus service failure injection for rollback, stale/root/target swaps, foreign IDs and unchanged inventories/bytes. Verify a replacement already owned by another project cannot inherit the retained record's Text.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test; commit the verified explicit task paths.

### Task 3: Recover grouped projects without violating category ownership

Files:

- Modify: src/service/project-recovery.ts
- Modify: src/service/discovery.ts
- Modify: src/renderer/components/ProjectRecoveryPanel.tsx
- Modify: src/renderer/localization.ts
- Modify: tests/project-recovery-service.test.mjs
- Modify: tests/grouped-discovery-service.test.mjs
- Modify: tests/project-recovery-ui.test.tsx

- [ ] Add grouped tests recovering into an existing active category and into a newly observed category without discovery Apply. Assert required same-source category ownership and unchanged project ID/Text, category-property ID/label and independent views.
- [ ] Validate both directory levels using the existing scanner. Reuse an active category only when its path and native evidence continuously match; reject excluded, replaced, missing or ambiguous current category associations with an actionable unavailable-target explanation.
- [ ] For a genuinely new category, insert its source-owned record before activating the recovered project in the same transaction. Preserve all existing projects/categories; do not discover unrelated candidate projects as a side effect.
- [ ] Add deterministic category/root/link swaps and category-insert/project-update failures. Assert complete rollback, no emitted committed event and unchanged property/category-label revisions and file inventories.
- [ ] Show grouped target category and full source-relative path in the EN/RU selection/review UI. Test keyboard operation, category conflicts, empty target sets and explicit refresh after stale review.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test; commit the verified explicit task paths.

### Task 4: Preserve drafts and reject stale recovery responses

Files:

- Modify: src/service/project-recovery.ts
- Modify: src/service/workspaces.ts
- Modify: src/renderer/App.tsx
- Modify: src/renderer/components/DiscoveryPanel.tsx
- Modify: src/renderer/components/ProjectRecoveryPanel.tsx
- Modify: src/renderer/components/TextPropertiesTable.tsx
- Modify: tests/project-recovery-service.test.mjs
- Modify: tests/project-recovery-ui.test.tsx
- Modify: tests/renderer-app.test.tsx
- Modify: tests/backend-lifecycle.test.mjs

- [ ] Add production event-order tests: own committed event before response, newer sibling recovery/discovery commits, same-source fanout, unrelated-source isolation and listener cleanup.
- [ ] Invalidate discovery and recovery reviews after committed source-association changes and source observations. Clear service tokens on workspace removal and service close/restart; never persist or replay tokens.
- [ ] Guard delayed preview/list/commit results by workspace/source/project, request lifetime, backend generation and discovery revision. Accept own event-before-response success while preventing an older response from replacing a newer sibling snapshot.
- [ ] Preserve independent Text and category-label revisions and unsaved drafts across availability refresh, retained-to-active transitions and recovery. Keep source retry and recovery failure from remounting unrelated editors.
- [ ] Add UI race tests for cancellation before preview completion, selection/removal, backend loss/restart, source disconnection, repeated submission and stale target selection. A lost mutation response must show an uncertain outcome and reload committed state without automatic retry or fabricated success.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test; commit the verified explicit task paths.

### Task 5: Add permanent runtime and presentation recovery fixtures

Files:

- Modify: scripts/smoke-runtime.mjs
- Modify: scripts/smoke-discovery-layouts.mjs
- Modify: src/renderer/components/bb-foundation.stories.tsx
- Modify: tests/project-recovery-ui.test.tsx
- Modify: tests/components.test.tsx

- [ ] Extend the actual Electron fixture with authored Text, missing individual folders, replaced/ambiguous retained records, direct/grouped recovery and root disconnect/retry. Exercise cancellation, rejection and success through production UI/service routes.
- [ ] Extend restart and final-workspace-removal/source-reuse assertions to compare recovered logical IDs, exact Text, categories, category label, settings and independent view IDs. Compare inventories and sentinel bytes against the externally prepared fixture state to detect application filesystem writes or marker files.
- [ ] Add EN/RU Ladle fixtures for retained rows and recovery loading, empty, selection, conflict, stale, failure, pending and saved states using production components.
- [ ] Extend layout/keyboard automation at 1440×960, 1024×720 and 420×800. Assert long authored names/paths wrap, controls remain reachable, focus returns after cancel/save and the document has no horizontal overflow.
- [ ] Extend evidence with recovery identities, revisions, events and distinct feature/shutdown/restart stages. Preserve failed attempts and screenshots under work/ralphex/issue-14; keep the existing ten-second shutdown assertion unchanged.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test and PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run build:ladle; commit the verified explicit task paths.

### Task 6: Verify acceptance and document implemented limits

Files:

- Modify: tests/project-recovery-service.test.mjs
- Modify: tests/grouped-discovery-service.test.mjs
- Modify: README.md
- Modify: CHANGELOG.md
- Modify: docs/architecture.md
- Modify: docs/development.md
- Create: docs/verification/issue-14-folder-recovery.md

- [ ] Add regression coverage reopening a populated baseline database containing active/excluded/missing/replaced projects, grouped categories and authored Text. Verify recovery and source reuse without schema/data reset. If a necessary migration is discovered, preserve existing migrations and add an ordered migration plus populated upgrade/rollback tests before proceeding.
- [ ] Update English user guidance, architecture and development documentation with the implemented selection rules, reserved-path/native conflicts, grouped-category limit, source retry, metadata-only recovery and stale/uncertain outcomes. Add an accurate English Unreleased entry; keep automatic reconciliation and mode switching future.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run lint, PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run typecheck, PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run check:docs, PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run build and PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run build:ladle.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" node scripts/smoke-discovery-layouts.mjs and preserve layout/keyboard results and screenshots.
- [ ] Run development smoke with PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" WORKSPACE_SMOKE_EVIDENCE_DIR="$PWD/work/ralphex/issue-14/runtime-dev" npm run smoke:runtime -- dev. Build a fresh unsigned artifact with PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run package:dev:mac, then run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" WORKSPACE_SMOKE_EVIDENCE_DIR="$PWD/work/ralphex/issue-14/runtime-release" npm run smoke:runtime -- release.
- [ ] Record actual passed, failed and unreached stages, evidence locations and acceptance-criterion mapping. A #44 shutdown failure remains a failed runtime check; do not retry blindly, relax timeouts, force successful exit or claim unreached restart verification.
- [ ] Run git diff --check and git diff 3731c798c8739624d97160d6b48fe6f8ec244550 --check. Commit verified explicit task paths and report remaining acceptance blockers.

## Post-Completion

- Inspect changed EN/RU screenshots for narrow/wide readability and focus usability; distinguish automated assertions from observed inspection.
- Before reviews, reread coordinator-findings.md and review the entire diff against the fixed base.
- First comprehensive review collects quality, implementation, testing, simplification and documentation perspectives, using batches of three and two if necessary. All reviewers inherit gpt-6.1-sol high.
- Follow-up review launches only the prescribed quality/implementation pair. Verify findings against actual code, fix confirmed in-scope defects, rerun affected checks and commit explicit paths.
- Coordinator owns tracker updates, exact-SHA macOS/Windows CI, platform acceptance, push and integration. Local macOS results do not establish Windows acceptance or close #44.
- No automatic finalization, push, merge, tagging, signing or release.

## Exclusions

No automatic cross-path reconciliation/watchers, configured mode switching, source relocation/merge, folder creation/move/rename/delete/reveal/archive mutation, new property types/views, backup/import, synchronization, AI, remote access, website, coverage quota/tooling or CLAUDE.md creation.
