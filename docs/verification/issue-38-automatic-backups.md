# Issue 38 local verification

Contract/scenarios: [plan](../plans/issue-38-automatic-backups.md).
Exact-SHA CI/integration acceptance: [GitHub checkpoint](https://github.com/kornouhovas/workspace/issues/38#issuecomment-6254733529).

## Implemented and reviewed

Automatic snapshots follow the owner-approved startup/24-hour schedule and seven-copy
retention policy. Separate verified pre-migration snapshots block unsafe migration
when protection fails and remain outside retention. Typed recovery commands expose
status, destination, retry and selection; replacement uses the existing confirmation.
Project-file contents remain separate. No migration SQL, dependency version, renderer
privilege or project-file mutation was introduced. No bb modules were copied.

Independent Standards and Spec reviews found two safety defects in the first candidate:
restore-incompatible snapshots could be published, and delayed backup selection could
race external file selection. Both were reproduced with failing tests, repaired and
re-reviewed with no remaining blocker. Backup verification now compares schema/ledger
and applicable recovery invariants before publication; historical schemas retain exact
schema/ledger/settings validation and require their matching app version. Backup
selection locks the parent until confirmation. A shared pure ID parser removes the
review's duplicated grammar observation.

## Observed checks

Pinned Node 22.21.1 was used after an initial build correctly rejected the shell's Node
26. Installation, native rebuild, application build, typecheck, lint, local Markdown
links and diff checks passed.

- Real SQLite/service tests cover startup/due timer, restart scheduling, WAL restore,
  retention, protected migration copies, successful upgrade, injected migration
  failure/rollback, matching-version restore, incompatible imports, write/read-back
  failure, corruption, retry, malformed requests and invalid application data.
- Recovery service/IPC/UI focused candidate: 27 passing scenarios before review;
  final service/UI review regressions: 15/15 passed, independently rerun by Spec review.
- Existing malformed-discriminator and migration-rollback regressions exposed changed
  behavior. The type guard was repaired; the migration assertion now checks the finite
  error code and retained SQL cause while preserving every row/schema/file assertion.
- The old renderer fixture always reported recovery unavailable. It now supplies a
  healthy empty backup-status query while retaining its other recovery failures;
  all 92 renderer scenarios pass. After-each cleanup also runs on failed assertions.
- Actual Electron development runtime: both EN/RU routes pass creation, status,
  keyboard cancellation, malformed input, selecting/restoring a saved backup, restart,
  unchanged project bytes, ordinary application/backend shutdown and fixture cleanup.
  Screenshots inspected at 360, 1024 and 1440 px; no horizontal overflow. Local evidence:
  `work/issue-38-runtime-final/evidence.json` and language/width screenshots.

## Full-suite result and local limitation

The final unchanged candidate ran `npm run test:all`: **3055 passed, 6 failed,
26 conditional skips** (3087 tests). All six failures are ordinary Electron close
10-second timeouts in five `property-editor-driver` fixture scenarios and
`runtime-electron-quit`; these fixture apps do not use the backup service. The property
fixture timeout also reproduced in the focused native run on local macOS 27. Timelines
retain quit/node-exit/parent-exit and forced-cleanup outcomes. Their cause is not
established by #38 and their assertions/deadlines were not relaxed. They remain a local
verification limitation alongside the independently tracked shutdown acceptance #44;
the full local suite is **not green**.

Earlier full runs also exposed the now-fixed discriminator/renderer-fixture failures;
one input-fingerprint assertion saw a source repair during an already-invalid run.
The final full run used unchanged sources. Logs are retained locally in
`/tmp/issue-38-full-verified.log`, `/tmp/issue-38-runtime-fixtures.log` and focused
`/tmp/issue-38-*.log` files.

Platform/package acceptance and integration remain pending until the reviewed exact
commit passes the required CI routes and its backup runtime evidence is inspected.
The existing full CI already runs the extended recovery script in development and
packaged builds on macOS latest, Windows latest and Windows 2022. The new real-database
suite defaults to platform coverage; migration selection now includes backup/recovery
fixtures. No inherited CI gate was removed or weakened.

## First CI failure and diagnosis continuation

Full CI39165311194, attempt1, candidate `53a58c3`, failed Windows latest's early
original creation/native command: selection count0 instead of1. Artifact12150238888
retains a verified service binding followed by rejection at
`readiness / collection / invalid_operation`, plus confirmed bridge/fixture cleanup.
Creation completion, acknowledgement and restart were unreached. The collector
validation failure follows the unreached platform suite, not evidence of a separate
observer defect. macOS/Windows2022 results are retained in the same run.

Existing coarse evidence cannot distinguish changing/incomplete collection membership
from invalid/duplicate entries or enumerator acquisition. The scoped continuation adds
only fixed guard labels to the existing rejection conditions and finite allowlists;
no guard, deadline, permit, retry or acceptance assertion changes. The mocked adapter
regressions fail12/12 without those labels and pass with them. Focused local native /
COM files:77passed,8Windows-only skips. Managed genuine/negative enumeration controls
still require the focused Windows route in [CI](../ci.md#issue-38-early-windows-collection-failure).
The historical failure's cause remains unestablished; platform acceptance is pending.
