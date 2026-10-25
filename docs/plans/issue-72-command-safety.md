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

## Seventh local milestone: fresh category removal

Fresh production category-removal Preview/Apply now stores versioned full
root/category/destination/member authorization inside the already immutable batch
binding; no schema migration is needed for this additive JSON form. Original raw
identities, member/request IDs and old engine fixtures remain intact. Every child
move must match the parent batch full proof and pinned mount frame at its own
context boundary. Fresh inventory checks affected proof uniqueness across eligible
unowned branches. Saved peer source roots veto by locator subtree or retained
physical evidence, including stale locators. Reservations carry full affected
proofs outside the original paths. Matching backup restore is retained; malformed
versions, role mismatches, substitutions and future generations are rejected.

Each move and nonrecursive empty-directory cleanup retains the existing stages.
Final SQL writes are followed by independent destination/member/full-inventory,
root and removed-path checks; a late filesystem change rolls back metadata and
completion while preserving cleanup intent. Tokens are consumed after a matching
request, including failed revalidation; property revisions remain independent.
Original retries, startup and status remain read-only. Recovery is still backend
gated pending separately reviewed attestations and old/new evidence handling.

Public red/green controls reproduced and repaired peer sources appearing after
Preview, durable aliases in unrelated branches, a modeled mount change immediately
after the child-attempt INSERT, retained peer-root physical ownership at a stale
locator, malformed proof restore, and relocation after terminal SQL UPDATE.
Read-only Spec/Standards repair follow-ups found no residual concrete issue in
inspected fresh-operation repairs; recovery/whole-issue acceptance excluded.

Observed Node22.21.1/macOS arm64: fresh full build, typecheck and lint pass;
affected removal/move/source/backup/recovery/compiled IPC set142 checks:141 pass,
one existing skip, zero fail/cancel. Eighteen new public removal checks include
six separate production process exits at batch intent, child intent/effect/record,
cleanup intent/effect, retaining the legacy crash matrix. UI and build/artifact
consumers271/271 pass. These are focused intermediate results, not the final
whole-issue suite or macOS/Windows Electron/package acceptance.

## Eighth local milestone: category-removal recovery

Migration0029 adds separate append-only sequenced removal attestations, without
rewriting original bindings, native tuples, IDs or receipts. New-policy explicit
recovery reacquires the same durable root/category/destination/member identities
in the same installation scope and pins a fresh mount frame. Child read-only
inspection can inspect fresh proofs before parent consent, but actual child
settlement compares the accepted parent attestation. Original retries remain
read-only, including across process exits. New-policy cleanup intent with an
already absent removed category can complete metadata without another rmdir.

Authentic0023 SQL upgrades require every recorded legacy tuple, including dev,
to match exactly before an explicit attestation. Root-only enrollment leaves
category/member proof fields NULL until that consent; only affected records are
enrolled in the attestation transaction before child effects. Separate root,
category, destination and member dev999 controls remain reserved without actions.
An absent legacy cleanup category cannot prove its tuple and remains reserved.
Malformed/unknown authorization or historical evidence never downgrades to legacy;
missing/NULL is distinct from empty string/zero. Original row/binding descriptors
must match before renewal or restore. Attested full proofs also reserve moved
objects independently of recorded paths.

An explicit recovery review may take a newer baseline revision after root binding
or observation, while preserving original semantic configuration and associations;
its generation/revision/frame are pinned within the review. This repaired an
observed exact0023 positive refusal after root-only binding advanced discovery
revision. Property/category-label revisions remain independent. Scoped anchor
loss/root-only rebinding cannot bless the old operation. Modeled between-run dev777
renewal succeeds without move replay; dev888 after Preview consumes the review
without attestation. These are modeled mount observations, not OS remount evidence.

