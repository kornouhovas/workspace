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

The owner confirmed both TDD seams and authorized publication: typed public service
commands with temporary real folders/SQLite, and settings UI/Electron flows.

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
- [x] Confirm TDD seams with the owner.
- [x] Implement reviewed, persisted role interpretation with retention and migration coverage.
- [x] Expose the shared tree inside workspace settings and reconcile navigation/consumers.
- [ ] Complete appearance, affected behavior and retained-guarantee verification.
- [x] Complete independent Standards and Spec reviews; repair findings.
- [ ] Commit the verified candidate and complete required CI/integration acceptance.


## Local candidate evidence before independent review

- Public service TDD reproduced rejected role configuration, deep exclusion rejection,
  stored-projection rejection, legacy direct reinterpretation without status, parent
  replacement, shared ownership changes, Refresh losing no-status membership and
  invalid null configuration. Focused repairs pass. The real pre-role database test
  verifies reviewed legacy enrollment, role reinterpretation, restart, values and views.
- EN/RU UI tests verify explicit expansion, shared-impact confirmation, stale delayed
  responses, Cancel focus and retained saved overrides while the source is unavailable.
- `npm run test:migrations` renewed1027 cases:1026 passed, one platform skip, zero
  failures/cancellations. The first run's13 failures remain recorded locally: additive
  fixture inventories, an incomplete rewind fixture, old journal policy comparisons
  and the legacy exclusion guard. Repairs preserve exact authored values, immutable
  journal bytes and the old direct/grouped exclusion limit. No deadline was widened.
- Typecheck, lint, documentation links and diff checks pass on the candidate worktree.
- Real Electron role settings pass EN/RU, both themes,1024x720 and1440x960, shared
  review, explicit project expansion, parent/child overrides, Escape, independent views,
  shared archive location, restart IDs/values, file bytes, shutdown and owned cleanup.
  Inspected actual settings/project captures; the implemented tree uses existing
  Inter/semantic tokens and preserves pinned main080b416c's contextual entry/Back.
  The earlier passive stale message and background ambiguity were reproduced and
  repaired; failed receipts are not accepted as current runtime evidence.
- The Sources native journey is replaced by the #74 contextual role journey while
  retaining its shared ownership, review/cancellation, archive, localization/restart
  and file-preservation assertions. Existing direct/grouped service coverage remains.
- The owner expanded command scope after review: explicit Group/Status parent selection
  for create/move, plus rename and archive/restore for all role placements. Migration0034
  extends the existing journals with full route authority and immutable role snapshots.
  This task adds no filesystem effect to configuration edits.
  File listing/Reveal uses the existing full-ancestor trusted target for new roles.
- Remaining: independent Standards/Spec review and repairs, complete final suite,
  renewed exact-candidate native evidence, three-host DEV/package CI and integration.
  Local complete inventory will use serial file scheduling as in the accepted #73
  local run; CI retains its ordinary host scheduling and complete inventory.

## Owner-confirmed command expansion after review

The owner selected implementation now, rather than deferral, for project creation
and moves with an explicit Group/Status parent and rename/archive/restore for every
new placement. Both previously approved TDD seams still apply.

- [x] Public create/move accept explicit parent paths; service validates roles,
  containment and full durable root-to-parent authority. UI lists full paths so
  same-name status folders remain distinct.
- [x] Rename/move relocate explicit project and descendant overrides; root project
  creation persists Project semantics. Derived count/depth overflow rejects before effects.
- [x] Archive/restore retain no-status and nearest-status behavior; alternative names
  bind target policy, current role changes determine restored status, missing parents
  need explicit consent, and original intermediate-parent replacement rejects restore.
- [x] Interrupted deep create/rename/move retain journals across restart and complete
  only through fresh reviewed recovery. Backup rejects future versions, changed
  intermediate authority and contradictory role snapshots.
- [x] Real populated0033 journal rebuild preserves every old cell and dependent
  attestation; existing pre-identity fixtures retain their legacy rejection assertions.
- [ ] Renew the full migration inventory, native command journey, final independent
  reviews and complete final suite on the expanded candidate; publish exact-SHA CI.

## Expanded candidate verification and retained coverage

Both independent review axes pass after repairs. Thirty public command scenarios
cover role placements, repeated operations, interruption/reviewed recovery, backup,
parent replacement, explicit parent recreation and sibling restore. The populated0033
upgrade test retains every old table cell and its authentic dependent attestation.
Migration checks recorded1057 passes, one platform skip and no failures/cancellations.

The complete local inventory ran once with serial file scheduling:3910 tests,
3866 passed,17 failed,27 platform skips and no cancellations. All seventeen failed
scenarios were diagnosed and renewed without retiring their guarantees:

- One category-move IPC case exposed an overly broad client payload spread. The
  client again selects only accepted fields, including the new parent alternative.
- Five category runtime/production-component cases needed the two additive null
  journal columns in the exact expected schema. Existing bytes/state/effect and
  one-actual-operation assertions remain unchanged.
