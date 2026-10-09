# Issue #11: Preview and Discover Direct Project Folders

## Overview

Deliver T04: preview immediate child folders, edit manual exclusions, apply the reviewed interpretation, and display project names in the existing default Table. Persist source-owned configuration and logical project records across restart and sibling workspaces without writing into project folders.

Plan destination: docs/plans/issue-11-direct-projects.md.

## Context

- Requirements: work/ralphex/issue-11/task.md, the versioned T04 ticket, and GitHub https://github.com/kornouhovas/workspace/issues/11.
- Accepted contracts: docs/product.md, docs/decisions.md D08/D16/D17/D21/D22/D25/D26, docs/architecture.md, GLOSSARY.md, ADRs 0001–0005, and docs/specs/workspace-0.1.0.md.
- Branch: codex/issue-11-direct-projects.
- Fixed review base for every phase: 3128915a9ce32ee2c47fedbefe9874df1168a91c.
- Baseline: clean checkout with a real TypeScript service, SQLite/Drizzle, workspace management, default Table identities, and validated source notifications.
- Service and persistence: src/service/workspaces.ts, settings.ts, entry.ts, and db/.
- Contracts and transport: src/contracts/, src/desktop/backend-controller.ts, main.ts, and preload.ts.
- Renderer: src/renderer/App.tsx, workspace-service-client.ts, localization.ts, app.css, and existing adapted bb controls.
- Tests and runtime: tests/workspaces-service.test.mjs, backend-lifecycle.test.mjs, renderer-app.test.tsx, build/artifact checks, and scripts/smoke-runtime.mjs.
- No new production dependency is expected.

## Development Approach

- Testing approach: TDD for discovery, identity matching, command validation, transactions, and notification behavior; extend UI and runtime tests alongside working features.
- Complete tasks sequentially. Every task includes new or updated tests; all tests must pass before starting the next task.
- Use meaningful behavioral assertions rather than a numerical coverage quota, as required by the T04 task contract.
- Before execution, install the committed dependency resolution with PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm ci.
- Explicitly prepend that PATH before EVERY Node/npm/npx command. Apply the same requirement to any outer review agents.
- All phases use gpt-6.1-sol:high. Preserve the fixed review base and T04 constraints in review instructions.
- Read work/ralphex/issue-11/coordinator-findings.md before each implementation/review phase if present; verify provisional findings against actual code.
- Keep filesystem policy, identity matching, and transactions in the backend. React consumes typed results and manages interaction state.
- Use disposable real SQLite databases and temporary folders, including nested content, sentinel bytes, links/junctions, and platform-appropriate access failures.
- Preserve contextIsolation: true, nodeIntegration: false, sandbox: true, machine-local database placement, and existing source/workspace/view ownership.
- Commit every completed, verified slice in English, staging explicit task files.
- Coordinator owns tracker changes, push, integration, publication, release, and final acceptance. Do not launch nested Ralphex.

## Settled Implementation Choices

### Discovery and exclusions

- Scan immediate children only. Files are not projects; recognized project contents are never traversed.
- Automatically exclude symbolic links and junctions before resolving their targets, directories whose names start with ".", and the Windows service directories "$RECYCLE.BIN" and "System Volume Information" using case-insensitive comparison.
- Honor a nullable, source-owned archiveRelativePath. If an archive lies below an immediate child, exclude that child from direct discovery so the designated archive cannot become project content through direct interpretation.
- Validate archive designation as a relative location within the source. Invalid persisted designation blocks discovery safely.
- Do not infer archive designation from names such as "Archive". Archive selection, defaults, and physical archive operations remain T15.
- Manual exclusions use exact immediate-child relative names returned by the backend. Reject absolute paths, traversal, separators, duplicates, and invented additions. Preserve previously saved exclusions for currently absent folders.
- Preview shows selectable real directories and automatically excluded entries with localized reasons. Manual exclusions remain editable; automatic exclusions cannot be overridden.
- Sort names deterministically without translating or altering authored text.

### Preview and apply

