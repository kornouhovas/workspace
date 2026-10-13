# Issue 21: Recoverable category removal verification

Source: [Issue #21](https://github.com/kornouhovas/workspace/issues/21). Scope/scenarios: [implementation plan](../plans/issue-21-category-removal.md). Contract: [architecture](../architecture.md#recoverable-category-removal-issue-21).

## Implemented result

The folder-backed category options UI requires an explicit reviewed destination for occupied categories. It preserves project IDs, exact properties and file contents, stops at the first unsuccessful move and exposes completed/rejected/pending/recoverable project outcomes. Explicit recovery skips completed moves and never overwrites destinations. Empty categories need no destination. Cleanup journals its intent and uses only nonrecursive empty-directory removal; unexpected files, new projects, changed identity and denied access prevent unsafe cleanup. Restart and read-only status never replay mutations. An interrupted physical move or cleanup can finish verified metadata through an explicit fresh review. Source siblings receive current projections; historical category and operation identities remain retained.

## Local candidate evidence (2026-10-13)

| Check | Observed result |
| --- | --- |
| Final full `npm test`, after double-activation repair | 2,656 passed, zero failures, 21 skips |
| Focused `npm run test:migrations` | 282 passed, zero failures, one host-filesystem skip |
| Removal service on disposable case-sensitive HFSX | All 27 passed, no skips; image detached and deleted |
| EN/RU removal and existing category-options DOM tests | Nine passed, including double activation plus a lost response retaining the actual dispatched ID |
| Typecheck, lint, documentation links, diff checks | Passed |
| Actual macOS arm64 development Electron category-options route | 16 checks passed; normal quit, backend exit and owned-fixture cleanup verified |
| Actual macOS arm64 packaged Electron category-options route | 16 checks passed; normal quit, backend exit and owned-fixture cleanup verified |
| Packaged ASAR/native/migration/license/version resources | Passed `npm run check:artifact -- release` |
| Matt Pocock Standards and Spec review | No remaining findings; final UI submission guards reviewed |

The normal full suite's 21 skips comprise 20 existing platform skips plus the planned-alias scenario on the ordinary case-insensitive fixture filesystem. That scenario passed separately with the other 26 service cases on HFSX. Full verification was renewed after the double-activation regression was reproduced and repaired; the earlier full pass is not substituted for the repaired candidate's result.

Real temporary SQLite/filesystem fixtures cover first-error stop, explicit sibling retry, uncertain native response, late target insertion with no-replace preservation, new arrivals before Apply/between moves/at cleanup, hidden files, replacement, denied cleanup, immutable receipts and populated migration 0011 upgrade/reopen. Separate processes exit at seven stages: batch intent, child intent, physical move, destination evidence, first completed child, cleanup intent and cleanup effect. Restart/read checks do not mutate; explicit recovery preserves IDs and sentinel bytes.

The production graphical route extends the existing category-options acceptance driver. Both languages at 1440×960 and 1024×720 cover collision feedback, Escape cancellation, explicit occupied-category Apply, sibling IDs/values/bytes, empty-category removal without a destination and reopen. The four removal previews are retained for each mode; representative EN wide packaged and RU narrow development captures were visually inspected. Local artifacts: `work/issue-21-runtime-dev-delivery/` and `work/issue-21-runtime-release-delivery/`. Local evidence has no CI SHA; exact tested SHA and platform runs are recorded in the GitHub checkpoint.

## Platform/integration acceptance

The unchanged ordinary CI matrix runs the new service/crash/UI cases, migration/build/package fixtures and expanded graphical driver on macOS, Windows latest and Windows 2022. No diagnostic route substitutes for full acceptance. Exact-SHA Actions, artifact inspection and delivery into `new-workspace` remain pending at this local checkpoint. GitHub owns current status and the tested/delivered SHAs.

## Retained first CI failure and repair

Full run [38386963810](https://github.com/kornouhovas/workspace/actions/runs/38386963810), attempt 1, tested `287ead815f6e927eb36e94d75d7ccfcd2a13efe0`. The macOS platform suite reported 2,171 passes, one failure and 21 skips. Its inherited never-focused Electron readiness control expected renderer `timed_out`, but received host `deadline exceeded`. The log proves the mismatched assertion; it does not identify the underlying delivery delay. No category-removal product failure was reported in that job; dependent macOS runtime/package stages were unreached.

A 30ms no-delivery reproduction fails the same assertion. Existing real-renderer/controlled-host-clock tests separately confirm timely finite evidence and late unknown evidence. The repaired never-focused control uses actual unfocused Electron snapshots and explicitly schedules both delivery outcomes against the unchanged default 15,000ms host deadline. It requires no early result, one record, timer disposal, rejection of late replacement and preservation of the primary timeout over recording errors. Production behavior, deadlines and readiness operands remain unchanged. The complete original readiness file passed locally: 27 checks, zero failures/skips. CI-route regression checks passed all nine cases. Renewed full `npm run test:all` on the repaired test/workflow candidate passed 2,659 tests, zero failures and the same 21 platform/filesystem skips; it reused the unchanged verified application build. Both Standards and Spec repair reviews found no remaining findings.

The added `checks: readiness` route runs only that macOS file and retains its original command log with SHA/run/attempt provenance. Focused acceptance, renewed full acceptance and integration remain pending; current run IDs and repair SHA belong to the GitHub checkpoint.

## Retained limits

No-replace protects the target; repeated path/identity checks are not an atomic filesystem ancestor lock. Filesystem effects and SQLite are not one transaction. Process-interruption evidence does not establish machine-crash or power-loss durability. See [ADR 0007](../adr/0007-no-replace-project-renames.md). Category/project-content deletion, automatic rollback, synchronization, archive redesign and release to `main` are outside this issue. Local packaging produced an unsigned development artifact, not a published release. No new bb module or dependency was copied.
