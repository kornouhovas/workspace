# Issue 72: Durable filesystem command safety

Issue: https://github.com/kornouhovas/workspace/issues/72.
Baseline: verified `new-workspace` `61c4c0bd`; task branch
`codex/issue-72-command-safety`. #71 is closed and delivered; the native and
textual dependency agree. No parent or competing checkpoint exists.

## Scope and seams

Implement ADR 0009's effect and interrupted-operation boundaries. Public service
commands with disposable real SQLite/filesystem roots are the accepted TDD seam
specified by the #70 handoff. Native adapters/IPC and real process restart retain
their own checks; simulated remount observations do not establish native-platform
acceptance. Preserve old journal bytes, receipts and unfinished reservations.

## Scenario inventory

- Create: direct/grouped enrollment, changed prior device number, fresh root and
  parent observations, wrong volume/folder/scope, containment, aliases, collisions,
  immutable intent and destination evidence, uncertain mkdir and explicit recovery.
- Rename/move/category operations: root, every parent/project/staging/destination,
  no-replace native boundary, compound removal, preserved IDs/values/contents.
- Archive/restore: designated location, original and recreated parents, append-only
  evidence, missing/colliding destination and explicit consequences.
- Recovery: old/new journals; exact legacy triples including dev; separately
  reviewed attestations; immutable terminal retry; restart and review remount;
  no automatic effects or release of uncertain reservations.
- Native/file routes: trusted current targets, generation/token invalidation,
  backend-enforced capabilities; renew actual macOS and Windows consumers.
- Storage: additive migration, old/new upgrade/restore, schema inventories,
  malformed/future evidence rejection and preserved journal/metadata contents.
- Transport/UI: valid payload no-effect checks for remaining gates; EN/RU reasons
  and operation recovery; independent property revision semantics remain.

## Coverage and delivery

Retain #71's safety gates per unconverted boundary. Adapt its creation-denial
expectation only after production creation/recovery safety is covered. Retain
lower-engine filesystem/native/crash suites until corresponding public service
coverage replaces the same guarantee. No skips or blanket retirement of failed
inherited scenarios. The late `keep_original` observer transition deferred by #71
must be renewed at the production API when its boundary is converted.

Run focused red/green and typechecks per slice. Reconcile migration fixtures before
final review. Independent Standards/Spec review, final full suite, actual supported
platform/native/package evidence and conditional integration remain required.
Push/Actions authorization is not inferred from #71's separate conversation.

## Progress

Implementation started; no #72 runtime acceptance claimed. Exact checkpoints and
commit/CI status belong to the issue. No live-data repair, main merge or release.

### First slice: creation candidate

Converted the production creation/recovery entry points. New journal authorization
and destination evidence are additive (0025); legacy columns/history remain
unchanged. Durable enrollment authorizes a fresh current-mount snapshot, never a
cross-run native comparison. Explicit recovery holds full destination evidence,
source generation and reservations. Separate append-only attestations authorize
provable old journals; a legacy dev mismatch remains unresolved after source
rebinding. Terminal original-request retries remain read-only. Pending ownership
vetoes include durable destination and attestation evidence across remounts.

Coverage decisions: adapt the #71 blanket creation gate to creation-specific
safety/recovery checks (`durable-project-creation.test.mjs`); retain all remaining
gates. Retain creation engine/crash cases, renew production observation during
mkdir and preserve no-effect stale-token observer checks. Historical schema
inventories add exact NULL creation evidence defaults and an empty attestation
table; rewind fixtures remove 0025 objects before replaying historical migrations.
The Windows command resolver follows discovery's non-exclusive descendant route;
its portable counter control went red (one forbidden native call), then green.

Observed on macOS arm64 with Node 22.21.1: fresh build/typecheck passed;
234/234 creation, crash, observer, source-binding, backup and engine-boundary checks
passed on the repaired source. Prior migration pass: 734 tests, 733 passed, one
existing skip, zero failures/cancellations; later ownership/backup/Windows-route
repairs renewed the affected 234 checks and require final migration renewal.
Standards/Spec review found parser, target-review, pending-ownership and backup
coherence defects; public red/green regressions and focused follow-ups repaired
them. Follow-ups report no remaining defect in the specific repairs, not issue
acceptance. Initial migration run (19 failures) and intermediate focused failures
are diagnostic evidence, not accepted results. Full final suite, native/Electron,
Windows hosts, package/CI and the other command families remain outstanding.

### Second slice: rename and reservation continuity candidate

