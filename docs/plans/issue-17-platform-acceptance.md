# Issue #17: Platform Acceptance Continuation

## Overview

Repair the confirmed immediate-Reveal feedback defect, Windows fixture failures, owned-fixture cleanup and asynchronous file-manager observation. Repair completed-plan links and record fresh local verification without claiming coordinator acceptance. Write the accepted plan to exactly docs/plans/issue-17-platform-acceptance.md. This draft authorizes no execution.

## Context

- Authority: work/ralphex/issue-17/task.md and coordinator-findings.md, especially their final Coordinator acceptance continuation; GitHub #17 and linked Beads workspace-31i.10.

- Preserve completed Tasks 1–7 in docs/plans/completed/issue-17-create-reveal.md, their history and evidence. Do not repeat or replace the original implementation.

- Starting HEAD: d5caea558071cfa757932c3a1c31ad554b70b918. Product checkpoint: e9ce13546b1850004008aa0e95c8da6713a0ae70.

- Fixed implementation/review base for every phase and resume: 4ac402620dd8139bdef9ff03625aae64bf60e132.

- Immediate-Reveal evidence: work/ralphex/issue-17/coordinator-immediate-dev/observations.json and coordinator-immediate-dev.stderr. Grouped native invocation and exact Finder selection passed; UI acknowledgment failed. Acceptance shutdown was unreached; cleanup shutdown passed separately.

- Windows evidence: ci-38042154474-windows-complete.log, ci-38042154474-windows-test-failures.json, ci-38042154474-windows-grouped.json and ci-38042154474-windows-evidence.zip under work/ralphex/issue-17/.

- The 53 Windows failures comprise 2 creation-service, 8 creation-UI, 42 Reveal and 1 production-App failures. Diagnose every recorded failure; do not assume a shared cause proves all repairs.

- Windows development exact-target observation was pending; packaged observation passed. Grouped development normal shutdown and restart passed before final SQLite cleanup failed with EBUSY.

- Existing boundaries: ProjectRevealButton, DiscoveryWorkspace, TextPropertiesTable, typed Workspace service and private backend/main native authorization.

- Existing dependencies only: React, testing-library, real SQLite/filesystem fixtures, Playwright Core and pinned Electron 44.7.0. No schema or dependency change is planned.

## Development Approach

- Testing approach: focused failing public-boundary regressions before repairs. Keep React thin and native authorization in the existing service/desktop boundary.

- Complete tasks sequentially. Every code-changing task adds or updates behavioral tests; npm test, lint and typecheck must pass before the next task.

- Every Node/npm/npx/tsx invocation explicitly begins with PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH. Install the committed resolution with that prefix and npm ci.

- Planning, tasks and all reviewers use gpt-6.1-sol with high reasoning and the original fixed base.

- Preserve logical-ID/source/native authorization, backend generations, selection/removal lifetimes, exact authored valid names and existing interruption/recovery behavior.

- Use coherent English commits with explicit task-path staging. Product documentation remains English; user discussion remains Russian.

- Run UI, runtime, build and package fixtures strictly sequentially. Never build or clean while a graphical fixture consumes dist.

- Preserve every failed, pending, skipped and unreached result. A skipped check is not a pass.

- No coverage quota/tooling, assertion weakening, global upgrades/configuration, unrelated cleanup, CLAUDE.md or automatic finalization.

- No executor push, tracker writes, integration, merge, release, signing, tags or publication.

## Implementation Steps

### Task 1: Repair Windows success fixtures and real-service query routing

Files:

- Modify: tests/project-creation-service.test.mjs

- Modify: tests/project-creation-ui.test.tsx

- Modify: tests/project-reveal.test.mjs

- Modify: tests/renderer-app.test.tsx

- [x] Map all 53 recorded failures to their failing setup/assertion and confirmed cause, including cascades from shared Reveal setup. Retain the original logs.

- [x] Replace Windows-invalid authored basenames in successful real-folder fixtures with platform-valid names containing meaningful authored whitespace/Unicode. Assert exact request, persisted name and filesystem basename without trimming or renaming.

- [x] Preserve POSIX-specific exact-name cases and explicit Windows trailing-space/trailing-dot rejection tests. Do not skip Windows suites or make invalid names valid.

- [x] Route listProjectCreations and getProjectCreation fixture requests through handleQuery. Assert successful list/status responses for accepted operations and a genuine missing-operation response for undelivered requests.

