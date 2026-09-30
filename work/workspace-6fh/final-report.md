# workspace-6fh — финальная реализация и проверка

Ветка `codex/workspace-6fh-design-application`; исходный HEAD `f29625597cd603beda42d4bee2d7b483fdb2b9f6`. Импортированный DESIGN_RULES.md сохранён: SHA256 `3b52eb4451902dc7e4363dd42dead1b8cf9b9f60e165e181efd415f79a797b2c`. Точное состояние исходников, production renderer и артефактов перечислено в [freeze-inventory.json](freeze-inventory.json).

## Результат по критериям

| Критерий | Реализовано и проверено | Свидетельства |
| --- | --- | --- |
| 1. Полная применимость | Все 33 раздела источника и лицензия classified; численные изменения и продуктовые адаптации указаны отдельно | [applicability.md](applicability.md) |
| 2. Общий дизайн | Светлые/тёмные нейтральные и семантические роли, transparent OKLab поверхности, шрифты, тени, радиусы, состояния. Generic Button/Input/Select36/r6/focus1; foreground Button и transparent Input. Плотность chrome, stronger2px custom focus и full-width Settings сохранены согласно действующим контрактам | [28 computed checks](after-contracts.json), [18 primitive checks](catalog/report.json), source diff |
| 3. Native матрица | До48 и после48 настоящих native Electron кадров: обе темы ×1440×960/1024×720 ×12 поверхностей. Финальные после пересняты на текущем renderer. Видны native traffic lights. PNG и actual CG bounds guarded; 135 native PNG в полном пакете имеют ожидаемые размеры | [before](before/report.json), [after](after/report.json), [dimensions](native-dimensions.json), [capture recipe](native-capture.mjs) |
| 4. Состояния/взаимодействия | Длинные проекты/имя Workspace/10 вкладок, общий Board scroll, grouped Table grid, panel reversal/inert/reduced motion, loading/error/recovery, tooltip bounds, invalid/disabled, сохранение rename draft/IME/pending/visible persistent error, первый outside pointer без activation/focus, Escape focus и Tab→project | [34 stress checks](stress/report.json), [10 interaction checks](interactions/report.json), [18 rename checks](rename/report.json), [catalog states](catalog/report.json), [OS pointer proof](native-pointer-check.md) |
| 5. Действующие сценарии | Persistence/restart/project session/search/filter/file tree/read/OS open/source bounds; все типы свойств, opaque select IDs/hidden values. Language switch display-only:145frames, blank0/loading0/IPC0, persistence and project restored. React/service/preload/security/JSON границы сохранены | [10 workflows](workflows/report.json), [11 property checks](properties/report.json), [3 locale checks](locale/report.json), regression source/security tests |
| 6. Проверки/документация | Node145/145, typecheck и renderer build успешны; docs links и diff-check. UI guidelines и bb policy обновлены; imported source неизменён. Backend/IPC production код не изменялся | [regression](regression-final.txt), [typecheck](typecheck-final.txt), [build](build-final.txt), [docs](docs-check.txt), [diff](diff-check.txt) |
| 7. Независимая приёмка/commit | Independent product acceptance PASS критериев1–6 на frozen SHA; scoped commit выполняется после приёмки, его hash и criterion7 same-state check фиксируются в handoff | [Independent acceptance](reviewer/acceptance.md), [accepted source state](reviewer/accepted-state.json), [nested menus4/4](reviewer/nested-menu-report.json); commit hash в handoff |

## Native и fixture provenance

`native-*.png` получены из реального native окна Electron посредством CoreGraphics после `app.focus({steal:true})/moveTop/show/focus`, ожидания settlement и сверки actual window bounds/PNG. Перед UI изменениями сняты48 baseline кадров оригинального HEAD; after48 пересняты финальным production build. Renderer screenshots с префиксом `renderer-` являются отдельной диагностикой и не заменяют native evidence. Дополнительные native состояния: stress18, properties10, rename4, catalog4, locale1, interactions2 — всего135.

Дополнительные сценарии используют выбранный временный источник и отдельную JSON metadata, тестовое IPC fault injection живёт только в harness. Workspace приложения пользователя и его источники не изменялись. Property cleanup затрагивает только `Fixture ` определения временного источника. Длинное временное имя Workspace восстановлено в Operations. Workflow restart использует отдельный fixture. Более ранние stress/catalog/workflow кадры проверяют неизменённые этими поздними исправлениями поверхности; финальная48 матрица, rename/locale/interactions и property picker сценарии покрывают изменённые поверхности. Каждый файл имеет индивидуальный SHA в inventory.

Поздние реальные дефекты исправлены: query-aware empty state в grouped Table; semantic file icons обеих тем; locale full reload dependency; clipped rename error перенесён в ограниченный body portal; dropdown inactive outside dismissal перенесён в capture phase до underlying React handler, с сохранением controlled/uncontrolled roots, caller handlers и nested portals.

## Ограничения

Desktop minimum1024×720 — действующий продуктовый scope; chat/composer/cloud/IDE/mobile сценарии источника не добавлялись. Native AX и клавиатурные сценарии проверены; полного VoiceOver аудита нет. Tooltip multiline в каталоге раскрыт управляемым fixture, это измерение геометрии, а не отдельная проверка hover trigger. Каталог использует production primitive modules в настоящем Electron, его Ladle chrome отличается от product shell. Live bb не запускался: источник закреплён imported SHA. Renderer build содержит существующее предупреждение о размере chunk; сборка успешна. Optional oxfmt unavailable из-за отсутствующего native binding, зависимости не менялись.

## Воспроизведение

Собрать `npm run build:renderer`. Запустить `node work/workspace-6fh/launch.mjs` (отдельный временный источник; `WORKSPACE_6FH_REUSE=1` только для повторного использования своего fixture). Endpoint CDP — точный `http://127.0.0.1:9246`, fixture HTTP9247. Скомпилировать capture-window.swift в `capture-window` перед native recipe. Затем последовательно запускать capture-surfaces.mjs after, property-flows.mjs, locale-check.mjs, rename-states.mjs, interaction-check.mjs; UI сценарии не параллелить. CDP scripts завершают только свой процесс без Playwright browser.close, сохраняя native окно для следующего сценария. После reviewer release закрываются только собственные fixture процессы.

Собственные fixture процессы60530/60531 и catalog47499 закрыты после reviewer runtime release; порты9246/9247/61000 свободны. Temporary fixture сохранён для воспроизведения; [cleanup record](cleanup.json).
