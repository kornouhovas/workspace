# Issue 18: Table Name editing and explicit rename recovery

## Overview

Implement Table Name editing and source-scoped rename recovery through the existing WorkspaceServiceClient. Preserve project identity, category, exact Text values, sibling configuration and folder contents. Establish the suspected unfinished-rename projection regression before changing discovery behavior.

Requested plan path: docs/plans/issue-18-project-rename-ui.md.

Planning only. Implementation requires the coordinator to inspect the current exact-SHA CI result and accepted draft. The task snapshot references Actions run 38150033449 at 49fcc6683c3ddbde16debf8b2001ea3408bad31b; the coordinator determines the current applicable result. Do not auto-start execution.

## Context

- Requirements: GitHub issue 18, T11: Rename project folders without losing identity; work/issue-18/ui/task.md.
- Linked execution step: workspace-31i.11. Preserve tracker history; no tracker writes during planning.
- Existing contracts: src/contracts/project-rename.ts and src/renderer/workspace-service-client.ts expose rename, status, unfinished list, recovery preview and recovery commands.
- UI integration: src/renderer/components/DiscoveryPanel.tsx owns committed lists, discovery revisions, observation generations and source lifetimes. TextPropertiesTable.tsx renders active and retained rows.
- Related patterns: ProjectCreationPanel.tsx, ProjectRecoveryPanel.tsx, TextPropertyCell.tsx and ProjectRevealButton.tsx provide typed-client interactions, async guards, keyboard controls and focus restoration.
- Projection investigation: src/service/discovery.ts, src/service/project-rename-reservations.ts and tests/project-rename-service.test.mjs. The service tests import emitted dist/service/settings.mjs.
- Presentation: src/renderer/localization.ts, src/renderer/app.css, src/renderer/components/bb-foundation.stories.tsx and scripts/smoke-discovery-layouts.mjs.
- Runtime acceptance: scripts/smoke-runtime.mjs, scripts/runtime-evidence.mjs, scripts/runtime-lifecycle.mjs, existing rename crash fixtures and native file-manager evidence helpers.
- Accepted boundaries: AGENTS.md, docs/development.md, docs/product.md, docs/decisions.md, docs/architecture.md, docs/reuse.md, GLOSSARY.md and accepted ADR 0007.
- Dependencies: existing committed package resolution and host-native artifacts. No dependency updates, migrations or new native adapter work.
- Exclusions: Board/group dragging, category moves, archive, unrelated shutdown repairs, new bb imports, release, merge, publication and global configuration changes.

## Development Approach

- Testing approach: vertical TDD following Matt Pocock guidance, one failing behavior test and minimal implementation at a time. Separate Matt Pocock Standards and Spec review remains coordinator-owned.
- Agreed seams: public workspace.listProjects with real disposable SQLite/filesystem fixtures; actual React components through WorkspaceServiceClient; actual development and fresh packaged Electron UI.
- Complete each task before starting the next. Code-changing tasks include meaningful new or updated behavioral tests. All affected checks must pass before proceeding.
- Documentation-only work does not require new tests. Reuse valid checks for unchanged inputs; add a regression only for a concrete uncovered behavior.
- Assess behavior, async handling, focus, unknown outcomes, recovery and actual-platform acceptance. No numeric coverage threshold is required.
- Run focused suites and typecheck regularly. Run the integrated full suite against final code, repeating checks only when changed inputs or unresolved failures require it.
- Rebuild relevant emitted service code before establishing the regression and after every source production correction. A passing test against stale dist output is not verification.
- Reuse unchanged native binaries, wrappers and package resolution while their build inputs remain valid.
- Keep React responsible for interaction and presentation. Naming policy, containment, collisions, alias handling and recovery authorization remain in the service. Keep Node, filesystem and SQLite outside the renderer; preserve contextIsolation, disabled nodeIntegration and sandbox.
- Preserve authored names without trimming. Keep committed Name separate from the draft until a confirmed result and current reload establish the actual location.
- Use immutable operation UUIDs. Unknown outcomes require explicit status checking. Reconnect, refresh, cancellation, rerender and list loading never replay mutations.
- Capture commands, revisions, platforms, outcomes and screenshots under ignored work/issue-18/ui. Distinguish injected interruption verification from historical OS causation.
- Preserve unrelated edits. Stage explicit task paths and create verified English commits after completed file-changing tasks.
- Planning does not authorize execution, notifications, push, tracker writes or finalization.

