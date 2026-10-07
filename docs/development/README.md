# Документы разработки

Начните с [AGENTS.md](../../AGENTS.md): это обязательная точка входа в правила работы. Правила этой папки обязательны при разработке. [rules.md](rules.md) задаёт рабочую политику; guides уточняют её применение. Специализированные спецификации, контракты и принятые ADR сохраняют авторитет в своих областях.

## Порядок чтения

1. [Обязательные правила](rules.md), [работа над задачей](workflow.md) и [проверки](quality.md) — прочитать для каждой задачи.
2. [Продукт](product.md) — что делает Workspace и где проходят границы MVP.
3. [Архитектура](architecture.md) — действующий runtime, слои и целевое хранение.
4. [Дизайн](design/README.md) и [политика адаптации](design/bb-workspace-policy.md) — обязательно для UI; [полный исходник bb](DESIGN_RULES.md) — справочник.

## Источник по вопросу

| Вопрос | Обязательный источник |
| --- | --- |
| Правила работы, разрешения, ветки и коммиты | [rules.md](rules.md), точка входа [AGENTS.md](../../AGENTS.md) |
| Продукт и границы | [PRD](../prd.md), [Vision](../vision.md), актуальные [сценарии](../flows/) |
| Слои и решения | [Архитектура](../architecture.md), [ADR](../adr/), особенно [ADR-006](../adr/006-workspace-source-bindings.md) |
| Данные и сервисные методы | [Модель данных](../data-model.md), [API-контракты](../api/) |
| Экраны и визуальные правила | [Interface](../interface.md), [UI guidelines](../ui-guidelines.md), [дизайн](design/README.md) |
| Проверки | [quality.md](quality.md), команды [package.json](../../package.json) |

Для UI-задачи прочитайте Interface, UI guidelines и соответствующий flow; при вызовах сервиса — его API-контракт. Для backend/storage — архитектуру, модель данных, применимые принятые ADR и API. Для документации — затронутые источники и правила проверок документации.

Старые планы и отчёты дают контекст конкретной работы. Их исторические процессные требования заменены rules.md; они не расширяют полномочия. Статус ADR проверяйте в самом документе: предложенное решение не считается принятым.

For Matt skills, read the [tracker configuration](../agents/issue-tracker.md) and [domain docs](../agents/domain.md). The first bb architecture stage is defined in the [session specification](../specs/bb-architecture.md); the [approved issue breakdown and cleanup proposal](../specs/bb-architecture-tickets.md) links to the GitHub tracker.

Documentation reconciliation is tracked in [Issue #4](https://github.com/kornouhovas/workspace/issues/4). The [full semantic audit](../specs/documentation-audit.md) records per-file assessments, current-runtime contradictions and recommended order; the [earlier cleanup inventory](../specs/documentation-cleanup.md) preserves proposed reductions and protected history. The audit is analysis, not a new mandatory implementation checklist.
