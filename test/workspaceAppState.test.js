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

test("workspace app state stores custom property catalog responses", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });
  const propertiesResponse = {
    workspaceId: "workspace:ops",
    properties: [
      { id: "property:name", name: "Name", propertyType: "text", type: "text", system: true },
      { id: "property:priority", name: "Priority", propertyType: "select", type: "select", system: false },
    ],
    selectValues: [
      { id: "selectValue:priority-high", propertyId: "property:priority", name: "High", color: "red" },
    ],
  };

  const state = workspaceAppStateReducer(loadedState, {
    type: "propertiesLoaded",
    propertiesResponse,
  });

  assert.deepEqual(state.propertyCatalog, propertiesResponse);
  assert.equal(state.status, "ready");
  assert.equal(state.projection, loadedState.projection);
});

test("workspace app state refreshes visible property labels from catalog without clearing projection", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse: {
      ...projectionResponse,
      visibleProperties: [
        { id: "property:name", name: "Name", propertyType: "text", system: true },
        { id: "property:priority", name: "Priority", propertyType: "select", system: false },
      ],
    },
    folderRoleTree,
  });
  const propertiesResponse = {
    workspaceId: "workspace:ops",
    properties: [
      { id: "property:name", name: "Name", propertyType: "text", type: "text", system: true },
      { id: "property:priority", name: "Urgency", propertyType: "select", type: "select", system: false },
    ],
    selectValues: [],
  };

  const state = workspaceAppStateReducer(loadedState, {
    type: "propertiesLoaded",
    propertiesResponse,
  });

  assert.equal(state.status, "ready");
  assert.equal(state.projection.projection, loadedState.projection.projection);
  assert.equal(
    state.projection.visibleProperties.find((property) => property.id === "property:priority")?.name,
    "Urgency",
  );
});

test("workspace app state updates visible view properties without clearing projection rows", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const alpha = {
    id: "project:alpha",
    name: "Alpha Project",
    propertyValues: {
      "property:name": "Alpha Project",
      "property:status": "status:active",
      "property:priority": "selectValue:high",
    },
  };
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse: {
      ...viewsResponse,
      views: [
        {
          id: "view:table",
          name: "Table",
          viewType: "table",
          visiblePropertyIds: ["property:name", "property:status"],
          propertyOrder: {
            "property:name": 10,
            "property:status": 20,
          },
        },
      ],
      activeViewId: "view:table",
    },
    projectionResponse: {
      ...projectionResponse,
      view: { id: "view:table", name: "Table", viewType: "table" },
      visibleProperties: [
        { id: "property:name", name: "Name", propertyType: "text", system: true },
        { id: "property:status", name: "Status", propertyType: "select", system: true },
      ],
      projection: {
        type: "table",
        rows: [alpha],
      },
    },
    folderRoleTree,
  });
  const catalogState = workspaceAppStateReducer(loadedState, {
    type: "propertiesLoaded",
    propertiesResponse: {
      workspaceId: "workspace:ops",
      properties: [
        { id: "property:name", name: "Name", propertyType: "text", type: "text", system: true },
        { id: "property:status", name: "Status", propertyType: "select", type: "select", system: true },
        { id: "property:priority", name: "Priority", propertyType: "select", type: "select", system: false },
      ],
      selectValues: [
        { id: "selectValue:high", propertyId: "property:priority", name: "High", color: "red" },
      ],
    },
  });

  const state = workspaceAppStateReducer(catalogState, {
    type: "viewPropertiesUpdated",
    viewId: "view:table",
    visiblePropertyIds: ["property:name", "property:status", "property:priority"],
    propertyOrder: {
      "property:name": 10,
      "property:status": 20,
      "property:priority": 30,
    },
  });

  assert.equal(state.status, "ready");
  assert.deepEqual(
    state.views[0].visiblePropertyIds,
    ["property:name", "property:status", "property:priority"],
  );
  assert.deepEqual(
    state.projection.visibleProperties.map((property) => [property.id, property.name]),
    [
      ["property:name", "Name"],
      ["property:status", "Status"],
      ["property:priority", "Priority"],
    ],
  );
  assert.equal(state.projection.projection.rows[0], alpha);
});

