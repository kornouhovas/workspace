# Compact: матрица краевых случаев и доказательств

Приложение к [handoff](compact-redesign-handoff.md). Аудит 2026-09-21, baseline `2f7cb00`. Метки: **observed** — реально пройден UI; **tested** — выполнены названные automated tests, не визуальная проверка; **code-inspected** — просмотр реализации; **proposed** — целевое правило; **unverified** — нужный сценарий не пройден. В одной строке допустимы разные метки для разных слоёв. Ни один слой не заменяет другой.

[Source/action inventory](../../work/task-loop/compact-design-handoff-2026-09-21/run/source-inventory.md) содержит 26 поверхностей с точными source:line и tests. [Лог 100 passing tests](../../work/task-loop/compact-design-handoff-2026-09-21/run/targeted-tests.txt). [UI observations](../../work/task-loop/compact-design-handoff-2026-09-21/run/ui-observations.json). Runtime — неизменённый renderer + IPC backend на `/tmp/workspace-design-review`, Chrome :8770, только разрешённые read/select методы; UI session менялся в отдельной browser tab. Native Electron, chooser и реальные рабочие данные не использовались.

| ID | Сценарий и что проверить при реализации | Текущее доказательство / статус | Решение для дизайна |
|---|---|---|---|
| E01 | Нет source / нет workspace | code-inspected App/states; UI unverified | Раздельные сообщения, существующий Settings CTA |
| E02 | Initial loading / refresh | code-inspected App; UI unverified | Skeleton стабильного размера; не fake empty |
| E03 | Workspace switch pending, stale response | tested workspaceAppState | Existing content + aria-busy, взаимодействие заблокировано |
| E04 | Ошибка load/scan/storage | code-inspected App; UI injection unverified | Не терять projection, контекстная ошибка; не выдумывать repair |
| E05 | Save failure, быстрые edits, switch during save | tested workspaceAppState | Нет false success; stale completion не меняет другой проект |
| E06 | Missing/inaccessible root после restart | code-inspected contracts; native unverified | Путь/ошибка читаемы, существующий Settings; без обхода safety |
| E07 | Project/file удалён или переименован после scan | code-inspected detail/App; localOpen tested | Disabled unavailable item; safe errors, не crash |
| E08 | Corrupt tab session / closed tab during save | tested projectSession/projectTabs | Не возвращать закрытый экземпляр |
| E09 | 0/1/many projects; zero status folders | code-inspected Board; views tested | Конкретные empty состояния; не Create project |
| E10 | No status / empty status / filter removed group | tested workspaceViews | Различать существующую пустую группу и исключённую фильтром |
| E11 | Empty search, Unicode no-match | observed empty-search PNG/AX | Сейчас пустая Board без текста; proposed пояснение «Ничего не найдено», без новой функции |
| E12 | Name-only search, query carried across views | tested workspaceViews; code-inspected | Не обещать поиск по properties/files |
| E13 | Long/unbroken/Unicode names и paths | code-inspected; runtime unverified | Truncate/wrap + full name, стабильная ширина |
| E14 | Duplicate project names разных папок | source identity contract; UI unverified | Стабильный ID, не объединять; путь в существующем контексте |
| E15 | 200 проектов / 10 групп / 30 columns | proposed stress fixture, unverified | Scroll по существующей модели; не заявлять performance SLA |
| E16 | Board saved wide width при resize | tested boardLayout/views; observed1024 saved384 | Fixed width+hscroll; min288/default384/max1600 |
| E17 | Board hidden/empty custom value, inline editor | code-inspected Board | Не перекрывать editor card click; пустое значение можно редактировать в detail |
| E18 | Table wide columns / resize / reorder | code-inspected Table; base Table observed1024 | Preserve pointer resize/reorder, hscroll |
| E19 | Text compact/wrap/newlines/long token | code-inspected editors; normalization tested | Compact popover по ширине cell; wrap растит row |
| E20 | Numbers 0, negative, decimal, null, =2+3*4 | tested properties | Result14 вне edit, expression при edit |
| E21 | Invalid number/expression | tested properties | Существующая нормализация/ошибка; не молча commit display text |
| E22 | Date empty/leap day/month/year/locale | tested properties+i18n; calendar UI unverified | Blank empty, clear/navigation, locale-aware display |
| E23 | Select empty/long/many/no match/create pending | code-inspected select editor; properties tested | Picker scroll, disabled pending/no-match, без fake value |
| E24 | Multi-select many chips / wrapping / clear | code-inspected; properties tested | Wrap внутри cell/panel, не раздвигать shell |
| E25 | Direct chip menu повторный click/outside-chip | code-inspected select/Table/detail | Rename/delete/color отдельно от picker; сохранить dismissal |
| E26 | Property delete used values / option delete used | code-inspected menus/contracts; domain tested | Существующие confirmations и последствия |
| E27 | Name required / Status hideable readonly / rename label | code-inspected; Customize observed | Не удалять/менять system identity, статус не dropdown |
| E28 | Hidden properties group edit/reorder/show | code-inspected detail | Hidden ≠ deleted; group остаётся доступной |
| E29 | Active filter on hidden property / empty filter | tested visibility/views | View settings не меняют definition/data |
| E30 | 1 view / last-view delete / duplicate view | code-inspected view-tabs; views tested | Last delete disabled; duplicate view не project |
| E31 | 20 view tabs / long rename / overflow | code-inspected, runtime unverified | Scroll, full accessible name, actions pinned |
| E32 | Open side panel / expand / restore | observed panel1024, duplicate1440, restore AX | View toolbar hidden при любом selectedProject |
| E33 | Duplicate project tab same ID data | observed two instances; tested reducers | Разные instance IDs; shared project data |
| E34 | 12 project tabs1024 | observed tabs-overflow PNG+DOM | Сейчас icon-only indistinguishable; proposed readable truncated scroll tabs |
| E35 | Close active first/middle/last/inactive | tested projectTabs; visual unverified | Selection fallback по reducer, не по имени |
| E36 | Restore one instance while duplicate remains | observed restore AX; tested | Удаляется один tab, panel открывается, Board selected |
| E37 | Reorder view/project/sidebar/property/column | code-inspected; drag tests | Не путать с запрещённым card cross-status DnD |
| E38 | Pointer DnD threshold/cancel/strip edge | code-inspected project-tabs; runtime unverified | Не вводить autoscroll/keyboard reorder как existing |
| E39 | Workspace-specific sessions/restart | tested projectSession | Tabs не пересекают workspace, corrupt storage безопасен |
| E40 | Sidebar collapse/restore | observed collapsed1024 | Inert hidden content, доступный Show sidebar |
| E41 | Settings source chooser cancel/pending/roles/deep tree | code-inspected Settings; native unverified | Сохранить roles/status colours/locale; no new property admin |
| E42 | Workspace rename blank/Escape/delete/reorder | code-inspected sidebar | Не менять файлы; trim/confirmation сохранены |
| E43 | Menu near edge/nested/popover scroll | Customize observed1024; остальные unverified | Collision handling, viewport max, no manual z-index |
| E44 | Escape from Customize/focus return | observed focus вернулся Customize | Сохранить primitive focus; nested Escape отдельно проверить |
| E45 | Outside click dismiss без activate underneath | code-inspected menu-dismissal | Первый outside click только закрывает overlay |
| E46 | Keyboard card activation/tab navigation/focus | code-inspected; полный проход unverified | Tab/Shift+Tab/Enter/Space/Escape + focus-visible |
| E47 | Bare toolbar icons default/hover/disabled/busy | proposed; static reference only | No hover backdrop, names/tooltips/focus сохраняются |
| E48 | Russian labels / mixed Unicode / IME composition | i18n tested; IME/UI unverified | Не bind Enter глобально, не ломать composition |
| E49 | File tree empty/deep/long/unavailable | code-inspected detail; localOpen tested | Scroll, distinguish folders/files, explicit safe open |
| E50 | Toast error/success за panel/menu | code-inspected; runtime unverified | Не блокирует controls, не исчезает без чтения |
| E51 | 1440×960 и1024×720 | observed ограниченные baseline states | Все изменённые поверхности повторно проверить после редизайна |
| E52 | 800×720 narrower stress | observed panel screenshot только | Ниже native min; не обещать mobile support |
| E53 | 125/200% zoom / OS scaling | unverified; electron zoom lock code-inspected | Browser stress acceptance, native zoom change вне scope |
| E54 | Native titlebar drag/no-drag/traffic lights | code-inspected electron/App; native unverified | Не перекрывать toolbar clicks, macOS/Windows проверить отдельно |
| E55 | Contrast / high contrast / focus not color-only | proposed, measurements unverified | Измерить contrast tokens, сохранить outline и подписи |
| E56 | Empty/error text very long / offline recovery | code-inspected errors, UI unverified | Wrapping + существующие действия, без придуманного retry/undo |