## Implementation Steps

### Task 1: Establish unfinished-rename projection behavior

**Files:**

- Modify: tests/project-rename-service.test.mjs.
- Modify only if reproduced: src/service/discovery.ts.
- Read: src/service/project-rename-reservations.ts and existing journal/crash fixtures.

- [x] Add direct and grouped disposable SQLite/filesystem cases that establish a project and exact Text, then leave an unfinished rename intent before a native effect.
- [x] Rebuild the current service bundle before the initial regression run using ./node_modules/.bin/esbuild src/service/settings.ts --bundle --platform=node --format=esm --external:better-sqlite3 --outfile=dist/service/settings.mjs. Confirm required existing migrations, wrappers and native artifacts match unchanged inputs.
- [x] Assert through public workspace.listProjects that the original UUID and Name remain retained as unresolved rather than policy-excluded; verify exact Text through the public Text query. Record whether the suspected defect reproduces.
- [x] Cover repeated lists, sibling reads, service restart and placement reservations. Assert reads do not replay rename, enroll a duplicate project or authorize conflicting mutations.
- [x] If reproduced, make the smallest interpretation correction while preserving manual/archive exclusions, replacement detection, native evidence and authorization gates. Rebuild dist/service/settings.mjs with the same command after the source correction and before the green run. If not reproduced, record the result and leave production unchanged.
- [x] Run node --import tsx --test tests/project-rename-service.test.mjs tests/project-rename-coordination.test.mjs tests/external-reconciliation-service.test.mjs tests/grouped-discovery-service.test.mjs, then npm run typecheck. Commit the verified regression and any proven correction.

**Task 1 verification:** The suspected defect reproduced in both direct and grouped public `workspace.listProjects` cases after rebuilding the current service: expected `unresolved`, observed `excluded` (2 failing tests). The correction preserves reservation ambiguity while leaving manual/archive exclusions and native replacement checks ahead of it. Ten added cases verify retained UUID/Name/category/exact Text, repeated and sibling reads, Refresh, restart, reserved placements, blocked conflicting commands and recovery gates. The required four-suite command passed all 411 tests with no skips on macOS arm64 / Node 22.21.1; `npm run typecheck`, affected-file ESLint and `git diff --check` passed. Existing native build inputs/binaries, wrappers and migrations were verified unchanged. Evidence: `work/issue-18/ui/task1/{red,green,reservations,policy,focused-final,typecheck,lint}.log`, both service build logs, `build-reuse.json` and `verification.json`. This establishes the injected unfinished-intent projection regression, not historical OS causation or graphical/platform acceptance.

### Task 2: Implement Table Name editing and explicit status resolution

**Files:**

- Create: src/renderer/components/ProjectRenamePanel.tsx.
- Modify: src/renderer/components/TextPropertiesTable.tsx.
- Modify: src/renderer/components/DiscoveryPanel.tsx.
- Modify: src/renderer/localization.ts and src/renderer/app.css.
- Create: tests/project-rename-ui.test.tsx.
- Update relevant integration cases in tests/renderer-app.test.tsx or tests/components.test.tsx.