Abandonment proves every known original affected object and placement, requires
no recoverable child and an existing original category, and performs no filesystem
effect. It can preserve unrelated late files/folders without adopting or deleting
them. Independent retry/abandon inspections retain this inherited guarantee;
private abandonment validation relaxes only empty-directory/destination-free
checks. Post-SQL inspection rolls back both attestation and reservation release
on a late change. Matching export/restore retains history; role/native/full proof,
unknown format, future/retrograde generation and consistent-but-malformed legacy
backup controls reject restore. Compiled production IPC rejects injected private
authority/replay and exposes no proofs.

Retain all legacy engine/crash checks; add separate public production recovery
and real historical-schema controls. No requirement is retired or newly skipped.
Read-only Spec/Standards follow-ups found no residual concrete issue in inspected
recovery, legacy-classification and late-arrival abandonment repairs. Whole-issue
and platform acceptance remain excluded. Migration inventories/counts/tags, exact
historical rewind and build/package resources include0029 (30 migrations).

Observed Node22.21.1/macOS arm64: fresh build/typecheck/lint pass; latest affected
set131 checks:130 pass, one existing skip, zero failure/cancellation. Dedicated
`test:migrations` on the reviewed frozen source executed907 checks:906 pass, one
existing skip, zero failure/cancellation. It includes matching restores, prior
command/discovery/metadata consumers and build/artifact checks. Final focused
UI/IPC renewal is recorded in the checkpoint. This is intermediate #72 evidence;
archive/restore effects, native Reveal/files, whole-issue review/full suite and
distinct macOS/Windows Electron/package/CI acceptance remain outstanding.

### Ninth slice: fresh archive/restore effects

Production fresh archive/restore now capture sufficient full root, project and
all existing parent proofs, with a pinned current mount and evidence generation.
Missing destination parents are created exclusively and recorded only after
repeated observation. New archive metadata retains full historical origin and
placement evidence separately from raw native identity; project/category IDs,
contents, property values and independent property revisions survive device-only
history changes. The archive operation's immutable Binding carries its authority.
Migration0030 adds nullable archive metadata authority, append-only parent proof
protection and the separate attestation table reserved for the recovery slice.
Current schema inventory is31 migrations; old migration SQL stays unchanged.

Fresh authorization checks complete source/archive namespace observations,
physical and locator ownership, reservations, exact policy and current registry.
Peer source checks protect moved project subtrees, archive destination containers
and new restore parents. They permit separately saved roots used only as unchanged
original parents; existing ancestors still receive full repeated checks. An
already recreated grouped parent is reusable only through a valid completed
restore receipt. Completion verifies current generation/policy, physical placement
and intended source/project/category/archive metadata inside the transaction after
SQL writes; a late generation change rolls back completion without replaying the
physical effect. Unknown/malformed full authority never falls back to legacy.
Matching backups restore; malformed journal descriptors, parent roles, unknown
formats, future generation and contradictory metadata proofs are rejected.

Retain historical archive engines, process-exit scenarios and archive metadata
fixtures. Adapt only their obsolete production blanket-gate assertions: production
archive effects are now covered by the durable public-service tests, while legacy
engine fixtures continue producing historical archive rows for metadata coverage.
Source/native gate tests retain the still-unconverted recovery/Reveal/files
boundaries. No metadata, ownership or platform requirement is retired.

Public controls include direct/grouped stored-device changes across restart,
peer roots inside moved folders or below restore destinations, full project
aliases, competing retained ownership, changed parent proof, unstable mkdir,
uncertain native outcome/read-only retry, property-only edits, parent-recreation
receipt validation, matching/malformed backup restore, unchanged nested-source
parents, stale current mount and changed volume/creation/scope. Read-only Spec and
Standards reviews found no residual concrete defect in inspected fresh effects,
peer-parent repair and backup validation. Recovery/sidecar consumption is excluded.

Observed Node22.21.1/macOS arm64: fresh build/typecheck/lint pass; initial affected
set118/118; renewed public durable archive tests18/18. First migration run921:
909 pass,11 failed,one existing skip; all11 traced to obsolete gate assertions
in two test helpers. Their affected117 checks pass after adaptation. The focused
migration rerun and final lint/docs receipts are recorded in the next checkpoint.
No full-suite, OS remount, Windows or Electron/package acceptance is claimed.
Physical archive recovery remains gated pending separate reviewed attestation,
legacy exact-tuple and fresh-frame implementation. Native Reveal/files and final
whole-issue/platform/CI acceptance remain outstanding.

