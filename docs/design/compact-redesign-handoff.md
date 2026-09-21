# Compact: спецификация редизайна для агента

Статус: дизайн-контракт Compact №3, реализован в ветке `codex/compact-redesign`; [отчёт о проверке](compact-implementation-review.md) перечисляет подтверждённые сценарии и ограничения. Основа — выбранный пользователем Compact №3 и последняя доработка верхней строки. Цель: спокойный светлый интерфейс с плотностью рабочего инструмента при сохранении функций, данных и доступных действий. PNG иллюстрируют композицию, но не являются источником бизнес-поведения или точных размеров.

## Входы и порядок доверия

1. Текущая задача пользователя и этот контракт определяют визуальное направление.
2. Фактические компоненты, service contracts и проверенные сценарии определяют существующие функции. Не переносить из изображения несуществующие действия.
3. [PRD](../prd.md), [UI guidelines](../ui-guidelines.md), [интерфейс](../interface.md), [архитектура](../architecture.md), [модель данных](../data-model.md), [properties API](../api/workspace-properties.md), [views API](../api/workspace-views.md) сохраняют продуктовые ограничения. В существующих guidelines тёмная тема обозначена текущей; светлая палитра ниже — выбранное новое направление, а не описание сегодняшнего runtime.
4. Визуальная основа: [Compact Board](../../outputs/compact-toolbar-2026-09-21/01-compact-board.png), [expanded project](../../outputs/compact-toolbar-2026-09-21/02-compact-expanded.png). Не использовать ранний Board с кнопками создания проектов и меню колонок/карточек: эти элементы были ошибкой макета.
5. [Матрица краевых случаев](compact-edge-matrix.md) — обязательный реестр покрытия и оставшихся проверок. «Все» означает все известные поверхности и перечисленные классы рисков, не все возможные комбинации данных/ОС.

## Неизменяемые границы

Проекты выводятся из папок; не добавлять Create project, карточечные меню или перенос между основными Status. Name и Status — системные: допускается переименование display label, но не изменение id/type/derived values или удаление. Name обязателен в view, Status можно скрывать по существующей модели. Удаление Workspace не удаляет файлы. ID проекта — непрозрачная стабильная идентичность; путь — locator. Одинаковые имена не объединять.

React остаётся тонким: `WorkspaceServiceClient` → preload IPC → backend. Не импортировать filesystem/backend/sidecar в renderer. Не менять storage, миграции, folder roles, контракты, security `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Текущий Electron подключает IPC; архитектурная запись о runtime без preload устарела и не является основанием удалить bridge. Диагностический браузерный harness не заменяет проверку packaged/native Electron.

Редизайн не разрешает новую theme toggle, автоматическое создание/repair папок, новые фильтры, новые команды восстановления, новую виртуализацию или изменение сохранения. Визуальные баги чинить в рамках layout; дефект существующего поведения записать отдельно, не маскировать новым UI обещанием.

## Целевые токены (proposed, проверить при реализации)

Использовать существующие semantic CSS variables и shadcn primitives, без новой UI-библиотеки. Не переписывать primitives ради одного экрана. Светлый фон `#FAFBFD`, поверхность `#FFFFFF`, sidebar `#F4F5FA`, subdued `#EEF0F6`, основной текст `#192238`, вторичный `#59647A`, граница `#D9DFEA`, accent `#6544D5`, выбранная вкладка `#EEE8FF`, destructive `#B42338`. Цвета статусов/Select брать из данных, не заменять фиксированным жёлтым/синим/зелёным из PNG. Проверить контраст реальными измерениями: обычный текст ≥4.5:1, крупный ≥3:1, значимые controls/focus ≥3:1; эти значения здесь требования, не отчёт измерений.

Geist Variable, интерфейс 13px/20px, вторичные labels/chips 12px/16px, заголовок проекта 20px/28px, section heading 13px medium. Основные имена/значения/tabs regular. Spacing 4/8/12/16/24px, radii controls6/cards8/panels10px, border1px. Table/property rows min36px, file rows28px, cards min48px и высота по содержимому. Не уменьшать существующие hit targets: glyph16px внутри области минимум32×32px. Не переносить крупные размеры текста из растрового макета буквально.

## Композиция и переполнение

