# workspace-jqv — независимый review частичного native after

Этот review обновляет прежний [checkpoint](resume-final-review.md): after изображения теперь существуют для Table и раскрытого sidebar/shell. Полная приёмка остаётся незавершённой. CUA/native ownership у executor; reviewer независимо просмотрел сохранённые PNG через image viewer, своих native actions не выполнял.

## Наблюдённый результат

Просмотрены [Light 1440×960](../after/native-light-1440x960-table.png), [Light 1024×720](../after/native-light-1024x720-table.png), [Dark 1440×960](../after/native-dark-1440x960-table.png), [Dark 1024×720](../after/native-dark-1024x720-table.png), валидные before Table Light1440/Dark1024 и ранее просмотренный live bb shell. [Native report](../after/partial-native-report.json) связывает все четыре PNG с test Electron PID73610, window2541, именем Workspace, onscreen CG bounds и фактическими пикселями требуемых размеров. Тема и активный Table также записаны.

На этих изображениях:

- Toggle расположен рядом с traffic lights, history — у trailing sidebar edge; видимого перекрытия OS controls нет в обоих размерах.
- Настройки сведены к нижнему icon action, заголовок Workspaces тише, sidebar selection и главные tabs имеют согласованные нейтральные состояния.
- Table лишён прежней большой закруглённой внешней рамки, воспринимается одной рабочей плоскостью; заголовки/вертикальные разделители/последний separator согласованы.
- При 1024×720 видны Add View, Customize и add-property action; текущие короткие имена/три строки не обрезаны. Light/Dark сохраняют читаемую иерархию.

Просмотренный shell/table визуально согласуется с живым Light bb по расположению controls и спокойной общей композиции. Table — Workspace продуктовая поверхность, прямого bb Table reference нет. Размеры sidebar320/header48 и toggle84×10/28×28 подкреплены [shell metrics](../after/shell-metrics.json), но вывод основан также на изображениях. Новых видимых дефектов в этих четырёх состояниях не обнаружено.

## Exact source и пределы

HEAD остаётся `97f44c0798d59049d88122054f0b524e8785ef45` плюс integration diff на `codex/workspace-jqv-live-bb-visual`. Все15 manifest SHA256 повторно совпали; продукта после source review не меняли. Программные checks и исправленные width/docs findings остаются действительными.

Критерий1 имеет настоящие bb reference, но own live bb review/stale user runtime остаются неопределёнными. Критерий2 теперь частично подтверждён визуально для Table/shell; Board/settings/project/menu after отсутствуют. Критерий3 выполнен только для статического Table/shell четырех size/theme состояний. Keyboard/focus/disabled/hover/selected/submenu/Escape/outside click/portal bounds/long names/native sidebar restore не наблюдались. Критерий4 имеет green программную часть и source preservation, но полного native behavior прохода нет. Критерий5 не принят: нет конечной полной независимой визуальной приёмки и scoped implementation commit на момент этого отчёта.

Вердикт: **полная проверка заблокирована**, частичные Table/shell состояния визуально пригодны. Scoped проверенный незавершённый milestone можно сохранить локально; закрывать задачу по этому evidence нельзя. AppleScript/native screenshot авторизованы пользователем только для test Electron foreground/capture; отдельное разрешение на fixture UI input пока ожидается, reviewer не выполнял неразрешённых действий.
