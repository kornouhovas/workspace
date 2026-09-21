# Attempt 2 checks before independent verification

- `npm test`: 200 passed, 0 failed after the final toolbar change; [raw output](tests-attempt2-final.txt).
- `npm run typecheck`: exit 0; [raw output](typecheck-attempt2-final.txt).
- `npm run build:renderer`: exit 0; [raw output](build-attempt2-final.txt). This build produced the assets recorded in [provenance](attempt2-provenance.md).
- `git diff --check`: exit 0; [raw output](diff-check-attempt2-final.txt).
- `swiftc -typecheck` on the native capture script: exit 0. Final PNG magic and dimensions checked with `file`.

In actual Electron with real preload/IPC and isolated folders, view and project tabs, Board/Table, Add View, Customize Columns, project restore/close, Settings, property action menu and keyboard focus were exercised. The `Select` property was hidden and deleted through the existing property menu **only in test data**, which also confirmed the mutation UI remained usable. At 1024×720 CDP Tab moved to Customize Columns with `:focus-visible=true` and computed `rgb(101, 68, 213) solid 2px`; the [full native focus capture](native-attempt2-final-focus-window-1024x720.png) shows the ring. This smoke is representative; the independent verifier should test preservation of other actions and assess the visual pair.

The product diff is limited to renderer presentation, focused structural test and UI documentation. No storage, IPC, Electron security, identity or status-rule code changed. Delivery and final commit are pending the independent verifier.
