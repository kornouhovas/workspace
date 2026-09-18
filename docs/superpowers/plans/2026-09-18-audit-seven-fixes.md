# Seven Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Исправить все семь ошибок аудита от 2026-09-18 без потери сохранившихся пользовательских метаданных.

**Architecture:** Сохранить React → WorkspaceServiceClient → preload IPC → backend и текущие transitional adapters; any-store остаётся целевым durable store. Исправить namespace, миграции, каскадное удаление и состояния UI на существующих границах. Для A1 предложен отдельный backend registry; его реализация начинается только после принятия ADR-004.

**Tech Stack:** Electron, React, TypeScript, Node.js `node:test`, Go, any-store/SQLite; существующие зависимости, без новых пакетов.

**Spec:** [audit-seven-fixes backlog](../../backlog/audit-seven-fixes.md), [Proposed ADR-004](../../adr/004-project-identity-and-audit-migrations.md), `docs/prd.md`, `docs/data-model.md`, `docs/api/workspace-properties.md`, `docs/api/workspace-views.md`.

## Global Constraints

- `React must stay thin.`
- `Commit every completed file-changing implementation before handoff.`
- `Do not introduce abstractions unless they reduce real duplication or clarify a boundary.`
- Без явного разрешения запрещены `add npm or Go dependencies`, `change project identity strategy`, `change folder role semantics`, `change Electron security posture` и `delete, move, or rename user project files on disk`.
- Пользователь запросил план. Реализация, миграция настоящей `.workspace` и принятие ADR этим документом не разрешены.
- Все тестовые configPath/viewStorePath/propertyStorePath/projectStorePath находятся в `mkdtemp`; ни один тест не должен использовать настоящую `.workspace` по умолчанию.
- Существующие Workspaces и custom properties одного источника сохраняют нынешнюю область совместного использования. Исправление глобальности folderRules между Workspaces не добавлять как восьмой баг.
- Никакой загрузки sidecar из React, новых IPC channel families, массового рефакторинга или переключения storage technology.
- При изменении format/schema: backup исходных байтов, проверка версии, parse до write, atomic replacement, повторяемость и preservation of history. Не восстанавливать «потерянное» выдуманными данными.
- После каждого slice: документация, целевые тесты, применимые более широкие проверки, review и отдельный commit только собственных файлов.

---

## Статус, последовательность и границы

Status: Human Review (план); Backlog (реализация). База аудита: `cd0e814` на `codex/feature-russian-localization`.

Это единый координирующий план для связанных ошибок сохранности и отображения. Каждый Task ниже — отдельный проверяемый slice. Не параллелить изменения `electron/workspaceIpc.js` и migration stores.

| Порядок | Ошибка аудита | Результат | Зависимость |
| --- | --- | --- | --- |
| 1 | A2 / №2 | Уникальные новые default views, сохранение legacy views | Разрешение на реализацию |
| 2 | A3 / №3 | Сохранение ролей при повторном выборе/смене источника | 1, чтобы A → B → A не терял views |
| 3 | A7 / №7 | Изоляция system property definitions по scope | 1; не меняет публичные property IDs |
| 4 | A1 / №1 | Registry и unit-tested сопоставление папок | Принятый ADR-004 |
| 5 | A1 / №1 | Registry подключён во все проектные IPC пути | 4, затем интеграционные тесты с 1–3 |
| 6 | A4 / №4 | Статусы определяются по реальной папке | 1–3; не зависит от filesystem identity проекта |
| 7 | A5 / №5 | Очистка фильтров, values и recovery удаления | 1, 3; полный regression после 5–6 |
| 8 | A6 / №6 | Production error/empty UI без mock fallback | Независим от backend исправлений |

Рекомендуемое исполнение: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Если ADR-004 ещё не принят, можно по отдельному разрешению исполнить 1–3, 6–8; A1 останется открытым. Переход к коду — отдельный запрос пользователя.

## Карта файлов

| Файлы | Ответственность в плане |
| --- | --- |
| `electron/workspaceIpc.js` | namespace default views, source selection, вызовы registry, status mapping, cascade/recovery |
| `src/workspacePropertyStore.js` | scope-qualified storage keys, schema migration, pending delete operation |
| `src/workspaceProjectRegistry.js` (новый) | чистое сопоставление project observations и файловый adapter реестра, без React |
| `src/workspaceObjects.js` | принимать уже назначенный project ID; legacy helper только для совместимости |
| `src/workspaceBackend.js`, `src/folderModel.js` | передавать locator папки статуса и registry-compatible результаты scan |
| `src/workspaceViews.js` | чистое удаление ссылки из фильтра и правила проекции |
| `src/App.tsx`, `src/workspaceAppState.ts` | реальные error/empty/ready states, retry, отсутствие runtime mock fallback |
| `src/components/workspace/states.tsx`, `settings-view.tsx`, `src/i18n/locales/{en,ru}.js` | доступный error UI, отсутствующий источник, тексты |
| `test/workspaceAuditRegression.test.js` (новый) | реальные IPC regressions всех backend пунктов |
| `test/workspaceProjectRegistry.test.js` (новый) | unit/fault tests identity и registry migration |
| Существующие `test/workspacePropertyStore.test.js`, `workspaceObjects.test.js`, `folderModel.test.js`, `workspaceBackend.test.js`, `workspaceViews.test.js`, `workspaceAppState.test.js`, `rendererBoundary.test.js`, `dashboardStructure.test.js` | ближайшие проверки соответствующих границ; обновить проверки, закрепляющие старые баги |
| `cmd/workspace-sidecar/main_test.go` | проверка parity cascade A5 с уже имеющимся Go-поведением |

