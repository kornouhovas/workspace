# workspace-2re implementation checkpoint

Checkout: `/private/tmp/workspace-2re-implementation`, branch `codex/workspace-2re-project-folder-rename`, HEAD baseline `4c2eaa8`. Main checkout remains on its original branch and dirty files are preserved. Baseline tracked binary patch and two untracked UI regression tests were copied into the isolated checkout. Node modules are linked to the original checkout. No Beads mutations, push, merge or commit yet.

## Baseline evidence

Raw `baseline-status.txt`, `baseline-head.txt`, `baseline.patch` record exact state. Selected Status move/order/controller tests: 25 passed. Typecheck and renderer build passed. Full baseline run initially had 2 failures: dashboardStructure stale PanelLeftIcon assertion and creation helper not built in isolated checkout. Built baseline helper and reran full baseline; inspect `baseline-full-tests-built-helper.txt` for final count (dashboardStructure remains a pre-existing failure).

## Implemented checkpoint (not accepted)

Native short-lived Go helper flag `--rename-project-directory` owns physical operations. macOS uses existing mandatory per-process sandbox policy and `renameatx_np(RENAME_EXCL)` with O_NOFOLLOW directory handles. Windows uses existing NTFS ancestry reservations, OBJ_DONT_REPARSE and native handle-relative FileRenameInformation with Replace=false. Windows amd64 cross-build passed; native Windows execution not available.

Backend `src/workspaceProjectRename.js` resolves ID in dispatcher-selected Workspace source. Single-component name validation, exclusive staging rename in same parent, dev/ino preservation and separate atomic settings journal prepared/staged/finalizing/committed. Separate physical commit from metadata publication; recovery rolls staging back before final rename and commits forward after observed final rename. Common mutation/read barrier with Status move rejects repeated requests. Existing JSON adapters remain active. Existing remap helper preserves opaque ID locator, roles for shared sources; property/history/view documents untouched.

9/9 physical macOS profile tests passed (`raw/rename-profile-tests.txt`): Unicode name, contents, opaque ID, properties/history, shared source/restart, old-path occupant isolation, no-op/invalid/conflict, case-only and long-name failure, interruptions at five phases, repeat/concurrent Status move. More adversarial checks remain.

UI implemented in isolated checkout: localized Rename project action in preview/expanded detail; Radix dialog with current name, focus restoration, Cancel/Escape, pending, associated inline error and IME Enter guard. Existing relocation refresh updates opened tabs, preview project, tree, Board/Table projection. Typecheck passed after wiring. Native UI not yet tested; no CUA or alternative UI automation used by implementer. CUA ownership requires coordination.

## Linux concrete blocker

User has explicitly required safe Linux implementation in this task. Fail-closed is not accepted as the finished feature. Current stub is a safety barrier during development only and cannot be presented as support.

Known viable class: path-based mandatory access control such as AppArmor, with write permission only to the selected source's canonical lexical path, mediation of disconnected/deleted paths and no fallback. Unlike Landlock/inode rules, a moved held parent would lose write permission at its new path. Loading a per-source kernel AppArmor profile needs enabled AppArmor, securityfs policy loading and CAP_MAC_ADMIN/root administrative deployment; this is a system policy change prohibited by the current no-global-settings boundary. No action taken. A trusted pre-installed profile/launcher or explicit deployment authorization and native Linux adversarial validation is needed. Landlock, os.Root/openat2 and private bind mount/root handles alone do not prevent an unsandboxed external writer from moving the allowed inode outside the lexical source. There is no native Linux stand on the observed host. Parent coordinator has been sent the concrete decision.

## Remaining work

- Harden helper root/parent identity and journal validation; cover substitutions and external ancestor moves, access errors, finalization target conflicts, rollback/recovery errors.
- Windows native identity/guard validation and adversarial cases (requires native stand).
- Resolve mandatory Linux OS mechanism and deployment boundary; implement/validate if authorized mechanism exists.
- UI native Light/Dark, keyboard focus, pending/error, Board/Table/detail/tabs/tree, view/workspace switch, restart/shared source; screenshots using CUA only.
- Update active API/data model/UI contracts, integrated full quality checks, inspect task diff and commit only task changes relative to dirty baseline.
- Main checkout integration must preserve foreign hunks. Isolated checkout baseline includes foreign changes; stage task delta only (never blanket git add App.tsx/detail/locales/docs).

Temporary resources: implementation and baseline worktrees under `/private/tmp/workspace-2re-*`; native helper Windows cross-build `/tmp/workspace-2re-windows.exe`; auto-cleaned physical fixtures `workspace-rename-*` in OS tmp. Native UI runtime fixture not yet created.

## Updated verified milestone (incomplete overall task)

