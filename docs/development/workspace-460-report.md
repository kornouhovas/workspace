# workspace-460: консолидация правил разработки

Дата: 30 сентября 2026. Реализация документации готова к независимой проверке; критерий 7 принимает отдельный reviewer в интегрированном checkout. Этот отчёт не объявляет его приёмку выполненной заранее.

Checkout: `/Users/aleksandersk/Documents/programming/Projects/project_folder`. Ветка: `codex/workspace-460-development-rules`, база `b4c3b64` (`codex/development-docs-lts`). Локальный scoped commit сообщается в handoff после проверок; push/merge/release не выполняются.

## Инвентаризация и решения

| Документ / группа | Решение | Причина |
| --- | --- | --- |
| [AGENTS.md](../../AGENTS.md) | Обновить и сократить | Обнаруживаемая обязательная точка входа; полная policy перенесена без потери обязанностей в rules.md |
| [rules.md](rules.md) | Создать из прежнего AGENTS | Один источник рабочей policy: авторизация, чтение, безопасность, проверки, branches/commits, handoff; общий процесс не распределён по старым шаблонам |
| [README проекта](../../README.md) | Обновить | Явная обязательность development, импорт дизайна, npm ci и реальный Electron/HMR запуск |
| [development index](README.md) | Обновить | Обязательная папка вместо только навигатора, ясный порядок чтения и авторитет специализированных контрактов |
| [product](product.md), [architecture](architecture.md) | Оставить | Уже описывают ADR-006, source bindings и current JSON versus target sidecar; сверены с кодом подключения |
| [workflow](workflow.md), [quality](quality.md) | Обновить | Один источник policy и профильный documentation.test; исторические slices/approvals не являются обязательными gates |
| [design index](design/README.md) | Обновить | Удалить устаревшее утверждение «документ ещё не предоставлен», связать источник с policy |
| [DESIGN_RULES.md](DESIGN_RULES.md) | Импортировать целиком | 1547 строк и точный hash оригинала; императивы внешнего источника не становятся полномочиями |
| [bb-workspace-policy](design/bb-workspace-policy.md) | Создать | Происхождение/версия/ограничения, применимость, конфликт с геометрией и продуктом, границы данных/стека/security |
| [design-qa.md](../../design-qa.md) | Архивировать по статусу на существующем пути | Уникальное evidence compact-итерации сохранено целиком, old geometry и pending native QA отделены от текущих правил; ссылки не требуют переноса |
| [quality-gates](../workflow/quality-gates.md) | Обновить до указателя | Устранить дублированный набор gates; старый путь остаётся рабочим |
| [chat workflow](../workflow/codex-chat-workflow.md), [task lifecycle](../workflow/task-lifecycle.md) | Архивировать по статусу на существующих путях | Сохранить историю схем и состояний; прежние требования templates/slices/approvals явно заменены текущей policy |
| [review protocol](../workflow/review-agent-protocol.md) | Обновить статус применения | Полезные severity/review guidance сохранены, формат необязателен; не разрешает делегирование сам по себе |
| [symphony readiness](../workflow/symphony-readiness.md) | Обновить статус применения | Future design и историческая manual схема сохранены; не дают разрешения создавать задачи/оркестрацию |
| [session handoff template](../templates/session-handoff.md) | Обновить статус применения | Поля для продолжения сохранены как необязательный шаблон |
| [backlog index](../backlog/README.md), [plans index](../superpowers/plans/README.md), [specs index](../superpowers/specs/README.md) | Обновить статус применения | Убрать трактовку всех запросов как обязательного отдельного template/spec и повторного approval |
| [PRD](../prd.md), [Vision](../vision.md), [architecture contract](../architecture.md), [data model](../data-model.md), [API](../api/), [flows](../flows/) | Оставить | Специализированные контракты сохраняют авторитет; цель sidecar/ранний shared source читаются с ADR-006 и текущей runtime картой |
| [Interface](../interface.md), [UI guidelines](../ui-guidelines.md) | Оставить | Текущие принятые геометрия/действия не меняются импортом bb; old gaps не объявлены выполненными |
| [ADR 001–006](../adr/) | Оставить | Уникальные решения сохранены, ADR-004 остаётся Proposed; импорт не принимает миграцию |
| [compact handoff](../design/compact-redesign-handoff.md), [edge matrix](../design/compact-edge-matrix.md), [implementation review](../design/compact-implementation-review.md) | Архивировать по статусу на существующих путях | Старые геометрия/палитра и указания агенту отделены от принятых текущих UI-контрактов; уникальное evidence и непроверенные пункты сохранены |
| [bb stack design](../design/bb-stack-design.md), outputs | Оставить | История reference versions и доказательств; policy отличает их от af72bb81 snapshot |
| Старые backlog/spec/plans, intake/bug/task templates, work evidence | Оставить | Уникальные task contracts и evidence не удаляются; процессные defaults заменены rules.md, шаблоны используются при необходимости |

