# GitHub #12: Shared Text Properties Implementation Plan

## Overview

Create and rename source-owned Text definitions, edit and clear their values in the existing default Table, and observe the same committed data from sibling workspaces after restart. Preserve logical project identities, independent workspace views and all project-folder contents.

Target plan file: docs/plans/issue-12-text-properties.md.

## Context

- Authoritative scope: work/ralphex/issue-12/task.md and work/ralphex/issue-12/coordinator-findings.md.
- Requirements: GitHub #12, docs/specs/workspace-0.1.0-tickets/05-create-and-edit-shared-text-properties.md, and the applicable sections of docs/specs/workspace-0.1.0.md.
- Applicable guidance: AGENTS.md, docs/development.md, docs/product.md, docs/decisions.md, docs/architecture.md, docs/reuse.md, GLOSSARY.md and accepted ADRs 0001–0005.
- Baseline: 2856e7aeff972d8f97b5825987e7051a459e1d84. The inspected checkout is clean and HEAD matches this baseline.
- Existing architecture: React uses WorkspaceServiceClient and a narrow preload API. Electron main forwards requests and notifications to a separate TypeScript utilityProcess owning SQLite through Drizzle and better-sqlite3.
- Existing Table: DiscoveryWorkspace in src/renderer/components/DiscoveryPanel.tsx renders committed project names. Discovery revisions and notifications already have delayed-response guards.
- Dependencies: T03/#10 and T04/#11 are implemented. The recorded npm ci completed with the committed lockfile. No new dependency or coverage tooling is planned.
- Tracking reference: workspace-31i.5. The coordinator owns tracker changes and delivery.

## Development Approach

- Testing approach: TDD for new service, ownership, transaction and interaction behavior. Use real temporary SQLite databases and disposable filesystem fixtures at the typed service boundary.
- Complete, verify and commit each task before starting the next. Every code task includes new or updated behavioral tests.
- Keep product rules and persistence behind WorkspaceService. Keep React focused on presentation, drafts and request lifecycle.
- Reuse the existing bb-derived controls, styles and notices. Record provenance in docs/reuse.md only if additional upstream code is copied.
- Use one focused Text-property service module and focused Table/cell components. Do not introduce a generic property framework, repository hierarchy or later property types.
- Stage explicit task paths only. Write English code, documentation and commits; report progress and results in Russian.

Every shell invocation of Node, npm, npx or tsx must explicitly prepend /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin to PATH, including reviewer commands. Never download another Node through npx.

Before each task commit, run:

- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm test
- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run lint
- PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run typecheck
- git diff --check

These checks must pass before starting the next task. No coverage percentage is an acceptance criterion.

## Slice Contracts and Semantics

- Definitions have opaque UUIDs, source ownership, an authored name, immutable propertyType equal to text, and stable creation order. Names must contain a non-whitespace character; preserve their authored spelling and surrounding whitespace. Duplicate display names are allowed because commands address IDs.
- Null represents an absent or cleared value. Store no value row for null. An empty string is a stored authored value distinct from null. Save preserves strings exactly, including Unicode, whitespace and line breaks. Clear explicitly submits null.
- Display absent and empty-string values with distinct localized labels. Do not trim values or translate authored names and text.
- Add a persisted source propertyRevision independent of discoveryRevision. Increment it once per changed property transaction. Identical rename/value assignments and clearing an absent value return success at the existing revision without emitting an event.
- Property mutations do not change discovery configuration, project associations, workspace selection or view IDs. Adding propertyRevision must not accidentally invalidate discovery previews through whole-source object comparisons.
- Validate exact payload keys, UUIDs, entity existence and workspace/property/project source ownership in the service. Reject unsupported creation types and attempted type changes, including malicious extra fields on rename.
- Value commands address logical project IDs, never paths. Retained project records keep their values; no automatic reattachment to missing, excluded or replaced folders is introduced.

Typed additions:

- TextPropertyDefinition: propertyId, sourceId, name and propertyType: text.
- TextPropertySnapshot: workspaceId, sourceId, revision, definitions, and stored values identified by projectId/propertyId. Absent values have no entry.
- TextPropertyMutation: snapshot, propertyId and projectId; projectId is null for definition mutations.
- workspace.listTextProperties: workspaceId; returns ServiceResult<TextPropertySnapshot>.
- workspace.createProperty: workspaceId, name, propertyType: text; returns ServiceResult<TextPropertyMutation>.
- workspace.renameProperty: workspaceId, propertyId, name; returns ServiceResult<TextPropertyMutation>.
- workspace.setTextValue: workspaceId, projectId, propertyId, value: string|null; returns ServiceResult<TextPropertyMutation>.
- workspace.propertiesChanged: sourceId, actual referencing workspaceIds and committed property revision.

Keep the existing ProjectList and discovery revision contract separate. The Table combines committed projects with the source property snapshot by logical IDs.

## Implementation Steps

### Task 1: Create and rename Text definitions through the default Table

Files:

- Create: src/contracts/text-properties.ts
- Create: src/service/text-properties.ts
- Create: src/service/db/migrations/0005_text_properties.sql
- Create: src/renderer/components/TextPropertiesTable.tsx
- Create: tests/text-properties-service.test.mjs
- Modify: src/service/db/schema.ts
- Modify: src/service/db/migrations/meta/_journal.json
- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/contracts/service-protocol.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: src/service/entry.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify: src/renderer/components/DiscoveryPanel.tsx
- Modify: src/renderer/localization.ts
- Modify: src/renderer/app.css
- Modify: tests/settings-service.test.mjs
- Modify: tests/workspaces-service.test.mjs
- Modify: tests/backend-lifecycle.test.mjs
- Modify: tests/renderer-app.test.tsx
- Modify: tests/build-smoke.test.mjs
- Modify: tests/artifact-smoke.test.mjs
- Modify: scripts/check-artifact.mjs

- [x] Add failing typed-service tests for create/rename, authored Unicode and whitespace, duplicate names, stable IDs, sibling-source visibility, unrelated-source isolation, malformed/unknown IDs and attempted type changes. Inject SQLite transaction failures and assert unchanged data, revision and notifications.
- [x] Add the ordered migration for source propertyRevision, property definitions and Text values. Use logical-ID foreign keys, a unique project/property value key and ownership constraints preventing cross-source values. Preserve all existing settings, sources, projects, workspaces, views and selection.
- [x] Build an upgrade fixture from the actual baseline migrations 0000–0004, populated with settings, discovery configuration, project identities and independent views. Upgrade and reopen repeatedly; assert unchanged baseline data and usable property commands. Extend build/artifact checks to require migration 0005 and reject its omission.
- [x] Implement list/create/rename in the focused Text-property service and expose them through WorkspaceService, settings routing, entry request validation, typed desktop overloads and WorkspaceServiceClient. Publish propertiesChanged only after changed transactions commit, using the existing notification queue and production transport.
- [x] Integrate TextPropertiesTable into DiscoveryWorkspace. Show Name and stable property headers, an EN/RU create form and accessible rename controls. Support Enter submission, Escape cancellation, pending prevention, focus restoration, blank-name validation and recoverable save errors. Keep a useful property-creation surface when no projects exist.
- [x] Guard property lists and definition saves by workspace/source identity, observed revision and request lifetime. Preserve own successful feedback when its event precedes the response. Compare discovery-preview source state using discovery-relevant fields so property edits do not invalidate an otherwise unchanged preview; test this regression.
- [x] Run the task checkpoint and commit the verified slice as feat: create and rename shared Text properties.

Task 1 checkpoint:

- Implemented source-owned Text definition list/create/rename, migration 0005, production property notifications, and localized Table controls. Value editing remains Task 2.
- Verified with 161 passing tests through real temporary SQLite/filesystem fixtures, upgrade/reopen fixtures, service entry IPC, typed client and EN/RU React interactions. npm test also completed the production build and build/artifact regression checks; npm run lint, npm run typecheck and git diff --check passed.
- Baseline migrations 0000–0004 are unchanged from 2856e7aeff972d8f97b5825987e7051a459e1d84. Existing migration-count and legacy fixture tests were updated for migration 0005.
- Logs, including earlier failed attempts, are retained under work/ralphex/issue-12/task-1-evidence. One failed test process was stopped after its assertion attempted to print a large DOM object; the project-list error-state regression was fixed and subsequent full runs passed.
- Native Electron feature/screenshots/restart/package evidence belongs to Task 4 and has not been run in this iteration. Windows evidence remains coordinator-owned; physical macOS27 shutdown #44 remains unresolved.

