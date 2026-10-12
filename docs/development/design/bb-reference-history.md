# bb reference provenance and historical acceptance

Read when comparing pinned bb revisions, auditing the import, or continuing workspace-6fh/workspace-jqv acceptance. Current applicability is owned by the [bb adaptation policy](bb-workspace-policy.md); historical reports do not establish acceptance of the current checkout.

## Import provenance

- Источник: чат Codex «Разобрать архитектуру проекта BB», thread `01a0e90b-43d2-72a0-a5f4-f5e4b2ebf6eb`, завершённый turn `01a0f39c-1afa-7043-86a2-8511a02445a2`.
- Локальный оригинал: `/Users/aleksandersk/Documents/Codex/2026-09-28/https-github-com-get-bb-bb/outputs/bb-design-system/DESIGN_RULES.md`.
- Импорт: 30 сентября 2026, 1547 строк, SHA256 `3b52eb4451902dc7e4363dd42dead1b8cf9b9f60e165e181efd415f79a797b2c`.
- Эталон: get-bb/bb commit `af72bb8167da292198bfa73b1c35ae3ac080bfca`, сохранённый снимок исходников. Во время этого исторического импорта живое bb не запускалось; совпадение скриншотов и полная доступность тогда не подтверждались. Живое сравнение следующей итерации описано в checkpoint workspace-jqv ниже.
- Статус: полный импорт источника и локальная политика применения. Матрица исходника не является выполненной приёмкой Workspace. Упомянутый в исходнике отдельный `bb-design-tokens.css` не импортирован; CSS-приложение внутри документа сохранено целиком.

## Historical implementation evidence

Применение источника af72bb81 выполнено в workspace-6fh: [матрица всех разделов](../../../work/workspace-6fh/applicability.md), [native before](../../../work/workspace-6fh/before/report.json), [native after](../../../work/workspace-6fh/after/report.json) и [дополнительные состояния](../../../work/workspace-6fh/stress/report.json). Эта историческая итерация сохраняла full-width Settings. В workspace-jqv пользователь разрешил дальнейшую визуальную переработку по живому bb: центрированная колонка Settings до 768px, 16px внутренние отступы, меню действий от 176px и toggle рядом с native controls. Текущий статус и незавершённая native приёмка описаны в [checkpoint workspace-jqv](../../../work/workspace-jqv/executor/visual-checkpoint.md). Матрица исходника не заменяет отчёт о проверке конкретной версии Workspace.

The stack adaptation's `061685c4…` / bb 0.44.0 implementation reference differs from the `af72bb81…` imported document. See [bb stack adaptation](../../design/bb-stack-design.md) when the comparison depends on that distinction.
