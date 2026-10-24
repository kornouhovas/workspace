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
