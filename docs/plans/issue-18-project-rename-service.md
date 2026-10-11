# Issue #18: Recoverable project rename service

## Overview

Implement project folder rename through the typed Workspace service, preserving the existing project UUID, exact Text values and source ownership in direct and grouped discovery modes. Add a durable SQLite journal, validated native rename, explicit recovery and production transport/client wiring.

Stop after local verification and preparation of focused real-platform service feedback. Name editing and recovery UI require a subsequent plan after coordinator interpretation of that feedback.

Target plan file: docs/plans/issue-18-project-rename-service.md.

## Context

- Requirements: work/ralphex/issue-18/task.md and GitHub #18 at https://github.com/kornouhovas/workspace/issues/18.
- Tracking: workspace-31i.11; the coordinator owns tracker changes and publication.
- Checkout: codex/issue-18-project-rename.
- Immutable issue base: a5728daa64caab6b90700854ad5e27417fcf683e.
- Last successful review and exact native CI checkpoint: de5de73c2cb178dce7591c8a80412805290dcf8d.
- Established native evidence: work/issue-18/ci-38123519292/verification.json and native/native-adapter.json.
- Settled design: docs/plans/completed/issue-18-project-rename-stage-1.md.
- Architecture and policy: AGENTS.md, docs/development.md, docs/product.md, docs/decisions.md, docs/architecture.md, GLOSSARY.md and ADRs 0004, 0006 and 0007.
- Existing patterns: src/service/project-creation.ts, project-filesystem.ts, workspaces.ts, discovery.ts, external-reconciliation.ts, project-recovery.ts and project-reveal.ts.
- Transport: src/contracts/workspaces.ts, desktop-api.ts and service-protocol.ts; src/service/settings.ts and entry.ts; src/desktop/backend-controller.ts and preload.ts; src/renderer/workspace-service-client.ts.
- Persistence: SQLite/Drizzle, migrations 0000–0008 and retained creation receipts.
- Dependencies: existing committed resolution only. Reuse the implemented private renameNoReplace adapter, separate Node/Electron binaries and fixed loading paths.

## Development Approach

- Testing approach: TDD at public typed service boundaries, with real disposable SQLite databases, directories and native operations.
- Write a meaningful failing behavioral test, confirm its failure, implement the smallest change and verify it before proceeding.
- Every code-changing task includes new or updated tests. Complete each task and pass its affected focused tests, typecheck and diff checks before starting the next task.
- Use node --import tsx --test with the affected test files listed in each task. Refresh affected emitted outputs before testing: npm run build:service-test-lib for bundled service tests; npm run build:backend and npm run build:desktop for changed production routes; node scripts/copy-migrations.mjs for emitted migrations. Use npm run build when a focused build/artifact check requires complete outputs.
- Broaden integration testing when shared-boundary changes or new failures justify it. Record the reason and inputs; do not require npm test at intermediate task gates.
- Run the full suite and integrated local checks once against final stage inputs in Task 7. npm test already performs npm run build; reuse that build for subsequent integrated smoke checks.
- Reuse passing evidence only when the relevant source, dependency, migration, fixture, runtime and emitted inputs are unchanged. Repeat checks when those inputs change or a new failure leaves a concern unresolved.
- Acceptance rests on meaningful behavior, migration, crash, IPC and native checks. No numeric coverage threshold or scoped coverage command is required.
- Use Node 22.21.1. On this macOS checkout, prepend /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin to PATH.
- Commit each completed, verified task with an English message and explicit staged paths.
- Keep rename and recovery filesystem effects outside the workspace lifecycle transaction wrapper. Durable intent must commit before any native mutation.
- Keep React thin and preserve contextIsolation: true, nodeIntegration: false and sandbox: true.
- Do not introduce packages, system installations, global configuration changes or a generic mutation framework.
- Planning approval authorizes saving and committing this plan only. Implementation uses a separate coordinator invocation.
- Executors do not change trackers, coordinator state, push, dispatch CI, merge or publish.

## Service Contract and Safety Rules

