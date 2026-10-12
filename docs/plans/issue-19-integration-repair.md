# Issue 19: Complete runner and category runtime integration

## Scope and evidence

Continue from `0c4e9c243105ad840bc564d1d5c28d0b536e3e36` after the previous executor was stopped and reaped at its failed Task 3 boundary. Its verified CI/docs work is committed; the original [runtime plan](issue-19-category-move-ui-runtime.md) remains incomplete. Preserve all finished service/UI/runtime implementation and failed receipts.

This plan materializes three coordinator-inspected, read-only Ralphex drafts:

- `work/issue-19/observer-output-identity-diagnosis/reviewed-planning.json`: two observer tasks.
- `work/issue-19/fixture-fresh-preview-diagnosis/reviewed-planning.json`: one fixture preparation task.
- `work/issue-19/category-noop-acknowledgment-diagnosis/reviewed-planning.json`: one acknowledgment task.

Task 5 completes only the pending verification/documentation from the original runtime Task 3. It does not repeat Tasks 1/2 or package unchanged product inputs.

Issue base stays `4f9f11f785c63a65585ea6f33f167fc438272c64`; last reviewed SHA stays `29b348e051c4c02b5388f7d7693710fda50f24ef` until a successful separate review. The requested runner commit `3b07406115e6eef1ef09f3ebef2959939e87bf78` was imported as `6efb4757cb4752248b48d702b2b2e239a4f41998` and is in use. Preserve its ownership and phase contracts.

Failed Actions: run `38240008030`, attempt 1, exact `29b348e051c4c02b5388f7d7693710fda50f24ef`. The complete scoped inspection is `work/issue-19/actions-38240008030-inspected.json`. Both actual Windows persistent-sharing scenarios, all 191 category UI tests plus two App/SQLite/native tests per OS, six category artifacts and four dedicated observer artifacts have been inspected. Full CI failed; those results do not establish whole-issue acceptance.

## Boundaries

- Historical inode IDs, scheduling, fixture second reply and runtime observer/revision sequence were not retained. The ignored diagnosis records distinguish original failures from controlled mechanisms; keep original attribution unproven.
- No production renderer/service/contracts/native/dependencies/CI policy changes. Keep thin React, selected-source authorization, existing filesystem limitations, single explicit mutation and no replay.
- Keep real observers active; no sleeps, deadline increases, automatic mutation retries, broader success unions or skipped acceptance.
- Use Node 22.21.1 and run-local gpt-6.1-sol/high. Global configuration, push, merge, trackers and Actions interpretation belong to the coordinator. No merge to main.
- Capture finite commands/exits, red/green logs and input identities in distinct ignored evidence directories. Do not build/clean while a fixture consumes outputs. Reuse passed unchanged inputs with proof.
- Commit each completed verified task using explicit paths. At failure retain the partial state and return ownership; the local supervisor blocks automatic failed-task replay.

### Task 1: Preserve full-width observer output identities

Files: `scripts/ralphex-observe.mjs`, `tests/ralphex-observe.test.mjs`, this plan.

- [x] Add public `observe` regressions injecting distinct full-width inode IDs `9007199254740992n` and `9007199254740993n`. Retain exact red results for foreign cursor-lock refusal expecting EEXIST and terminal publication with all five foreign cursor identity keys. Preserve source/cursor/foreign-lock bytes, reach the snapshot seam, retain source_mismatch and zero heartbeat transport.
- [x] Change only output-validation stat reads to `{ bigint: true }`, comparing complete device/inode strings. Preserve canonical paths, derived reserved outputs, real hardlink/symlink and equal full-width identity refusal, foreign lock protection and non-ENOENT error propagation. Exercise meaningful negatives.
- [x] Deliberately retain existing log stat/file.stat and persisted version-1 logIdentity semantics. Verify existing cursor continuation; document that rounded log identity continuity is outside this minimal repair, without migrating or invalidating old cursors.
- [x] Run focused observer regressions, then existing observer/runner/Windows-diagnostic tests under a finite process bound. Record actual results and causal limits; commit verified Task 1 paths.

