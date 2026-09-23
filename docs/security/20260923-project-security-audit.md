# Аудит безопасности Workspace Project Board

## Метаданные аудита

| Поле | Значение |
| --- | --- |
| Дата начала | 2026-09-23 |
| Базовая ревизия | `7e5add7eb8da7e23317687a3f3ae74bd7e5d197f` |
| Рабочая ветка | `codex/project-security-audit` |
| Состояние checkout на старте | Dirty: 2 изменённых tracked-файла и 37 untracked-объектов, существовавших до аудита; они не входят в scope и не изменяются аудитором |
| Node.js | `v20.18.3` |
| npm | `10.8.2` |
| Go | `go1.26.2 darwin/arm64` |
| Electron | `41.5.0` установлен; диапазон manifest — `^41.5.0` |
| Тип анализа | Статический анализ, локальные тесты и безопасные изолированные fixtures |
| Статус | In progress |

Ревизия фиксирует исходную точку анализа, а не утверждает чистоту рабочего дерева. Все ссылки на файлы в отчёте относительны корню репозитория. Содержимое посторонних untracked-артефактов и пользовательских папок не является источником evidence.

## Цель и границы аудита

Цель — оценить безопасность локального Electron-приложения, Node backend, файловых операций, Go sidecar, SQLite/any-store и цепочки поставки. Итогом должен стать приоритизированный отчёт с воспроизводимыми доказательствами и рекомендациями. Аудит не исправляет уязвимости и не меняет production behavior.

В scope входят:

- Electron main process, BrowserWindow configuration, preload и IPC dispatcher;
- renderer boundary, `WorkspaceServiceClient` и renderer transport;
- входные payload, ошибки и привилегированные workspace operations;
- выбранная project source folder, path validation, symlink и опасные файловые операции;
- transitional JSON metadata, Go sidecar, any-store и SQLite;
- npm/Go dependencies, lockfiles, build scripts и tracked/reachable Git history;
- существующие security controls, их тесты и расхождения между документацией и runtime.

Вне scope без отдельного разрешения:

- исправление findings или рефакторинг production-кода;
- установка новых dependencies и внешних security scanners;
- dynamic fuzzing, penetration testing чужих процессов или сетевых систем;
- аудит upstream-исходников Electron, Chromium, any-store и операционной системы;
- code signing, notarization и installer hardening;
- чтение содержимого пользовательских файлов вне созданных для теста временных каталогов;
- cloud sync, authentication и release/deployment verification, которых нет в текущем MVP.

## Методика

1. Установить фактический runtime и действующие архитектурные контракты, отделяя целевую архитектуру от transitional adapters.
2. Проследить данные через границы `renderer → preload → IPC → backend → filesystem/sidecar → SQLite`.
3. Проверить привилегированные операции adversarial-входами только в изолированных временных fixtures.
4. Зафиксировать существующие защиты characterization/regression-тестами; небезопасное поведение не закреплять как допустимое.
5. Для каждого подтверждённого finding сохранить минимальное evidence, сценарий воспроизведения, impact и конкретную рекомендацию.
6. Проверить dependencies, tracked tree и reachable Git history без вывода raw-секретов.
7. Отделить vulnerabilities от defense-in-depth, расхождений документации, непроверенных гипотез и ограничений аудита.

Evidence считается достаточным, когда оно воспроизводится на зафиксированной ревизии статическим путём или тестом и прямо связывает контролируемый атакующим input с security impact. Отсутствие control само по себе не считается vulnerability без достижимого сценария и влияния.

## Активы

| Актив | Требуемое свойство |
| --- | --- |
| Пользовательские project files | Конфиденциальность и целостность; операции только внутри выбранного source root |
| Workspace metadata и история | Целостность, доступность, корректная область workspace/project/property |
| Абсолютный путь source folder | Конфиденциальность; раскрытие только там, где необходимо runtime |
| SQLite/any-store и transitional JSON | Целостность, восстановимость, безопасные права и миграции |
| Electron privileged process | Изоляция от renderer и минимальный IPC capability surface |
| Локальный sidecar endpoint | Недоступность неавторизованных привилегированных операций и межобластного доступа |
| Build и dependency graph | Целостность, воспроизводимость и отсутствие известных компрометаций |
| Локальные credentials и secrets | Неразглашение в tree, history, логах, ошибках и audit artifacts |

