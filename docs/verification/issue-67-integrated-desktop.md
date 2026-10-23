# Issue 67: Integrated desktop verification

Status: **in progress; not accepted**. Issue and live checkpoints:
https://github.com/kornouhovas/workspace/issues/67.
[Scenario/retention map](../plans/issue-67-integrated-desktop.md).

## Latest consolidated receipts (production A222)

The [hosted ledger](issue-67-evidence/hosted-ledger-a222-through-8f32.json)
retains actual reports and SHAs through harness8f32; source/build/dependency/native/
migration inputs remain identical to productionA222. These are combined receipts,
not a complete passing run at8f32.

- Broad39944358198: complete regression inventory and302Ladle states/906captures
  pass on all three hosts. Mac3447pass/3474total27skip; each Windows3544pass/
  3557total13skip across its three serial batches. Windows latest passes all31
  packaged journeys and strict44/44 with tracing off. Direct/grouped Table drag
  274.1/237.4ms, preview172.2/186.2ms, complete tree671.5/2997.3ms; peak conservative
  process-memory sample900415488bytes. Approved preview endpoints remain300/5000ms
  from one opening event; all other interaction limits remain300ms.
- [Archive renewal39942111999](issue-67-evidence/archive-renewal-a222.json): original
  dev/release archive/Views and24contextual journeys/192captures per mode pass on
  all three hosts. No postA222 product change invalidates these original receipts.
- [Actual installers](issue-67-evidence/installers-a222.json): DMG39942643346 on
  macOS14.8.9arm64 and NSIS39942908192 on WindowsServer2025 pass external install,
  persisted identity/reopen/replacement, bundled backend/isolation/notices/version
  and cleanup. Windows Server does not establish Windows11 acceptance.
- Focused39960693209 at9e3: workspace and ordinary assignment pass all three hosts.
  FS-only39963985819 at8f32 now passes all three original release consumers,
  including360px stress,96supported-size appearance captures, collision/identity/
  metadata checks, equal controlled bounds, normal quit/backend exit/owned cleanup.
- Partial tails39965141240 at8f32: Mac passes sources, Board, navigation, keyboard,
  files, scalars, selections, properties and projects, then fails categories before
  the move control exists in Board preview. Windows2022 fails its first projects
  rename entry; later rows are unreached. Both failed journeys retain normal quit,
  backend exit and cleanup. Passing prefixes remain at their actual SHA.

Current Winlatest sourceA222 captures were separately inspected in88 selected
whole-window EN-light/RU-dark variants across principal and late surfaces. Table,
preview/tree, expanded/tree and settings were compared with accepted#69 captures:
composition and foundation remain; Add property/edit controls are intentional#58
additions. These sampled comparisons complement the complete capture inventory;
they do not supply missing platform or behavioral acceptance.

Local Darwin27 fresh full candidate remains3446pass/1fail/27skip3474total:
original10000ms native Electron shutdown. Thirty narrow controls and74sampled
lifecycle cases pass; one explicitly diagnostic full-context run reproduces18
failures/20samples. Unsymbolicated native stacks do not establish a unique cause.
No deadline relaxation, full-suite retry-to-green or acceptance waiver is applied.
Windows11/System-theme and remaining native/package/strict gates remain open.

## Candidate and execution

Base `5799532c4966e026b96b6b18718f5a8e8171bf6b` includes accepted #66.
Task branch `codex/issue-67-integrated-desktop`. This change adds acceptance
infrastructure and repairs completed-operation focus in the archive panel.
Schema, native resources and runtime dependencies remain unchanged. Earlier
fixture-only renderer/package equivalence receipts are historical; the focus
repair requires renewed application/package acceptance. Existing principal UI journeys now explicitly
select development or the packaged executable. Development remains the default.
No assertion, deadline, identity/data-preservation or cleanup gate is relaxed.

The final integrated runner executes all principal/late journeys, original native,
crash/recovery consumers and strict scale sequentially against the package. Its
manifest retains actual SHA/run/attempt/host, each command/log digest, all script
digests, app.asar and full package file/symlink inventories. Package changes cause
failure. Failed commands stop the runner, retain their nonzero exit and mark
remaining rows unreached. Bounded tail renewal explicitly records excluded rows
and cannot return complete acceptance. Diagnostic failure probes also cannot pass.

Scale keeps the original #41 inventory and numerical limits. The final runner
also selects `--project-flows`: event-to-committed-paint preview, expand, expanded
Text commit and return at 1000 projects/20 properties/10 views per direct/grouped
source, actual public-query value assertions, cancelled draft, unique tab and
additional conservative process-memory sample. The immutable earlier #41 baseline
does not support these newer flows and retains its original default inventory.

## Preparatory local evidence

Host: Darwin27.0.0 arm64, Node22.21.1. These receipts precede the reviewed final
candidate and are not final integrated acceptance.

- Fresh build and package/resource verification pass. Explicit packaged Board
  passes 32 populated/long/empty/unavailable variants, keyboard widths, group/layout
  persistence, source-outage recovery, normal shutdown and owned cleanup.
- Launcher selection was red for missing package-mode support and then green.
  CLI failure-propagation was red before the integrated runner and then green.
  Focused launcher/integration/existing desktop-route command:38/38, zero skips.
- Preliminary complete runner: foundation, shell, workspace management, sources,
  Board and navigation pass against one package. File-tree/native scenario reaches
  every functional assertion, including exact Finder Reveal and TextEdit document,
  then **fails original 10000ms normal shutdown**. Forced process-group cleanup
  reports stopped; the caller's owned-process/fixture cleanup receipt remains
  unverified/skipped. Later journeys in this attempt are unreached. Original
  `work/issue-67-integrated/report.json` and per-journey logs are retained locally.