Task 1 local evidence (macOS, Node 22.21.1): `work/issue-19/task-1-output-identity-20261012/`. Every recorded command has a 60-second process bound; `*-command.json` retains exact arguments and exits, and `input-identity.json` retains source hashes and the starting HEAD `431b1b98e393cfb426d76c4fff222753d97b8931`.

- Before the production change, `node --test --test-name-pattern='distinct full-width inode IDs' tests/ralphex-observe.test.mjs` exited 1: all six controlled regressions failed (`red.log`). The foreign lock returned the observer-owned validation error instead of EEXIST; all five foreign cursor keys failed before reaching snapshot publication.
- After the single validation-stat change, the focused identity/publication/alias/continuation selection exited 0 with 20/20 tests and no skips (`focused-green.log`). Equal full-width device/inode pairs still refuse outputs; distinct full-width devices remain distinct even with equal inodes. Real hardlinks, file/directory symlinks, reserved derived paths and EACCES/EIO propagation retain their protections.
- `node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs tests/windows-native-view-diagnostics.test.mjs tests/windows-product-diagnostics.test.mjs tests/windows-selection-diagnostics.test.mjs tests/windows-rename-diagnostics.test.mjs` exited 0: 193 passed, 0 failed, 8 existing Windows-host-only controls skipped on macOS (`observer-runner-windows.log`). Those skips do not establish Windows acceptance.
- Affected ESLint, `node scripts/check-doc-links.mjs` and `git diff --check` exited 0 (`lint.log`, `docs.log`, `diff.log`). No product build/package inputs changed and no build or runtime acceptance is claimed.

Only output-validation stat reads use BigInt. Log stat, opened-file stat and persisted version-1 `logIdentity` deliberately keep their existing Number semantics; the continuation regression preserves the rounded `1:9007199254740992` identity across two public observations without migration or cursor invalidation. Rounded log identity continuity remains outside this minimal repair. Controlled rounding is reproduced and repaired; historical Windows identities were not retained, so attribution of Actions run `38240008030` remains unproven and exact-SHA Windows acceptance stays coordinator-owned. At the Task 1 handoff, Task 2 timing controls and all later sections remained unexecuted.

### Task 2: Isolate heartbeat alias test time

Files: `tests/ralphex-observe.test.mjs`, `docs/ralphex.md`, this plan.

- [x] Add a scoped deterministic test clock retaining the original 90ms budget. Hold time through valid capability verification/renewal; advance to the deadline on the second actual snapshot read. Preserve physical-worktree selection, exact bd arguments, identified ownership and source-byte assertions.
- [x] Add explicit expiry after valid help (120ms advance), requiring lease_lost and zero renewal calls, plus renewal failure and success/rejection/thrown-assertion restoration controls. Restore Date.now/filesystem mocks in finally and synchronize builtin exports; subsequent observations must remain independent.
- [x] Preserve production lease/request/polling policy. Run existing diagnostic prepare/diagnostic/tests/validate commands using their actual supported CLI and an ignored evidence directory; inspect strict sanitized schemas and finite exits. Run affected lint/docs/diff checks; update output identity scope and timing/attribution limits in docs/ralphex.md. Commit verified paths.

Task 2 local evidence (macOS, Node 22.21.1): `work/issue-19/task-2-heartbeat-clock-20261012/`. Commands retain numeric exits, exact arguments, a 110-second outer process bound and full logs in `*-command.json`; the existing diagnostic test supervisor retains its unchanged 90-second deadline. `input-identity.json` records starting HEAD `838d077d35745442c068ddedbe1ed6dc67204825` and source hashes. `inspection.json` confirms unchanged observer/transport/runner/diagnostic production inputs, dependency inputs and other focused test files, diagnostic stdout/persisted equality and the test-status/TAP result. An initial inspection incorrectly expected JSON at the end of the tests command's TAP output; it failed before recording completion and was corrected (`inspection-initial-rejected.json`).

