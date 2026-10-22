# Issue 62: contextual archive and restore

Baseline: `73437086516018598438a38f23535226abdd7646`; #50/#60 closed.
Owner selected Matt Pocock implement and authorized starting after blockers clear.
Branch: `codex/issue-62-contextual-archive`.

## Handoff

Main `080b416c` supplies daily Active/Archived, row/card and single-project
composition; bb `f135a001` supplies the existing Inter, semantic controls and
compact presentation. Reuse the accepted #60 nonmodal Radix operation dialog.
No new upstream source or dependency. Keep ordinary archived editors and the
fixed folder-backed category, source-owned archive settings and existing typed
review/apply/status/recovery boundaries. No service/schema/native rewrite.

## Scenarios and seams

The originating issue specifies public Workspace service with disposable SQLite
and folders, renderer interactions and actual Electron/platform checks.

- Table, Board, preview and expanded project menus expose current Archive/Restore.
- Review displays exact source-relative paths; Cancel/Escape has no mutation and
  returns focus. Independent editors and menus retain Escape ownership.
- Archive and restore preserve identity, ordinary values and retained tabs;
  switch Active/Archived without replacing the selected saved view.
- Occupied restore target requires an alternative name; missing parent requires
  explicit creation; incompatible mode remains blocked. No overwrite/guessing.
- Pending blocks competing operations; lost replies use the exact operation ID.
  Wrong project/action/source replies cannot complete a different operation.
- Fresh recovery review binds operation and token; source observations invalidate
  reviews. Restart/error safety remains covered by existing real-folder suites.
- Whole-screen EN/RU, light/dark, 1024x720/1440x960 comparison separately from
  behavior; real native journey verifies editing archived values and restart.

## Inherited coverage

Retain archive service/journal/crash/IPC, identity, containment, restore decisions,
category freeze and metadata tests. Retain the history form until contextual
replacement is verified; adapt only affected UI/native locators to current public
controls. Record any replacement by scenario in the verification report.

## Verification selection

Focused UI and affected navigation/selection/property checks while implementing;
typecheck/lint/build; early actual whole-screen comparison; final Spec/Standards
review and one full local suite. Add a bounded three-host desktop UX route for
the contextual journey and original archive/native consumers. Package renewal
where dialog/native consumers require it; unchanged installer inputs stay at
their accepted milestone. Actual results and remaining gates belong to #62 and
the verification report, not this scenario list.