- [x] Retain both-mode EN/RU explicit retry, immutable original payload/ID, pending double-click, one durable project and reopen assertions.

- [x] Run affected suites, then standard task exit checks; commit the verified fixture repairs. Local success does not establish Windows acceptance.

#### Task 1 Windows failure diagnosis

Original evidence is retained unchanged under ignored work/ralphex/issue-17/: ci-38042154474-windows-complete.log, ci-38042154474-windows-test-failures.json and ci-38042154474-windows-evidence.zip. Run 38042154474 tested product SHA 3132bf8011f50428e87318bcc5363c56f6060c69; these historical failures are not results for the continuation. Locations below are from that SHA, before subsequent line shifts.

- C (2 failures): the success request ends in two spaces ("  Authored проект 📝  "); the completed assertion at project-creation-service.test.mjs:678 instead receives rejected under Windows basename rules. Use a valid authored Unicode name with leading whitespace and assert request/receipt/SQLite/directory-entry equality.
- U (8 failures): the retry success request ends in two spaces ("  Retry Текст 📝  "); all eight completion waits fail after explicit retry. In the full log the form is aria-invalid=true. Independently, both list/status fixture callbacks incorrectly call handleCommand, which rejects read-only queries; the former missing-status assertion therefore could pass for the wrong reason. New list/status assertions failed all eight cases locally before routing repair. Keep both modes/languages/delivery cases and immutable same-ID/payload retry, pending prevention, one project and reopen checks.
- R (42 failures): every recorded stack reaches the shared fixture's completed assertion at project-reveal.test.mjs:28 before its scenario callback. The shared request is "  Project  ", rejected for trailing spaces. These are setup cascades, not 42 independently demonstrated Reveal-policy defects. Keep every original scenario, repair the shared success name and assert its persisted/exact directory spelling before entering the scenario.
- A (1 failure): production App reaches the first Reveal feedback wait at renderer-app.test.tsx:3279 with the generic native-error message in the full log. Its name "Authored folder" is already valid. The fixture compares the backend's native canonicalRoot with legacy realpathSync(root) inside a callback whose assertion errors are swallowed as native_error by the service. Align the exact assertion with realpathSync.native and the workspace creation result; collect callback target/validation data and assert outside that catch boundary so future assertion failures are visible. The original swallowed assertion is unavailable in the log; the resolver mismatch is the identified fixture defect, while exact Windows rerun remains a coordinator gate.

POSIX trailing-space/colon/backslash/newline cases and explicit simulated Windows trailing-space/trailing-dot rejections remain. The former success spellings are also exercised explicitly in the POSIX-only real-folder test. No Windows suite or authorization assertion is skipped or relaxed. Local macOS execution and simulated Windows name rules do not establish Windows acceptance.