- Add workspace.previewDiscovery with workspaceId and optional excludedRelativePaths. Omitting exclusions loads the saved source configuration; supplying them creates a reviewed draft.
- Return a DiscoveryPreview containing workspaceId, sourceId, source revision, canonical root, draft exclusions, candidate decisions, and an opaque previewToken.
- Represent empty, unavailable, unreadable, and root-identity-conflict states explicitly. Only complete, safe previews receive an applyable token.
- Keep tokens in service memory, bound to workspace/source ownership, root identity, configuration revision, draft exclusions, and the complete interpretation snapshot. A new preview for that workspace replaces its previous token; service restart invalidates tokens.
- Preview and exclusion edits perform no persistent writes. Cancel discards renderer state without changing configuration, projects, selection, or views.
- Add workspace.applyDiscovery with workspaceId and previewToken. The backend obtains exclusions and reviewed candidates from its token, never from a submitted project list.
- Revalidate ownership, current configuration, root identity, entry kinds, candidate identities, exclusions, and containment using the same scanner before persistence.
- Changed filesystem/configuration state returns stale_preview and requires a refreshed preview and another explicit Apply. Never silently apply a different interpretation.
- Commit source configuration and project associations atomically. Failed validation or transactions preserve saved state and emit no committed discovery event.
- Filesystem observations are not a filesystem lock. Reject changes observed during validation and document the remaining race boundary without claiming atomic filesystem/database coordination.

### Persistence and identity

- Store source-owned direct-discovery configuration, revision, nullable archive designation, and applied root identity evidence.
- Introduce source-owned projects with opaque UUIDs, relative paths, native identity evidence, and retained association state. Paths and native IDs are locators/evidence, not logical project IDs.
- Store dev/ino and available directory birth-time evidence losslessly. Match only the same relative path under the same verified root with sufficient, unchanged evidence and no conflicting association.
- Do not use mutable directory modification/change timestamps as durable project identity.
- Changed reliable evidence establishes a replacement: retain the old record and assign a new logical ID to the new folder.
- Insufficient, conflicting, or reused evidence remains unresolved and retains existing metadata. Explain unresolved candidates in preview; do not attach old metadata or silently create duplicate associations.
- Do not automatically reassociate records already marked unresolved/missing, or match folders at another path by native ID. External moves and recovery actions remain T07/T08.
- Manual exclusion retains project records. Re-including a continuously matching folder can reuse its ID.
- A successful complete scan can mark absent associations as retained/missing. Unavailable or unreadable roots do not rewrite projects as missing or erase the saved projection.
- Add workspace.listProjects with workspaceId. Return source ownership, revision, configuration/availability state, active project summaries, and retained-record counts.
- Keep the existing default Table view ID. Show active applied project names and a localized retained-metadata notice without adding reassociation controls.

## Implementation Steps

### Task 1: Deliver a read-only direct-discovery preview

Files:

- Create: src/service/discovery.ts
- Create: src/service/db/migrations/0003_source_discovery.sql
- Create: src/renderer/components/DiscoveryPanel.tsx
- Modify: src/service/db/schema.ts
- Modify: src/service/db/migrations/meta/_journal.json
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
- Modify: tests/build-smoke.test.mjs
- Modify: tests/artifact-smoke.test.mjs
- Modify: scripts/check-artifact.mjs

Interfaces:

- WorkspaceService.previewDiscovery(input: unknown) returns ServiceResult<DiscoveryPreview>.
- WorkspaceServiceClient.previewDiscovery(workspaceId, excludedRelativePaths?) forwards the typed request.
- DiscoveryPanel presents backend decisions and receives callbacks; it performs no filesystem or domain interpretation.

- [x] Add failing real-fixture tests for immediate directories, ordinary files, nested project content, dot-prefixed/service directories, symlinks/junctions, empty roots, unavailable roots, and directory-open failures.
- [x] Add the source configuration migration with unconfigured defaults, revision, saved exclusions, nullable archiveRelativePath, and nullable applied-root evidence; preserve existing IDs, settings, selection, ordering, and views.
- [x] Implement the shared scanner and read-only preview/token policy with strict selected-source containment and root/entry rechecks. Do not enumerate project contents or external link targets.
- [x] Wire preview requests through the real service entry, typed desktop API, existing IPC route, and renderer client. Reject malformed requests and foreign workspace ownership.
- [x] Add an EN/RU preview panel with manual exclusion controls, automatic-exclusion explanations, Cancel, keyboard focus recovery, and loading/empty/unreadable/unavailable states. Exclusion changes request a new authoritative preview.
- [x] Seed a real persisted nullable archive designation in a disposable database and verify it through the production preview service; include an ordinary undesignated Archive folder. Extend upgrade/build/artifact fixtures and assert previews/cancellation leave saved records and folder bytes unchanged.
- [x] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test and PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run typecheck; commit the verified preview slice.

