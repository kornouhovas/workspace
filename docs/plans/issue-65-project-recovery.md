# Issue 65: retained project recovery

Baseline: `90c4fbdb04f1720ecf174fd8b388bb39c0fb36cd` (accepted #62 and #61).
Branch: `codex/issue-65-project-recovery`. Tracker: #65; all native and textual
blockers #55/#61/#62/#64 are closed. Execution uses Matt Pocock implement/TDD.

## Scope and handoff

Retain the accepted main `080b416c` project/tab composition and bb `f135a001`
compact typography, tokens and existing Radix operation dialog. No splits or
additional runtime dependencies. Keep the current service identity, reassociation,
archive, source ownership and review-token contracts. No schema change is planned.

The selected project's current status belongs immediately below its header/path.
Missing/replaced/unresolved projects offer Locate folder; excluded and mode-inactive
projects explain the actual reason and offer source settings. A root outage takes
precedence over individual missing state. Archived projects identify their state,
retain ordinary editors and expose only applicable filesystem actions. Refresh and
retry stay reachable in expanded and preview contexts. Recovery opens in the existing
nonmodal operation dialog, including when the saved-view host is hidden. Cancel,
Escape and confirmed completion return focus to the current visible origin or
current project header. Switching project invalidates an old recovery response;
no automatic mutation replay or tab activation follows a late result.

## Public seams and scenarios

The issue already selects these seams: typed Workspace service with disposable real
SQLite/filesystem, renderer interactions, and actual Electron/platform consumers.

| Acceptance | Check |
| --- | --- |
| Retained missing/excluded/mode-inactive/archive/source outage | Contextual status, applicable actions and unique retained tabs, EN/RU |
| Verified move/rename and copy/replacement ambiguity | Retain external-reconciliation/recovery service cases; fresh file tree and values in navigation |
| Recovery entry/return | Preview/expanded Locate, visible dialog, Cancel/Escape/focus, close/reopen, stale/failed preview and retry |
| Safety and root outage | Source-wide status precedes individual resolution, unsafe actions disabled; current tokens and contained targets |
| Settings without an open source | Contextual Sources route and shell Backup/recovery remain reachable; return preserves project context |
| Session restart/restore | Retain session/backup service and native consumers; current availability revalidation |
| Delayed reads/switching | Delayed previews/commands cannot activate or overwrite another selected project; reads do not replay mutations |
| Appearance | Whole-window EN/RU, light/dark, 1024x720/1440x960; compare main composition and current accepted desktop styling |

## Inherited coverage decisions

- Retain project-recovery-service, external-reconciliation-service, discovery-mode,
  project-archive, workspace-sessions and data-recovery cases: identity, native
  evidence, containment, current review tokens and session persistence remain valid.
- Adapt project-recovery-ui entry and focus assertions to the contextual dialog;
  preserve pending/stale/uncertain outcomes and independent ordinary editing.
- Retain project-navigation-ui, project-files and contextual-archive controls;
  expand their current status/return and delayed-response cases where affected.
- No accepted product scenario is retired. Any obsolete selector is replaced by
  the corresponding accessible action/state assertion, with a recorded reason.

## Verification and progress

Run focused tests and typecheck during each vertical slice, then affected service,
renderer and native consumers on the completed candidate. Review Standards and
Spec with the code-review skill, repair findings, then run the full suite once.
Use a matching hosted desktop route with exact SHA/host/artifact provenance;
retain unchanged installer/release inputs under the matrix. Existing #62 broad
synthetic quit/cleanup failures remain explicit historical watchpoints, not a
passing receipt or permission to defer an affected failure.

Current: scoped implementation and local behavior/appearance checks pass;
[verification](../verification/issue-65-project-recovery.md) records actual results
and retained failures. Standards/Spec review returned zero findings. The one full-suite run completed
with explicit unrelated synthetic-quit/cleanup failures in the report. Hosted
three-host scoped acceptance passed at `aef7ab77`, with all selected tests, native
and packaged consumers and exact-SHA artifacts inspected. The final documentation
receipt changes no accepted source/test/package inputs. Live checkpoints and delivery SHA belong to #65.