- workspace.renameProject accepts exactly type, workspaceId, projectId, operationId, name and expectedRevision. The service resolves source, mode, parent, category, paths and native identity.
- Add workspace.listProjectRenames, workspace.getProjectRename, workspace.previewProjectRenameRecovery and workspace.recoverProjectRename.
- Recovery accepts exactly type, workspaceId, operationId, previewToken and an advertised action.
- Results distinguish completed, unchanged, rejected and recoverable. Use finite problem categories without raw OS messages, SQL, stacks or absolute paths.
- An exact-current-name request is unchanged only after current ownership, revision, policy and actual location validation. It performs no native call and increments no revision.
- Bind an accepted operation immutably to its original request. Completed and unchanged receipts remain replayable without further filesystem effects; changed-payload retries fail.
- Journal stages are intent, staged, destination_recorded, uncertain, completed and failed. Retain the last verified placement and evidence when recording uncertainty.
- Persist the original and requested locators, existing project UUID, source configuration, full root/parent/project identity and optional reserved staging locator before mutation.
- Full identity uses lossless dev, ino and positive birthtimeNs. Historical reused dev/ino evidence remains conservatively conflicting.
- Detect self-aliasing from actual parent entries and full identity. A folded string or operating-system name does not establish ownership.
- Use one no-replace operation when the destination is absent. A target that actually aliases the selected directory requires two same-parent hops through a reserved hidden staging basename. Commit staged evidence before the second hop.
- Completion requires exact requested spelling observed through parent enumeration and unchanged full identity.
- Only the selected project's own current locator receives the self exception. Other projects, categories, history and unfinished creation/rename operations remain reservations.
- Recovery actions are retry_original, finish_staged, complete_destination and keep_original. Each requires fresh, unique matching placement, current same-source authorization and conflict checks.
- keep_original terminates the operation without moving anything only when the original placement is uniquely verified. Previously recorded evidence remains retained.
- Missing, replaced, linked, inaccessible, multiply matched or conflicting evidence stays unresolved. Never adopt another folder.
- No automatic mutation replay, overwrite fallback, marker files, recursive deletion or filesystem rollback.
- Source/ancestor substitution races and process-interruption versus power-loss durability remain explicit limitations.

## Implementation Steps

### Task 1: Define the rename contract and durable journal

Files:

- Create: src/contracts/project-rename.ts
- Create: src/service/db/migrations/0009_project_rename.sql
- Modify: src/service/db/schema.ts
- Modify: src/service/db/migrations/meta/_journal.json
- Create: tests/project-rename-journal.test.mjs
- Modify: tests/settings-service.test.mjs for the migration-count expectation
- Modify: tests/build-smoke.test.mjs
- Modify: tests/artifact-smoke.test.mjs
- Modify: scripts/check-artifact.mjs

Interfaces:

- Define WorkspaceRenameProjectCommand, ProjectRenameRequest, ProjectRenameResult, ProjectRenameList, ProjectRenameRecoveryPreview and ProjectRenameRecoveryAction.
- Export isProjectRenameRequest(value: unknown) with exact-key validation.
- Add schema.projectRenameOperations for source-owned durable operations.

- [ ] Write failing contract tests for all five requests, malformed UUIDs/revisions, unknown actions, extra fields and submitted paths/native evidence; preserve valid authored name text.
- [ ] Implement contract types and migration 0009. Persist immutable request/context, original/requested/staging locators, full identities, last verified placement, problem and terminal result/revision. Keep initiatingWorkspaceId historical without a workspace deletion cascade.
- [ ] Guard legal transitions, evidence consistency, immutable terminal receipts, DELETE/REPLACE history protection, one unfinished operation per project and cross-role exact-path conflicts between unfinished rename rows. Permit aliases inside one operation without weakening conflicts with another.
- [ ] Guard successful completion against the same active source-owned project/category/native identity and committed discovery revision. Represent validated unchanged receipts explicitly, allowing the unchanged revision without filesystem mutation; retain original-placement evidence for safe failed/keep_original termination.
- [ ] Test populated 0000–0008 upgrades, reopen, migration rollback, multiple sequential renames of one project, invalid transitions, changed bindings, duplicate reservations and unchanged Text/creation history.
- [ ] Update build/artifact requirements for migration 0009 and test missing SQL, missing journal entry and modified migration content. Update the existing fresh-database migration-count assertion.
- [ ] Refresh required outputs and run node --import tsx --test tests/project-rename-journal.test.mjs tests/settings-service.test.mjs tests/build-smoke.test.mjs tests/artifact-smoke.test.mjs, npm run typecheck and git diff --check; commit the verified foundation.

### Task 2: Coordinate outstanding renames with existing source consumers

Files:

