# Issue 52: grouped Table and contextual columns

Issue: [#52](https://github.com/kornouhovas/workspace/issues/52), parent #47.
Baseline: verified `d931bf32`; branch `codex/issue-52-grouped-table`.
Blocker #51 is closed and delivered at the baseline. No existing #52 owner/checkpoint.

## Scope and agreed seams

Retain public typed Workspace service, temporary real SQLite/filesystem fixtures,
renderer interactions and Electron journeys. No storage/service rewrite or migration.

- Contextual Table grouping: supported exact scalar, category/Select and MultiSelect
  membership; none; default/ascending/descending/manual, hide/collapse/hide-empty.
- Contextual whole-Table and individual-column presentation: visible order, hide/show,
  width 120–800, Text wrapping; Name remains visible. Preserve dormant settings.
- Existing typed values/editors, loading/empty/errors/retry and pending feedback.
- Dedicated manual row controls/payload versus group-value assignment; preserve
  filters, membership, independent view/workspace settings and reopen persistence.
- Keyboard controls, Escape/focus return, outside click, long authored content,
  independent scrolling, EN/RU light/dark at 1024x720 and 1440x960.

## Inherited coverage

Retain grouping/layout/service/IPC, ownership/reopen and all assignment scenarios.
Adapt Table grouping and layout renderer/native drivers to contextual entry points;
retain Board behavior, exact groups/MultiSelect, value editing, errors, delayed
responses, width/focus, row/column order, wrapping and persistence assertions.
Retain strict #41 performance limits and readiness; adapt only Table panel entry.
Adapt renderer-app’s former one-button category-header assertion to require both
the preserved category rename and new contextual column entry; retain no-inline-editor,
exclusion and Text-draft assertions. No accepted requirement retired. Add contextual header keyboard/focus coverage.

## Verification and delivery

Focused red/green renderer checks and typecheck during slices; affected real-service
regressions, lint/docs, build and native Table/views/shell inspection. Independent
Standards/Spec reviews before final full suite. Required supported-host/package and
strict performance evidence remain gates until observed. Commit the verified local
candidate; publish/push only within the owner's corresponding authorization.

Observed local results and review: [verification report](../verification/issue-52-grouped-table.md).
Current SHA/run/attempt acceptance and next gates belong to the [GitHub checkpoint](https://github.com/kornouhovas/workspace/issues/52#issuecomment-6294773446).