Ninth-slice renewal: `test:migrations`925 checks:924 pass,one existing skip,
zero failures/cancellations on frozen source. Archive/contextual UI35/35 pass;
lint, local Markdown links217 and diff checks pass. Build/typechecking passed on
the unchanged service source. No new skips were introduced.

### Tenth slice: scoped archive/restore recovery

For already sufficient same-scope journals, production explicit recovery now
renews root/project/all recorded parent observations into a private current mount
frame, preserving immutable original Binding/native/parent bytes. A single-use
review pins that frame, current configuration, generation/revision, reservations
and attestation history. Apply reinspects inside an immediate transaction and
stores a separate append-only attestation before any retry effect. Original
Apply/status/startup remain read-only. A verified destination after an uncertain
native response completes metadata without another rename. Missing planned
parents may be created exclusively on explicit retry; previously recorded parent
proofs are never rewritten. Lost scope/root-only binding cannot renew authority.

Keep original proves the actual original and commits its attestation plus
reservation release together. Post-SQL full placement/policy checks roll back
both on late relocation. Unrecorded parent creation and a separately occupied
final destination can still offer Keep original without adopting, overwriting or
deleting those unrelated objects. Unknown stored sidecars cannot be ignored by
later review. Shared sidecar parsing validates immutable request/journal roles,
full identity continuity, parent history and generation bounds on backup restore.

Read-only interim Spec review found independent-property fingerprint invalidation
and an occupied-destination availability regression. Public red/green tests now
normalize only independent property counters and obtain project authority from
exactly one full match, leaving other placements without authority. Follow-up
found no residual defect in those repairs. Standards review found no concrete
scoped authority/transaction/protocol defect. Legacy exact-tuple recovery and
archived-record designated binding remain explicitly outstanding; their missing
full authority cannot select a legacy fallback in the scoped implementation.

New public checks cover modeled between-run mount renewal, no native replay,
Keep-original late-write rollback, unknown/contradictory sidecar restore and
runtime refusal, stale recovery mount, unrecorded parent retention, property
independence, occupied final destination, direct/grouped restore settlement,
retry with exclusive parent creation, and lost scope after root-only binding.
Six production subprocess exits exercise intent, mkdir effect, rename effect,
destination recording, uncommitted completion and committed receipt. The
uncommitted-completion fixture exits after terminal SQL on the actual service
connection; a separate SQLite reader cannot see an uncommitted terminal row.
Compiled production IPC accepts IDs/token only, rejects proof injection/replay,
and exposes no private proof. Historical archive engine scenarios remain intact.

Observed Node22.21.1/macOS arm64: fresh build/typecheck/lint/diff pass; affected
service/metadata/legacy/crash/UI/compiled-IPC set161/161 passes. No migration SQL or
schema changed since the verified ninth slice. Full-suite and supported-platform
acceptance remain unexecuted. Next: legacy archive recovery and designated
archived binding; native Reveal/files; final review/full/platform/CI gates.

### Eleventh slice: legacy archive/restore recovery

Authentic0023 archive/restore journals now obtain a first per-operation consent
only when the current enrolled root and every recorded project/category/parent
native tuple match exactly, including dev. Native objects have an exact known
shape. Original absent/NULL durable fields remain distinct from malformed,
unknown or retained new-policy authority: deleting a new journal's authorization
cannot turn it into legacy. The root-only review grants no descendant authority.
Only the selected project/category enroll inside the attestation transaction;
raw original bindings, native strings, IDs and recorded native parent slots
remain unchanged. Unrelated categories remain unbound.