test("workspace app state updates view value visibility without clearing projection rows", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const alpha = {
    id: "project:alpha",
    name: "Alpha Project",
    propertyValues: {
      "property:name": "Alpha Project",
      "property:status": "status:active",
    },
  };
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse: {
      workspaceId: "workspace:ops",
      activeViewId: "view:table",
      views: [
        {
          id: "view:table",
          name: "Table",
          viewType: "table",
          valueVisibility: {},
        },
      ],
    },
    projectionResponse: {
      ...projectionResponse,
      view: {
        id: "view:table",
        name: "Table",
        viewType: "table",
        valueVisibility: {},
      },
      projection: {
        type: "table",
        rows: [alpha],
      },
    },
    folderRoleTree,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "viewValueVisibilityUpdated",
    viewId: "view:table",
    valueVisibility: {
      "property:status": { valueIds: ["status:active"] },
    },
  });

  assert.deepEqual(state.views[0].valueVisibility, {
    "property:status": { valueIds: ["status:active"] },
  });
  assert.deepEqual(state.projection.view.valueVisibility, {
    "property:status": { valueIds: ["status:active"] },
  });
  assert.equal(state.projection.projection.rows[0], alpha);
});

test("workspace app state updates view property layout without clearing projection rows", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const alpha = {
    id: "project:alpha",
    name: "Alpha Project",
    propertyValues: {
      "property:name": "Alpha Project",
      "property:notes": "first line\nsecond line",
    },
  };
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse: {
      workspaceId: "workspace:ops",
      activeViewId: "view:table",
      views: [
        {
          id: "view:table",
          name: "Table",
          viewType: "table",
          propertyLayout: {},
        },
      ],
    },
    projectionResponse: {
      ...projectionResponse,
      view: {
        id: "view:table",
        name: "Table",
        viewType: "table",
        propertyLayout: {},
      },
      projection: {
        type: "table",
        rows: [alpha],
      },
    },
    folderRoleTree,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "viewPropertyLayoutUpdated",
    viewId: "view:table",
    propertyLayout: {
      "property:notes": { wrapContent: true },
    },
  });

  assert.deepEqual(state.views[0].propertyLayout, {
    "property:notes": { wrapContent: true },
  });
  assert.deepEqual(state.projection.view.propertyLayout, {
    "property:notes": { wrapContent: true },
  });
  assert.equal(state.projection.projection.rows[0], alpha);
});

test("workspace app state previews Board column width without clearing projection columns", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse: {
      workspaceId: "workspace:ops",
      activeViewId: "view:board",
      views: [{
        id: "view:board",
        name: "Board",
        viewType: "board",
        boardLayout: { columnWidth: 384 },
      }],
    },
    projectionResponse: {
      ...projectionResponse,
      view: {
        id: "view:board",
        name: "Board",
        viewType: "board",
        boardLayout: { columnWidth: 384 },
      },
    },
    folderRoleTree,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "viewBoardLayoutUpdated",
    viewId: "view:board",
    boardLayout: { columnWidth: 456 },
  });

  assert.deepEqual(state.views[0].boardLayout, { columnWidth: 456 });
  assert.deepEqual(state.projection.view.boardLayout, { columnWidth: 456 });
  assert.equal(state.projection.projection, loadedState.projection.projection);
});

