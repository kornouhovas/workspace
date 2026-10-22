# Issue 62 verification

Baseline: `73437086516018598438a38f23535226abdd7646`.
Candidate, hosted acceptance and integration SHAs will be recorded in #62.

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
  passes in its focused file. Final aggregate results remain pending.
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
then green. Final follow-up reviews report no remaining findings; hosted acceptance remains pending.

## Diagnostic receipts and remaining acceptance

The initial native driver expected an invented effect label; the actual dialog
was rendered. That receipt failed honestly, with normal quit/cleanup. Corrected
the new driver to the existing localized explanation; no assertion/deadline was
weakened. Early 96-capture success remains separate from the 192-capture final
dev matrix. Raw local logs remain in `/tmp/issue62-*` and `work/issue-62-*`.

Required before delivery: final two-axis review, complete local suite once,
selected three-host contextual archive profile, inspected native/package/restart
artifacts and verified integration. Broader #67/#42 and Windows 11 release gates
remain separate. No full-green, hosted acceptance, integration or release claim.

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
full run. The selected three-host native/archive/restart/Views profile still
must pass before #62 acceptance.

After that full run started, the only execution change was test/CI evidence
copying: immediately snapshot each original archive/Views consumer's successful
output into distinct dev/release directories, preventing later overwrite.
Original commands, app/build/dependency inputs, assertions and deadlines are
unchanged; routing25/25 renewed and independent Standards follow-up has zero
findings. This does not require another whole-suite run under evidence reuse.
