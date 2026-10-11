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
- Modify: tests/project-creation-service.test.mjs for affected prior-upgrade migration-count expectations
- Modify: tests/build-smoke.test.mjs
- Modify: tests/artifact-smoke.test.mjs
- Modify: scripts/check-artifact.mjs

Interfaces:

- Define WorkspaceRenameProjectCommand, ProjectRenameRequest, ProjectRenameResult, ProjectRenameList, ProjectRenameRecoveryPreview and ProjectRenameRecoveryAction.
- Export isProjectRenameRequest(value: unknown) with exact-key validation.
- Add schema.projectRenameOperations for source-owned durable operations.

- [x] Write failing contract tests for all five requests, malformed UUIDs/revisions, unknown actions, extra fields and submitted paths/native evidence; preserve valid authored name text.
- [x] Implement contract types and migration 0009. Persist immutable request/context, original/requested/staging locators, full identities, last verified placement, problem and terminal result/revision. Keep initiatingWorkspaceId historical without a workspace deletion cascade.
- [x] Guard legal transitions, evidence consistency, immutable terminal receipts, DELETE/REPLACE history protection, one unfinished operation per project and cross-role exact-path conflicts between unfinished rename rows. Permit aliases inside one operation without weakening conflicts with another.
- [x] Guard successful completion against the same active source-owned project/category/native identity and committed discovery revision. Represent validated unchanged receipts explicitly, allowing the unchanged revision without filesystem mutation; retain original-placement evidence for safe failed/keep_original termination.
- [x] Test populated 0000–0008 upgrades, reopen, migration rollback, multiple sequential renames of one project, invalid transitions, changed bindings, duplicate reservations and unchanged Text/creation history.
- [x] Update build/artifact requirements for migration 0009 and test missing SQL, missing journal entry and modified migration content. Update the existing fresh-database migration-count assertion.
- [x] Refresh required outputs and run node --import tsx --test tests/project-rename-journal.test.mjs tests/settings-service.test.mjs tests/build-smoke.test.mjs tests/artifact-smoke.test.mjs, npm run typecheck and git diff --check; commit the verified foundation.

Task 1 verification (local macOS arm64, Node.js 22.21.1):

- Confirmed the initial contract/journal test failed before implementation; artifact requirement tests and the retained-destination/restaging regression also failed before their fixes.
- `npm run build` passed. After the final SQL refinement, `node scripts/copy-migrations.mjs` refreshed emitted migrations; build/artifact tests verified the final journal and SQL against source.
- `node --import tsx --test tests/project-rename-journal.test.mjs tests/settings-service.test.mjs tests/build-smoke.test.mjs tests/artifact-smoke.test.mjs` passed: 71 tests, no failures or skips, including 18 contract/journal tests.
- The shared migration boundary required updating two prior-upgrade count assertions in `tests/project-creation-service.test.mjs`. Its 114 tests passed against the final schema/migration and unchanged service outputs; this evidence remains valid after the final assertion-only journal-test correction.
- `npm run typecheck`, ESLint on the affected TypeScript/JavaScript files, and `git diff --check` passed.
- This establishes the contract and journal foundation only. Rename execution, reservation integration, recovery/IPC and real-platform service acceptance remain in subsequent tasks and coordinator checkpoints.

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

- [x] Write failing real-database tests that seed unfinished original, staged and destination placements before service startup; assert startup observation, Refresh, discovery and reassociation cannot enroll them under another UUID.
- [x] Make outstanding renames visible before observer synchronization. Pause source locator reconciliation and conflicting discovery Apply, reassociation, creation/recovery mutations and additional rename execution while an unfinished rename requires resolution. Preserve reads, Text editing and unrelated sources.
- [x] Bind discovery/reassociation reviews to rename reservation snapshots, invalidate affected reviews on operation changes and check reservations again inside metadata transactions. Do not rewrite stored project placement merely because a staging or destination folder is observed.
- [x] Extend Reveal authorization and reauthorization to reject an affected unfinished rename and conflicting placements. Preserve successful Reveal for eligible unrelated projects and the existing private native dispatch protocol.
- [x] Test same-source sibling fanout, reentrant listeners, queued watcher/Refresh activity, independent revisions, final-reference removal and source reuse. Prove completed/failed rename receipts and completed creation receipts do not permanently reserve vacated paths.
- [x] Refresh affected outputs and run node --import tsx --test tests/project-rename-coordination.test.mjs tests/external-reconciliation-service.test.mjs tests/project-recovery-service.test.mjs tests/project-reveal.test.mjs tests/grouped-discovery-service.test.mjs tests/discovery-mode-service.test.mjs tests/project-creation-service.test.mjs, npm run typecheck and git diff --check. Broaden shared-boundary regression checks if the changes or failures require it; commit.

