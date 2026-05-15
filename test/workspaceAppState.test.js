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

const folderRoleTree = [
  {
    id: "folder:active",
    name: "Active",
    relativePath: "Active",
    role: "status",
    status: "Ready",
    children: [
      {
        id: "folder:alpha",
        name: "Project Alpha",
        relativePath: "Active/Project Alpha",
        role: "project",
        status: "Discovered",
        children: [],
      },
    ],
  },
];

test("workspace app state represents a missing source folder", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const state = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "sourceFolderMissing",
  });

  assert.equal(state.status, "ready");
  assert.equal(state.root, null);
  assert.equal(state.sourceFolderMissing, true);
  assert.equal(state.error, null);
  assert.deepEqual(state.folderRoleTree, []);
});

test("workspace app state stores loaded service projection responses", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const state = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });

  assert.equal(state.status, "ready");
  assert.deepEqual(state.root, root);
  assert.equal(state.workspaceId, "workspace:ops");
  assert.equal(state.activeViewId, "view:board");
  assert.deepEqual(state.views, viewsResponse.views);
  assert.deepEqual(state.projection, projectionResponse);
  assert.deepEqual(state.folderRoleTree, folderRoleTree);
});

test("workspace app state stores selected root before projection loading completes", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const state = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "rootSelected",
    root,
  });

  assert.equal(state.status, "loading");
  assert.deepEqual(state.root, root);
  assert.equal(state.workspaceId, "workspace:ops");
  assert.equal(state.sourceFolderMissing, false);
  assert.equal(state.error, null);
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
    folderRoleTree,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "searchQueryChanged",
    searchQuery: "alpha",
  });

  assert.equal(state.searchQuery, "alpha");
  assert.equal(state.projection, loadedState.projection);
  assert.equal(state.activeViewId, "view:board");
});

test("workspace app state updates projection without returning to loading", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });

  const nextProjection = {
    ...projectionResponse,
    view: { id: "view:table", name: "Table", viewType: "table" },
    projection: { type: "table", rows: [] },
  };
  const state = workspaceAppStateReducer(loadedState, {
    type: "projectionUpdated",
    projectionResponse: nextProjection,
  });

  assert.equal(state.status, "ready");
  assert.deepEqual(state.projection, nextProjection);
  assert.equal(state.activeViewId, "view:board");
});

test("workspace app state switches the active view", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "activeViewChanged",
    activeViewId: "view:table",
  });

  assert.equal(state.activeViewId, "view:table");
  assert.equal(state.searchQuery, "");
});

test("workspace app state adds a created view to only the active workspace state", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "viewCreated",
    workspaceId: "workspace:ops",
    activeViewId: "view:board-2",
    view: { id: "view:board-2", name: "Board 2", viewType: "board" },
  });

  assert.deepEqual(
    state.views.map((view) => view.id),
    ["view:board", "view:table", "view:board-2"],
  );
  assert.equal(state.activeViewId, "view:board-2");
  assert.equal(state.projection, loadedState.projection);
});

test("workspace app state ignores a created view for another workspace", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "viewCreated",
    workspaceId: "workspace:other",
    activeViewId: "view:other-board",
    view: { id: "view:other-board", name: "Board", viewType: "board" },
  });

  assert.equal(state, loadedState);
});

test("workspace app state renames a loaded view locally", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "viewRenamed",
    viewId: "view:board",
    name: "Operations Board",
  });

  assert.equal(state.views.find((view) => view.id === "view:board")?.name, "Operations Board");
  assert.equal(state.projection?.view.name, "Operations Board");
});

test("workspace projection search filter narrows board and table locally by project name", async () => {
  const { filterWorkspaceProjectionBySearch } = await importAppStateModule();
  const alpha = {
    id: "project:alpha",
    name: "Alpha Project",
    propertyValues: { "property:name": "Alpha Project" },
  };
  const beta = {
    id: "project:beta",
    name: "Beta Project",
    propertyValues: { "property:name": "Beta Project" },
  };
  const boardProjection = {
    ...projectionResponse,
    projection: {
      type: "board",
      capabilities: { canMoveBetweenStatuses: false },
      columns: [
        { statusValueId: "status:active", name: "Active", projects: [alpha, beta] },
        { statusValueId: "status:done", name: "Done", projects: [beta] },
      ],
    },
  };
  const tableProjection = {
    ...projectionResponse,
    projection: {
      type: "table",
      rows: [alpha, beta],
    },
  };

  const filteredBoard = filterWorkspaceProjectionBySearch(boardProjection, "alpha");
  const filteredTable = filterWorkspaceProjectionBySearch(tableProjection, "alpha");

  assert.deepEqual(filteredBoard.projection.columns.map((column) => column.projects.map((project) => project.id)), [
    ["project:alpha"],
    [],
  ]);
  assert.deepEqual(filteredTable.projection.rows.map((project) => project.id), ["project:alpha"]);
  assert.deepEqual(boardProjection.projection.columns[0].projects.map((project) => project.id), [
    "project:alpha",
    "project:beta",
  ]);
});