Удалённых файлов и физических переносов нет: лишнее дублирование актуальных gates заменено указателем, исторические материалы архивированы по статусу. Это сохраняет существующие пути, уникальные принятые контракты, ADR и доказательства.

## Реальная реализация и согласованность

Прочитаны AGENTS, README, design-qa, все прежние development guides, workflow documents, связанные indexes/templates, UI/ADR contracts и целевой исходник. Проверены runtime wiring в `electron/main.js`, `electron/workspaceIpc.js`, `scripts/dev-desktop.mjs` и команды package.json. Main регистрирует dispatcher, выбирает development URL или production loadFile, сохраняет sandbox/contextIsolation/nodeIntegration. Dispatcher использует файловые settings/views/property adapters; sidecar не подключён автоматически. Результат инспекции не является запуском приложения.

Полная прежняя рабочая policy сохранена в rules.md. AGENTS направляет к ней, workflow/quality уточняют применение, specialized docs сохраняют авторитет. Ссылки назад на AGENTS являются навигацией, не взаимным переопределением правил. Исходный bb документ не редактирован. Пользовательские данные, выбранные корни, source-scoped значения, IDs, session/settings, роли, status drag restriction, geometry, dependencies и программный код не менялись.

Сторонние изменения `.ralphex/` и `work/task-loop/notion-compact-refinement-2026-09-22/run/*` сохранены; они не входят в scope/stage/commit. Их coordination/state меняются другими участниками во время работы; исполнитель их не записывает и не сбрасывает.

## Проверки

- SHA256 исходника и импорта: `3b52eb4451902dc7e4363dd42dead1b8cf9b9f60e165e181efd415f79a797b2c`; совпадает. `wc -l`: 1547.
- `node --test test/documentation.test.js`: PASS, 2/2. Это существующая профильная проверка notices и agent instructions; отдельного npm docs script нет. Новые wording tests не добавлены.
- Относительные Markdown ссылки и anchors: PASS: 26 документов, 226 локальных ссылок/якорей, 0 ошибок; 118 внешних URL пропущены. Одноразовый локальный checker исключал fenced code, проверял существование targets и Unicode heading slugs с suffix для повторных заголовков. Входящих Markdown-ссылок на удалённые заголовки AGENTS/quality-gates не найдено.
- Согласованность: ручной review policy/guide/history/runtime/commands, критериев и интегрированного scoped diff.
- `git diff --check`: PASS, завершённый результат без whitespace errors.
- Electron/Go builds, npm test/typecheck и UI capture не запускались для документационной задачи.

## Evidence по критериям

| Критерий | Реализация / проверка |
| --- | --- |
| 1 | DESIGN_RULES.md полный, SHA256/1547 строк; provenance/reference/limitations в policy |
| 2 | Таблица inventory выше; history/ADR/contracts сохранены; удаления/переносы не нужны |
| 3 | AGENTS → обязательные README/rules/workflow/quality; scoped чтение domain docs; ветки/commits/gates согласованы |
| 4 | Отдельная bb-workspace-policy; конфликты geometry/behavior разрешаются по принятому Workspace contract; нет полномочий на stack/data/security изменения |
| 5 | README/development описывают current JSON и реальные package scripts; historical design-qa сохраняет pending native evidence без новой PASS заявки |
| 6 | Hash/profile docs check/link-anchor scan/consistency/diff check с наблюдёнными результатами |
| 7 | Scoped local commit после проверок; посторонние правки сохранены; независимая приёмка ожидается и записывается координатором |

Ограничения: живое bb и runtime Workspace не запускались, новая визуальная приёмка не заявлена. Внешние URL не проверялись по сети; проверяется локальная документация и версия snapshot. Импорт справочника не закрывает старые UI QA gaps и не реализует target sidecar.
