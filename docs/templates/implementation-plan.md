# Optional implementation plan form

Use for a multi-step authorized change. Checkpoints apply when the user requests them. Select tests by risk and affected boundary; this form does not require a new test or full build for every prose edit.

- Originating GitHub issue and accepted scope:
- Baseline / dedicated branch / unrelated changes to preserve:
- Contracts and decisions that constrain the change:
- Ordered slices, ownership and dependencies:
- Completion criterion for each slice:
- Behavior/regression checks and any needed fixtures:
- Integration/visual/native checks where affected:
- Recovery or migration strategy where relevant:
- Verified commit and remaining work:

[Rules](../development/rules.md) owns authorization/commits, [quality](../development/quality.md) owns verification, and the [tracker](../agents/issue-tracker.md) owns task state. Use relevant fields; the form adds no approval gate or mandatory report.
