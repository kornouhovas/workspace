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
| Статус | Готов к human review; remediation не выполнялась |

Ревизия фиксирует исходную точку анализа, а не утверждает чистоту рабочего дерева. Все ссылки на файлы в отчёте относительны корню репозитория. Содержимое посторонних untracked-артефактов и пользовательских папок не является источником evidence.

## Executive summary

Аудит выявил 18 уникальных findings: 0 High, 5 Medium, 6 Low и 7 Informational; Critical findings не обнаружены. Одиннадцать findings являются подтверждёнными vulnerabilities, шесть — defense-in-depth рекомендациями и одно — расхождением документации с ещё не подключённым sidecar-контрактом. Для активного Electron runtime наиболее приоритетны привилегированный reveal (SEC-005) и утечка file descriptors при preview (SEC-010). До включения Go sidecar в production transport необходимо закрыть authentication/origin boundary (SEC-011) и cross-workspace ownership (SEC-013). Отсутствующие navigation/sender controls (SEC-001) и известные advisories без подтверждённого project-specific exploit path (SEC-016) остаются обязательным hardening до расширения navigation surface или release, но не считаются подтверждёнными vulnerabilities текущего runtime.

Существующие controls существенно ограничивают blast radius: Electron включает isolation и sandbox, preload/main используют совпадающие allowlists, renderer не импортирует Node/backend modules, path helpers блокируют lexical traversal и стабильные symlink escapes, JSON writes используют atomic replacement, а sidecar по умолчанию слушает ephemeral loopback address. Это не компенсирует findings, зависящие от скомпрометированного renderer, конкурентного изменения filesystem или другого локального процесса.

Аудит не менял production behavior и не доказывает release readiness. Dynamic fuzzing, multi-platform behavior, packaged sidecar lifecycle, code signing/notarization, внешний Go advisory scan и upstream-аудит dependencies остались вне проверенной области.

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

- Severity: Informational
- Confidence: High
- Status: Open
- Class: Defense in depth
- CWE: CWE-346
- OWASP: A01:2021 Broken Access Control
- Trust boundary: TB-01, TB-02
- Affected files: `electron/main.js:71`, `electron/main.js:94`, `electron/preload.cjs:40`, `electron/workspaceIpc.js:82`, `electron/workspaceIpc.js:125`
- Evidence: окно загружает локальный renderer с preload, но не регистрирует `will-navigate`, `setWindowOpenHandler` или permission handler; IPC handler принимает `_event` и не проверяет `event.sender`, `senderFrame` или origin. Preload остаётся capability facade для всех 34 workspace methods, включая изменение metadata, preview и reveal. Поиск этих controls в Electron runtime не дал совпадений; allowlist и единственный канал подтверждены `test/securityControls.test.js`.
- Impact: прямой штатный внешний navigation target в текущем renderer не обнаружен, а скомпрометированный trusted renderer уже может вызвать весь preload API до navigation; поэтому дополнительная privilege escalation в текущем runtime не доказана. Отсутствующие controls увеличат blast radius, если будущая ссылка, rich preview или ошибка routing позволит загрузить недоверенный документ в тот же `webContents`.
- Reproduction: статически подтвердить отсутствие navigation/window/permission policy и sender/frame validation. Отдельная тестовая сборка с `location.assign()` может подтвердить, что недоверенный документ наследует bridge, но это проверка отсутствующего control, а не воспроизведение достижимого текущего exploit path. Не использовать пользовательскую project folder.
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

### SEC-004: Canonical-path проверка отделена от использования файла

- Severity: Medium
- Confidence: Medium
- Status: Open
- Class: Vulnerability
- CWE: CWE-367
- OWASP: A01:2021 Broken Access Control
- Trust boundary: TB-03
- Affected files: `src/localOpen.js:48`, `src/localOpen.js:77`, `src/workspaceBackend.js:170`, `src/workspaceBackend.js:567`, `src/workspaceBackend.js:605`, `src/workspaceBackend.js:640`
- Evidence: `resolveExistingWorkspacePath` проверяет `existsSync` и canonical target через `realpathSync`, но возвращает исходный lexical path. Затем отдельные `statSync`, `readdir`, `createReadStream` или `spawn` повторно разрешают этот path. Рекурсивный scan также строит следующий lexical path из ранее полученного `Dirent`. Ни file descriptor, ни inode не удерживаются между validation и use.
- Impact: процесс, способный менять вредоносную выбранную папку, может попытаться заменить проверенный файл или каталог symlink между проверкой и использованием и добиться чтения имён/файла либо открытия объекта вне выбранного root. Успешность зависит от race timing; стабильный exploit в рамках безопасного аудита не запускался.
- Reproduction: на полностью временном fixture циклически менять in-root target между обычным объектом и symlink на отдельный temporary outside-root, параллельно вызывая list/preview/reveal; фиксировать только факт обращения к outside inode. Не использовать пользовательские каталоги.
- Recommendation: выполнять operation по уже открытому descriptor и проверять descriptor-resolved identity, либо использовать platform-safe open-at/no-follow traversal для каждого сегмента; для spawn передавать проверенный descriptor-backed target или повторно проверять inode непосредственно перед operation. Добавить deterministic race harness с временными fixtures.

### SEC-005: `workspace.reveal` может запускать macOS application bundle

- Severity: Medium
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-749
- OWASP: A01:2021 Broken Access Control
- Trust boundary: TB-02, TB-03
- Affected files: `electron/preload.cjs:36`, `electron/workspaceIpc.js:657`, `src/localOpen.js:64`, `src/localOpen.js:77`
- Evidence: `kind: "directory"` принимает любой directory внутри source root, а `getMacOpenCommand` независимо от kind выполняет `open <target>`. Безопасный stub-fixture с каталогом `Untrusted.app` вернул status 200 и зафиксировал аргументы `open <fixture>/root/Untrusted.app`; shell не используется. В текущем renderer нет call site для `reveal`, но метод доступен через preload allowlist.
- Impact: скомпрометированный renderer может без отдельного main-process подтверждения попросить LaunchServices запустить подготовленный application bundle из вредоносной выбранной папки, превращая renderer compromise в запуск native-кода от имени пользователя. Требуются одновременно доступ к bridge и наличие подходящего bundle внутри source root.
- Reproduction: создать пустой `Untrusted.app` только во временном fixture и вызвать `createRevealResponse` с injected `spawnCommand`; проверить, что был бы вызван `open` с bundle path, не запуская приложение.
- Recommendation: реализовать именно reveal-in-Finder (`shell.showItemInFolder` или эквивалент с явной семантикой), запретить executable/application/package targets, привязать вызов к подтверждённому user gesture и добавить main-process confirmation для потенциально запускаемых типов.

### SEC-006: Локальные metadata и SQLite создаются без явных restrictive permissions

