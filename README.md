# Workspace

Локальное Electron-приложение на React/Vite и any-store для работы с workspace-папкой.

В проекте есть Electron shell, renderer Workspace Project Board, backend modules в `src/` и Go sidecar `cmd/workspace-sidecar`. Прямой browser/Vite dev режим не используется как пользовательский запуск.

## Быстрый запуск

Electron app:

```bash
cd /Users/aleksandersk/Documents/programming/node/project_folder
npm run electron
```

Если renderer еще не собран или нужен свежий production bundle:

```bash
npm run build:renderer
npm run electron
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
npm run electron
npm run electron:build
go test ./...
npm run build:sidecar
```

## Development and component catalog

Run `npm run dev` for the Electron app with Vite HMR and isolated checkout-local `.workspace-dev` metadata and Electron preferences. Production `npm run electron` still loads the built renderer. `npm run storybook` opens the Ladle catalog; `npm run storybook:build`, `npm run lint`, and `npm run format:check` verify components and code. See [bb adaptation](docs/design/bb-stack-design.md) for commands and design decisions.
