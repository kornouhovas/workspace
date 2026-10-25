# Issue 75: safe status assignment

Tracker: [#75](https://github.com/kornouhovas/workspace/issues/75).
Baseline: `52c7a9e35e8c28ec5dd6eff21f720b873a8c4203`, accepted #74 integration.
Branch: `codex/issue-75-status-moves`; checkout: `.worktrees/issue-75-status-moves`.
Executor: Matt Pocock implement. Both native/textual blockers (#72, #74) are closed;
no native parent or earlier issue ownership checkpoint existed at start.

## Outcome and boundaries

Status editing and supported Table/Board group assignment move whole project
folders into permitted physical statuses. Keep category UUIDs and show full paths
so same-name destinations remain distinct. Preserve basename, project identity,
values, contents and applicable descendant role overrides.

No status, statuses under another status and historical unavailable groups retain
their projects and discovery visibility, but cannot receive status assignment.
Explain disabled choices in EN/RU. Retain #74's separately owner-approved explicit
parent-folder operation and ordinary-property metadata assignment.

Revalidate current source, roles, category ownership, revision and durable/current-
mount evidence before effects. Retain collision, substitution, containment and
no-overwrite guards from the existing journaled engine. Pending/lost outcomes keep
original bindings; interruption requires explicit fresh recovery review. Cancel,
keyboard return and independent focus remain usable through source refresh.

No schema/native/installer change, release, main merge or live-data repair belongs
to this issue. Use only disposable real folders and SQLite for safety/recovery.

## Scenario ledger

| Requirement | Check / retained guarantee |
| --- | --- |
| Distinct allowed destinations | Public projection and native status choices use UUIDs and Clients/Active versus Personal/Active paths |
| Whole-folder move | Public Table/Board commands, exact bytes/Text, saved descendant roles and reopen |
| Invalid destinations | Nested/No status/historical UI states, visible discovery and service rejection before effects |
| Failure safety | Occupied destination, stale config, replaced intermediate parent, foreign ownership; original contents retained |
| Recovery | Injected transaction interruption, no automatic replay, reviewed explicit completion and restart; original journal/crash/IPC suites retained |
| UI lifecycle | Status UUID request, Cancel/Escape, pending/unknown controller coverage, delayed refresh and independent focus; actual DEV/package return/reopen |
| Ordinary assignment / parent action | Existing service/UI suites and original native consumers retained |
| Appearance | Main/bb reference contract, EN/RU, light/dark, 1024x720/1440x960 captures on required hosts |

The owner explicitly confirmed both public TDD seams: service commands with real
temporary folders/SQLite and UI/Electron interactions. Existing requirements are
retained; only superseded status-choice expectations are adapted. No test is
retired because it failed or was costly.

## Completed implementation and verification

- [x] Verify ownership/dependencies and create the isolated branch from the accepted tip.
- [x] Implement full-path status choices and server ownership/nesting restrictions.
- [x] Add status-cell editing and preserve Table/Board accessible assignment routes.
- [x] Verify identity, contents, properties, roles, failure safety and explicit recovery.
- [x] Preserve pending/unknown bindings, cancellation and return focus.
- [x] Review Standards and Spec independently; repair and re-review findings.
- [x] Run focused checks/typechecking and the final complete local suite, retaining negative receipts.
- [x] Inspect appearance and current affected DEV/package evidence on all three supported CI hosts.
- [x] Commit and publish the verified implementation and acceptance records.

Application source: `e1551eca` (implementation `fdd9e97c` plus status focus repair).
Accepted native candidate: `5dd4918f`. Current controller/service verification is
346/346 on macOS latest, Windows latest and Windows2022; evaluated routing checks
pass 74/74. Required native rows are complete through inspected receipts at e155,
ad8 and 5dd. Source/build equality and exact run/attempt/artifact provenance are
recorded in the [verification report](../verification/issue-75-status-moves.md).

The initial and final local full runs remain non-green: 3901/23/27 and
3877/53/27 passed/failed/skipped respectively. Their inherited native shutdown/
cleanup watchpoints, task dependency-symlink correction, selector/CRLF repairs and
fresh native draft guards retain explicit evidence. Hosted full application/data/
native assertions pass; failed routing rows and all changed/unreached native rows
have their own passing renewals. There is no blanket full-green claim.

GitHub owns integration status and the delivered SHA. Follow the authorized
new-workspace integration route after acceptance; do not start another issue.