- Create: src/service/project-rename-reservations.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/discovery.ts
- Modify: src/service/external-reconciliation.ts
- Modify: src/service/project-creation.ts
- Modify: src/service/project-recovery.ts
- Modify: src/service/project-reveal.ts
- Create: tests/project-rename-coordination.test.mjs
- Modify: tests/external-reconciliation-service.test.mjs
- Modify: tests/project-recovery-service.test.mjs
- Modify: tests/project-reveal.test.mjs
- Update affected cases in tests/grouped-discovery-service.test.mjs, tests/discovery-mode-service.test.mjs and tests/project-creation-service.test.mjs as needed

Interfaces:

- Provide a focused SQLite reader for unfinished rename operations and their reserved placements/native evidence.
- Existing consumers combine these reservations with creation reservations without changing creation receipt semantics.

- [ ] Write failing real-database tests that seed unfinished original, staged and destination placements before service startup; assert startup observation, Refresh, discovery and reassociation cannot enroll them under another UUID.
- [ ] Make outstanding renames visible before observer synchronization. Pause source locator reconciliation and conflicting discovery Apply, reassociation, creation/recovery mutations and additional rename execution while an unfinished rename requires resolution. Preserve reads, Text editing and unrelated sources.
- [ ] Bind discovery/reassociation reviews to rename reservation snapshots, invalidate affected reviews on operation changes and check reservations again inside metadata transactions. Do not rewrite stored project placement merely because a staging or destination folder is observed.
- [ ] Extend Reveal authorization and reauthorization to reject an affected unfinished rename and conflicting placements. Preserve successful Reveal for eligible unrelated projects and the existing private native dispatch protocol.
- [ ] Test same-source sibling fanout, reentrant listeners, queued watcher/Refresh activity, independent revisions, final-reference removal and source reuse. Prove completed/failed rename receipts and completed creation receipts do not permanently reserve vacated paths.
- [ ] Refresh affected outputs and run node --import tsx --test tests/project-rename-coordination.test.mjs tests/external-reconciliation-service.test.mjs tests/project-recovery-service.test.mjs tests/project-reveal.test.mjs tests/grouped-discovery-service.test.mjs tests/discovery-mode-service.test.mjs tests/project-creation-service.test.mjs, npm run typecheck and git diff --check. Broaden shared-boundary regression checks if the changes or failures require it; commit.

### Task 3: Implement validated rename and exact-name no-op

Files:

- Create: src/service/project-rename.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: src/service/project-filesystem.ts
- Create: tests/project-rename-service.test.mjs
- Modify: tests/project-creation-service.test.mjs

Interfaces:

- createProjectRenameService exposes renameProject(input: unknown): ServiceResult<ProjectRenameResult>.
- Integration callbacks invalidate source reviews and publish committed source-scoped project changes.
- Use an internal injectable no-replace function returning ProjectRenameFilesystemResult, defaulting to the existing emitted native adapter. Injection does not enter public requests or production configuration.

- [ ] Write failing direct/grouped tests through the public service seam for rename and exact-name no-op, using real directories with sentinel bytes, existing Text values, sibling workspaces and independent views/settings.
- [ ] Validate IDs, current revision/mode, active association, same-source category, full root/parent/project identity, canonical containment, exact source spelling, basename rules, exclusions/archive and all historical/unfinished reservations. Preserve valid authored whitespace and platform names without trimming.
- [ ] Implement immutable retries before stale-revision validation of a new operation. Terminal retries return recorded results; unfinished retries return recoverable status without replay. Reject changed payloads and reject new rename execution while unfinished creation affects the source.
- [ ] Commit intent before native calls. Determine actual self-aliasing; reserve a collision-free hidden same-parent staging path where needed. Revalidate before and after each hop, persist staged evidence before hop two and record destination evidence before final metadata completion.
- [ ] Complete by updating the existing project locator, discovery revision and receipt in one SQLite transaction. Verify exact requested spelling and full identity around final writes. Preserve category ID, exact Text, independent property/category revisions, views, selection and receipt history.
- [ ] Test invalid/colliding names, stale/missing/replaced/link locations, root/category swaps, native unavailability, late occupied destinations, ordinary and mounted case-only behavior. Assert failures preserve other entries and sentinels; uncertain effects retain the last verified placement. Assert one committed project event per successful rename, no revision/event for unchanged or rejected requests, actual sibling membership and unrelated-source isolation.
- [ ] Refresh affected outputs and run node --import tsx --test tests/project-rename-service.test.mjs tests/project-rename-coordination.test.mjs tests/project-creation-service.test.mjs, npm run typecheck and git diff --check; commit.

