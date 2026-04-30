# Workspace

Локальное приложение для работы с workspace-папкой в браузере.

## Нужно ли поднимать backend отдельно?

Нет. Команда `npm run dev` поднимает один локальный Node-сервер:

- отдает frontend по адресу `http://127.0.0.1:4173/`;
- обслуживает backend endpoints для выбора workspace root, сканирования папок, просмотра preview-файлов и открытия папок/файлов в Finder на macOS.

Отдельный backend-процесс запускать не нужно.

## Быстрый запуск

```bash
cd /Users/aleksandersk/Documents/programming/node/project_folder
npm run dev
```

После запуска открой:

```text
http://127.0.0.1:4173/
```

## Выбор workspace-папки

Путь к workspace root больше не нужно передавать через переменную окружения.

1. Запусти приложение командой `npm run dev`.
2. Открой `http://127.0.0.1:4173/`.
3. Перейди в `Settings`.
4. Нажми `Choose folder` и выбери папку в системном macOS-диалоге.

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

## Безопасность локального endpoint

Backend endpoints принимают только относительные пути внутри выбранной workspace-папки.

Запросы с абсолютным путем или `../` отклоняются. Это нужно, чтобы браузер не мог открыть произвольный файл вне выбранной workspace-папки.

## Если порт занят

По умолчанию используется порт `4173`.

Можно запустить на другом порту:

```bash
PORT=4174 npm run dev
```

Тогда открой:

```text
http://127.0.0.1:4174/
```

## Проверка

```bash
npm test
```

## Как это устроено

Выбор папки теперь делает backend через системный macOS-диалог. Поэтому frontend получает root, дерево папок и содержимое `card place` через локальные API, а запуск остается простым: `npm run dev`.
