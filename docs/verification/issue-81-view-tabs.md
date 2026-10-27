# Issue 81 verification

The [scenario plan](../plans/issue-81-view-tabs.md) records scope and coverage decisions. The GitHub checkpoint owns CI, acceptance and integration evidence.

## Appearance

The scope uses the existing local bb-inspired tokens and Radix menu/tabs foundation. No upstream source or dependency was added. Main supplies the saved-view workflow; this slice additionally moves adjacent tabs during horizontal drag and retains a thin inset neutral keyboard-focus indicator.

On macOS arm64, `npm run smoke:shell` passed with real Electron outer bounds of 1024×720 and 1440×960. It verified the restored minimum size, native content bounds, matching renderer viewport and focus PNG dimensions, and checked creation-menu bounds. Renderer captures at those measured native bounds cover EN/RU and light/dark. The focus and menu matrix was inspected together, and representative whole renderer screens were inspected individually. These are development renderer captures, not native title-bar captures or Windows/package evidence.

## Behavior and retained guarantees

The initial delayed `queryView` regression was red: selection changed while the target projection was absent. Preparation now retains the previous view until the target filter, projection and layout are ready; tests cover different filters, delayed layout, repeated transitions, concurrent changes, archive mode, project-area blocking, subscription cleanup and errors. Independent standards and spec reviews found no further confirmed critical issue after their repairs. The public service, SQLite, IPC and filesystem command contracts remain unchanged.

`npm run smoke:views` passed in real Electron using disposable data in both languages: creation, context actions, pointer reordering, horizontal-only motion, Escape cancellation, overflow autoscroll, restart and existing view/grouping journeys. `smoke:shell` also passed. The affected move, rename and recovery fixture suites passed 476 tests after their mocked clients were updated to supply the required default layout; their original assertions remain. The Ladle development check passed after replacing the task checkout's external node_modules symlink with a local `npm ci` installation.

An earlier full run was interrupted after discovering those fixture and Ladle failures. Before interruption two native tests also reported a 10-second Electron shutdown timeout; both subsequently passed in isolated current-code runs. The initial results remain failures and the shutdown cause is not established. An earlier `smoke:views` group-assignment timeout likewise did not recur in isolated and subsequent combined runs; its cause remains unconfirmed.

## Remaining gates

The repaired candidate completed `npm run test:all` on macOS arm64, Node 22.21.1: 3,999 tests, 3,972 passed, zero failed and 27 skipped. The local log is `/tmp/issue81-full-final.log` (SHA-256 `edf3bea3aa7cdf445f4a812804c30eee64997c59cc822a82489fb5670e36f383`). After that run, one test-only assertion was added for creating two Board tabs with the same display name; its focused test, typecheck and lint passed. Application, fixture and build inputs were unchanged, so the full result is retained under [CI evidence reuse](../ci.md#evidence-reuse-after-test-only-repairs).

The candidate still requires scoped CI artifacts on supported desktop hosts. Record actual commands, SHA, host and results in the GitHub checkpoint and integrate only after the required evidence passes. Human feedback on the changed focus and drag treatment remains distinct from local automated evidence.

## CI repair in progress

The navigation run [40477262633](https://github.com/kornouhovas/workspace/actions/runs/40477262633) tested commit `0051a8302afaecdcfdaed3ac9a8fd673a3107cb3`. macOS job `122098468509` passed 873 tests and navigation before `smoke:shell` timed out waiting for the actions trigger to regain focus. Its failure screenshot shows the creation trigger focused; the original run did not record focus events. A controlled real-Electron regression reproduced focus theft when the creation menu's return was delayed. The driver now waits for that return before opening the next menu; the historical cause remains unproven.

Windows 2022 job `122098468775` passed 873 tests, navigation and shell, then `smoke:views` asserted the context-menu trigger's focus immediately after Escape and observed false. The driver now waits for the same expected focus before asserting it. Deferred menu autofocus is a plausible explanation, but the original run did not capture a focus trace and does not establish the cause. Neither repair changes application code or removes the focus assertions.

The `view-menu-focus` workflow route runs the original failed shell consumer on macOS and views consumer on Windows 2022, including the focused real-Electron regression on macOS. After focused acceptance, `view-menu-renewal` runs the changed shell and views consumers on all three desktop hosts. Both preserve candidate provenance and native artifacts; shell focus tracing is bounded and opt-in. Prior full-suite evidence remains attributed to its original SHA; affected consumer evidence must be renewed on the repair SHA.