## Доверительные границы

| ID | Граница | Недоверенная сторона | Привилегированная сторона | Основной риск |
| --- | --- | --- | --- | --- |
| TB-01 | Renderer → preload | DOM, UI state, active content | Изолированный preload | Расширение API или доступ к Node/Electron primitives |
| TB-02 | Preload → IPC main | Renderer-controlled method/payload | Main dispatcher | Вызов неразрешённого метода, spoofed sender/frame, утечка ошибок |
| TB-03 | IPC/backend → filesystem | Relative paths и metadata | Node filesystem/open/spawn | Traversal, symlink escape, TOCTOU, destructive access |
| TB-04 | Backend → transitional stores | Runtime inputs и повреждённые JSON | Settings/views/properties adapters | Corruption, lost update, unsafe migration/recovery |
| TB-05 | Node client → Go sidecar | Локальный HTTP request | Sidecar handlers и any-store | Cross-workspace access, request abuse, local-process/browser attack |
| TB-06 | Sidecar → SQLite | Documents и identifiers | Database file | Scope violation, corruption, unsafe permissions, internal error leak |
| TB-07 | Repository/build → application | Packages, scripts, artifacts | Developer/runtime environment | Supply-chain compromise и secret inclusion |

## Источники входных данных

- renderer-controlled service method names, JSON payloads, IDs, names, relative paths, filters и property values;
- DOM/URL/navigation state и содержимое файлов, отображаемое или открываемое приложением;
- выбранный пользователем абсолютный source-folder path и дерево каталогов под ним;
- имена файлов, separator/encoding edge cases, symlinks и изменения файловой системы между проверкой и использованием;
- transitional JSON, SQLite/any-store documents, schema versions и повреждённые metadata;
- HTTP method, headers, body и connection behavior локального sidecar;
- package manifests, lockfiles, lifecycle/build scripts, environment и Git-tracked/history content;
- сообщения об ошибках от Node, Electron, Go, filesystem и database layers.

## Модель атакующего

Рассматриваются следующие атакующие:

- владелец или поставщик вредоносной выбранной папки, способный создавать имена, файлы и symlinks;
- скомпрометированный renderer, способный вызывать весь API, доступный через preload, с произвольными payload;
- вредоносная веб-страница или navigation target, загруженная в окно из-за ошибки конфигурации;
- непривилегированный посторонний локальный процесс, способный подключаться к локальному HTTP endpoint;
- локальный пользователь или сбой, оставивший повреждённые, устаревшие либо future-schema metadata;
- скомпрометированный npm/Go package, lifecycle script или неподтверждённый binary artifact;
- разработчик, случайно добавивший credentials, локальную базу или чувствительный artifact в Git.

Не предполагается защита от администратора/root с полным контролем хоста, физической компрометации разблокированного устройства или модифицированного исполняемого файла после доверенной установки.

## Предположения и ограничения

- Аудит выполняется на macOS arm64 в одном локальном checkout; платформенные различия Windows/Linux требуют отдельной проверки.
- Тесты опасных операций используют только временные fixtures и не меняют пользовательские project folders.
- Renderer считается потенциально скомпрометированным; `contextIsolation` и sandbox уменьшают, но не устраняют необходимость авторизации IPC.
- Localhost не считается доверенной границей: другой локальный процесс и, при подходящих browser controls, веб-страница могут пытаться обращаться к endpoint.
- Accepted ADR описывают намеренный контракт, но finding основывается на активном коде и воспроизводимом evidence.
- ADR-004 имеет статус Proposed и не считается действующей реализацией identity/migration controls.
- На этом этапе внешние advisory-сервисы и scanners не запускались; их доступность будет проверена в dependency-задаче.
- Непроверенная гипотеза помечается как limitation или follow-up и не получает severity подтверждённой vulnerability.

## Классификация риска

Допустимые severity:

