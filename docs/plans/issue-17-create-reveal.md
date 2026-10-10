# Issue #17 / T10: Create project folders and reveal them in the file manager

## Overview

Implement creation of one real project folder in a configured direct source or an existing valid active grouped category. Persist a fresh durable logical project ID, expose interrupted operations for explicit recovery, and open verified project folders through native Finder/Explorer integration.

After this revised draft is accepted, write it to exactly docs/plans/issue-17-create-reveal.md.

Category creation, rename, moves, archive/restore, deletion, new property types, general views, synchronization, AI, remote access, website, legacy import and release remain outside this task.

## Context

- Authority: work/ralphex/issue-17/task.md and coordinator-findings.md; GitHub #17; Beads workspace-31i.10; specification stories 19–22 and 27. Story 21 contributes Reveal only.
- Revision authority: the final DRAFT REVIEW feedback in work/ralphex/issue-17/plan-progress-terminal01.txt. Preserve the accepted scope and seven slices; replace the earlier confinement requirement with a bounded supported adapter and explicit race limitations.
- Checkout: codex/issue-17-create-reveal. Verified HEAD and fixed implementation/review base: 4ac402620dd8139bdef9ff03625aae64bf60e132. Use this base for every phase, resume and review.
- Runtime: src/service/settings.ts opens SQLite, applies actual Drizzle migrations and routes Workspace operations. src/service/workspaces.ts owns source events, discovery, recovery integration and observation.
- Existing identity/history rules: src/service/discovery.ts, project-recovery.ts and external-reconciliation.ts. Native identity contains lossless dev, ino and birthtimeNs; migrations currently end at 0007.
- Production transport: src/contracts/workspaces.ts, desktop-api.ts and service-protocol.ts; src/service/entry.ts; src/desktop/backend-controller.ts, main.ts and preload.ts; src/renderer/workspace-service-client.ts.
- UI: DiscoveryWorkspace in src/renderer/components/DiscoveryPanel.tsx loads projects and tracks discovery/observation revisions. TextPropertiesTable.tsx retains independent Text and category-label drafts.
- Evidence: real temporary SQLite/filesystem service fixtures, production entry/controller/ports/preload/client checks, React interactions, permanent Ladle stories, scripts/smoke-discovery-layouts.mjs and scripts/smoke-runtime.mjs.
- Dependencies: retain the committed lockfile. Use existing Node filesystem APIs for the focused creation adapter and Electron shell.openPath for native opening. No new native addon is planned. Report any consequential native dependency and its necessity before adoption.
- The scoped temporary CONNECT proxy belongs exclusively to coordinator tooling. It introduces no product, dependency, packaging or global-configuration change.

## Development Approach

- Testing approach: TDD for service safety, durable recovery and transport; focused behavioral UI regressions.
- Complete each task and its required automated checks before proceeding. Every task includes new or updated tests; all tests must pass before starting the next task.
- Install the committed resolution with PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm ci.
- Explicitly prepend that PATH on every Node/npm/npx/tsx invocation, including resumed work, focused tests, packaging and graphical commands.
- Standard task exit checks, invoked separately:
- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test
- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run lint
- PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run typecheck
- git diff --check
- npm test rebuilds dist. Run graphical fixtures sequentially and never build or clean while a fixture depends on dist or dist/ladle.
- Commit each completed, verified slice using explicit task-path staging and an English commit message. Preserve unrelated files and processes.
- Product files, documentation, plans and commits use English. UI supports EN/RU; discussion uses Russian.
- No coverage quota/tooling, historical migration edits, database resets, CLAUDE.md, global configuration changes, unrelated cleanup or automatic finalization.
- Executors do not mutate trackers, push, integrate, merge, release, sign, tag or publish. Coordinator responsibilities remain separate.
- Record failed, skipped, unreached and pending graphical/platform checks accurately. An external gate or written harness does not satisfy an acceptance criterion.

## Creation, Recovery and Filesystem Contract

