# workspace-ars — исправления UI

Изменения выполнены в основном checkout на `codex/bb-interface-1wx`, поверх6eab951. Backend, IPC, security flags, зависимости и пользовательские данные не менялись. Disposable fixture описан в [manifest](evidence/fixture.json); уникальный bundle `local.workspace.fixesars`.

Пользователь снял исходное ограничение «только CUA» во время выполнения. Начальная попытка CUA не нашла прежний audit bundle: process74440 уже завершён. Дальнейшая приёмка — реальный Electron через Playwright `_electron`, production entrypoint/preload/service, отдельный userData. Browser не выдаётся за Electron.

## Причины и исправления

| Проблема | Причина | Исправление / доказательство |
|---|---|---|
| UI389-01 | Пустые button triggers получали имя только из пустого текста | Property + project aria-label для text/number/date/select; [до](evidence/before-results.json), [первое после](evidence/after-results.json), финальный прогон |
| UI389-02 | Любой split запрещал правый preview; selectedProject обновлялся, но tree продолжал показывать прежнюю вкладку | Независимый preview открывается поверх Navigation, tree/identities сохраняются; [Alpha + Beta](evidence/final-saved-split-beta.png) |
| UI389-03 | Viewport `lg` columns и `lg:col-span-2` создавали узкую implicit column; Back to workspace имел icon-only width28 | Grid по доступной ширине, roles на отдельной строке, корректная ширина Back; screenshots ниже |
| Expanded/right panel | Right host не зависел от expanded screen | Host отсутствует из DOM во время expanded, предпочтение видимости сохраняется для возврата |
| Expanded selection | Detail стартовал invisible + double RAF после remount | Inline content видим с первого render, нет transform transition;24RAF samples в финальном JSON |
| Sidebar collision | Toggle начинался на80px, header reserve перекрывался более специфичным CSS, history исчезала вместе с body | Toggle96px, history128px, reserve208px только у ведущего header; collapsed geometry tests |
| Узкий tab strip | Overlay horizontal scrollbar перехватывал click по вкладке в28px strip | Scrollbar скрыт как в bb right tabs; scroll/reveal/keyboard сохраняются; [локализация](evidence/final-failure.png), финальный mouse click pass |
| Open in split | Дубли в App/right chrome/context menu | Удалены все UI команды; drag/drop, reducer и сохранённые деревья оставлены |
| Icons | ArrowExpand/SidebarRight не соответствовали bb | Exact Hugeicons ExpandIcon/CollapseIcon,13px в28px hit area; source mapping ниже |

Renderer session `screens.fullScreen` — optional boolean в прежнем формате v2, чтобы выбор tab из сохранённого tree восстанавливался как expanded screen. Старые snapshot без поля сохраняют split presentation. Это не миграция backend store. [Regression](../../test/workspaceProjectSession.test.js), [red](evidence/session-red.log), [green](evidence/session-green.log).

## Проверки

[Финальная Electron матрица](evidence/final-results.json), [исполняемый harness](verify-electron.mjs), [лог](evidence/electron-final.log). Harness выходит с ненулевым кодом при failed check. Данные создаются [fixture](fixture.mjs), bundle — [prepare](prepare-native.py). Test seed сохранённого split создаётся только в isolated localStorage из tab identities, созданных через UI; дальнейшие открытия/переключения/restore/close выполняются реальными mouse/keyboard interactions.

Проверены Board/Table, независимый Beta при restored split Alpha, выбор существующей expanded tab из split и возврат Board, две вкладки и идентичности, CmdW/CmdShiftT, Settings, sidebar, restore, reload и отдельный **app.close → electron.launch** с теми же metadata. Notes введено через Table и проверено после restore/restart. Измерены innerWidth/innerHeight и BrowserWindow contentSize1440×960/1024×720, zoomFactor1 и DPR1. Playwright viewport устанавливается в том же real Electron webContents, обычный browser runtime не используется.

| Вид | Light1440 | Light1024 | Dark1440 | Dark1024 |
|---|---|---|---|---|
| Settings/Navigation | [PNG](evidence/final-settings-Light-1440.png) | [PNG](evidence/final-settings-Light-1024.png) | [PNG](evidence/final-settings-Dark-1440.png) | [PNG](evidence/final-settings-Dark-1024.png) |
| Collapsed sidebar | [PNG](evidence/final-collapsed-Light-1440.png) | [PNG](evidence/final-collapsed-Light-1024.png) | [PNG](evidence/final-collapsed-Dark-1440.png) | [PNG](evidence/final-collapsed-Dark-1024.png) |
| Expanded | [PNG](evidence/final-expanded-Light-1440.png) | [PNG](evidence/final-expanded-Light-1024.png) | [PNG](evidence/final-expanded-Dark-1440.png) | [PNG](evidence/final-expanded-Dark-1024.png) |
| Restore preview | [PNG](evidence/final-restored-Light-1440.png) | [PNG](evidence/final-restored-Light-1024.png) | [PNG](evidence/final-restored-Dark-1440.png) | [PNG](evidence/final-restored-Dark-1024.png) |

[Restart/restore](evidence/final-restart-restore.png). Final `node-tests.log`:256/256; `typecheck.log`, `build-renderer.log`, `diff-check.log` — completed exit0. Earlier `before`, `integrated`, `integrated2` are explicitly intermediate red/green evidence, not final acceptance.

## Значки bb

Эталон0.44.0: [reference matrix](../bb-interface-1wx/reference-matrix.md), [сохранённый live screenshot](../bb-interface-1wx/reference/bb-nested-three-panes-dark-1440.jpg). Source `/tmp/bb-reference-20260928` commit061685c4a3198fbe83592e6993e95e7c5790ba55:

- `packages/shared-ui/src/components/ui/icon-extended.tsx`: Maximize2→ExpandIcon, Minimize2→CollapseIcon.
- `apps/app/src/views/thread-detail/PaneMaximizeButton.tsx`: isFullScreen выбирает Minimize2, иначе Maximize2.
- `packages/shared-ui/src/components/ui/coarse-pointer-sizing.ts`: glyph13px / hit area28px.

Использованы те же Hugeicons paths со stroke1.5, viewBox0 0 24 24, без rotation; Expand — внешние верхний правый/нижний левый углы, Collapse — внутренние углы. [Expand UI crop](evidence/final-expand-icon.png), [Restore UI crop](evidence/final-restore-icon.png); runtime checks измеряют оба13×13/28×28. Это source + сохранённый live reference, не новая native сессия bb.

## Честные ограничения

- Снимки `page.screenshot` показывают Electron webContents; нативные macOS traffic lights не входят в их composited image. Область под них зарезервирована до96px, controls проверены геометрически; непосредственное нажатие native traffic lights не проверялось.
- Ранее отмеченная H01: восстановленный split Alpha может показать пустое file tree до повторного выбора проекта. В этом пакете не исправлялось. Поэтому утверждаем сохранность panes/tab identities/property values и рабочие открытия, но не полную приёмку восстановления file tree.
- Не проводилась новая native сессия bb; оба состояния значков сопоставлены с исходниками и сохранёнными эталонами. Полный audit389 вне этого пакета не закрывается.
