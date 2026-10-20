# Issue 51: contextual saved views

Source: [GitHub #51](https://github.com/kornouhovas/workspace/issues/51), parent #47.
Baseline: `53a87519`. Branch: `codex/issue-51-contextual-views`.

## Scope and seams

Use existing typed view/filter commands, real SQLite service fixtures, renderer
user interactions and native Electron journeys, as specified by the issue.
Do not change persistence, source ownership or Table/Board presentation contracts.

- Saved tabs: pointer/keyboard activation, create, edit, reorder, duplicate,
  delete and final-view protection; confirmed service state only.
- Contextual filter editor: project-name search, existing typed/empty operators,
  explicit Apply/Clear, persisted per-view scope, authored draft on rejection.
- Preserve mounted workspace context through settings entry/return.
- EN/RU, light/dark, 1024x720 and 1440x960; keyboard dismissal and focus return.
- Restart/workspace switching, independent duplicate settings and live source edits.

## Inherited scenario reconciliation

Retain `views-service`, `view-filters-service`, grouping/layout/service/IPC and
source-ownership scenarios without changing their contracts. Adapt `views-ui`,
`smoke-views`, `smoke-desktop-shell` and performance navigation from the replaced
select to saved tabs; retain their persistence, archive, source-sharing, layout
and performance assertions. Adapt filter renderer/runtime interactions to open
contextual controls; retain all operators, clear, stale reads, rejected saves,
metadata cleanup and live refresh assertions. Adapt `test-suites` expectations to the existing #50 source diagnostic selectors;
retain the ordinary commands and three-platform matrix. No applicable requirement retired.

## Verification and remaining gates

Run focused renderer/service tests and typechecking during slices; inspect and
review the completed diff before the final full suite. Native development and
packaged journeys and required platform CI remain acceptance gates until observed.
The owner explicitly authorized publication for #51 to the currently public
repository after reviewing local candidate `23c7fb4`. Current run/repair/integration
state is recorded in the [GitHub checkpoint](https://github.com/kornouhovas/workspace/issues/51#issuecomment-6289753833).

Local implementation and review evidence: [verification report](../verification/issue-51-contextual-views.md).

Implementation and both source-review axes are complete. Full desktop acceptance
passes on macOS latest, Windows latest and Windows 2022 at `23c7fb4`, as do macOS
14/Windows installer routes. Strict packaged performance passes on macOS 14 at
`b77d3885` and Windows latest at `45064815`; each has six native controls, all 32
measurements, four normal quits/backend exits and cleanup. The verification report
records actual SHA/run/attempt/artifacts, renewed consumers and unchanged-input
justification. Historical failures remain recorded; diagnostic traces do not prove
the cause of earlier timing misses. No required scoped gate remains unresolved.
Owner-authorized integration follows this documentation/review checkpoint. No next
issue is selected and no release is authorized.
