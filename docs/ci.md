# CI checks and diagnostic routes

## Native macOS top strip

For #79 select `desktop-ci.yml` with `checks: window-chrome`. It runs static
checks, retained App/session/isolation/routing regressions, the shell/settings
journey and actual development plus checked packaged Electron window journeys
on macOS latest, Windows latest and Windows2022. Native geometry, minimize/restore,
fullscreen return, EN/RU, both themes/sizes, keyboard and pointer navigation, normal
shutdown and fixture cleanup have separate receipts. Local native input and full
window captures supplement the automated lifecycle calls. No installer, schema,
resource or dependency input changes; final #67/release gates remain separate.

For the original macOS failure at `bbc09277` (run40354335288), select
`checks: window-chrome-repair` first. It runs only the failing projection-endpoint
control on macOS with static prerequisites and always-uploaded logs. A controlled
125ms delay per native frame reproduces the original insufficient driver-delay
assertion: the host pause began before renderer paint stabilization. Await the
paint receipt before the300ms host-delivery pause; keep committed-result/membership
and the200ms assertion unchanged. After focused success, renew the unreached
macOS consumers with `checks: window-chrome-macos` and retain independently complete Windows receipts only with
unchanged application/build inputs. Original failures remain failed. The focused repair and macOS renewal use separate
concurrency suffixes so they do not cancel a receipt-producing platform run.

## General preferences

For #78 select `desktop-ci.yml` with `checks: general-settings`. This bounded
renderer/navigation route runs static checks, App/preferences and retained session/
recovery regressions, real Electron shell (EN/RU, both themes/sizes, native System
notifications and restart), session/selection return and workspace contextual entry
on macOS latest, Windows latest and Windows2022. It records candidate SHA and
run/attempt in artifact names. No schema, native adapter, resource, dependency or
installer input changes; packaging and release acceptance remain separate.


For an affected Windows management-only renewal select
`checks: general-settings-management`. It runs only Windows latest/2022 build/
static prerequisites, native removal/entry/cancellation controls and the original
workspace-management journey. The ordinary General route remains all three hosts.

Run40276259568's Windows2022 diagnostic recorded expected count1 with two actual
IDs, yet the old async `waitForFunction` completed. The pinned Playwright poller
checks Promise truthiness without awaiting the predicate. A native red control
reproduces the false acknowledgment. Explicit awaited public polling now requires
the target ID absent and exact remaining count, then the form's hidden acknowledgment
within the original15s total. The confirmation also retains a live enabled guard before the single Enter;
a disabled-control regression proves zero commands until readiness. Final ordinary
run40277479712 atbc889bfd passes both Windows hosts and four controls. Submit is
never replayed. Original failed receipts
stay failed; unchanged app/shell/session/regression evidence retains3f429ec8 provenance.

## Workspace-local status colors

For #77 dispatch `desktop-ci.yml` with `checks: status-colors`. The bounded
route runs static checks, routing and affected public service/UI ownership
regressions on macOS latest, Windows latest and Windows2022. The real Electron
settings/Table/Board journey runs in DEV and checked packaged modes on each host,
with EN/RU, themes/sizes, keyboard/focus, workspace/duplicate isolation, restart,
folder/byte preservation and normal shutdown/cleanup receipts. This adds no
migration, native resource, dependency or installer input. The implement workflow
also runs the final complete local suite once; final #67/release requirements
remain separate. Artifacts retain source SHA, run/attempt, host and mode.


## Separate special archive

For #76, dispatch `desktop-ci.yml` with `checks: special-archive`. The reusable
route builds the reviewed candidate and runs the complete suite on macOS latest,
Windows latest and Windows2022. EN/RU first-use Archive, Cancel, ordinary-status
rejection, separate designation, settings, restart and configured reuse run in
DEV and the checked packaged artifact. Retained contextual archive and original
archive recovery/restart consumers preserve existing guarantees. Artifact names
include candidate SHA, run/attempt and host; screenshots and normal-quit/cleanup
receipts stay separate from behavioral/full-suite results. This route does not
publish a release or replace final desktop/manual Windows acceptance.

For a driver-only repair after inspected complete-suite evidence, the same route
accepts `checks: special-archive-native`. It retains build/static prerequisites
and every DEV/package/native consumer, skipping only the complete-suite step.
It also renews the original direct/grouped native-notification cases and the
real-callback ordering control within their original shared 4s deadline.
Compare application/build inputs and retain exact source-SHA provenance under
the evidence-reuse policy before selecting it; default acceptance still runs all.


## Folder status assignment

For #75, dispatch `desktop-ci.yml` with `checks: status-moves`. The reusable
`status-moves.yml` builds once on macOS latest, Windows latest and Windows2022,
runs the final complete suite, then actual EN/RU status editing, disabled target,
Cancel/focus, Table assignment and Board drag journeys. Retained explicit parent
operations and ordinary/filesystem assignment run in DEV; status and parent
operations run again in the checked packaged artifact. Receipts retain candidate
SHA, run/attempt, host, mode, screenshots, normal shutdown and fixture cleanup.
No installer, resource, dependency or schema input changes; final release/manual
Windows11 acceptance remains separate. Original full/release routes are unchanged.

For the additive selector inventory failure at8e0b258f, use
`checks: status-moves-routing` first. It runs only the original
`tests/test-suites.test.mjs` and route guards after npm ci/static
checks, without builds, native consumers or a full-suite retry. The frozen expected
selector list is updated to include the authorized route; the default/full and
negative scheduling guarantees remain. After focused success and artifact
inspection, `checks: status-moves-runtime` selects the previously unreached
DEV/package consumers and prerequisites, preserving the successful unchanged full
complement at its original source SHA. These phases use separate concurrency
suffixes so the original broad run can finish recording evidence. Every original
failure retains its result; these selectors never turn skipped or failed checks
into passing evidence. Additional observed failures require their own diagnosis
and focused selection before the missing tails.

The current runtime phase also renews the complete affected move/role/assignment
controller and public service regressions before actual DEV/package consumers.
The later focus correction is a bounded renderer change: retain unchanged backend,
contract, native, dependency and build input evidence from the full run, and renew
all affected UI/native consumers under the desktop UX selection matrix. This is
full affected UI acceptance, not a passing raw full-suite claim or a waiver of its
historical fixture watchpoints. Run the local final suite on the completed repair.

Routing40216820576 at1ee7e4fc passed73/73 on macOS and72/73 on both Windows
hosts. The Windows error directly identifies CRLF rejection in the new raw-source
newline guard. The repair accepts both line endings and runs LF/CRLF variants
without weakening the guard; actual phase/matrix evaluation remains. Renew routing
only on Windows latest/Windows2022. The macOS receipt retains its source provenance;
full/runtime still select all three hosts. Local/independent routing passes74/74.


## Folder-role settings acceptance

For #74, dispatch `desktop-ci.yml` with `checks: folder-roles` on the reviewed
candidate. The reusable `folder-roles.yml` runs the complete suite on macOS latest,
Windows latest and Windows2022, then role settings, retained workspace management
and retained project settings/Back journeys in DEV and packaged modes. Artifacts
retain host, candidate SHA, run/attempt, full log and each consumer's receipts and
captures. This does not publish a release or replace #67/#42 acceptance.

For original run40190522307 failures at7ad3b1c4, first dispatch
`checks: folder-roles-repair`. It builds on the same three hosts, runs the actual
Windows/POSIX parent-path guard, role-command and source-outage public regressions,
then the original DEV `smoke-retained-recovery.mjs` consumer. Its focused log and
runtime report preserve SHA/run/attempt and failure/cleanup evidence. It does not
run full suites, unrelated journeys or packages. The reusable workflow defaults to
full acceptance; the focused input is explicit and routing-tested. After focused
success, the application changes require renewed `checks: folder-roles` broad
acceptance before integration.


Run40193124906 at97819571 passed all52 public regressions on all three
hosts and the retained DEV consumer on macOS/Windows latest. Windows2022 failed
at archived Text editor entry (line121): pointer action completed but no textarea
appeared; the retained value stayed unchanged and shutdown/cleanup passed.
`checks: folder-roles-recovery-repair` renews only that host's original consumer
and bounded archive-editor entry controls. It reuses the existing one-activation
keyboard/focus preparation without mutation replay or longer deadlines. A real
Electron pointer-interruption control reproduces the symptom pattern; the precise
historical timing cause remains unestablished. Successful public and other-host
receipts retain their original SHA/run. Full acceptance follows this focused gate.
The packaged retained consumer explicitly passes the positional `release` argument;
the script does not select executable mode from WORKSPACE_SMOKE_MODE.


Run40194100008/attempt1 at9ee8c787 completed all three full inventories.
macOS has3917 tests/3881 pass/9 fail/27 platform skips; each Windows host has
51+14+3936 tests with the same9 failures,14 skips and no cancellations. These
are obsolete source-outage projection expectations, not additional application
changes. `checks: folder-outage-repair` renews those13 selected service/IPC cases
(including changed/conflicting-root distinctions) on all three hosts first.
After inspected success, `checks: folder-roles-runtime` supplies the previously
unreached original role/management/retained-recovery DEV/package journeys.
The successful full-suite complement retains9ee8c787 provenance under evidence
reuse; the failed full runs remain failed. Default full selection is unchanged.

The runtime tail also runs `smoke-source-outage.mjs dev|release` on all three
hosts. This replaces the affected source-disconnect segment of the historical
composite `smoke-runtime` for #74: two original verified source-move cycles,
shared ownership/fanout, active/excluded membership, exact Text, distinct view IDs,
unsubscribed isolation, unrelated/source/external-link-target bytes, restart and
normal shutdown/cleanup. Its actual Electron packaged state is asserted. The
historical composite's local renewal stopped at its superseded pre-#73 setup
message before this segment; it remains failed and supplies no acceptance.
Current #73/#74 setup/context guarantees are covered by the role, workspace
management and retained-recovery consumers; independent view presentation is
covered by the role journey. Ordinary historical full routes are not rewritten.


Run40198618666 at43811dde passed all eight macOS runtime rows, including actual
packaged source outage and retained recovery. Windows latest lost pointer entry
into Settings; Windows2022 reached explicit stale-name review during rename.
`checks: folder-role-entry-repair` renews just two real-Electron entry controls
and the original role DEV journey on all three hosts. The scoped driver uses acknowledged
keyboard Settings entry, and permits at most one explicit current-name
review after a conclusively inactive/stale editor. It requires the enabled review
control (no pending/unresolved submission), unchanged public project identity/path,
an original physical folder and an absent requested destination. Unknown outcomes
are never replayed; the complete rename retains its15s limit.

After this gate passes, `folder-roles-runtime` renews the changed role packaged
consumer on all hosts and the missing Windows management/recovery/source-outage
rows. It omits role DEV supplied by the gate and unchanged successful macOS rows,
whose43811dde receipts remain inherited. Default full behavior remains unchanged.
The pointer interruption control establishes a possible mechanism; the precise
historical pointer timing cause remains unestablished. The Windows2022 capture
itself proves the explicit stale review rather than an accepted operation.


## Final integrated desktop acceptance

For #67, dispatch the registered `desktop-ci.yml` with `checks: integrated-desktop`
on the reviewed candidate.
It runs the complete current suite, retained Ladle state inventory and resource
inspection, then `scripts/integrated-desktop.mjs` against one unchanged package
on macOS latest, Windows latest and Windows 2022. Principal journeys explicitly
set `WORKSPACE_SMOKE_MODE=release`; existing positional release-mode journeys and
original native/crash/recovery consumers remain. The last journey enforces the
original strict #41 scale limits. A failure stops subsequent package consumers;
the manifest marks them unreached and retains the nonzero exit. No skipped or
unreached row supplies acceptance. Raw logs/captures and host/SHA/run/attempt,
all harness digests, app.asar hashes and before/after full package inventories
are retained. `--from=<journey>` renews a bounded tail; excluded journeys remain
explicit and a successful tail is `partial`, never complete acceptance.

Run `macos-install.yml` separately for actual DMG and NSIS installation on the
same source candidate. These routes retain their actual package hashes; they do
not claim to install the exact binary from a different job. Windows Server is
still not Windows 11. This route does not publish a release, close #42 or waive
supported-host, appearance comparison or strict-performance gates. Ordinary CI
defaults remain unchanged. `--failure-probe` deliberately produces a failed,
diagnostic-only receipt and cannot establish package acceptance.

For the initial #67 registry failures on `77d936ba`, use
`checks: integrated-regressions`: all three hosts run the exact failed
Windows-distribution/registry command, repaired routing/launcher controls and the
new actual-Electron project-timing regression. It does not replay the full suite,
layout inventory or packages. Inspect its original/repair/native reports first.
Then `checks: integrated-runtime` runs the previously unreached Ladle state
inventory, package/resources and all packaged journeys/strict scale. Neither
selection changes ordinary full defaults. Earlier full runs remain failed;
their passing unchanged cases retain their actual source provenance. The Windows
installer still requires its unexecuted original driver and actual NSIS flow.

For run39915975323's first Applied Ladle state failure, use
`checks: integrated-layout`. It renews all four required Applied Table/empty
EN/RU states at all three sizes on all three hosts. The preview mock now implements
the current workspace-session query/write boundary; production renderer output is
byte-identical. Missing any named Applied state fails closed, including when the
remaining selection would otherwise be nonempty. After inspected Applied, category-move and creation/rename focused successes,
`integrated-runtime` selects `--remaining-after-operations` for the unexecuted
complement, followed by package/resources and every original/new packaged journey
and strict scale. Ordinary `integrated-desktop` still selects the complete layout
inventory. Preserve each report's selection/counts; a focused family is not the
complete inventory. This fixture-only repair does not replay the full suites or
unchanged successful installer receipts.