- Один app shell, без внешнего page scroll. Sidebar и рабочая область имеют собственный overflow; `min-width:0`, `min-height:0` на flex/grid дочерних контейнерах обязательны. Sidebar ориентир248px, компактное состояние сохраняет существующее поведение toggle. Не принудительно менять пользовательское состояние collapse при resize.
- Верхняя строка main ориентир48px, одна линия: существующие view tabs → разделитель → project tabs → закреплённая справа группа контекстных действий. Название Workspace достаточно в sidebar; не создавать второй title/toolbar этаж. На macOS не перекрыть native traffic lights и drag region; controls — `no-drag`.
- Board active: Add View `+` и Customize Columns `sliders` без текстовой подписи. View actions доступны через существующее context menu на вкладке; отдельный `…` в PNG не является существующей toolbar кнопкой и не требуется к реализации. Если существующие действия вынесены в другие context menus, сохранить их handlers/доступ, не приписывать новый функционал иконке. При выбранном проекте (side panel и expanded) view actions скрыты/inert по существующей модели; restore и close справа той же строки. Board/Table и имена проектов остаются текстовыми.
- Верхние action icons: прозрачные default/hover/pressed фон и border, без плашки/тени; курсор и tooltip допустимы. **No hover background не означает no focus**: `focus-visible` контрастное кольцо2px с offset2px, disabled семантически отключён и визуально приглушён, loading не допускает повторной мутации. Не удалять focus outline глобально и не отключать hover у остальных меню/строк.
- При нехватке ширины сначала ограничить имена tabs (120–200px, ellipsis + полное accessible name/tooltip); группа действий не сжимается и не переносится. View/project tabs используют горизонтально прокручиваемые области, активная вкладка видима после выбора/создания/закрытия. Нельзя скрывать Close/Restore за пределами viewport. Разделитель различает два типа вкладок даже при overflow. Не вводить несуществующий overflow dropdown только ради макета; существующий scroll — базовый вариант.
- Board columns: минимальная ширина288px, фактический default384px, persisted maximum1600px; ограничение нового выбора одной третью рабочей области по существующему helper. Сохранённая ширина не уменьшается при resize; hscroll вместо растягивания/сжатия. Фильтр убирает исключённые группы без расширения остальных. Пустые видимые статусы остаются; No status поддерживается.
- Table: стабильные ширины и горизонтальный scroll; Name не исчезает. Wrapped Text расширяет высоту строки, а не ширину колонки. Без wrap — компактный cell-width popover. Сохранить существующие pointer resize/reorder колонок; sticky columns не вводить без отдельного решения.
- Side panel: сохранять существующий nonmodal dialog, resize и focus management; сохранённая ширина/ограничения имеют приоритет над PNG, существующий max calc(100vw - 6rem), внутренний scroll, заголовок и close доступны. Expanded — в основной области, sidebar не исчезает. Properties перед File tree, без дублирования Name в properties. Скрытые свойства не теряют editing/menu/reorder.
- Menus/popovers: ограничить viewport, collision handling существующего primitive; длинные имена truncate/wrap внутри max-width, длинный список scroll. Не лечить перекрытия произвольными z-index. Toast не должен блокировать верхние actions или ввод.

## Состояния и взаимодействия

На любой поверхности различать первоначальную загрузку, загрузку после изменения, пустое содержимое, пустой результат фильтра и ошибку. Не показывать «нет проектов» до окончания загрузки. Сохранять стабильные размеры skeleton; при refresh не сбрасывать выбор/скролл без причины. Если сейчас нет retry action — не рисовать работающий Retry; использовать существующий переход Settings/повтор операции и записать требуемое развитие отдельно.

Ошибка сохранения: не показывать success, оставить доступное сообщение рядом с контекстом/существующий toast и рабочий путь повторения. Не обещать offline queue/undo/recovery, которых нет. Ошибка source/path/storage не должна предлагать обход filesystem sandbox. Длинное сообщение/путь переносится, не раздвигает shell. Stale/missing selected project/tab корректно обрабатывается текущими reducers; замена дизайна не должна менять identity.

