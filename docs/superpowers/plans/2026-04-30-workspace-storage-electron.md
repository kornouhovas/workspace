# Workspace Storage Electron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Workspace storage MVP: current UI packaged through Electron, backend calls routed through a safe preload API, and Workspace objects/properties persisted through an `any-store` Go sidecar.

**Architecture:** Keep the renderer UI close to the current browser app, but move privileged operations behind Electron main and preload. Add a narrow Workspace service contract so renderer code talks to `window.workspace` in Electron and can still fall back to HTTP during browser development. Add a Go sidecar that owns the `any-store` database and exposes local JSON endpoints to Electron main.

**Tech Stack:** Electron, vanilla HTML/CSS/JavaScript modules, Node `node:test`, Go 1.24+, `github.com/anyproto/any-store`, local JSON transport, macOS local filesystem APIs through Electron main.

---

## File Structure

- Modify `package.json`: rename package to `workspace`, add Electron scripts and dev dependency.
- Modify `README.md`: rename product documentation to Workspace, describe Electron and any-store.
- Modify `src/workspaceBackend.js`: rename storage directory constants from `.folder-kanban` to `.workspace` with legacy migration support.
- Modify `test/workspaceBackend.test.js`: cover new Workspace data paths and legacy property migration.
- Create `src/workspaceProperties.js`: property type definitions, schema normalization, and value normalization.
- Create `test/workspaceProperties.test.js`: property type tests.
- Create `src/workspaceObjects.js`: folder scan to Workspace object/property projection.
- Create `test/workspaceObjects.test.js`: projection and preservation tests.
- Create `src/workspaceServiceClient.js`: transport-agnostic client used by Electron main and development backend.
- Create `test/workspaceServiceClient.test.js`: fake transport tests.
- Create `electron/main.js`: Electron BrowserWindow, sidecar lifecycle, IPC handlers.
- Create `electron/preload.js`: safe renderer API exposed as `window.workspace`.
- Modify `app.js`: route backend calls through a shared API adapter that uses `window.workspace` when present and HTTP fetch otherwise.
- Create `cmd/workspace-sidecar/main.go`: Go sidecar HTTP server.
- Create `internal/workspacestore/store.go`: any-store persistence wrapper.
- Create `internal/workspacestore/store_test.go`: Go persistence tests.
- Create `THIRD_PARTY_NOTICES.md`: document `any-store` MIT license.
- Modify `.gitignore`: ignore generated Workspace data and sidecar binaries.

## Preconditions

- [ ] **Step 1: Confirm branch**

Run:

```bash
git status --short --branch
```

Expected:

```text
## Storage
```

- [ ] **Step 2: Confirm Node works**

Run:

```bash
npm test
```

Expected: all existing Node tests pass.

- [ ] **Step 3: Confirm Go toolchain or install it**

Run:

```bash
go version
```

Expected after setup:

```text
go version go1.24
```

If `go` is missing on macOS, install it before Task 5:

```bash
brew install go
go version
```

Expected: `go version` prints Go 1.24 or newer.

### Task 1: Workspace Naming and Local Data Paths

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `src/workspaceBackend.js`
- Modify: `test/workspaceBackend.test.js`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing path migration tests**

Extend the existing imports in `test/workspaceBackend.test.js` so they include `existsSync`, `dirname`, and the legacy path constants:

```js
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import {
  defaultLegacyWorkspacePropertiesPath,
  defaultLegacyWorkspaceSettingsPath,
  defaultWorkspacePropertiesPath,
  defaultWorkspaceSettingsPath,
} from "../src/workspaceBackend.js";
```

Add these tests to `test/workspaceBackend.test.js`:

```js

test("workspace backend uses .workspace data paths", () => {
  assert.match(defaultWorkspaceSettingsPath, /\/\.workspace\/settings\.json$/);
  assert.match(defaultWorkspacePropertiesPath, /\/\.workspace\/properties\.json$/);
  assert.match(defaultLegacyWorkspaceSettingsPath, /\/\.folder-kanban\/settings\.json$/);
  assert.match(defaultLegacyWorkspacePropertiesPath, /\/\.folder-kanban\/properties\.json$/);
});

test("readWorkspaceSettings migrates legacy settings when new settings are missing", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "workspace-data-"));
  const configPath = join(dataDir, ".workspace", "settings.json");
  const legacyConfigPath = join(dataDir, ".folder-kanban", "settings.json");
  await mkdir(dirname(legacyConfigPath), { recursive: true });
  await writeFile(legacyConfigPath, JSON.stringify({ rootPath: "/tmp/workspace-root" }));

  const settings = await readWorkspaceSettings(configPath, legacyConfigPath);

  assert.deepEqual(settings, { rootPath: "/tmp/workspace-root" });
  assert.equal(existsSync(configPath), true);
});

test("readWorkspaceProperties migrates legacy properties when new properties are missing", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "workspace-data-"));
  const propertiesPath = join(dataDir, ".workspace", "properties.json");
  const legacyPropertiesPath = join(dataDir, ".folder-kanban", "properties.json");
  await mkdir(dirname(legacyPropertiesPath), { recursive: true });
  await writeFile(legacyPropertiesPath, JSON.stringify({ roots: { abc: { Project: { text: "legacy" } } } }));

  const properties = await readWorkspaceProperties(propertiesPath, legacyPropertiesPath);

  assert.equal(properties.roots.abc.Project.text, "legacy");
  assert.equal(existsSync(propertiesPath), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test --test-name-pattern "workspace backend uses|migrates legacy" test/workspaceBackend.test.js
```