test("workspace app state removes a deleted property from catalog and projections", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const alpha = {
    id: "project:alpha",
    name: "Alpha Project",
    propertyValues: {
      "property:name": "Alpha Project",
      "property:status": "status:active",
      "property:priority": "High",
    },
  };
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse: {
      ...viewsResponse,
      views: [
        {
          id: "view:board",
          name: "Board",
          viewType: "board",
          visiblePropertyIds: ["property:name", "property:status", "property:priority"],
          propertyOrder: {
            "property:name": 10,
            "property:status": 20,
            "property:priority": 30,
          },
          valueVisibility: {
            "property:priority": { valueIds: ["selectValue:high"] },
          },
        },
      ],
    },
    projectionResponse: {
      ...projectionResponse,
      visibleProperties: [
        { id: "property:name", name: "Name", propertyType: "text", system: true },
        { id: "property:status", name: "Status", propertyType: "select", system: true },
        { id: "property:priority", name: "Priority", propertyType: "select", system: false },
      ],
      projection: {
        type: "board",
        capabilities: { canMoveBetweenStatuses: false },
        columns: [
          { statusValueId: "status:active", name: "Active", projects: [alpha] },
        ],
      },
    },
    folderRoleTree,
  });
  const catalogState = workspaceAppStateReducer(loadedState, {
    type: "propertiesLoaded",
    propertiesResponse: {
      workspaceId: "workspace:ops",
      properties: [
        { id: "property:name", name: "Name", propertyType: "text", type: "text", system: true },
        { id: "property:status", name: "Status", propertyType: "select", type: "select", system: true },
        { id: "property:priority", name: "Priority", propertyType: "select", type: "select", system: false },
      ],
      selectValues: [
        { id: "selectValue:high", propertyId: "property:priority", name: "High", color: "red" },
      ],
    },
  });

  const state = workspaceAppStateReducer(catalogState, {
    type: "propertyDeleted",
    propertyId: "property:priority",
  });

  assert.deepEqual(
    state.propertyCatalog.properties.map((property) => property.id),
    ["property:name", "property:status"],
  );
  assert.deepEqual(state.propertyCatalog.selectValues, []);
  assert.deepEqual(
    state.projection.visibleProperties.map((property) => property.id),
    ["property:name", "property:status"],
  );
  assert.equal(
    Object.hasOwn(state.projection.projection.columns[0].projects[0].propertyValues, "property:priority"),
    false,
  );
  assert.deepEqual(state.views[0].visiblePropertyIds, ["property:name", "property:status"]);
  assert.equal(Object.hasOwn(state.views[0].propertyOrder, "property:priority"), false);
  assert.deepEqual(state.views[0].valueVisibility, {});
});

test("workspace app state applies project property value updates without closing details", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const alpha = {
    id: "project:alpha",
    name: "Alpha Project",
    propertyValues: { "property:name": "Alpha Project" },
  };
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse: {
      ...projectionResponse,
      projection: {
        type: "board",
        capabilities: { canMoveBetweenStatuses: false },
        columns: [
          { statusValueId: "status:active", name: "Active", projects: [alpha] },
        ],
      },
    },
    folderRoleTree,
  });
  const selectedState = workspaceAppStateReducer(loadedState, {
    type: "projectSelected",
    selectedProjectId: "project:alpha",
  });

  const state = workspaceAppStateReducer(selectedState, {
    type: "projectPropertyValueUpdated",
    projectId: "project:alpha",
    propertyId: "property:budget",
    value: 12000,
  });
  const updatedProject = state.projection.projection.columns[0].projects[0];

  assert.equal(state.selectedProjectId, "project:alpha");
  assert.equal(state.detailOpen, true);
  assert.equal(updatedProject.propertyValues["property:budget"], 12000);
  assert.equal(state.propertySaveError, null);
});

test("workspace app state stores property save errors without clearing projection data", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "propertySaveFailed",
    error: "Could not save property value.",
  });

  assert.equal(state.status, "ready");
  assert.equal(state.projection, loadedState.projection);
  assert.equal(state.propertySaveError, "Could not save property value.");
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

test("workspace app state keeps current workspace content visible while another workspace loads", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });
  const nextRoot = { ...root, workspaceId: "workspace:design" };
  const nextProjectionResponse = {
    ...projectionResponse,
    workspaceId: "workspace:design",
    view: { id: "view:design-board", name: "Board", viewType: "board" },
  };
  const nextViewsResponse = {
    workspaceId: "workspace:design",
    activeViewId: "view:design-board",
    views: [{ id: "view:design-board", name: "Board", viewType: "board" }],
  };

  const reloadingState = workspaceAppStateReducer(loadedState, { type: "loadStarted" });
  const rootRefreshState = workspaceAppStateReducer(reloadingState, {
    type: "rootSelected",
    root: nextRoot,
  });

  assert.equal(reloadingState.status, "ready");
  assert.equal(reloadingState.projection, projectionResponse);
  assert.equal(rootRefreshState.status, "ready");
  assert.equal(rootRefreshState.workspaceId, "workspace:design");
  assert.equal(rootRefreshState.projection, projectionResponse);
  assert.deepEqual(rootRefreshState.views, viewsResponse.views);
  assert.equal(rootRefreshState.activeViewId, "view:board");
  assert.equal(rootRefreshState.workspaceSwitchPending, true);

  const switchedState = workspaceAppStateReducer(rootRefreshState, {
    type: "projectionLoaded",
    root: nextRoot,
    viewsResponse: nextViewsResponse,
    projectionResponse: nextProjectionResponse,
    folderRoleTree,
  });

  assert.equal(switchedState.status, "ready");
  assert.equal(switchedState.workspaceId, "workspace:design");
  assert.deepEqual(switchedState.projection, nextProjectionResponse);
  assert.deepEqual(switchedState.views, nextViewsResponse.views);
});

