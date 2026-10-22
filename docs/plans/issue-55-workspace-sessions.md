# Issue 55: Device-local workspace sessions

Issue: https://github.com/kornouhovas/workspace/issues/55

## Baseline and execution

Matt Pocock implement/TDD; no Ralphex. Immutable issue-start commit:
`8231d8bb1f74f1b4eb3692c6a09dc8a902bed6c0`.
Branch `codex/issue-55-workspace-sessions`, checkout
`.worktrees/issue-55-workspace-sessions`. Native and textual blockers #54 and
#69 are closed; #64 is also closed. Issue #55 has no prior execution checkpoint.

The owner confirmed all three test seams on 2026-10-22: public typed Workspace
service with disposable real SQLite/filesystem fixtures, user interactions in
the renderer, and real Electron/development and packaged restart/recovery flows.
The confirmation covers the Matt Pocock TDD seam requirement.

## Scope and slices

1. Add a narrow session read/save contract and one SQLite migration. Initialize
   sessions for existing workspaces and newly created workspaces. Workspace
   removal deletes only its own session; source siblings remain independent.
2. Persist unique ordered project IDs, expanded project, per-view preview IDs,
   sidebar width/collapse and project width. Use current workspace view selection
   as the authoritative saved view, with deletion fallback. Do not persist
   project values, filesystem snapshots, nested splits or navigation history.
3. Validate workspace/view/source ownership, bounded sizes, duplicate IDs and
   active-project membership. Use revision protection to reject obsolete writes;
   renderer lifetimes reject late reads and never save an unhydrated default.
4. Connect restoration and saving to existing project/sidebar controls without
   changing the accepted composition. Read current project properties, archive
   membership, availability and real files after restart and restore. Retained
   unavailable projects keep their tabs and actual status.
5. Extend backup/restore validation for session shape and relationships. Preserve
   historical-schema pre-migration backup verification, existing invalid and
   interrupted-restore protection, and project-file exclusion.
6. Reconcile migration consumers and inherited scenarios, review Standards and
   Spec independently against the immutable baseline, complete selected checks,
   commit verified changes and follow the authorized integration route only after
   complete acceptance. CI and integration checkpoints belong to GitHub #55.

## Acceptance map

| Requirement | Planned evidence |
| --- | --- |
| Existing/new workspace initialization and independent sibling sessions | Public service, real SQLite upgrade/reopen, workspace removal |
| Ordered unique tabs, active view/project, previews and allowed layout | Service validation plus renderer actions and Electron restart |
| Ownership and stale-write/response rejection | Public service revision/foreign-reference cases and delayed UI responses |
| Missing/excluded/archived/unavailable projects; fresh values/tree | Disposable folder/state transitions and real application restart |
| Automatic/pre-migration backup and export/restore | Existing recovery consumers plus populated-session round trips |
| Invalid/interrupted restore preserves app data, excludes project bytes | Existing recovery failure cases extended with session state |
| Accepted composition, EN/RU, themes, sizes, keyboard/focus/pending/error | Whole-window comparison with accepted #69 captures and pinned main/bb references |
| Retained guarantees and packaged/platform consumers | Migration inventory, selected actual CI route and inspected reports/artifacts |

## Inherited coverage decisions

Retain #54 tab/navigation/resize/scroll/focus scenarios and current-run-only
Back/Forward. Adapt only setup assumptions changed by asynchronous session
hydration; retain their observable assertions. Retain view lifecycle/selection,
workspace isolation, real SQLite upgrade, automatic backup, invalid/interrupted
restore and packaged app-data consumers. Update migration counts/schema
inventories with the new migration while retaining preservation/rejection
assertions. No scenario is retired at this preparation stage.

## Progress

Implementation and local acceptance are recorded below. All three test seams
are confirmed; platform acceptance and integration remain gated by GitHub #55.

## Implementation and focused evidence

All three seams were confirmed by the owner. Implemented migration 0023, typed
session read/save with revision/runtime-epoch protection, renderer hydration and
serialized saving, sidebar/project controls, backup validation and exact-schema
historical backup compatibility. View deletion prunes its preview transactionally.
No renderer filesystem/database capability, package dependency or CSS changes.

Observed locally (macOS kernel 27.0.0 arm64, Apple M1 Pro, Node 22.21.1):

- Service tracer went red on absent session query, green after implementation.
  Ownership tracer went red on foreign view IDs, then green after ownership checks.
  View-deletion and corrupt-restore tracers likewise went red before their repairs.
- `workspace-sessions-service.test.mjs`: 10 passing scenarios, including populated
  real upgrade/reopen, same-source sibling independence/removal, malformed/foreign
  state, runtime epoch, backup/export, missing/excluded/archived/unavailable roots.