- Severity: Low
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-732
- OWASP: A01:2021 Broken Access Control
- Trust boundary: TB-04, TB-06
- Affected files: `src/workspaceBackend.js:511`, `src/workspacePropertyStore.js:155`, `electron/workspaceIpc.js:1779`, `cmd/workspace-sidecar/main.go:24`, `internal/workspacestore/store.go:142`
- Evidence: JSON adapters вызывают `mkdir`/`writeFile` без `mode`; temporary file после `rename` становится metadata-файлом с правами, определёнными umask. На текущем audit host временный `settings.json` был создан с mode `0644`. Sidecar передаёт default `workspace.db` или произвольный `-db` path в `any-store` без `chmod`; в temporary-каталоге с mode `0700` SQLite database, WAL и SHM были созданы с mode `0644`. Активный Electron transport sidecar не запускает, поэтому фактический packaged location пока не определён.
- Impact: если родительские каталоги доступны другим локальным accounts/processes, они могут читать source path, workspace/view/property metadata и историю. Ограничивающие права домашнего каталога часто уменьшают риск, но приложение само не обеспечивает требуемую конфиденциальность.
- Reproduction: с default umask создать JSON metadata и запустить sidecar с `-db` во временном каталоге; проверить только mode через `stat`. На проверенном host JSON, SQLite, WAL и SHM получили `0644`; содержимое в evidence не копировать.
- Recommendation: создавать metadata directories с `0700`, temporary/final JSON и SQLite с `0600`, проверять/исправлять права существующих файлов при безопасной миграции и добавить platform-aware permission tests; Windows ACL рассматривать отдельно.

### SEC-007: Future-schema metadata принимаются с потерей неизвестных данных

- Severity: Low
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-20
- OWASP: A08:2021 Software and Data Integrity Failures
- Trust boundary: TB-04
- Affected files: `src/workspacePropertyStore.js:123`, `src/workspacePropertyStore.js:133`, `electron/workspaceIpc.js:1760`, `src/workspaceBackend.js:430`
- Evidence: property store не проверяет входной `schemaVersion`, всегда возвращает version 1 и нормализует только известные top-level collections; view store и settings не имеют version gate. На временном fixture документ `schemaVersion: 99` с неизвестным top-level полем после обычного save был переписан как version 1, а неизвестное поле исчезло. Синтаксически corrupt JSON при этом корректно отклоняется и сохраняется без перезаписи.
- Impact: запуск старой версии приложения над metadata от будущей версии или расширения может тихо уничтожить неподдерживаемые поля и привести к необратимой потере локального состояния после следующей записи.
- Reproduction: во временном property-store JSON задать future `schemaVersion` и marker-поле, затем сохранить отдельное свойство штатным adapter API; повторное чтение файла показывает version 1 без marker.
- Recommendation: отклонять версии выше поддерживаемой до любых записей, валидировать shape по версии, выполнять явные idempotent migrations с backup и сохранять неизвестные данные только по документированному forward-compatibility контракту.

### SEC-008: Защита от concurrent lost update действует только внутри одного adapter instance

- Severity: Low
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-362
- OWASP: A04:2021 Insecure Design
- Trust boundary: TB-04
- Affected files: `src/workspaceBackend.js:489`, `src/workspacePropertyStore.js:5`, `electron/workspaceIpc.js:86`, `electron/workspaceIpc.js:1691`
- Evidence: view/property stores сериализуют операции через in-memory Promise только внутри одного созданного instance; settings writer не имеет очереди или file lock. Два property-store instance на одном temporary path одновременно сохранили разные документы, но итоговый JSON содержал только один из них. Atomic rename предотвращает partial JSON, но не lost update между readers/writers.
- Impact: два Electron instance, повторно созданные handlers или иной конкурентный writer могут молча терять корректные metadata. Скомпрометированный renderer в одном handler имеет меньший blast radius благодаря per-instance queue, но multi-process/external coordination отсутствует.
- Reproduction: создать два `createFilePropertyStore` для одного temporary path и одновременно сохранить разные IDs; после завершения проверить число IDs, не используя production metadata.
- Recommendation: назначить single-writer ownership, добавить межпроцессный lock или transactional store с compare-and-swap/revision, включить revision в schema и тестировать concurrent writers из независимых instances/processes.

### SEC-009: Preview allowlist включает active-content форматы без отдельной policy

- Severity: Informational
- Confidence: High
- Status: Open
- Class: Defense in depth
- CWE: CWE-434
- OWASP: A05:2021 Security Misconfiguration
- Trust boundary: TB-01, TB-03
- Affected files: `src/localOpen.js:5`, `src/workspaceBackend.js:25`, `src/workspaceBackend.js:170`, `electron/workspaceIpc.js:661`
- Evidence: extension allowlist включает `HTML/SVG/XML/JS` и CSS наряду с изображениями/media; response возвращает absolute `filePath` и browser-oriented content type, но не задаёт isolated preview origin, CSP или download-only disposition. В текущем renderer вызовов `previewFile`/`reveal` не найдено кроме client API и тестов, поэтому штатный active-content render path сейчас не подтверждён.
- Impact: control не создаёт самостоятельной эксплуатации в текущем UI, но будущий preview component может загрузить attacker-controlled active content в Electron context и объединить риск с SEC-001/SEC-002.
- Reproduction: статически сравнить allowlist и content-type map, затем подтвердить отсутствие renderer call site; active HTML не загружать в application window.
- Recommendation: оставить в inline-preview allowlist только passive formats, преобразовывать text/markdown в inert text, SVG/XML sanitise или отдавать как download, а любой rich preview изолировать в отдельном origin/webContents без preload, navigation и permissions.

### SEC-010: IPC preview создаёт и теряет незакрытый file stream

- Severity: Medium
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-772
- OWASP: A04:2021 Insecure Design
- Trust boundary: TB-02, TB-03
- Affected files: `src/workspaceBackend.js:170`, `src/workspaceBackend.js:185`, `electron/workspaceIpc.js:661`
- Evidence: `createFileResponse` создаёт `createReadStream(filePath)`, но IPC branch возвращает только `filePath` и `contentType`, теряя ссылку на stream без чтения или `destroy`. На временном fixture 80 вызовов открыли 80 дополнительных descriptors; явный `destroy` вернул descriptor count к baseline. Через IPC renderer не получает stream и не может закрыть его.
- Impact: renderer с bridge-доступом может повторять preview requests до исчерпания file descriptors и отказа main process или других файловых операций. Race удаления между `statSync` и asynchronous stream open также может породить необработанную stream error.
- Reproduction: на temporary text file многократно вызвать `createFileResponse`, дождаться `open`, сравнить descriptor count и затем обязательно уничтожить все streams для очистки fixture.
- Recommendation: не создавать stream в metadata-only IPC route; если preview должен передавать bytes, владеть lifecycle в main process, добавить error/close handlers, size/rate limits и гарантированный cleanup. Добавить regression test, подтверждающий отсутствие роста descriptors.

### SEC-011: Sidecar принимает неаутентифицированные запросы от локальных клиентов и browser origins

