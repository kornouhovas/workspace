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
comments before continuing. Fixture reconciliation and focused native repair are
complete. The final Windows repair passed110/111 tests with one existing skip on
both hosts in40092827817; temporary traces are removed. Next: renew the complete
three-host candidate, inspect every full/dev/package receipt and then apply the
conditional integration route. No earlier diagnostic failure is relabelled passed.



### Inherited scenario decisions during continuation

| Scenarios | Decision and retained boundary |
| --- | --- |
| Observed project reads, Refresh/restart | Adapt: cache the accepted availability projection; keep live metadata and fresh default reads. `observed-projects-service` verifies both. |
| Pre-property/pre-view/pre-session SQL upgrades and journal history | Adapt historical SQL fixtures to the actual old schema; assert all old rows plus explicit NULL evidence/generation-zero defaults. Keep backup, constraints, reopen and rollback assertions. |
| Archived metadata/property/session reads | Adapt arrangement through actual legacy archive engine, then exercise the current application metadata boundary. No identity backfill. |
| Creation/rename/move/Reveal command-engine guarantees | Retain at explicit `openUnconvertedEngineFixture(...).engines`, using real production factories/native adapters/SQLite. The separate `.application` stays gated; `unconverted-engine-fixture` proves separation and no evidence enrollment. |
| Archive/category/removal/recovery command and crash guarantees | Retain through the same explicitly named engine fixture, including crash-worker handshakes and real Electron adapters. This does not establish availability through the current application API. |
| Old successful project recovery after external reconciliation or mode change | Replace current-application success assertions with `identity_update_required`, retained metadata and no-effect assertions under ADR 0009/#72. Keep actual discovery/reconciliation checks and separate retained engine guarantees. |
| Refresh invalidating independent legacy engine fixture reviews | Adapt to explicit engine invalidation. Do not claim the private engine fixture proves current application observer-generation wiring; current service binding/observed tests cover that boundary. |

No failing scenario is newly skipped. These decisions preserve SQL/native safety
and distinguish old-engine evidence from current application behavior. Current migration reconciliation passes; final full-suite and supported-platform acceptance remain required.


| Additional inherited/current scenarios | Decision and replacement evidence |
| --- | --- |
| Successful current-App creation/Reveal and retained-project recovery | Replace effects with EN/RU real-App `identity_update_required` feedback, preserved draft/metadata, zero journal/native/filesystem changes and no replay on reopen (`renderer-app`). Keep terminal original retries as receipts and unfinished operation uncertainty/reservations intact (`project-creation-ui`, `source-association-service`). |
| Historical command native/Electron process guarantees | Retain original rename/category-move consumers using an explicitly test-only service entry. Reports identify `unconverted_test_engine`; default application entry stays gated. Package exclusion plus `artifact-smoke` reject any shipped test entry. |
| Source observer/reconciliation | Retain actual application observation, independent metadata edits, reservations and explicit binding guards. External old recovery arrangement uses actual engines followed by real reviewed enrollment; it does not backfill evidence. |
| Legacy unconfigured sources | Add paired new-source creation enrollment versus existing NULL-evidence root review. Root-only approval never enrolls legacy descendants or silently reactivates excluded records. |
| Cross-source ownership and mixed role history | Add actual macOS Data-volume alias, duplicate-root creation/binding/restore and NTFS GUID-case ownership controls. Require full durable evidence for a non-NULL dormant record, even with equal native triples; retain separate legitimate NULL-history and matching-durable controls. |
| Supported host/package acceptance | Add registered `source-access` CI selection: full suite on macOS/Windows latest/Windows 2022, production development Sources and unchanged package/resources plus packaged Sources. Original ordinary CI defaults remain unchanged. This route makes no claim that gated #72 effects are available. |


The old current-application `keep_original` settlement/observer scenario is deferred
specifically to #72: after settlement, a late pre-settlement scan must not restore
ambiguous eligibility or a degraded state for either sibling. That transition is
unreachable through #71's production gate; generic source-binding generation tests
do not replace its settlement-hook evidence. `project-category-move-runtime`
retains the complete keep-original journal/metadata/trees/receipt oracle through
the explicit legacy engine, while current production denial is compared against
`recoveryState` after each request, including every interrupted journal byte.