## Task 1: A2 — сохранить default views разных источников

**Files:** Modify `electron/workspaceIpc.js` (`ensureDefaultWorkspace`, `readViewStoreData`, `writeViewStoreData`); Create `test/workspaceAuditRegression.test.js`; Modify `test/workspaceIpc.test.js`, `docs/data-model.md`, `docs/api/workspace-views.md`.

**Interfaces:** Публичные `workspace.setRoot/getRoot/listViews/updateView/getViewProjection` не меняются. Новые default IDs: `createStableDocumentId("view", workspaceId, "default", viewType)`; существующие ID и activeViewId сохраняются. Использовать имеющийся `createStableDocumentId`, не копию алгоритма.

- [ ] **1. Добавить изолированную fixture и падающий IPC regression.** Следующий helper разместить в новом тестовом файле; все последующие snippets используют именно его. В Node imports также нужны `rename` для Task 5 и `createFolderObjectId` для legacy assertions.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWorkspaceIpcHandler } from "../electron/workspaceIpc.js";
import { createFolderObjectId } from "../src/workspaceObjects.js";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "workspace-audit-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const roots = { A: join(directory, "A"), B: join(directory, "B") };
  await Promise.all(Object.values(roots).map(root =>
    mkdir(join(root, "Active", "Alpha"), { recursive: true })));
  let selected = roots.A;
  const options = {
    configPath: join(directory, "settings.json"),
    viewStorePath: join(directory, "views.json"),
    propertyStorePath: join(directory, "properties.json"),
    projectStorePath: join(directory, "projects.json"),
    chooseRoot: async () => selected,
  };
  let handler = createWorkspaceIpcHandler(options);
  const call = (method, body = {}) => handler(null, `workspace.${method}`, body);
  return {
    roots, options, call,
    restart() { handler = createWorkspaceIpcHandler(options); },
    async select(name) {
      selected = roots[name];
      return (await call("setRoot")).root.workspaceId;
    },
    async views(workspaceId) { return call("listViews", { workspaceId }); },
    async projectList(workspaceId) {
      const views = await call("listViews", { workspaceId });
      const response = await call("getViewProjection", {
        workspaceId, viewId: views.activeViewId,
      });
      return response.projection.type === "table"
        ? response.projection.rows
        : response.projection.columns.flatMap(column => column.projects);
    },
  };
}