Task 1 verification: 115 tests passed with `npm test` (including the application build); `npm run typecheck`, `npm run lint`, `npm run check:docs`, and `git diff --check` passed. A disposable actual-Electron preview run exercised EN/RU at 1440x960, 1024x720, and 420x800, authoritative exclusions, keyboard focus recovery, cancellation, unchanged configuration, sentinel bytes, and ordinary shutdown. Screenshots and command logs are retained under ignored `work/ralphex/issue-11/task1-preview*`. The native picker used the existing test seam; Windows was not exercised. The external macOS host shutdown prerequisite #44 remains open. Apply/project persistence and the integrated runtime scenarios remain Tasks 2–4.

### Task 2: Apply reviewed discovery and display persistent projects

Files:

- Create: src/service/db/migrations/0004_direct_projects.sql
- Modify: src/service/db/schema.ts
- Modify: src/service/db/migrations/meta/_journal.json
- Modify: src/service/discovery.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: src/service/entry.ts
- Modify: src/contracts/settings.ts
- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/contracts/service-protocol.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify: src/renderer/components/DiscoveryPanel.tsx
- Modify: src/renderer/App.tsx
- Modify: src/renderer/localization.ts
- Modify: src/renderer/app.css
- Modify: tests/workspaces-service.test.mjs
- Modify: tests/backend-lifecycle.test.mjs
- Modify: tests/renderer-app.test.tsx
- Modify: tests/build-smoke.test.mjs
- Modify: tests/artifact-smoke.test.mjs
- Modify: scripts/check-artifact.mjs

Interfaces:

- WorkspaceService.applyDiscovery(input: unknown) returns ServiceResult<ProjectList>.
- WorkspaceService.listProjects(input: unknown) returns ServiceResult<ProjectList>.
- WorkspaceServiceClient.applyDiscovery(workspaceId, previewToken) and listProjects(workspaceId) expose the same contracts.
- Add stale_preview to the validated ServiceResult error vocabulary.

- [x] Add failing service tests for preview/apply agreement, persisted manual exclusions, stable IDs after unchanged rescans/restart, replacement/copy/native-ID reuse, insufficient evidence, retained missing/excluded records, and root replacement.
- [x] Add the project migration, source-owned records, conservative matching rules, and real listProjects query. Preserve source/project metadata after removal of the final workspace and reuse it when another workspace references that source.
- [x] Implement exact-payload validation and token ownership/revision checks. Rescan before apply; reject candidate additions/removals/replacements, link swaps, root retargeting, changed configuration/archive designation, forged tokens, restart-expired tokens, and removed workspaces.
- [x] Persist reviewed exclusions, root evidence, configuration revision, and project associations in one transaction. Inject failures during configuration and project writes; assert full rollback, retained metadata, and no committed discovery event.
- [x] Wire Apply and project-list queries through service/IPC/client. Display committed project names in the existing Table; distinguish unconfigured, applied-empty, retained-metadata, unavailable, loading, and error states in EN/RU.
- [x] Test keyboard Apply, pending-state duplicate prevention, storage failures, stale-preview refresh requiring another explicit Apply, re-inclusion, and unchanged root/project/excluded/external bytes with no marker files. Extend populated upgrade/reopen and packaged-migration fixtures.
- [x] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test and PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run typecheck; commit the verified apply/Table slice.

Task 2 verification: 135 tests passed with `npm test` (including the application build); `npm run typecheck`, `npm run lint`, `npm run check:docs`, and `git diff --check` passed. Real SQLite/filesystem fixtures cover reviewed projection agreement, persisted exclusions, stable IDs after restart/rescan/re-inclusion, replacement/copy/reused or insufficient native evidence, retained missing/unresolved/excluded records, final-workspace removal/reuse, root replacement/retargeting, token/configuration/ownership validation, and rollback during configuration/project writes and observed filesystem changes. Actual service ports and BackendController preserve the normalized stale-preview response. EN/RU renderer tests cover keyboard Apply, duplicate prevention, storage failure, explicit re-Apply after refresh, loading/error/empty/retained states, and checkbox focus during authoritative exclusion refresh.

