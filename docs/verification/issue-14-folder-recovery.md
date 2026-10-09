# Issue #14: Folder recovery verification

## Scope and checkpoint

Local verification on macOS / arm64 for GitHub #14 (T07), branch codex/issue-14-folder-recovery. Fixed implementation/review base: 3731c798c8739624d97160d6b48fe6f8ec244550. Task 5 runtime/presentation checkpoint: 3d6cc29. Task 6 changes only tests and documentation; the exercised production renderer/service, migrations and permanent runtime/Ladle fixtures are unchanged from that checkpoint. This report is committed with Task 6; its containing commit identifies the completed local checkpoint. It is not a published release or coordinator platform acceptance.

Recovery exposes retained metadata and explicitly reassociates a missing/unresolved/replaced logical project to a validated folder within its configured source. Direct and grouped recovery preserve IDs and authored Text, make no project filesystem writes, and require reviewed selection and confirmation. Excluded records use discovery reinclusion. Grouped recovery reuses a continuously verified active category or inserts a genuinely new category atomically; existing unavailable category associations are not repaired here. Automatic reconciliation/watchers, mode switching, source relocation, folder mutations and backups/import remain outside this slice.

## Acceptance mapping

| Issue acceptance criterion | Permanent evidence | Observed local result |
| --- | --- | --- |
| Unavailable root shown once without deleting projects/values | project-recovery-service, renderer-app and project-recovery-ui tests; runtime disconnect/retry fixture | Passed service/UI tests and Task 5 development runtime; source feedback preserves rows and avoids mass missing labels. |
| Individual missing/ambiguous folder retains logical record/Text and offers recovery | retained projection and EN/RU Locate folder tests; actual missing, persisted-unresolved and observed-replaced runtime scenarios | Passed tests and development runtime with accessible Text and original IDs. |
| Containment/existence/conflicts validated without overwrite/merge | disposable direct/grouped service fixtures, production IPC/client tests, runtime reserved-target rejection and stale target change | Passed; invalid depth, traversal, links, exclusions, archive/service paths, native aliases, foreign ownership and reserved paths fail without writes. |
| Cancel/failure preserves metadata; success survives restart with same identity | transaction injection/race tests, populated-baseline regression, runtime cancel/recovery/restart/source reuse | Passed tests and development runtime; exact Text/category/category-label/settings and independent views compared. |
| End-to-end remove/disconnect/recover through UI/service without markers | permanent development and packaged Electron smoke; inventories/sentinel bytes compared against external fixture state | Development and fresh packaged runtime passed. No application project-file writes observed in passed scenarios. |

These are local observations, not tracker closure. The coordinator owns GitHub/Beads status, exact-SHA macOS/Windows CI and platform acceptance.

## Automated checks

All Node/npm/tsx invocations explicitly prepend /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin to PATH. npm ci used the committed lockfile. Task 6 logs are retained under the ignored work/ralphex/issue-14 directory.

- npm test: 278 passed, zero failed/skipped, including the production build (task-6-test-1.log).
- npm run lint and npm run typecheck: passed (task-6-lint-1.log, task-6-typecheck-1.log).
- npm run check:docs: passed, 63 Markdown files (task-6-docs-1.log; final recheck in task-6-docs-final.log).
- npm run build: passed within npm test and the fresh package command; version 0.1.0 verified. npm run build:ladle passed (task-6-ladle-1.log).
- CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac: passed; signing explicitly skipped and artifact resources/native SQLite/migrations/version/license verified (task-6-package-mac-1.log).
- git diff --check and git diff 3731c798c8739624d97160d6b48fe6f8ec244550 --check: passed after final plan/report edits (task-6-diff-check.log).
- No Task 6 failed or skipped check was observed; earlier failed probes remain preserved.

The new populated baseline test initializes the actual unchanged 0000–0006 migrations directly, seeds settings, two independent workspace/views, active/excluded/missing/unresolved/replaced projects, grouped categories/category label and exact authored Text with nonzero independent revisions. Opening the service and read-only previews leave all records and the migration journal unchanged. Recovery increments only discoveryRevision and changes the selected association; peer records, Text and category metadata remain intact. Reopen and final-workspace removal/source reuse compare logical IDs and values, source ownership, migrations, settings, inventories and sentinel bytes. Earlier populated 0000–0004 and 0000–0005 upgrade regressions still pass. No migration is needed or introduced.

## Presentation and development runtime evidence reused

