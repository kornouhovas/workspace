# workspace-2ly — panel motion and resize

Checkout: `/Users/aleksandersk/Documents/programming/Projects/project_folder`, branch `codex/bb-interface-1wx`, baseline `ef6e97c`. Verification uses a disposable Electron bundle and isolated metadata/project fixtures; no real project folders, backend, IPC, Electron security settings or dependencies changed.

## Causes and behavior

- Saved-view selection cleared the project but left `rightVisible` true, exposing Navigation in the right host. View selection now hides that host while retaining project tab identities and the saved split. Restore explicitly opens the preview again.
- Content repeated the project name in a padded heading. The host tab remains visible; the dialog has the project name as its accessible label, and Properties starts immediately below the header. The partial preview tab no longer receives the hover close action. Header Hide/Expand and keyboard controls remain.
- Sidebar visibility used `display:none`, and the right host unmounted. Both now animate occupied width for 220ms. Outgoing preview content/name remain during close; hidden content is inert immediately, outgoing dialogs ignore Escape, and the retained preview is released after the transition. Reduced motion disables transitions. Existing expanded tabs switch screens immediately.
- Right width was capped at 640px and at workspace-minus-280px. Pointer resize now follows the pointer up to the workspace edge, with all width easing disabled during capture. At that edge it enters the existing expanded mode during the drag. Pointer up, cancellation, lost capture and unmount release resize listeners/capture.
- Restore uses the partial width at **pointerdown** of the drag that reached the edge, not the near-full intermediate width. Ordinary completed resizes establish the next partial width. An explicit-width session marker distinguishes manually resized 560px from the legacy automatic-half-width value; legacy sessions keep their existing automatic behavior.

The sidebar toggle remains after all pane drag regions in DOM order, preserving the native routing correction from workspace-ars.

## Evidence and harnesses

- [User screenshot](evidence/user-before.png), copied from the supplied temporary path.
- [Before native probe](evidence/before.json): expanded→Board leaves a 519px right host, preview close exists, and resize max is 640.
- [Initial regression failures](evidence/node-red.log), [manual-width regression failure](evidence/manual-width-red.log), [targeted green](evidence/node-green.log).
- [Main native harness](verify.mjs): OS CGEvent clicks and pointer drags, Light/Dark × 1440×960/1024×720, three hide/show cycles with right preview closed/open, RAF intermediate dimensions, outgoing content/inert checks, hover/title checks, edge expand before mouseup, Restore, data/search preservation, rapid reversal, reduced motion and true app close/relaunch.
- [Additional native harness](verify-extra.mjs): exact 560px and repeated partial resize, lost-capture cancellation after OS drag, drag-expanded mode/identity/Restore width across restart, launcher separation, inert Escape, Add Table, and real intermediate PNGs for both panels in all four theme/size configurations. Capture cancellation uses the browser's releasePointerCapture API on a capture acquired by OS pointer, followed by further OS drag/up; it is distinguished from OS mouseup in the result.
- [OS click helper](native-click.swift) and [pointer helper](native-pointer.swift) post through CoreGraphics HID event tap. CDP/DOM are used for observation, setting fixture window size, auxiliary keyboard interactions and setup; sidebar routing and boundary drag are actual OS pointer events.

Intermediate probes are retained, not represented as final passes. `probe`/`probe2` used overly strict accessible-name matchers; `probe3` exposed the missing explicit Restore visibility update; `probe4` completed the four configurations but stopped at an incorrect New Board menu name. `final` passed 278 assertions then expected search to survive **view creation**. Existing `workspaceAppState.ts` intentionally clears search on `viewCreated`, while `activeViewChanged` preserves it. The final harness sets its search after creation and before expanded→view, retaining the original Board/Table preservation assertions.

## Reproduction

The exact completed runs used the fixture in [fixture.json](evidence/fixture.json), which lives under the system temporary directory. The helpers require macOS Accessibility access already available to this session. Compile them with:

```sh
swiftc work/panel-motion-2ly/native-click.swift -o /tmp/workspace-2ly-native-click
swiftc work/panel-motion-2ly/native-pointer.swift -o /tmp/workspace-2ly-native-pointer
swiftc work/panel-motion-2ly/native-foreground.swift -o /tmp/workspace-2ly-native-foreground
```

Verified run entry points and initial UI states:

- `node work/panel-motion-2ly/verify-routing.mjs routing-diagnostic`: a ready Board/Table screen with Project Alpha; it clears only fixture project tabs before its repeated cycles.
- `node work/panel-motion-2ly/verify-resume.mjs resume-complete`: a ready Board/Table screen. It creates its additional Board, then closes/relaunches twice, ending on an expanded project. This is the completed remaining-acceptance run.
- `node work/panel-motion-2ly/verify-extra.mjs`: an expanded Project Alpha with the fixture Notes value `2LY preserved note`. It ends on Board with the preview closed.
- `node work/panel-motion-2ly/verify-smoke.mjs smoke-complete`: an expanded Project Alpha. This is the completed final-source native smoke.

For a fresh disposable fixture, create its manifest with `node work/ui-fixes-ars/fixture.mjs > work/panel-motion-2ly/evidence/fixture.json`, then run `python3 work/ui-fixes-ars/prepare-native.py work/panel-motion-2ly/evidence/fixture.json`. [verify.mjs](verify.mjs) documents the broad matrix and value setup used for the first 278 successful checks; its incomplete runs are not advertised as an all-green command. Run the targeted entry points above from their stated UI state rather than chaining them blindly. The successful route used for handoff is the completed diagnostic + extra + resume + final smoke evidence below.

Each harness closes only its own Electron process and exits nonzero on failure. Native verification temporarily focuses its fixture window. webContents screenshots omit macOS traffic lights; native clicks still traverse window-frame routing.

## Completed verification and limitations

| Requirement | Completed evidence |
|---|---|
| Both themes/sizes, preview and expanded layout, no duplicate heading/hover close | [matrix assertions](evidence/final-results.json), first 278 passing checks; all four configurations completed before the unrelated view-creation setup assertion |
| Intermediate width frames, smooth open/close, rapid toggles, reduced motion, outgoing content/inert | [RAF samples](evidence/final-results.json), [16 intermediate PNG captures and checks](evidence/extra-results.json) |
| OS drag intermediate positions, edge expansion before mouseup, visible/hidden sidebar, restored pre-drag width, data | Eight drag scenarios in [matrix](evidence/final-results.json); repeated partial 560/610, lost capture and drag-mode restart in [extra](evidence/extra-results.json), 23/23 checks |
| New saved view, retained search/tab identity, hidden host after restart, three OS hide/show cycles after collapsed restart, expanded restart | [resume-complete](evidence/resume-complete-results.json), 15/15 |
| Repeated OS expanded→view→tab→Restore routing | [routing diagnostic](evidence/routing-diagnostic-results.json), 12 complete cycles / 36 assertions; per-click native bounds and DOM hit/regions captured |
| Final source native smoke | [smoke-complete](evidence/smoke-complete-results.json): 66/66 assertions and 147 trusted pointer events; all four theme/size configurations, three sidebar hide/show cycles with preview closed/open, drag-expanded→Board/Table and Restore |
| Code checks | [npm test](evidence/npm-test.log): 259/259; [typecheck](evidence/typecheck.log), [renderer build](evidence/build-renderer.log), [diff check](evidence/diff-check.log): completed successfully |

The renderer build reports the existing Vite large-chunk warning. No Go checks were needed because backend/IPC/sidecar contracts were unchanged. Text logs have trailing whitespace normalized; test outcomes and messages are unchanged. Final source files are recorded in [SHA-256 manifest](evidence/source-sha256.txt).

Early native runs `final2`, `routing`, and `routing-after` sometimes did not deliver a pointer event in the header. The 12-cycle diagnostic passed with captured native bounds/hit regions; that alone does **not** establish the cause of those earlier misses. Removing drag regions from hidden headers is a hidden-host invariant, not a claimed causal fix for these intermittent observations.

A separate startup coordinate error in `resume`/`resume2`/`resume3` is proven by [native coordinate probe](evidence/coordinates-results.json): the actual CGWindow/Electron width was 1358, while the forced renderer viewport was 1440 and the target rect lay beyond the native window. The click then activated Dock. The completed resume waits for native window show/readiness before resizing, verifies native/renderer dimensions, stabilizes focus and measures the target after two animation frames. It dispatches OS move/down/up separately with the pointer helper. `resume-final` also records a corrected harness-only variable error before the successful `resume-complete`; none of these incomplete runs is represented as a pass.
