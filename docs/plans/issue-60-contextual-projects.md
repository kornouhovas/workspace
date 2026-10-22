# Issue 60: contextual project operations

Tracker: [#60](https://github.com/kornouhovas/workspace/issues/60).
Baseline: `8b490e5e8801ffe7c2e52302d72cd6258b4443a5`, after #59 closed.
Branch: `codex/issue-60-contextual-projects`.

## Contract and scenarios

Retain the existing recoverable creation, no-replace rename and ID-only native
Reveal commands. No service, schema, native adapter or IPC change is planned.
Creation already uses the saved-view action area. Row/card menus already provide
rename and Reveal; complete the missing project-details rename entry point rather
than duplicating controls. The retained-tab project ID remains the identity.

- Direct creation and grouped creation in an existing category use exact authored
  names, current revisions and containment checks. Refresh the real view projection;
  filters can legitimately exclude the committed project.
- Compact Radix dialogs show relative source paths, validation, pending and actual
  receipts. Cancel/Escape before submission have no effect. Dismissing a pending
  form does not cancel the accepted command. Status and explicit token-bound
  recovery do not automatically replay mutations.
- Rename from Table, Board, preview and expanded details retains project identity,
  unrelated values and tabs. Occupied/invalid/permission outcomes remain explicit.
- Reveal stays a distinct native action, authorizes the current target and exposes
  pending, dispatched, rejected and lost-response outcomes.
- Verify keyboard entry, focus return, EN/RU, light/dark and 1024x720/1440x960.

## Verification and inherited coverage

Agreed seams from the originating issue: public typed Workspace service with
real temporary SQLite/folders; renderer user interactions; actual Electron and
native supported-platform routes. Apply Matt Pocock TDD at these existing seams.
Retain creation/rename service, journal, crash, coordination, IPC and Reveal tests.
Adapt affected DOM setup and interaction discovery to dialog accessibility while
retaining every identity, recovery, collision, late-response and no-replay case.
Add named-dialog/path/cancel and project-details/retained-tab interaction cases.
No inherited requirement is retired.

Run focused files and typecheck during implementation; inspect actual changed
screens early. Review against Spec/Standards, run one full local suite on the
completed candidate and preserve any observed failures. Run an actual matching
three-host CI profile, inspect provenance and reports, then integrate through the
owner-authorized new-workspace route. Final release gates remain with #67/#42.

## Visual handoff

Main `080b416c` supplies contextual project journeys and the accepted composition;
bb `f135a001` supplies the existing Inter/semantic component styling. Use current
#69/#54 presentation as the comparison baseline. Add centered compact nonmodal
forms with shared semantic background/border/focus roles and source-relative
path wrapping; preserve the whole-screen shell, Table/Board and project area.
Use Radix Dialog 1.2.0 (MIT), following its controlled Root/Portal/Title contract with public Radix FocusScope 1.2.0
for focus lifecycle; no additional bb source is copied. This adds a runtime dependency, so
renew build/package/resource checks and supported-host consumers. Installer
configuration and native adapter inputs remain unchanged.

Escape arbitration uses an ordinary window-bubble fallback, after React editors
and document-owned contextual menus. Radix Dialog.Content is deliberately not
used: its unconditional document-capture dismissal would consume Escape before
independent editors. The public FocusScope preserves loop/autofocus behavior;
there are no private Radix APIs or native-event modifications.
