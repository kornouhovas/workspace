# Documentation reconciliation delivery

Status: implemented and verified, 2026-10-08. Tracked by [GitHub Issue #4](https://github.com/kornouhovas/workspace/issues/4), on codex/bb-architecture-workflow. The user authorized all documentation recommendations from the [baseline audit](documentation-audit.md), including historical reductions and concise optional templates. This scope changes documentation/discoverability checks and preserves evidence; runtime, appearance, data migration, merge and release remain separate.

## Preserved baselines

- [Full audit at e291a9c](https://github.com/kornouhovas/workspace/blob/e291a9c43ab3c1e69668f2d4b90ab18bad720865/docs/specs/documentation-audit.md): assessment of all 75 documentation files at 34ad688, five original-checkout variants and the original-only rename contract.
- [Earlier inventory and preliminary 14-body proposal](https://github.com/kornouhovas/workspace/blob/e291a9c43ab3c1e69668f2d4b90ab18bad720865/docs/specs/documentation-cleanup.md): full 74-file inventory, incoming references, original revisions and historical-link limitations.
- Every condensed historical body retains its existing path and a direct link to its complete original at the immutable e291a9c revision. Git history is preserved.
- [Ownership/preservation evidence](../../work/documentation-reconciliation/) records retained duplicated requirements and original-checkout document variants. Evidence is conditional reference material, not a new operational policy.

## Audit recommendation outcomes

| ID | Applied documentation outcome | Separate implementation/acceptance boundary |
| --- | --- | --- |
| D01 | Properties API and architecture distinguish current JSON adapters from target Go/any-store; active write paths are explicit | No adapter switch or data migration |
| D02 | Vision/PRD/data-model body statements describe independent/shared roots and unbound creation | Accepted ADR-006 behavior retained |
| D03 | Data model owns the current/target scope table; APIs reference source-scoped definitions/values/history | Agree any future namespace migration separately |
| D04 | Current fallback/explicit-move identity is separated from Proposed ADR-004 registry and target examples | No registry acceptance, A1 closure or general move/rename guarantee |
| D05 | Active Vision/source-flow/stack references describe allowed Status moves and precise unavailable destinations | No permission for arbitrary filesystem rearrangement |
| D06 | Stale missing-controls list, startup restoration, borderless rows, numeric expression editing, grouping multiplicity, No status and loading/activation exceptions reconciled | No UI changes; original-checkout variants remain versioned separately |
| D07 | Repeated paragraphs have retained owners; Interface/UI/API point to detailed flows and wire contracts | Required geometry, cancellation, safety/recovery and accessibility remain |
| D08 | Standalone Go capabilities and missing view-field round trips are explicit | Future store integration needs parity/migration/recovery checks |
| D09 | Existing sources contract expanded with lifecycle/discovery/filesystem payloads, results, errors, targeting and actual queue limits | No new method/transport/authentication implemented |
| D10 | Historical backlogs are marked; unfinished criteria mapped below; security/design/session evidence retained | No new vulnerability status, native/platform acceptance or stale advisory claims |
| D11 | Imported bb source/license retained byte-for-byte; policy now specifies conditional section access and distinct revisions | No new visual defaults, bb functions or dependencies |
| D12 | Eight historical plan/process bodies condensed; six useful templates retained as concise optional forms | No mandatory intake/report/test ritual; ADR/release forms retained |
| D13 | Exact original documentation diffs/rename source captured with hashes and explicit integration instructions | Original files/deletions untouched; matching product changes reviewed before merge |

The expanded API contract also corrects previously inaccurate queue descriptions and legacy saveProperty alias assumptions. Reads share the current dispatcher queue; picker waits are outside it. Several lifecycle/property writes remain separate commits, not transactions. Documentation does not imply security fixes.

## Requirement ownership

| Requirement family | Canonical owner | Other documents |
| --- | --- | --- |
| Current adapter/scope/identity compatibility | Data model scope table; runtime guide for wiring | API and architecture pointers, plus operation-local safeguards |
| Product purpose and supported actions | PRD; Vision for positioning | Short scope context in specialized contracts |
| Screen composition and project/session navigation | Interface and accepted session ADRs | UI keeps geometry/accessibility; service keeps targeting/results |
| Status drag/picker cancellation, provisional placement, activation | Board/Table flow | Status API retains filesystem/recovery/publication invariants |
| Board card snapshot/padding and component geometry | UI guidelines | Flow/Interface reference visuals; no repeated full paragraph |
| Board grouping/order/wrap interactions | Board/Table flow | View API owns serialization, validation and compatibility |
| Table column resize/restoration and failure handling | Table flow | API owns width keys/limits/merge; UI owns grids/handles |
| Operational policy/checks/tracker | development/rules, quality and agents/issue-tracker | Historical paths/forms link current authority |

[requirements-ownership.json](../../work/documentation-reconciliation/requirements-ownership.json) preserves the baseline repeated text, owner and original locations for all 20 occurrences/groups. Nineteen paragraphs are retained under an owner; the duplicated introductory override is replaced by corrected product body statements and distinct pointers. This evidence permits retention checks without keeping active requirements in four places.

## Historical body reductions

| Preserved path | Treatment and full original |
| --- | --- |
| docs/superpowers/plans/2026-05-14-workspace-views-backend-storage.md | [Short historical pointer](../superpowers/plans/2026-05-14-workspace-views-backend-storage.md); links full original and storage/view requirements |
| docs/superpowers/plans/2026-05-15-workspace-custom-properties.md | [Short historical pointer](../superpowers/plans/2026-05-15-workspace-custom-properties.md); retains property/history acceptance boundaries |
| docs/superpowers/plans/2026-05-15-workspace-frontend-electron-app.md | [Short historical pointer](../superpowers/plans/2026-05-15-workspace-frontend-electron-app.md); retains shell/IPC/native acceptance context |
| docs/superpowers/plans/2026-07-13-russian-localization.md | [Short historical pointer](../superpowers/plans/2026-07-13-russian-localization.md); links ADR/locale flow and original acceptance |
| docs/superpowers/plans/2026-09-18-audit-seven-fixes.md | [Short historical pointer](../superpowers/plans/2026-09-18-audit-seven-fixes.md); A1–A7 remain below and in full backlog/original |
| docs/workflow/codex-chat-workflow.md | [Compatibility pointer](../workflow/codex-chat-workflow.md) to current policy/tracker and original process |
| docs/workflow/task-lifecycle.md | [Compatibility pointer](../workflow/task-lifecycle.md), with current GitHub/Beads ownership |
| docs/workflow/symphony-readiness.md | [Future research pointer](../workflow/symphony-readiness.md); orchestration is separate scope |

Existing historical indexes remain. Useful optional [issue](../templates/backlog-item.md), [bug](../templates/bug-intake.md), [feature](../templates/feature-intake.md), [implementation](../templates/implementation-plan.md), [review](../templates/review-request.md) and [continuation](../templates/session-handoff.md) forms remain. ADR/release templates and frozen reports remain full; review guidance is concise and optional. No document path is deleted or moved.

## Legacy acceptance carry-forward

These rows preserve unfinished requirements for future issue reconciliation. They are not a second live backlog and do not claim completion. Read original requirements only when continuing that work; record current scope/status and verification in GitHub.

| Original work | Requirements retained / unresolved verification |
| --- | --- |
| Views/backend/storage plan | Named client operations; pure view defaults/validation; filtering/projection; Go documents/routes; backend use cases; transport wiring; full acceptance. Standalone store progress is distinct from active Electron wiring and complete current view-field parity. |
| Properties plan | All five types/editors, normalization, system restrictions, select lifecycle/colors, value visibility/projections, history, persistence/restart and visual consistency across Board/Table/details. Confirm lifecycle history, cascade/value-history atomicity and store integration separately; do not infer completion from UI presence. |
| Frontend plan | Preload security, renderer transport, one active surface, real view CRUD, Settings/details, service state and native/error checks. Existing features do not close every old edge/native criterion; source-checkout variants and prior full-suite limitation remain. |
| Localization plan | English fallback/device persistence, complete app-owned RU/EN text coverage, unchanged user text, no data reload/write on locale change; native and regression criteria preserved in full original/backlog and ADR-003/flow. |
| Width requirement | Independent saved Board width, narrow-window scrolling, constraints on new selection, stable existing widths and per-view independence. Current API/flow own behavior; historic width/native acceptance not rerun here. |
| Future Symphony/process research | Preserve scheduling/intake/ownership/recovery requirements at pinned originals. No automation or agent/chat creation is configured by this cleanup. |

### Seven-fix safety requirements

The [full A1–A7 backlog](../backlog/audit-seven-fixes.md) is retained. All seven need current acceptance evidence; no row is closed by this task.

| ID | Required outcome and dependency |
| --- | --- |
| A1 | Accept ADR-004 before registry work. Preserve existing opaque IDs; UUID identities for new registry projects; retain values/history after supported registered-folder rename/move/restart; reject ambiguous matching. Do not reconstruct overwritten metadata or infer complete identity from explicit-move aliases. |
| A2 | Same-root/A → B → A/restart retain view names, filters, visibility, order, Board layout and active view. New default IDs must be unique; retained legacy views are not regenerated. |
| A3 | Same-root reselection and source reversal preserve roles/active selection. Cancellation, invalid paths and write failure keep previous settings. Current independent Workspace bindings supersede the old shared-root-role assumptions. |
| A4 | Distinguish slug collisions, same-name statuses under different groups and a real No status folder. Each project occurs once under Status grouping; filter/color changes target only the correct folder. This does not prohibit Multi-select grouping occurrences. |
| A5 | Removed option ID disappears from current values and filters in every live Workspace of that source. Preserve remaining options/includeEmpty/history; remove empty filter key when includeEmpty=false. Cascades recover after failure and repeat safely. |
| A6 | Initial/bridge/missing-source/corrupt-storage/switch/reload failures show no fabricated projects, roots, Workspaces or views. Retry/Settings and RU/EN remain usable; required native sizes/evidence must be verified separately. |
| A7 | System definition labels survive independent sources, A → B → A and restart. Keep public property:name/property:status IDs and compatible source namespaces. Do not split same-root shared custom data as an extra migration. |

Migration criteria also remain: repeatability, backup/parse/schema/atomic replacement, untouched corrupt JSON, retained values/history, truthful write-failure feedback, compatible rollback and isolated temporary fixtures. Original sequencing/risk details remain in the pinned full plan; subsequent accepted ADRs take precedence over obsolete scope assumptions.

### Evidence and platform limits

Keep the complete dated security report, completed audit plan, Compact edge/handoff/review documents, workspace-460 report, session command/lifecycle verification and all existing work/outputs artifacts. The security report remains its test-coupled 34-Open-finding snapshot; verified remediation/current status belongs in GitHub. Old advisory counts, screenshot checks or compilation results are not current security/native acceptance.

ADR-004 remains Proposed. Linux confined project creation remains the existing workspace-ub5 follow-up; ADR-009 keeps Windows/native limitations. A creation guard decision does not establish acceptance for an arbitrary rename. Session issues #2/#3 retain their branch verification and pre-existing full-suite limitation; parent integration remains open.

## Original-checkout integration exceptions

The [original manifest](../../work/documentation-reconciliation/original-checkout-manifest.json), [five-document patch](../../work/documentation-reconciliation/original-docs.patch.gz) and [exact rename contract snapshot](../../work/documentation-reconciliation/workspace-project-rename.md.txt) preserve the original HEAD/branch, hashes and variants. The snapshot is raw original Markdown with its original relative-path context, not an active API contract at its archive location.

Before merging into that checkout:

1. Review Status-operation rename barriers and data-model aliases/journal with the pending rename implementation; keep containment/recovery/platform requirements separate from project creation.
2. Review native left-header arrangement, visible/hidden property presentation and rename affordances together in Interface/UI guidelines and matching code. Apply the accepted current UI version; do not overwrite it with older branch composition.
3. Review the untracked rename contract with its code/tests; retain its complete source snapshot until it has an accepted integrated version.
4. Reconcile the seven external deletions (five plans and two indexes) against retained compatibility paths and incoming references. They are not automatically staged/restored in the original checkout by this task.
5. Keep unrelated runtime, work evidence and settings untouched. Verify integration as a separate slice; this documentation commit does not merge the two versions.

## Verification

Observed checks passed: node --test test/documentation.test.js test/securityAuditReport.test.js (21/21); all 76 documentation paths retained; local Markdown paths/anchors valid; zero repeated active paragraphs at the audited 180-character threshold; all 20 baseline requirement groups accounted for; all eight full historical originals verified in pinned Git objects. SHA-256 checks preserve 2,386 existing runtime/source/work/outputs files, imported bb source/license, frozen security/design/session reports and ADR/release templates. The original checkout's 59 Markdown files and seven external deletions are unchanged; its additional metadata file is preserved too. Documentation discoverability checks now target active rules/workflow/quality/tracker sources. git diff --check passed. Exact final link counts and preservation results are in the [verification record](../../work/documentation-reconciliation/verification.json). Software/native builds are unnecessary for this documentation-only scope and are not claimed.
