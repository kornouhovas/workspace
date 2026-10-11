# Runtime source-disconnect repair verification

This report covers the disposable fixture repair for Issue #18. Production filesystem policy, native observation, application assertions and the ten-second normal-quit requirement are unchanged. The active execution plan is `docs/plans/issue-18-runtime-source-disconnect-repair.md`; coordinator review and platform acceptance remain separate.

## Finding and repair boundary

Historical Windows Server 2022 run 38136094122 rejected the second selected-root disconnect with Node `EPERM` (errno -4048), after the first disconnect/restore succeeded. The unchanged historical replay and Task 1's extracted behavioral regression both failed before repair. The extracted regression reached the same callable helper as the actual second-disconnect callsite, injected the captured first-attempt error and otherwise used real temporary directories and Node rename. Its pre-repair result was zero passed, one failed (approximately 52 ms); after repair all 51 Task 1 tests passed. These retained results establish the fixture's one-shot failure propagation, not the historical lock owner.

All four actual disconnect/restore calls now use the owned-fixture helper and evidence wrapper. Only Windows `EPERM` from the actual move is retryable: at most 20 attempts within 2,000 ms, with spacing of up to 100 ms capped by the remaining budget. Each attempt revalidates ownership, full root identity, unchanged no-follow content inventory and destination absence. Success requires source absence, matching destination identity and unchanged bytes/link texts. In-flight operations are awaited; late completion and unexpected effects fail without blind replay or rollback. Non-Windows and other errors remain single-attempt failures.

Release, persistent-block and no-holder tests exercise the shared helper. The actual Windows holder requires readiness and a real blocked Node rename before release, or retains the handle until finite rejection. Portable process/handshake controls verify orchestration and cleanup, but do not establish Windows sharing. Controlled sharing is a possible mechanism; service/native-canonicalization observations do not attribute the historical failure. Ordinary Node rename plus validation does not provide atomic no-replace protection against adversarial concurrent substitution; this seam operates only on owned disposable fixtures.

## Inputs and local checks

Task 4 started at `6565cc6c` on `codex/issue-18-project-rename`, with a clean checkout. The immutable issue base remains `a5728daa64caab6b90700854ad5e27417fcf683e`; repair review starts at `2e6444d0e200c9df73081042671731af463eb199`. Verification used macOS 27.0 (26A428), arm64, Node 22.21.1 and Electron 44.7.0. Each command selected the existing Node installation with `PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH`.

All evidence/log paths below are ignored and relative to `work/issue-18/runtime-disconnect-repair/`.

| Check | Actual result |
| --- | --- |
| Initial output inspection | Eight in-memory esbuild comparisons and all eleven migration/journal comparisons matched current `dist`; native source/binary hashes matched the retained build inspection. Saved as `task4-prebuild-inspection.json`. |
| Initial `npm run check:artifact -- release` | Failed: the old macOS package lacked migration 0009. Preserved in `task4-artifact.log`; no runtime acceptance was attempted with this package. |
| `CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac` | Passed the normal clean build, native Node/Electron compilation, unsigned development directory packaging and artifact checks. No fixture was consuming `dist` during rebuilding. Log: `task4-package.log`. |
| Initial package byte-comparison inspection | Aborted because the inspection expected an external native script inside ASAR. Corrected the inspection to read the documented `extraResources` location; no package/code change or runtime invocation was needed. The observed failure is recorded in `task4-package-comparison-initial.json`. |
| Final package comparison | All 26 shipped `dist` files matched current output bytes, including the external native scripts; excluded service-test outputs were not required in the package. |
| `node --import tsx --test tests/runtime-source-disconnect.test.mjs tests/runtime-lifecycle.test.mjs tests/windows-rename-diagnostics.test.mjs` | Passed before and after packaging: 167 tests, 160 passed, zero failures, seven explicit Windows-only skips. Final log: `task4-focused-final.log`. |
| `npm run lint`, `npm run typecheck` | Passed; zero lint warnings. Logs: `task4-lint.log`, `task4-typecheck.log`. Source inputs remained unchanged by packaging. |

The final executable input SHA-256 is:

```text
1f1ecb9c0a3c0b0150d20ee9a22a8a8fee0461d4c5fb9459e604d59e9c2a73a2
```

`task4-input-manifest.json` records 210 relative file names and SHA-256 values: tracked source/native/scripts/tests, manifests/build configuration, emitted outputs, SQLite prebuilds, Electron version metadata and the macOS ASAR/executable/unpacked native resources. The aggregate hashes sorted relative path, NUL, file SHA-256 and LF. Documentation-only edits are outside this executable digest. The manifest retains build identity without incorporating disposable fixture paths, names, IDs, PIDs or contents.