### Task 2: Edit and clear authored Text values with durable project references

Files:

- Create: src/renderer/components/TextPropertyCell.tsx
- Modify: src/contracts/text-properties.ts
- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/contracts/service-protocol.ts
- Modify: src/service/text-properties.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: src/service/entry.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify: src/renderer/components/TextPropertiesTable.tsx
- Modify: src/renderer/localization.ts
- Modify: src/renderer/app.css
- Modify: tests/text-properties-service.test.mjs
- Modify: tests/workspaces-service.test.mjs
- Modify: tests/backend-lifecycle.test.mjs
- Modify: tests/renderer-app.test.tsx

- [x] Add failing service tests for nonempty strings, empty strings, null clearing, repeated no-op saves, Unicode, whitespace-only and multiline values. Verify exact returned and reopened values, revision changes, event suppression for no-ops and rollback for injected insert/update/delete failures.
- [x] Implement workspace.setTextValue with exact validation and same-source ownership checks. Persist the value change, revision and returned snapshot in one transaction; publish after commit. Reject foreign properties/projects, missing entities, non-string/non-null values and attempted property-type changes without writes.
- [x] Add an accessible cell editor labeled with project and property names. Enter on the cell opens editing; textarea Enter inserts a newline; Ctrl/Cmd+Enter saves; Escape cancels. Provide explicit keyboard-accessible Save, Clear and Cancel controls, focus restoration and pending state.
- [x] Preserve drafts after validation, storage or transport failure. Show localized absence/empty-string labels and useful EN/RU errors. Report saved state only from an actual successful service result; do not automatically save on blur or replay failed commands.
- [x] Extend real SQLite/filesystem regressions with values assigned before exclusion, missing-folder observation and folder replacement. Assert retained values remain attached to the original logical IDs, replacement IDs receive no inherited values, and sibling/last-workspace removal and source reuse preserve metadata after reopen. Compare fixture inventories and sentinel bytes before/after metadata commands.
- [x] Exercise save/clear through the typed client and service entry, including same-source sibling success and unrelated-source rejection. Add EN/RU interaction assertions for keyboard editing, cancellation, pending prevention and recoverable failed drafts.
- [x] Run the task checkpoint and commit the verified slice as feat: edit and clear shared Text values.

Task 2 checkpoint:

- Implemented workspace.setTextValue through the typed client/service entry and source-owned SQLite transactions. Null removes the value row; empty strings, Unicode, whitespace and line breaks are stored exactly. Identical assignments and clearing an absent value suppress revision increments and events.
- Added the localized accessible Table cell editor with Enter to open, multiline textarea input, Ctrl/Cmd+Enter to save, Escape to cancel, explicit Save/Clear/Cancel, pending prevention and focus restoration. Validation, storage and transport failures retain drafts; blur does not save.
- Verified with 166 passing tests via npm test, including production build and artifact regressions, real temporary SQLite rollback/reopen, typed client/service entry event-before-response behavior, and EN/RU mock and real-service UI interactions. npm run lint, npm run typecheck and git diff --check passed.
- Disposable filesystem fixtures preserve directory inventories and sentinel bytes across metadata commands. Values remain on original IDs through exclusions, replacement/missing observations, sibling/final workspace removal and retained source reuse; settings, discovery configuration, project records, selection and independent views remain unchanged by value mutations.
- Evidence is retained under work/ralphex/issue-12/task-2-evidence, including the initial failing service/cell tests and a focused IPC attempt run against an outdated compiled entry. The subsequent full npm test rebuilt the entry and passed all checks.
- Notification conflict notices and backend lifecycle response guards remain Task 3. Native Electron/screenshots/restart/package checks remain Task 4; no native or Windows runtime verification is claimed here. Physical macOS27 shutdown #44 remains unresolved and a final-release blocker.

### Task 3: Preserve committed state and editing drafts across notifications