test("A2: source switching preserves default view settings", async t => {
  const f = await fixture(t);
  const a = await f.select("A");
  const before = await f.views(a);
  await f.call("updateView", {
    workspaceId: a, viewId: before.activeViewId,
    patch: { name: "My board", boardLayout: { columnWidth: 700 } },
  });
  const b = await f.select("B");
  const bViews = await f.views(b);
  assert.ok(bViews.views.every(v => !before.views.some(old => old.id === v.id)));
  await f.select("A");
  f.restart();
  const after = await f.views(a);
  const board = after.views.find(v => v.id === before.activeViewId);
  assert.equal(board.name, "My board");
  assert.equal(board.boardLayout.columnWidth, 700);
  assert.equal(after.activeViewId, before.activeViewId);
});
```

- [ ] **2. Запустить RED:** `node --test --test-name-pattern='A2:' test/workspaceAuditRegression.test.js`. Ожидается падение на пересечении ID или потерянных settings, не на ошибке fixture.
- [ ] **3. Изменить выдачу новых default IDs и защитить legacy.** Сохранившийся view принадлежит `view.workspaceId`; наличие чужого default ID не даёт права его перезаписать. Существующий Workspace с legacy Board/Table не пересоздавать. Если legacy запись уже потеряна, создать новый default только для отсутствующего Workspace и не заявлять восстановление его настроек.

```js
const id = createStableDocumentId("view", workspaceId, "default", viewType);
// viewType — "board" / "table" в existing initialization.
// Перед saveView: если такой id уже существует с другим workspaceId,
// вернуть STORAGE_UNAVAILABLE, не перезаписывать документ.
```

- [ ] **4. Добавить legacy/concurrency coverage.** Seed `views.json` через `writeFile` с `view:default-board`, пользовательскими name/filter/order и activeViewId; A → B → A сохраняет весь документ кроме допустимых timestamps. Прогнать одновременные `getRoot/listViews/scan` и убедиться в ровно двух defaults на новый Workspace. Существующие тесты не должны требовать старые константные ID для новых данных: брать IDs из `listViews`.
- [ ] **5. GREEN и документация:** `node --test test/workspaceAuditRegression.test.js test/workspaceIpc.test.js test/workspaceViews.test.js`. Описать opaque IDs и совместимость legacy; затем `npm test`, `git --no-pager diff --check`.
- [ ] **6. Review/commit:** `git add` только указанных изменённых файлов; `git commit -m "fix: isolate default views by workspace"`.

## Task 2: A3 — сохранять роли при выборе источника

**Files:** Modify `electron/workspaceIpc.js` (`setRoot`, scan/updateFolderRole и все чтения folderRules), `src/workspaceBackend.js` (settings read/write при необходимости), `test/workspaceAuditRegression.test.js`, `test/workspaceIpc.test.js`, `docs/data-model.md`, `docs/flows/settings-source-folder-and-roles.md`.

**Interfaces:** Существующие IPC methods неизменны. В settings schemaVersion=2 добавить `folderRulesBySource[sourceFolderId]` и `activeWorkspaceIdBySource[sourceFolderId]`; отсутствие версии означает legacy input. `folderRules` оставить согласованным compatibility mirror текущего источника. `setRoot` и `setActiveWorkspace` обновляют обе формы одной записью settings. В этом slice не менять global-vs-Workspace семантику ролей.

- [ ] **1. Добавить RED test.**

```js
test("A3: selecting the same source and returning to it preserves roles", async t => {
  const f = await fixture(t);
  await f.select("A");
  await f.call("updateFolderRole", { path: "Active", role: "group" });
  await f.select("A");
  assert.equal((await f.call("scan")).tree.find(n => n.path === "Active").role, "group");
  await f.select("B");
  assert.equal((await f.call("scan")).tree.find(n => n.path === "Active").role, "status");
  await f.select("A");
  f.restart();
  assert.equal((await f.call("scan")).tree.find(n => n.path === "Active").role, "group");
});
```

- [ ] **2. RED:** `node --test --test-name-pattern='A3:' test/workspaceAuditRegression.test.js`; ожидается `status !== group`.
- [ ] **3. Добавить lossless settings migration и один atomic save выбранного источника.** Читать старые settings до изменения. Старый набор ролей привязать только к source ID старого rootPath. Не копировать роли A в B. Сохранять прочие settings через spread; не переписывать файл, если same-root selection не меняет состояние.

```js
const folderRulesBySource = { ...(settings.folderRulesBySource || {}) };
if (oldSourceId && !Object.hasOwn(folderRulesBySource, oldSourceId)) {
  folderRulesBySource[oldSourceId] = normalizeFolderRules(settings.folderRules);
}
const nextRules = folderRulesBySource[nextSourceId] || {};
// oldSourceId/nextSourceId вычисляются имеющимся createWorkspaceId
// из предыдущего и выбранного rootPath; для пустого old root oldSourceId=null.
```

- [ ] **4. Проверить все consumers:** `scan`, `updateFolderRole`, `getStatusValues`, `updateProjectPropertyValue`, `getViewProjection` получают набор текущего источника. Добавить тесты active Workspace restore; cancel `chooseRoot` возвращает пустую строку и не меняет байты; invalid directory, corrupt JSON и ошибка записи не очищают старое состояние. Не менять cancellation UX в этом slice.
- [ ] **5. GREEN:** `node --test test/workspaceAuditRegression.test.js test/workspaceIpc.test.js test/workspaceBackend.test.js`; затем `npm test`, `git --no-pager diff --check`. Docs различают текущую source-scoped совместимость и целевой Workspace-scoped контракт, не объявляя последний реализованным.
- [ ] **6. Review/commit:** `git commit -m "fix: preserve source folder role settings"` после selective staging.

## Task 3: A7 — разделить ключи property definitions по области данных

**Files:** Modify `src/workspacePropertyStore.js`, `test/workspacePropertyStore.test.js`, `test/workspaceAuditRegression.test.js`, `docs/data-model.md`, `docs/api/workspace-properties.md`.

**Interfaces:** `getProperty(workspaceId, propertyId)`, `saveProperty(property)`, `listProperties(workspaceId)` остаются прежними. В runtime их scope — существующий propertyScopeId/sourceFolderId. Публичные ID `property:name`, `property:status` не меняются.

- [ ] **1. Добавить RED test.**

```js
test("A7: system labels survive switching sources", async t => {
  const f = await fixture(t);
  const a = await f.select("A");
  await f.call("updateProperty", {
    workspaceId: a, propertyId: "property:name", patch: { name: "Client A" },
  });
  const b = await f.select("B");
  await f.call("updateProperty", {
    workspaceId: b, propertyId: "property:name", patch: { name: "Client B" },
  });
  await f.select("A");
  f.restart();
  const properties = (await f.call("listProperties", { workspaceId: a })).properties;
  assert.equal(properties.find(p => p.id === "property:name").name, "Client A");
});
```

- [ ] **2. RED:** `node --test --test-name-pattern='A7:' test/workspaceAuditRegression.test.js`; ожидается `Name !== Client A`.
- [ ] **3. Ввести key helper и schemaVersion=2.** Read/write используют одинаковый helper. Мигрировать каждое сохранившееся определение по полям самого документа, не по текущему открытому root. Не менять scope custom properties и не переименовывать их IDs.

```js
function createPropertyDefinitionKey(scopeId, propertyId) {
  return [scopeId, propertyId].map(value => encodeURIComponent(String(value))).join("/");
}
// getProperty: data.properties[createPropertyDefinitionKey(workspaceId, propertyId)]
// saveProperty: data.properties[createPropertyDefinitionKey(property.workspaceId, property.id)]
```

- [ ] **4. Migration tests:** v1→v2 сохраняет definitions, values, selectValues и history byte-equivalent по payload; повтор v2→v2 не меняет данные; совпадающие property IDs в разных scopes сосуществуют; special characters не создают key collision; конфликтующие duplicate documents внутри одной области вызывают ошибку с сохранением оригинала; corrupt/future version не перезаписывается. Существующие перезаписанные v1 definitions не «восстанавливать» из другой области.
- [ ] **5. GREEN:** `node --test test/workspacePropertyStore.test.js test/workspaceAuditRegression.test.js test/workspaceIpc.test.js`; затем `npm test`, `git --no-pager diff --check`. Обновить описание внутренних ключей и миграции.
- [ ] **6. Review/commit:** `git commit -m "fix: scope stored property definitions"` после selective staging.

## Task 4: A1 — backend registry и безопасное сопоставление identity

**Approval gate:** Прочитать ADR-004. Пока Status не Accepted на основании явного решения пользователя, Task 4–5 не исполнять. Подготовка этого плана не считается разрешением.

**Files:** Create `src/workspaceProjectRegistry.js`, `test/workspaceProjectRegistry.test.js`; Modify `docs/adr/004-project-identity-and-audit-migrations.md`, `docs/architecture.md`, `docs/data-model.md` после принятия.

**Interfaces (backend-only):**

```ts
type Evidence = { device: string; fileId: string; birthtimeNs: string } | null;
type Observation = { relativePath: string; name: string; evidence: Evidence; legacyId: string };
type ProjectRecord = {
  id: string; sourceFolderId: string; currentRelativePath: string; name: string;
  discoveryState: "active" | "missing"; evidence: Evidence;
  createdAt: string; updatedAt: string; lastSeenAt: string;
};
// Pure function; all inputs are already validated, observations form a complete scan.
type ReconcileInput = {
  sourceFolderId: string; records: ProjectRecord[]; observations: Observation[];
  legacyReferencedIds: Set<string>; idFactory: () => string; now: string;
};
type ReconcileResult = { records: ProjectRecord[]; projectIdsByPath: Record<string, string> };
declare function reconcileProjectRecords(input: ReconcileInput): ReconcileResult;
// File adapter serializes read/reconcile/atomic-write as one operation per file.
declare function createFileProjectRegistry(filePath: string): {
  reconcile(input: Omit<ReconcileInput, "records">): Promise<ReconcileResult>;
};
```

- [ ] **1. Добавить unit RED без filesystem эвристик.** Test imports чистый `reconcileProjectRecords` из нового модуля. В test fixture создать prior record с `id: "object:legacy-alpha"`, path `Active/Alpha`, evidence `{device:"1",fileId:"42",birthtimeNs:"100"}` и timestamps `2026-09-18T00:00:00.000Z`.

```js
const result = reconcileProjectRecords({
  sourceFolderId: "source:A", records: [prior],
  observations: [{ relativePath: "Active/Renamed", name: "Renamed",
    evidence: prior.evidence, legacyId: "object:path-derived-renamed" }],
  legacyReferencedIds: new Set([prior.id]),
  idFactory: () => "fresh-id", now: "2026-09-18T01:00:00.000Z",
});
assert.equal(result.projectIdsByPath["Active/Renamed"], prior.id);
assert.equal(result.records[0].currentRelativePath, "Active/Renamed");
```

- [ ] **2. RED:** `node --test test/workspaceProjectRegistry.test.js`; ожидается отсутствующий новый module/function до реализации.
- [ ] **3. Реализовать reconciliation согласно ADR.** Сначала строить полные индексы evidence и paths, затем сопоставлять; нельзя принимать решение до рассмотрения всех observations. Использовать строгий source scope, unique evidence match и отсутствие старого пути. Стабильный opaque ID возвращать отдельно от locator.

```js
// При первом усвоении ранее известного пути:
const id = legacyReferencedIds.has(observation.legacyId)
  ? observation.legacyId
  : `project:${idFactory()}`;