Task 2 verification (local macOS arm64, Node.js 22.21.1):

- The initial eight real-database coordination tests failed before implementation, including startup locator rewriting and Reveal reauthorization accepting a newly committed rename intent. The final coordination suite contains 21 passing tests across direct/grouped modes.
- `project-rename-reservations.ts` reads unfinished operations directly from SQLite and combines original/requested/staging placements with creation reservations. Full row snapshots detect operation/evidence changes without a discovery revision. Source reconciliation, Apply, reassociation and creation/recovery mutations pause while a rename is unfinished; reads, Text edits, unrelated-source mutations and eligible unrelated Reveal remain available.
- The exported `hasUnfinishedProjectRename` guard supplies the gate for the rename executor introduced in Task 3. This task implements coordination only; it does not introduce a rename command or native rename execution.
- Tests cover pending placements before restart, reservation aliases, transaction-injected intent with rollback, queued watcher/Refresh work, reentrant sibling listeners, independent revisions, final-reference removal/source reuse, terminal rename path release and unchanged completed creation retry receipts. Existing both-mode completed-creation vacated-path regressions also passed.
- The required focused run initially exposed three prior-upgrade tests still expecting nine migrations or omitting the new empty rename table. Updated only those migration expectations and added empty-journal assertions where applicable.
- `npm run build:service-test-lib`, `npm run build:backend` and `npm run build:desktop` passed, refreshing affected emitted inputs.
- `node --import tsx --test tests/project-rename-coordination.test.mjs tests/external-reconciliation-service.test.mjs tests/project-recovery-service.test.mjs tests/project-reveal.test.mjs tests/grouped-discovery-service.test.mjs tests/discovery-mode-service.test.mjs tests/project-creation-service.test.mjs` passed against final inputs: 440 tests, no failures or skips.
- Broadened the shared observer/normalization/creation boundary checks with `node --import tsx --test tests/source-observer.test.mjs tests/settings-service.test.mjs tests/discovery-canonicalization.test.mjs tests/project-creation-crash.test.mjs`: 67 tests passed, no failures or skips.
- `npm run typecheck`, ESLint on all changed TypeScript/JavaScript files, `npm run check:docs` and `git diff --check` passed.
- No Windows host/service acceptance, graphical rename smoke or external CI was performed. Those remain coordinator-owned checkpoints; Tasks 3–7 remain unfinished.

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

- [x] Write failing direct/grouped tests through the public service seam for rename and exact-name no-op, using real directories with sentinel bytes, existing Text values, sibling workspaces and independent views/settings.
- [x] Validate IDs, current revision/mode, active association, same-source category, full root/parent/project identity, canonical containment, exact source spelling, basename rules, exclusions/archive and all historical/unfinished reservations. Preserve valid authored whitespace and platform names without trimming.
- [x] Implement immutable retries before stale-revision validation of a new operation. Terminal retries return recorded results; unfinished retries return recoverable status without replay. Reject changed payloads and reject new rename execution while unfinished creation affects the source.
- [x] Commit intent before native calls. Determine actual self-aliasing; reserve a collision-free hidden same-parent staging path where needed. Revalidate before and after each hop, persist staged evidence before hop two and record destination evidence before final metadata completion.
- [x] Complete by updating the existing project locator, discovery revision and receipt in one SQLite transaction. Verify exact requested spelling and full identity around final writes. Preserve category ID, exact Text, independent property/category revisions, views, selection and receipt history.
- [x] Test invalid/colliding names, stale/missing/replaced/link locations, root/category swaps, native unavailability, late occupied destinations, ordinary and mounted case-only behavior. Assert failures preserve other entries and sentinels; uncertain effects retain the last verified placement. Assert one committed project event per successful rename, no revision/event for unchanged or rejected requests, actual sibling membership and unrelated-source isolation.
- [x] Refresh affected outputs and run node --import tsx --test tests/project-rename-service.test.mjs tests/project-rename-coordination.test.mjs tests/project-creation-service.test.mjs, npm run typecheck and git diff --check; commit.