- Diagnosis: original standalone deferred-cleanup test passes; eight sequential
  controls pass at approximately1.1–1.2s each. Original packaged files command with
  Playwright browser logging also passes including native target, normal quit and
  owned cleanup. This does not reproduce a deterministic causal mechanism, repair
  the original failure or relabel the first attempt green. Controls and original
  diagnostic live under `work/issue-67-diagnosis/`.
- Preliminary independent tail begins with scalars, selections, properties and
  ordinary assignment passing. Its actual subsequent rows and final-candidate
  results belong to the next checkpoint, not an inferred passing full run.

No inherited requirement/scenario is retired. Package-mode adaptation supplements
the original public service/real-SQLite/filesystem/isolation/native/platform suite.

## Appearance and outstanding gates

Final appearance evidence must compare principal and late captures with pinned
main `080b416c`, bb `f135a001` and accepted #69 Workspace captures. The rejected
#69 `before-table-1024.png` is historical failure evidence, not an accepted target.
System media emulation proves renderer reaction but does not alone prove actual
OS setting changes. Keep this distinction in final reports.

Required pending gates: final-candidate full local/hosted regression inventory,
all packaged journeys and inspected captures, actual installer/reopen evidence,
strict performance including new project flows, complete UX01–UX20/preservation
ledger and independent review. Earlier scoped receipts do not satisfy these gates.

The owner reports no available actual Windows11 host/VM/runner. Windows Server
CI cannot satisfy that supported-desktop acceptance requirement. Keep #67 open;
do not integrate as accepted, publish a release or close #47/#7/#42 while required
gates remain unresolved.

## Review repairs and retained runtime draft scenario

Initial independent Standards review found two implementation issues: ambient
`WORKSPACE_PERFORMANCE_ROOT` could redirect strict scale to another package, and
the development launcher lookup had made a common test perform Electron's lazy
native installation. The runner now pins the task performance root and disables
diagnostic native tracing. An actual child failure probe observes these values;
it fails against the original forwarding and passes after the repair. The actual
development lookup is moved to a platform test; common path/validation tests stay
pure. Initial Spec review identified actual OS System switching as an open gate,
without other implementation findings.

