# Независимая приёмка workspace-jqv — предварительная матрица

Это план проверки, не acceptance. CUA принадлежит executor до явной передачи координатором. Проверка конечного runtime/снимков ожидает handoff.

## 1. Live bb действительно изучен: приложение/версия/тема зафиксированы, ключевые меню и общая композиция представлены реальными снимками и наблюдениями. Версия/runtime текущего Workspace проверена, возможный старый запуск локализован. Официальные Tailwind4/Radix страницы изучены, применимые решения и URL указаны; версии зависимостей сверены.

Проверка: Проверить bb bundle/version/theme и observed screenshots; current Workspace PID, загрузку built renderer/dev URL, соответствие source/build/runtime. URL и версии official docs/dependencies должны иметь конкретные выводы.

Вердикт: ожидает реализации и доказательств.

## 2. Есть конкретное визуальное сравнение bb/Workspace до/после с измерениями размеров/отступов/типографики/цветов/иконок меню и общих элементов. Все выявленные относящиеся к запросу существенные визуальные расхождения устранены или обоснованы различием продукта; прежняя геометрия не сохраняется только потому, что описана старым документом. Общие компоненты дают согласованный результат на затронутых экранах, а не только отдельном demo.

Проверка: Сопоставить изображения и измерения до/после одинаковых состояний; проверить согласованность меню Workspace/tab/view/filter/group/property/file и shell/sidebar/header/Board/Table/properties/settings. Product distinctions допустимы, исторические размеры не оправдание.

Вердикт: ожидает реализации и доказательств.

## 3. Измененный Workspace проверен в реальном Electron при 1440x960 и1024x720 в light/dark с временными данными: shell/sidebar, Board/Table, раскрытый проект, настройки и ключевые измененные меню/overlays. Снимки до/после одинаковых состояний и сравнения с live bb подтверждают результат. Проверены keyboard/focus, disabled/hover/selected, submenu/escape/outsideclick/portal bounds, длинные имена/переполнение; нет перекрытий macOS traffic lights/controls и обрезанных действий. Объем evidence соразмерен изменениям, старые passing checks не повторять без риска.

Проверка: В собственном Electron fixture проверить light/dark × 1440×960/1024×720. Shell, Board, Table, expanded project, global/workspace settings; key overlays, keyboard focus/Escape, hover/disabled/selected, submenu/portal bounds/inactive outside dismissal, long names and OS traffic lights.

Вердикт: ожидает реализации и доказательств.

## 4. Данные и существующие сценарии/source/roles/primary status drag, свойства/grouping/views/preferences/file operations сохранены; live bb и пользовательские folders/metadata не изменены. Relevant regression tests, npm run typecheck, npm run build:renderer, git diff --check прошли; остальные checks только по реально затронутым границам development/quality. UI документы отражают реализованный результат, исходный DESIGN_RULES.md не переписан ради удобства.

Проверка: Проверить scoped diff: security/service/JSON adapters unchanged, source/roles/status drag/history/IDs retained. Проверить actual completed relevant regression/typecheck/build/diff outputs и docs consistency; DESIGN_RULES hash unchanged. No bb setting/content mutations.

Вердикт: ожидает реализации и доказательств.

## 5. Независимый reviewer принимает визуальное сравнение с live bb и поведение на конечном интегрированном состоянии, не подменяя это token/test числами. Scoped локальный commit на новой codex ветке, чужие правки сохранены. Итог включает перечитанный Beads статус, commit, отчет и ссылки bb/до/после, ограничения/непроверенные критерии. Недоступное изучение live bb или обязательная визуальная проверка означает незавершенность, а не молчаливую замену прежним документом.

Проверка: Зафиксировать integrated source/file hashes, verdict per exact criteria and commit same-state, foreign dirty paths preserved. Read Beads final state. Criterion 5 остаётся pending до scoped commit/handoff.

Вердикт: ожидает реализации и доказательств.

## Сохраняемые функциональные контракты

WorkspaceServiceClient → preload IPC → backend; contextIsolation:true/nodeIntegration:false/sandbox:true. Active JSON adapters. Opaque IDs and source-scoped values/history; independent source bindings; role traversal; no drag between primary statuses. Board/Table projection and saved views, detail preview/expanded tabs/session persistence, property editors/grouping/filters, device language/theme, filesystem source validation.

## Прочитанные источники

AGENTS; docs/development/{README,rules,workflow,quality,product,architecture}.md; bb-workspace-policy; Interface; UI guidelines; PRD; Board/Table and settings/source/roles/language flows; accepted ADR002/005/006; prior work/workspace-6fh/{final-report,applicability}.md; package.json. Prior 6fh evidence only historical context: live bb was not inspected there.
