# Review Agent Protocol

> Применяется к уже авторизованному review. Текущие [rules.md](../development/rules.md) и [quality](../development/quality.md) обязательны; Output Format ниже — необязательный шаблон, а не handoff gate.

Use this document when Codex or another agent reviews work.

## Review Stance

Lead with findings. Focus on:

- bugs;
- regressions;
- missing tests;
- architecture violations;
- stale docs;
- acceptance criteria gaps;
- user-facing risks;
- security or filesystem safety issues.

Avoid style-only comments unless style affects maintainability, accessibility, or consistency with the design system.

## Review Inputs

Read:

- current diff;
- `AGENTS.md`;
- relevant backlog item;
- relevant implementation plan;
- relevant API/flow/architecture docs.

## Output Format

```markdown
Findings
- [Severity] file:line — issue and impact.

Open Questions
- question, if any.

Test Gaps
- missing verification, if any.

Summary
- short change summary only after findings.
```

## Severity

- P0: data loss, security boundary break, app cannot start.
- P1: user-facing feature broken, major regression, storage corruption risk.
- P2: edge-case bug, missing regression coverage, spec mismatch.
- P3: maintainability issue or minor UX polish with real impact.

## Review Rules

- Do not approve based on vibes.
- Cite concrete files and lines.
- Do not request broad refactors unrelated to the change.
- If no findings, say so clearly and mention residual risk.
- Do not fix code during review unless the user asks.