Tab instances: обычный клик проекта открывает side panel; Expand создаёт экземпляр project tab. Один проект может иметь несколько экземпляров. Board/Table остаются view navigation, project tabs — другой набор. Duplicate/Restore/Close и drag reorder сохраняют семантику и session persistence. Выбор после закрытия активной вкладки определяет `App.tsx:542–553`: предыдущая слева, иначе возврат к view; это code-inspected, а не доказанный reducer suite selection test; проверить первый/последний/неактивный/дубликат отдельно. Restore удаляет только соответствующий экземпляр и возвращает side panel. Переключение Workspace не переносит tabs чужого workspace.

Доступность: keyboard activation карточки/строки, Tab/Shift+Tab, Escape и возврат focus после overlay; accessible names icon buttons и заголовки Sheet/Dialog. Порядок focus соответствует visual order. Не кодировать selection/error/status только цветом. Существующий outside-click dismiss сначала закрывает меню, не активирует нижележащий control. DnD клавиатурой проверять отдельно от pointer; наличие drag handle не доказывает keyboard support. Если существующей альтернативы нет, отметить gap, а не обещать её как уже работающую.

Редакторы: сохранять transient draft/commit/cancel и validation существующих компонентов. Text — multiline, ручные переносы; Numbers — число или выражение с `=`, результат вне edit, исходник при edit; Date — существующий формат/локаль и clear; Select/Multi-select — пустое blank, chips, picker, direct chip menu rename/delete/color, повторный клик закрывает menu, клик вне chip открывает picker. Не превращать Status в editable dropdown. Delete property/value — существующие подтверждения/последствия, не только косметическое исчезновение строки.

## План реализации для следующего агента

1. Прочитать AGENTS, этот документ и матрицу; проверить checkout/status. Создать отдельную `codex/compact-redesign` ветку, если текущая не предназначена для реализации. Не трогать live `.workspace`. Зафиксировать текущие tests и UI captures на отдельном fixture.
2. Сверить action map с актуальным исходником. Зафиксировать исходные state transitions и handlers. Если код изменился после аудита, обновить evidence; не считать этот документ универсальным снимком будущего HEAD.
3. Ввести scoped semantic palette/spacing, сохранить компоненты и контракты. Обновить shell/sidebar и единую верхнюю строку; проверить длинные/многочисленные tabs до остальных поверхностей.
4. Перенести Board/Table/Sheet/expanded/Settings/editors/menus/dialogs/toasts на общие токены. Сохранить существующие event handlers и persistence. Не переписывать App business orchestration ради стиля.
5. Пройти матрицу: обычные и неприятные данные, все property types, ошибки, tab lifecycle, локаль, 1440×960 и1024×720. Узкий800px — stress; native minimum сейчас1024. Electron принудительно zoom1; 125/200% browser zoom — диагностический stress, поддержка native zoom требует отдельного решения.
6. Исправить visual regressions, провести независимый review по function parity и screenshot comparison. Затем targeted Node tests, `npm run typecheck`, `npm run build:renderer`, `git diff --check`. Backend/Go checks нужны только при фактическом изменении соответствующей границы; такое изменение не входит в редизайн автоматически. Документационный аудит сейчас не требует build.
7. Обновить UI docs фактическим новым дизайном и описать непроверенное. Коммитить проверенные intended changes по AGENTS. Не push/merge/release без авторизации.

## Приёмка реализации

- Ни одно существующее действие не потеряно; ни одного действия создания проекта, изменения derived Status или переноса между основными группами не добавлено.
- View и project tabs видны/достижимы при overflow; toolbar строго в одной строке, без labels и hover backdrop у верхних actions. Focus и accessible names остаются.
- Данные и persistence до/после совпадают за исключением намеренно изменённых fixture view prefs. Работающие проекты/история/IDs/paths не мигрируются.
- Нет обрезанных названий без способа прочитать полное имя, скрытого close, скачущих ширин колонок, выпадения popup за viewport, неверных success/empty состояний.
- Все строки матрицы имеют проверенный результат или конкретную непроверенную причину и следующий шаг. Ни code-inspected, ни passing unit tests не заменяют UI observation.
- Сделать парные captures обычного Board, Table с wrap, panel, expanded с overflow, Settings, empty/error/menu на двух desktop размерах; клавиатурные сценарии и контраст измерить отдельно.

