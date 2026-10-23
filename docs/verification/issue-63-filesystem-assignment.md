# Issue 63: filesystem group assignment verification

Baseline: `90c4fbdb04f1720ecf174fd8b388bb39c0fb36cd`. Scope and scenario decisions: [plan](../plans/issue-63-filesystem-assignment.md); GitHub #63 owns CI/integration status.

## Affected behavior and retention

Retain all existing service/IPC/renderer scenarios and real filesystem/crash/restart consumers. The changed interrupted UI cases add recorded paths and Details entry in both views/languages. No requirement is retired. Existing command/operation IDs, source containment, identity, no-replace, archived category restriction and all-type empty/MultiSelect semantics remain unchanged.

Observed initial focused results: 73 assignment service/IPC/renderer checks and 28 route checks pass. Typecheck and lint pass. Interrupted receipt UI follows red then green (8 EN/RU/view/type cases). Route selection also follows red then green and retains failure propagation.

The first native run failed on an invalid driver assumption: preflight collisions return `operation: null`, without journal paths. A focused real service/renderer collision probe confirms it. The driver now asserts zero unfinished operations and unchanged placement instead; actual interrupted receipts still require original/requested paths. That failed receipt and its normal exit/owned cleanup remain separately recorded.

The second native run (`work/issue-63-assignment-native`) completed ordinary and folder assignment, collision, Details/history, keyboard return and screenshot journeys. Normal quit then exceeded the existing 10-second deadline; it remains a failed run, with asserted owned cleanup. The unchanged #62 baseline passed its original ordinary driver with normal shutdown; this does not establish the second run's shutdown cause. The reviewed driver now also covers Name history and explicit returned focus. Its fresh run (`work/issue-63-assignment-reviewed`) passed 13 recorded journeys and 96 whole-screen captures with normal shutdown and asserted owned cleanup, retaining the failed run separately. Do not infer platform acceptance from those successful intermediate interactions.

## Appearance

Reference mapping: main `080b416c` Table/Board composition, bb `f135a001` Inter/compact neutral styling and accepted #59 assignment captures; #61/#62 source history/recovery controls are reused. New collision/status Details entry uses existing StatusMessage/button tokens. Source history opens the correct category/name section and focuses its summary; Escape returns to source tools in the same working view.

Inspected current EN light Table 1024, RU light Board 1024 and RU dark Board 1440 screenshots against accepted #59 Table/Board references. Sidebar, toolbar, grouped rows/cards, font hierarchy and independent view scrolling retain the accepted composition. The only added collision surface is the compact Details button below status. Existing source history styling is reused, with viewport-contained wrapping and focused summary. No permanent management form stack or document overflow is introduced. Additional reviewed captures: EN dark Table 1440 Name history, RU dark Table 1024 Name collision and EN light Board 1440 category history. Both languages/themes/sizes and both changed list surfaces were inspected against the same reference mapping. The source popover is an intentional overlay rather than a composition replacement. Exact CI provenance is recorded in the acceptance ledger below.

## Local verification and known limits

Standards review had zero findings. Spec review identified missing real Name-history and explicit focus-return assertions; both were added, then the expanded native route passed. The affected-boundary profile passed 967 tests with zero skips; renewed typecheck/lint pass. One complete `npm run test:all` on `de5c346e` finished: **3384 passed / 26 failed / 27 skipped / 3437 total**, 210.327s. [Failure inventory and full-log digest](issue-63-full-suite-failures.json) retain all exact names. Twenty-five failures are original 10-second synthetic Electron shutdown deadlines; one is the existing rename-readiness cleanup-control assertion. The failed files and their synthetic fixture/driver/lifecycle boundaries are unchanged from the accepted baseline and do not load this changed UI. Failure membership varies from #62 (nine additional names, with other prior failures absent); the timing cause is not established. No test/deadline was removed or raised and no full-suite retry was used. These remain explicit broader #67/#42 harness watchpoints. All changed assignment/dialog consumers passed; this is not a full-suite-green claim.

The Spec repair was independently re-reviewed with zero remaining findings. Local Markdown links (206 files) and diff checks pass. The selected three-host native acceptance subsequently passed as recorded below. Integrated verification is pending and will be recorded in GitHub #63. This is not a full-suite-green or release claim. Package, installer, release and final #67/#42 gates remain separate.

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

