# Issue 23 verification

Requirements and current acceptance: [GitHub #23](https://github.com/kornouhovas/workspace/issues/23).
Implementation/scenarios: [plan](../plans/issue-23-number-properties.md).
Baseline: `82e983cd`; task branch `codex/issue-23-number-properties`.

## Observed local checks

- First Number service scenario failed on the baseline, then passed after implementation.
- Built backend IPC regression failed on the Text-only entry validator, then passed after
  admitting Number creation and validating the new command. The original Electron failure
  independently exercised this same separate-process entry boundary.
- Number service checks passed for arithmetic/limits, no-op revisions/events, siblings/reopen,
  ownership/type rejection, transaction rollback, populated Text-preserving migration,
  retained/archived editing and unchanged sentinel bytes.
- EN/RU keyboard DOM tests through the real service/SQLite passed for creation, computation,
  invalid draft retention, cancellation, clear and focus.
- Initial migration run found three stale migration-count/schema-inventory fixture expectations;
  the focused repaired build/category-removal/discovery-mode/Number run passed (62 passed,
  one platform skip). Existing preservation assertions were retained.

Final local results and independent review are recorded below. Target-platform CI and
integrated acceptance remain in the GitHub checkpoint; local macOS checks do not prove Windows acceptance.

## Standards

One original low-severity finding: the architecture overview/runtime table still described
ordinary non-Text properties as future work, contradicting the added implemented Number
section. The overview/table now describe actual Text/Number wiring and retain future scope
for the remaining types. No blocking correctness, ownership, transaction, migration or
renderer-boundary defect was reported. No smell-baseline finding warranted a change.

## Spec

One original P2 finding: disabling the focused input during save caused Chromium to move
focus to BODY; reenabling after failure did not restore focus. Locator-level Escape in the
initial native harness could mask this. The effect now responds to editing/pending and
restores the enabled draft editor. EN/RU DOM tests assert focus, and native smoke asserts
actual activeElement before global keyboard Escape. Independent follow-up review found
this repair resolves P2 and reported no other missing/incorrect requirements or scope creep.

Review totals: Standards 1 original / 0 outstanding (documentation); Spec 1 original /
0 outstanding (failed-save keyboard focus). Axes were reviewed independently against
baseline `82e983cd` and the staged task candidate, with the focused repair checked separately.

## Native development evidence

The rebuilt macOS development application passed `npm run smoke:number -- dev` for both
languages: real preload/IPC/backend Number creation and arithmetic, computed display,
invalid-value preservation, keyboard focus/cancel, clearing, sibling snapshots, reopen and
unchanged sentinel bytes. EN/RU 1024×720 and 1440×960 captures were inspected. Ordinary
quit, backend exit and fixture cleanup were verified. Local evidence is retained under
`work/issue-23-number-runtime/`; this is disposable-fixture evidence, not live user data.

## Final-suite repair evidence

The first full run found only the workflow inventory fixture missing Number dev/package
commands and their evidence path. The expected inventory was extended while retaining the
identical three-OS route and all existing command/artifact assertions; its 20 tests passed.

The subsequent full run found the inherited observer first-execution fixture returning
`deadline` instead of `needs_decision`. Its isolated cases passed. A controlled 60 ms delay
before the first snapshot read reproduced `deadline` for both heartbeat variants, reporting
`second-execution`: the original 25 ms publication timer can replace the fixture before the
observer first binds. This proves a red-capable fixture ordering problem; the original full
run's internal read ordering was not captured, so it does not establish that exact trace.

Only the test fixture changed: publish the replacement after the first complete owner read,
freeze the logical clock within try/finally, retain the 200 ms observer budget and 50 ms poll,
and preserve mismatch/no-cursor/owner-lock assertions. An independent 5-second host abort
bounds a missed-mismatch regression; globals/timer are restored on every outcome. The
107-test observer file and the final focused two cases passed. Production observer code,
execution policy, heartbeat permissions and deadlines are unchanged; no Ralphex run started.

Focused Standards follow-up identified the initially unbounded frozen-clock test, then
verified the independent abort repair. Final totals across initial/focused review:
Standards 2 original / 0 outstanding; Spec 1 original / 0 outstanding.


## Completed local candidate

- Node 22.21.1; dependencies installed independently in the task checkout with `npm ci`.
- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run check:docs` and
  `git diff --check` passed. Documentation links checked across 127 Markdown files.
- Final `npm run test:all` passed: 2,746 tests, 2,725 passed, 0 failed, 21 platform skips.
  This includes all migration consumers selected by `test:migrations`, existing regression
  fixtures and the reviewed observer/CI-inventory repairs. The build was reused unchanged.
- `npm run smoke:number -- dev` passed for EN/RU on macOS arm64.
- `npm run package:built` and `npm run check:artifact -- release` passed; the resulting
  development package is unsigned and is not a production release.
- `npm run smoke:number -- release` passed for EN/RU: computed numeric display,
  validation preserving previous value/draft, actual focus/global Escape, clear, sibling,
  SQLite reopen, unchanged sentinel bytes, ordinary shutdown/backend exit and fixture cleanup.
  Packaged screenshots/evidence are retained under `work/issue-23-number-package/`.

CI adds Number dev/package keyboard/runtime steps to each existing macOS, Windows latest
and Windows 2022 acceptance route and retains Number evidence in the existing upload.
The new service/SQLite/IPC/mixed UI tests default to platform coverage. Existing common,
filesystem/recovery/native routes and packaging assertions remain required and unchanged.
No platform/integration outcome is inferred from dispatch or a missing artifact.

## First candidate CI failure

Candidate `bab3c4b016f82237a7899de85753f27552c17604`, run 38522832305 attempt 1:
common checks, the macOS full job and Windows 2022 full job passed. Both successful jobs
included Number development and packaged EN/RU runtime. Windows latest passed platform
and layout checks, then failed the original development creation crash/recovery matrix
(`npm run smoke:runtime -- dev --creation --skip-native`, job 115716670702).

Its retained creation report shows 14 successful ordinary shutdowns followed by a 10-second
shutdown timeout on grouped `after_commit`, before restart persistence. Forced cleanup
confirmed parent stop but retained command error 255; fixture cleanup passed. Number native
stages on that OS were unreached. The original evidence has no quit-dispatch/lifecycle phases,
so it cannot identify whether inspector dispatch, backend waiting or later Electron quit
was responsible. The inherited shutdown failure is not described as a Number defect or fixed.

A bounded fixture-only quit-phase capture and `creation-shutdown` focused CI route now
preserve finite before-quit/will-quit/quit phase fields and owned-parent exit. They do not
retain names, paths, PIDs or exception text, change production code/deadlines, veto quit,
relax the original command or convert forced cleanup into normal shutdown. Local lifecycle
and evidence/route regressions passed; independent Standards review found no issue.
Focused and subsequent full acceptance outcomes remain in the GitHub checkpoint.
