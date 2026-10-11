# Issue #19: Recoverable category move service checkpoint

## Scope and input identity

This report covers the typed category move service, dedicated journal, source coordination, explicit recovery and production IPC/client from [the bounded plan](../plans/completed/issue-19-category-move-service.md). [Architecture](../architecture.md#implemented-recoverable-project-category-move-service) describes the contract and [ADR 0007](../adr/0007-no-replace-project-renames.md#category-move-extension) records native/journal decisions. Category editing/recovery UI and full issue acceptance remain subsequent coordinator work.

- Immutable issue base: `4f9f11f785c63a65585ea6f33f167fc438272c64`.
- Service/native/IPC/fixture/dependency/CI inputs at Task 7 entry: `608adb0d`. Task 7 adds a public-service regression and documentation, and updates build/ASAR test fixtures; production and Electron smoke fixture inputs remain unchanged.
- Local host: macOS 27.0 (26A428), arm64. CLI commands select the existing Node 22.21.1 installation by prepending `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin` to PATH. No install, dependency addition or global configuration change was performed.
- Full logs and sanitized JSON remain under ignored `work/issue-19/`; they are local evidence, not committed artifacts or newly observed CI results. Prior task red/green logs retain their original inputs and outcomes in the plan.
- The final commit is identified by the commit containing the completed Task 7 plan and this report; its SHA is reported in the executor handoff. Review has not been launched.

## Final local verification

The new public-service regression first passed against the retained Task 6 build (`work/issue-19/task-7-regression.log`). It creates a project, renames it, saves exact Text and sentinel bytes, moves it through the default native adapter, reopens SQLite and creates a fresh UUID at the vacated placement under the current revision. A stale fresh request cannot mutate. Public receipt queries through a sibling and identical original requests preserve all creation/rename/move outcomes across further reopen, without replay, extra revisions or inherited Text. This is added regression coverage of existing behavior; no new production fix or fabricated red result is claimed.

The initial `npm test` failed: 2,124 tests, 2,079 passed, 25 failed and 20 Windows-host-only skips (`work/issue-19/task-7-npm-test-red.log`). Failures were confined to obsolete build/ASAR test inputs: the build assertion expected migration 0009; ASAR fixtures omitted 0010 while the current journal and artifact checker require its SQL. Updating those two fixtures preserves the existing checker and production inputs. Failed historical results remain retained; final command outcomes and exact built-input identity follow below.

| Final command | Observed result and local evidence |
| --- | --- |
| `npm test` | Clean production/native build and full suite passed: 2,124 tests, 2,104 passed, zero failures/cancellations/todos, 20 Windows-host-only skips; 98.607 seconds. `work/issue-19/task-7-npm-test-green.log`. |
| Focused build/artifact/move tests | `node --import tsx --test tests/build-smoke.test.mjs tests/artifact-smoke.test.mjs tests/project-category-move-service.test.mjs`: 179 passed, zero failures/skips. `work/issue-19/task-7-affected-green.log`. The subsequently strengthened stale-configuration assertion passed in the final full suite. |
| `npm run lint` | Passed with zero warnings. `work/issue-19/task-7-lint.log`. |
| `npm run typecheck` | Passed. `work/issue-19/task-7-typecheck.log`. |
| `npm run check:docs` | Passed initial local Markdown checks in 94 files and repeated after final evidence/plan updates. `work/issue-19/task-7-docs-initial.log`, `task-7-docs-final.log`. |
| `git diff --check` | Passed initial and final checks. `work/issue-19/task-7-diff-initial.log`, `task-7-diff-final.log`. |
| `WORKSPACE_CATEGORY_MOVE_SERVICE_EVIDENCE_DIR=work/issue-19/task-7-standalone npm run smoke:category-move:service` | Passed against the final clean build with no intervening rebuild: all 12 scenarios passed, no required skipped/unreached result, four successful utility exits, ordered acknowledgment/exit, main exit zero, independently confirmed shutdown and fixture removal. `work/issue-19/task-7-standalone.log`, `task-7-standalone/service-checkpoint.json`. |

The 20 full-suite skips are Windows-only PowerShell/COM/UIA/STA/loaded-module/bridge and selected-root sharing controls. None establishes Windows acceptance. No category move journal/service/coordination/crash/IPC/fixture case or required standalone scenario was skipped. The full build retained the existing CJS import.meta warning; the fixed runtime wrapper successfully loaded in actual Electron.

Standalone smoke used Electron 44.7.0 / embedded Node 24.21.0 and supervisor Node 22.21.1. Final persisted evidence and independently recomputed input identity match:

```text
da353c692cbaabe06c858a1efe2c73185bc0b32c6d9b6ad5568d01e7dd9783d2
```

`work/issue-19/task-7-input-digest.json` records that this clean-build digest differs from Task 6's `b8f0e975551a2b618ad4b88fff3a5e46161ba484dbf78b209c942d12909c6c45`. Task 6 runtime evidence was not substituted for the new standalone run. Documentation and the changed service/build/artifact tests are outside the smoke runtime digest. Final smoke confirms fixture lifecycle cleanup, not graphical normal quit or Windows behavior. The exact Task 7 commit is recorded after successful commit in ignored `work/issue-19/task-7-commit.txt` and the executor handoff.

## Acceptance mapping

All filesystem/database scenarios use disposable roots and real temporary SQLite, never live project folders. The full suite contains the permanent checks below.

| Boundary | Checks |
| --- | --- |
| Contract and dedicated journal | `tests/project-category-move-journal.test.mjs`: all five exact request shapes; populated actual 0000–0009 upgrades to 0010/reopen retaining IDs, values, independent revisions, creation/rename receipts and outstanding recovery; migration rollback; immutable binding/evidence, transitions, terminal receipts and DELETE/REPLACE protection. |
| Move, no-op and history | `tests/project-category-move-service.test.mjs`: active grouped/same-source authorization, freshly validated no-op with no effect/revision/event; exact basename/UUID/native identity/Text retention, category and locator atomicity, one sibling event and unrelated-source isolation; current policy, malformed/foreign/empty/unavailable/linked/replaced/excluded/archive/direct/mode-inactive rejection; immutable retries, reopen and vacated placement reuse. |
| Native protection and uncertainty | Service tests cover empty/nonempty occupied directories, files, links and aliases, with an empty target inserted at the native-call boundary; sentinels and full identities survive. Bounded injected permission/native/storage failures, substitutions around intent/evidence/completion and transaction-local revision/reservation changes retain uncertainty or reject verified no-effect failures. Existing creation/rename/native regressions run in the full suite. |
| Source coordination | `tests/project-category-move-coordination.test.mjs` and affected creation/rename/discovery/reconciliation/reassociation/Reveal/observer suites: original/destination/evidence reservations loaded before startup, no destination enrollment or association rewrite, sibling reentry/source reuse, stale reviews and transaction rechecks, cross-journal ID guards preserving historical overlaps, root rebinding, reads/Text/unrelated sources, eligible Reveal and terminal placement release. Self exceptions use operation kind plus ID. |
| Explicit recovery | Service tests exercise unique unchanged original/destination placement, fresh owned token, exact spelling, current revision/policy/reservations and replacement-preview/backend lifetime. Only retry_original, complete_destination or keep_original is offered when safe. Missing/replaced/link/inaccessible/multiple/conflicting evidence stays unresolved; no folder adoption. Siblings/recreated workspaces recover retained-source operations while historical initiating IDs remain immutable. |
| Abrupt service interruption | `tests/project-category-move-crash.test.mjs`: parent terminates the child after observed intent, native effect, destination evidence or completion, preventing cleanup. Reopen/status/list/original unfinished retries never replay. Explicit recovery completes once or keeps original, preserving UUID/identity/Text/history, including source reuse after final-workspace removal. This establishes process-interruption behavior. |
| Production typed transport | `tests/project-category-move-ipc.test.mjs`: compiled entry/controller, emitted preload and client carry all five requests and event-before-response sibling notifications. Exact/foreign/altered requests and token ownership are checked; private path/evidence stays out of public results. Lost/undelivered/timed-out responses and backend replacement require status or explicit fresh action, without automatic replay. Stale Reveal authorization fails and fresh authorization uses the committed locator. |
| Actual macOS Electron service | `scripts/smoke-project-category-move.mjs` and `tests/fixtures/project-category-move-service-electron.cjs`: compiled production backend/default adapter in actual utility processes; move/no-op/rejection/collision, basename/UUID/Text/independent revisions, sibling isolation, view/selection retention, restart, all three recovery actions and final receipt reopen. |
| Checkpoint integrity | `tests/project-category-move-fixture.test.mjs`: positive result and negative assertion/protocol/result/missing/skipped/unreached/acknowledgment/timeout/publication/read/premature-exit/cleanup/evidence-write controls. Four successful owned utility exits, ordered result/ack_sent/ack_received/exit_sent/main_exit, shutdown confirmation and removal are required; skipped/unreached scenarios cannot pass. Privacy, persisted outcomes and input-digest sensitivity are checked. |

Smoke evidence labels each scenario's kind. `grouped.occupied_insertion` inserts an occupied destination at the actual adapter boundary as a separate collision control; it does not inject an adapter into the production service. `grouped.complete_destination` uses a real SQLite completion rejection after an effect. `grouped.retry_original` and `grouped.keep_original` use fixture-native external return to create reviewed recovery states. These injected controls demonstrate handling of those states; they do not identify historical OS causes or establish coordinated power-loss durability. Abrupt parent-termination tests are separate evidence.

## Security and guarantee limits

Only IDs and expected revision enter the move request. The service derives both parents, basename, root/policy and evidence, using the existing fixed native adapter. No ordinary rename, copy/delete, overwrite fallback, permanent marker, recursive deletion or automatic rollback/replay is introduced. Production transport retains `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; renderer code has no Node/database/native access. Public operation/results omit absolute paths, native identities and adapter choice.

No-replace protects the destination at the native operation. Source/ancestor substitution between repeated path checks and the call can still redirect an effect. Fresh checks detect observed changes without atomic confinement, guaranteed rollback or locating every displaced effect. Standalone intent/evidence commits and immutable terminal history support service-process interruption recovery; a failed uncertainty write leaves earlier durable evidence authoritative. SQLite WAL uses driver-default synchronous/fullfsync with no coordinated filesystem/parent-directory flush protocol. There is no filesystem/SQLite atomic transaction or established machine-crash/power-loss durability.

## Coordinator-owned acceptance

The existing native primitive checkpoint from Issue #18 is historical mechanism evidence; it is not category move service acceptance. The independent `project-category-move-service-early` matrix targets macos-latest, windows-latest and windows-2022 and retains failures with artifacts. This executor neither pushed nor dispatched it; actual Windows category move results remain pending.

Remaining gates stay outside executable Task checkboxes:

- Separate Matt code-review and Ralphex review against the immutable issue base.
- Actual both-Windows-target service results at the exact reviewed SHA, with every required scenario/artifact inspected; absent, failed, skipped and unreached evidence remains pending.
- Category editing/recovery UI with explicit physical-move messaging, EN/RU, keyboard, pending/error/empty states and response-lifetime handling; subsequent development/packaged graphical and full platform/product acceptance.
- Existing native Reveal selected-item and normal graphical Electron quit/#44 gates. The acknowledged service fixture uses app.exit and confirms owned-process cleanup; it does not establish normal graphical application quit or Finder/Explorer selected-item observation.

No tracker/coordinator-state mutation, push, merge, release, signing, publication, UI work or separate review was performed. Completing this service plan does not close Issue #19 or start another issue.