- Before the test repair, the retained public-boundary probe with `ISSUE19_HB_PROBE=expired` exited 1: advancing 120 ms after valid help produced `lease_lost` where the original alias assertion expected `deadline` (`red.log`). This is an injected scheduling mechanism, not a replay or attribution of historical macOS scheduling.
- The focused `node --test --test-name-pattern='heartbeat.*(alias|physical repository)' tests/ralphex-observe.test.mjs` exited 0: 6 passed, 0 failed/skipped (`focused-green.log`). The ordinary alias test holds time through exactly one help/renewal pair, advances after the second real snapshot read and ends at 90 ms. Explicit 120 ms help expiry makes zero renewal calls; renewal status 7 fails before a second snapshot. Success, rejected observation and thrown assertion restore clock/filesystem/builtin exports and permit an independent observation.
- Actual `windows-observer-diagnostics.mjs prepare`, `diagnostic`, `tests` and `validate` commands exited 0 with their supported `--output` arguments. Both diagnostic cases are identified ordinary deadline observations with unchanged inputs, removed fixtures and a successful owned-child exit. The unchanged tests supervisor ran observer/runner/diagnostic suites: 121 passed, 0 failed/skipped (`diagnostic-tests.log`). Strict sanitized schema/provenance validation passed; no schema or production deadline was widened.
- Affected ESLint, `npm run check:docs` and `git diff --check` exited 0 (`lint.log`, `docs-final.log`, `diff-final.log`). Only observer tests, the run guide and this plan changed. No product build/package/runtime checks are claimed; exact-SHA Windows and whole-run acceptance, separate review and historical attribution remain coordinator-owned. Tasks 3–5 remain unexecuted.

### Task 3: Prepare fixture observation before recovery review

Files: `tests/fixtures/project-category-move-service-electron.cjs`, `tests/project-category-move-coordination.test.mjs`, `tests/project-category-move-fixture.test.mjs`, this plan.

- [ ] Use the corrected real-service/SQLite/filesystem probe to retain final-helper red from a newer source observation between fresh review and the one final chosen action. Count only observationRevision newer than the actual getSourceObservation baseline; cached subscription replay is not a new invalidation. Preserve exact no-effect oracles.
- [ ] After controlled external return and before constructing initial recovery review, use the existing selected-source refreshSource request. Share a test-owned helper only when necessary. Independently compare complete retained tables/receipts, no-follow tree entries/bytes/native identities, Text/settings/views and effect events before/after. Only observation acknowledgment may change; no move/recovery/replay occurs during preparation.
- [ ] Prove preparation at the actual Electron fixture seam. Unchanged observer passes/replayed cached events must not create a newer revision. Ordinary recovery uses one action; the controlled first-stale case uses two submissions and one fresh preview. Preserve second-stale, other/unknown/malformed replies, changed state/bytes/actions/identity rejection and all deliberate negatives. No extra restart or observer disabling; keep four successful utility exits.
- [ ] Verify source/output/migration/native/dependency continuity, then affected coordination/fixture tests and one actual recovery-preview-success Electron checkpoint with 12/12 scenarios, four exits, ordered handshake, shutdown and removal. Run affected lint/docs/diff checks; retain original macOS scenario as pending until exact-SHA CI. Commit verified paths.

### Task 4: Require durable proof for guarded UI acknowledgments

Files: `scripts/smoke-project-category-move-ui.mjs`, `tests/project-category-move-runtime.test.mjs`; `tests/project-category-move-ui.test.tsx` only for the actual component regression seam; this plan.