## Original graphical runtime scenarios

Both original full invocations ran once, sequentially, against the same final build. No failure was rerun or assertion relaxed. Each used a fresh evidence directory:

```sh
WORKSPACE_SMOKE_EVIDENCE_DIR=work/issue-18/runtime-disconnect-repair/task4-dev-1 npm run smoke:runtime -- dev
WORKSPACE_SMOKE_EVIDENCE_DIR=work/issue-18/runtime-disconnect-repair/task4-release-1 npm run smoke:runtime -- release
```

| Observed acceptance | Development | Packaged macOS |
| --- | --- | --- |
| Command / final persisted status | Exit 0 / passed | Exit 0 / passed |
| Runtime stages | All 15 true | All 15 true |
| Actual subscribed disconnect/restore | Passed; 1 attempt each, 6/7 ms | Passed; 1 attempt each, 6/8 ms |
| Actual unsubscribed disconnect/restore | Passed; 1 attempt each, 5/5 ms | Passed; 1 attempt each, 7/6 ms |
| Move effects | All four verified source absence, matching destination identity and unchanged contents | Same |
| Normal shutdown and backend exit | Three normal sessions and the expected invalid-SQLite startup-failure session passed; no forced termination | Same |
| Fixture cleanup | Passed with process termination verified | Same |
| Independent process/root probes | All 21 tracked processes absent; no new fixture root remained | All 22 tracked processes absent; no new fixture root remained |
| EN/RU layout evidence | 135 screenshots; 1440×960, 1024×720 and 420×800 overflow assertions passed | Same |

All move records had null first-error/final codes; macOS did not exercise retry. The original unavailable/restored UI assertions, exactly two actual subscribed source-change events and no additional events after unsubscribe passed. Workspace/source/view/project identities, retained projects, exact Text/revisions, source bytes/no-follow inventory, sibling routing and unrelated-source isolation remained intact. The full scenarios also passed direct/grouped discovery and mode round trips, explicit stale re-Apply, category labels, recovery, native reconciliation, explicit Refresh, shutdown-missed changes, restart persistence, inactive/active/final removal, empty restart and retained-source reuse. The intentionally invalid SQLite startup was correctly reported and shut down; it is a successful negative assertion, not a failed invocation.

Original persisted observations and screenshots are under `task4-dev-1/` and `task4-release-1/`; logs are `task4-dev-1.log` and `task4-release-1.log`. Independent verification is recorded in `task4-dev-1-independent.json` and `task4-release-1-independent.json`; it tracked spawned processes and compared temporary fixture roots before/after without changing the application or its shutdown policy. `task4-runtime-summary.json` retains only finite outcomes/counts/move records, excluding the original observations' fixture identities and contents.

The stale-artifact failure was retained before the justified package refresh, and the initial byte-comparison inspection error was retained before correcting its resource lookup. Neither graphical invocation had failed, skipped or unreached stages. Their passing individual shutdowns do not resolve Issue #44. No in-scope implementation correction was required, so source/helper/test inputs and the final executable digest remained unchanged.

## Final scope and evidence retention

Task 4 changes only this report, `docs/development.md` and the active plan. `npm run check:docs` and `git diff --check` passed after final edits. No temporary implementation probes or throwaway harness scripts remained; verification commands ran inline. The ignored historical replay, original red logs, sharing comparison and retained CI evidence remain unchanged. An ignored diagnosis README labels the replay as historical, because its original extracted callsite intentionally predates the helper. No current-success claim is derived by rerunning that stale replay. Permanent behavioral and lifecycle controls remain in the test suite.

## Remaining acceptance

The coordinator must run the focused command above on actual Windows Server 2022 and Windows Latest with Node 22.21.1 and current built service inputs. Require zero failures and no Windows-only skips: actual release must observe `EPERM` then a verified move; persistent blocking must reject with unchanged source and absent destination; no-holder moves and holder input-rejection/release/exit/cleanup controls must pass. The pre-existing Windows diagnostic controls also require execution. Local skips and deterministic platform seams do not satisfy these gates.

Exact reviewed-SHA platform CI, follow-up review, tracker updates and integration remain coordinator-owned. Issue #18 stays open; Name/recovery UI, broader graphical project-rename acceptance and independent shutdown Issue #44 remain outside this repair. No tracker/run-state mutation, push, merge, signing, publication or global configuration change is part of Task 4.
