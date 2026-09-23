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

### SEC-001: Navigation и IPC sender не ограничены доверенным renderer

- Severity: Medium
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-346
- OWASP: A01:2021 Broken Access Control
- Trust boundary: TB-01, TB-02
- Affected files: `electron/main.js:71`, `electron/main.js:94`, `electron/preload.cjs:40`, `electron/workspaceIpc.js:82`, `electron/workspaceIpc.js:125`
- Evidence: окно загружает локальный renderer с preload, но не регистрирует `will-navigate`, `setWindowOpenHandler` или permission handler; IPC handler принимает `_event` и не проверяет `event.sender`, `senderFrame` или origin. Preload остаётся capability facade для всех 34 workspace methods, включая изменение metadata, preview и reveal. Поиск этих controls в Electron runtime не дал совпадений; allowlist и единственный канал подтверждены `test/securityControls.test.js`.
- Impact: если main frame будет перенаправлен на недоверенный URL (например, после компрометации renderer или будущей ошибки обработки ссылки), загруженный там документ получит тот же preload API и сможет читать сведения о workspace, менять локальные metadata и вызывать filesystem-backed операции в пределах полномочий bridge. Для эксплуатации требуется navigation в недоверенный документ; прямой штатный внешний navigation target в текущем renderer не обнаружен.
- Reproduction: в отдельной тестовой сборке инициировать из renderer `location.assign()` на контролируемую страницу и после загрузки проверить наличие `window.workspace.request`; статический путь подтверждается отсутствием navigation policy и sender/frame validation. Не использовать пользовательскую project folder.
- Recommendation: запрещать все main-frame navigation вне ожидаемого локального renderer URL, отклонять создание новых окон, задавать явный permission request/check handler и в IPC проверять `event.sender`/`senderFrame.url` против текущего `mainWindow.webContents` и локального renderer origin; добавить Electron integration test с доверенным и недоверенным sender.

### SEC-002: Renderer не получает Content Security Policy

- Severity: Informational
- Confidence: High
- Status: Open
- Class: Defense in depth
- CWE: CWE-693
- OWASP: A05:2021 Security Misconfiguration
- Trust boundary: TB-01
- Affected files: `index.html:1`, `vite.config.ts:5`, `electron/main.js:94`
- Evidence: `index.html` не содержит `Content-Security-Policy` meta policy, Electron загружает production renderer через `loadFile`, а runtime не добавляет CSP response headers. Поиск `Content-Security-Policy` по renderer и Electron configuration не дал совпадений. Подтверждённого attacker-controlled HTML/JS injection sink в проверенном renderer graph не найдено.
- Impact: CSP не создаёт дополнительного барьера для выполнения injected script и загрузки неожиданного active content, поэтому будущая XSS или небезопасная зависимость сразу получает доступ к exposed workspace bridge. Самостоятельный exploit без отдельного injection/navigation primitive не подтверждён.
- Reproduction: собрать renderer и проверить итоговый `dist/renderer/index.html`: CSP meta отсутствует; локальная страница не получает HTTP headers из-за `loadFile`.
- Recommendation: добавить строгую production CSP, совместимую с Vite bundle и необходимыми styles/fonts, исключить `unsafe-eval`, ограничить `script-src`, `connect-src`, `img-src` и `frame-src`; проверить packaged build и UI regression tests.

### SEC-003: IPC раскрывает renderer абсолютные пути и внутренние сообщения ошибок

- Severity: Low
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-209
- OWASP: A05:2021 Security Misconfiguration
- Trust boundary: TB-02
- Affected files: `electron/workspaceIpc.js:690`, `electron/workspaceIpc.js:661`, `electron/workspaceIpc.js:1810`, `src/i18n/errors.js:9`, `src/App.tsx:107`, `src/components/workspace/settings-view.tsx:175`
- Evidence: `workspace.getRoot` возвращает `rootPath`/`path`, `workspace.previewFile` возвращает абсолютный `filePath`, а storage corruption error включает полный storage path в `error.message`. Renderer сохраняет неизвестные `Error.message` как opaque message и отображает service errors; Settings явно показывает полный source path. Stack trace явно не возвращается application-кодом, но централизованной sanitization границы ошибок нет.
- Impact: любой код с доступом к bridge узнаёт имя пользователя и структуру локальных директорий, а ошибки могут раскрыть расположение application metadata. Основное усиление impact происходит вместе с SEC-001; для штатного Settings UI раскрытие выбранного пути сейчас является ожидаемым поведением.
- Reproduction: на временном fixture выбрать source folder и вызвать `workspace.getRoot`/`workspace.previewFile`; ответы содержат абсолютный path. Создать повреждённый временный `views.json` и вызвать читающий метод; текст ошибки содержит путь fixture.
- Recommendation: возвращать renderer opaque locator/display name вместо абсолютного path там, где путь не нужен действию пользователя; preview должен возвращать безопасный token или сразу подготовленные данные; на IPC boundary преобразовывать исключения в allowlisted `{code, field, message}` без stack, cause и filesystem paths, сохраняя подробности только в локальном redacted log.

