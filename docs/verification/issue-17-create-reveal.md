# T10 / GitHub #17: Project creation and native Reveal verification

## Snapshot and scope

Fixed implementation/review base: 4ac402620dd8139bdef9ff03625aae64bf60e132. Task 7 started from 2804db06ac62c6ff230c17e803592f89fe288a3f (Task 6); the tested working snapshot includes the Task 7 changes committed with this report. Resolve its delivery SHA with git log -1 --format=%H -- docs/verification/issue-17-create-reveal.md. This report does not claim exact-SHA CI acceptance. Platform: local macOS 27.0 (26A428), arm64; Node 22.21.1, pinned Electron 44.7.0, package version 0.1.0. All Node/npm/npx invocations prepend /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin to PATH. No lockfile/version/global configuration, signing, tracker, push/integration or release change.

The source implements configured direct/existing-category grouped creation, durable source-owned operation history, explicit recovery, observer/discovery reservations, production IPC/UI and trusted native Reveal. Creation makes one exclusive empty directory and writes no markers. Project rename/moves, category creation, archive/restore and deletion remain outside scope.

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

The native directory-package semantics watchpoint is also open. Installed Electron 44.7.0 typings describe openPath as desktop-default opening and showItemInFolder as file-manager display/selection. The product accepts real directory packages; ordinary-directory results in this report do not prove that Reveal avoids launching a package or its associated editor. No disposable-package execution probe or integration repair was performed in this iteration. This concern must be resolved before native acceptance; it is not a passed test or a reason to ban otherwise valid package names.

The immediate-after-create Reveal feedback watchpoint is unresolved: existing UI guards can report uncertainty when a newer source/discovery observation arrives during dispatch. Strict native fixtures explicitly Refresh and await the committed load with observation active. Their success cannot establish immediate-Reveal feedback behavior; no guard/assertion was weakened to hide it.

The required Ralphex five-perspective first review and quality/implementation follow-ups remain separate pending phases. Coordinator owns independent final product verification (including both repair probes), exact-SHA macOS/Windows CI/native acceptance, any required observed Explorer/Finder confirmation, tracker completion and local integration. Issue #44 on physical macOS 27/Electron 44.7.0 remains an independent final-release prerequisite. Normal quit retains its ten-second assertion; forced cleanup is failure. No unmet issue criterion or external gate is marked accepted here.
