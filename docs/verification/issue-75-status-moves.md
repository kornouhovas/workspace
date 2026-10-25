# Issue 75: status assignment evidence

Tracker: [#75](https://github.com/kornouhovas/workspace/issues/75).
Base: `52c7a9e35e8c28ec5dd6eff21f720b873a8c4203`.
Application implementation: `fdd9e97c`; reviewed acceptance/driver repair: `8e0b258f`.
[Scenario plan](../plans/issue-75-status-moves.md).

## Appearance and interactions

Main's existing accepted workspace/Table/Board composition and bb-derived Inter,
semantic controls and operation dialog are reused; reference pins remain in
[reuse](../reuse.md). No new CSS, upstream code, icon asset or dependency is copied.
The project status cell adds an accessible Edit status action. Full source-relative
paths identify destinations, while existing Group assignment selects/drag handles
retain their entry points. No status/nested/historical targets remain visible
with disabled choices and EN/RU explanations. Explicit parent-folder moves remain
the distinct owner-approved #74 operation.

The local actual Electron journey records four EN/RU Table/Board behavior groups
and sixteen light/dark 1024x720/1440x960 whole-screen editor captures. Inspected narrow
RU/wide EN captures wrap explanatory text, retain reachable actions and preserve
existing styling. Cancel/Escape returns focus. Status editing, Table selection and
native Board drag move the folder; values/bytes/roles survive reopen. Two normal
shutdowns assert backend exit and owned fixture cleanup. Local evidence lives at
`work/issue-75-status-moves/result.json` and the adjacent captures; CI artifacts
supply durable exact-SHA host/mode receipts.

Earlier local driver failures remain historical failures. Existing settled-path,
viewport-visibility and native drag helpers replace premature predicate/visibility
assumptions. Native option.disabled is read directly. Post-assignment editor/Cancel
and restarted UI readiness are observed before normal quit. Some earlier quit
runs timed out despite complete quit events; their historical cause is not
established. Current successful shutdowns do not relabel those receipts.

## Behavior and retained guarantees

| Requirement | Evidence |
| --- | --- |
| Distinct physical status choices | Public projection and status editor use category UUIDs; Clients/Active and Personal/Active labels retain paths |
| Whole project, IDs, values, contents and overrides | Public Table/Board commands, temporary folders/SQLite, exact bytes/Text and saved descendant roles after restart |
| Invalid/nested/No status/historical targets | Public service rejections before effects; disabled native options and visible discovery groups |
| Occupied/stale/changed/foreign source | Public command regressions retain original files and occupied destination contents |
| Interrupted/uncertain/restart | Public interrupted-transaction regression, fresh recovery preview/explicit completion; inherited controller/journal/crash/IPC coverage retained |
| Pending/lost result/cancellation/focus | Shared move-controller renderer suite retained; status-specific category-ID request and Cancel checks added; real Electron Cancel/return/reopen verified |
| Ordinary-property assignment | Existing scalar/select service/UI suites and original native assignment consumer retained |
| Durable identity, containment/no overwrite | Existing #72 move engine, native primitive, original crash/journal/IPC suites retained; no native/schema change |
| General explicit parent operation | #74 original role service/UI and native journey retained |

Focused service/role/grouping verification:56/56 passed. Inherited focused renderer
verification:258/258 passed; extended status/role UI and routing:9/9 passed.
Typecheck, lint, build, documentation links and diff checks pass.
Independent code-review: Spec0 findings; Standards2 acceptance-guard findings,
repaired and independently re-reviewed with no remaining material findings.

The owner confirmed both TDD seams in this issue: real temporary service/SQLite/
filesystem checks and UI/Electron interactions. No live project data is used.

## Final acceptance checkpoint

The final local full suite and exact-candidate hosted acceptance are in progress.
[Hosted run40216043193](https://github.com/kornouhovas/workspace/actions/runs/40216043193)
tests `8e0b258fc84b8888fbc27a7b111a41447db75c89`, attempt1, with the scoped
`status-moves` route on macOS latest, Windows latest and Windows2022. It preserves
complete-suite and DEV/package consumers plus retained role/assignment journeys.
No passing result or integration is claimed at this checkpoint.

Local full-run failures remain explicit pending focused renewal: inherited native
fixtures hit the unchanged normal-close deadline after product assertions; their
cause is unestablished and the historical watchpoints remain separate. Ladle403
is explained by the temporary task dependency symlink placing bootstrap HTML
outside Vite's allowed root; replace the task-owned environment and renew its
original command without changing product/test allowlists. Final counts and
renewal receipts belong here after the full run completes.

No release, main merge, installer/signing change or live-data repair is included.
Windows Server CI evidence remains distinct from Windows11 manual desktop and
final #67/#42 acceptance.


### Local full-run result and focused repairs

The single final local `npm test` at8e0b258f finishes with3951 tests:
3901 passed,23 failed,27 skipped,0 cancelled. Its complete negative receipt is
retained at `work/issue-75-local/full.log`; it is not a green-suite claim.
Twenty-one failures are inherited native fixture normal-close timeouts after
product assertions. The synthetic creation fixture inputs are unchanged; the
category-header graph includes additive localization keys, while its used strings,
components, CSS/fonts and lifecycle code are unchanged. Historical native quit
watchpoints remain with their original broader milestone ownership; isolated
success cannot establish the cause of these current failures.

The remaining failures are the task dependency-symlink Ladle403 and the exact
CI selector inventory expectation. Replacing only the task-owned dependency
symlink with an owned copy preserves versions and source and renews original
Ladle1/1. Reconcile the expected selector list and add evaluated routing guards;
focused original inventory plus new route tests pass73/73 locally. This is a
verification-only repair: application, migrations, native resources, package/
lockfile/build inputs are byte-identical to8e0b258f. No product assertion, timeout,
cleanup gate or supported-platform promise is removed. Original native files
renew separately with their existing assertions; hosted repair and native tails
remain pending. Both test seams are now explicitly confirmed by the owner in
this issue, in addition to their accepted #74 precedent.
