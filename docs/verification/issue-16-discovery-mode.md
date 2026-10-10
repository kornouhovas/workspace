# GitHub #16: Discovery mode changes — local verification

## Scope and source snapshot

Requirement: [GitHub #16](https://github.com/kornouhovas/workspace/issues/16), specification stories 16–18. This report covers metadata-only configured-source mode changes, retained history, exclusions, explicit recovery, observation, production transport/UI and delivery resources. No folder mutation commands, signing, version bump, push, publication or platform acceptance are included. Product version remains 0.1.0.

Fixed implementation/review base: `59d4407bf5364020428b9a736dc3844824c177a5`. Local checks run on macOS 27.0 (26A428), arm64, with Node 22.21.1 explicitly prepended to PATH on every Node/npm/npx/tsx invocation. The committed lockfile was installed with npm ci at run initialization (`work/ralphex/issue-16/npm-ci.log`); this slice changes no dependencies or lockfile.

Implementation milestones: `2eb1f0e` preview, `1e73563` persistence, `1ff7bab` recovery/observation, `ab5ce80` UI/transport, `de2302a1a3bcded57d51fe103aadcd0f2b8c447c` graphical fixtures. Task 6 verifies the Task 5 production/fixture snapshot plus the artifact-check and documentation changes described here. Its resulting commit is the commit containing this report; it cannot embed its own SHA. This is local working-tree evidence, not an observed exact-SHA CI pass. The coordinator must verify final commit applicability and platform acceptance.

## Acceptance mapping

| Criterion | Implementation and permanent evidence | Local result |
| --- | --- | --- |
| Preview identifies added, retained, no-longer-recognized projects and category availability | `tests/discovery-mode-service.test.mjs`, production transport tests, EN/RU App tests, 18 mode Ladle states and runtime mode-change stages | Service/UI/transport regressions and Task 5 development runtime passed; Task 6 affected layouts and packaged scenario also passed. |
| Cancel leaves configuration/metadata untouched; Apply changes no files or placement | Full SQLite equality around previews, inventory/sentinel comparisons, transaction/race/partial-write failures, UI Cancel and runtime storage snapshots | Task 5 development and Task 6 packaged Cancel/Apply and byte/inventory assertions passed. |
| Unmatched records/values remain visible and editable for explicit reassociation | Mode-inactive history, retained Text editing, target-depth/own-path recovery, reserved/native conflicts and both-direction round trips | Service/UI recovery regressions, Task 5 development and Task 6 packaged recovery passed. Automatic discovery/Refresh/startup/observation cannot revive dormant projects. |
| Mode is shared by source and survives restart without changing independent views | Same-source fanout/different-source isolation tests, populated upgrade/reopen/final-removal reuse, runtime exact settings/IDs/labels/Text/exclusions/archive/views snapshots | Task 5 development normal quit, restart and final-removal/source reuse passed; Task 6 packaged normal quit, restart and reuse also passed. |
| Stale reviews revalidate and offer recovery without cross-depth guessing or filesystem mutation | Token/config/root/association/full-snapshot checks; sibling races and delayed response guards; role/history reservations, stale explicit re-Apply and reassociation | Service/UI/transport regressions, Task 5 development and Task 6 packaged stale/recovery scenarios passed. No filesystem lock or permanent native identity guarantee is claimed. |

Migration 0007 upgrades the actual populated 0000–0006 schema. Historical migrations remain unchanged. Build/artifact regressions require its SQL and journal entry; negative packages missing either must fail. Direct projection hides preserved category/property history; grouped Apply resumes only conservative continuously evidenced category history. Exact Text and hidden label drafts retain logical identities and independent revisions.

## Commands and observed outcomes

Each command below uses `PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH`. Logs/evidence live in the ignored `work/ralphex/issue-16/` directory and are retained locally rather than distributed in the package.

All commands ran separately and exited zero after the artifact checker repair:

| Command (with the PATH prefix above) | Evidence | Observed result |
| --- | --- | --- |
| npm test | task6-tests-01.log | 530 passed, zero failures/skips; includes populated migration, rollback, native observation, transport and EN/RU UI regressions. |
| npm run lint | task6-lint-01.log | Passed, no warnings. |
| npm run typecheck | task6-typecheck-01.log | Passed. |
| npm run check:docs | task6-docs-01.log; task6-docs-final.log | Passed local links/anchors; final run includes the completed report/plan. |
| npm run build | task6-build-01.log | Passed desktop/backend/renderer/version and migration copy. |
| npm run build:ladle | task6-ladle-build-01.log | Passed. |
| WORKSPACE_SMOKE_EVIDENCE_DIR=work/ralphex/issue-16/task6-layouts-01 node scripts/smoke-discovery-layouts.mjs --chromium --mode-changes | task6-layouts-01.log; task6-layouts-01/ladle-observations.json | 18 EN/RU stories, 54 viewport screenshots at 1440×960, 1024×720 and 420×800; 18 interactions passed. Wrapping, reachable controls, keyboard/focus and document overflow checks passed; Chromium closed. Electron shutdown was not exercised in this browser run. |
| CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac | task6-package-mac-01.log | Fresh unsigned arm64 directory artifact and resource check passed, including migration 0007/journal, native SQLite, version and bb notice. |
| WORKSPACE_SMOKE_EVIDENCE_DIR=work/ralphex/issue-16/task6-runtime-package-01 npm run smoke:runtime -- release | task6-runtime-package-01.log; task6-runtime-package-01/release-observations.json | Passed every stage below; 135 screenshots, 17 observations. |
| git diff --check; git diff 59d4407bf5364020428b9a736dc3844824c177a5 --check | task6-diff-check-final.log | Passed. Full fixed-base diff inspected for accepted scope, service/renderer boundary, packaging and metadata-only filesystem behavior. |

Graphical runs were sequential; no build or clean occurred while a fixture used dist. Representative RU narrow review and EN wide category screenshots were visually inspected. Non-mode Ladle states reuse the unchanged Task 5 full milestone below; no new full 120-story run is claimed. Package creation rebuilds dist, so the preceding Ladle outputs are preserved through their evidence rather than asserted to remain in dist.

The packaged app is release/mac-arm64/Workspace.app. Its app.asar SHA-256 is `72ed11af02f475d3c2f5da17a9424fa390a44f452eaea1ac634c4f3e5f08947f`. The ignored task6-snapshot-01.json records the fixed base, production milestone and hashes for the service repair, migration and unchanged runtime/layout fixtures. The checker was changed in Task 6; production application/graphical fixture files remain identical to Task 5. Documentation/tests and the report/plan are finalized after runtime; no exact final-commit CI claim is made.

| Packaged stage | Result |
| --- | --- |
| EN/RU mode-change Cancel | Passed; full persisted metadata unchanged. |
| Both mode directions and sibling stale review/explicit re-Apply | Passed; category disappearance/return and inactive exclusions checked. |
| Explicit target-depth recovery and mode-retained editing | Passed; original UUIDs/exact Text preserved, new roles inherit no values. |
| Native reconciliation and explicit Refresh | Passed; includes the repaired dormant-project/current-category role history. |
| Pre-quit feature checks | Passed; settings, IDs, authored labels/Text, independent views, exclusions/archive designation and byte/inventory assertions. |
| Normal quit/backend exit | Passed; all three recorded shutdown attempts passed the unchanged ten-second assertion. |
| Shutdown-missed reconciliation, restart persistence and mode-change restart | Passed only after normal quit. |
| Final removal, retained-source reuse and mode-change reuse | Passed; source-owned metadata retained with independent new views. |
| Startup failure/cleanup | Passed; evidence status is passed with no recorded error. |
| Failed/unreached packaged stages | None in this run. This does not close independent #44. |

## Reused historical evidence

Task 5 at `de2302a1a3bcded57d51fe103aadcd0f2b8c447c` passed 528 tests, lint/typecheck and Ladle build. The final affected-state Chromium run `task5-layouts-03` passed all 18 EN/RU mode stories at three sizes (54 screenshots). The preceding full run `task5-layouts-02` captured all 120 stories (360 screenshots); unchanged non-mode states reuse that successful milestone. Presentation fixtures use disposable typed responses, not SQLite, and browser cleanup does not establish Electron shutdown.

Task 5 development runtime `task5-runtime-dev-04` passed all mode Cancel/Apply/recovery, native reconciliation, normal quit/backend exit, restart persistence, final-removal/source reuse and startup-failure stages. The production runtime scenario is unchanged in Task 6. Its exact storage snapshots compare settings, Text/labels, logical identities, independent views, authored exclusions and disposable seeded archive designation; inventories and sentinel bytes remain unchanged by application commands. This is reused development evidence at its original milestone, not a new Task 6 development run.

The runtime reproduced coordinator Finding1 in `task5-runtime-dev-03` before bounded role-aware reconciliation repair. Permanent service/native/startup tests preserve same-role and unreliable/conflicting-evidence restrictions while permitting the exact legitimate dormant-project/current-category overlap. Independent draft probes are coordinator-owned and must be checked against final commits; they are not final platform acceptance.

Earlier failed attempts remain in `task5-layouts-01` and `task5-runtime-dev-01` through `-03`, with causes and completed/unreached stages recorded in the plan. Task 6 artifact red tests are retained in `task6-artifact-red.log`; both expected missing-resource regressions failed before the checker repair, and `task6-artifact-green.log` then passed all 11 artifact tests.

## Remaining limits and coordinator gates

- Physical macOS 27 / Electron 44.7.0 issue [#44](https://github.com/kornouhovas/workspace/issues/44) remains an independent final-release prerequisite. An individual successful local quit does not close it. The ten-second normal-quit assertion is unchanged and forced cleanup remains failure; no unchanged native retry is authorized here.
- Windows runtime/package behavior and exact-SHA macOS/Windows CI acceptance require observed coordinator evidence. Local macOS checks cannot establish Windows acceptance.
- False runtime stage flags mean failed or unreached stages; only completed assertions may be reported passed. Restart/source reuse require a successful normal quit.
- Repeated validation detects observed races without locking folders; indistinguishable full native-evidence reuse and later filesystem changes remain possible. Whole-source relocation/merge, archive/category/folder commands and portable identity remain separate work.
- The automated disposable root-picker seam does not establish manual OS-native picker acceptance. Tracker completion, CI push, integration and final platform acceptance remain coordinator-owned. No signing, tags, release, publication, global upgrades or unrelated cleanup occurred.

## Full-review follow-up (2026-10-10)

All five independent first-review perspectives completed against the fixed base before repairs. Quality and implementation identified the same major defect: a project excluded before changing mode could not be explicitly recovered after removing that exclusion. Simplification identified a redundant nullable category wrapper in Apply. Testing and documentation reported no additional findings. Both confirmed findings were repaired.

Historical `association_state` and `mode_inactive` remain intact until explicit recovery. Projection and recovery now distinguish an ongoing exclusion from the historical excluded state. Removing a manual exclusion permits reviewed own-path or target-depth reassociation without automatic enrollment or changing UUID/Text. Persisted exclusions, archive containment and policy exclusions still block recovery. Follow-up review caught and repaired a case-insensitive archive comparison; distinct case-sensitive paths remain independent, while archive aliases rely on scanner-confirmed evidence. The final quality/implementation pair reported no critical or major findings.

Permanent regressions cover direct-project, grouped-child and grouped-category exclusion removal, both own-path and target-depth recovery, restart, read-only review, exact metadata/file preservation, ongoing archive restrictions and case-sensitive paths versus confirmed aliases. EN/RU interaction tests verify recovery visibility and keyboard confirmation. The existing retained-row Ladle fixture now exercises historical exclusion removal; its layout scenario checks visible, keyboard-reachable recovery without stale exclusion guidance.

Review evidence remains under ignored `work/ralphex/issue-16/`: `review-exclusions-red.log` records all eight initial service/UI regressions failing; `review-exclusions-green.log` records them passing after repair. `review-tests-final.log` records the final full `npm test` build and 541 passing tests, zero failures/skips. Lint, typecheck and local documentation links passed. `review-ladle-build-01.log` and `review-layouts-01` record a successful Ladle build and 54 screenshots across all 18 mode states at the three established sizes, including 18 interactions and successful Chromium cleanup. The retained EN wide and RU narrow screens were visually inspected. All Node commands used the required PATH prefix; builds and graphical execution ran sequentially.

The Task 5/6 Electron and packaged results above remain evidence at their original milestones. This review changes service/renderer code and presentation fixtures; it does not claim a new packaged runtime pass or final exact-SHA platform acceptance. Coordinator gates, including Windows and #44, remain unchanged.

## Second critical/major review follow-up (2026-10-10)

The independent quality/implementation pair completed before repair. Quality identified a major mode-return defect: after grouped discovery accepted a replacement category at an old category's path, the superseded replaced history prevented that continuously matching category from resuming after grouped→direct→grouped. This also blocked explicit own-path project recovery. Implementation reported no additional findings.

Dormant replaced history remains persisted and continues to reserve new enrollment during mode return. An already accepted active/excluded category can resume only with reliable, matching full native evidence at its current path beneath the verified root. Superseded history no longer hides that verified owner or its eligible children. Other dormant category states, identity mismatches and observed aliases retain their restrictions. Projects still require explicit recovery; category resumption does not reactivate project metadata.

The real SQLite/filesystem regression first failed at the category preview (`review2-category-red.log`), then passed with the affected discovery/grouped/recovery suites: 104 tests, zero failures/skips (`review2-service-green-02.log`). It exercises actual category replacement, restart between modes, category UUID preservation, retained project UUID/exact Text, explicit own-path recovery, unchanged file inventory and later new-child enrollment without reviving superseded history. Evidence is under ignored `work/ralphex/issue-16/`; all Node commands use the required PATH prefix. No graphical or packaged runtime was rerun for this service-only repair; the earlier milestone evidence and coordinator platform gates remain unchanged.

Both reviewers' focused audits of the repair reported no critical/major findings. Final `npm test` rebuilt production outputs and passed all 542 tests, zero failures/skips (`review2-tests-final.log`); lint, typecheck, documentation links and working/fixed-base whitespace checks passed. The earlier pre-repair 541-test pass is recorded separately in `review2-tests-01.log`.

## Windows artifact-check repair (2026-10-10)

Coordinator-observed exact-SHA CI run `37995577229` at `3c96d4d` passed the macOS job, while Windows `npm test` passed 535 tests, failed three artifact tests and skipped four existing POSIX-only tests. The failed CI log remains in `ci-37995577229-failed.log`. All five independent review perspectives completed against the fixed base before repair. Quality, implementation and testing confirmed the same defect; simplification and documentation reported no additional findings.

The installed ASAR dependency traverses nested archive paths with host-native separators. The new migration-journal extraction supplied a literal POSIX path, preventing valid Windows archives from reaching their migration/version checks. Both journal and build-version extraction now use native `join`; required resources and migration-entry/version assertions remain intact.

The new regression runs the complete checker against real ASAR archives in isolated child processes with Windows archive-path semantics and host-native external fixture paths. It covers a valid package, missing migration, missing journal, missing journal entry and version mismatch. Before repair, the three affected cases failed at journal lookup, matching CI (`review3-artifact-red.log`). After repair, all 17 artifact checks passed (`review3-artifact-green.log`). This targeted traversal regression on macOS does not establish Windows platform acceptance.

The full `npm test` build passed 548 tests with zero failures/skips (`review3-tests-final.log`). Lint, typecheck, documentation links, a separate production build and Ladle build passed (`review3-lint.log`, `review3-typecheck.log`, `review3-docs.log`, `review3-build.log`, `review3-ladle-build.log`); working/fixed-base whitespace checks also passed. Builds ran sequentially. Every Node/npm command prepended Node 22.21.1 to PATH. The corrected checker also passed against the existing local macOS artifact (`review3-existing-artifact.log`); this is a new resource check, not a fresh package or runtime run.

Only the artifact checker, its regression tests and this evidence report changed. Production service/renderer code, migrations and graphical fixtures remain unchanged; earlier runtime/package/layout evidence retains its original milestone. New exact-SHA macOS/Windows CI acceptance, trackers and integration remain coordinator-owned. Independent #44 and the unchanged normal-shutdown policy remain in force; no push, release, signing, tags or publication occurred.
