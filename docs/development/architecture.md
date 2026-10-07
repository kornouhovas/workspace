# Архитектура и действующий runtime

Карта слоёв и границы находятся в [архитектуре](../architecture.md), контракты — в [модели данных](../data-model.md) и [API](../api/). Перед изменением транспорта прочитайте [ADR-002](../adr/002-electron-preload-ipc-bridge.md) и [ADR-006](../adr/006-workspace-source-bindings.md).

## Electron сейчас

```text
React UI → WorkspaceServiceClient → renderer transport
  → window.workspace.request → sandboxed preload IPC
    → Electron main dispatcher → domain/backend → JSON-адаптеры
```

Это можно проследить в [App.tsx](../../src/App.tsx), [service client](../../src/workspaceServiceClient.js), [renderer transport](../../src/workspaceRendererTransport.ts), [preload](../../electron/preload.cjs), [main](../../electron/main.js) и [dispatcher](../../electron/workspaceIpc.js). Dispatcher использует файловые adapters settings/views/properties; при обычном запуске метаданные лежат в `.workspace`, при `npm run dev` — в изолированной `.workspace-dev` текущего checkout.

React отвечает за представление и действия пользователя. Проверка путей, обнаружение проектов, роли папок, нормализация свойств, идентичность и проекция views принадлежат backend/domain. Renderer не импортирует Node builtins, backend storage или sidecar clients. Сохраняются `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

Renderer session commands use [workspaceSession.js](../../src/workspaceSession.js), subscribed to by React. The owner coordinates tabs, pane layout, selection, fallback and transient closed-tab history without React or platform imports. [workspaceSessionLifecycle.js](../../src/workspaceSessionLifecycle.js) composes that owner with injected storage and the current service client, owning screen memory, persistence/restoration and preview request freshness. General data loading, CRUD queues and DOM effects remain composition-root adapters; see [ADR-010](../adr/010-renderer-session-command-owner.md) and [ADR-011](../adr/011-renderer-session-lifecycle.md).

## Целевое хранение

[ADR-001](../adr/001-local-first-workspace-storage.md) сохраняет целевой durable store: Go sidecar → `any-store` → SQLite. [Sidecar](../../cmd/workspace-sidecar/main.go) и [Go store](../../internal/workspacestore/store.go) существуют, но Electron main не запускает sidecar HTTP server и не подключает его вместо JSON-адаптеров. Самостоятельный запуск sidecar не переключает storage приложения. ADR-006 прямо сохраняет этот переходный runtime; подключение целевого store — отдельная работа.

Project IDs — opaque identities, пути — locators. Операции с файлами проверяются относительно выбранного источника; удаление Workspace не удаляет проекты на диске. Контракты изменений данных: [properties](../api/workspace-properties.md), [views](../api/workspace-views.md), [sources/session](../api/workspace-session-sources.md). Не заменяйте схему или адаптер на основании целевого описания без проверки текущего подключения.

В [каталоге ADR](../adr/) ADR-002, ADR-003, ADR-005 и ADR-006 приняты; ADR-004 про реестр идентичности имеет статус Proposed. Его описание не разрешает реализацию миграции.

Создание новой папки проекта использует узкий CLI режим существующего Go бинарника с `os.Root`; он не открывает store/HTTP server и не переключает JSON adapters. См. [контракт](../api/workspace-views.md#confined-directory-helper).
