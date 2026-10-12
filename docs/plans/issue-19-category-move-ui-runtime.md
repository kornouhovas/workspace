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

- [ ] Seed owned disposable grouped source, sibling and unrelated configurations with real SQLite, project tree/sentinel bytes, exact Text, category labels/settings/views and native identity. Use existing service/build inputs only after verifying continuity; do not build/clean while any fixture consumes dist.
- [ ] Add --category-move routing and a finite dedicated production UI driver. Add the driver to normal dev/release only after existing baseline and rename acceptance/cleanup. Reuse finite startup, lifecycle, layout and executable helpers.
- [ ] Perform real category changes through production UI/preload/backend. Verify logical/native identity, exact basename/full no-follow tree and bytes, Text, independent labels/settings/views, same-source sibling updates and unrelated-source isolation after normal restart.
- [ ] Exercise current-category validated no-op and occupied/unavailable destination rejection through actual UI. Verify occupied destination bytes survive and no unauthorized effect occurs.
- [ ] Repair directly affected existing category-cell runtime selectors/assertions from the retained diagnosis. Bind to the intended project/category, preserve exact authored category text and metadata-only label checks, assert the intended eligible move action and retained/direct restrictions instead of the obsolete blanket zero-button assumption. Add a red-capable behavioral regression at the existing production UI/driver seam before fixing; do not freeze source text.
- [ ] Add named finite acceptance evidence and behavioral tests for fixture preparation, read-only reopen and strict shape/input identity. Failed/skipped/unreached required assertions cannot pass. This intermediate task does not claim final recovery or platform acceptance.
- [ ] Run focused runtime/evidence/UI tests, typecheck, targeted lint and git diff --check with Node22. Record actual commands/exits and continuity; commit verified task paths. Do not run full npm test or package yet.

### Task 2: Drive explicit UI recovery after controlled process interruptions

Files:
- Modify scripts/smoke-project-category-move-ui.mjs.
- Modify tests/project-category-move-runtime.test.mjs.
- Modify scripts/runtime-evidence.mjs only for the finite recovery evidence contract.

- [ ] Reuse the existing crash worker for intent, native_effect, destination_evidence and commit boundaries, plus a separate original-placement keep_original case. Preserve ownership and bounded worker exit; do not add a production injection seam.
- [ ] Prove actual UI startup/list/status stays read-only and never replays effects. Drive retry_original, complete_destination and keep_original only through actual UI using fresh preview and advertised action; verify durable status, exact identities/data and persisted outcome after normal restart.
- [ ] Record controlled preparation separately from production UI recovery. Require every named recovery checkpoint, all three explicit actions, normal graphical shutdown, backend exit and independently confirmed owned cleanup. Terminal commit status needs no recovery mutation and must not invent one.
- [ ] Extend red/green behavioral driver/evidence regressions for missing/wrong/failed/skipped/unreached assertions and input identity, without copying helper implementation or relaxing original scenario gates.
- [ ] Run focused runtime/evidence/UI regressions, typecheck, targeted lint and diff check. Reuse unchanged Task1 results only with verified input continuity. Record evidence and commit verified paths; no full suite or package yet.

### Task 3: Integrate CI, complete development/package checks and document acceptance

Files:
- Modify .github/workflows/desktop-ci.yml only for focused category layout execution and failure-preserving artifact retention.
- Create docs/verification/issue-19-category-move-ui.md.
- Modify docs/development.md and docs/architecture.md.
- Modify README.md only where current user-facing capability guidance needs updating.
- Modify tests/project-category-move-runtime.test.mjs and directly affected existing CI-shape regression only if integration actually changes that contract.
- Modify this plan for completion evidence and archive when complete.

- [ ] Preserve existing CI matrices, native gates, sanitized full-suite transport, and existing regular dev/release runtime checks. Add focused category layouts/evidence retention without duplicating the runtime driver in extra jobs.
- [ ] Run focused UI/runtime regressions and typecheck, then full npm test once for final integrated inputs, npm run lint, npm run check:docs and git diff --check. Record counts and platform-only skips. If a new failure requires a code change, verify its affected boundary before repeating only justified checks.
- [ ] Reuse existing Ladle150 evidence when all its source/build inputs are unchanged. Build Ladle/rerun focused category layouts only if their inputs changed. CI routing changes alone do not invalidate unchanged local screenshots.
- [ ] Sequentially run npm run smoke:runtime -- dev --category-move, create a fresh macOS artifact with CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac, then npm run smoke:runtime -- release --category-move. Distinct ignored evidence directories; no concurrent clean/build while fixture consumes dist.
- [ ] Re-run the original normal dev and release smoke commands sequentially after fixing the category-cell fixture. Those routes must complete existing baseline and rename plus new category driver, with actual normal quit/backend exit/cleanup. Reuse a dedicated-driver receipt only when exact inputs and the wrapper contract justify it; do not claim original scenario passed from the --category-move shortcut.
- [ ] Inspect changed screens EN/RU and preserve named assertions, input revisions, all recovery checkpoints, normal lifecycle and owned fixture cleanup. Failed/unreached/skipped required stages remain failures.
- [ ] Document implemented behavior, actual commands/results/input revisions, reused prerequisite receipts and pending exact-SHA Windows/final issue gates. Historical failure causes stay limited to proven evidence. Validate links/diff, commit only verified task files and archive this plan with valid links.

## Coordinator-owned delivery

After execute, run separate Ralphex review and Matt Standards/Spec review of the actual final SHA, inspect diff/receipts and required checks, then authorized push. Monitor exact-SHA Actions to completion and inspect required artifacts, original scenarios, failures/skips/unreached states. Actual Windows graphical category driver acceptance is still pending until that final run, even though early UI tests passed. Complete Issue19 only after its full criteria and required delivery are verified. No main merge.
