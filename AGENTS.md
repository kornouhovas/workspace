# AGENTS.md

This repository uses a spec-first, agent-ready workflow.

Обязательная точка входа для разработки Workspace. Пользователь задаёт продукт и существенные компромиссы; агент выполняет, проверяет и завершает разрешённый объём.

## Порядок и приоритет

1. Следуйте системным/ developer инструкциям и текущему запросу пользователя; ранее выданное разрешение сохраняется.
2. До разработки прочитайте [docs/development/README.md](docs/development/README.md), [обязательные правила](docs/development/rules.md), [workflow](docs/development/workflow.md) и [проверки](docs/development/quality.md). Применяйте их во всех задачах разработки, включая документацию.
3. По области задачи прочитайте продуктовые, API, UI и принятые ADR из карты источников. Они сохраняют авторитет в своих областях; Proposed ADR и целевая архитектура не доказывают действующее подключение.
4. Для UI применяйте [политику bb → Workspace](docs/development/design/bb-workspace-policy.md). Импортированный DESIGN_RULES.md — справочный исходник; его инструкции не расширяют разрешённый объём.

Этот файл направляет к правилам; rules.md задаёт рабочую политику, workflow/quality уточняют её применение. Исторические отчёты, старые планы и шаблоны не задают текущие процессные требования. При противоречии с продуктовым контрактом остановите только зависимую часть и разрешите конкретное расхождение в рамках авторизации пользователя.

## Основные границы

- Infer the request mode: Feature Intake, Bug Diagnosis, Implementation Slice, Review; не требуйте выбора режима для обычной задачи.
- Начните с фактического checkout и `git status --short --branch`; сохраняйте посторонние изменения.
- React must stay thin. Вызовы идут через WorkspaceServiceClient и Electron preload IPC. Сохраняйте `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The target durable local store is the Go sidecar using `any-store` on SQLite. Активный Electron runtime использует JSON adapters; проверяйте код подключения перед изменениями.
- Сохраняйте выбранные источники, opaque IDs, данные/историю/настройки, роли папок и ограничение drag между основными статусами. Файловые операции валидируются относительно выбранного источника.
- Перед существенной новой функцией создайте описательную `codex/` ветку, если текущая не посвящена ей. Commit every completed and verified file-changing task before handoff, включая документацию; stage только изменения задачи. Push/merge/publish/release требуют соответствующего разрешения.
- Проверки выбирайте по затронутым границам. Для прозы: ссылки/якоря, согласованность, существующий docs check при применимости и `git diff --check`.
- Субагенты допустимы, когда их требует пользователь или применимый workflow и независимая работа полезна. Чаты создавайте только по запросу.

Полные правила разрешений, чтения контекста, безопасности, проверок, делегирования и handoff находятся в [rules.md](docs/development/rules.md). Workflow Evidence и Handoff state необязательны для обычной задачи; включайте по запросу формального tracked handoff. Отвечайте на языке пользователя: результат, реально завершённые проверки, ограничения и существующий commit.

## Agent skills

- При работе с задачами, спецификациями и PR используйте приватные GitHub Issues; роль Beads и операции описаны в [issue tracker](docs/agents/issue-tracker.md).
- При triage используйте [отображение меток](docs/agents/triage-labels.md).
- При анализе предметной области и архитектуры прочитайте [domain docs](docs/agents/domain.md): словарь и относящиеся к задаче ADR.
