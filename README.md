# Workspace

Локальная React/Vite и any-store основа для работы с workspace-папкой.

Renderer живет в `src/renderer`, собирается Vite в `dist/renderer` и использует shadcn dashboard shell. Локальное хранилище workspace-данных остается в Go sidecar на базе `any-store` и SQLite.

## Быстрый запуск

Renderer:

```bash
cd /Users/aleksandersk/Documents/programming/node/project_folder
npm run dev
```

Sidecar:

```bash
npm run build:sidecar
./workspace-sidecar -db .workspace/workspace.db
```

## Storage

Workspace stores local object and property data through `any-store`, a Go document database on top of SQLite.

`any-store` is used under the MIT License. See `THIRD_PARTY_NOTICES.md`.

Выбранный абсолютный путь сохраняется локально в `.workspace/settings.json`.
Свойства папок сохраняются рядом в `.workspace/properties.json`.
При первом чтении приложение мигрирует legacy-данные из `.folder-kanban/settings.json` и `.folder-kanban/properties.json`, если новые файлы еще не созданы.
Обе локальные папки добавлены в `.gitignore`, потому что в них хранятся данные, специфичные для твоей машины.

## Безопасность локального endpoint

Backend endpoints принимают только относительные пути внутри выбранной workspace-папки.

Запросы с абсолютным путем или `../` отклоняются. Это нужно, чтобы браузер не мог открыть произвольный файл вне выбранной workspace-папки.

## Проверка

```bash
npm test
npm run typecheck
npm run build:renderer
```

## Как это устроено

Vite отдает renderer как обычное web-приложение. Backend/local слой состоит из workspace backend modules в `src/` и Go sidecar `cmd/workspace-sidecar`, который хранит данные через `any-store`.
