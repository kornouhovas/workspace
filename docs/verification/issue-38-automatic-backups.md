# Issue 38 local verification

Contract/scenarios: [plan](../plans/issue-38-automatic-backups.md).
CI/integration acceptance: [GitHub checkpoint](https://github.com/kornouhovas/workspace/issues/38#issuecomment-6254733529).

## Observed focused evidence

- Node 22.21.1; `npm ci`, native rebuild and application build succeeded. An initial
  build correctly rejected the shell's Node 26; subsequent checks use the pinned Node.
- 27 focused service, recovery IPC and EN/RU UI scenarios passed. These cover startup,
  due timer, restart scheduling, WAL restore, seven-copy retention, protected migration
  snapshots, successful upgrade, injected migration failure/rollback, matching-version
  restore, incompatible-version rejection, blocked backup writes, corrupt verification,
  explicit retry, malformed requests, confirmation/Escape and late-response lifetime.
- Typecheck, lint and local documentation links checked during implementation.
- No migration SQL, dependency version, renderer privilege or project-file mutation
  was introduced. Migration fixtures now include automatic backup/recovery scenarios.

Final migration inventory, independent review, full suite, actual runtime inspection
and exact-SHA platform CI remain pending in this candidate. These focused results do
not establish Windows or packaged acceptance.
