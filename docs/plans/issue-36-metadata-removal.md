# Issue 36: reviewed metadata deletion

Tracker and acceptance: [GitHub #36](https://github.com/kornouhovas/workspace/issues/36).
Base: `127e8c0a915e8e511d14d08d9a4775a4cb10ec97`.
Owner approved the policy and service/SQLite, IPC and UI TDD seams in conversation.
Publication for this task to the currently public repository is explicitly authorized.

## Contract

Preview source-wide usages before deleting a custom property or ordinary option.
Cancel performs no mutation. Name and folder-backed structural properties are rejected.
Option clear removes its memberships; reassignment preserves other MultiSelect options
and deduplicates an already assigned destination. Remove the old option from filter
operands (remove a rule if no operand remains), or substitute/deduplicate its replacement.
Remove or transfer ordinary group keys and Board widths; an existing destination width
wins. Preserve other view settings and workspace-local visibility of surviving options.
Property deletion removes its values, options, visibility and all filter/group/layout
references, including dormant settings. Reset its active grouping to no grouping.
No operation edits project files, project identities or filesystem journals.

An opaque, workspace-bound in-memory preview token binds the selected action and a fresh
source-wide snapshot, including every sibling view. Any intervening relevant change,
new workspace/view, service restart or consumed token requires another review. Validate
again inside the same SQLite transaction as values/reference cleanup and source revision.
A failure rolls back the complete operation and emits no committed events. Publish the
existing source-wide property event only after commit; consumers reread view settings.

## Scenarios and checks

- Service, real disposable SQLite: preview/cancel purity; each custom type; both option
  actions for Single Select/MultiSelect; destination already present; empty usages;
  hidden options; active/archived/retained values; configured Table and Board siblings;
  filter operands, active/dormant group keys and widths; unrelated source isolation;
  restart; structural/foreign IDs; stale values, view edits, sibling creation, tokens;
  injected transaction failure and no events; filesystem contents unchanged.
- IPC: exact request shapes, owned token/action, malformed/foreign requests rejected;
  real backend request/response route and renderer-client forwarding.
- UI: EN/RU review, explicit clear/reassign/cancel, keyboard focus/Escape, pending,
  empty/loading/error and stale-preview refresh; failed/unknown apply rereads state
  without replay. All affected view consumers refresh after the property event.
- Required candidate checks: focused tests and regular typecheck, lint, docs, diff,
  one full final suite; review Standards/Spec against the immutable base.
- Platform acceptance: inspect the actual CI workflow, extend its existing runtime
  fixture as necessary, and inspect required exact-SHA macOS/Windows artifacts before
  issue acceptance and authorized integration into `new-workspace`.

## Progress

Implementation, focused service/IPC/UI checks, full local native view scenarios and independent Standards/Spec review are complete. The final local inventory is recorded in the verification report (3035 pass, four unchanged standalone native-close failures, 26 conditional skips); exact-SHA platform acceptance remains governed by the GitHub checkpoint. GitHub checkpoint owns
live progress, platform acceptance and delivered SHA. No new bb module is planned.