- Severity: Medium
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-306
- OWASP: A07:2021 Identification and Authentication Failures
- Trust boundary: TB-05
- Affected files: `cmd/workspace-sidecar/main.go:23`, `cmd/workspace-sidecar/main.go:35`, `cmd/workspace-sidecar/main.go:44`, `src/workspaceSidecarClient.js:1`
- Evidence: default bind — loopback `127.0.0.1:0`, что исключает обычный внешний network access, но listener может быть переопределён через `-addr`. Handler не проверяет session secret, `Authorization`, `Host` или `Origin`. CORS response headers отсутствуют, поэтому обычный cross-origin JavaScript не читает ответы и preflight блокирует PUT/PATCH/DELETE; однако POST handlers декодируют JSON независимо от `Content-Type`, и browser может отправить simple `no-cors` POST с `text/plain` после обнаружения порта. Любой локальный процесс с доступом к порту может читать root path и менять все sidecar metadata.
- Impact: вредоносная локальная программа, а при port discovery и web origin — blind POST, может создавать или изменять metadata без участия пользователя. Если `-addr` выставлен на non-loopback interface, тот же capability становится доступен сети. Риск ограничен тем, что текущий Electron runtime sidecar автоматически не запускает.
- Reproduction: запустить sidecar только с temporary database, определить выведенный loopback port и отправить POST `/workspace/properties` с валидным JSON body и `Content-Type: text/plain`; mutation принимается без credential или Origin check. Production database не использовать.
- Recommendation: lifecycle должен генерировать per-launch cryptographic bearer secret и передавать его Node client через непубличный канал; проверять secret constant-time на каждом route, фиксировать loopback bind без unrestricted override в production, проверять Host/Origin и отклонять non-JSON mutation requests. Добавить integration tests для отсутствующего/неверного token и browser-style request.

### SEC-012: HTTP server не ограничивает body и connection lifetime

- Severity: Low
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-400
- OWASP: A04:2021 Insecure Design
- Trust boundary: TB-05
- Affected files: `cmd/workspace-sidecar/main.go:35`, `cmd/workspace-sidecar/main.go:41`, `cmd/workspace-sidecar/main.go:56`, `cmd/workspace-sidecar/main.go:85`
- Evidence: server запускается через `http.Serve(listener, mux)` без `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout` или `IdleTimeout`; request bodies читаются напрямую через `json.Decoder` без `http.MaxBytesReader`. Decoder вызывается один раз, поэтому trailing JSON после первого значения не проверяется. Signal handling и `Server.Shutdown` отсутствуют; `log.Fatal(http.Serve(...))` завершает process через `os.Exit`, из-за чего отложенный `store.Close` не выполняется при возврате Serve.
- Impact: клиент, достигший endpoint, может удерживать connections или послать чрезмерный body и исчерпать память/descriptors, вызывая отказ локального storage service; abrupt shutdown увеличивает риск незавершённого checkpoint/cleanup. Default loopback и отсутствие packaged lifecycle ограничивают blast radius.
- Reproduction: только на отдельной temporary database открыть медленный/неограниченный request к mutation route и наблюдать отсутствие server deadline; для parser отдельно отправить два последовательных JSON values и проверить, что первый принимается. Не выполнять нагрузочный тест против пользовательского процесса.
- Recommendation: использовать явный `http.Server` с conservative timeouts и `MaxHeaderBytes`, оборачивать bodies в `http.MaxBytesReader`, требовать ровно один JSON value и EOF, ограничивать concurrency, обрабатывать SIGINT/SIGTERM через `Shutdown`, затем закрывать/flush store с bounded context.

### SEC-013: Глобальные document IDs позволяют перезапись между workspace scopes

- Severity: Medium
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-639
- OWASP: A01:2021 Broken Access Control
- Trust boundary: TB-05, TB-06
- Affected files: `cmd/workspace-sidecar/main.go:181`, `cmd/workspace-sidecar/main.go:411`, `cmd/workspace-sidecar/main.go:431`, `cmd/workspace-sidecar/main.go:508`, `internal/workspacestore/store.go:218`, `internal/workspacestore/store.go:432`
- Evidence: `/workspace/views` PUT передаёт client-controlled `id` и `workspaceId` прямо в global `views` collection. `UpsertView` не проверяет существующего owner, поэтому повторный ID заменяет документ другого workspace. Property create проверяет duplicate ID только среди `ListPropertyDefinitions(targetWorkspace)`, после чего global upsert с тем же ID может заменить property другого workspace. Напротив, active-view и reorder paths проверяют workspace ownership, а list methods фильтруют по `workspaceId`; эти положительные controls подтверждены Go tests. `projectId` для property value проверяется только на непустоту и не связывается с registry/source folder.
- Impact: collision или атакующий internal caller может переназначить view/property другому workspace, скрыть исходный документ из его scoped list и нарушить ссылки/active state. Произвольный `projectId` создаёт orphan или неверно scoped values. Отсутствие authentication в SEC-011 делает exploit прямым для любого достигшего sidecar клиента.
- Reproduction: в temporary database сохранить view с ID `view:shared` в workspace A, затем PUT документа с тем же ID и workspace B; `GetView` возвращает B, а list A теряет исходный view. Этот unsafe case не закрепляется regression-тестом как допустимый behavior.
- Recommendation: определить глобально уникальные opaque server-generated IDs либо composite storage key `(workspaceId, id)`; перед каждым update/upsert проверять immutable ownership, существование workspace/project/property и согласованность всех references. Добавить rejection tests для cross-workspace collision и orphan project IDs после исправления.

### SEC-014: Sidecar возвращает клиенту raw parser и storage errors

- Severity: Low
- Confidence: High
- Status: Open
- Class: Vulnerability
- CWE: CWE-209
- OWASP: A05:2021 Security Misconfiguration
- Trust boundary: TB-05, TB-06
- Affected files: `cmd/workspace-sidecar/main.go:56`, `cmd/workspace-sidecar/main.go:1418`, `src/workspaceSidecarClient.js:12`
- Evidence: malformed JSON responses содержат `json.Decoder` error verbatim, а `writeResult` возвращает любой `any-store`/SQLite `err.Error()` как JSON `error`; Node client затем выбрасывает эту строку без sanitization. Non-JSON response body клиент не отражает и использует generic method error, что подтверждено `test/sidecarClient.test.js`.
- Impact: достигший endpoint клиент может получить детали parser, database schema/path или внутреннего состояния, полезные для дальнейшей атаки; при проксировании через IPC эти сведения могут дойти до renderer. Самостоятельный высокий impact не подтверждён.
- Reproduction: на temporary sidecar отправить malformed JSON и вызвать storage error на invalid/corrupt fixture; сравнить ответ с исходным internal error, не копируя абсолютный path в audit artifacts.
- Recommendation: логировать подробную ошибку только в privileged process с redaction, наружу возвращать стабильный code и безопасное сообщение; различать validation 4xx и internal 5xx, добавить correlation ID и tests, запрещающие path/schema leakage.

### SEC-015: Property history не является append-only на sidecar boundary