- `project-navigation-ui.test.tsx`: 16 passing scenarios; restored expanded/preview,
  deleted view context, ignored late workspace read, no unhydrated default writes,
  and EN/RU explicit recovery without failed-operation replay.
- Original App/navigation renewal: 120/120 passed before the two additive
  late-read/error scenarios; the complete navigation file subsequently passed16/16.
- `npm run test:migrations` initial candidate: 665 pass/5 fail/1 skip. Four synthetic
  downgrade fixtures retained newer session schema while deleting its migration
  ledger; the historical inventory omitted the newly initialized table. Adapted
  those fixtures to remove the newer schema when constructing the old version,
  extended the inventory assertion to prove both initialized sessions, and retained
  every data/filter/group/layout/rejection assertion. All79 scenarios in the
  affected migration/recovery renewal passed. Full migration renewal remains due.
- Initial App run:93/106, with13 failures after shell remount during backend
  generation change. Keep the shell mounted and reset only the session controller;
  original three-failure reproduction passed3/3, complete App/navigation120/120.
- New real Electron development scenario now passes after repairing its cleanup
  callback:16 EN/RU/theme/size preview/expanded captures,3 normal app/backend quits,
  asserted owned cleanup, restart/fresh metadata/files, missing retained tab,
  export/verified-backup restoration and independent sibling sessions. First
  attempt's passed behavioral assertions and failed cleanup are not an overall pass.
- Typecheck/lint/docs/build and profile failure-propagation checks pass.

Appearance: compared `work/issue-55-sessions-dev/preview-ru-light-1024.png` with
accepted #69 Windows2022 navigation capture from run39699908853, plus current
expanded/theme/size variants. Main composition remains pinned080b416c and bb style
f135a001. Restored sidebar260px and project440px, the retained Beacon tab and current
real file content are intentional fixture/session differences. No composition or
style rewrite; existing CSS and resources are unchanged. Platform-rendering and
remaining captures require exact-candidate CI inspection before acceptance.

## Coverage reconciliation

Retain #54 navigation tests unchanged in their original observable contracts;
add provider-backed persistence scenarios at the same UI/service boundaries.
Adapt App's shared mock API with independent session storage so existing
settings/workspace/error/focus tests use the expanded public contract. Adapt
current migration count24, shipped migration inventory and historical downgrade
fixtures as above. Extend existing interrupted/engine-failed recovery fixtures
with populated saved/current sessions and assert rollback/restore of their widths.
No accepted requirement or scenario is retired.

## Remaining acceptance

Independent Standards/Spec review, any repairs and affected renewal; completed
candidate full suite and full migration renewal; actual supported desktop and
packaged session/recovery/saved-view consumers with artifact inspection; final
appearance map; exact-SHA GitHub checkpoint and authorized integration. Windows11
release and final #67/#42 gates remain separate. No issue acceptance claimed.


## Final local candidate and review

Standards review:0 findings; Spec review:0 confirmed findings against
`8231d8bb...7b39305`. Independent follow-up reviews of both repair diffs also
returned0/0; reviewers made no changes.

- Final `npm run test:migrations`:675 pass/0 fail/1 skip (676 reported tests).
- One final `npm run test:all`:3299 pass/3 fail/27 skip (3329 reported tests),
 201.1s. The three finite failures were the original App source-path assertion
 running before asynchronous session hydration, and two exact workflow inventories
 omitting the added session commands/artifacts. The source-path/heading checks now
 await the same content with the original budget; full/source continuation retain
 every prior command and add matching dev/release session commands/environments.
- Complete affected-file renewal (`renderer-app`, `windows-product-diagnostics`,
 `desktop-ux-checks`):144/144 pass. No application/schema/dependency/native/build
 input changed after the broad run; other3299 passing results are retained under
 the test-only evidence-reuse policy. The original overall broad negative is not
 relabeled as a green full invocation.
- Corrected appearance consumer uses actual Settings Appearance radio controls
 and waits for the document theme. Earlier dark-labelled light captures are not
 appearance evidence. The corrected original development command passes all16
 preview/expanded variants,3 normal app/backend quits and asserted fixture cleanup.
 Inspected the16-image contact sheet plus full-size narrow light/dark and wide
 expanded captures against accepted #69/main/bb composition. Persisted requested
 widths and retained tabs are the only intended composition differences.

Selected hosted acceptance: `desktop-ux/sessions` on macOS latest, Windows latest
and Windows2022, including actual dev/package session/recovery and packaged saved
views. Because startup/storage inputs changed, renew matching macOS14 DMG and
Windowslatest NSIS installation/reopen consumers and candidate-only packaged
performance on macOS14/Windowslatest. Existing immutable performance baseline
and final Windows11/67/42 gates are retained; no release is authorized.

Remaining: inspect those exact-SHA receipts/artifacts, diagnose any failures,
update the acceptance map, verify and integrate the accepted candidate only.
