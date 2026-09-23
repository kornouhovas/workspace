# Комплексный анализ безопасности проекта

## Overview

Провести полный аудит безопасности текущего Electron-приложения, Node backend, файловых операций, Go sidecar, локального хранилища и цепочки поставки. Результатом станет приоритизированный отчёт с доказательствами, сценариями эксплуатации, оценкой риска и рекомендациями, но без исправления найденных уязвимостей и без изменения production-кода.

## Context

- Files involved: `docs/security/20260923-project-security-audit.md`, `test/securityAuditReport.test.js`, `test/securityControls.test.js`, `electron/main.js`, `electron/preload.cjs`, `electron/workspaceIpc.js`, `src/workspaceRendererTransport.ts`, `src/workspaceServiceClient.js`, `src/App.tsx`, `index.html`, `vite.config.ts`, `src/localOpen.js`, `src/workspaceBackend.js`, `src/workspacePropertyStore.js`, `src/workspaceSidecarClient.js`, `cmd/workspace-sidecar/main.go`, `internal/workspacestore/store.go`, соответствующие Node/Go тесты и файлы зависимостей.
- Related patterns: renderer обращается к backend только через `WorkspaceServiceClient` и Electron preload IPC; файловая безопасность, storage и identity остаются в backend/domain; sidecar остаётся внутренним локальным сервисом; тесты опасных операций используют только изолированные временные fixtures.
- Dependencies: текущие Node/npm, Electron, Go и any-store зависимости проекта; новые зависимости и внешние сканеры не устанавливаются без отдельного разрешения.
- Контракты: `docs/architecture.md`, `docs/data-model.md`, `docs/api/*`, `docs/adr/001-local-first-workspace-storage.md`, `docs/adr/002-electron-preload-ipc-bridge.md`.
- Анализируемые границы доверия: renderer → preload → IPC → backend → filesystem/sidecar → SQLite.
- Модель угроз включает вредоносное содержимое выбранной папки, symlink/path traversal, скомпрометированный renderer, посторонний локальный процесс или веб-страницу, повреждённые metadata и уязвимые зависимости.
- Findings классифицируются как Critical, High, Medium, Low или Informational; для каждого указываются вероятность, влияние, CWE/OWASP, доказательство, затронутые файлы и рекомендуемое исправление.
- Raw-секреты, абсолютные пользовательские пути и чувствительное содержимое файлов не включаются в отчёт.
- Изменения production-кода и исправления findings явно исключены из scope.

## Development Approach

- **Testing approach**: Regular — сначала собрать и классифицировать evidence, затем добавить или обновить проверки полноты отчёта и уже существующих защит.
- Работать только с текущим checkout и изолированными временными fixtures; не читать содержимое пользовательских файлов вне выбранных тестовых каталогов.
- Проверять git-tracked файлы и доступную историю на секреты, не выводя найденные значения целиком.
- Не устанавливать новые npm/Go зависимости и внешние сканеры без отдельного разрешения.
- Не добавлять тесты, которые закрепляют небезопасное поведение как допустимое; такие случаи оформлять findings с воспроизводимым evidence.
- Отделять подтверждённые уязвимости от hardening-рекомендаций, непроверенных гипотез и ограничений аудита.
- Complete each task fully before moving to the next.
- **CRITICAL: every task MUST include new/updated tests.**
- **CRITICAL: all tests must pass before starting next task.**

## Implementation Steps

### Task 1: Зафиксировать scope, методику и модель угроз

**Files:**

- Create: `docs/security/20260923-project-security-audit.md`
- Create: `test/securityAuditReport.test.js`
- Inspect: `AGENTS.md`
- Inspect: `README.md`
- Inspect: `docs/architecture.md`
- Inspect: `docs/data-model.md`
- Inspect: `docs/adr/*.md`
- Inspect: `package.json`
- Inspect: `go.mod`

- [x] Зафиксировать commit, состояние рабочего дерева, версии Node/Go/Electron и точные границы аудита.
- [x] Описать активы, доверительные границы, источники входных данных, атакующие модели и предположения.
- [x] Создать шаблон finding с ID, severity, confidence, CWE/OWASP, evidence, impact, reproduction, recommendation и статусом.
- [x] Составить матрицу покрытия Electron, IPC, filesystem, storage, sidecar, dependencies, secrets и build configuration.
- [x] Добавить `test/securityAuditReport.test.js`, проверяющий обязательные разделы, уникальность finding ID и допустимые значения severity/confidence.
- [x] Запустить `node --test test/securityAuditReport.test.js`.
- [x] Запустить `npm test`; все тесты должны пройти до Task 2.

### Task 2: Проверить Electron, renderer и IPC boundary

**Files:**

