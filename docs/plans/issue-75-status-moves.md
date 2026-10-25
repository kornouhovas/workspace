# Issue 75: safe status assignment

Tracker: [#75](https://github.com/kornouhovas/workspace/issues/75).
Baseline: `52c7a9e35e8c28ec5dd6eff21f720b873a8c4203`, accepted #74 integration.
Branch: `codex/issue-75-status-moves`; checkout: `.worktrees/issue-75-status-moves`.
Executor: Matt Pocock implement. Both native blockers (#72, #74) are closed;
there is no native parent or existing issue checkpoint/owner.

## Contract and scenarios

- Status choices retain category UUIDs and show full source-relative paths, so
  Clients/Active and Personal/Active remain distinct.
- Status assignment moves the whole project into the chosen status folder,
  preserving basename, logical identity, values, bytes and descendant overrides.
- No status and statuses below another status remain discoverable, but cannot
  receive a status assignment. Explain disabled choices in EN/RU.
- Revalidate current source, roles, category ownership, revision and durable
  evidence before effects. Retain collision, substitution, containment and
  no-overwrite guards from the journaled move engine.
- Cover cancel, pending, lost response, explicit read-only status, interrupted
  operation review/recovery and restart on disposable roots/SQLite.
- Retain explicit parent-folder moves introduced and owner-approved in #74;
  status editing and group assignment do not expose arbitrary rearrangement.
- Preserve ordinary scalar/select assignment, Board/Table entry points,
  accessible alternatives and focus. Inspect EN/RU, themes and supported sizes.

## Verification and retention

Public seams reuse the owner-confirmed #74 boundaries and #75 acceptance: service commands using real temporary
folders/SQLite, and renderer/Electron interactions. Retain existing move identity,
crash, recovery, no-overwrite, IPC and ordinary property scenarios. Adapt status
choice/assignment expectations only where #75 changes the accepted contract.
No schema/native/packaging change is planned. Run focused regressions/typechecks
through slices; independent Standards/Spec review precedes the final full suite.
Renew affected filesystem/native/platform consumers in DEV and packaged modes on
macOS, Windows latest and Windows2022, using a matching scoped CI route. Preserve
exact SHA/run/artifact evidence. Release, main merge and live-data repair are excluded.

## Checkpoint

Implementation and verification in progress. GitHub owns CI/integration status.


## Local implementation evidence

- The initial public-service regression failed because nested status assignment
  completed; the scoped server guard now rejects it before effects.
- Focused service/role/grouping run: 56/56 passed, including distinct status UUIDs,
  whole-folder bytes, properties, descendant roles, restart, collisions, stale
  configuration, changed intermediate parents, foreign ownership and explicit
  interrupted-operation recovery. Existing move/crash/identity suites are retained.
- Focused inherited renderer run: 258/258 passed; the extended role/status UI and
  route checks pass separately (9/9). Pending/unknown/dismissal/review behavior
  remains covered through the shared move controller; status-specific commands
  retain category IDs rather than the explicit-parent action's path request.
- Typecheck/lint/build/documentation checks pass. Native appearance and complete
  final suite/three-host acceptance are pending; GitHub owns their delivery gates.
- Native driver preparation preserves the 15s bounds: query actual settled public
  paths through the existing host-side helper, visit viewport-loaded project rows,
  and use the existing native drag helper with a visible destination heading.
  Reading option.disabled verifies native option state; Playwright isDisabled
  retargets this option check to its enabled parent select.


## Review and native checkpoint

Independent code-review axes against `52c7a9e3...fdd9e97c`: Spec found zero
implementation issues. Standards found two P2 acceptance-guard issues: the
ordinary common job needed to exclude the new selector, and each shutdown needed
to assert backend exit. Both are repaired and independently re-reviewed with zero
remaining material findings. The routing regression now checks ordinary suppression.

The local macOS native status journey passes four EN/RU Table/Board cases, sixteen
light/dark 1024x720/1440x960 captures, whole-folder/value/role preservation,
reopen and two normal shutdowns with asserted backend termination and cleanup.
The retained #74 explicit parent-operation journey also passes. Inspected whole-screen
captures reuse main's accepted composition and existing bb-inspired controls/Inter
(reference revisions remain in reuse.md); the status cell adds the existing edit
icon and move dialog, with path choices and explanatory disabled states. No new
component framework, asset, CSS token or dependency is introduced. Text wraps and
actions remain reachable in inspected narrow RU and wide EN captures.

Earlier local driver failures remain failures: async predicate/path acknowledgment,
viewport-loaded Board rows, native option retargeting and native drag endpoint
preparation were reconciled with the existing helpers. Some runs timed out during
normal quit despite complete quit events; empty/source controls and the retained
role journey passed, so the historical cause is unestablished. The final driver
additionally proves post-assignment editor availability/Cancel focus and real UI
readiness after restart, then verifies unchanged normal-exit deadlines. Successful
current shutdown receipts do not relabel earlier failures. Final suite/CI and
integration remain pending at this checkpoint.


## Final-suite reconciliation

Single local full run:3901pass/23fail/27skip (3951total), including21 inherited
normal-close timeouts, Ladle's task-symlink403 and one omitted exact CI-selector
fixture. Original Ladle passes after replacing the task-owned dependency link;
73 focused inventory/routing checks pass after additive fixture reconciliation.
The application graph remains unchanged. Preserve full successful complement and
negative receipts; renew exact failures/missing platform/native tails through the
focused routes under ci.md, and keep historical quit causation unestablished.
