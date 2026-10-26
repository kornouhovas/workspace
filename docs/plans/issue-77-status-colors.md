# Issue 77: workspace-local status colors

Tracker: [#77](https://github.com/kornouhovas/workspace/issues/77).
Baseline: `5f3987a813f6d249ea661829c893574ffe4d54f1` (`new-workspace`).
Branch: `codex/issue-77-status-colors`; executor: Matt Pocock implement.
Native/textual blocker #74 is closed; no parent or existing coordinator checkpoint.
Publication is owner-authorized. No release, main merge or live-data repair.

## Scenario ledger and implementation

Reuse category_presentation (no migration) and add an exact typed color-only
command. Preserve hidden/order fields and other colors, reject foreign/inactive
identities, target only the selected workspace event, and persist across reopen.
Use one shared native-select editor inside the existing settings rows and
contextual group tools; retain folder basenames and identify duplicates by path.
The owner confirmed public service/real SQLite and UI/Electron TDD seams.

| Requirement | Planned evidence |
| --- | --- |
| Settings and Board/Table entry points | EN/RU UI interactions and real Electron journey |
| Immediate agreement and restart | Workspace events, actual settings/group/chip values, SQLite reopen |
| Duplicate names and workspace isolation | Two nested same-name statuses, sibling workspace, independent colors |
| Presentation only | Retained IDs/paths/content, source revision and other option presentation unchanged |
| Ordinary options | Retain existing source-owned option tests, no ordinary property wiring changes |
| Accessibility and failure | Keyboard/select, Escape/focus return, disabled pending, rejected/transport error and refresh |
| Appearance | Actual screenshots in both themes/languages, 1024x720 and 1440x960; shared bb foundation |

Retain existing category presentation, folder-role, selection ownership and
filesystem safety coverage. Add focused service/UI tests; no inherited requirement
is retired. Run typecheck/focused tests during slices, review both axes against
this baseline, then full suite once on the final candidate. Select supported-host
CI/native consumers by docs/desktop-ux-verification.md; acceptance receipts belong
in the GitHub checkpoint and verification report.

## Completion

All scoped criteria have passing inspected evidence in the
[verification ledger](../verification/issue-77-status-colors.md).
Standards/Spec reviews have no remaining findings after the error-focus repair.
Candidate `01720f66` passes the supported-host 137-regression/DEV/package route.
The local final full run remains failed; its successful complement and all 100
original failed-file tests after environment/serial renewal retain separate
provenance. No test requirement is retired. Final documentation-only commit and
integration SHA are recorded in the GitHub completion checkpoint.