- [ ] Add an associated EN/RU Name editor opened from an active eligible Table row. Support Enter/submit, Escape/cancel and actual focus restoration to the initiating control or a stable Table fallback.
- [ ] Submit the exact authored name, selected workspace/project, immutable operation UUID and current expected discovery revision through renameProject. Prevent duplicate submission and disable unavailable or stale mutation targets while retaining Text editing on retained rows.
- [ ] Handle completed, unchanged, rejected and recoverable results plus service errors. Keep committed Name separate from the draft; show useful invalid, occupied, stale, unavailable and uncertain messages without implying rollback.
- [ ] Retain submitted operation identity independently of editor visibility. Offer explicit getProjectRename status checking after unknown transport outcomes and block replacement mutations until resolved. Closing the editor dismisses presentation only.
- [ ] Guard response application with workspace/source/project/operation identity, request/backend generation, source lifetime, revision and observation state. Handle confirmed own events arriving before responses, reload newer placement and prevent older receipts from repainting current rows.
- [ ] Add typed-client interaction tests for EN/RU, authored whitespace, exact-name unchanged results, keyboard/focus, double submission, pending dismissal, errors, unknown status, mismatched bindings, sibling events, delayed responses, selection switches, unmount and backend restart. Assert lifecycle changes never issue another rename.
- [ ] Run node --import tsx --test tests/project-rename-ui.test.tsx tests/project-creation-ui.test.tsx tests/project-recovery-ui.test.tsx tests/renderer-app.test.tsx tests/components.test.tsx, then npm run typecheck. Commit the verified editor slice.

### Task 3: Add source-scoped unfinished rename review and recovery

**Files:**

- Modify: src/renderer/components/ProjectRenamePanel.tsx.
- Modify: src/renderer/components/DiscoveryPanel.tsx.
- Modify: src/renderer/localization.ts and src/renderer/app.css.
- Modify: tests/project-rename-ui.test.tsx.
- Update tests/project-recovery-ui.test.tsx where existing reassociation interaction is affected.

- [ ] Load listProjectRenames on initial mount, restart/reconnect and relevant source changes. Guard source/workspace bindings and list generations; preserve unknown-operation status access independently of list results.
- [ ] Show original/requested Names and loading, empty, list error, pending, uncertain and resolved states. Present fresh service placement evidence without exposing staging locators, native identities or arbitrary-folder adoption.
- [ ] Request previewProjectRenameRecovery only for explicit review. Show meaningful original/staged/destination placement states and render only service-advertised retry_original, finish_staged, complete_destination and keep_original actions.
- [ ] Submit recovery only after explicit user action with the fresh preview token. Invalidate previews on relevant observations, revisions, refresh, operation changes, backend restart and selection changes; require another explicit review.
- [ ] Handle recovery uncertainty through the same operation’s status route. Treat keep_original as a resolved retained-original outcome and reload committed projection after confirmed completion without optimistic Name replacement.
- [ ] Add behavioral tests for every advertised action, no-action placements, missing/replaced/linked/unavailable/conflicting evidence, stale tokens, cancelled/delayed reviews, wrong operation/project bindings, sibling authorization, list/status races and focus restoration. Prove no implicit recovery or mutation replay.
- [ ] Run the Task 2 focused UI command and npm run typecheck. Commit the verified recovery slice.

### Task 4: Add EN/RU previews and automated layout acceptance

**Files:**

- Modify: src/renderer/components/bb-foundation.stories.tsx.
- Modify: scripts/smoke-discovery-layouts.mjs.
- Modify: src/renderer/app.css where measured layouts require correction.
- Modify: tests/components.test.tsx and tests/project-rename-ui.test.tsx for concrete interaction regressions.

- [ ] Add production-component Ladle states for direct/grouped editing, pending, saved/unchanged, invalid/collision/stale/unavailable errors, unknown status, unfinished-list loading/empty/error, recovery placements, blocked recovery and stale review in both languages.
- [ ] Extend layout selection and state counts to include rename surfaces. Capture 1440×960, 1024×720 and 420×800 screenshots with long authored Names and messages.
- [ ] Extend automated checks for document overflow, wrapping, reachable controls, associated labels, keyboard operation and actual focus restoration.
- [ ] Add behavioral regression assertions for layout or focus corrections; preserve existing discovery, creation, Text, category and reassociation checks.
- [ ] Run focused component/UI tests, npm run build:ladle and node scripts/smoke-discovery-layouts.mjs with evidence under work/issue-18/ui/layouts. Commit verified presentation changes.

### Task 5: Extend actual development and packaged Electron acceptance

**Files:**

