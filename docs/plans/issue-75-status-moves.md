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