Further explicit attempts validate the ordered, contiguous sidecar chain and
renew identical full evidence/current scope on a fresh mount. The first legacy
attestation preserves its exact tuple proof; later frames use that accepted full
proof rather than silently rerunning old equality. Source scope loss remains
reserved even after root-only binding. Reservations validate/retain attested
physical project evidence beyond recorded paths. Unknown sidecars never disappear
into a legacy fallback. Exclusively created parent slots may append full proof
only when their original plan was missing; preexisting native-only slots are not
rewritten. Matching backups retain those mixed old/new histories, while unknown
policy/native shapes, consistently rewritten original history, contradictory
parent scope and broken sequences are rejected.

Spec review reproduced a stale reserved projection after legacy Keep original.
A settlement callback now clears the observation cache, advances the in-flight
observation version and requests a new observation; an observed-list test verifies
immediate visibility after selected enrollment. Another public red/green test
closes missing-authorization downgrade. Exact native-shape red/green coverage
rejects extra unknown fields. Follow-up Spec/Standards reviews found no residual
concrete defect in those inspected repairs.

Real historical SQLite checks cover direct archive/restore, grouped selected-only
enrollment and preserved category ID, independent dev999 root/each archive-parent/
project/category refusals, first consent then modeled dev777 renewal, missing
parents, cached projection settlement, matching/malformed backup history and
post-consent scope loss. Compiled production IPC independently executes the old
journal with IDs/token only, rejects injected proof/replay, and exposes no private
authority. Add this historical boundary to `test:migrations`. No supported-platform
or full-suite acceptance is inferred from these disposable/process tests.

Fresh build/typecheck/lint and targeted results, followed by the frozen-source
migration renewal, are recorded in the checkpoint. Designated binding of legacy
or scope-unverified completed archived records remains separate work; ordinary
source association still cannot reactivate archives. Native Reveal/files and
final whole-issue review/full/macOS/Windows/Electron/package/CI gates remain.

Eleventh-slice renewal: Node22.21.1 fresh build/typecheck/lint/docs217/diff
pass; targeted set144/144 passes, including both compiled production IPC routes.
Frozen-source `test:migrations`962 checks:961 pass,one existing skip,zero
failures/cancellations. No new skips or migration SQL changes were introduced.

## Twelfth slice: explicit completed-archive association

Completed legacy or scope-unverified archives can explicitly enroll only their
fixed designated archived placement. Association preserves inactive state,
original relative path/category, native history, properties and archive metadata.
Root-only approval never enrolls archived children. Append-only migration0031
records the exact archive snapshot, current source generation and full root,
project and every archive-parent observation separately from old metadata.
Malformed roles, aliases, retained owners, reservations, peer roots inside the
selected target and known physical mismatches fail closed. An unchanged route
parent may itself be another source root; observing it does not move that root.

Restore v2 references an actual immutable association row. It retains the known
historical original-parent observation verbatim, including its old scope; legacy
history has a null original-parent proof rather than a fabricated one. Existing
grouped destinations require a separately enrolled current category. Explicit
creation of a missing original parent creates a new category ID and retains old
native/proof history. Matching backups validate receipt references and reject
orphaned, altered, future-generation or contradictory roles. Recovery renews a
private frame without rewriting the original journal or repeating a lost native
response. Original retry remains read-only.

A mode/scope-loss lifecycle exposed an unavailable dormant original category.
Only a category referenced by a verified available grouped archive can now bind
at its unchanged saved path while preserving dormant flags. Its direct-project
role history requires matching full physical evidence or exact current native
triples for every remaining native-only role, including `dev`. Each role still needs
its own explicit selection; reviewed mode Apply performs activation separately.
A dormant direct-project record can coexist with a restore parent only when its
full physical proof matches that separately enrolled current category. EN/RU UI
labels distinguish archived projects and retained original parents and fix their
mapping destinations. Ordinary project/category mapping cannot reactivate an
archived project.

Interim read-only Spec/Standards reviews found retained/peer ownership gaps,
root/project receipt aliases and a stale-native role exception. Each reproduced
red at the public service or backup boundary and passed after repair. Follow-up
reviews found no residual concrete defect in the inspected repairs. Existing
coverage is retained; migration inventory/count fixtures adapt from 31 to 32 and
add the completed-archive association fixture to `test:migrations`.

