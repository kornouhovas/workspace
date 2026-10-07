# Full documentation audit

Status: analysis delivered for [GitHub Issue #4](https://github.com/kornouhovas/workspace/issues/4). This report proposes reconciliation; it does not apply document removal, change product behavior, approve a migration or close the issue.

## Scope and evidence

Audit date: 2026-10-07. Baseline: `34ad68814e4b4ddd3ff8680d512e7f42befddc31`, branch `codex/bb-architecture-workflow`, isolated worktree. The baseline contains **75 documentation files and 14,585 lines**. Every file is classified below by purpose, authority, current relevance and recommended treatment. The earlier [cleanup inventory](documentation-cleanup.md) covered 74 files at `5981cf9`; its inventory remains a historical snapshot.

The original checkout was inspected separately: 66 documentation paths were recorded, 59 present and seven already deleted outside this task. It includes five modified documentation variants and one original-only, untracked contract at `docs/api/workspace-project-rename.md`; the branch has no rename contract. Thus the audit covers **76 unique document paths**, including the original-only contract. No original-checkout document or deletion is adopted by this report.

Method: inspect document content and relationships, separate accepted decisions from proposals and historical instructions, compare consequential current-runtime claims with selected implementation paths, inspect original-checkout differences, check local Markdown paths/anchors, and identify repeated paragraphs. Historical implementation plans and imported examples are assessed as documentation; their code snippets, execution instructions and old acceptance lists are not rerun as a new implementation task.

The comparison uses the current [IPC dispatcher](../../electron/workspaceIpc.js), [service client](../../src/workspaceServiceClient.js), [JSON view normalization](../../src/workspaceViews.js), [project identity](../../src/workspaceObjects.js), [Go store](../../internal/workspacestore/store.go), [renderer composition](../../src/App.tsx), [surface state](../../src/workspaceAppState.ts), and applicable accepted ADRs. This is a full documentation assessment, not a new security audit, exhaustive behavioral test or native visual acceptance run.

## Result

The documentation contains valuable product contracts, safety constraints and evidence. Most problems are **drift and repeated authority**, rather than useless documents. Removing old plans alone would leave contradictions in frequently read product, API and UI files. Reconcile those contracts first; reduce optional process material afterward.

Keep the current product appearance and own backend. Keep the accepted desktop session boundaries. Future server/mobile web, AI, skills, plugins, marketing-site implementation and Go-store integration remain separate scopes. This report does not import bb functionality or its visual defaults.

Priority **High** below means a documentation ambiguity could lead to an incorrect storage, data-scope or product change. **Medium** means misleading implementation guidance or avoidable maintenance risk. These priorities are not newly confirmed security vulnerabilities.

## Findings and recommended corrections

### D01 — High: current and target persistence are mixed

[Properties API](../api/workspace-properties.md), lines 44 and 524–531, says all durable documents use the local any-store sidecar and that properties.json is only a migration input. The active [IPC dispatcher](../../electron/workspaceIpc.js), lines 94–100 and 371–396, constructs file-backed view/property stores and performs property mutations through them. [ADR-006](../adr/006-workspace-source-bindings.md) explicitly retains these JSON adapters; the [runtime guide](../development/architecture.md) describes them correctly.

Correction: distinguish the implemented Electron persistence path from target durable-store requirements in the API contract. Preserve the target architecture and existing service boundary; do not change adapters to make an aspirational sentence true. Also reconcile the storage-only statements deeper in [architecture](../architecture.md), especially its rules and example flows.

### D02 — High: shared-source assumptions survive the accepted source model

[Vision](../vision.md), lines 42, 64–66, 102 and 135, still describes a single shared project folder. [PRD](../prd.md), lines 19 and 94–97, repeats that assumption. [Data model](../data-model.md), lines 125–126, places independent-root and shared-root rules next to one another. Their introductory override notices help but leave contradictory body instructions available to agents.

[ADR-006](../adr/006-workspace-source-bindings.md) accepts independent Workspace bindings while allowing Workspaces to share a root. The dispatcher resolves the selected Workspace's binding. Replace the old body statements with that model, including first selection, unavailable roots, retained roles and A → B → A recovery. Preserve the existing opaque IDs and source-scoped compatibility namespaces.

### D03 — High: property scope is described as Workspace scope without the compatibility qualification

[Properties API](../api/workspace-properties.md), lines 40–42, and target documents/indexes in [data model](../data-model.md) describe Workspace-scoped definitions and values. The current dispatcher computes sourceFolderId at line 251 and passes it as propertyScopeId at lines 380 and 394. Several Workspaces bound to the same root therefore share project/property data. This is explicitly retained by ADR-006, not an incidental new migration in this branch.

Correction: document a scope table for current source-scoped properties/project values/history, per-Workspace views/session, device preferences, and target-store documents. Resolve target scope during a separately reviewed integration/migration decision. Do not silently split existing values or infer a migration from the target examples. The historical SEC-030 finding also needs this later decision; changing prose does not close a security finding.

### D04 — High: stable identity is a target, not a complete registry implementation

[Data model](../data-model.md), line 287, illustrates stable project:<uuid> identity. Its later transitional section records operation-specific projectLocators. [ADR-004](../adr/004-project-identity-and-audit-migrations.md) remains **Proposed**. [workspaceObjects](../../src/workspaceObjects.js), lines 109–111, still generates fallback identity from the locator; explicit locators preserve identity for known Status operations. That is not a complete reconciler for arbitrary external folder moves/renames.

Keep the target model and proposed ADR, but state current identity guarantees and limitations together. Preserve opaque-ID use by consumers, values and history. Do not present a general registry or original-checkout rename implementation as integrated on this branch, and do not declare audit A1 resolved from these partial mechanisms.

### D05 — High: obsolete Status-move prohibitions remain in active references

[Vision](../vision.md), line 178, and [source/roles flow](../flows/settings-source-folder-and-roles.md), line 29, prohibit primary-Status drag. [bb stack guide](../design/bb-stack-design.md), line 30, says that restriction is retained. These conflict with accepted [ADR-007](../adr/007-board-table-status-moves.md), [ADR-008](../adr/008-table-row-order.md), and the existing [Status move API](../api/workspace-status-move.md).

Replace the prohibitions with precise allowed actions: eligible Status-group Board drops, Table rank changes and permitted explicit Status-group crossings through the existing service. Preserve unavailable No status destinations, custom-property crossing restrictions, source validation and recovery. Historical prohibitions in old plans remain historical; they should not become current policy again.

### D06 — Medium: UI contracts contain stale implementation gaps and conflicting exceptions

[Interface](../interface.md), line 58, calls Workspace rename/delete/reorder future work, although [service methods](../../src/workspaceServiceClient.js), lines 110–123, and renderer handlers exist. Lines 366–380 label established shell, view creation and project-opening behavior as current gaps. Those undated statements can trigger unnecessary reimplementation. Reconcile each item against current acceptance evidence; implementation presence alone is not proof that every UI scenario passed.

Other concrete inconsistencies require consolidation:

- Interface line 254 says one row per project, while later Multi-select grouping permits several occurrences with unique project totals.
- Interface line 327 requires a bordered hidden-properties table, while the compact property contract describes borderless rows. The original checkout already changes this paragraph; preserve that variant during integration.
- Interface's startup acceptance omits valid saved-session restoration, which its startup section and ADR-011 permit.
- [UI guidelines](../ui-guidelines.md), line 263, prescribes numeric inputs, although the Numbers contract supports expression editing.
- Earlier Status descriptions include a disabled No status choice; later descriptions omit it. The [picker](../../src/components/workspace/project-status-picker.tsx), line 46, filters that destination out. Distinguish the service's disabled option metadata from the actual menu.
- [Status API](../api/workspace-status-move.md), line 52, describes a grouped-Table loading surface, while later UI/flow sections retain an inert confirmed surface during saved-view activation. Document initial loading and activation separately using the current surface-state model.

These are documentation corrections to existing behavior, not authorization to change appearance or add features.

### D07 — Medium: interaction prose is copied between four authorities

The active-document scan found **20 exact repeated paragraphs of at least 180 characters**, after excluding fenced examples, historical plans/reports, templates and imported bb rules. For example, the 1,327-character Table drag paragraph appears in Interface, UI guidelines, Board/Table flow and Status API. Board grouping, wrapping, cancellation and saved-view activation are also repeated.

Copying complete interaction requirements makes a later amendment easy to miss. Keep one owner for each requirement, with short links from other documents and the essential guardrails needed locally. Do not replace detailed flows with vague summaries or merge all documentation into one file.

### D08 — High before store integration: Go capability inventory and view schema need reconciliation

[Architecture](../architecture.md), lines 161–176, calls Workspace/View/property-definition/select/history documents future sidecar capabilities. [Go store](../../internal/workspacestore/store.go) already defines these families and operations. The missing work is not identical to the old list: active Electron integration remains absent, and current view preferences are not fully represented in the target Go schema.

At the baseline, Go ViewDocument has grouping, property layout and Board column width, but lacks the current JSON view fields rowOrder, columnOrder, hiddenColumnIds, tableColumnWidths and boardGroupingVersion. BoardLayoutDocument has no wrapContent. [Views API](../api/workspace-views.md), lines 625–682, correctly records these additive JSON preferences. This static comparison identifies an integration/round-trip risk; it is not a current JSON-runtime data-loss reproduction.

Replace the capability list with implemented standalone operations, active wiring, schema parity gaps and pending lifecycle/migration work. Before switching stores, verify round trips for every persisted view field and retained unavailable IDs. Keep project-creation CLI helper use distinct from HTTP storage integration.

### D09 — Medium: several existing internal service methods lack complete contracts

The API folder covers properties, views, Status moves, and a short sources/session contract. Workspace update/reorder/delete/activation and file-tree/preview/reveal behavior are described informally in other documents but lack a comparable consolidated request/response/error contract. These existing [service methods](../../src/workspaceServiceClient.js) matter to future transport adapters.

Extend the existing sources contract or add a focused lifecycle/filesystem contract when reconciling those boundaries. Include explicit Workspace targeting, deletion-without-user-file-removal, cancellation, missing sources/projects and stale request handling. Do not create a separate document for every widget, or treat future HTTP transport as already accepted/implemented.

### D10 — Medium: history must not be interpreted as a current completion ledger

Legacy backlog items and plans contain old current-state assertions, unchecked steps and unresolved acceptance criteria. Frontend/property/storage functionality has progressed since their snapshots; a checked implementation path cannot prove complete plan acceptance. The seven-fix plan explicitly leaves registry A1 dependent on Proposed ADR-004. The Compact reports preserve unverified native/edge checks and old visual values; they are already marked historical and should stay that way.

The [security report](../security/20260923-project-security-audit.md) records baseline `7e5add7`, a dated threat model and 34 Open findings. [Report tests](../../test/securityAuditReport.test.js), lines 162, 173 and 449, enforce its baseline, finding count and Open-status snapshot. Preserve it as a historical evidence artifact. Track remediation/current security status separately with fresh verification; do not casually edit its statuses, classify all findings as current vulnerabilities or repeat its old dependency advisory counts as current results.

The completed security plan, Compact matrices, workspace-460 report and session verification records should retain their limitations. Preserve the open Linux creation follow-up and separate Windows/native verification limits; a platform exception for creation does not automatically authorize a different rename operation.

### D11 — Medium: imported bb rules need conditional access and clear provenance

[DESIGN_RULES](../development/DESIGN_RULES.md) is a 1,547-line pinned reference with source links, a CSS appendix and license text. It includes composer, streaming, diff, mobile overlays and plugin guidance outside the present Workspace scope. Its own AI instruction calls it the main visual specification; current [adaptation policy](../development/design/bb-workspace-policy.md) correctly limits its authority and preserves Workspace-specific contracts.

Retain the full imported source and license, keep the short policy mandatory for UI, and reach only relevant source sections conditionally. The file hash matches the existing applicability record: `3b52eb4451902dc7e4363dd42dead1b8cf9b9f60e165e181efd415f79a797b2c`. Its bb source revision differs from earlier stack research and later architecture research because they are separate snapshots. Keep each revision explicit; do not claim all references describe one current bb release. No new external-source or native screenshot equivalence is claimed here.

### D12 — Medium: the preliminary reduction list should not imply templates are useless

The earlier proposal selects five large historical plans, three old workflow/orchestration guides and six templates for replacement with pointers. Low incoming-reference counts do not prove disuse, and the full audit does not justify removing useful intake/review/handoff forms merely because they are optional.

Revised recommendation: keep useful templates in concise, explicitly optional form; link current policy instead of repeating gates. Consider historical plan/process body reduction only after unresolved criteria, provenance and pinned full originals are mapped. Keep the ADR and release templates. A release checklist can retain stricter release checks without making every prose edit run them. Keep the existing review protocol optional and its findings-first advice.

### D13 — High at integration: original-checkout documentation is a separate version

Original modifications affect Status move, data model, Board/Table flow, Interface and UI guidelines. They include a rename barrier and journal/locator rules, native left-header arrangement, visible/hidden property presentation and a project rename affordance. The original-only rename API has its own validation, containment and recovery requirements. These are not redundant with this branch's session work or safe to overwrite with a cleaned older document.

Preserve all five variants and the untracked contract until their corresponding product changes are reviewed together. The seven already absent superpowers paths are external deletions, not this audit's cleanup result. Reconcile them explicitly before merging the branch; do not stage them as part of this task.

## Authority and duplication map

| Question | Canonical owner | Other documents should retain |
| --- | --- | --- |
| Working policy, authorization, commits | development/rules.md, reached through AGENTS.md | Short context-specific links; no duplicated general gates |
| Task scope/status and acceptance | GitHub Issues plus originating versioned spec | Auxiliary Beads execution notes; historical baselines |
| Product purpose, supported behavior, exclusions | PRD; Vision for positioning | Essential scope reminders, links to detailed flows |
| Screen composition and navigation | Interface | References to state transitions and visual exceptions |
| Ordered interactions, cancellation/recovery, navigation races | Relevant flows | API safety invariants; concise UI state descriptions |
| Tokens, density, visual states, keyboard/accessibility rules | UI guidelines plus bb adaptation policy | Product-specific exceptions and source attribution |
| Payloads, errors, validation, operation outcomes | API contracts | Links from UI/flows, without copied geometry prose |
| Document shapes, scopes, lifetimes and compatibility | Data model | Current/target distinction in runtime guide and APIs |
| Accepted decision rationale and supersession | ADRs | Accurate status references; do not rewrite accepted history |
| Current runtime wiring and target migration boundaries | development/architecture.md and reconciled architecture.md | Explicit implementation evidence, versioned future gaps |
| Historical security/visual/test evidence | Original reports and work artifacts | Links and limitations; current remediation tracked separately |

## Complete per-file disposition

**Keep/reconcile** means retain the document's purpose while correcting the identified drift. **History** means preserve requirements/evidence without treating old execution instructions as policy. **Optional** means read only when needed; it does not mean disposable. These are recommendations, not applied changes.

### Product, architecture and flows — 9 files

| Path | Role and assessment | Recommended treatment |
| --- | --- | --- |
| `docs/vision.md` | Product positioning; shared-source and Status exclusions conflict with accepted behavior | Keep/reconcile D02, D05; link PRD/flows for mechanics |
| `docs/prd.md` | Main product contract; useful requirements, old root assumptions remain | Keep/reconcile D02; remove duplicate mechanics after D07 mapping |
| `docs/architecture.md` | Layer/target guide; current notice is correct, deeper store/capability prose is stale | Keep/reconcile D01, D04, D08; narrow already-addressed follow-ups |
| `docs/data-model.md` | Target schema plus current compatibility additions; adjacent contradictory roots and ambiguous scopes | Keep/reconcile D02–D04, D08; explicit current/target scope table |
| `docs/interface.md` | Screen composition; useful current appendices, obsolete gaps and conflicting early rules | Keep/reconcile D06; consolidate D07; preserve original D13 variant |
| `docs/ui-guidelines.md` | Visual/component contracts; interaction repetition and numeric-input exception | Keep/reconcile D06–D07; preserve original D13 variant |
| `docs/flows/board-table-views.md` | Detailed views/grouping/drag/wrap interactions and error states | Keep as interaction owner; deduplicate D07; preserve rename variant |
| `docs/flows/settings-source-folder-and-roles.md` | Source selection/roles recovery; obsolete Status-drag assumption | Keep/reconcile D05; retain unavailable-root and role safeguards |
| `docs/flows/language-selection.md` | Locale selection/persistence and error behavior | Keep; aligns with ADR-003, no new locale feature required |

### Architecture decisions — 11 files

| Path | Role and assessment | Recommended treatment |
| --- | --- | --- |
| `docs/adr/001-local-first-workspace-storage.md` | Accepted target any-store decision; shared-source premise superseded | Keep rationale; clarify supersession/current wiring via ADR-006 |
| `docs/adr/002-electron-preload-ipc-bridge.md` | Accepted transport/security boundary, implemented | Keep; core renderer/backend constraint |
| `docs/adr/003-renderer-localisation-catalogs.md` | Accepted device-local locale/catalog design | Keep; avoid duplicating flow details |
| `docs/adr/004-project-identity-and-audit-migrations.md` | Proposed registry/conservative migration; not fully integrated | Keep Proposed; preserve decision dependency, D04 |
| `docs/adr/005-bb-pane-session-chrome.md` | Accepted pane/session chrome rationale | Keep; relate to accepted command/lifecycle evolution |
| `docs/adr/006-workspace-source-bindings.md` | Accepted independent roots and compatible source-scoped metadata | Keep; authoritative resolution of D01–D03 |
| `docs/adr/007-board-table-status-moves.md` | Accepted explicit Status actions and exclusions | Keep; authoritative resolution of D05 |
| `docs/adr/008-table-row-order.md` | Accepted Table rank and explicit group crossing | Keep; distinct rank versus filesystem mutation |
| `docs/adr/009-project-creation-os-guard.md` | Accepted creation confinement with explicit platform limitations | Keep; preserve pending Linux/native evidence, D10 |
| `docs/adr/010-renderer-session-command-owner.md` | Accepted pure owner implemented on this branch | Keep; links verification, does not claim original-checkout integration |
| `docs/adr/011-renderer-session-lifecycle.md` | Accepted lifecycle/storage/freshness adapters on this branch | Keep; preserve storage compatibility and composition boundaries |

### API contracts — 4 files

| Path | Role and assessment | Recommended treatment |
| --- | --- | --- |
| `docs/api/workspace-properties.md` | Detailed property operations/errors; current store and scope claims need correction | Keep/reconcile D01, D03; preserve validation/history requirements |
| `docs/api/workspace-session-sources.md` | Short implemented source/session operations contract | Keep/extend lifecycle and filesystem coverage under D09 |
| `docs/api/workspace-status-move.md` | Filesystem move safety/recovery plus copied visual prose | Keep service contract; reconcile D06–D07 and original rename barrier |
| `docs/api/workspace-views.md` | Views/projection/creation contracts and additive preferences | Keep; separate appendices into coherent topics, retain all D08 fields |

### Agent setup and development guidance — 13 files

| Path | Role and assessment | Recommended treatment |
| --- | --- | --- |
| `docs/agents/domain.md` | Small task-specific domain/source pointers | Keep conditional entry point; no extra process layer |
| `docs/agents/issue-tracker.md` | GitHub primary, Beads auxiliary, private repository and artifact language | Keep as tracker authority |
| `docs/agents/triage-labels.md` | Small issue labeling guide | Keep when triaging; labels do not create another backlog |
| `docs/development/README.md` | Mandatory source map/discoverability | Keep; point to completed audit and reviewed cleanup state |
| `docs/development/rules.md` | Current operational authority, overrides old plan gates | Keep; future wording simplification is optional, not a policy redesign |
| `docs/development/workflow.md` | Short current task/tracker/commit guidance | Keep; already suitably concise |
| `docs/development/quality.md` | Risk-based checks and evidence limits | Keep; distinguish docs checks from software/native verification |
| `docs/development/product.md` | Short accepted product boundaries and Status actions | Keep; current clarification is useful |
| `docs/development/architecture.md` | Accurate current JSON runtime/session and target-store distinction | Keep; preferred quick implementation map, D01/D08 |
| `docs/development/design/README.md` | Short UI entry/source map | Keep; relevant contracts before imported source |
| `docs/development/design/bb-workspace-policy.md` | Workspace-specific adaptation/provenance authority | Keep mandatory for UI; do not expand mobile/chat scope |
| `docs/development/DESIGN_RULES.md` | Pinned bb reference, CSS and license; broader than product | Keep full reference, reach sections conditionally, D11 |
| `docs/development/workspace-460-report.md` | Historical workflow setup/review and unresolved acceptance | Keep history; optional links rather than mandatory report template |

### Backlog context — 7 files

| Path | Role and assessment | Recommended treatment |
| --- | --- | --- |
| `docs/backlog/README.md` | Historical-context index, correctly points to GitHub | Keep short index |
| `docs/backlog/audit-seven-fixes.md` | A1–A7 preservation/acceptance requirements, partially unresolved | Keep history and unresolved mapping, D04/D10; do not declare all done |
| `docs/backlog/board-column-width-control.md` | Original width requirement and acceptance context | Keep history; current width contract belongs in API/flow/UI |
| `docs/backlog/russian-localization.md` | Original locale scope/acceptance | Keep history; current ADR/flow own behavior |
| `docs/backlog/workspace-custom-properties.md` | Valuable property requirements; old current-state assertions | Keep history, map unresolved criteria before condensing, D01/D10 |
| `docs/backlog/workspace-frontend-electron-app.md` | Original dashboard-to-product scope; obsolete implementation-state claims | Keep history, not current implementation checklist, D06/D10 |
| `docs/backlog/workspace-views-backend-storage.md` | Original service/store scope and acceptance | Keep history; distinguish standalone store work from active wiring, D08 |

### Design research and evidence — 4 files

| Path | Role and assessment | Recommended treatment |
| --- | --- | --- |
| `docs/design/bb-stack-design.md` | Pinned stack/dev-profile research; one obsolete Status restriction | Keep/reconcile D05; retain source revision and isolation limits |
| `docs/design/compact-edge-matrix.md` | Historical edge cases and observed/tested/unverified evidence | Keep full evidence; useful future checks without old visual authority |
| `docs/design/compact-implementation-review.md` | Historical implementation review and native verification gaps | Keep full history/limitations, D10 |
| `docs/design/compact-redesign-handoff.md` | Historical design rationale, actions/source map and proposals | Keep as evidence/reference; old dimensions/prompt are not new policy |

### Security and completed analysis — 2 files

| Path | Role and assessment | Recommended treatment |
| --- | --- | --- |
| `docs/security/20260923-project-security-audit.md` | Baseline-pinned 34-finding evidence with report-test coupling | Keep full frozen report, D10; remediation tracked separately |
| `docs/plans/completed/20260923-project-security-audit.md` | Completed audit plan and check history, old mandatory task gates | Keep history; do not inherit its per-task full-suite requirements |

### Current specifications and verification — 5 files

| Path | Role and assessment | Recommended treatment |
| --- | --- | --- |
| `docs/specs/bb-architecture.md` | Approved session slice, boundaries and future exclusions | Keep; current implementation is separate from future web/server work |
| `docs/specs/bb-architecture-tickets.md` | Issue #2/#3 delivery and open #4 scope | Keep/update full-audit progress; do not close #4 from analysis alone |
| `docs/specs/documentation-cleanup.md` | Prior complete path inventory but preliminary semantic reduction list | Keep baseline evidence; qualify list using D12 and this report |
| `docs/specs/session-commands-verification.md` | Versioned commands/native checks and pre-existing full-suite limitation | Keep evidence; do not claim its checks were rerun for this audit |
| `docs/specs/session-lifecycle-verification.md` | Versioned storage/race/native review and reproduction | Keep evidence; preserve review regression and limitations |

### Legacy plans and indexes — 7 files

| Path | Role and assessment | Recommended treatment |
| --- | --- | --- |
| `docs/superpowers/plans/README.md` | Correct historical-plan pointer/current-policy notice | Keep path/index; original external deletion needs integration review |
| `docs/superpowers/specs/README.md` | Compatibility pointer to current specs/policy | Keep path/index; original external deletion is outside this audit |
| `docs/superpowers/plans/2026-05-14-workspace-views-backend-storage.md` | 1,706-line executable historical plan with storage code examples | Candidate history pointer after acceptance mapping; preserve full Git original |
| `docs/superpowers/plans/2026-05-15-workspace-custom-properties.md` | 823-line historic property/store/UI plan with old execution gates | Candidate history pointer; retain unresolved store integration requirements |
| `docs/superpowers/plans/2026-05-15-workspace-frontend-electron-app.md` | 800-line initial frontend/IPC plan, now largely stale as instructions | Candidate history pointer; preserve acceptance/evidence context |
| `docs/superpowers/plans/2026-07-13-russian-localization.md` | Shorter historic locale implementation plan | Optional history pointer after linking ADR-003/flow/full original |
| `docs/superpowers/plans/2026-09-18-audit-seven-fixes.md` | 504-line coordinated safety plan; A1/ADR-004 decision still matters | Candidate reduction only with explicit unresolved A1–A7 mapping |

### Optional templates — 8 files

| Path | Role and assessment | Recommended treatment |
| --- | --- | --- |
| `docs/templates/adr.md` | Decision context/options/consequences form | Keep optional; useful for consequential decisions |
| `docs/templates/backlog-item.md` | Older local-backlog form | Condense as optional issue drafting aid; GitHub owns scope/status |
| `docs/templates/bug-intake.md` | Reproduction/impact/evidence form | Keep concise optional form; normal bug reports need no ritual |
| `docs/templates/feature-intake.md` | Scope/acceptance/tradeoff form | Keep concise optional form; existing conversation can supply inputs |
| `docs/templates/implementation-plan.md` | Test-first execution form with broad verification repetitions | Condense optional; select checks by affected boundary, D12 |
| `docs/templates/release-checklist.md` | Release scope/risk/rollback decision form | Keep optional release-specific requirements; no implied release authorization |
| `docs/templates/review-request.md` | Review context/checks/risk form | Keep concise optional; useful explicit review input |
| `docs/templates/session-handoff.md` | Continuation/evidence/state form | Keep concise optional; avoid mandatory ceremony for ordinary tasks |

### Workflow references — 5 files

| Path | Role and assessment | Recommended treatment |
| --- | --- | --- |
| `docs/workflow/codex-chat-workflow.md` | Old chat/intake/backlog execution process | Candidate historical pointer to current rules/tracker |
| `docs/workflow/quality-gates.md` | Five-line pointer to current quality authority | Keep; further reduction offers no meaningful benefit |
| `docs/workflow/review-agent-protocol.md` | Optional findings-first review format with historical plan inputs | Keep concise optional; current issue/spec instead of obligatory legacy plans |
| `docs/workflow/symphony-readiness.md` | Future orchestration exploration/requirements | Candidate history/future-reference pointer; not current execution authority |
| `docs/workflow/task-lifecycle.md` | Older tracked states/intake/handoff process | Candidate historical pointer; GitHub owns completion state |

### Original-checkout-only contract and variants

| Path | Observed state | Treatment |
| --- | --- | --- |
| `docs/api/workspace-project-rename.md` | Untracked contract for existing-folder rename, containment and recovery | Preserve original bytes; review with rename implementation before integration |
| `docs/api/workspace-status-move.md` | Modified with rename-operation barrier reference | Preserve variant and barrier requirements |
| `docs/data-model.md` | Modified with rename aliases/journal compatibility | Preserve data/identity implications; reconcile with D03/D04 |
| `docs/flows/board-table-views.md` | Modified with project rename interaction | Preserve; do not imply it is implemented on this branch |
| `docs/interface.md` | Modified native header/property composition and rename affordance | Preserve accepted current appearance during integration |
| `docs/ui-guidelines.md` | Matching modified header/property/rename guidance | Reconcile with Interface together, not independently |

## Ordered reconciliation plan

1. **Correct active contradictions first:** D01–D06 and D08. Update current/target storage, source/scope rules, precise Status permissions, current UI exceptions and sidecar parity inventory. Preserve existing behavior; resolve consequential migration choices separately.
2. **Consolidate repeated contracts:** build a requirement-to-owner map for D07 before cutting paragraphs. Keep API safety/recovery, flow cancellation/async states and UI accessibility/geometry in their proper owners. Expand D09 only for existing service boundaries that need contracts.
3. **Review historical reductions:** keep the eight historical plan/process candidates from the preliminary list for individual review. Map unfinished A1–A7, native/security limitations and existing incoming references; retain pinned full originals and compatibility paths. Prefer concise useful optional forms for the six template candidates, instead of replacing every template with a pointer.
4. **Preserve evidence and variants:** keep ADRs, security/Compact/session reports, license text, work/outputs artifacts and original-checkout changes. New prose uses technical English; wholesale translation of frozen historical documents is unnecessary.
5. **Verify and deliver each approved slice:** compare retained requirements, check all affected local paths/anchors and documentation tests, inspect diff/whitespace, commit only task changes and update GitHub #4. Closing an auxiliary Beads audit step does not close the cleanup issue. Integration remains separate; no merge or release is included.

## Verification and limits

Baseline scan: all 75 files; **330 inline local Markdown links**, including **48 Markdown fragment links**, with **zero missing paths or anchors**. The scan excludes fenced code examples and checks heading/explicit-anchor targets. It is not a renderer-level Markdown parser or proof that every plain-text path, external link or example command is valid. It recorded 161 external links; external targets and upstream bb claims were not comprehensively revalidated for this local audit.

The baseline duplicate scan found 20 repeated active prose paragraphs as described in D07. Historical work snapshots' 47 unresolved path-link occurrences remain recorded in the earlier cleanup inventory; they are outside the docs-folder result and are not rewritten here.

Delivery checks passed: all 75 baseline paths occur once in the per-file matrix; the original-only rename contract is assessed separately. After adding this report/navigation links, all 76 branch documents have 374 valid inline local links, including 48 fragment links. `node --test test/documentation.test.js test/securityAuditReport.test.js` passed **21/21 checks**; this validates documentation/report constraints, not current security remediation. `git diff --check` passed.

SHA-256 comparison confirms 72 baseline documents unchanged, with only three navigation/proposal files updated and this report added. All 66 recorded original-checkout document states remain unchanged: 59 present files have identical bytes and seven external deletions remain absent. Source contracts, imported rules, plan/template bodies, runtime code and evidence artifacts are untouched. No software build, new native UI acceptance, dependency advisory scan, Linux/Windows containment exercise or general security remediation is claimed.