Task 3 verification (local macOS arm64, Node.js 22.21.1):

- The initial four direct/grouped public-service rename/no-op tests failed because the service method did not exist. An additional untracked-alias no-op regression failed before its fix. The final rename suite contains 115 passing tests.
- `createProjectRenameService.renameProject` is exposed through the Workspace and Settings service objects. Its internal native injection defaults to the fixed emitted no-replace adapter; requests carry no paths, evidence or adapter selection. Production request/IPC/client dispatch remains Task 5.
- Validation covers exact requests, source/project/category ownership, active applied mode/revision, root/parent/project identity and canonical spelling, basename and exclusion/archive policy, historical paths/native evidence and unfinished creation/rename reservations. Exact-name no-op records an immutable unchanged receipt with no native call, revision or project event. Same-operation retries reconcile durable receipts before new-operation revision validation and never replay unfinished effects.
- Rename commits intent separately before native execution, reserves an absent hidden same-parent staging entry for actual self-aliases, persists staged evidence before hop two and records destination evidence before atomic locator/revision/completion writes. Tests preserve UUID, exact Text, category, independent revisions/settings/views/selection and creation/rename receipt history. The existing filesystem validators were reused without changing creation semantics.
- Both direct and grouped cases observed `mountedCaseBehavior=self_alias;hopCount=2` on the actual temporary mount, with exact final spelling and unchanged full identity/sentinel bytes. Ordinary absent-destination renames and the production default Node adapter also passed. Windows naming/access simulations are policy evidence only.
- Failure cases cover malformed/foreign/path-bearing requests, invalid/excluded/colliding and historical names, missing/replaced/linked/wrong-spelling projects, root/category replacement and links, native unavailability/errors, late occupied destinations and hidden staging candidates, second-hop conflicts, evidence persistence and final transaction failure. Uncertain effects retain the last committed placement/evidence; terminal failure and recoverable retries do not replay. Refresh during a native effect does not enroll another UUID; committed listeners see final metadata, actual siblings receive one project event and unrelated sources remain writable.
- `npm run build:service-test-lib` and `npm run build:backend` passed, refreshing the affected emitted inputs. Backend bundling reports esbuild's CJS `import.meta` warning from the existing native wrapper; the CJS wrapper selects its `__dirname` branch.
- `node --import tsx --test tests/project-rename-service.test.mjs tests/project-rename-coordination.test.mjs tests/project-creation-service.test.mjs` passed: 250 tests, no failures or skips. After test-only Windows fixture portability and mounted-case diagnostic refinements, the affected rename suite was rerun: 115 tests passed with no failures or skips; unchanged coordination/creation evidence remains applicable.
- Broadened the shared service-construction/observer boundary with `node --import tsx --test tests/settings-service.test.mjs tests/project-reveal.test.mjs tests/source-observer.test.mjs`: 103 tests passed, no failures or skips.
- `npm run typecheck`, ESLint on all changed TypeScript/JavaScript files, `npm run check:docs` and `git diff --check` passed.
- Explicit rename recovery, abrupt process-interruption fixtures, production rename transport, Electron service smoke and Windows service acceptance were not performed or implemented in this task. Tasks 4–7 and coordinator-owned platform acceptance remain unfinished. No UI, tracker, push, integration or publication changes were made.

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