- Severity: Informational
- Confidence: High
- Status: Open
- Class: Documentation gap
- CWE: CWE-778
- OWASP: A09:2021 Security Logging and Monitoring Failures
- Trust boundary: TB-05, TB-06
- Affected files: `cmd/workspace-sidecar/main.go:65`, `cmd/workspace-sidecar/main.go:156`, `internal/workspacestore/store.go:637`, `docs/data-model.md:616`, `docs/api/workspace-properties.md:502`
- Evidence: store предоставляет `AppendPropertyHistory`, но реализация использует обычный global upsert по caller-controlled ID, поэтому повтор ID перезапишет событие. Sidecar routes для property/value create, update и delete не вызывают history method; HTTP route чтения history также отсутствует. При этом контракт требует append-only history и запись history при mutation. `ListPropertyHistory` корректно фильтрует по workspace и сортирует события; это подтверждено `internal/workspacestore/store_test.go`.
- Impact: если sidecar станет активным durable transport без дополнительного orchestration, изменения и удаления properties/values не создадут полный audit trail, а collision history ID может изменить прошлое. Сейчас Electron использует transitional JSON adapters, поэтому это расхождение целевой архитектуры, а не подтверждённая потеря истории в активном runtime.
- Reproduction: на temporary store дважды вызвать `AppendPropertyHistory` с одним ID и разным payload либо выполнить sidecar property mutation и проверить отсутствие нового history event.
- Recommendation: генерировать history IDs server-side, использовать insert-only constraint с duplicate rejection и атомарно записывать current document + history event в одной transaction; покрыть каждый mutation контрактным тестом до переключения Electron на sidecar.

### SEC-016: Locked npm graph содержит известные high-severity advisories

- Severity: Informational
- Confidence: High
- Status: Open
- Class: Defense in depth
- CWE: CWE-1395
- OWASP: A06:2021 Vulnerable and Outdated Components
- Trust boundary: TB-07
- Affected files: `package.json:20`, `package.json:43`, `package-lock.json:1`
- Evidence: `npm audit --json --omit=dev` для locked production graph вернул 15 affected packages: 8 high, 4 moderate и 3 low; полный `npm audit --json` вернул 18: 11 high, 4 moderate и 3 low. Exact affected versions и advisory IDs перечислены в разделе dependency evidence. Production-classified advisories в основном достигаются через прямую dependency `shadcn@4.7.0`, которая не импортируется application source или build scripts. Electron advisories относятся к custom `ProtocolResponse.url` и sandboxed iframe popup paths, которых в приложении нет; `extract-zip` используется при получении Electron package, а не для application-controlled archives. Vite используется для build, не dev server, и зафиксированные Vite advisories относятся к Windows-specific dev-server paths. Registry severity подтверждена, но attacker-controlled input до уязвимых операций текущего проекта не прослежен.
- Impact: известный vulnerable graph увеличивает риск install/build/release и может стать достижимым при добавлении соответствующей runtime или tooling functionality, однако текущий project-specific exploit path не подтверждён. Это dependency hardening и release gate, а не доказанная High vulnerability приложения; registry severity не переносится автоматически в project severity.
- Reproduction: на зафиксированном `package-lock.json` выполнить production и full `npm audit --json`, сохранить только counts, advisory IDs и installed versions, подтвердить dependency roots через `npm explain`, затем сопоставить advisory prerequisites с фактическими imports, build scripts и Electron features. Audit exit code 1 подтверждает advisory presence, но не exploitability.
- Recommendation: удалить неиспользуемый `shadcn` из runtime dependencies либо перенести CLI tooling в dev-only workflow, обновить Electron/Vite и уязвимые transitive chains до исправленных версий, пересоздать lockfile контролируемым change, затем повторить оба audit, полный test/typecheck/build и Electron smoke test.

### SEC-017: SQLite и audit-runner artifacts не покрыты ignore policy

- Severity: Informational
- Confidence: High
- Status: Open
- Class: Defense in depth
- CWE: CWE-200
- OWASP: A05:2021 Security Misconfiguration
- Trust boundary: TB-07
- Affected files: `.gitignore:1`, `cmd/workspace-sidecar/main.go:24`
- Evidence: `.gitignore` исключает `.workspace/`, `node_modules/`, `build/`, `dist/` и root sidecar binaries, но `git check-ignore` не исключает default `workspace.db`, его `-wal`/`-shm`, `.ralphex/` или сохраняемый вручную `npm-audit.json`. В текущем tracked tree и reachable history таких runtime/audit artifacts не найдено, поэтому фактическая утечка не подтверждена.
- Impact: случайный `git add` может сохранить SQLite metadata, абсолютные пути, audit logs или advisory output. Это потенциальное раскрытие, а не текущая vulnerability: проверенные artifacts остаются untracked и raw audit output в repository не сохранялся.
- Reproduction: проверить representative paths через `git check-ignore -v`, затем искать tracked и historical names через `git ls-files` и `git rev-list --objects --all`; не открывать пользовательскую database.
- Recommendation: добавить узкие root/project patterns для фактического sidecar database, WAL/SHM и локального audit-runner output; не использовать широкий `*.db`, если repository должен хранить test fixtures, и добавить CI-check, запрещающий неожиданные runtime databases/secrets.

### SEC-018: Install/build chain не имеет полного hermetic provenance

- Severity: Informational
- Confidence: High
- Status: Open
- Class: Defense in depth
- CWE: CWE-829
- OWASP: A08:2021 Software and Data Integrity Failures
- Trust boundary: TB-07
- Affected files: `package.json:7`, `package.json:20`, `package-lock.json:1`, `scripts/build-renderer.mjs:1`, `scripts/disable-fsevents-loader.mjs:1`
- Evidence: lockfile v3 фиксирует все 646 package entries с sha512 integrity и единственным source host `registry.npmjs.org`; `go mod verify` проходит, Go graph имеет exact versions и не содержит replacements. При этом 28 из 29 direct npm requirements используют caret ranges, `packageManager`/`engines` не заданы, а normal install допускает lifecycle scripts у Electron, esbuild и MSW (lock также маркирует fsevents). Root build scripts используют local Vite/Go tools и fixed output paths, но не формируют checksums, SBOM или provenance attestation. Tracked tree содержит только 154 PNG и 7 JPEG evidence/design assets, без executable mode и без Mach-O/ELF/PE artifacts.
- Impact: lockfile и integrity существенно уменьшают дрейф, однако смена package-manager semantics, разрешённое обновление lockfile или compromised lifecycle package может изменить install/build result и выполнить код в developer/CI context. Неподтверждённого executable artifact в Git не найдено; finding относится к hardening/release provenance.
- Reproduction: проверить manifest ranges и scripts, агрегировать `packages[*].resolved`, `integrity` и `hasInstallScript` из lockfile, выполнить `npm ci --ignore-scripts --dry-run --audit=false`, `go mod verify` и inventory tracked file modes/magic без запуска downloaded binaries.
- Recommendation: зафиксировать поддерживаемые Node/npm через `engines` и `packageManager`, использовать `npm ci` на clean CI, review/allowlist lifecycle scripts, разделить runtime и tooling dependencies, генерировать checksums/SBOM/provenance для release artifacts и проверять их до публикации.

## Сведение и классификация findings

Все 18 IDs проверены на дублирование по root cause, trust boundary, затронутому активу и минимальному сценарию воспроизведения. Дубликатов не осталось. Похожие наблюдения сохранены отдельно только там, где remediation и граница различаются: SEC-003 относится к Electron IPC, а SEC-014 — к sidecar HTTP; SEC-001 ограничивает доверие к renderer, а SEC-011 — к локальному HTTP-клиенту; SEC-004 описывает TOCTOU, тогда как SEC-010 — детерминированную утечку ресурса. Общая проблема permissions для JSON и SQLite уже объединена в SEC-006.