- Accept a workspace ID, operation ID, authored basename, expected discovery mode/revision and category ID where grouped. The renderer submits no destination path, native evidence or logical project ID.
- Creation requires an applied source configuration. Grouped creation requires an existing same-source active category with valid current-mode, path and native evidence. Never create or reactivate a category as a side effect.
- Persist a focused source-owned creation-operation record before mkdir. Reserve one logical project UUID and bind the immutable request to its initiating workspace/source, configuration, verified parent evidence and intended destination.
- Distinguish durable intent, recorded filesystem evidence, completed metadata and recoverable uncertainty. Commit the final project association, operation completion and discovery revision atomically.
- Same-operation retries reconcile the recorded outcome and preserve its reserved UUID. Completed operations return their recorded result without another filesystem effect or revision increment. Altered payloads and unauthorized IDs fail.
- An interrupted mkdir without durable native evidence leaves ownership uncertain. An existing path or empty folder is insufficient proof. Expose uncertainty without silently adopting a replacement; any association requires explicit reviewed recovery and fresh validation.
- Recorded sufficient unchanged evidence permits explicit completion of metadata for the reserved ID. Missing, replaced, linked, inaccessible or conflicting destinations remain visible recovery cases. Queries and startup perform no automatic mutation replay.
- Outstanding operation reservations participate in discovery Apply, reassociation and reconciliation so observer activity cannot enroll the destination under another project ID.
- Preserve historical reservations, mode-inactive metadata, exact Text, definitions/labels, exclusions/archive roles, settings, independent revisions and workspace view IDs. New projects inherit no Text values.
- Choose the smallest supported adapter: Node lstat/realpath/native-evidence checks and exclusive nonrecursive mkdir. Reuse existing identity/containment rules; introduce no general mutation framework or unbounded native addon.
- Revalidate canonical root/category, full native identity, directory kind and absence of links around mkdir and the final metadata transaction. Reject observed swaps and retain a recoverable operation if filesystem effects already occurred.
- These checks do not provide atomic filesystem confinement. A concurrent ancestor move or replacement between validation and a path-based call can redirect an effect or leave the created directory outside its expected locator. Document this unavoidable TOCTOU window and preserve evidence; never claim a filesystem lock or guaranteed rollback.
- Never overwrite existing content or recursively remove folders during failure/recovery. Do not remove a folder after third-party content appears. Tests compare inventories and sentinels and explicitly account for effects of injected external moves.

## Implementation Steps

### Task 1: Define durable creation contracts and persistence

Files:

- Create: src/contracts/project-creation.ts
- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/contracts/service-protocol.ts
- Modify: src/service/db/schema.ts
- Create: src/service/db/migrations/0008_project_creation.sql
- Modify: src/service/db/migrations/meta/_journal.json
- Create: docs/adr/0006-recoverable-project-creation.md
- Create: tests/project-creation-service.test.mjs

- [x] Define exact typed creation, operation-list/status and explicit recovery requests/results, including useful validation, collision, filesystem and uncertain-outcome states.
- [x] Add the source-owned operation journal, immutable request binding, reserved project UUID, stage/evidence constraints and destination reservations. Preserve operation history after workspace removal and source reuse.
- [x] Record the bounded recovery state machine, crash windows, request idempotency and process-interruption versus power-loss durability limits in the ADR.
- [x] Specify the supported Node filesystem adapter, root/category/full-identity/link checks and concurrent ancestor-move TOCTOU limitation. Report any consequential native dependency before adopting it.
- [x] Add populated actual 0000–0007 upgrade, reopen, journal-constraint and migration-failure rollback tests preserving IDs, views, exact values and source configuration.
- [x] Run standard task exit checks and PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run check:docs; commit the verified foundation.

### Task 2: Create one safely validated direct or grouped project

Files:

- Create: src/service/project-creation.ts
- Create: src/service/project-filesystem.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: tests/project-creation-service.test.mjs

- [x] Validate exact payloads, UUIDs, ownership and authored platform basenames. Reject traversal, invalid/reserved names and conflicting aliases without silent trimming or renaming; preserve valid platform-specific names.
- [x] Revalidate applied canonical root/full identity, discovery mode/revision, category ownership/path/full identity/active state, exclusions, archive containment and historical reservations before durable intent and filesystem effects.
- [x] Perform exclusive nonrecursive mkdir through the focused Node adapter. Check canonical parents, full evidence and no links immediately before and after mkdir; persist sufficient destination evidence and recheck around metadata writes/commit. Observed changes prevent successful completion and leave an explicit recoverable outcome when necessary.
- [x] Atomically persist the fresh project association and completed operation, increment discoveryRevision once and publish actual source-sibling fanout after commit. Preserve view IDs and independent property/category-label revisions.
- [x] Add real-fixture tests for both modes, empty roots/categories, unconfigured/no-category states, invalid platform names, case aliases, occupied files/directories, concurrent requests, permission failures, exclusions/archive, stale categories, mode/root changes, foreign IDs and observed root/category/link/ancestor swaps. Verify inventories and sentinels; distinguish simulated platform rules from actual OS behavior and record the residual race limitation.
- [x] Run standard task exit checks; commit the verified creation slice.