- Inspect: `electron/main.js`
- Inspect: `electron/preload.cjs`
- Inspect: `electron/workspaceIpc.js`
- Inspect: `src/workspaceRendererTransport.ts`
- Inspect: `src/workspaceServiceClient.js`
- Inspect: `src/App.tsx`
- Inspect: `index.html`
- Inspect: `vite.config.ts`
- Modify: `test/runtimeMode.test.js`
- Modify: `test/rendererBoundary.test.js`
- Create: `test/securityControls.test.js`
- Modify: `test/securityAuditReport.test.js`
- Modify: `docs/security/20260923-project-security-audit.md`

- [x] Проверить `contextIsolation`, `nodeIntegration`, sandbox, preload API, список IPC methods и отсутствие Node/backend imports в renderer.
- [x] Проверить авторизацию IPC sender/frame, валидацию payload, обработку ошибок и возможность вызова привилегированных методов из скомпрометированного renderer.
- [x] Проверить navigation, новые окна, permission handlers, CSP, загрузку локального renderer и риски активного содержимого.
- [x] Проверить раскрытие абсолютных путей, stack traces и внутренних ошибок через IPC.
- [x] Добавить regression/characterization-тесты только для подтверждённых существующих защит Electron и renderer boundary.
- [x] Зафиксировать отсутствующие controls отдельными findings без изменения production-кода.
- [x] Обновить тест полноты отчёта требованием Electron/IPC evidence.
- [x] Запустить `node --test test/runtimeMode.test.js test/rendererBoundary.test.js test/securityControls.test.js test/securityAuditReport.test.js`.
- [x] Запустить `npm test`; все тесты должны пройти до Task 3.

### Task 3: Проверить файловую систему, локальные данные и опасные операции

**Files:**

- Inspect: `src/localOpen.js`
- Inspect: `src/workspaceBackend.js`
- Inspect: `src/workspacePropertyStore.js`
- Inspect: `electron/workspaceIpc.js`
- Modify: `test/localOpen.test.js`
- Modify: `test/workspaceBackend.test.js`
- Modify: `test/workspaceIpc.test.js`
- Modify: `test/securityControls.test.js`
- Modify: `test/securityAuditReport.test.js`
- Modify: `docs/security/20260923-project-security-audit.md`

- [x] Проследить каждый путь от renderer payload до `readFile`, `writeFile`, `readdir`, `rename`, `rm`, `stat`, `realpath` и `spawn`.
- [x] Проверить absolute path, `..`, separator/encoding edge cases, symlink escape, broken symlink, TOCTOU и подмену файла между validation и use.
- [x] Проверить allowlist preview-типов, обработку HTML/SVG/XML/JS, раскрытие `filePath` и запуск локальных приложений.
- [x] Проверить права создаваемых `.workspace`/JSON/SQLite файлов, atomic write, backup/recovery, corrupt/future schema и конкурентные записи.
- [x] Подтвердить, что удаление Workspace и metadata не удаляет пользовательские проекты.
- [x] Расширить изолированные fixture-тесты существующих path/symlink/destructive-operation защит; findings не оформлять как разрешённое поведение.
- [x] Обновить тест полноты отчёта требованием filesystem/storage evidence.
- [x] Запустить `node --test test/localOpen.test.js test/workspaceBackend.test.js test/workspaceIpc.test.js test/securityControls.test.js test/securityAuditReport.test.js`.
- [x] Запустить `npm test`; все тесты должны пройти до Task 4.

### Task 4: Проверить Go sidecar, локальный HTTP и any-store

**Files:**

- Inspect: `src/workspaceSidecarClient.js`
- Inspect: `cmd/workspace-sidecar/main.go`
- Inspect: `internal/workspacestore/store.go`
- Modify: `test/sidecarClient.test.js`
- Modify: `cmd/workspace-sidecar/main_test.go`
- Modify: `internal/workspacestore/store_test.go`
- Modify: `test/securityAuditReport.test.js`
- Modify: `docs/security/20260923-project-security-audit.md`

- [x] Проверить bind address, доступность endpoint другим локальным процессам, отсутствие или наличие authentication/session secret и возможные browser-origin атаки.
- [x] Проверить HTTP methods, Content-Type, malformed JSON, trailing data, размер body, timeouts, concurrency и graceful shutdown.
- [x] Проверить валидацию document IDs, workspace/project/property scope, soft delete, history и возможность cross-workspace доступа.
- [x] Проверить права и расположение SQLite-файла, обработку ошибок any-store и утечку внутренних сведений.
- [x] Добавить Go/Node тесты подтверждённых method, validation и malformed-request controls.
- [x] Зафиксировать отсутствующие лимиты, authentication или transport controls как findings, не меняя sidecar.
- [x] Обновить тест полноты отчёта требованием sidecar/store evidence.
- [x] Запустить `node --test test/sidecarClient.test.js test/securityAuditReport.test.js`.
- [x] Запустить `go test ./...`; все тесты должны пройти до Task 5.