Observed Node 22.21.1/macOS arm64: fresh build/typecheck/lint/docs 217/diff pass;
affected 131/131 pass, including compiled production IPC binding and v2 restore.
Frozen-source `test:migrations`: 985 checks, 984 pass, one existing skip, zero
failures/cancellations. Real 0023 direct/grouped fixtures preserve metadata and
contents; controls include explicit/missing original parents, scope loss,
contradictory ownership, late-SQL ancestor changes, matching/malformed backups,
mode round trips and lost-response recovery without replay.

The separate disposable Electron UI journey completed selection/Cancel, archived
binding and archived-state checks with eight EN/RU light/dark screenshots at
1024/1440 widths, but its first shutdown exceeded 10 seconds and was forcibly
cleaned up. A minimal empty-app shutdown and three subsequent complete UI runs
closed normally without parallel migration load. The first shutdown failure is
retained as an intermittent runtime limitation; no product shutdown repair is
claimed. EN/RU changed rows were visually inspected at 1024 light and 1440 dark;
notes wrap without horizontal overflow. These runs verify the changed UI, not
whole-issue platform acceptance. Native Reveal/files conversion and final whole-issue review/full suite,
separate macOS/Windows native/Electron/package/CI gates remain. No push,
integration, release or actual remount acceptance is inferred.

## Thirteenth slice: native and file consumers

Production Reveal, file listing and file Open/Reveal now acquire current durable
source/project/ancestor frames rather than using stored device numbers as
cross-run identity. A private closed protocol carries full folder observations
and source generation; renderer requests still contain logical IDs and relative
file locators only. Pure evidence types/validation/equality move into a Node-free
contract module, with existing service exports retained. Main independently
reobserves every protected folder immediately before dispatch/GO and rejects
missing authority at the actual controller boundary. The bundled main provider
loads from the fixed `dist/service` artifact location rather than incorrectly
looking for the addon under `dist/desktop`. Windows descendants keep nonexclusive
route resolution, native DELETE sharing, long-path operands and READY_PARENT/GO.

Archived file targets require current same-scope recorded full ancestry or an
actual immutable selected-archive association receipt. Root-only scope renewal
cannot authorize archived contents. Both ordinary and archive namespaces veto
full root/ancestor/project aliases. Current/stale peer-source target owners and
late ownership changes are checked during permit reauthorization. Unchanged
route-parent source roots remain allowed. Native regular-file operands retain
request-local exact device/inode/birth, kind, link-count and route checks beneath
fully verified directories; they do not acquire persisted file identity or
cross-remount authority. Spec review confirmed this preserves the accepted folder
contract and does not add durable regular-file storage.

Read-only interim reviews drove public red/green repairs for ordinary-namespace
archive aliases and peer target ownership. An additional protected-root alias
control reproduced red and passed after inventory repair. Source-generation,
policy, scope, volume, current-mount, cancellation, late peer ownership and
independent main proof changes all reject before dispatch. Missing/replaced
transport controls retain their specific problems instead of a generic expired
request. Follow-up Spec/Standards inspections found no remaining concrete defect
in those ownership repairs; whole-issue review remains separate.

Coverage decisions: adapt obsolete #71 gate assertions to converted production
behavior, retaining unbound-folder refusal, logical-only request validation,
zero-effect malformed inputs and cancellation. `backend-lifecycle` native journeys
now use the production factory, including current creation/recovery transport;
dedicated legacy engine/crash suites remain. The EN/RU production App gate test
now verifies successful enrolled creation/Reveal, exact retained metadata and
restart, while source-binding/native service cases cover missing enrollment.
The legacy-engine fixture still proves its output cannot silently enroll or
acquire archive authority. No safety requirement or supported platform is retired.

The serialized native receipt observer recognizes the added APFS/NTFS proof shape
without retaining proof values. The original creation runtime seed failed first
because Electron's child lacked the `tsx` loader already used by Node crash
checks, then because its legacy completed rows were correctly retained as
unbound. Runtime renewal explicitly selects the compiled production factory;
legacy Node crash fixtures keep their existing default engine. This fixes the
acceptance harness without restoring automatic legacy adoption.

