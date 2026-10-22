# Issue 61: contextual categories

Baseline: `73437086516018598438a38f23535226abdd7646`; blocker #60 closed.
Branch: `codex/issue-61-contextual-categories`. GitHub #61 owns live status.

## Scope and handoff

Reuse existing typed Workspace commands and folder journals. Main `080b416c` owns contextual working composition; bb `f135a001` owns Inter, compact neutral controls and semantic tokens. Reuse the local Radix ProjectOperationDialog and source-relative authored paths. Keep source settings as the category management entry; Table/Board and preview/expanded menus share Move. Property-label rename stays separate from real folder operations.

## Scenarios and coverage

- Move active grouped projects through menus in Table, Board, preview and expanded details; preserve identity, values, tabs and source siblings. Empty/ineligible IDs, collisions, unavailable/external changes retain service rejection.
- Property-label rename changes metadata only; category create/associate/rename shows current affected paths before Apply.
- Occupied removal requires an explicit destination and fresh impact review; cancellation has no effect.
- Pending/unknown/interrupted operations retain exact IDs, read-only status and explicit recovery; no automatic replay or dismissal rollback.
- Keyboard/focus, Cancel/Escape and return; EN/RU, light/dark, 1024x720 and 1440x960 whole-screen comparison separately from behavior.

Retain existing move service/journal/crash/coordination/IPC, category options/removal service and UI scenarios: same current public commands and safety guarantees. Adapt DOM setup for Radix and dialog locators when necessary, retaining assertions. Add renderer dialog and details Move scenarios. Retain original native category drivers and their SQLite/filesystem/recovery assertions; adapt selectors only when changed composition requires it.

Public seams are prescribed in #61: Workspace service with real disposable SQLite/folders; renderer user interactions; actual Electron/platform routes. No new seam or service/storage boundary is proposed.

## Verification selection

Run focused renderer tests and typecheck during each slice. Inspect changed dialogs early in real Electron. Review Spec and Standards independently, repair findings, then run the full local suite once. Hosted three-host category acceptance must include existing folder-move/options native and recovery consumers plus the changed contextual journeys. Package/installer inputs are unchanged; expand routes if evidence shows wider impact. Record raw receipts and inherited-test decisions in the verification report; passing prior evidence stays at its actual SHA.

## Candidate progress

Scoped implementation, early whole-screen inspection and independent reviews are complete; both review axes have zero unresolved findings after Escape/focus repairs. Local scenarios and inheritance decisions are recorded in [verification](../verification/issue-61-contextual-categories.md). The full local receipt and passing three-host scoped hosted acceptance are recorded in verification. Integration delivery and exact delivered SHA remain in GitHub #61.