| Recorded test | Scenario | Original declaration | Diagnosis |
| --- | --- | --- | --- |
| 360 | direct real creation commits one fresh durable ID, exact name and sibling event while preserving metadata | project-creation-service.test.mjs:671:3 | C |
| 362 | grouped real creation commits one fresh durable ID, exact name and sibling event while preserving metadata | project-creation-service.test.mjs:671:3 | C |
| 426 | en: direct explicit retry reconciles undelivered with original payload and one durable project | project-creation-ui.test.tsx:221:3 | U |
| 427 | en: direct explicit retry reconciles completed_response_lost with original payload and one durable project | project-creation-ui.test.tsx:221:3 | U |
| 428 | en: grouped explicit retry reconciles undelivered with original payload and one durable project | project-creation-ui.test.tsx:221:3 | U |
| 429 | en: grouped explicit retry reconciles completed_response_lost with original payload and one durable project | project-creation-ui.test.tsx:221:3 | U |
| 430 | ru: direct explicit retry reconciles undelivered with original payload and one durable project | project-creation-ui.test.tsx:221:3 | U |
| 431 | ru: direct explicit retry reconciles completed_response_lost with original payload and one durable project | project-creation-ui.test.tsx:221:3 | U |
| 432 | ru: grouped explicit retry reconciles undelivered with original payload and one durable project | project-creation-ui.test.tsx:221:3 | U |
| 433 | ru: grouped explicit retry reconciles completed_response_lost with original payload and one durable project | project-creation-ui.test.tsx:221:3 | U |
| 543 | direct Reveal verifies the real folder, allows source siblings, exposes only dispatch acknowledgment and preserves data | project-reveal.test.mjs:47:3 | R |
| 544 | direct Reveal rejects malformed/foreign identities before native dispatch | project-reveal.test.mjs:59:3 | R |
| 545 | direct Reveal reports missing without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 546 | direct Reveal reports replaced without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 547 | direct Reveal reports link without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 548 | direct Reveal reports root_unavailable without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 549 | direct Reveal reports root_replaced without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 550 | direct Reveal reports excluded without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 551 | direct Reveal reports mode_retained without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 552 | direct delayed native dispatch rejects removed/replaced destination and changed parent evidence | project-reveal.test.mjs:101:3 | R |
| 553 | direct post-dispatch evidence checks report a folder changed during the native API call | project-reveal.test.mjs:114:3 | R |
| 554 | direct native errors and unavailable adapters give bounded useful failures without leaking paths | project-reveal.test.mjs:121:3 | R |
| 555 | grouped Reveal verifies the real folder, allows source siblings, exposes only dispatch acknowledgment and preserves data | project-reveal.test.mjs:47:3 | R |
| 556 | grouped Reveal rejects malformed/foreign identities before native dispatch | project-reveal.test.mjs:59:3 | R |
| 557 | grouped Reveal reports missing without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 558 | grouped Reveal reports replaced without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 559 | grouped Reveal reports link without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 560 | grouped Reveal reports root_unavailable without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 561 | grouped Reveal reports root_replaced without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 562 | grouped Reveal reports excluded without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 563 | grouped Reveal reports mode_retained without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 564 | grouped Reveal reports category_unavailable without invoking native integration | project-reveal.test.mjs:71:5 | R |
| 565 | grouped delayed native dispatch rejects removed/replaced destination and changed parent evidence | project-reveal.test.mjs:101:3 | R |
| 566 | grouped post-dispatch evidence checks report a folder changed during the native API call | project-reveal.test.mjs:114:3 | R |
| 567 | grouped native errors and unavailable adapters give bounded useful failures without leaking paths | project-reveal.test.mjs:121:3 | R |
| 568 | direct retained excluded metadata never opens a folder even with unchanged evidence | project-reveal.test.mjs:132:5 | R |
| 569 | direct retained missing metadata never opens a folder even with unchanged evidence | project-reveal.test.mjs:132:5 | R |
| 570 | direct retained unresolved metadata never opens a folder even with unchanged evidence | project-reveal.test.mjs:132:5 | R |
| 571 | direct retained replaced metadata never opens a folder even with unchanged evidence | project-reveal.test.mjs:132:5 | R |
| 572 | direct archive designation and exact full native identity block native dispatch | project-reveal.test.mjs:140:3 | R |
| 573 | direct policy changes and service closure during native completion cannot produce stale success | project-reveal.test.mjs:152:3 | R |
| 574 | direct desktop revalidates delayed root/category/link changes before dispatch | project-reveal.test.mjs:163:3 | R |
| 575 | direct inaccessible selected directories fail before native dispatch (simulated ACL denial) | project-reveal.test.mjs:179:3 | R |
| 576 | grouped retained excluded metadata never opens a folder even with unchanged evidence | project-reveal.test.mjs:132:5 | R |
| 577 | grouped retained missing metadata never opens a folder even with unchanged evidence | project-reveal.test.mjs:132:5 | R |
| 578 | grouped retained unresolved metadata never opens a folder even with unchanged evidence | project-reveal.test.mjs:132:5 | R |
| 579 | grouped retained replaced metadata never opens a folder even with unchanged evidence | project-reveal.test.mjs:132:5 | R |
| 580 | grouped archive designation and exact full native identity block native dispatch | project-reveal.test.mjs:140:3 | R |
| 581 | grouped policy changes and service closure during native completion cannot produce stale success | project-reveal.test.mjs:152:3 | R |
| 582 | grouped desktop revalidates delayed root/category/link changes before dispatch | project-reveal.test.mjs:163:3 | R |
| 583 | grouped inaccessible selected directories fail before native dispatch (simulated ACL denial) | project-reveal.test.mjs:179:3 | R |
| 584 | private desktop targets reject traversal, unsupported depth, links and identity tampering | project-reveal.test.mjs:190:1 | R |
| 670 | EN/RU production App creates in both modes, preserves IDs after service reopen and reports verified Reveal outcomes | renderer-app.test.tsx:3241:1 | A |

