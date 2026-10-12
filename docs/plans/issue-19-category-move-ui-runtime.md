# Issue 19: Actual category move UI runtime acceptance

## Overview

Materialize the preserved runtime stage after the completed local UI slice, separate reviews and actual early Windows UI feedback. Drive the production Table UI through Electron/preload/backend with disposable real SQLite/filesystem fixtures. Complete focused development/package acceptance while preserving all existing runtime checks.

## Context and verified boundary

- Requirement: https://github.com/kornouhovas/workspace/issues/19; Beads workspace-31i.12. Read actual AGENTS.md, docs/development.md, product/decisions/architecture, relevant ADRs and GLOSSARY.md.
- Source draft: work/issue-19/category-move-ui-runtime-future.md, retained from the reviewed Ralphex UI draft. This plan divides that unchanged future stage into three bounded local tasks; do not replan or replay completed service, runner, local UI or independent diagnostics.
- Last reviewed HEAD: 29b348e051c4c02b5388f7d7693710fda50f24ef. Immutable issue base: 4f9f11f785c63a65585ea6f33f167fc438272c64.
- Local UI and review repair completed through d7747967; Windows persistent-sharing test-only repair completed/reviewed through 29b348e0. All executors exited and were reaped, lock free before this materialization.
- Actual early Windows UI gate passed at d7747967, Actions 38237915838: 191/191 category UI tests and 2/2 production App SQLite/native lost-response/remount tests on each Windows OS. Full npm test passed on all three OS. Receipt: work/issue-19/actions-38237915838-inspected.json.
- That Actions run failed all six normal dev/release runtime commands on the obsolete category-only exact accessible cell query and following zero-button contract at scripts/smoke-runtime.mjs:671-672. Cause and EN/RU red/control probe are retained in work/issue-19/runtime-category-cell-diagnosis/diagnosis.json. Current category UI intentionally includes a move action; adapt directly affected fixture assertions without weakening exact authored category/metadata/filesystem checks.
- Exact-SHA Actions 38240008030 for the separate test-only repair is coordinator-owned and monitored independently. It is not graphical category acceptance and the obsolete runtime fixture remains pending there.
- Existing patterns: scripts/smoke-project-rename-ui.mjs, smoke-runtime.mjs, runtime-evidence.mjs, runtime-startup.mjs, runtime-lifecycle.mjs, runtime-layout.mjs and tests/project-rename-runtime.test.mjs.
- Reuse tests/fixtures/project-category-move-crash-worker.mjs at its actual supported checkpoint names. No new production injection seam.
- Use Node 22.21.1 explicitly inside every shell: /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin. Preserve global settings and run-local model/effort.

## Boundaries and approach

- Matt Pocock implement/tdd at already agreed production UI/typed-client, actual Electron disposable SQLite/filesystem, and existing driver-owned fixture/evidence seams.
- Keep React thin; service authorization, native one-hop no-replace, journals/reservations, migrations, IPC contracts and dependencies remain unchanged.
- Add no category creation/rename/deletion, generic mutation framework, mutation replay, native selection gate or new production failure-injection API.
- Preserve existing CI matrices/native gates/full-suite service checkpoint transport and failure/skip/unreached semantics. Existing normal dev/release routes carry the new driver after existing acceptance and cleanup; do not duplicate runtime runs.
- Preserve finite deadlines and strict normal graphical quit/backend exit/owned cleanup. Controlled interruption is labeled fixture preparation, not a normal shutdown. Forced cleanup never establishes acceptance.
- Filesystem/SQLite non-atomicity, path substitution and power-loss limitations remain unchanged. Issue44 and unrelated Finder/Explorer selected-item release acceptance stay separate; do not invent a Reveal gate for category move.
- Each task commits only verified explicit paths. No executor push, merge, signing/release, Actions or tracker writes.
- Collect compact named results and input identities under distinct ignored work/issue-19/category-move-ui-runtime/ directories; retain historical failures and source logs.

## Implementation Steps

### Task 1: Add real grouped category UI fixture and rejection coverage

Files:
- Create scripts/smoke-project-category-move-ui.mjs.
- Create tests/project-category-move-runtime.test.mjs.
- Modify scripts/runtime-evidence.mjs.
- Modify scripts/smoke-runtime.mjs.

