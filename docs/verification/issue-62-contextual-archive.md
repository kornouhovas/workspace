# Issue 62 verification

Baseline: `73437086516018598438a38f23535226abdd7646`.
Tested candidate: `c7d9c1601e5121775fe4c6ab5b427c813056db69`, including accepted #61 at `6bd000f2`.
Final hosted run: [39867249349](https://github.com/kornouhovas/workspace/actions/runs/39867249349), attempt 1, `contextual-archive`.
Delivery SHA is recorded in #62 after integration.

## Appearance

Main `080b416c` supplies sidebar/saved-view/project-area composition; bb
`f135a001` supplies the accepted Inter/semantic-control foundation. Compared the
running full screen with `docs/research/desktop-experience-evidence/main-table-1440.png`
and the accepted #60 dialog handoff. Existing single-project/unique-tab and bb
styling deviations remain deliberate. Archive stays in the daily toolbar and
project menus, without adding a management page or changing the principal shell.

Early inspection removed the empty history summary from the contextual dialog.
The exact source-relative path consequence, explicit Apply and Cancel remain
visible. Added archive-local wrapping for long unbroken paths; no shared token
was changed. Narrow RU dark expanded project and wide EN light Table inspected.
The later dev matrix passed 24 mutation journeys and 192 whole-window captures:
direct/grouped × EN/RU × Table/Board × list/preview/expanded × both themes/sizes
for Archive and Restore. Images have a SHA-256 manifest and four retained
representatives in [evidence](issue-62-evidence/manifest.json).

## Affected behavior

- Contextual menus share the existing typed review/apply/status/recovery commands;
  no service, schema, IPC, native adapter, dependency or installer changes.
- Contextual Cancel/Escape returns to the origin; review no longer overwrites its
  focus reference. This new test first failed for a missing dialog, then exposed
  a deterministic focus loop on Escape; preserving the origin made EN/RU pass.
- Reply validation now retains uncertainty unless operation/source/project/action
  and both paths match the saved request. Six adversarial reply cases verify the
  same read-only status lookup and one mutation. Pending double-click admits one
  command; late success preserves an independent editor's focus.
- A recovery preview for another project under the same operation ID first failed
  its regression, then passed after immutable operation bindings were checked.
- 102 archive/service/real-SQLite/filesystem/crash/IPC/navigation/editor scenarios
  passed. Subsequent UI/routing renewal passed 53; later pending/focus addition
  passes in its focused file. Final hosted results are recorded below.
- Dev Electron: 24 journeys/192 captures, identity, exact file bytes, ordinary
  archived Text editing, Cancel/no-effect, retained-tab uniqueness, normal app/
  backend exits and asserted owned-fixture cleanup passed.

## Inherited coverage decisions

| Scenario | Decision and evidence |
| --- | --- |
| Relative placement, identity/values, no-overwrite, missing parent, incompatible mode, permissions, interrupted/restart recovery | Retain existing archive service/journal/crash/IPC and original native archive consumer |
| Reviewed source-owned designation, no silent relocation | Retain source settings and existing history/location controls |
| Explicit occupied-target correction | Retain EN/RU tests; adapt their completion fixture to `Client/Alternative` after authoring that name, rather than the inconsistent old `Client/Project` receipt; assertions unchanged |
| Ordinary archived editors and fixed folder-backed category | Retain backend/selection coverage; contextual real Electron editing composes with existing ordinary editor |
| Table/Board and project-area navigation | Retain existing suites and original Views consumer; add menu/Cancel/identity/tab tests |
| Existing history-form entry points | Retain while new contextual replacements are verified; no scenario retired |

## Review and repairs

Initial Standards and Spec reviews each found the same P2: entering recovery
inside a contextual dialog overwrote the original focus trigger. The independent
renderer reproduction closed to BODY rather than the origin. Added EN/RU
recovery-Cancel regressions; the pre-repair test reproduced a CPU-bound DOM focus
loop and was terminated, not counted as a pass. Preserving the contextual origin
made the 37-case archive/dialog renewal pass. Recovery has one contextual Cancel.
If the original row disappears or becomes hidden, cancellation uses the visible
project header or view heading instead; EN/RU origin/fallback cases cover this.
The first fallback repair targeted a hidden Active heading after restore from
Archived. A new actual Electron `dev --focus-only` journey failed at Restore→Done
with no visible focus owner; it passed after choosing the visible archive region
(and the project header only when that region is hidden by expansion). The native
full route retains this assertion for every journey; focus-only is diagnostic,
not appearance acceptance. Added the missing archived action header/width and
virtualized placeholder column count; a public columnheader regression was red
then green. Final follow-up reviews report no remaining findings. Both merge-conflict review axes also cleared the accepted #61 composition; 283 local archive/category/routing tests, typecheck, lint and docs204 passed.

## Diagnostic receipts and remaining acceptance

The initial native driver expected an invented effect label; the actual dialog
was rendered. That receipt failed honestly, with normal quit/cleanup. Corrected
the new driver to the existing localized explanation; no assertion/deadline was
weakened. Early 96-capture success remains separate from the 192-capture final
dev matrix. Raw local logs remain in `/tmp/issue62-*` and `work/issue-62-*`.

Final two-axis review and the one complete local suite are finished. The scoped three-host native/package/restart acceptance is recorded below; integration is recorded in #62. Broader #67/#42 and Windows 11 release gates remain separate. This is not a full-suite-green or release claim.

Local host: Apple M1 Pro, macOS 27.0 (26A428), Node 22.21.1. Final review
follow-ups report Standards 0 and Spec 0 remaining findings. Current focused
UI/layout/navigation/route renewal: 91/91; typecheck/lint/docs202 pass. Original
development archive consumer: 12 checks, four direct/grouped EN/RU restart
journeys with exact files/metadata; original Views: 6 journeys. Both exit and
assert owned-fixture cleanup normally. The complete local suite finished once; its actual failed result is retained below.


## Complete local suite

One `npm test` (fresh build, Node22.21.1): **3378 passed / 27 skipped /
24 failed / 3429 total**, 227.243s test phase. No whole-suite retry.
[Failure inventory and full-log digest](issue-62-full-suite-failures.json).
Twenty-three failures are original10000ms Electron quit timeouts across
property-editor-driver8, rename-editor-readiness2, runtime-electron-quit1,
runtime-view-readiness7, selection-driver3 and view-scroll-native2. The remaining
rename-editor-readiness cleanup-control assertion expected count1 and observed0;
its historical timing cause is not established here.

All those files, their synthetic Electron fixture, lifecycle/driver helpers and
the useViewScroll hook are unchanged from73437086. They do not load the changed
archive controller. Similar unchanged shutdown boundaries were already retained
in #60, though this run's exact failure count is its own receipt. These failures
remain broader #67/#42 harness watchpoints; no deadline/assertion/test was removed
or raised, and they are not relabelled passing by the scoped native runs.
All current archive/controller and affected interaction tests passed within the
full run. The final scoped three-host native/archive/restart/Views acceptance is separate from these original synthetic fixture failures.

After that full run started, the only execution change was test/CI evidence
copying: immediately snapshot each original archive/Views consumer's successful
output into distinct dev/release directories, preventing later overwrite.
Original commands, app/build/dependency inputs, assertions and deadlines are
unchanged; routing25/25 renewed and independent Standards follow-up has zero
findings. This does not require another whole-suite run under evidence reuse.

## Designation eligibility renewal

Final requirement reconciliation found Archive still enabled before the source
had a designated archive location. The service safely rejected it, but this did
not meet current UI eligibility. Actual Electron pre-designation menu assertion
was red (`false !== true`); the list/details predicate now also requires
`archiveSnapshot.relativePath`. That actual journey became green and74 affected
UI/navigation/routing tests, typecheck and lint pass. Both review axes cleared
the repair. The default native profile checks pre-designation disabled state in
all four source/language fixtures, then configured Archive/Restore normally.

The one full local run above predates only this application predicate repair and
its native assertion. Renew affected native/package acceptance on all selected
hosts; retain the original full result without replaying unchanged synthetic
fixture failures. Earlier a7aa8904 CI remains evidence for its actual candidate,
not acceptance of the repaired predicate. Configured-screen composition is
unchanged; final hosted appearance/native receipts still require inspection.

## Original Actions failure map and driver repair

Original run39863932190, attempt1, application a7aa8904:

- Windows2022 job120121272001: affected tests passed; new dev consumer completed
  22 journeys/180captures, then timed out filling the grouped RU Board preview
  Text editor. Failure image shows the readonly value; normal quit and owned
  cleanup passed. Later dev/archive/Views/package consumers were not reached.
- Windowslatest job120121272356: tests passed; the new dev consumer timed out at
  initial backend readiness (0 journeys). Screenshot shows the empty workspace
  interface. Original10000ms quit also timed out; cleanup was correctly skipped
  because process termination/startup ownership was unverified. This is not a
  cleanup pass or proof of its historical cause. Later consumers were unreached.
- macOS job120121272216: complete selected profile success at its actual a7aa SHA;
  original artifact and job log downloaded for inspection. This is historical
  coverage, not acceptance of the later application eligibility predicate.

Downloaded original logs and both Windows artifacts. Ranked hypotheses were
late source observation closing an editor, pointer enablement changing during
entry, and a separate startup-readiness failure. A controlled real-browser button
that disables during pointerdown deterministically reproduced the missing editor
with the click driver (1000ms control failure). One deliberate Enter on the
currently enabled control passed with exactly one activation and no app-data
mutation; the real archive editing journey then passed locally. This supports
the entry repair, not unique causation for the old Windows timing.

The new driver adopts the existing `waitForRuntimeInterface` contract (same
15000ms deadline, typed backend status) and finite failure diagnostics; no
backend, product, dependency, resource, assertion or production deadline changed.
Added a two-Windows original development renewal profile, retaining exact full
native command, normal shutdown and owned cleanup. Local affected UI/startup/
routing66/66, typecheck/lint and actual one-journey control pass. Focused Windows renewal [39866457499](https://github.com/kornouhovas/workspace/actions/runs/39866457499), attempt1 at `e8942337`, passed on both original hosts. Inspected each log/artifact:66 controls,24 dev journeys/192 captures, ready startup/reload, exactly1 editor activation/no app-data mutation, normal app/backend exits and asserted owned cleanup. Fresh combined-candidate acceptance follows below.


## Final hosted acceptance

Run39867249349, attempt1, Node22.21.1, candidate `c7d9c1601e5121775fe4c6ab5b427c813056db69`:

| Host / job | Affected tests | Dev and release contextual | Original archive / Views, each mode | Result |
| --- | --- | --- | --- | --- |
| macos-latest /120132437073 |366/366|24 journeys +192 captures each|12 /6|Pass|
| windows-2022 /120132437074 |365/365|24 journeys +192 captures each|12 /6|Pass|
| windows-latest /120132437124 |365/365|24 journeys +192 captures each|12 /6|Pass|

All selected jobs and commands passed; no affected test skips. Downloaded and
inspected all three logs/artifacts. Each provenance receipt names the tested SHA,
run, attempt, host platform and profile. Each contextual report has ready startup
and reload, exactly one isolated editor-entry activation, no control app-data
mutation, normal app/backend quit and asserted owned cleanup. Every original
archive and Views report has normal quit and asserted owned cleanup. Package
resource/license checks passed on each host before its release consumers.
[Report hashes and consumer counts](issue-62-evidence/hosted-receipts.json) retain
the18 separate reports. Artifact names are `desktop-ux-foundation-macos-latest`,
`desktop-ux-foundation-windows-2022` and `desktop-ux-foundation-windows-latest`.

Inspected final macOS full-screen representatives across EN/RU, light/dark,
1024/1440 and Table/Board/list/preview/expanded, plus Windows2022 narrow RU dark
Board preview and Windowslatest wide EN light Table restoration. The dialog,
path consequence, explicit choices and return controls fit the accepted shell.
The192-image release manifest and four retained PNGs now refer to this exact
hosted candidate, replacing earlier local appearance evidence.

Only verification documents and retained evidence change after this tested
candidate. Production source, dependencies, native resources, build/package
inputs, tests, drivers and workflow stay byte-identical. Under CI evidence reuse,
retain these successful native/package receipts and verify documentation plus
the integrated tree without rerunning the complete suite or unchanged platform
consumers. Broader #67/#42 and manual Windows11/installer/release gates remain
open at their existing milestones.