- [x] Write failing tests for all four recovery actions and previews with absent, original, staged, requested, replaced, linked, inaccessible and conflicting placements. Deduplicate actual self-alias observations by full identity and exact parent spelling.
- [x] Bind tokens to workspace/source/operation, immutable binding, current revision/configuration, reservations and reviewed placement evidence. Invalidate on replacement preview, relevant source changes, workspace removal and service close/restart. Reject foreign, stale, reused or unadvertised actions.
- [x] Implement retry_original and finish_staged through the same durable/native validation path; complete_destination commits only the uniquely matching requested folder; keep_original records terminal non-mutation resolution only for the uniquely verified original.
- [x] Inject failures before intent commit, before each native call, after each filesystem effect, during evidence persistence, during final metadata writes and after commit before response. Include failed uncertainty writes; durable prior intent/evidence must remain visible.
- [x] Add parent-terminated child-process fixtures after committed intent, first staging effect, staged evidence, final effect, destination evidence and final commit. Assert checkpoints were reached and abrupt termination prevented cleanup from masking state.
- [x] Test restart without replay, immutable original-request retries, changed-payload rejection, recovery through a sibling after initiating-workspace removal, final removal/reuse and repeated recovery. Preserve UUID/Text and prevent extra revision increments or duplicate events.
- [x] Refresh affected outputs and run node --import tsx --test tests/project-rename-service.test.mjs tests/project-rename-crash.test.mjs tests/project-rename-coordination.test.mjs, npm run typecheck and git diff --check; commit the verified recovery slice.

Task 4 verification (local macOS arm64, Node.js 22.21.1):

- Four initial direct/grouped public-service tests failed because the recovery methods did not exist. Four additional regressions failed for recovery after a uniquely verified external return from `destination_recorded`; the implementation now enters staged through uncertainty while retaining recorded evidence.
- `listProjectRenames`, `getProjectRename`, `previewProjectRenameRecovery` and `recoverProjectRename` are exposed through the Workspace and Settings service objects. Production request/IPC/client dispatch remains Task 5. Status reads and immutable original-request retries never replay effects.
- Recovery reviews authorize only `retry_original`, `finish_staged`, `complete_destination` or `keep_original` for a uniquely verified original/staged/requested placement. Actual self-alias observations are deduplicated using full identity and exact enumerated spelling. Missing, replaced, linked, inaccessible, conflicting and multiply matching placements remain unresolved; no replacement is adopted. Final evidence/completion and keep-original transactions revalidate unique placement around writes.
- Opaque service-memory tokens bind workspace/source/operation, the full immutable journal snapshot, current revision/configuration, reservations, parent entries and inspected identities. Replacement previews, relevant source changes, workspace removal and close/restart invalidate reviews. Foreign, stale, reused and unadvertised actions are rejected; caller mutation of returned previews cannot alter authorization. Independent Text edits remain available without invalidating an otherwise fresh review.
- Fault tests cover intent commit failure, failures before either native hop and after either effect, staged/destination evidence writes, final metadata rollback, failed uncertainty writes and committed-response interruption. Prior intent/evidence remains durable; repeated explicit recovery preserves UUID, category, exact Text, independent settings/views and receipt history without duplicate revisions or events.
- Parent-terminated child processes reached all six checkpoints in both modes: committed intent, first staging effect, staged evidence, final effect, destination evidence and final commit. Each test observed its checkpoint before SIGKILL and verified cleanup did not execute. Restart/status/list/original retries did not mutate the journal. Sibling recovery and final-reference removal/source reuse retained the original project and historical initiating workspace. All local crash cases observed `staging=mounted_self_alias`; the fixture has an explicitly identified alias-policy seam for case-sensitive hosts, which does not establish mounted-case acceptance there.
- `npm run build:service-test-lib` and `npm run build:backend` passed against final service inputs. Backend bundling retains the existing esbuild CJS `import.meta` warning; the native wrapper uses its `__dirname` branch in CJS.
- `node --import tsx --test tests/project-rename-service.test.mjs tests/project-rename-crash.test.mjs tests/project-rename-coordination.test.mjs` passed: 241 tests, no failures or skips (206 rename-service, 14 process-interruption and 21 coordination tests). After adding two final initiating-workspace-removal regressions, reran the affected rename-service suite: 208 tests passed without failures or skips. Unchanged crash/coordination inputs retain their passing evidence; the verified recovery slice totals 243 tests.
- Broadened checks because Workspace/Settings construction and review invalidation are shared with creation, reassociation, Reveal and observation: `node --import tsx --test tests/settings-service.test.mjs tests/project-creation-service.test.mjs tests/project-creation-crash.test.mjs tests/project-recovery-service.test.mjs tests/project-reveal.test.mjs tests/source-observer.test.mjs` passed: 281 tests, no failures or skips.
- `npm run typecheck`, ESLint on all changed TypeScript/JavaScript files, `npm run check:docs` and `git diff --check` passed.
- No Windows host/service acceptance, production rename transport, graphical/Electron rename service smoke, external CI or coordinated power-loss durability was established. Tasks 5–7 and coordinator-owned platform acceptance remain unfinished. No UI, tracker, push, integration or publication changes were made.

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

