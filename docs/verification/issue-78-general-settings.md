# Issue 78: General preferences verification

## Scope and implementation

Language and appearance share General; separate Appearance navigation is removed.
Independent existing typed settings commands preserve accepted language/appearance
until successful persistence. Each control has localized pending and failure
feedback, and appearance failures no longer claim that language failed to save.
No schema, dependency, native resource, packaging or storage boundary changed.

Composition reference: main `080b416c`, existing bb foundation `f135a001` documented
in [reuse](../reuse.md). Existing section/sidebar/card/theme controls remain; the
intentional difference is two preference sections on General.

## Appearance

Actual Electron captures cover EN/RU, Light/Dark and 1024x720/1440x960. Inspected
English dark minimum, Russian light minimum, English light wide and Russian dark
wide: labels/control groups fit; existing semantic colors/typography, focus ring,
sidebar hierarchy and theme cards remain. No horizontal/document overflow.
Snapshots are retained in native shell artifacts, separate from behavioral results.

## Behavior and retained guarantees

- TDD: adapted App regression fails while Appearance exists; passes after merge
  into General. Both languages cover independent concurrent pending/errors,
  accepted values, retry and no combined-save action.
- Existing SQLite preference upgrade/reopen/rollback tests are retained.
- Real Electron uses nativeTheme updates with Playwright's default light media
  override cleared. System follows dark/light native media events; explicit Dark
  stays fixed. The host's persistent OS preference is not changed.
- Shell preserves authored Cyrillic workspace names and source paths, selected
  saved view, scroll/layout and keyboard focus across Settings/Back. Restart
  retains RU/System and the active workspace. Backup/About/workspace sections
  remain keyboard reachable. Current Folder Roles preview/Cancel preserves the
  complete public project list without shared-impact acknowledgment.
- Retained session and contextual workspace journeys cover selection/project
  state, contextual entry, duplicate identities, rename/reorder/restart and
  removal/reconnection with unchanged project bytes and source metadata.
- Shutdown/backend ownership and disposable-fixture cleanup remain required.

## Evidence ledger

Application candidate: `3f429ec8f196e41390d34596fa2a771e7d2a6735`.
[Original scoped CI](https://github.com/kornouhovas/workspace/actions/runs/40274826519):
307/307 affected regressions, shell and session journeys pass on macOS latest,
Windows latest and Windows 2022. macOS workspace management also passes. Both
Windows management failures remain failed and are renewed separately below.
Downloaded per-host reports were inspected for exact SHA, passing native checks
and owned cleanup. Local shell also passes 28 recorded checks.

Final local complete suite on that candidate:3976 tests, 3948 pass, 1 fail, 27 skipped.
The grouped background-discovery close reported `Background discovery stop
unverified` in 1105 ms. Scanner/worker/service/test inputs are unchanged from base
`a41d2e84`; isolated rerun passes 3/3 in 315 ms. Exact cause is not established. The
full run remains failed; this unchanged-boundary limitation is retained for #67
integrated acceptance, not waived or described as a passing complete suite.
Local logs remain under `work/issue-78/` in the task checkout.

## Windows driver diagnosis and repair

The Windows 2022 outcome diagnostic at `be53730d`/run 40276259568 records expected
remaining 1 with both workspace IDs, yet the old async wait advanced to Back.
Pinned Playwright 1.64.0 checks a predicate Promise's truthiness without awaiting
its result. A real Electron control with the original extracted expression fails
before removal; the helper wrongly completes on the async false result.

`1ff44d5e` changes only the test driver: explicit awaited public polling requires
expected count and target ID absence, followed by form-hidden acknowledgment
within the unchanged 15s total. Submit remains single; only reads repeat. The
native control separately delays backend effect and UI acknowledgment. Local 3
controls,71 routing checks, lint/docs and original management pass. Both review
axes found 0 defects. No application/build input changed from 3f429ec8; successful
unchanged source receipts retain that provenance under the evidence-reuse policy.

The initial awaited-outcome renewal at
[1ff44d5e](https://github.com/kornouhovas/workspace/actions/runs/40276914806)
remains failed: Windows 2022 retains a visible first confirmation and both records.
This establishes that the old prematurely acknowledged outcome also concealed an
unaccepted Submit. A second native control reproduces disabled confirmation
consuming Enter with zero commands. The precise initiating disabled timing in
that older run remains inferred, separately from the reproduced call-site defect.

`bc889bfdd4467bee519ec04441b9ec26e51ba42e` returns a live enabled confirmation
locator through the caller's single Submit. Four native controls and original local
macOS management pass; both review axes have zero findings.
[Final ordinary renewal](https://github.com/kornouhovas/workspace/actions/runs/40277479712)
passes Windows latest and Windows 2022. Both inspected artifacts report the exact
bc889bfd SHA, all 11 management groups, normal process shutdown and owned cleanup.
This includes removal/reconnection with original byte/source/identity assertions.
No diagnostic success substitutes for this ordinary receipt. All earlier failed
runs retain their outcomes.

The complete diff from 3f429ec8 to bc889bfd contains only smoke-driver/native
controls, diagnostic/routing workflow and documentation changes. Application,
migrations, dependencies/lockfile, native resources, build/package configuration
and runtime application settings are identical. Renewed consumers: management
on both Windows hosts and local macOS, its four controls and routing/static checks.
The successful original 307-check, shell and session receipts on all three CI
hosts and original macOS management retain their actual source provenance.

Release/manual Windows11, #67 final desktop and the unrelated full-run limitation
remain separate. This issue publishes source changes; no release or main merge.