Каждый finding содержит Trust boundary и минимальный Reproduction. Сценарии с race, native launch, resource exhaustion или повреждением данных описаны для isolated temporary fixture и не выполняются над пользовательскими данными.

| Class | Findings | Интерпретация |
| --- | --- | --- |
| Vulnerability | SEC-003—SEC-008, SEC-010—SEC-014 | Достижимый security или data-safety impact подтверждён статическим путём либо безопасным fixture |
| Defense in depth | SEC-001, SEC-002, SEC-009, SEC-016—SEC-018 | Самостоятельный exploit не подтверждён; control уменьшает вероятность или blast radius будущей цепочки |
| Documentation gap | SEC-015 | Целевой append-only контракт расходится с sidecar implementation, но sidecar не является активным Electron transport |
| Limitation | Нет finding ID | Непроверенные области перечислены отдельно и не выданы за vulnerabilities |

## Risk register

| Приоритет | Findings | Severity | Основной риск | Состояние |
| --- | --- | --- | --- | --- |
| P1 | SEC-005, SEC-010 | Medium | Native launch из выбранной папки и отказ main process из-за утечки descriptors | Open |
| P1 | SEC-011, SEC-013 | Medium | Неавторизованные sidecar mutations и cross-workspace overwrite до активации sidecar | Open |
| P1 | SEC-004 | Medium | Race-dependent filesystem escape из выбранного source root | Open |
| P2 | SEC-003, SEC-006, SEC-007, SEC-008, SEC-012, SEC-014 | Low | Disclosure, permissions, metadata integrity и локальный denial of service | Open |
| P3 | SEC-001, SEC-002, SEC-009, SEC-015, SEC-016, SEC-017, SEC-018 | Informational | Trust-boundary hardening, advisory hygiene, audit trail, artifacts и provenance | Open |

Residual severity учитывает текущие ограничения: sidecar не подключён к Electron transport, direct renderer call site для preview/reveal не найден, default listener loopback-only, а race для SEC-004 не воспроизводился как стабильный exploit. При появлении packaged sidecar lifecycle, rich preview или внешней navigation эти оценки следует пересмотреть до release.

## Приоритет и безопасный порядок remediation

1. SEC-005 и SEC-010 исправить вместе как сужение filesystem capability: заменить launch semantics на reveal-only, убрать невостребованный stream и добавить rate/lifecycle tests. После этого пересмотреть SEC-003 и SEC-009, поскольку preview contract может измениться.
2. До активации sidecar сначала ввести lifecycle-owned session secret и loopback/Host/Origin/Content-Type policy (SEC-011), затем bounded HTTP server и sanitized errors (SEC-012, SEC-014), и только потом исправлять ownership/ID invariants (SEC-013) и подключать transport.
3. SEC-004 требует platform-aware filesystem design и deterministic race harness; выполнять его отдельной data-safety задачей, не маскируя повторной lexical проверкой.
4. SEC-006—SEC-008 исправлять миграционно: backup и version gate перед изменением permissions/schema, затем single-writer/revision coordination. Это сохраняет существующие значения и не превращает recovery в destructive rewrite.
5. SEC-001 закрыть до добавления любых external navigation, links или rich preview: сначала navigation/window/permission policy, затем sender/frame authorization и integration tests.
6. SEC-016 исправлять отдельным dependency change до release: удалить неиспользуемый graph, обновить Electron/Vite и transitive packages, затем повторить reachability review, audit и полный Electron smoke/build. Не смешивать lockfile migration с boundary fixes.
7. SEC-002, SEC-009, SEC-015, SEC-017 и SEC-018 выполнять после соответствующих boundary/data fixes либо в release-hardening потоке; каждую рекомендацию проверять собственным scope, не считать текущий audit доказательством исправления.

## Положительные security controls

