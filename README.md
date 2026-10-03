# Workspace

Локальное Electron-приложение на React/Vite для работы с workspace-папками.

[Документы разработки](docs/development/README.md): продукт, архитектура, правила работы, проверки и [исходник дизайна bb с политикой применения](docs/development/design/README.md). Правила этой папки обязательны при разработке. Обязательная точка входа в рабочие правила — [AGENTS.md](AGENTS.md).

В проекте есть Electron shell, renderer Workspace Project Board, backend modules в `src/` и Go sidecar `cmd/workspace-sidecar`. Прямой browser/Vite dev режим не используется как пользовательский запуск.

## Быстрый запуск

Установите зависимости через `npm ci`. Для разработки используйте `npm run dev`: Electron + Vite HMR с изолированными метаданными/preferences в `.workspace-dev` текущего checkout.

Из корня текущего checkout, Electron app:

```bash
npm run electron
```

Если renderer еще не собран или нужен свежий production bundle:

```bash
npm run build:renderer
npm run electron
```

Отдельный sidecar (не переключает хранение Electron):

```bash
npm run build:sidecar
./build/sidecar/local/workspace-sidecar -db .workspace/workspace.db
```

## Storage

Действующий Electron runtime использует JSON-адаптеры settings/views/properties за WorkspaceServiceClient и preload IPC. Go sidecar с `any-store` поверх SQLite — целевое durable хранение; Electron не подключает sidecar как store. Создание новой папки проекта использует только узкий CLI-режим существующего бинарника с удерживаемым дескриптором каталога; `npm run dev` и `npm run electron` собирают helper перед запуском. См. [ADR-006](docs/adr/006-workspace-source-bindings.md) и [карту архитектуры](docs/development/architecture.md).

`any-store` is used under the MIT License. See `THIRD_PARTY_NOTICES.md`.

Выбранный абсолютный путь сохраняется локально в `.workspace/settings.json`.
Свойства папок сохраняются рядом в `.workspace/properties.json`.
При первом чтении backend мигрирует legacy-данные из `.folder-kanban/settings.json` и `.folder-kanban/properties.json`, если новые файлы еще не созданы.
Обе локальные папки добавлены в `.gitignore`, потому что в них хранятся данные, специфичные для твоей машины.

## Безопасность локального endpoint

Backend endpoints принимают только относительные пути внутри выбранной workspace-папки.

Запросы с абсолютным путем или `../` отклоняются. Это нужно, чтобы локальный runtime не мог открыть произвольный файл вне выбранной workspace-папки.

## Проверка

Набор выбирается по затронутым границам: [правила проверок](docs/development/quality.md). Ниже доступные команды, а не обязательный прогон для каждой правки.

```bash
npm test
npm run typecheck
npm run build:renderer
npm run electron
npm run electron:build
go test ./...
npm run build:sidecar
```

## Разработка и каталог компонентов

Run `npm run dev` for the Electron app with Vite HMR and isolated checkout-local `.workspace-dev` metadata and Electron preferences. Production `npm run electron` still loads the built renderer. `npm run storybook` opens the Ladle catalog; `npm run storybook:build`, `npm run lint`, and `npm run format:check` verify components and code. See [bb adaptation](docs/design/bb-stack-design.md) for commands and design decisions.
