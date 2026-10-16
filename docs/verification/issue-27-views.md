# Issue 27 verification

Scope and scenarios: [plan](../plans/issue-27-views.md). External acceptance and delivered
SHA: [GitHub #27](https://github.com/kornouhovas/workspace/issues/27).

## Local evidence

- Node 22.21.1 is used for builds and tests.
- Service/real SQLite regressions cover lifecycle, independent copies, workspace selection,
  Board-only fallback, malformed/foreign commands, injected duplication rollback and
  populated pre-view-management upgrade/reopen.
- EN/RU DOM interactions cover keyboard lifecycle and all existing property types in
  both layouts, including Active/Archived switching; Board edits reach sibling workspaces and sibling edits refresh Table/Board.
- Built IPC regressions cover every lifecycle command, malformed input and valid events.
- Existing migration fixtures retain their data-preservation/rejection assertions and
  explicitly account for view positions and workspace-owned selections.
- The new `smoke:views` route covers actual development/packaged Electron EN/RU lifecycle,
  validation, keyboard value edits, independent copy layout, selection after restart,
  sibling isolation, unchanged project bytes, normal shutdown and fixture cleanup.
  Screenshots include 360, 1024 and 1440 pixel widths.

## Observed candidate results

- `npm run build`: passed.
- `npm run typecheck`, `npm run lint`, `npm run check:docs`, `git diff --check`: passed.
- `npm run test:migrations`: 423 passed, one platform skip on the then-complete
  migration selection. Creation/recovery/rename historical fixtures were subsequently
  added to this focused command; the final full run covers the expanded inventory.
- `node --import tsx --test --test-concurrency=1 tests/*.test.mjs tests/*.test.tsx`:
  the complete test inventory, 2869 passed, 25 platform skips, zero failures.
- `npm run smoke:views -- dev`: passed EN/RU at 360/1024/1440, lifecycle/copy/layout,
  shared property editing, Active/Archived layout switching, restart, normal parent/
  backend shutdown and verified disposable-fixture cleanup. Local evidence is under
  `work/issue-27-views-runtime/`. Board screenshots were inspected at narrow and desktop widths.
- Two-axis Matt Pocock review: Standards had no findings. Spec found an Archived-layout
  omission; an integrated EN/RU red/green regression reproduced it, the selected layout
  was passed into archived rendering, and follow-up review confirmed resolution.
  Verification-fixture repairs received a separate Standards review with no findings.

The initial full run exposed missing view responses in old mocked UI clients,
historical view-position expectations and the CI command/artifact inventory. Those
fixtures now model the new public contract while retaining their ownership, exact-data,
rollback and focus assertions. Focused repaired UI/migration files passed 553 tests;
additional historical creation scenarios passed 114 tests.

Local native-fixture limitation: the ordinary parallel full run and a four-worker run
retained Electron-fixture shutdown timeouts with the unchanged 10-second deadline.
The original focused shutdown/driver checks and CI-inventory regressions passed (25/25), and the complete sequential
run passed without excluding cases, relaxing deadlines or changing shutdown assertions.
This does not establish the historical timeout cause or claim parallel reliability.
CI inherits the existing common tests and macOS/Windows latest/Windows 2022 platform
matrix, including runtime/package checks. The new view tests default to platform
coverage; development and packaged view smoke checks and retained evidence are added.
Local macOS evidence alone does not establish Windows acceptance.


- `CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:built` and
  `npm run check:artifact -- release`: passed for the unsigned local macOS arm64 package.
- `npm run smoke:views -- release`: passed both languages and all retained lifecycle,
  layout, source-property, archive, restart, shutdown and cleanup checks. Evidence is
  under `work/issue-27-views-release/`.
- Packaged acceptance exposed a runtime-driver sequencing issue: a keypress was sent
  while the next action was disabled by the preceding mutation. The driver now waits
  for the enabled native button before its single Enter, observes the visible delete
  confirmation before Escape, and waits for app-owned focus before asserting it.
  No mutation is replayed, and no focus, timeout or cleanup assertion is bypassed.
