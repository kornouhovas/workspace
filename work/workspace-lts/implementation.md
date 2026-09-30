# workspace-lts — результат исполнителя до независимой приёмки

Checkout: `/Users/aleksandersk/Documents/programming/Projects/project_folder`.
Ветка: `codex/development-docs-lts`, создана от `codex/table-group-drag-dnk` перед изменениями. Настройки модели наследованы; дополнительные агенты исполнителем не создавались. Beads прочитан только через `bd --sandbox --readonly show workspace-lts --json`; записи не выполнялись.

## Объём и критерии

1. Созданы [навигатор](../../docs/development/README.md), product, architecture, workflow, quality и [design/README](../../docs/development/design/README.md). В корневом README есть вход; навигатор даёт маршруты чтения для UI, backend/storage и документации.
2. Новые guides короткие, русские и с относительными каноническими ссылками; исходные спецификации не переносились и не дублировались полностью.
3. AGENTS.md сохранён обязательной точкой входа. В workflow явно указан приоритет над старыми task lifecycle/chat workflow и планами. ADR-004 остаётся Proposed; новые правила/обязательные шаблоны не добавлены.
4. Electron transport прослежен: `src/App.tsx` создаёт WorkspaceServiceClient с `src/workspaceRendererTransport.ts`; `electron/preload.cjs` вызывает `workspace:request`; main регистрирует `electron/workspaceIpc.js`. Dispatcher создаёт файловые views/properties adapters и читает/пишет JSON settings. Main сохраняет contextIsolation/sandbox и отключённый nodeIntegration; sidecar не запускается/не подключается. ADR-006 явно подтверждает переходный runtime и ADR-001 целевое any-store. Go sidecar/store существуют отдельно. package.json подтверждает запуск/build/scripts; README исправляет старый абсолютный checkout path и путь binary на `build/sidecar/local/workspace-sidecar`.
5. design/README фиксирует отсутствие документа пользователя, объясняет добавление и обозначение статуса, ссылается на существующие UI/design sources; ссылок на несуществующий будущий файл нет.
6. Точечно исправлены README, пояснения актуальности architecture/Vision/PRD, storage precondition settings flow. quality-gates теперь следует AGENTS: документация без npm test/build, проверка по границе. Исходные архитектурные решения не изменены.
7. Интегрированный diff прочитан. Посторонние `.ralphex/**` и `work/task-loop/notion-compact-refinement-2026-09-22/run/**` сохранены, не stage/reset/stash/revert. Локальный коммит ожидает независимого review согласно поручению координатора; этот критерий завершит исполнитель после принятия.

## Проверки

- Python-проверка относительных Markdown links по всем 12 документам задачи: 80 ссылок, 0 отсутствующих файлов/каталогов. Anchor-ссылок в проверяемом наборе нет.
- Проверка упомянутых `npm run` команд против scripts package.json: 13 уникальных скриптов, все существуют.
- `git diff --check` завершился успешно (exit 0); добавленные untracked guides дополнительно проверены `git diff --no-index --check /dev/null <file>`, ошибок нет.
- Согласованность вручную сверена с AGENTS, ADR-001/002/005/006, кодом активного транспорта и package.json. ADR-003 принят, ADR-004 Proposed. Изменения ограничены текстами и evidence.
- В package.json/scripts отдельного docs/link checker не найдено. Программные тесты, Electron/Go builds и визуальная проверка не запускались: изменена только документация, по AGENTS они не требуются.

## Состояние для review

Точный intended manifest: [manifest.sha256](manifest.sha256). Он фиксирует SHA256 12 документов и этого отчёта; сам manifest исключён из собственного содержимого, его SHA передан координатору отдельно. Reviewer evidence — отдельный допустимый артефакт. Stage и commit ещё не выполнены. После review необходимо сверить frozen hashes, проверить staged diff, коммитить только принятые файлы и reviewer artifact, выполнить `git show --check`.
