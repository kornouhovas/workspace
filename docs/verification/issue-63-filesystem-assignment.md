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