// При совпадении зарегистрированного проекта сохранять record.id.
// Новый evidence у существующего пути => новая папка, не reuse прежнего ID.
// Старые несопоставленные records становятся missing только после full scan.
```

- [ ] **4. Покрыть таблицу решений тестами:** rename; move внутри тома; restart; missing→return с тем же evidence; два проекта с одинаковым именем; новая папка на старом пути; duplicate/нулевой evidence; отсутствие birthtime; другой source; copy с другим fileId; legacy values/history без текущего folder. Не удалять missing records и осиротевшие metadata. При uncertainty не объединять проекты.
- [ ] **5. Реализовать файловый adapter.** `projects.json` schemaVersion=1; serialize операции по каноническому пути metadata file в текущем процессе; temp+rename; возвращать mapping только после успешной записи. Preserve other sources. Для corrupt/future schema возвращать storage error. Новый adapter не экспортировать renderer. Injected `projectStorePath` выводить из configPath по умолчанию.
- [ ] **6. Fault tests и GREEN:** concurrent reconcile из двух adapter instances не создаёт два ID; write failure не выдаёт успешный mapping; retry/restart идемпотентен; повреждённый файл не перезаписывается. Run `node --test test/workspaceProjectRegistry.test.js`, `npm test`, `git --no-pager diff --check`.
- [ ] **7. Обновить архитектуру/data model/ADR и commit:** `git commit -m "feat: add stable local project registry"`. Этот commit — проверенная основа, A1 ещё не закрыт до Task 5.

## Task 5: A1 — подключить registry к scan, projection и сохранению значений

**Files:** Modify `electron/workspaceIpc.js` (`getProjectsAndStatusValues`, scan и value-write paths), `src/workspaceBackend.js`, `src/workspaceObjects.js`, `test/workspaceAuditRegression.test.js`, `test/workspaceObjects.test.js`, `test/workspaceBackend.test.js`, `test/rendererBoundary.test.js`, `docs/api/workspace-views.md`, `docs/api/workspace-properties.md`, `docs/data-model.md`.

**Interfaces:** Task 4 registry. Расширить `projectFoldersToWorkspaceObjects({workspaceId, rootPath, folders, projectIdsByPath})` необязательным map для legacy callers; runtime всегда передаёт map. `createFolderObjectId` сохранить только для legacy lookup/file-tree identity, не назначать им новые runtime project IDs. Согласовать `scan.workspace.objects[].id` и projection project.id.

- [ ] **1. Добавить RED real-filesystem regression.**

```js
test("A1: project values survive rename and process restart", async t => {
  const f = await fixture(t);
  const workspaceId = await f.select("A");
  await f.call("createProperty", {
    workspaceId, id: "property:note", name: "Note", type: "text",
  });
  const before = (await f.projectList(workspaceId))[0];
  await f.call("updateProjectPropertyValue", {
    workspaceId, projectId: before.id, propertyId: "property:note", value: "Keep this note",
  });
  await rename(join(f.roots.A, "Active", "Alpha"), join(f.roots.A, "Active", "Renamed"));
  f.restart();
  const after = (await f.projectList(workspaceId))[0];
  assert.equal(after.id, before.id);
  assert.equal(after.currentRelativePath, "Active/Renamed");
  assert.equal(after.propertyValues["property:note"], "Keep this note");
});
```

- [ ] **2. RED:** `node --test --test-name-pattern='A1:' test/workspaceAuditRegression.test.js`; ожидается различие IDs или потеря Note на старом runtime.
- [ ] **3. Собрать observations в backend после проверки реальных путей.** Использовать существующий `resolveExistingWorkspacePath` и прочитать его результат согласно текущему контракту; только после успешного полного обхода вызвать registry. `stat(..., { bigint: true })` преобразовать в строки; platform adapter возвращает null при ненадёжных/отсутствующих признаках. Не передавать evidence в React.

```js
const result = await projectRegistry.reconcile({
  sourceFolderId, observations, legacyReferencedIds, idFactory, now: now(),
});
const workspace = projectFoldersToWorkspaceObjects({
  workspaceId: sourceFolderId, rootPath, folders,
  projectIdsByPath: result.projectIdsByPath,
});
```

- [ ] **4. Связать все consumers.** `workspace.scan`, `getViewProjection`, `updateProjectPropertyValue` и `getStatusValues` должны использовать одни зарегистрированные IDs. При миграции `legacyReferencedIds` собрать из current и deleted property values, history и существующих project records; сохранить ID ранее известной папки. Если текущий legacy project ранее нигде не сохранялся, выдача нового UUID безопасна. Проверка пути остаётся необходимой при каждом file operation.
- [ ] **5. Дополнительные regressions:** seed pre-upgrade properties.json с `createFolderObjectId(sourceFolderId, "Active/Alpha")`, current value и history → migration сохраняет этот ID → rename сохраняет value/history; move под другой статус меняет статус, не ID; два Workspaces одного источника получают один project.id; copy не получает старые values; write failure реестра не разрешает value-write с временным ID. Повтор scan не создаёт новые registry records.
- [ ] **6. GREEN/backend gates:** `node --test test/workspaceProjectRegistry.test.js test/workspaceAuditRegression.test.js test/workspaceObjects.test.js test/workspaceBackend.test.js test/rendererBoundary.test.js`; затем `npm test`, `go test ./...`, `npm run build:sidecar`, `git --no-pager diff --check`.
- [ ] **7. Platform smoke/docs/commit:** реальный rename временной папки на macOS, отдельная проверка Windows перед заявлением поддержки там; описать unsupported evidence/cross-volume пределы. `git commit -m "fix: retain project metadata across folder renames"`. Не менять настоящие файлы пользователя для smoke.

## Task 6: A4 — уникальные статусы по folder locator и migration filters/colors

**Files:** Modify `src/folderModel.js`, `src/workspaceObjects.js`, `src/workspaceBackend.js`, `electron/workspaceIpc.js` (`createStatusValues`, project status assignment), `test/folderModel.test.js`, `test/workspaceObjects.test.js`, `test/workspaceAuditRegression.test.js`, `docs/data-model.md`, `docs/api/workspace-views.md`.

**Interfaces:** При flatten передавать `statusRelativePath: string | null` от реального status node через folder и workspace object до status value. ID: `statusValue:folder:${encodeURIComponent(sourceFolderId)}:${encodeURIComponent(statusRelativePath)}`. `statusValue:no-status` только при null locator. Имя папки — подпись, не признак отсутствия статуса.

- [ ] **1. Добавить RED test.**

```js
test("A4: colliding status labels do not duplicate projects", async t => {
  const f = await fixture(t);
  await mkdir(join(f.roots.A, "In progress", "One"), { recursive: true });
  await mkdir(join(f.roots.A, "In-progress", "Two"), { recursive: true });
  const workspaceId = await f.select("A");
  const { activeViewId } = await f.views(workspaceId);
  const response = await f.call("getViewProjection", { workspaceId, viewId: activeViewId });
  const columns = response.projection.columns.filter(c => ["In progress", "In-progress"].includes(c.name));
  assert.equal(new Set(columns.map(c => c.statusValueId)).size, 2);
  assert.deepEqual(columns.map(c => c.projects.length), [1, 1]);
  assert.equal(new Set(columns.flatMap(c => c.projects.map(p => p.id))).size, 2);
});
```

- [ ] **2. RED:** `node --test --test-name-pattern='A4:' test/workspaceAuditRegression.test.js`; ожидается 1 уникальный ID вместо 2 или по два проекта в колонке.
- [ ] **3. Протянуть locator от traversal и заменить name matching.** В `collectAccessTreeCards` context добавить statusRelativePath; `status` node задаёт `node.path`, `group` сохраняет context, исходный context null. В `projectFoldersToWorkspaceObjects` сохранить locator. В IPC lookup/membership использовать новый ID, а не поиск по name/slug.

```js
const id = object.statusRelativePath === null
  ? NO_STATUS_VALUE_ID
  : `statusValue:folder:${encodeURIComponent(sourceFolderId)}:${encodeURIComponent(object.statusRelativePath)}`;