### Task 4: Implement explicit recovery and prove interruption boundaries

Files:

- Modify: src/service/project-rename.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: tests/project-rename-service.test.mjs
- Create: tests/project-rename-crash.test.mjs
- Create: tests/fixtures/project-rename-crash-worker.mjs

Interfaces:

- listProjectRenames and getProjectRename return authorized durable status without mutation replay.
- previewProjectRenameRecovery returns inspected placements, allowed actions and an opaque service-memory token.
- recoverProjectRename executes only the freshly revalidated advertised action.

- [ ] Write failing tests for all four recovery actions and previews with absent, original, staged, requested, replaced, linked, inaccessible and conflicting placements. Deduplicate actual self-alias observations by full identity and exact parent spelling.
- [ ] Bind tokens to workspace/source/operation, immutable binding, current revision/configuration, reservations and reviewed placement evidence. Invalidate on replacement preview, relevant source changes, workspace removal and service close/restart. Reject foreign, stale, reused or unadvertised actions.
- [ ] Implement retry_original and finish_staged through the same durable/native validation path; complete_destination commits only the uniquely matching requested folder; keep_original records terminal non-mutation resolution only for the uniquely verified original.
- [ ] Inject failures before intent commit, before each native call, after each filesystem effect, during evidence persistence, during final metadata writes and after commit before response. Include failed uncertainty writes; durable prior intent/evidence must remain visible.
- [ ] Add parent-terminated child-process fixtures after committed intent, first staging effect, staged evidence, final effect, destination evidence and final commit. Assert checkpoints were reached and abrupt termination prevented cleanup from masking state.
- [ ] Test restart without replay, immutable original-request retries, changed-payload rejection, recovery through a sibling after initiating-workspace removal, final removal/reuse and repeated recovery. Preserve UUID/Text and prevent extra revision increments or duplicate events.
- [ ] Refresh affected outputs and run node --import tsx --test tests/project-rename-service.test.mjs tests/project-rename-crash.test.mjs tests/project-rename-coordination.test.mjs, npm run typecheck and git diff --check; commit the verified recovery slice.

### Task 5: Wire production transport and typed client methods

Files:

- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/contracts/service-protocol.ts
- Modify: src/service/settings.ts
- Modify: src/service/entry.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify where explicit routing requires it: src/desktop/backend-controller.ts and src/desktop/preload.ts
- Create: tests/project-rename-ipc.test.mjs
- Modify: tests/settings-service.test.mjs
- Modify: tests/backend-lifecycle.test.mjs

Interfaces:

- WorkspaceServiceClient.renameProject accepts the original command fields without type.
- Add listProjectRenames, getProjectRename, previewProjectRenameRecovery and recoverProjectRename methods matching the service contract.

- [ ] Write failing tests through the compiled production entry/controller/preload/client route for all five requests, results and existing source-scoped notifications.
- [ ] Extend request/result unions, desktop overloads, exact malformed-request validation, query classification and service dispatch. Preserve the narrow preload API and keep native evidence, staging paths and module selection private.
- [ ] Implement client methods without Name UI or a mutation queue. Explicit retries resend the caller's original operationId, name and expectedRevision unchanged.
- [ ] Test malformed/path-bearing requests, foreign workspace/project/operation ownership, recovery token ownership and altered-payload retries. Verify committed events precede responses, siblings receive the correct revision and unrelated sources remain isolated.
- [ ] Drop a rename response and replace the backend at pre-intent, unfinished and completed boundaries. Assert reconnect/status/list do not mutate; explicit same-request retry delivers an unsent request or returns the durable result without duplicate effects.
- [ ] Verify a pending old Reveal authorization fails after rename and fresh authorization resolves the completed/recovered location through the existing trusted route.
- [ ] Refresh affected service, backend and desktop outputs and run node --import tsx --test tests/project-rename-ipc.test.mjs tests/settings-service.test.mjs tests/backend-lifecycle.test.mjs tests/project-reveal.test.mjs, npm run typecheck and git diff --check. Broaden transport regressions if shared-boundary changes or new failures justify it; commit.

### Task 6: Prepare focused real-platform service feedback

Files:

- Create: scripts/smoke-project-rename.mjs
- Create: tests/fixtures/project-rename-service-electron.cjs
- Create: tests/project-rename-fixture.test.mjs
- Modify: tests/project-rename-service.test.mjs
- Modify: package.json
- Modify: .github/workflows/desktop-ci.yml

