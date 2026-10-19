# Issue 48 desktop shell

Issue authority: GitHub #48 and parent #47. Baseline: `8b35d16e` (owner-stopped #41 integrated; performance acceptance remains independent).

## Scenarios and inherited-test inventory (before implementation)

- Retain all service, SQLite, filesystem, recovery, IPC and platform safety scenarios and their registration.
- Adapt App language/settings scenarios and runtime smoke entry to open General explicitly. Their persistence, backend error and authored-text assertions remain.
- Retain workspace creation/rename/reorder/removal controls as working legacy entry points; adapt navigation into Workspaces as needed.
- Retain discovery/property/view controls and real Table/Board behavior, including #41 viewport projection. No wholesale test import or disabled assertions.
- Add typed-service appearance default, independent language/theme writes, invalid values, failed save and reopen coverage. Existing settings records support another key without a migration.
- Add renderer launch/sidebar switching, settings categories, in-session route memory, keyboard return/focus, preserved context, pending/error/retry and backend-unavailable navigation.
- Inspect real Electron at 1024x720 and 1440x960 in EN/RU/light/dark, OS-theme changes and independent scroll ownership; retain representative Ladle control states.

## Delivery

Review against baseline and #48, repair findings, typecheck/lint/focused checks and full suite on completed candidate. Local evidence will be recorded in `docs/verification/issue-48-desktop-shell.md`. GitHub checkpoint owns CI, human acceptance and integration gates. The owner explicitly authorized public push and integration of #48 on 2026-10-19.
