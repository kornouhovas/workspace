# workspace-jqv — независимый промежуточный source review

Это предварительная проверка интегрированного diff, не итоговая визуальная приёмка. CUA остаётся у executor; reviewer не управлял интерфейсом. Исторический `final-review.md` относится к checkpoint доступа.

Состояние: branch `codex/workspace-jqv-live-bb-visual`, HEAD `97f44c0798d59049d88122054f0b524e8785ef45`, незакоммиченный UI diff в 9 исходных файлах. Foreign task-loop/.ralphex/6fh изменения сохранены. Данные, service/storage, opaque IDs, роли и Electron security не изменены просмотренным diff.

## Проверенные материалы

Независимо просмотрены сохранённые native live bb shell/thread-menu/submenu/settings light и Workspace before Board/global settings/menu. Снимки показывают реальную прямоугольную композицию bb; прежняя Stage Manager диагностика больше не является единственным reference. Before Board/settings демонстрируют существенные различия: тяжелые фоновые Board lanes, full-width settings, иное расположение history/toggle и более широкое workspace menu. Новый source diff адресует эти различия, но его конечный внешний вид пока не наблюдён.

`before/dimensions.json` честно выделяет пять неподходящих для matched evidence изображений. Light Workspace menu/settings имеют 2048×1440 pixels при label 1440×960, light expanded project 1168×920, dark narrow menu 396×354 и dark large menu 2878×1920. Не считать их эквивалентными whole-window состояниями заявленных размеров. Валидные before снимки в остальных состояниях пригодны для дальнейшего сравнения.

## Конкретное замечание передано executor

Новый `w-max` в `workspaceMenuContentClassName` перебивает `w-60` у raw fixed property menu в `table-view.tsx`, потому что compiled CSS `.w-max` расположен после `.w-60`. Это не Radix Content с `cn()` merge. Его anchor clamp продолжает использовать `propertyMenuWidth = 240`; длинное custom property name может расширить меню за правую границу. Исполнителю предложено сохранить явно заданную ширину через `cn()` либо исключить shared `w-max` для вручную позиционируемых поверхностей. Требуется проверка длинного property name у края в narrow Electron.

## Остающиеся риски приёмки

- Native after четырёх size/theme комбинаций и собственный осмотр reviewer отсутствуют.
- Keyboard focus/Escape/outside dismissal, submenu portal bounds, disabled/selected/hover, native sidebar restore и traffic lights требуют runtime наблюдения после изменения header geometry.
- Bounded settings с широкими select и увеличенными padding нужно проверить в narrow host с открытой Navigation и длинными именами/путями.
- Shared меню property/group/filter/file и expanded project должны визуально согласоваться с общей переработкой. Source-only размеры не доказывают согласованность.
- `executor/regression.txt` пока содержит 20 pass / 1 fail старой structural geometry assertion; исполнитель обновляет исторические assertions. Итоговый завершённый зелёный log требуется перед принятием criterion 4.

Ни criterion 3, ни criterion 5 не приняты. Итог по всем пяти критериям ожидает corrected integrated state pack, completed checks, CUA transfer и scoped commit.
