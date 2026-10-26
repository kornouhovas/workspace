# Issue 77 status colors verification

Baseline: `5f3987a8`; [scenario plan](../plans/issue-77-status-colors.md).
The GitHub checkpoint owns exact candidate/delivery SHA and CI receipts.

## Appearance

Main composition reference remains `080b416c`; bb foundation reference remains
`f135a001`. New UI uses the existing native labeled select, category palette and
ContextTools. No upstream code or dependency is added. Real folder basenames
remain in settings/cells; existing group labels preserve path disambiguation.
Settings expose workspace-local color scope beside the shared folder-role scope.

The first Electron journey passed EN/RU, both themes, 1024x720 and 1440x960,
settings and both group layouts, restart, focus and cleanup. Its setup left
unnecessary historical associations from an initial role configuration. The
fixture was adapted to start unconfigured and explicitly group by status. This
is a fixture repair, not application acceptance for the completed candidate.
The corrected fixture passes the same complete local Electron journey: eight
language/theme/size combinations and 24 settings/Table/Board captures, immediate
agreement, duplicate/sibling isolation, restart and normal shutdown/cleanup.
Representative settings and group captures were visually inspected, including
narrow RU dark and wide EN light. Supported-host CI receipts remain pending.

## Affected behavior

Public service tests use real disposable SQLite/folders. They cover distinct
same-name identities, color-only persistence/reopen, sibling workspace isolation,
unchanged projects/discovery revision/bytes, visibility/order retention,
foreign/inactive/malformed rejection and targeted/no-op notifications.
The initial notification assertion was narrowed to category presentation events;
background source observation is an independent retained contract.

EN/RU UI tests cover save/pending/focus, rejected response/read-only recovery,
settings path identity and role-draft preservation on presentation events.
A separate red/green ordering test reproduces a delayed command response
repainting a newer committed color and guards the corrected precedence.
Typecheck, lint, documentation links and 136 focused regressions pass.
Independent Standards/Spec reviews found one shared error-focus concern, repaired
by focusing Refresh on failure and the select after read-only recovery. EN/RU
component checks and a real Electron production-component control cover rejection,
transport failure, Escape/return and no mutation replay. Reinstating the original
focus behavior makes the native control fail; the repair passes. No remaining
material review findings. Final full suite and supported-host receipts remain
pending until the GitHub ledger.
The native journey records discovery revision before/after the complete session
instead of requiring equality across background observation and restart; the
public service test retains the strict color-command revision invariant.

## Retained guarantees and selection

Existing category-presentation, ordinary Single/MultiSelect ownership, folder-role
UI and grouping tests are retained. Only folder-role mocked clients are adapted
for the additive presentation read/subscription. No inherited requirement is
retired. Schema, filesystem/native resources, dependencies and installer behavior
are unchanged. The new command travels through the existing validated category
request routing, service and isolated preload boundary.

The `status-colors` CI selector runs affected checks and real DEV/package
consumers on macOS latest, Windows latest and Windows2022. Its reports retain
SHA/run/attempt, platform, actual mode, screenshots, normal quit and cleanup.
The final local full suite is separate from those affected-host receipts.
Final desktop #67, release #42 and manual Windows11 acceptance remain separate.