Expected: FAIL because `.workspace` constants and legacy migration arguments do not exist.

- [ ] **Step 3: Implement storage path migration**

In `src/workspaceBackend.js`, replace the existing data path constants and read helpers with:

```js
export const defaultWorkspaceDataDirectory = join(process.cwd(), ".workspace");
export const defaultLegacyWorkspaceDataDirectory = join(process.cwd(), ".folder-kanban");
export const defaultWorkspaceSettingsPath = join(defaultWorkspaceDataDirectory, "settings.json");
export const defaultWorkspacePropertiesPath = join(defaultWorkspaceDataDirectory, "properties.json");
export const defaultLegacyWorkspaceSettingsPath = join(defaultLegacyWorkspaceDataDirectory, "settings.json");
export const defaultLegacyWorkspacePropertiesPath = join(defaultLegacyWorkspaceDataDirectory, "properties.json");

export async function readWorkspaceSettings(
  configPath = defaultWorkspaceSettingsPath,
  legacyConfigPath = defaultLegacyWorkspaceSettingsPath,
) {
  const settings = await readJsonFile(configPath);
  if (settings) {
    return settings;
  }

  const legacySettings = await readJsonFile(legacyConfigPath);
  if (!legacySettings) {
    return {};
  }

  await writeWorkspaceSettings(configPath, legacySettings);
  return legacySettings;
}

export async function readWorkspaceProperties(
  propertiesPath = defaultWorkspacePropertiesPath,
  legacyPropertiesPath = defaultLegacyWorkspacePropertiesPath,
) {
  const properties = await readJsonFile(propertiesPath);
  if (properties) {
    return normalizeWorkspaceProperties(properties);
  }

  const legacyProperties = await readJsonFile(legacyPropertiesPath);
  if (!legacyProperties) {
    return { roots: {} };
  }

  await writeWorkspaceProperties(propertiesPath, legacyProperties);
  return normalizeWorkspaceProperties(legacyProperties);
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}
```

Update callers that pass only `configPath` or `propertiesPath`; default legacy paths should continue working without call-site changes.

- [ ] **Step 4: Rename package and README**

In `package.json`, change:

```json
{
  "name": "workspace",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "dev": "node dev-server.js"
  }
}
```

In `README.md`, replace the title and app-data references:

```markdown
# Workspace

Локальное приложение для работы с workspace-папкой.

Выбранный абсолютный путь сохраняется локально в `.workspace/settings.json`.
Если рядом есть старые `.folder-kanban/settings.json` или `.folder-kanban/properties.json`, приложение мигрирует их в `.workspace/` при чтении.
```

In `.gitignore`, ensure these entries exist:

```gitignore
.workspace/
.folder-kanban/
workspace-sidecar
workspace-sidecar.exe
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
node --test --test-name-pattern "workspace backend uses|migrates legacy" test/workspaceBackend.test.js
npm test
```

Expected: targeted tests pass, then all Node tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json README.md src/workspaceBackend.js test/workspaceBackend.test.js .gitignore
git commit -m "Rename workspace data paths"
```

### Task 2: Property Type Domain

**Files:**
- Create: `src/workspaceProperties.js`
- Create: `test/workspaceProperties.test.js`

- [ ] **Step 1: Write failing property tests**

Create `test/workspaceProperties.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultPropertySchemas,
  normalizePropertySchema,
  normalizePropertyValue,
  propertyTypeIds,
} from "../src/workspaceProperties.js";

test("propertyTypeIds exposes MVP Notion-like property types", () => {
  assert.deepEqual(propertyTypeIds, ["text", "number", "date", "select", "multi-select"]);
});

test("createDefaultPropertySchemas returns system Name and Status plus editable Text", () => {
  assert.deepEqual(createDefaultPropertySchemas("workspace-1").map((schema) => [schema.id, schema.name, schema.type, schema.system]), [
    ["property:name", "Name", "text", true],
    ["property:status", "Status", "select", true],
    ["property:text", "Text", "text", false],
  ]);
});

test("normalizePropertyValue normalizes text number date select and multi-select", () => {
  assert.equal(normalizePropertyValue("text", 12), "12");
  assert.equal(normalizePropertyValue("number", "42.5"), 42.5);
  assert.equal(normalizePropertyValue("number", ""), null);
  assert.equal(normalizePropertyValue("date", "2026-04-30"), "2026-04-30");
  assert.equal(normalizePropertyValue("date", "bad"), null);
  assert.equal(normalizePropertyValue("select", "option-a"), "option-a");
  assert.deepEqual(normalizePropertyValue("multi-select", ["b", "a", "b"]), ["b", "a"]);
});