test("workspace app state keeps current view state as a stale visual surface when another workspace is activated", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "workspaceActivated",
    workspaceId: "workspace:design",
  });

  assert.equal(state.status, "ready");
  assert.equal(state.workspaceId, "workspace:design");
  assert.deepEqual(state.root, { ...root, workspaceId: "workspace:design" });
  assert.equal(state.projection, projectionResponse);
  assert.deepEqual(state.views, viewsResponse.views);
  assert.equal(state.activeViewId, "view:board");
  assert.equal(state.workspaceSwitchPending, true);
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

  const viewSwitchState = workspaceAppStateReducer(loadedState, {
    type: "activeViewChanged",
    activeViewId: "view:table",
  });
  const nextProjection = {
    ...projectionResponse,
    view: { id: "view:table", name: "Table", viewType: "table" },
    projection: { type: "table", rows: [] },
  };
  const state = workspaceAppStateReducer(viewSwitchState, {
    type: "projectionUpdated",
    projectionResponse: nextProjection,
  });

  assert.equal(state.status, "ready");
  assert.deepEqual(state.projection, nextProjection);
  assert.equal(state.activeViewId, "view:table");
});

test("workspace app state ignores projection updates for stale workspace or view", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });

  const staleViewProjection = {
    ...projectionResponse,
    view: { id: "view:table", name: "Table", viewType: "table" },
    projection: { type: "table", rows: [] },
  };
  const staleWorkspaceProjection = {
    ...projectionResponse,
    workspaceId: "workspace:archive",
  };

  const staleViewState = workspaceAppStateReducer(loadedState, {
    type: "projectionUpdated",
    projectionResponse: staleViewProjection,
  });
  const staleWorkspaceState = workspaceAppStateReducer(loadedState, {
    type: "projectionUpdated",
    projectionResponse: staleWorkspaceProjection,
  });

  assert.equal(staleViewState, loadedState);
  assert.equal(staleWorkspaceState, loadedState);
});

test("workspace app state ignores full projection loads after workspace or view changes", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });
  const switchedViewState = workspaceAppStateReducer(loadedState, {
    type: "activeViewChanged",
    activeViewId: "view:table",
  });
  const staleViewState = workspaceAppStateReducer(switchedViewState, {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });
  const switchedWorkspaceState = workspaceAppStateReducer(loadedState, {
    type: "workspaceActivated",
    workspaceId: "workspace:archive",
  });
  const staleWorkspaceState = workspaceAppStateReducer(switchedWorkspaceState, {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse,
    folderRoleTree,
  });

  assert.equal(staleViewState, switchedViewState);
  assert.equal(staleWorkspaceState, switchedWorkspaceState);
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
  const searchedState = workspaceAppStateReducer(loadedState, {
    type: "searchQueryChanged",
    searchQuery: "Проект 🧪",
  });

  const state = workspaceAppStateReducer(searchedState, {
    type: "activeViewChanged",
    activeViewId: "view:table",
  });

  assert.equal(state.activeViewId, "view:table");
  assert.equal(state.searchQuery, "Проект 🧪");
  assert.equal(state.projection.workspaceId, "workspace:ops");
  assert.equal(state.projection.view.id, "view:table");
  assert.equal(state.projection.projection.type, "table");
});