A disposable actual-Electron run exercised preview/exclude/Apply/Table and unchanged rescans in EN/RU at 1440x960, 1024x720 and 420x800, asserted no horizontal overflow and unchanged sentinel bytes/no markers, and retained project and Table view IDs after restart. Both normal quits passed. Screenshots, script and results are under ignored `work/ralphex/issue-11/task2-apply*`; visual inspection confirms long-name/path wrapping and legible narrow actions. Two initial diagnostic selector mistakes were corrected before the successful feature run. Native picking used the existing test seam; Windows and fresh packaged runtime were not exercised in this slice. The external macOS host shutdown prerequisite #44 remains open. Source-scoped discovery notifications and broader race guards remain Task 3; integrated/runtime/artifact acceptance remains Task 4. Filesystem evidence and repeated checks do not provide a filesystem lock or detect every reuse of indistinguishable native evidence; no move reconciliation or reassociation is implemented.

### Task 3: Propagate applied projects safely to sibling workspaces

Files:

- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/service-protocol.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/entry.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify: src/renderer/App.tsx
- Modify: src/renderer/components/DiscoveryPanel.tsx
- Modify: tests/workspaces-service.test.mjs
- Modify: tests/backend-lifecycle.test.mjs
- Modify: tests/renderer-app.test.tsx
- Modify: src/desktop/backend-controller.ts, main.ts, or preload.ts only where existing routing requires an actual change

Interfaces:

- Extend WorkspaceChangeEvent with workspace.projectsChanged containing sourceId, actual referencing workspaceIds, and committed revision.
- Deliver it through the existing workspace.change envelope and production subscription route.

- [x] Add failing tests for actual same-source fanout, different-source isolation, stale sibling previews, subscription cleanup, and failed-transaction event suppression.
- [x] Publish discovery events only after successful commits, using actual workspace references and the committed revision. Keep source availability and workspace-list events authoritative; avoid notifications or reload loops for unchanged projections.
- [x] Extend event validation and exercise delivery through real service ports, BackendController, compiled preload, and typed client, including malformed events and interleaved responses.
- [x] Reload applied projects for the currently referencing workspace; load the saved shared projection on workspace activation/restart. Invalidate affected previews and require review again before Apply.
- [x] Guard delayed project-list/preview/apply responses against newer source revisions, selection changes, workspace removal, cancellation, and backend restart. Preserve entered exclusions for review without presenting stale rows as current.
- [x] Test two real clients/workspaces sharing a source, unrelated roots, removal of all references, subsequent source reuse, and preserved independent view identities; cover EN/RU error recovery and cleanup.
- [x] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test and PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run typecheck; commit the verified notification/race slice.

Task 3 verification: 142 tests passed with `npm test` (including the application build); `npm run lint`, `npm run typecheck`, `npm run check:docs`, and `git diff --check` passed. Real SQLite/filesystem tests assert post-commit source-scoped project notifications, actual references, unchanged-Apply suppression with stable revision and still-valid sibling previews, failed-transaction suppression, retained metadata after final-reference removal/source reuse, and independent Table identities. Two typed clients receive events through real service ports and BackendController; compiled preload rejects malformed project events and cleans subscriptions. Renderer regressions cover reverse-order lists/previews/Apply responses, newer revision floors, source isolation, selection/removal/cancellation, backend restart, EN/RU Retry recovery, preserved draft exclusions, and keyboard focus recovery when stale preview controls disappear.

A disposable actual-Electron development run exercised sibling Apply through the production service/preload/client route, updated Table rows, invalidated the open preview, preserved the exclusion draft for explicit refreshed review, rejected unrelated-source effects, retained sentinel bytes without markers, and verified keyboard focus recovery. EN/RU stale-preview screenshots at 1440x960, 1024x720 and 420x800 show legible controls and no horizontal overflow. Normal shutdown passed. Script, screenshots, results and logs are under ignored `work/ralphex/issue-11/task3-*`. Initial diagnostic selector and unchanged-Apply expectation mistakes were corrected and their failed evidence retained. Native picking used the existing test seam; Windows and fresh packaged verification remain Task 4/coordinator work. The external macOS host shutdown prerequisite #44 remains open. No trackers, integration, push or release were changed.