- [x] Seed owned disposable grouped source, sibling and unrelated configurations with real SQLite, project tree/sentinel bytes, exact Text, category labels/settings/views and native identity. Use existing service/build inputs only after verifying continuity; do not build/clean while any fixture consumes dist.
- [x] Add --category-move routing and a finite dedicated production UI driver. Add the driver to normal dev/release only after existing baseline and rename acceptance/cleanup. Reuse finite startup, lifecycle, layout and executable helpers.
- [x] Perform real category changes through production UI/preload/backend. Verify logical/native identity, exact basename/full no-follow tree and bytes, Text, independent labels/settings/views, same-source sibling updates and unrelated-source isolation after normal restart.
- [x] Exercise current-category validated no-op and occupied/unavailable destination rejection through actual UI. Verify occupied destination bytes survive and no unauthorized effect occurs.
- [x] Repair directly affected existing category-cell runtime selectors/assertions from the retained diagnosis. Bind to the intended project/category, preserve exact authored category text and metadata-only label checks, assert the intended eligible move action and retained/direct restrictions instead of the obsolete blanket zero-button assumption. Add a red-capable behavioral regression at the existing production UI/driver seam before fixing; do not freeze source text.
- [x] Add named finite acceptance evidence and behavioral tests for fixture preparation, read-only reopen and strict shape/input identity. Failed/skipped/unreached required assertions cannot pass. This intermediate task does not claim final recovery or platform acceptance.
- [x] Run focused runtime/evidence/UI tests, typecheck, targeted lint and git diff --check with Node22. Record actual commands/exits and continuity; commit verified task paths. Do not run full npm test or package yet.

Task 1 verification (local macOS arm64, Node 22.21.1):
- Exit 0: focused runtime/evidence/startup/lifecycle tests (62 passed, zero skips); focused category/creation/rename/recovery/components UI tests (530 passed, zero skips); typecheck; targeted ESLint; `git diff --check`.
- The original category-cell contract produced two expected EN/RU behavioral failures before repair at the production table seam. Duplicate basenames in different categories and same-category sibling rows now pass with exact authored text and the intended eligible action; retained grouped/direct restrictions also pass. Full original dev/release routes remain Task 3 checks.
- Exit 0: `WORKSPACE_SMOKE_EVIDENCE_DIR=work/issue-19/category-move-ui-runtime/task1/dev-final npm run smoke:runtime -- dev --category-move`. All named grouped EN/RU stages passed, including real SQLite/filesystem moves, validated current-category no-op, occupied/unavailable rejection, native/logical identity and full no-follow bytes, sibling/isolation, independent metadata/views, restart persistence, four normal graphical quits/backend exits and independently confirmed fixture removal. Thirty layout screenshots were retained; narrow EN/RU editors were visually inspected.
- Runtime source revision: `96abda52ac357b5fbaa936dde190bc9e32636cdf` plus the task working-tree inputs identified by SHA-256 `80b11e99a50dec6ae5476e107d2dbf5d899578f83d7e94eb85fd81998b9416bb`. Every emitted service/backend/main/preload bundle was compared with current source in memory; migrations matched exactly and renderer source/configuration matched the reviewed build. No build/clean/package/full-suite command was run. Final runtime input hashes were rechecked unchanged.
- Full commands/exits, preserved fixture failures, identity manifest and runtime receipt: `work/issue-19/category-move-ui-runtime/task1/verification.json`, `input-continuity.json`, `dev-final/dev-category-move-inputs.json` and `dev-final/dev-category-move-observations.json`. These ignored receipts establish this intermediate local slice only; recovery, integrated development/package routes, separate review and final exact-SHA Windows acceptance remain pending.

### Task 2: Drive explicit UI recovery after controlled process interruptions

Files:
- Modify scripts/smoke-project-category-move-ui.mjs.
- Modify tests/project-category-move-runtime.test.mjs.
- Modify scripts/runtime-evidence.mjs only for the finite recovery evidence contract.

- [x] Reuse the existing crash worker for intent, native_effect, destination_evidence and commit boundaries, plus a separate original-placement keep_original case. Preserve ownership and bounded worker exit; do not add a production injection seam.
- [x] Prove actual UI startup/list/status stays read-only and never replays effects. Drive retry_original, complete_destination and keep_original only through actual UI using fresh preview and advertised action; verify durable status, exact identities/data and persisted outcome after normal restart.
- [x] Record controlled preparation separately from production UI recovery. Require every named recovery checkpoint, all three explicit actions, normal graphical shutdown, backend exit and independently confirmed owned cleanup. Terminal commit status needs no recovery mutation and must not invent one.
- [x] Extend red/green behavioral driver/evidence regressions for missing/wrong/failed/skipped/unreached assertions and input identity, without copying helper implementation or relaxing original scenario gates.
- [x] Run focused runtime/evidence/UI regressions, typecheck, targeted lint and diff check. Reuse unchanged Task1 results only with verified input continuity. Record evidence and commit verified paths; no full suite or package yet.

