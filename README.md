# Workspace

Локальная React/Vite и any-store основа для работы с workspace-папкой.

В проекте есть web interface layer на shadcn/ui `dashboard-01`, backend modules в `src/` и Go sidecar `cmd/workspace-sidecar`. Electron shell удален.

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
При первом чтении backend мигрирует legacy-данные из `.folder-kanban/settings.json` и `.folder-kanban/properties.json`, если новые файлы еще не созданы.
Обе локальные папки добавлены в `.gitignore`, потому что в них хранятся данные, специфичные для твоей машины.

## Безопасность локального endpoint

Backend endpoints принимают только относительные пути внутри выбранной workspace-папки.

Запросы с абсолютным путем или `../` отклоняются. Это нужно, чтобы локальный runtime не мог открыть произвольный файл вне выбранной workspace-папки.

## Проверка

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
```