- Electron использует `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, локальный `loadFile` и не включает webview или отключение web security; preload экспортирует только `workspace.request`.
- Preload и main имеют одинаковые явные allowlists из 34 IPC methods; renderer boundary tests не допускают imports Node builtins, Electron или backend modules.
- Filesystem helpers отклоняют absolute paths, lexical traversal и существующие symlinks за canonical source root; native open запускается без shell interpolation.
- Transitional JSON stores выполняют same-directory temporary write + atomic rename и удаляют только temporary files; corrupt JSON не перезаписывается. Workspace deletion soft-deletes metadata и не удаляет project files.
- Sidecar по умолчанию использует ephemeral `127.0.0.1:0`; handlers ограничивают HTTP methods, scoped list operations фильтруют workspace, soft delete исключает удалённые документы, history list сортируется и scoped по workspace.
- npm lockfile v3 содержит integrity для registry packages, Go modules имеют exact versions и проходят `go mod verify`; tracked tree/history scan не обнаружил credentials, runtime databases или executable binaries.

Эти controls зафиксированы characterization/regression tests. Тесты подтверждают только существующее поведение и не утверждают, что отсутствующие controls уже реализованы.

## Residual risks

- Компрометация доверенного renderer остаётся способна использовать весь разрешённый preload API: navigation/sender hardening из SEC-001 предотвращает расширение capability на другой origin/frame, но не является authorization внутри уже скомпрометированного main renderer.
- Вредоносная выбранная папка остаётся источником race, active-content и native-launch рисков до исправления SEC-004, SEC-005 и SEC-009.
- Локальная multi-process среда остаётся вне единого trust domain: permissions, concurrent writers и будущий sidecar требуют явной защиты.
- Lockfile integrity не устраняет известные advisories и риск lifecycle scripts; результаты npm registry отражают snapshot на дату аудита.
- Отсутствие найденных secrets снижает риск, но regex/entropy scan не гарантирует обнаружение нестандартных, зашифрованных или встроенных в media credentials.

## Непроверенные области и ограничения аудита

- Не выполнялись dynamic fuzzing, нагрузочный DoS, стабильная эксплуатация TOCTOU, запуск native application bundle или тесты над пользовательскими folders/databases.
- Не проверялись Windows/Linux filesystem semantics и ACL, packaged Electron/sidecar lifecycle, installer, auto-update, code signing и notarization.
- `govulncheck` отсутствовал и не устанавливался; Go advisory reachability не проверена внешней базой. npm audit зависит от доступного registry snapshot.
- Не проводился upstream source audit Electron, Chromium, any-store и transitive packages, а также аудит CI secret stores, remote Git hosting logs и npm provenance service.
- Visual/runtime проверка будущего rich preview отсутствует, потому что active renderer call site для preview/reveal не найден.
- Coverage новых audit helpers измерена Node test runner: 100% lines, 81.97% branches и 100% functions. `go test -cover ./...` показал 53.1% statements для sidecar command и 59.8% для store; Task 6 не добавляла Go helpers, а недостающий coverage существующего production-кода остаётся ограничением. Coverage production security paths report-oriented Node тестами не заявляется.

## Рекомендуемые follow-up задачи

Ниже перечислены самостоятельные implementation scopes. Они не являются выполненными исправлениями: все findings остаются `Open`, а каждую задачу следует планировать, реализовывать и принимать отдельно. Строки расположены по фактическому приоритету и зависимостям; стабильные FUP IDs сохраняют тематическую нумерацию.

| Задача | Findings | Отдельный scope | Verification criteria |
| --- | --- | --- | --- |
| FUP-04: Preview и reveal capability | SEC-005, SEC-009, SEC-010 | Заменить native launch на reveal-only contract, определить isolated/download-only preview policy и закрыть stream lifecycle | `.app` и executable-like targets не запускаются; active content не исполняется в privileged origin; repeated preview не увеличивает число открытых descriptors |
| FUP-06: Sidecar transport hardening | SEC-011, SEC-012, SEC-014 | До подключения sidecar реализовать lifecycle-owned secret, loopback/Host/Origin/Content-Type policy, limits, timeouts, graceful shutdown и sanitized errors | Integration tests отклоняют неверный token/origin/content type и oversized body; slow-client test ограничен timeout; responses не раскрывают parser/storage internals |
| FUP-07: Sidecar identity и history | SEC-013, SEC-015 | После transport hardening ввести workspace ownership для IDs и append-only history invariants с совместимой миграцией | Cross-workspace overwrite/delete отклоняются; history невозможно перезаписать тем же ID; migration и Go store tests сохраняют существующие документы |
| FUP-03: Filesystem race safety | SEC-004 | Спроектировать platform-aware operation-by-handle или эквивалентную защиту от symlink/rename race отдельно от preview UI | Детерминированный temporary-fixture race harness не выходит за source root на поддерживаемых платформах; traversal/symlink regression suite проходит |
| FUP-05: Metadata durability и permissions | SEC-006, SEC-007, SEC-008 | Добавить restrictive modes, backup/version gate и single-writer/revision coordination с сохранением данных | Migration fixtures сохраняют values/history, future schema отклоняется без rewrite, concurrent update test не теряет данные, созданные файлы имеют ожидаемые permissions |
| FUP-02: Electron trust boundary | SEC-001, SEC-002, SEC-003 | Ввести navigation/window/permission policy, sender/frame authorization, CSP и безопасный IPC error/path contract | Electron integration tests отклоняют недоверенный URL, frame, popup и permission; renderer не получает внутренний stack или лишний абсолютный path; существующий trusted flow проходит |
| FUP-01: Dependency remediation | SEC-016 | Удалить неиспользуемый runtime graph, обновить Electron/Vite и затронутые transitive packages без boundary-изменений | Clean install по lockfile; production и full `npm audit` не содержат принятых High advisories; проходят npm tests, typecheck, renderer/Electron build и smoke test |
| FUP-08: Repository и release hardening | SEC-017, SEC-018 | Уточнить ignore policy, зафиксировать toolchain/clean-build contract и добавить SBOM/checksum/provenance без изменения application behavior | CI отклоняет runtime DB/audit artifacts, clean reproducible build использует pinned toolchain, release artifacts имеют проверяемые checksum/SBOM/provenance |

## Итоговый handoff

- Отчёт проверен на raw-секреты и пользовательские абсолютные пути: такие значения в него не включены. Утверждения о результатах ограничены статическим анализом, выполненными тестами и явно указанными limitations; непроверенные области не представлены как подтверждённые vulnerabilities.
- В рамках аудита не изменялись production behavior, публичные или внутренние API contracts, storage schema, manifests/lockfiles/dependencies и Electron security settings. Изменения ограничены audit-report, audit/security characterization tests и execution plan.
- Рекомендации и follow-up scopes описывают будущую работу. Ни один finding не помечен исправленным или mitigated, и production remediation в рамках этого аудита не выполнялась.
- `README.md` проверен: описанные запуск, storage, endpoint boundary и команды проверки не изменились, поэтому обновление не требуется.
- `AGENTS.md` проверен: архитектурные границы и рабочие правила не менялись, поэтому обновление не требуется.
- Handoff state: отчёт готов к human review. Подтверждённых Critical/High vulnerabilities не обнаружено; remediation подтверждённых Medium/Low findings и release-hardening требует отдельных implementation scopes.

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

## Filesystem и local metadata boundary

Проверка проследила renderer payload через `workspace.listEntries`, `workspace.listProjectFileTree`, `workspace.previewFile` и `workspace.reveal` до filesystem/process primitives. Все adversarial проверки выполнялись только на temporary fixtures; production-код и пользовательские project files не менялись.

| Primitive/контроль | Путь данных и evidence | Результат |
| --- | --- | --- |
| `readFile` | `src/workspaceBackend.js:499-508`, `src/workspacePropertyStore.js:133-151`, `electron/workspaceIpc.js:1760-1776` | Читает transitional JSON; syntax corruption отклоняется. User project content через этот primitive не читается |
| `writeFile` / `rename` / `rm` | `src/workspaceBackend.js:511-540`, `src/workspacePropertyStore.js:155-166`, `electron/workspaceIpc.js:1779-1790`, `test/securityControls.test.js` | Same-directory random temp + atomic rename; `rm` применяется только к failed temp. Нет `fsync`/directory sync, explicit mode или общего cross-instance lock; SEC-006/SEC-008 |
| `readdir` | `src/workspaceBackend.js:567-663` | Возвращаются только не-hidden entries с `Dirent.isDirectory/isFile`; symlink entries не входят в обычную выдачу. Recursive validation остаётся race-prone; SEC-004 |
| `stat` / `realpath` | `src/localOpen.js:29-59`, `src/workspaceBackend.js:152-189`, `test/localOpen.test.js`, `test/workspaceBackend.test.js` | Absolute path, lexical `..`, sibling-prefix escape и существующий symlink escape отклоняются; broken symlink даёт not-found и не запускается. Percent-encoding не декодируется backend и остаётся literal filename. Между check и use остаётся TOCTOU; SEC-004 |
| `spawn` | `src/localOpen.js:64-125`, `src/workspaceBackend.js:493-496`, `test/securityControls.test.js` | Аргументы передаются массивом без shell, что блокирует shell metacharacter injection. `open` может запустить `.app` directory; SEC-005 |
| Preview allowlist | `src/localOpen.js:5-27`, `src/workspaceBackend.js:25-45,170-190`, `electron/workspaceIpc.js:661-669` | Unknown extension получает 415; HTML/SVG/XML/JS разрешены без active-content policy, текущего UI consumer нет; SEC-009. IPC теряет созданный stream; SEC-010 |
| Workspace deletion | `electron/workspaceIpc.js:517-553`, `test/workspaceIpc.test.js` | `workspace.deleteWorkspace` делает soft delete только metadata и меняет active ID; `rm`/`rename` source tree не вызываются, isolated test подтверждает сохранность project file |

Проверка local metadata дала следующие результаты:

- settings/properties backend при записи сохраняет синтаксически corrupt старый JSON как uniquely named `.bak`, затем делает atomic replacement; read corrupt JSON возвращает `WORKSPACE_STORAGE_CORRUPT` и не мигрирует legacy поверх него;
- view/property stores отклоняют corrupt JSON и сохраняют исходный файл, но автоматического backup/recovery для них нет; это fail-closed поведение, а не восстановление;
- property/view stores имеют per-instance Promise queue, но concurrent writers из разных instances/processes не координируются; воспроизведён lost update (SEC-008);
- future-schema gate отсутствует: property metadata может быть понижена до schema 1 с потерей неизвестных top-level данных (SEC-007); settings/views отдельной version-модели не имеют;
- temporary JSON, SQLite, WAL и SHM создаются без explicit restrictive permissions и на текущем host получили `0644`; packaged SQLite location пока не определён (SEC-006);
- atomic rename защищает от partial target при обычной ошибке write, но нет `fsync` файла/каталога, общей revision и гарантии crash durability; это учитывается в remediation SEC-007/SEC-008.

Расширенные fixture-тесты фиксируют только существующие защиты: rejection traversal/absolute/symlink/broken-symlink и kind mismatch, unsupported preview extensions, atomic temp cleanup и отсутствие удаления project file при workspace soft delete. Они намеренно не утверждают, что `.app` launch, active content, permissive mode, future-schema downgrade, lost update или descriptor leak являются допустимым поведением.

## Go sidecar и any-store boundary

Проверка проследила `WorkspaceSidecarClient` до HTTP handlers и `any-store` collections. Sidecar сейчас является отдельным CLI и автоматически не запускается Electron runtime; выводы относятся к реализованному transport и обязательны до его включения как durable store.

| Контроль | Evidence | Результат |
| --- | --- | --- |
| Bind и authentication | `cmd/workspace-sidecar/main.go:23-41` | Default bind — `127.0.0.1:0`; authentication/session secret, Host и Origin checks отсутствуют, а `-addr` допускает non-loopback bind; SEC-011 |
| Browser-origin boundary | mutation handlers и CORS review | ACAO отсутствует, поэтому обычное чтение response и preflighted methods блокируются браузером; POST с `text/plain` JSON принимается без preflight/content-type gate; SEC-011 |
| HTTP methods и Content-Type | `cmd/workspace-sidecar/main.go:49-493`, `cmd/workspace-sidecar/main_test.go` | Privileged routes имеют method allowlists и возвращают 405; health принимает любой method. Response всегда JSON, request `Content-Type` не проверяется |
| Malformed и trailing JSON | все `json.NewDecoder(...).Decode` call sites, `cmd/workspace-sidecar/main_test.go` | Синтаксически malformed JSON отклоняется до mutation; trailing second value не проверяется, unknown fields обычно принимаются; SEC-012 |
| Body, timeout, concurrency, shutdown | `cmd/workspace-sidecar/main.go:35-41` | Нет body limit, request/server timeouts, concurrency limit и graceful shutdown. Batch store writes используют один `WriteTx`, но handler read-modify-write не объединён общей transaction; SEC-012, concurrent lost-update остаётся follow-up risk |
| Node transport | `src/workspaceSidecarClient.js`, `test/sidecarClient.test.js` | Явное отображение service method → method/path; unknown methods отклоняются до fetch, query IDs проходят `encodeURIComponent`, mutation body отправляется как JSON. Abort timeout и credential отсутствуют |
| Workspace/view scope | `cmd/workspace-sidecar/main.go:359-492`, `internal/workspacestore/store.go:193-368` | Active-view и reorder валидируют workspace ownership, active lists фильтруют soft-deleted документы; direct upsert/global ID collision обходит owner check; SEC-013 |
| Project/property/select scope | `cmd/workspace-sidecar/main.go:508-738`, store list methods | Property/select references сверяются внутри workspace/property; project existence не проверяется. Soft-deleted properties/select/property-values исключаются из active lists |
| Soft delete и history | cascade handlers, `internal/workspacestore/store.go:385-687`, `internal/workspacestore/store_test.go` | Cascade writes объединены `WriteTx`, active lists скрывают `deletedAt`; history list workspace-scoped, но history не append-only и handlers его не создают; SEC-015 |
| SQLite location и permissions | `cmd/workspace-sidecar/main.go:24`, `internal/workspacestore/store.go:142` | Default — `workspace.db` относительно CWD, `-db` принимает arbitrary path. Temporary evidence: database/WAL/SHM mode `0644`, parent fixture `0700`; SEC-006 |
| any-store errors | `cmd/workspace-sidecar/main.go:1418-1429`, `src/workspaceSidecarClient.js:12-15` | Internal errors возвращаются verbatim как 400 и client повторяет message; non-JSON body не отражается; SEC-014 |

Подтверждённые положительные controls покрыты только characterization-тестами: method rejection, malformed JSON без mutation, active-view cross-workspace rejection, query encoding, workspace-scoped active lists, soft delete и history filtering. Тесты намеренно не закрепляют отсутствие authentication/limits, permissive Content-Type, raw error disclosure, глобальные ID collision или overwriteable history как допустимое поведение. Нагрузочная проверка timeout/concurrency не выполнялась, чтобы не превращать audit в denial-of-service; риск подтверждён конфигурацией server и non-atomic read-modify-write paths.

## Dependencies, secrets и build chain

Проверка выполнялась без изменения manifests, lockfiles, installed dependencies или production-кода. Raw `npm audit` JSON и совпавшие строки secret scan не сохранялись в repository; ниже находятся только безопасные агрегаты и identifiers.

### Lockfiles и dependency inventory

| Проверка | Evidence | Результат |
| --- | --- | --- |
| npm lock integrity | `package-lock.json`, programmatic inventory, `npm ci --ignore-scripts --dry-run --audit=false` | lockfileVersion 3; 646 package entries: 486 production-classified и 160 dev-only; у всех resolved entries есть sha512 integrity; все 646 source URLs относятся к `registry.npmjs.org`, git/file/non-registry sources отсутствуют |
| Direct npm requirements | `package.json:20-51` и lock root entries | 29 direct requirements: 28 caret ranges и exact `typescript@5.9.3`; lock фиксирует exact versions для всех direct packages |
| Lifecycle surface | lock `hasInstallScript` и installed package manifests | lock маркирует Electron, esbuild, fsevents и MSW; installed Electron/esbuild/MSW объявляют postinstall, installed fsevents lifecycle script не объявляет. Audit dry-run выполнялся с `--ignore-scripts`, поэтому эти scripts не запускались |
| Go module integrity | `go.mod`, `go.sum`, `go mod verify` | Все downloaded modules verified; direct `github.com/anyproto/any-store@v0.4.6`, inventory содержит 36 modules с main module, exact versions и без replacements |
| Go advisory tooling | `command -v govulncheck` | `govulncheck` отсутствует и по условиям аудита не устанавливался; Go advisory scan остаётся limitation, inventory получен через `go list -m -json all` |

Build scripts вызывают project-local Vite и Go toolchain, используют фиксированные package paths и направляют sidecar output под ignored `build/`. `scripts/build-renderer.mjs` регистрирует только локальный loader для отключения optional `fsevents`, затем вызывает Vite. Shell interpolation из внешнего input в root scripts не обнаружена. Воспроизводимость ограничена незакреплённой версией Node/npm, разрешёнными manifest ranges, lifecycle scripts и отсутствием attestation/checksums для build outputs (SEC-018).

### npm advisory snapshot

| Graph | Critical | High | Moderate | Low | Total affected packages |
| --- | ---: | ---: | ---: | ---: | ---: |
| Production, `npm audit --json --omit=dev` | 0 | 8 | 4 | 3 | 15 |
| Full, `npm audit --json` | 0 | 11 | 4 | 3 | 18 |

Affected locked versions и advisory IDs; строки с `via` наследуют IDs от указанной dependency:

| Package | Installed version | Graph | Advisory IDs |
| --- | --- | --- | --- |
| `@babel/core` | 7.29.0 | Production | 1123528 |
| `@hono/node-server` | 1.19.14 | Production | 1139322 |
| `baseline-browser-mapping` | 2.10.27 | Production | 1193686 |
| `body-parser` | 2.2.2 | Production | 1123976 |
| `brace-expansion` | 5.0.5 | Production | 1120311, 1123898, 1130591, 1130734 |
| `browserslist` | 4.28.2 | Production | 1153171, 1153172 |
| `express-rate-limit` | 8.5.0 | Production | via `ip-address`: 1118827, 1130722 |
| `fast-uri` | 3.1.2 | Production | 1124064, 1130720, 1158524, 1158527, 1158530, 1204921 |
| `hono` | 4.12.17 | Production | 1117915, 1118963, 1118964, 1120082, 1120083, 1120084, 1120085, 1123997, 1123998, 1123999, 1124000, 1124001, 1124005, 1124009, 1124010, 1130733, 1138771, 1138772, 1138773, 1193729, 1193730, 1193731 |
| `ip-address` | 10.1.0 | Production | 1118827, 1130722 |
| `js-yaml` | 4.1.1 | Production | 1121860, 1123911, 1138115, 1193727 |
| `nanoid` | 3.3.12 | Production | 1138811, 1139427 |
| `postcss` | 8.5.14 | Production | 1130709, 1139510 |
| `postcss-selector-parser` | 7.1.1 | Production | 1153169 |
| `qs` | 6.15.1 | Production | 1119502, 1158506, 1158507 |
| `electron` | 41.5.0 | Full/dev addition | 1136584, 1136608; via `extract-zip`: 1139346, 1193685 |
| `extract-zip` | 2.0.1 | Full/dev addition | 1139346, 1193685 |
| `vite` | 6.4.2 | Full/dev addition | 1120784, 1123525 |

`npm explain` связывает основную production-classified группу с прямой dependency `shadcn@4.7.0`; import/use `shadcn` в `src`, `electron` или build scripts не найден. Electron является direct devDependency, но представляет фактически запускаемый desktop runtime; приложение не использует custom protocol response, sandboxed iframe/`allow-popups` или application-controlled archive extraction, указанные в зафиксированных Electron/extract-zip advisories. Vite вызывается только для production build, dev server не запускается, а зафиксированные Vite advisories относятся к Windows-specific dev-server behavior. Поэтому SEC-016 сохраняет registry evidence и обязательную remediation до release, но классифицирован как defense in depth без подтверждённого project-specific exploit path. Registry snapshot меняется со временем, поэтому counts и IDs относятся к проверке 2026-09-23 и должны обновляться перед remediation/release.

### Secrets, generated artifacts и binary provenance

Сигнатурный scan 1181 текущих tracked files, HEAD и всех 473 reachable commits проверил private-key headers, AWS/GitHub/Slack/Google/Stripe/OpenAI-style tokens, JWT, credential-bearing URLs и quoted credential assignments. Совпадений не найдено; raw candidate values не выводились. Дополнительная эвристика quoted high-entropy values по текущему tracked tree, исключая checksum-heavy `package-lock.json` и `go.sum`, дала 0 кандидатов. Это снижает риск случайно committed credentials, но не доказывает отсутствие неизвестного формата или секрета в binary/image payload.

Проверка artifact paths и file provenance дала следующие результаты:

- tracked tree и reachable object paths не содержат `.workspace/`, `build/`, `dist/`, `node_modules/`, `.ralphex/`, root sidecar binary, `workspace.db`/WAL/SHM или `npm-audit.json`;
- `.workspace/`, `build/`, `dist/`, `node_modules/` и root sidecar binaries корректно игнорируются;
- `workspace.db`, `workspace.db-wal`, `workspace.db-shm`, `.ralphex/` и ad-hoc `npm-audit.json` не игнорируются (SEC-017);
- tracked executable modes и Mach-O/ELF/PE artifacts отсутствуют; 161 tracked media artifacts классифицированы как 154 PNG и 7 JPEG design/test evidence, а не исполняемые binaries;
- `THIRD_PARTY_NOTICES.md` документирует direct Go dependency any-store; полнота license notices для npm graph относится к legal/release review и не использовалась как security finding.

Secret scan был regex/entropy-oriented review, а не специализированный scanner: false negatives для нестандартных/зашифрованных credential formats и secrets внутри images остаются ограничением. Внешние Git hosting logs, CI secret stores, npm provenance service, code signing/notarization и upstream source audit не проверялись.

## Матрица покрытия

| Область | Компоненты и вопросы | Метод evidence | Задача | Статус |
| --- | --- | --- | --- | --- |
| Electron shell | BrowserWindow, isolation, sandbox, navigation, windows, permissions, CSP | Code review + existing/new tests | Task 2 | Covered |
| Preload и IPC | Exposed API, allowlist, sender/frame, payload, errors | Data-flow review + adversarial tests | Task 2 | Covered |
| Renderer boundary | Imports, transport, path/error disclosure, active content | Static boundary tests + code review | Task 2 | Covered |
| Filesystem | Path resolution, traversal, symlink, TOCTOU, open/spawn/delete | Temporary fixtures + source tracing | Task 3 | Covered |
| Local metadata | JSON permissions, atomicity, backup, schema, concurrency | Adapter review + isolated corruption tests | Task 3 | Covered |
| Go sidecar HTTP | Bind/auth, methods, content type, body limits, timeout, shutdown | Handler/client tests + code review | Task 4 | Covered |
| any-store/SQLite | ID and scope validation, soft delete/history, permissions, errors | Store tests + document-flow review | Task 4 | Covered |
| Dependencies | npm/Go graph, lock integrity, advisories, lifecycle scripts | Manifest/lock review + available native tooling | Task 5 | Covered |
| Secrets | Tracked tree, reachable history, generated/local artifacts | Pattern/entropy-oriented scan with redacted output | Task 5 | Covered |
| Build configuration | Scripts, version ranges, binary artifacts, reproducibility | Script and artifact provenance review | Task 5 | Covered |

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
| 2026-09-23 | Filesystem и local metadata | Подтверждены traversal/symlink/atomic-write/soft-delete controls; зарегистрированы SEC-004—SEC-010 |
| 2026-09-23 | Go sidecar и any-store | Подтверждены method/scope/soft-delete controls; зарегистрированы SEC-011—SEC-015 и расширен SEC-006 |
| 2026-09-23 | Dependencies, secrets и build chain | Проверены npm/Go inventories, advisories, lifecycle/build scripts, 473 reachable commits и artifact provenance; зарегистрированы SEC-016—SEC-018 |
| 2026-09-23 | Сведение и критерии приёмки | 18 findings дедуплицированы и классифицированы; добавлены executive summary, risk register, remediation order, positive controls, residual risks и limitations; полный test/typecheck/build прошёл |
| 2026-09-23 | Финальный handoff | Проверены redaction и границы утверждений; добавлен отдельный follow-up backlog; подтверждено отсутствие production/API/schema/dependency/security-setting изменений; README и AGENTS не требуют обновления |
