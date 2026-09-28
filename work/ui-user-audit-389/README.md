# Пользовательский аудит workspace-389 — checkpoint

Дата: 2026-09-28. **Полная приёмка не завершена:** native Computer Use сначала работал через AX, затем заблокирован ScreenCaptureKit `-3812`. Подтверждена одна проблема доступности в Electron; ещё две проблемы воспроизведены в браузерном контуре того же renderer. Исправлений продукта нет. workspace-1wx этим отчётом не принимается.

- [Матрица сценариев](scenarios.md)
- [Дефекты и границы доказательств](defects.md)
- [Возобновление и процессы](resume.md)

## Окружение и данные

Checkout `/Users/aleksandersk/Documents/programming/Projects/project_folder`, ветка `codex/bb-interface-1wx`, HEAD `44ffbaeb6d8a0dd0606de27cce2d1eb0ebd13fac`. macOS 27.0 (26A428), shell Node 20.18.3. Установленный Electron 41.5.0 / Chromium 146.0.7680.216 (версия наблюдалась в его default app). Renderer заново собран из этого HEAD: [лог](evidence/build-renderer.log), `index-C8egTgna.js`, `index-dY2DQ66z.css`. Сборка прошла, есть предупреждение chunk >500 kB. Это подготовка аудита, не доказательство UI-приёмки. Тесты продукта не запускались.

Исходный PID 72193 к началу аудита уже отсутствовал; `ps` также не нашёл dev-desktop/Vite. Живые пользовательские `.workspace-dev` и project folders не использовались. Копия установленного Electron с уникальным bundle ID `local.workspace.audit389` создана только внутри tmp для адресного выбора CUA. Продуктовый `electron/main.js`, preload, IPC и настройки безопасности не менялись. Native запуск использовал production file renderer и `WORKSPACE_DEV=1`, отдельный `WORKSPACE_DEV_DATA`, пустой `WORKSPACE_DEV_URL`.

| Контур | Данные и transport |
|---|---|
| Native Electron, PID 74440 | [manifest](evidence/fixture.json), tmp `workspace-user-audit-389-FHQv5H`; реальный preload/IPC и JSON adapters. CUA подтвердил file URL текущего checkout. Настроенный main.js размер 1440×960, zoom1; фактическая native геометрия не подтверждена. Начальная Appearance System (видимо тёмная), затем UI Light. |
| Browser CUA, PID 74725, tab1, `http://127.0.0.1:38913/` | [server log](evidence/browser-server.log), отдельный tmp `workspace-user-audit-389-Ve0cSk`, workspace `workspace:68c6c644d90dba96`. HTTP fixture вызывает реальный Workspace handler, но НЕ Electron IPC. Сервер не перезапускался во время reload/repro. |

Обе fixtures созданы [fixture.mjs](fixture.mjs): Alpha (README.md и docs/notes.txt), Beta, Gamma, длинное имя, Empty project; статусы Active/Done/Waiting и Notes:text. В native через UI сохранено Alpha Notes=`Audit note 389`. В browser через UI создан второй Workspace, Beta Notes=`Beta text`, Number и Alpha expression `=2+3*4` (результат14), Date=`2026-09-30`, Select=`Urgent`, Multi-select=`Red`+`Blue` с последующим снятием Red. Пользовательские файлы не менялись. Browser source path подтверждён UI Settings, native — [Settings AX](evidence/settings-light.txt).

## Снимки и ограничения

Browser CUA viewport устанавливался в 1440×960 и1024×720, затем override сброшен. Четыре снимка Settings ниже проверены глазами: интерфейс заполняет canvas, sidebar320, нижний Settings у нижнего края. `file` подтвердил JPEG и размеры. Это browser screenshots, НЕ native. Расширения приведены к фактическому JPEG без преобразования изображений.

| Тема | 1440×960 | 1024×720 |
|---|---|---|
| Light (выбрана UI) | [снимок](evidence/browser-light-settings-1440x960.jpg) | [снимок](evidence/browser-light-settings-1024x720.jpg) |
| Dark (выбрана UI) | [снимок](evidence/browser-dark-settings-1440x960.jpg) | [снимок](evidence/browser-dark-settings-1024x720.jpg) |

[Native thumbnail](evidence/native-invalid-perspective.jpg) имеет250×290 и перспективное искажение; НЕ служит доказательством layout, контраста или размера. [Журнал ограничения](evidence/native-tool-limitations.txt). Пользователь выбрал продолжать только Computer Use; альтернативная UI-автоматизация не применялась. Browser вкладка была hidden: subagent-инструмент не поддерживает visible:true, но CUA screenshot/AX/мышь/клавиатура работали.

## Итог доступного покрытия

Native пройдены Board→Alpha→Notes→split→maximize/restore→закрыть основной host→Settings→Table; поиск, фильтр, дублирование и закрытие вкладок, CmdW/CmdShiftT. Browser дополнил переключение Workspace, редакторы text/number/date/select/multi-select, sidebar collapse/history, launcher dedup/excluded-reopen, close-other, outside-dismiss и Escape, file disclosure, split edge move и keyboard resize, reload, четыре theme/size снимка. Главное препятствие пользователю из обнаруженного — открытие следующего проекта при существующем split (browser-reproduced); Settings при открытой Navigation теряет читаемые folder roles. Точные шаги и статус каждого результата — в связанных документах.

Код, контракты, зависимости, Beads и чужие work/task-loop/.ralphex не изменены. Нет заявлений о полном native покрытии, runtime-эквивалентности bb или отсутствии иных дефектов. Parent должен проверить и сохранить checkpoint; закрывать задачу как полностью принятую нельзя.