Task 2 verification (local macOS arm64, Node 22.21.1):
- Exit 0: focused runtime/evidence/startup/lifecycle tests (65 passed, zero skips); focused category/creation/rename/recovery/components UI tests (530 passed, zero skips); typecheck; targeted ESLint; `git diff --check`.
- Red/green behavioral regressions retained: absent recovery evidence and missing interruption driver each failed before implementation. Final tests reject every missing/failed/skipped/pending/unreached recovery assertion, incorrect preparation/checkpoint/action/outcome, insufficient normal shutdowns and changed input identity. Actual worker tests cover all four durable boundaries, read-only reopen, wrong/early checkpoint rejection and owned termination.
- Exit 0: `WORKSPACE_SMOKE_EVIDENCE_DIR=work/issue-19/category-move-ui-runtime/task2/dev-first npm run smoke:runtime -- dev --category-move`. Both languages passed all five named recovery cases after the existing grouped move/rejection checks. Startup, production list/status controls, repeated reads, fresh UI preview and normal restart preserved exact journal/metadata/tree bytes before explicit recovery. The production UI advertised and submitted retry_original, complete_destination and keep_original; committed operations offered no recovery mutation. Final receipts, UUID/native identity, exact basename/no-follow tree/Text, sibling state, independent labels/settings/views and unrelated-source isolation persisted after restart.
- All ten interruption workers exited after acknowledged controlled fixture preparation, without finally cleanup. Separately, 34 production Electron sessions quit normally with backend exit; owned fixture removal was independently confirmed. Fifty-four screenshots were retained; narrow EN/RU recovery screens were visually inspected.
- Runtime source revision: `a35ce72145b31fc796fa98af62063d675427c69f` plus the task working-tree inputs identified by SHA-256 `0a1484ff8e6ac4b7a8cb720bad521ca808bc2aac3f37338e2e170750c68d69be`. Four emitted service/backend/main/preload bundles again matched current source in memory, migrations matched exactly, and all 201 Task1 prerequisite hashes remained unchanged. Final runtime hashes were independently rechecked unchanged. No build, clean, full suite or package command was run.
- Full commands/exits, red/green logs, continuity manifest and runtime receipt: `work/issue-19/category-move-ui-runtime/task2/verification.json`, `input-continuity.json`, `final-inputs.json`, `dev-first/dev-category-move-inputs.json` and `dev-first/dev-category-move-observations.json`. Task3 integration/development/package checks, separate review and final exact-SHA Windows acceptance remain pending.

### Task 3: Integrate CI, complete development/package checks and document acceptance

Files:
- Modify .github/workflows/desktop-ci.yml only for focused category layout execution and failure-preserving artifact retention.
- Create docs/verification/issue-19-category-move-ui.md.
- Modify docs/development.md and docs/architecture.md.
- Modify README.md only where current user-facing capability guidance needs updating.
- Modify tests/project-category-move-runtime.test.mjs and directly affected existing CI-shape regression only if integration actually changes that contract.
- Modify this plan for completion evidence and archive when complete.