## Безопасный воспроизводимый набор данных

Создать новый temporary root через `mkdtemp` (например `/tmp/workspace-compact-edge-*`), отдельные config/view/property/session paths. Никогда не подставлять repository `.workspace` или рабочий source пользователя. Исходный diagnostic harness расположен в [предыдущем run](../../work/task-loop/quiet-precision-tabs-2026-09-21/run/diagnostic-harness.mjs); он read/select-only и не годится для подтверждения mutation flows. Для editing теста расширить только временный harness с явными fixture paths либо использовать isolated native launch. Не открывать внешний файл/приложение для проверки safe-open без необходимости.

Fixture cases: empty root; базовые6 проектов; standalone No status; empty status; одинаковое имя «Проект» в двух status folders; имя120+ символов с пробелами/кириллицей/emoji и unbroken token;200 проектов/10 статусов;10 уровней tree;30 custom properties; text multiline1000 символов, number0/-1/1.5/=2+3*4/invalid, leap date, empty date, select50 options, multiselect20 выбранных. Создавать через backend/service API, сохраняя role schema/IDs, не вручную подделывать durable records. Отдельный fixture для missing root/file и отказа service; error injection маркировать synthetic.20 views/20 mixed+duplicate tabs создать через существующие UI/service операции. Не загрязнять baseline/reuse captured fixture без записи изменений.

## Команды и граница результатов

В этом аудите выполнено100 tests,0 failed:

```sh
node --test test/workspaceProjectTabs.test.js test/workspaceProjectSession.test.js test/workspaceBoardLayout.test.js test/workspaceDrag.test.js test/workspaceViewVisibility.test.js test/workspaceAppState.test.js test/workspaceProperties.test.js test/workspaceViews.test.js test/localOpen.test.js test/rendererBoundary.test.js test/i18n.test.js
```

Это domain/reducer/contract проверки; они не доказывают clipping/focus/contrast. После renderer implementation выполнить их и `npm run typecheck`, `npm run build:renderer`, `git diff --check`, затем реальные UI acceptance сценарии. Проверки native chooser/permissions/OS scaling, полный проход всех editors, долгих имён, many-project performance и injected errors остаются открытыми, а не «пройдены».

Ограничение capture: `collapsed-1024.png`, `customize-1024.png`, `panel-1024.png` фактически1024×496, хотя перед серией задавался viewport1024×720. Они подтверждают содержимое/ширину и AX, но не полный720px layout. Board/search/table/tabs1024×720, duplicate1440×960 и stress800×720 имеют ожидаемые raster размеры.
