# Issue 70: Durable folder evidence decision and handoff

Issue: [#70](https://github.com/kornouhovas/workspace/issues/70). Base: verified `new-workspace` `24400d164516b54161aa3cbf995049fcf9af328d`. Task branch: `codex/issue-70-durable-identity`. Native blockers are empty, no native parent exists, and textual blockers are None. The issue is independently executable; #47/#7 are related specifications and #67 is a separate final gate. No other owner/issue-70 checkout was found at start.

Outcome: owner-accepted [ADR 0009](../adr/0009-durable-folder-evidence.md), explicit migration/recovery scenarios and implementable boundaries for [#71](https://github.com/kornouhovas/workspace/issues/71) and [#72](https://github.com/kornouhovas/workspace/issues/72). This is documentation only: no schema, runtime or live-data repair. The owner accepted ADR 0009 on 2026-10-23 in the implementation conversation. This settles the design prerequisite; it does not start #71. The scoped requirements in #70 govern; its D66–D82 reference is not a claim those decisions already approve a volume schema.

## Scenario inventory and acceptance mapping

| #70 criterion | Concrete design/check | Implementation owner |
| --- | --- | --- |
| Durable macOS/Windows evidence, current mount, missing evidence | ADR platform contract, continuity rules and truthful states; compare against primary API sources | #71 adapter/discovery, #72 effect boundary |
| Legacy migration and reviewed reassociation | Additive migration with no inferred UUID, explicit one-to-one root/category/project consent; atomic token-bound Apply | #71 |
| Same policy at every boundary | ADR rollout table, backend capability gate, token generation, old/new journals | #71 gate/read paths; #72 conversion/enablement |
| Conflict/unavailable recovery journey | ADR EN/RU state table and Sources/project review steps, retained data and operation guidance | #71 UI; #72 operation UI |
| Preserve containment, identities/data, no markers | No filesystem effects in #70; retain/extend existing public-boundary safety coverage below | Both |
| Accepted design and actionable handoff | This plan and ADR, independent Standards/Spec review, owner decision | #70; accepted 2026-10-23 |

## Required implementation scenarios

Each row is a required observable check or explicitly retained limitation, not a result already obtained. Use disposable real SQLite databases and roots. Keep macOS and Windows receipts separate; mocked evidence tests do not replace actual native provider checks.

| Scenario | Expected observable outcome | Owner |
| --- | --- | --- |
| Same enrolled volume/folder, changed `dev` only between runs | Source accessible; logical source/project/category IDs, all property values, views and sessions preserved; no automatic recovery of already-retained records | #71 |
| Dev-only reproduction control with legacy evidence | Review required, no silent backfill/adoption; unchanged-dev legacy control also requires first enrollment | #71 |
| Restart/remount and repeated Refresh/watch hints | Sufficient enrolled evidence preserves continuity; hints never supply consent or replay effects | #71 |
| Wrong UUID/volume with same path/inode/time; folder-ID or creation-time mismatch | Distinct truthful conflict, no adoption or metadata transfer | #71/#72 |
| Missing/partial/zero/unsupported evidence, adapter unavailable, permission error | Finite reason; retained metadata usable, filesystem actions blocked; Retry does not weaken evidence | #71/#72 |
| Mount below source or source below actual mount root; Windows volume aliases | Correct containing-volume evidence; cross-volume descendant blocked; unrecognized GUID alias reviewed | #71/#72 |
| Duplicate IDs, conflicting logical ownership or ambiguous scan | No automatic match/new enrollment that steals historical data | #71 |
| Links/junctions/reparse swaps, ancestor substitution, mount change during scan/review/effect | Containment/revalidation failure; no authorized effect, or truthful uncertainty if an effect was possible | Both |
| Legacy populated database upgrade and reopen | Old evidence/history retained; new evidence absent until consent; IDs/properties/category links/views/session unchanged | #71 |
| Explicit legacy source-only versus selected category/project mappings | Root approval never approves all descendants; grouped parents validated first; unrelated, excluded, inactive, archived and unmapped records retain policy/state | #71 |
| Cancel, stale token, sibling mapping/configuration change, restart/backend replacement | No writes/replay; old reviews/worker results/file targets/native permits rejected | Both |
| Injected migration or reviewed-Apply transaction failure | Backup intact, no partial metadata update or committed notification | #71 |
| Backup/restore of old/new forms, foreign-machine restore, future/unknown evidence version | Matching-version validation; no inferred authority; foreign/unknown evidence requires review or blocks; old binary cannot consume new schema | #71 |
| Same-installation restore versus copied database/export; lost/corrupt local installation anchor | Only surviving matching local anchor retains scope; backup excludes anchor; restore never overwrites it; new/missing anchor requires reviewed scope enrollment only with unchanged sufficient durable evidence, without data loss; old-scope unfinished journals remain reserved/uncertain | #71 |
| Direct service/IPC/retry calls while a consumer is gated | No mkdir/rename/move/archive/restore/category mutation or native/file dispatch, even with a newly enrolled root | #71 |
| New-policy create/rename/category move/category options/removal/archive/restore and group assignment after remount | Same policy at root/all parents/staging/project/destination; preserve IDs, exact names/values/contents, collisions and no-overwrite; fresh reviews | #72 |
| New journals at each process-interruption boundary | Immutable request/evidence; reservations loaded before observation; no replay on status/reconnect; explicit current review to recover | #72 |
| Legacy terminal retry after upgrade | Same stored receipt, no effect, no rewritten history | #72 |
| Legacy unfinished journal, every recorded triple unchanged | Separate explicit reviewed attestation, reservations retained, original stage/ownership checks before any recovery | #72 |
| Legacy unfinished journal with changed recorded `dev` or other conflict | Remains blocked/uncertain, retains reservations; source rebind cannot bless historical evidence | #72; deliberate availability limit |
| Legacy creation intent without destination evidence | Existing `associate_reviewed` only with exact root/parent checks and new per-operation consent; recorded conflicting destination cannot use exception | #72 |
| Same-operation request retry, changed payload, compound category operation and lost response | Original immutable request/ID semantics, no duplicate filesystem effect or receipt, safe reservation handling | #72 |
| Actual native adapter in Node/Electron, dev/package on supported hosts | Evidence provider/loading/resources verified; normal exit/owned cleanup; no renderer Node/db exposure | #71 adapter, #72 native consumer renewal |
| EN/RU recovery at narrow/wide layouts | Reason, impact, explicit mapping/Cancel, preserved values and pending-operation guidance visible; appearance separate from behavior | #71/#72 |

No cross-machine portability, reliable detection of indistinguishable cloned volumes, source relocation/merge, unsupported-provider fallback, or manual release of unprovable journal reservations is promised by this design. These are owner-accepted limits, not passing runtime scenarios.

## Coverage retention and execution seams

Retain public requirements covered by existing discovery/grouped/mode/reconciliation/recovery tests; adapt their identity fixtures to versioned evidence and preserve wrong-volume/substitution rejection. Replace only the obsolete expectation that every cross-run `dev` change means replacement: its new paired checks are sufficient-durable-evidence continuity and legacy/missing-evidence rejection. Keep metadata-only/property/session tests unchanged unless their fixtures need explicit enrollment.

Retain create/rename/category-move/category-removal/archive journal, abrupt-process, reservations, native no-replace, file-tree/target, Reveal, backup/restore and real-SQLite upgrade guarantees. Add gating checks before loosening any discovery path. Do not remove a failed historical assertion without mapping its guarantee to a new public-boundary scenario under [test retention](../development.md#inherited-test-coverage). Apply [CI evidence reuse](../ci.md#evidence-reuse-after-test-only-repairs); use the [desktop UX matrix](../desktop-ux-verification.md) for appearance and native cadence. Schema/native changes in #71/#72 require their actual migration/platform/package checks, not #70's documentation evidence.

#71's first seam is the typed backend evidence provider and policy evaluator; then migration, gated discovery/observation, and reviewed binding. #72's seam is command authorization at root/parent/project/destination plus journal/recovery and trusted native consumers. Use Matt Pocock TDD at those observable seams during implementation. This design task has no production-code seam to run red/green tests against.

## Local verification and handoff status

- [x] Read issue, native/textual dependencies, current project contracts and runtime identity call sites.
- [x] Draft ADR with primary platform references, migration/review policy, capability gates and journal limits.
- [x] Map every acceptance criterion and implementation scenario above.
- [x] Independent Standards and Spec review: Standards 0 findings; Spec found an undefined machine-scope anchor, repaired with its lifecycle, scope-unverified enrollment and paired restore scenarios. Focused re-review confirmed 0 remaining findings.
- [x] Documentation verification: `npm run check:docs` passed (214 Markdown files); both local anchor references and qualified runtime paths were checked; `git diff --check` passed.
- [x] Reviewed proposal and observed documentation verification recorded in the task commit (see GitHub checkpoint for SHA).
- [x] Owner accepted ADR, including its deliberate availability limits, on 2026-10-23.
- [x] Accepted document integrated into `new-workspace` at `e690f8a7`; integrated `npm run check:docs` (214 files) and `git diff --check` passed. Final delivered SHA and publication receipt belong in the GitHub checkpoint.

Current execution/acceptance updates belong in the [GitHub checkpoint](https://github.com/kornouhovas/workspace/issues/70#issuecomment-6368976358). Runtime/type/full-suite/appearance checks are not applicable to this documentation-only change under the project boundary-based verification policy. No new runtime/platform verification is claimed.
