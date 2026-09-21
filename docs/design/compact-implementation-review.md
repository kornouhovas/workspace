# Compact №3: реализация и проверка

Ветка `codex/compact-redesign`, попытка `compact-implementation-2026-09-21`. Дизайн-источники: [handoff](compact-redesign-handoff.md) и [матрица](compact-edge-matrix.md). Изменения ограничены renderer, стилями, локализацией, тестом reducer и UI-документацией. Storage, IPC, Electron security, project IDs, правила Status и файлы пользователя не менялись. Браузерные наблюдения проводились на отдельном временном source/config, путь и команды — в `work/task-loop/compact-implementation-2026-09-21/run/`.

## Результат

Светлая палитра Compact, плотные sidebar/Board/Table/панель/Settings и единая верхняя строка реализованы. Вкладки представляют текст и прокручиваются; активная вкладка раскрывается после переключения и изменения ширины окна. Add View и Customize Columns остались действиями с доступными именами/подсказками и видимым focus, без фона hover. Поиск без совпадений показывает отдельное сообщение; запрос сохраняется при смене вида. Действия проекта находятся в той же верхней строке. Дополнительных команд из иллюстраций нет.

`observed` — проверено через UI на изолированном fixture; `tested` — выполнен автоматический тест, не визуальная проверка; `inspected` — проверен код/контракт; `unverified` — конкретный сценарий не выполнен, указана причина. Базовые доказательства из [первой матрицы](compact-edge-matrix.md) сохраняются; ниже результат после внедрения. Ни один тип доказательства не подменяет другой.