The dispatch-only new workflow was also replaced before use: GitHub requires a
manually triggered workflow to exist on its default branch. The final job lives in
registered `desktop-ci.yml` under `checks: integrated-desktop`; routing controls
fail before this repair and pass afterwards, preserving ordinary full defaults.
See [GitHub manual-workflow requirements](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
Focused launcher/integration/route checks after repair:40/40, zero skips.

The preliminary tail passes scalars, selection/property editors, ordinary and
filesystem assignment, contextual projects/categories/archive, retained recovery,
sessions, data recovery and all seven original feature consumers. It then fails
the original base runtime while Escape targets a vanished Text editor after
its 420px screenshot. This is separate from the unresolved native-quit failure.

Minimal actual-App reproduction: original viewport helper presses Collapse
sidebar while the draft is active, causing the accepted #56 valid-draft blur
commit. It observes zero editor and persisted `Unsubmitted screenshot draft`.
Control changing only viewport without the sidebar press retains one editor and
the original persisted value. Both controls have normal exit/owned cleanup. This
distinguishes focus-driven commit from viewport remount or source refresh.

The adapted original driver prepares each viewport first, opens and fills the
real draft, captures, Escape-cancels and verifies the original value independently
at each size. It preserves all screenshot/overflow/deadline/value assertions;
product blur behavior is unchanged. The ordinary base command already includes
separate rename/category native fixtures, so the integrated runner does not replay
those successful consumers a second time. Original-command renewal and final
candidate evidence remain separately recorded in GitHub.

Preparatory appearance inspection reviewed all40 principal variants (five surfaces
by both sizes/languages/themes) plus24 restoration/property-review/missing-preview
variants, using contact sheets and selected full-resolution captures. Table1440
matches the accepted #69 composition. Preview/expanded retain its boundaries/tree,
with the intentional #58 property-creation/editor controls. Settings and late
reviews retain the accepted bb foundation and scoped #66 dialog stacking. No
material mismatch was observed in these inspected variants. The full remaining
state/control inventory and final hosted candidate still require their receipts.

## Complete local suite and first hosted installer

Reviewed source **77d936baeec18f2da0930b8cfa1f3c6b23967060**:
one complete `npm run test:all`, exit1, **3435pass/2fail/27skip/3464total**,
180865.6ms. No synthetic native shutdown fails in this run. Only the old literal
common-condition and dispatch-option assertions in `test-suites.test.mjs` fail.
[Raw inventory/log digest](issue-67-evidence/local-full-suite.json) and
[446 tested input hashes](issue-67-evidence/tested-inputs.json) preserve this
negative. The focused original Windows installer command reproduces71pass/2fail.

The adapted common test evaluates every registered dispatch choice and both
ordinary push/PR events; the option inventory includes the approved routes.
No product/safety assertion is retired. Local focused Windows policy/registry/
launcher/routing command passes113/113, zero skips. Hosted focused renewal precedes
runtime/installer tails. Complete suite reuse is limited to unchanged passing
inputs; no new full run or retroactive full-green claim is made.

Actual DMG run [39913465917](https://github.com/kornouhovas/workspace/actions/runs/39913465917),
attempt1, exact77d936ba, passes. Downloaded artifact12484161287 is inspected:
macOS14.8.9arm64/kernel23.6.0, actual outside-build installation, bundled backend,
EN/RU/isolation, retained identities/views/language, replacement/data preservation
and normal owned cleanup. DMG SHA256
`4bd4a7461be0a667af6ade753e60db7e047f2f1582707b1d4117465698ec22a4`.
Initial Mac run39912976237 is cancelled and supplies no acceptance. Windows
run39912980483 fails the two static registry assertions before actual installation;
artifact12483344640 retains its policy log. Windows installation remains pending.

Actual local macOS27 OS appearance passes both directions through System Events,
Electron nativeTheme and renderer, with System selected and Playwright's light
override explicitly disabled. [Receipt](issue-67-evidence/macos-native-system-theme.json),
[Light](issue-67-evidence/native-light.png), [Dark](issue-67-evidence/native-dark.png)
and [exact control source](issue-67-evidence/macos-native-system-theme-control.mjs.txt)
are retained. Original appearance is restored; normal quit/cleanup pass. Initial
control without disabling emulation fails dark, as expected from the pinned
Playwright code. This accepts only the observed Mac transition, not Windows.

## Project-scale timing repair

The local final-tail runner passes the original creation crash matrix and both
direct/grouped native creation routes. Strict scale then passes its first14 direct
measurements (startup4936.7ms, original interactions64.4–125.6ms, scan378.0ms;
conservative process peak880820224B) but fails before recording preview because
the new asynchronous readiness callback resolves to `false`, not timestamps.
Normal quit/backend exit pass. Grouped and later project measurements are
unreached; this is not strict acceptance.

Minimal actual-App reproduction observes a real event timestamp but readiness
`false`. A new real-Electron regression is red against the original helper.
The repaired exported project observer polls internally until the current project
identity, fields, tree, requested expanded state and selected tab survive both
paint stages. The original finite-clock assertion,30s readiness deadline and300ms
acceptance limit remain unchanged. Existing list-projection/timing exports are
unchanged. Both preview/expanded delayed-identity controls pass; complete native
readiness file21/21 passes with normal shutdown. Minimal actual App now records
55.0ms event-to-paint with normal quit/cleanup. Renew the original complete strict
command on the repaired harness; that small fixture does not prove scale.

## Hosted full-suite and focused renewal receipts

Full run [39912972260](https://github.com/kornouhovas/workspace/actions/runs/39912972260),
attempt1, exact77d936ba: all three hosts fail only the two stale registry assertions.
Mac3435pass/2fail/27skip; each Windows3532pass/2fail/13skip, aggregating its two
isolated native batches and ordinary batch. All artifacts were downloaded and
inspected:12484410537 (Mac),12483799316 (Windowslatest),12484372429 (Windows2022).
[Per-host provenance, batches, failures and log digests](issue-67-evidence/hosted-full-suite.json)
retain the actual tested input. These failed full runs are never relabeled green.

Focused run [39915219571](https://github.com/kornouhovas/workspace/actions/runs/39915219571),
attempt1, exact**6bf1fbcdeda7f5876909ec2dbd71153b5469155e** passes all three hosts:
original73/73, repair40/40 and new native timing1/1 each; no failures or skips.
Artifacts12483998685 (Mac),12483619892 (Windowslatest),12484533904 (Windows2022)
are downloaded/inspected. [Receipt digests](issue-67-evidence/hosted-focused.json).
Independent cumulative repair review:Standards0/Spec0 after repairs. Unchanged
passing full-suite scenarios retain77 provenance; newly changed consumers renew.

Actual Windows NSIS run
[39915980187](https://github.com/kornouhovas/workspace/actions/runs/39915980187),
attempt1 at6bf1fbcd, passes. Artifact12485067606 is downloaded/inspected:
original policy/registry73/73 and installed-keyboard driver2/2, actual offline
Unicode/space-path installation, bundled backend/SQLite, version/notices/isolation,
EN/RU keyboard, reopen/reinstall with retained IDs/views and independent APPDATA,
uninstall and asserted normal owned cleanup. [Installer receipt](issue-67-evidence/windows-installer.json).
Installer SHA256 `48c264dd4369fb451c78548e3339cfcadfe646cca57ed144ddcac348979352dc`.
Actual OS is **Microsoft Windows Server2025 Datacenter**, kernel10.0.26100;
this does not satisfy Windows11. [Mac installer receipt](issue-67-evidence/macos-installer.json)
retains its actual77d936ba provenance because installation/production inputs did
not change in the test-only repair.

## Local scale shutdown negative and bounded control

The repaired strict driver at6bf1fbcd passes all20 measured direct observations:
startup4522.2ms; preview235.5ms, expand50.9ms, expanded edit49.3ms, return62.3ms;
all original interactions also meet300ms. All five direct memory observations
pass, conservative maximum977289216B. It then fails the unchanged10s ordinary
quit after before-quit/will-quit/quit/node-exit events; parent exit occurs only
after forced SIGKILL. Owned cleanup passes but normal quit/backend-exit acceptance
does not. Grouped/reopen scenarios remain unreached.
[Raw scale receipt](issue-67-evidence/local-scale-shutdown-failure.json).
No unchanged strict retry is used to seek a green result.

A separate six-launch packaged control using the unchanged1000/20/10 fixture
passes all six normal quits (159–244ms) while each window is unfocused.
[Control receipt](issue-67-evidence/packaged-quit-control.json).
Together with the earlier standalone controls, this rules out an unconditional
launch/quit failure, but does not uniquely explain the intermittent long-journey
macOS27/inspector shutdown. Preserve the negative; supported-host strict acceptance
still needs its own complete original receipts.

## Ladle session-fixture repair

Runtime run [39915975323](https://github.com/kornouhovas/workspace/actions/runs/39915975323)
at6bf1fbcd fails all three hosts in the first `applied-empty-english` story:
zero layout captures, visible workspace-session error and normal Electron quit.
The WorkspacePreview mock predates #55 and rejects required `getSession` and
`setSession`, so this is a fixture failure before the intended state is rendered.
The real backend's session regressions and packaged session/recovery journeys
remain separately covered.

The repaired fixture provides independent workspace snapshots, shared contract
defaults, epoch/revision rejection and exact acknowledged revisions. All four
Applied Table/empty EN/RU states are renewed at1440/1024/420, retaining geometry,
wrapping, original caller deadlines and normal shutdown. Narrowed original command
is red before the repair and passes12 captures afterwards. A named-case guard
rejects even a single missing Applied metadata entry with featurePassedfalse and
normal quit; metadata is restored byte-for-byte after the negative control.
The complement remains mandatory; no failed/unreached state is retired.

[Renderer equivalence](issue-67-evidence/renderer-fixture-equivalence.json) confirms
all10 production outputs are byte-identical before/after the `.stories.tsx` repair.
New focused `integrated-layout` precedes the unexecuted complementary inventory
and all package/scale journeys via `integrated-runtime`. Reviewed unchanged
full-suite/installer evidence remains at its actual earlier sources.


## Applied appearance rejection and keyboard coverage

Run39918520639 at52a61777 passed four Applied stories/12 captures on each
host, with normal shutdown. Image inspection subsequently rejected intended
appearance: the fixture displayed an archive error. Those receipts establish
geometry only and are explicitly reclassified in
[the hosted receipt](issue-67-evidence/hosted-applied-layouts.json).
The public archive reads were absent; returning revision0 also correctly triggers
the production stale-snapshot guard against project revision1. The fixture now
provides both archive reads and a current revision. The layout driver waits for
archive and property loading to finish and rejects visible alerts/retry controls.
The narrowed original command was red with one visible alert before this repair
and green with12 captures afterwards. Hosted healthy-state renewal remains required.

The new packaged keyboard journey covers EN1024×720 and RU1440×960 using Tab,
roving arrows, Enter/Escape and native keyboard typeahead. Public service calls
prepare disposable data and observe committed assignment; no pointer or DOM focus
setter drives the journey. It checks widths, Text cancellation, invalid Number
navigation protection, unique project tabs/reorder/close/reopen/return, distinct
native assignment transitions in both languages, contextual Escape, rename Cancel
with preserved bytes, and settings Back. The local receipt records zero pointerdowns,
normal shutdown and both transitions. [Receipt](issue-67-evidence/keyboard-local.json)
and [exact tested control](issue-67-evidence/keyboard-local-control.mjs.txt).
The integrated runner now requires this journey against the same pinned package.

The owner confirms there is currently no Windows11 machine/VM/runner. Windows11
and real Windows System-theme evidence remain unresolved mandatory acceptance
gates; hosted Windows Server cannot satisfy them. Issue67 remains in progress.


## Category-move fixture portal renewal

[Healthy Applied renewal39922602291](https://github.com/kornouhovas/workspace/actions/runs/39922602291)
atcc6fc32c passes12 captures on each host. Downloaded and inspected receipts
are retained in [the healthy receipt](issue-67-evidence/hosted-healthy-applied.json).

Runtime39923120745 atcc6fc32c fails all three hosts after30 captures in
category-move-collision-english. Normal shutdown passes; package/native/scale
consumers remain unreached. Local category-move reproduces the same15s timeout.
The minimal DOM probe shows moveCalls0 and the destination input in the dialog
outside the fixture main. Accepted operation forms are portaled; the old fixture
queries/observer were scoped to main. Portal-aware preparation and recovery-review
lookup restore all50 states/150 captures, retaining mutation counts/focus/Escape.
The same family's unrelated archive error is separately red before adding current
archive reads and green afterwards. [Local receipt](issue-67-evidence/category-fixture-local.json).
The targeted category UI suite passes213/213; routing68/68, typecheck/lint pass.

The focused hosted route is integrated-category-layout, followed only after
inspected success by the complement excluding Applied and category-move.
The local complement already reaches the next previously unreached failure,
creation-collision-english, after72 captures; its fixture readiness repair is next.
No passed full suite, installed candidate or accepted product behavior is retired.


## Creation and rename fixture renewal

[Category focused39924395020](https://github.com/kornouhovas/workspace/actions/runs/39924395020)
atffcb8cf0 passes150 captures and normal shutdown on each host. Downloaded all
artifacts and inspected representative RU1024 recovery-dialog captures across
hosts; unrelated archive error is absent. [Hosted receipt](issue-67-evidence/hosted-category-layouts.json).

Creation's narrowed command reproduces the portal failure: readyfalse, input
outside main/in dialog, untouched empty value. Body-based preparation restores
all36 creation/reveal states/108 captures. Rename's narrowed command likewise
fails readiness before portal-aware input/review/status lookup and observation.
A separate archive health guard is red1 before current archive reads are supplied.
The final rename command passes all96 states/288 captures, retaining original
interactions/mutation counts, geometry and normal shutdown.
[Local red/green receipts](issue-67-evidence/operation-fixture-local.json).
Targeted creation UI94/94 and rename UI203/203 pass, routing68/68/typecheck/lint
pass. Renderer rebuild again produces the same10 production files byte-for-byte.

Use integrated-operation-layout for hosted creation/rename renewal with separate
reports. Only after inspected Applied, category-move and creation/rename successes,
integrated-runtime selects the116 remaining states and all packaged journeys.
Ordinary integrated-desktop still selects all302 states. No required state is
retired and no failed receipt is reclassified as passing.


## Remaining composed-source fixture health

Local116-state complement passes348 captures and normal shutdown. Its source
appearance is subsequently rejected: SourceObservationPreview is the last composed
DiscoveryWorkspace fixture without archive reads. A narrowed14-state source command
with the archive-only health guard is red1 before current archive reads and green42
captures afterwards. Intentional source refresh/error/degraded assertions remain.
[Raw observations and acceptance limit](issue-67-evidence/source-fixture-local.json).
Inspected healthy EN1024 source capture has no unrelated error; all four composed
App/DiscoveryWorkspace fixtures now provide archive reads. Both reviews report0
findings; typecheck/lint and renderer10-file byte-equivalence pass. Source states
remain in the final hosted116-state complement; the348-capture geometry result
alone does not establish healthy appearance.


## Completed-operation focus race

Runtime39926161171 at61dffe60 passes the remaining116 Ladle states and package
verification on every host. Windows2022 passes15 journeys before archive-contexts
fails focus after grouped/RU/Table/list Restore; macOS fails archived Text entry
in grouped/RU/Table/preview after19 completed context cases. Both retain normal
quit/backend exit/owned cleanup. [Separate raw failures](issue-67-evidence/hosted-archive-failures.json).
Windowslatest passes all30 preceding packaged journeys, then strictscale misses
three300ms limits: direct filtered Table drag344.1ms, direct preview754.1ms,
grouped preview3433.4ms. Startup/scan, all memory samples (maximum882864128B),
four normal quits and cleanup pass. [Raw scale negative](issue-67-evidence/hosted-windows-scale-failure.json).
No failed/unreached row is accepted or retired.

The focus failure is causally reproduced through the real archive panel's public
UI in both languages: hold the archived-list refresh, complete Restore and select
Done, then release the empty list. Done had focused the still-connected origin
row; the delayed refresh removes it and focus falls to BODY. Both regressions are
red before the repair. Completed operations now focus a stable visible owner;
ordinary cancellation retains origin focus. Pending/unknown/data guards are
unchanged. Both review axes report0findings.

[Full local suite](issue-67-evidence/focus-fix-full-suite.json) passes3440/3467,
zero failures,27 skips,159875.5ms on the freshly built focus-repair candidate.
[Exact tested inputs](issue-67-evidence/focus-fix-tested-inputs.json).
Archive UI20/20, typecheck/lint/docs, fresh package/resources and the original
24-context/192-capture packaged archive journey pass with normal cleanup.
[Original native command receipt](issue-67-evidence/focus-fix-archive-native.json).
The separate macOS editor-entry failure still requires hosted renewal; the focus
repair is not claimed as its proven cause. Strict scale requires separate diagnosis.
Earlier renderer/installer/unchanged-package receipts retain their actual pre-fix
inputs and do not establish repaired-candidate acceptance.


## Isolated project-performance profiling

The Windows strict negative above is retained. Ranked diagnostic hypotheses are
backend filesystem/source validation, renderer work, and readiness-observation
latency. The existing isolated performance profile now optionally includes project
flows and captures preview CPU/timeline plus fixed-type file/project/archive read
timings. It does not record payloads or alter production resources; backend
instrumentation changes only its disposable copy. Project-profile selection
requires diagnostic-only and renderer profiling, defaults off, and cannot run the
strict acceptance step. Strict limits/observer semantics are unchanged.
The file-read observation control is red before the added allowlist entry and
green after; updated route guards execute actual valid/rejected combinations.
Focused74/74 and lint pass; both reviews0remaining findings. These test-only
probe/route changes follow the focus-fix full-suite pass and renew only affected
consumers. No instrumented result will establish performance acceptance.


## Archive entry trace and performance cause

Archive renewal39930880419 atc33e84a7 passes dev/release on Windowslatest and dev
on Windows2022. Macdev and Windows2022release fail after editing archived preview:
the service still contains `Archived table list` instead of the newly filled
`Archived table preview`. [Separate receipts](issue-67-evidence/archive-renewal-c33.json).
This is not claimed as fixed by the completed-operation focus repair. A local
12-cycle preview control with unique saved values and4× diagnostic CPU throttling
passes; it does not reproduce or accept the hosted failure.

An explicit diagnostic-only archive route records a128-event ring of focus/input/
disabled/editor-length state and focus-call stacks. It preserves original actions,
assertions, deadlines, native cleanup and one initial entry-control activation.
Local traced focus-only command passes normal quit/cleanup; observed records are
bounded and contain neither known authored note nor edited value. Review identified
an ambient-flag leak; the actual child probe is red before pinning acceptance
`WORKSPACE_ARCHIVE_ENTRY_TRACE=0`, then routing68/68 and lint pass. Dedicated
profile jobs alone use1. Both review axes have0remaining findings.

[Performance diagnostic39930886286](issue-67-evidence/project-performance-profile.json)
atc33e84a7 proves preview waits for the file-list backend, not busy renderer work.
Grouped listProjectFiles1631.4ms includes two full scans878.4+675.1ms, with renderer
idle1545.5ms; direct list318.3ms includes scans134.4+118.9ms. The original strict
negative is unchanged. A required owner question is pending about new preview
budget: completed properties/visible tree loading versus the fully loaded tree.
No endpoint or limit is changed while that definition is unresolved. Filter/group/
edit300ms requirements remain unchanged. Continue independent archive diagnosis.


## Owner-approved preview endpoints

The owner confirms preview<=300ms to current usable properties and visible tree
loading/ready presentation; the fully loaded tree must complete<=5,000ms from the
same opening event, retaining all identity checks. The accepted spec records this.
Only the new preview observation uses the presented endpoint. Existing fully ready
observer defaults, expand/edit and filter/group/drag limits remain unchanged. The
driver records two separate clocks from one event; it does not reset the start.

Native control is red before the presented endpoint, green after: current ID/value
and enabled visible field must precede preview; file delivery is explicitly held
until afterwards and then checked by the original ready endpoint. Targeted old/new
native controls2/2 pass normal quit, routes/probe74/74 and lint/docs pass. The full
readiness file retains19pass/3old-control normal-quit failures on local Mac27, not a
green22 result; no unchanged file retry. [Receipt](issue-67-evidence/preview-endpoint-control.json).
The old provisional fully-loaded-preview300ms negatives remain historical; renewed
strict evidence must satisfy the newly confirmed two endpoints. The direct filtered
Table drag344.1ms negative remains under its unchanged300ms requirement.


## Editor-window trace refinement

Diagnostic39933803877 at96b59f28 reproduces the old-value failure in Windows2022dev
and Windowslatestrelease; four other OS/mode jobs pass. The global128-event ring
is overwritten by subsequent restore-dialog captures before the final assertion,
so those observations do not establish a cause. The refined trace keeps an
independent128-event editor window and64-command setTextValue metadata ring
(length/time/outcome only), preserving exact handler replies/Promises/errors.
The local traced original focus-only command passes normal quit/cleanup with exactly
two expected public writes (fixture setup and one edit), no replay, bounded rings
and no known authored text. Both reviews0findings; focused74/74/lint/docs pass.
This is diagnostic instrumentation only, not a product repair or acceptance pass.


## Archive editor typing preparation

Diagnostic39935314046 at74fa5477 reproduces old-value saves in Mac release and
Windows latest dev; four other jobs pass. The independent editor window records
no new input event in either failed edit. The successful setTextValue command
receives the previous value length; no backend rollback is observed. This narrows
the failed boundary without proving a unique cause for every historical failure.

A native browser control is red when editor preparation returns before the
textarea owns focus. It is green after waiting for the current connected, visible,
enabled, focused control through committed frames. The driver types once, checks
the current value before Save, and retains the original final restored-value
assertion. Observation and typing share the existing15s deadline with a host
timeout; no action or mutation is replayed. Both review axes report0 findings.

The exact final helper passes the packaged original focus journey, normal quit
and owned cleanup; routing/probe74/74, lint and docs pass. An earlier full original
archive run passes24 journeys/192 captures before the final host-deadline
refinement and is identified separately. [Source and check receipt](issue-67-evidence/archive-editor-readiness-control.json).
Next renew ordinary uninstrumented dev/release archive on all three hosts, then
renew broad integration and installer evidence. Windows11 remains unavailable;
no acceptance, integration or closure is claimed.


## Candidate085 ordinary renewal and installation

Ordinary archive39938129849 at08504f86 passes Windows latest development and
release24 journeys/192 captures each, plus original archive and Views consumers.
Mac development and Windows2022 development fail at direct/EN/Table/expanded
editor readiness: one textarea remains but focus is BODY. The existing15s
deadline rejects this state; normal quit, backend exit and owned cleanup pass.
Their release/tail commands are unreached, not passing. [Raw reports and artifacts](issue-67-evidence/archive-renewal-085.json).
The local traced full24/192 pass does not override these hosted negatives.
Diagnostic39939563035 observes this new focus boundary without changing the
candidate or supplying acceptance. Broad acceptance remains behind this gate.

Actual installation renewal passes on the same08504f86 candidate: macOS14.8.9
arm64 DMG39938129249/artifact12495300240 verifies external installation,
EN/RU keyboard/isolation, persisted identities and replacement preserving data.
[DMG receipt](issue-67-evidence/macos-install-renewal-085.json). NSIS39938351550/
artifact12494728592 verifies Unicode/space installation, notices/version, bundled
SQLite/backend, keyboard/isolation, persisted reopen/reinstall, independent normal
APPDATA, normal quit, uninstall and cleanup. [NSIS receipt](issue-67-evidence/windows-install-renewal-085.json).
The NSIS host is WindowsServer2025, not Windows11. Neither installer result accepts
the still-open archive, strict scale, broad integration or real Windows11 gates.


## Disabled scalar focus repair

Diagnostic39939563035 at08504f86 passes Windows2022 release; five other jobs
fail. Windows development/release traces show textarea focus followed22–39ms
later by disabling and focusout to BODY. The scalar effect did not react to
reenabling. A real React TextPropertyCell in Electron reproduces this loss before
the repair; reenabling now restores the draft's own focus when BODY still owns
focus. Ordinary opening/pending behavior is retained. A second native control
goes red for two retained invalid drafts and green with actual editor ownership;
an independently chosen control keeps focus. No write occurs before Save.

Both native controls pass, affected UI/routing141/141, typecheck/lint and a fresh
build pass. The original development archive24 journeys/192 captures passes with
normal quit/backend exit/cleanup. Both review axes report0 remaining findings.
The normal three-host candidate still needs renewal. Mac diagnostic failures
instead show keydown without click and no textarea; that activation boundary
remains unresolved, and this focus repair does not claim to fix it. [Source,
trace and check receipt](issue-67-evidence/scalar-disabled-focus-repair.json).


## Document-start diagnostic attachment

The Mac keydown-without-click case remains unresolved. A native control proves
that the trace's init script attempts observation before documentElement exists,
throwing a not-a-Node exception after installing event listeners. Consequently
earlier traces contain real focus/input events but lack reliable mutation-state
coverage. The observer now attaches to Document and records target disabled state
as boolean metadata. The native control is red before, green after; routing108/108,
lint and both reviews pass. The traced original development focus-only journey
passes normal quit/cleanup with actual state events. [Receipt](issue-67-evidence/archive-trace-document-control.json).
This repairs diagnostic coverage only; renew the explicit diagnostic route to
distinguish Mac activation loss before claiming or choosing a product repair.


## Opening interrupted before initial focus

Diagnostic39941120241 at8bfad860 passes Mac dev/release, Windows latest dev
and Windows2022 release. Both remaining failures click an enabled value button,
then mount a disabled textarea before its first focus; it reenables8–12ms later
with BODY still active. Prior ownership alone cannot restore a request that has
not yet reached focus. New editor activation now establishes focus intent, while
ordinary blur, multiple-draft ownership and independent-control protections remain.

The real React/Electron control is red at reenabled focus before this repair,
then all three focus controls pass. A first capture-phase fixture prevented
activation entirely and is not counted as that reproduction; the retained
bubble-phase fixture reproduces a disabled editor mounted by the same click.
Keyboard selection makes the authored-value assertion independent of initial
caret placement. UI/routing141/141, typecheck/lint, renderer build and original
dev focus-only journey pass with normal quit/cleanup; both reviews0 findings.
[Source, trace and check receipt](issue-67-evidence/scalar-opening-disabled-focus-repair.json).
Renew ordinary uninstrumented three-host archive before broad/strict/installer
acceptance. Earlier8bf local packaged24/192 passes remain historical; production
input changed again and those results are not relabelled as current.


## Workspace fixture activation handoff

Broad39944358198 atA222 passes Mac full inventory3447/3474 with27skips,
all302Ladle states/906captures, package/resources, foundation and shell. Its
workspace-management journey then cannot find the inactive workspace Settings
menu after a fixture activation reply. A native control goes red when preparation
returns at that reply, before the exact selected UI identity/session enablement.
The helper now observes both through the existing workspace readiness boundary,
issuing one activation only; inactive Rename/Settings, duplicate IDs, restart,
cancellation and project-byte assertions remain unchanged. This proves a missing
precondition, not a unique cause for every historical nondelivery.

Native1/1 and routing92/92 pass, as do typecheck/lint. The original journey on a
fresh package of unchanged A222 production passes with stopped processes/owned
cleanup. An earlier local release control used the older package and is not used
as current-candidate acceptance. Both reviews0findings after requiring successful
readiness/package/resource prerequisites before the new focused native command.
[Source and check receipt](issue-67-evidence/workspace-activation-control.json).
The focused integrated-fixture-repairs route renews all three release hosts; ordinary
sidebar/full defaults remain intact. Production/build/dependency inputs are
unchanged by this repair, so passing A222 evidence retains its actual provenance.


## Controlled drag geometry preparation

Windows2022 broad39944358198 atA222 passes twelve journeys, then the filesystem
assignment control compares a missing before rectangle with a valid after
rectangle. The new read-only preparation observes positive stable current bounds
through2+2frames, reacquiring a replaced handle under one host-enforced15s
deadline. It performs no gesture. Original after equality, single dragstart,
native pointer matrix and identity/byte assertions remain unchanged.

Native replacement/hidden-deadline control is red before, green after; original
real pointer control1/1, routes92/92, typecheck/lint and both reviews pass. The
local ordinary original fails earlier in an unchanged pointer postcondition;
filesystem is unreached. These remain negatives, not repair acceptance. [Receipt](issue-67-evidence/drag-bounds-control.json).
The unpublished focused selector is now integrated-fixture-repairs, renewing
workspace and both ordinary/filesystem assignment consumers in one three-host
release job. It retains successful prerequisites and separate reports; the older
workspace-sidebar development profile and15min outer bound remain unchanged.
The union's30min CI allowance does not alter native/scenario deadlines.

Production source, migrations, native resources, dependencies, package manifests
and build/version inputs have no diff fromA222. Packaging includes dist/package
inputs, not these smoke drivers. Existing dragRuntimeGroup implementation is
unchanged; its new export has no top-level side effect. Reuse passing A222
full/layout/installer/unaffected journeys at their original SHA; renew the changed
consumers and missing tails only after focused artifact inspection.


## Missing-tail selection control

Unknown exclusions and empty selections fail before application access. Default
selection remains all31. A real exit23 probe proves that a26-row subset example
records its five exclusions and unreached consumers without complete acceptance.
Routing/probe94/94 and lint pass; both review axes0 findings. [Receipt](issue-67-evidence/missing-tail-selection-control.json).
The bounded tail route is ready but remains behind focused original-command
success and artifact inspection. It does not accept excluded rows or Win11.


## Retained360px filesystem collision capture

Focused39960693209 at9e3 passes workspace and ordinary assignment on all three
hosts; both Windows filesystem consumers pass. Mac filesystem then fails exact
control visibility at the original15s bound in a360px stress capture. Its
[unmodified failure capture](issue-67-evidence/narrow-collision-failure.png) retains
a220px expanded sidebar and a large collision notice. The native adapter control
is red before the real sidebar collapse is prepared for360px, green after, also
checking unchanged420px behavior and1024/1440 restoration.

Only the filesystem appearance caller supplies shell-aware preparation; the
folder helper default remains the original plain viewport call for Views. All
visibility/overflow/identity/bytes checks remain. Native1/1, routes95/95, typecheck,
lint and both reviews pass. Local original again fails earlier in the unchanged
pointer postcondition; the stress slice is unreached, not passing evidence.
[Source and check receipt](issue-67-evidence/narrow-filesystem-control.json).

The next focused selector integrated-filesystem-repair runs only this release
consumer and its native adapter/routing checks on all three hosts. It retains
package/resource prerequisites and skips already inspected workspace/ordinary
passes. After its artifacts pass, missing tails use23Mac/15Windows2022 rows,
excluding the current source's inspected archive/Views receipts from39942111999.


## Contextual project keyboard entry preparation

Windows2022 tail39965141240 leaves Project actions focused on Rename without
opening the rename dialog. A native control reproduces the missing enablement
precondition: Enter on the initially disabled button is lost, while waiting for
the current enabled control opens one dialog with exactly one activation. A
permanently disabled control keeps the caller timeout and receives no activation.
Only contextual-project rename entry uses this adapter; shared context tools and
application behavior remain unchanged. Original collision, review, identity,
metadata, Cancel and appearance assertions are retained.

Native1/1 and routing73/73 pass after the red controls. The local original command
reaches the dialog but then observes the existing source-changed review guard
instead of its expected collision; it remains negative. The controlled pattern
does not uniquely prove the historical hosted cause. [Raw receipt](issue-67-evidence/project-context-entry-control.json).
Use integrated-project-entry-repair to renew this changed original release
consumer on all three hosts before any missing-tail continuation. Mac categories
requires independent diagnosis; its failed entry is not accepted by this repair.


## Project renewal and unresolved category diagnostic

Focused39967363906 at30a7 passes the changed original project command on all
three hosts. Artifacts12506614659Mac/12506354987Winlatest/12507058213Win2022
are inspected:20checks and32captures per host, including collision/Cancel,
identity/metadata and normal quit/backend exit/owned cleanup. [Raw reports](issue-67-evidence/project-entry-renewal-30a7.json).
This renews project entry, not the independent category failure or local negative.

Six minimized local Board/list→preview cycles pass42diagnostic transitions and
96captures without reproducing the hosted missing-control failure. The local
full diagnostic reaches a different existing source-changed guard while selecting
a return category. Neither result identifies the hosted cause. The new optional
Playwright trace keeps action/DOM/screenshots on the disposable fixture, disables
source capture, records finite phase and failure screenshot, and stops under3s
before the original normal-shutdown path. Start also has3s, failure PNG2s; no
product assertion or shutdown deadline changes. Local recorded ZIP integrity
passes with111before/after actions,287DOM snapshots and65screencast frames; the
original command remains failed with normal shutdown and cleanup. [Receipt](issue-67-evidence/category-entry-diagnostic-control.json).

Tracing defaults off and the aggregate runner pins it to0; a real exit23 child
probe goes red before that pin, green after. Routing74/74, typecheck/lint/docs
and both reviews pass. integrated-category-entry-profile runs only the original
Mac release category command with diagnostic1. It cannot provide ordinary
acceptance or start the missing13-row tails. Those remain behind inspection and
passing focused original-category renewal under the failed-Actions loop.


## Category diagnostic sampling

Hosted39968597489 at7e57 completes22checks/64captures with diagnostic1, normal
quit/backend exit/cleanup. Artifact12508465900 is inspected; the valid trace
contains1419before/after actions,3320DOM snapshots and744screencast frames.
[Raw report](issue-67-evidence/category-entry-traced-host.json). It does not
reproduce the missing Move control, establish a cause, or accept ordinary
categories. Heavy observation may change timing.

The same focused selector now samples three isolated Mac trials using a lighter
events mode. A64-entry ring records only observer-ready, project-area count
changes and native preview pointer/mouse/click time, coordinates, trust and
enabled/connected/busy state. It records no authored values and requests no
geometry/layout work. Missing installation fails the diagnostic. Collection has
2s before unchanged normal shutdown; ordinary mode0 and heavy mode1 remain.
The first local light diagnostic observes all five trusted pointer/mouse/click
events and project-area appearance, then fails later at RUBoardpreview move
dialog detachment; that is not the hosted missing-control failure. Normal quit
and cleanup pass. Both earlier negatives remain. Bounded sampling supplies
diagnosis only; original-category acceptance and missing tails remain blocked.


Final local observer validation explicitly records observer-ready and trusted
events across preview/close transitions; the diagnostic completes22checks/64
captures with normal quit/cleanup. Its earlier later-dialog negative is retained.
[Both event receipts](issue-67-evidence/category-entry-event-controls.json).
Routing74/74, type/lint/docs and both review axes pass. These are instrument
validation and bounded reproduction sampling, never renewed ordinary categories.


## Hosted light diagnostic result

Run39969757636 atbcf2 completes three isolated Mac event trials. Artifacts
12508202942/12509355160/12508657415 are inspected, including observer-ready,
64-entry bound, normal quit/backend exit/owned cleanup. Trials1/3 pass diagnostic
22checks/64captures. Trial2 fails later at RUBoard/list return-move dialog
detachment with the explicit source-changed guard; its ring contains only the
observer-ready event because it has not reached a preview in that document.
[Raw three-trial receipts](issue-67-evidence/category-entry-event-hosts.json) and
[unmodified later failure capture](issue-67-evidence/category-return-stale-diagnostic.png).

This is not the original ENBoard/preview missing Move action. The source-changed
return failure and the historical missing-control failure remain distinct.
Heavy trace, six minimized local cycles and three lighter hosted trials do not
establish a reproducible loop for that original symptom. No product repair or
ordinary-category acceptance is inferred from passing diagnostics. A stable
reproduction/capture that distinguishes missing preview input from a later session
or project-context change is still needed before choosing its repair.

All useful runs have finished. The candidate and raw evidence are committed on
the task branch. Remaining ordinary categories, missing package/strict tails,
local Darwin27 shutdown and actual Windows11/System-theme gates remain open;
#67 is unaccepted and has not been integrated or released.