- [x] Write failing tests through the compiled production entry/controller/preload/client route for all five requests, results and existing source-scoped notifications.
- [x] Extend request/result unions, desktop overloads, exact malformed-request validation, query classification and service dispatch. Preserve the narrow preload API and keep native evidence, staging paths and module selection private.
- [x] Implement client methods without Name UI or a mutation queue. Explicit retries resend the caller's original operationId, name and expectedRevision unchanged.
- [x] Test malformed/path-bearing requests, foreign workspace/project/operation ownership, recovery token ownership and altered-payload retries. Verify committed events precede responses, siblings receive the correct revision and unrelated sources remain isolated.
- [x] Drop a rename response and replace the backend at pre-intent, unfinished and completed boundaries. Assert reconnect/status/list do not mutate; explicit same-request retry delivers an unsent request or returns the durable result without duplicate effects.
- [x] Verify a pending old Reveal authorization fails after rename and fresh authorization resolves the completed/recovered location through the existing trusted route.
- [x] Refresh affected service, backend and desktop outputs and run node --import tsx --test tests/project-rename-ipc.test.mjs tests/settings-service.test.mjs tests/backend-lifecycle.test.mjs tests/project-reveal.test.mjs, npm run typecheck and git diff --check. Broaden transport regressions if shared-boundary changes or new failures justify it; commit.

Task 5 verification (local macOS arm64, Node.js 22.21.1):

- The initial 17 compiled-route tests failed because the client rename methods did not exist. Two additional Settings/entry dispatch tests failed before routing was implemented. The final IPC suite contains 21 passing tests.
- All five requests now participate in the Workspace request/result unions, desktop overloads, Settings dispatch and production entry query classification/exact validation. The client forwards the caller's original operation ID, authored name and expected revision unchanged, with no mutation queue or automatic retry. Existing generic controller/preload routing required no source changes.
- Disposable real SQLite/filesystem tests traverse the emitted production entry and controller, VM-loaded emitted preload, in-memory compiled production client and cloned message-port/IPC doubles. They cover completed, unchanged, rejected and recoverable results, same-source status/history, exact Text/UUID/category retention, event-before-response ordering for rename and recovery, sibling membership/revisions and unrelated-source isolation. A separate test uses the emitted entry's default service/native adapter without service injection.
- Malformed/extra/path/native/module-bearing payloads, invalid IDs/revisions/actions, foreign workspace/project/operation ownership, altered original-request retries, foreign/unadvertised/reused recovery tokens and tokens retained across backend replacement are rejected without another effect. Public results expose neither absolute fixture paths, hidden staging locators nor native identity/evidence.
- Both modes cover an undelivered pre-intent request and dropped responses at unfinished original, unfinished destination and completed boundaries. Backend replacement, status/list reads and stale-generation replies do not replay or mutate the durable journal. Explicit immutable retries deliver only the undelivered request or return its durable result; explicit recovery completes unfinished operations with one revision/event. These are controlled transport interruptions and service replacement, not new abrupt-process crash evidence.
- Recovery through the production client covers retry_original, complete_destination and keep_original. Actual mounted case aliases in both local modes additionally exercised finish_staged after an interrupted first hop, preserving full identity and exact final spelling while keeping hidden staging private. The test records a distinct-placement branch for case-sensitive hosts rather than assuming aliases from the OS.
- Pending old Reveal reauthorization fails after ordinary rename and after explicit recovery. Fresh Reveal traverses the existing private verification route and trusted desktop filesystem adapter using the completed locator. The final OS file-manager call is a test recorder; no Finder/Explorer selection or graphical runtime acceptance is claimed.
- `npm run build:service-test-lib`, `npm run build:backend` and `npm run build:desktop` passed, refreshing all affected emitted inputs. Backend bundling retains the existing esbuild CJS `import.meta` warning; the fixed native wrapper uses its `__dirname` branch in CJS, also exercised by the default-entry test.
- `node --import tsx --test tests/project-rename-ipc.test.mjs tests/settings-service.test.mjs tests/backend-lifecycle.test.mjs tests/project-reveal.test.mjs` passed against final inputs: 149 tests, no failures or skips. The required backend lifecycle and Reveal suites also verify the shared transport's existing creation, discovery, Text, observation, notification, cancellation and startup behavior.
- `npm run typecheck`, ESLint on all changed TypeScript/JavaScript files, `npm run check:docs` and `git diff --check` passed.
- Tasks 6–7, actual Electron rename service smoke, Windows service acceptance and coordinator-owned external CI remain unfinished. No Name UI, tracker, push, integration or publication changes were made.

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

