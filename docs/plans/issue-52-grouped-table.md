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

## Performance follow-up

Hosted profiles reproduced two complete property snapshot reads per assignment.
At the existing renderer + real-service seam, delay property reads after a successful
mutation: its complete accepted snapshot must allow actual projected values and
keyboard focus without waiting for redundant reads. Retain lost/rejected replies,
newer-revision guards, cross-owner isolation and actual grouped projection refresh.
Adapt the old delayed-read busy assertion to this fresh-response guarantee; no
failure/recovery coverage is retired. If application code changes, renew full
acceptance; earlier unchanged-input receipts no longer establish the new candidate.

Adapt the inherited Windows continuation literal-matrix assertion to evaluate its
unchanged both-host default after the explicit host selector was added. Retain
the full original layout/runtime/package command parity assertions and the
selector contract checks. The full-suite failure and focused renewal are retained.

The Windows backend profile then retained a slow assignment with 143 ms before
backend execution and 42 ms within it; its preceding unmeasured correctness query
walked the filesystem for 1.8 seconds. Adapt those metadata-only correctness reads
to the existing complete/revision-validated displayed-source projection. Initial
source verification and all explicit filesystem-change/Refresh/identity checks
retain ordinary fresh reads. Preserve every expected-ID, group, current-value and
ordering assertion; stale/foreign/incomplete projections still fail. Validate
Table/Board parity, MultiSelect overlap/manual order and the explicit transition
back to filesystem observation. This changes preparation on both hosts, so renew
both original strict performance consumers rather than infer a pass from profiles.

Adapt serial measured-endpoint locator preparation to observe the same exact
result DOM within renderer readiness first. Retain all original locators after
the captured paint, complete projection/visible fields/busy guards and frame pairs;
no action, target or start clock changes. Add a native delayed-result/late-driver
regression. This is shared measurement preparation, so renew both strict hosts.

Evaluate deferring compact column-trigger Radix trees until first activation,
then retaining their existing lifecycle. Preserve labels, first pointer/Enter/Space
activation, repeated opening, Escape/outside focus and removed-header fallback.
Use hosted first-grouping profiles to test the proposed performance effect; an
isolated mount-cost reduction alone does not establish the remaining latency cause.

The compact-root experiment did not resolve hosted first grouping (709 ms), so
restore the original popover implementation and retain its expanded keyboard
coverage. Altered-scheduling diagnostics still missed the interaction target
(421 ms), so do not introduce a production scheduling change from that result.

The retained backend repair indexes interpretation paths and native alias
candidate buckets, preserving original order, every alias, mutable retained-state
checks, continuously matching historical exceptions and reservations. Scanner,
identity authority, reconciliation writes and transactional verification stay
unchanged. Retain inherited discovery/recovery/mode/reconciliation/native tests;
add thousand-record ordering/input preservation, replaced history, alias birth
evidence, missing-path and reservation cases. Compare seeded mixed histories
against the original algorithm. Hosted strict acceptance remains required.

Apply the same complete-response observation guarantee to ordinary typed value
edits after hosted profiles showed an additional property read. Count overlapping
value saves, retain every event's minimum revision, and fall back to observation
after stale/rejected/lost replies without mutation replay. Exercise accepted,
superseded and lost-after-commit replies at the existing renderer/real-service seam;
renew typed editor, assignment, full-suite and hosted acceptance evidence.

Adapt renderer-app's own-event list resolver to deferred observation. Retain the
separate out-of-order list guarantee by issuing a later external event while the
stale mutation's fallback read is pending, then resolve the newest read first.
No guarantee is retired; renew the complete renderer-app consumer.