test("normalizePropertySchema preserves future config and falls back to text for unknown type", () => {
  assert.deepEqual(
    normalizePropertySchema({
      id: "property:priority",
      workspaceId: "workspace-1",
      name: "Priority",
      type: "select",
      config: { options: [{ id: "high", name: "High", color: "red" }] },
      order: 40,
    }),
    {
      id: "property:priority",
      workspaceId: "workspace-1",
      name: "Priority",
      type: "select",
      system: false,
      hidden: false,
      order: 40,
      config: { options: [{ id: "high", name: "High", color: "red" }] },
    },
  );

  assert.equal(normalizePropertySchema({ id: "x", name: "X", type: "formula" }).type, "text");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test test/workspaceProperties.test.js
```

Expected: FAIL because `src/workspaceProperties.js` does not exist.

- [ ] **Step 3: Implement property domain**

Create `src/workspaceProperties.js`:

```js
export const propertyTypeIds = ["text", "number", "date", "select", "multi-select"];

export function createDefaultPropertySchemas(workspaceId) {
  return [
    normalizePropertySchema({
      id: "property:name",
      workspaceId,
      name: "Name",
      type: "text",
      system: true,
      order: 10,
    }),
    normalizePropertySchema({
      id: "property:status",
      workspaceId,
      name: "Status",
      type: "select",
      system: true,
      order: 20,
    }),
    normalizePropertySchema({
      id: "property:text",
      workspaceId,
      name: "Text",
      type: "text",
      system: false,
      order: 30,
    }),
  ];
}

export function normalizePropertySchema(schema = {}) {
  const type = propertyTypeIds.includes(schema.type) ? schema.type : "text";
  return {
    id: typeof schema.id === "string" && schema.id ? schema.id : `property:${type}`,
    workspaceId: typeof schema.workspaceId === "string" ? schema.workspaceId : "",
    name: typeof schema.name === "string" && schema.name.trim() ? schema.name.trim() : "Untitled",
    type,
    system: schema.system === true,
    hidden: schema.hidden === true,
    order: Number.isFinite(schema.order) ? schema.order : 100,
    config: normalizePropertyConfig(type, schema.config),
  };
}

export function normalizePropertyValue(type, value) {
  if (type === "number") {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  if (type === "date") {
    if (typeof value !== "string") {
      return null;
    }
    return /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
      ? value
      : null;
  }

  if (type === "select") {
    return typeof value === "string" && value ? value : null;
  }

  if (type === "multi-select") {
    if (!Array.isArray(value)) {
      return [];
    }
    return [...new Set(value.filter((item) => typeof item === "string" && item))];
  }

  return value === null || value === undefined ? "" : String(value);
}

function normalizePropertyConfig(type, config = {}) {
  if (type !== "select" && type !== "multi-select") {
    return config && typeof config === "object" && !Array.isArray(config) ? { ...config } : {};
  }

  const options = Array.isArray(config?.options) ? config.options : [];
  return {
    ...config,
    options: options
      .filter((option) => option && typeof option.id === "string" && typeof option.name === "string")
      .map((option, index) => ({
        id: option.id,
        name: option.name,
        color: typeof option.color === "string" ? option.color : "gray",
        order: Number.isFinite(option.order) ? option.order : index,
      })),
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node --test test/workspaceProperties.test.js
npm test
```

Expected: property tests pass, then all Node tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/workspaceProperties.js test/workspaceProperties.test.js
git commit -m "Add workspace property types"
```

### Task 3: Folder Scan Projection to Workspace Objects

**Files:**
- Create: `src/workspaceObjects.js`
- Create: `test/workspaceObjects.test.js`
- Modify: `src/workspaceBackend.js`
- Modify: `test/workspaceBackend.test.js`

- [ ] **Step 1: Write failing projection tests**

Create `test/workspaceObjects.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createFolderObjectId,
  projectFoldersToWorkspaceObjects,
  readSystemPropertyValue,
} from "../src/workspaceObjects.js";

test("createFolderObjectId creates stable ids from workspace and folder path", () => {
  assert.equal(createFolderObjectId("workspace-main", "Active/Project Alpha"), "object:workspace-main:active-project-alpha");
});

test("projectFoldersToWorkspaceObjects converts folder cards into Workspace objects", () => {
  const result = projectFoldersToWorkspaceObjects({
    workspaceId: "workspace-main",
    rootPath: "/Users/example/Objects",
    folders: [
      { name: "Project Alpha", status: "Active", path: "Active/Project Alpha", text: "keep me" },
    ],
  });

  assert.deepEqual(result.objects, [
    {
      id: "object:workspace-main:active-project-alpha",
      workspaceId: "workspace-main",
      type: "project",
      source: {
        kind: "folder",
        path: "Active/Project Alpha",
        absoluteRoot: "/Users/example/Objects",
      },
      folderName: "Project Alpha",
      folderStatus: "Active",
    },
  ]);
  assert.deepEqual(result.propertyValues, [
    {
      id: "value:object:workspace-main:active-project-alpha:property:text",
      workspaceId: "workspace-main",
      objectId: "object:workspace-main:active-project-alpha",
      propertyId: "property:text",
      type: "text",
      value: "keep me",
    },
  ]);
});

test("readSystemPropertyValue reads Name and Status from folder-derived fields", () => {
  const object = { folderName: "Project Alpha", folderStatus: "Active" };
  assert.equal(readSystemPropertyValue(object, "property:name"), "Project Alpha");
  assert.equal(readSystemPropertyValue(object, "property:status"), "Active");
  assert.equal(readSystemPropertyValue(object, "property:text"), undefined);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test test/workspaceObjects.test.js
```

Expected: FAIL because `src/workspaceObjects.js` does not exist.

- [ ] **Step 3: Implement projection module**

Create `src/workspaceObjects.js`:

```js
import { normalizePropertyValue } from "./workspaceProperties.js";

export function projectFoldersToWorkspaceObjects({ workspaceId, rootPath, folders }) {
  const objects = [];
  const propertyValues = [];

  for (const folder of folders) {
    const objectId = createFolderObjectId(workspaceId, folder.path || folder.name);
    objects.push({
      id: objectId,
      workspaceId,
      type: "project",
      source: {
        kind: "folder",
        path: folder.path || folder.name,
        absoluteRoot: rootPath,
      },
      folderName: folder.name,
      folderStatus: folder.status,
    });

    const text = normalizePropertyValue("text", folder.text);
    if (text) {
      propertyValues.push({
        id: createPropertyValueId(objectId, "property:text"),
        workspaceId,
        objectId,
        propertyId: "property:text",
        type: "text",
        value: text,
      });
    }
  }

  return { objects, propertyValues };
}

export function createFolderObjectId(workspaceId, folderPath) {
  return `object:${workspaceId}:${slugify(folderPath)}`;
}

export function createPropertyValueId(objectId, propertyId) {
  return `value:${objectId}:${propertyId}`;
}

export function readSystemPropertyValue(object, propertyId) {
  if (propertyId === "property:name") {
    return object.folderName;
  }
  if (propertyId === "property:status") {
    return object.folderStatus;
  }
  return undefined;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}
```

- [ ] **Step 4: Add backend response projection without changing UI payload**

In `src/workspaceBackend.js`, import:

```js
import { projectFoldersToWorkspaceObjects } from "./workspaceObjects.js";
```

Inside `createScanResponse`, after `folders` is built, add:

```js
const workspaceId = createWorkspaceId(root);
const projected = projectFoldersToWorkspaceObjects({
  workspaceId,
  rootPath: root,
  folders,
});
```

Return projection in addition to the existing payload:

```js
return createJsonResponse(200, {
  root: createRootPayload(root),
  tree,
  folders,
  workspace: {
    id: workspaceId,
    objects: projected.objects,
    propertyValues: projected.propertyValues,
  },
});
```

Add helper:

```js
function createWorkspaceId(root) {
  return `workspace:${createRootPropertiesKey(root)}`;
}
```

- [ ] **Step 5: Add backend projection assertion**

In `test/workspaceBackend.test.js`, extend `createScanResponse builds access tree and cards from saved root`:

```js
assert.equal(response.payload.workspace.id, `workspace:${createRootPropertiesKey(root)}`);
assert.deepEqual(
  response.payload.workspace.objects.map((object) => [object.folderName, object.folderStatus, object.source.path]),
  [
    ["Project Alpha", "Active", "Active/Project Alpha"],
    ["Completed", "Archive", "Archive/Completed"],
  ],
);
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```bash
node --test test/workspaceObjects.test.js
node --test --test-name-pattern "createScanResponse builds access tree" test/workspaceBackend.test.js
npm test
```

Expected: projection tests pass, targeted backend test passes, then all Node tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/workspaceObjects.js test/workspaceObjects.test.js src/workspaceBackend.js test/workspaceBackend.test.js
git commit -m "Project folders into workspace objects"
```

### Task 4: Workspace Service Client Contract

**Files:**
- Create: `src/workspaceServiceClient.js`
- Create: `test/workspaceServiceClient.test.js`

- [ ] **Step 1: Write failing client tests**

Create `test/workspaceServiceClient.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceServiceClient } from "../src/workspaceServiceClient.js";

function createRecordingTransport() {
  const calls = [];
  return {
    calls,
    async request(method, payload) {
      calls.push([method, payload]);
      return { ok: true, method, payload };
    },
  };
}

test("WorkspaceServiceClient sends named service methods through transport", async () => {
  const transport = createRecordingTransport();
  const client = new WorkspaceServiceClient(transport);

  await client.getRoot();
  await client.setRoot({ rootPath: "/tmp/workspace" });
  await client.scan({ rules: { Active: { role: "status" } } });
  await client.listEntries({ path: "Active/Project Alpha" });
  await client.saveProperty({ path: "Active/Project Alpha", propertyId: "property:text", type: "text", value: "note" });

  assert.deepEqual(transport.calls, [
    ["workspace.getRoot", {}],
    ["workspace.setRoot", { rootPath: "/tmp/workspace" }],
    ["workspace.scan", { rules: { Active: { role: "status" } } }],
    ["workspace.listEntries", { path: "Active/Project Alpha" }],
    ["workspace.saveProperty", { path: "Active/Project Alpha", propertyId: "property:text", type: "text", value: "note" }],
  ]);
});

test("WorkspaceServiceClient rejects missing transport request function", () => {
  assert.throws(() => new WorkspaceServiceClient({}), /transport.request/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test test/workspaceServiceClient.test.js
```

Expected: FAIL because `src/workspaceServiceClient.js` does not exist.

- [ ] **Step 3: Implement client**

Create `src/workspaceServiceClient.js`:

```js
export class WorkspaceServiceClient {
  constructor(transport) {
    if (!transport || typeof transport.request !== "function") {
      throw new TypeError("WorkspaceServiceClient requires transport.request(method, payload).");
    }
    this.transport = transport;
  }

  getRoot() {
    return this.transport.request("workspace.getRoot", {});
  }

  setRoot(payload) {
    return this.transport.request("workspace.setRoot", normalizeObjectPayload(payload));
  }

  scan(payload) {
    return this.transport.request("workspace.scan", normalizeObjectPayload(payload));
  }

  listEntries(payload) {
    return this.transport.request("workspace.listEntries", normalizeObjectPayload(payload));
  }

  saveProperty(payload) {
    return this.transport.request("workspace.saveProperty", normalizeObjectPayload(payload));
  }

  reveal(payload) {
    return this.transport.request("workspace.reveal", normalizeObjectPayload(payload));
  }

  previewFile(payload) {
    return this.transport.request("workspace.previewFile", normalizeObjectPayload(payload));
  }
}

function normalizeObjectPayload(payload) {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node --test test/workspaceServiceClient.test.js
npm test
```

Expected: client tests pass, then all Node tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/workspaceServiceClient.js test/workspaceServiceClient.test.js
git commit -m "Add workspace service client"
```

### Task 5: Go any-store Sidecar

**Files:**
- Create: `go.mod`
- Create: `cmd/workspace-sidecar/main.go`
- Create: `internal/workspacestore/store.go`
- Create: `internal/workspacestore/store_test.go`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize Go module**

Run:

```bash
go mod init workspace
go get github.com/anyproto/any-store@latest
```

Expected: `go.mod` and `go.sum` are created, and `go.mod` includes `github.com/anyproto/any-store`.

- [ ] **Step 2: Write failing Go storage tests**

Create `internal/workspacestore/store_test.go`:

```go
package workspacestore

import (
	"context"
	"path/filepath"
	"testing"
)

func TestStorePersistsWorkspaceRootAndPropertyValue(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	if err := store.SetRoot(ctx, RootDocument{
		ID:       "workspace:root",
		RootPath: "/tmp/workspace-root",
		Name:     "workspace-root",
	}); err != nil {
		t.Fatal(err)
	}

	root, err := store.GetRoot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if root.RootPath != "/tmp/workspace-root" {
		t.Fatalf("expected root path to persist, got %q", root.RootPath)
	}

	value := PropertyValueDocument{
		ID:          "value:object-1:property:text",
		WorkspaceID: "workspace:root",
		ObjectID:    "object-1",
		PropertyID:  "property:text",
		Type:        "text",
		Value:       "note",
	}
	if err := store.UpsertPropertyValue(ctx, value); err != nil {
		t.Fatal(err)
	}

	values, err := store.ListPropertyValues(ctx, "workspace:root")
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 || values[0].Value != "note" {
		t.Fatalf("expected saved text value, got %#v", values)
	}
}
```

- [ ] **Step 3: Run Go test to verify it fails**

Run:

```bash
go test ./internal/workspacestore
```

Expected: FAIL because `Open`, `RootDocument`, and `PropertyValueDocument` are not defined.

- [ ] **Step 4: Implement any-store wrapper**

Create `internal/workspacestore/store.go`:

```go
package workspacestore

import (
	"context"
	"encoding/json"
	"errors"

	anystore "github.com/anyproto/any-store"
	"github.com/anyproto/any-store/anyenc"
)

const rootDocumentID = "workspace:root"

type Store struct {
	db anystore.DB
}

type RootDocument struct {
	ID       string `json:"id"`
	RootPath string `json:"rootPath"`
	Name     string `json:"name"`
}

type PropertyValueDocument struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspaceId"`
	ObjectID    string `json:"objectId"`
	PropertyID  string `json:"propertyId"`
	Type        string `json:"type"`
	Value       any    `json:"value"`
}

func Open(ctx context.Context, path string) (*Store, error) {
	db, err := anystore.Open(ctx, path, nil)
	if err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) SetRoot(ctx context.Context, root RootDocument) error {
	if root.ID == "" {
		root.ID = rootDocumentID
	}
	return s.upsertJSON(ctx, "workspaces", root)
}

func (s *Store) GetRoot(ctx context.Context) (RootDocument, error) {
	coll, err := s.db.Collection(ctx, "workspaces")
	if err != nil {
		return RootDocument{}, err
	}
	doc, err := coll.FindId(ctx, rootDocumentID)
	if err != nil {
		if errors.Is(err, anystore.ErrDocNotFound) {
			return RootDocument{}, nil
		}
		return RootDocument{}, err
	}
	var root RootDocument
	if err := json.Unmarshal([]byte(doc.Value().String()), &root); err != nil {
		return RootDocument{}, err
	}
	return root, nil
}

func (s *Store) UpsertPropertyValue(ctx context.Context, value PropertyValueDocument) error {
	return s.upsertJSON(ctx, "property_values", value)
}

func (s *Store) ListPropertyValues(ctx context.Context, workspaceID string) ([]PropertyValueDocument, error) {
	coll, err := s.db.Collection(ctx, "property_values")
	if err != nil {
		return nil, err
	}
	iter, err := coll.Find(map[string]any{"workspaceId": workspaceID}).Iter(ctx)
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	var values []PropertyValueDocument
	for iter.Next() {
		doc, err := iter.Doc()
		if err != nil {
			return nil, err
		}
		var value PropertyValueDocument
		if err := json.Unmarshal([]byte(doc.Value().String()), &value); err != nil {
			return nil, err
		}
		values = append(values, value)
	}
	return values, iter.Err()
}

func (s *Store) upsertJSON(ctx context.Context, collectionName string, doc any) error {
	data, err := json.Marshal(doc)
	if err != nil {
		return err
	}
	coll, err := s.db.Collection(ctx, collectionName)
	if err != nil {
		return err
	}
	return coll.UpsertOne(ctx, anyenc.MustParseJson(string(data)))
}
```

- [ ] **Step 5: Add sidecar HTTP server**

Create `cmd/workspace-sidecar/main.go`:

```go
package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"net"
	"net/http"

	"workspace/internal/workspacestore"
)

func main() {
	dbPath := flag.String("db", "workspace.db", "path to any-store database")
	addr := flag.String("addr", "127.0.0.1:0", "listen address")
	flag.Parse()

	ctx := context.Background()
	store, err := workspacestore.Open(ctx, *dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
	mux.HandleFunc("/workspace/root", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			root, err := store.GetRoot(r.Context())
			writeResult(w, root, err)
			return
		}
		if r.Method == http.MethodPut {
			var root workspacestore.RootDocument
			if err := json.NewDecoder(r.Body).Decode(&root); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			writeResult(w, map[string]any{"ok": true}, store.SetRoot(r.Context(), root))
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
	})

	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("workspace-sidecar listening on %s", listener.Addr().String())
	log.Fatal(http.Serve(listener, mux))
}

func writeResult(w http.ResponseWriter, payload any, err error) {
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
```

- [ ] **Step 6: Run Go tests and build**

Run:

```bash
go test ./...
go build -o workspace-sidecar ./cmd/workspace-sidecar
```

Expected: Go tests pass and `workspace-sidecar` binary is created.

- [ ] **Step 7: Commit**

Run:

```bash
git add go.mod go.sum cmd internal .gitignore
git commit -m "Add any-store workspace sidecar"
```

### Task 6: Electron Shell and Preload API

**Files:**
- Modify: `package.json`
- Create: `electron/main.js`
- Create: `electron/preload.js`
- Create: `test/electronStructure.test.js`

- [ ] **Step 1: Install Electron**

Run:

```bash
npm install --save-dev electron
```

Expected: `package.json` and `package-lock.json` include Electron.

- [ ] **Step 2: Write structural Electron tests**

Create `test/electronStructure.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Electron main creates BrowserWindow with isolated preload", async () => {
  const main = await readFile(new URL("../electron/main.js", import.meta.url), "utf8");

  assert.match(main, /new BrowserWindow\(/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /preload:\s*join\(__dirname,\s*"preload\.js"\)/);
  assert.match(main, /ipcMain\.handle\("workspace:getRoot"/);
});

test("preload exposes a narrow workspace API", async () => {
  const preload = await readFile(new URL("../electron/preload.js", import.meta.url), "utf8");

  assert.match(preload, /contextBridge\.exposeInMainWorld\("workspace"/);
  assert.match(preload, /getRoot:\s*\(\) => ipcRenderer\.invoke\("workspace:getRoot"\)/);
  assert.match(preload, /scan:\s*\(payload\) => ipcRenderer\.invoke\("workspace:scan", payload\)/);
  assert.doesNotMatch(preload, /require\("fs"\)/);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
node --test test/electronStructure.test.js
```

Expected: FAIL because Electron files do not exist.

- [ ] **Step 4: Implement Electron main**

Create `electron/main.js`:

```js
import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createListEntriesResponse,
  createRootResponse,
  createScanResponse,
  createSelectRootResponse,
  defaultWorkspaceSettingsPath,
  readWorkspaceSettings,
} from "../src/workspaceBackend.js";
import { createRevealResponse } from "../src/localOpen.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    backgroundColor: "#181818",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.js"),
    },
  });

  await mainWindow.loadFile(join(__dirname, "..", "index.html"));
}

function registerWorkspaceHandlers() {
  ipcMain.handle("workspace:getRoot", () => createRootResponse());
  ipcMain.handle("workspace:selectRoot", () => createSelectRootResponse());
  ipcMain.handle("workspace:scan", async (_event, payload = {}) => {
    const settings = await readWorkspaceSettings(defaultWorkspaceSettingsPath);
    return createScanResponse({ root: settings.rootPath, rules: payload.rules });
  });
  ipcMain.handle("workspace:listEntries", async (_event, payload = {}) => {
    const settings = await readWorkspaceSettings(defaultWorkspaceSettingsPath);
    return createListEntriesResponse({ root: settings.rootPath, body: payload });
  });
  ipcMain.handle("workspace:reveal", async (_event, payload = {}) => {
    const settings = await readWorkspaceSettings(defaultWorkspaceSettingsPath);
    return createRevealResponse({ root: settings.rootPath, body: payload });
  });
}

app.whenReady().then(async () => {
  registerWorkspaceHandlers();
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
```

- [ ] **Step 5: Implement preload**

Create `electron/preload.js`:

```js
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("workspace", {
  getRoot: () => ipcRenderer.invoke("workspace:getRoot"),
  selectRoot: () => ipcRenderer.invoke("workspace:selectRoot"),
  scan: (payload) => ipcRenderer.invoke("workspace:scan", payload),
  listEntries: (payload) => ipcRenderer.invoke("workspace:listEntries", payload),
  reveal: (payload) => ipcRenderer.invoke("workspace:reveal", payload),
});
```

- [ ] **Step 6: Add Electron scripts**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "test": "node --test",
    "dev": "node dev-server.js",
    "electron": "electron electron/main.js"
  }
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
node --test test/electronStructure.test.js
npm test
```

Expected: Electron structural tests pass, then all Node tests pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add package.json package-lock.json electron test/electronStructure.test.js
git commit -m "Add Electron workspace shell"
```

### Task 7: Renderer Workspace API Adapter

**Files:**
- Modify: `app.js`
- Modify: `test/uiStructure.test.js`

- [ ] **Step 1: Write failing UI structure assertions**

In `test/uiStructure.test.js`, add to the app structure test that currently checks backend calls:

```js
assert.match(app, /function hasElectronWorkspaceApi\(\)/);
assert.match(app, /window\.workspace/);
assert.match(app, /workspaceRequest\("getRoot"/);
assert.match(app, /workspaceRequest\("scan", \{ rules: folderAccessRules \}\)/);
assert.match(app, /workspaceRequest\("listEntries", \{ path: folderPath \}\)/);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test --test-name-pattern "table and card place|settings access|folder board" test/uiStructure.test.js
```

Expected: FAIL because `workspaceRequest` and Electron API detection do not exist.

- [ ] **Step 3: Add workspace API adapter**

In `app.js`, near the existing `fetchJson` and `postJson` helpers, add:

```js
function hasElectronWorkspaceApi() {
  return Boolean(window.workspace && typeof window.workspace.getRoot === "function");
}

async function workspaceRequest(action, payload = {}) {
  if (hasElectronWorkspaceApi() && typeof window.workspace[action] === "function") {
    const response = await window.workspace[action](payload);
    if (response?.status && response.status >= 400) {
      throw new Error(response.payload?.error || "Workspace request failed.");
    }
    return response?.payload || response;
  }

  const route = getWorkspaceHttpRoute(action, payload);
  if (route.method === "GET") {
    return fetchJson(route.url);
  }
  return postJson(route.url, route.body);
}

function getWorkspaceHttpRoute(action, payload) {
  if (action === "getRoot") {
    return { method: "GET", url: "/api/root" };
  }
  if (action === "selectRoot") {
    return { method: "POST", url: "/api/select-root", body: payload };
  }
  if (action === "scan") {
    return { method: "POST", url: "/api/scan", body: payload };
  }
  if (action === "listEntries") {
    return { method: "POST", url: "/api/list-entries", body: payload };
  }
  if (action === "reveal") {
    return { method: "POST", url: "/api/reveal", body: payload };
  }
  throw new Error(`Unknown workspace action: ${action}`);
}
```

Replace current direct fetch/post call sites:

```js
const root = await fetchWorkspaceRoot();
```

uses:

```js
async function fetchWorkspaceRoot() {
  const data = await workspaceRequest("getRoot");
  return data.root || null;
}
```

Replace `/api/select-root`, `/api/scan`, `/api/list-entries`, and `/api/reveal` calls with `workspaceRequest("selectRoot")`, `workspaceRequest("scan", { rules: folderAccessRules })`, `workspaceRequest("listEntries", { path: folderPath })`, and `workspaceRequest("reveal", { path, kind })`.

- [ ] **Step 4: Run tests**

Run:

```bash
node --test --test-name-pattern "table and card place|settings access|folder board" test/uiStructure.test.js
npm test
```

Expected: targeted UI structure tests pass, then all Node tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add app.js test/uiStructure.test.js
git commit -m "Route renderer through workspace API"
```

### Task 8: Sidecar Client Wiring in Electron Main

**Files:**
- Modify: `electron/main.js`
- Create: `electron/sidecarClient.js`
- Create: `test/sidecarClient.test.js`

- [ ] **Step 1: Write fake sidecar client tests**

Create `test/sidecarClient.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createSidecarHttpTransport } from "../electron/sidecarClient.js";

test("createSidecarHttpTransport maps service methods to sidecar routes", async () => {
  const calls = [];
  const transport = createSidecarHttpTransport("http://127.0.0.1:5000", async (url, options = {}) => {
    calls.push([url, options.method || "GET", options.body ? JSON.parse(options.body) : null]);
    return {
      ok: true,
      async json() {
        return { ok: true };
      },
    };
  });

  await transport.request("workspace.getRoot", {});
  await transport.request("workspace.setRoot", { rootPath: "/tmp/workspace" });

  assert.deepEqual(calls, [
    ["http://127.0.0.1:5000/workspace/root", "GET", null],
    ["http://127.0.0.1:5000/workspace/root", "PUT", { rootPath: "/tmp/workspace" }],
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test test/sidecarClient.test.js
```

Expected: FAIL because `electron/sidecarClient.js` does not exist.

- [ ] **Step 3: Implement sidecar HTTP transport**

Create `electron/sidecarClient.js`:

```js
export function createSidecarHttpTransport(baseUrl, fetchImpl = fetch) {
  return {
    async request(method, payload = {}) {
      const route = getSidecarRoute(method);
      const response = await fetchImpl(`${baseUrl}${route.path}`, {
        method: route.httpMethod,
        headers: route.httpMethod === "GET" ? undefined : { "content-type": "application/json" },
        body: route.httpMethod === "GET" ? undefined : JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Sidecar request failed: ${method}`);
      }
      return data;
    },
  };
}

