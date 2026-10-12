# Issue 19: Category move UI runtime verification

## Implemented boundary

The production Table category editor routes through the typed client, narrow preload and Electron utilityProcess backend. Eligible active grouped projects move into an existing same-source category with an unchanged basename and UUID. Current-category assignments are freshly validated no-ops; occupied and unavailable destinations reject without unauthorized effects. Explicit status and fresh service-advertised recovery preserve interrupted operation ownership. Direct/retained rows keep their restrictions and Text remains usable.

The driver uses disposable real SQLite and no-follow project trees with sentinel bytes, independent labels/settings/views, same-source siblings and an unrelated source. It checks logical/native identity, exact authored Name/Text and filesystem bytes after normal restart. Controlled preparation uses the existing crash worker at intent, native_effect, destination_evidence and commit, plus a separate keep_original case. Startup/list/status remain read-only; only explicit UI retry_original, complete_destination or keep_original may change the operation. A completed commit offers no invented recovery mutation.

Normal dev/release smoke commands preserve baseline and rename acceptance/cleanup before category acceptance. The --category-move shortcut establishes only the category driver. Named evidence rejects missing, wrong, failed, skipped and unreached assertions; controlled interruption preparation and forced cleanup cannot establish normal graphical shutdown. Renderer isolation, service contracts, migrations, native adapters and dependencies are unchanged in this integration task.

## Local evidence

Local platform: macOS arm64, Node 22.21.1. Runtime source revision: `b086725cfddcc38e1f97d3b896f306285400c3d4` plus the identified working-tree inputs. Full logs and commands/exits are retained in `work/issue-19/category-move-ui-runtime/task3/verification.json` and `runtime-commands.json`.

| Command | Actual result | Evidence under task3 |
| --- | --- | --- |
| Focused category/creation/rename/recovery/component UI and runtime/CI tests | 530 UI cases passed; first combined run failed the directly affected old CI shape expectation; final focused runtime/CI run passed 64, zero skips | `focused.log`, `focused-green.log` |
| CI layout regression before integration | Exit 1, expected missing focused layout step | `ci-red.log` |
| `npm run typecheck` | Exit 0 | `typecheck.log` |
| `npm test` | Exit 0; 2476 passed, 20 Windows-only skips, no failures | `full-test.log`, `platform-skips.json` |
| `npm run lint` | Exit 0 | `lint.log` |
| `npm run check:docs` | Exit 0; final report/plan links and diff rechecked | `docs.log`, `docs-final.log` |
| `git diff --check` | Exit 0; final report/plan links and diff rechecked | `diff-check-final.log` |
| `npm run smoke:runtime -- dev --category-move` | Exit 1; RU current-category assertion failed, later RU stages unreached | `dev-category.log`, `dev-category/` |
| `CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac` | Exit 0; fresh artifact and artifact-content check passed | `package-mac.log` |
| `npm run smoke:runtime -- release --category-move` | Exit 0; both languages, all five recovery cases each, 34 normal graphical quits/backend exits and confirmed owned cleanup | `release-category.log`, `release-category/` |
| `npm run smoke:runtime -- dev` | Exit 0; actual baseline, rename and category passed sequentially, with 4 + 46 + 34 normal sessions and owned cleanup | `dev-normal.log`, `dev-normal/` |
| `npm run smoke:runtime -- release` | Exit 0; actual baseline, rename and category passed sequentially, with 4 + 46 + 34 normal sessions and owned cleanup | `release-normal.log`, `release-normal/` |

The failed dedicated development run displayed the localized guarded completion message instead of the exact no-op confirmation. Its screenshot and named receipt retain the failed currentCategory stage, unreached later stages and passed owned cleanup. EN grouped/rejection/restart and all EN recovery stages had passed. `task3/diagnosis.json` leaves the specific invalidation/revision source unproven: retained evidence does not identify which production observation/ref changed during response delivery. The already-reviewed UI/driver boundary and no-op assertion remain unchanged. Task 3 remains incomplete until a bounded coordinator repair and required original-scenario verification establish the missing acceptance.

Runtime input digests: dedicated development `16825934eb226eab28a870a2594fa28f3eb684fa700cef789beab5cf707267a9`; packaged category `e4c1e4b37e2e5e225e9d4e4a3d71b883a171ed51734ddda7bbb425635560e042`. The emitted source/build/native/migration and packaged resource hashes are retained in each `*-category-move-inputs.json`; successful fixtures independently assert unchanged inputs across their lifetime. Normal development category input digest: `589ee9c5caa4164ad970cc5a05e796292e04d763d85407d5cad21d40375c7999`. `task3/dev-input-comparison.json` shows only the two freshly rebuilt native binaries differ from the earlier failed dedicated development inputs; the later normal result does not erase that failure. Package creation was sequential after confirmed cleanup; no fixture consumed dist during a clean/build. The regular packaged category digest matched the dedicated packaged receipt exactly. Both original routes passed their own baseline/rename/category receipts; no shortcut receipt substitutes for them. Both EN and RU narrow native-effect recovery screens were visually inspected: wrapping and advertised recovery controls remained readable/reachable; the Table retains its bounded horizontal scroller.

Task 1 and Task 2 receipts remain under `work/issue-19/category-move-ui-runtime/task1/verification.json` and `task2/verification.json`. Before the final clean build, all 201 Task 2 prerequisite hashes matched. `task3/prerequisite-continuity.json` records that comparison and Ladle reuse. The reviewed renderer, Ladle configuration, package resolution and layout driver are unchanged from d7747967dc95497981d6f9f6b28925b1355274d4. Its `work/issue-19/category-move-ui-review-repair/ladle-category-move-20261012/ladle-observations.json` establishes 50 EN/RU production-component stories, 150 screenshots and normal Electron quit. No duplicate local Ladle build/run is needed for this CI routing change.

The category-cell regression first reproduced the obsolete category-only accessible-cell/zero-button contract in EN/RU. The repaired driver binds the intended row, exact authored category text and eligible action while retaining metadata-only label and restricted-row checks. Historical failure attribution stays limited to the retained `work/issue-19/runtime-category-cell-diagnosis/diagnosis.json`; platform failures with unproven attribution remain separate.

## CI and remaining gates

The existing macOS/windows-latest/windows-2022 verification matrix runs focused category layouts after the Ladle build, once per OS. Failure-preserving artifact upload includes `work/ci-category-move-layouts/` and both regular dev/release runtime directories. Existing creation/native gates, independent service matrices, sanitized original full-suite checkpoint transport and regular runtime commands remain intact. No duplicate category runtime job was added.

Early Windows UI feedback at d7747967 passed 191 category UI tests and two production App SQLite/native lost-response/remount tests on each Windows OS, with full npm test passing on all three OS; coordinator receipt: `work/issue-19/actions-38237915838-inspected.json`. That run's original runtime commands failed the obsolete category-cell fixture. This local integration does not establish final Windows graphical acceptance. Separate Ralphex and Matt Standards/Spec review, authorized push, observed exact-SHA Actions artifacts and whole Issue 19 criteria remain coordinator-owned. Issue #44 and Finder/Explorer selected-item release acceptance are independent gates.

Filesystem and SQLite writes are not atomic; path substitutions between checks and native calls remain possible, and controlled process interruption does not establish coordinated power-loss durability. See [the architecture](../architecture.md#implemented-recoverable-project-category-move-service), [ADR 0007](../adr/0007-no-replace-project-renames.md), [service evidence](issue-19-category-move-service.md) and [the runtime plan](../plans/issue-19-category-move-ui-runtime.md). No push, merge, release, signing, tracker write or global configuration change was performed by this executor.
