# Optional review protocol

Use for an already authorized review. [Rules](../development/rules.md) and [quality](../development/quality.md) govern scope and evidence. Read the diff, originating GitHub issue/current specification, and affected API/product/UI/ADR contracts; read a legacy plan only when it is relevant to the reviewed change.

Lead with concrete findings ordered by impact: bugs, regressions, data/filesystem/security violations, missing acceptance/regression evidence, architecture boundary violations or stale contracts. Cite file/line and explain the consequence. Style observations earn a finding only when they affect behavior, accessibility or maintenance.

| Priority | Meaning |
| --- | --- |
| P0 | Data loss/security boundary break or application cannot start |
| P1 | Broken user-facing function, major regression or storage corruption risk |
| P2 | Edge case, missing meaningful regression coverage or contract mismatch |
| P3 | Maintainability/minor UX issue with a concrete consequence |

Optionally report findings, unresolved questions, verification gaps and a short summary. If no findings, state that and the limits of the review; passing compilation or a commit is not native acceptance. Keep changes outside review scope intact and implement fixes only when authorized. This protocol does not itself authorize delegation, agent creation, merge or release.
