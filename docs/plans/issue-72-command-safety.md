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
