# Implementation plans

Create a plan only for an agreed, bounded slice. Link its GitHub issue; state the outcome, blocking dependencies, affected boundaries, verification and checkable completion criteria in English. Current tracking and executor selection follow [development](../development.md); a plan does not select Ralphex or authorize another task.

## Reading and status

Read the selected plan and the current GitHub checkpoint when executing or continuing that slice. Completed checkboxes prove only the recorded executable steps; issue acceptance also requires its review, required platform/Actions evidence and authorized [integration](../development.md#integration-branch). Read [completed](completed/) plans only for relevant historical implementation or acceptance evidence. Their former tracker instructions and Beads IDs are archival; GitHub is the sole live tracker.

The following executable checklists are complete, but retain stable paths for existing references/snapshots. Their location outside `completed/` does not make them unfinished or authorize replay:

| Plan | Remaining acceptance authority |
| --- | --- |
| [Workspace management](issue-10-workspace-management.md) | Current issue #10 acceptance and delivery checkpoint |
| [Windows diagnostics](20261010-issue-17-windows-diagnostic-repair.md) | Exact-SHA issue #17 platform results and current coordinator checkpoint |
| [Runner startup fixture](issue-19-runner-startup-fixture.md) | Issue #19 waiting snapshot and remaining review/Actions/native gates |
| [Ralphex observer](ralphex-event-observer.md) | Recorded review/platform evidence and separately scoped adoption/deployment |

Plan checklists track executable work and observed local verification. Link the GitHub checkpoint for candidate CI and delivery status; update post-commit run URLs and integration receipts there so recording acceptance does not routinely change the verified candidate.

Preserve product decisions in their contracts/ADRs; a plan cannot silently replace them. Update executable progress only from observed verification and report skipped, failed and unreached checks separately.