- Modify: scripts/smoke-runtime.mjs.
- Create: scripts/smoke-project-rename-ui.mjs for the coherent graphical rename scenario.
- Modify: scripts/runtime-evidence.mjs.
- Create: tests/project-rename-runtime.test.mjs.
- Modify: tests/runtime-lifecycle.test.mjs.
- Extend tests/fixtures/project-rename-crash-worker.mjs only if existing owned-fixture interruption controls are insufficient.

- [ ] Wire rename acceptance into the existing development and release smoke route using temporary sources and machine-local temporary SQLite. Exercise actual Name submission and recovery controls through production preload/client/service wiring.
- [ ] Verify direct/grouped folder movement, unchanged UUID/category, exact Text and file inventory, sibling visibility, restart persistence and fresh Reveal authorization at the committed location.
- [ ] Exercise invalid and occupied rejection with the real Name retained. Verify case-only behavior from actual mounted-filesystem evidence and exact enumerated spelling; record unsupported outcomes honestly.
- [ ] Seed bounded driver-owned interruption fixtures before/after native effects and metadata completion, then use the real recovery UI. Cover original, destination and staged recovery where applicable, explicit keep_original and unfinished operations surviving restart.
- [ ] Add harness/evidence tests proving failed, skipped or unreached assertions cannot become passed acceptance. Preserve renderer isolation, normal quit, backend exit, file-manager cleanup and verified owned-fixture cleanup. Retain primary failures without timeout increases or masking.
- [ ] Run node --import tsx --test tests/project-rename-runtime.test.mjs tests/runtime-lifecycle.test.mjs. Run the final development build and npm run smoke:runtime -- dev, then create a fresh local macOS artifact with npm run package:dev:mac and run npm run smoke:runtime -- release. Save separate evidence for each artifact and invocation.
- [ ] Commit verified runtime changes. Record actual local results and unresolved external gates without claiming Windows UI acceptance.

### Task 6: Verify acceptance and update documentation

**Files:**

- Modify: README.md, docs/development.md and docs/architecture.md where implemented behavior changes their current descriptions.
- Create: docs/verification/issue-18-project-rename-ui.md.
- Update relevant service/UI/runtime tests only if a concrete uncovered behavior is found.

- [ ] Map every remaining issue criterion to meaningful assertions and saved evidence, including identity/Text preservation, async guards, focus, unknown outcomes, explicit source-scoped recovery and actual-platform acceptance.
- [ ] Reuse valid checks for unchanged inputs. If the acceptance review exposes a concrete behavioral gap, add a focused failing regression, make the bounded correction, rebuild affected emitted inputs and rerun affected checks before documenting completion. Documentation-only changes require no new tests.
- [ ] Run npm test, npm run lint, npm run typecheck, npm run build:ladle, npm run check:docs and git diff --check against final code. npm test performs the integrated build. Reuse completed final-code checks where inputs are unchanged; rerun layouts or runtime acceptance when subsequent changes invalidate their inputs.
- [ ] Document implemented Name/status/recovery behavior, the projection reproduction result, actual local graphical/package checks, commands, evidence revisions and remaining platform limitations. For prose-only trailing commits, identify both the tested code revision and documentation revision.
- [ ] Preserve accepted ADR boundaries and independent issue gates. Update existing repository documentation without creating CLAUDE.md or changing agent instructions.
- [ ] Commit verified documentation and any required final regression additions. Leave task changes reviewable and preserve unrelated work.

## Post-Completion: Coordinator Decisions and External Acceptance

- Coordinator inspects the current exact-SHA Actions result and accepted draft before starting execution.
- Coordinator performs the separate Ralphex/Matt Pocock Standards and Spec review using the recorded issue base and review comparison. This plan does not launch review or authorize push.
- Review saved EN/RU screenshots, including narrow layouts, and retain remaining visual findings.
- Actual Windows development and fresh packaged UI acceptance remains coordinator-owned after an authorized reviewed push. Local skips do not satisfy it.
- Preserve the independent Windows failed-startup quit gate and historical physical macOS issue 44 gate. New rename evidence must not silently close either.
- Do not close Issue 18, finalize trackers, merge or release from local UI evidence alone.
