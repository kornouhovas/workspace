# Issue 69: Early coherent desktop interface

Tracker and current execution checkpoint: [#69](https://github.com/kornouhovas/workspace/issues/69).
Immutable issue-start: `86ec752714c860662d4b1da0c25c2e5b71606bff`.
Executor: Matt Pocock implement. All native/textual blockers #68/#53/#54/#64
are closed. This milestone does not close #47/#67/#42 or publish a release.

## Reference and public boundaries

Main `080b416c57b2869024ac62363e96b68b40f499c0` owns composition and
working journeys; bb `f135a001e72942cee9118d2693208ec0725e2f18` owns
typography, semantic styles and controls. Retain the accepted single project
area, unique project tabs, service ownership and filesystem safety. Compare
whole windows, not isolated controls. Reuse the bundled Inter, local icons,
Hint and pinned Radix controls; no new dependency or copied module is planned.

The owner confirmed all three seams: public Workspace service with disposable
SQLite/folders; UI through user interactions; actual Electron and packaged
runtime. Tests at each boundary establish only its observable guarantees.

## Acceptance scenario map

| Requirement | Evidence to produce | Status |
| --- | --- | --- |
| One candidate: populated Table/Board/preview/expanded real tree/settings | Actual whole-window captures compared to pinned main/bb, ordinary and long data | Pending |
| Empty/loading/error/unavailable states | Existing state scenarios plus real changed-flow inspection | Pending |
| Sidebar collapse/discoverable restore/pointer and keyboard resize | Original shell/navigation journeys, focus and released-width assertions | Pending |
| Preview close/reopen, expand/return, unique tabs | Original navigation journey; view/filter/selection/scroll/focus retained | Pending |
| View create/rename/duplicate/reorder/switch/delete/cancel/last-view | Original saved-view journey and service/UI lifecycle scenarios | Pending |
| Back/Forward, branch truncation, end states, fresh history | Original navigation journey; settings/workspace return and removed destinations | Pending |
| Icons/hints/state/keyboard/Escape/popup bounds | EN/RU x light/dark x 1024x720/1440x960 inventory | Pending |
| Broad regression/native termination | Final completed-candidate full suite; retained standalone failure diagnosis | Pending |
| Supported platforms and packages | Full desktop routes, actual artifacts and exact SHA/run/host | Pending |
| Strict representative scale | Original packaged 1,000-project direct/grouped scenarios and approved limits | Pending |
| Installation | Compare current installer inputs with receipts; renew changed inputs | Pending |
| Compact final acceptance map | Appearance, behavior, safety and later issue ownership per principal surface | Pending |

## Retention and diagnosis

Retain all accepted service, identity, recovery, isolation, native Open/Reveal,
shutdown and cleanup requirements. Adapt/replace/retire inherited tests only
with a named requirement and replacement under
[test retention](../development.md#inherited-test-coverage). No requirement is
retired at task start. Reuse evidence only under the
[unchanged-input policy](../ci.md#evidence-reuse-after-test-only-repairs).

#53/#54/#64 recorded standalone property-editor, view-readiness and deferred-quit
normal-shutdown failures, including a secondary discarded-handle diagnostic
and an unbounded rename-fixture close. These are required #69 gates, not
application-cause evidence. Preserve original deadlines and ownership checks;
reproduce/minimize before selecting a repair. Local initial reproduction was
invalidated by concurrent lazy Electron extraction in a fresh dependency tree;
prepare the binary serially before native workers. Raw logs stay in
`work/issue-69/` and do not establish acceptance by their existence.

## Verification and delivery

Run focused files and typecheck during vertical slices. Complete independent
Standards/Spec review against the immutable start, repair findings, then run
the full completed-candidate suite once. Record exact failures and renew affected
consumers after repairs. Inspect required CI artifacts before integration;
skipped, diagnostic, failed and unexecuted scenarios are not passes. Current
CI/integration status belongs in the linked GitHub checkpoint.

## First vertical slice: restore compact daily composition

The original foundation command failed on the integrated base: Table top 84px,
view-strip bottom 42px (42px gap, accepted maximum 24px). #54's independent
scroll host had separated Source tools, creation and Active/Archived from the
strip. Compare the pinned main Table capture at
`docs/research/desktop-experience-evidence/main-table-1440.png` and accepted
#68 correction. This is a material regression, not a new visual baseline.

Move only entry controls through a local daily-strip target; forms, controllers,
pending receipts and error/recovery surfaces retain their original lifetimes.
Hide the relocated controls while a project is expanded. The public UI regression
failed with Source tools absent from Views, then passed with source-menu Escape
focus, creation/archive entries and expand/return identity preservation. No new
service command, dependency, native resource or storage change.

Observed local checks on Node 22.21.1/macOS arm64:

- 241 affected navigation/context/creation/archive/App/Views tests passed.
- Typecheck, lint, renderer build, documentation links and whitespace passed.
- Ten focused lifecycle/deadline/forced-cleanup tests passed.
- Original real-Electron foundation command reached all 16 populated/long and
  24 empty variants with loaded Inter Latin/Cyrillic, bounds/interaction/font
  assertions intact. Table top 54px, strip bottom 42px in all 16 variants.
  The command **failed** normal 10-second shutdown; cleanup remains unaccepted.
  Captures are appearance evidence only, not a passing complete runtime receipt.

The original three-file native reproduction reported 29 tests: 16 pass/13 fail.
Two failures masked shutdown through discarded `app.process()` handles. Capture
the owned child before close and preserve a prior scenario error separately.
Renewal exposes the original 10-second timeout instead of that secondary
TypeError (15 tests: four pass/11 fail); it does not repair native termination.
The rename fixture now uses the existing bounded close helper rather than
unbounded `app.close()`, retaining normal exit/profile-removal assertions.

The original property scenario minimized to one property-creator interaction
failed three of three sequential native launches. Disabling GPU failed three of
three too; GPU disablement is not adopted. An asynchronously scheduled sole quit
also failed and is not adopted. A native stack sample and blank-window controls
are retained locally; symbol coverage is insufficient to name a native cause.
No normal deadline, deferred-cleanup, ownership or forced-cleanup assertion is
weakened. Native diagnosis and all remaining milestone evidence remain gates.

## Subsequent observations and focused CI

Original Board and navigation commands passed on the repaired renderer, including
normal parent/backend exit and asserted cleanup. Board covers 16 populated/long,
eight empty and eight unavailable states; navigation covers 32 ordinary/long
preview/expanded states and its scroll/focus/resize/history assertions. The
original file command reached all 16 real-tree variants, Refresh/disappearance,
exact Finder selection, exact external TextEdit document and unchanged bytes,
then failed normal shutdown. Its cleanup was skipped, not counted as passing.
The [acceptance map](../verification/issue-69-coherent-desktop.md) and eight
synthetic captures preserve concrete appearance comparison separately.

Independent Standards and Spec reviews of `86ec7527...6dc5021` reported zero
slice findings and explicitly left milestone gates open. Local packaging and
resource/license artifact inspection passed with the unchanged application
runtime inputs. Strict packaged scale measurement is still a separate gate.

Downloaded official Electron 44.7.0 Breakpad symbols; framework module UUID
`4C4C44BE55553144A1E383408F6C571F0` matches the native samples. Symbolized main
waits in Chromium `BrowserProcessIOThread::ProcessHostCleanUp` and
`TaskTracker::CompleteShutdown`; a sampled network child also waits for thread
pool shutdown, with a newly starting worker in macOS
`_pthread_set_properties_self`. Other samples include internal Chromium SQLite
initialization and GPU disk-cache cleanup. These identify where work waits;
they do not establish the ultimate cause or implicate Workspace's SQLite data.

Finite diagnostic comparisons were rejected rather than adopted:

- Disabling DeclarativePerformanceObserver or shader disk cache separately or
  together still reproduces shutdown failure.
- A nonpersistent browser-session minimal control passed three launches, but
  expanded fixture testing reproduced failure. Temporary fixture edits were
  reverted; the broader run crossed that reversion and is not a candidate
  acceptance receipt.
- Official checksum-verified Electron 44.9.3, selected only through a local
  executable override, reported 29 tests: 24 pass/five fail. Dependencies remain
  pinned to 44.7.0; no update is claimed to repair termination.
- Disabling Thread QoS passed three minimal launches, then original four-file
  renewal reported 61 tests: 51 pass/10 fail. A separate 320-thread native C QoS
  start/join control completed in 0.003 seconds. No QoS workaround is adopted.

The source candidate remains free of experimental runtime flags, browser-session
changes and dependency changes. Raw diagnostic programs/symbols/logs stay under
ignored `work/issue-69/` and are not shipped.

The original macOS property route at `6dc5021`, run `39653070240`, is queued;
queueing is not evidence. Add `checks: native-lifecycle` to the existing desktop
workflow to run the four original native fixture files concurrently on all three
supported hosts, via a reusable same-SHA workflow. Preserve provenance and logs,
normal deadlines and failure propagation. Route guards and the actual exit-23
pipeline probe pass with 64 selected CI-route tests. Ordinary routes remain
unchanged; no full milestone acceptance is inferred from this focused route.

## Hosted fixture route diagnosis

Inspected original property run `39653070240`/attempt 1 at `6dc5021`:
13/13 original property cases pass on macOS 26.6.2 build 25G83, Node 22.21.1.
Downloaded provenance and original log match run/SHA/platform. This is scoped
hosted evidence, not a local macOS 27 repair or a complete milestone receipt.

First three-host native route `39655598104`/attempt 1 at `8c71718b` failed:
macOS 30 pass/13 fail (43 reported tests), Windows latest 33 pass/10 fail
(43 reported), Windows 2022 58 pass/three fail (61 reported). All failed cases
are **launch failures**, with two/three lazy Electron downloads per host and
zero normal-shutdown timeout messages. Unexecuted nested cases are not passes.
The ordinary runner prepares Electron serially; `npm run build` alone does not
do that. The newly added route omitted this prerequisite and let workers race
the same binary extraction. A new route-order regression fails before repair;
add the same serial `require('electron')` prerequisite without changing fixture
concurrency, assertions or deadlines. The repaired route/dispatch/pipeline suite
passes 64/64. Renew only this original failed route on all three failed hosts;
inspect its artifacts before any broad acceptance dispatch.

Strict local packaged scale at application candidate `6dc5021` is **failed**:
direct cold startup 5,991.3ms exceeds 5,000ms; first Table filter 354.8ms exceeds
300ms. Later recorded interactions and scans are within limits, and all seven
recorded working-set measurements are below 1GB. Three actual application
shutdown/backend checks and fixture cleanup pass. Grouped Table reset after
filtered group assignment times out waiting for usable projection: all 1,000
ordered IDs match, pending count zero, 989 field skeletons remain. A grouped-only
diagnostic reproduces this without the direct prefix. It is not a strict pass;
failure screenshot and bounded geometry collection are being used to minimize
the case. Remaining grouped Board scenarios are unexecuted. Preserve targets,
original timings and no-replay assertions; no performance acceptance claimed.


## Fractional projection readiness repair

The original grouped reset failure minimizes from 1,000 to 100 projects without
changing its geometry: the working clip ends at 624.5px, while integer
`clientHeight` extends the helper's calculated edge to 625px. A fully hidden
skeleton begins at 624.8125px. Real viewport loading correctly leaves it unloaded;
the acceptance helper incorrectly waits for it. The native fractional-bound
regression first fails on exactly that assertion (with an additional independent
shutdown timeout), then passes with normal native quit after repairing the clip.

Use fractional padding-box bounds while retaining native scrollbar space.
Complete ordered membership, pending state, actual controls and every genuinely
visible fractional row remain required. The regression covers both axes,
rounded-up/down dimensions and borders. Its expanded matrix passes; the adjacent
original clipping case passes its assertions but fails normal shutdown on the
local macOS 27 host. Typecheck/lint and independent Standards/Spec review pass
(zero findings each). A bounded failure-only screenshot retains the original
readiness exception, without action retries or deadline/target changes.

The renewed grouped-only 1,000-project diagnostic passes Table reset/edit and
Board filter/group/assignment/edit, external Refresh and RU/offscreen-draft checks.
It fails the first normal 10-second application shutdown before reopen; forced
owned-process cleanup and fixture removal pass. This proves the original readiness
repair, not complete grouped, strict-scale or lifecycle acceptance. Direct startup
and first-filter target misses from the original strict run remain gates.

Inspected native route `39656728828`/attempt 1 at `6c89b095`: all four original
fixture files pass 61/61 on each of macOS latest (kernel 25.6.0), Windows latest
(10.0.26100) and Windows 2022 (10.0.20348), Node 22.21.1. Downloaded original logs
and provenance match each host/SHA/run. This validates serial Electron preparation
on the hosted route; it does not explain or repair local macOS 27 shutdowns.
Renew the changed readiness file on all hosts and the original strict consumer
on this helper candidate before claiming its acceptance.


## Candidate 8cb8097 and deterministic native controls

The completed-candidate local `npm run test:all` passes: 3,270 reported tests,
3,244 pass, zero fail, 26 platform skips, Node 22.21.1/macOS 27 arm64.
The original strict scale renewal reaches 15 direct-source measurements, all
within numerical limits, but fails the first normal 10-second shutdown before
reopen/grouped scenarios. Cleanup passes. This is not a strict acceptance pass
or proof that earlier startup/filter target misses were repaired.

Downloaded run `39657440072`/attempt 1 at `8cb8097`: macOS passes 62/62;
Windows latest passes 61/62, failing a transient-pending trace assertion after
late driver observation; Windows 2022 passes 60/62, with one failed operand
subcase and its parent because a 200ms host deadline beats the real snapshot's
arrival. Fractional geometry and normal shutdown pass on every hosted case.

Both test races reproduce with controlled 250ms host delay. Gate the fixture's
120ms pending-completion timer on its first actual readiness observation, keep
80ms renderer work and all existing assertions, and assert at least 200ms from
observation to first paint so the injected host delay cannot satisfy coverage.
For operand classification, collect real read-only Electron snapshots first;
separate unchanged controlled-clock tests retain timely/late delivery, unknown
operands, 200ms/default 15s deadlines and single-record cleanup guarantees.
No application, production helper, clock, deadline or performance target changes.
Reviewed timing control passes 1/1; operand matrix plus delivery controls pass
17/17, including normal native shutdown. Typecheck/lint pass. Both review axes
identified the same timing lower-bound gap; the added observation-relative
assertion resolves it, with zero remaining findings.

Retain the passing full-suite receipt under the test-only evidence policy and
renew both changed native fixture files on all three hosts. Do not rerun the
unchanged full suite solely for these fixture repairs. Installer run
`39657809047` at `8cb8097` builds/verifies the DMG and passes installed-keyboard
controls but fails actual installation smoke: the old workspace creation driver
waits for a now-hidden Workspaces settings heading. The downloaded failure report
and screenshot retain this negative; installed runtime was launched and owned
cleanup passed. Diagnose/adapt the original installed journey before renewal.


## Installed workspace navigation adapter

The downloaded macOS 14.8.9/arm64 report confirms installation outside the build
and then a 30s wait for hidden `#workspace-title`; selected source and active
Workspace had already been created. The fixture now reproduces the same hidden
heading/source behind Settings, after its original asynchronous folder selection.
It fails on the original heading wait before repair. The adapter now waits for
the active sidebar Workspace, opens Settings / Workspaces, checks the same exact
visible source, and uses the existing rename/return path. No caller deadline,
creation action, identity/value/persistence assertion or installed runtime changes.
The native fixture additionally requires one creation, one Settings visit and
return to the workspace; its original never-completed creation control remains.

Focused local interaction and rejection assertions pass, but both cases fail
normal native shutdown, so this receipt is failed overall. Independent Standards
and Spec review report zero findings. Renew actual macOS and Windows installer
consumers, including their installed-workspace driver controls; retain the full
`8cb8097` suite for unchanged boundaries under test-only evidence reuse. This
adapter changes neither application/package inputs nor the strict scale harness.


## Supported-host renewal and strict numerical gates

At `ebd090ab`, inspected original native run `39659477771`/attempt 1 passes
62/62 on each supported hosted platform. Both actual installer renewals pass:
macOS `39659054203`/attempt 1 on 14.8.9 arm64 and Windows `39659356326`/attempt 1
on Server 2025 x64. Exact-SHA reports, original logs and cleanup are downloaded;
the acceptance map records their boundaries. Windows 11 release evidence remains
separate. The macOS heading-driver failure is repaired at its original consumer.

Original strict packaged run `39659477806`/attempt 1 completes all 32 functional
cases, ten memory samples and four normal quits/backend exits/cleanup on both
hosts. Mac fails first Table filter at 603.2ms. Windows fails direct/grouped Table
edit at 344.5/382.8ms and grouped Table assignment at 315.4ms. All exceed the
unchanged 300ms limit; other original timing and memory limits pass. Do not repeat
unchanged strict execution or dispatch broad acceptance before its focused repair.

Mac separate diagnostic `39660140707` reproduces filtering at 529.7ms. Mutation
and projection IPC are about 4–25ms, while renderer CPU has about 53ms work with
14ms layout and predominantly idle/frame delay. A frame requested at +23ms is
not delivered until +297ms. Default native and document visibility/focus are true;
no ultimate GPU/frame-scheduling cause is proved. Four backend batches/252 requests
complete; diagnostic tracing memory overhead is not a new unprofiled memory miss.

Ranked remaining questions: outstanding native/GPU frame work before the event,
frame throttling independent of focus, then application render/queue cost not yet
observed. Existing issue-52 evidence rejected unthrottling for its first-grouping
failure and resolved preparatory popover GPU work by observing presented operands.
Retain those results. The current explicit unthrottled comparison targets the new
first-filter symptom; it never changes strict or application configuration.
Windows gets its own existing renderer/backend profile for edit/assignment misses.

Enable existing detailed scheduler/compositor/GPU categories for the diagnostic
first direct Table filter as well as the already traced grouping interval. This
one-line change does not change a flag, action, preparation, clock, readiness,
endpoint, deadline or limit. Syntax/lint and seven focused guard controls pass;
both independent review axes report zero findings. Renew this diagnostic consumer;
retain actual unchanged native/installer/full-suite inputs and receipts.


## Presented filter/editor operands

Detailed normal-scheduling Mac diagnostic `39661385601`/attempt 1 at `c41e9126`
reproduces first filtering at 545.4ms. GPU raster/flush starts 141.7ms before Save
and lasts 449.3ms; Dawn worker spans also start before the event and last up to
228ms. Later GPU spans continue through the endpoint. Mutation/projection IPC is
about 3–17ms and a renderer task is about 46ms. These are observed intervals,
not an identified shader or proof of the unique cause of every historical miss.

The explicit unthrottled first-filter comparison `39660741556` at `ebd090ab`
still misses at 597.8ms (and direct startup 5,138.8ms); reject it. Original/default
runtime throttling remains unchanged. Windows diagnostic `39660689587` completes
all scenarios with no timing misses, but runs on AMD EPYC 9V45 while original
strict used Intel Xeon 8370C. Its complete four batches/255 requests do not repair
or replace the original strict failures on another observed CPU.

Following the existing presented-grouping boundary, add an explicit
`waitForPresentation` option to the real context-entry helper, default false.
Only affected performance preparation opts in: stable pixels of the owning
filter/editor surface, or inline control. Filter drafts, actual edit entry and
Save are prepared before the same original Enter event; preparation durations
are recorded separately. No mutation is warmed/replayed, value/filter applied,
readiness waived, paint frame removed or deadline/limit changed. Entering the
inline editor also dismisses unrelated tools through their original real entry.

The moving filter/editor native control first fails both presentation assertions
with zero submissions. After repair its UI subcases pass, but that initial run
fails local normal shutdown and remains negative. Expanded fallback coverage
then passes four tests including the parent with normal quit: owning tools,
inline editor and inline control each present before return, retain the exact
draft, perform one open, zero preparatory saves and one explicit subsequent Save.
Typecheck/lint and 52 route controls pass. Both independent reviews report zero
findings. Renew the changed native file and original strict scale on both hosts;
this is a precondition repair, not production GPU or final performance acceptance.


## Scoped-owner preparation correction and first strict pass

At `fec9fc26`, downloaded native run `39662918554`/attempt 1 passes 66/66 on
each host. Original strict run `39662918865`/attempt 1 passes on both macOS 14
and Windows latest: 32 timings, ten memory samples, four normal quits/backend
exits and cleanup each. Mac first Table filter is 192.9ms, with its separately
recorded control preparation 711.3ms; conservative peak memory is 968,359,936
bytes. Windows runs on AMD EPYC 9V45 and peaks at 833,220,608 bytes; direct/grouped
Table edit is 213.7/175.8ms and grouped assignment 190.2ms. This is bounded actual
host evidence, not proof of a unique repair for the earlier Intel-host misses.
Local `fec9fc26` strict renewal remains failed: 15 direct samples reached, startup
5,919.7ms exceeds 5,000ms, then normal shutdown fails; cleanup passes. Other
14 reached timings pass. Do not relabel this local negative as a strict pass.

A stronger native preparation case found a scoped-locator owner bug: re-rooting
`row.getByRole(...)` inside its own editor with `has` misses the ancestor row,
so the helper falls back to Save alone. Animate the editor width while Save is
stationary; the scoped case fails with presentation false while the other two
cases pass. Resolve `closest()` from the actual control node, screenshot that
owner and dispose the handle in `finally`. The default path remains unchanged.
The expanded native control passes 4/4 with normal quit; typecheck/lint and both
independent reviews pass (zero findings). Original event clocks, mutations,
readiness, paint frames and limits remain untouched. Renew the affected native
and original strict consumers on this final owner correction before broad CI.


## Windows assignment renewal and empty-row cleanup experiment

At `ed2c6feb`, native run `39663902847`/attempt 1 reports 66/66 on all
three hosts (artifact inspection pending). Original strict run `39663902198`/
attempt 1 passes Mac: 32 timings, ten memory samples, four normal exits and
cleanup; first filter 167.2ms, maximum interaction 202.8ms, peak 966,017,024 bytes.
Windows AMD EPYC 7763 fails direct Table/Board filtered assignment at
328.7/330.7ms against the unchanged 300ms limit. All functional, memory,
shutdown and cleanup assertions pass. Preserve this required negative gate;
broad CI remains pending.

Windows diagnostic `39665545703`/attempt 1 at the same SHA runs on Intel Xeon
8370C. Direct assignment is 293.3/237.7ms, with Table assignment IPC 87.2ms.
The combined grouping/assignment traces contain 646/640 fired animation
callbacks (41.8/35.1ms total). This is different-host diagnostic evidence, not
strict acceptance or proof that callbacks alone caused the earlier miss.

Test the narrow cleanup hypothesis: identity shells that have never mounted
fields have nothing to evict. Skip their deferred cleanup frames while retaining
reconciliation for loaded fields and newly always-visible rows. Observer, focus,
draft and pending retention predicates stay unchanged. A public UI preservation
case passes before and after: busy retains loaded offscreen fields, completion
evicts them, and newly pinning the first row loads it without an observer event.
After the guard, 64 related viewport/group-assignment/layout/navigation tests,
typecheck and lint pass. Both independent review axes find no issue. This is an
unproved performance experiment until the actual packaged profile and original
strict consumer are renewed. Because application input changed, the final full
suite and affected native/package/performance evidence must also be renewed.


The renewed local `npm run test:all` on `af23242d` completes in 148.0s:
3,275 total, 3,244 pass, five fail, 26 platform skips. All five failures are
normal ten-second Electron shutdown timeouts after JavaScript quit receipts:
property fixture EN Single Select creation, caller deadline, delayed owned
focus; view-readiness event timing and invalidation between frame pairs. These
fixtures load standalone HTML rather than the changed renderer; their primary
UI assertions complete. Forced cleanup reports stopped owned processes.
Retain this failed full-suite receipt and the unchanged-input relationship to
inspected named-host native run `39663902847` (66/66 each, three hosts), rather
than retrying the local full suite or calling its result green. Actual current
supported desktop/package acceptance remains required. Original strict renewal
`39667534800` now tests the production guard on both required performance hosts;
the separate package profile `39667106631` remains diagnostic only.


## Principal-journey acceptance composition

The acceptance audit confirms ordinary broad `checks: full` omits dedicated
foundation, Board, navigation and real-files native commands. Compose these
existing commands as `desktop_ux_profile: coherent` rather than assuming broad
regression alone renews principal appearance and behavior. Union shared affected
UI/service regressions once, retaining separate native property/readiness and
Windows COM controls. Run the original eight journeys sequentially, preserve
three supported hosts and the existing package/artifact/packaged-Views gates.
The new route first fails its selection regression, then passes all thirteen
route tests, including actual exit23 propagation, unique shared tests/commands,
three-host selection and package-gate evaluation. This changes test scheduling,
not application inputs or original assertions. Renew that actual profile after
the failed original strict consumer passes; ordinary full desktop remains a
separate final required gate. Appearance captures retain their actual SHA;
refresh affected Table/Board/transition states on the production candidate.

Standards review catches conflicting focused switches: coherent initially ignores
packaged-only/category-only. A condition regression fails for packaged-only;
exclude both flags from the coherent source step, preserving their existing
focused consumers rather than launching a broad bundle on a narrowed host.

Both independent route review axes now report zero remaining findings.
The focused-switch repair passes evaluated tests; typecheck, lint, docs and
whitespace checks pass. Windows package diagnostic `39667106631`/attempt1
at `af23242d` completes all 32 functional/timing observations, four normal
quits and cleanup. Its direct drop windows contain 45/29 fired animation
callbacks (5.37/4.26ms) rather than baseline 416/417 (19.05/20.62ms). The
candidate host is AMD EPYC9V45 versus baseline Intel8370C, so callback reduction
is observed but timings do not isolate hardware-independent speedup. Original
strict `39667534800` is the numerical acceptance gate.

Current local visual foundation on `af23242d` passes all sixteen populated/long
variants and twenty-four empty variants, including font, geometry and popup
assertions, then normal shutdown and fixture cleanup. Inspected light1440 and
long RU dark1024 Table captures preserve compact composition and complete
visible fields. This is a fresh affected appearance receipt, not a relabeling
of historical screenshots; the full-suite shutdown negative remains retained.


## Guard strict result and viewport budget hypothesis

Original strict `39667534800`/attempt1 at `af23242d` passes Mac completely:
32 timings, ten memory samples, four normal exits and cleanup. Windows AMD
EPYC7763 completes the same functional/memory/exit/cleanup gates but fails eleven
numerical samples: direct startup8926.6ms; direct Table filters345.2/318.7/301.3,
assignment441.3/edit343.3; grouped Table filters610.8/330.7, assignment420.4/
edit316.9 and first Board filter362.5ms. Preserve the failed result. The empty-row
guard demonstrably reduces callbacks but does not establish performance acceptance.
No unchanged strict retry or broad desktop dispatch follows this failure.

Ranked next hypotheses: (1) 1000px field overscan mounts excessive offscreen
controls, increasing startup/React/layout cost; reducing this alone predicts
lower live-field/DOM/memory work and shorter renderer spans; (2) independent
layout/grouping reloads cause intermediate full-field renders, predicting
multiple costly renders per metadata event; (3) native startup/disk latency is
a separate contributor, predicting long connection/first-window phases even
when renderer cost falls. Test the first by changing only overscan to300px,
retaining all identity shells, real observer-driven fields, localized forward/
backward keyboard gates and focus/draft/pending pinning. The original strict
consumer is the red performance signal; public viewport preservation cases
protect behavior rather than asserting an implementation-specific pixel constant.

The300px experiment passes the same64 affected UI cases, typecheck/lint and
both independent reviews (zero findings). Reviews explicitly require rapid-scroll/
field readiness, native, current appearance and full renewal before adoption.
Fresh af23242d Board and navigation commands pass their complete state and
interaction matrices with normal exits/cleanup. Fresh files reaches16tree
captures, exact Finder selection and external TextEdit document/unchanged bytes,
then fails local shutdown; cleanup is skipped, and this remains negative. The
raw file report preserves a mistakenly supplied malformed GITHUB_SHA; a separate
source-provenance receipt records the error, actual built source and renderer
hashes. Versioned images/manifest use the verified application inputs and do
not claim the pending300px application or a passing files runtime.


## Native scroll preservation for reduced preload

Extend the existing project-navigation journey with real scrollbar jumps across
five animation frames, ending at the lower position. Use the existing readonly
projection predicate to require exact service-derived ordered identities and all
actually clipped visible field controls, then return to the top and require
the same invariants. No synthetic observer callback, field materialization,
focus intervention, deadline or performance-clock change. Original navigation
scenarios remain intact. The stronger bottom/return version passes locally on
`65099447`:32ordinary/long capture states, existing focus/scroll/resize/history/
Board-preview checks, normal quit and asserted cleanup. Lint/docs and both
independent review axes pass (zero findings). This establishes eventual Table
readiness, not a frame-latency or1000project/Board performance result. The
coherent profile will renew the added native journey across three hosts after
the original strict failed consumer is repaired. Combined performance renewal
`39669773440` records separate diagnostic and original strict reports on the
same observed host; only the original unprofiled `--enforce` step accepts limits.


## Rejected preload-margin experiment

At65099447, original strict39669773440/attempt1 on Mac fails only direct
Table grouping381.3ms (observation32.5, initial readiness282.5, final stability
66.3ms);32functional samples, tenmemory samples, fournormalexits andcleanup
complete. Its separate diagnostic passes all timings. Compared with af23242d
strict39667534800, startup/groupedTable/groupedBoard checkpoints have exactly
the same loaded rows14/7/3 and DOM nodes6124/3704/2265. The hypothesized
reduction in mounted fields is not observed. Reject300px and restore1000px;
do not claim reverting an ineffective experiment uniquely repairs grouping.
Retain the actual Windows/Mac failures and the useful rapid-scroll regression.
The next diagnostic uses the actual packaged renderer under a fixed explicit
CPU throttle in an ignored harness copy, to expose renderer cost consistently;
it is never strict acceptance. No deadline, target or original harness is
changed by that diagnostic.

The same65099447 run's Windows AMD EPYC7763 strict fails six samples:
direct firstTablefilter565.2/assignment481.7; grouped first/secondTablefilters
780.5/306.2, assignment319.8 and fullRefresh6330.4ms.32functional samples,
tenmemorysamples, fournormalexits andcleanup complete. Diagnostic on that same
host reproduces Table grouping373.4/assignment314.0/edit338.1ms. Mounted rows
and nodes remain identical to af23242d, confirming no measured preload reduction.

Detailed Windows diagnostic puts actual grouping mutation work at3.3ms after
119ms queue delay; an overlapping reconciliation spans94.1ms. Assignment is
63.6ms backend plus multiple renderer passes. Preserve both backend scheduling
and renderer hypotheses; neither is proven as a unique cause. A local fixed4x
renderer-throttle diagnostic on restored af23242d application reproduces
Table grouping362.9/edit408.5ms while Board grouping164.1/edit158.9ms. It
completes16direct observations, two normal exits and cleanup (diagnostic only,
not strict acceptance). CPU samples point to repeated React/DOM work and scroll
restoration, motivating a measured Table presentation-render experiment.


## Rejected Table presentation memoization experiment

Experiment stabilizes presentation hook callbacks/state, reuses equal field
descriptors and memoizes column controls.64affectedUItests/typecheck/lint and
bothreviews pass, plus a public realSQLite/UI preservation case for open
column tools across value refresh, metadata rename and EN/RU changes.
However the same local fixed4xrenderer diagnostic gives grouping373.5ms versus
362.9baseline, assignment281.2versus279.2 and edit382.7versus408.5. This does
not establish a useful consistent improvement; discard all three production
changes. Retain the meaningful public preservation test. No strict retry is
dispatched for that rejected experiment.

The Windows65099447 diagnostic also directly exposes service queue delay:
grouping reaches backend at+119ms and executes in3.3ms; reconciliation beginning
at-29ms occupies94.1ms. Grouped periodic scans can therefore delay unrelated
metadata interactions. Inspect public-service CPU profiles before choosing a
backend change; preserve complete native-alias, reservation, identity and
transaction revalidation guards.


## Reconciliation alias index: measured candidate

The public-service baseline atd7cf7de profiles groupedRefresh272.1ms, with
about34.2ms CPU sampled in repeated grouped alias-conflict scans. Replace only
those full-array comparisons with exact JSON(dev,ino) buckets containing every
matching directory/historical record. Keep original self/owner, continuous
replaced and category-role-history predicates; birthtime remains excluded from
the alias key, matching the original conservative nativeAlias relation. No
scan, reservation, mapping, transaction revalidation or write is bypassed.

After this isolated change,148external-reconciliation/discovery-interpretation/
observed-project/background-discovery tests pass, including ambiguous aliases,
historical reused evidence, category/project relocations and native observation.
Typecheck/lint and both independent safety reviews pass (zero findings). Same
public-service profile gives groupedRefresh236.6ms versus272.1ms; native realpath
samples remain about144ms versus147ms, while conflict scans disappear from the
leading CPU samples and index construction is about1.6ms. This supports the
predicted removal of repeated comparisons, not strict desktop acceptance.
Renew original packaged strict consumers and all affected service/native/full
coverage. Startup reconciliation changed, so renew actual installer consumers
instead of relying solely on previous unchanged-service installer reuse.

Original strict renewal39673607042 tests83be28ea on both hosts. A separate
local fixed4xrenderer profile on that package still reproduces Table grouping
410.1/edit399.3ms (Board158.7/158.3); the alias index does not claim to remove
renderer cost. A further ignored-copy diagnostic changes only table border
layout to separate/zero-spacing, leaving repository CSS and its consumers
unchanged until a measured comparison justifies adoption.

The isolated separate-border diagnostic does not explain grouping:410.1→415.8ms,
with grouping Paint78.6→79.0ms and Layout36.4→33.6ms. Assignment335.7→286.2
and edit399.3→307.8ms improve, but assignment Paint only63.3→54.9ms and other
renderer scheduling also changes. Do not infer that border collapse is the
grouping cause or adopt another unproved shared style change. Repository CSS
remains unchanged; the diagnostic copy completes16observations, two normal
exits and cleanup and is retained only as an experiment.


## Alias candidate strict result and visible-row cleanup hypothesis

At83be28ea, original strict39673607042/attempt1 passes Mac completely:
32timings/10memory/fournormalexits/cleanup, maximum interaction287.2ms, peak
979,533,824bytes. Windows AMD EPYC7763 passes every limit except direct Table
filtered assignment326.5ms; grouped assignment297.6ms, Table grouping285.6/
241.2ms, grouped Refresh4669.9ms. All32functional results, memory (peak
844,922,880bytes), fournormalexits and cleanup pass. Retain the required
assignment failure; no unchanged strict retry or broad CI follows.

The current eviction effect still schedules reconciliation for already visible
or permanently pinned loaded fields, although those fields cannot be evicted.
Skip that scheduling; observer visibility changes still reconcile, and loaded
offscreen fields retain the original delayed cleanup for pending/focus return.
Newly pinned unloaded rows still schedule loading; add the reverse unpinning
case to public preservation coverage. Prediction: fewer fired frames/row passes
in the same fixed4x diagnostic, before renewing the actual Windows strict gate.
No readiness, event clock, paint endpoint or limit changes.

The visible-row guard's fixed4x diagnostic reaches15direct samples. Table
assignment335.7→292.0ms, grouping410.1→382.4ms and edit399.3→391.7ms.
The drop window fires47→9animation callbacks and93→47FunctionCall events;
Paint remains63.3→63.5ms. This supports the scheduling prediction rather than
a paint-style cause. The command then fails the known local normal shutdown
timeout; forced owned-process stop and asserted cleanup pass. Preserve that
failed diagnostic command: it is neither a complete nor a strict native receipt.
Both review axes report zero findings on the guard. Renew original strict
consumers; no timing endpoint, callback observation predicate or budget changes.


## Visible-row strict renewal and subsequent isolated probes

Original strict `39675697329`, attempt 1, at `1b87e521` passes Mac M1 Virtual
and fails Windows AMD EPYC 7763 direct/grouped Table filtered assignment at
343.4/302.7ms against 300ms. Both reports/logs are downloaded and inspected:
32 functional observations, ten memory samples, four normal application/backend
exits and asserted cleanup pass on each host. All other timing limits pass.
The guard's work reduction does not establish closure of the required strict
gate. Cumulative Standards and Spec reviews against the issue-start base each
report zero implementation findings. Broad/coherent/installer renewal remains
behind the focused gate; do not retry unchanged strict inputs for a green host.

Windows renderer/backend diagnostic `39676643141`, attempt 1, at the same SHA
runs on faster AMD EPYC 9V45, completes all 32 observations/four normal exits/
cleanup, and does not reproduce the numerical miss: assignments 198.7/174.4ms.
Direct assignment command is observed at +0.2 to +51.2ms; configuration reads
at +46.2 to +53.2ms and projection query at +79.2 to +95.2ms. This is bounded
scheduling evidence, not acceptance or proof of the earlier host's cause.

Reject a one-variable projection `useLayoutEffect` experiment. Same-host fixed4x
comparison against the visible-row baseline gives assignment 296.4 versus
292.0ms, grouping 380.1 versus 382.4ms and edit 405.5 versus 391.7ms. The query
starts at +119 versus +134ms but end-to-end assignment does not improve.
All 52 related UI tests pass; the diagnostic completes 16 observations, two
normal exits and cleanup. Restore original effect scheduling. UI tests completed
during disposable fixture preparation, before the diagnostic measurements.

The next hypothesis is eager construction of closed column-control panels:
fixed4x drop samples include approximately 4.6ms self/10ms inclusive work in
TableLayoutControls, while no column popup is open. Extract column computation
and control JSX into a stable child component mounted by the existing Radix
Content. Keep the same content lifetime, current props, feedback ownership,
keys, width-editor lifetime and focus return; no cache or memo comparator.
All 52 related UI cases, typecheck/lint, package/artifact build and both review
axes pass. Measured benefit remains pending; do not infer it from the extraction.


Reject the closed-panel extraction after its fixed4x diagnostic completes all
16 observations, two normal exits and cleanup. Assignment is 301.7 versus
292.0ms, grouping 362.8 versus 382.4ms and edit 386.0 versus 391.7ms. Drop-window
FunctionCall work is 143.0 versus 141.5ms and Paint 66.3 versus 63.5ms, so the
predicted net reduction is not established. Restore original TableLayout source;
retain the passing preservation checks and zero-finding reviews as experiment
evidence, not acceptance. Current package must be rebuilt after this restoration.


Revisit the separate-border hypothesis specifically for the remaining assignment
boundary, not as the previously rejected explanation of grouping. On the current
visible-row renderer, the isolated package-copy override completes 16 direct/
reopen observations, two normal exits and asserted cleanup. Assignment changes
292.0→289.3ms, grouping 382.4→375.1ms and edit 391.7→288.8ms. Assignment Paint
63.5→55.0ms repeats the earlier alias candidate's independent 63.3→54.9ms;
FunctionCall stays approximately 141.5→140.4ms. This establishes bounded paint
work reduction, not end-to-end closure or a unique cause of the slow Windows
host. Keep original budgets, event clocks and readiness/exit predicates.

Adopt only separate table borders with zero spacing. Existing cells own only
bottom/right borders and remove the last right separator; no competing row/
table borders or rowspans require collapsed-border arbitration. Both review
axes report zero source findings. All 69 relevant UI cases, typecheck/lint and
package/artifact build pass. Actual visual geometry and rapid-scroll/navigation
renewal are running before candidate publication. Shared active/grouped/archived
and detail surfaces still require affected coherent/broad acceptance; the old
appearance manifest does not accept the changed CSS.


The current CSS candidate's visual-foundation command reaches all 16 populated/
long and 24 empty variants with original geometry/font/popup assertions, then
fails the local normal-shutdown deadline. Forced owned-process stop passes;
report retains stopped=false/cleaned=false, so this is not a passing native
receipt. Inspected actual ordinary EN light1440 and long RU dark1024 Table
captures: single separators, aligned headers, wrapping and compact strip remain
coherent with the pinned references; no material appearance mismatch observed.

The subsequent original navigation command passes all 32 ordinary/long states,
rapid-scroll exact identities/clipped visible fields, focus/label isolation,
vertical/horizontal scroll and filtered clamps, expand/return, resize/endpoints,
collapse/restore, EN/RU, tab close/reopen/reorder, real history and Board preview.
Normal quit and asserted cleanup pass. Raw local reports correctly have no
manually supplied Git SHA; adjacent source-provenance.json records actual
execution HEAD, full renderer input hashes and the uncommitted source diff.
Original hosted strict renewal remains required before any broad acceptance.


## Separate-border strict renewal and idle value-button work

Original strict `39679072917`, attempt 1, at `09faa767` passes Mac M1 Virtual:
32 observations, ten memory samples, four normal exits/backend exits, cleanup,
maximum interaction276.6ms and conservative peak934,215,680bytes. Table
assignments are213.0/226.5ms. Windows Xeon8573C fails only direct Table filtered
assignment310.5ms against300ms; grouped assignment282.1ms and every other
numerical limit pass. Windows also completes all functional/memory/exit/cleanup
assertions. Both artifact sets are downloaded and inspected. Required direct
assignment remains open; no unchanged strict retry or broad acceptance follows.

The next isolated optimization retains JSX only for an unchanged idle scalar
value button. Dependencies cover its actual label, disabled/editing state, raw
and displayed value and language. The click handler captures only stable React
state with a functional update. Retained editors remain outside the memo and
receive every current identity, revision, option and save callback. No custom
comparator, stale revision, service cache, timing or readiness change.

Extend the existing real-service Table popup preservation case: after value,
property-name and language updates, close column tools, open the localized cell,
assert the latest value and Escape focus return. It passes before the production
change. All87related Table/assignment/filter/viewport/navigation/component and
Number/Date/Select UI cases pass afterward; typecheck/lint, package/artifact build
and both independent reviews pass. No new implementation-coupled timer assertion.

Same-host fixed4x diagnostic completes16direct/reopen observations, two normal
exits and cleanup. Against the computed-equivalent separate-border copy,
assignment289.3→269.1ms; drop-window FunctionCall140.4→127.9ms (46→38events),
Paint55.0→53.6ms and Layout11.6→9.0ms. Table edit288.8→292.2ms and grouping
375.1→380.7ms do not establish improvement. Retain only the bounded reduction
in assignment work as justification; original hosted strict renewal is required.


## Passing scale/installers and Windows file-Reveal failure map

At `b577cfd2`, original strict `39680595721` (attempt1) passes both required
hosts; downloaded reports/logs verify32timings, ten memory samples, four normal
application/backend exits and asserted cleanup each. Mac M1 maximum interaction
286.8ms/peak924,696,576bytes; Windows Xeon8573C maximum241.2ms/peak847,798,272,
direct/grouped Table assignments227.5/214.4ms. Historical failures retain their
actual host/SHA; no unchanged strict retry or target relaxation accepts them.

Both actual installers pass at the same candidate, attempt1: Mac `39681337146`
on14.8.9arm64 (DMG SHA2560fc3cf1447947fa70c94c2e772f691cb2acd7931aa0d0aebb6b79657bcac3527)
and Windows `39681752968` on Server2025x64/kernel10.0.26100 (NSIS SHA256
86ef9d9e75aae33517a4d9beff85b16f5d9d791eac6e33d2d93e91415d39207e).
Actual outside-build installation, bundled service/data identity, EN/RU,
isolation, reopen/replacement/reinstall, Windows default APPDATA/uninstall,
normal exits and asserted cleanup pass. Reports/artifacts are inspected;
this does not supply Windows11 release evidence.

Coherent `39681330400`, attempt1, passes all principal and package steps on
macOS latest and Windows2022 at `b577cfd2`. Windows latest passes1374shared
regressions, original native controls, visual16/24 variants and Board16/8/8,
then fails original `smoke-project-files.mjs:75`: actual nested Unicode-file
Reveal presents the external-action failure. All16preview/expanded captures,
real tree/arrow focus, empty/Refresh/disappearance checks precede that failure.
Normal application/backend exit and asserted cleanup pass. Navigation/shell/
workspace/source/Views and package gates on this host remain unreached; full
CI is not dispatched while this focused boundary is open. Original report
lacks native phase/CPU evidence, so do not claim a specific COM cause.

Ranked hypotheses: native bridge/COM rejection, Explorer readiness, or Unicode
path handling. Add a dedicated Windows-only workflow for the unchanged original
file consumer, existing build prerequisite, pipefail and always-upload evidence;
trace defaults off, trace-enabled probes are diagnostic only. Subscribe to the
existing trusted main-process native events with128metadata records, no paths,
and report exact SHA/run/attempt/kernel/CPU. Both observer installation and read
have independent1000ms diagnostic deadlines and separately recorded failures;
they do not replace the original failure or block normal close/owned cleanup.
Both review axes identified that missing bound initially and now report zero
remaining findings after its repair.47route/lifecycle tests, lint, syntax and
documentation checks pass; actual pipeline exit23 and a no-pipefail negative
control establish failure propagation. No application, permit, retry, UI/native
deadline, ownership or data assertion changes. Renew only the failed original
consumer before classifying acceptance reuse and unreached Windows journeys.


Initial direct dispatch of the newly added workflow returns GitHub404 because it
is not on the default branch; no consumer ran. Add the same-SHA reusable call
from the existing desktop workflow instead, following the native-lifecycle route:
`checks: project-files-windows-trace` for diagnostics and `project-files-windows`
for original execution. Both skip common/full; ordinary defaults and matrices
remain unchanged. The route test evaluates these conditions and trace mapping,
in addition to actual pipeline failure/negative controls.14route checks and lint/
docs pass; both review axes report zero findings on this caller repair.


Trace-enabled focused `39684193756`, attempt1, at `9b05276c` completes all
original tree/Open/Reveal assertions, normal exit and cleanup on Windows kernel
10.0.26100/AMD EPYC9V45. Observer evidence is complete with no diagnostic errors:
assemblies170.6ms, compile425.9ms, Shell572.9ms, binding1044.4ms, window candidate
2643.5ms, UIA root4225.7ms, readiness4974.3ms, final readiness5033.5ms, one
SELECT, stopped and done. It does not reproduce or identify the earlier native
failure; no native production repair or cause is claimed. Run one original
trace-disabled consumer with the new bounded report at the same diagnostic-only
candidate to capture the failing bridge phase or establish its actual current
result. This is not a retry-until-green sequence; another failure returns to its
new evidence rather than an unchanged rerun. Broad acceptance remains behind it.

Refresh seven curated appearance images from the passing Mac coherent consumer
at actual application `b577cfd2`; retain the before image's original base. Manifest
hashes and all renderer inputs match; no src delta exists through diagnostic
candidate `9b05276c`. Actual Table/empty/error inspected by coordinator and Board/
real-tree preview/expanded/settings inspected by independent Spec reviewer:
zero material appearance findings. The compact map now separates current passing
boundaries, failed/unreached Windows routes and retained local native negatives.
This appearance renewal does not accept the failed Windows native operation.


Original trace-disabled focused `39684755404`, attempt1, at `9b05276c` passes
on AMD EPYC7763/kernel10.0.26100. All16tree preview/expanded captures, real
Refresh/disappearance, exact native file selection, exact external document and
unchanged bytes pass. Events show one started/open/select/stopped/done sequence;
no observer collection error. Normal exit and asserted cleanup pass. Downloaded
original report/runtime log are inspected. Earlier cause remains unknown; neither
this receipt nor the diagnostic is described as a native production repair.

Independent policy audit confirms failed-Actions loop §2 permits bounded
unresolved-cause evidence; §4 still requires the original focused command and
its artifacts, now satisfied. §5 permits acceptance renewal after that pass.
No new human decision is prescribed without a contract/support change. Renew
unreached Windows navigation/package using existing navigation-native route
`39685187380`; its fixed two-Windows matrix is retained. Then run ordinary full
acceptance for missing common/platform/source/shell/workspace/service/package
coverage. Existing passing Mac/Windows2022 principal evidence and current strict/
installer results retain their actual unchanged application inputs and SHA.


Navigation renewal `39685187380`, attempt1, at `9b05276c` passes both original
Windowslatest/Windows2022 native navigation consumers and their selected UI
regressions. Reports/provenance are inspected:32ordinary/long states, rapid
scroll/visible fields, resize/scroll/focus/history, normal exit and cleanup pass.
Package steps are deliberately skipped by navigation-native; an initial shorthand
"navigation/package renewal" was inaccurate and is corrected here. Packaged
Views and the other unreached source/shell/workspace/native/platform consumers
remain for ordinary full `39685830877`, now dispatched at the same diagnostic/
test-only SHA. Current application/installer/strict source inputs stay unchanged.


Full `39685830877`, attempt1, at `9b05276c` failed. Common checks pass.
macOS platform:2756 tests/2728 pass/2 fail/26 skip; Windows2022:
2775 tests/2760 pass/2 fail/13 skip. Both failures are the same two stale CI
inventory expectations omitting the new project-files dispatch modes. All other
executed platform cases pass; Ladle/development/package tails are unreached.
Windows latest fails its original early direct-creation consumer before native
invocation: the accepted settings heading exists but is hidden. Its later shell
artifact/collector failures are consequences of unreached prerequisites, not
separate product diagnoses. Preserve those failures and exact logs/artifacts.

Adapt the three creation/rename/category drivers to visible selected sidebar
workspace identity (exact ID and name), retaining navigation readiness. A real
Electron fixture distinguishes hidden headings, a same-name selected sibling
and the unselected target before the user's navigation completes. Keep bounded
normal shutdown, captured owned child and asserted cleanup. Reconcile the two
inventory expectations. Local focused verification:52/52 pass; lint passes.
Standards/spec review found no contract finding. No application input changes.
Renew the original Windows latest early direct command first with the original
trace environment via existing readiness/native/early route; then selected
identity/inventory and original Reveal controls. Missing three-host runtime tails
remain required, retaining individual unchanged passing platform rows above.


Driver/inventory repair committed as `df6708a6`; focused original run
`39688465783`, attempt1, is pending. The explicit missing-tail selector is tested
red before addition and passes52/52 inventory checks after implementation.
It preserves the original two-Windows default, adds all three hosts only with
`all-desktops`, renews failed inventory/new native identity controls, and copies
the exact full prefix only for the previously unreached Windowslatest host.
Original observer/category environments, collector validation and artifacts are
retained. Original Ladle/development/package tails and normal failure propagation
remain. Spec review:0 findings; skip duplicate Windows early native only after
its focused receipt passes and is inspected. No blanket unchanged platform rerun.


Focused `39688465783`, attempt1, at `df6708a6` fails later: creation form
420px stress bounds right421>420 with expanded220px sidebar. Required desktop
1024/1440 captures pass, identity/inventory and original Reveal controls pass;
native/restart stages remain unreached. Normal failure quit/cleanup pass.
Artifact and screenshot inspected; no native failure claimed. The desktop spec
requires1024/1440, not an expanded420px mobile client. Retain420px reachability
stress via real Collapse/Restore, asserting collapsed/discoverable restore and
expanded state at required desktop widths. No bounds/operation/ownership/data
assertion removed. Apply the same capture adapter to creation/rename/category
and base runtime's inherited420px discovery/settings captures; real workspace
selection restores its sidebar before using entries. No production change.
Native adapter regression passes53/53 selected tests; lint passes. Original
local direct after_evidence creation now passes including native invocation,
restart, normal exits and cleanup (`work/creation-runtime-dev-1792622873682`).
Renew the changed original Windows consumer before missing-tail continuation.


Standards review found one collapsed-settings continuation error: Back and the
next Settings tabs were hidden after the420px capture. New native regression
fails with expected Back action/actual null before repair. Shared settings entry,
return and workspace selection now restore the sidebar through its real action;
no settings command is skipped. Repeat inventory52/52 and lint pass. New native settings/collapse assertions
complete, but local macOS27 normal Electron quit hits the preserved10s timeout;
52pass/1failed of53. Do not label this renewed native execution green. The
previous original local creation remains its actual passing receipt; current
native lifecycle acceptance must renew on named CI hosts. Standards re-review:
0 remaining findings. No timeout/cleanup weakening or unchanged local retry.


Focused `39689266663`, attempt1, at `8fb787e4` reaches native and fails:
one exact parent open, zero selections, owner_deadline in opened state. Trace
reaches uia_root8663.8ms; no properties marker before12sowner expiry. Receipt
rejects native_unavailable. Bridge start/stop1/1; failure normalquit and exact
filemanager/fixturecleanup pass; restart unready. No stale-heading/bounds failure.
New native settings/identity/inventory controls pass on Windows. Prior cold
Windows cause is not established by this sample. Ranked hypotheses: UIA read
latency, lost exact window binding, native event delivery delay. Add one existing
bounded read-only terminal native inspector after strictfailure+confirmedbridge
stop, onlywithtrace1. Five-second observation/one-secondtermination budgets;
unknown/throw prevents ownedcleanup, primaryerror retained. No new select or
native/application/deadline modification. Host metadata reads no Explorer state.
Native diagnostic regression redbeforefix;84pass/2platformskip of86 selected
inspector/product/inventory tests, lint/docs pass. Found/reconciled another
source-continuation prefix fixture to account only unconditional defaultsteps;
actual optionalguard and unchangedtail remain independently asserted. Both
reviews0findings. Renew these changedcontrols on all3tailhosts. One diagnostic
focused run precedes justified originaltraceoff renewal; neverretryuntilgreen.


Bounded diagnostic `39690085187`, attempt1, at `cbbbd263` passes on AMD
EPYC7763/kernel10.0.26100. Downloaded host/report/log inspected: exactnative
open/select/return1/1/1, independentCOM/UIAselected agreement, readiness5107ms,
creation/recovery/restart, two normal backend/app exits and assertedcleanup pass.
Failure-only terminal inspector is not reached; this does not explain or repair
prior ownerexpiry. New native/inventory/product/inspector controls87/87 and
original Reveal controls249/249 pass. Trace-disabled original renewal
`39690488883`, attempt1, pending on sameharness; inspect before all-desktops tail.


Original trace-disabled `39690488883`, attempt1, at `cbbbd263` fails again:
EPYC9V74/kernel10.0.26100, oneexactparentopen/zero selection, owner_deadline
at12043ms and native_unavailable receipt. Nativebridge, failurequit and exact
filemanager/fixturecleanup confirmed. No phase trace by design. Gate remains
failed; previous diagnostic pass is not a native repair or stable original pass.

Read-only audit narrows the earlier trace: owner→uia_root is3996ms failed versus
1172ms passed, and includes HWND/PID/Get-Process, not UIA root acquisition itself.
Root→properties is446ms in pass but never completed before expiry in failure.
Repeated Add-Type and process-name lookup are measurement candidates, not proven
removable freshness guards. Do not remove repeated owner/UIA authorization checks.

Add explicit `checks: native-owner-profile` for a generated-copy diagnostic of the
same Electron creation consumer. Verify generatedbytes match source, pin exact
replacementmarkers, retainoriginal/instrumentedhashes, profileonly process lookup,
assemblyload and FromHandle wall/CPU, cap64fixedscalarrecords, restore+verify
originalbytes in finally. No source/dependency/package-input modification.
Originalnativeactions/permit/identity/deadlines and failingexit remain. Defaultoff;
profilecopies cannotaccept productiontiming or originalnativeexecution. Local
transformation/drift/route/product/inspector tests86pass/2platformskip of88;
lint/docs pass. Standards0/Spec0, actualPowerShell execution remains forCIprobe.


GitHub rejected the new boolean dispatch at `47fdfe24` with HTTP422: maximum25
workflow_dispatch inputs. No job was created. Move this explicit diagnostic
selection into existingchecks choice `native-owner-profile`, preserving all
25inputs/defaults. Reconcile common/checks inventory and assert only its focused
Windowslatest job selects; ordinaryreadiness remains original. No product failure
or successful diagnosticexecution is inferred from dispatch rejection.


Generated-copy diagnostic `39692017634`, attempt1, at `feaa5226` passes onEPYC7763/
kernel10.0.26100.25fixedscalarspans, originalexit0 and verifiedrestorationhashes.
Firstprocesslookup567.2ms/CPU15.6, firstroot599.7ms/CPU31.3; repeatedprocess/root
reads1–2ms, repeatedassemblyload1–2ms. Actualcreation/recovery/native/independent
COM+UIA/restart/twonormalquits/cleanup pass in this alteredcopy only. It doesnot
reproduce or explain the original failure. Preserveoriginalgatefailed.

Next explicitdiagnostic `native-owner-direct-profile` changes only generatedcopy
processlookup to fresh .NETGetProcessById/ProcessName withfinallyDispose, keeping
all HWND/PID/Explorer/root checks and originalnativeguards/deadlines. This tests
whether cmdletfirst-use cost is avoidable without dropping a freshness predicate.
No appsource/resourceinputchange. Varianttestredbeforefix;87pass/2platformskip of89
selectedchecks; lint/docs pass. Only a measuredcopiedhypothesis, notproductionfix
or permission to claim originalacceptance. Originaltraceoff remainsrequired.


Direct-copy `39692600770`, attempt1, at `70e8c79a` passes onXeon8370C/
kernel10.0.26100.25validspans, originalexit0, verifiedrestoration; processfirst
7.5ms, root1205ms. Complete native/independentCOM/UIA/restart/twonormalquits/
cleanup pass onlyin alteredcopy. Differenthosts preclude a causalratio or old
failure attribution. This supports a scoped first-use process-cmdlet elimination.

Production replaces the same two process-name reads with a shared fresh
GetProcessById/ProcessName/finallyDispose helper. Every HWND/PID/Explorer/root/tab,
pre/post item freshness, permit and deadline guard remains; nothing cached.
Adapt controlledUIAfixture injection to the new lookup, retainingwrongprocess
rejection. Add actualWindows control that forbidsprocesscmdlet, reads selftwice
and rejects unavailablePIDs. Temporary generated-copy tools/selectors/tests are
retired after their completed diagnostic purpose; reports/history remain. No
product requirement or native safety scenario is retired. Keepdispatch25limit
regression. DocsCI currentroute corrected afterreview; sourcecode0findings,
Spec0. Native source/build inputs nowchanged: oldb577strict/installers are not
currentacceptance. Originaltraceofffirst, thenfreshfullall3/strictboth/installers.

Initial local targeted command omittedtsx and failed importing the TypeScript
bridge test; this is invocation failure, not native behavior. Lint/typecheckpass.
Repeat the selected command with its requiredtsx loader before publication.

Corrected targetedtsx command:190total/176pass/14platformskip/0fail;
lint/typecheck/docs pass. Standards documentation findingresolved,0remaining;
Spec0. ActualnewWindowsprocesscontrol and originalnativeexecution remainCIgates.


Originaltraceoff `39693324029`, attempt1, at `299a46be` COMPLETEPASS onEPYC7763/
kernel10.0.26100: creation/recovery/nativeopen-select-return1/1/1, independent
COM/UIAagreement, restart, twonormalquits/backendexits and assertedcleanup.
Actualnewprocessidentitycontrol and249Revealcontrols pass. Overalljobfails only
terminalUIAcontrolledfixture still overriding oldGetProcess; secondmock was missed
in reconciliation. Preservefailedtestlog; no productfailure inferred. Adapt that
fixture to newhelper, retainwrongprocess/nativePID/offscreen/disabled assertions.
Run onlyoriginalfailedfile+actualprocesscontrol through `native-owner-controls`;
no appbuild/npmdependency required, strictpipefail andexactSHA/run/attemptupload.
Source/app stays299a; do not repeatpassed originalnative now. Full/strict/install
renewal remains behind this focusedfilegate. Source safetyreviews0remain.


Focusedcontrol renewal `39693870739`, attempt1, at `9a359816` passes12/12 on
Windowslatest. Downloadedoriginaltestlog inspected, includingterminalUIAcontrolled
conditions andactualprocessidentity/unavailablePIDcontrol. Sourceinputs exactly
match originaltraceoffpassed299a46be. Test-onlydiff preserves that native receipt.
The focusedgate is now satisfied; this doesnotattribute oldnativeexpiry uniquely.

Currentappcandidate299a46be, verificationhead9a359816. Freshfull39694044347,
strictbothcandidate-only39694044226 (immutablebaselineinherited), macOSinstaller
39694044252 dispatched/attempt1. WindowsinstallerfollowscompletedmacOSinstaller
toavoidsharedworkflowconcurrency cancellation. Renewcurrentnativefileconsumers
andcoherentcoverage asrequired afterfull; priorrendererappearance inputsremain
byte-identicalb577, but oldnative/strict/installers cannotacceptnewresources.


Freshstrict `39694044226`, attempt1, at `9a359816` fails bothoriginalhosts:
M1Virtual/kernel23.6.0 directTableTextedit310.8ms>300; EPYC7763/kernel10.0.26100
directTableassignment314.8ms>300. Bothfinishall32functional/timingcases,10memory
samples/fournormalapp+backendexits/assertedcleanup. Macpeak918388736bytes. Both
rawreports/logsdownloadedandinspected. No unchangedstrictretry. Retainusefulfull
andinstallerjobsalreadyrunning. MacDMG39694044252passes14.8.9arm64completeinstall/
reopen/replacement/identity/isolation/ENRU/cleanup; hash57b53e00ce7346f497c050ded4a6885573b88390bb36423b09aa2346b7917e96.
WindowsNSIS39694305845pendingatthesameverificationhead.

Ranked Textsave hypotheses: broadTable re-render, backendcommit/snapshot cost,
focus/paint stabilization. Existingdiagnosticfilter/assignmenttraces coverWindows;
add CPU/timelinecaptureforTexteditonlyunderexistingprofileFilters. Strictaction,
clock, endpoint and300mslimit unchanged; profile/enforceguard retained.8fixture/
backend/querychecks+1CLIguard pass, lint/docs pass; Standards0. Runexisting
performance diagnostic_only/profile_filters/profile_backend onbothfailedhosts;
no baseline or originalstrictrepeat untildiagnosticevidence selectsnextstep.


### Full-suite observer fixture repair and bounded strict renewal

Full run39694044347/attempt1 at9a359816 has completed. Common passes.
Mac platform:2763 total,2722 pass,14 fail,27 skip. Both Windows hosts:
2782 total,2755 pass,the same14 fail,13 skip. Downloaded original job logs
confirm every failure is an LF/CRLF negative workflow mutation fixture: copied
source-runtime prerequisites introduced a second matching fragment outside the
actual verify job. All other platform scenarios and early source/native creation
prerequisites pass independently; Ladle/dev/package tails remain unreached.
Retain all24 workflow checks and scope mutation plus validation to the unique
actual verify job. New observer-workflow route runs both original observer and
suite-inventory files on all three affected hosts, with original retained-call
collector validation and always-uploaded exact-SHA evidence. No app/build inputs,
assertions, deadlines or ordinary CI defaults change. Local97/97 tests, final
24/24 LF/CRLF controls and lint pass; Standards review0. Focused hosted renewal
must pass before acceptance continuation.

Diagnostic39694806459/attempt1 atba683bab completes both hosts,32 cases and
four normal app/backend exits/cleanup each. Mac Textedit181.4ms (backend9.8ms);
Windows assignment340.7ms (backend51.7ms,76.7ms before backend start).
Profiles do not identify a removable safety operation or establish a unique
cause. One predefined original strict renewal39695914995/attempt1 runs with
unchanged candidate299a,preparation,event clock,endpoints and limits. Spec review
accepts this bounded renewal after diagnosis; another failure requires renewed
diagnosis, not another equivalent profile/retry cycle. Mac job has passed;
Windows is pending. Passing renewal is evidence for its actual host/run, not a
proof of universal reliability or a reclassification of the previous misses.

Current Windows installer39694305845 passes all installed/offline/isolation/
reinstall/uninstall/normal-exit/cleanup assertions; NSIS SHA256
f8ccfd9b2916bfc137571d8d20f00719ec24b054cb5bf692ef65100ffd69754d.
This is Server2025 x64 evidence, not Windows11 release acceptance.


Continuation checkpoint: observer controls closed; Windows strict assignment remains open

Branch codex/issue-69-coherent-desktop, HEAD b8579bba; app inputs remain 299a46be. Full39694044347/attempt1 at9a359816 completed: common passes; Mac2722 pass/14 fail/27 skip, Windows latest and2022 each2755 pass/14 fail/13 skip. Every failure is the same LF/CRLF workflow mutation fixture targeting duplicated text outside the actual verify job. Other platform and source/native prefix rows pass; Ladle/dev/package tails were unreached.

Repair b8579bba scopes mutations AND validation to the unique actual verify job, retaining all24 controls. Local97/97, lint/docs pass, Standards0. Original focused [39696523771](https://github.com/kornouhovas/workspace/actions/runs/39696523771), attempt1, passes97/97 on each of Mac/latestWindows/Windows2022. Downloaded tests.log and original collector.json inspected: complete, ordinary, exit0, exact SHA/run/attempt/host. No app/build/limit changes.

Bounded diagnostic39694806459 completed both hosts. The predefined original strict renewal [39695914995](https://github.com/kornouhovas/workspace/actions/runs/39695914995), attempt1 atba683bab: Mac M1 Virtual passes all targets (max255.1ms); Windows EPYC7763/kernel10.0.26100 again misses direct Table filtered group drag312.8ms>300. Both complete32 functional/timing cases,10memory samples,four normal app/backend exits and asserted cleanup. Original report/logs inspected. Previous misses remain failures, not host-noise dismissals.

No further unchanged strict retry. Windows-only bounded renderer/backend diagnosis [39696644374](https://github.com/kornouhovas/workspace/actions/runs/39696644374), attempt1 atb8579bba, pending. Distinguish event/command delivery, backend execution and committed Table paint; preserve action/membership/clock/endpoints/limits. A profile alone will not authorize another identical strict retry. Mac need not repeat absent an affecting change. Spec review confirms broad missing tails remain behind this unresolved strict gate. Installer/native receipts remain as previous checkpoint; no release/main/next issue.


### Measured snapshot batching candidate

Windows-only diagnostic39696644374/attempt1 atb8579bba runs on the same
CPU model as the failed strict host (EPYC7763/kernel10.0.26100). It reproduces
313.7ms direct Table assignment with immediate command arrival: backend75.66ms,
projection38.77ms. All32 observations,four normal app/backend exits and cleanup
complete. This rules out delivery delay for this sample, not every earlier miss.
Do not rerun the unchanged strict candidate.

A bounded public-service experiment identifies avoidable snapshot work: every
Select option made a separate workspace-visibility query and property type
presence made four more definition queries. Read source-filtered,position-ordered
definitions once and derive types; read workspace-filtered visibility once only
when Select definitions exist. Keep all output field omission,value ordering,
revision/ownership checks and transaction boundaries. No caching across requests.
The initial unconditional visibility prototype fails the retained populated
pre-Select upgrade scenario. Conditional hasSelect repairs it; retain the test,
not a new assumption that every historical schema already has Select tables.

Temporary real SQLite/folder fixtures use public Workspace service commands.
100-project/20-property/24-option snapshot mean1.837ms ->1.084ms (100 reads).
At representative1000 projects with the same20 properties/24 options, snapshot
mean6.836ms ->5.705ms; complete JSON output is deeply equal. Same-fixture public
filtered group assignment A/B/B/A (10 warmups+30 measured mutations each) gives
means23.559/20.429/20.674/23.188ms; medians23.484/20.365/20.522/22.977ms.
Each mutation asserts the exact selected option. This supports reduced service
work, not a claim that the full Electron interaction now passes300ms.

Retain/adapt existing regression coverage at the public service seam:105/105
Text/Number/Date/SingleSelect/MultiSelect/group-assignment/filter/grouping/
metadata-removal cases pass, including workspace visibility isolation,restart,
old-schema upgrade and rollback. Lint/typecheck pass. Full-snapshot equality
and both independent reviews pass (Standards0,Spec0). These existing scenarios
cover the changed response semantics; no implementation-mirroring query-count
test or timing-sensitive unit threshold is introduced.

Select one original strict renewal on both hosts after this changed production
candidate is committed. Keep all original clocks,preparation,endpoints and
numerical targets. Another failure returns to diagnosis. If adopted, changed
backend/package inputs reopen affected full runtime/package/installer evidence;
old native-resource/renderer appearance receipts retain their actual SHA and
unchanged-input justification. No broad acceptance before focused success.


### Snapshot candidate strict result: new Mac grouping gate

Original39697859659/attempt1 atf5398b92 completes both hosts. Windows
Xeon8370C/kernel10.0.26100 passes all32 targets (max296.5ms),10memory samples,
four normal app/backend exits and assertedcleanup. This differs from the earlier
EPYC7763 host; it accepts this actual receipt, not unique causal attribution.
MacM1Virtual/kernel23.6.0 completes the same correctness/memory/exit/cleanup
requirements but fails grouped Table grouping309.8ms>300. Direct Table assignment
252.7ms/edit203.8ms pass. Failed grouping observation starts+7.1ms, firstpaint
260.9ms, finalstabilization48.9ms. All raw reports downloaded and inspected.
Do not repeat unchanged strict Mac. Current focused gate is grouped Table
grouping on Mac, not the now-passing Windows receipt.

Ranked predictions: grouping save/projection/backend queue cost; mounting grouped
Table controls/fields; layout/paint and original final-frame stabilization.
Existing Mac-only renderer/backend diagnostic39698462359/attempt1 atf5398b92
captures the first(change) marker in grouped-table-grouping-assignment trace,
not its later(drop) marker. Keep original clocks/endpoints/targets. Another
profile pass alone will not authorize another unchanged strict retry. Broad
acceptance and integration remain gated.


### Measured observer-driven scroll restoration candidate

Mac diagnostic39698462359/attempt1 atf5398b92 completes32 observations/four
normal exits/cleanup; grouped Table grouping242.8ms is diagnostic, not a strict
renewal. Backend grouping1.86ms arrives immediately; projection17.5ms. FIRST
change-event trace identifies9 scroll restore callbacks,10.79ms work and one
4.52ms forced layout. This supports a scoped rendering-work hypothesis, not
unique attribution of the earlier309.8ms strict miss.

A same-host packaged renderer experiment under fixed4x CPU (grouped only;
never acceptance) compares unchanged restoration with observer coalescing.
Both complete16 observations,two normal application/backend exits and cleanup.
Grouping406.7 ->394.3ms; assignment325.4 ->307.1ms; edit312.4 ->320.7ms.
Trace review confirms9 notifications become3 geometry passes; restoration work
26.72 ->4.88ms and nested forced-layout14.56 ->0ms. FunctionCall union109.65
->80.29ms; Layout31.97 ->28.85ms; Paint38.00 ->40.13ms. Categories overlap.
Firstpaint391.9 ->380.3ms and finalreadiness406.7 ->394.3ms; the original
endpoint/finalframes remain, not a shifted completion criterion. Net latency
benefit is modest; strict success is not inferred.

Coalesce only observer-driven reads. Observer notifications immediately cancel
pending final-placement frames; initial placement, current busy/bounds reads,
parent/child coordinates, final two frames, identity checks, user cancellation
and effect cleanup remain. Cleanup cancels both frame handles. No change to
viewport overscan, command preparation, numerical targets or measurements.

Retain17 existing navigation/viewport UI cases, all pass. Add one real Electron
regression with actual geometry/native input, no DOM dimension/frame mocks:
expand/return coordinates, wheel/pointer/key interruption while busy without
later snap-back, view replacement, shorter projection clamping and draft
retention. A review finding that key cancellation was tested after clamping to
zero is repaired: End now moves a scrollable owner to a distinct bottom position
before projection completion. Wheel coordinates are captured after actual final
position and two frames. Reviewed native test passes1/1 with normalquit/cleanup.
Both review axes have0 remaining findings. Lint/typecheck and111 selector/
observer/inventory tests pass; original24 LF/CRLF guards remain intact.

The new scroll-restoration desktop profile runs focused native navigation plus
this original regression on all3hosts. Existing navigation-native remains2Windows
and ordinary defaults remain unchanged. Sequential native registration also
covers coherent acceptance; the full platform suite discovers the new file.
Select one original strict renewal on bothhosts plus focusednative3hosts for
this changed source. Broad full/coherent/package/installer/appearance acceptance
remains behind both focused gates; every new failure returns to diagnosis.


### Current strict result and request-local snapshot reuse

Original39699904612/attempt1 atf581f93f: MacM1Virtual passes all32 targets,
maximum298.1ms. WindowsEPYC7763 fails only direct Table assignment310.6ms>300
(observationstart65.9ms,firstpaint279.5ms,finalstabilization31.1ms). Both complete
all32 functional observations,10memory samples,four normal application/backend
exits and asserted cleanup. Downloaded reports and originalfailedlog inspected.
No unchanged strict retry. Native39699908853/attempt1 atf581f93f passes all3hosts:
new native scroll control1/1 each, original32-state navigation, exact identities/
visible fields, scroll/focus,ENRU,Back/Forward,normalquits/cleanup. Original logs
and reports downloaded/inspected. Cumulative reviews86ec..f581 both0 findings.

The next measured backend optimization removes a repeated full snapshot read
inside active ordinary metadata assignment. The command already owns a complete
snapshot; pass it only as a backend-internal argument to stored projection.
Inside the current read transaction require matching workspace,source and
propertyRevision, otherwise perform the original fresh read. No IPC field,
persistent cache or schema change. Filesystem and archived assignments keep
the original read path; final mutation transaction/authorization stays intact.

Representative1000-project/20-property/24-option public service A/B/B/A,
10 warmups+30 actual filtered assignment mutations perbatch: mean20.592/14.624/
14.556/20.208ms; median20.714/14.535/14.580/20.013ms. Every returned committed
option is asserted. This demonstrates reduced service work, not full strict
acceptance. All temporary fixtures are closed/removed; hashes and raw benchmark
receipts retained under ignored work evidence.

Add real SQLite service regressions for a stale snapshot after a committed
value update and a foreign source at the SAME property revision. Both pass.
A controlled compiled-copy mutation removes only identity/revision guards;
both scenarios fail2/2, proving sensitivity. Production source is untouched by
that negative control; throwaway compiled module/test copy removed. Existing
41 focused filter/group/folder-assignment cases pass. All107 affected property/filter/group/folder/metadata-removal safety cases pass;
lint/typecheck/docs pass. Both source reviews0 findings.

Select one original both-host strict renewal on this changed implementation
after final checks. Any new failure returns to diagnosis. Native-scroll inputs
and the previously passing focused control are unchanged; full/coherent/package/
installer/appearance acceptance still requires current affected renewal before
integration. No release/main/next issue.

### Frozen application acceptance and auxiliary fixture failures

Application candidate9face229/attempt1 strict39701212914 passes both hosts:
MacM1Virtual/kernel23.6.0 max258.6ms/peak933085184B; WindowsEPYC9V74/
kernel10.0.26100 max257.1ms/peak836993024B. Both complete32 observations,
10memory samples,four normal app/backend exits and asserted cleanup. The
Windows CPU differs from preceding EPYC7763 failures; no universal or unique
historical causal claim. Coherent39702006958 passes all3hosts, including
native exact-target/Open/external-document/byte preservation,32navigation
states,16ordinary/24longstates,Board and development/packaged Views with
normal app/backend shutdowns and cleanup. Reports downloaded/inspected;
seven refreshed Mac images independently reviewed with0 material findings.

MacDMG39702007001 and WindowsNSIS39702006868 pass actual installation,
bundledbackend,ENRU,identity/views,isolation,replacement/reinstall,normalexit/
cleanup. Exact hashes and actual hosts are in the acceptance map. Temporary
verification ref holds exactly9face to avoid same-ref workflow cancellation;
its build inputs are the same and it must be deleted only after delivery.

Full39702007107/attempt1 at9face: common/static pass. Mac2739pass/1fail/
27skip: actual0ms observer CLI cancellation's worker exits1. Both Windows
platform suites2773pass/0fail/13skip, Ladlebuild and108creationcaptures pass;
category layouts then fail first collision-English fixture readiness15s.
All later runtime tails remain unreached. Original logs/artifacts retained;
these failures are not transferred to another issue or counted as passing.

Observer original CLI cases pass2/2 locally. Hypotheses: partial release
publication, cancellation affecting worker, unrelated terminal failure. The
parent directly writes the release file while the real child polls it; a
controlled delay after create/beforewrite reproduces exact workerexit1.
Test-only helper publishes complete exclusive pending file by same-directory
rename; the same real-worker regression passes. All110 original observer
checks pass, and combined originalobserver/inventory/workflow controls208/208
pass. Original full log lacks child cause: partial publication is a proven
fixture vulnerability, not a proven unique cause of the initial failure.
Finite failure-only worker classification retains future evidence without
paths/log excerpts. Cancellation/ownership/deadlines/terminal/cleanup asserts
remain. Both independent reviews0 findings; lint/docs/whitespace pass.
Commit8c68253 adds focused observer-cancellation on all3consumerhosts, retaining
pipefail, failure artifacts and original/full defaults. Focused success and
all failed/unreached runtime rows remain gates. Application9face is unchanged.

Observer focused39704164666/attempt1 at8c682531 passes166/166 on eachhost;
exact provenance/logs downloaded and inspected. The original singleMacfailure
remains historical; no claim of its unique cause. Requirement coverage renewed.

Category readiness reproduced locally on the exact original command with normal
quit. Bounded DOM probe: loaded row,moveCalls0,old second-column action absent.
The current command lives in project actions; no production code repair needed.
Retain the operation/identity/mutation requirements; adapt fixture preparation to
actual contextual row action and Source-tools/history disclosure. New ENRU
productionUI regression fails2/2 under oldselector and passes2/2withnewhelper;
history disclosure submits no review/recovery/move. All209 originalUIchecks pass.
Read-only initial review reopening remains bounded to one refresh; focus returns
to actual visible contextual owner, while disabled mutations remain asserted.

Adapt shared geometry to visible content. Compact Table header ellipsis requires
actual nowrap/ellipsis/hidden CSS AND the exact full label in accessible metadata;
values and operation paths retain wrapping. Under accepted desktopminimum1024,
retire ONLY daily Active/Archived row internaloverflow from standalone420px
operation-form stress. Required1024/1440toolbar coverage remains coherent39702006958;
420px operation forms,paths,controls anddocumentoverflow checks remain. Original
category command passes50states/150images/interactions/normalquit locally at
work/issue-69/category-layout-repaired6. Every priornegative retained. Both
independent reviews0; lint/typecheck/docs/whitespace pass. Focused hosted original
category command remains required, then all shared layout consumers need renewal.

Production-equivalence proof: same isolated9face checkout/toolchain; sequential
production Vite builds before/after overlaying only the changed story and its
story-only helper yield all10 identical output hashes. Temporarycheckout removed.
Helper reachable only fromstories/tests; backend/native/migrations/dependencies/
configuration are unchanged. Actual installer/coherent packages build without
Ladle and retain unchanged production inputs. Broad full/source-runtime packages
also contain dist/Ladle under existing dist/** packaging, so renew their pending
packaged consumers after current Ladle build; do not call packagebytes identical.

### Category focused success and complete layout consumer renewal

Original category focused39705377859/attempt1 atea3f2057 passes onall3hosts.
Downloaded reports eachassert50states,150captures,50interactions,featurePassed
andnormalshutdown. Original209UIchecks alsopass. Keep actualsourceprovenance;
subsequent sharedhelperextraction renews categoryconsumersagain inunfilteredrun.

Sharedgeometrymeasurement requires allstoryconsumers, notcategoryonly. Original
local --rename reproduces firstcollision-direct-English readiness15s/normalquit.
Same stale cellselector: currentaction is contextual. Extract identicalpublic
storyentry/historyhelpers into story-context-preparation (stories/tests only),
use them forrename and keep categorywrappers. Adapt renamefocus toactualvisible
owner, keep disabledmutation,exactdraft,Cancel/status/recovery/mutationcounts.
A copiedoldselectorhelper/test negativefails bothENRUcases; originalsource
untouched andtemporarycopiesremoved. Actual productionUIaction/historycases
assertzero commands. Combined407UIcheckspass; originalrenamecommand completes
96states/288images/normalquit. All99 route/workflowguards pass; lint/typecheck
pass. Both independent reviews0. Unfilteredoriginallayout locallypending covers
all302states/906images, including every sharedmeasurementbranch.

Add explicit source_runtime_platform=runtime-tails choice under existing
source-runtime route: all3hosts, unchanged originaldev/releasecommands, direct
Windowslatestcreation included. Renew storyUI+route/identitycontrols then
unfilteredLadlebeforemissingruntimeconsumers; skipalready-passedplatform/prefix
rowsandduplicateselectedcaptures. Preserve every failure and all-layout evidence.
All existingchoices/defaultsunchanged. Focused originalcategorygatepassed above;
newlayout/runtime evidence remains required. Noacceptance/integration yet.

Final sharedstory production-equivalence proof passes: isolated9facecheckout,
sequentialVitebuilds before/after allthreecurrentstory/helperoverlays produce
10identical hashes. Exact overlay/outputhashes retained under
work/issue-69/production-equivalence-final-story/report.json; temporarycheckout
removed. Full diff from9face changes onlytests/stories/drivers/manualroutes/docs;
backend/native/migrations/dependency/buildconfig/productionresources unchanged.
Strict/coherent/install receipts retain actual9faceSHA. Pending runtime-tail
packages intentionally rebuild Ladle extras; packagebytesarenotclaimedidentical.

Local unfilteredLadle completes302states/906captures andnormalquit. All shared
measurement/storybranches pass. Runtime-tail39706193093/attempt1 ata959e7a9
builds onall3 but fails original5-fileinventory beforeUI/Ladle/runtimes. Exact
failure: windows-product-diagnostics:489 compares literalif strings andrejects
newprofileconditions; task missed this dependentfixture. Mac89pass/1fail/3skip;
bothWindows fail sameguard. No runtime tail executed. Cancellation requested
only after discovering deterministiccommonfailure; runhadalreadycompleted and
wasnotcancelled. Preserveactualfailures/logs/artifacts.

Scopedtestrepair evaluates conditionsperprofile/OS and compares authoritative
originalverify commandorder/environment. Existingprofiles matchexactly; newtails
permit only selected→unfilteredlayouts andWindowslatestdirectcreation. Retain
allruntime/packagecommands/order/environment. Original5-filecommand passes93
localchecks:90pass/3platformskips; finalcombinedinventory/workflowcontrols136:
133pass/3skip. Bothindependentreviews0; lint/docs/whitespace pass. Addfocused
source-inventory routeall3withtheexactoriginal5files/provenance/pipefail/always
artifacts; newrouteguardensuresoriginalcommand. Noapplicationinputschanged.
Focusedhostedsuccessmustprecedenexttaildispatch; allunreachedrowsremainpending.

Source-inventory39706702525/attempt1 at50d6ee5 passes all3: Mac91pass/3skip,
bothWindows94pass/0skip. Exactprovenance/logs inspected. Next runtime-tail
39706958232/attempt1 atsame50d6 builds, passes originalinventory and407UIchecks,
then unfilteredLadlefails all3 atcategory-editing-English420: measured
category-property-header overflow. 1440/1024capturespass; originalnormalquit
passes. Localunfiltered302states/906capturespreviouslypasses onMac27, so
retainhostdifference ratherthan claiminglocalreproduction. Allruntimetails
remainunreached. Downloadedall3reports andprimarylogs retained.

Rankeddiagnostichypotheses: nativecontrolmetrics/widthconstraints; measurement
beforepost-resizegeometrysettles; absoluteheadertrigger expanding themeasured
box. Add finitegeometry fromtheoriginalmeasurement plus failure-only screenshot/
corroboratinggeometry. Noassertion ordeadline changes. Reviewcaught anunbounded
failureevaluate beforecleanup: use existingwithDeadline1000ms andexplicit2000ms
screenshottimeout; originalfailureassigned/savedfirst, unavailablecaptureseparate.
Bothreviewsconfirm0remainingfindings. Controllednativefixturefailure proves
originalnonzerooverflowverdict, geometry/imagecapture, normalElectronquit;
temporarymutantscriptremoved. All137 route/controlchecks locally134pass/3skip,
lint/docs/whitespacepass. New layout-fixtures routeall3 runs onlyoriginalunfiltered
command+Ladleprerequisite, exactprovenance andfailureartifacts. Selectonebounded
diagnosticprobe; noacceptanceoruniquecauseclaim from it. Productioninputsunchanged.