function getSidecarRoute(method) {
  if (method === "workspace.getRoot") {
    return { httpMethod: "GET", path: "/workspace/root" };
  }
  if (method === "workspace.setRoot") {
    return { httpMethod: "PUT", path: "/workspace/root" };
  }
  throw new Error(`Unsupported sidecar method: ${method}`);
}
```

- [ ] **Step 4: Wire Electron main to client boundary**

In `electron/main.js`, import:

```js
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createSidecarHttpTransport } from "./sidecarClient.js";
import { WorkspaceServiceClient } from "../src/workspaceServiceClient.js";
```

Add sidecar state:

```js
let workspaceClient = null;
let sidecarProcess = null;
```

Add startup:

```js
async function startWorkspaceSidecar() {
  const sidecarPath = join(__dirname, "..", "workspace-sidecar");
  sidecarProcess = spawn(sidecarPath, ["-db", join(app.getPath("userData"), "workspace.db")], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  sidecarProcess.stderr.setEncoding("utf8");
  sidecarProcess.stderr.on("data", (chunk) => console.error(chunk.trim()));

  sidecarProcess.stdout.setEncoding("utf8");
  const [chunk] = await once(sidecarProcess.stdout, "data");
  const match = String(chunk).match(/listening on (127\.0\.0\.1:\d+)/);
  if (!match) {
    throw new Error(`Could not read sidecar address from: ${chunk}`);
  }

  workspaceClient = new WorkspaceServiceClient(createSidecarHttpTransport(`http://${match[1]}`));
}
```

Update `app.whenReady()`:

```js
app.whenReady().then(async () => {
  await startWorkspaceSidecar();
  registerWorkspaceHandlers();
  await createWindow();
});
```

Keep filesystem operations in Electron main for now. Use sidecar for persisted root when the sidecar is available:

```js
ipcMain.handle("workspace:getRoot", async () => {
  if (!workspaceClient) {
    return createRootResponse();
  }
  const root = await workspaceClient.getRoot();
  return { status: 200, payload: { root: root.rootPath ? { name: root.name } : null } };
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
node --test test/sidecarClient.test.js test/electronStructure.test.js
npm test
```

Expected: sidecar client tests pass, Electron structure tests pass, all Node tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add electron/main.js electron/sidecarClient.js test/sidecarClient.test.js
git commit -m "Wire Electron to workspace sidecar"
```

### Task 9: Licensing and README

**Files:**
- Create: `THIRD_PARTY_NOTICES.md`
- Modify: `README.md`
- Modify: `test/uiStructure.test.js`

- [ ] **Step 1: Write documentation test**

Create `test/documentation.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("third party notices document any-store MIT license", async () => {
  const notices = await readFile(new URL("../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8");

  assert.match(notices, /any-store/);
  assert.match(notices, /MIT License/);
  assert.match(notices, /Copyright \(c\) 2023 Any Association/);
  assert.match(notices, /https:\/\/github\.com\/anyproto\/any-store/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test --test-name-pattern "third party notices" test/documentation.test.js
```

Expected: FAIL because `THIRD_PARTY_NOTICES.md` does not exist.

- [ ] **Step 3: Add notices**

Create `THIRD_PARTY_NOTICES.md`:

```markdown
# Third Party Notices

## any-store

Repository: https://github.com/anyproto/any-store

License: MIT License

Copyright (c) 2023 Any Association

Workspace uses `any-store` as the embedded local document database for the Go storage sidecar. The dependency is distributed under the MIT License. The full license text is available in the upstream repository:

https://raw.githubusercontent.com/anyproto/any-store/main/LICENSE.md
```

- [ ] **Step 4: Update README**

Add a storage section to `README.md`:

```markdown
## Storage

Workspace stores local object and property data through `any-store`, a Go document database on top of one SQLite file.

The Electron app includes the UI and backend in one application. The renderer talks to Electron main through preload IPC. Electron main owns OS access and starts the local Workspace storage sidecar.

`any-store` is used under the MIT License. See `THIRD_PARTY_NOTICES.md`.
```

- [ ] **Step 5: Run tests**

Run:

```bash
node --test --test-name-pattern "third party notices" test/documentation.test.js
npm test
```

Expected: documentation test passes, then all Node tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add README.md THIRD_PARTY_NOTICES.md test/documentation.test.js
git commit -m "Document workspace storage licensing"
```

## Final Verification

- [ ] **Step 1: Run all JavaScript tests**

Run:

```bash
npm test
```

Expected: all Node tests pass.

- [ ] **Step 2: Run Go tests**

Run:

```bash
go test ./...
```

Expected: all Go tests pass.

- [ ] **Step 3: Build sidecar**

Run:

```bash
go build -o workspace-sidecar ./cmd/workspace-sidecar
```

Expected: `workspace-sidecar` binary is created.

- [ ] **Step 4: Launch browser development mode**

Run:

```bash
npm run dev
```

Expected: app serves at `http://127.0.0.1:4173/` and existing browser workflow still works.

- [ ] **Step 5: Launch Electron**

Run:

```bash
npm run electron
```

Expected: Electron opens the current Workspace UI, `Settings` can choose a folder, Table text still edits without focus loss, and card place can open files/folders.

## Self-Review

- Spec coverage: Electron single app, current UI preservation, any-store storage, property types, Name/Status system properties, folder scan behavior, gRPC deferred transport, and license notice are each covered by a task.
- Placeholder scan: no incomplete implementation markers are intentionally left in this plan.
- Type consistency: `WorkspaceServiceClient`, `workspaceRequest`, `createSidecarHttpTransport`, `RootDocument`, and `PropertyValueDocument` names are consistent across tasks.
