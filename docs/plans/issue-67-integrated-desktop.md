# Issue 67: Integrated desktop acceptance

Issue: https://github.com/kornouhovas/workspace/issues/67

Base: `5799532c4966e026b96b6b18718f5a8e8171bf6b`, verified integration from #66.
Branch: `codex/issue-67-integrated-desktop`; sibling task worktree of `new-workspace`.
All native/textual blockers #69/#58/#63/#65/#66/#41 are closed. No prior #67
execution owner was recorded. This is Matt Pocock execution, without Ralphex.

## Candidate and boundaries

Verify the composed interface and preserve the accepted main `080b416c` composition,
bb `f135a001` component/Inter styling and early #69 Workspace captures. No redesign,
storage migration, backend rewrite or release is authorized by this task.

The owner confirmed public Workspace service/disposable real SQLite and folders,
user-facing UI interactions, and real Electron/package journeys as TDD seams.
Use existing scenarios first; add regressions for demonstrated gaps or failures.
Keep historical failures and actual SHA/run/attempt/host/artifact provenance.

## Scenario and retention map

All inherited current requirements are retained. Existing development-only principal
journeys will also run against the package; this adapts execution, not assertions.

| Rows | Implementation owners | Observable final-candidate checks |
| --- | --- | --- |
| UX01–02 | #48/#49/#50/#55 | Workspace/source/shell journeys: picker cancel, setup/reuse, lifecycle, Back/Forward, independent sessions and project preservation |
| UX03–06 | #54/#55 | Navigation: preview replacement, editor isolation, unique tabs, expand/return, close/reopen/reorder, widths and focus |
| UX07–08 | #55/#65 | Sessions/retained recovery: restart/export/restore, independent siblings, current files/values, missing/excluded/archived/source-outage/verified rename |
| UX09–10 | #56/#57 | Scalar/selection journeys across Table/Board/details: commit/cancel, invalid/error draft guards, Escape, immediate choices and persisted mutations |
| UX11 | #58/#61 | Property/category management and public services: source-wide data, workspace hiding, view presentation, reviewed removal/stale/cancel |
| UX12 | #51/#52/#53 | Board/Views and layout journeys: lifecycle, filters/grouping/membership/visibility/order/width/wrap/restart |
| UX13 | #59/#63 | Ordinary and filesystem assignment journeys, all types, empty/invalid/collision, filtered membership and keyboard alternatives |
| UX14 | #64 | Real project tree/native Open/Reveal: current files, loading/error/containment, exact external native outcome |
| UX15 | #60/#61/#62/#65 | Contextual project/category/archive/recovery and original crash/journal fixtures: no overwrite, uncertain outcomes, identity/files/restart |
| UX16 | #48/#50/#66 | Shell/source/data-recovery: category memory, direct context/Back/focus, immediate settings versus reviewed operations |
| UX17–18 | All UI slices | Whole-window principal and late-surface EN/RU × light/dark × 1024x720/1440x960 captures, System, long content/popovers/resize, keyboard/control inventory and reference comparison |
| UX19 | #37/#38/#55/#66 | Real migration/backup/session/recovery suites and packaged recovery: upgrade/reopen, invalid/interrupted protection, project-file exclusion |
| UX20 | #39/#40/#41/#69 | Full current suites, packaged native consumers, isolation/notices/version, actual DMG/NSIS installation and strict direct/grouped 1000/20/10 scale |

Parent preservation baseline: retain all applicable #8–#40 public service,
SQLite/filesystem/identity/ownership/containment/journal/recovery, platform/native,
renderer-isolation and build/resource tests in the complete suite. Existing broad
desktop CI retains original crash/creation/rename/category/native runtime routes.
New package journeys supplement these routes; they do not replace failure or
unsupported-platform evidence. No inherited scenario is retired.

## Execution order and gates

1. Make development-only principal journeys explicitly package-capable and verify
   launcher selection/failure propagation. Keep ordinary defaults intact.
2. Run focused checks/typecheck/lint, compare actual principal and late-surface
   captures, then perform two-axis review and repairs.
3. Run the complete local suite once on the completed candidate. Diagnose failures
   with original deadlines/cleanup requirements; no unchanged retries to green.
4. Renew broad hosted checks and packaged UX/strict scale on the same source
   candidate, inspect reports/artifacts, and record exact evidence. Run actual
   installer checks with the matching candidate; #42 retains release ownership.
5. Integrate only after every required acceptance gate passes. #47/#7/#42 remain
   open; no release or main merge.

Windows 11 is a required open external gate: the owner reports no available
Windows 11 machine/VM/runner. GitHub Windows Server evidence cannot satisfy it.
Complete independent work and retain this limitation without claiming acceptance.
Known earlier local synthetic normal-quit failures and #57 scale misses must be
renewed/diagnosed; earlier scoped passes are not a final-candidate full-green result.

Live execution/CI checkpoints belong to issue #67. Final receipts and limitations
will be recorded in the corresponding verification report.
