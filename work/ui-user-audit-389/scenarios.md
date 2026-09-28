# Матрица пользовательских сценариев

`passed` означает только конкретный наблюдённый результат в указанном контуре. `blocked` включает непроверенные части обязательного объёма после отказа native инструмента; это не положительный результат. Browser не заменяет Electron. Сценарии выполнены мышью/клавиатурой CUA, без вызова reducer/service в обход UI (исключение — заранее созданные тестовые данные).

| ID | Сценарий | Native Electron | Дополнительный browser | Наблюдение/evidence |
|---|---|---|---|---|
| S01 | Старт populated Board без details | passed AX | passed | Alpha/Beta/длинный/Gamma/Empty,3status; native fileURL текущего checkout |
| S02 | Board→Alpha→Notes edit→Tab | passed AX | passed text отдельно | [Native Detail](evidence/native-detail-ax.txt); Audit note389 появился на Board/Table |
| S03 | Board↔Table с сохранением search | passed AX | passed | [Alpha search Table](evidence/table-search-alpha.txt) |
| S04 | Search no match / очистка | passed AX | — | [Empty search](evidence/search-empty.txt), после очистки5проектов |
| S05 | Customize Columns→Active filter→Escape | passed AX | — | [3Active строки + filter indicator, фокус trigger](evidence/table-filter-active.txt) |
| S06 | Открыть пустое Notes поле | failed accessibility | failed accessibility | UI389-01; editor открыть можно, trigger без имени |
| S07 | Text: Escape отмена / Tab сохранение | blocked полный цикл | passed | Beta text после Escape отсутствует, повтор+Tab сохраняет; [сохранённое значение](evidence/browser-beta-open-control-after-close-ax.txt) |
| S08 | Number creation/expression/reopen | blocked | passed | UI created Number, `=2+3*4`→14→reopen исходное выражение; [14в split](evidence/browser-beta-open-after-split-ax.txt) |
| S09 | Date/Select/Multi-select | blocked | passed основные edit цепочки; errors/цвета не проверены | UI create Date→30September→reopen `2026-09-30`; Select create Urgent; Multi create Red+Blue→removeRed. [Date](evidence/browser-date-reopen-ax.txt), [2values](evidence/browser-select-multiselect-values-ax.txt), [итог](evidence/browser-properties-completed.jpg) |
| S10 | Alpha Open in split | passed AX | passed | Сохраняет Board/Table, Alpha отдельная область, Navigation справа |
| S11 | Split maximize→restore | passed AX | — | Отображался Restore split; возврат Board+Alpha+Navigation; native tool outputs, отдельный screenshot непригоден |
| S12 | Close primary→Settings→Back→Table | passed AX | — | [Settings после закрытия primary](evidence/settings-light.txt), [Table](evidence/table-search-alpha.txt) |
| S13 | Повторное открытие/Expand Alpha | passed частичная цепочка AX | — | [expanded Alpha](evidence/expanded-alpha-repeat.txt); уникальность нового tab при expand отдельно не подтверждена |
| S14 | Tab context Duplicate | passed AX | — | [2Alpha instances](evidence/duplicate-alpha.txt) |
| S15 | Фоновая close button / reopen CmdShiftT | passed AX | — | [Reopen](evidence/reopen-keyboard.txt); active сохранялся при close фоновой |
| S16 | CmdW active→сосед→last→Table | passed AX | — | [last-close Table](evidence/last-tab-close.txt) |
| S17 | Middle-click | blocked, tool ambiguity | blocked, не выполнено | [после native middle](evidence/middle-close-inactive.txt), H02 |
| S18 | Close-other/right, launcher/repeat/reopen, overflow/reorder | blocked | passed launcher/repeat/excluded-reopen/close-other; close-right/overflow/reorder не выполнены | CmdT twice→1blank, close blank→CmdShiftT не восстанавливает blank согласно контракту; Duplicate→Close other исходного оставляет исходный выбранным. [launcher](evidence/browser-launcher-close-reopen-ax.txt), [close-other](evidence/browser-close-other-ax.txt) |
| S19 | Split keyboard Right | blocked native focus ambiguity | passed | splitter50→52, screenshot затем drag; native click splitter не подтвердил focus |
| S20 | Pane header edge move | blocked | passed | Alpha header из правой области перемещён в верхнюю; [результат](evidence/browser-pane-drag.jpg) |
| S21 | Center swap/nested3+/pointer resize/maximized drag/close разных leaves | blocked | blocked, не выполнено | Не подменено pure transition тестами |
| S22 | Открыть Beta после split | blocked | failed | UI389-02, [минимальный repro](evidence/browser-board-beta-open-no-drag-ax.txt) |
| S23 | Reload persistence | blocked real restart | passed расположение; H01 дерево | [после reload](evidence/browser-beta-open-after-reload-ax.txt): Alpha сверху/Table снизу, properties сохраняются; file tree0 требует исследования |
| S24 | Add Workspace/switch/back retains Table | blocked | passed | Создан второй Workspace, при возврате Operations выбран Table и Beta text сохранён |
| S25 | Settings appearance System→Light | passed AX | passed Light/Dark | [native Light](evidence/settings-light.txt), [browser4captures](README.md) |
| S26 | Settings folder roots initially collapsed | passed AX | passed | Active/Done/Waiting, дочерних folder rows нет; роли Status |
| S27 | Settings role edits/language/native chooser cancellation | blocked | blocked, не выполнено | Нет изменения реальных source folders |
| S28 | Settings layout с Navigation | blocked visual | failed | UI389-03, обе темы и оба размера |
| S29 | File disclosure docs→notes.txt | blocked | passed | CUA AX docs expanded→notes.txt. Открытие файла внешним приложением не проверено |
| S30 | Sidebar collapse/resize, navigation back/forward | blocked | passed collapse/restore/back/forward; resize не выполнен | Hide sidebar→Show sidebar→restore; Back to workspace→Back возвращает Settings→Forward возвращает Board. [журнал](evidence/browser-additional-actions.txt) |
| S31 | Focus/Tab/Escape | passed ограниченно AX | passed ограниченно | Escape filter возвращает trigger; CmdW возвращает Table; native видимость focus не проверена |
| S32 | Outside dismiss, dialog confirm/cancel, hover/tooltip | blocked | passed popup Escape/outside; отдельные dialogs/hover/tooltip не выполнены | Date Escape возвращает trigger. Multi picker→снять Red→первый click Table закрывает popup, Board остаётся выбранным; второй Table активирует. [AX](evidence/browser-outside-dismiss-ax.txt). Полная accessibility не утверждается |
| S33 | Empty/loading/error/disabled | passed search-empty и disabled back/forward; остальное blocked | ограниченно empty files, H01 | Нет injected save/network errors; loading geometry не подтверждена |
| S34 | Light/Dark1440×960/1024×720 realElectron | blocked | отдельные4captures, visual defects | Native thumbnail250×290 + ScreenCaptureKit-3812; [ограничение](evidence/native-tool-limitations.txt) |
| S35 | Сравнение с bb0.44 | blocked | blocked | Reference matrix прочитана; эквивалентный live comparison не выполнен |

Нужное продолжение: восстановить Computer Use доступ к реальному Electron, повторить browser-only дефекты там, завершить native S09/S17–21/S23/S27/S30–34 и неполные части строк. Аудит пока checkpoint, не завершённая UI-приёмка.