Read when selecting or diagnosing a CI route, changing CI scheduling, or checking exact-SHA acceptance. [Development](development.md#verification) owns verification policy; [.github/workflows/desktop-ci.yml](../.github/workflows/desktop-ci.yml) owns the inherited desktop routes.
[macos-install.yml](../.github/workflows/macos-install.yml) adds macOS 14 arm64 DMG
build/install/reopen/replacement acceptance on push, pull requests and manual dispatch.
It retains exact-SHA reports/screenshots without publishing the DMG.
The issue-scoped [performance workflow](../.github/workflows/performance.yml)
packages immutable baseline `d925f8b7` and the candidate on macOS 14 and Windows
latest, then applies the same disposable 1,000-project harness. Baseline target
misses are retained; scenario, shutdown and cleanup failures remain failures.
The candidate must pass correctness and all approved limits. Artifacts contain
raw reports/screens with SHA/run/attempt provenance, without application binaries.
See [measurement boundaries](verification/issue-41-performance.md).
For a failed performance candidate step, dispatch that workflow with
`candidate_only: true` and the actual failed `platform`. `profile_filters: true`
adds a separate renderer CPU profile of the 100-to-1,000-row Board filter
transition. Profiled runs are diagnostic and cannot use `--enforce`; the original
unprofiled strict command still runs independently after its package prerequisite.
Baseline failure evidence remains retained, and ordinary push/full dispatch
defaults still measure both baseline and candidate on both platforms. A focused
success does not replace the full acceptance run on the repaired SHA.
`profile_service: true` separately profiles real public-service open, source
lists, displayed-view reads, refresh and the native observer interval using the
same disposable scale. These Node profiles diagnose backend work; they do not
substitute for the original packaged Electron command that still follows them.
The same workflow adds Windows x64 NSIS installation/reopen/reinstall acceptance
on ordinary push/PR, or independently with `checks: windows-install` on dispatch.
This runs on `windows-latest` and records its actual Windows Server version; it
does not stand in for Windows 11 desktop acceptance. Installer downloads are not
uploaded. See [Windows installation](windows-install.md).

The issue #48 `desktop-shell` focused route also replays the original development
Table/Board lifecycle after the folder-group visibility and saved-filter failures,
including their filter/removal and viewport regressions, and Windows
creation/recovery Ladle layouts after the corresponding full-run failure.
Its original assertions and exact-SHA artifact remain required; the broader
ordinary platform matrix is unchanged.

For #48's remaining macOS final-workspace-removal navigation failure,
`checks: shell-runtime` runs the original macOS development runtime with App
removal, readiness, lifecycle and routing regressions, serial Electron setup,
strict build gates and exact-SHA evidence. Earlier authoring, Windows MultiSelect
and category-cache failure results remain in the issue's verification report;
their ordinary/full tests and native commands remain registered. Their resolved
Windows focused commands are not replayed for this macOS navigation failure.
Focused success still precedes full acceptance.

For #48's remaining Windows latest views startup failure, `checks: views-readiness`
runs only its original development Table/Board command with startup/ownership,
native drag, async path-readiness, assignment and viewport regressions. The prior
macOS and Windows 2022 drag failures retain their original passing focused evidence.
Bounded reproduction
uses three independent original journeys per host, distinct logs/evidence and
stops at the first failure. It retains the original 15-second readiness allowance,
strict failures and exact-SHA evidence; full acceptance follows only after the
original commands pass. Native drag endpoints are scrolled into view before
mouse-down; automatic scrolling during the gesture is disabled, without replaying
a mutation or replacing its result assertions.
As in the ordinary suite runner, its build prerequisite completes Electron's
lazy installation serially before parallel native regression workers start.

For #48's Windows latest early direct-creation Reveal failure, use the existing
`checks: readiness` route with `readiness_reveal_windows`, `readiness_native_windows`
and `readiness_native_early` enabled. That combination selects only Windows latest
and the original cold direct-creation/native command before related Reveal controls.
Enable `readiness_native_trace` to retain the existing finite bridge phases for
the observed opened/owner-deadline rejection. Deadlines, native selection,
binding/permit guards and cleanup assertions remain unchanged; trace evidence
alone does not establish a repair or acceptance.

## Candidate and handoff

Subsequent #47 UI work after #52 follows the owner-approved
[desktop UX selection matrix](desktop-ux-verification.md). Bounded UI changes
require visual and affected-behavior evidence; broad acceptance runs at its
integration milestones or when the affected boundary calls for it. This overrides
blanket application-change/full-rerun wording for that scope only. The actual
workflow defaults below remain broad until a verified scoped route is implemented;
the policy does not turn a skipped check into evidence or change #52's live gates.

The acceptance renewal policy below governs all focused routes in this document. Historical route notes requiring a subsequent full run describe the default; eligible test-only repairs use [evidence reuse](#evidence-reuse-after-test-only-repairs) instead. Ordinary push/PR and explicit full workflow defaults remain unchanged.

Use the [implementation sequence](development.md#implementation-sequence) before dispatching candidate acceptance. The candidate includes application changes, tests, fixtures, CI routes and relevant repository reports. Record observed local results before committing it; keep pending CI/integration status in the GitHub issue checkpoint linked from the plan.

After acceptance, record the run/attempt, tested SHA, actual checks/artifacts, delivered SHA and integration verification in that checkpoint. A fast-forward delivery of the same commit retains exact-SHA evidence. If a required later change creates another commit, identify its affected boundary and renew the checks it requires; state explicitly when a documentation-only change has separate checks rather than describing its SHA as platform-tested. Preserve existing workflow defaults and required platform coverage.

For #49's sidebar switching and source-setup focus repairs, `checks: workspace-sidebar`
runs the original `npm run smoke:shell` and the focused `smoke:workspaces` native
journey on macOS latest, Windows latest and Windows 2022, with their build and
related workspace/routing regressions. The
failure was an ambiguous name selector matching both workspace selection and the
new contextual-actions button. Exact-name selection retains saved-view and
restart/focus assertions. Setup postponement now returns focus after its preview
trigger is enabled, including delayed-preview rejection. This focused route retains SHA/run/attempt artifacts;
its success precedes a full acceptance dispatch on the same repaired SHA.
Ordinary platform coverage remains unchanged. Workspace-management artifacts are
required after an attempted management step; an earlier skipped step has no
management evidence to upload.

For #49's later Windows 2022 management/Apply failure, `checks: workspace-setup`
selects only Windows 2022, the original `npm run smoke:workspaces`, and its
keyboard-readiness/route regressions. The other two management targets and all
original-shell targets retain their passed evidence. The driver waits for an
enabled reviewed Apply before one Enter, retaining the caller deadline and
original project/persistence assertions. Focused success and artifact inspection
precede renewed full acceptance on the same SHA. For the subsequent fixture-only
preparation timeout, `checks: workspace-setup-readiness` runs only the failed
readiness fixtures and route tests; the original Windows 2022 native journey
already passed in run 39376901213 and retains its separate evidence. Fixture
preparation has its existing 30-second budget; the 1,000-ms keyboard action and
100-ms negative action deadlines remain unchanged.

## Failed Actions loop

For #69's original Windows latest project-file Reveal failure, dispatch
`desktop-ci.yml` with `checks: project-files-windows` (original execution) or
`checks: project-files-windows-trace` (diagnostic). The existing workflow calls
`project-files-windows.yml` at the same candidate SHA. It builds and runs the unchanged
`node scripts/smoke-project-files.mjs` consumer only on Windows latest, preserving
the existing native/UI deadlines, exact Open/Reveal and data assertions, normal
exit and cleanup. `trace: true` enables bounded native-phase diagnostics and is
not acceptance; the default `false` retains the original native execution.
The report records SHA/run/attempt/kernel/CPU and bounded bridge events, including
on failure. Raw logs and original result propagate through the upload step.
Passing evidence for unchanged boundaries on the other coherent hosts remains
at its actual tested SHA; unreached Windows journeys still require renewal.

For #69's retained standalone native termination failures, dispatch
`desktop-ci.yml` with `checks: native-lifecycle`. The existing workflow calls
[native-lifecycle.yml](../.github/workflows/native-lifecycle.yml) at the same
candidate SHA on macOS latest, Windows latest and Windows 2022. It builds once,
finishes Electron's lazy binary extraction serially with `require('electron')`,
then runs the original property-editor, view-readiness, deferred-quit and rename
fixture files concurrently. Original per-scenario deadlines, ownership and
cleanup assertions remain intact. Exact SHA/run/attempt/platform/kernel evidence
and the original test log are uploaded even after failure. Ordinary push/PR/full
routes are unchanged. A source inventory/dispatch guard and an actual exit-23
pipeline probe verify that the route preserves failure propagation. This focused
route provides native-boundary evidence; it does not accept #69's appearance,
package, installation or performance gates.

For issue #41's macOS/Windows development runtimes waiting for offscreen project cells,
dispatch the desktop workflow with `checks: viewport-runtime`. It runs only
the three affected platforms, the viewport/rename/category driver regressions and the original
`npm run smoke:runtime -- dev` command with its existing deadlines, layout,
data-preservation, native and shutdown assertions. The driver scrolls to the
owned project identity before expecting its real fields. It never accepts a
placeholder as a cell. Exact-SHA evidence is retained; unrelated raw-rename and
observer CLI diagnostics are not selected. Full acceptance follows focused
success on the repaired SHA.

Apply this loop automatically when a GitHub Actions check fails during an authorized task, including continuation in a new window. The agent invokes `diagnosing-bugs` without requiring another user command. Executor selection remains governed by [development](development.md#executor-selection); CI failure does not select Ralphex. Continue within existing implementation/push/Actions authorization; request only genuinely missing access or consequential decisions.

1. **Retain the failure.** Record the run/attempt, exact SHA, failed check, OS, original command and relevant logs/artifacts. Distinguish a failed check from a cancelled run, skipped stage or unavailable evidence.
2. **Diagnose and repair.** Follow `diagnosing-bugs`: build a red-capable reproduction, test falsifiable hypotheses, make the scoped repair and verify a meaningful regression. If original evidence cannot identify the cause, retain that limitation and add bounded diagnostic evidence instead of claiming causation or retrying unchanged inputs until green. Preserve product assertions, deadlines, ownership and cleanup gates.
3. **Run only the affected failed checks.** Map the actual failures to focused commands on the affected OS, with necessary build/fixture prerequisites and relevant repair regressions. Select an existing manual route only when it matches those failures. If no matching route exists, add or narrow one before dispatch; the historical route names below are not a generic list to replay. Do not substitute an entire full suite for an addressable failed step. A rerun of an old failed run tests its old SHA, not the repair.
4. **Keep full CI behind the focused gate.** While preparing repair commits, use the repository's supported push-CI suppression (`[skip ci]`) and explicitly dispatch the focused route for the repaired SHA. Keep ordinary workflow defaults intact. Inspect the original focused command's result and required artifacts; diagnostics alone, missing evidence, skips and unreached stages do not pass this gate. A new focused failure returns to diagnosis.
5. **Renew acceptance after focused success.** Once every affected failed check passes and its evidence is inspected, classify the complete diff from the earlier tested candidate. For eligible test-only repairs, follow [evidence reuse](#evidence-reuse-after-test-only-repairs), running affected consumers and any missing scenarios. For application/build/dependency changes or an uncertain impact boundary, dispatch full acceptance on the reviewed SHA after coordinated pushes finish. A new failure returns to step 1 with its failure map.
6. **Deliver only with complete passing coverage.** Inspect required artifacts and apply the existing acceptance/integration policy. Every required scenario/platform needs either current passing evidence or explicitly justified inherited evidence. Focused success alone is insufficient; report each actual tested SHA separately from the delivered SHA.

Keep the current SHA, failure map, reproduction/repair evidence, focused run/result, full run/result and next unresolved gate in the task's existing checkpoint. On a new window or context reset, read that checkpoint and verify the current branch/SHA and run status before continuing from the unresolved gate. Do not default to full CI or replay completed gates merely because the conversation restarted; code changes or new failures determine which evidence needs renewal.

### Evidence reuse after test-only repairs

Select required scenarios under the [inherited coverage policy](development.md#inherited-test-coverage), then run broad acceptance on the completed application candidate. After a repair confined to tests, fixtures, smoke drivers, diagnostic workflow routes or documentation, reuse successful evidence only when all of these conditions hold:

1. Review the entire diff between the source receipt's SHA and the candidate, including intermediate commits. Establish unchanged application, migrations, native resources, dependencies/lockfile, build/package inputs and relevant runtime configuration. A filename classification alone is insufficient; scripts and CI can affect the built application or execution environment.
2. Map each changed test/helper/fixture/route to its consumers and required OS/runtime modes. Renew those checks on the candidate, including the original failed command and repair regressions. A shared helper change expands the consumer set. Validate changed CI routing and suite registration; retain assertions, deadlines and required platform coverage.
3. Retain only successful, inspected receipts with available logs/artifacts and matching relevant inputs, command, runner/toolchain and scenario. A failed overall job may contribute individually successful steps with independent complete evidence. Failed, cancelled, skipped, unreached or missing-evidence scenarios remain unresolved; run them with their prerequisites. A later contradictory failure reopens the scenario even if an older run passed.
4. Record a compact acceptance ledger in the existing GitHub checkpoint: scenario/command and OS/mode; source SHA/run/attempt and artifact; inherited or renewed status; unchanged-input justification or repair result; remaining gates. State which application inputs were compared and which consumers were renewed. Never relabel old receipts as tests executed on the new SHA.

When every required row has passing evidence, acceptance may combine runs without another full matrix. If impact or evidence is uncertain, run the affected broader boundary; use full CI when it cannot be bounded. Release-specific acceptance and agreed human gates still apply. Documentation-only follow-ups require documentation checks and inherit runtime evidence under this same rule.

Use supported `[skip ci]` commits and explicit focused dispatch for eligible follow-ups; retain ordinary workflow defaults. Add a bounded route for affected or unreached commands when existing selectors cannot run them. Inspect an already-running full job before cancelling: allow it to finish if it is providing missing evidence, and retain any new failure for diagnosis. This policy changes acceptance decisions, not GitHub status conclusions or required branch-protection checks; any enforced gate remains required until separately changed with authorization.

### CI test scheduling

Ordinary push and pull-request runs execute common DOM/mocked-client and pure-helper tests once on macOS, alongside lint, typecheck and documentation links. The macOS, Windows latest and Windows 2022 matrix builds once per OS and runs the remaining platform tests, then the existing development and packaged runtime acceptance routes. SQLite, real filesystem, process, native and mixed UI/backend suites remain in that matrix. Production move, recovery and native acceptance assertions are unchanged.

`npm test` still builds and runs every test locally. Test discovery is explicitly limited to `tests/` by the suite runner; sibling worktrees are outside its inventory. After a build, `npm run test:all` runs every test without rebuilding; `npm run test:platform` selects platform suites. `npm run test:common` requires no application build. The explicit common list lives in [test-suites.mjs](../scripts/test-suites.mjs); new test files default to platform coverage. `node scripts/test-suites.mjs <all|common|platform> --list` prints the selected files. Partition controls require complete, nonoverlapping coverage and preserve platform-sensitive suites.

CI packages its already verified build with `npm run package:built`; local `package:dir` retains its fresh-build behavior. A failed prerequisite stops dependent acceptance steps, while failure evidence uploads retain `always()`. New commits cancel older runs for the same event/ref. Push and pull-request identities remain distinct.

Isolated observer, early rename/category service and Windows selection/rename/resolver investigation jobs are available through manual `workflow_dispatch` with `diagnostics: true`. Historical API/CLI experiments retain their separate `legacy_windows_diagnostics` opt-in. Their focused test files remain covered by platform suites during ordinary CI; their standalone experiments are additional diagnostics. A diagnostic artifact or skipped job does not establish product acceptance. Historical evidence directories and artifact names containing `full-suite` now carry the original platform-suite call/checkpoints; they retain exact SHA/run/attempt provenance.

Manual `workflow_dispatch` defaults to `checks: full`. Select `checks: failed` with diagnostics disabled to run only the Windows latest pure-Node observer suite and the macOS development rename/Reveal route. These independent jobs retain original failures and exact SHA/run/attempt artifacts. Focused success is a prerequisite for requesting full acceptance, not a replacement for the ordinary three-platform routes. Rename diagnostics retain the original typed native Reveal receipt on macOS before checking the UI acknowledgment, including rejected responses; they do not relax acceptance or identify historical causes by themselves.

For the later Windows runtime failures, select `checks: failed` and `runtime_failures: true` instead. This runs only the original direct creation/Reveal route on Windows latest and the development runtime on Windows 2022, preceded by the existing isolated category rename/sharing comparisons on Windows 2022. The original scenario still runs if a comparison fails, provided its build passed. Creation diagnostics retain the existing finite typed Reveal receipt on both desktop platforms before native assertions. These are diagnostic routes, not a waiver or proof of historical causation; original failures and unreached stages remain failures.

This scheduling change reduces repeated execution, not the test inventory. Actual Windows acceptance and any pre-existing failures remain pending until a reviewed-SHA run completes. Compare observed job durations after the change before claiming a measured speed or cost reduction.

For integration run failures in category layouts and direct creation, select `checks: failed` and `integration_failures: true`. This takes precedence over the older runtime-failure selector and runs only the original category-layout command on macOS and direct development creation/Reveal on Windows 2022, with relevant UI and Windows bridge regressions. Failure artifacts retain exact SHA/run/attempt provenance. The Windows bridge emits only finite private phase/reason markers on failure; these diagnose a rejection and never authorize success or expose exception text. Production deadlines, binding guards, single dispatch and cleanup requirements stay unchanged. Focused evidence must be inspected before requesting full acceptance.

For the issue-29 category-layout overflow on all three platforms, add `category_layout_only: true`
with `checks: failed, integration_failures: true`. Only the original layout
route runs on macOS, Windows latest and Windows 2022; its existing EN/RU state, width and shutdown assertions remain intact.
The flag defaults to false and does not alter ordinary/full acceptance or the
existing combined integration-failure route (macOS layouts and Windows 2022 Reveal). Inspect its exact-SHA artifact before
requesting full acceptance.

For the issue-21 macOS editor-readiness failure, select `checks: readiness` to run only the original real-Electron readiness suite and retain its test log with exact SHA/run/attempt provenance. It requires no application build. Timely and late delivery use real renderer operands and a controlled host clock to verify the unchanged default deadline and truthful unknown evidence. Focused success still precedes full acceptance.

For the issue-22 Windows latest final packaged-runtime cleanup failure, select `checks: windows-release`. This skips common/full-matrix jobs and runs only Windows latest: build prerequisites, lifecycle/startup/route regressions, packaging/resource validation and the original `npm run smoke:runtime -- release` command. Exact SHA/run/attempt evidence is retained even on failure. The rename harness records the finite cleanup predicate and counts without PIDs, paths or raw probe exceptions. This is diagnostic evidence; parent/backend exit, native cleanup and fixture-removal gates and their deadlines are unchanged. Focused original-step success is required before dispatching full acceptance on the same candidate.

For the subsequent issue-22 recovery-fanout and grouped rename failures, select `checks: issue22-failures`. Only Windows latest and macOS run: build/capture/route prerequisites, the Windows `backend-lifecycle.test.mjs` file and original macOS `npm run smoke:runtime -- dev`. Commit/observer event contracts remain distinct, original runtime assertions/deadlines stay intact, and finite submission receipts contain no names or paths. Both focused scenarios and retained artifacts must pass before full CI.

For issue #31's direct-recovery fixture failure on Windows 2022 and original
macOS development runtime, use `checks: issue22-failures` with
`recovery_windows_2022: true`. This selects the exact backend lifecycle file on
Windows 2022 and unchanged `npm run smoke:runtime -- dev` on macOS. The selector
default remains false, retaining the earlier Windows latest route and ordinary
full coverage. The manual-recovery fixture holds unrelated notification scans;
automatic reconciliation has separate coverage. Failure-only receipts distinguish
review error code and whether the same logical project already occupies the target,
without paths or service exception text. Inspect both original commands and their
artifacts before full acceptance on the repair SHA.


For the issue-23 Windows latest development creation crash/recovery shutdown failure,
select `checks: creation-shutdown`. This runs only Windows latest: the existing build,
quit-evidence/lifecycle/route regressions, and the original
`npm run smoke:runtime -- dev --creation --skip-native` command. The fixture captures
finite owned-process quit phases without names, paths, PIDs or exception text; original
normal-quit/exit/cleanup assertions and deadlines remain unchanged. The exact-SHA artifact
retains all original scenario outcomes, including failure or unreached restart stages.
Missing phase evidence does not prove a cause, and a diagnostic run alone is not full
acceptance. Inspect original-step focused success before dispatching full CI on that SHA.


For the issue-24 Windows 2022 raw legacy realpath stress failure, select `checks: raw-rename`.
The same selector now independently runs the original failed macOS dev runtime command
after build, preserving exact-SHA submission receipts and logs. Both matching jobs must
pass before renewed full acceptance; input preparation verifies exact authored text
before Enter without replaying filesystem effects or accepting a different outcome.
After macOS original focused success with unchanged runtime sources, dispatch
`checks: raw-rename, raw_windows_only: true` to focus a remaining Windows-only
failure. The flag defaults to false, affects only this manual macOS job, and
leaves ordinary/full platform coverage intact.
macOS also runs the original observer CLI cancellation cases after dependencies,
including when runtime fails, with strict exit and retained output.
The Windows raw-rename job runs only Windows 2022 with the existing service-fixture build, bounded idle/native/
legacy/production-scan comparisons and the original Windows rename regression file.
The original test runs after a comparison failure when its build passed; no continuation
or success waiver is applied. Exact-SHA comparison artifacts preserve negative renames,
data invariants, overlap and termination. The regression assertion now retains complete
allowlisted fixture context. A later actual legacy-stress EPERM disproved the
blanket always-success diagnostic expectation: Windows can deny a parent move
while child metadata is being read. The initial single failure remains negative
and counted. Only Windows stress_legacy EPERM may add a separate post-reader
move/restore control: both workers exited, service closed, zero watches/timers,
unchanged full fixture identity/bytes before the control, one same-API forward move
and one restore, exact identity/bytes (including SQLite) after each. Missing proof,
extra attempts, persistent denial, other errors, changed state or unknown child
termination remain failures. Idle, production-scan and product originals stay
strict. This proves post-quiescence movability, not the historical blocking actor.
The finite parser retains both additional operations and original negative response/
failure count; no reader-side ENOENT is invented. Original-step focused success is
required before dispatching full acceptance on the same reviewed SHA.
After the additional local App fixture initial-list race, add
`raw_renderer_check: true` to the raw-only selector. A separate macOS job builds
the service fixture and runs the original `renderer-app.test.tsx` file with strict
pipefail and exact-SHA logs, alongside unchanged Windows raw checks. This flag
defaults false; ordinary/full routes and `raw_windows_only` behavior stay intact.
Both affected original files must pass before full same-SHA acceptance.
The renewed raw-only investigation also executes an actual PowerShell event-filter
control and four separate original legacy fixtures with a unique owned Kernel-File
collector set. The owned set is created with a 15-second run-for setting before
start, explicitly stopped/deleted, and has a 16 MB circular file. Stop is requested
asynchronously after the owned rename-worker close, with fixture-finally fallback;
the original completion signal and one-second resolver lifetime do not await it.
The collector retains
5-second command bounds and a 10-second bound per reader. A full-decode baseline
and a time-filtered reader inspect the same ETL in alternating order, after
a clock-only peek capped at 64 records (three readers total). The peek exports
only aggregate provider count and relative time range; query errors use fixed
allowlisted IDs without exception text. The
filtered reader retains only the existing 1-second-before/25ms-after window and may
miss older name associations. Unknown reader termination forbids a second reader
and raw cleanup. The probe requires successful interpreter controls; original
comparisons/regression remain independent. Raw ETL stays outside artifacts;
only numeric owned-fixture event fields are retained, capped at 256 per reader.
The native query preserves subsecond UTC values as round-trip strings. Installed
PowerShell hashtable-builder controls require precision loss with DateTime operands
and exact millisecond preservation with strings. Native ProviderName filtering
is removed as a separate one-variable comparison; the shared decoder still checks
the exact provider before any fields are decoded. Actual ETL proof remains separate. IRP/FileObject reuse is guarded,
and separate before/during/after queues retain at most 256 records. Missing or truncated
events never establish handle absence (`lossVerified: false`); positive event correlation
does not by itself identify the actor that blocked a historical rename. Collector stop
and owned set deletion must be confirmed before raw trace cleanup; unknown stop
or unavailable event evidence aborts further probes. Original
bounded comparisons and the original regression still execute independently after a
probe/control failure when the build passed. This temporary debug route changes no
product operation, deadline, retry or skip. Its historical strict legacy-success
oracle is now governed by the explicit post-quiescence diagnostic contract above.


For the renewed issue-24 unit failures, select `checks: issue24-failures`. The original
`test-suites.test.mjs` scheduling/routing file runs on macOS, Windows latest and Windows
2022. Windows 2022 also runs the original runner startup/terminal cases from
`ralphex-observe.test.mjs`; that independent step still runs after a routing failure when
its dependencies passed. Only npm dependencies are required, with no application build or
unrelated runtime suite. Pipefail retains both commands' exits; exact-SHA/run/attempt test
logs upload even on failure. Ordinary push/full defaults and the original three-platform
acceptance route remain unchanged. Inspect every affected focused result before full
acceptance on that same reviewed SHA.


For the issue-24 Windows latest category-checkpoint failure, select `checks: category-fixture`.
Windows latest runs the existing build and original `project-category-move-fixture.test.mjs`
file. Windows 2022 independently runs the original failed `npm run smoke:runtime -- dev`
after building, preserving the unavailable-category submission proof and runtime observations.
Pipefail preserves both exits; exact-SHA logs and each sanitized checkpoint upload even on
failure. Malformed-result controls now corrupt only their reached injection, retaining earlier
real service/lifecycle failures. No restart retry, deadline, production assertion or cleanup gate
is relaxed. Inspect original-file success and retained checkpoints before full acceptance on
the same reviewed SHA; a better diagnostic does not establish the historical restart cause.


For the subsequent issue-24 Windows latest initial category-service connect and
Electron cleanup-control mount failures, select `checks: issue24-startup`.
It builds once and independently runs the original category fixture and readiness
files on Windows latest; readiness still runs after a category failure if build
passed. Strict pipefail and exact-SHA logs/checkpoints retain both original exits.
The fixture-owned navigation completes within the existing firstWindow allowance;
cleanup controls retain primary/secondary errors without an unrelated DOM mount.
Category connect failures retain finite controller startup stages, including before
a diagnostic injection is reached. The original 6s startup, scenarios, shutdown,
cleanup and invalid-diagnostic assertions remain mandatory. Focused success and
artifact inspection precede full acceptance on that same reviewed candidate.


After that route's unchanged readiness file passes, `startup_category_only: true`
focuses a remaining category failure; the flag defaults to false and affects
only the focused readiness step. A timed-out owned-worker wait is now explicitly
rejected at its original 1s deadline, retaining a finite running/stopped/unknown
probe of only its captured owned PID. A stopped probe without an exit event still
fails. Original scenario, terminal, count, normal shutdown and cleanup assertions
remain; actual OS stop/notification causation is not inferred from the snapshot.


For the later Windows latest and Windows 2022 readiness navigation/context failures in issue24,
dispatch `checks: readiness, readiness_windows: true`. This existing route
runs only the original readiness file and its regressions on both Windows runners with
npm dependencies and distinct OS/SHA/run artifacts; the flag defaults to the historical macOS route and does not
change ordinary/full coverage. Main load receipts are followed by the exact
fixture data URL's Page load within the same30s firstWindow allowance. Different
fixture navigation URLs prevent an old load state from satisfying a new load.
Inspect the original-file result/log before renewed full same-SHA acceptance.

For issue24 full run38636598781's additional macOS grouped packaged creation/native
acknowledgment failure, include `readiness_package_creation: true` in that same
`checks: readiness, readiness_windows: true` dispatch. The independent macOS job
builds, checks the Reveal service regressions, packages and validates the artifact,
then runs the exact original grouped packaged creation/native command without skips.
Its separate artifact retains exact SHA/run/attempt and all original target, reply,
shutdown/restart and owned cleanup assertions. One union dispatch avoids branch
concurrency cancelling a second focused run. Full acceptance still follows only
after every affected focused result and artifact passes on the same SHA.

For full run38641861932's original Reveal-file failures on Windows, dispatch
`checks: readiness, readiness_reveal_windows: true, readiness_package_creation: true`.
This replaces the unrelated editor file with the original Reveal regression file
on both Windows runners and preserves the exact macOS packaged native command
after the service repair. Both Windows logs retain OS/SHA/run/attempt provenance;
the original assertions and full/default scheduling remain unchanged.

Add `readiness_native_windows: true` to that same union for the complete
run38641861932 failure map: Windows latest independently runs the exact original
direct development creation/native command after a successful build, even if
its service/bridge regression file fails. Both Windows jobs include the existing
bridge regression file. Native owner expiry retains its finite protocol state
and owner_deadline reason without changing the12-second deadline, one navigation,
one GO/selection, exact-view guards or owned-process cleanup. This state is the
last token acknowledged by main, not proof of the blocked COM call or OS actor.

For run38645981450's repeated Windows latest native expiry after the full UI
prefix, add `readiness_native_prefix: true` to the focused Reveal/native union.
It retains the original Ladle build, both original layout commands and original
dev creation/crash command before the exact failed direct native command. The
last command still runs independently after successful application build if a
regression or prefix fails; every failed predecessor remains a failed job.
The focused command defaults to `WORKSPACE_REVEAL_TRACE=0`, matching the full
product runtime. `readiness_native_trace: true` explicitly enables diagnosis. Fixed
bootstrap/read-boundary markers are deduplicated (19 maximum), validated under
the unchanged1024-byte protocol limit and retained as first received boundary
latencies from adapter spawn. They neither authorize GO nor identify the current
blocked call after repeated polls. The `binding_returned` marker records whether at least one binding read completed; its presence confirms a completed read; absence means no completion marker was received and leaves read/exception/delivery hypotheses unresolved. Default runtime behavior has tracing disabled.
Actual Windows interpreter controls, existing view/binding/permit/deadline tests
and original target/native/quit/cleanup assertions remain required.

For issue #26 full run 38727412661's macOS packaged MultiSelect property-creator timeout,
select `checks: multiselect`. This runs only macOS build prerequisites, real Electron
loading/keyboard and MultiSelect regressions, packaging/resource validation and the
original `npm run smoke:multiselect -- release` command. The original command still
runs after successful packaging even if a regression fails, and every failed step
keeps the job failed. Exact SHA/run/attempt metadata, regression output and runtime
JSON/screenshots are retained. Production deadlines, keyboard activation, EN/RU,
restart, set/visibility, normal quit/backend exit and owned cleanup assertions remain
unchanged. Inspect both the original command and required evidence before renewed
full acceptance on that same reviewed SHA.

Issue #26 full run 38732178491's sole Windows latest failure is the final category-move
fixture ownership gate inside the original packaged `npm run smoke:runtime -- release`.
Use the same `checks: windows-release` selector. Its regression prefix now includes
`project-category-move-runtime.test.mjs` alongside lifecycle/startup/route checks.
Category-move evidence retains the exact finite `inspectOwnedProcesses` predicate used
for cleanup (reason/counts only), matching the existing rename fixture's diagnostics.
The stopped value, all PID/parent/startup uncertainty restrictions, original scenarios,
34 normal quits/backend exits, deadlines and confirmed-removal requirements remain
unchanged. Missing earlier predicate evidence cannot establish whether the failure was
PID reuse, an owned live process, or incomplete observation. Inspect the original
Windows command and this evidence before any renewed full acceptance on the same SHA.

For issue #26 full run 38738171579's Windows latest ETW-control regression failure,
select `checks: etw-controls`. It runs only the original
`node --import tsx --test tests/windows-rename-etw.test.mjs` file on Windows latest,
with route guards and exact-SHA/run/attempt test-output evidence. The test retains
finite phase, elapsed, killed/signal/code and known-error markers when PowerShell
fails; no raw additional stderr, paths or event payloads are logged. The existing
ten-second child limit, native-builder precision control and all attribution,
retention, privacy and equality assertions remain unchanged. This diagnostic does
not prove the historical cause; focused original success and artifact inspection
are required before another full run on the same reviewed SHA.

The same `etw-controls` selector additionally renews the subsequently failed local
property-driver native fixture on macOS, in an independent job running only
`tests/property-editor-driver.test.mjs`. It retains its own exact-SHA/run/attempt
output and failures; both original files and artifacts must pass before full CI.
The native fixture uses one Playwright-owned normal quit under the unchanged
ten-second bound; forced cleanup after failure never satisfies normal closure.

For full run38808047668's sole macOS property-driver setup failure, select
`checks: property-fixture`. It runs that exact original property-driver file only,
using the existing artifact/normal-quit contract. The old `etw-controls` union and
ordinary full/push defaults remain intact. The negative test arms its unchanged
100ms caller deadline after HTML/listener preparation; it still requires timeout,
zero activation and no editor. Setup is not the operation under this short deadline.
Inspect its original-file result before renewed full acceptance on the same SHA.

For issue #26 run 38761764716's Windows latest creation shutdown timeout, the
existing `checks: creation-shutdown` route matches the exact original command.
It includes the real-Electron deferred-quit regression and runs the original
creation matrix independently after regression failure when the build succeeded.
The runtime helper gives Playwright sole ownership of the normal quit request;
its ten-second bound, strict failure/forced-cleanup behavior and all caller
backend/fixture checks remain. The native red/green control proves a competing
quit can bypass deferred cleanup, not the exact historical timeout cause.

The same creation route includes the native input-focus readiness regression
after a local original-matrix one-shot focus failure. Creation waits for visible,
app-focused input in its existing 15-second page allowance, retaining the explicit
focus assertion; the driver never acquires focus. Absent app focus still times out.

After focused run 38765621210 exposed concurrent first-use Electron downloads
and native launch failures, all/platform suite execution resolves the pinned
Electron binary once before parallel workers. Common tests and `--list` retain
their existing behavior. The creation-focused route performs the same serial
preparation before its native regressions; original creation runs independently
after build/preparation success. No deadline, assertion, inventory or failed-step
result is relaxed. The historical OS-level extraction mechanism remains unproven.

For issue #26 run 38767720986's Windows latest category checkpoint utility-exit
failure, select `checks: category-fixture, category_fixture_only: true`. This
runs only the original failed Windows latest file; the flag defaults false and
preserves the historical Windows2022 runtime route. On Windows, all/platform
suite execution runs the category fixture file in an exclusive first batch,
then every other selected file once. Failures/signals remain failed across
batches; the original one-second exit deadline, diagnostic and cleanup assertions
are unchanged. Common/list and non-Windows execution are unchanged. Isolation
tests a native-load/event-delivery hypothesis; exact historical causation remains
unproven. Focused original/artifact acceptance still precedes full CI.

For issue #26 run38772058082's Windows2022 App Reveal-feedback failure, select
`checks: app-fixture`. It builds and runs only the original renderer-app file on
Windows2022, independently after route-check failure when build succeeds, with
strict output retention and exactSHA/run/attempt provenance. The failing test
retains finite click/typed receipt/lifetime counters and known-message booleans;
original interactions, waits and assertions remain unchanged. Diagnostic evidence
and local success do not prove the historical cause; focused original/artifact
acceptance remains required before full CI on the same reviewed SHA.

For issue #26's repeated Windows latest direct creation/native owner expiry,
focused38781872446 removed only the UI predecessor block and passed the unchanged
original command, exact selected-target observation, restart and cleanup. The
Windows latest full job now runs that direct native command immediately after
build, before platform workers and layout/recovery workloads. Other OS order is
unchanged. The original command runs exactly once per OS; all later checks and
strict native/ownership/deadline/cleanup assertions remain required. This is
scheduling isolation, not proof of the historical Windows/COM cause.

Validate this order with `checks: readiness`, `readiness_reveal_windows: true`,
`readiness_native_windows: true`, `readiness_native_prefix: true` and
`readiness_native_early: true`. Native acceptance runs first after build; all
relevant native/service controls and original layout/recovery predecessors still
run afterwards, even if that native command fails. The default early flag is
false, preserving the historical reproduction order. Exact-SHA artifacts and
full acceptance are required after focused success.

The Windows binding uses direct .NET IDispatch reads rather than PowerShell COM
member discovery. The ShellWindows collection return also passes through the
opaque managed helper, with genuine Count/IUnknown/typed-Item controls; this is a
scoped latency hypothesis, not unique historical-cause proof. Renew its cold original with `checks: readiness`,
`readiness_reveal_windows: true`, `readiness_native_windows: true`,
`readiness_native_early: true`; leave the historical prefix and `readiness_native_trace` disabled. Inspect the
exact-SHA native result, COM/UIA target evidence, restart, shutdown and cleanup
before full acceptance. Temporary COM/host/timing comparison routes are removed;
no Explorer warm-up precedes this original. Focused npm installation retains
verbose failure output under strict pipefail, including failures before build,
without retry or runtime substitution.


For full38808047668's Windows category failures and the later Windows2022 rename
Reveal failure, select `checks: runtime-observation`. Both Windows latest and 2022
original development runtimes run, preceded by observer/receipt/UI controls and
the minimized real category UI command. Only Windows2022 also runs the existing
isolated real-service, idle, child-sharing and native/legacy-realpath/production-scan
comparisons. Those comparisons own disposable roots and do not attribute the
historical OS handle. Each original command runs independently after a successful
build, including after control/comparison/minimized failure. `readiness_native_trace`
defaults off; enable it explicitly only for the bounded native boundary comparison.
Inspect actual bound replies, independent no-effects proofs and native failure
stages in the exact-SHA artifacts. The focused build retains strict-pipefail output
and verbose dependency preparation diagnostics even when runtime is unreached.
Rename cleanup records confirmed backend exits per owned launch occurrence, so
later numeric PID reuse does not invalidate an earlier exit proof. Unknown or
new owned occurrences remain unconfirmed until independently verified absent.
Default/full scheduling and the historical
Windows2022-only category-fixture selector remain unchanged. No retry, observer
suppression, settling wait or deadline change is added to product or original
runtime acceptance. Inspect original/comparison artifacts before choosing a repair
or requesting full acceptance.

Focused runtime-observation uploads completed control logs before the long
original runtime, with exact SHA/run/attempt provenance. The original build-only
prerequisite, strict exits and final always-upload remain unchanged.

Windows Reveal obtains each fresh Shell.Windows candidate set through SDK-typed
_NewEnum/IEnumVARIANT, avoiding indexed Item acquisition observed active during a
failed quiet request. Bounded exhaustion, validated counts and unique COM identities
precede the existing exact parent/target, Document, HWND/Explorer/UIA, readiness,
permit and pre/post-selection checks. Count agreement is not atomic membership
proof. There is no retry, indexed fallback, warm-up, cache or deadline extension.
Temporary checkpoint timers and acquisition switches are removed before final
ordinary focused/full acceptance. Immediate finite read tracing remains opt-in;
window_candidate marks processing of an enumerated candidate.

### View-backed Ladle fixture failure

For issue #28's missing filter-query mock in the original category layout capture,
select `checks: view-fixtures`. The focused matrix runs macOS, Windows latest and
Windows 2022: existing category/rename/recovery UI regressions, the Ladle build and
the exact original `node scripts/smoke-discovery-layouts.mjs --category-move` command.
It retains SHA/run/attempt/platform provenance, original readiness deadlines,
screenshots, interactions and normal shutdown assertions. Inspect all affected
original-step results and artifacts before dispatching full acceptance on the same
repair SHA. The ordinary/full matrix remains unchanged.


Issue #28 run 39038352303 additionally reproduced the original App Reveal-feedback
failure on both Windows runners: a typed `missing` response accompanied by visible
`uncertain` feedback. `checks: app-fixture` now maps the unchanged original file to
both affected runners, with separate artifacts. A bounded, path-free test timeline
retains projection state/revision, source event ordering and Reveal start/reply
phases on success and failure. Thirty local repetitions passed; that result does
not identify the remote race or waive its original assertion. The existing
`checks: issue24-failures` route separately replays the original routing file on
all three platforms after the `view-fixtures` inventory repair.

For issue #31 full run 39064672849's Windows latest observer worker exit failure,
select `checks: failed, observer_fixture_only: true`. This retains the original
Windows observer/runner/diagnostic files and excludes only the unrelated macOS
rename job for that explicit selector. The default false preserves historical
routing and full coverage. Strict pipefail and an always-uploaded exact-SHA log
retain original exits independently of collector validation. A failed real PID
denial worker emits only finite status/exit/error-class markers, never paths or
raw logs. A successful isolated run does not identify the historical worker cause;
inspect the original file and evidence before renewed full acceptance.

For issue #32 run39113135361's sole Windows latest packaged Number creator
failure, select `checks: number`. The Windows latest-only job retains build,
real-Electron delayed/enabled creator controls, Number service/UI regressions,
packaging/resource checks and the original `npm run smoke:number -- release`.
The original runs independently after regression failure when packaging succeeds;
strict output capture, failed exits and exact-SHA/run/attempt artifacts remain.
A deterministic delayed-disabled control reproduces the old direct focus/Enter
missing-form pattern. The Number runtime now uses the existing enabled creator
helper without changing keyboard entry, deadlines or product assertions. The
original failure lacks a focus/enablement timeline, so its unique historical
cause is not established. Inspect original EN/RU/restart/shutdown/cleanup evidence
before renewed full acceptance on the same reviewed SHA. Ordinary push/full and
all three platform routes remain unchanged.

For issue #32 run39116052433's Windows latest property-driver normal-close
failure, select `checks: windows-property-fixture`. It reuses the existing
property fixture job on Windows latest only; the historical macOS and ETW
selectors keep their OS. Route/batch guards precede the unchanged original
`tests/property-editor-driver.test.mjs`, which still runs independently after a
guard failure when dependency installation succeeded. Exact-run provenance and
strict original output are uploaded even on failure.

Windows all/platform execution now gives this native fixture its own batch after
the existing category utility-exit batch, before all remaining files. Every file
still runs once, and any failed/signaled batch keeps the suite failed. Other OS
and common execution are unchanged. This tests native cross-file load isolation;
it does not establish historical shutdown causation. Failure-only finite event
receipt timestamps distinguish close request/result, app quit receipts, parent
exit and stdio close without logging paths or PIDs. The ten-second normal-close,
negative caller deadline, single activation and cleanup assertions remain intact.
Inspect the original focused result before renewed full acceptance.


For issue #33 full run39124807104's Windows latest development rename authoring
failure, select `checks: rename-authoring`. Only Windows latest runs the real-Electron
authoring/readiness controls and original `npm run smoke:runtime -- dev` command.
The original command runs after a control failure when its build succeeded; strict
pipefail and exact SHA/run/attempt artifacts preserve both outcomes. Ordinary/full
routes remain unchanged. Inspect the original rename receipt, full runtime outcome,
normal shutdown and cleanup before a renewed full run on the same candidate.

The lost/deferred keyboard-delete control reproduces the original failure pattern
without submitting a filesystem command. Nonempty draft preparation now uses one
standard locator replacement and retains exact authored-value verification before
Enter; empty drafts still require an exact empty result. This removes a redundant
separate Delete dependency, without proving the historical Windows event-loss cause,
relaxing product assertions or replaying rename commands.

For issue #33 run39127698398's cold Windows latest creation Reveal exception,
the readiness native route above retains its original command and ordering.
Failure packets may additionally carry the last allowlisted read boundary and
coarse exception class, only for readiness/precommand/postcheck exceptions.
This failure-only context is independent of opt-in trace, resets each read and
never includes exception text, paths or HRESULTs. It does not change selection
permission or readiness. Validate protocol and actual PowerShell controls plus
the untraced cold original before renewed full CI; a traced success alone does
not establish the historical cause or satisfy full acceptance.

For integration run39136222601's Windows2022 premature-main-exit rename
fixture failure, select `checks: rename-fixture`. The Windows2022-only job
builds and runs the original `tests/project-rename-fixture.test.mjs`, retaining
strict exits, exact-SHA/run/attempt provenance and each control's bounded
checkpoint evidence. The failed original observed one utility instead of five;
this does not identify the cause of the earlier worker exit. The focused route
adds no retries, deadline extension, reduced worker count or product assertion
changes. Inspect its original result and checkpoints before renewed full CI.

For issue35 full39140454210's Windows latest delayed-focus property fixture
normal-close failure, use the existing `checks: windows-property-fixture` route.
The unchanged ten-second normal-close gate observed main quit/Node exit, with
parent exit only at forced cleanup. Failure-only finite page/context/application
close receipts now distinguish window/protocol lifetime from parent lifetime.
They observe public events and issue no quit, focus, retry or cleanup commands.
The historical native cause remains unproven. Inspect the exact-SHA original
file and retained timeline before renewed full acceptance.

For issue35 full39142202230's Windows latest category fixture evidence-write
control exit1 (expected0), select `checks: category-fixture`,
`category_fixture_only: true`. The intentional occupied evidence destination
prevents writing its checkpoint; the original exit assertion now retains the
already validated private-safe finite diagnostic/scenario/utility event packet
on failure. Handshake, normal exit, scenario, utility, privacy, cleanup and
occupied-file preservation assertions remain. No underlying cause is inferred
from exit1 alone; inspect the original focused result before renewed full CI.

## Issue 38 early Windows collection failure

Full run39165311194 at `53a58c3` failed its early Windows latest original direct
creation/Reveal command before selection. The retained finite receipt is
`readiness / collection / invalid_operation`; native selection was zero, service
reply was a rejected `native_error`, and owned cleanup passed. The subsequent
collector-document validation failed because the platform suite was unreached;
that absence does not pass or independently identify the native cause.

The managed collection guards retain fixed failure-only labels for count-result /
range, enumerator acquisition, terminal value/count, changed count, status, extra /
limited entries, null/non-COM entries and duplicate identity. The existing checks,
bounds, call order, one-navigation/selection authority and deadlines are unchanged.
No message, path or numeric HRESULT is emitted. These labels distinguish hypotheses;
they do not establish the original historical cause or authorize a retry.

Use the existing focused route with `checks: readiness`,
`readiness_reveal_windows: true`, `readiness_native_windows: true`, and
`readiness_native_early: true`; leave prefix and optional trace disabled to retain
its cold original order. Both Windows runners execute the bridge/service regressions,
and Windows latest first runs the exact failed native command. Inspect that original
result plus managed guard controls and owned cleanup before renewed full acceptance
on the same reviewed SHA. Preserve the failed full run and artifact12150238888.

## Issue 39 Windows Date creator failure

The installation workflow also provides a focused original-step replay for full
run `39200366181`'s Windows latest development Date failure. Dispatch
[macos-install.yml](../.github/workflows/macos-install.yml) with
`checks: windows-date`. This builds on Windows latest, runs existing real-Electron
creator and Date service/UI/route regressions, then the original
`npm run smoke:date -- dev` even after a regression failure if the build passed.
Strict command exits and exact-SHA/run/attempt evidence remain. The default
`checks: macos` retains macOS 14 arm64 installation; ordinary/full desktop coverage
is unchanged. Focused success precedes renewed full desktop acceptance on the
same reviewed SHA. The reproduced disabled-button mechanism does not independently
establish the historical activation timing, which the original failure did not record.

## Issue 48 desktop shell launch geometry

Full run `39298961435` at `719adbe` failed the new shell journey on macOS latest
and Windows 2022 before its renderer-size scenarios. The original assertion
incorrectly demanded a 1024x720 content viewport; #47 specifies a minimum window.
Retain those result artifacts (content 1024x645 and 1008x689 respectively), the
unreached ordinary platform suite and its secondary missing-collector failure.
Neither unreached steps nor secondary validation count as passing acceptance.

The repaired product uses default/minimum outer dimensions of 1024x720. The
original native journey records outer/content bounds, minimum, display/work area
and scale factor before asserting the initial outer window. An undersized native
window still fails explicitly; the two 1024x720/1440x960 renderer journeys are
unchanged. Geometry failure no longer masks already-established process ownership
and safe cleanup.

Dispatch `desktop-ci.yml` with `checks: desktop-shell` for this failure. It builds,
runs affected settings/App/route regressions and the original `npm run smoke:shell`
on macOS latest, Windows latest and Windows 2022. The original runs after a failed
regression when its build succeeded; strict exits, exact SHA/run/attempt provenance
and always-uploaded results remain. Inspect native geometry, original journey and
cleanup before full CI on the same reviewed repair SHA. Ordinary/default coverage
is unchanged.


## Issue 49 packaged Single Select readiness

Full desktop run `39381220528` at `99584863` passed Common, all platform suites,
and complete macOS/latest and Windows/2022 acceptance. Only Windows/latest's
`npm run smoke:select -- release` failed waiting for Property name after keyboard
creation. The failed screenshot showed the workspace without a property form;
normal shutdown and owned cleanup passed. The enabled state at activation was not
captured, so the historical timing cause remains an inference.

Dispatch `checks: select-readiness` to build and package on Windows/latest, run the
real-Electron EN/RU creator readiness regressions and routing checks, then replay
that exact packaged command. Enabled-button keyboard activation reuses the
existing property driver; all original action deadlines and scenario assertions
remain. Always-uploaded evidence records SHA/run/attempt and the original result.
Inspect focused results before renewed full desktop acceptance on the same SHA.
Application and installer inputs are unchanged by this driver/fixture/CI repair;
retain their separately recorded successful exact-SHA receipts.

For #50's canonical-path fixture mismatch, `checks: source-fixture` renews the
source settings renderer/service scenarios on Windows 2022, Windows latest and
macOS after their required build. The original Windows 2022 log distinguishes
legacy short-path expectations from the native canonical path displayed by the
application. This route preserves original assertions and captures exact-SHA
provenance. Apply the evidence-reuse policy to this test/route-only repair; source
native and installer receipts retain their actual earlier SHA.

After #50's original source-fixture gate passes, `checks: source-runtime` supplies
only the Windows 2022/latest layout, development-runtime and packaged-runtime
steps that the failed platform batch never reached. It builds fresh inputs and
retains the ordinary suffix's commands, environments, conditions, deadlines and
artifacts; a parity regression guards that boundary. Earlier successful platform
cases, source/shell/management journeys and installers retain their own SHA.
Windows latest's early direct native receipt is inherited; Windows 2022's later
direct native step remains in the continuation. This route neither reruns macOS
nor replaces any missing Windows scenario with inherited success.


## Issue 51 clipped Board readiness

For performance run `39414634270` at `23c7fb4`, renew only the candidate on the
failed hosts with `performance.yml`, `candidate_only: true`, `platform: both`.
A real-Electron readiness regression precedes the unchanged strict measurement;
the original still runs after a failed regression if packaging succeeded. The
readonly predicate intersects ancestor clipping boxes while retaining complete
ordered membership, pending rejection and real fields for partially visible rows.
The observed clipped-row mechanism explains the readiness deadlock, not the
separately retained startup/filter/assignment target misses. All original limits,
normal shutdown and owned cleanup remain. The original desktop and installer
runs retain their own SHA; apply evidence reuse only after reviewing unchanged
application/build inputs and inspecting every missing or renewed receipt.


After readiness renewal `39416296014`, retain the inspected macOS 14 strict
receipt at `cfefb0f7`; only Windows latest failed startup/filter timing. Dispatch
`platform: windows-latest`, `candidate_only: true`, `profile_service: true` to
retain a separate public-service diagnosis followed by the original unprofiled
strict command. Historical failures remain evidence, and profiling is not
acceptance. The runtime activation helper supports both the current tabs and the
immutable baseline select with one action and no replay; its native regression
renews both control paths without changing measured targets or application inputs.


Windows renewal `39418142493` at `420158b2` completed all functional/lifecycle
checks and startup/memory targets, but five interaction samples still exceeded
300ms. The separate service profile completed; displayed-view reads were
23.6–36.8ms, while configured-source opening/listing/refresh and native observation
also consumed CPU. This does not identify the renderer interaction delay.
The opt-in `profile_filters` diagnostic now additionally captures the first Table
filter and each Table/Board grouping-assignment span. The existing Board widening
profile is retained; all profiled measurements remain diagnostic, and the original
unprofiled strict command runs independently. An explicit Windows dispatch with
`candidate_only: false` also provides the immutable baseline's original select
consumer as a differential control; baseline target misses are recorded, not waived.


The subsequent endpoint repair captures interaction completion inside the final
existing renderer frame, retaining both readiness checks and both frame pairs.
It records the old late-read observation and trailing driver delay separately;
finite/fresh timestamp guards reject invalid measurements. Native regressions
prove delayed rendering remains measured, later driver delay does not move the
endpoint, and invalidated fields require the second readiness check. Renew only
the candidate plus these controls on both performance hosts; earlier performance
receipts retain their old clock and SHA. The original `--enforce` command and all
limits/correctness/lifecycle gates remain; desktop/installer inputs are unchanged.


For `39422590498`'s remaining macOS Table assignment and Windows interaction/scan
misses, renew both original strict candidate hosts after the in-renderer
stabilization repair. It retains both complete readiness observations and both
frame pairs within one renderer promise, records phase timestamps, and removes
only driver round trips between those phases. Fixture setup uses its ordinary
30-second budget; 500ms activation controls remain. A performance-only language
adapter preserves the immutable baseline's inline select without changing the
shared current settings driver. The failed baseline General-tab comparison remains
failed diagnostic evidence; neither its target misses nor unreached cases are
relabeled as passing current acceptance.


After `39424627943`, macOS 14 strict acceptance at `b77d3885` is inspected/passing;
only Windows latest remains failed. Observation-start metadata leaves the endpoint
and readiness algorithm unchanged, while expected-ID preparation now occurs before
the event as the contract requires. Retain the actual macOS receipt with that
unchanged-input/conservative-bound justification and renewed native controls.
Select Windows only with `candidate_only: true`, `profile_service: true`; the
separate diagnostic now includes actual filter/grouping saves and group assignment,
then the original unprofiled strict command runs independently. New phases split
pre-observation time from initial readiness; neither diagnostics nor local timings
substitute for the failed Windows targets.


For `39440696066`'s remaining Windows interaction misses, the existing optional
`profile_filters` renderer diagnostic now additionally retains Chromium timeline
streams and fixed event/paint marks alongside CPU profiles. This distinguishes
native layout/paint, JS/GC and idle spans; data loss rejects and collection has a
bounded completion/owned cleanup path. Marks/tracing execute only in the diagnostic
branch. Select Windows candidate-only with `profile_filters: true`; the unchanged
unprofiled original follows independently. Retain actual macOS `b77d3885` strict
acceptance and the separately inspected desktop/installers. No trace or isolated
service timing substitutes for a Windows strict pass.

## Issue 52 failed-host renewal

The original `350293cc` run missed macOS Table grouping/assignment targets and
Windows latest's category fixture failed before its injected cleanup checkpoint
(`grouped.restart`, `stop_owned_timeout_stopped`). These are separate gates.
Retain the actual failed artifacts and first-failure codes; a later control's
expected failure cannot stand in for reaching it. The fixture exit assertion now
includes only its already sanitized finite diagnostic/count/cleanup evidence.

The separate existing `profile_filters` performance run optionally observes main
IPC request/reply times for four fixed grouping/projection command types, bounded
to 256 records, and native window focus/visibility/minimized state. It retains no
payload, reply, exception, path or PID. This helper is installed only in diagnostic
runs; the original unprofiled strict command, endpoint, clocks, deadlines and
limits remain unchanged. Wall time correlates events; duration uses a monotonic
clock. Diagnostic results cannot substitute for strict acceptance.

Use existing `checks: category-fixture` with `category_fixture_only: true` for the
failed Windows latest original fixture file. After its focused gate passes,
`checks: source-runtime`, `source_runtime_platform: windows-latest` renews the
unreached development/packaged routes on that host. The default `all` preserves
both Windows hosts; ordinary three-platform push/full acceptance is unchanged.
The early direct Windows latest creation and shell/management/source steps that
already passed retain their actual inspected receipts; this route retains the
existing exclusion of that duplicate early direct scenario.

Apply evidence reuse only after reviewing the complete delta: these diagnostic,
assertion-message, selector/test and documentation changes do not change the
application, dependencies, migrations, native resources or build/package inputs.
Retain installer/unaffected full-platform results at their actual source SHA;
renew changed diagnostics/native controls and the failed/missing consumers.

The same original Windows performance run later timed out after resetting Table
grouping and search. Its reset driver could press an HTML-disabled Save while a
new projection was pending. A native delayed-enable regression reproduces the
lost action (zero submits, filtered rows) and passes when the original single
Enter is prepared against an enabled/focused control. Only this unmeasured reset
precondition changes; event-to-paint measurements and membership/readiness checks
remain intact. This establishes the driver race, not the unique cause of the old
hosted timeout. A failure-only readonly packet now records expected/actual row
counts, mismatch index, unloaded/pending/group counts and Save/search booleans;
it retains no IDs/text/paths and never substitutes for the original timeout.

The `c09a0505` Windows renewal completed all 32 performance scenarios, including
reset/full projection, but still missed strict targets. Its eight native driver
controls failed at normal Electron shutdown. Select `performance.yml` with
`readiness_only: true`, `platform: windows-latest` to renew only these original
controls with bounded quit-event/debugger-wait/exit evidence. This route skips
packaging, baseline and strict performance; it cannot supply performance acceptance.
Ordinary workflow defaults and the independent strict command remain unchanged.
Do not infer a repaired native lifecycle from a functional assertion or forced exit.

The isolated Windows controls then passed 10/10 at `87e63246`, run `39460699645`;
no fixture shutdown logic was changed and the historical timeout cause remains
unproven. The next optional profile records request timings for assignment,
filter saves, Text saves, snapshot reads and refresh as well as grouping/view
reads, after every measured UI endpoint. This distinguishes backend time from
renderer/driver time in the actual remaining failures. The fixed allowlist,
256-request history, privacy boundary and diagnostic-only installation remain;
original strict clocks, actions, endpoints and targets are unchanged.

For investigation without unchanged strict reruns, `diagnostic_only: true` skips
baseline and strict acceptance, requires at least one selected `profile_filters`
or `profile_service`, and uses a separate platform-specific concurrency group.
It still packages the exact candidate, retains the original native controls and
runs selected profiles. It cannot supply strict acceptance. Defaults preserve
the existing original full/candidate routes and their limits.

At `30b502b4`, strict run `39463627765` passed macOS but Windows still missed
interaction limits. Both exact artifacts were inspected: all 32 functional cases,
normal application quits/backend exits and cleanup completed. Windows separate
profiles observed assignment IPC up to 268.8 ms and filter save 126.2 ms, after
the redundant property reads had been removed. Preserve the actual macOS strict
receipt; no unchanged Windows strict rerun is selected for diagnosis.

For that remaining failure, `diagnostic_only: true`, `platform: windows-latest`,
`profile_filters: true`, `profile_backend: true` instruments only the disposable
profile bundle copy. Its archive is extracted, the pinned backend factory is
wrapped once and the diagnostic backend hashes are recorded. The original package
and strict route remain untouched. Backend observations retain fixed request types,
wall/CPU durations and timestamps, capped at 256 per process; no payloads, replies,
errors, authored values or process identities are recorded. Each normal close
flushes one batch to a new evidence file; missing batches fail diagnostics. CPU
usage includes backend worker threads and is not a main-thread CPU measurement.
Compare backend execution start/end with the main IPC interval to distinguish
service work from queue/transport delay. This modified copy cannot supply startup,
package or strict performance acceptance. Conflicting modes/missing renderer
profiling are rejected before execution.

Windows backend diagnostic `39466360777` at `80a9640f` completed 32 scenarios,
four normal backend batches/178 requests and cleanup. A slow grouped Board
assignment spent 143 ms before backend execution, 42 ms executing, and about
8 ms returning; an unmeasured preceding ordinary queryView spent 1.8 seconds
walking the source. This identifies queue delay in that diagnostic sample, not
a unique cause for every older strict failure.

The next driver repair replaces repeated metadata-only unmeasured filesystem
queries with the existing displayed-source projection derived from a public
complete source list. The service still validates its revision/full ownership
and reads current values/filter/group/layout state; stale input fails without
fallback. Initial source verification and post-filesystem-change/Refresh/identity
checks retain their ordinary fresh reads. No measured action, clock, readiness,
correctness assertion or limit is removed. Renew both original strict consumers
because preparation changed on both hosts; modified-copy diagnostics are not
acceptance and earlier receipts keep their actual SHA/harness provenance.

The issue-52 copied backend probe also records fixed internal reconciliation,
direct/grouped scan and workspace-load phase durations. These
nested spans share the bounded payload-free service history and normal-close
batch; they never authorize or replace a scan, result or request. Exact pinned
function markers and copied-artifact child execution are verified. This separates
otherwise unexplained pre-request queue time from service execution; no original
application or strict package is instrumented.

For issue-52 serial endpoint polling delay, the performance readiness predicate
also checks the operation's committed result DOM before its original frame pairs.
Observation starts before retained role-locator waits. Saved group heading and
destination membership, actual edited text and external rename remain required;
all later locators and public-service/filesystem assertions still execute. Native
controls cover delayed commitment and late driver delivery. Both strict hosts
must renew after this shared measurement-driver repair; a passing diagnostic
profile does not satisfy acceptance or establish a backend queue repair.

For the remaining issue-52 focused macOS first-group frame gaps, the separate
renderer profile accepts `profile_unthrottled: true` (CLI
`--profile-filters --profile-unthrottled`). It records original/current native
background throttling and renderer visibility/focus at the event and observation.
Only this explicit diagnostic changes scheduling; default/strict launches never
set it, and CLI enforcement rejects profiled execution. Native property and
pre-fixture CLI guard controls cover the distinction. The altered configuration
cannot supply performance acceptance or justify a production runtime change by
itself. Retain the original normal-scheduling failure for comparison.

## Scoped desktop UX foundation

Issue #68 adds `checks: desktop-ux` to the existing manual Desktop workflow.
The route runs on macOS latest, Windows latest and Windows 2022. It excludes the
ordinary common/verify chain for this dispatch only; ordinary push/PR/full and
release/installer routes retain their existing selection.

After `npm ci` and the normal build, `npm run test:desktop-ux` invokes the explicit
`foundation` profile in [desktop-ux-checks.mjs](../scripts/desktop-ux-checks.mjs):
static checks, affected React and real-service suites, artifact consumers and
real Electron visual/shell/workspace/source/saved-view flows. SQLite/folder/native
suites keep their original boundaries and remain in the ordinary platform/full
inventory. The route packages the candidate, verifies its resources/licenses and
runs the packaged saved-view consumers. It is not the #69/#67 milestone or release
acceptance route.

Use `node scripts/desktop-ux-checks.mjs foundation --list` to inspect the exact
selected commands. The `desktop_ux_failure_probe` workflow input deliberately
executes a failing selected command (exit 23). Its jobs must fail; skipped later
commands do not count as passes. The positive dispatch omits that input and must
pass every selected command. Local regression tests independently prove exit
propagation and stop-before-next-command behavior. Preserve negative-control and
positive-run receipts separately, with candidate SHA/run/attempt/host and uploaded
artifacts. Full/native/data-safety/installer routes are retained, not replaced.

After the #68 packaged-route correction, `desktop_ux_packaged_only: true`
selects build/package/artifact prerequisites, the actual `smoke:views -- release`
entry point, and the originally reached `smoke:runtime -- release` consumer.
It skips the unchanged source profile; retain that profile's separate exact-SHA
receipt. The extra original runtime preserves its source/discovery/editor/recovery
assertions after sidebar/context entry adaptation. The default remains false.
This route is for renewing that failed boundary, not a substitute for missing
source acceptance.

For #68's later Windows latest category-runtime shutdown failure,
`desktop_ux_category_only: true` selects only that host, adapter regressions,
build/package/assets and the original `release --category-move` command.
Default platform/source selection is unchanged. With
`desktop_ux_category_quit_trace: true`, the route runs unchanged blank-HTML and
deferred-quit controls, then a separately named diagnostic category command even
if a control fails. The explicit trace only observes finite quit phases, debugger
waiting and a nine-second parent/phase snapshot; the normal ten-second deadline,
backend, ownership and cleanup gates are unchanged. Trace reports are diagnostic,
not acceptance. Omit the trace input for the separate strict category command;
its passing artifact is required. Preserve the already passed macOS/Windows 2022
and Windows latest base/rename/views receipts when their inputs remain unchanged.

### Bounded grouped Board acceptance

For #53, `checks: desktop-ux` with `desktop_ux_profile: board` selects the explicit
`board` profile in `scripts/desktop-ux-checks.mjs`. The default remains `foundation`.
The Board profile runs type/lint, affected renderer and real SQLite/folder
service tests, complete Electron Board appearance/interaction captures and the
retained development saved-view consumer. It runs on the existing three-host
matrix and uploads `work/issue-53-board` plus saved-view evidence with the exact
candidate provenance. It does not package unchanged runtime resources or run
installers; ordinary/full/foundation and release routes retain those checks.
Use the Board profile without the packaged/category renewal switches. Failed or
skipped commands remain gates; `--failure-probe` still propagates exit 23.

Issue #53's local macOS full renewal on `d3f8ad7` exposed standalone native
property-creator/view-readiness shutdown failures after JavaScript quit receipts.
The fixture, transitive helpers, Electron dependency/launch inputs and relevant
native resources are unchanged from the issue base; these fixtures do not load
the application/CSS. A two-file parallel reproduction yielded 27 pass/one timeout,
and the same scenarios serially yielded 28 pass. An experimental Darwin batch
isolation still failed a view-readiness shutdown diagnostic and an independent
normal-quit fixture in the full run, so the scheduling change was reverted.
The native cause remains unresolved; the post-close `app.process()` diagnostic
can obscure the original error. Preserve every negative and the rejected
isolation hypothesis in #53's checkpoint. #69 owns resolving/accepting these
broad-harness gates; passing bounded Board acceptance does not certify a green
full suite or the coherent-interface milestone. The final scoped code/route
matches the passing `d3f8ad7` three-host Board receipt; documentation-only
follow-ups inherit it under the evidence policy above.

### Bounded project navigation acceptance

For #54, `checks: desktop-ux` with `desktop_ux_profile: navigation` selects
`navigationCommands()` in `scripts/desktop-ux-checks.mjs`. It runs type/lint,
affected shell/Table/Board/property/archive renderer and real SQLite/folder
services, the Electron project preview/tab/resize journey and shared shell/views
consumers on macOS latest, Windows latest and Windows 2022. Captures include
EN/RU, both themes and sizes, preview/expanded/return, tab close/reopen, released
width, resize bounds and sidebar collapse/restore. Artifacts include
`work/issue-54-navigation` and exact candidate provenance.

Use without packaged/category renewal switches. No IPC, database, runtime
dependency, native resource or installer input changes in this slice; ordinary
full/foundation/release routes retain packaged checks. The route does not accept
#64's tree, #55's persisted session, #56's complete draft guard or #69/#67.
Failure propagation remains strict; suppressed/skipped jobs are not passes.

For the original #54 native navigation failure (long project preview requested
while the prior view's scroll restoration was still active), select
`checks: desktop-ux` and `desktop_ux_profile: navigation-native`. This retains the build prerequisites,
type/lint and navigation/viewport/views/route regressions, then the original
`smoke-project-navigation.mjs` command with unchanged deadlines and shutdown/
cleanup gates. After the original macOS renewal passed, complete run39629050743
exposed late native anchoring on both Windows hosts. The focused profile now
selects those two failed hosts; the earlier macOS receipt retains its own SHA. It omits the unrelated
full-profile consumers while diagnosing the failure. The default profile remains `foundation`;
application repairs renew the complete navigation profile after focused success.
Provenance records both profile and focused-mode selection. A shorter filtered
projection must clamp its saved scroll to current bounds and release restoration;
programmatic smoke scrolling waits for the actual selected projection to settle.

## Project files acceptance

The `desktop-ux` dispatch profile `project-files` runs the affected renderer,
real SQLite/filesystem, IPC/controller and native adapter suites, then actual
Electron file-tree, Open/Reveal, project navigation, shell and saved-view journeys
on macOS latest, Windows latest and Windows 2022. Artifact
`desktop-ux-foundation-<host>` includes exact-SHA provenance and
`work/issue-64-files` appearance/native/shutdown/cleanup evidence. Plain-text
external observation uses the host's TextEdit/Notepad association. macOS CI binds
a uniquely named fixture document's visible WindowServer window to the OS default
application's executable PID, without requesting Automation control of TextEdit.
The cleanup guard permits termination only of a newly launched CI app process with
that one owned document and no other named windows; pre-existing apps are excluded.
Local hosts may use the explicitly selected existing Apple Events document reader
when native window names are redacted. Windows observes the exact command-line
path plus unique window title. These receipts are independent of dispatch acknowledgment.
This adds no workflow input and preserves default foundation/full/release routes.
Installer acceptance remains at the integration milestones: no dependency, native
resource, package or startup/update input changes in this slice.

### Issue 64 focused native renewal

After original run 39641467815, `project-files-native` selects the three affected
desktop hosts and the original real-files/Views native commands, with public
files/IPC/Reveal/visibility regressions. It runs the unchanged Windows COM control
file in a separate Node invocation before the selected batch; deadlines, negative
permit guards and assertions remain unchanged. This tests the Windows-latest
resource-competition hypothesis without treating it as an established cause.
The valid-component long-path fixture asserts a real absolute path beyond260
characters. The macOS failure path captures bounded observer error metadata,
NSWorkspace process identity and a native desktop screenshot where available;
none of those diagnostics substitutes for exact document observation.
The native-only route retains original Open/Reveal, Views, shutdown and cleanup
gates and does not supply full acceptance. Apply evidence reuse or renew the full
`project-files` profile after the focused gate passes.


## Coherent desktop milestone

For #69, `checks: desktop-ux` with `desktop_ux_profile: coherent` composes the
existing principal journeys on one candidate: visual foundation, grouped Board,
real project files/Open/Reveal, project navigation, shell, workspaces, sources
and saved views. Shared affected UI/service regressions run once; standalone
native readiness/property fixtures and Windows COM controls retain separate
invocations. Existing deadlines, assertions, normal exits, owned cleanup and
fail-fast command propagation remain intact. The three-host desktop matrix,
package/artifact/license checks and packaged saved-view consumer remain enabled.
Provenance records `coherent`; existing artifact paths retain every original
scenario's evidence directory. The default remains `foundation`; this selects
no release or installer publication.

Use without the packaged-only or category-only switches; those retain their
focused consumers and skip the coherent source bundle.

This profile supplements ordinary `checks: full`, which does not run the
dedicated appearance/Board/navigation/files journeys. Both are required for
the coherent milestone; a diagnostic or skipped command does not accept it.


### Coherent milestone missing-tail continuation

After #69 full run `39685830877`, `checks: source-runtime` with explicit
`source_runtime_platform: all-desktops` renews missing Ladle/development/package
consumers on macOS latest, Windows latest and Windows 2022. Existing `all`
continues to select only the two Windows hosts; individual-host choices remain.
The explicit continuation also renews the failed CI inventory and visible
workspace-identity native regression on all three hosts. Only Windows latest
runs the previously unreached full shell/workspaces/sources/platform prefix,
with original observer/category environments, validation and failure artifacts.
The earlier independent passing platform cases retain their actual provenance.

First renew the original Windows latest early direct-creation command via
`checks: readiness`, `readiness_reveal_windows: true`,
`readiness_native_windows: true`, `readiness_native_early: true` and the original
`readiness_native_trace: true` environment. Inspect its native/exit/cleanup
artifacts before selecting the continuation; its existing duplicate exclusion
is unchanged. A selected regression or consumer failure remains a failure;
unreached tail rows remain gates. This route changes no application/package
inputs or ordinary full defaults and supplies no release acceptance.


For #69's Windows latest native owner expiry, historical generated-copy probes
`39692017634` and `39692600770` measured process lookup, UIA assembly loading
and root acquisition. Their temporary `native-owner-profile` and
`native-owner-direct-profile` selectors/tools are retired after that experiment.
Reports retain copied hashes, verified restoration and diagnostic-only limits;
different-host timings do not prove the old failure's cause or a speed ratio.

The scoped native repair uses a fresh .NET PID/process-name lookup with disposal
at every existing owner guard. It removes first-use process-cmdlet loading, while
retaining all HWND/PID/Explorer/root/tab checks, permits and deadlines. Renew the
original trace-disabled command using `checks: readiness`,
`readiness_reveal_windows: true`, `readiness_native_windows: true` and
`readiness_native_early: true`; omit `readiness_native_trace`. Inspect exact native
selection, independent COM/UIA, restart, normal quit and cleanup before broader
acceptance. Native build inputs changed, so renew required full desktop/package,
strict performance and installer evidence; prior candidate receipts remain
historical evidence, not acceptance of the new native revision.


After #69 original native `39693324029` passes but its terminal UIA fixture fails,
`checks: native-owner-controls` renews only the original
`windows-native-view-diagnostics.test.mjs` and actual
`windows-process-owner.test.mjs` on Windows latest. Both use Node core and native
PowerShell resources; no npm install or application build is needed. Strict
pipefail, normal test exits and always-upload retain exact-SHA/run/attempt
results. The test-only fixture repair keeps all wrong-owner and terminal-state
assertions; retain the separate passed original consumer at its application SHA.
Renew broader acceptance only after this remaining failed file passes.

### Observer cancellation fixture renewal

For #69's macOS observer cancellation worker exit, select
`checks: observer-cancellation`. The original `ralphex-observe.test.mjs` file
runs on all three desktop hosts, including both real CLI cancellation cases
and a real-worker partial-publication regression. The fixture publishes its
release receipt by rename only after the complete write; cancellation, ownership,
terminal exit and cleanup assertions remain. Exact SHA/run/attempt and test logs
are uploaded even on failure. This route neither builds nor changes application
inputs; ordinary/full coverage remains unchanged. Apply evidence reuse only after
focused success and run every previously unreached runtime scenario separately.

For #69's category-story readiness failure, the original category-layout focused
route above remains authoritative on all three hosts. Story preparation enters
current project actions and Source-tools history; it never bypasses the service
or submits an extra mutation. Layout measurement ignores hidden content and
accepts compact-header ellipsis only with the exact accessible label. The
standalone 420px operation-form stress retains wrapping/path/control assertions;
only the daily Active/Archived row's internal overflow is outside that stress
below the supported1024px desktop minimum. Required1024/1440 desktop controls
remain covered by coherent acceptance. These are adapted inherited scenarios,
not a supported-window change. Shared layout-driver edits additionally require
all remaining story consumers, through the unfiltered original layout command
or a complete partition, after the failed focused command passes.

For #69's missing runtime tails after inspected focused fixture success, select
`checks: source-runtime, source_runtime_platform: runtime-tails`. This explicit
choice builds on all three hosts, renews changed story UI and route/identity
controls, then runs the **unfiltered original** Ladle command before every
original development and packaged runtime tail. It includes direct creation on
Windows latest. The full layout pass covers creation, rename, mode changes and
all other shared measurement consumers; it replaces duplicate selected captures
for this choice only. Existing selectors and ordinary defaults remain unchanged.
Previously successful platform/prefix rows retain their exact earlier receipts;
failed/unreached rows require the new evidence. The layout/provenance directories
are preserved with runtime evidence. Packages from this route also contain the
newly built Ladle assets under the existing dist/** package rule; production
entry bundles/resources stay separately verified against the application SHA.

If the source-continuation inventory guard fails, use
`checks: source-inventory` before renewing tails. It runs the exact five-file
identity/inventory/native-control command on all three hosts, with strict exit
propagation and exact provenance/failure logs. The guard compares evaluated
command order and environments for existing profiles against `verify`; for
`runtime-tails` only the declared full-layout substitution and Windows latest
direct consumer differ. Missing commands, changed environments and skips remain
failures. This focused route does not build or accept application runtimes.

For a shared Ladle layout failure, `checks: layout-fixtures` isolates the original
unfiltered command and its Ladle prerequisite on all three desktop hosts. It
retains original assertions and deadlines, records exact provenance and uploads
the result even on failure. Observed category-header overflow includes finite
geometry from the original measurement. Later failure geometry has a1000ms
budget and screenshot a2000ms timeout; unavailable diagnostics do not replace
the primary failure or prevent ordinary shutdown/cleanup. A diagnostic probe is
not an acceptance waiver or proof of the historical cause.


The category-header application repair adds an actual production renderer build
and `tests/category-header-layout-native.test.mjs` before that original Ladle
command. The regression uses real Electron/CSS/fonts and legal narrow Table
columns at supported windows, checking containment, non-overlap, EN/RU Hint,
exact keyboard Save/Cancel and focus return with normal shutdown/owned cleanup.
It does not replace any original layout assertion. Application input changes
require renewed full/strict/coherent/installer/appearance acceptance after the
focused original failure passes; earlier test-only reuse does not apply.


## Issue 69 source-context runtime reconciliation

Full `39712591684` at `770e07e5` passes common/platform suites and the
shell/workspaces/source/creation prefixes, then fails the original
`npm run smoke:runtime -- dev` on all three hosts: a global root-path locator
matches both Source tools and retained Workspaces settings. Later runtime and
package rows are unreached. Retain those failures and their successful cleanup.

Dispatch `checks: workspace-root-runtime` after local reconciliation and review.
Only `focused-rename-runtime` runs, on macOS latest, Windows latest and Windows
2022: build, native source-context/layout and route regressions, then the exact
original development runtime command (including rename/category journeys).
Pipefail, exact SHA/run/attempt provenance and always-uploaded
`issue-69-source-root-runtime-*` artifacts remain. Ordinary/full, raw-rename and
viewport selections are unchanged. Inspect original results and owned cleanup
before renewing missing consumers.

The driver adapts current source/setup ownership, keyboard-preserved context,
live context closure and visible settings geometry. Only the already accepted
below-minimum daily toolbar is excluded at widths below1024; operation controls
at420 and all supported-width overflow assertions remain. Native negative
controls distinguish these cases. Recovery Escape targets its focusable heading
inside the existing owning handler; cancellation and data-preservation assertions
remain.

Apply evidence reuse only after reviewing the entire delta from770e07e5.
The changed capture helper is consumed by runtime, creation, rename and category
move drivers; renew each required development and packaged mode. The existing
`source-runtime` / `runtime-tails` profile completes these consumers and every
unreached runtime/package tail after focused success. Strict, coherent, installer
and appearance receipts retain their actual770e07e5 source only when application,
build, resource, dependency and execution inputs are proved unchanged. No failed
or unreached row becomes passing through reuse.


For the subsequent #69 loading-history reachability failure in39719353774, use
`checks: layout-fixtures` for the original unfiltered command on all three hosts.
Both Windows failures retain608 captures and normal quit. The route serially
initializes Electron before category-header and actual-hook scroll native tests.
The new driver uses ordinary keyboard scroll intent at an already-focused button
in the owning restoring view; it retains loading/focus, zero command activation
and the original geometry predicate, including an unreachable negative control.
A controlled actual-story late-notification probe reproduces the reset mechanism;
it does not establish unique historical timing. Keep any useful running runtime
coverage and its ref fixed. Inspect the focused original results before completing
missing Windows tails; retain independently complete Mac consumers when inputs
are unchanged.


For #69's subsequent macOS development MultiSelect hidden-summary failure,
`checks: multiselect` renews that exact command plus the shared Single Select
driver in development and packaged modes on macOS. The two development steps
run independently after a successful build; packaged consumers retain independent
artifact gates. Exact provenance, regression logs and all four runtime directories
are always preserved. Both drivers enter the existing tools/disclosure path for
initial and reopened option management; data/keyboard/restart/filesystem/shutdown
assertions remain. Focused success does not replace required Windows consumers
or the still-unreached properties/archive/recovery/package tails.


For #69's later retained-context and creation-cleanup failures, dispatch the
reviewed test-driver repair with `checks: archive-contexts` and
`checks: creation-ownership`. Each selects only its focused all-three-host job.
Archive-contexts runs archive/category UI/service controls and the exact original
development plus related packaged commands. Creation-ownership runs occurrence/
lifecycle controls, original development crash matrix and direct/grouped native
creation. Both initialize Electron serially and retain exact provenance, pipefail
and always-uploaded evidence. Creation's existing occurrence registry retains
positive parent/backend exit proof instead of reprobing an already-exited numeric
PID; unknown ownership still blocks cleanup. Original skipped cleanup remains a
failed receipt; matching controlled PID reuse is not unique historical causation.

After those focused originals pass and their reports are inspected, select
`checks: source-runtime, source_runtime_platform: package-tails`. This keeps all
three build/package hosts and native inventory controls, builds Ladle for the
unchanged package composition, runs missing development DataRecovery and every
original packaged runtime command. Windowslatest also renews dev Views, MultiSelect,
Select, Date and Number because39722181287 stopped before them. Mac/Windows2022
skip those only with their inspected successfuld6bcd7c0 reports. Base/rename/category
retain exact earlier passing receipts; focused creation and archive/category
renew their changed consumers. No platform suite or full layout/dev prefix is
replayed for this profile. A new failure reopens its concrete row before acceptance.
Ordinary/full and older focused defaults remain unchanged; no added dispatch inputs.

For #69's subsequent Views menu detachment in39724821487 on Windowslatest,
select `checks: view-contexts`. It renews only the changed Views driver in dev and
release once on macOS latest, Windows latest and Windows2022. Real-Electron
ViewsPanel/context focus-return, existing UI/service and route controls precede
the original commands; build, package/resource validation, serial Electron setup,
pipefail, exact provenance and always artifacts remain. `views-readiness` retains
its older Windows-only three-iteration diagnostic behavior. The Views-specific
helper dismisses the owning context via actual controls before keyboard menu
entry; shared grouping behavior, product source and original assertions remain.
After focused success and artifact inspection, `checks: source-runtime,
source_runtime_platform: package-windows-latest` runs only missing Windowslatest
dev Views/MultiSelect/Select/Date/Number/DataRecovery and all packaged consumers.
Inspected macOS/Windows2022 package-tail receipts39724821487 retain their actual
341ef774 source; their changed Views consumers still require focused renewal.

## Workspace session acceptance

For issue #55, `desktop-ci.yml` with `checks: desktop-ux` and
`desktop_ux_profile: sessions` selects the public real-SQLite session/upgrade/
backup/recovery and affected renderer suites, development session restart and
original data-recovery consumers, package/resource verification, and packaged
session/data-recovery/saved-view consumers on all three existing desktop hosts.
The ordinary full route also includes the development and packaged session
commands, preserving its common/platform and original runtime inventory.
`smoke-workspace-sessions.mjs` records exact SHA/run/attempt/host, whole-window
EN/RU/theme/size captures, fresh project content, missing tabs, independent sibling
sessions, normal app/backend exits and asserted owned-fixture cleanup. Skipped or
unreached consumers are not passing evidence. Changed storage/startup inputs
require renewed affected package/migration consumers; this route does not waive
Windows 11 release acceptance or final #67 requirements.

## Scalar draft acceptance

For #56, `checks: desktop-ux` with `desktop_ux_profile: scalars` runs the
shared scalar/service and affected Table/Board/project/navigation regressions,
then actual Electron scalar, project-navigation and original Number/Date routes
on macOS latest, Windows latest and Windows 2022. Packaging/resource gates and
packaged scalar, original Number/Date and saved-view consumers remain mandatory.
The ordinary/full defaults are unchanged. `work/issue-56-scalars-*` records the
candidate SHA/run/attempt/host, EN/RU/theme/size editor captures, public-query
values, blocked invalid navigation, correction, normal app/backend exit and
owned-fixture cleanup. New profile failure probes retain nonzero propagation;
skipped or unreached commands are not passing evidence. No installer input,
release or main-branch publication is changed by this profile.


## Issue 57 selection editors

Manual `checks: desktop-ux` with `desktop_ux_profile: selections` runs the
shared Table/Board/details selection and option editors, public Select/MultiSelect
service/IPC ownership, safe metadata/folder-backed regressions and the scalar
navigation guard. Native commands inspect open menus across EN/RU, light/dark
and both supported window sizes, then retain original Select/MultiSelect and
saved-view/grouping journeys. Failed commands propagate on macOS latest,
Windows latest and Windows 2022; artifacts include exact-candidate provenance,
menu screenshots and restart/shutdown receipts.

The bounded profile does not rebuild unchanged packages or installers. Ordinary
full routes and #67/#42 milestone gates remain intact. See the
[selection verification report](verification/issue-57-selection-editors.md) for
local results, retained failures and the GitHub checkpoint for hosted acceptance.


For the first #57 test-driver failures, `desktop_ux_profile: selection-native`
runs only the new native detaching-control/readiness/focus regressions and
original Selection/Select/MultiSelect commands on all three hosts. It additionally
renews original Views on Windows 2022, its failed host. After focused success,
`selection-tail` runs only the unreached scalar/Views commands on macOS and
Windows latest. The default `selections` and ordinary routes remain intact;
no skipped package job supplies acceptance. These profiles implement the
[test-only evidence reuse ledger](#evidence-reuse-after-test-only-repairs), with
actual results maintained in issue #57.

The subsequent macOS original MultiSelect focus failure is renewed with
`selection-focus`: native driver/routing regressions and the unchanged original
MultiSelect journey on macOS only. Content dismissal is followed by observation
of the exact trigger focus before the retained element-identity assertion.
Passing Windows native receipts and macOS Selection/Select receipts remain at
`1695c5ff`; no unchanged platform journey is retried to obtain a green verdict.

## Contextual property acceptance

For issue #58, dispatch `checks: desktop-ux`, `desktop_ux_profile: properties`.
The scoped profile runs property/removal service and IPC checks, affected
renderer/navigation/selection/layout coverage, native creator readiness, the
property matrix and existing selection/Select/MultiSelect/Views Electron flows.
It uses the existing macOS latest, Windows latest and Windows 2022 matrix.
Property screenshots and the flow report are retained in
`work/issue-58-properties-dev` with the candidate provenance artifact. No installer
boundary changes; ordinary/full, packaged and final milestone routes remain.

For the #58 view-switch/property-smoke failure on macOS and the Views grouping
focus failure on Windows latest, use `desktop_ux_profile: property-repair`.
It selects only those two hosts, the three controlled readiness/focus regressions,
and each host's original failed command. After focused success, `property-tail`
renews unreached macOS selection/Select/MultiSelect/Views consumers, the changed
property smoke on both Windows hosts, and the changed Views consumer on Windows
2022. Earlier passing source/service results retain their exact receipts under
the test-only reuse policy. No product, build, dependency, timing threshold or
ordinary workflow default changes in this repair.
The property repair profile finishes Electron's lazy binary extraction serially
before its parallel native regression workers, as the ordinary suite runner does.
The original commands remain behind that passing preparation/regression gate.

For #58's subsequent macOS MultiSelect reopen/focus failure, the existing
`selection-focus` profile renews the failed original command and native/routing
regressions on macOS. After its success, `property-renewal` runs only macOS Views,
both Windows changed MultiSelect consumers, and Windows latest Views (its earlier
execution was cancelled, not passed). Candidate build/provenance/artifact upload
and original product deadlines/assertions remain. The 21 routing checks cover
all hosts, the explicit latest-only Views environment, CLI registration and
exit-23 propagation. Earlier accepted prefixes retain their tested `d4c6206a`
receipts only because subsequent changes are confined to test drivers/routing.
Do not dispatch a new manual run on the same branch until the active one ends:
the workflow concurrency group cancels its in-progress predecessor.

## Ordinary group assignment

For #59, `checks: desktop-ux` and `desktop_ux_profile: group-assignment` select
public assignment/service/IPC and affected Table/Board/draft/selection regressions,
real pointer readiness and the original all-type Views consumers on macOS latest,
Windows latest and Windows 2022. `smoke-group-assignment.mjs` additionally records
all five ordinary types, MultiSelect occurrences, keyboard clearing/reopen and
whole-screen idle/active-drag/cancellation in EN/RU, light/dark, 1024x720/1440x960.
Exact SHA/run/attempt/host reports and normal shutdown/owned cleanup are preserved
under `work/issue-59-assignment`. Failure propagation is tested; skipped or
unreached commands do not supply acceptance. Unchanged service/schema/IPC/native
filesystem/dependency/package inputs do not trigger installer renewal; ordinary
full and #67/#42 gates remain intact.

## Contextual project operations

For #60, dispatch `checks: desktop-ux`,
`desktop_ux_profile: contextual-projects`. This selects creation/rename/recovery/
Reveal service, crash, IPC and affected renderer/navigation checks, the contextual
project journey and original development creation/rename/native Reveal consumers
on macOS latest, Windows latest and Windows 2022. The profile then packages and
checks resources and renews the same packaged consumers. The new Radix runtime
dependency requires these package checks; installer inputs remain unchanged.

`work/issue-60-projects-*` records exact SHA/run/attempt/host, EN/RU/theme/size
whole-screen captures, actual committed project IDs/metadata and collision/Cancel
outcomes, with normal application/backend exits and asserted owned cleanup.
Original creation/rename reports retain their own directories in the same
artifact. Suppressed push CI and skipped/unreached commands supply no acceptance.
Ordinary full and final #67/#42 release routes remain intact.

For #60's test-only inherited category-move DOM setup repair, select
`desktop_ux_profile: contextual-project-regressions` after the active acceptance
run completes. It renews creation/rename/dialog/category interaction and routing
checks on all three hosts, without replaying unchanged native/package consumers.
The ordinary contextual profile retains the additional category-move coverage
for future runs. Preserve the original full local failures and exact native
receipts; this focused route cannot accept a failed/unreached native command.

## Contextual archive acceptance

For #62, manual `checks: desktop-ux` with `desktop_ux_profile: contextual-archive`
selects the affected renderer, public archive/real-SQLite/filesystem/crash/IPC,
retained session and route suites on all three existing desktop hosts. It runs
contextual Archive/Restore in development and packaged modes, the original archive
restart consumer and original Views consumer in each mode, with serial packaging
and artifact/license verification between them. Every selected command retains
normal failure propagation. Ordinary/full and installer defaults are unchanged.

`smoke-contextual-archive.mjs` records SHA/run/attempt/host, full-window EN/RU,
light/dark, 1024/1440 captures, identity/ordinary editing/retained-tab/file checks,
visible focus after Done and normal shutdown/owned cleanup. `dev --focus-only`
is a one-journey diagnostic for the Archived Restore→Done regression; its receipt
explicitly sets `focusOnly` and has no appearance captures. It cannot replace
the full selected profile or the original restart consumer. Evidence lives under
`work/issue-62-archive-*` and the original archive directories in the hosted
artifact. Final #67/#42 and supported release-host gates remain separate.

For #62's original Windows startup/editor-entry failures, select
`desktop_ux_profile: contextual-archive-native`. Only Windows latest and Windows
2022 run the affected UI/startup/routing controls and the original development
contextual archive command, including its full appearance/identity/editing matrix.
A real-browser pointer-disable control is red for click entry and green for one
keyboard activation of the currently enabled editor; it writes no application
data. The driver uses the existing15000ms interface/startup contract with typed
backend status and bounded failure observation; original native deadlines,
mutation counts, quit and owned-cleanup assertions remain unchanged. Inspect
focused original receipts before renewing full native/package/archive/Views
acceptance. Earlier failure timing has no uniquely established historical cause.

## Contextual folder-backed categories

For #61, `checks: desktop-ux` with `desktop_ux_profile: contextual-categories` selects the three supported CI hosts. It runs affected renderer/service/SQLite/folder/journal/crash/IPC and routing regressions, the new contextual Move/category-review matrix, original category-options/removal and original interrupted category-move native consumers in development and packaged modes. Build/package consumers run sequentially; original deadlines, receipt/identity/file/recovery and normal-shutdown/cleanup assertions remain unchanged. Artifacts include exact profile/SHA/run provenance and each native route's reports/screens. Ordinary full/release defaults remain unchanged. This profile provides scoped #61 evidence; it does not accept #67/#42 or unchanged installer/manual release gates.

## Filesystem group assignment

For #63, `checks: desktop-ux` with `desktop_ux_profile: filesystem-assignment`
selects the three supported hosts. It runs assignment service/IPC/UI, rename and
category move crash/recovery, archive restrictions and affected dialog/navigation
checks; the changed Details/history journeys and the complete ordinary/Name/category
assignment matrix run in actual development Electron. Original Views, rename and
category-move native consumers remain explicit. `work/issue-63-assignment` retains
EN/RU light/dark narrow/wide captures and separate normal-exit/cleanup results.
No service/schema/native/dependency/package input changes; installer renewal remains
with the wider milestone. Full and #67/#42 routes remain unchanged.

For failed run `39871362877`, select `filesystem-assignment-repair` first.
It limits execution to the failed macOS visibility command and Windows latest
original rename Reveal. The Windows diagnostic enables existing bounded native
trace; a separate subsequent step repeats the exact original trace-disabled
command and is required for acceptance. macOS runs the projection-race regression
and original assignment driver. Ordinary three-host defaults remain unchanged.

After both focused gates pass and artifacts are inspected, select
`filesystem-assignment-tail`. It renews the changed shared visibility regression
and all native consumers (assignment, Views, rename and category move) on all
three hosts because their helper input changed. Passing unchanged service/UI
inputs retain their exact original provenance; no full-suite retry is required
for this test-only repair. Trace-only results and unreached commands do not pass
acceptance.

If the Windows validation prefix fails before the native command, renew only
Windows latest with `filesystem-assignment-reveal-repair`. Contract validation
explicitly uses `WORKSPACE_REVEAL_TRACE=0`; only the following original native
diagnostic receives trace=1, and a third strict native step uses trace=0. This
prevents diagnostic output from changing strict finite-protocol assertions.
The passed macOS focused receipt remains at its actual SHA.

## Retained project recovery

For #65, `checks: desktop-ux` with `desktop_ux_profile: retained-recovery`
selects current recovery/reconciliation/mode/session/backup/archive/file service
contracts and affected renderer/navigation/dialog consumers on macOS latest,
Windows latest and Windows 2022. Native development and packaged consumers
exercise retained missing/excluded/mode-inactive/archived/source-outage contexts,
explicit reassociation, verified external rename, current files/values and restart.
Original sessions, data recovery and archive journeys remain; development project
navigation and packaged Views renew related consumers. Packages retain resource
and license inspection. Commands run serially and propagate failures.

`work/issue-65-*` contains whole-window EN/RU, light/dark, both-size captures,
current token/identity checks, source-outage geometry, normal application/backend
shutdown and asserted owned-fixture cleanup. Provenance records SHA/run/attempt,
host and selected profile. An earlier failed or diagnostic local report is retained
as such; it never supplies normal shutdown or restart acceptance. Ordinary/full,
installer and release defaults remain unchanged. Final #67/#42 acceptance must
include this recovery scope and its retained product guarantees.

For integrating #63 with accepted retained recovery #65, select
`filesystem-assignment-integration`. It runs the union of both affected test
inventories once, followed by every original assignment and retained-recovery
native consumer, including development/package recovery, sessions, archive,
data recovery, navigation and packaged Views. Packaging and resource inspection
remain serial. All three hosts and both issue artifact destinations are retained.
This renews the combined renderer/CSS inputs; the earlier separate issue receipts
do not substitute for merged-candidate acceptance.

For merged run39877009892's packaged Sources-readiness failure, select
`filesystem-assignment-recovery-renewal`: the controlled delayed-list regression
and original retained-recovery driver run in development and packaged modes on
all three hosts. Only macOS additionally runs its unreached release sessions,
data recovery, archive and Views tail. Other successful inspected merged receipts
retain their actual6de2c383 provenance; application/build inputs are unchanged by
this driver-only repair. Exact visible canonical-source identity, original
caller deadlines, screenshots, restart and shutdown/cleanup gates remain required.

## Recovery settings acceptance

For #66, `checks: desktop-ux` with `desktop_ux_profile: recovery-settings`
selects recovery/App/dialog interactions, real SQLite backup/session/recovery,
settings/version/artifact checks and development recovery/session/shell journeys
on macOS latest, Windows latest and Windows 2022. The route packages the candidate
and repeats the actual recovery and session consumers in release mode. Recovery
captures cover Backup, About, review, invalid restoration, unavailable source and
startup failure; EN/RU, light/dark, 1024x720 and 1440x960 are retained separately.
Startup database failure uses a disposable corrupt database and must preserve its
bytes. The original 360px stress and data-preservation assertions remain present.
An unavailable backend shows matching-version instructions; no replacement is
attempted until its service can open. All normal-exit and owned-cleanup gates
remain mandatory. Installer and strict scale milestones retain their separately
owned acceptance because no installer/native/storage/performance path is changed.

For the category-move portal/archive fixture repair in #67, use
`checks: integrated-category-layout` first. It renews all50 EN/RU category-move
states/150 captures on all three hosts, without full tests or package journeys.
After its passing artifacts are inspected, renew the creation/rename fixtures
with `checks: integrated-operation-layout`. This runs36 creation/reveal and96
rename states, retaining separate reports. After all three focused gates pass and
their artifacts are inspected, `integrated-runtime` excludes only the already
renewed Applied, category-move, creation and rename families (116 states remain). Ordinary
`integrated-desktop` retains the entire layout inventory. This adds a checks
choice without exceeding the existing workflow-dispatch input limit.


For #67's strict preview/drag misses, `performance.yml` supports
`diagnostic_only: true`, `profile_filters: true`, `profile_projects: true` and
`profile_backend: true`, with `platform: windows-latest`. This omits baseline and
strict acceptance reruns. Preview CPU/timeline profiles and bounded payload-free
IPC/backend observations are diagnostic only. Project profiling defaults off and
rejects use without both isolated diagnostic mode and renderer profiling.
Normal `--enforce --project-flows` limits and clocks remain unchanged.


For the unresolved archived-editor entry/save race in #67, use
`checks: integrated-archive-profile`. Its six diagnostic jobs run the original
archive command in dev/release on all three hosts. They retain the original
assertions/nonzero failures and record only bounded focus/input/disabled state,
lengths and focus-call stacks, never authored values. Receipts explicitly mark
diagnostic execution. Ordinary integrated acceptance pins
`WORKSPACE_ARCHIVE_ENTRY_TRACE=0`; the diagnostic job alone sets it to1.
These observations cannot replace normal archive acceptance.


For #67's Mac packaged workspace-management failure at39944358198, select
`checks: integrated-fixture-repairs`. It reuses the three-host sidebar job, renews
related renderer/service, exact selected-identity and current drag-bounds readiness
checks plus the original real pointer control, packages and inspects resources,
then runs original workspace-management and ordinary/filesystem assignment
commands in release mode with tracing disabled. The assignment control also
renews Windows2022 run39944358198's missing before rectangle. Every original command requires successful
readiness/package/resource prerequisites. The historical workspace-sidebar
selector retains its development shell/management behavior. No full tests, Ladle
or unrelated journey is replayed by this focused gate. After artifact inspection,
renew only missing native tails under the test-only evidence policy; retain
passing full/layout/installer receipts at their actual A222 SHA.


After the #67 focused repair artifacts pass and are inspected, select
`checks: integrated-missing-tails`. It renews Mac from sources excluding the
separately renewed ordinary/filesystem assignment and A222 archive/Views
consumers (23 journeys), and Windows2022 from projects excluding those same
archive/Views consumers (15 journeys). Windows latest retains its complete
A222 run39944358198. The route omits full tests and Ladle, builds/packages each
host, and retains the original serial commands, strict scale, complete package
inventory guards and mandatory artifacts. Reports explicitly remain partial and
list every omitted row; the acceptance ledger must supply inspected passing
receipts for those rows at their actual SHA.


For focused9e3 run39960693209's Mac360px collision visibility failure, select
`checks: integrated-filesystem-repair`. It renews the native360/420 shell posture
and supported-size restoration control, package/resources and original release
filesystem assignment on all three hosts. Workspace and ordinary-assignment
receipts remain at9e3; they are not replayed. Only the filesystem appearance
caller supplies the real sidebar preparation; original Views keeps its default
viewport behavior. Inspect passing original reports before missing-tail dispatch.


For run39965141240's Windows2022 contextual-project entry failure, select
`checks: integrated-project-entry-repair`. It runs the disabled/enabled keyboard
control and routing checks, package/resource prerequisites and only the original
contextual-project release journey on all three hosts. Tracing remains disabled;
the original command runs only after successful prerequisites. No full suite,
Ladle or unrelated package journey is replayed. Inspect original reports before
renewing missing tails; the independent Mac category-entry failure remains open.


For Mac tail39965141240's missing Move action in Board preview, select
`checks: integrated-category-entry-profile`. It packages/inspects only macOS
latest and runs the original release category command with diagnostic Playwright
snapshots/screenshots. WORKSPACE_CATEGORY_ENTRY_TRACE=1 is opt-in, marks its
report diagnostic and disables source capture. Start/stop are bounded before
original normal shutdown/cleanup; capture failure preserves scenario failure.
Ordinary aggregate acceptance explicitly pins this flag to0. This diagnostic
route cannot accept categories or start missing tails; retain passing30a7
project-entry receipts and prior unchanged production inputs at their actual SHA.


After the heavy traced category diagnostic passes without reproducing the
missing control, the same selector runs exactly three isolated Mac diagnostic
trials with WORKSPACE_CATEGORY_ENTRY_TRACE=events. This observes a64-entry ring
of trusted preview pointer/mouse events and project-area count changes, with no
DOM snapshots or authored values. The observer records installation and fails
closed if absent; collection has2s before unchanged normal shutdown. Trial
identity is retained in provenance/artifact names. These bounded samples seek
a reproduction; passing them cannot clear the historical category gate or
unblock acceptance tails. Mode1 remains available for original heavy trace.


## Durable source access correction

For #71, dispatch `desktop-ci.yml` with `checks: source-access`. The registered
selection calls `source-access.yml` on macOS latest, Windows latest and Windows
2022. It builds once, runs the complete current suite, then actual production
Sources enrollment in development mode. Packaging and resource inspection precede
the same Sources journey in release mode against the unchanged candidate.
Receipts preserve EN/RU, both themes/sizes, explicit mappings, Cancel/Apply,
logical IDs, native-command denial, normal shutdown and owned cleanup, with
SHA/run/attempt/kernel and the packaged app.asar hash. Failures stop dependent
steps and logs/artifacts retain their original status. A missing Windows or
package receipt remains an open gate. Ordinary push/PR/full defaults are unchanged;
successful unconverted folder effects remain owned by #72, separately from retained
command-engine safety coverage and this issue's production capability denial.


For run40090391119's Windows failures, select `checks: source-access-repair`.
It renews the five original failed files (native evidence, source association,
identity upgrade, Text upgrade and Windows rename diagnostics) on Windows latest
and Windows2022, after a fresh build. It does not rerun passing macOS acceptance
or unrelated Windows files. The initial repair runs used a temporary finite setup trace to locate the
long-path provider refusal. That trace and its environment selection have been
removed after red/green confirmation; the current focused route runs the original
checks without diagnostic substitution. Passing full macOS evidence remains at81a3381d.
Windows dev/package journeys were unreached and still require execution after the
focused failure gate passes.


After focused40092827817 passed on both Windows hosts, renew `checks: source-access`
on the trace-free final candidate. The adapter's Windows native operand changes
application behavior, so this renewal includes the complete three-host suite and
all original development/package Sources consumers, rather than substituting
focused successes for full acceptance. Retain81a3381d's passing macOS receipt and
original failing Windows receipts at their actual provenance.


A further sharing-policy review after passing40093275559 added evidence-layer
native-child avoidance and route-substitution controls. `source-access-repair`
therefore also renews `discovery-canonicalization.test.mjs` on both Windows hosts,
retaining source-level native root checks. Passing earlier full receipts do not
waive this finding; inspect the repaired focused gate before the next full
source-access renewal. The original ordinary/full selection is unchanged.

## Durable command safety acceptance

For #72, use the registered `desktop-ci.yml` dispatcher with
`checks: command-safety`. The [command workflow](../.github/workflows/command-safety.yml)
runs the complete current suite on macOS latest, Windows latest and Windows 2022,
then renews development and packaged source enrollment, creation/recovery/native,
rename, category move, category folders/removal, archive/restore, file Open/Reveal
and backup/recovery consumers. Each host packages once. The acceptance driver
records the actual source SHA/diff and harness digests, host/architecture, full
package inventory and app.asar hash; package changes fail acceptance. No release
is published and no live data is used. Windows Server receipts remain distinct
from Windows 11 desktop acceptance.

`checks: command-safety-runtime` omits the full suite;
`checks: command-safety-packaged` also omits the development journeys. Use these only under the existing evidence-reuse policy.
The reusable workflow input `from`, or the local driver option `--from`,
selects a named tail of the driver inventory. Excluded and
unreached journeys remain explicit; a successful tail reports `partial` rather
than complete acceptance. Earlier passing results retain their actual SHA,
package hash and source provenance. A failure stops later consumers and preserves
its nonzero exit. `--failure-probe` is diagnostic-only: it runs no real journey and
must produce a failed receipt. These routes do not waive any unresolved issue or
supported-host requirement. Ordinary full dispatch behavior remains unchanged.

For #72 run40162220624's Windows command-safety fixture failures, select
`checks: command-safety-fixtures`. This runs the original eleven failed files
with their unchanged assertions on macOS latest, Windows latest and Windows 2022,
after the existing build. A separate disposable path diagnostic records raw and
canonical source locators, SQL lookup counts, native operand comparisons and
whether each modeled proof injection actually fired. Diagnostic output alone
never accepts the original checks. Original nonzero exits and all reports are
retained. Only this selector gets its own concurrency suffix, so an ongoing
full acceptance run on the same ref can finish providing missing evidence.
Ordinary push/PR/full grouping and defaults remain unchanged. Follow the shared
failed-Actions and evidence-reuse policies before renewing acceptance.

After the same #72 repair narrows the remaining failure to the equal-root legacy
alias case, `checks: command-safety-archive-alias` selects only
`durable-archive-location.test.mjs` on those three hosts. The default fixture profile
still selects all eleven files. Artifacts record the actual profile/file inventory;
a narrow pass does not claim the eleven-file profile ran again. Build prerequisites,
original failure propagation and separate diagnostic concurrency are retained.

After the focused #72 fixture gate passes, `checks: command-safety-windows`
renews only Windows latest and Windows2022 in runtime phase: unchanged static/build
prerequisites, all eight DEV journeys, one package/artifact check, then all eight
package journeys. It supplies the previously unreached Windows consumers without
rerunning the completed macOS acceptance or the addressed full-suite step.
The reusable workflow's `hosts` selection defaults to all three hosts for both
call and direct dispatch, and unknown selections fail before consumers run.
Preserve each inherited full/focused receipt's real SHA and each package hash.

For run40166177229's Windows2022 creation context-entry failure, select
`checks: command-safety-creation-diagnostic`. This isolated diagnostic route runs
the original source-enrollment prefix and all eight original creation checkpoints
on Windows2022, with passive, bounded context-entry observation enabled. It
changes no UI actions, visibility deadlines, native checks or cleanup assertions.
A passive-observer control runs after the original sequence; primary failures and
all artifacts remain. Its separate concurrency suffix preserves other runtime
runs. Diagnostic receipts are explicitly marked and cannot supply ordinary
acceptance or waive the unresolved failure. Default routes install no observer.

The same diagnostic route now adds at most24 grouped `after_commit` samples
after the original eight checkpoints succeed. Each sample gets its own fixture,
app and marked evidence directory, retains native/cleanup assertions and stops
the series on its first failure. These samples aim to capture an intermittent
failure with passive evidence; even24 successes establish no historical cause
and do not replace ordinary runtime acceptance.

After run40168582599 completed all24 passive samples without reproducing the
failure, those bounded samples now omit the custom DOM observer and record
Playwright action/DOM/screenshot traces around Submit and first entry instead.
Receipts carry `contextTraceDiagnostic`; trace failures preserve a nonzero result.
The original eight-case prefix retains passive observations, and ordinary routes
install neither diagnostic. This comparison tests observation sensitivity and
still supplies no ordinary acceptance or asserted historical cause.

Run40169066416's24 trace-only samples also passed. The next bounded diagnostic
changes one timing variable: sixfold Chromium renderer CPU throttling only from
Submit to first entry. It requires trace mode, records the rate, resets to normal
and detaches before native dispatch, and retains all original visibility/native/
cleanup deadlines. Failures to configure/reset tracing or CPU remain failures.
This stress condition is diagnostic only and never ordinary acceptance.

After the bounded Windows2022 diagnostic comparisons,
`checks: command-safety-windows-2022` supplies one ordinary runtime renewal on
Windows2022 only: original prerequisites, all eight DEV journeys, one package and
artifact check, then all eight packaged journeys. It enables no diagnostic flags
and the failed creation gate stops later consumers. Preserve the original failure
and unestablished historical cause; diagnostic successes do not supply ordinary
acceptance. Reusable/all-host defaults and other host selections stay unchanged.
A new ordinary failure returns to the failed-Actions diagnosis loop.

Cumulative review identified a changed default creation driver sequence in the
optional diagnostic disposal wrapper. Renew only that consumer on macOS latest
and Windows latest with `checks: command-safety-creation`. The ordinary route
retains source-enrollment as its original prefix, all eight creation checkpoints
in DEV and package modes, one package/artifact check and native/cleanup gates.
It enables no diagnostics and uses separate concurrency so Windows2022 can
finish supplying its missing tail. Other six journeys are explicitly excluded;
manifest status is `partial`, with actual source/harness/package provenance.
The reusable `through` input / CLI `--through` selects an inclusive inventory end;
unknown/reversed ranges fail, and empty defaults preserve the full inventory.
This narrow renewal resolves only creation-driver reuse; inherited successful
receipts retain their actual tested SHA, and the unknown historical cause stays
explicit.

## Immediate folder opening (issue 73)

Dispatch the registered `desktop-ci.yml` with `checks: immediate-folders`.
The [scoped route](../.github/workflows/immediate-folders.yml) runs the full suite
on macOS latest, Windows latest and Windows 2022, then immediate folder opening
and retained unconfigured-source workspace management in development and packaged
modes. Each host packages once. Receipts retain SHA/run/attempt, mode, screenshots,
reopen, source reuse, file preservation and normal shutdown/cleanup. It changes
no ordinary full defaults and publishes no release. Windows Server evidence does
not substitute for Windows 11 desktop acceptance.


A local keyboard renewal also reproduced the Settings failure. Bounded passive
trace captured Enter delivered to Settings without a click/transition; the precise
reason for that consumed activation is unestablished. The navigation-only helper
now waits for the visible destination and may re-enter Settings within its original
15s budget. A control consumes the first keyboard activation and verifies eventual
selected-tab acknowledgment. No service mutation is repeated. Temporary trace
instrumentation was removed. Rename operand verification is also bounded by the
remaining15s; a stalled read-only callback fails with no further submission.


Focused40199671216 at9752299b passes macOS controls/role DEV; Windows
latest reaches Settings but loses target-tab selection, while Windows2022 passes
rename and stops entering archive review after a logged row detachment and hidden
replacement action. No filesystem submission was reached at that failure. The
navigation gate now waits through selected-tab acknowledgment and re-enters only
row tools/unsubmitted action forms after replacement, each within15s. A real
Electron row-clone control requires2 tools entries and exactly1 unsubmitted form;
first-tab activation consumption is also covered. Rename unknown-outcome and
operand guards remain unchanged. Local3 controls and the original role journey
pass. The same focused role-entry gate renews these changes before the existing
runtime complement; all prior failed receipts remain failed.


Runtime40200473514 at a2d240b4 remains failed: macOS role package stopped
at hidden language settings selected through the old helper; Windows2022 management
DEV reached the second removal but lost tools entry before confirmation; Windows
latest management/recovery DEV passed, then role package reached a stale move draft
before its disabled Submit. Cleanup passes. The role language/Back routes now use
the acknowledged settings helper. Management removal entry is bound to stable ID
and opens only an unsubmitted confirmation; the caller still confirms once.
Move preparation permits one explicit stale Cancel/reopen before any command,
verifying unchanged public/physical source and absent destination under15s. The
caller sends the move exactly once; uncertain results have no replay path.

The existing folder-role-entry-repair gate now renews all affected consumers:
five actual-Electron navigation/draft controls, original role and workspace-management
journeys in DEV and package modes on all3hosts, with package/artifact prerequisites.
It omits full suites and unchanged retained recovery/source-outage rows. Local5
controls,70 routing checks, role and management native journeys, lint/docs pass.
Original failed receipts remain failed; remaining Windows retained recovery/outage
rows still require their separate complement after this gate passes.


Gate40201152440 at75b3e9c1 passes macOS role/management DEV/package.
Both Windows role DEV journeys pass; management stops in navigation readiness
after contextual rename Escape (line118). The input can be visible but disabled
until its inactive-workspace activation reply completes; production ignores busy
cancellation. The old driver dispatched Escape without enabled readiness, then
returned while the draft could remain open. A real Electron control reproduces
disabled Escape causing no cancellation. The driver now waits for the enabled
input, sends Escape once and requires hidden-form acknowledgment within15s.
This demonstrates the mechanism; the precise historical race remains inferred.
Local6 controls and original management journey pass. Application code is unchanged.

After this entry gate supplies role/management on all3hosts in both modes,
runtime_only selects Windows latest/2022 only and the remaining retained-recovery
and source-outage DEV/package rows, with package/artifact prerequisites. It does
not replay accepted role/management consumers. Normal full and entry selections
still use all3hosts. Routing checks evaluate both inventories and full defaults.


Gate40201834859 at46ceba93 passes macOS all changed consumers; Windows2022
passes role/management DEV then loses a packaged tree-expansion gesture; Windows
latest reaches a second independently stale rename review. Both captures show
unchanged originals and explicit UI guards, not unknown accepted effects.
Folder expansion now acknowledges expanded state through read-only navigation
within15s. Rename supports at most4 freshly reviewed drafts in the unchanged15s
budget. Each requires the enabled no-unresolved current-name review, fresh public
and physical no-effect proof, and acknowledgment that review disappeared before
authoring. Unknown/accepted work is never replayed. The repeated-stale control
requires3 submissions/2 reviews/1 effect; unknown and stalled checks remain.
Local7 controls, original role journey, routing and lint pass. The same affected
consumer gate renews these driver-only changes before remaining Windows tails.


Gate40202436050 at1791b2df remains failed. macOS lost Add entry after staged
fixture deletion; Windows latest reached a vanished RU restore preview and Windows
2022 a stale RU move rejection. The Add driver now waits for actual empty UI and
enabled controls, then clicks once. Management language/Back uses the acknowledged
navigator. Subsequent rename drafts unconditionally require enabled review and
fresh proof, even if refreshed props might otherwise hide that guard.

Move completion can reauthor only an exact stale rejection with no status control,
unchanged public/physical source, absent target and no unfinished project journal.
It opens a fresh form within15s; unknown/accepted commands are never replayed.
Archive completion requires the same physical/journal no-effect proof and idle UI
before fresh review. An unknown archive outcome uses only Check saved outcome,
then requires completion; Apply is never replayed for unknown work. Both helpers
retain bounded4-draft/15s limits. The English idle Cancel label is taken from
production localization in the native control. No application source changed.

Local10 controls, original role/management journeys,70 routing checks and lint
pass. Independent reviews cover the cumulative guards and the localization repair.
The affected-consumer gate renews both drivers in DEV/package on all3hosts; the
remaining runtime tail is still Windows retained recovery/outage only.


Gate40203516042 at2d90918b passes macOS all affected consumers and role DEV
on both Windows hosts. Both Windows management journeys then stop at the first
stable-ID removal entry after restart, before confirmation; screenshots alone do
not distinguish missing locator, pending form or session state. Do not infer a
product cause or replay broad acceptance. `checks: folder-management-diagnostic`
runs only original management DEV on Windows latest/2022 with passive opt-in
DOM row/form/status snapshots and bounded post-failure public workspace/session
reads. Each read has1s and records unavailable without replacing the original
failure. Reports are diagnosticOnly and cannot establish acceptance. No observer
or CPU change is installed in ordinary routes. A local6x CPU probe passed without
reproducing the failure; it does not establish cause or ordinary acceptance.


Diagnostic40204450670 at a0c6aa2b passes both Windows original consumers
with the pre-removal DOM snapshot. These marked receipts establish no acceptance
or historical cause. The comparison now changes only observation timing:
folder-management-diagnostic uses mode failure, omitting all pre-removal reads
and collecting bounded DOM/public state only after the original failure. Ordinary
execution also awaits no diagnostic helper when the flag is absent. A success
under observation does not clear the earlier ordinary failures.


Failure-only diagnostic40204774239 at93d6e436 also passes both Windows
management consumers, with no pre-removal observation. These remain diagnostic
receipts, not acceptance. Compare the remaining environment difference before
inferring observation sensitivity: the diagnostic originally ran management
immediately after build, whereas the failed acceptance ran entry controls and
role DEV first. The diagnostic now retains that exact bounded prefix (10 controls,
role DEV, original management) on both Windows hosts. Failure-only reads and all
original deadlines/assertions remain. No full inventory or packages are selected;
all diagnostic results retain their status and cannot waive ordinary acceptance.


Prefix diagnostic40205201537 at c98a3e1c passes Windows2022 through original
management, while Windows latest stops earlier at role rename input disabled by
a fresh observation after enabled readiness. Management cause remains unestablished.
The matching focused control invalidates both input and Submit during input focus,
as production does; a fresh review is required before1 submit/1 effect. Rename
per-gesture waits are now bounded to1s within its unchanged15s total, and advance
only through the explicit enabled no-unresolved review guard with unconditional
fresh proof for each later draft. Unknown/stalled/repeated-rejection checks remain.
Local control, original role journey,71 routing checks and lint pass. Renew ordinary
affected-consumer acceptance on the reviewed repair; diagnostic successes are not
substituted for original consumers and historical failures remain recorded.


Ordinary gate40205926705 at c9e068a3 passes all10 controls on3hosts,
role DEV/package on3hosts and management DEV on3hosts plus management package
on macOS/Windows latest. Only Windows2022 management package fails at first
removal entry (10 groups passed, no confirmation reached). Eleven of12 driver
rows pass; all3 package/artifact prerequisites pass. The successful rows retain
exact c9e068a3 provenance and inspected cleanup; the failed row stays unresolved.

Use folder-management-package-diagnostic for the exact remaining Windows2022
packaged role-prefix/management sequence, with failure-only diagnostics. Its
prepared ordinary counterpart folder-management-package uses the same commands
and empty diagnostic flag, and requires its own passing receipt after diagnostic
inspection. No other host/full suite/DEV consumers are selected. Both use the
existing package and artifact prerequisites. All ordinary management failures now
collect bounded read-only DOM/public/session failureState after the error; no
happy-path observation/action is added and the original failure remains primary.


Ordinary Windows2022 package renewal40207318581 atbae3e96a stopped in the
role prefix, before management. Its failure capture proves archive completion
and Done were already present: the helper had left its first1s wait, then waited
for an obsolete Cancel. This is a reproduced acknowledgment defect, not an unknown
filesystem result. Post-submit observation now races completed, enabled read-only
status and enabled idle Cancel under the original15s total. Late completion is
accepted without new Apply. The real Electron1300ms control verifies1Apply,
0status,1effect; stale/unknown proof controls remain. Local role, routing and lint pass.

The role-entry gate now renews only the affected role DEV/package journey and
10 controls on all3hosts. Management is excluded from this gate: navigation and
management happy-path inputs are unchanged by the archive helper repair, so the
11passing c9 driver rows retain their evidence as applicable; all6 role rows are
renewed, and Windows2022 management package still requires its dedicated ordinary
route after role success. No diagnostic result supplies acceptance.


Role gate40207912871 at1ea7fe8b passes macOS/Windows2022 DEV/package and
Windows latest DEV; Windows latest package stops waiting for configuration review
before any Apply. Preview entry now acknowledges the actual review within15s,
repeating only read-only Review changes when its prior response/gesture was lost.
Affected-workspace checks, unchecked shared-impact acknowledgment and one explicit
Apply remain unchanged. The real Electron control discards its first preview and
requires2 reads/0 applies/unchecked acknowledgment. Local role journey,71 routing,
lint and both reviews pass. The role-only gate now selects11 controls and all6
role host/mode consumers; unrelated management rows are not replayed.


Role40208488377 at3999232c passes Mac/Windows2022 both modes and Winlatest
DEV. Winlatest package's remaining failure is archive-location preview: the one
read-only Review archive folder gesture did not expose Confirm. The matching
helper now waits for enabled confirmation, repeating only the preview read within
15s. Caller confirmation remains single, followed by the existing Stored API
assertion. Native control uses production localization and verifies2 preview
reads/0 premature confirms/1 separate confirmation. Local native/routing/lint and
both review axes pass. Renew the role-only12control/6consumer gate; accepted
management rows remain separately reused and Win22package management remains open.


Role40209213750 at da181321 passes Mac/Windows2022 both modes; Winlatest
DEV reaches stale move preparation while selectOption waits on a disabled select
before any Submit. Its bounded selection attempt now yields to the exact stale
UI and fresh no-status/public/physical/journal proof, with at most4 verified
preparations in the unchanged15s total. A form is returned only after successful
selection, exact current parent value, no stale message and enabled Submit.
The strengthened real Electron control leaves Submit enabled while the requested
option is unavailable; it still requires proof/reopen and2forms/0commands with
the correct parent. Local original role/control/lint and both reviews pass.
Only the role host/mode gate is renewed; management and recovery/outage ledgers
remain unchanged. No application/build inputs changed or deadlines increased.


Ordinary40210892301 atc94cd9c2 stopped in the role package prefix before
management: RU creation returned the exact source/category unavailable-or-changed
rejection with no unknown status. Creation now follows the same guarded current-draft
flow: ready public Group parent, target absent in public records/on disk, no
unfinished creation journal, exact name/parent before Submit, and fresh proof before
any rejected-request reopening. Unknown/recoverable outcomes cannot allocate a
new request. Four drafts and1s gesture handling share the unchanged15s total.
Controls verify rejected2attempts/1effect, unknown1attempt/0effect/0reopen, and
pre-Submit invalidation1attempt/1effect after a fresh form. Local role/control,
71 routing/lint and both review axes pass. Renew only the role13-control/6consumer
gate; management's Win22package row and Windows recovery/outage tail remain open.


## Retained settings navigation renewal

Runtime40213146706/attempt1 atcbeb1e3b passes all four Windows2022 recovery
and source-outage DEV/package rows. Its Windows latest retained DEV consumer
passes six groups/48 captures, then waits on hidden interface-language while the
project remains visible and Settings has focus. Three normal shutdowns and cleanup
pass. The original pointer navigator neither acknowledges settings entry nor selected
General; the existing real Electron interruption control reproduces that gap.

Reuse the existing acknowledged role settings/language/Back navigator in the retained
consumer. Its only helper addition is the Backup label; existing role/management
paths are unchanged. A native control consumes entry/tab keys and verifies exactly
one language change, return and selected Backup. It fails before the additive label
and passes afterward. Original seven journeys/64 captures and all data/identity,
review, focus, containment, restart, bytes and cleanup assertions remain unchanged.

The recovery-repair selector now renews the changed consumer in DEV/package on all
three hosts, with editor/settings controls and package/artifact prerequisites.
Only Windows latest adds its still-missing source-outage DEV/package pair; the
unchanged Windows2022 pair retains40213146706 provenance. No full/role/management
consumer is selected. Application/build inputs remain identical to9ee8c787.
The failed overall run remains failed; original Windows latest acceptance is open
until this focused renewal succeeds and its artifacts are inspected.


## Issue 75 native entry repair

At e1551eca, runtime40218363946 passes346/346 affected public/controller checks
on all3hosts. macOS DEV stops at initial role Apply with stale_preview: the
fixture populated an already-observed empty source. Windows latest DEV passes
EN Table, then its EN Board editor shows the exact stale-source rejection before
movement; source files remain at Clients/Active/App. The driver incorrectly waited
only for the target path rather than entering the already-supported fresh-draft flow.

`status-moves-entry-repair` runs build/static prerequisites and the original
DEV status command only on those two failed hosts. Fixture directories now precede
connection; an unconfigured source has no observation reference until its single
reviewed grouped-role Apply. Authored Status/Notes labels are fixture content and
remain unchanged in RU. The unchanged approved prepareRoleMove/completeRoleMove
helpers select the status UUID and allow another draft only with current active
membership, original bytes/path/category, absent target and no unfinished journal.
Unknown outcomes cannot be reopened/replayed. Four drafts share the unchanged15s
outer deadline; no filesystem mutation is introduced into the driver.

After focused success and artifact inspection, status-moves-native-renewal runs
the complete affected DEV/package native/retained consumers on all3hosts. It skips
the already-passing346 public checks and raw full suite because this is a fixture/
driver/route-only repair. Existing full/runtime routes and all supported-platform
assertions stay available. The new phases have separate concurrency suffixes.


Entry run40220050595 atad8a5018 passes the original DEV command on macOS and
Windows latest. Both inspected reports have4behavior groups,16captures, restart,
2normal quits with backend exit and owned cleanup. Runtime40218363946 at e155
also succeeds completely on Windows2022; its retained role DEV/package and ordinary
assignment receipts are inspected. Native renewal therefore skips accepted status
DEV on Mac/Windows latest and accepted retained/ordinary rows on Windows2022.
It renews status DEV on Windows2022, status package/artifact prerequisites on all
three hosts, and the missing retained/ordinary/role-package rows on Mac/Windows
latest. Full/runtime defaults still run their original inventory. Evaluated routing
checks assert per-host command counts;74/74 pass locally and independently.
