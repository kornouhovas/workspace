# Vision: Workspace Project Board

Workspace is a desktop product with independently selected project sources. Detailed supported behavior belongs in the [PRD](prd.md) and [flows](flows/).

## Product Direction

Workspace is a desktop application for projects that already exist as folders on disk. Each Workspace binds a selected source and saves its views; roots can be shared or independent. Board and Table project the discovered folders and their properties without replacing the filesystem or our backend.

Продуктовая идея близка к Notion-like workspace, но источником истины для проектов остаётся локальная файловая структура. Приложение должно помогать видеть статусы проектов, управлять свойствами и быстро переходить к файлам и папкам проекта.

## Target Users

Основная аудитория: малые и средние организации, команды и операционные подразделения, которые ведут проекты в локальных или синхронизируемых папках.

Типичный пользователь:

- работает с несколькими проектами одновременно;
- хранит каждый проект как отдельную папку;
- хочет видеть проекты по статусам без ручного ведения отдельной таблицы;
- хочет быстро открывать файлы и папки проекта из одного интерфейса.

## Problem

Проекты часто уже разложены по папкам, но статус, приоритет, дополнительные свойства и общее состояние работ приходится отслеживать отдельно: в таблицах, мессенджерах, таск-трекерах или вручную по структуре директорий.

Это создаёт несколько проблем:

- нет единого визуального представления всех проектов из выбранной рабочей папки;
- статусы проектов не связаны напрямую со структурой папок;
- сложно быстро найти проект и открыть нужный файл;
- кастомные свойства проектов приходится вести отдельно от файловой структуры;
- команды теряют обзор, когда проектов становится много.

## Product Goal

Дать пользователю удобные локальные Workspaces поверх существующей папки проектов: приложение должно распознавать структуру рабочей папки, отображать проекты карточками и строками, позволять управлять статусами, view-настройками и свойствами, а также быстро открывать содержимое проекта.

## MVP Scope

MVP включает:

- selecting a project source for the target Workspace in Workspace settings;
- creating Workspaces in the Left Panel, before source selection or with a shared/independent binding;
- отображение проектов из Workspace в виде Kanban Board;
- отображение тех же проектов в Table view;
- карточку проекта с базовыми и кастомными properties;
- правую выезжающую панель проекта;
- просмотр файловой структуры проекта в правой панели;
- открытие файлов и переход в папки проекта;
- поиск проектов;
- управление Workspace: добавление, удаление, переименование, перемещение;
- управление views внутри Workspace: добавление, удаление и сохранение настроек отображения;
- выбор видимых values у properties в конкретном view для фильтрации проектов;
- настройку дерева папок Workspace;
- назначение папкам ролей `group`, `status`, `project`;
- базовые properties: `Name`, `Status`;
- кастомные properties типов `text`, `number`, `single select`, `multi select`, `date`;
- управление properties: добавление, удаление, изменение, перемещение, скрытие;
- управление values у select-properties: добавление, удаление, изменение, перемещение, скрытие;
- история изменений properties и property values в local-first модели.

## Core Workspace Model

Each Workspace selects its source in Workspace settings. Workspaces may share a root or bind independent roots; changing one binding preserves other Workspaces and retained data.

A Workspace is a saved working configuration with its own source binding and views. Views, visibility, grouping and filters are independent; Workspaces sharing a source retain shared source-scoped project/property values under ADR-006.

Дерево папок интерпретируется через роли:

- `group`: папка не является статусом или проектом; приложение пропускает её как контейнер и ищет проекты внутри;
- `status`: папка задаёт статус для проектов внутри неё и используется для группировки в Board и Table;
- `project`: папка является проектом; приложение не ищет проекты глубже внутри этой папки.

`Status` проекта в MVP задаётся папкой со статусной ролью, в которой находится проект.

Если проект найден вне папки с ролью `status`, он получает статус `No status`. В MVP поддерживается один уровень status folders; вложенные status-группы не входят в первую версию.

## Workspace Views