- [ ] Reuse the retained actual DiscoveryWorkspace EN/RU red/control probe. Add committed driver/component regressions for neutral and in-flight sourceObserved completion, preserving one chosen submission, exact Name/Text/list and editor detachment. The existing renderer guard is legal and must remain unchanged.
- [ ] Immediately before current-category Enter, capture immutable selected workspace/source/project/category/name/path/revision, complete owned journal, metadata, source/unrelated no-follow trees, sibling/unrelated typed projections, Text/settings/views and projectsChanged events. Require exactly one new operation and unchanged existing rows; correlate every immutable binding to the actual UI action, never merely the latest row.
- [ ] Through the existing typed preload query, read that exact operation. Require ok/unchanged/completed/resultKind unchanged/problem null/lastVerifiedPlacement original; completedRevision and expectedRevision equal the captured revision; original/destination category and paths equal the captured current placement. Every project receipt field and durable operation binding must match exactly. Check stored native evidence, unchanged independent state and no extra events; repeat read-only checks to reject replay/subsequent operations.
- [ ] Only after authoritative proof, accept the exact ordinary no-op acknowledgment or existing guarded completion acknowledgment and require editor detachment. Absent/malformed/foreign/nonterminal/moved/revision/placement mismatches, additional or modified operations, changed SQLite/filesystem/events and guard text without proof must fail. Preserve every named acceptance stage.
- [ ] Apply the same directly affected acknowledgment discipline to normal move/recovery completion waits while retaining their separate exact expected outcome, correlated existing/new journal operation, one authored action and independent preservation/event/restart oracles. Keep keep_original's exact rejected/kept_original assertion. No generic framework or success union.
- [ ] Run focused runtime/evidence/UI behavior tests and affected lint/type/docs/diff checks. Against verified fresh production inputs, run the original dedicated dev category command once after the meaningful repair in a new evidence directory. Require all EN/RU stages, five interruptions per language, 34 normal quits/backend exits and fixture removal. Record input/operation receipts, retain the original failed run and commit verified task paths.

### Task 5: Complete pending runtime verification and documentation

Files: `docs/verification/issue-19-category-move-ui.md`, `docs/development.md`, `docs/architecture.md`, `README.md`, original runtime plan and this plan; driver/test changes only to resolve a concrete affected failure within Task 4 scope.

- [ ] Resume only the original runtime Task 3 pending checks. Verify exact product build/package inputs against the fresh Task 3 package and renderer receipts. Reuse package creation, artifact-content checks and 150 Ladle captures only when their inputs remain unchanged. Rebuild/repackage only for a demonstrated product-input change; no concurrent fixture/build.
- [ ] New driver code changes its verification inputs: run dedicated release and original normal dev/release sequentially with distinct evidence, completing baseline/rename/category routes and inspecting strict named outcomes, normal shutdown/backend exit and cleanup. Reuse Task 4's dedicated dev result only on exact unchanged inputs. Preserve startup-failure cleanup as its own expected case, not a normal successful application session.
- [ ] Inspect final EN/RU narrow actual runtime captures and the current shortened copy. Update verification docs with actual source revisions, commands/exits, input continuity, prior failed results, reused product/package/Ladle evidence and pending exact-SHA Windows/final issue gates. Do not attribute historical failures to the candidate robustness repairs.
- [ ] Confirm all executable items in the original runtime plan are actually satisfied; mark only those checked. Validate docs links and git diff --check. Commit verified documentation and archive both completed plans with valid links. Keep issue completion, external CI and publication outside executable checkboxes.

## Coordinator delivery gates

After successful execution, immediately run separate Ralphex review from last reviewed `29b348e051c4c02b5388f7d7693710fda50f24ef`, widened over all unreviewed graphical runtime, observer, fixture and documentation changes. Collect independent Matt Standards and Spec perspectives, resolve confirmed findings and inspect final receipts/input continuity.

Then perform the authorized push of `codex/issue-19-category-move`. Identify Actions by exact pushed SHA/run/attempt, monitor completion and inspect required actual Windows/macOS jobs and artifacts, including original runner and graphical category scenarios. A skip or probe alone is not OS acceptance. The independent existing Windows creation/Reveal failure remains unproven and separately diagnosed; do not invent a native Reveal requirement for category move or conflate it with Issue 44 shutdown.

Complete Issue 19 and its linked execution step only when their actual criteria and authorized delivery are satisfied. Report use of the requested new runner and the actual Actions URL. Do not merge main.
