# Issue 37: application-data export and restore

Tracker: [#37](https://github.com/kornouhovas/workspace/issues/37).
Immutable base: `f694461c`. Executor: Matt Pocock implement/TDD.
Publication to the currently public repository is authorized for this issue.

## Contract

Export a version 1 JSON envelope containing a consistent SQLite serialized image,
its SHA-256 checksum, and an explicit application-format identifier. Serialize on
the service's synchronous SQLite connection, including committed WAL data. Export
all tables, including settings, source/workspace/project metadata, property types,
views and operation history. Never include project-file contents.

Validate exact envelope/version, checksum, SQLite integrity, foreign keys, migration
ledger, canonical schema and supported view/settings shapes before replacement.
Require an exact supported schema; future upgrades need an explicit format adapter.
Restore copies validated rows into the live database in one SQLite transaction,
using only its trusted schema. Temporarily drop/recreate immutable-history triggers
inside that transaction and disable connection foreign-key enforcement outside it;
run explicit foreign-key/integrity checks before commit and restore enforcement in
finally. SQLite rollback protects current data on errors or process interruption;
there is no database-file rename or WAL sidecar replacement.

After commit, expire every in-memory review and observer, rebuild workspace services,
rebind IPC observation and reload the renderer. Never automatically retry restoration
on an unknown transport outcome. Existing missing-folder recovery remains responsible
for reassociation; restore never creates or replays filesystem operations.

## Scenarios

- Real service/SQLite: nonempty WAL snapshot while service remains usable; multiple
  sources/workspaces, all property types, independent views and language after reopen;
  missing folder retains identity/value and uses existing recovery.
- Reject malformed, future-version, corrupt, wrong-schema, invalid settings/view data,
  foreign-key-invalid exports without changing current state; transaction failure and
  process interruption preserve current state and trigger schema.
- Typed client/IPC: exact shapes, bounded content, transport route, stale previews expire.
- UI: visible scope warning, file selection, explicit replacement confirmation/cancel,
  keyboard, EN/RU, pending/error/success; download and restore with disposable data.
- Checks: focused tests/typecheck per slice; lint/docs/diff; Standards and Spec review;
  full final suite and selected exact-SHA CI; integration after required acceptance.

Automatic and pre-migration backups are #38. Recovery instructions document this limit.
