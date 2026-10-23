# Issue 66: Recovery settings and application information

Issue: https://github.com/kornouhovas/workspace/issues/66

Initial preparation: `fba398960b534b56a898930c132066e855f71a45`. Implementation updated before code changes to accepted `new-workspace` at `5dee808a`.
Branch: `codex/issue-66-recovery-settings`.
Native and textual blocker #55 is closed; no existing coordinator/checkpoint was recorded for #66.

## Contract and handoff

Extend the accepted #69 settings template: pinned main `080b416c` supplies composition and bb `f135a001` supplies Inter, semantic colors, cards, sidebar and controls. Use the existing Backup and recovery/About categories, category memory and Back/focus behavior. No additional copied module or runtime dependency is planned.

Backup and recovery displays the existing verified snapshot list, destination, 24-hour/seven-copy policy, pre-migration distinction, manual export and file selection directly in the settings card. Review includes the selected file/backup identity, replacement scope, Cancel/Escape, explicit Apply, pending, rejected and unknown outcomes. Preserve existing typed commands, schema validation, transaction, no-replay and project-file exclusion guarantees. Return focus to the initiating control after Cancel.

About displays the actual package version and complete applicable notices with readable, wrapping license content. Build/package/version checks remain authoritative.

Startup recovery remains reachable without a working source or initialized application data. If the backend cannot open its database, explain the exact backup/migration diagnostic and existing matching-version recovery procedure; never suggest that an unavailable backend can replace data. After successful restore, reload the renderer so current-run navigation and cached project contexts are discarded; hydrate the actual restored session.

## Scenario and inherited coverage map

| Requirement | Coverage and disposition |
| --- | --- |
| Automatic/pre-migration status, schedule/retention, create/retry, export and reviewed restore | Retain backend backup/recovery tests; adapt renderer/native presentation selectors only as needed |
| Explicit replacement, Cancel/Escape/focus, pending/error/unknown no replay | Retain existing recovery UI scenarios; extend for direct category and originating-control focus |
| Sessions/source/settings/views and populated upgrade round trips | Retain #55 real SQLite session/recovery/backup scenarios; renew affected consumers |
| Invalid/interrupted restore and missing folders | Retain real recovery crash/validation and session availability cases; renew native recovery consumer |
| Startup failure/source unavailability | Extend settings/App checks for recovery instructions and safe disabled operations |
| Product version and notices | Existing version/package/provenance checks plus visible About coverage |
| Category memory, Back/focus, independent preference saves | Retain shell/App/settings cases; renew complete affected files |
| EN/RU, 1024x720 and 1440x960, light/dark | Actual whole-window Electron captures and comparison with accepted settings handoff |

Owner confirmed all three TDD seams on 2026-10-23: renderer interaction, public Workspace service using temporary real SQLite/filesystem fixtures, and actual Electron journeys. Red/green cycles recorded under `/tmp/issue66-*`; final receipts are recorded below.

## Verification status

Scoped implementation and acceptance complete on repaired candidate `052f6787`: independent review, affected checks, actual local dev/release recovery/session/resource checks and inspected three-host CI run `39892142679` attempt1. See the verification report below for the separately retained broad local negative and exact evidence. Delivery/integration SHA belongs to the GitHub issue checkpoint. This does not authorize a release.

## In-progress observations

- Direct category/focus initially red (both languages), then 10/10 passing; startup and About added red/green, recovery UI12/12. Public backup/recovery/session/component checks44/44; complete App/recovery/route files154/154 before the additive unconfirmed-result scenario. Typecheck, build and version pass using Node22.21.1.
- First native attempt failed because an inherited `details.open` predicate became vacuously true when the disclosure was replaced. The current driver waits for the actual load event and ready App, retaining original restore/data assertions. A subsequent attempt reached all EN/RU restore/restart/project-byte checks but failed the final 10-second ordinary quit; it remains a negative receipt. A readiness hypothesis adds actual App readiness before native interactions/quit; acceptance is pending that invocation, not a claim that causation is established.
- Review now uses the existing shared operation dialog, keeping failure/pending feedback within its focus scope. The inherited DOM fixture now installs browser globals before loading Radix; assertions and deadlines are retained. Native error selectors follow the portalled dialog rather than its former settings-card parent.
- Selected route: `desktop-ux/recovery-settings`, all three existing hosts, development/release recovery and session consumers; unchanged installer and scale milestones remain separately owned. No schema, native command, dependency or installer source changes.

## Candidate review and local broad result

Application candidate `a0b6a7a7` has independent Standards0/Spec0 findings. One
fresh-build `npm test` completed3430pass/2fail/27skip; both unchanged synthetic
native quit deadlines remain negative broader watchpoints, with no full retry.
See the [verification report](../verification/issue-66-recovery-settings.md) and
[failure inventory](../verification/issue-66-full-suite-failures.json). All scoped
checks passed. Final dev/release and hosted route acceptance remain pending.

## Appearance repair

Final inspection rejected the initial dialog's two-column arrangement caused by
an inherited `.recovery-review` class collision. The native geometry assertion
reproduced both alignment/stacking failures against the old packaged candidate.
The new wrapper alone is `.data-restore-review`; old project recovery CSS matches
baseline exactly. Focused recovery/project-recovery/dialog75/75 and typecheck/build
pass. Independent repair review has no implementation findings; the report now
records the rejected appearance and pending repaired-candidate provenance. Renew
both native modes, affected renderer/route consumers and hosted acceptance. Other
passing broad checks retain their actual a0b6a7a7 provenance; no full-green claim.

## Scoped acceptance complete

Repaired candidate `052f6787` passed real local and hosted geometry, recovery,
startup/source outage, session, notices/version and package consumers. Inspected
CI `39892142679` attempt1: macOS252/252; each Windows251/251, all zero skips.
Artifacts12475835884/12474948341/12475960442 retain exact SHA/report provenance.
Appearance and retained behavior are recorded separately in the verification
report. Broader synthetic shutdown watchpoints remain with67/42; no release or
main merge. Integrate through the existing owner-authorized route and record the
delivered SHA in GitHub. Later report-only files retain unchanged application,
service/schema/native/dependency/build/package inputs from the tested candidate.
