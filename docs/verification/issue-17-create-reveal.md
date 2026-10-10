# T10 / GitHub #17: Project creation and native Reveal verification

## Snapshot and scope

Fixed implementation/review base: 4ac402620dd8139bdef9ff03625aae64bf60e132. Task 7 started from 2804db06ac62c6ff230c17e803592f89fe288a3f (Task 6); the tested working snapshot includes the Task 7 changes committed with this report. Task 7 delivery SHA: d10743f7198a06544613b8bc94220596f62de885. First-review repair SHA: 3132bf8011f50428e87318bcc5363c56f6060c69. Second-review repair SHA: e9ce13546b1850004008aa0e95c8da6713a0ae70. This report does not claim exact-SHA CI acceptance. Platform: local macOS 27.0 (26A428), arm64; Node 22.21.1, pinned Electron 44.7.0, package version 0.1.0. All Node/npm/npx invocations prepend /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin to PATH. No lockfile/version/global configuration, signing, tracker, push/integration or release change.

The source implements configured direct/existing-category grouped creation, durable source-owned operation history, explicit recovery, observer/discovery reservations, production IPC/UI and trusted native Reveal. Creation makes one exclusive empty directory and writes no markers. Project rename/moves, category creation, archive/restore and deletion remain outside scope.

The sections through Limits and separate coordinator gates retain their original milestone results and open-gate status. The appended [platform acceptance continuation](#platform-acceptance-continuation) records subsequent repairs and evidence; neither historical nor continuation local results establish coordinator final acceptance.

## Second review repairs

Both independent second-pass reviewers examined 3132bf8011f50428e87318bcc5363c56f6060c69 against the same fixed base. Implementation review reported no critical/major findings. Quality review found one major reservation defect, independently reproduced through the production service in both modes before repair: interrupt creation of ſ after mkdir, externally rename it to S before evidence recording, then preview/Apply discovery. The filesystem resolves both spellings to the same full native identity, but NFD plus lowercase did not reserve the renamed entry; Apply assigned a second UUID while the original reserved UUID remained outstanding.

Creation, discovery and Reveal now share a conservative decomposed Unicode alias key with uppercase expansion and repeated case conversion, covering long s, final sigma, ligatures and capital sharp s. Alias keys never replace authored names or native evidence. This intentionally reserves equivalent spellings even on case-sensitive volumes, retaining the existing conservative policy rather than claiming exact filesystem collation. The [Unicode case-folding data](https://www.unicode.org/Public/16.0.0/ucd/CaseFolding.txt) documents case expansions that simple lowercasing omits; no third-party implementation or mapping table was copied.

Twenty added real-service regressions cover five alias pairs in both modes, interrupted rename/Apply, preserved reserved UUID/history, explicit same-operation retry, reopen/startup, historical path reservations and unchanged third-party/sentinel bytes. These interruption-specific tests use the filesystem seam; the existing parent-terminated process-crash suite remains distinct. Focused creation/Reveal checks passed all 157 tests without failures/skips. Final npm test passed 821 tests with zero failures/skips (work/issue17-review2-tests.log), including its production build. npm run lint, npm run typecheck, npm run check:docs and working/fixed-base diff whitespace checks passed. A separate repaired version of the original disposable macOS probe confirmed equal full native identity for ſ/S, unresolved discovery entries, no additions/second UUID and the unchanged outstanding reserved UUID in both modes (work/issue17-review2-native-alias.jsonl). No graphical/platform acceptance is inferred from these service checks; coordinator gates, immediate-Reveal feedback, the historical grouped restart investigation and #44 remain open.

## First review repairs

The five independent first-review perspectives (quality, implementation, testing, simplification and documentation) reviewed d10743f against the fixed base above before any repair. Duplicate reports were merged. Four findings were confirmed against full code context: desktop-default Reveal could execute a directory package; status/recovery of another operation could discard an uncertain original request; creation used full native identity where discovery conservatively reserves reused dev/ino; full layout-count documentation still said 120/360 instead of 152/456. Simplification reported no issues. The transient list-versus-observer scan investigation has an existing explicit Refresh mitigation and is not classified as an additional defect or as proof of the historical Finder failure's cause.

Reveal now uses shell.showItemInFolder, preserving logical-ID authorization and pre/post-validation. The void native return supplies no OS success result: dispatched means invocation returned without throwing. The evidence helper verifies the exact disposable parent and selected full-path item; it records no unrelated user paths and closes only matching fixture windows. Native fixtures support a harmless disposable .app with an owned launch marker that must remain absent. Historical openPath evidence below does not verify this repaired adapter.

Uncertain original-request state survives status/recovery of other operations without unlocking its draft or changing its immutable payload/ID. EN/RU regression cases cover both status and successful recovery of another operation, followed by explicit original retry. Both-mode service tests model retained native evidence with equal dev/ino and different birthtime, require recoverable native_conflict, no new project and a blocked recovery preview. Completed receipt/path-release behavior remains covered.

Review validation (same local platform and explicit PATH prefix):

| Command | Outcome | Evidence |
| --- | --- | --- |
| npm test | Passed 801 tests, zero failures/skips; delivery recheck after harness correction and packaging also passed all 801 | work/issue17-review-tests-final.log; work/issue17-review-tests-delivery.log |
| npm run lint; npm run typecheck; npm run check:docs | Passed; lint repeated after harness correction | work/issue17-review-lint-final.log; work/issue17-review-typecheck.log; work/issue17-review-docs-final.log |
| npm run build:ladle | Passed | work/issue17-review-ladle.log |
| node scripts/smoke-discovery-layouts.mjs --creation | Passed 96 EN/RU screenshots and normal shutdown; wide EN grouped and narrow RU uncertain captures visually inspected | work/issue17-review-layouts and .log |
| node scripts/smoke-project-creation.mjs dev --checkpoint=after_evidence --directory-package | First run reached native/Finder/non-execution/normal shutdown but failed restart inventory: the new harness had added Contents and still expected an empty folder | work/issue17-review-dev-package and .log |
| Same dev command after exact-inventory correction | Passed both modes: creation, explicit recovery, real showItemInFolder, localized dispatch acknowledgment, exact selected .app, absent launch marker, preserved inventory/Text/IDs, normal shutdown/backend termination and restart | work/issue17-review-dev-package-inventory and .log |
| CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dir:mac -- --config.electronDist=/Users/aleksandersk/Library/Caches/electron/5a625dfd3df3efc3971556afe64989f9aa6ea0f4cd6e33889c1951789041498f/electron-v44.7.0-darwin-arm64.zip | Passed fresh unsigned package and included source build, using the established pinned local cache | work/issue17-review-package.log |
| npm run check:artifact -- release | Passed | work/issue17-review-artifact.log |
| node scripts/smoke-project-creation.mjs release --checkpoint=after_evidence --directory-package | Passed the same both-mode native/package/recovery/restart assertions on the fresh artifact | work/issue17-review-release-package and .log |

The fresh reviewed app.asar SHA-256 is f747c7f334cfcb1a0394e44e4e9581aa4b4521eb78d7c9e93d8b94df81313d6c (work/issue17-review-artifact.sha256). All graphical runs and packaging were sequential. Successful native runs observed selected items, not the project as the Finder window's current directory. Only matching disposable parent windows were eligible for cleanup. This establishes local .app behavior for the repaired adapter, not Windows acceptance, immediate-after-create acknowledgment, exact-SHA coordinator acceptance or #44 resolution. The historical Task 7 grouped dev failure remains retained and its original cause is not established. Follow-up reviews remain for the external loop.

The initial automated run passed 799 of 801 tests; two old injected adapters still returned an openPath error string. They were updated to exercise synchronous exceptions and rejected promises for the void API; the original error assertions remain intact. No native run was repeated unchanged, no normal-quit assertion was weakened and no historical failure or external acceptance gate was cleared.

## Criteria and evidence

| Issue criterion | Evidence | Result and limits |
| --- | --- | --- |
| Direct root / existing grouped category; durable logical ID | Real SQLite/filesystem creation, production entry/controller/preload/client, EN/RU interactions, restart/source reuse and runtime fixtures | Local automated coverage in both modes; coordinator exact-SHA/platform acceptance remains open |
| Names, occupied paths, permissions, stale categories and escaping destinations | Platform name/alias, real collision/sentinel, POSIX permission, root/category/link/destination/ancestor swap and rollback fixtures | Observed invalid states reject safely; Windows name/errno simulations are not OS acceptance; unobserved ancestor/substitution TOCTOU remains |
| Visible recoverable interruption; no duplicate records on retry | Parent-terminated child at four durable boundaries in both modes, explicit status/review/recovery, observer/Apply/Refresh races; actual React plus real-service lost/undelivered response retry | Process-interruption recovery; no automatic mutation replay or coordinated power-loss durability claim |
| Native Reveal and useful missing/unavailable feedback | Policy/evidence tests and actual production boundary; local Electron shell.openPath / localized acknowledgment / exact-target observation tracked separately | Actual local outcomes below; Windows/native platform gate and immediate-after-create feedback watchpoint remain open |
| UI/service agreement after restart on target OSes | Both-mode real-service/React reopen and local development/fresh unsigned packaged runtime checks | Local outcomes below; coordinator macOS/Windows exact-SHA acceptance remains open |
| Migration and package integrity | Populated actual 0000–0007→0008 upgrade/reopen/rollback; build and ASAR tests compare all shipped SQL/journal, require 0008, private native routing, desktop openPath, SQLite binary, version and license | Local outcomes below; no historical migration edit or reset |

## Confirmed coordinator findings repaired locally

Finding 1: assertReservations now adds path/native reservations only for unfinished operations. Completed immutable request/outcome history and UUID remain unchanged; project/category/current/historical reservations still apply. Both-mode fixtures create Original, attach exact Text and sentinel, move it using Refresh or explicit reassociation, create a fresh project at the vacated path and reopen. The original ID/values/sentinel/views stay with Renamed; the new ID inherits nothing. Retrying the original receipt changes neither files nor revision. Independent coordinator verification remains pending; this executor does not mutate coordinator finding status.

Finding 2: ProjectCreationPanel retains the exact original request through an uncertain transport result. Explicit Retry original request reuses its operation ID, name, category, mode and expected revision. Actual React plus real SQLite/filesystem service tests cover both modes/languages and undelivered versus completed-response-lost cases, pending double-click prevention, cancel/reopen/reconnect without replay and one durable project after reopen. Delayed retry responses after selection/removal/backend changes are ignored. A definite no-effect stale rejection restores the authored editable draft. Status invalid_input for an absent request does not discard uncertainty or force a new ID.

The initial red tests reproduced the vacated-path rejection and absent explicit retry (work/issue17-task7-red.log). Artifact negative tests initially proved the previous checker accepted absent/modified creation SQL/journal (work/issue17-task7-focused-initial.log). Type-check failures while authoring tests were corrected; all final outcomes must be read from the final logs below.

## Task 7 command results

Evidence is under distinct ignored work/issue17-task7-* paths. Commands below use the PATH prefix recorded above; graphical commands also set WORKSPACE_SMOKE_EVIDENCE_DIR to their listed directory. Failed/pending/unreached results are retained separately; a skipped check is never a pass.

| Command | Outcome | Evidence |
| --- | --- | --- |
| npm test | Passed: 795 tests, 0 failures, 0 skips | work/issue17-task7-tests-final.log |
| npm run lint | Passed, zero warnings | work/issue17-task7-lint-final.log |
| npm run typecheck | Passed | work/issue17-task7-typecheck-final.log |
| npm run check:docs | Passed, 70 Markdown files | work/issue17-task7-docs-final.log |
| npm run build | Passed | work/issue17-task7-build.log |
| npm run build:ladle | Passed | work/issue17-task7-ladle-build.log |
| node scripts/smoke-discovery-layouts.mjs --creation | Passed, 96 Electron EN/RU captures, keyboard/focus/wrapping/overflow checks | work/issue17-task7-layouts-sequential and .log |
| npm run smoke:runtime -- dev | Passed, full existing runtime/lifecycle/discovery/recovery matrix, normal quit/backend termination | work/issue17-task7-dev-final and .log |
| CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac | Failed during Electron download: HTTP 502; partial output not accepted | work/issue17-task7-package.log |
| CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dir:mac -- --config.electronDist=/Users/aleksandersk/Library/Caches/electron/5a625dfd3df3efc3971556afe64989f9aa6ea0f4cd6e33889c1951789041498f/electron-v44.7.0-darwin-arm64.zip | Passed; fresh unsigned artifact using existing pinned ZIP, no dependency/global change | work/issue17-task7-package-cached.log |
| npm run check:artifact -- release | Passed: all SQL/journal match source, renderer assets/native output/SQLite/license/version present | work/issue17-task7-artifact.log |
| npm run smoke:runtime -- release | Passed, full runtime/lifecycle/discovery/recovery matrix and normal quit/backend termination on the fresh artifact | work/issue17-task7-release-final and .log |
| npm run smoke:runtime -- dev --creation --checkpoint=after_evidence | Failed overall: direct completed; grouped restart timed out after successful creation/recovery/API/UI/Finder/first shutdown | work/issue17-task7-dev-native-final and .log |
| npm run smoke:runtime -- release --creation --checkpoint=after_evidence | Passed: direct and grouped creation/recovery, actual API/localized UI, exact Finder targets, normal quit/backend termination and restart | work/issue17-task7-release-native-final and .log |
| git diff --check; git diff --check 4ac402620dd8139bdef9ff03625aae64bf60e132..HEAD | Passed; complete fixed-base diff (including Task 7 changes) and seven preceding commits inspected | Working/fixed-base local inspection; required independent reviews remain pending |

Fresh packaged app.asar SHA-256: 72e9c3e040d24d88ed045cd222cf1d9d94567af310254f6600454e7a1789f203 (work/issue17-task7-artifact.sha256). This artifact contains the tested Task 7 product snapshot; report/plan documentation is committed afterward. It is local unsigned development packaging, not a release.

Native-stage details are in dev-creation-observations.json / release-creation-observations.json inside their respective directories. Both final runs observed the exact full disposable Finder targets in both modes (not title-only success), actual shell.openPath returned empty error strings, and both EN/RU dispatched messages were asserted. Exact-target-only window cleanup completed. For dev, direct restart passed; grouped restart did not reach the harness's ready selection condition within 15 seconds. The captured Russian UI showed retained project rows with source_changed feedback. This does not prove data loss or its cause; it does not satisfy grouped native restart acceptance. Failure cleanup normal quit is recorded separately and cannot replace a missing acceptance stage. No guard, normal-quit timeout or assertion was weakened, and this failure was not retried unchanged. Release is a distinct fresh-artifact check, not a retry used to erase the dev failure. Non-selected mode branches in each per-mode evidence object correctly remain unreached; the other run supplies that mode's evidence.

Scheduling caveat: earlier work/issue17-task7-layouts, work/issue17-task7-dev, work/issue17-task7-dev-sequential and work/issue17-task7-dev-native runs overlapped because a yielded session was mistaken for completion. Their logs are preserved and not used as the sequential final-run evidence above. The listed layouts-sequential run itself completed without overlap; dev-final, dev-native-final, packaging, release-final and release-native-final were each confirmed finished before starting the next fixture/build. Earlier successes do not override the final dev failure. There was no Finder/Explorer process termination or unrelated-window cleanup.

The current native checks cover the after_evidence boundary in both modes with real UI/IPC/native calls. The all-four-boundary graphical matrix belongs to Task 6, below; current permanent process-crash tests still exercise all four boundaries in both modes. No actual Windows execution, directory-package native probe, exact-SHA CI, power-loss test, coordinator final acceptance or #44 resolution was performed. These are pending, not skipped passes. Two affected final layout captures (grouped English desktop and uncertain Russian narrow viewport with explicit retry) and the dev failure screenshot were visually inspected.

## Historical milestone evidence

These results belong to their original milestones and do not substitute for Task 7 or exact-SHA acceptance:

- Task 1, 0ea9941: 560 tests and foundation checks; populated upgrade/reopen/rollback.
- Task 2, f436dce5eda0fe40c1c0b92e2f3f93683ceb924a: 621 tests; real creation/races. Offline npm ci installed the committed resolution after registry 502 failures.
- Task 3, 507558416ae7aa1087c530031b2197ade615efe2: 652 tests; abrupt process-crash boundaries and reservation/observer coordination.
- Task 4, 3de5bf9: 718 tests; injected native results and real compiled entry/controller/ports/preload/client. No actual Finder/Explorer proof.
- Task 5, 28c7598bce3d0cbe66b491d47fa9f5cfb406c058: EN/RU UI milestone, with both coordinator findings still open then.
- Task 6, 2804db0: 768 tests, Electron/Chromium 96 captures each, development/packaged eight-case recovery matrices and strict native both-mode runs. Evidence directories and scope are recorded in the plan's Task 6 local evidence. Actual shell.openPath returned empty error strings and localized acknowledgment passed after explicit Refresh; exact Finder observation/cleanup remained pending due to AppleScript timeout. No Windows acceptance or #44 resolution. Packaging succeeded with the pinned cached ZIP after the original 502 failure; historical failure logs remain intact.

## Limits and separate coordinator gates

The bounded Node adapter revalidates canonical root/category/destination and full dev/ino/birthtimeNs evidence around path-based mkdir, evidence writes and metadata commit. Concurrent ancestor moves and substitution before first destination evidence can redirect effects between checks. Repeated checks are not atomic confinement or a filesystem lock; recovery retains effects rather than recursively deleting folders. SQLite and filesystem creation are separate durability domains; parent fsync/coordinated power-loss recovery is not implemented. See [ADR 0006](../adr/0006-recoverable-project-creation.md).

Native reauthorization and pre/post-dispatch checks do not remove the validation-to-openPath race or undo an already invoked OS action. dispatched is API acknowledgment, not observed opening. Finder observation/cleanup filters candidate basenames before exact full-target alias comparison under bounded AppleEvents, avoiding unrelated target resolution. No unrelated window paths are recorded; only proven matching disposable windows may close.

At Task 7, the native directory-package semantics watchpoint remained open. Installed Electron 44.7.0 typings describe openPath as desktop-default opening and showItemInFolder as file-manager display/selection. The product accepts real directory packages; ordinary-directory results in this report do not prove that Reveal avoids launching a package or its associated editor. No disposable-package execution probe or integration repair was performed in this iteration. The first-review repairs above replace that adapter; these earlier results remain historical evidence and cannot establish acceptance of the repaired native route.

The immediate-after-create Reveal feedback watchpoint is unresolved: existing UI guards can report uncertainty when a newer source/discovery observation arrives during dispatch. Strict native fixtures explicitly Refresh and await the committed load with observation active. Their success cannot establish immediate-Reveal feedback behavior; no guard/assertion was weakened to hide it.

The required Ralphex five-perspective first review and quality/implementation follow-ups remain separate pending phases. Coordinator owns independent final product verification (including both repair probes), exact-SHA macOS/Windows CI/native acceptance, any required observed Explorer/Finder confirmation, tracker completion and local integration. Issue #44 on physical macOS 27/Electron 44.7.0 remains an independent final-release prerequisite. Normal quit retains its ten-second assertion; forced cleanup is failure. No unmet issue criterion or external gate is marked accepted here.

## Platform acceptance continuation

This addendum records completed continuation Tasks 1–3 and the documentation-only Task 4 over f2aabfd1cc0ae5cd8e13b7ab3019bf04dbbf3a3f. The fixed implementation/review base remains 4ac402620dd8139bdef9ff03625aae64bf60e132. The [accepted continuation plan](https://github.com/kornouhovas/workspace/blob/97f9cdbfb56302b5ec6f401994c02c6bfd20b43e/docs/plans/issue-17-platform-acceptance.md) is pinned to its original accepted commit so its reference survives the eventual completed-plan move. Progress and outcomes below refer to subsequent commits, not that original unchecked plan snapshot.

| Task | Verified change commit | Scope |
| --- | --- | --- |
| 1 | 2d6b562e8f0aa9372f65100cbccb4951dd4864d9 | Windows-valid success fixtures, exact authored names and genuine list/status query routing |
| 2 | dc3103854fa9921b43cf27be600c7e359b0fcfaf | Immediate-Reveal acknowledgment across benign observation, retaining target/request guards |
| 3 | f2aabfd1cc0ae5cd8e13b7ab3019bf04dbbf3a3f | Immediate graphical scenario, bounded exact-target observation and separate owned-fixture cleanup |

All reused task results below were obtained on local macOS arm64 with Node 22.21.1 and pinned Electron 44.7.0. The working changes were tested before each listed commit; report/plan edits accompanied those commits. Every Node/npm/npx/tsx command explicitly prepended PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH. Evidence paths below are under ignored work/ralphex/issue-17/ unless otherwise stated. This documentation task does not rerun or reclassify their tests as fresh Task 4 execution.

### Historical Windows failures and complete mapping

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


A second historical run, 38042598935 at e9ce13546b1850004008aa0e95c8da6713a0ae70, reported 820 tests: 761 passed, the same 53-fixture failure family failed and 6 skipped (ci-38042598935-windows-complete.log). Its other native/runtime stages passed, including cleanup on that run. That unchanged success does not explain or clear run 38042154474's EBUSY cleanup failure. Neither historical run tests the continuation repairs.

### Repair behavior and regressions

Task 1 keeps exact authored whitespace/Unicode in platform-valid successful names and checks request, receipt, persisted relative-path basename and directory-entry equality. POSIX trailing-space/colon/backslash/newline cases and explicit Windows trailing-space/trailing-dot rejection remain. All 42 Reveal scenarios still run after the repaired shared setup; no Windows suite is skipped. Retry list/status callbacks now use handleQuery, verify successful reads for accepted operations and a real missing-operation response for undelivered requests. Both modes/languages retain immutable original payload/ID, pending double-click, one durable project and reopen checks. The production-App callback collects native validation data for assertions outside the service's native-error catch and compares native canonical paths.

Task 2's failing production-App regression established the broad observation guard: ready/active sourceObserved events advance observationVersion even when discoveryRevision and the authorized target are unchanged. Reveal now uses sourceLifetime for locator/unsafe availability transitions, the existing discovery-revision guard, and a monotonic row-target version derived from public project/category locators and retained state. A target change away and back still invalidates the older request. Backend/selection/unmount guards, exact response IDs, ID-only requests and backend/main pre/post-native authorization remain. Only Reveal feedback resets for target changes; editors retain drafts and pending requests cannot dispatch twice.

EN/RU actual React plus real SQLite/filesystem regressions create and immediately Reveal in both modes, delay the native response, inject a benign active observation with a verified projection reload, and require one invocation, localized dispatched acknowledgment and durable-ID reopening. Adversarial cases reject selection/removal, backend unavailable-to-ready transitions, changed source/project/category paths, retained state, revisions and foreign IDs. Twenty real-filesystem scenarios verify specific backend rejection reasons for project/root/category path or identity changes after initial authorization. These controlled test seams are not OS observation evidence.

Task 3 presses Reveal as soon as the created row appears, with no Refresh, sibling selection, post-creation query or settling wait beforehand. Observation stays active and the actual native API is invoked exactly once. Read-only observation shares one monotonic ten-second total deadline across attempts and pauses; each subprocess gets at most five seconds and no more than the remaining budget. Attempts, elapsed time, deadline and final completion reason are retained. Only the exact disposable parent plus selected full-path item can pass; title-only matches, native API return and late matches cannot. No unrelated window locations are recorded, and only exact matching fixture windows may close.

Separate fixtureCleanup evidence is saved before throwing. Removal of the owned disposable root requires tracked Electron/crash-seed termination and absence of backend PIDs, then uses recursive fs.rm with maxRetries 5 and retryDelay 100 ms. Exhaustion fails cleanup; an earlier primary scenario failure takes precedence. Unverified termination skips removal and fails the fixture. The unchanged ten-second normal quit and forced-cleanup failure remain. Deterministic tests cover delayed matches, shrinking budgets, deadline exhaustion/late success, unavailable observation, single invocation, confinement/termination gating, simulated transient locks, exhausted cleanup and simultaneous primary failure. Simulations do not establish Windows lock or Explorer behavior.

### Reused local command evidence from Tasks 1–3

| Task and command | Actual result | Retained evidence |
| --- | --- | --- |
| 1: npm ci; npm ci --offline | Online install stopped after registry HTTP 502; offline committed resolution passed without dependency/global changes | Task 1 plan evidence |
| 1: focused retry query regression before repair | All 8 cases failed on command-routed list requests | task1-query-red.log |
| 1: affected service/UI/Reveal/App suites | Initial 262 passed / 45 failed from a new assertion assuming a nonexistent projects.name column; repaired persisted relative_path assertion, then 307 passed / 0 failed | task1-affected.log; task1-affected-repaired.log |
| 1: npm test; npm run lint; npm run typecheck | Build and 821 tests passed, zero failures/skips; lint passed; typecheck caught missing workspaceId, then passed after repair; all 8 focused retry cases passed finally | task1-npm-test.log; task1-lint-final.log; task1-typecheck.log; task1-typecheck-repaired.log; task1-query-final.log |
| 2: focused production-App regression before repair | Failed at missing dispatched acknowledgment in EN/direct; enclosing test stopped before other combinations | task2-immediate-red.log |
| 2: final affected service/UI/Reveal/App suites | 313 passed, zero failures/skips; four language/mode combinations and exact backend rejection assertions | task2-affected-final.log |
| 2: npm test; npm run lint; npm run typecheck | Build and 827 tests passed, zero failures/skips; lint passed; initial narrow inferred test-client query types repaired, then typecheck passed | task2-npm-test-final.log; task2-lint.log; task2-typecheck.log; task2-typecheck-repaired.log |
| 3: focused new regressions before/after implementation | Missing observation/cleanup functions failed first; implemented functions passed | task3-regressions-red.log; task3-regressions-green.log |
| 3: node --test tests/runtime-lifecycle.test.mjs tests/runtime-executable.test.mjs | 18 passed, zero failures/skips | task3-runtime-tests-final.log |
| 3: npm test; npm run lint; npm run typecheck | Build and 836 tests passed, zero failures/skips; lint/typecheck passed; earlier 835-test run retained separately | task3-npm-test-final.log; task3-lint.log; task3-typecheck.log; task3-npm-test.log |
| 3: npx --no-install electron-builder install-app-deps; npm rebuild better-sqlite3 | Pinned Electron native ABI prepared before graphical verification; Node test ABI restored afterward | task3-rebuild-electron.log; task3-rebuild-node.log |
| 1–3: working and full fixed-base git diff --check | Passed at each milestone | Respective task plan verification sections |

### Local immediate native scenario at Task 3

WORKSPACE_SMOKE_EVIDENCE_DIR=work/ralphex/issue-17/task3-dev-immediate-20261010-1325 npm run smoke:runtime -- dev --creation --checkpoint=after_evidence ran sequentially against the Task 3 working snapshot over dc31038, subsequently committed as f2aabfd. Evidence: task3-dev-immediate.log and task3-dev-immediate-20261010-1325/dev-creation-observations.json. This is development evidence, with no new package or artifact digest claimed.

| Stage | Direct / EN | Grouped / RU |
| --- | --- | --- |
| Creation and explicit after_evidence recovery | Passed | Passed |
| Immediate real shell.showItemInFolder invocation | Passed, exactly once | Passed, exactly once |
| Localized dispatched acknowledgment | Passed | Passed |
| Exact Finder parent and selected full-path item | Passed, first attempt, about 331 ms | Passed, first attempt, about 201 ms |
| Normal shutdown and backend termination | Passed on both closes | Passed on both closes |
| Restart IDs/Text/inventory persistence | Passed | Passed |
| Exact matching-window cleanup | Completed for the disposable target | Completed for the disposable target |

The top-level fixtureCleanup separately passed with processesStopped=true and maxRetries=5/retryDelay=100. Non-selected mode branches in each run remain unreached; the other mode's run supplies that mode's evidence. The actual API return, localized acknowledgment, exact Finder selection, normal shutdown, restart and fixture removal are distinct results. dispatched means only that the void API returned without throwing. This local successful grouped restart does not establish the cause of the historical Task 7 failure or rewrite its failed result.

### Remaining continuation and coordinator gates

- At the Task 4 checkpoint, Task 5 still owed fresh standard/layout/development/package verification. Its subsequent local results are recorded below; Task 3's development-only evidence did not establish packaged acceptance.
- The coordinator must independently rerun immediate-Reveal using a new evidence directory. Its original d5caea grouped result remains native invocation once/exact Finder pass, UI acknowledgment failed, acceptance shutdown unreached, cleanup shutdown passed separately (coordinator-immediate-dev/observations.json and coordinator-immediate-dev.stderr).
- The coordinator owns final exact-SHA Windows/macOS CI and native acceptance: all 53 Windows failures, exact Explorer/Finder observation in both modes and successful owned-fixture cleanup. Historical Windows development pending observations and EBUSY remain preserved; local macOS and simulated-lock results do not close them.
- The original five first-review perspectives and follow-up pair completed for e9ce135; the continuation's prescribed reviews are separate. No final continuation review acceptance is claimed by this documentation task.
- The historical grouped-development restart failure remains explicitly accounted for with its original scope; a subsequent pass is not a diagnosis or a replacement result.
- Trackers and verified local integration remain coordinator-owned. Physical macOS 27 / Electron 44.7.0 #44 remains an independent final-release prerequisite. No executor push, merge, release, signing, tags or publication occurred, and no unmet acceptance criterion is checked complete.

### Documentation validation at Task 4

Over f2aabfd, this documentation-only task corrected the ADR/completed-plan links and current development/architecture/README/Unreleased guidance, appended the failure mapping and reused repair evidence, and preserved the original completed plan byte-for-byte except its corrected link. PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH npm run check:docs passed for 71 Markdown files (task4-check-docs.log). One-off local path/anchor inspection, repository-reference survival after the plan move, pinned Git-path resolution and exact comparison of all 53 historical failure IDs/names passed (task4-link-anchor-inspection.log). Working and fixed-base git diff --check passed.

The coordinator's Task 4 clarification requires these documentation checks instead of repeating the full Electron build/test suite for prose alone. No product tests, graphical/native scenario, build or package was rerun in Task 4, and no documentation-phrasing tests were added. Task 5 and the coordinator gates above remain open.

### Fresh continuation verification at Task 5

Tested source SHA: ae2828187b4b45440ab8ccd3f38dde682b987846, with an initially clean checkout. Fixed implementation/review base: 4ac402620dd8139bdef9ff03625aae64bf60e132. Executed on 2026-10-10, physical macOS 27.0 (26A428), arm64, Node 22.21.1, Electron 44.7.0 and product version 0.1.0. This task changes only this report and the continuation plan after verification; product code and dependency resolution are unchanged. The committed resolution installed in Task 1 was reused. Every Node/npm/npx/tsx invocation explicitly prepended PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH.

All logs and evidence in this section are below ignored work/ralphex/issue-17/. Each graphical invocation used its own WORKSPACE_SMOKE_EVIDENCE_DIR, named in the table. Layout, development runtime, development native, packaging, packaged runtime, packaged native and packaged directory-package checks ran strictly sequentially; no build or clean overlapped a graphical fixture. release is the positional runtime mode, not a CLI flag.

| Command after the PATH prefix | Actual result | Log / evidence directory |
| --- | --- | --- |
| npm test | Production build passed; 836 passed, 0 failed, 0 skipped | task5-npm-test.log |
| npm run lint | Passed | task5-lint.log |
| npm run typecheck | Passed | task5-typecheck.log |
| npm run check:docs | Passed, 71 Markdown files; repeated after report/plan edits | task5-check-docs.log; task5-check-docs-final.log |
| npm run build | Passed; version 0.1.0 matched | task5-build.log |
| npm run build:ladle | Passed | task5-build-ladle.log |
| node scripts/smoke-discovery-layouts.mjs --creation | Passed all 32 EN/RU stories at 1440×960, 1024×720 and 420×800: 96 captures, interactions/layout assertions and normal Electron shutdown | task5-layouts-electron.log; task5-layouts-electron-20261010 |
| npx --no-install electron-builder install-app-deps | Passed; prepared native SQLite for Electron before development runtime | task5-rebuild-electron.log |
| npm run smoke:runtime -- dev | Passed all 15 runtime stage flags, recorded lifecycle shutdowns, startup-failure handling and final quit | task5-dev-runtime.log; task5-dev-runtime-20261010 |
| npm run smoke:runtime -- dev --creation --checkpoint=after_evidence | Passed both modes, immediate native Reveal and separate cleanup | task5-dev-immediate.log; task5-dev-immediate-20261010 |
| CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac | Failed with HTTP 502 during Electron download; no artifact accepted from this attempt | task5-package.log |
| CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dir:mac -- --config.electronDist=/Users/aleksandersk/Library/Caches/electron/5a625dfd3df3efc3971556afe64989f9aa6ea0f4cd6e33889c1951789041498f/electron-v44.7.0-darwin-arm64.zip | Passed fresh build/package using the verified pinned cache; macOS signing explicitly skipped | task5-package-cached.log |
| npm run check:artifact -- release | Passed packaged version, migrations/journal, renderer/backend/private native route, native SQLite and bb notice checks | task5-check-artifact.log |
| npm run smoke:runtime -- release | Passed the same full 15-stage lifecycle matrix, recorded shutdowns, startup-failure handling and final quit | task5-release-runtime.log; task5-release-runtime-20261010 |
| npm run smoke:runtime -- release --creation --checkpoint=after_evidence | Passed both modes, immediate native Reveal and separate cleanup | task5-release-immediate.log; task5-release-immediate-20261010 |
| npm run smoke:runtime -- release --creation --checkpoint=after_evidence --directory-package | Passed both modes, exact Finder selection, harmless .app non-execution, normal quit/restart and separate cleanup | task5-release-directory-package.log; task5-release-directory-package-20261010 |
| npm rebuild better-sqlite3 | Passed after all graphical fixtures terminated; restored the Node test ABI, then verified a real in-memory SQLite query under Node 22.21.1 | task5-rebuild-node.log; task5-node-abi.log |

The failed network attempt was diagnosed before the changed packaging command; it was not a native failure replay. The cached Electron ZIP SHA-256 is e04e411b58a0a14375dd21b0ab4a378fd38930a702e4e20e322fee4849404c0b, matching node_modules/electron/checksums.json for the pinned version. Fresh release/mac-arm64/Workspace.app/Contents/Resources/app.asar SHA-256 is 147b42c5701a4d0263a17f53ac940517dadea8af77b859499c69eb4f39a8ee7e (task5-artifact.sha256); it remained unchanged through packaged verification. task5-run-metadata.json records host/cache/source metadata, and task5-graphical-summary.json records assertions against the actual saved stage results.

The native scenarios use direct/EN and grouped/RU. In each of the six mode/scenario combinations, creation, after_evidence interruption recovery, one real shell.showItemInFolder invocation, truthful localized dispatch acknowledgment, exact parent plus selected full-path observation, two normal shutdowns with backend exit, restart persistence and exact matching-window cleanup passed. The ordinary-folder scenarios press Reveal as soon as its newly created row is available, without Refresh or settling waits and with production observation active. The package variant prepares only its harmless disposable probe before Reveal. The two package probes retained launchMarkerAbsent=true; this demonstrates local non-execution of those probes, not arbitrary package behavior on other OSes.

| Scenario | Direct/EN exact observation | Grouped/RU exact observation | Owned fixture cleanup |
| --- | --- | --- | --- |
| Development immediate Reveal | First attempt, 215 ms | First attempt, 200 ms | Passed after verified process termination |
| Fresh packaged immediate Reveal | First attempt, 247 ms | First attempt, 230 ms | Passed after verified process termination |
| Fresh packaged directory-package | First attempt, 323 ms | First attempt, 233 ms | Passed after verified process termination |

Each observation used the unchanged ten-second total budget; each fixtureCleanup independently recorded processesStopped=true, maxRetries=5 and retryDelay=100. No transient lock occurred locally, so these runs do not prove actual Windows lock recovery. Opposite-mode branches in each run remain unreached; its companion run supplies that mode's evidence. Only after_evidence was selected for these focused graphical runs; the 836-test suite separately exercises all four process-interruption boundaries. Native invocation, dispatched UI feedback, exact OS selection, shutdown, restart and owned-tree removal remain distinct assertions, and no skipped/unreached result was promoted to a pass.

Visually inspected the grouped English 1440×960 and uncertain Russian 420×800 layout captures, including category controls, wrapping and explicit original-request retry. Inspected working changes, the full fixed-base diff scope and service/desktop/renderer/fixture boundaries, and commit history. Working/full fixed-base git diff --check passed. The retained full diff and history are task5-fixed-base.diff and task5-commit-history.log; this inspection does not replace the prescribed independent continuation reviews. No product change or new test code was necessary in this verification/reporting task.

### Coordinator handoff after Task 5

Continuation implementation commits are 2d6b562 (Windows fixture/query repair), dc31038 (immediate-Reveal acknowledgment), f2aabfd (bounded native observation/owned cleanup) and ae28281 (documentation). The final Task 5 commit adds only verified report/progress documentation over the tested ae28281 snapshot. Local sequential continuation verification is complete; continuation's five first-review perspectives and any required quality/implementation follow-up pair remain for the review phase.

The independent coordinator immediate-Reveal harness, final exact-SHA Windows/macOS CI/native acceptance, actual Windows Explorer observation and successful Windows owned-fixture cleanup remain coordinator gates. Historical Windows failures/pending observations/EBUSY, the original grouped immediate-feedback failure and the unexplained historical grouped-development restart failure retain their original results and SHA/scope. New local passes do not diagnose or erase those failures. Trackers and verified integration remain coordinator-owned; physical macOS 27 / Electron 44.7.0 #44 remains an independent final-release prerequisite despite these normal local quits. No executor push, tracker write, integration, signing, release, tag or publication occurred, and no external acceptance criterion was checked complete.

### Continuation first-review repairs

Reviewed checkpoint 35337dbcb32e87a4a676c1706146e7b13dddcc2e against the unchanged fixed base 4ac402620dd8139bdef9ff03625aae64bf60e132. All five independent perspectives completed before repairs, in batches of three and two. Quality, testing and simplification reported no findings. Implementation reported one major test-ordering defect; documentation reported three minor inconsistencies. All four findings were verified in their full code/document context and confirmed; none was discarded as a false positive.

The retained completed Windows CI log ci-38044758666-windows-complete.log tested f2aabfd and records 835 tests: 827 passed, two failed and six existing POSIX skips. EN/direct project-identity expected replaced but received unresolved; RU/direct project-path expected missing but received unresolved, both at the former tests/project-creation-ui.test.tsx:312 assertion. These were safe rejections, not unsafe native dispatches. This separate failure is preserved alongside the earlier 53-failure family.

Code inspection and a deterministic real-SQLite/filesystem reproduction establish the ordering cause. Native watch hints schedule refreshSource, whose reconciliation can persist a uniquely evidenced external move before the delayed native callback completes. project-reveal.ts then verifies the moved folder but rejects the changed trusted target as unresolved. Before reconciliation, the unchanged saved locator instead yields the exact missing/replaced/category/root problem. The previous test left that order to wall-clock watcher scheduling while demanding only the latter result.

The UI boundary fixture now controls watch hints and scheduling through the existing ObserverDependencies seam, retaining real native probes, filesystem changes, SQLite, production reconciliation, React and service post-native validation. Eight EN/RU × direct/grouped × ordering tests cover 32 folder-change cases. Before observation, exact missing/replaced/root/category problems remain asserted. After observation, exact unresolved is asserted along with one revision increment, the original logical project ID, the precise new active locator and uncertain UI feedback. Both orders require one request and no dispatched success. No product guard, error contract or assertion was relaxed. Graphical immediate-Reveal fixtures retain the actual production observer.

The architecture responsibility table now names the implemented shell.showItemInFolder integration. The accepted continuation plan no longer calls itself an unexecuted draft. The harness-only native-observation/fixture-cleanup bullet was removed from the user-facing changelog; that methodology remains documented in development and verification guidance, and the immediate-Reveal product fix remains in Unreleased.

Repair verification ran on physical macOS on 2026-10-10 in the working tree based on 35337db, with Node 22.21.1 explicitly prepended to PATH for every Node/npm command. The checked tests/project-creation-ui.test.tsx SHA-256 is c1c49dccf0d55284fdf2eabe1355eb43369a4af2986285cdafdc893b734f616b. Logs remain below ignored work/ralphex/issue-17/:

- Deterministic red reproduction: node --import tsx --test --test-name-pattern='delayed real-service Reveal' tests/project-creation-ui.test.tsx passed the four before-observation tests and failed the four after-observation tests at the original missing assertion, with actual unresolved. Log: review0-observer-order-red.log. Each red after-observation test stops at its first project-path case; the green run supplies the remaining cases.
- The same focused command after splitting the exact expectations passed all eight tests/32 cases. Log: review0-observer-order-green.log.
- npm test rebuilt production output and passed 840 tests, zero failures/skips. Log: review0-npm-test.log.
- npm run lint and npm run typecheck passed. Logs: review0-lint-final.log and review0-typecheck-final.log.
- npm run check:docs passed and was repeated after the final report/plan edits. Log: review0-docs-final.log. Working and full fixed-base git diff --check passed.

The repair changes only tests and documentation. It introduces no new native/package result and leaves Task 5's existing graphical evidence at its original SHA/scope. Follow-up quality/implementation review and final exact-SHA coordinator platform acceptance remain required; #44, tracker closure and integration are unchanged external gates.

## Bounded Windows observation diagnostics after completed-plan handoff

Coordinator CI 38046397144 tested dfe1afcb820132a567fe11a6a1dc65be2774e8ca. macOS completed all steps with 840 passing tests. Windows completed 839 tests (833 passed, six existing POSIX skips, zero failures); the direct development native scenario failed exact selection observation. The single actual showItemInFolder call returned and English dispatch acknowledgment passed. Eighteen read-only attempts exhausted the unchanged ten-second budget in approximately 10015.9 ms; the first took approximately 3484.8 ms, and the last 173 ms subprocess budget timed out. Other Windows native scenarios passed. Failure cleanup recorded normal quit and owned-fixture cleanup independently; direct scenario creation acceptance, acceptance shutdown and restart remained unreached. Original full log, evidence ZIP and native summary remain under ignored work/ralphex/issue-17/ with the ci-38046397144 prefix.

All five first-review perspectives were collected against dfe1afc and the original fixed base before any repairs. Quality, implementation and testing reported the same confirmed diagnostic gap at scripts/file-manager-evidence.mjs:35: catch {} collapses COM/document failures into the same false as a normal nonmatch. Simplification and documentation reported no issues. Existing evidence cannot distinguish absent parent, unselected target, inaccessible COM view, Windows tab enumeration behavior or native dispatch failure. No product cause is established.

The installed Electron declaration returns void. The pinned [Electron 44.7.0 Windows source](https://github.com/electron/electron/blob/v44.7.0/shell/common/platform_util_win.cc#L251-L333) posts a COM STA task, calls SHOpenFolderAndSelectItems, and contains early returns and a conditional parent-only fallback. These are possible explanations, not evidence that any occurred here. [Microsoft's selection API contract](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shopenfolderandselectitems) returns an HRESULT that is not exposed by Electron's JavaScript API. [Shell.Windows](https://learn.microsoft.com/en-us/windows/win32/shell/shell-windows) and [SelectedItems](https://learn.microsoft.com/en-us/windows/win32/shell/shellfolderview-selecteditems) describe the automation boundary; they do not prove that the failed run enumerated the intended view or selected item. No cold-start, tab or timing hypothesis is treated as proven.

The bounded repair adds read-only structured Windows observation: exact parent found, target present through [ParseName](https://learn.microsoft.com/en-us/windows/win32/shell/folder-parsename), exact selected target match, matching-parent/error counts and at most eight finite stage/numeric HRESULT pairs. Only the exact parent and selected full target path can establish success. Unavailable shell/enumeration and malformed telemetry remain distinct from ordinary nonmatches; per-view read errors can resolve within the same existing deadline. JavaScript retains explicitly allowed fields only, rejects inconsistent evidence and sanitizes subprocess failure codes. It never retains other window paths, titles, selections, COM messages or raw stdout/stderr. Native dispatch, its invocation count, source authorization, the observation/normal-quit deadlines and owned-window cleanup are unchanged. This is instrumentation, not a claim that Windows Reveal was repaired.

New deterministic tests cover each decision, exact success, errors by stage, corrupted/inconsistent responses, bounded error retention, output privacy and a transient per-view error followed by exact selection within the same budget. A Windows-only test executes the actual observer PowerShell with controlled COM views, including a selected target under the wrong parent, absent target, selection/document failures and exact success. It simulates COM; it is not actual Explorer acceptance and is skipped on macOS. The first focused run failed all six host-independent new tests before implementation (review-windows-diagnostics-red.log); after implementation, the three focused files passed 24 tests with the one Windows-only test skipped (review-windows-diagnostics-green.log).

Validation ran on macOS arm64 on 2026-10-10, on the diagnostic repair tree over dfe1afc, with PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH explicitly prepended to every Node/npm invocation. npm test rebuilt production output and passed 846 tests, zero failures, with the one Windows PowerShell test skipped (review-windows-diagnostics-npm-test.log). Separate lint, typecheck and check:docs passed; Markdown validation checked 71 files (review-windows-diagnostics-lint.log, review-windows-diagnostics-typecheck.log and review-windows-diagnostics-docs.log). The final focused rerun passed 24 tests with one Windows-only skip (review-windows-diagnostics-focused-final.log). Working and full fixed-base whitespace checks passed. All logs remain under ignored work/ralphex/issue-17/.

Tested SHA-256 digests: scripts/file-manager-evidence.mjs 58f861a7baba40b62f092fb2dd221797d33953822a80b765e43d65cbc9fd0b3f; tests/file-manager-evidence.test.mjs f2564aee0012c8c66c1d8da9b1ae5b089e06dadab4f09fcdf3eee1895c25991f; tests/runtime-lifecycle.test.mjs b9d811001f2870b74c588e2b16f9ea52135917c5853653b1493a45dc7721b6e0. No unchanged native rerun, package rebuild, CI push, tracker write or integration is performed for this diagnostic repair. Windows execution with the new telemetry and final exact-SHA platform acceptance remain coordinator gates. Historical failures and independent #44 remain open with their original scope.
