# Issue 24: Calendar Date properties

Tracking and acceptance: [GitHub #24](https://github.com/kornouhovas/workspace/issues/24).
Baseline: `947d4eca`; task branch: `codex/issue-24-date-properties`.
Blocker #12 is closed. The owner confirmed the calendar contract and publication in
this intentionally public repository. Executor: Matt Pocock implement/TDD and
independent two-axis review; no Ralphex run.

## Contract and scope

Date is an ordinary source-owned property, including on retained and archived projects.
A value is a real proleptic Gregorian calendar day in canonical ASCII `YYYY-MM-DD`,
years 0001–9999. No instant, time-of-day, timezone or automatic normalization is stored.
Leap years use the divisible-by-4, century and divisible-by-400 rules. Null or
whitespace-only input clears; other noncanonical input is rejected, including surrounding
whitespace, timestamps, localized numeric input and impossible days. Equal values are
no-ops. Invalid commands and failed transactions preserve value, revision and notifications.

The owner confirmed this contract from the preserved calendar-string baseline. The
previous regex-only validation and local Date constructor are not correctness contracts.
The Table accepts keyboard `YYYY-MM-DD`; English and Russian medium-date display changes
only presentation. A UTC-only Intl adapter with explicit Gregorian calendar and full-year
assignment prevents timezone and year-00–99 conversion. Active drafts stay canonical and
survive language changes. Enter saves, Escape cancels, explicit Clear or empty Save clears;
failed saves retain draft and focus. The existing shared cell owns loading, busy/error,
sibling revision/lifetime guards and focus; no new calendar picker is required by this slice.

`workspace.createProperty` admits `date`; `workspace.setDateValue` accepts workspace,
project and property UUIDs plus `value: string | null`. The compatible
`workspace.listTextProperties` snapshot adds optional `dateValues` only for sources with a
Date definition, retaining separate Text and Number values. Immutable types, authored
labels, stable ordering, source ownership and sibling notifications remain enforced.

Migration 0015 expands definitions without changing earlier migrations, preserving Text
and Number children and their SQL type guards. Date storage has source/project foreign
keys, calendar checks and type guards; the immutable-type trigger is restored. Editing
Date changes no project folder/files, locator, project ID or view configuration. No bb
code or dependency was copied; the existing adapted foundation is reused.

## Scenario gates

| Scenario | Evidence route |
| --- | --- |
| Create/edit/clear, exact leap/boundary dates, settings/restart, no-op events | Date service suite using real temporary SQLite and isolated roots |
| Invalid dates/payloads, source/project/type ownership, immutable rename | Date service and built backend IPC suites |
| Transaction failures preserve state/events; Text/Number-preserving upgrade and SQL guards | Date service suite and `test:migrations` |
| Retained/archive editing and unchanged fixture bytes | Date service suite |
| EN/RU keyboard, draft/error/focus, same-property language switch, early year display | Date UI suite through actual typed client/service |
| Actual Electron preload/IPC/backend, timezone boundaries, language switch, restart, narrow/wide screens | `smoke:date` in development and packaged modes |
| Existing behavior and migration/build/package/CI consumers | Inherited full suite plus updated inventory expectations |
| Standards/spec correctness | Independent two-axis review of the complete candidate |
| Inherited full-CI navigation and post-dispatch acknowledgment failures | Original Windows latest/2022 readiness file; exact macOS grouped packaged creation/native command; unchanged-authority dirty-scan rejection controls |
| Target-OS CI and integration | Existing macOS/Windows latest/Windows 2022 routes plus Date dev/package steps/artifacts |

Observed local evidence belongs to [verification](../verification/issue-24-date-properties.md).
Exact-SHA CI, acceptance and delivery remain in the GitHub checkpoint; unresolved gates
are not completed acceptance. No separate human acceptance gate was requested.