// Карта statuses индексируется id; relativePath содержит настоящий locator.
```

- [ ] **4. Мигрировать сохранённые status references до выдачи projection.** Сначала построить полный legacyId → newIds map. Один old slug, несколько папок: разворачивать прежний filter value во все соответствующие новые IDs, чтобы не потерять прежний видимый набор; общий color скопировать. При неизвестном locator не угадывать по похожему имени; сохранить исходные metadata в backup и вернуть явную ошибку миграции до её разрешения. В views store сохранить per-source запись `statusIdentityMigrations[sourceFolderId]` с mapping и phase (`prepared`/`complete`); read/write должны сохранять её. Mapping записать до color/view updates, чтобы restart использовал тот же mapping. Стадии повторяемы; complete ставить только после всех записей, до этого projection не выдавать.
- [ ] **5. Тесты migration/семантики:** разные labels из RED; одинаковые names под двумя group; реальная папка `No status` и проект без статуса; независимые colors/filter; legacy filter на коллидирующий slug сохраняет объединение; повтор migration; restart; fault между color/view updates и успешный recovery. Проверить Board/Table одинаковый набор без дубликатов и неизменность project IDs из Task 5.
- [ ] **6. GREEN:** `node --test test/folderModel.test.js test/workspaceObjects.test.js test/workspaceBackend.test.js test/workspaceViews.test.js test/workspaceAuditRegression.test.js`; затем backend gates и docs. `git commit -m "fix: identify statuses by source folder locator"` после selective staging.

## Task 7: A5 — удалить select value из всех фильтров и завершать cascade после сбоя

**Files:** Modify `electron/workspaceIpc.js` (`deleteSelectValueResult`, передача viewStore, source operation gate), `src/workspaceViews.js`, `src/workspacePropertyStore.js`, `test/workspaceViews.test.js`, `test/workspacePropertyStore.test.js`, `test/workspaceAuditRegression.test.js`, `cmd/workspace-sidecar/main_test.go`, `docs/api/workspace-properties.md`, `docs/data-model.md`.

**Interfaces:** Новый чистый `removeSelectValueFromViewFilters(view, propertyId, selectValueId)` возвращает `{view, changed}`. В propertyStore добавить `beginSelectValueDeletion(operation)`, `listPendingSelectValueDeletions(scopeId)`, `completeSelectValueDeletion(operationId)`; operation сохраняет id, scopeId, propertyId, selectValueId, timestamp и snapshots affected values/history для идемпотентного завершения. Публичный `deleteSelectValue` прежний.

- [ ] **1. Добавить RED integration.**

```js
test("A5: deleting the last included option removes stale filters", async t => {
  const f = await fixture(t);
  const workspaceId = await f.select("A");
  await f.call("createProperty", { workspaceId, id: "property:priority", name: "Priority", type: "select" });
  const { selectValue } = await f.call("createSelectValue", {
    workspaceId, propertyId: "property:priority", name: "High", color: "red",
  });
  const project = (await f.projectList(workspaceId))[0];
  await f.call("updateProjectPropertyValue", {
    workspaceId, projectId: project.id, propertyId: "property:priority", value: selectValue.id,
  });
  const { activeViewId } = await f.views(workspaceId);
  await f.call("updateView", { workspaceId, viewId: activeViewId, patch: {
    valueVisibility: { "property:priority": { valueIds: [selectValue.id], includeEmpty: false } },
  } });
  await f.call("deleteSelectValue", { workspaceId, selectValueId: selectValue.id, confirmDeleteUsages: true });
  const after = await f.views(workspaceId);
  assert.equal(after.views.find(v => v.id === activeViewId).valueVisibility["property:priority"], undefined);
  assert.equal((await f.projectList(workspaceId)).length, 1);
});
```

- [ ] **2. RED:** `node --test --test-name-pattern='A5:' test/workspaceAuditRegression.test.js`; ожидается оставшийся filter key или 0 проектов.
- [ ] **3. Реализовать чистое удаление ссылки, сохранив includeEmpty.**

```js
const valueVisibility = structuredClone(view.valueVisibility || {});
const setting = valueVisibility[propertyId];
if (!setting || !setting.valueIds.includes(selectValueId)) return { view, changed: false };
const valueIds = setting.valueIds.filter(id => id !== selectValueId);
if (valueIds.length === 0 && !setting.includeEmpty) delete valueVisibility[propertyId];
else valueVisibility[propertyId] = { ...setting, valueIds };
return { view: { ...view, valueVisibility }, changed: true };
```

- [ ] **4. Подключить cleanup всех Workspaces источника.** Передать viewStore в delete handler. Повторить scope traversal существующего `removePropertyFromSourceViews`: `listWorkspaces(propertyScopeId)` → `listViews(workspace.id)` → pure patch → saveView с updatedAt. Не чистить другой source и не ограничиваться текущим view. Не менять прочие property filters, order или visibility.
- [ ] **5. Сделать interruption-safe deletion.** Под source-scoped process gate: проверить confirmation → атомарно сохранить pending operation → очистить affected views → одной записью properties применить tombstone, значения, историю и убрать pending operation. На startup/перед чтением либо записью затронутой source metadata завершать pending операции. History IDs содержат persisted operation.id, replay не добавляет дублей. Reads не должны выдавать половину каскада. Два handlers внутри одного runtime используют общий gate по metadata paths; это не обещание multi-process lock или полноценной JSON-транзакции.
- [ ] **6. Fault/edge tests:** unused value; single/multi-select; [High,Low]→[Low]; includeEmpty=true с нулём IDs остаётся; несколько views/Workspaces источника; другой источник нетронут; ошибка view save после первой записи → IPC error и persisted pending → новый handler завершает операцию → нет dead references или duplicate history; concurrent view update не теряется за stale snapshot. Старые уже удалённые значения с dangling filters чистятся при идемпотентной repair на загрузке каталога/views, не через invalid public update.
- [ ] **7. Parity/ GREEN:** сравнить с `cascadeDeleteSelectValue` и `removeSelectValueFromView` в `cmd/workspace-sidecar/main.go`; добавить/уточнить Go test на delete-last-filter и includeEmpty. `node --test test/workspaceViews.test.js test/workspacePropertyStore.test.js test/workspaceAuditRegression.test.js test/workspaceIpc.test.js`; затем `npm test`, `go test ./...`, `npm run build:sidecar`, `git --no-pager diff --check`.
- [ ] **8. Docs/review/commit:** описать recoverable cascade и гарантии ACK; `git commit -m "fix: clean view filters when deleting select values"`.

## Task 8: A6 — production UI без демонстрационных fallback

**Files:** Modify `src/App.tsx`, `src/workspaceAppState.ts`, `src/components/workspace/states.tsx`, `src/components/workspace/settings-view.tsx`, `src/i18n/locales/en.js`, `src/i18n/locales/ru.js`, `test/workspaceAppState.test.js`, `test/dashboardStructure.test.js`, `test/rendererBoundary.test.js`, `docs/interface.md`, `docs/flows/board-table-views.md`, `docs/flows/settings-source-folder-and-roles.md`. Mock fixtures могут оставаться в тестах; production imports mock values удалить. Type-only imports допустимы, если не добавляют runtime mock data.

**Interfaces:** Добавить в `workspaceAppState.ts` чистый `getWorkspaceSurfaceKind(state): "loading" | "error" | "empty" | "ready"`. Error state component принимает error, onRetry, onOpenSettings. Settings принимает отсутствующий source как null либо явно `state:"missing"`; на экран не выводится выдуманный connected path. Новых service methods не требуется.

- [ ] **1. RED reducer/presentation test:** использовать существующий TypeScript transpile loader из `test/workspaceAppState.test.js`; экспортируемый selector должен реально использоваться App, не оставаться тестовой имитацией.

```js
const state = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
  type: "serviceError", error: { kind: "opaque", message: "Source folder unavailable" },
});
assert.equal(getWorkspaceSurfaceKind(state), "error");
assert.equal(state.projection, null);
```

- [ ] **2. RED:** `node --test test/workspaceAppState.test.js test/dashboardStructure.test.js`. Добавить boundary assertion отсутствия value imports `workspaceMockProjection/workspaceMockSettings` из App; не заменять этим проверки поведения.
- [ ] **3. Реализовать приоритет состояний и ветви App.**

```ts
export function getWorkspaceSurfaceKind(state: WorkspaceAppState) {
  if (state.status === "error") return "error";
  if (state.status === "idle" || state.status === "loading") return "loading";
  if (state.sourceFolderMissing) return "empty";
  if (!state.projection) return "loading";
  return "ready";
}
```

Error ветка рендерит только error/retry/settings; не рендерит Board/Table под баннером. Сохранённая previous projection может остаться в state для восстановления, но не выдаётся за данные нового Workspace. Успешный pending switch с прежним ready surface сохраняет существующее документированное поведение; failed switch переходит в явную ошибку. Готовую surface дополнительно проверять на соответствие workspace/view, как сейчас делает serviceProjection.

- [ ] **4. Удалить runtime mock fallbacks во всех соседних ветвях:** navigationWorkspaces, viewState, sourceFolder, folderRoleTree, visibleProperties, statusValues, board/table projection, handleCreateView. Без данных — пустые коллекции/null, не Operations/демофайлы. `onRetry` увеличивает reloadToken и использует действующую загрузку; Settings доступен также при ошибке. Create Workspace при отсутствующем root имеет честное disabled/validation состояние.
- [ ] **5. Проверить outcomes:** initial SOURCE_FOLDER_UNAVAILABLE; missing root; corrupt storage; ошибка scan после получения root; ошибка switch с предыдущей projection; retry failure→success; Settings missing/unavailable и отсутствие fake roles. Проверить что retry не теряет user metadata, stale asynchronous response не возвращает старую ошибочную surface. Тексты error/retry/empty используют en/ru catalogs.
- [ ] **6. GREEN frontend gates:** `node --test test/workspaceAppState.test.js test/dashboardStructure.test.js test/rendererBoundary.test.js test/i18n.test.js`; затем `npm test`, `npm run typecheck`, `npm run build:renderer`, `git --no-pager diff --check`.
- [ ] **7. Electron visual/interaction verification:** на изолированной fixture среды, не меняя настоящую source configuration, запустить `npm run electron`. Проверить RU/EN, 1440×960 и 1024×720: initial error, missing source, Retry recovery, Settings recovery, populated Board/Table и detail. Проверить Tab/Enter/focus на Retry/Settings; нет fake rows, disabled недоступные действия, нет overflow. Если screen capture снова недоступен, назвать blocker и не отмечать visual gate PASS.
- [ ] **8. Docs/review/commit:** `git commit -m "fix: remove mock data from workspace error states"` после selective staging.

## Финальная приёмка всех семи исправлений

- [ ] Сопоставить A1–A7 из backlog с тестами/commits Tasks 1–8; A1 закрывается только после Task 5 и подтверждения заявленных платформ.
- [ ] Прогнать полный quality gate, команды по отдельности для однозначного exit status:

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
git --no-pager diff --check
```