New migration0026 retains nullable legacy fields and adds immutable rename
root/parent/project authorization plus append-only reviewed attestations. Production
rename uses sufficient enrolled evidence to acquire a current execution snapshot;
case-only staging, no-replace effects, receipts and original native history remain.
New-policy recovery reacquires mounts through a fresh explicit review and retains
all recorded durable identities. Legacy recovery requires exact original triples.
A legacy grouped parent can be inspected under that operation's exact-triple
review; this does not enroll the category or its other children globally. Once the
operation settles, ordinary category enrollment is separately available. Real
0023 creation/rename upgrades exercise this route.

Retained legacy inode/birthtime ownership vetoes are independent of device-number
namespaces. Durable operation evidence and attestation targets now reach discovery,
observation and explicit source mappings even after an object moves beyond its
recorded paths. Unprovable legacy native evidence also remains a veto, never an
execution permit. Root-only enrollment cannot adopt a folder physically reserved
by an unfinished operation. These guards never rewrite journals or release IDs.

Adapted blanket rename-denial cases to actual public production/IPC rename,
missing-target no-effect refusal and private-data non-disclosure; remaining move,
category, archive and native/file consumers stay gated. Backup tests reject future,
incomplete or contradictory rename authorizations and attestation targets while
matching current snapshots restore successfully. Historical fixtures retain exact
NULL additive defaults and empty attestation tables.

Observed local evidence on Node22.21.1/macOS arm64: 280 retained rename/new-command
checks passed before subsequent review repairs; 142 production/IPC/observer checks
passed after grouped-parent/ownership repairs. The final affected creation/rename,
real legacy upgrade, source binding, observer, engine/crash/IPC and backup set passed
401/401 after the root-reservation repair. Latest dedicated migration pass:753 tests,
752 passed, one existing skip, zero failures/cancellations, before the final narrow
root-veto repair; its affected evidence is renewed by the 401-check set. Earlier
migration run750 had one obsolete gate expectation; it was adapted to actual
missing-target refusal and preserved filesystem safety. No new skip/retirement.

Standards/Spec review repaired grouped legacy-parent deadlock and historical
ownership gaps; follow-ups found no remaining defect in those repairs. Additional
public red/green regressions repaired moved pending objects and reserved-root
adoption. Narrow follow-up found no remaining concrete veto defect. This is still
not whole-issue or platform acceptance: move/category/archive/restore, native/file
consumers, final full suite, native Electron/Windows/package/CI and integration
remain outstanding. No push, main merge, release or owner live-data repair.

### Third slice: two-parent category moves

Production moves and explicit recovery now pin both parent authorizations to one
source generation and root/mount snapshot. Migration0027 adds immutable nullable
original/destination authorization and project evidence, plus append-only recovery
attestations. Cross-run recovery renews mounts while preserving original durable
proofs and journal bytes. Authentic0023 grouped moves retain exact legacy triples
and operation-only parent consent. Scoped pending moves remain reserved after
anchor loss and root-only rebinding. Metadata IDs, property values, native
no-replace behavior, original retries and the compound-removal child exception
remain intact.

Coverage decisions: replace the obsolete production move-denial expectation with
an actual compiled production IPC move and private-proof non-disclosure. Move the
remaining blanket denial checks to archive/native/file/category boundaries.
Retain legacy engine/crash checks and add a separate production crash matrix,
including forced parent termination before native effect, after native effect,
after destination evidence and after commit. Restore the deferred production
`keep_original` oracle with a genuinely delayed pre-settlement scan and sibling
projections; the late scan cannot reintroduce ambiguity/degraded state.

Backup controls reject inconsistent two-parent roots, missing/future proofs,
mutated attestation requests and contradictions in previously recorded native
history. Shared creation/rename history-retention controls went red before the
validator repair. Invalid source-generation text and malformed NTFS GUIDs also
went red before their narrow validation repairs. Existing schema/default/rewind
fixtures explicitly cover migration0027; no new skips or blanket retirements.

Observed Node22.21.1/macOS arm64: typecheck, lint and fresh build passed; affected
public/engine/backup/runtime set225/225, transport/source/fixture set60/60 and
production plus legacy crash matrix12/12 passed. The expanded durable move set
passed23/23, including created/volume/scope substitutions for root, both parents
and project with no native dispatch. Migration renewal766 tests:765 passed, one
existing skip, zero failures/cancellations. That run precedes only the additional
crash/substitution test coverage, whose affected checks passed separately.
Standards/Spec reviews found no concrete remaining defect in the move slice.

This is not whole-issue acceptance. Category folder/removal, archive/restore,
project reassociation and native/file consumers remain gated. Final review/full
suite and actual macOS/Windows Electron/package/CI evidence remain outstanding;
modeled remounts and Node-native process crashes do not establish Windows or
Electron acceptance. No feature push or integration has occurred.

### Fourth slice: explicit project reassociation