| ID | Результат после реализации |
|---|---|
| E01 | inspected: отдельные no-source и no-workspace ветви сохранены; observed в новой UI unverified, fixture был с source. |
| E02 | inspected: loading/refresh ветви не менялись; screenshot loading unverified, состояние кратковременно. |
| E03 | tested: reducer для stale workspace response в профильном наборе; pending UI unverified без инъекции задержки. |
| E04 | inspected: service error остаётся над проекцией; UI-инъекция ошибки unverified. |
| E05 | tested: stale-save/reducer профильные тесты; save failure UI unverified без безопасной fault injection. |
| E06 | inspected: missing-root обработка и Settings CTA сохранены; restart с отсутствующим root/native chooser unverified. |
| E07 | inspected: file/project availability и безопасное открытие не менялись; удаление после scan UI unverified. |
| E08 | tested: projectSession/projectTabs regressions, закрытый tab не восстанавливается по имени. |
| E09 | observed: шесть проектов, три Status на Board; zero/one/no-status UI unverified, исходная логика проекции сохранена. |
| E10 | tested: фильтрация статусов в workspaceViews; empty status UI unverified. |
| E11 | observed: Unicode запрос без совпадений показывает локализованное сообщение в Board и Table (`empty-search-final-1024x720.png`). |
| E12 | tested: новый reducer regression для переноса Unicode search query между видами; observed перенос Board→Table. Поиск остаётся по имени. |
| E13 | observed: длинное Unicode/unbroken имя вида сокращается визуально, полное имя остаётся в `title`/AX; длинные project names/paths UI unverified. |
| E14 | inspected: табы используют project ID, не название; duplicate-name fixture UI unverified. |
| E15 | unverified: 200 проектов/10 групп/30 колонок не генерировались; performance не заявляется. |
| E16 | observed: Board при 1024 имеет горизонтальную прокрутку и стабильную ширину колонок; правила min/max покрыты существующим тестом boardLayout. |
| E17 | inspected: Board card/value click и detail editor сохранены; hidden/empty custom value UI unverified. |
| E18 | observed: Table при 1024 сохраняет столбцы и горизонтальную прокрутку; drag/resize UI unverified, обработчики не менялись. |
| E19 | observed: через Table Text editor сохранены две строки с кириллицей/emoji, после reload значение сохранилось; длинный 1000-символьный wrap UI unverified. |
| E20 | tested: properties scenarios для 0, отрицательных, decimal и формулы; observed: `=2+3*4` введено через Table editor, отображается `14` и сохраняется после reload. |
| E21 | tested: invalid number/expression normalization; UI error unverified. |
| E22 | tested: date/property/i18n набор; observed: выбор 29 сентября 2026 через calendar в Table сохранился после reload. Typed leap date и month/year navigation UI unverified. |
| E23 | observed: пустой Select picker, no-match и создание Unicode option, выбранный chip сохранился после reload; 50 options UI unverified. |
| E24 | observed: через Multi-select созданы и выбраны два chips, после reload оба сохранились и не расширили shell; 20 chips UI unverified. |
| E25 | inspected: chip direct menu и dismissal обработчики сохранены; повторные pointer действия UI unverified. |
| E26 | tested: property domain validations; delete confirmation UI unverified. |
| E27 | inspected: системные Name/Status ограничения сохранены; Customize action observed и доступен из верхней строки. |
| E28 | inspected: hidden property group и reorder не менялись; UI unverified на fixture без custom properties. |
| E29 | tested: visibility/view projection regressions; фильтр не меняет сохранённые значения. |
| E30 | observed: создано 18 новых Board views через существующее Add View, context menu предлагает Duplicate/Rename/Delete; last-view delete и actual duplicate/delete UI unverified. |
| E31 | observed: 20 view tabs и длинный Unicode rename при 1024×720; выбранный tab и Add View находятся внутри viewport, 20 видов/active view сохранились после reload (`views-20-1024x720.jpg`). |
| E32 | observed: panel и expanded при 1024, restore в боковую панель, close в верхней строке; скриншоты `panel-1024x720.png`, `expanded-1024x720.png`. |
| E33 | observed: два и более instance одного Workspace App в tabs; разные tab instances, данные проекта общие по контракту. |
| E34 | observed: 12 текстовых project tabs при 1440 и 1024; после resize активная вкладка в видимой области (`overflow-after-1024x720.png`, geometry JSON). |
| E35 | observed: close последнего активного выбирает предыдущий tab; first/middle/inactive UI unverified, reducer tested. |
| E36 | observed: Restore удаляет один tab instance и открывает side panel при оставшихся дубликатах. |
| E37 | inspected: existing reorder handlers сохранены; pointer DnD UI unverified. |
| E38 | inspected: activation threshold и drag constraint сохранены; edge/cancel UI unverified. |
| E39 | tested: workspace session serialization/recovery; restart UI unverified. |
| E40 | baseline observed: sidebar collapse/restore; inspected после изменения — скрытое содержимое inert, кнопка Show sidebar доступна; повторный UI проход unverified. |
| E41 | observed: Settings, roles и path при 1024/1440; native chooser/cancel/deep tree unverified, их не открывали на тестовом fixture. |
| E42 | inspected: workspace rename/delete/reorder handlers сохранены; mutation UI unverified в read/select harness. |
| E43 | observed: Customize menu и context menu view при 1024; последнее имеет bounds x555–779/y23–145 внутри viewport. Nested/popover scroll UI unverified. |
| E44 | observed verifier: Return открывает Customize и Escape возвращает focus trigger; nested Escape отдельно unverified. |
| E45 | inspected: shared inactive outside-dismissal не менялся; pointer pass-through UI unverified. |
| E46 | observed verifier: Tab переводит focus на Customize, Return открывает, Escape закрывает с возвратом focus; полный Shift+Tab/Space/card flow unverified. |
| E47 | observed verifier: icon-only Customize/Add View в верхней строке, прозрачный default фон, названия/tooltip в AX и 2px purple focus; hover/disabled/busy state UI unverified. |
| E48 | observed: русский текст в native AX и английский в браузерном fixture; IME composition unverified. |
| E49 | observed: file tree с одним файлом в detail; empty/deep/unavailable UI unverified. |
| E50 | inspected: Sonner слой не менялся; toast за panel/menu UI unverified. |
| E51 | observed: Board при 1440×960 и 1024×720, Table/panel/expanded/Settings/search и 20-view/editors stress при 1024×720; raster размеры проверены. |
| E52 | unverified после внедрения: 800×720 ниже целевого desktop min; baseline screenshot в исходной матрице. |
| E53 | unverified: zoom 125/200% и OS scaling в этой попытке не запускались. |
| E54 | observed: native Electron AX показал русские toolbar/tabs и Table; native CUA screenshot получен во втором запуске, сохранена только миниатюра 118×167. Размер окна и titlebar/traffic-light hit testing unverified. Первый ScreenCaptureKit вызов возвращал `-3811`, повторный успешен. |
| E55 | measured (WCAG sRGB): foreground/background 15.28:1, muted/background 5.75:1, primary/background 6.07:1, destructive/background 6.26:1, input/background 3.05:1; focus ring `#6544D5` и текстовые Status labels. High Contrast OS unverified. |
| E56 | observed: no-search текст переносится в ограниченной ширине; long error/offline recovery UI unverified без fault injection. |

