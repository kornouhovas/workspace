# Issue 76 verification

Issue: [#76](https://github.com/kornouhovas/workspace/issues/76).
Base: `676737a3`; branch: `codex/issue-76-special-archive`.
The [scenario ledger](../plans/issue-76-special-archive.md) defines acceptance.
GitHub checkpoints own candidate/run provenance and integration readiness.

## Implementation and retained guarantees

First-use contextual Archive offers a source-relative special location with
separate review/confirmation before project review. Cancel before confirmation
writes nothing. Stored explicit configuration is reused and remains available
in workspace settings. No name-based adoption, automatic migration or live-data
repair occurs. Current role-aware filesystem inspection also vetoes ordinary
statuses not yet enrolled by discovery, at preview and every Apply reinspection.

Existing journaled archive/restore owns identity, properties, original paths,
source containment, no-overwrite, interruption recovery and read-only unknown
status checks. No schema, native resource, dependency, isolation or installer
input changed. Tests retain those guarantees rather than retiring failed cases.
The old native assertion that Archive is disabled without configuration is
adapted to the accepted first-use action; its remaining contextual scenarios stay.

## Local evidence

Toolchain: Node 22.21.1, macOS arm64. Disposable SQLite and folder fixtures only.

- UI red/green: first-use EN/RU tests initially fail on the missing location field;
  current archive/contextual UI and workflow checks pass 38/38.
- Service red/green: empty/populated un-enrolled Archive statuses initially receive
  an erroneous token; current tests reject both. A reviewed empty physical archive
  change initially exposed a policy-dependent binding regression; the corrected
  service passes it and the folder-arrival-before-Apply rejection scenario.
- Final focused role-command and durable-location files: 51/51 pass. Earlier
  archive/location/service selection: 84/84 pass.
- Workflow scheduling/artifact retention: 72/72 pass. DEV and packaged retained
  evidence use distinct uploaded directories.
- Typecheck, lint, documentation links, production build and diff whitespace pass.
- Complete local suite at the application candidate: 3965 tests, 3910 passed,
  28 failed, 27 skipped. Twenty-five failures are native 10s shutdown timeouts;
  one fixture-cleanup assertion is downstream of the same quit failure. Two
  LF/CRLF status-workflow guards freeze the old option position and are repaired
  to check actual YAML membership/default and preserve the original routing.
  No full-green result is claimed. Affected routing/startup renewal passes 97/97.

Independent Standards and Spec review found and repaired lost DEV evidence,
un-enrolled status adoption and the empty-designation-change regression. Both
axes report zero remaining implementation findings after re-review.

## Appearance and native evidence

The new state reuses the accepted ProjectOperationDialog, bb input/button controls
and existing main-derived work-area composition from the baseline. No new style,
asset, copied module or panel arrangement is introduced. The first-use state is
new behavior; it has no identical historical reference screen.

The actual Electron visual diagnostic captures EN/RU, light/dark and 1024x720/
1440x960 first-use dialogs plus workspace settings. Inspection confirms wrapping,
viewport fit, visible controls and ordinary authored Archive/App placement. Its
two journeys check cancellation, ownership rejection, designation, archive/restore,
UUID, Text, bytes and configured reuse. The diagnostic substitutes reload for
process restart and therefore supplies no process-restart acceptance. Its final
normal quit and owned cleanup pass; its diagnostic flag remains explicit.

The original local native run fails a 10s normal-quit gate after EN archive.
A minimal empty-app launch/ready/close reproduces that timeout without a workspace
or Archive interaction; forced owned-process cleanup succeeds. This does not
establish its precise cause or make the failed native receipt passing. The final
native driver now observes the current archived record, absence of unfinished
operations and settled archive panel before its normal close/restart; all original
quit deadlines and process/cleanup assertions remain.

Required hosted evidence is `desktop-ci.yml`, `checks: special-archive`: complete
suites and actual DEV/package first-use/settings/restart on macOS latest, Windows
latest and Windows2022, plus retained contextual archive and original recovery/
restart consumers. The completed hosted rows below satisfy scoped issue acceptance;
release/manual Windows11 and final #67/#42 acceptance remain separate.

## Driver and routing renewal

The post-candidate repair changes only smoke-driver, tests, CI routing and prose.
Application, migrations, resources, dependencies, build scripts and packaging
inputs remain identical to `bb7701e6`. The first new driver revision omitted the
required startup-receipt callback; a minimal boundary invocation reproduces
`record is not a function`, while the explicit callback records the ready state.
The final driver records every launch and retains original normal-quit assertions.
A speculative visibility wait matched a hidden retained settings section and is
removed; completed archived identity and absence of unfinished operations are
still read before close. Current local actual native execution reaches the
original normal-quit timeout, with confirmed owned-process cleanup.

`special-archive-native` renews affected routing/startup regressions and all
original DEV/package consumers after inspected full-suite evidence. Its separate
concurrency group preserves a still-running full receipt. No diagnostic result,
failed run or skipped consumer becomes passing acceptance.

## Inspected original hosted complete suites

At application candidate `bb7701e6`, run
[40224251563/attempt 1](https://github.com/kornouhovas/workspace/actions/runs/40224251563):

- macOS latest: 3965 tests, 3935 passed, 3 failed, 27 skipped. The two option-position
  guards and the grouped native-notification assertion fail; all other reported
  checks pass. Downloaded full log/artifact inspected.
- Windows latest: isolated batches pass 51/51 and 14/14; remaining batch has
  3984 tests, 3968 passed, 2 failed, 14 skipped. Only the two option-position
  guards fail. Downloaded full log/artifact inspected.
- Windows2022: isolated batches pass 51/51 and 14/14; remaining batch has
  3984 tests, 3968 passed, 2 failed, 14 skipped. Only the same two option-position
  guards fail. Downloaded full log/artifact inspected.

The notification failure asserts callback order: reconciliation committed before
its `hints` counter advanced. An exact local 20-run loop does not reproduce the
natural timing. A deterministic public-service control instead holds the real
read-only installation-window scan until the single fixture move, and delays a
*genuine OS callback* until after that scan commits. The old check reproduces the
same assertion failure; awaiting commit and the actual native hint independently
passes all three selected cases under the original shared 4000ms deadline. There
is no synthetic notification, Refresh, mutation replay or deadline increase.
This proves the ordering mechanism is possible; the precise historical CI timing
cause remains unestablished. Native-hint delivery is still required for acceptance.
Both review axes report zero findings for the test-only repair; local cases pass
3/3 and routing/startup renewal remains 97/97.

The original retained `smoke:archive -- dev` also passes locally: all 12 direct/
grouped EN/RU layout, archived Text, restart and restore checks, with five normal
quits, backend exit and owned cleanup. This successful receipt stays separate
from the failed new native driver's local quit receipt.

## Accepted hosted renewal

[40226779029/attempt 1](https://github.com/kornouhovas/workspace/actions/runs/40226779029)
passes on macOS latest, Windows latest and Windows2022 at
`5e78d4b6311fa698f8aadd2284de2cd5d6c28ab6`. All three complete job logs and
artifact archives were downloaded and inspected.

| Scenario on each host | Renewed result |
| --- | --- |
| Original routing failures and startup controls | 97/97 pass |
| Original direct/grouped native notifications and real-callback ordering control | 3/3 pass, original shared 4s deadline |
| New first-use/settings DEV | EN/RU journeys pass, 16 captures, three normal quits and backend exits |
| New first-use/settings package | Same two journeys/16 captures/three normal quits pass in checked platform package |
| Retained contextual DEV archive | Original selected journey passes |
| Retained archive DEV and package | 12/12 checks per mode, five normal quits each; direct/grouped Text/restart/restore retained |
| All consumers | Owned processes stopped and fixture cleanup passes |

The six new host/mode rows retain 96 screenshots across EN/RU, light/dark and
1024x720/1440x960; original archive consumers retain 48 additional captures.
Twelve representative new captures were manually inspected across all three
hosts and both runtime modes, covering both languages, themes, sizes and the two
changed surfaces. The wider matrix has capture/overflow receipts; it is not a
claim that every image received independent manual inspection. No clipping or
control/return gap was found in the manual sample. Separate Standards and Spec
evidence reviews report zero findings.

Artifacts are named
`special-archive-<host>-5e78d4b6311fa698f8aadd2284de2cd5d6c28ab6-run-40226779029-attempt-1`.
DEV/package and retained DEV/package receipts have distinct directories.

Acceptance combines the inspected successful complete-suite complement from
`bb7701e6` with the renewed failed/changed tests and originally unexecuted native
consumers at `5e78d4b6`, under the shared evidence-reuse policy. Their full diff
contains only tests, smoke drivers, workflow selection and prose: application,
migrations, resources, dependencies, runtime/compiler/build and packaging inputs
are unchanged. The failed original overall run and the non-green local full run
retain their original results; no blanket raw-full-green claim is made.

Every issue-76 scenario has passing scoped acceptance evidence. GitHub records
the delivered integration SHA; this completes neither final #67 nor a release.