Production retained-project recovery now requires verified source authorization,
fresh root/parent/target proofs and source evidence generation. A single-use review
pins the complete native scan, sufficient full durable observations, associations,
reservations and policy. Apply reacquires separate evidence before/inside/after
the transaction. Existing grouped parents must already be verified; an explicitly
selected new parent and selected project are enrolled together without discovering
its other children. Commit advances evidence generation and discovery revision
once. IDs and authored values remain; SQL failures roll back enrollment.

Review found duplicate durable candidate IDs could bypass the complete-scan veto,
and repeated full inventories caused quadratic native acquisitions. Direct child
and new grouped-parent collision controls plus a bounded native-read counter went
red before repair, then green. Inventory/parent caches belong to a single newly
created scan only; no observations cross preview/Apply or transaction phases.
Root ownership and generation-increment controls also went red before their
repairs. Scope/volume/created/mount substitutions, unverified parents, competing
legacy/durable owners across device namespaces and late SQL rollback are covered.

Coverage decisions: retain legacy-engine recovery checks and their no-enrollment
assertions; replace only the old blanket production gate expectation with explicit
review availability. Restore the pre-#71 observer token scenarios using actual
issued recovery tokens: accepted notification reconciliation and mode changes
invalidate them. Add compiled production recovery IPC, single-use replay refusal
and private-proof non-disclosure. Initial restart fixture used a continuously
active external rename, which accepted startup reconciliation correctly handled;
the repaired fixture first persists genuine missing history, then returns the
candidate. This preserves the existing external-continuity contract.

Observed Node22.21.1/macOS arm64: fresh build, typecheck and lint passed; repaired
recovery/public/legacy/UI/source/observer/fixture checks210/210, including18 new
public recovery controls and compiled IPC coverage. Independent Standards/Spec
follow-ups found no remaining concrete finding in these repairs. Dedicated
migration renewal follows on this source. This remains an intermediate local
candidate; category/archive/native/file consumers and final platform/full-suite
acceptance remain outstanding.

Migration renewal initially exposed29 retained-suite failures: obsolete blanket
recovery gates and own-path/category-history regressions. Restore the accepted
public mode/exclusion/own-path/grouped recovery scenarios instead of retaining the
rollout gate as their expected behavior. The helper for live native role-history
scenarios now uses production reassociation directly, with no legacy engine or
post-operation backfill. Restored backup recovery also explicitly rebinds and
reopens its retained ID/values.

The direct own-historical-path role exception requires identical sufficient
current-scope evidence in subject, dormant category and reviewed target. Missing,
changed, foreign-scope, different-path or independently different-object history
still vetoes. New grouped parents may reuse only retired history at a different
path; unavailable existing categories and other retained path/physical owners
remain blocked. A paired legacy dormant-role exception requires both saved native
triples to match the reviewed parent exactly including dev; equal stale history
alone remains a veto. Public negative controls went red before these path and
current-mount repairs. No shared command-authorizer policy was weakened.

The broad repaired source before the last two narrow review fixes passed415/415,
including real native observer scenarios. The final affected recovery/mode/grouped/
source/legacy set passed177/177 after those fixes (27 new public recovery cases).
Standards/Spec narrow follow-ups found no unresolved defect in the repairs. Fresh
build, typecheck, lint and diff check pass; exact-candidate migration evidence is
being renewed. The failed797-test migration receipt (767pass/29fail/one existing
skip) is diagnostic evidence, not an accepted final result.

Renewed dedicated migration result:806 tests,805 passed, one existing skip, zero
failures/cancellations; subsequent observer/UI set95/95 passed. A final same-scan
root-proof control then exposed a later evidence inventory differing from the
already authorized root while retaining its native tuple. Inventory acquisition
now verifies its own root's full saved proof/current scope and scan mount, and
retains failure for that scan so later clean reads cannot rehabilitate it. The
public control went red before repair. The final affected recovery/source/mode/
grouped/legacy/observer set passed217/217 after this repair (28 new public recovery
cases); fresh build/typecheck/lint and diff check passed. This narrowly renews the
affected source boundary after the806-test migration receipt; no schema, migration,
backup format or build configuration changed in that final repair. Final whole-
issue verification remains outstanding.

### Fifth slice: archive location designation

Production archive-location review/Apply now acquire a fresh durable/current root
snapshot and full proofs for every existing component. Missing components remain
missing; designation creates no folder or project. Scope/volume/mount changes,
duplicate physical proofs, retained owners and saved roots veto adoption. Tokens
bind source generation, policy, associations, reservations and observed components;
Apply reinspects after its SQL write and rolls back on change, without a success
event. Property-only edits retain their independent revision semantics.