- [ ] Проверить последовательно в одной временной metadata fixture: legacy данные → upgrade → rename проекта → редактирование Note → A/B/A → независимые labels → коллидирующие статусы → delete filtered Select → restart. Ни один из следующих slices не должен возвращать предыдущий баг.
- [ ] Повторить все миграции и сравнить логические документы, current values и append-only history; faults после каждой durable стадии не дают false success и восстанавливаются после restart.
- [ ] Review границ: React без backend imports; no external filesystem writes; property/project/status/view IDs не смешиваются; архивы metadata не включают пользовательские файлы. Нет новых зависимостей.
- [ ] Подготовить handoff: changed files, A1–A7 результат, точные test totals/exit status, commits, docs updated, визуальные evidence/ограничения, unrecoverable legacy loss и platform limits. Handoff state Human Review, не Done до принятия пользователем.

## Rollback И Сохранность

До первого schema upgrade при остановленном приложении сохранить согласованный комплект settings/views/properties и существующий projects registry; только app metadata. Реализация создаёт versioned backup перед собственными миграциями, не меняя файл резервной копии при повторном старте.

При сбое не запускать старую версию поверх новой схемы. Остановить приложение, сохранить новые данные отдельно и восстановить согласованный комплект backup; изменения после backup требуют отдельного переноса, их нельзя молча отбросить. Восстановление настоящих пользовательских metadata — отдельное явное действие, не часть тестового прогона.

