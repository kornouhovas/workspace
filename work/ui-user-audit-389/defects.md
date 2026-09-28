# Дефекты

Приоритеты: P2 — значимо мешает рабочему сценарию, есть обход; P3 — локальное неудобство. Ни один пункт не заявлен как подтверждённое расхождение с bb0.44: здесь проверялись собственные контракты Workspace. Browser-only означает наблюдённый дефект renderer в дополнительном контуре; воспроизведение в Electron ещё требуется.

## UI389-01 — пустые ячейки Table не имеют доступного имени

**P2, accessibility; подтверждено native AX и browser AX.** При клавиатурной/ассистивной навигации несколько пустых редактируемых значений представлены одинаковым безымянным `pop up button`; по самому control невозможно понять свойство/проект. Number показывает аналогичный безымянный `button` в browser. Нарушает требование подписанных form controls в UI guidelines. Полный тест VoiceOver не проводился; описан именно факт AX, а не проверенная речь screen reader.

Предусловия: fixture, Table, видимое Notes с пустыми значениями Beta и длинного проекта.

1. Открыть Table.
2. Перейти к пустой Notes ячейке Beta (мышью или Tab).
3. Проверить доступное имя. Открыть редактор и сравнить его имя `Notes: Text`.
4. Закрыть редактор; повторить для другого пустого значения.

Ожидание: control имеет имя наподобие «Edit Notes for Project Beta», даже когда содержимое пустое. Факт: `pop up button` без имени. В Detail соответствующий control назван `Edit Notes value`.

Воспроизводимость: два native снимка в разное время и независимая browser fixture. Доказательства: [native Table после фильтра](evidence/table-filter-active.txt), [native Table после закрытия последней вкладки](evidence/last-tab-close.txt), [browser Table](evidence/browser-table-empty-ax.txt), [визуальный контекст](evidence/browser-dark-table-1440x960.jpg). Причина в исходниках не исследовалась. Обход для зрячего пользователя — ориентироваться по столбцу/строке; полноценного accessibility обхода не подтверждено.

## UI389-02 — при открытом split клик другого проекта не открывает его детали

**P2, функциональность, browser-only.** Блокирует последовательную работу с несколькими проектами; после закрытия split открытие снова работает. Потери данных не наблюдались.

Предусловия: browser fixture38913, Workspace с Board или Table и минимум Alpha/Beta. Один и тот же сервер и tmp root на протяжении проверки; fixture не пересоздавалась. Sidebar и fixed Navigation открыты.

Минимальные шаги (повторены во втором Workspace без drag):

1. Открыть Project Alpha из Board.
2. Нажать `Open in split` в right panel.
3. Нажать карточку Project Beta на Board.

Ожидание: открываются детали Beta в независимой side panel, существующий split Alpha сохраняется. Факт: фокус на Project Beta, но остаются Alpha и Navigation; Beta detail отсутствует. Название Navigation меняется с Alpha на Workspace, что подтверждает обработку действия, однако нужное содержимое не появляется.

Первое воспроизведение: Table→Alpha→split→перенести header Alpha к верхнему краю рабочего Table→два клика Beta. После reload тот же результат. Затем воспроизведено минимальными шагами в другом Workspace без drag. Контроль: закрыть Alpha split через `Close pane`, снова нажать Beta — Beta открывается.

Доказательства: [после клика Table](evidence/browser-beta-open-after-split-ax.txt), [видимый фокус Beta и отсутствие details](evidence/browser-beta-open-after-split.jpg), [после reload](evidence/browser-beta-open-after-reload-ax.txt), [минимальное Board воспроизведение без drag](evidence/browser-board-beta-open-no-drag-ax.txt), [контроль после Close pane](evidence/browser-beta-open-control-after-close-ax.txt).

Воспроизводимость: два Workspace, Board/Table; повторные клики, reload. Обход: закрыть существующий split. Причина не установлена; renderer state/selection — гипотеза. Native воспроизведение заблокировано CUA, поэтому Electron влияние не утверждается как проверенное.

## UI389-03 — Settings с открытой Navigation сжимает/перекрывает folder roles

**P2, читаемость и управление, browser-only.** Нельзя уверенно сопоставить видимые Group/Status/Project кнопки с именами папок. При1024×720 правая часть Settings почти целиком обрезана; Back to workspace пересекается с pane toggle. При1440×960 имена папок не читаются, Ready перекрывает Group.

Предусловия: fixture с Active/Done/Waiting; expanded sidebar320; fixed Navigation открыта примерно на половину рабочей области.

1. Открыть Settings при видимой Navigation (например, после Open in split и Close pane).
2. Установить Light; проверить1440×960 и1024×720.
3. Повторить с Dark.
4. Для контроля при1024×720 закрыть right panel.

Ожидание: Settings адаптируется к ширине своей области; имена/роли остаются читаемы и кликабельны без наложений. Факт: folder role section сохраняет двухколоночную компоновку при недостаточной ширине; названия исчезают из видимого пространства, Ready/role controls перекрываются. После закрытия right panel те же строки читаемы.

Воспроизводимость: обе темы и оба размера. Доказательства: [Light1440](evidence/browser-light-settings-1440x960.jpg), [Light1024](evidence/browser-light-settings-1024x720.jpg), [Dark1440](evidence/browser-dark-settings-1440x960.jpg), [Dark1024](evidence/browser-dark-settings-1024x720.jpg), [контроль right panel closed](evidence/browser-settings-control-right-closed.jpg). Скриншоты полноразмерные, соответствие размеров проверено `file` и визуально. Обход — закрыть Navigation. Native visual не проверена.

## Отдельные наблюдения, не включённые в подтверждённые дефекты

- **H01: file tree после browser reload показывает0items у Alpha.** До reload docs+README видны, после reload в двух последующих AX состояниях0items: [до](evidence/browser-beta-open-after-split-ax.txt), [после](evidence/browser-beta-open-after-reload-ax.txt). В том же непрерывном серверном процессе открытие Alpha через другой Workspace вновь показывает2items. Вероятна неполная загрузка дерева восстановленной split области, однако её загрузочный жизненный цикл отдельно не локализован; не считать доказанным storage/data-loss дефектом. Проекты/файлы на диске не менялись. Нужен отдельный повтор native и ожидание завершённой загрузки с сетевыми/сервисными доказательствами.
- **H02: native middle-click AX выбрал вкладку вместо закрытия.** Инструмент мог выполнить AX activation вместо мышиного middle event. Нужна полноразмерная native геометрия и координатный повтор. Не подтверждённый продуктовый баг.
- Native thumbnail и ScreenCaptureKit — ограничения инструмента, а не дефекты Workspace.
- `docs/interface.md` содержит прежние acceptance пункты про Table drag handle, которые противоречат более конкретному актуальному разделу Table без row drag. Это расхождение документа, не UI389 баг; документы в аудите не менялись.
