# Хранилище Workspace и выборочное использование bb

Дата проверки: 8 октября 2026 года. Статус: исследование и предложение, **не ADR и не план реализации**.

## Зафиксированные исходные решения

- Свойства проектов и общие views сохраняются в any-store. Это исходное продуктовое решение, а не результат данного сравнения.
- По умолчанию продукт работает локально. Совместная папка — подключаемый режим; рабочая БД локальна, обмен общими данными идёт отдельно. Серверный режим рассматривается позднее.
- Выбор механизма объединения изменений ещё открыт: Automerge обсуждался как кандидат, но не принят.
- Модули bb стоит заимствовать по полезным границам. Перенос его UI или runtime не означает автоматического принятия всей модели данных bb.
- Вопрос исследования: выгодно ли хранить **все остальные структурированные данные** — чаты, события, состояние агента, очереди и настройки — также в any-store?

Предварительный ответ: **общего доказанного победителя нет**. Any-store способен хранить такие записи; основания для запрета «чаты только в SQL» отсутствуют. При этом перенос SQL-зависимых сервисов bb на any-store — отдельная реализация, а второй движок несёт цену согласованности. Решение определяется объёмом заимствования bb и проверкой конкретных операций, а не словом «документная» или «реляционная».

## Три разных базы сравнения

| База сравнения | Что проверено | Чего это не означает |
| --- | --- | --- |
| Workspace сегодня | [go.mod](../../go.mod) закрепляет `any-store v0.4.6`; [Store.Open](../../internal/workspacestore/store.go) открывает её через Go. Активный Electron всё ещё использует JSON adapters. | Наличие Go store не доказывает, что текущая UI-сессия пишет в него. |
| Any-store для нового продукта | Рассмотрены main `33c75a0794feb0a3697a184d785385461926eac2` и тег библиотеки `v2.2.1` → `e03605080be551dce41a5d6df2bc571abfd3341b`, API import `/v2`. | Это не закреплённая версия Workspace и не обещание совместимой замены файла v0.4.6. |
| bb | Рассмотрен commit `f135a001e72942cee9118d2693208ec0725e2f18`: `better-sqlite3` + Drizzle + собственные SQL migrations и сервисы. | bb не является доказательством, что весь его runtime нужен Workspace. |

