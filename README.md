# Workspace

Локальное Electron-приложение для работы с workspace-папкой.

## Нужно ли поднимать backend отдельно?

Нет. Команда `npm run electron` запускает UI и backend в одном приложении:

- собирает локальный sidecar `workspace-sidecar`;
- открывает Electron UI;
- запускает backend внутри Electron main process;
- подключает локальный `any-store` storage через sidecar.

Отдельный backend-процесс запускать не нужно.

## Быстрый запуск

```bash
cd /Users/aleksandersk/Documents/programming/node/project_folder
npm run electron
```

## Выбор workspace-папки

Путь к workspace root больше не нужно передавать через переменную окружения.

1. Запусти приложение командой `npm run electron`.
2. Перейди в `Settings`.
3. Нажми `Choose folder` и выбери папку в системном macOS-диалоге.

Выбранный абсолютный путь сохраняется локально в `.workspace/settings.json`.
Свойства папок сохраняются рядом в `.workspace/properties.json`.
При первом чтении приложение мигрирует legacy-данные из `.folder-kanban/settings.json` и `.folder-kanban/properties.json`, если новые файлы еще не созданы.
Обе локальные папки добавлены в `.gitignore`, потому что в них хранятся данные, специфичные для твоей машины.

## Как работает открытие файлов и папок

- Клик по шеврону папки в `card place` раскрывает вложенные файлы и папки.
- Клик по строке папки открывает эту папку в Finder.
- PDF, изображения, текстовые файлы, видео, аудио, JSON, HTML, CSS, Markdown и похожие preview-типы открываются в браузере.
- Остальные файлы открываются в macOS через `open`.

## Storage

Workspace stores local object and property data through `any-store`, a Go document database on top of SQLite.
The Electron app includes the UI and backend in one application. The renderer talks to Electron main through preload IPC. Electron main owns OS access and starts the local Workspace storage sidecar.

`any-store` is used under the MIT License. See `THIRD_PARTY_NOTICES.md`.

## Запуск

```bash
npm run electron
```

This command builds the local `workspace-sidecar` binary first, then opens the Electron app. The generated binary is ignored by git.

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

Выбор папки делает Electron backend через системный macOS-диалог. Renderer получает root, дерево папок и содержимое `card place` через preload IPC. Electron main владеет доступом к файловой системе и синхронизирует выбранный workspace root с `any-store`.
