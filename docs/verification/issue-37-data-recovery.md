# Issue 37: application-data export and restore verification

Base: `f694461c`. Scope and scenario matrix: [plan](../plans/issue-37-data-recovery.md).
User instructions: [recovery](../recovery.md). Tracker: [#37](https://github.com/kornouhovas/workspace/issues/37).

## Observed local evidence

Node 22.21.1 on macOS. Initial service regression failed on missing export dispatch.
The implemented round trip then exposed WAL header flags on a serialized image:
a minimized real-file WAL database failed deserialization with `unable to open
database file`, while the same in-memory/rollback database opened. Normalizing
only the private validation copy's header resolved that failure; the original
checksum is verified before normalization. Export captures committed WAL pages.

Focused service tests exercise all five property types, stable option memberships,
multiple sources/workspaces, independent views/filter/layout, settings and completed
creation receipts after reopening. Invalid format/version/checksum/schema/ledger,
foreign keys, settings, ownership and configuration rejection preserve current data.
Engine fault injection after deletion proves rollback of rows and immutable triggers;
process SIGKILL inside the transaction followed by reopen proves crash rollback.
A missing-folder round trip retains identity/Text, expires stale preview tokens and
uses the existing explicit reassociation route without fabricating project folders.

IPC regression uses the real built backend and verifies exact request rejection,
round trip and workspace event subscription after rebuilding services. EN/RU UI
checks cover explicit confirmation, keyboard cancel/focus, pending/error, unmount
and an unknown outcome that disables mutation replay.

The real Electron development smoke downloads the exported file through the UI,
selects it, cancels with Escape, rejects malformed JSON, restores with Enter,
checks exact Text and language after renderer reload and process restart, and
preserves a sentinel project file. Both EN/RU pass at widths 360/1024/1440 with
no document overflow; confirmation screenshots were inspected. Normal shutdown,
backend exit and fixture cleanup pass. Evidence is generated under
`work/issue-37-data-runtime/`; fixtures and actual exports are disposable.

## Candidate checks and delivery

Typecheck, lint, documentation links and diff checks pass on the implementation.
Full-suite/review and platform acceptance status are recorded in the GitHub
checkpoint with exact candidate/delivered SHAs; this document is local evidence,
not a claim of future CI acceptance. The existing full CI matrix inherits all
platform regressions, builds, artifact checks and runtime routes. This issue adds
`smoke:data-recovery` for development and packaged applications and retains its
artifacts. New test files are automatically included in the platform/full inventory.
No migration or new bb module is introduced. Automatic/pre-migration backups are #38.