Windows-only run [39874042194](https://github.com/kornouhovas/workspace/actions/runs/39874042194),
attempt 1 at `d39a95ab`: validation passed, diagnostic original rename failed,
strict original command was not reached. Artifact `12467263254` retains the
exact receipt and normal exit/owned cleanup. Trace records first
`binding_returned` at 856ms, first `window_candidate` at 10377ms and `owner` at
11769ms, then `opened/owner_deadline`, zero selection/return. No UIA boundary
was reached. This falsifies UIA or permit latency as the primary delay for this
observed run; it does not distinguish cold Explorer registration, a blocking
later COM enumeration or process-identity work. No native repair is claimed.

A bounded additional fresh-host comparison at unchanged `d39a95ab` is run
39874685226. It is one diagnostic sample, not an until-green loop. Repeated
pre-UIA delay requires finer boundary measurements before another renewal.
Original strict acceptance remains mandatory after any diagnostic success.

The bounded comparison `39874685226`, attempt 1 at `d39a95ab`, passed validation,
original diagnostic and separate trace-disabled original rename. Downloaded
artifact `12467478047` was inspected: direct/grouped exact native selection agrees
with independent UI Automation; seven interruption/restart cases per mode,
46 normal shutdowns and all bridge/file-manager/fixture cleanup gates pass in
each command. Native request/reply latencies were 6.07s/1.96s diagnostic and
1.95s/1.95s strict. The earlier timing failure is retained, its exact cause remains
unproved, and no production native repair is claimed. This is current strict
passing coverage, not a relabelling of the failed runs.

After inspecting both focused gates, the shared-helper native tail was dispatched
as run `39875400508`, attempt 1 at `d39a95ab`, all three supported hosts. It renews
assignment, original Views, rename and category-move consumers with the current
visibility helper; unchanged service/UI receipts retain their original SHA.

## Accepted evidence ledger

Application/service/schema/native/dependency/build inputs are byte-identical
between the initial platform test candidate `5aeeb1b2` and native candidate
`d39a95ab`. The complete intervening diff contains driver/test/CI/documentation
repairs only; it changes no application build command or runtime configuration.
The current-group visibility helper expands renewal to every native consumer.
No requirement, assertion or deadline is retired.

| Boundary | Tested SHA / run / attempt | Result and inspected artifact |
| --- | --- | --- |
| Selected assignment/dialog/service/IPC/recovery tests, macOS | `5aeeb1b2` / `39871362877` / 1 | 967 passed, zero skips; `12466307094`; inherited unchanged inputs |
| Same selected tests, Windows latest / 2022 | `5aeeb1b2` / `39871362877` / 1 | 959 passed per host, zero skips; `12467321172` / `12466731997`; inherited unchanged inputs |
| Original macOS assignment + controlled projection regression | `0f0252c0` / `39873303740` / 1 | Passed; `12467421841`; focused failed-command renewal |
| Original Windows latest rename diagnostic + strict trace-disabled command | `d39a95ab` / `39874685226` / 1 | Both passed; `12467478047`; focused native renewal |
| Shared-helper regression + complete native tail, macOS | `d39a95ab` / `39875400508` / 1 | Passed; `12468805691` |
| Same native tail, Windows latest | `d39a95ab` / `39875400508` / 1 | Passed; `12468308211` |
| Same native tail, Windows 2022 | `d39a95ab` / `39875400508` / 1 | Passed; `12468532444` |

Each tail host passed 32 routing/visibility checks with zero skips, expanded
assignment (13 recorded journeys, 96 whole-window captures, all-type/empty/
MultiSelect plus real Name/category moves and collision/history/focus-return),
original Views (6 checks), original rename (direct/grouped exact native target,
seven interruption/restart cases per mode, 46 normal shutdowns) and original
category move (34 normal shutdowns). Exact SHA/run/attempt/platform receipts,
normal backend exits and complete owned cleanup were inspected. Windows selection
agrees with independent UI Automation. All three current assignment reports
assert source-stable geometry and zero replay/collision effects.

Independent Standards and Spec reviews cover the implementation and both
subsequent test/CI repairs with zero unresolved findings. Documentation-only
receipt updates have separate link/diff checks and inherit these runtime inputs;
their delivered SHA is not described as platform-tested. Integration/delivered
SHA and its actual checks will be recorded in the closing GitHub checkpoint.
The retained failed runs above and full-suite inventory remain negative evidence;
Windows cold timing cause and wider #67/#42/package/installer/release gates remain
separate. No full local suite was retried.

## Integration with accepted issue 65

Before delivery, integration advanced independently to accepted #65 at
`1bd363de`. Merge `b8759247` retains both implementations: `sourceAvailable` and
retained recovery coexist with filesystem receipt/history entry. Both review axes
found no conflict-resolution defects; routing32, typecheck, lint and build pass.
The separate issue receipts above remain their actual pre-merge evidence.
Shared renderer/CSS inputs changed, so merged acceptance is pending and cannot
inherit the pre-merge platform verdict. The combined
`filesystem-assignment-integration` route unions affected test files once and
renews both issues' development/native/package consumers on all three hosts.
No full local suite retry is selected; the affected boundary is explicitly
expanded to both accepted UI slices and all their native/package consumers.

Combined local acceptance: 1407/1407 affected tests, zero skips/failures (80.03s),
33/33 route tests, lint and208-file documentation links pass. The new route
regression was red before implementation and green after; both independent
reviews found no route/spec defects. The application build at merged `b8759247`
passed; subsequent changes are CI/test/documentation only.