### Task 5: Проверить зависимости, секреты и цепочку сборки

**Files:**

- Inspect: `package.json`
- Inspect: `package-lock.json`
- Inspect: `go.mod`
- Inspect: `go.sum`
- Inspect: `.gitignore`
- Inspect: `scripts/*.mjs`
- Inspect: `THIRD_PARTY_NOTICES.md`
- Modify: `test/securityAuditReport.test.js`
- Modify: `docs/security/20260923-project-security-audit.md`

- [x] Проверить lockfile integrity, lifecycle/build scripts, источники пакетов, прямые и транзитивные npm/Go dependencies.
- [x] Выполнить `npm audit --json` для production и полного dependency graph; сохранить в отчёте только итоговые counts, advisory IDs и затронутые версии.
- [x] Снять Go module inventory через `go list -m -json all`; не устанавливать `govulncheck`, если его нет в окружении, а отсутствие advisory scan отметить ограничением.
- [x] Просканировать tracked tree и reachable git history на ключи, токены, private keys, credentials и случайно закоммиченные локальные базы, не копируя секреты в отчёт.
- [x] Проверить `.workspace`, build output, sidecar database и audit artifacts на корректное исключение из Git.
- [x] Проверить воспроизводимость и безопасность build scripts, использование version ranges и наличие неподтверждённых binary artifacts.
- [x] Обновить тест полноты отчёта требованиями dependency, secret и build-chain evidence.
- [x] Запустить `node --test test/securityAuditReport.test.js`.
- [x] Запустить `npm test` и `go test ./...`; все тесты должны пройти до Task 6.

### Task 6: Свести findings и проверить критерии приёмки

**Files:**

- Modify: `docs/security/20260923-project-security-audit.md`
- Modify: `test/securityAuditReport.test.js`
- Modify: `test/securityControls.test.js`

- [x] Удалить дубликаты и для каждого finding подтвердить затронутую доверительную границу и минимальный воспроизводимый сценарий.
- [x] Разделить подтверждённые vulnerabilities, defense-in-depth рекомендации, документационные расхождения и ограничения аудита.
- [x] Приоритизировать remediation: Critical/High сначала, затем Medium/Low; указать зависимости и безопасный порядок исправлений.
- [x] Добавить executive summary, risk register, положительные controls, residual risks и перечень областей, которые не удалось проверить.
- [x] Обновить report-тест, чтобы каждый finding имел evidence, impact, recommendation и корректные file references.
- [x] Обновить security-control tests только для уже существующих защит, выявленных во время сведения результатов.
- [x] Запустить `node --test test/securityAuditReport.test.js test/securityControls.test.js`.
- [x] Запустить полный набор: `npm test`, `npm run typecheck`, `npm run build:renderer`, `go test ./...`, `npm run build:sidecar`, `git diff --check`.
- [x] Выполнить `node --experimental-test-coverage --test test/securityAuditReport.test.js test/securityControls.test.js` и `go test -cover ./...`; подтвердить не менее 80% покрытия новых audit helpers либо явно зафиксировать недостающее покрытие как ограничение.
- [x] Не переходить к Task 7, пока тесты, typecheck и builds не завершатся успешно.

### Task 7: Завершить документацию и подготовить handoff

**Files:**

- Modify: `docs/security/20260923-project-security-audit.md`
- Modify: `test/securityAuditReport.test.js`
- Inspect: `README.md`
- Inspect: `AGENTS.md`

- [x] Проверить, что отчёт не содержит raw-секретов, пользовательских абсолютных путей, непроверенных утверждений или предложений, представленных как уже выполненные исправления.
- [x] Добавить таблицу рекомендуемых follow-up задач с отдельными scopes и verification criteria, не реализуя их.
- [x] Зафиксировать, что production behavior, API, storage schema, зависимости и Electron security settings не изменялись.
- [x] Подтвердить, что README и AGENTS не требуют обновления, поскольку поведение и внутренние правила не меняются.
- [x] Обновить тест отчёта финальными требованиями к summary, risk register, limitations и remediation backlog.
- [x] Запустить `node --test test/documentation.test.js test/securityAuditReport.test.js`.
- [x] Запустить `git diff --check` и проверить итоговый diff только на audit-report и test artifacts.
- [x] Запустить финальный `npm test` и `go test ./...`; все проверки должны пройти.

## Post-Completion

- Отчёт передаётся на human review без автоматического исправления findings.
- Исправления Critical/High оформляются отдельным implementation plan после явного разрешения пользователя.
- Недоступные внешние advisory-базы или отсутствующий `govulncheck` фиксируются как ограничения, а не компенсируются установкой инструментов без разрешения.
- Dynamic fuzzing, code signing/notarization, installer hardening и аудит upstream-кода Electron/any-store рассматриваются отдельно, если они потребуются для release readiness.
