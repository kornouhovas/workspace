# workspace-9s1 — Workspace sessions, sources and panel chrome

Checkout: `/Users/aleksandersk/Documents/programming/Projects/project_folder`, branch `codex/bb-interface-1wx`, baseline `62cd72c`.

**Status: verified implementation milestone; required native OS-pointer acceptance remains blocked.** The task must not be closed on the strength of the renderer/CDP checks below. No live user folders or metadata were used. All source changes and file renames in verification target the disposable fixture named in [fixture.json](evidence/fixture.json). Electron security settings, dependencies, Go storage and sidecar routes are unchanged.

## Implemented behavior and causes

- Same Board/Table project clicks now close/open preview. Expanded tab IDs are retained. Preview ID is persisted separately from an expanded tab and refreshed through backend `workspace.getProject`, independently of view filters; file-tree loading is explicitly Workspace-scoped. Missing preview projects close the host with an unavailable message.
- Only sidebar width is a shared renderer preference. Existing pane layouts remain intact. A missing shared preference takes the first validated legacy layout width, or 320px. Sidebar keyboard sizing previously inverted Home/End through a pointer-specific workaround; `growDirection` now applies that direction only to pointer deltas.
- Workspace switching retains a coherent outgoing screen until a destination snapshot is ready. A load generation rejects superseded results; activation writes are ordered. The reducer accepts a complete replacement snapshot even when source and saved-view IDs differ. The failure/recovery path also batches its visible state after asynchronous reads.
- The actual Electron transport uses transitional JSON adapters. Legacy siblings receive their previous shared source and independent copies of its roles. `workspaceSources` retains each binding and role snapshots for previously selected roots. Workspace/view IDs and existing source-scoped projects, values and history remain unchanged. Different sources remain isolated; returning to an earlier source recovers its values. Picker targets are captured before waiting; settings mutations are serialized while picker waits and scans remain outside the mutation queue.
- Settings identifies the Workspace, suppresses preview while editing, and restores context on return. Unavailable sources retain their path and navigation; no mock status/property catalog or stale role tree is shown. Unknown historical source paths never fall back to another Workspace’s root.
- History arrows and sidebar toggle keep fixed positions; toggle stays after the arrows and after pane drag regions in DOM order. Leading title/tab padding interpolates with sidebar width. Reduced motion disables both transitions. Existing edge-resize→expanded and pre-drag width Restore remain operational.

Contracts: [ADR-006](../../docs/adr/006-workspace-source-bindings.md), [internal IPC operations](../../docs/api/workspace-session-sources.md), updated interface/data/Settings flow documents.

## Observed verification

| Area | Evidence and outcome |
|---|---|
| Node regressions | [initial red](evidence/red.log), [width red](evidence/sidebar-red.log), [unfiltered lookup red](evidence/lookup-red.log), [atomic snapshot red/green](evidence/atomic-green.log), [unknown source red/green](evidence/unknown-source-green.log). [Targeted suite](evidence/targeted.log): 67/67. Includes legacy siblings, ID/value preservation after source change and return, delayed picker vs activation, unavailable/canceled selections, preview round trip, shared width and atomic root/view replacement. |
| Board/Table same-card sequence | First six successful checks in [probe6](evidence/probe6-results.json): A→A close→A reopen→B content. Subsequent source checks reached 23 successful checks before the native foreground blocker. |
| Settings source isolation | [probe6](evidence/probe6-results.json): B selected a distinct fixture source through Settings, A retained its source/preview, sidebar width survived A↔B; canceled/unavailable selections retained A. Native picker responses are deterministic Electron-main test doubles; production Settings/IPC/backend run unchanged. Actual OS picker interaction is not claimed. |
| Renderer animation matrix | [renderer-probe2](evidence/renderer-probe2-results.json): **107/107**, Light/Dark × 1440×960/1024×720, three CDP sidebar cycles/configuration, rapid reversal, preview close/open, reduced motion, A/B content and restart, closed panel restoration. Corresponding intermediate/settled PNGs are in `evidence/renderer-probe2-*`. These are webContents screenshots and CDP inputs, not proof of native header hit testing. |
| Title continuity | RAF data in the renderer matrix contains intermediate occupied widths and title positions. For each of the four configurations, title X follows `208 + (460 - 200) × sidebarWidth / 460` with maximum residual below 0.011px. Toggle X remains fixed. Intermediate PNGs were inspected. |
| Advanced session/data behavior | First **32 successful checks** in [sessions-probe2](evidence/sessions-probe2-results.json): filtered preview and values after restart; delayed A→B→A→B with coherent per-frame preview; expanded tab identity/screen across switch/restart; Board/Table hides preview but retains tab; boundary resize expands before pointerup and Restore returns exact partial width; late A picker leaves B unaffected; returning A to its original root retains project ID/value. This run then exposed the unavailable-source mock-catalog bug described below; it is not advertised as an all-green run. |
| Final unavailable-source recovery | [recovery-final](evidence/recovery-final-results.json): **5/5** after fixing mock fallback and batching the error snapshot. Stored B path survives, stale/mock properties and roles are absent, preview host is suppressed in Settings, A remains usable. |
| Final code checks | [npm test](evidence/npm-test.log): **266/266**; [typecheck](evidence/typecheck.log), [renderer build](evidence/build-renderer.log), [Go tests](evidence/go-test.log), [sidecar build](evidence/build-sidecar.log): exit 0. Renderer build reports the existing large-chunk warning. [Source manifest](evidence/source-sha256.txt). |

