# workspace-ars: дополнения A–D

База `bc3ec99`, тот же основной checkout/ветка. Предыдущие evidence в родительской папке сохранены; они не используются как доказательство исправления D. Скриншоты пользователя скопированы: [main header](evidence/user-main-header.png), [collapsed/right preview](evidence/user-right-preview.png). Commit пользовательского окна по ним установить нельзя.

## Причина и изменение

**D воспроизведён настоящим OS pointer на актуальном Electron fixture.** [Before JSON](evidence/before-results.json): native Hide доставляет trusted pointerdown и `collapsed=true`; native Show по той же видимой кнопке не доставляет pointerdown в renderer и остаётся `true`. DOM hit testing при этом указывает SVG кнопки и computed `app-region:no-drag`. Runtime URL — `dist/renderer/index.html` текущего checkout, baseline commitbc3ec99. Значит предыдущий CDP click обходил проблему macOS non-client routing.

Toggle находился в DOM до main/pane headers, чьи drag regions включали его координаты. Единственная пробная правка — перенести тот же toggle после pane hosts, сохранив координаты, обработчик, классы и no-drag. [Probe](evidence/probe-results.json) доставляет native Show и проходит три полных цикла. Native region ordering подтверждён контролируемым сравнением; DOM no-drag сам по себе не гарантировал кликабельность. В коде оставлен комментарий о необходимом порядке.

A–C: удалён отдельный right-panel toggle из main header; main Expand/Close выводятся только на expanded screen, но не дублируют правый preview; удалён плюс правого header. Управление карточкой справа, самостоятельные split controls, основной Add Board/Table, keyboard launcher и сохранённые tabs/layouts остаются. [Controls before](evidence/controls-before-results.json) фиксирует присутствие прежних кнопок; [after](evidence/controls-final-results.json) проверяет удаление и работающие оставшиеся пути.

## Проверка

[Native harness](verify-matrix.mjs) запускает production Electron entrypoint/preload в [isolated fixture](evidence/fixture.json). Каждый sidebar click выполняет [Swift CGEvent](native-click.swift) через HID event tap в **глобальных координатах окна**, рассчитанных из фактических contentBounds и rect кнопки. Это не DOM click, не reducer call и не CDP mouse input. DOM используется для наблюдения; остальные сценарии допускают Playwright UI input. Новые зависимости и системные разрешения не устанавливались.

[Финальный результат](evidence/final-results.json), [краткий лог](evidence/native-final.log):180 успешных assertions,48 полных hide→show циклов. Все16комбинаций Board/Table × right preview off/on × Light/Dark ×1440×960/1024×720 проходят три цикла. После **каждого** Hide проверяется true, после **каждого** Show — false; дополнительно width320 и содержимое sidebar.49 trusted Hide и49 trusted Show включают collapsed app.close→relaunch→native expand. Keyboard проверяется отдельно и не заменяет pointer evidence. Реальные BrowserWindow contentBounds и renderer viewport совпадают с требуемыми размерами, zoom1/DPR1.

[Дополнительный harness](verify-controls.mjs), [результат](evidence/controls-final-results.json):6/6 — native preview collapse/expand, создание Board+Table основным плюсом, keyboard right launcher dedup, отсутствие right plus при существующей вкладке и её сохранение после reload. Промежуточная ошибка ожидания второго New Table меню была ошибкой harness: добавлено ожидание завершения async создания первого view. Финальный прогон завершён exit0.

Снимки Electron webContents:

| Поверхность | Light1440 | Light1024 | Dark1440 | Dark1024 |
|---|---|---|---|---|
| Board, right closed | [PNG](evidence/final-Light-1440-Board-rightfalse.png) | [PNG](evidence/final-Light-1024-Board-rightfalse.png) | [PNG](evidence/final-Dark-1440-Board-rightfalse.png) | [PNG](evidence/final-Dark-1024-Board-rightfalse.png) |
| Board, right preview | [PNG](evidence/final-Light-1440-Board-righttrue.png) | [PNG](evidence/final-Light-1024-Board-righttrue.png) | [PNG](evidence/final-Dark-1440-Board-righttrue.png) | [PNG](evidence/final-Dark-1024-Board-righttrue.png) |
| Table, right preview | [PNG](evidence/final-Light-1440-Table-righttrue.png) | [PNG](evidence/final-Light-1024-Table-righttrue.png) | [PNG](evidence/final-Dark-1440-Table-righttrue.png) | [PNG](evidence/final-Dark-1024-Table-righttrue.png) |

[Collapsed preview после исправления](evidence/controls-final-collapsed-preview.png), [restart expanded](evidence/final-restart-expanded.png), [retained tabs](evidence/controls-final-retained-tabs.png). Нативные traffic lights не входят в webContents screenshots; клик проходит через OS pointer и native frame routing, а не через изображение.

Relevant Node tests:28/28 ([лог](evidence/node-tests.log)); typecheck и build:renderer exit0 ([typecheck](evidence/typecheck.log), [build](evidence/build-renderer.log)). Native harness — содержательная regression coverage для маршрутизации, которую Node/source tests не могут проверить. Изменения не затрагивают backend/storage/IPC/dependencies/security или реальные пользовательские данные. H01/другие вопросы предыдущего аудита этим дополнением не исследовались.

## Воспроизведение проверки

Из checkout, с отдельным fixture manifest по аналогии с родительскими `fixture.mjs`/`prepare-native.py`:

```sh
swiftc work/ui-fixes-ars/followup/native-click.swift -o /tmp/workspace-ars-native-click
node work/ui-fixes-ars/followup/verify-matrix.mjs final
node work/ui-fixes-ars/followup/verify-controls.mjs controls-final
```

Оба harness закрывают только собственный Electron process и возвращают nonzero при ошибке. Во время native кликов test window получает focus. `verify-electron.mjs` — ранняя probe, не полный финальный набор; первое before assertion о main toggle использовало неверный matcher и не является A evidence (для A используется controls-before). Probe default1358px не выдаётся за final1440px.