- [x] Build a fixture using the emitted production backend and real Electron native adapter with temporary SQLite and roots. Cover both modes, exact UUID/Text/category retention, sibling events, fresh Reveal authorization, restart and explicit interrupted-operation recovery.
- [x] Exercise actual mounted case behavior, exact final spelling and native collision protection. Record whether self-alias staging or a direct rename was exercised; do not treat platform naming simulations as filesystem evidence.
- [x] Add bounded parent/child deadlines and acknowledgement/cleanup checks using existing fixture conventions. Record required scenarios as passed, failed, skipped or unreached; required missing assertions fail the checkpoint. Preserve evidence before cleanup on failure.
- [x] Test fixture success, injected failure, timeout, malformed protocol and cleanup reporting. Keep paths, names, native identities and raw errors out of published evidence.
- [x] Add an independent early service CI matrix for macOS and both existing Windows runner versions, building and running focused checks and service smoke before unrelated UI/native Reveal work. Upload service evidence with always() handling; preserve existing Windows Reveal/shutdown jobs and native artifacts unchanged.
- [x] Refresh affected outputs and run node --import tsx --test tests/project-rename-fixture.test.mjs tests/project-rename-service.test.mjs, npm run typecheck and git diff --check; commit. Leave the final integrated smoke run to Task 7. CI editing does not authorize executor push or dispatch.

Task 6 verification (local macOS arm64, Node.js 22.21.1):

