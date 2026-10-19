# Desktop UX test inheritance

This is a scenario/provenance map, not another tracker or a requirement to copy
historical suites. Each new ticket owns adaptation of its affected existing tests.
The source specification and per-ticket migration criteria are authoritative.

## Inspected current baseline

The inspected new-workspace runtime baseline is d925f8b7. Its suite runner selects
111 test files: 9 common and 102 platform files, with complete nonoverlapping
coverage. This is inventory evidence only, not a passing test run. It excludes
helper/fixture files and future accepted #41 changes. Refresh the inventory from
the latest verified integration branch before implementation.

Examples of retained seams:

- [Workspace service](../../../tests/workspaces-service.test.mjs) uses temporary
  real folders and SQLite, including reopen/ownership assertions.
- [Table UI](../../../tests/table-layout-ui.test.tsx) uses the real service/SQLite
  but locates the old Table layout panel. Adapt the interaction to new contextual
  controls; retain width/visibility/order persistence and focus assertions.
- [Renderer app](../../../tests/renderer-app.test.tsx) covers shared UI/service
  scenarios. Migrate affected routes and fixtures rather than keeping obsolete
  forms mounted just to satisfy tests.
- [Suite inventory](../../../scripts/test-suites.mjs) and
  [CI policy](../../ci.md#ci-test-scheduling) own common/platform coverage and
  actual native/packaged checks. Historical manual diagnostics are conditional.

## Mapping to the approved slices

| Slice | Existing issue acceptance | Preserve or adapt |
| --- | --- | --- |
| U01 | #8, #9, #10 | settings/language persistence, backend failure, workspace selection and packaged launch/reopen |
| U02 | #9, #10, #11, #13 | workspace creation/removal, configured-source reuse, discovery preview and source/workspace ownership |
| U03 | #11, #13, #14, #15, #16, #22 | discovery modes/exclusions, stale review, external reconciliation, unavailable roots and archive designation |
| U04 | #27, #28 | view lifecycle/duplication/final-view protection, saved search and typed/empty filters |
| U05 | #29, #30, #31 | exact grouping, MultiSelect membership, Table row/column order, widths and view isolation |
| U06 | #29, #30, #32 | exact grouping, Board membership/order/visibility/widths/wrapping and view isolation |
| U07 | #27, #28, #31, #32 | view selection, filters/layout, focus, asynchronous selection and main-derived project-tab scenarios reconciled with the accepted no-split/unique-tab rules |
| U08 | #10, #27, #37, #38 | workspace/view persistence, real database upgrades, backup/export/restore and invalid/interrupted recovery |
| U09 | #12, #23, #24, #31, #32 | Text empty/absent values, Number expression results, Date validation/timezones, draft focus/lifetimes and real editor smoke routes |
| U10 | #25, #26 | Single Select/MultiSelect set semantics, hidden chosen options, option scope, delayed responses and keyboard/persistence |
| U11 | #12, #23, #24, #25, #26, #36 | property definitions, immutable types, ordinary option operations and reviewed metadata removal with view-reference cleanup |
| U12 | #33, #34 | scalar/Single Select/MultiSelect group assignment, empty transitions, filtered projections and failed-command feedback |
| U13 | #17, #18 | recoverable creation, no-replace rename, journal/crash/status/recovery, native Reveal and selected-target evidence |
| U14 | #19, #20, #21 | physical category moves, category option creation/rename/removal, collision/containment and interrupted-operation recovery |
| U15 | #22 | relative archive placement, explicit restore decisions, retained identity/values and archived-category restrictions |
| U16 | #33, #34, #35 | complete group-assignment matrix, Name collisions, folder-backed moves and equivalent accessible commands |
| U17 | #14, #15, #17, #18, #19 | availability/identity reconciliation, native authorization, containment, IPC isolation and Open/Reveal separation; add tree/Open scenarios where no prior command exists |
| U18 | #14, #15, #16, #19, #22 | reassociation, external moves/replacements, unavailable-source behavior, mode inactivity, archive states and preserved identity |
| U19 | #8, #37, #38, #39, #40 | language/settings, real app-data recovery/backups, package version/notices, installer/reopen and failed restore protection |
| U20 | #8–#40, #41 and #42 | complete current regression inventory, integrated runtime/native/install routes and accepted representative-scale measurement harness |

## Per-slice evidence

Record the old scenario/test, disposition (retain/adapt/replace/retire), rationale,
replacement check where behavior remains required, and actual verification result
in the issue checkpoint or bounded execution plan. Explicit contract changes such
as Text Escape cancellation or automatic workspace naming require new expectations;
old implementation structure is not a requirement.

New session and file-tree/Open commands need new public-boundary coverage, plus
renderer/native scenarios. Add meaningful tests for new behavior without copying
all tests from an earlier issue. Dead diagnostic scaffolding or duplicate tests
may be removed only through a scoped reviewed change that preserves still-required
coverage. Do not silently drop tests from common/platform discovery.

Run focused relevant checks during development; use the required full suite once
on the completed reviewed candidate, renewing affected checks after further
changes. UI/native evidence and supported-platform limits remain separate from
service-only success. Documentation preparation does not claim these tests pass.