Isolated implementation Node suite (without archived work tests): 413 total, 412 pass, 1 pre-existing `renderer composes the workspace product shell` in `test/dashboardStructure.test.js` (stale `/PanelLeftIcon/` assertion from foreign dirty baseline). Baseline after helper build: 396 total, 395 pass, same single failure. This result covers the isolated discovery scope; actual main discovery and reconstructed comparison are recorded below. Typecheck, renderer build, Go tests, native sidecar build, Windows cross-build and diff check completed successfully. Renderer keeps the existing bundle-size warning. Optional oxfmt attempt could not load installed native binding; no dependency replacement was performed.

16/16 backend profile tests and 4/4 renderer controller tests cover physical happy path, case-only/long names, properties/history/roles/shared source, persisted row rank JSON, new old-path occupant isolation, five interruption phases, structured error transport, source/staged symlink/replacement, same-source parent replacement, race-created foreign target, simultaneous Status/rename and persistent metadata failure after physical completion. Metadata failure returns explicit recovery-required with verified new locator/name and empty tree; no false success or old file tree.

Native Go tests include internal hook after fstatat identity check and before renameatx_np: late parent/root relocation returns EPERM; late directory/symlink replacement can physically relocate the foreign entry inside the selected source, but postrename inode verification returns ESTALE. Original and foreign contents remain; helper never acknowledges success. Backend ambiguity tests preserve journal/data, leave identity/property metadata unchanged and block discovery across restart. This is retention/recovery, not atomic prevention of every within-source substitution. Independent verifier reviewed and replayed that limitation.

The UI error wrapper was independently verified fixed in rebuilt partial runtime, and expanded Unicode rename/restart/true injected pending were verified. Latest error-input refocus, operation-specific Renaming indicator, shared synchronous pending guard and keyboard reachable pending-details inside modal are implemented and typechecked/built, but final native retest was interrupted by Mac lock/ScreenCaptureKit errors/user-changed UI state. CUA alternatives were not used. Narrow startup launcher exists, but exact narrow native acceptance is not established. Earlier native Light/Dark screenshots and CUA observations are partial evidence, not final acceptance.

AppArmor candidate remains unproven: `attach_disconnected` is explicitly unsafe per primary documentation. Mediate_deleted, VFS/LSM ordering, profile lifetime/removal, literal escaping and detached namespace behavior require proof. No AppArmor loader/profile or global system setting was changed. Linux mandatory implementation and native Linux/Windows stands remain outstanding; refusal stub is an interim safety barrier only. No platform exception was approved.

### Acceptance matrix

| Criterion | Available result | Remaining limitation |
| --- | --- | --- |
| 1 | Real macOS same-parent native CUA rename; content/Status/old path verified | Final main native repeat outstanding |
| 2 | Board/Table/preview/expanded tabs/tree/view switch/shared Workspace/restart in isolated runtime | Final main + latest narrow/native fixes unverified |
| 3 | ID, properties/history JSON, shared roles, rowOrder unchanged, old-path occupant isolation tests | Final UI session/refs broad native acceptance incomplete |
| 4 | Native Cancel/Escape/noop, conflict/traversal/Unicode; profile invalid/long/case-only | Native Windows/Linux behavior not executed |
| 5 | Mac OS guard, no-clobber, late-substitution ambiguity, journal interruptions/postphysical metadata fault | Windows native/Linux safe implementation; final integrated visible recovery UI |
| 6 | Partial Light/Dark/keyboard/focus/pending/error screenshots, expanded/restart | Latest refocus/Renaming/modal details and exact narrow/native capture unavailable |
| 7 | Available boundary checks completed; actual main full Node run has seven reconstructed baseline failures; contracts updated | Milestone commit only; full task acceptance not reached |

### Reproduction

From the integrated main checkout or isolated implementation: `npm run build:sidecar`, `node --test test/workspaceProjectRename.test.js test/workspaceProjectMoveState.test.js`, `GOFLAGS=-buildvcs=false go test ./cmd/workspace-sidecar -run 'TestNativeRenameGuard|TestRenameDirectoryValidation' -count=1 -v`. Expected all profile/native tests pass; each physical fixture is isolated and cleans itself. Full `npm test` on main dirty integrated state discovers historical work tests and has seven failures listed below; isolated implementation discovery has one failure. Then typecheck/build renderer/test:go/build sidecar/diff-check as recorded in raw outputs.