Saved source locators supply a separate ownership veto even for unconfigured
legacy roots with NULL evidence. Conservative case/Unicode alias keys retain
component boundaries without rewriting canonical/authored paths. Proper ancestor
sources permit their already-selected nested source to designate its own archive;
entering a peer subtree, containing a peer root, or aliasing the selected root
remains blocked. Exact/descendant legacy roots, missing aliases, ancestor
availability and alias-equality controls went red before the corresponding
review repairs. Locator similarity is never continuity authorization.

Coverage decisions: remove only location designation from the remaining blanket
backend gate checks; archive/restore effects and recovery stay gated. Retain the
legacy archive engine suites and renew production designation controls. New public
set15/15 covers stored root-device changes, full component substitutions, root
verification, duplicate proofs, independent metadata, source ownership and
post-write rollback. Fresh build/typecheck/lint and the affected archive/journal/
source/observer set137/137 passed; diff check passes. Standards/Spec narrow repair
follow-ups found no remaining concrete issue in inspected fixes. Migration
selection now includes these public legacy-root controls; its renewal follows.
This is a local intermediate milestone, not archive-effects or platform acceptance.

Final location-slice migration renewal:822 tests,821 passed, one existing skip,
zero failures/cancellations; docs217 and diff check passed. The initial822-test
run had9 failures from one obsolete location-denial assertion in the shared
historical archived-project fixture. That fixture now performs designation through
the production API, asserts the still-gated archive-effect boundary, and retains
its explicit legacy archive/restore engine arrangement. All9 affected metadata,
ordering/grouping/filter/session scenarios passed on renewal; no skip/retirement.
The same run renews the preceding same-scan project-recovery root-proof repair.

### Sixth slice: category-folder operations

Production category create/associate/rename and explicit recovery now bind the
current root, category and every affected member to sufficient full proofs and
pinned mounts. Migration0028 adds nullable immutable authorization, append-once
destination evidence and separate append-only attestations. Creation enrolls only
the new empty category; association lists/enrolls only the reviewed children;
rename preserves IDs, raw native history, values and contents. Full current
inventories veto duplicate IDs including unowned branches, live/historical owners
and relocation of saved source roots. Repeated checks compare both full proofs
and mounts, including an empty category after the native effect.

Recovery never replays a category rename. New-policy journals reacquire mounts
through explicit review while retaining original full identities and scope.
Legacy root/category/member triples must match exactly including dev before a
separate attestation; authentic0023 SQL upgrades prove success and changed-dev
refusal. Unrecorded creation targets are not adopted. Same-revision settlement
clears observation cache/version so old ambiguity cannot restore itself. Impact
snapshot projection is read-only comparison; full proofs and fresh mounts supply
authority. Legacy nullable-field hydration uses semantic object comparison while
identity/binding strings remain byte-exact.

Public red/green controls and independent review repaired stale-token reuse after
an observed remount, contradictory raw association backup evidence, post-SQL
`keep_original` reservation release, full-proof changes between inventories,
empty-category mount changes after effect, and impossible attestation generations.
Matching original-operation retries remain read-only; wrong tokens do not consume
another review. Property-only edits remain independent. Scope loss followed by
root-only binding cannot bless scoped pending operations. Pending category and
member durable/coarse legacy proofs reserve moved objects outside recorded paths.

Coverage decisions: retain legacy engine/crash scenarios; add separate production
process-exit checkpoints at intent, native effect and destination recording, plus
real old-schema upgrades and matching restore. Replace remaining category-folder
blanket gates with production checks; keep category removal/archive/native/file
gates. Two inherited rename/Name-group drop assertions now verify actual fresh
missing-target and occupied-owner refusals instead of obsolete rollout gates.
No requirement or failed scenario is newly skipped/blanket-retired.

Latest fresh build/typecheck/lint and affected public/legacy/category/UI/source/
observer/compiled Name-drop set145/145 passed before the final host-separator
consistency adjustment. Read-only Standards/Spec narrow follow-ups report no
remaining concrete finding in inspected repairs. The migration inventory includes
0028, exact NULL defaults, empty attestations and historical rewind cleanup;
its full focused renewal follows. This remains intermediate issue work: category
removal, archive/restore effects, native/file consumers and final platform/full-suite
acceptance remain outstanding.

The final focused migration run after that adjustment executed873 checks:
871 passed, one existing skip, and one stale build-smoke expectation failed
(last migration index27 instead of28). Only that test literal was repaired;
application, migration and generated build inputs remained unchanged. Under
CI evidence reuse, the affected build/artifact consumers then passed53/53.
Typecheck, lint, docs217 and diff check passed on the resulting slice. The
failed broad receipt remains diagnostic; this records the bounded renewal,
not an unexecuted final whole-issue suite.