Files:

- Modify: src/contracts/service-protocol.ts
- Modify: src/service/text-properties.ts
- Modify: src/service/workspaces.ts
- Modify: src/renderer/components/TextPropertiesTable.tsx
- Modify: src/renderer/components/TextPropertyCell.tsx
- Modify: src/renderer/components/DiscoveryPanel.tsx
- Modify: src/renderer/App.tsx where backend lifecycle propagation requires it
- Modify: src/renderer/localization.ts
- Modify: tests/text-properties-service.test.mjs
- Modify: tests/backend-lifecycle.test.mjs
- Modify: tests/renderer-app.test.tsx

- [x] Add controlled deferred-response tests for an own event arriving before its save response, a newer sibling commit overtaking an older list/save response, multiple property notifications, workspace switching/removal, backend unavailable/ready transitions and component cleanup.
- [x] Keep committed snapshots and editing drafts separate. Reload affected source data without replacing an unsaved draft. If the same field changes externally, preserve the draft and show a localized notice; Save remains an explicit new command and Cancel reveals current committed data.
- [x] Accept snapshots only for the current workspace/source and at least the newest observed property revision. Allow an own successful response at that revision, reject older snapshot replacement and distinguish a completed save from a subsequent sibling change. Invalidate pending work on backend lifecycle changes and cleanup; never replay mutations automatically.
- [x] Extend IPC regressions through the real service entry with temporary SQLite, BackendController event handling, preload subscriptions and WorkspaceServiceClient validation. Assert event-before-response ordering, actual sibling fanout, unrelated-source isolation, malformed-event rejection, unsubscribe/unload cleanup and no events from failed/no-op transactions.
- [x] Verify subscriber failures and reentrant reads cannot change committed results or reorder property event batches. Preserve discovery notification behavior and test that definition rename does not lose values or disturb independent views.
- [x] Run the task checkpoint and commit the verified slice as feat: guard shared Text updates and editing drafts.

Task 3 checkpoint:

- Kept committed property snapshots separate from cell/name drafts. Same-field sibling changes show localized EN/RU notices without replacing drafts; Cancel reveals current committed data, and retry sends an explicit new command with the retained authored draft.
- Cell save feedback now distinguishes a successful command overtaken by a newer source revision. Own events before responses retain success; older list/save snapshots cannot replace newer committed data. Later sibling changes update completed cell and definition feedback.
- Added backend generations in App so even batched unavailable/ready notifications invalidate prior component lifetimes and trigger fresh queries. Old editors are reset on backend restart, workspace/source replacement or removal; pending mutations are never replayed automatically. Tests also cover unmount cleanup.
- Verified the existing service notification queue with throwing subscribers, reentrant committed reads and nested property/discovery mutations. Event batches remain ordered, committed responses remain unchanged, rename retains values, and independent views/selection and sentinel file bytes are preserved.
- Extended real temporary SQLite entry/controller/compiled-preload/client regressions for two subscribers, actual sibling fanout, unrelated-source isolation, event-before-response ordering, no-op/failed transactions, malformed-event rejection and unsubscribe/unload/shutdown cleanup.
- All 172 tests passed through npm test, including the production build and existing build/artifact regressions. npm run lint, npm run typecheck and git diff --check passed. No dependency, migration, transport contract or upstream copied-code changes were needed in this task.
- Evidence is retained under work/ralphex/issue-12/task-3-evidence, including initial failing notice/feedback tests, the reproduced batched-lifecycle failure and a failed typecheck attempt followed by corrected passing checkpoint logs.
- Native Electron feature checks, screenshots, application restart and packaging evidence remain Task 4. No native or Windows runtime acceptance is claimed. Physical macOS27 shutdown #44 remains unresolved and a final-release blocker; Windows evidence remains coordinator-owned.

### Task 4: Add permanent runtime evidence and document the implemented slice

Files:

- Modify: scripts/smoke-runtime.mjs
- Modify: scripts/smoke-discovery-layouts.mjs
- Modify: src/renderer/components/bb-foundation.stories.tsx
- Modify: tests/renderer-app.test.tsx
- Modify: tests/backend-lifecycle.test.mjs
- Modify: tests/build-smoke.test.mjs and tests/artifact-smoke.test.mjs if additional regression assertions are needed
- Modify: README.md
- Modify: CHANGELOG.md
- Modify: docs/development.md
- Modify: docs/architecture.md
- Modify: docs/reuse.md only if additional upstream code was copied

- [ ] Extend permanent Electron smoke scenarios before the first quit: discover disposable projects, create/rename a Text definition, save authored/empty/whitespace values, clear a value, switch to a sibling workspace and assert shared data, and verify a different source is unchanged. Use the production UI and preload route; record property/source/project/view IDs and revisions.
- [ ] Extend post-restart scenarios to verify definition/value persistence, sibling visibility and unchanged logical identities, then workspace removal/source reuse. Compare sentinel bytes and directory inventories, preserving renderer-isolation and startup-failure assertions.
- [ ] Add EN/RU Ladle fixtures and interaction regressions for no definitions, no projects, loading, editing, saving, validation, save failure, sibling-change notice and successful saved data. Include long authored names/values and screenshots at 1440×960, 1024×720 and 420×800; assert wrapping and usable controls without document overflow.
- [ ] Update capability documentation and Unreleased notes to describe the implemented Text-only scope, ownership, empty-string/null semantics, keyboard controls, migration and actual verification limits. Keep later property types, view features and recovery capabilities explicitly outside this slice.
- [ ] Run the task checkpoint plus PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run check:docs, PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run build, and PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run build:ladle.
- [ ] Run bounded local evidence attempts with separate output directories: PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" node scripts/smoke-discovery-layouts.mjs, PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run smoke:runtime -- dev, PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run package:dev:mac, and PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH" npm run smoke:runtime -- release. Set WORKSPACE_SMOKE_EVIDENCE_DIR under work/ralphex/issue-12 for each smoke mode.
- [ ] Preserve all failed attempts and unchanged 10-second native quit assertions. Record completed pre-quit feature checks separately from shutdown failures and restart scenarios not reached. Do not retry identical failures blindly, relax timeouts, change OS/dependencies or treat forced cleanup as normal shutdown success.
- [ ] Inspect git diff 2856e7aeff972d8f97b5825987e7051a459e1d84, record actual commands/results and remaining gates, and commit verified task changes as test: verify shared Text property workflows. A failed feature assertion requires a fix and justified recheck; known #44 evidence remains a reported external failure.

## Acceptance Mapping

- Create/rename definitions, service-enforced immutable type and validation: Task 1.
- Edit/clear, exact authored text and distinct empty/absent values: Task 2.
- Shared-source ownership, unrelated-source rejection and independent views: Tasks 1–3.
- Durable logical references, retained metadata, migration and unchanged folders: Tasks 1–2 and Task 4 runtime scenarios.
- Production notifications, stale-response protection and recoverable drafts: Tasks 1–3.
- EN/RU, keyboard operation, errors and narrow layouts: every UI task and Task 4.

## Exclusions

No property deletion, hiding or reordering; other property types or options; filtering, grouping, dragging, Board or general view lifecycle; grouped discovery, folder mutations, watchers or reassociation; backups, legacy import, synchronization, AI, remote access or website work. No dependency/OS upgrades, tracker changes, nested Ralphex, push, remote merge or release.

## Post-Completion

- The coordinator reviews this draft before execution and owns delivery, integration, tracker status and external platform gates.
- Outer review phases must reread coordinator-findings.md and use the fixed baseline. Collect all five perspectives: quality/security, implementation, testing, simplification and documentation. Use gpt-6.1-sol high for every reviewer; with three child slots, use batches of three and two and collect all reports before proceeding. Verify findings against actual code, fix confirmed #12 defects and rerun affected checks.
- Observed Windows runtime/package evidence is required and will be arranged by the coordinator through authorized CI. Local macOS results do not establish Windows acceptance.
- Physical macOS27 native Electron shutdown #44 remains unresolved and a final-release blocker, independently of passing feature checks or CI.
- Checked plan tasks do not establish product completion. Report actual evidence, skipped scenarios, remaining limitations and existing commits in Russian; the coordinator decides acceptance.
