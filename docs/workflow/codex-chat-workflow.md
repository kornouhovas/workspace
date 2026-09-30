# Codex Chat Workflow

> Исторический процессный документ. Текущие обязательные правила: [rules.md](../development/rules.md), [workflow](../development/workflow.md), [quality](../development/quality.md). Шаблоны, обязательное разбиение на slices и повторные approvals ниже не являются текущими требованиями; статусы применяются для учёта tracked work. Исторический текст сохранён для контекста.

This document describes how the human should work with Codex in chat.

The human can write short requests. Codex expands them into the right workflow.

## Core Pattern

```text
Human intent
  -> Codex chooses mode
  -> Codex asks only necessary questions
  -> Codex prepares missing docs/task/plan
  -> Codex implements one approved slice
  -> Codex verifies
  -> Codex hands off for review
```

## You Can Write Short Requests

New feature:

```text
Хочу фичу: экспорт активного Table view в CSV.
```

Bug:

```text
Баг: Settings не открывается по клику в sidebar.
```

Review:

```text
Проверь текущий diff как code review.
```

Implementation slice:

```text
Реализуй только Task 4 из docs/superpowers/plans/2026-05-15-workspace-custom-properties.md.
```

## What Codex Should Do With Feature Requests

If context is enough, Codex should proceed to feature preparation.

If context is missing, Codex should ask concrete questions, such as:

- should this be user-facing in MVP?
- which screen owns the action?
- does this cross Electron IPC, backend, sidecar, or storage?
- does the feature need new persistence?
- should it affect current filters/search/view settings?

Codex should not ask broad generic questions when the docs already answer them.

## What Codex Should Do With Bug Reports

Codex should not jump straight to a guessed fix.

Expected sequence:

1. Confirm expected behavior from docs or ask the user.
2. Reproduce or localize.
3. Identify root cause.
4. Add a regression test.
5. Fix.
6. Verify.

## Useful Human Constraints

Add these when relevant:

```text
Код пока не меняй.
```

```text
Сделай сразу, если контекста хватает.
```

```text
Только маленький slice, без следующего шага.
```

```text
Без новых зависимостей.
```

```text
Сначала покажи план.
```

```text
Не коммить пока.
```

## When Codex Should Stop And Ask

Codex should stop when:

- there are multiple reasonable product behaviors;
- architecture would change;
- a new dependency seems needed;
- a public service contract would change;
- storage schema would change;
- Electron security or IPC boundaries would change;
- tests show unrelated failures that block confidence;
- active user/agent edits conflict with the task.

## Good Chat Examples

### Feature Prep

```text
Хочу фичу: экспорт активного Table view в CSV.
Сначала подготовь feature intake и скажи, какие docs/API/ADR нужны. Код пока не меняй.
```

### Feature Implementation

```text
Реализуй первый slice для CSV export: service contract and tests only.
Не добавляй UI и не переходи к Electron IPC.
```

### Bug

```text
Баг: после изменения folder role Board не обновляется до перезапуска.
Сначала диагностика и root cause, затем regression test и минимальный fix.
```

### Review

```text
Проверь текущий diff на соответствие docs/api/workspace-properties.md и docs/architecture.md.
Не исправляй, только findings.
```