Observed Node 22.21.1/macOS arm64: fresh build/typecheck/lint/diff pass;
latest affected set 278/278, including 23 new production/native checks and 51
receipt-observer checks. Separate fixture renewal 90/90 and adapted public App/
legacy-boundary controls 2/2 pass. Actual macOS dev file journey passed nested
listing/navigation, 16 EN/RU/theme/size captures, missing-file feedback, exact
Unicode file selection in Finder, external application Open, preserved bytes and
owned process/fixture cleanup (`work/issue-72-native-files/report.json`). Actual
creation/recovery dev journey passed all eight direct/grouped abrupt checkpoints,
new native invocation/acknowledgment, exact Finder target selection and two normal
shutdown/restart observations per checkpoint
(`work/issue-72-native-creation3/dev-creation-observations.json`). These are dev
consumer receipts; no packaged or Windows result is inferred. Full final suite,
whole-issue review, migration renewal and separate package/CI acceptance remain.

The updated source-association dev journey also passes: eight EN/RU light/dark
1024/1440 captures, explicit selection/Cancel, preserved logical project and
successful converted file listing after enrollment, with normal owned shutdown.
The new non-gating association guidance was visually inspected in the narrow RU
capture. Its report is `work/issue-72-native-source-association/report.json`.

## Whole-issue review and fourteenth slice: closed legacy history

Review fixed point: `61c4c0bd...fff33784`, including all thirteen implementation
milestones. The independent Spec axis found no confirmed remaining implementation
defect or unrelated scope expansion, and explicitly retained the unexecuted full,
package and supported-platform gates. The Standards axis found ignored optional
original generations in category-removal/category-folder legacy snapshots and
non-closed native tuple comparisons; its judgment smell was the duplicated
security-sensitive removal source-policy filter. These findings were resolved
before final broad verification. This is not final platform acceptance.

Legacy snapshots now distinguish absent authentic pre-policy generations from
present values: the latter must be safe nonnegative integers bounded by the
reviewed/current generation. Shared history validators run in recovery and backup
validation. Closed native tuple syntax requires exactly three decimal strings;
retained zero tuples remain representable but cannot match sufficient positive
current proofs. Legacy capture/observe, creation/rename/move target comparisons,
category snapshot roles and backup native columns use the closed parser. The
single removal source-policy helper replaces the duplicated filters. No global
identity equality is weakened and no historical bytes are rewritten.

An additional public repro showed that removing a new category-folder journal's
authorization could expose legacy recovery both in the same scope and after
scope loss plus root-only rebinding. Legacy attestation now refuses every retained
nonnull durable field in the original source/category/member/addition roles,
matching the archive/removal policy. Syntax-only unprovable history remains
retainable without gaining authority. A coherent backup relabel of a scoped
receipt is rejected; pending reservations remain intact. This is a separate
anti-downgrade repair, not a claim that database snapshots are tamper-evident.

New public real0023 recovery/backup controls pass 26/26. An isolated pristine
`fff33784` service build ran the same focused controls: six real failures across
seven cases confirmed target-shape grants, a removal grant and malformed backup
acceptance; the category-folder live shape control was already refused. Earlier
fixture-constraint/import failures were diagnostic-only and were corrected before
that baseline comparison. Native-shape and generation controls preserve the
matching positive backups and exact legacy recovery. The existing archive shape
fixture now injects its malformed nested history after opening a valid migrated
fixture, because strict backup validation correctly rejects malformed native
columns before migration can begin. Its recovery no-effect guarantee remains.

Fresh build/typecheck/lint/diff pass; affected legacy/scoped command, category,
archive and real backup checks pass 161/161. Additional anti-downgrade controls
pass 3/3; the category/archive subset passed 46/46 before the added backup control.
Both independent review follow-ups found no residual defect or history-preservation
overreach in the inspected repairs. Migration renewal, final full suite, package
and separate supported-platform/CI receipts remain to be completed.