- `Critical` — надёжно достижимая компрометация ключевых активов с максимальным impact и без существенных предварительных условий;
- `High` — серьёзная компрометация конфиденциальности, целостности или выполнения привилегированных операций;
- `Medium` — существенный impact при дополнительных условиях либо ограниченном blast radius;
- `Low` — небольшой, локализованный security impact;
- `Informational` — hardening, положительный control, расхождение или наблюдение без доказанной эксплуатации.

Допустимые confidence: `High`, `Medium`, `Low`. Confidence отражает качество evidence, а не impact. OWASP-классификация выбирается по релевантному проекту (например, ASVS, Top 10 или Electron guidance), CWE используется для типа слабости.

## Шаблон finding

Каждый подтверждённый finding добавляется в раздел «Findings» в следующем формате:

```markdown
### SEC-001: Краткое название

- Severity: High
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-000
- OWASP: категория или N/A с объяснением
- Trust boundary: TB-00
- Affected files: `relative/path.js:line`
- Evidence: минимальное наблюдение, test/command и безопасный результат без raw-секретов
- Impact: затронутый актив и реальное последствие
- Reproduction: минимальные безопасные шаги на временном fixture
- Recommendation: конкретное исправление и способ его проверки
```

ID имеет формат `SEC-NNN`, уникален и после публикации не переиспользуется. Допустимые status: `Open`, `Accepted`, `Mitigated`, `False positive`. Допустимые class: `Vulnerability`, `Defense in depth`, `Documentation gap`, `Limitation`. File references должны быть относительными и указывать только файлы репозитория.

## Findings

На этапе определения scope подтверждённые findings ещё не зарегистрированы. Последующие задачи добавляют их только после проверки evidence.

## Матрица покрытия

| Область | Компоненты и вопросы | Метод evidence | Задача | Статус |
| --- | --- | --- | --- | --- |
| Electron shell | BrowserWindow, isolation, sandbox, navigation, windows, permissions, CSP | Code review + existing/new tests | Task 2 | Planned |
| Preload и IPC | Exposed API, allowlist, sender/frame, payload, errors | Data-flow review + adversarial tests | Task 2 | Planned |
| Renderer boundary | Imports, transport, path/error disclosure, active content | Static boundary tests + code review | Task 2 | Planned |
| Filesystem | Path resolution, traversal, symlink, TOCTOU, open/spawn/delete | Temporary fixtures + source tracing | Task 3 | Planned |
| Local metadata | JSON permissions, atomicity, backup, schema, concurrency | Adapter review + isolated corruption tests | Task 3 | Planned |
| Go sidecar HTTP | Bind/auth, methods, content type, body limits, timeout, shutdown | Handler/client tests + code review | Task 4 | Planned |
| any-store/SQLite | ID and scope validation, soft delete/history, permissions, errors | Store tests + document-flow review | Task 4 | Planned |
| Dependencies | npm/Go graph, lock integrity, advisories, lifecycle scripts | Manifest/lock review + available native tooling | Task 5 | Planned |
| Secrets | Tracked tree, reachable history, generated/local artifacts | Pattern/entropy-oriented scan with redacted output | Task 5 | Planned |
| Build configuration | Scripts, version ranges, binary artifacts, reproducibility | Script and artifact provenance review | Task 5 | Planned |

Статусы coverage: `Planned`, `In progress`, `Covered`, `Limited`. `Covered` означает, что evidence и выводы внесены в отчёт; это не означает отсутствия findings.

## Правила работы с доказательствами

- Ссылки содержат relative path и, где возможно, line number или test name.
- Команды описываются без абсолютных пользовательских путей, токенов и содержимого приватных файлов.
- Обнаруженный возможный secret не копируется: фиксируются только тип, расположение, commit и redacted fingerprint.
- Security impact не выводится только из документации; активный runtime проверяется отдельно.
- Негативный результат scanner не заменяет ручную проверку trust boundaries.
- Ошибка или недоступность инструмента фиксируется как limitation, а не как успешная проверка.

## Журнал проверки

| Дата | Область | Результат |
| --- | --- | --- |
| 2026-09-23 | Scope и baseline | Зафиксированы ревизия, dirty-state, toolchain, модель угроз, finding contract и coverage matrix |
