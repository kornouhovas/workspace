# Issue 34 verification

Scope: [issue #34](https://github.com/kornouhovas/workspace/issues/34), [contract/scenarios](../plans/issue-34-multiselect-drag.md), base `9905ba3f`.

## Local evidence

Matt Pocock TDD at the issue-selected service and layout seams: the service transition regression failed before MultiSelect assignment support; the corrected UI fixture fails with first-group source selection restored, and passes with occurrence-specific source keys. Disposable real SQLite/project directories cover replacement, deduplication, empty clearing/assignment, same-group no-op, stale/foreign/absent/hidden destinations, concurrent unrelated memberships, siblings, filters, persistence and transactional rollback. Deleted or otherwise absent option identities fail projection validation; option deletion itself is a separate capability.

Board/Table EN/RU interactions exercise native drag payloads, per-occurrence source identity, duplicate refresh, empty clearing of multiple memberships, accessible selector/Enter clear alternatives, failures and unknown transport replies without replay. IPC routes the same typed command. Existing Electron views acceptance inherits the added MultiSelect scenarios on all three CI platforms in development and packaged applications. Native checks include both layouts/languages, narrow/wide screenshots, native pointer source, selector merge, Enter clear, empty assignment, reload, unchanged folders and normal cleanup.

Independent Standards review found no code violations and requested documentation consistency updates. Spec review requested explicit multi-membership empty clearing through both layouts; the final candidate adds that interaction in DOM and native runtime scenarios. Final checks and CI/integration receipts are recorded in the GitHub checkpoint; unobserved platform results are not implied here. No schema, dependency, bb module or reduced existing acceptance assertion is introduced.


## Native fixture preparation

The first multi-membership empty-drop attempt used the distant A row in Table and timed out with A+C still saved. At wide width A and the empty heading were separated by more than a viewport, consistent with gesture cancellation during automatic scrolling. The failed run has no dragstart timeline, so its unique historical cause is not established. Keeping the same multi-clear assertion and selecting adjacent C instead passed the original EN/RU Table/Board route. This narrows gesture preparation; it does not relax assignment or cleanup assertions. Screenshots scroll the destination selector into view to retain useful narrow Board evidence rather than capturing a horizontally clipped group container.


## Final candidate checks

Focused assignment service/IPC/UI: **36/36 passed**. Broader assignment/grouping/Table/Board regression selection: **57/57 passed** before the final IPC and multi-clear test additions. Typecheck, lint, local documentation links and diff validation pass. The final real-Electron development views route passes EN/RU, including ten assignment scenarios per language (eight inherited scalar/Single Select and two new MultiSelect layout cases), normal shutdown and fixture cleanup. Narrow EN Board and wide RU Table evidence was visually inspected.

The first full inventory passed **2988**, failed **1**, and conditionally skipped **26**. Its sole failure was Ladle's Vite 403 for a node_modules symlink into a sibling checkout. Replacing that setup shortcut with a checkout-local dependency copy made the unchanged original Ladle test pass (**1/1**); no source or Vite policy was changed. Renewed full inventory and exact-SHA platform/integration evidence follow in the GitHub checkpoint.


The renewed full inventory passed **2987**, failed **2**, and conditionally skipped **26**. Both failures were the unchanged native `property-editor-driver.test.mjs` ten-second normal-close boundary (MultiSelect and Number creator controls), after successful editor assertions and application quit events. The original candidate file passed **5/5** in isolation. The fixture, driver and lifecycle helper match base `9905ba3f` byte-for-byte and do not load task UI/service changes. This does not establish the native shutdown cause or waive the full-platform acceptance gate. No deadline, shutdown or cleanup assertion was relaxed. Exact-SHA CI must establish its actual results before integration.


An isolated pristine-base `9905ba3f` control reproduced the same normal-close timeout after successful authoring and quit events. This establishes that the failure pattern exists without #34, while its underlying native shutdown cause remains unresolved. Candidate-specific behavior is supported by focused/native assignment evidence; CI acceptance remains a separate gate.