Interfaces:

- npm run smoke:rename:service runs disposable production-service scenarios in an actual development Electron utilityProcess.
- npm run test:rename:early runs focused journal, coordination, service, crash, IPC and fixture checks against already built outputs.
- Optional WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR stores sanitized service evidence separately from existing native/Reveal evidence.

- [ ] Build a fixture using the emitted production backend and real Electron native adapter with temporary SQLite and roots. Cover both modes, exact UUID/Text/category retention, sibling events, fresh Reveal authorization, restart and explicit interrupted-operation recovery.
- [ ] Exercise actual mounted case behavior, exact final spelling and native collision protection. Record whether self-alias staging or a direct rename was exercised; do not treat platform naming simulations as filesystem evidence.
- [ ] Add bounded parent/child deadlines and acknowledgement/cleanup checks using existing fixture conventions. Record required scenarios as passed, failed, skipped or unreached; required missing assertions fail the checkpoint. Preserve evidence before cleanup on failure.
- [ ] Test fixture success, injected failure, timeout, malformed protocol and cleanup reporting. Keep paths, names, native identities and raw errors out of published evidence.
- [ ] Add an independent early service CI matrix for macOS and both existing Windows runner versions, building and running focused checks and service smoke before unrelated UI/native Reveal work. Upload service evidence with always() handling; preserve existing Windows Reveal/shutdown jobs and native artifacts unchanged.
- [ ] Refresh affected outputs and run node --import tsx --test tests/project-rename-fixture.test.mjs tests/project-rename-service.test.mjs, npm run typecheck and git diff --check; commit. Leave the final integrated smoke run to Task 7. CI editing does not authorize executor push or dispatch.

### Task 7: Document the implemented boundary and verify acceptance

Files:

- Modify: docs/architecture.md
- Modify: docs/development.md
- Modify: docs/adr/0007-no-replace-project-renames.md
- Create: docs/verification/issue-18-project-rename-service.md
- Update only if a verification failure requires correction: files and tests owned by preceding tasks

- [ ] Document the implemented contract, journal transitions, no-op receipts, reservations, recovery actions, explicit retry semantics and production transport. Update superseded implementation-status statements without rewriting historical evidence or the creation decision in ADR 0006.
- [ ] Record process-interruption guarantees, unsupported/native-unavailable behavior, source/ancestor substitution races and absence of filesystem/SQLite atomicity or coordinated power-loss durability.
- [ ] Against final stage inputs, run npm test once, npm run lint, npm run typecheck, npm run check:docs and git diff --check. npm test supplies the final clean build and full suite. Run npm run smoke:rename:service against those final outputs. Reuse applicable passing exact-input evidence; repeat affected checks only after relevant changes, new failures or unresolved concerns.
- [ ] Record actual host/runtime, commands, input identity, test totals and sanitized service evidence. Map acceptance to behavior, migration, crash, IPC and native assertions. Distinguish the established native checkpoint from newly observed service results; list unperformed target-platform checks explicitly.
- [ ] Verify documentation links and consistency with code and evidence. After adding verification results, rerun affected documentation/diff checks without repeating unchanged code/runtime checks. Confirm no Name/Ladle/UI implementation, tracker mutation, publication or full Issue #18 completion claim entered the diff. Any code correction requires a meaningful regression test and affected verification.
- [ ] Commit completed verified changes with explicit paths and stop at the service checkpoint.

## Post-Completion: Coordinator-Owned Platform Checkpoint

The coordinator separately reviews the service/transport diff against the immutable issue base and last successful review SHA, then obtains actual CI results at the exact reviewed implementation SHA.

Required service evidence includes direct/grouped rename, mounted case behavior and exact spelling, collision protection, UUID/Text/category retention, restart, interruption recovery, sibling notification isolation and fresh Reveal authorization.

The coordinator interprets macOS and both Windows results.

A skipped, failed or unreached required scenario remains pending; existing native-adapter evidence does not establish service acceptance. Passing evidence can be reused only for its exact relevant inputs.

Name editing, truthful retained Name/error UI, EN/RU keyboard/loading/recovery states, Ladle/layout expansion, broader development/packaged rename runtime acceptance and full issue completion remain outside this plan.

Existing Windows Reveal and shutdown acceptance remain separate gates. No automatic implementation follows plan acceptance.