Workspace может содержать несколько views. View задаёт способ отображения проектов внутри конкретного Workspace: например, Board view или Table view.

Пользователь может добавлять и удалять views. Workspace сохраняет свои views и настройки каждого view:

- тип view;
- имя view;
- порядок view;
- набор отображаемых properties;
- порядок properties;
- видимость properties;
- видимые values у properties для фильтрации проектов;
- настройки отображения values, когда это применимо к типу property.

Views не меняют сами проекты и файловую структуру. Они задают способ просмотра, видимость properties и фильтрацию проектов внутри Workspace.

## Local Data And Sync Direction

Electron currently stores metadata locally through JSON adapters behind preload IPC. The standalone Go/any-store store is the accepted durable target; it does not become active simply because its code exists. Current scopes and target integration are defined in the [data model](data-model.md#current-runtime-and-target-scope).

Local storage отвечает за:

- настройки Workspace;
- the source bound to that Workspace in Workspace settings;
- роли папок в дереве Workspace;
- список views и настройки отображения;
- определения кастомных properties;
- значения properties для проектов;
- порядок, скрытие и настройки values;
- историю изменений properties и property values.

В будущем поверх local-first хранения должен быть наложен `any sync` для синхронизации данных между устройствами или участниками. Синхронизация не входит в MVP как пользовательская функция, но модель хранения должна учитывать будущий sync-слой и не привязывать product data к UI-состоянию.

## Main UI Areas

Left Panel:

- Add Workspace;
- Search;
- Workspaces;
- Settings.

Main Area:

- Board view с карточками проектов по статусам;
- Table view со списком проектов и properties.

Right Panel:

- открывается по клику на карточку или строку проекта;
- показывает `Name`, `Status` и кастомные properties;
- показывает файловую структуру проекта;
- позволяет открывать файлы и переходить в папки.

Settings:

- selecting the target Workspace source and recovering an unavailable root;
- отображение дерева папок;
- назначение ролей `group`, `status`, `project`;
- configuring folder roles and derived Status colors; custom properties/options are managed through Table, Project Detail and view/property menus.

## Non-Goals For First Version

В первой версии не делаем:

- авторизацию;
- multi-user collaboration;
- облачную синхронизацию как отдельную продуктовую функцию;
- роли и права доступа;
- публичный web-доступ к Workspace;
- встроенный редактор файлов;
- полноценный таск-трекер внутри проекта;
- интеграции с внешними PM-системами;
- мобильное приложение.

## Success Metrics

Успех MVP можно измерять по таким признакам:

- пользователь может выбрать папку проектов в Settings и создать Workspace поверх неё;
- проекты корректно группируются по статусам из структуры папок;
- пользователь может переключаться между Board и Table без потери данных;
- пользователь может найти проект через поиск;
- пользователь может открыть карточку проекта и увидеть properties и файлы;
- пользователь может открыть файл или папку проекта из приложения;
- пользователь может настроить properties без ручного редактирования служебных файлов;
- пользователь может добавить или удалить view внутри Workspace;
- Workspace сохраняет views и настройки видимости properties;
- Workspace сохраняет настройки видимых values у properties для фильтрации проектов;
- приложение безопасно работает только в пределах выбранной папки проектов.

## Product Constraints

- Источник проектов в MVP — локальная файловая система.
- Приложение должно уважать существующую структуру папок и не ломать её без явного действия пользователя.
- Работа с путями, открытием файлов и обходом дерева должна быть безопасной.
- Локальные данные Workspace и properties должны храниться предсказуемо и мигрироваться без потери пользовательских настроек.
- Product data хранится local-first через `any local` / `any-store`.
- Будущий `any sync` должен быть отдельным слоем поверх локального хранения, а не заменой локальной модели.
- Status-folder moves are available through the explicit Board/Table operation in [ADR-007](adr/007-board-table-status-moves.md) and [ADR-008](adr/008-table-row-order.md). Destinations must be eligible Status groups; No status and custom-property group crossings are unavailable. Arbitrary filesystem rearrangement remains outside that contract.