### Следующие проверки для неполного покрытия

- E01–E07, E09–E10, E14–E15, E50, E56: создать отдельные temporary roots и управляемые fault/latency scenarios для пустого source, save/load errors, stale paths, duplicate names и stress; повторить UI и сохранить снимки. Текущий read/select fixture воспроизводил только populated состояние.
- E13, E17–E19, E22–E26, E28, E30–E31, E35, E37–E38, E42, E49: расширенный **только изолированный** harness уже проверил long view name, 20 views и пять типов property editor. Для оставшихся подпунктов создать long project name, 1000-символьный Text, 50 options/20 chips, deep tree и пройти подтверждения, reorder, разные позиции закрытия вкладок. Эти состояния не возникали в текущем fixture.
- E40, E43–E48: повторить после внедрения полный pointer/keyboard проход с tab/shift-tab/Enter/Space/Escape, краевыми меню, outside click, IME и disabled/busy; записать focus/hover screenshots. В текущем прогоне зафиксированы базовые controls и часть меню.
- E41, E53–E55: повторить на native Electron host chooser/scale/High Contrast и titlebar hit testing. Native AX и миниатюра получены при повторном запуске, но размер окна и OS controls не измерены.

## Артефакты и проверки

Скриншоты, геометрия вкладок, диагностический harness, fixture path и логи находятся в [run](../../work/task-loop/compact-implementation-2026-09-21/run/). Browser harness использует только временные source/config и явный allowlist read/select/mutation API; рабочие данные пользователя не затронуты. Native Electron подтвердил AX, во втором запуске CUA дал миниатюру `native-electron-thumbnail.png` (118×167); она не доказывает целевой размер окна. Все файлы с расширением `.png` перекодированы в PNG, новые дополнительные browser captures сохранены как `.jpg`. [Наблюдения попытки 2](../../work/task-loop/compact-implementation-2026-09-21/run/attempt-2-ui-observations.json). Исходная матрица содержит baseline evidence до изменений.

После исправлений попытки 2 пройдены `npm test` (200/200), `npm run typecheck`, `npm run build:renderer` и `git diff --check` (exit 0). Логи: `npm-test-attempt-2.txt`, `typecheck-attempt-2.txt`, `build-renderer-attempt-2.txt`, `diff-check-attempt-2.txt` в run. Проверено, что пять итоговых PNG с названиями `*-final-*` имеют размеры 1440×960 или 1024×720 согласно имени и реальные PNG bytes; новые `*.jpg` имеют JPEG bytes. Независимый verifier подтвердил quality и browser outcome для замороженной попытки 2 в [отчёте](../../work/task-loop/compact-implementation-2026-09-21/run/verifier-attempt-2/report.md). Локальный коммит реализации: `9186024` (`Implement Compact workspace redesign`). Push/merge/release не выполнялись.