- [x] Preserve existing CI matrices, native gates, sanitized full-suite transport, and existing regular dev/release runtime checks. Add focused category layouts/evidence retention without duplicating the runtime driver in extra jobs.
- [x] Run focused UI/runtime regressions and typecheck, then full npm test once for final integrated inputs, npm run lint, npm run check:docs and git diff --check. Record counts and platform-only skips. If a new failure requires a code change, verify its affected boundary before repeating only justified checks.
- [x] Reuse existing Ladle150 evidence when all its source/build inputs are unchanged. Build Ladle/rerun focused category layouts only if their inputs changed. CI routing changes alone do not invalidate unchanged local screenshots.
- [ ] Sequentially run npm run smoke:runtime -- dev --category-move, create a fresh macOS artifact with CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac, then npm run smoke:runtime -- release --category-move. Distinct ignored evidence directories; no concurrent clean/build while fixture consumes dist.
- [x] Re-run the original normal dev and release smoke commands sequentially after fixing the category-cell fixture. Those routes must complete existing baseline and rename plus new category driver, with actual normal quit/backend exit/cleanup. Reuse a dedicated-driver receipt only when exact inputs and the wrapper contract justify it; do not claim original scenario passed from the --category-move shortcut.
- [x] Inspect changed screens EN/RU and preserve named assertions, input revisions, all recovery checkpoints, normal lifecycle and owned fixture cleanup. Failed/unreached/skipped required stages remain failures.
- [ ] Document implemented behavior, actual commands/results/input revisions, reused prerequisite receipts and pending exact-SHA Windows/final issue gates. Historical failure causes stay limited to proven evidence. Validate links/diff, commit only verified task files and archive this plan with valid links.

Task 3 partial verification (local macOS arm64, Node 22.21.1):
- Verified CI integration: one focused category layout step in the unchanged three-OS verification matrix, failure-preserving artifact retention, unchanged original runtime/native/service/full-suite routes. The new CI routing regression failed before integration; the directly affected existing CI-shape expectation then failed until its expected step/artifact path was updated. Final focused runtime/CI tests passed 64 with zero skips; all 530 affected UI cases passed with unchanged UI inputs.
- Exit 0: typecheck, one full npm test (2476 passed, 20 actual Windows-only skips, zero failures), lint, documentation links and diff checks. All 201 Task 2 prerequisite hashes matched before the clean build. The 150 reviewed Ladle screenshots were reused only after verifying unchanged renderer/Ladle/package/layout-driver inputs from d7747967; no duplicate local Ladle build/run.
- Exit 1: first `npm run smoke:runtime -- dev --category-move`. EN grouped/rejection/restart and all EN recovery cases passed, but RU currentCategory timed out waiting for the exact no-op confirmation. The preserved screenshot displays the localized guarded completion message; later RU assertions remain unreached. Owned process/fixture cleanup passed. The precise observation/revision source remains unproven in `task3/diagnosis.json`; the UI/driver and assertion remain unchanged. This required dedicated development gate is not complete.
- Exit 0, sequential after confirmed cleanup: fresh unsigned macOS development artifact and artifact-content checks; dedicated release category driver; original normal dev; original normal release. Each successful category receipt passed every EN/RU named assertion and all five recovery cases per language, 34 normal graphical quits/backend exits and independently confirmed owned fixture removal. Each original route separately passed baseline (4 normal sessions), rename (46) and category (34); no shortcut substitutes for baseline/rename acceptance. EN/RU narrow recovery screens were visually inspected.
- Runtime source revision: b086725cfddcc38e1f97d3b896f306285400c3d4 plus identified working-tree inputs. The failed dedicated dev digest is 16825934eb226eab28a870a2594fa28f3eb684fa700cef789beab5cf707267a9; normal dev digest is 589ee9c5caa4164ad970cc5a05e796292e04d763d85407d5cad21d40375c7999. Only two rebuilt native binaries differ between those dev input sets. Dedicated and original normal release use the same digest e4c1e4b37e2e5e225e9d4e4a3d71b883a171ed51734ddda7bbb425635560e042. Successful category input hashes were independently rechecked unchanged after all runs.
- Full commands/exits, logs, named receipts, screenshot inspection and prerequisite/input comparisons: `work/issue-19/category-move-ui-runtime/task3/verification.json`, `runtime-commands.json`, `diagnosis.json`, `prerequisite-continuity.json`, `dev-input-comparison.json` and each distinct runtime directory. See [the UI runtime report](../verification/issue-19-category-move-ui.md). CI/documentation changes are verified and committed; Task 3 and plan archival remain incomplete because the dedicated dev failure needs bounded coordinator diagnosis/repair and original-scenario verification. Final review, exact-SHA Windows graphical acceptance and whole-issue delivery remain separate coordinator gates.

## Coordinator-owned delivery

After execute, run separate Ralphex review and Matt Standards/Spec review of the actual final SHA, inspect diff/receipts and required checks, then authorized push. Monitor exact-SHA Actions to completion and inspect required artifacts, original scenarios, failures/skips/unreached states. Actual Windows graphical category driver acceptance is still pending until that final run, even though early UI tests passed. Complete Issue19 only after its full criteria and required delivery are verified. No main merge.