test("workspace app state ignores older property save completions for the same cell", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const alpha = {
    id: "project:alpha",
    name: "Alpha Project",
    propertyValues: { "property:budget": 1000 },
  };
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse,
    projectionResponse: {
      ...projectionResponse,
      projection: {
        type: "table",
        rows: [alpha],
      },
    },
    folderRoleTree,
  });
  const firstPendingState = workspaceAppStateReducer(loadedState, {
    type: "projectPropertyValueSaveStarted",
    projectId: "project:alpha",
    propertyId: "property:budget",
    requestVersion: 1,
  });
  const secondPendingState = workspaceAppStateReducer(firstPendingState, {
    type: "projectPropertyValueSaveStarted",
    projectId: "project:alpha",
    propertyId: "property:budget",
    requestVersion: 2,
  });
  const secondCompletedState = workspaceAppStateReducer(secondPendingState, {
    type: "projectPropertyValueUpdated",
    projectId: "project:alpha",
    propertyId: "property:budget",
    value: 3000,
    requestVersion: 2,
  });
  const firstCompletedState = workspaceAppStateReducer(secondCompletedState, {
    type: "projectPropertyValueUpdated",
    projectId: "project:alpha",
    propertyId: "property:budget",
    value: 2000,
    requestVersion: 1,
  });

  assert.equal(firstCompletedState.projection.projection.rows[0].propertyValues["property:budget"], 3000);
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
  assert.equal(state.projection.view.id, "view:board-2");
  assert.equal(state.projection.projection.type, "board");
  assert.equal(state.projectionRefreshing, true);
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

test("workspace app state reorders loaded views locally", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const loadedState = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded",
    root,
    viewsResponse: {
      ...viewsResponse,
      views: [
        ...viewsResponse.views,
        { id: "view:board-2", name: "Board 2", viewType: "board" },
      ],
    },
    projectionResponse,
    folderRoleTree,
  });

  const state = workspaceAppStateReducer(loadedState, {
    type: "viewsReordered",
    orderedViewIds: ["view:table", "view:board-2", "view:board"],
  });

  assert.deepEqual(
    state.views.map((view) => view.id),
    ["view:table", "view:board-2", "view:board"],
  );
  assert.equal(state.activeViewId, "view:board");
  assert.equal(state.projection, loadedState.projection);
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

test('accepted workspace snapshot replaces a different root and view atomically', async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer: reduce } = await importAppStateModule();
  const initial = reduce(createInitialWorkspaceAppState(), { type: 'projectionLoaded', root, viewsResponse, projectionResponse, folderRoleTree });
  const targetRoot = { ...root, workspaceId: 'workspace:research', path: '/other/source' };
  const targetView = { id: 'view:research', name: 'Research', viewType: 'board' };
  const next = reduce(initial, { type: 'projectionLoaded', replaceWorkspace: true, root: targetRoot, viewsResponse: { workspaceId: targetRoot.workspaceId, activeViewId: targetView.id, views: [targetView] }, projectionResponse: { ...projectionResponse, workspaceId: targetRoot.workspaceId, view: targetView }, folderRoleTree: [] });
  assert.equal(next.root.path, '/other/source');
  assert.equal(next.workspaceId, 'workspace:research');
  assert.equal(next.activeViewId, 'view:research');
  assert.equal(next.projection.workspaceId, next.workspaceId);
  assert.equal(next.workspaceSwitchPending, false);
});

test("rootless recovery retains target identity and clears the outgoing workspace snapshot", async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer } = await importAppStateModule();
  const outgoing = workspaceAppStateReducer(createInitialWorkspaceAppState(), {
    type: "projectionLoaded", root, viewsResponse, projectionResponse, folderRoleTree,
  });
  const target = { workspaceId: "workspace:rootless", name: "New workspace", path: "" };
  const recovered = workspaceAppStateReducer(outgoing, { type: "sourceFolderMissing", root: target });
  assert.equal(recovered.workspaceId, target.workspaceId);
  assert.deepEqual(recovered.root, target);
  assert.equal(recovered.status, "ready");
  assert.equal(recovered.sourceFolderMissing, true);
  assert.equal(recovered.projection, null);
  assert.equal(recovered.propertyCatalog, null);
  assert.deepEqual(recovered.folderRoleTree, []);
});
