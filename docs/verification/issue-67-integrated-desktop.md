# Issue 67: Integrated desktop verification

Status: **in progress; not accepted**. Issue and live checkpoints:
https://github.com/kornouhovas/workspace/issues/67.
[Scenario/retention map](../plans/issue-67-integrated-desktop.md).

## Candidate and execution

Base `5799532c4966e026b96b6b18718f5a8e8171bf6b` includes accepted #66.
Task branch `codex/issue-67-integrated-desktop`. This change adds acceptance
infrastructure; application, schema, native resources, runtime dependencies and
installer inputs remain unchanged. Existing principal UI journeys now explicitly
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