### Task 4: Verify integrated acceptance and document actual capabilities

Files:

- Modify: scripts/smoke-runtime.mjs
- Modify: tests/renderer-app.test.tsx
- Modify: tests/backend-lifecycle.test.mjs
- Modify: src/renderer/components/bb-foundation.stories.tsx
- Modify: README.md
- Modify: CHANGELOG.md
- Modify: docs/development.md
- Modify: docs/architecture.md
- Modify: docs/reuse.md only if additional bb code is copied

- [ ] Extend automated actual-Electron fixtures and UI flows to preview, exclude, cancel, apply, show project names, inspect sibling observations, restart, rescan without ID changes, remove/recreate configurations, and verify retained source/project metadata and sentinel bytes.
- [ ] Extend runtime failure scenarios for stale preview and unavailable-root retention, using production controls and the real utilityProcess/preload/client route. Preserve renderer-isolation, native-picker seam, startup-failure, and shutdown assertions.
- [ ] Add Ladle states and automated EN/RU screenshots at 1440x960, 1024x720, and 420x800 for preview, applied Table, empty/pending/error/stale states, and long authored names/paths; assert wrapping and absence of unintended overflow.
- [ ] Update capability documentation and Unreleased only for implemented behavior, precise exclusions, conservative identity limits, retained metadata, and actual verification commands. Preserve bb attribution/notices; do not add an active-plan link to docs/plans/README.md.
- [ ] Run the complete checks: PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test; PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run lint; PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run typecheck; PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run check:docs; PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run build; PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run build:ladle; git diff --check.
- [ ] Run PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run smoke:runtime -- dev, PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run package:dev:mac, and PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run smoke:runtime -- release against a fresh artifact. If downloads fail, bound waits and use supported run-local --config.electronDist=node_modules/electron/dist with matching installed Electron44.7.0.
- [ ] Record commands, feature assertions, screenshots, runtime failures, and limitations under ignored work/ralphex/issue-11, including evidence recorded before any quit failure. Inspect the final diff against 3128915a9ce32ee2c47fedbefe9874df1168a91c, verify documentation references remain valid after plan archival, commit verified changes, and leave a clean worktree.

## Acceptance Mapping

- Preview/apply agreement, exclusions, untouched content, and cancellation: Tasks 1–2 and runtime Task 4.
- Direct depth, service/link/archive exclusions, and containment: Tasks 1–2.
- Logical IDs, unchanged rescan/restart, and conservative replacement handling: Task 2 and runtime Task 4.
- Stale filesystem/configuration/token/ownership rejection and rollback: Tasks 2–3.
- Empty/unreadable/unavailable states and retained metadata: Tasks 1–4.
- Same-source sharing, unrelated-source isolation, final-reference removal, and default Table identity: Tasks 2–4.
- Real IPC events, races, localization, keyboard operation, layouts, migrations, and packaged resources: Tasks 1–4.

## Exclusions

Grouped discovery, folder-backed Select, properties, Board/general view lifecycle, external reconciliation/reassociation, watchers, folder creation/rename/move, archive/restore, backup implementation, synchronization, AI, remote access, website, and legacy import remain outside T04.

## Post-Completion

- Coordinator inspects and accepts the plan before execution; outer Ralphex owns reviews. Do not recursively launch Ralphex.
- Coordinator obtains and assesses authorized Windows platform evidence. macOS checks do not establish Windows verification.
- Physical macOS27 host shutdown bug #44 remains an external release prerequisite. Record feature assertions separately from quit failure; do not retry blindly, alter production shutdown, suppress assertions, or claim the prerequisite resolved.
- Native picker behavior remains subject to the existing automated seam limitation.
- Coordinator owns GitHub/Beads status, integration, push, release, and acceptance. Do not close parent #7/epic workspace-31i or begin another issue.
- Report actual checks, remaining limitations, and existing commits in Russian.