- The initial fixture test failed because the supervisor module did not exist. The implementation now starts the emitted production `entry.cjs` in actual Electron utility processes through the emitted BackendController, with the default service/native adapter and disposable real SQLite/root fixtures. No service injection or platform naming simulation supplies mounted-filesystem evidence.
- Both direct and grouped modes passed ordinary rename, actual mounted case handling/exact spelling, occupied service destination rejection, Electron-native late collision protection, unchanged full folder identity/sentinel bytes, UUID/exact Text/category/configuration retention, sibling revision/event isolation, fresh private Reveal authorization, backend restart and explicit interrupted-operation recovery. The local mount exercised `self_alias_staged` in both modes; committed staging identity and exact enumerated final spelling were asserted. The native collision subcase calls the fixed Electron adapter directly after inserting an occupied destination; it does not claim deterministic late-collision injection inside the production service.
- Recovery uses a real SQLite completion-write failure after the production native filesystem effect, then stops/reopens the backend. Restart/status/list/immutable original retry preserve the durable unfinished row without replay; explicit sibling `complete_destination` completes once with one revision/event and fresh Reveal authorization at the recovered location. This is controlled metadata interruption and backend restart, not additional abrupt-process or power-loss evidence. Task 4 retains the separate abrupt-process fixtures.
- The supervisor and fixture enforce bounded startup/request/main/outer/termination deadlines, result acknowledgment and observed process exits before fixture removal. Timeout cleanup targets only active owned utility processes. Missing required assertions and skipped required scenarios fail the checkpoint. Published JSON retains finite scenario/status/mounted-case/runtime/lifecycle outcomes and an input digest, excluding fixture paths, authored names, native identities, PIDs and raw errors. Evidence is saved before cleanup and updated afterward; write failures cannot prevent cleanup or pass the checkpoint.
- Nine fixture controls passed: real success, injected assertion failure, live-utility timeout, malformed protocol, unreached assertion, skipped required assertion, missing acknowledgment, cleanup failure reporting, and persisted sanitized evidence/write-failure cleanup. Negative controls retain separate evidence directories and fail their checkpoint as expected.
- Added `smoke:rename:service` and `test:rename:early`. The independent `project-rename-service-early` CI job builds and runs focused journal/coordination/service/crash/IPC/fixture checks and service smoke on `macos-latest`, `windows-latest` and `windows-2022`, with separate `always()` evidence upload. Parsed the workflow with the installed js-yaml and compared all pre-existing job objects to HEAD: every existing job, including Windows Reveal/shutdown/native-artifact handling, is unchanged. No CI push or dispatch was performed.
- `npm run build:service-test-lib`, `npm run build:backend`, `npm run build:desktop` and `node scripts/copy-migrations.mjs` passed, refreshing affected outputs. The backend retains its existing esbuild CJS `import.meta` warning; the native wrapper uses its fixed `__dirname` branch.
- `node --import tsx --test tests/project-rename-fixture.test.mjs tests/project-rename-service.test.mjs` passed: 219 tests, no failures or skips (9 fixture and 210 service tests). After refining active-child accounting, reran the affected fixture suite: all 9 tests passed; unchanged service/emitted inputs retain their 210-test evidence. The two added default-native direct/grouped service regressions prove completion-write interruption/restart/sibling recovery without filesystem dependency injection.
- Final fixture controls saved ignored evidence under `work/issue-18/task-6-service-controls-final/`; successful `service-checkpoint.json` records Electron 44.7.0 / embedded Node 24.21.0, confirmed shutdown, removed fixtures and input SHA-256 `c9fbd9a840aa56b97c05470e0b91000e1bf1680e6898c09b674fcc4041021b2b`. The digest covers relevant source, dependency resolution, emitted service/controller/native/migration inputs, SQLite binary and fixture/supervisor inputs. Original focused-run output is retained in `work/issue-18-task-6-tests.log`; the final affected fixture rerun is in `work/issue-18-task-6-fixture-final.log`.
- `npm run typecheck`, ESLint on all changed JavaScript/CJS files, `npm run check:docs` and `git diff --check` passed. No production/UI boundary was changed, so unchanged broader service/transport evidence from preceding tasks remains applicable.
- Task 7 owns final integrated checks and the standalone `npm run smoke:rename:service` invocation against its final build. Actual Windows results, coordinator interpretation and external CI remain unperformed. Reveal uses a fixture acknowledgment after real service reauthorization, not Finder/Explorer invocation. Main exits through the fixture handshake using `app.exit`; graphical application normal-quit/#44 acceptance is not established. No Name UI, tracker, integration or publication changes were made.

### Task 7: Document the implemented boundary and verify acceptance

Files:

- Modify: docs/architecture.md
- Modify: docs/development.md
- Modify: docs/adr/0007-no-replace-project-renames.md
- Create: docs/verification/issue-18-project-rename-service.md
- Update only if a verification failure requires correction: files and tests owned by preceding tasks

- [x] Document the implemented contract, journal transitions, no-op receipts, reservations, recovery actions, explicit retry semantics and production transport. Update superseded implementation-status statements without rewriting historical evidence or the creation decision in ADR 0006.
- [x] Record process-interruption guarantees, unsupported/native-unavailable behavior, source/ancestor substitution races and absence of filesystem/SQLite atomicity or coordinated power-loss durability.
- [x] Against final stage inputs, run npm test once, npm run lint, npm run typecheck, npm run check:docs and git diff --check. npm test supplies the final clean build and full suite. Run npm run smoke:rename:service against those final outputs. Reuse applicable passing exact-input evidence; repeat affected checks only after relevant changes, new failures or unresolved concerns.
- [x] Record actual host/runtime, commands, input identity, test totals and sanitized service evidence. Map acceptance to behavior, migration, crash, IPC and native assertions. Distinguish the established native checkpoint from newly observed service results; list unperformed target-platform checks explicitly.
- [x] Verify documentation links and consistency with code and evidence. After adding verification results, rerun affected documentation/diff checks without repeating unchanged code/runtime checks. Confirm no Name/Ladle/UI implementation, tracker mutation, publication or full Issue #18 completion claim entered the diff. Any code correction requires a meaningful regression test and affected verification.
- [x] Commit completed verified changes with explicit paths and stop at the service checkpoint.