Task 2 local evidence (macOS, Node 22.21.1): npm test passed 621 tests with no failures/skips; lint, typecheck, check:docs and git diff --check passed. The focused creation suite passed all 73 tests. Initial network npm ci encountered repeated registry HTTP 502 responses and was stopped; npm ci --offline --no-audit installed the committed resolution successfully without lockfile/global changes. Windows naming/errno simulations do not establish Windows acceptance. ADR 0006 records the demonstrated ancestor-redirection race and the remaining unobserved destination-substitution window. Discovery/recovery integration and coordinator platform gates remain open.

### Task 3: Recover interrupted operations and coordinate discovery

Files:

- Modify: src/service/project-creation.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/discovery.ts
- Modify: src/service/project-recovery.ts
- Modify: src/service/external-reconciliation.ts
- Modify: src/service/source-observer.ts only where necessary
- Modify: tests/project-creation-service.test.mjs
- Modify: tests/source-observer.test.mjs
- Create: tests/project-creation-crash.test.mjs
- Create: tests/fixtures/project-creation-crash-worker.mjs

- [x] Load persisted outstanding reservations before startup observation can enroll their destinations. Expose source-scoped unfinished operations after reopen and source reuse without replaying mutations.
- [x] Implement explicit status/retry and reviewed recovery preserving the reserved UUID. Distinguish sufficient recorded evidence from uncertain ownership; never infer ownership from path/emptiness or silently adopt a replacement.
- [x] Incorporate outstanding path/native reservations into discovery preview/Apply, reassociation and reconciliation. Invalidate affected reviews and preserve event-before-response and observer/request lifetime guards.
- [x] Keep production observation active: Windows root-only native watches with five-second validated grouped polling; macOS root/category watches; startup and explicit Refresh fallbacks.
- [x] Add abrupt child-process crash scenarios that cannot execute in-process cleanup: after durable intent before mkdir, after mkdir before evidence, after evidence before final metadata commit, and after commit before response. Cover lost responses, changed retry payloads, replaced/nonempty/link targets, partial database failure, active observer/Apply/Refresh races, restart, source reuse, sibling visibility and unrelated-source isolation. Assert no duplicate IDs, inherited values, markers or destructive cleanup.
- [x] Run standard task exit checks; commit the verified recovery slice.

Task 3 local evidence (macOS, Node 22.21.1): npm test passed 652 tests with no failures/skips; lint, typecheck, git diff --check and the fixed-base diff whitespace check passed. Real disposable SQLite/filesystem fixtures cover source-scoped read-only status, explicit recovery with the reserved UUID, source reuse, immutable evidence, rollback, review invalidation, event-before-response ordering and pending reservations during observer/Refresh/Apply/reassociation/reconciliation activity. Parent-terminated child processes cover durable intent, mkdir without evidence, evidence before metadata and commit before response in both modes; cleanup markers confirm that child cleanup did not execute. The focused source-observer suite passed 35 tests, including active root/category watches and simulated Windows root-only five-second polling. Simulated Windows scheduling is not Windows acceptance. No automatic mutation replay, destructive cleanup or identity markers were introduced. The bounded adapter TOCTOU and process-interruption durability limits remain as recorded in ADR 0006; production transport/UI/native integration and coordinator platform gates remain open.

### Task 4: Wire trusted native Reveal through the production boundary

Files:

- Create: src/contracts/project-reveal.ts
- Create: src/service/project-reveal.ts
- Create: src/desktop/project-reveal.ts
- Modify: src/contracts/workspaces.ts
- Modify: src/contracts/desktop-api.ts
- Modify: src/contracts/service-protocol.ts
- Modify: src/service/workspaces.ts
- Modify: src/service/settings.ts
- Modify: src/service/entry.ts
- Modify: src/desktop/backend-controller.ts
- Modify: src/desktop/main.ts
- Modify: src/desktop/preload.ts
- Modify: src/renderer/workspace-service-client.ts
- Modify: tests/backend-lifecycle.test.mjs
- Create: tests/project-reveal.test.mjs
- Modify: package.json build scripts only if a separate test bundle is needed

