# Issue #18: Recoverable project rename service checkpoint

## Scope and input identity

This report covers the implemented service, durable journal, coordination, explicit recovery and production typed transport/client from [the service plan](../plans/completed/issue-18-project-rename-service.md). It stops before Name editing/recovery UI and coordinator platform acceptance. [Architecture](../architecture.md#implemented-recoverable-project-rename-service) defines the implemented boundary; [ADR 0007](../adr/0007-no-replace-project-renames.md) records the native and durability decisions. ADR 0006 remains the unchanged creation decision.

- Immutable issue base: `a5728daa64caab6b90700854ad5e27417fcf683e`.
- Last successful coordinator review/native CI checkpoint: `de5de73c2cb178dce7591c8a80412805290dcf8d`.
- Final service, dependency, fixture and CI implementation input commit: `2eb5bd2949ad47c225aa0229dbce303ce11fdd5e`. Task 7 changes documentation and this plan only; no executable inputs changed during verification.
- Local host: macOS 27.0 (26A428), arm64. CLI Node.js: 22.21.1, selected by prepending `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin` to PATH for npm commands. Runtime/build uses the existing committed dependency resolution; no install, global configuration change or dependency addition was performed in Task 7.
- Final local logs and service JSON are retained in ignored `work/issue-18/task-7/`. These are local evidence, not portable committed artifacts or newly observed CI results.

## Final local verification

Local run on 2026-10-11, against the final executable inputs above:

| Command | Observed result |
| --- | --- |
| `npm test` | Passed once, including clean production renderer/desktop/service builds, separate Node/Electron native builds, migrations and version verification. TAP: 1472 tests, 1456 passed, 16 skipped, zero failures/cancellations/todos; duration 86.006 seconds. Log: `work/issue-18/task-7/npm-test.log`. |
| `npm run lint` | Passed with zero warnings. Log: `work/issue-18/task-7/lint.log`. |
| `npm run typecheck` | Passed. Log: `work/issue-18/task-7/typecheck.log`. |
| `npm run check:docs` | Passed local Markdown target checks in 80 files before the final evidence update; repeated after the final report/plan update. Logs: `work/issue-18/task-7/docs-initial.log` and `docs-final.log`. |
| `git diff --check` | Passed before and after final evidence/plan updates. |
| `WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR=work/issue-18/task-7/service npm run smoke:rename:service` | Passed against the outputs from npm test, with no intervening rebuild. All 16 direct/grouped scenarios passed; no failed/skipped/unreached scenario. Log: `work/issue-18/task-7/service-smoke.log`; sanitized JSON: `work/issue-18/task-7/service/service-checkpoint.json`. |

The 16 full-suite skips are Windows-host-only PowerShell/COM/UIA/STA/loaded-system-module/bridge controls. They were not executed on macOS and are not counted as Windows acceptance. No rename journal/service/coordination/crash/IPC/fixture test or required standalone service scenario was skipped. The build retained the existing esbuild CJS `import.meta` warning in the native wrapper; its fixed `__dirname` branch loaded successfully in the actual production Electron service smoke. No code correction or repeat full-suite/build/runtime run was needed.

The standalone smoke recorded Electron 44.7.0 / embedded Node 24.21.0 and supervisor Node 22.21.1, with `self_alias_staged` on the actual local mount in both modes. Exact requested spelling, staged evidence, unchanged full identity and sentinel bytes were asserted. Five owned utility processes exited; the result/acknowledgment/exit handshake completed, main exited with code zero, `shutdownConfirmed=true` and `cleanup=removed`. Protocol errors, stderr bytes and ignored whitespace counts were zero. This confirms fixture lifecycle cleanup, not graphical app normal-quit acceptance.

Final service evidence `inputSha256`:

```text
132168f37929e98cad86712c754dc0a0a383398106f07c18687bf80e0ba9b9a6
```

The supervisor hashes package/lock resolution, service and contract source trees, native C/binding inputs, BackendController source/emitted module, emitted service/native/migrations, the installed host SQLite binary and supervisor/Electron/protocol fixture inputs. Documentation is outside that runtime digest. The digest identifies this final clean build; it is not substituted with Task 6's earlier focused-build digest. No generated output or local evidence file is staged. Historical plan evidence remains unchanged; only Task 7 is marked complete after its checks.

## Acceptance mapping

The final full suite includes the permanent checks below; previous task red/green evidence remains in the plan. All filesystem changes use disposable roots/databases, never live user projects.

| Behavior or boundary | Assertions and evidence |
| --- | --- |
| Exact public contract and journal | `tests/project-rename-journal.test.mjs`: all five exact request shapes, malformed/extra/path/native-bearing inputs, authored spelling, populated actual 0000–0008→0009 upgrades/reopen, late migration rollback/retry, immutable request/evidence/receipts, DELETE/REPLACE protection, legal transitions, cross-role reservations, unchanged and failed/keep-original receipts. Existing Text/creation history and source reuse survive. Build/artifact tests require the matching SQL and journal entry. |
| Direct/grouped rename and no-op | `tests/project-rename-service.test.mjs`: UUID/exact Text/category/configuration/settings/views and independent revisions retained; event-before-response and sibling/unrelated-source isolation; validated exact-name no native call/revision/event; immutable receipts/retries before new-command stale validation. Invalid/excluded/archive/historical/occupied names, missing/replaced/link/inactive/unresolved locations and malformed/foreign requests cannot adopt another folder. |
| Native effects and safety | Service tests use actual fixed emitted adapter and temporary folders, full identity/sentinels/inventories, exact parent enumeration and actual mounted case detection. Late occupied destinations and staging allocation collisions preserve other entries. Native-unavailable/unsupported/permission/busy/cross-device controls fail closed. Simulated Windows naming policy is validation evidence only. `tests/project-rename-native.test.mjs` separately exercises the primitive in Node/Electron and ASAR loading. |
| Coordination before observation | `tests/project-rename-coordination.test.mjs` plus discovery/reconciliation/creation/reassociation/Reveal regressions: persisted original/staged/destination reservations loaded before startup; conflicting source mutations and stale reviews blocked, transaction rechecks/rollback, queued watcher/Refresh and reentrant subscribers, Text/read/unrelated-source availability, source reuse/final-reference removal, terminal receipt path release. |
| Explicit recovery | Service tests inspect unique fresh original/staged/destination identity, exact spelling and advertised actions; token ownership, stale source/revision/reservation/evidence, replacement preview and backend lifetime; missing/replaced/link/inaccessible/multiple matches remain unresolved. All four actions preserve UUID/Text/category/receipts; keep_original moves nothing and retains prior evidence. Siblings can recover after initiating workspace removal. |
| Storage failures and residual races | Service tests fail intent, staged/destination evidence, completion and uncertainty writes, retaining the last durable row without fabricated success or rollback. Root/category/project/ancestor/link swaps, late original reappearance and replacement evidence block completion and preserve fixture content. Observed-race detection is bounded; no atomic confinement or power-loss guarantee is inferred. |
| Abrupt service-process interruption | `tests/project-rename-crash.test.mjs`: parent waits for an observed checkpoint then kills the child at intent, first staging effect, staged evidence, final effect, destination evidence and final commit, in both modes; cleanup is not executed. Restart/list/status/immutable original retries do not mutate; explicit sibling recovery completes once, retaining metadata/history and supporting final-reference removal/source reuse. Local diagnostics distinguish actual mounted self alias from the explicit alias-policy seam on case-sensitive hosts. |
| Production typed transport | `tests/project-rename-ipc.test.mjs`: compiled production entry/controller, emitted preload and compiled client carry all five requests/results/events; exact validation, foreign source/project/operation and recovery-token ownership, changed-payload retries, public evidence privacy. Lost/undelivered responses and backend replacement at pre-intent/unfinished/completed boundaries never replay; explicit same original request delivers only unsent work or returns durable status/receipt. These controlled replacements are separate from abrupt-process evidence. |
| Fresh Reveal authorization | IPC/Reveal tests reject pending old authorization after rename/recovery; fresh authorization reaches the existing trusted route with the committed locator. Final OS calls are recorders in boundary tests. Service smoke exercises actual private backend/main reauthorization with a fixture acknowledgment. Neither establishes Finder/Explorer selected-item observation. |
| Actual development Electron service | `scripts/smoke-project-rename.mjs` and `tests/fixtures/project-rename-service-electron.cjs`: emitted production backend/default native adapter through BackendController in actual utility processes, temporary SQLite/roots, both-mode rename, mounted case/exact spelling, collisions, retention, events/isolation, Reveal authorization, restart and explicit recovery. All 16 required scenarios must pass. A real SQLite completion-write failure follows the native effect; restart/status/list/original retry leave it unfinished until explicit sibling complete_destination. This is controlled metadata interruption, distinct from process-kill tests. |
| Checkpoint integrity | `tests/project-rename-fixture.test.mjs`: real success plus injected failure, live-child timeout, malformed protocol, unreached/skipped required assertions, missing acknowledgment, cleanup reporting and evidence-write failure. Bounded deadlines, owned-child exits and acknowledgment are required. Negative controls fail as expected; skipped/unreached required smoke scenarios never count as acceptance. |

The actual Electron collision scenario checks occupied service destinations and additionally inserts an occupied target immediately before calling the fixed native adapter directly. This demonstrates late native no-replace protection; it does not claim deterministic collision injection inside production service execution. Actual local staging evidence and the final service digest are recorded with the command outcomes.

## Established native evidence and pending external acceptance

The coordinator's retained `work/issue-18/ci-38123519292/verification.json` identifies [CI run 38123519292](https://github.com/kornouhovas/workspace/actions/runs/38123519292) at `de5de73c2cb178dce7591c8a80412805290dcf8d`: conclusion success, seven required jobs and all 18 native adapter cases passed. `native/native-adapter.json` retains the scenario evidence. This is the established primitive checkpoint across macOS and both Windows runners, not new service acceptance. The current executor did not push, dispatch CI or reinterpret that historical milestone as service verification.

The independent `project-rename-service-early` job targets macos-latest, windows-latest and windows-2022, builds the final inputs, runs `test:rename:early` and `smoke:rename:service`, and uploads separate service evidence with `always()`. Existing Windows Reveal/shutdown/native-artifact paths remain unchanged by this stage. Editing or locally inspecting this job does not establish its results.

Coordinator-owned gates remain outside executable Task checkboxes:

- Separate service/transport review against the immutable issue base and last successful review SHA.
- Actual macOS and both Windows CI service results at the exact reviewed implementation SHA, including direct/grouped rename, mounted case/exact spelling, collisions, retention, restart/recovery, sibling isolation and fresh Reveal authorization. Local macOS checks cannot establish Windows compilation/loading/filesystem behavior for this service stage.
- Coordinator interpretation of every required passed/failed/skipped/unreached scenario; absent evidence stays pending.
- Existing Windows Reveal command/selected-item/shutdown acceptance and #44 normal graphical Electron quit remain independent gates. The service fixture uses acknowledged `app.exit` and confirms owned-process cleanup; it does not establish graphical application normal quit.
- Subsequent Name editing, truthful retained Name/error UI, EN/RU keyboard/loading/recovery states, Ladle/layout expansion and broader development/packaged rename runtime acceptance. Task 7 did not build Ladle or a fresh packaged application, or run graphical rename UI smoke.

No tracker mutation, push, merge, release, signing or publication was performed. Completing this executable service plan does not complete Issue #18.

## First whole-issue review repairs

The first whole-issue review compared `a5728daa64caab6b90700854ad5e27417fcf683e...d45468675a21726b296f7c3007c015cdbc5d3ae3` across five independent correctness, requirements, test, simplification and documentation perspectives before applying repairs.

- Creation and rename journals have separate operation-ID namespaces. The rename self exception incorrectly exempted unfinished creation reservations with the same caller-supplied ID. Both context and placement checks now exempt only the current rename's own rows. Six direct/grouped regressions cover a reserved destination, another free destination and an exact-name no-op; all six failed against the prior emitted service and pass after the repair, without native calls, receipts, revision/events or metadata changes.
- Archiving the service plan left two maintained Markdown links pointing to its previous location. ADR 0007 and this report now link to the completed plan; the previously failing documentation check passes.

Repair verification on the same macOS arm64 host with Node.js 22.21.1 refreshed `build:service-test-lib` (including both native binaries) and `build:backend`. `npm run test:rename:early` passed 299 tests, including recovery, abrupt-process, IPC and actual Electron fixture controls. Creation, reassociation, Reveal and Settings service suites passed another 233 tests. All 532 tests passed with no failures or skips. `npm run lint`, `npm run typecheck`, `npm run check:docs` and `git diff --check` passed. Test logs are retained under ignored `work/issue-18/whole-issue-review/`.

The original full-suite and standalone smoke results above retain their historical input identity. They are not new results for the repaired service; unchanged UI/build configuration evidence was reused, while affected service/transport/runtime checks were repeated. Exact-SHA platform CI and the other coordinator gates remain pending.

## Bounded service-fixture handshake repair

The [repair plan](../plans/issue-18-service-handshake-repair.md) covers private fixture supervision and tests only. Executable repairs were committed as `3419172b` (bounded control handshake) and `6c803c02` (precise failure lifecycles). Task 3 changes documentation only. Production/native/UI sources, dependencies, build and CI configuration remain unchanged from the last reviewed HEAD `113721caca5ae1f15a5b8f859ada5d52412e7ef0`; the immutable issue base remains `a5728daa64caab6b90700854ad5e27417fcf683e`.

Historical [CI run 38132376699](https://github.com/kornouhovas/workspace/actions/runs/38132376699) remains the original Windows service-fixture failure. Both Windows standalone artifacts passed all 16 scenarios, then reported result, ack_sent and supervisor_timeout without ack_received or exit_sent. Shutdown and removal succeeded, but lifecycle acceptance failed. Several broad negative controls also timed out. Original artifacts remain under `work/issue-18/ci-38132376699/`; `work/issue-18/service-handshake-repair/original-windows-references.json` indexes them. No Windows stdin probe was executed. Finite local early/late-listener probes both succeeded; disabled-receiver and closed-pipe controls separated successful parent writes from observed receiver delivery. These macOS observations leave historical Windows stdin causality unproven.

The repaired seam publishes only fixed bounded ack/exit records through same-directory temporary files and rename beneath the disposable supervisor root. Receiver polling starts before main_ready; ack follows the actual result, ack_received follows consumption, and exit follows observed ack_received. Publication/read failures and deadlines remain finite and sticky; polling stops on terminal paths. Cleanup follows independently confirmed owned-process shutdown. Stdout stage/byte/message limits remain unchanged. Temporary probe scripts were removed before Task 3 verification; historical JSON/log evidence remains intact. Permanent bounded fault controls remain as regressions.

Final verification ran on 2026-10-11, macOS 27.0 (26A428), arm64, supervisor Node 22.21.1, Electron 44.7.0 / embedded Node 24.21.0. Node was selected through the existing version-specific PATH. In-memory esbuild comparisons matched the retained controller, service entry, settings and both native-wrapper outputs; migrations/journal matched, and native source/binary SHA-256 values matched Task 1. No refresh, build, clean, install or configuration change was necessary. Reuse observations are retained in `work/issue-18/service-handshake-repair/task3-build-inspection.json` and `task3-reuse.json`.

| Command or retained evidence | Observed result |
| --- | --- |
| `WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR=work/issue-18/service-handshake-repair/task3-early npm run test:rename:early` | Ran once against final inputs: 309 passed, zero failures/skips/cancellations. Log: `task3-early-tests.log`; all 11 separate positive/control artifacts inspected under `task3-early/`. |
| Task 2 native protocol controls: `node --test --test-name-pattern='supervisor parser\|CRLF framing\|stdout cannot pass' tests/project-rename-native.test.mjs` | Retained 10 passing selected tests, zero failures/skips. Native/protocol tests, fixtures, build inputs and exercised binaries remain unchanged. Original log: `task2-native-protocol-tests.log`; artifact: `task2-native-protocol/native-adapter.json`. Covers LF/CRLF/whitespace/chunk boundaries, malformed/unknown/truncated records, byte/message limits and actual Electron protocol rejection after acknowledgment. |
| `npm run lint`, `npm run typecheck` | Both passed; zero lint warnings. Logs: `task3-lint.log`, `task3-typecheck.log`. |
| `npm run check:docs`, `git diff --check` | Passed after documentation and plan updates. |
| `WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR=work/issue-18/service-handshake-repair/task3-standalone npm run smoke:rename:service` | Passed separately against the same retained build and final fixture inputs. Log: `task3-standalone-smoke.log`; artifact: `task3-standalone/service-checkpoint.json`. |

All paths in this table are beneath ignored `work/issue-18/service-handshake-repair/`. No full suite, fresh packaging or graphical run was performed for this private repair; earlier full-service history above retains its original inputs and results.

Both final positive artifacts passed all 16 named direct/grouped scenarios, observed self_alias_staged on both local mounted-case checks, and retained exactly one ordered result/ack_sent/ack_received/exit_sent/main_exit handshake. Main exited zero without signal/timeout; all five owned utilities exited successfully. Protocol was valid, shutdown independently confirmed and fixtures removed. The independently recomputed final inputSha256 matched every positive/control artifact:

```text
74a218f1fb4ffe53da795793a59bba1cc76f2ca670712840f5f7bedc141f1039
```

This digest includes the executable `tests/fixtures/project-rename-service-control.cjs`; a disposable-copy regression proves helper changes affect it without mutating live inputs. Documentation and removed scratch scripts are outside the digest.

Every negative artifact retained `ok=false` for its intended reason:

| Control | Required and observed lifecycle |
| --- | --- |
| failure | Only direct.rename failed; later scenarios unreached. Complete handshake, main exit 1, one successful utility exit. |
| missing-assertion / skipped | Only direct.rename unreached / skipped; other 15 scenarios passed. Complete handshake, main exit 0. |
| malformed | All scenarios passed; exactly one sticky malformed-record failure. Complete handshake, main exit 0. |
| cleanup | All scenarios passed; complete handshake and main exit 0 preceded the injected cleanup-report failure. |
| missing-ack | All scenarios passed and result arrived; no ack or exit instruction sent. Genuine supervisor timeout followed result. |
| timeout | A live utility reached worker_started; genuine timeout before result, with all scenarios unreached. No platform-specific termination-code assumption. |
| control-publication | All scenarios passed; occupied ack temporary record produced control_publish_failed / controlFailure=publish. No ack/exit publication or timeout. |
| control-read | All scenarios passed; an exit-record directory produced only sanitized startup_failed / controlFailure=receive. Ack sent, no ack_received/exit instruction, main exit 1, no timeout. |
| premature-main-exit | Five successful utility exits, then main exit 7 before result. Scenarios remained unreached; no protocol/control error, signal or timeout. |

All controls confirmed shutdown and removal except the deliberately injected cleanup-report failure. The five complete-handshake controls had no unrelated timeout, acknowledgment loss or signal. Persisted final evidence equaled returned sanitized outcomes; privacy assertions rejected mailbox paths, command records, raw errors and existing scenario/path/native-identity secrets. The occupied-file evidence-write control also confirmed shutdown/removal while preserving occupied bytes. Helper controls passed incomplete-publication, exact-size/record, invalid/out-of-order/duplicate, publication/read failure and deadline-disposal assertions.

Local executable repair completion does not establish Windows acceptance or complete Issue #18. Coordinator-owned gates remain outside Task checkboxes: separate follow-up review from `113721caca5ae1f15a5b8f859ada5d52412e7ef0`, authorized push/CI, observed early-service and full verification on macOS/windows-latest/windows-2022 at the exact reviewed commit, and inspection of every service/control artifact. Missing external evidence remains pending. Historical stdin causality, graphical Reveal, packaged rename acceptance and #44 remain separate. No tracker/coordinator-state mutation, push, CI dispatch, merge, release, signing or publication was performed.

## Guarantee limits

The no-replace primitive protects the target at its native operation. Source/ancestor substitution between validation and that path-based call can still redirect an effect, and unobserved substitutions cannot all be detected. Full identity and repeated exact placement checks provide conservative detection, not a filesystem lock, guaranteed confinement, rollback or another-folder adoption authority. Unsupported filesystems and unavailable modules reject without ordinary-rename fallback.

Standalone intent/evidence commits and immutable terminal receipts support service-process interruption recovery. Earlier intent/evidence remains authoritative when an uncertainty write fails. SQLite uses WAL/foreign keys with driver-default synchronous/fullfsync; no parent-directory flush or coordinated filesystem/database durability protocol was added. There is no atomic filesystem/SQLite transaction or established coordinated machine-crash/power-loss durability. Permanent marker files, recursive deletion, automatic mutation replay and filesystem rollback are absent.