## Electron, renderer и IPC boundary

Проверка охватила `BrowserWindow`, preload facade, main-process dispatcher, renderer import graph, navigation/new-window/permission controls, Content-Security-Policy, payload/error flow и раскрытие path. Production-код не изменялся.

| Контроль | Evidence | Результат |
| --- | --- | --- |
| Process isolation | `electron/main.js:71-87`, `test/runtimeMode.test.js`, `test/securityControls.test.js` | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; небезопасные `webSecurity`, `allowRunningInsecureContent` и `webviewTag` не включены |
| Renderer source | `electron/main.js:94`, `vite.config.ts:7-14` | Загружается локальный built renderer через `loadFile`; `loadURL` не используется |
| Preload surface | `electron/preload.cjs:3-52`, `test/securityControls.test.js` | В main world выставлен только `workspace.request`; method allowlist совпадает с main dispatcher и неизвестный method отклоняется до IPC |
| Main dispatch и payload | `electron/workspaceIpc.js:25-130` и method-specific validators | Main повторно проверяет method, top-level non-object payload нормализуется, обязательные строки/enum/order проверяются в обработчиках; единой schema и общего size limit нет |
| Renderer boundary | `src/main.tsx`, `src/App.tsx`, `src/workspaceRendererTransport.ts`, `src/workspaceServiceClient.js`, `test/rendererBoundary.test.js` | Транзитивный renderer graph не импортирует `electron`, Node builtins, backend, sidecar client или local-open modules |
| sender/frame authorization | `electron/workspaceIpc.js:82-125` | `event` игнорируется, sender/frame/origin не проверяется; finding SEC-001 |
| navigation, windows, permission | `electron/main.js:71-98` | Нет navigation allowlist, `setWindowOpenHandler` и permission request/check handlers; finding SEC-001 |
| Content-Security-Policy и active content | `index.html:1-12`, renderer graph review | CSP отсутствует; прямого attacker-controlled HTML injection или штатной загрузки remote renderer не найдено; finding SEC-002 |
| absolute path и error disclosure | `electron/workspaceIpc.js:661-700,1810-1823`, `src/i18n/errors.js:9-28` | Root/preview responses содержат absolute path, внутренние error messages не централизованно очищаются; finding SEC-003 |
| Stack traces | IPC response construction и renderer error normalization | Application response не добавляет stack, однако Electron serialization не проверялась integration-тестом; это ограничение текущего статического этапа |

Разрешённые методы охватывают чтение дерева и projections, настройку root, CRUD workspace/view/property/value, preview и reveal. Preload и main используют одинаковый явный список. Это ограничивает произвольные IPC channels, но не является authorization для origin: скомпрометированный доверенный renderer по принятой модели угроз может вызвать весь список. Method-specific payload validation существует, однако глубина проверки неоднородна и будет дополнительно проверена на filesystem/storage и sidecar этапах.

## Матрица покрытия

| Область | Компоненты и вопросы | Метод evidence | Задача | Статус |
| --- | --- | --- | --- | --- |
| Electron shell | BrowserWindow, isolation, sandbox, navigation, windows, permissions, CSP | Code review + existing/new tests | Task 2 | Covered |
| Preload и IPC | Exposed API, allowlist, sender/frame, payload, errors | Data-flow review + adversarial tests | Task 2 | Covered |
| Renderer boundary | Imports, transport, path/error disclosure, active content | Static boundary tests + code review | Task 2 | Covered |
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
| 2026-09-23 | Electron, renderer и IPC | Подтверждены isolation, preload/main allowlists и renderer import boundary; зарегистрированы SEC-001—SEC-003 |