- Seven workspace-management UI cases used mocks that returned workspace-load
  payloads for the new contextual source query. A separate valid source-list mock
  preserves exact management-command assertions and explicit source scenarios.
- Four category-grouping UI cases now expect No status under #74. Ordinary Select
  remains No value; recovery and editable-metadata assertions are retained.

The transport/runtime repair passes40 tests; the renderer fixture repair passes102;
folder/ordinary grouping passes18. A rebuilt candidate's combined command, UI,
transport/runtime and grouping selection passes92 tests. The larger category/dialog
UI selection passes217. Typecheck, lint, local documentation links and diff checks
pass. The failed full receipt remains failed; final exact-candidate broad evidence
will come from the complete three-host CI route.

The real Electron expanded journey passes EN/RU, both themes and supported sizes,
Group creation, no-status rename, nested Status move, archive/restore, explicit root
move, restart IDs/paths/values/file bytes, normal shutdown and owned cleanup. Actual
creation/parent-selector captures were inspected. The driver scrolls to real row
identities, waits for enabled controls, follows explicit current-name/impact review
and acknowledges editor entry before authoring a mutation. Re-entering an editor
can handle row replacement during pointer activation; filesystem commands are never
replayed by that navigation preparation, and the original dialog deadline is kept.

Remaining delivery gate: publish the reviewed candidate, inspect required DEV/package
three-host CI receipts/captures and integrate only after complete acceptance. GitHub
checkpoints own exact SHAs, runs, inherited/renewed evidence and final delivery.

## First published CI failure map and repair gate

Run40190522307/attempt1 tested7ad3b1c4. macOS passed its full3910-case
inventory, role DEV journey and retained workspace DEV journey, then failed the
original retained-recovery DEV source-outage assertion at line132. Both Windows
hosts failed the same12 new deep role command scenarios with filesystem_changed;
root creation and archive parent-chain cases passed. Their full-suite reports have
51+14+3929 tests and12 failures, with no cancellations. Required later native/package
steps remained unreached and are not accepted.

- The original macOS native command reproduced locally. A minimized public service
  loop fails on fresh legacy and role sources without archive history: a root outage
  incorrectly changes last-known active membership to individual unresolved state.
  The repair returns null resolution for unavailable/unreadable sources and retains
  deliberate null values in the observed projection. Ownership conflicts and all
  actual filesystem authorization checks remain unchanged. Both public cases pass.
- A sub-millisecond guard loop reproduces the Windows failure using actual win32
  path semantics: native relative paths contain backslashes, while the immutable
  journal locator uses forward slashes. Compare after native-separator conversion;
  do not normalize the authored path. Windows/POSIX positive cases and traversal,
  link and changed-identity rejection cases pass. Native Windows renewal is pending.
- After the outage repair the original native journey advanced to its previously
  unreached line145, whose literal mode-change text was superseded by #74's folder
  configuration label. The inspected UI has the expected retained project and exact
  ordinary value. Update that literal; retain the original retained/edit/file checks.

Independent Standards and Spec review pass for the two application repairs. The
new folder-roles-repair manual gate targets these regressions and the original
retained DEV consumer on all three hosts. Full acceptance is renewed only after
that gate passes, because application inputs changed. No original failure, deadline,
identity/effect assertion or supported host is waived.

Local repair gate preparation passes160 focused/routing tests, typecheck, lint,
documentation links and diff checks. Strengthening the Windows/POSIX guard test
also exposed an old private-helper traversal gap: a canonical ../Outside relative
path could equal its supplied locator. Both hosts now explicitly reject parent
escape before comparing portable paths; exact identities still apply. The original
retained DEV command now passes all7 journeys and64 captures with normal shutdown
and owned cleanup. Native supported-host repair-gate results remain pending.


## Second focused failure and bounded consumer repair

Run40193124906 at97819571 passes52 public role/path/outage checks on every
host. macOS and Windows latest retained DEV pass7 journeys/64 captures each.
Windows2022's retained DEV stops at archived Text editor entry, line121, before
any authored value/save: the pointer click completed but no textarea appeared.
Its failure capture shows the enabled old value, focus BODY and archived context;
normal shutdown and owned cleanup passed. Exact historical timing cause is not
established. Three hypotheses were compared: pointer-time availability interruption,
editor focus/blur closure, and an obscuring context. A real Electron control rejects
the original pointer+fill under injected pointer-time disabling, then succeeds via
the existing one-activation keyboard/focus helper, with no application mutation.
Reuse that helper in this consumer; retain its15s deadline, exactly authored value,
Save and public persisted-value assertions. This is driver-only preparation.