- [x] Route creation/status/recovery and Reveal through the typed client, narrow preload, controller and actual service entry with exact request validation.
- [x] Accept logical workspace/project IDs for Reveal. Backend policy validates ownership, current source/root/category evidence, selected real-folder identity, containment and eligibility; return useful missing/replaced/unavailable/mode-retained failures.
- [x] Add a private backend-to-desktop native request/reply route bound to the current request and backend generation. Keep validated paths/evidence private and expose no arbitrary renderer path, file URL or shell-command API.
- [x] Recheck trusted root/category/destination evidence immediately before native dispatch and after completion where useful. Use Electron shell.openPath for the verified directory and handle its returned error. Distinguish dispatch acknowledgment from observed Finder/Explorer opening; document the remaining path-based invocation race.
- [x] Add service and real entry/controller/ports/preload/client tests for malformed/foreign IDs, delayed dispatch, destination removal/replacement, stale generations, timeouts, native errors and pending-request/listener cleanup. Preserve contextIsolation:true, nodeIntegration:false and sandbox:true.
- [x] Run standard task exit checks; commit the verified transport/native slice.

Task 4 local evidence (macOS, Node 22.21.1): npm test passed 718 tests with no failures/skips; lint, typecheck, check:docs and working/fixed-base diff whitespace checks passed. The focused Reveal/production-boundary suites passed all 96 tests. Compiled service entry/controller/ports/preload/client fixtures exercise creation, source-scoped status and explicit recovery in both modes, private native request/reply and reauthorization, queued policy/destination changes, foreign/malformed envelopes, timeouts, native errors, stale generations and subscription/request cleanup. The existing narrow preload command surface required no additional privileged API. main.ts wires the trusted adapter to Electron shell.openPath; injected openPath results in these automated tests are not actual Finder/Explorer invocation or observed opening. ADR 0006 records dispatch acknowledgment, cancellation limits and the remaining policy/filesystem-to-native path race. UI/graphical evidence and coordinator target-OS gates remain open; issue #44 is unchanged.

### Task 5: Add EN/RU creation, recovery and Reveal interactions

Files:

- Create: src/renderer/components/ProjectCreationPanel.tsx
- Modify: src/renderer/components/DiscoveryPanel.tsx
- Modify: src/renderer/components/TextPropertiesTable.tsx
- Modify: src/renderer/App.tsx
- Modify: src/renderer/localization.ts
- Modify: src/renderer/app.css
- Modify: src/renderer/components/bb-foundation.stories.tsx
- Modify: tests/renderer-app.test.tsx
- Create: tests/project-creation-ui.test.tsx

- [ ] Add authored-name creation controls for configured direct/grouped sources and existing-category selection. Explain empty, unconfigured and no-valid-category states without implicit category creation.
- [ ] Present pending, validation, collision, unavailable, failure, success and recoverable interruption states. Retain the operation ID across uncertain responses, load outstanding operations after reconnect/reopen and require explicit status/retry/recovery.
- [ ] Add per-project Reveal pending/error feedback and useful retained-folder explanations. Do not report successful opening for missing or unvalidated folders.
- [ ] Guard lists/results by workspace/source selection, request/operation lifetime, backend generation, discovery revision and observation version. Preserve Text/category-label drafts and focus during creation and sibling updates; never automatically replay uncertain mutations.
- [ ] Add actual React EN/RU tests for keyboard submission/category selection, Escape/cancel semantics, focus restoration, double-submit prevention, uncertain outcomes, explicit recovery, selection/removal/backend changes and stale/sibling responses. Cancellation must not imply reversal of an accepted filesystem effect.
- [ ] Add permanent EN/RU Ladle fixtures for both modes and relevant states; run standard task exit checks and PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run build:ladle; commit the verified UI slice.

### Task 6: Extend permanent runtime, crash and native evidence

Files:

- Modify: scripts/smoke-runtime.mjs
- Modify: scripts/smoke-discovery-layouts.mjs
- Modify: scripts/runtime-evidence.mjs
- Modify: tests/runtime-lifecycle.test.mjs
- Modify: tests/project-creation-crash.test.mjs
- Modify: .github/workflows/desktop-ci.yml only where necessary to run and preserve new evidence

- [ ] Extend automated layout capture/interactions for creation/recovery/Reveal at 1440×960, 1024×720 and 420×800, including wrapping, keyboard/focus, reachable controls and no document overflow.
- [ ] Extend development and fresh packaged Electron scenarios through production UI/IPC for both modes, active observers, real native Reveal, restart, interruption/recovery, durable IDs, sibling/source isolation and preserved metadata/sentinels.
- [ ] Add separate evidence stages for creation, interruption recovery, native API invocation, observed file-manager outcome, normal shutdown and restart persistence. Add tests preventing failed, skipped or unreached stages from being marked passed.
- [ ] Invoke the real native adapter with disposable folders on the local host and record its actual API result. Keep mocked/simulated evidence separate; record observed file-manager behavior only when established. Prepare the same harness for coordinator target-OS CI without marking Windows acceptance complete.
- [ ] Run standard task exit checks and affected local graphical scenarios sequentially with the explicit Node PATH and distinct ignored evidence directories. Preserve failures; never build/clean while fixtures use dist and clean only owned disposable processes.
- [ ] Preserve the unchanged ten-second normal-quit assertion and forced-cleanup failure. Add no blind unchanged native retry, weakened assertion, app.exit/self-SIGKILL or global upgrade. Commit verified harness changes and record blocked graphical stages as unmet.

