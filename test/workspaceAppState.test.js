import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as ts from "typescript";

async function importAppStateModule() {
  const source = await readFile(new URL("../src/workspaceAppState.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const root = {
  workspaceId: "workspace:ops",
  name: "Client Work",
  path: "/Users/example/Client Work",
};

const viewsResponse = {
  workspaceId: "workspace:ops",
  activeViewId: "view:board",
  views: [
    { id: "view:board", name: "Board", viewType: "board" },
    { id: "view:table", name: "Table", viewType: "table" },
  ],
};

const projectionResponse = {
  workspaceId: "workspace:ops",
  view: { id: "view:board", name: "Board", viewType: "board" },
  visibleProperties: [
    { id: "property:name", name: "Name", propertyType: "text", system: true },
  ],
  statusValues: [],
  projection: {
    type: "board",
    capabilities: { canMoveBetweenStatuses: false },
    columns: [],
  },
};

test("workspace app state represents a missing source folder", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const state = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "sourceFolderMissing",
  });

  assert.equal(state.status, "ready");
  assert.equal(state.root, null);
  assert.equal(state.sourceFolderMissing, true);
  assert.equal(state.error, null);
});

test("workspace app state stores loaded service projection responses", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const state = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
  });

  assert.equal(state.status, "ready");
  assert.deepEqual(state.root, root);
  assert.equal(state.workspaceId, "workspace:ops");
  assert.equal(state.activeViewId, "view:board");
  assert.deepEqual(state.views, viewsResponse.views);
  assert.deepEqual(state.projection, projectionResponse);
});

test("workspace app state stores service errors", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const state = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "serviceError",
    error: "Workspace IPC bridge is unavailable.",
  });

  assert.equal(state.status, "error");
  assert.equal(state.error, "Workspace IPC bridge is unavailable.");
  assert.equal(state.sourceFolderMissing, false);
});

test("workspace app state updates search query without changing service responses", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "searchQueryChanged",
    searchQuery: "alpha",
  });

  assert.equal(state.searchQuery, "alpha");
  assert.equal(state.projection, loadedState.projection);
  assert.equal(state.activeViewId, "view:board");
});

test("workspace app state switches the active view", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "activeViewChanged",
    activeViewId: "view:table",
  });

  assert.equal(state.activeViewId, "view:table");
  assert.equal(state.searchQuery, "");
});