#### Task 1 local verification

Verified on macOS with Node 22.21.1 against the Task 1 working changes over 97f9cdb (fixed review base remains 4ac402620dd8139bdef9ff03625aae64bf60e132). Every Node/npm/tsx command explicitly prepended PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH.

- npm ci: stopped after repeated registry HTTP 502 responses; npm ci --offline then passed using the committed lockfile and cached resolution. No dependency or global configuration changes.
- Focused query regression before repair: all 8 retry cases failed because list requests used the command route (task1-query-red.log).
- Initial affected run: 262 passed, 45 failed due to newly added assertions assuming a projects.name column. Corrected to the actual persisted relative_path basename; retained the failed log (task1-affected.log).
- tsx --test tests/project-creation-service.test.mjs tests/project-creation-ui.test.tsx tests/project-reveal.test.mjs tests/renderer-app.test.tsx: 307 passed, 0 failed (task1-affected-repaired.log).
- npm test: build succeeded; 821 passed, 0 failed, 0 skipped (task1-npm-test.log).
- npm run lint: passed (task1-lint-final.log).
- npm run typecheck: initially caught a missing workspaceId argument in the new list assertion; repaired and passed (task1-typecheck.log and task1-typecheck-repaired.log). The final focused retry rerun passed all 8 cases (task1-query-final.log).
- git diff --check: passed. All mentioned logs remain under ignored work/ralphex/issue-17/.

Windows execution, native OS acceptance, cleanup acceptance and coordinator final-SHA checks remain external gates. This task repairs fixtures only and does not resolve the immediate-Reveal product defect assigned to Task 2 or the existing documentation links assigned to Task 4.

### Task 2: Preserve truthful immediate-Reveal acknowledgment

Files:

- Modify: src/renderer/components/ProjectRevealButton.tsx

- Modify as necessary: src/renderer/components/DiscoveryPanel.tsx

- Modify as necessary: src/renderer/components/TextPropertiesTable.tsx

- Modify: tests/project-creation-ui.test.tsx

- Modify: tests/renderer-app.test.tsx

- [ ] Trace the confirmed grouped failure through sourceObserved events, discovery revisions, projection reloads and Reveal response guards.

- [ ] Add EN/RU actual React regressions for immediate creation followed by Reveal in both modes, including a benign active observation arriving while the response is pending. A confirmed dispatched response for the current authorized project must retain the localized acknowledgment.

- [ ] Add delayed-response adversarial cases for selection/removal, backend replacement and actual project/root/category path or identity changes. Preserve useful rejection/uncertainty and prevent stale acknowledgment or duplicate dispatch.

- [ ] Implement the smallest correction that distinguishes benign observation from invalidated request/target lifetimes. Do not blanket-remove guards or alter the public ID-only request.

- [ ] Preserve Text/category drafts, pending controls and keyboard behavior. Run affected real-service/UI and existing Reveal authorization regressions, then standard task exit checks; commit.

### Task 3: Repair native observation and owned-fixture cleanup

Files:

- Modify: scripts/file-manager-evidence.mjs

- Modify: scripts/smoke-project-creation.mjs

- Modify as necessary: scripts/runtime-lifecycle.mjs

- Modify as necessary: scripts/runtime-evidence.mjs

- Modify: tests/runtime-lifecycle.test.mjs

- [ ] Change the permanent graphical scenario to press Reveal as soon as the newly created row is available. Remove preceding Refresh and artificial settling waits; keep production observation active and invoke the real native API exactly once.

- [ ] Bound repeated read-only observation of that same invocation to a ten-second total deadline. Cap each subprocess by the remaining budget; record attempts, elapsed time and final exact-target outcome.

- [ ] Preserve exact parent and selected full-path requirements, safe target-as-data handling and privacy. Title-only matching, API acknowledgment and repeated native Reveal cannot satisfy observation.

- [ ] Add deterministic behavioral regressions for delayed observation success, deadline exhaustion, unavailable observation and unchanged single invocation. Keep simulated outcomes distinct from actual OS evidence.

- [ ] After verified owned-process termination, apply bounded recursive fs.rm retries to the owned disposable fixture only, using maxRetries 5 and retryDelay 100 ms. Preserve the unchanged ten-second normal Electron quit and forced-cleanup failure.