### Task 7: Verify acceptance criteria and document the handoff

Files:

- Modify: README.md
- Modify: docs/architecture.md
- Modify: docs/development.md
- Modify: docs/decisions.md
- Modify: docs/adr/0006-recoverable-project-creation.md as implementation establishes the final details
- Modify: CHANGELOG.md
- Create: docs/verification/issue-17-create-reveal.md
- Modify: tests/build-smoke.test.mjs
- Modify: tests/artifact-smoke.test.mjs
- Modify: scripts/check-artifact.mjs only as required

- [ ] Extend build/artifact regressions for migration 0008, its journal entry and the native integration output; verify shipped SQL/journal matches source and required runtime resources are present.
- [ ] Update affected English documentation and Unreleased notes with actual implemented behavior, recovery stages, filesystem/native TOCTOU limits and evidence. Keep version 0.1.0; add bb provenance/notices only if additional code was adapted.
- [ ] Run the full automated checks separately: PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm test; PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run lint; PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run typecheck; PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run check:docs; PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run build; PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run build:ladle.
- [ ] Run affected local layout checks with PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH node scripts/smoke-discovery-layouts.mjs and development checks with PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run smoke:runtime -- dev. Create a fresh unsigned macOS artifact using PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac, then run PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run smoke:runtime -- release. Use separate ignored evidence directories and report each actual outcome without blind retries.
- [ ] Inspect git diff --check, git diff --check 4ac402620dd8139bdef9ff03625aae64bf60e132..HEAD, the complete fixed-base diff including uncommitted task changes, and commit history.
- [ ] Write a criterion-mapped verification report with commands, SHA, platform, real/simulated evidence and passed/failed/unreached/pending results. Stage task files explicitly and commit verified changes. Leave unmet acceptance criteria and external coordinator gates open.

## Ralphex Review Protocol

- Planning, execution and every reviewer use gpt-6.1-sol with high reasoning. Preserve fixed base 4ac402620dd8139bdef9ff03625aae64bf60e132 for every phase/resume.
- First review collects all five perspectives: quality, implementation, testing, simplification and documentation. Batches of three plus two are permitted under thread limits; collect every report before repairs.
- Reviewers inherit the required model/reasoning. Reuse or close completed reviewers as needed.
- Verify findings against actual code and task authority; repair confirmed scoped findings, rerun affected checks and commit.
- Second/follow-up reviews use only the quality/implementation pair for critical/major findings.
- No tracker mutation, unrelated cleanup or automatic finalization.

## Acceptance Mapping

- Direct/grouped placement and durable logical ID: Tasks 1–3; production UI and restart evidence in Tasks 5–6.
- Names, occupied paths, permissions, stale categories and source safety: Task 2; observed swap/crash/recovery regressions in Tasks 3–4. Document residual concurrent ancestor-move TOCTOU explicitly.
- Visible recoverable interruption without duplicate identity: Tasks 1, 3, 5–6.
- Native Reveal and useful missing/unavailable handling: Tasks 4–6.
- UI/service agreement after restart in both discovery modes: Tasks 3, 5–6.
- Migration/package integrity and evidence/documentation consistency: Task 7.
- Actual target-OS acceptance: separate coordinator gates below. Local mocks, simulated paths, written harnesses and macOS results do not establish Windows acceptance.

## Post-Completion: Separate Coordinator Gates

- Coordinator independently verifies the reviewed product SHA against the issue and disposable-fixture probe matrix.
- Coordinator owns exact-SHA macOS/Windows CI pushes, actual native integration/platform acceptance and any necessary observed Finder/Explorer confirmation.
- Coordinator owns verified local fast-forward integration and GitHub/Beads completion updates.
- Physical macOS 27 / Electron 44.7.0 issue #44 remains an independent final-release prerequisite. This task does not resolve or bypass it.
- Report executor implementation/local checks separately from pending coordinator gates. A skipped or unreached check is not a pass.
- Reused unchanged historical evidence must retain its original milestone, SHA and scope.
- Release, signing, tags and publication remain outside this plan. [26-10-10 09:57:47]
