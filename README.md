# Workspace

Локальная Electron/any-store основа для работы с workspace-папкой.

Renderer UI is intentionally absent on the `app-redesign` branch. The previous handwritten interface and its UI tests were removed so the renderer can be rebuilt from a clean slate while keeping Electron, local filesystem access, and storage plumbing.

## Нужно ли поднимать backend отдельно?

Нет. Команда `npm run electron` запускает локальную Electron/backend-обвязку:

- собирает локальный sidecar `workspace-sidecar`;
- открывает пустое Electron-окно для будущего renderer;
- запускает backend внутри Electron main process;
- подключает локальный `any-store` storage через sidecar.

Отдельный backend-процесс запускать не нужно.

## Быстрый запуск

```bash
cd /Users/aleksandersk/Documents/programming/node/project_folder
npm run electron
```

Выбранный абсолютный путь сохраняется локально в `.workspace/settings.json`.
Свойства папок сохраняются рядом в `.workspace/properties.json`.
В Electron-сборке эти файлы находятся внутри системной папки данных приложения, например `~/Library/Application Support/Workspace/.workspace/` на macOS.
При первом чтении приложение мигрирует legacy-данные из `.folder-kanban/settings.json` и `.folder-kanban/properties.json`, если новые файлы еще не созданы.
Обе локальные папки добавлены в `.gitignore`, потому что в них хранятся данные, специфичные для твоей машины.

## Storage

Workspace stores local object and property data through `any-store`, a Go document database on top of SQLite.
Electron main owns OS access, exposes the preload IPC contract, and starts the local Workspace storage sidecar. A new renderer can be attached to that contract during the redesign.

`any-store` is used under the MIT License. See `THIRD_PARTY_NOTICES.md`.

## Запуск

```bash
npm run electron
```

This command builds the local `workspace-sidecar` binary first, then opens a blank Electron window. The generated binary is ignored by git.

## Сборка приложения

Сборка macOS-приложения для Apple Silicon:

```bash
npm run dist:mac
```

Сборка Windows-приложения:

```bash
npm run dist:win
```

Сборка обеих платформ одной командой:

```bash
npm run dist:all
```

Перед упаковкой команды собирают sidecar для `darwin-arm64` и `win32-x64`. Готовые приложения появляются в папке `dist/`.

## Безопасность локального endpoint

Backend endpoints принимают только относительные пути внутри выбранной workspace-папки.

Запросы с абсолютным путем или `../` отклоняются. Это нужно, чтобы браузер не мог открыть произвольный файл вне выбранной workspace-папки.

## Проверка

```bash
npm test
```

## Как это устроено

Electron main владеет доступом к файловой системе, держит preload IPC contract и синхронизирует выбранный workspace root с `any-store`. Renderer на этой ветке удален и будет создан заново.