Per the run-local reuse instruction, unchanged native checks are not rerun just to duplicate a checkbox. Task 5 final evidence remains applicable to the unchanged production and fixture code:

- task-5-layout-final/ladle-observations.json and task-5-layout-final.log: featurePassed/shutdownPassed true; 88 EN/RU stories at 1440×960, 1024×720 and 420×800 (264 screenshots); 60 interactions including 20 recovery states. Long recovery names/paths wrap, document overflow is absent, controls are reachable, keyboard selection/cancellation/save and focus restoration pass. These are typed production-component presentation fixtures, not SQLite persistence evidence.
- task-5-runtime-dev-1/dev-observations.json and task-5-runtime-dev-1.log: status passed; recoveryFeatures, preQuitFeatures, firstShutdown, restartPersistence, retainedSourceReuse and startupFailure all true; three normal shutdowns passed. 117 screenshots cover actual production UI/IPC/service routes. Scenarios include direct missing/unresolved/replaced recovery, grouped new-category recovery without Apply, cancellation, reserved-target rejection, stale target refresh with explicit reselection, root disconnect/retry, ordered sibling notifications and unrelated-source isolation, restart and source reuse with unchanged bytes/inventories.
- Task 5 visual inspection and coordinator-visual-notes.md record EN/RU wide/narrow selection, retained and grouped saved screens. Observed wrapping/readable review fields/controls and focus outlines complement automated keyboard/focus assertions. Visual inspection does not establish every screenshot's correctness or native dialog behavior.

Earlier failed probes/logs and all screenshot directories remain under work/ralphex/issue-14; no evidence is deleted or overwritten. The automated picker seam bypasses the native OS dialog and does not establish hand-tested native picker acceptance.

## Fresh packaged runtime

The fresh unsigned artifact at release/mac-arm64/Workspace.app was built and resource-checked, then executed once with npm run smoke:runtime -- release. task-6-runtime-release-1.log and runtime-release/release-observations.json record status passed on darwin/arm64. recoveryFeatures, preQuitFeatures, firstShutdown, restartPersistence, retainedSourceReuse and startupFailure are all true; all three recorded normal shutdowns passed. No failed or unreached packaged stage was observed. The unchanged ten-second shutdown assertion was used; no retry or forced-success cleanup was needed.

The packaged fixture passed direct missing/unresolved/replaced and grouped new-category recovery, source retry, cancellation/conflict/stale reselection, exact restart/source-reuse identity and Text/category/label/settings comparisons, independent views, source-scoped events/isolation and unchanged externally prepared inventories/sentinel bytes. Separate output runtime-release contains 117 screenshots; it does not overwrite Task 5 evidence.

Task 6 additionally inspected four actual packaged captures: release-en-420-recovery-571700e4-1aae-455a-8bc7-29bc3d0496af-missing-selected.png, the corresponding en-1440 missing-selected image, release-ru-1440-recovery-821fc5b8-fc2e-4199-a7f0-a5433ff5530d-replaced-selected.png, and the corresponding ru-420 missing-saved image. Long grouped project/previous/target/category paths and candidate explanations wrap; recovery controls fit without visible overlap. The narrow saved screen shows the success notice and focus outline on the Table heading, with additional columns inside the intended bounded Table scroller. Keyboard/control reachability and focus behavior are automated assertions; this inspection records visible presentation only.

## Implemented limits and remaining gates

Read-only observations and revalidation before/after transactional writes detect observed changes, but provide no filesystem lock and cannot prevent later changes or indistinguishable native-evidence reuse. Another non-replaced record reserves its path; current conflicting native evidence blocks targets, while retired historical replaced evidence alone does not prove live ownership. Recovery neither overwrites nor transfers another logical record.

Same-source association commits/observations invalidate ephemeral reviews. stale_preview requires Refresh, reselection and confirmation. A lost accepted response reports uncertainty and reloads committed state without replay or fabricated success. Backend generations, cancellation/removal and newer sibling snapshots guard delayed results; independent Text/category-label revisions and drafts are preserved.

Physical macOS27 / Electron44.7.0 shutdown #44 remains unresolved independently of local normal exits. Local macOS results do not establish Windows acceptance. Exact-SHA CI on both platforms, native/platform acceptance, tracker changes, push and integration remain coordinator-owned. No release/tag/signing/publication or automatic finalization was performed. Comprehensive/follow-up review is a separate post-completion phase prescribed by the plan.