## Plan Self-Review

- Coverage: A1 → Tasks 4–5; A2 → 1; A3 → 2; A4 → 6; A5 → 7; A6 → 8; A7 → 3.
- Scope: семь дефектов; новые subsystem changes ограничены Proposed ADR-004, без packaging/sync/global refactor.
- Compatibility: legacy IDs остаются opaque; source identity не меняется; migration сохраняет history и не угадывает потерянные значения.
- Interfaces: fixture определён в Task 1; registry в Task 4 потребляется Task 5; pure filter helper определяется и используется в Task 7; selector определяется и используется в Task 8.
- Execution choice после разрешения: subagent-driven-development с review каждого slice либо executing-plans в текущей задаче. Выбор способа не заменяет принятие ADR-004.

## Workflow Evidence

- Mode: Bug Diagnosis — план исправлений после Review.
- Docs read: WORKFLOW, architecture, prd, data-model, ui-guidelines, interface, API properties/views, flows, ADR-001/002/003, existing implementation plans.
- Branch: codex/feature-russian-localization.
- Acceptance criteria or expected behavior: все A1–A7 из связанного backlog, без потери текущих metadata.
- Quality gates: для планирования — review покрытия, путей, ссылок и documentation test; для исполнения — focused RED/GREEN, полный набор и Electron visual QA.
- Handoff state: Human Review. Документы подготовлены; исправления и миграции не выполнялись.
