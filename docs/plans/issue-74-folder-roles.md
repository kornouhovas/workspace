# Issue 74: folder roles in workspace settings

Tracker and acceptance: [#74](https://github.com/kornouhovas/workspace/issues/74).
Baseline: `d20eddc1`, the accepted #73 integration. Executor: Matt Pocock implement.
Branch: `codex/issue-74-folder-roles`; worktree: `.worktrees/issue-74-folder-roles`.
Issue #73 is closed; its final checkpoint records three-host acceptance and integration.

## Outcome and boundaries

Configure the selected root's shared folder interpretation from contextual workspace
settings. Persist explicit group, status and project roles and exclusions, including
overrides below an existing project boundary. Ordinary discovery traverses groups
and statuses and stops at projects. Each project uses its nearest status ancestor,
or no status. Editing interpretation has no filesystem effects. A parent's role
change must preserve independently saved descendant roles.

Reuse existing typed service, SQLite and isolated renderer boundaries. Preserve
archive configuration until a usable replacement exists, shared source ownership,
workspace-owned views, source identity and operation reservations. No release,
main merge or live-data repair belongs to this task.

## Inspection findings

Current discovery supports direct and exactly two-level grouped scans. Role support
requires coordinated changes to scanning, planning, durable evidence and watcher
topology; changing only the settings UI would leave background discovery inconsistent.
Existing SQLite triggers require immediate-parent categories and prohibit nested
category paths. Existing project list validation and several physical-operation
authorizers also assume that layout. Migration and consumer reconciliation must
preserve those safety guarantees under the accepted role model.

Use explicit reviewed configuration changes with source revision, current folder
evidence, ownership and unfinished-operation reservations. Preserve project IDs,
values and view references when sufficient evidence proves continuity. Keep
unrecognized or ambiguous historical records for explicit recovery. A role change
must never transfer a former project's metadata to a newly discovered child.

## Scenario ledger

| Requirement | Evidence to produce |
| --- | --- |
| Shared persisted tree | Public service commands, two workspaces over one root, reopen; independent view settings |
| Descendant overrides | Expand below a project in settings; save child roles; change parent without rewriting child roles |
| Nearest status | Clients(group)/Acme(status)/App(project) -> Acme; Clients(group)/App(project) -> no status; Work(status)/Urgent(status)/App(project) -> Urgent |
| Distinct status identity | Same-name status folders at distinct paths keep distinct IDs and memberships |
| Stop at projects | Ordinary discovery leaves project contents untraversed; explicit settings expansion is separate |
| Reviewed edits | Impact includes affected sibling workspaces; stale config, filesystem/evidence changes and reservations reject Apply |
| Data preservation | Existing populated source, real schema upgrade, reinterpretation, restart; IDs/values/view references retained or exposed for recovery |
| Exclusions and safety | Temporary roots, links/hidden/archive exclusions, containment, unavailable root and failed transaction; no filesystem mutation |
| Existing consumers | Reconcile project/category commands, archive/restore, recovery, grouping/filtering, source identity, worker and watcher behavior |
| Settings navigation | No Sources navigation entry; selected workspace detail shows root, availability, roles/exclusions and archive controls |
| Session and accessibility | Contextual entry, Back, selection/scroll, keyboard and focus; EN/RU, themes and supported sizes |

## Test retention and verification

Proposed TDD seams await the owner's response: typed public service commands with
temporary real folders/SQLite, and settings UI/Electron flows. No new test has been
written before that confirmation, as required by the TDD skill.

Retain source identity, data preservation, recovery, isolation and platform
guarantees. Adapt superseded direct/grouped UI assumptions to the accepted #74
tree. Identify replacement coverage before retiring any old scenario. Reconcile
migration counts/journal inventories, recovery validators, build fixtures and
upgrade/reopen consumers before the final run.

Run focused service/UI tests and typecheck during vertical slices. Inspect the
rendered settings early; run real Electron changed-flow checks. After both review
axes and repairs, run migration checks and the complete suite on the final
candidate. Select supported-host/package checks from the complete affected diff
under [desktop verification](../desktop-ux-verification.md) and [CI](../ci.md).
Record actual results and exact-SHA CI/integration progress in the issue checkpoint.

## Execution

- [x] Verify dependency completion, ownership and accepted baseline; create isolated branch.
- [x] Inspect current discovery, storage, identity and settings boundaries.
- [ ] Confirm TDD seams with the owner.
- [ ] Implement reviewed, persisted role interpretation with retention and migration coverage.
- [ ] Expose the shared tree inside workspace settings and reconcile navigation/consumers.
- [ ] Complete appearance, affected behavior and retained-guarantee verification.
- [ ] Complete independent Standards and Spec reviews; repair findings.
- [ ] Commit the verified candidate and complete required CI/integration acceptance.
