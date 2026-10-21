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