- [ ] Record fixture cleanup separately. Test transient lock recovery, exhausted cleanup, and primary-failure preservation when cleanup also fails. Save cleanup outcomes before throwing; do not report failed cleanup as a pass.

- [ ] Preserve exact matching-window cleanup only. Run affected lifecycle/evidence tests and standard task exit checks; commit.

### Task 4: Repair completed-plan links and current verification guidance

Files:

- Modify: docs/adr/0006-recoverable-project-creation.md

- Modify: docs/plans/completed/issue-17-create-reveal.md

- Modify: docs/development.md

- Modify: docs/verification/issue-17-create-reveal.md

- Modify as necessary: README.md and CHANGELOG.md

- [ ] Correct the ADR link to the completed original plan and the completed plan’s verification-addendum link. Preserve original task checkboxes and historical acceptance claims.

- [ ] Use repository web references for continuation-plan links that must survive Ralphex moving the plan into completed. Verify local relative links against their actual final locations.

- [ ] Update guidance for immediate creation→Reveal, bounded observation and separate cleanup evidence. Describe dispatched as API acknowledgment, distinct from exact Finder/Explorer observation.

- [ ] Append the 53-failure mapping, repair/test evidence and remaining platform gates to the verification report. Preserve all original failures and their SHA/scope.

- [ ] Run the existing check:docs validator, inspect affected anchors and git diff --check, then standard task exit checks; commit the documentation repair. Add no documentation-phrasing tests.

### Task 5: Verify the continuation and prepare coordinator handoff

Files:

- Update evidence/results: docs/verification/issue-17-create-reveal.md

- Update task progress only: docs/plans/issue-17-platform-acceptance.md

- [ ] Run separately with the required PATH prefix: npm test, npm run lint, npm run typecheck, npm run check:docs, npm run build and npm run build:ladle.

- [ ] Run the affected EN/RU creation/Reveal layout checks at 1440×960, 1024×720 and 420×800 with node scripts/smoke-discovery-layouts.mjs --creation.

- [ ] Run local production development verification first: npm run smoke:runtime -- dev, then the focused real native both-mode scenario with --creation --checkpoint=after_evidence. Require immediate Reveal, one native invocation, truthful localized acknowledgment, exact target observation, normal quit, restart persistence and separately successful cleanup.

- [ ] Only after development fixtures terminate, create a fresh unsigned local macOS artifact with CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac. If necessary, use the verified pinned cached Electron ZIP through the existing per-command electronDist override and run check:artifact separately.

- [ ] Run fresh-package full runtime and focused native scenarios using the corresponding --release mode. Retain the harmless --directory-package non-execution check on macOS.

- [ ] Use a distinct ignored WORKSPACE_SMOKE_EVIDENCE_DIR for every graphical invocation. Diagnose failures before any changed rerun; do not blindly replay native failures.

- [ ] Inspect working and full fixed-base diffs, whitespace checks and commit history. Record commands, tested SHA/artifact digest, platform and every actual stage result; commit the verified report with explicit staging.

## Review Protocol

- Collect all five first-review perspectives—quality, implementation, testing, simplification and documentation—before repairs. Batches 3+2 are permitted under thread limits.

- Use gpt-6.1-sol high throughout; reuse or close completed reviewers as necessary.

- Verify findings against code and authority, repair scoped confirmed findings, rerun affected checks and commit.

- Follow-up reviews use only the quality/implementation pair for critical/major findings until clean.

- Any relevant review repair invalidates affected earlier verification; rerun it sequentially and record the tested SHA.

## Post-Completion: Coordinator Gates

- Coordinator independently reruns its immediate-Reveal harness in a new evidence directory.

- Coordinator owns final exact-SHA Windows/macOS CI and native acceptance, including all 53 Windows failures, exact Explorer/Finder observation and successful owned-fixture cleanup.

- Historical grouped-development restart failure remains preserved and explicitly accounted for; a new successful run does not rewrite the old result.

- Coordinator owns tracker completion and verified local integration. No executor action satisfies those gates.

- Physical macOS 27 / Electron 44.7.0 issue #44 remains an independent final-release prerequisite.

- Executor handoff reports verified commits, actual checks and remaining limitations in Russian. No unmet acceptance criterion is checked complete.