Источники: [текущий Workspace runtime](../development/architecture.md), [any-store v2 snapshot](https://github.com/anyproto/any-store/tree/33c75a0794feb0a3697a184d785385461926eac2), [bb DB dependencies](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/db/package.json).

## Any-store v0.4.6: действительные возможности

| Требование | Проверенная возможность | Необходимая работа приложения |
| --- | --- | --- |
| Атомарная запись нескольких документов | `ReadTx`, `WriteTx`, commit/rollback; операции принимают transaction context. | Определить границу транзакции: событие + состояние run + очередь/outbox, а не несколько независимых вызовов. |
| Индексы и уникальность | `IndexInfo` поддерживает несколько полей, порядок, `Unique`, `Sparse`; коллекции имеют `EnsureIndex`. | Выбрать ключи дедупликации, проверить nullable/missing-семантику; не приравнивать sparse к произвольному SQL partial index. |
| Чтение истории страницами | Query API предоставляет filter, `Sort`, `Limit`, `Offset`, iterator, `Count`, `Explain`. | Для длинного журнала проверить keyset pagination через `sessionId/sequence`; наличие offset не гарантирует приемлемую цену глубоких страниц. |
| Добавление событий | Коллекция имеет Insert/Upsert/update/delete. Событие может быть отдельным документом. | Append-only, sequence, retry/dedup, retention и запрет недопустимого lifecycle перехода — политика приложения. |
| Резервирование и восстановление | DB API имеет Backup, QuickCheck, Flush. | Проверить согласованность backup с внешними файлами и поведение выбранных durability-настроек. |
| Поиск чатов | В проверенных public DB/Collection/Query/Index APIs v0.4.6 полноценный FTS API не обнаружен. | Не обещать поиск bb через простой перенос query. Выбрать/проверить отдельный индекс либо другую версию движка. |
| Проверка модели и миграции | Документы допускают изменяемую структуру; публичная поверхность не доказывает предметные foreign keys/check/cascade или готовые миграции Workspace. | Валидировать команды/записи, ссылки и schemaVersion; хранить и тестировать журнал миграций. |

Первичные исходники закреплённой версии: [DB](https://github.com/anyproto/any-store/blob/v0.4.6/db.go), [Collection](https://github.com/anyproto/any-store/blob/v0.4.6/collection.go), [Query](https://github.com/anyproto/any-store/blob/v0.4.6/query.go), [Index](https://github.com/anyproto/any-store/blob/v0.4.6/index.go), [README](https://github.com/anyproto/any-store/blob/v0.4.6/README.md). APIs также сверены с установленной dependency в Go module cache.

Это документный API поверх SQLite/WAL, не автоматический sync-engine. Прямо изменять внутренние таблицы any-store из Drizzle не следует считать поддерживаемой интеграцией: публичного контракта такого совместного владения здесь не установлено. [Драйвер v0.4.6](https://github.com/anyproto/any-store/blob/v0.4.6/internal/driver/manager.go), [исследование общего каталога](workspace-shared-folder-sync.ru.md).

## Any-store v2: отдельный кандидат для greenfield

На проверенном commit v2 описывает собственный btree/pager/WAL движок и собственный формат файла, без CGO. Документированы compound/unique/sparse индексы, транзакции с одним писателем, BM25 full-text, vector search и aggregation pipelines с ограниченным `$lookup`. Поэтому отсутствие FTS в проверенном API v0.4.6 нельзя распространять на v2. [README фиксированного commit](https://github.com/anyproto/any-store/blob/33c75a0794feb0a3697a184d785385461926eac2/README.md).

Проект обсуждается как greenfield: v0.4.6 описывает сегодняшний checkout, но не обязательный выбор для новой реализации. Дополнительно проверен именно тег библиотеки `v2.2.1`, а не отдельного CLI: tag object датирован 2 октября 2026 года и указывает на commit `e03605080be551dce41a5d6df2bc571abfd3341b`. Его README также перечисляет FTS, транзакции и собственный движок; `go.mod` задаёт Go `1.26.0`. Для первого greenfield-пилота это конкретный кандидат. Наличие тега не доказывает приёмку нашего приложения: сборка на целевых ОС, нагрузка и восстановление не проверялись. [Tag object](https://api.github.com/repos/anyproto/any-store/git/tags/e87d0ff609806cea290208dab8df6bfaa6a250dc), [v2.2.1 README](https://github.com/anyproto/any-store/blob/v2.2.1/README.md), [v2.2.1 go.mod](https://github.com/anyproto/any-store/blob/v2.2.1/go.mod).

Это расширяет пригодность единого any-store для чатов, но не доказывает паритет с поиском bb, совместимость запросов или результат на нагрузке Workspace. Тот же README описывает перестроение индексов при изменении формата и ограничения записи старой версией. Стабильность миграционного пути нашего продукта, срок поддержки и стоимость эксплуатации требуют отдельной проверки; номер v2 не заменяет её.

Даже новый движок не выбирает за продукт жизненный цикл агента, scope синхронизации или разрешение конфликтов. «Один движок» не обязательно означает одну физическую БД: данные устройства, приватные чаты и общие данные могут иметь разных владельцев и политики экспорта.

## Что именно связывает bb с SQLite/Drizzle

bb открывает SQLite через `better-sqlite3`, включает WAL, foreign keys, busy timeout и передаёт соединение Drizzle вместе со schema. Значения tuning bb не предлагается переносить без измерений. [Connection](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/db/src/connection.ts).

Схема содержит threads, events, environments, preferences и другие семейства. В ней есть FK с cascade/restrict/set-null, составные и частичные unique indexes, check expressions. Это конкретные инварианты bb, не просто интерфейс универсального key-value store. [Schema](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/db/src/schema.ts).

Путь приёма событий напрямую использует Drizzle и `json_extract`, вызывает transactional append из `@bb/db`, а затем выполняет lifecycle effects и уведомления. Внутренний event repository использует sequence, чтение до/после sequence, raw SQL, joins, подзапросы и указание индексов. Это означает: заимствовать файл сервиса целиком, заменив только имя database driver, не получится. [Server events](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/server/src/internal/events.ts), [Event repository](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/db/src/data/events.ts).

Поиск чатов использует FTS5 virtual table, rowid-связь с segments и triggers; отдельная миграция добавляет prefix indexing. Поэтому переписать storage — ещё и сохранить поведение производного поискового индекса. [FTS migration](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/db/drizzle/0040_thread_search_rowid_fts.sql), [Prefix FTS](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/db/drizzle/0101_thread_search_prefix_fts.sql).

Запуск сервера инициализирует БД и выполняет миграции. Собственный migration layer bb проверяет journal/hash/history и обрабатывает продуктовые преобразования. Это готовый опыт, но его схемы и переходы принадлежат bb, а не новому Workspace. [Server DB](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/server/src/db.ts), [Migrations](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/db/src/migrate.ts).

**Вывод из кода:** выгоднее отделить контракты provider adapter, события и state machine от конкретного repository; SQL-зависимые сервисы либо сохраняются вместе с их store, либо осознанно портируются и повторно проверяются. Величина переноса пока не оценена в человеко-днях и не измерена числом совместимых модулей.

## SQLite/Drizzle как контрольный вариант

SQLite умеет хранить и обрабатывать JSON/JSONB; индексы могут включать выражения. Поэтому гибкие свойства не доказывают уникального преимущества any-store, хотя документный API может быть удобнее. [SQLite JSON](https://www.sqlite.org/json1.html), [CREATE INDEX](https://www.sqlite.org/lang_createindex.html).

Drizzle описывает constraints/indexes, но TypeScript типизация не проверяет любой входящий runtime payload. Предметная валидация всё равно нужна. Для external-content FTS SQLite требует поддерживать согласованность индекса с исходным содержимым; выбор FTS не снимает эту обязанность. [Drizzle constraints](https://orm.drizzle.team/docs/indexes-constraints), [SQLite FTS5](https://www.sqlite.org/fts5.html).

Полный переход на SQLite/Drizzle мог бы уменьшить языковую границу с bb, но **переоткрывает уже принятое решение о свойствах и views в any-store**. Здесь он нужен для честного сравнения, а не предлагается как скрытая замена согласованной модели.

## Сравнение трёх вариантов

Оценки ниже — архитектурные выводы по коду, не результаты benchmark.

| Критерий | A. Any-store для всех структурированных данных | B. Any-store metadata + SQLite/Drizzle runtime | C. SQLite/Drizzle для всего |
| --- | --- | --- | --- |
| Согласованный metadata выбор | Сохраняется | Сохраняется | Требует нового решения |
| Транзакции между записью run и связанными данными | Возможны внутри одной DB и owner; межпроцессный вызов проектируется явно | Нет одной общей транзакции двух stores; нужны idempotent commands/outbox/reconciliation | Возможны внутри одной DB |
| Перенос готовых bb services | SQL/Drizzle-части переписываются | SQL-зависимая часть потенциально переносится ближе к оригиналу | Наиболее близкий storage API, но предметную модель всё равно адаптировать |
| Go lifecycle | Требуется | Требуется плюс Node DB lifecycle | Для storage не требуется; другие Go helpers оцениваются отдельно |
| Поиск | v0.4.6 требует решения; v2 имеет свой FTS, паритет проверить | Можно сохранить SQL/FTS путь bb | Можно сохранить SQL/FTS путь bb |
| Backup/migrations | Один технологический стек, несколько возможных scopes | Два migration/backup/recovery пути и согласование ссылок | Один SQL стек |
| Цена стартовой неопределённости | Реализация runtime repositories и проверка выбранной версии | Дополнительные границы/дублирование, но меньше некоторых портов | Повторное открытие metadata решения |

Для B связь чата с проектом должна быть устойчивой по ID, а не SQL FK между файлами разных движков. Запуск агента не должен зависеть от того, успела ли внешняя папка доставить чужое изменение. Как обработать удалённый проект с сохранённой историей чата — продуктовое правило, не автоматический cascade.

Один факт имеет одного владельца: B не должен независимо записывать один и тот же run в оба stores. Между ними нужны стабильные ID, idempotent commands/outbox, reconciliation и согласованное backup/restore; общее происхождение от SQLite не создаёт транзакцию между сервисами. Полностью перестраиваемый поисковый индекс — отдельный случай: он не второй авторитетный runtime store, хотя его adapter, обновление и восстановление также стоят работы.

Разделение «свойства документные, чат реляционный» недостаточно для выбора B: чат также можно описать документами; решающий аргумент в пользу B — конкретная экономия сохранённого и проверенного runtime-кода, запросов и миграций bb. В пользу A — уменьшение числа persistence-владельцев при ограниченном переносе bb.

## Что означает «все данные»

Это предложение по ответственности, не принятый список синхронизируемых сущностей:

| Данные | Возможность хранения | Что нужно определить отдельно |
| --- | --- | --- |
| Свойства, definitions/options, общие views | Any-store выбран | Общая идентичность, exchange/merge и восстановление |
| Сообщения и нормализованные agent events | Any-store технически подходит | Публичность/приватность чата, retention, attachments, поиск |
| Run, pending interaction, очередь команд | Any-store технически подходит при транзакционной модели | Единственный владелец исполнения, leases/retry/cancel и crash recovery |
| Настройки | Структурированные значения можно хранить в любом из вариантов | Device-local, пользовательские и workspace-shared scopes |
| Файлы проекта, большие artifacts, provider session files | Наличие общего store не требует помещать их байты внутрь | Файловый владелец, lifetime и восстановление ссылок |

Чаты и очередь не становятся общими автоматически только потому, что используют тот же движок. Повторно доставленный через shared folder event не должен повторно запускать shell-команду. Репликация истории и исполнение команды — разные операции.

## Упаковка и жизненный цикл

Workspace уже имеет [Go build script](../../scripts/build-sidecar.mjs) с отдельными target/platform/arch и [Go sidecar](../../cmd/workspace-sidecar/main.go). Но активный Electron не запускает storage HTTP sidecar; его настоящий start/readiness/shutdown/restart/migration handoff остаётся работой интеграции. [Runtime guide](../development/architecture.md).

Отсутствие CGO у any-store уменьшает одну категорию сборочных зависимостей, но не убирает доставку бинарника и версионирование протокола TypeScript↔Go. Пакет bb использует native `better-sqlite3`; его документация отдельно обсуждает установку/build и Electron. Значит, вариант B не является вариантом «без packaging work». [Any-store v0.4.6](https://github.com/anyproto/any-store/blob/v0.4.6/README.md), [better-sqlite3 troubleshooting](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md).

Для всех вариантов нужен один понятный владелец записей. Транзакцию лучше выражать операцией сервиса, например `appendEventsAndAdvanceRun`, а не держать открытую DB transaction между последовательными вызовами renderer. Это предложение по границе, а не готовый API.

## Рекомендация до прототипа

**Не принимать правило «всё обязательно в any-store» и не добавлять вторую runtime DB заранее.** Сохранять any-store для принятой metadata области; описать минимальный набор runtime операций независимо от движка. Для небольшого собственного runtime сначала проверить единый any-store; для заимствования значительной SQL-зависимой части bb сравнить стоимость её сохранения с ценой второго store.

Направление выбора конкретное: **A выигрывает**, если собственный runtime невелик, необходимые запросы/инварианты/поиск проходят пилот и экономия одного persistence стека превосходит цену TypeScript↔Go repositories. **B выигрывает**, если действительно сохраняется существенная проверенная часть bb event/queue/search services, а стоимость адаптации и восстановления между stores меньше её порта. Пока масштаба такого reuse нет, добавление runtime SQLite не обосновано. Эти условия оцениваются вместе с упаковкой и измеренным workload, а не предполагаемой скоростью движка.

Для greenfield первым кандидатом any-store предлагается фиксированный `v2.2.1`; v0.4.6 остаётся базой описания текущего checkout и совместимости, а не обязательным конкурентом для новой реализации. Не приписывать старой версии возможности новой и не считать чтение README достаточным основанием для upgrade действующего приложения. Ни общая скорость, ни надёжность на наших объёмах пока не измерены.

Сила вывода высокая для существования API и coupling исходников; средняя для оценки границ/стоимости; низкая для throughput, latency, длительности миграции и полной переносимости bb, поскольку прототип не выполнялся.

## Прототип: критерии, после которых можно выбрать

1. **Один и тот же workload:** заранее зафиксировать число параллельных runs, объём истории, размер event batch, нужные запросы и целевые p95 latency/память. Численные пороги согласовать по продукту, не выдумывать по библиотечному README.
2. **Транзакция lifecycle:** append batch, advance run, enqueue/dequeue и outbox фиксируются согласованно; исключение в середине откатывает всё необходимое.
3. **Retry и уникальность:** одинаковый event/request ID дважды, конкурентные sequence и повтор после падения не создают второй смысловой эффект.
4. **История:** листание по sequence без пропусков/дубликатов при дописывании; фильтры по thread/turn/type; query plan и стоимость глубоких страниц.
5. **Поиск:** одинаковый корпус и запросы; качество результатов, инкрементальное обновление, удаление, восстановление индекса. FTS5 и v2 FTS не объявлять эквивалентными без проверки.
6. **Схема:** нарушение ссылок и уникальности, неизвестный тип event, смена schemaVersion, migration interruption и восстановление backup.
7. **Упаковка:** выбранные ОС/архитектуры, чистая установка, readiness, graceful shutdown, kill/restart и incompatible binary/schema versions.
8. **Split-кандидат:** падение между stores, удаление проекта при наличии runs, повтор reconciliation, согласованная резервная копия. Если B выигрывает reuse, эта цена входит в оценку.
9. **Инвентаризация reuse:** перечислить конкретные bb modules «без переноса», «через adapter», «переписать» и перенести один законченный вертикальный сценарий.
10. **Области синхронизации:** восстановление общих properties/views на новом устройстве не выдаёт приватный чат и не исполняет старую очередь заново.

После этого выбор A/B оформляется отдельным решением с измерениями и оставшимися рисками. Вариант C рассматривается только при явном пересмотре принятой metadata основы.

## UI bb: принятый стек и границы заимствования

Выбор frontend стека bb принят независимо от storage. Следующие сведения относятся к тому же commit `f135a001e72942cee9118d2693208ec0725e2f18`; версии ниже — majors из manifests, не точные resolved versions lockfile. Старые дизайн-референсы на другие commits не подменяют этот снимок.

| Область | Проверенный стек и роль |
| --- | --- |
| Web-приложение | React 19, TypeScript, Vite 8, React Compiler. |
| UI и оформление | Tailwind 4, shadcn `radix-mira`/Radix, CSS variables и Hugeicons. |
| Навигация и данные | React Router 7, TanStack Query 5; Jotai 2 используется, в частности, для split layouts. Это не TanStack Router. |
| Сложные списки и панели | React Virtual 3, dnd-kit, react-resizable-panels 2. |
| Каталог компонентов | Ladle 5. |

Первичные источники: [app manifest](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/package.json), [Vite](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/vite.config.ts), [shadcn configuration](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/components.json), [theme](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/src/components/ui/theme.css), [providers](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/src/main.tsx), [layout atoms](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/src/lib/split-layout/atoms.ts), [Ladle](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/.ladle/config.mjs).

`@bb/shared-ui` — private source package внутри workspace, а не обещанный standalone React kit. Перенос требует Tailwind source scan и browser aliases для portal-scope/browser-dimming. `core-ui` содержит функции представления домена, а `client-core` зависит от bb domain/contracts/thread-view. Следовательно, границы extraction важнее копирования названия пакета. [Shared UI manifest](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/shared-ui/package.json), [Vite seam](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/vite-shared-ui-seam.ts), [Core UI](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/core-ui/src/index.ts), [Client core](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/client-core/package.json).

Table primitives shared-ui не реализуют таблицу проектов Workspace; `@tanstack/react-table` не указан в app/shared-ui manifests. Свои свойства, группировку и порядок строк надо сохранить отдельной предметной реализацией. Tiptap 3, xterm, `@pierre/diffs`, Markdown/KaTeX/Mermaid подключаются по возникающим функциям, а не обязательным комплектом для первого Board/Table. [UI code splitting](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/docs/ui-code-splitting.md).

Mobile bb — отдельный Expo/React Native/Expo Router/NativeWind client, а не автоматическая сборка web-компонентов. При копировании кода сохраняется MIT copyright/license notice Michael Yong. [Mobile manifest](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/mobile/package.json), [MIT License](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/LICENSE).

Совместимость перенесённых компонентов и performance не проверялись сборкой. Предложение: взять техническую основу UI и подходящие primitives, затем адаптировать их к предметным контрактам Workspace; агентские редактор/терминал/diff — последующие срезы. Ни frontend стек, ни MIT-лицензия не обязывают принимать DB schema и agent lifecycle bb.