Task 7 verification (local macOS 27.0 / arm64, CLI Node.js 22.21.1):

- Updated architecture, development guidance and ADR 0007 to describe the implemented exact contract, migration 0009 transitions, no-op receipts, reservations, four recovery actions, immutable retries, production transport and finite native failure behavior. Retained historical native observations and the unchanged ADR 0006 creation decision; documented source/ancestor substitution and process-interruption versus power-loss limitations.
- Added `docs/verification/issue-18-project-rename-service.md` with acceptance mapping, final implementation input commit `2eb5bd2949ad47c225aa0229dbce303ce11fdd5e`, commands, host/runtime, final service digest, local log/evidence locations and explicit pending coordinator gates. Task 7 changes only these documents and this plan; executable/dependency/fixture inputs remain unchanged.
- Ran `npm test` once against final stage inputs: clean full build passed, then 1472 tests reported 1456 passed, 16 Windows-host-only skips, zero failures/cancellations/todos. No rename journal/service/coordination/crash/IPC/fixture tests were skipped. The existing esbuild CJS import.meta warning remains; the wrapper's fixed __dirname route loaded in the actual Electron service smoke.
- `npm run lint`, `npm run typecheck`, `npm run check:docs` and `git diff --check` passed. After adding evidence and marking Task 7, repeated affected docs/diff checks and checked the added local anchor and documentation-only scope. No code correction or repeat build/full suite/runtime invocation was needed.
- Standalone `npm run smoke:rename:service` passed against the same npm-test outputs: all 16 required direct/grouped scenarios passed with no failures/skips/unreached assertions. Both modes exercised actual mounted `self_alias_staged` behavior and exact final spelling. Electron 44.7.0 / embedded Node 24.21.0 recorded five owned utility exits, acknowledged result/main exit, shutdownConfirmed=true and cleanup=removed, with no protocol error or stderr bytes.
- Final sanitized `work/issue-18/task-7/service/service-checkpoint.json` records input SHA-256 `132168f37929e98cad86712c754dc0a0a383398106f07c18687bf80e0ba9b9a6`. Full-suite/lint/type/docs/smoke logs are retained under ignored `work/issue-18/task-7/`; no generated output or evidence is staged.
- The established native CI checkpoint remains de5de73c2cb178dce7591c8a80412805290dcf8d/run 38123519292, distinct from the new local service result. New Windows/macOS exact-reviewed-SHA service CI, coordinator review/interpretation, actual Finder/Explorer selection, normal graphical quit/#44, Name/recovery UI, EN/RU/Ladle/layout work and broader development/packaged rename acceptance remain outside executable Task sections. No trackers, UI, publication or full Issue #18 completion claim changed.

## Post-Completion: Coordinator-Owned Platform Checkpoint

The coordinator separately reviews the service/transport diff against the immutable issue base and last successful review SHA, then obtains actual CI results at the exact reviewed implementation SHA.

Required service evidence includes direct/grouped rename, mounted case behavior and exact spelling, collision protection, UUID/Text/category retention, restart, interruption recovery, sibling notification isolation and fresh Reveal authorization.

The coordinator interprets macOS and both Windows results.

A skipped, failed or unreached required scenario remains pending; existing native-adapter evidence does not establish service acceptance. Passing evidence can be reused only for its exact relevant inputs.

Name editing, truthful retained Name/error UI, EN/RU keyboard/loading/recovery states, Ladle/layout expansion, broader development/packaged rename runtime acceptance and full issue completion remain outside this plan.

Existing Windows Reveal and shutdown acceptance remain separate gates. No automatic implementation follows plan acceptance.