## Failures and limitations retained honestly

- `probe` selected both buttons in a Workspace row; `probe2` expected “Project source” rather than “Source”; `probe3` expected the child of a collapsed folder. These are harness mistakes, not passes.
- `probe4` exposed a production reducer bug when both root and view IDs changed. The atomic snapshot regression reproduced it; the following probes passed that path.
- `probe5` exposed the sidebar End-key inversion; the pointer-direction correction fixed it. Later width checks passed.
- `probe6`, `probe7`, `probe8` and `native-probe` cannot establish native accessibility. CoreGraphics reported transformed/thumbnail window bounds while Electron reported a full-size logical window, with Dock foreground. Foreground retries alone did not resolve it.
- Computer Use subsequently returned: **“The Mac is locked and automatic unlock is paused because physical input was detected. Ask the user to unlock the Mac manually before continuing.”** The main agent requested manual unlock. No permission/security settings were changed to bypass it.
- The first `renderer-probe` was interrupted while waiting indefinitely for a native show event; only its own fixture processes were terminated. The harness now waits for renderer content then explicitly shows the fixture before validating sizes. `renderer-probe2` is the completed matrix.
- `sessions-probe` had a harness-only card wait when the target was expanded; the second run corrected that. `sessions-probe2` then found a real unavailable-source fallback: role tree was empty, but mock status values were rendered in Settings. Final recovery evidence verifies the fix.

Still required after manual unlock: actual OS-pointer sidebar hide/show at least three cycles (also after hidden-sidebar restart), native header routing in both themes/sizes, and final native visual sign-off. CDP `isTrusted` events are not labeled as OS input. No current native run is claimed successful.

## Resume/reproduction

The fixture is outside the repository and may be removed by macOS. Recreate a disposable fixture if needed:

```sh
node work/ui-fixes-ars/fixture.mjs > work/workspace-sessions-9s1/evidence/fixture.json
python3 work/ui-fixes-ars/prepare-native.py work/workspace-sessions-9s1/evidence/fixture.json
```

The harnesses always pass `WORKSPACE_DEV_DATA` from that manifest. They close only their own Electron process. Settings selection is stubbed in Electron main for deterministic isolated paths, including delayed/canceled results. Source unavailability is tested by renaming only fixture folders, restoring them afterward.

Compile existing native helpers (no app permission changes):

```sh
swiftc work/panel-motion-2ly/native-pointer.swift -o /tmp/workspace-2ly-native-pointer
swiftc work/panel-motion-2ly/native-foreground.swift -o /tmp/workspace-2ly-native-foreground
swiftc work/panel-motion-2ly/native-state.swift -o /tmp/workspace-2ly-native-state
```

After unlocking the Mac, run the bounded native continuation:

```sh
node work/workspace-sessions-9s1/verify-native.mjs native-resume
```

It normalizes only the disposable session, checks real CoreGraphics bounds against Electron bounds and foreground PID before OS clicks, then exercises the matrix and hidden-sidebar restart. Do not weaken its guards or replace OS clicks with CDP to make it pass.

Other drivers: `verify.mjs` covers the initial source/card flow and native matrix; `verify-renderer.mjs` is explicitly CDP-only; `verify-sessions.mjs` covers delayed/filter/expanded/data cases; `verify-recovery.mjs` isolates unavailable-source recovery. Use a new phase argument to retain previous evidence. Incomplete runs are kept in the record rather than rewritten as successes.