A new Windows2022-only folder-roles-recovery-repair gate runs the bounded editor
controls and original retained DEV consumer, preserving the failed receipt.
The same review found that the retained script accepts positional mode rather than
the workflow's environment mode. Its packaged command now explicitly passes release;
prior DEV receipts never establish packaged acceptance. Routing tests cover this.
Application, migrations, dependencies and build/package inputs are unchanged from
97819571; its successful public/other-host repair receipts remain valid. Full
three-host DEV/package acceptance remains required after the focused gate passes.


## Full-suite expectation renewal and runtime complement

Full40194100008/attempt1 at9ee8c787 completed all three inventories: macOS
3917 cases/3881 pass/9 fail/27 skips; each Windows host51+14+3936 cases
with3913 passes in the last batch, the same9 failures and14 skips. No cancellations.
The local exact13-case selection reproduces9 failures and4 successes in2.4s.
All failures require the obsolete unavailable/unreadable projects=[]/unresolved
projection, contradicted by the accepted source-level-outage contract and the
original retained native consumer. Adapt expectations to null individual resolution
and retained last-known active/excluded membership; keep all SQL, bytes, Text,
counts, IDs and safety assertions. Changed roots remain unresolved and identity
conflicts replaced. The same13 cases then pass in2.1s. No application changes.

The actual-runtime assertion test consumes the source-disconnect expectations
from smoke-runtime and preserves both cycles, source fanout, isolation and byte
checks. A local whole-composite renewal failed earlier at superseded pre-#73
workspace-creation messaging, before outage. That failure is retained. Under
requirement-based retention, renew its affected segment using the current scoped
smoke-source-outage native driver: original verified move helper, two cycles,
active/excluded exact projections and authored Unicode/whitespace Text, shared
source IDs/distinct view IDs, isolated third workspace/source, exact source event
sequence and unsubscribe, original/source/unrelated/external link-target bytes,
restart and actual packaged-mode assertion. Current role/management/recovery
journeys replace the old composite setup/context assumptions; role journey covers
independent presentation. No original safety requirement is retired.

The all-host folder-outage-repair gate selects the13 original affected cases
before runtime acceptance. folder-roles-runtime then omits only the already-run
full inventory and supplies all original unreached DEV/package journeys plus the
scoped source-disconnect replacement in both modes. Application, migrations,
resources, dependencies and build/package inputs are identical to9ee8c787.
Successful full-suite complements retain their real SHA/run/artifact; repaired
expectations and runtime rows require new receipts. The failed runs stay failed.


## Native entry gate and remaining Windows complement

Outage-repair40198320655 at43811dde passes all13 selected cases on all3
hosts. Runtime40198618666 passes all8 macOS native DEV/package consumers with
owned shutdown/cleanup; packaged source-outage records app.isPackaged=true.
Windows latest stops at Settings/Appearance entry; capture shows the workspace,
not settings. Windows2022 reaches an explicit stale current-name review at rename,
with original path and requested draft intact. Both failed receipts retain their
original exits and successful cleanup. Later Windows consumers are unreached.

Real Electron controls demonstrate original pointer navigation failure under a
mid-gesture interruption and original rename-submit waiting forever after stale
review; no historical pointer timing cause is claimed. The scoped role helper
uses acknowledged keyboard Settings entry followed by selected-tab acknowledgment.
Rename allows one explicit review only when production exposes an enabled
current-name review (no pending/unresolved command), after public current name/path
and physical original-directory/absent-target verification. The uncertain-result
control has1 submission,0 effects,0 review and fails closed. The complete rename
keeps15s; no accepted command is replayed. Original local role journey passes.

The role-entry gate selects the2 controls and original role DEV on all3hosts.
After success, runtime tail renews role packaged on all3hosts and all missing
Windows consumers, inheriting unchanged successful macOS management/recovery/outage
receipts at43811dde. Application/build inputs remain identical to9ee8c787.
70 routing tests and lint pass; independent reviews cover this repair.


A local keyboard renewal also reproduced the Settings failure. Bounded passive
trace captured Enter delivered to Settings without a click/transition; the precise
reason for that consumed activation is unestablished. The navigation-only helper
now waits for the visible destination and may re-enter Settings within its original
15s budget. A control consumes the first keyboard activation and verifies eventual
selected-tab acknowledgment. No service mutation is repeated. Temporary trace
instrumentation was removed. Rename operand verification is also bounded by the
remaining15s; a stalled read-only callback fails with no further submission.


Focused40199671216 at9752299b passes macOS controls/role DEV; Windows
latest reaches Settings but loses target-tab selection, while Windows2022 passes
rename and stops entering archive review after a logged row detachment and hidden
replacement action. No filesystem submission was reached at that failure. The
navigation gate now waits through selected-tab acknowledgment and re-enters only
row tools/unsubmitted action forms after replacement, each within15s. A real
Electron row-clone control requires2 tools entries and exactly1 unsubmitted form;
first-tab activation consumption is also covered. Rename unknown-outcome and
operand guards remain unchanged. Local3 controls and the original role journey
pass. The same focused role-entry gate renews these changes before the existing
runtime complement; all prior failed receipts remain failed.
