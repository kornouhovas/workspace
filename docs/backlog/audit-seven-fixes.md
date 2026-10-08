# Исправление семи ошибок аудита приложения

> Historical requirements snapshot. Current scope/status belongs to GitHub Issues; current behavior follows accepted contracts/ADRs. Old Current State, execution gates and checkboxes below are historical, not evidence of present completion. Preserve unmet criteria using the [carry-forward map](../specs/documentation-cleanup.md#legacy-acceptance-carry-forward).

Status: Backlog

## Goal

Устранить семь подтверждённых ошибок аудита от 2026-09-18, сохранив существующие метаданные и границы Electron / WorkspaceServiceClient / backend.

Это подготовка исправлений, а не разрешение начать реализацию. План находится на Human Review. Изменение стратегии идентичности проектов требует отдельного принятия [ADR-004](../adr/004-project-identity-and-audit-migrations.md).

## Context And Bug Impact

Проверенная база: `cd0e814e2728c092395edcac5567f1e4063c774b`, ветка `codex/feature-russian-localization`. Перед исполнением сравнить её с текущим HEAD.

| ID | Приоритет | Ошибка | Причина | Ожидаемый результат |
| --- | --- | --- | --- | --- |
| A1 | P1 | Переименование папки отцепляет свойства | `createFolderObjectId` вычисляется заново из пути | Зарегистрированный проект сохраняет ID, значения и историю после подтверждённого rename/move внутри того же источника и тома |
| A2 | P1 | A → B → A сбрасывает стандартные views | Глобальные `view:default-board` / `view:default-table` | Представления разных источников не перезаписывают друг друга |
| A3 | P1 | Повторный выбор источника сбрасывает роли | `setRoot` пишет `folderRules: {}` | Повторный выбор и возврат к источнику сохраняют его роли |
| A4 | P2 | Разные статусы смешивают проекты | ID статуса основан на неуникальном slug имени | Разные папки статусов различимы независимо от имени |
| A5 | P2 | Удалённое значение остаётся в фильтре | Delete Select не обновляет views в Electron | Удаление очищает ссылки во всех затронутых views |
| A6 | P2 | Ошибка загрузки показывает демопроекты | Production fallback использует mock projection | Ошибка/пустое состояние показывают только реальные данные и действия восстановления |
| A7 | P2 | Метки Name/Status теряются между источниками | Property store индексируется только по `property.id` | Системные ID неизменны, хранилище разделяет определения по области данных |

## Scope

- Исправления действующего Electron runtime и его файловых transitional stores.
- Регрессионные тесты через настоящий IPC handler с изолированными временными папками.
- Версионированные, повторяемые миграции сохранившихся метаданных.
- Реестр идентичности проектов по предложению ADR-004, после явного согласования.
- Проверка соответствия поведения существующим Go-sidecar контрактам без переключения runtime на sidecar в этой задаче.
- Обновление затронутых contracts/data model/flows в том же implementation slice.

## Out Of Scope

- Новые npm/Go зависимости, смена storage technology, запуск packaged sidecar, sync, auth.
- Переименование, перемещение или удаление настоящих пользовательских файлов приложением.
- Автоматическое восстановление записей, уже перезаписанных старым кодом и отсутствующих в backup.
- Автоматическое узнавание проекта после копирования на другой том, неподтверждённого сетевого file ID или rename до первого сбора filesystem identity.
- Изменение области совместного использования custom properties между Workspaces одного источника.
- Отдельное устранение существующего расхождения глобальных folderRules с целевой Workspace-scoped моделью. A3 предотвращает сброс и разделяет сохранение по источникам; смысл ролей и их текущая область применения между Workspaces не меняются.
- Общая переработка App.tsx, Electron dispatcher или визуального дизайна.

## Acceptance Criteria

- A1: существующий ID при миграции сохраняется как непрозрачный ключ; новый проект получает UUID. После rename/move зарегистрированной папки на поддерживаемой ФС ID, все значения и история сохраняются также после рестарта. Неоднозначное совпадение не присваивает чужие значения.
- A2: A → B → A и повторный запуск сохраняют name, filters, visiblePropertyIds, order, boardLayout и activeViewId. Новые default IDs уникальны по Workspace. Сохранившиеся legacy views не пересоздаются.
- A3: same-root reselection — без сброса ролей и active Workspace; A → B → A восстанавливает разные наборы ролей. Cancel, invalid path и ошибка записи не очищают настройки.
- A4: `In progress`, `In-progress`, одноимённые статусы под разными group и реальная папка `No status` различаются. Каждый проект присутствует в Board ровно один раз; фильтр и цвет затрагивают только целевую папку.
- A5: удалённого selectValueId нет в current values или valueVisibility всех живых Workspaces этого источника. Оставшиеся значения фильтра и includeEmpty сохраняются. Если фильтр становится пустым и includeEmpty=false, ключ фильтра удаляется. История сохраняется; повтор после сбоя безопасен.
- A6: initial error, missing source, corrupt storage, failed workspace switch и reload failure не показывают mock-проекты, mock-папку, Operations или фиктивные views. Retry и Settings работают, RU/EN текст локализован.
- A7: Name/Status в A и B независимо сохраняют метки после A → B → A и рестарта; `property:name` / `property:status` в публичных контрактах не меняются.
- Миграции проходят дважды без новых изменений, не изменяют corrupt JSON и не удаляют историю. Сбой записи не публикуется как успешное сохранение.
- Все quality gates проходят; UI A6 проверен в Electron при 1440×960 и 1024×720 в RU/EN либо handoff явно остаётся с незакрытой визуальной проверкой.

## Relevant Docs

- [Implementation plan](../superpowers/plans/2026-09-18-audit-seven-fixes.md)
- [Proposed ADR-004](../adr/004-project-identity-and-audit-migrations.md)
- `AGENTS.md`, `docs/architecture.md`, `docs/prd.md`, `docs/data-model.md`
- `docs/api/workspace-properties.md`, `docs/api/workspace-views.md`
- `docs/ui-guidelines.md`, `docs/interface.md`, `docs/flows/board-table-views.md`
- `docs/flows/settings-source-folder-and-roles.md`, `docs/flows/language-selection.md`
- ADR-001, ADR-002, ADR-003; существующие планы backend/storage, custom properties, frontend и локализации.

## Test Plan And Quality Gates

Каждый slice: сначала воспроизводящий тест и ожидаемое падение, затем исправление, PASS, документация, review и отдельный commit. Фикстуры всегда задают configPath, viewStorePath и propertyStorePath; значения по умолчанию могут указывать на настоящую `.workspace`.

Полный финальный набор:

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
git --no-pager diff --check
```

## Risks And Release Conditions

- Некоторые уже потерянные названия и настройки восстановимы только из резервной копии. Не выдавать defaults за восстановленные пользовательские данные.
- Node filesystem evidence — признак для сопоставления, не primary ID и не гарантия на всех ФС. Границы поддержки заданы ADR-004.
- Обновление двух JSON stores не является единой транзакцией: A5 требует воспроизводимого recovery до обслуживания затронутых запросов.
- Старый бинарник может неверно интерпретировать новую схему. Rollback — остановка приложения и восстановление согласованной backup metadata, а не только git checkout.
- Нельзя объявлять устранёнными A1/A4, проверив только имена: проверять устойчивые ID, фактическую принадлежность проектов, значения, фильтры и историю.

## Workflow Evidence

- Mode: Bug Diagnosis — подготовка плана по результатам Review.
- Docs read: документы из Relevant Docs и реализация затронутых функций.
- Branch: codex/feature-russian-localization.
- Acceptance criteria: A1–A7 выше.
- Quality gates: документация и ссылки проверяются в задаче планирования; runtime gates выполняются при реализации.
- Handoff state: Human Review; implementation status остаётся Backlog до разрешения на исполнение.
