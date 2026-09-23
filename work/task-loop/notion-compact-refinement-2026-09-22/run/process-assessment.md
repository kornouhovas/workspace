# Process assessment at intake

The shared `workspace-project-board` journal contains no accepted process-improvement proposal. It does contain two linked Compact runs and repeated incidents around browser evidence substituting for native evidence, stale structure assertions, transition screenshots and incomplete visual criteria. The immediately preceding correction passed an independent native audit for the older visual target. This run is a new exposure because the user has expanded and reprioritized the target: a more compact Notion-like shell plus twelve explicit behavioral/layout requirements.

The current process risk is criteria drift hidden by reusing a formerly successful screenshot. The new run therefore defines its twelve falsifiers before touching product code, preserves the new reference files, captures an actual pre-change native baseline and requires settled full-window pairs at both requested sizes. DOM/CDP evidence may support accessibility, scroll and persistence findings but cannot substitute for native composition.

No process effect is claimed at intake. The existing `native-visual-acceptance` scenario remains applicable; the first observation for this new exposure will be the preserved pre-change native baseline. A new incident records that the prior supported outcome is insufficient for the expanded scope, without relabeling the previous audit as false.

## Implementation checkpoint assessment

The predeclared row 7 falsifier exposed an additional product mismatch before freeze: search and value filters dropped zero-result status columns, making a compact empty column and a visible zero count impossible. The first focused behavior tests failed as expected, and the stored Electron probe showed only the matching column. Incident `compact-board-empty-columns-filtered-out` records the raw RED output. The corrected projection retains all existing status columns, does not reorder or invent statuses, and now records 1/0/0 visible counts with 124/90/90 px content-driven surfaces.

This supports the value of defining concrete falsifying observations before implementation. It does not justify a global task-loop process change from one task, so no improvement proposal is created. The repeated native-evidence dependency remains a known environment constraint: CDP supplies behavior diagnostics, while a root-thread UI action is still required to raise the Stage Manager window before CoreGraphics capture.
