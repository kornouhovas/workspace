# Issue #18: No-replace rename adapter — first platform slice

## Overview

Implement and verify the narrow no-replace filesystem adapter required by Issue #18 before expanding the rename journal, service and UI. A rename must reject an occupied destination at the native operation, including an empty directory created after application validation.

The coordinator reviewed the Ralphex draft and bounded this executable plan to the first working native slice. The broader issue design below remains a non-executable outline. Stop after local Node/Electron adapter verification and preparing early Windows feedback; actual Windows acceptance remains pending until observed.

## Context

- Requirements: work/ralphex/issue-18/task.md and work/ralphex/issue-18/github-issue.json; [GitHub #18](https://github.com/kornouhovas/workspace/issues/18) remains authoritative.
- Execution tracking: workspace-31i.11, owned by the coordinator.
- Branch: codex/issue-18-project-rename.
- Fixed issue base: a5728daa64caab6b90700854ad5e27417fcf683e.
- Architecture: synchronous TypeScript service in Electron utilityProcess, SQLite/Drizzle, typed message-port/preload/client boundary.
- Existing patterns: project-creation.ts, project-filesystem.ts, creation migration 0008, discovery reservations, external reconciliation, explicit reassociation and trusted Reveal.
- Relevant decisions: docs/product.md, docs/decisions.md, docs/architecture.md, docs/specs/workspace-0.1.0.md and accepted ADRs 0001–0006.
- Preserve existing creation history and recovery semantics. Rename operates on an existing project identity and requires a separate journal.

## Coordinator decision and implementation boundary

The original no-overwrite contract remains mandatory. Repeated checks followed by Node rename are insufficient: the previous planning experiment observed replacement of an existing empty destination directory on macOS.

The coordinator selected a small repository-owned synchronous Node-API addon exposing only renameNoReplace(fromPath, toPath). This preserves the synchronous service model and avoids introducing a subprocess mutation lifecycle.

- macOS: call renamex_np with RENAME_EXCL. Unsupported filesystems fail closed; there is no ordinary-rename fallback. Apple documents exclusion support as filesystem-dependent. [Apple rename documentation](https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/bsd/man/man2/rename.2)
- Windows: call MoveFileExW with flags zero. Do not enable replacement, copying across volumes or delayed reboot operations. Preserve UTF-16 paths. [Microsoft MoveFileExW documentation](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw)
- Use the C Node-API directly, with NAPI_VERSION=8 and no node-addon-api package. Node-API supplies a stable native interface, but actual Node and Electron loading must be tested. [Node-API documentation](https://nodejs.org/download/release/v22.21.1/docs/api/n-api.html)
- No new npm dependency is proposed. package-lock.json already pins node-gyp 12.4.0 transitively. Invoke that installed local tool explicitly after npm ci; fail if unavailable rather than downloading a different tool.
- Build prerequisites become Python, Xcode Command Line Tools/macOS SDK or Visual Studio C++ Build Tools/Windows SDK, plus version-specific Node/Electron headers and Windows import libraries. Local inspection found clang, the macOS declarations and cached Electron 44.7.0 headers; Windows toolchain availability has not been verified.
- Build separate Node-test and Electron-runtime binaries from the same source, for the current host architecture. Do not assume native module portability or add cross-compilation, universal builds or prebuilt distribution.
- Load only fixed application-owned module paths. Package the runtime binary outside ASAR using a narrow unpack rule. No renderer-provided module path, native API, shell command or filesystem path enters the public rename request.
- Native memory safety and packaging become repository responsibilities. The addon runs with backend privileges; it introduces no elevation, network listener or persistent OS-policy change. Electron has platform-specific native loading requirements. [Electron native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)

This internal adapter implements the already authorized no-overwrite requirement. It adds no npm package, renderer capability, privilege, storage replacement or network boundary. Reuse the locked build tool and installed platform SDKs; record the bounded design in a rename ADR. If implementation needs a new package, an unapproved toolchain installation, broader native API, or a weakened safety guarantee, stop only that dependent part and report the concrete choice. Do not install system tools or change global configuration.

The first executable slice is the adapter and its build/fixture integration. The journal/service/transport outline is deferred until early actual Windows feedback. The user requested starting Issue #18, not publishing its implementation: no push, merge or release is authorized by this plan.

## Development Approach

- Testing approach: TDD, using meaningful red/green tests at the public service boundary with real temporary SQLite and filesystem fixtures.
- Use targeted red/green checks while iterating; run the affected integrated checks once after the native slice is complete.
- Every code-changing task includes new or updated tests.
- Use Node 22.21.1; locally prepend /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin to PATH.
- Keep filesystem mutation outside the existing outer workspace lifecycle transaction. Commit intent before any native call.
- Commit each completed, verified task with an English message, staging only its files.
- Do not change trackers, global settings, product version, release policy or renderer isolation.
- Do not claim atomic filesystem/SQLite updates, automatic rollback or power-loss durability.
- Native no-replace protects the destination at the rename operation. Path validation still has ancestor/source substitution races; repeated evidence checks detect observed changes and retain uncertainty rather than claiming atomic confinement.

## Rename and recovery contract

The public command workspace.renameProject accepts exactly workspaceId, projectId, operationId, name and expectedRevision. Resolve source, mode, current location, parent, category and native evidence inside the service. Accept no client paths or native identities.

Expose workspace.listProjectRenames, workspace.getProjectRename, workspace.previewProjectRenameRecovery and workspace.recoverProjectRename. Recovery submits workspaceId, operationId, previewToken and an advertised action.

Results distinguish completed, unchanged, rejected and recoverable outcomes. An exact-current-name request is unchanged only after current authorization and location validation; it performs no filesystem operation or revision increment.

Persist immutable request binding, existing project UUID, old/requested paths and names, source configuration, root/parent/project identities and an optional reserved staging path. Use intent, staged, destination_recorded, uncertain, completed and failed states. Preserve the last verified placement/evidence when recording uncertainty.

Ordinary renames use one no-replace operation. Determine self-aliasing from actual directory entries and full native identity, never from process.platform or a folded string alone. When a case-only target resolves to the same directory, use two journaled no-replace hops through a reserved hidden same-parent staging basename. Verify the exact requested spelling through parent enumeration before completion. On a case-sensitive mount with an absent target, use the direct operation.

Keep conservative alias/history checks for every other project, category and unfinished operation. The selected project’s own current locator is the only self exception; Unicode folding alone never proves ownership.

Recovery previews inspect old, staging and requested placements without moving anything. Advertise only freshly safe actions:

- retry_original: repeat the rename from the uniquely matching original directory.
- finish_staged: move the uniquely matching staged directory to the absent requested destination.
- complete_destination: commit metadata for the uniquely matching requested directory.
- keep_original: terminate the unfinished operation without mutation when the unique original placement is verified and no other placement contains its identity.

Missing, replaced, linked, inaccessible, multiply matched or conflicting evidence remains unresolved. Recovery never adopts a different folder or overwrites an occupied destination.

## Implementation Steps

### Task 1: Build and verify the no-replace adapter

Files:

- Create: native/project-rename/binding.gyp
- Create: native/project-rename/project_rename.c
- Create: scripts/build-project-rename-native.mjs
- Create: src/service/project-rename-filesystem.ts
- Create: tests/project-rename-native.test.mjs
- Create: tests/fixtures/project-rename-native-electron.cjs
- Modify: package.json, .gitignore, scripts/check-artifact.mjs, .github/workflows/desktop-ci.yml
- Create: docs/adr/0007-no-replace-project-renames.md
- Update: docs/development.md
- Update: tests/build-smoke.test.mjs, tests/artifact-smoke.test.mjs

- [ ] Write failing native tests for nonempty directory rename, empty/nonempty occupied directories, files, links and a destination created immediately before the real native call. Assert both directory identities and sentinel bytes survive rejection.
- [ ] Implement the single synchronous native function and typed wrapper. Validate argument shape/encoding, preserve platform names, release allocations and return bounded error categories without raw paths or exception text.
- [ ] Build with the locked local node-gyp for Node 22.21.1 and Electron 44.7.0. Emit separate test/runtime binaries; integrate compilation after clean and before consuming service builds, including standalone build:service-test-lib.
- [ ] Resolve binaries from trusted emitted-module locations, with no cwd/PATH/environment search. Missing, incompatible or unsupported adapters reject rename without breaking unrelated application startup.
- [ ] Add the narrow runtime ASAR-unpack rule and artifact validation. Test native loading and a disposable rename through Node and an actual Electron utilityProcess fixture; test missing/corrupt module failures.
- [ ] Add the focused real native tests to the existing early Windows verification path after build, preserving current creation/Reveal checks and evidence. Prepare the exact commands and record the actual compiler/native-loading outcomes; editing CI does not authorize pushing or dispatching it.
- [ ] Record the bounded adapter decision, compiler/header prerequisites, unsupported-filesystem failure behavior and residual source/ancestor races in the ADR and development guide. Do not claim that the rename service or Name editor is implemented.
- [ ] Run npm test, npm run lint, npm run typecheck, npm run check:docs and git diff --check on the current host, then commit. Record actual platform results without treating Windows skips as Windows evidence.
- [ ] Stop after this slice. The coordinator obtains early actual Windows feedback before any journal/service/Name UI expansion or full-issue review.

## Deferred outline — not executable in this run

The following is design context for a subsequent reviewed plan after platform feedback. These are not Task sections or completion checkboxes for this invocation.

### Future contract/journal work: Define the rename contract and durable journal

Files:

- Create: src/contracts/project-rename.ts
- Create: src/service/db/migrations/0009_project_rename.sql
- Modify: src/service/db/schema.ts
- Modify: src/service/db/migrations/meta/_journal.json
- Create: tests/project-rename-journal.test.mjs
- Update: tests/build-smoke.test.mjs, tests/artifact-smoke.test.mjs, scripts/check-artifact.mjs

- Write failing contract and real-SQLite migration tests for exact payload validation, populated 0000–0008 upgrades, unchanged project/Text/history data and reopen.
- Define the command/query/result/recovery types and immutable journal binding described above. Keep native evidence private.
- Add migration guards for state/evidence consistency, legal transitions, immutable terminal receipts and historical initiating workspace IDs without a workspace deletion cascade. Protect history against DELETE and SQLite REPLACE.
- Reserve one unfinished operation per project and its old, requested and optional staging paths. Permit self-aliasing within that operation while rejecting other outstanding exact-path conflicts; service checks will cover filesystem aliases and cross-journal conflicts.
- Test invalid transitions, altered bindings, duplicate operations/reservations and completion guards against the existing same-source project association.
- Update migration build/artifact checks, run npm test, npm run typecheck and git diff --check, then commit the verified foundation.

### Future service work: Implement validated rename and source coordination

Files:

- Create: src/service/project-rename.ts
- Create: tests/project-rename-service.test.mjs
- Modify: src/service/workspaces.ts, src/service/settings.ts
- Modify: src/service/discovery.ts, src/service/external-reconciliation.ts
- Modify: src/service/project-creation.ts, src/service/project-recovery.ts, src/service/project-reveal.ts
- Update relevant creation, discovery, reconciliation, recovery and Reveal tests.

- Write failing direct/grouped service tests with sibling and unrelated workspaces, populated exact Text values and real filesystem inventories.
- Validate same-source ownership, active/current-mode association, expected revision, full root/parent/project identity, containment, basename, exclusions, archive policy, occupied destinations and historical/native reservations. Preserve authored names without trimming.
- Commit durable intent, invalidate affected reviews, perform the native operation and verify exact resulting placement. Implement the reserved two-hop self-alias path with persisted staged evidence before its second hop.
- Complete by updating the existing project locator, journal receipt and discovery revision in one SQLite transaction. Preserve category ID, Text rows, property revisions, views, selection and unrelated sources.
- Include outstanding rename paths/native evidence in existing reservation consumers before startup observation. Conservatively pause source locator reconciliation and conflicting discovery Apply/reassociation/creation while rename is outstanding; reject rename while unfinished creation affects that source. Continue reads and Text editing. Release the pause after terminal resolution.
- Publish one committed source-scoped project event after success; invalidate old Reveal authorization and authorize the new actual location. Test reentrant notifications, watcher/Refresh activity, stale previews, source reuse, self-alias exceptions and completed creation receipts after rename.
- Run npm test and npm run typecheck, then commit the working service slice.

### Future recovery work: Prove interruption handling and explicit recovery

Files:

- Modify: src/service/project-rename.ts, src/contracts/project-rename.ts
- Create: tests/project-rename-crash.test.mjs
- Create: tests/fixtures/project-rename-crash-worker.mjs
- Update: tests/project-rename-service.test.mjs

- Add deterministic failures before intent, before each native call, after each filesystem effect, during evidence persistence, during final metadata writes and after commit before response. Assert real filesystem and SQLite outcomes.
- Implement status, list, token-bound preview and explicit recovery actions. Freshly validate current same-source authorization, policy, reservations and exact full identity before every recovery effect or metadata completion.
- Add parent-terminated child fixtures after intent, first staging hop, recorded staging evidence, final rename, destination evidence and completion. Prove abrupt termination prevents cleanup from masking the boundary.
- Test reopen without mutation replay, failed uncertainty writes, same-ID immutable retries, terminal receipt reuse, changed-payload rejection and recovery through a sibling after initiating-workspace removal.
- Verify conflicting/replaced/missing/link cases retain metadata and reservations. Completed receipts release vacated paths without replaying rename or transferring Text; incomplete operations never trigger destructive cleanup.
- Run npm test and npm run typecheck, then commit the recovery slice.

### Future transport work: Wire production transport and client methods

Files:

- Modify: src/contracts/desktop-api.ts, src/contracts/service-protocol.ts
- Modify: src/service/settings.ts, src/service/entry.ts
- Modify: src/renderer/workspace-service-client.ts
- Update: tests/settings-service.test.mjs, tests/backend-lifecycle.test.mjs
- Create: tests/project-rename-ipc.test.mjs

- Add failing request/response/event tests through the production entry/controller/preload/client route.
- Extend typed request/result unions, query classification, exact request validation and service dispatch for rename/status/recovery.
- Add corresponding typed client methods without adding a Name editor or exposing native paths, evidence or addon loading.
- Verify malformed/foreign requests fail, events precede successful responses, siblings receive current revisions and unrelated roots remain isolated. Test lost responses, backend replacement and explicit original-request retry without automatic replay.
- Verify Reveal reauthorization rejects an old target after rename and resolves the actual completed/recovered location through the existing trusted route.
- Run npm test, npm run lint and npm run typecheck, then commit the transport slice.

### Future service platform work: Prepare platform feedback and verify the stage boundary

Files:

- Create: scripts/smoke-project-rename.mjs
- Create: tests/project-rename-fixture.test.mjs
- Modify: package.json, .github/workflows/desktop-ci.yml
- Update: docs/development.md, docs/architecture.md
- Create: docs/verification/issue-18-project-rename-stage-1.md

- Create a fixture using the emitted production service and real native adapter, disposable roots and SQLite. Cover both modes, restart, exact Text/ID retention, self-alias behavior, collision races and recovery. Emit sanitized platform/runtime/revision/outcome evidence and fail on incomplete required assertions.
- Test the fixture’s success, failure and cleanup reporting. Add a focused test:rename:early command and an independent early Windows job that builds and runs rename checks before broader UI/native Reveal work; preserve failure evidence. Editing the workflow does not authorize push or CI dispatch.
- Run npm test, npm run lint, npm run typecheck, npm run build, npm run check:docs and git diff --check. Run node scripts/smoke-project-rename.mjs locally and record the actual result.
- Document implemented service behavior, build prerequisites, recovery actions, remaining races and unperformed platform checks. Keep creation ADR 0006 unchanged; any new rename ADR must record the coordinator’s actual accepted adapter decision.
- Commit verified changes and stop at the platform checkpoint. Do not begin Name UI, packaged rename runtime expansion or full-issue review.


## Post-Completion — coordinator-owned checkpoint

The coordinator inspects the diff and local evidence, then obtains actual Windows results at the exact implementation SHA. Required early evidence for this slice includes native module loading in Node/Electron, collision protection and mounted-filesystem case behavior. Both discovery modes, logical identity/Text retention, restart and interruption recovery remain required in the following service stage.

A missing compiler, native failure, unsupported filesystem, skipped scenario or unreached assertion remains a pending or failed result. Do not substitute a simulation or weaken the safety requirement.

Full Issue #18 remains open for Name editing with truthful retained Name/error behavior, EN/RU keyboard/loading/error/recovery states, Ladle/layout work, broader development/packaged runtime integration and observed macOS/Windows acceptance. Existing Windows Reveal and #44 shutdown gates remain separate.

Trackers, push, CI dispatch, subsequent planning, full review, merge, publication and issue closure remain coordinator responsibilities requiring their corresponding authorization.