UI fixture source generator: `/tmp/workspace-2re-ui-fixture.mjs`; IDs and original setup: `raw/ui-fixture.json`. Do not rerun over an already renamed fixture. Existing disposable source `/private/tmp/workspace-2re-ui-source`, metadata/userData `/private/tmp/workspace-2re-ui-data`. Launch with `WORKSPACE_DEV=1 WORKSPACE_DEV_DATA=/private/tmp/workspace-2re-ui-data ./node_modules/.bin/electron electron/main.js`. Test-only pending launcher source saved as `raw/pending-launcher-source.txt`, narrow version as `raw/pending-narrow-launcher-source.txt`; place it under checkout/electron to preserve relative imports. Changed-name submit writes `rename-pending` and waits for `rename-release` inside fixture data; write release to allow completion. Remove only those test sentinels between pending scenarios. UI interactions/screenshots exclusively via cua_repl.

Temporary worktrees `/private/tmp/workspace-2re-implementation` and `/private/tmp/workspace-2re-baseline` remain for reproduction. Native test fixtures normally self-delete; verifier-owned replay fixtures are in verifier evidence and were not removed. UI source/data retained for continuation; own Electron runtime can be stopped after verification without removing data. Windows binary `/tmp/workspace-2re-windows.exe` is cross-built only.

Integration relationship: the local milestone commit is on the dedicated isolated branch and contains task changes relative to committed HEAD, excluding foreign dirty hunks. Main stays on its original branch; its working files contain baseline foreign changes plus the task delta. This is a safe working-file integration, not a branch merge/push. Raw `task-delta-manifest.json`, `task-index-manifest.json`, `integration-preservation.json` and commit hashes distinguish integrated file bytes from committed task-only bytes.

## Final main-checkout correction and terminal state

Main integrated `npm test` discovers existing untracked historical test copies under `work/`; it is broader than the first isolated baseline/full run. Actual final main result: **454 tests, 447 pass, 7 fail** (`raw/main-full-node-tests.txt`). Main profile/security/controller: **26/26 pass**; main typecheck, renderer, Go and sidecar build plus diff-check pass. Dedicated staged snapshot typecheck/renderer also pass. The milestone is not a green full-suite or full feature acceptance.

All 7 observed main failures:

- `test/dashboardStructure.test.js`: `renderer composes the workspace product shell`, stale `/PanelLeftIcon/` expectation.
- `work/workspace-4fw/run-20261003-1830/reviewer/dashboard-baseline.test.mjs`: same stale dashboard expectation.
- `work/workspace-4fw/run-20261003-1830/reviewer/dashboard-current.test.mjs`: same stale dashboard expectation.
- `work/workspace-r59/run-20261003/implementer/baseline/workspacePaneKeyboard.test.js`: missing historical relative `implementer/src/workspacePaneKeyboard.js` import.
- `work/workspace-r59/run-20261003/implementer/baseline/workspaceProjectSession.test.js`: missing historical relative `implementer/src/workspaceProjectSession.js` import.
- `work/workspace-ti5/executor/baseline/test__dashboardStructure.test.js`: missing historical `executor/components.json`.
- `work/workspace-ti5/executor/singleline/baseline/test__projectDetailProperties.test.js`: missing historical relative source import.

Existing archived test copies were preserved; no exclusion, fix or removal changed main npm test discovery. A **reconstructed comparator**, run after implementation rather than an initial before-state execution, uses original HEAD plus the saved initial dirty source and unchanged archived tests with their original historical zlj companion sources. Result: **437 tests, 430 pass, 7 fail**, the same seven test locations/error classes as main. Main adds 17 passing tests. See `raw/baseline-full-reconstructed-comparator.txt`, `raw/baseline-archived-test-inventory.json`, and SHA/conditions in `raw/baseline-comparator-conditions.json`.

Two archived 4fw scripts hardcode the absolute main path, so their unchanged copies still read main source in that reconstructed full run. A separate comparator replaces only that root literal with `/private/tmp/workspace-2re-baseline`; both then fail the same `/PanelLeftIcon/` assertion against initial dirty baseline (`raw/baseline-historical-root-remap.txt`, replacement counts/hashes in conditions). This separate instrumentation is explicit and does not alter original historical tests or main. Together these observations reproduce all seven failures against the saved baseline and support that their observed causes predate this task. The earlier incomplete archival run lacked zlj companion sources and is retained as `raw/baseline-full-with-archived-tests.txt`, not cited as the final comparator. The original simpler initial baseline evidence remains intact and is not substituted for actual main results.

Task-only milestone committed locally on `codex/workspace-2re-project-folder-rename`; its final hash/files are in `raw/commit-state.json`. Main remains `codex/workspace-rei-board-column-actions` at original HEAD with integrated task working changes plus untouched original foreign changes. SHA manifests record task integrated/committed bytes and preservation. No push/merge/Beads mutation. Own Electron instances are no longer running according to the final process inventory; UI fixtures and launch sources remain available. **Overall workspace-2re remains incomplete**, pending safe Linux implementation/native Windows+Linux stands and final main/latest UI acceptance. No final platform exception or AppArmor deployment has been authorized/executed by this worker.
