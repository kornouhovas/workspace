# Возобновление

Только CUA для UI. Пользователь прямо выбрал Computer Use; не использовать внешний Playwright, Electron evaluate, CDP или OS event automation. Код/контракты не исправлять в этой задаче.

## Продолжить существующие fixtures

Native manifest: [fixture.json](evidence/fixture.json), bundle `local.workspace.audit389`, process74440. Browser server process74725, CUA tab1 `http://127.0.0.1:38913/`, tmp `workspace-user-audit-389-Ve0cSk`. Оба процесса были живы при последней проверке. Они принадлежат только аудиту; можно безопасно завершить после проверки актуального PID/command. Browser таб помечен handoff, viewport override сброшен. Завершение native процесса не должно затрагивать другие Electron/default apps.

Native запуск из checkout:

```bash
python3 work/ui-user-audit-389/launch-native.py work/ui-user-audit-389/evidence/fixture.json
```

Не запускать вторую копию поверх уже живого74440. Скрипт только запускает установленный Electron entrypoint на изолированных метаданных; UI им не управляется. Текущий CUA отказ описан в [tool log](evidence/native-tool-limitations.txt). Повторять getApp стоит после изменения условий доступности, а не в бесконечном цикле.

Cua bind для существующего native:

```javascript
var audit = await cua.getApp("local.workspace.audit389");
```

Сначала подтвердить Window Workspace/fileURL текущего checkout и полноценный screenshot. Пока доступен только искажённый thumbnail, не делать координатных выводов о native layout/drag. Перепроверить фактические1440×960 и1024×720 через разрешённые UI возможности; исходный configured size/zoom не считать измерением.

## Создать новый disposable native запуск

Из корня проекта:

```bash
npm run build:renderer
node work/ui-user-audit-389/fixture.mjs > /tmp/workspace-audit-389-new.json
python3 work/ui-user-audit-389/prepare-native.py /tmp/workspace-audit-389-new.json
python3 work/ui-user-audit-389/launch-native.py /tmp/workspace-audit-389-new.json
```

Использовать CUA bundle/path из нового manifest. При одновременных тестовых копиях одинаковый bundle ID неоднозначен: сначала завершить прежний audit процесс. Не завершать пользовательские Electron процессы. `prepare-native.py` копирует установленный bundle в новый tmp и меняет только его display name/identifier; системные app bundles/разрешения не трогает.

## Browser ограничение

[Server](browser-fixture-server.mjs) импортирует [fixture](fixture.mjs) и при каждом новом процессе создаёт **новую** tmp data identity. Это отдельные данные от native. Достоверный server PID74725 и descriptor в [логе](evidence/browser-server.log). Не перезапускать сервер на прежнем origin и затем выдавать остаточный browser localStorage от старого dataset за persistence defect. Для нового запуска использовать новый порт в тестовом harness либо новый чистый CUA browser origin, зафиксировать обе identity. В текущем аудите сервер не перезапускался между действиями/reload.

Сервер только localhost, production bridge не меняет. Методы handler доступны через fixture HTTP; native folder picker и OS file opening им не подтверждаются. Production data paths не используются.

## Приоритет следующих проверок

1. Native повтор UI389-02/03; UI389-01 проверить screen reader именами при необходимости.
2. Native4theme/size screenshots, full fill и масштаб; затем pane/tab drags, nested splits, center swap, pointer resize, overflow/reorder/middleclick.
3. Desktop restart с той же metadata; file tree восстановленного split (H01), focus/maximize persistence.
4. Native Date/Select/Multi-select (browser основные цепочки уже пройдены), validation/error/loading, dialogs, role/language/picker, native sidebar history и resize.

Матрицу обновлять по наблюдаемым результатам. Не закрывать workspace-1wx автоматически, не создавать bugtasks без запроса.
