# Issue 52: grouped Table and contextual columns

Issue: [#52](https://github.com/kornouhovas/workspace/issues/52); baseline `d931bf32`.
Branch: `codex/issue-52-grouped-table`. Scope/retention mapping:
[implementation plan](../plans/issue-52-grouped-table.md).

## Accepted candidate

Tested SHA: `ce18c264684734cd23d04d58d083e02324250a52`. All runs below are
attempt 1; their logs and required artifacts were inspected. The final handoff
changes documentation only and reuses these unchanged runtime/build/test inputs.
Delivery is recorded in the [GitHub checkpoint](https://github.com/kornouhovas/workspace/issues/52#issuecomment-6300181694).

| Acceptance | Observed result |
| --- | --- |
| [Full Desktop matrix](https://github.com/kornouhovas/workspace/actions/runs/39483128565) | Common 494/494; macOS 2,687 passed / 26 platform skips; each Windows host 2,719 passed / 13 platform skips; zero failures. All development/packaged/native/layout/artifact steps passed. |
| [Strict performance](https://github.com/kornouhovas/workspace/actions/runs/39482340125) | Both hosts: 32 timings, ten memory samples, four normal quits/backend exits and cleanup passed. |
| [macOS DMG](https://github.com/kornouhovas/workspace/actions/runs/39483135137) | macOS 14.8.9 arm64 installation, reopen and replacement/data preservation passed. |
| [Windows NSIS](https://github.com/kornouhovas/workspace/actions/runs/39483534204) | Windows Server 2025 x64 installation, reopen/reinstall/APPDATA preservation, uninstall and cleanup passed. |
| Final Standards / Spec audits | Zero actionable findings on each axis for `d931bf32...ce18c264`. |

Cold first popover presentation on the macOS runner was separately recorded at
680.6 ms; the grouping choice after presentation was 207.9 ms. Do not interpret
these as sub-300ms cold opening. Windows Server evidence does not establish a
Windows 11 human desktop check. No stable release or installer download is
published. Earlier failed and pending receipts below are chronological history,
not the current acceptance state.

## Behavior and boundaries

Table grouping and presentation open in Radix popovers. Column headers expose
compact contextual actions with full accessible authored names. Whole-Table controls
restore hidden columns; Name remains visible. Existing typed values/editors, exact
scalar/Select/category/MultiSelect grouping, ordering/hide/collapse/hide-empty,
manual row order, width/wrapping, independent view/workspace settings and recovery
routes remain on their existing typed service contracts. No schema migration or
additional dependency/upstream source import. Later bounded observation and
discovery performance repairs, diagnostics and evidence are recorded below.

Escape dismisses the active popover and restores the trigger. Hiding a column
from its header falls back to the whole-Table trigger when that header disappears.
Pending/failed writes retain committed settings, disabled controls and explicit
feedback/retry/reset. Contextual grouping restores usable focus after pending saves.

## Review and observed local evidence

Host: macOS 27 arm64, Node 22.21.1. Generated evidence is local under `/tmp/issue52-*`.

- TDD: contextual Table entry was red before the popover implementation; header
  settings/hide/focus were red before header integration. Renderer checks passed
  23/23 (including rejected header-width save/retry); affected retained service/UI/native regressions passed 64/64.
- Typecheck, ESLint, application and Ladle builds, documentation links and
  whitespace checks passed. Fresh arm64 directory packaging and
  `check:artifact` resources/notices/version checks passed.
- Independent Matt Pocock Standards and Spec reviews, including the driver delta,
  reported zero actionable findings, including compact header actions, local
  rejected-save feedback and the inherited category-header assertion adaptation.
- Development views journey passed all six checks, three ready startups, three
  normal quits/backend exits and owned cleanup. It includes exact grouping,
  MultiSelect/category/recovery, values, filters, Table/Board layout, assignment,
  metadata removal, restart and isolation. The final application build renewed
  this journey successfully with the same six checks and all three normal quits.
- Desktop shell passed its existing journey plus Table/column/group popovers in
  EN/RU, light/dark and 1024x720/1440x960. Inspected screenshots exposed duplicate
  long names in header triggers; compact triggers retain full accessible labels.
  Final compact-trigger shell renewal also passed; inspected the final
  EN/RU light/dark screenshots and popup bounds at both required sizes.

The first development views run failed its native Table drag order assertion.
The focused real Table reproduction failed at the same assertion. Preparing both
endpoints through existing `dragRuntimeGroup` before mouse-down passed the same
native gesture/result assertion; no synthetic mutation, retry or changed deadline.
The existing native scroll/drag regression covers this helper. New popup inspection
also prepares the visible anchor and observes final Radix bounds before asserting;
Escape uses one page keyboard event without refocusing a disappearing panel.

## Outstanding acceptance

The first broad suite (3,179 tests: 3,152 passed, 26 platform skips, one failure)
was started before the visual header refinement and is not final-candidate evidence.
Its single failure was an inherited raw category-header button count. The adapted
check requires both accessible actions and retains no-inline-editor, exclusions
and Text-draft assertions; its focused scenario passed. Final source review, typecheck, ESLint, build, links and whitespace checks pass.
Final-candidate `npm run test:all`: 3,180 tests, 3,153 passed, 26 platform skips,
one failure in the unchanged minimal property-editor Electron fixture's normal
shutdown after the Single Select interaction passed. It emitted before-quit,
will-quit, quit and node-exit; the parent required forced cleanup after 10 seconds.
The isolated unchanged file passed 9/13, with four different normal-close failures;
the original failing Single Select case passed. Both failed runs remain failed.

`git diff d931bf32` is empty for this fixture/driver, runtime lifecycle helper,
Electron/Playwright dependency manifests and lockfile. The fixture loads only
minimal data-URL HTML, not application source. [Issue 51's baseline report](issue-51-contextual-views.md)
records the same local macOS 27 pattern on unchanged `53a87519`, including matching
native inputs. This establishes inherited reproduction, not a unique native cause
or an application repair. No deadline or normal-quit requirement is weakened.
Supported-host CI, packaged runtime/installer and strict representative-scale
evidence remain gates. No integration, issue closure
or release is claimed by this local report. GitHub owns current acceptance status.

The owner explicitly authorized publication to the current public repository for
#52. Preserve actual run/attempt/SHA evidence and earlier failures in its checkpoint;
apply shared CI evidence reuse only to demonstrated unchanged inputs.

## First published candidate and diagnosis

Candidate `350293cc`, attempt 1: installer run `39453035604` passed macOS 14 arm64
and Windows/latest x64. Both downloaded reports match the SHA, verify installation,
reopen/reinstall/replacement preserving data, EN/RU/isolation and cleanup. The
Windows host is Server 2025 Datacenter, not Windows 11. Local final packaged views
also passed six checks, three normal quits/backend exits and cleanup.

Full desktop `39453035549`: Common/static and macOS/latest passed. Windows/latest's
isolated original category fixture failed its cleanup control before the intended
injection: `grouped.restart` / `stop_owned_timeout_stopped`, one utility started
and exited, normal supervisor handshake, owned shutdown confirmed. Later scenarios
were unreached; exit 1 correctly failed its expected exit 0. The original 2,692-test
remaining platform batch and 13 property-driver controls passed. The observed
failure is not an established UI/backend regression or a repaired lifecycle cause.
Windows/2022 also passed the full job. Windows/latest still-missing runtime receipts remain in the GitHub checkpoint.

Strict performance `39453041704`: macOS 14 `350293cc` completed all 32 functional
measurements, memory/startup/scan gates, four normal quits/backend exits and cleanup.
It failed direct Table grouping 585.8 ms and grouped Table assignment 329.6 ms against
300 ms. Its failure remains failed. Windows results are recorded below. The immutable
`d925f8b7` baseline also missed targets; that does not waive candidate limits.

A separate local profile reproduced first direct grouping 541.9 ms and later grouped
grouping 74.3 ms. The marked slow interval contained about 478.8 ms idle, 22.6 ms program
and 1.6 ms GC, with no >9 ms JS task. This does not support a local React/Radix CPU
bottleneck or prove the hosted cause. Subsequent diagnostic request timings were
fast but did not reproduce the slow interval. A reduced 20-project probe did not
retain the delay; it is not performance acceptance. No application optimization
or native cause is claimed from these observations.

Diagnostic-only renewal adds bounded main IPC timing/window-state observations to
`--profile-filters`; two red-to-green probe tests preserve original replies,
errors, single invocation and bounded/no-payload output. The original strict
command is unchanged. The category assertion now prints existing sanitized
first-failure evidence; no deadline/outcome is weakened. The existing runtime
continuation can narrow to Windows latest after its fixture gate passes.
See [the focused route policy](../ci.md#issue-52-failed-host-renewal).

Windows strict `39453041704`, attempt 1, `350293cc`, AMD EPYC 7763: only 22 measurements
completed. Eight interactions exceeded 300 ms (direct Table assignment 472.0/edit 327.3,
direct Board assignment 301.4/edit 397.4, grouped Table filters 396.5/360.5,
grouping 344.2/assignment 328.4). It then timed out after 30 seconds while expecting
the full projection after Table grouping/search reset. All collected startup/scan/
memory checks and three actual normal quits/backend exits/cleanup passed; remaining
cases are unreached, not passing.

The reset call site pressed Save without waiting for its enabled state after the
preceding grouping command. A real-Electron delayed-enable regression failed with
zero submits/filtered rows before repair and passed with exactly one submit/full
rows after preparing the enabled control. The production app is unchanged; the
unmeasured reset now prepares focus/enabled state before one Enter. Original
measurements, limits and full ordered membership/readiness predicates remain.
This demonstrates the driver race, not historical hosted causation. Timeout
inspection is readonly and bounded to counts/state flags without authored data.
Both diagnostic and original strict commands require renewed failed-host receipts.

Diagnostic repair verification: native readiness/probe/reset controls 10/10; CI route
contracts 50/50; typecheck, lint, documentation and whitespace checks passed. Both
independent Standards and Spec reviews reported zero findings. This delta changes
only tests, drivers, CI and documentation; application/build inputs remain at
`350293cc`. Retain its passing receipts and renew affected failed consumers.

## First focused renewal

`c09a0505`, attempt 1: Windows category fixture run `39458142256` passed 51/51;
its inspected cleanup control reached every intended service scenario, all four
utilities exited, exit 0/normal handshake was retained and only the intended final
cleanup injection failed. Missing Windows runtime continues at `39458910748`.

Performance `39458140472` remains failed: macOS strict completed all 32 scenarios,
but direct/grouped Table assignment was 337.0/316.3 ms (limit 300). Windows strict
also completed all 32, including reset/full projection. Eight samples missed limits:
direct Table assignment/edit 346.8/306.4, Board grouping 345.7; grouped Table filters
353.2/321.1, assignment 407.4, Board grouping 363.7, refresh 5033.1 (scan limit 5000).
Windows native controls failed eight normal shutdowns; their functional assertions
do not establish lifecycle acceptance. Two pure diagnostic controls passed.

The macOS separate profile reproduced grouping 498.8 ms with a focused/visible
window; corresponding set/query IPC was 4.3/52.4 ms, with about 336.8 ms renderer
idle in the first 500 ms. A long frame gap is observed, not a proven native cause.
Further bounded quit diagnostics and a controls-only route separate the Windows
fixture failure from strict performance; no application/build inputs changed.

Isolated Windows native controls `39460699645`, attempt 1 at `87e63246`, passed
10/10 with original normal close unchanged. The earlier native-close failures
remain recorded; no unique cause or lifecycle repair is claimed. A real local
1000-project locator comparison found about 4–6 ms for the assignment heading,
so broad/scoped locator work did not reproduce hosted assignment delay.
The next diagnostic-only request observations cover each remaining operation,
not only grouping, with a red/green one-invocation/no-authored-data control.

## Assignment snapshot follow-up (application change)

Both `80d6a202` diagnostic-only profiles at run `39461540010`, attempt 1,
completed. Their green job result is diagnostic completion, not strict acceptance.
Per-operation IPC showed two complete property reads after each assignment on
both hosts (roughly 13–47 ms each), after a reply already carrying that snapshot.
The Windows profile's direct startup was 20.7 seconds; its interactions passed.
The macOS profile still observed direct grouping 503.4 ms and grouped assignment
319.8 ms. Profiles do not establish the complete historical delay cause.

At the existing renderer/real-service seam, a delayed property-read regression
failed because a complete accepted mutation reply still left controls disabled.
The repair defers property-event observation during an assignment, keeps the
minimum revision, accepts only the existing ownership/revision-checked complete
snapshot and avoids the redundant read for ordinary metadata success. Stale,
lost/rejected and filesystem outcomes retain fallback observation without replay.
Actual group projection refresh and focus sequencing remain intact. A newer
property change during assignment supersedes its older reply through fallback.

Assignment UI scenarios passed 37/37 (EN/RU, Table/Board, scalar/MultiSelect,
filesystem/recovery, lost/rejected replies, focus, filters and newer revision).
Typecheck/lint/docs, application build and both independent reviews passed.
The earlier native controls and route contracts passed 11/11 and 50/50.
Full local suite `/tmp/issue52-refresh-full.log`: 3187 tests, 3160 passed,
26 skipped, one failed obsolete literal Windows continuation matrix assertion.
All application/native cases passed. Adapt that assertion to evaluate the default
host expression while retaining every original command parity assertion; focused
renewal covers that bounded test-only repair without repeating unchanged passing
application cases. The actual full run remains recorded as failed.
All required platform/package/installer/performance acceptance must be renewed;
previous unchanged-application receipts remain historical, not final acceptance
for this source change. GitHub owns actual candidate SHA/run status.

Focused continuation/test-suite contracts passed 73/73 after the literal-matrix
adaptation; both independent incremental reviews found no remaining findings.
The original complete run and its sole static failure are preserved above.

## Remaining Windows performance gate

At exact clean `30b502b4`, run `39463627765` attempt 1, macOS 14 strict passed all
32 measurements, memory/startup/scan, four normal quits/backend exits and cleanup;
Table assignment was 237.9/231.4 ms direct/grouped. Native controls passed 11/11.
The separate profile confirmed both redundant property reads were absent.

Windows strict completed all 32 functional cases but failed direct Table filter
539.8, assignment 457.2, edit 303.8; grouped Table filters 425.7/319.2, assignment
373.6, edit 304.5, Board grouping 364.8 ms (300 ms limit). Its separate profile
observed assignment IPC 268.8 ms and filter save 126.2 ms without redundant reads.
These failures remain failed. An optional disposable-copy backend timing probe
will separate actual service execution from IPC queue/delivery time. It preserves
normal service results/errors and records no authored data; copied backend hashes
and normal-close batch counts distinguish this diagnostic artifact. The accepted
macOS strict package remains unmodified; new strict acceptance is not inferred
from modified-copy diagnostics.

Backend probe controls passed 53/53 (service reply/error/one-call preservation,
archive-copy isolation, real child execution/parseable output, bounded histories,
normal-close batch accounting and CI routes). The real local disposable package
completed all 32 diagnostic scenarios, four normal quits/backend exits and cleanup;
its four batches contained 178 requests and passed the batch inspector. Local
assignment service time was about 24–27 ms; the Windows failure is not reproduced
by those local values. Its startup miss remains diagnostic. Both independent
reviews found no remaining findings; lint/docs/whitespace passed. Application and
original package inputs remain unchanged from `30b502b4`.

## Validated displayed-projection driver repair

Windows diagnostic run `39466360777`, attempt 1 at `80a9640f`, completed all
32 scenarios, four normal quits/backend exits, cleanup and four batches/178
requests. Its grouped Board assignment was 380.5 ms: main IPC 193.8 ms,
143 ms before backend execution, 41.9 ms service execution and about 8 ms return.
The preceding unmeasured ordinary query spent 1797 ms walking the source. This
sample identifies queue delay, not a unique cause for every historical miss.

Metadata-only correctness reads now use the existing complete, revision-validated
public displayed projection. All actual IDs, groups, values and order assertions
remain; the service validates ownership/membership and reads current metadata.
Initial full discovery, packaged startup, external rename/refresh and reopen keep
the original filesystem path. The explicit filesystem phase removes the hint
before any external change; stale projections fail without fallback or retries.
Public adapter and real-service parity/revision controls passed 13/13. Both
independent incremental reviews found zero findings; lint/docs/whitespace passed.

Local diagnostic `/tmp/issue52-displayed-query-local` completed all 32 scenarios,
four normal quits/backend exits, cleanup and four batches/178 requests. Its
interaction samples were below 300 ms, but diagnostic startup and memory misses
remain non-acceptance evidence. Neither local timings nor a modified diagnostic
package establishes hosted strict acceptance. Application/build inputs remain
unchanged from `30b502b4`; this shared preparation change requires renewed strict
performance and readiness consumers on both hosts, followed by full application
platform/package/installer acceptance for the earlier application repair.

## Displayed-projection renewal and remaining queue

Run `39468948293`, attempt 1 at clean `80d4fc82`: macOS strict passed all 32
measurements, memory, four normal quits/backend exits and cleanup. Windows strict
completed the same functional/lifecycle cases with memory passing, but missed
seven limits: direct Table filter 335.3, assignment 354.0, edit 410.6, Board edit
312.6; grouped Table assignment 331.7, edit 363.0 ms; grouped refresh 5149.0 ms.
The separate Windows profile still observed the first filter at 437.7 ms, including
253 ms before backend execution and 32.8 ms execution. Its grouped Table assignment
was 333.1 ms with IPC 102.5 ms; the readiness observer began at 281.2 ms after
serial locator waits. Removing full-scan correctness reads did not resolve all
misses. Original failures remain failed; no unchanged strict retry is selected.

Ranked remaining questions: internal background source work queues a request;
renderer work delays the ready projection; serial driver endpoint polling delays
observation. The next diagnostic copy times only four fixed internal functions
(reconciliation, direct/grouped scans, workspace load), with
one-call/result/error/receiver preservation, bounded payload-free shared history
and normal-close flush. Original application and strict package are unchanged.

The first local phase-instrumented copy failed startup because a nested function
was injected at module scope. Both reviews identified the error. Remove that phase,
require module-level declarations and add actual bundled-entry execution coverage.
The repaired five probe controls passed, including copied child execution and
real bundled scope. The repaired local diagnostic completed all 32 scenarios,
four normal quits/backend exits/cleanup and four batches (113/13/113/13 records),
without reaching the 256 bound. Diagnostic startup remains above target. Both
independent re-reviews found zero findings; lint/docs/whitespace passed. This
changes only the diagnostic copy and its controls; no strict retry is selected.

## Observe the actual endpoint before serial driver delivery

A controlled native regression failed when projection readiness could finish before
its required saved heading/destination membership. Extend that same predicate with
operation-specific DOM endpoints and start it immediately after the measured event,
before the retained serial locator waits. Grouping requires groups; assignment
requires the exact saved heading and destination/project; editing requires the
actual saved visible button text; external Refresh requires the renamed row text.
Global busy, complete ordered membership, all visible editors, both readiness checks
and the original four paint frames remain. Every original locator and subsequent
service/filesystem assertion still executes. Targets, deadlines, actions and event
start clocks are unchanged; later host observation cannot move captured paint.
The regression passed with delayed result commitment plus 300 ms driver delivery;
all 12 native readiness controls passed. Both independent reviews found zero
findings, including immutable-baseline/current markup compatibility. Lint and
whitespace passed. This shared driver/helper change requires both strict hosts
and readiness consumers to renew; it does not repair the separate backend queue.

The real local endpoint-driver diagnostic completed 32 scenarios, four normal
quits/backend exits/cleanup and four batches/252 phase/request records. Interaction
samples were below target, while direct diagnostic startup was 5601.3 ms; this is
not strict or hosted acceptance. Lint/docs/whitespace passed on the final delta.

## First-use compact trigger candidate

The actual endpoint-driver diagnostic run `39472649575`, attempt 1 at `0fce55b0`,
retained macOS first Table grouping at 847.4 ms: grouping IPC 2.1 ms, projection
44.4 ms, observation 37.4 ms, first stabilized paint 594.9 ms, final 847.4 ms.
The focused/visible window had roughly 180 ms in two React work tasks and long
frame gaps; backend phases do not establish a service cause for this sample.
Windows completed all 32 diagnostic scenarios and normal quits/backend exits and
cleanup, but the required diagnostic close-batch inspector failed (three batches,
missing the grouped interaction backend). This remains failed diagnostic evidence;
its main IPC observations cannot supply missing backend execution timings.

A production-mode native probe of actual closed Table column controls measured
63 repeated triggers at 5.2 ms commit; deferring only compact Radix roots until
first activation measured 1.1 ms. The small isolated probe does not establish the
hosted cause. Keep an activated root mounted so subsequent open/close, Escape,
outside dismissal and removed-header fallback retain the existing Radix behavior.
Noncompact Table/grouping popovers are unchanged. Table/grouping UI scenarios pass
23/23, including EN/RU first Enter, Escape focus return, Space reopen, removed-header
fallback and first pointer width-rejection/retry. Both independent reviews found
zero findings. Fresh build, directory package/artifact, typecheck/lint and the
28-check/eight-variant native shell journey passed with owned cleanup. Inspected
RU dark 1024 column popup retains bounds and long content. This application change
requires actual hosted performance proof and renewed full application/platform/
installer acceptance; no complete target pass is claimed from the local probe.

The hosted first-use candidate `2564a02b`, diagnostic run `39474553368`, attempt 1,
completed all 32 scenarios, four normal quits/backend exits/cleanup and four
batches/252 records, but first Table grouping remained 709.0 ms (mutation IPC
11.0 ms, projection 71.2 ms, first stabilized paint 492.4 ms, final 709.0 ms).
Deferring compact roots did not resolve the measured symptom. No strict acceptance
is inferred from its green diagnostic-completion job.

A separate scheduling diagnostic records native original/current throttling and
renderer visibility/focus. Explicit `--profile-unthrottled` requires renderer
profiling, which rejects `--enforce`; original/default routes never set the native
property. This will test long frame gaps, not approve altered-scheduling targets.
Native controls passed 13/13, including actual property/default-state preservation;
the additional isolated native/CLI controls passed 2/2 and reject invalid modes
before creating evidence/fixtures. The route suite first failed its old exact guard
expression after adding the opt-in; adapt it while retaining original strict,
readiness, package and platform assertions. Final route controls passed 50/50.
Both independent diagnostic reviews found zero findings. The discovery-index
application repair remains a separate local candidate; it is not part of this
scheduling-diagnostic comparison's published application inputs.

## Indexed interpretation candidate and explicit readiness observations

Altered-scheduling diagnostic `39475640079`, attempt 1 at `f58f415a`, completed
32 scenarios, four normal quits/backend exits/cleanup and four batches/252 records.
Every owned window recorded original throttling true and diagnostic throttling
false; the page was visible/focused. First Table grouping still missed at 421.3 ms
(mutation IPC 2.5, projection 20.4; first stabilized paint 365.1, final 421.3 ms),
with final direct/grouped diagnostic memory misses. This is not a scheduling repair
or acceptance. Restore the original compact popover source from `0fce55b0`; keep
its additional EN/RU Enter/Escape/focus/Space coverage.

Actual retained backend interpretation now indexes first path matches and complete
dev/ino candidate buckets rather than scanning every record for every child.
Original record order, mutable retained copies, every alias, birth evidence,
continuously matching historical exceptions and reservations remain. No scanner,
filesystem authorization, reconciliation write or storage contract changes.
The isolated 1000-record loop observed median 46.5 to 4.9 ms; its 44 ms candidate
outlier is retained. Five hundred seeded mixed-history/alias/exclusion/reservation
comparisons matched `2564a02b` exactly. Four new domain cases preserve complete
ordering/input immutability, historical shadowing/recovery exceptions, ambiguous
birth aliases, missing-path non-reattachment and reservations. Rebuilt real-service,
worker and native filesystem regressions passed 326/326; Table/grouping/assignment
UI cases passed 60/60 after restoring the original popover. Both reviews found
zero findings, including incremental restoration and observation changes.

Fresh package/artifact verification passed. Real local indexed-package diagnostic
`/tmp/issue52-indexed-local` completed all 32 cases, four normal quits/backend exits,
cleanup and four batches/252 records; original backend hash was
`859627690b0a7b9023f2cb1463861e44586f6b95f38c5392f6ab5b23e6a16106`.
These local diagnostic results do not establish hosted strict acceptance.
Trace-only readiness history records at most 64 timestamps, projection/endpoint
booleans and pending counts to distinguish waiting for DOM from waiting for the
original four paint frames. Strict short-circuiting, readiness, deadline and frame
pairs remain unchanged; no history is allocated for strict execution. All 14 native
readiness/guard controls passed after the new observations.

The reviewed indexed application candidate's complete local `npm run test:all`
passed: 3203 tests, 3177 passed, 26 platform skips, zero failures (130.3 seconds;
`/tmp/issue52-indexed-full.log`). The existing fresh build/package was unchanged.
Earlier failed full runs remain recorded separately; this is an actual later full
pass, not relabeling their results. Hosted platform/installer and original strict
performance acceptance still require renewed evidence for this application change.

## Value-edit observation repair

Normal-scheduling indexed diagnostic `39477194538`, attempt 1 at `4c5bc681`,
completed 32 functional scenarios, four normal quits/backend exits/cleanup and
four complete backend batches on each host (252 macOS / 253 Windows records).
This diagnostic completion is not strict acceptance. macOS first Table grouping
was 527.3 ms; mutation IPC was 3.4 ms and projection 27.8 ms, with first observed
ready DOM at 355.8 ms and final paint at 527.3 ms. Windows missed direct Table
filter (360.2), assignment (313.1), edit (362.3), grouped Table edit (321.1) and
external refresh (5265.6 ms). First filter backend queue was 171 ms; indexed
interpretation reduced the prior measured queue but did not resolve every miss.

Windows edit profiling also observed an unnecessary property request alongside
layout/grouping refresh and projection. The value-edit path now defers property
observation while value mutations are pending, accepts only correctly owned,
current complete reply snapshots, and reads actual values after stale, rejected,
mismatched or lost replies. Overlapping commands are counted; no mutation is
replayed. Existing assignment behavior and all strict timing predicates, frame
pairs, scenarios and budgets are unchanged.

The public renderer/real-service regression first failed with one duplicate
property request, then passed with zero duplicates for an accepted reply. Newer
revision and lost-after-commit cases verify actual displayed values, fallback
reads, one mutation and restored focus. Focused typed editor/assignment tests
passed 48/48. Both independent Standards and Spec reviews found zero actionable
findings; typecheck, lint and fresh package/artifact validation passed. Complete
local and hosted acceptance results are recorded when observed below.

The new application inputs' full local run `/tmp/issue52-value-full.log` ran
3206 tests: 3178 passed, 26 platform skips, two failures. Preserve both failures:
(1) renderer-app's old own-event read resolver no longer existed after the
observation repair; (2) a Russian Single Select native creation fixture reached
JavaScript quit/page close but its parent exceeded the unchanged 10-second normal
shutdown deadline on local macOS 27. Forced cleanup passed; this is not a normal
quit receipt or proof of its cause.

Adapt the first fixture to the accepted complete-response guarantee while retaining
own-event success, newer-change feedback, duplicate suppression, stale mutation
fallback and a genuine later-event/overtaken-list response race. No application or
build inputs changed during this fixture repair. Both independent reviews found
zero findings. Renewed renderer-app passed 104/104. The unchanged original native
property-editor-driver suite subsequently passed 13/13, including normal shutdown;
that later receipt does not erase or explain the earlier timeout. Reuse the other
unchanged-input full-run checks under the shared policy; hosted strict/platform/
installer acceptance remains pending.

Original strict candidate run `39480066531`, attempt 1 at `39e5b3c5`, passed
Windows latest: all 32 timings, ten memory samples, four normal quits/backend
exits and asserted cleanup. Table edit was 228.6 / 240.5 ms for direct/grouped;
grouped external refresh was 4724.5 ms. macOS completed all functional scenarios,
all ten memory samples, four normal quits/backend exits and cleanup, but failed
one timing: first direct Table grouping 561.8 ms (observation start 43.0,
first stabilized paint 519.2, final stabilization 42.6 ms). All other 31 timings
passed. Preserve the original miss; the run is failed overall.

Fresh development and packaged views journeys each passed six checks with three
normal quits/backend exits and fixture cleanup. Scheduling investigation reads
original `4c5bc681` CPU samples: the renderer was `(idle)` throughout about
145–340 ms after the first grouping event, while its recorded JS tasks were 15
and 39 ms. This bounds the evidence; it does not identify the scheduler cause.
Add toplevel/renderer scheduler/compositor/GPU/frame tracing only to the separate
diagnostic direct-Table grouping/assignment interval. Other profiles, strict/default
routes, application/build inputs, actions and acceptance predicates stay unchanged.
Native readiness controls passed 14/14 and CI route controls 50/50; lint/whitespace
and both independent reviews passed. Renew only the macOS diagnostic for this
new evidence; Windows strict receipt remains available for unchanged inputs.

## First-group GPU scheduling experiment

Expanded macOS diagnostic `39480983785`, attempt 1 at `290b9089`, completed its
32 cases; first Table grouping still missed at 453.8 ms. The newly included GPU
process records two `DawnPlatformImpl::RunWorkerTask` spans (154.9 and 164.3 ms)
at about 105 and 187 ms after the grouping event. Presentation then spends 72.8 ms
in `CALayerTreeCoordinator::ApplyBackpressure`. Renderer tasks were about 13,
20 and 29 ms; its CPU profile explains neither GPU work nor the prior idle gap.
This identifies observed GPU intervals, not a specific shader or causal CSS rule.
[Chromium's coordinator source](https://chromium.googlesource.com/chromium/src/+/HEAD/ui/accelerated_widget_mac/ca_layer_tree_coordinator.mm)
implements backpressure by waiting on the prior frame's fences.

Ranked comparisons: new rounded Table-group border geometry, repeated Table/header
geometry, then host GPU/frame scheduling independent of those styles. The first
single-variable source experiment uses square outer Table-group borders while
preserving Board styling, dimensions, padding, contents, interactions, popovers
and all measured operands. Reject this experiment if hosted GPU spans and latency
remain; local speed alone is insufficient. It is not an accepted performance fix.


Before publishing the radius experiment, correlate spans that STARTED before the
measured event: GPU raster/flush ran from -45.6 to +351.4 ms; three Dawn tasks
started at -42.4/-39.8/-39.3 ms and lasted 307.4/226.4/144.7 ms. The expensive
work therefore preceded group creation and overlaps initial popover rendering.
Reject and restore the unpublished radius experiment. Its 23 UI controls, fresh
package/artifact and native shell journey passed, but these do not establish a
performance effect. No experimental CSS is retained or published.

The current helper opens the popover then immediately permits selectOption;
DOM presence does not prove that its pixels reached the GPU output. Test explicit
popover visual readiness before the measured user choice. Retain start at the
same change event, original action, all result predicates and four-frame endpoint;
record preparatory screenshot latency separately rather than hiding it.

Native delayed-presentation control failed before the helper repair (DOM-visible
moving popover released before presentation). After observing stable panel pixels,
it passed with one open, zero preparatory grouping changes, unchanged initial
selection and one subsequent actual choice. Full native readiness suite passed
15/15, route controls 50/50; fresh unmodified-application package/artifact, lint and
both independent reviews passed. Opening duration is recorded separately in
`preparations`; no renderer/service/style application input changes are retained.
Renew both strict hosts and actual shared-helper runtime consumers.

## Presented-control acceptance candidate

Strict original run `39482340125`, attempt 1 at `ce18c264`, PASSED on both
macOS 14 arm64 and Windows latest x64: 32 timings, ten memory samples, four normal
quits/backend exits and asserted owned cleanup per host. Native controls passed
15/15 on each. Mac direct/grouped Table grouping was 207.9/125.0 ms. The separately
recorded first Table popover preparation took 680.6/232.6 ms on Mac and
135.7/132.7 ms on Windows. These records do not claim sub-300ms cold menu opening
or a production GPU repair; the measured choice starts with presented operands.

Application, dependency and build sources are unchanged from `39e5b3c5` through
`ce18c264`; later commits add only driver preparation, diagnostic tracing, tests
and evidence. The final Standards and Spec audits of `d931bf32...ce18c264`
reported zero actionable findings on each axis. No discarded CSS, lazy-root or altered scheduling
experiment is retained in application behavior.

Fresh local original `--enforce` performance passed 32 timings, ten memory samples,
four normal quits/backend exits and cleanup. Current shared-helper development and
packaged views journeys each passed six checks and three normal quits/backend
exits/cleanup. Shell renewed all 28 checks over EN/RU, light/dark and
1024x720/1440x960, including bounds/focus. Inspected narrow Russian dark grouping
and wide English light column popovers; no overflow or hidden actions were found.

Full Desktop `39483128565` and macOS installation `39483135137` are pending on
this exact acceptance SHA; Windows installation follows after macOS workflow
completion. These are remaining gates, not passing evidence.

Installer acceptance at `ce18c264`, attempt 1, is now inspected and passing:
macOS `39483135137` on 14.8.9 arm64 validated installed DMG resources, bundled
backend, EN/RU/isolation, saved identities/language after reopening and data
preservation after app replacement. Windows `39483534204` on Windows Server 2025
Datacenter x64 validated offline unsigned NSIS in a Unicode/space path, installed
backend/SQLite, EN/RU/normal quit/isolation, persisted identities/language,
same-candidate reinstall, independent normal APPDATA storage, uninstall and
asserted cleanup. These hosted Windows receipts do not establish a Windows 11
human desktop check. No installer binary download or stable release is published.


## Final broad acceptance

Full Desktop `39483128565` completed successfully at `ce18c264`, attempt 1.
Common tests passed 494/494 with lint, typecheck and documentation checks. macOS
platform tests: 2,713 total, 2,687 passed, 26 platform skips, zero failures.
Windows latest and Windows 2022 each: 2,732 total, 2,719 passed, 13 platform skips,
zero failures. All original build, Ladle/layout, artifact, creation/Reveal,
development and packaged runtime stages completed successfully.

Inspected current artifacts: shell 28, workspace management 11 and source settings
9 checks per platform; all stopped/cleanup receipts passed. Each host retained 16
passing typed dev/release runtime reports, normal quits/backend exits and asserted
cleanup, including six-check views journeys. General runtime, rename and category
observation reports passed. Creation crash matrices retained eight dev and eight
release scenarios per host; direct/grouped creation receipts retained cleanup.
Windows native bridge receipts had no active or unknown child. Earlier run failures
remain separately retained and are not relabeled as passing.

The final documentation-only handoff is checked with local Markdown links and
whitespace checks. All non-documentation inputs remain byte-identical to tested
`ce18c264`; runtime acceptance is reused under the shared evidence policy. The
owner-authorized integration proceeds only after verifying that `new-workspace`
is still clean at `d931bf32`; record the delivered SHA in GitHub after push.
