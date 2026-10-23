# Issue 71: Recover source access across device-number changes

Issue: https://github.com/kornouhovas/workspace/issues/71. Baseline: `649b2347`.
Branch: `codex/issue-71-source-access`. ADR 0009 is accepted; native/textual blocker #70 is closed; no parent or competing checkpoint was found.

## Execution and acceptance

Implement at the seams agreed in issue 70: private evidence adapter/policy, real SQLite service discovery and reviewed binding, then isolated transport and EN/RU recovery UI. Use disposable roots/databases only.

- Native sufficient evidence, finite unsupported/permission/disconnected/changed results, exact integer serialization, containing-volume and link/substitution checks on macOS/Windows.
- Installation anchor outside database/backups; same-install restore versus lost/corrupt/foreign anchor.
- Additive migration preserves old triples, IDs, properties, views, sessions and immutable journals; verified pre-migration backup and rollback.
- Durable continuity across changed dev/restart/watch hints; wrong volume/folder/unknown/partial evidence rejected without adoption.
- Explicit one-to-one legacy/scope mapping with root-only consent, parent ownership, retained/unmapped impact and journal blockers. Cancel/stale/restart/sibling/config/reservation changes reject; atomic Apply publishes only after commit.
- Backend capability gate rejects direct service/IPC/retry/native/file effects until #72; metadata remains usable.
- Backup/restore validation and migration fixtures; affected interaction and Electron appearance evidence in EN/RU, narrow/wide and both themes.
- Independent Standards/Spec review; type/lint/docs/build, focused tests, migration suite and final full suite; supported-platform CI and accepted integration.

## Coverage retention

Retain existing containment, ownership, non-overwrite, journals, reservation, SQLite recovery, properties and view/session guarantees. Adapt discovery fixtures to explicit sufficient enrollment. Replace cross-run dev equality with paired durable-continuity and legacy-review checks. Do not retire filesystem safety guarantees while consumers are gated; their low-level tests remain applicable to #72.

Progress and exact verification receipts belong in the GitHub checkpoint. Unexecuted requirements remain open.

Implementation and verification checkpoint: [observed candidate evidence](../verification/issue-71-source-access.md). Acceptance remains open.


## Continuation gates

The candidate is not accepted. Read the verification checkpoint and GitHub issue
comments before continuing. Next: reconcile inherited migration/read-only and
journal fixtures; classify each intentionally gated application journey under the
accepted #72 rollout without removing safety coverage; extend valid-payload gate
coverage for retained/archived histories; renew affected checks. Then complete
Windows native/packaged and remaining required platform receipts, final review and
exact-candidate full/CI acceptance before using the integration route.
