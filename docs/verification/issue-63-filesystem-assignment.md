# Issue 63: filesystem group assignment verification

Baseline: `90c4fbdb04f1720ecf174fd8b388bb39c0fb36cd`. Scope and scenario decisions: [plan](../plans/issue-63-filesystem-assignment.md); GitHub #63 owns CI/integration status.

## Affected behavior and retention

Retain all existing service/IPC/renderer scenarios and real filesystem/crash/restart consumers. The changed interrupted UI cases add recorded paths and Details entry in both views/languages. No requirement is retired. Existing command/operation IDs, source containment, identity, no-replace, archived category restriction and all-type empty/MultiSelect semantics remain unchanged.

Observed initial focused results: 73 assignment service/IPC/renderer checks and 28 route checks pass. Typecheck and lint pass. Interrupted receipt UI follows red then green (8 EN/RU/view/type cases). Route selection also follows red then green and retains failure propagation.

The first native run failed on an invalid driver assumption: preflight collisions return `operation: null`, without journal paths. A focused real service/renderer collision probe confirms it. The driver now asserts zero unfinished operations and unchanged placement instead; actual interrupted receipts still require original/requested paths. That failed receipt and its normal exit/owned cleanup remain separately recorded.

The second native run (`work/issue-63-assignment-native`) completed ordinary and folder assignment, collision, Details/history, keyboard return and screenshot journeys. Normal quit then exceeded the existing 10-second deadline; it remains a failed run, with asserted owned cleanup. The unchanged #62 baseline passed its original ordinary driver with normal shutdown; this does not establish the second run's shutdown cause. The reviewed driver now also covers Name history and explicit returned focus. Its fresh run (`work/issue-63-assignment-reviewed`) passed 13 recorded journeys and 96 whole-screen captures with normal shutdown and asserted owned cleanup, retaining the failed run separately. Do not infer platform acceptance from those successful intermediate interactions.

## Appearance

Reference mapping: main `080b416c` Table/Board composition, bb `f135a001` Inter/compact neutral styling and accepted #59 assignment captures; #61/#62 source history/recovery controls are reused. New collision/status Details entry uses existing StatusMessage/button tokens. Source history opens the correct category/name section and focuses its summary; Escape returns to source tools in the same working view.

Inspected current EN light Table 1024, RU light Board 1024 and RU dark Board 1440 screenshots against accepted #59 Table/Board references. Sidebar, toolbar, grouped rows/cards, font hierarchy and independent view scrolling retain the accepted composition. The only added collision surface is the compact Details button below status. Existing source history styling is reused, with viewport-contained wrapping and focused summary. No permanent management form stack or document overflow is introduced. Additional reviewed captures: EN dark Table 1440 Name history, RU dark Table 1024 Name collision and EN light Board 1440 category history. Both languages/themes/sizes and both changed list surfaces were inspected against the same reference mapping. The source popover is an intentional overlay rather than a composition replacement. Exact CI provenance remains pending.

## Remaining gates

Standards review had zero findings. Spec review identified missing real Name-history and explicit focus-return assertions; both were added, then the expanded native route passed. The affected-boundary profile passed 967 tests with zero skips; renewed typecheck/lint pass. One complete `npm run test:all` on `de5c346e` finished: **3384 passed / 26 failed / 27 skipped / 3437 total**, 210.327s. [Failure inventory and full-log digest](issue-63-full-suite-failures.json) retain all exact names. Twenty-five failures are original 10-second synthetic Electron shutdown deadlines; one is the existing rename-readiness cleanup-control assertion. The failed files and their synthetic fixture/driver/lifecycle boundaries are unchanged from the accepted baseline and do not load this changed UI. Failure membership varies from #62 (nine additional names, with other prior failures absent); the timing cause is not established. No test/deadline was removed or raised and no full-suite retry was used. These remain explicit broader #67/#42 harness watchpoints. All changed assignment/dialog consumers passed; this is not a full-suite-green claim.

The Spec repair was independently re-reviewed with zero remaining findings. Local Markdown links (206 files) and diff checks pass. Selected three-host CI and integrated verification remain pending. No full-green, closure or release claim. Package, installer, release and final #67/#42 gates remain separate.

## Exact-SHA CI failure and renewal

Run [39871362877](https://github.com/kornouhovas/workspace/actions/runs/39871362877),
attempt 1, candidate `5aeeb1b255242963975809061c093d5798272b66`: macOS passed 967 selected tests; each Windows host passed 959, all with zero skips. Windows 2022 completed every selected native consumer.
Windows latest completed the new assignment route (13 journeys/96 captures)
and original Views, then original rename Reveal failed: bridge opened, no selection,
`owner_deadline`, rejected `native_unavailable` after about 12.25s. macOS failed
with `Runtime control visibility timed out` after the new RU Table Name-history
journey, while entering inherited 360px capture. Both failures and normal exits/
owned cleanup remain failures; their missing tails are not accepted. Retained
artifacts: macOS `12466307094`; Windows receipts are retained from the same run.

A controlled native regression proves a related stale-projection driver defect:
the service response can resolve before the displayed grouping changes; a visit
to the old row returns before the current occurrence exists. It was red
(`false !== true`) before the optional current-group readiness repair and green
after it. The shared helper now scopes scrolling to that current group. Existing
paths/deadlines/360px stress remain intact. This establishes the controlled cause;
the original macOS timeout is accepted only after its actual command passes.

Windows hypotheses remain explicit: initial Explorer ownership lookup exceeds its
owner budget; UIA/window readiness is delayed; or the permit/selection boundary
never becomes eligible. The original receipt establishes opened/owner expiry,
not which internal boundary caused it. The focused trace distinguishes these
predictions without changing native code or raising deadlines; trace-disabled
original acceptance must follow.

The repair changes tests/drivers/CI only. Application, service, schema, native and
dependency inputs are unchanged from the original candidate. Retain the successful
967/macOS and 959/Windows test receipts for those unchanged inputs; renew route/regression tests and
every native consumer of the changed shared visibility helper on all three hosts
after the focused failure gates pass. No original failure is relabelled passing.

Focused run [39873303740](https://github.com/kornouhovas/workspace/actions/runs/39873303740),
attempt 1 at `0f0252c0c4c645b1099cbb7170f162ce89266258`: macOS projection
regression and original expanded assignment command passed. Windows latest
failed the strict production-file bridge validation because the new workflow
incorrectly enabled diagnostic trace on the whole validation step; the original
rename diagnostic and strict commands were not reached. This is a CI environment
scope defect, not a renewed Reveal verdict. Preserve that failure.

A route regression is red with the leaked trace environment, green after
isolating validation(trace=0), original diagnostic(trace=1) and original strict
acceptance(trace=0) into separate steps. Renew only the failed Windows prefix and
original commands; retain the passing macOS focused receipt without replay.