## Готовый запрос агенту

> Реализуй выбранный Compact редизайн по `docs/design/compact-redesign-handoff.md` и `docs/design/compact-edge-matrix.md`. Сначала прочитай AGENTS и актуальный код; используй PNG только как визуальную основу. Сохрани все существующие функции и доступ к ним, service/storage/security contracts и рабочие данные. Верхние Add View/Customize/существующие actions — в одной строке с view/project navigation, icon-only без hover фона, с accessible names и keyboard focus. Не добавляй выдуманные controls. Работай на изолированных fixtures, пройди матрицу состояний и размеры1440×960/1024×720, сообщай отдельно observed/tested/unverified. Исправь layout, проведи релевантные tests/typecheck/build и независимый review, обнови UI docs, сделай локальный commit. Не push/merge/release. Новые функции, изменение storage и native zoom не входят в этот этап; при обнаружении необходимости сформулируй конкретный отдельный вопрос, продолжая независимую работу.

## Карта действий и файлов

Сохранять handler/API каждого перечисленного действия; cosmetic relocation не означает перенос ответственности между слоями. Детальные source:line в [инвентаре](../../work/task-loop/compact-design-handoff-2026-09-21/run/source-inventory.md).

| Файл | Сохранить действия и состояния | Допустимая работа |
|---|---|---|
| `src/styles.css`, `src/components/workspace/menu-styles.ts` | Semantic tokens, общие меню/checkbox/destructive/focus | Палитра, плотность, общие presentation tokens |
| `src/App.tsx` | Loading/error/pending/stale guards, workspace selection, source/services, selectedProject, tabs | Shell/layout и размещение существующих controls; не rewrite orchestration |
| `left-panel.tsx` | Add workspace, search, select, rename/delete/reorder, collapse, Settings | Плотность/sidebar overflow, доступные icon names |
| `view-tabs.tsx` | Board/Table select, add view, rename/duplicate/delete/reorder, last-view protection, Customize | Одна строка, icon-only action triggers, no-hover; contextual hidden/inert |
| `project-tabs.tsx` | Select/duplicate/restore/close/reorder по instance ID | Читаемый overflow, active/focus, no loss of tabs |
| `board-view.tsx` | Card open, inline custom editing, status grouping, two-axis scroll | Compact cards и стабильные колонки; без новых menu/add/DnD |
| `table-view.tsx` | Row open, inline editing, property add/menu, column resize/reorder, wrap/filter/hide | Stable grid, overflow, editor geometry |
| `project-detail-panel.tsx` | Resize/expand/restore/close, visible+hidden properties/reorder/CRUD, file expand/open | Panel/expanded layout, compact headers/rows; nonmodal contract |
| `property-controls.tsx`, `view-filter-menu.tsx` | Rename/hide/show/delete protected/custom props, filters/value visibility | Согласованные меню и scroll |
| `text-value-editor.tsx`, `number-value.ts`, `date-value-editor.tsx`, `select-value-editor.tsx` | Все5 типов, commit/cancel/validation, option CRUD/color/search/clear | Presentation и доступность, не normalization |
| `settings-view.tsx`, `states.tsx` | Source chooser, roles, status colors, locale; source empty CTA | Читаемое дерево/формы/loading/error |
| `menu-dismissal.ts`, `src/components/ui/*` | Outside click consumption, overlay semantics | Переиспользовать; менять shared primitive только при доказанном дефекте |
| `src/workspaceProjectTabs.js`, `src/workspaceProjectSession.js`, `src/workspaceBoardLayout.js` | Reducers/session/width contract | Контрольные references/tests, изменение поведения вне визуального scope |
| `electron/main.js`, `electron/preload.cjs`, `electron/workspaceIpc.js`, backend/sidecar | Window min/zoom/security/IPC/filesystem/storage | Не менять в этом редизайне |

Два известных UX gap для реализации: (1) пустой поиск сейчас даёт пустую доску без пояснения — добавить только информативный текст в существующий empty branch; (2) много project tabs становятся одинаковыми иконками — предпочтительно сохранить текст с горизонтальной прокруткой. Это **proposed изменения presentation**, не свидетельства о существующем поведении. Не вводить новые команды/сохранённые настройки для их решения.
