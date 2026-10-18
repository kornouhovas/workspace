# Issue 38: automatic and pre-migration backups

Tracker: [#38](https://github.com/kornouhovas/workspace/issues/38).
Immutable base: `165447df`. Executor: Matt Pocock implement/TDD.
The owner approved publication to the currently public repository for this task.

## Accepted contract

Owner approved: check at service startup and every 24 hours of operation; back up
when the last successful automatic snapshot is at least 24 hours old. Keep the seven
newest verified automatic snapshots in the local application-data `backups` directory.
Before any pending migration of existing application data, write and read back a
verified, consistent snapshot. Failure blocks migration. Pre-migration snapshots are
separate and never subject to automatic retention. Failed migrations roll back through
Drizzle's migration transaction; retain the snapshot and offer explicit recovery with
the matching older app version. Do not retry failed migrations automatically.

Reuse the version 1 application-data envelope and SQLite serialization (including
committed WAL). Verify checksum, SQLite integrity, foreign keys and matching schema /
ledger on read-back before reporting success. Atomic publication and file flush precede
retention. An incomplete backup cannot count as success or displace a good snapshot.
Expose status, destination, snapshots, retry and selection through typed recovery
commands; restore uses the existing confirmation/unknown-outcome handling. Older schema
snapshots require the matching app version; no untrusted migration SQL is imported.
No project contents, synchronized working databases, or new external dependencies.
No bb modules are copied.

## Scenarios and checks

Pre-agreed seams: typed Workspace service with temporary real SQLite/filesystem
fixtures; typed IPC and EN/RU UI interactions, as required by the issue.

- Automatic startup/due timer; restart respects last success; WAL state round trip;
  backups do not include project contents; status empty/loading/success/failure/retry.
- File write/read-back/corruption failure preserves working data and previous backups;
  retention keeps seven automatic snapshots and every pre-migration recovery point.
- Existing-schema upgrade retains values; backup failure prevents schema mutation;
  injected migration failure rolls back and permits old-version restore/reopen.
- Typed request validation rejects paths/traversal/extra keys; invalid snapshots cannot
  restore; confirmation/Escape/keyboard, pending/error and EN/RU routes remain usable.
- Focused service/UI/IPC tests and typecheck per slice; migration fixture inventory;
  lint/docs/diff; Standards and Spec review; final full suite and exact-SHA CI, then
  authorized integration. Record local results in a verification report; CI status in
  the linked GitHub checkpoint.
