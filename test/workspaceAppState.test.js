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
  assert.equal(state.projection, loadedState.projection);
  assert.equal(state.projection.projection.type, "board");
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
  assert.equal(state.projection, loadedState.projection);
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

test('Table search preserves empty group catalog and counts unique displayed memberships', async () => {
  const {filterWorkspaceProjectionBySearch}=await importAppStateModule();
  const alpha={id:'a',name:'Alpha'},beta={id:'b',name:'Beta'};
  const group=(id,rows)=>({id,name:id,rows,count:rows.length,hidden:false,collapsed:false,empty:false});
  const groups=[group('one',[alpha,beta]),group('two',[alpha]),group('unused',[])];
  const response={workspaceId:'a',view:{id:'table',grouping:{propertyId:'tags',hideEmpty:false}},projection:{type:'table',rows:[alpha,beta],groups,groupOptions:groups}};
  const filtered=filterWorkspaceProjectionBySearch(response,'Alpha').projection;
  assert.equal(filtered.totalProjectCount,1);assert.deepEqual(filtered.groups.map(g=>g.count),[1,1,0]);
  const empty=filterWorkspaceProjectionBySearch(response,'missing').projection;assert.equal(empty.groups.length,3);assert.equal(empty.totalProjectCount,0);
  const hiddenEmpty=filterWorkspaceProjectionBySearch({...response,view:{...response.view,grouping:{propertyId:'tags',hideEmpty:true}}},'missing').projection;
  assert.equal(hiddenEmpty.groups.length,0);assert.equal(hiddenEmpty.groupOptions.length,3);
});

test('a delayed grouped projection cannot replace a different active view after property save', async () => {
  const {workspaceAppStateReducer,createInitialWorkspaceAppState}=await importAppStateModule();
  const state={...createInitialWorkspaceAppState(),status:'ready',workspaceId:'workspace:a',activeViewId:'view:b',projection:{workspaceId:'workspace:a',view:{id:'view:b',grouping:{propertyId:'date'}},projection:{type:'table',rows:[],groups:[]}}};
  const late={workspaceId:'workspace:a',view:{id:'view:a',grouping:{propertyId:'tags'}},projection:{type:'table',rows:[{id:'alpha'}],groups:[]}};
  assert.equal(workspaceAppStateReducer(state,{type:'projectionUpdated',projectionResponse:late}),state);
});

test('deleting the grouping property immediately clears section rendering and shows recovery notice', async () => {
  const {workspaceAppStateReducer,createInitialWorkspaceAppState}=await importAppStateModule();
  const view={id:'table',viewType:'table',grouping:{propertyId:'tags'}};
  const state={...createInitialWorkspaceAppState(),status:'ready',views:[view],projection:{workspaceId:'a',view,visibleProperties:[{id:'tags'}],projection:{type:'table',rows:[{id:'alpha',propertyValues:{tags:['one']}}],groups:[{id:'value:one',rows:[{id:'alpha'}]}],groupOptions:[]}}};
  const after=workspaceAppStateReducer(state,{type:'propertyDeleted',propertyId:'tags'});
  assert.equal(after.views[0].grouping,null);assert.equal(after.projection.projection.groups,undefined);assert.equal(after.projection.projection.groupingNotice,'property-removed');assert.equal(after.projection.projection.rows.length,1);
});

test('saved grouped Table waits for its authoritative projection instead of fabricating flat rows', async () => {
  const {createInitialWorkspaceAppState, workspaceAppStateReducer} = await importAppStateModule();
  const grouping = {propertyId:'property:status',sort:'manual',manualOrder:['value:active'],hiddenGroupIds:['value:old'],collapsedGroupIds:['value:active'],hideEmpty:true};
  const target = {id:'view:grouped',name:'Grouped',viewType:'table',grouping,rowOrder:['b','a']};
  const loaded = workspaceAppStateReducer(createInitialWorkspaceAppState(), {type:'projectionLoaded',root,viewsResponse:{...viewsResponse,views:[...viewsResponse.views,target]},projectionResponse:{...projectionResponse,projection:{...projectionResponse.projection,columns:[{statusValueId:'active',projects:[{id:'a'},{id:'b'}]}]}},folderRoleTree});
  const pending = workspaceAppStateReducer(loaded,{type:'activeViewChanged',activeViewId:target.id});
  assert.equal(pending.activeViewId,target.id);
  assert.equal(pending.projection,loaded.projection,'pending grouped view retains the complete previous service surface');
  assert.deepEqual(pending.views.at(-1),target,'all saved target settings survive the transition');
  const ready = {...projectionResponse,view:target,projection:{type:'table',rows:[],groups:[],groupOptions:[]}};
  const next = workspaceAppStateReducer(pending,{type:'projectionUpdated',projectionResponse:ready});
  assert.equal(next.projection,ready);
  const switched = workspaceAppStateReducer(next,{type:'activeViewChanged',activeViewId:'view:table'});
  assert.equal(workspaceAppStateReducer(switched,{type:'projectionUpdated',projectionResponse:ready}),switched);
});


test('saved-view transitions retain the previous identity and settings until authoritative activation', async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer: reduce, getWorkspaceSurfaceState } = await importAppStateModule();
  const target = { id: 'view:grouped', name: 'Grouped', viewType: 'table', grouping: {propertyId:'priority', sort:'manual', manualOrder:['blue','red'], hiddenGroupIds:['red'], collapsedGroupIds:['blue'], hideEmpty:true}, rowOrder:['b','a'], visiblePropertyIds:['property:name','priority'] };
  const prior = {...projectionResponse, projection:{type:'board',capabilities:{canMoveBetweenStatuses:false},columns:[{statusValueId:'active',name:'Active',projects:[{id:'a',name:'Alpha'}]}]}};
  const ready = reduce(createInitialWorkspaceAppState(), { type:'projectionLoaded',root,viewsResponse:{...viewsResponse,views:[...viewsResponse.views,target]},projectionResponse:prior,folderRoleTree });
  const pending = reduce(ready,{type:'activeViewChanged',activeViewId:target.id});
  assert.equal(pending.projection,prior,'previous authoritative projection survives');
  const surface = getWorkspaceSurfaceState(pending);
  assert.equal(surface.projection, prior);
  assert.equal(surface.viewId, 'view:board');
  assert.equal(surface.pendingViewId, 'view:grouped');
  assert.equal(surface.interactionDisabled, true);
  assert.deepEqual(pending.views.at(-1),target);
  const fresh = {...projectionResponse,view:target,projection:{type:'table',rows:[{id:'b',name:'Beta'}],groups:[{id:'blue',name:'Blue',count:1,rows:[{id:'b',name:'Beta'}],collapsed:true,hidden:false,empty:false}],groupOptions:[]}};
  const activated=reduce(pending,{type:'projectionUpdated',projectionResponse:fresh,viewRequestVersion:pending.viewRequestVersion});
  assert.equal(getWorkspaceSurfaceState(activated).projection,fresh);
  assert.equal(getWorkspaceSurfaceState(activated).viewId,target.id);
  assert.equal(getWorkspaceSurfaceState(activated).interactionDisabled,false);
});

test('A to B to A reuses the retained ready A and rejects responses from an earlier intent', async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer: reduce, getWorkspaceSurfaceState }=await importAppStateModule();
  const ready=reduce(createInitialWorkspaceAppState(),{type:'projectionLoaded',root,viewsResponse,projectionResponse,folderRoleTree});
  const b=reduce(ready,{type:'activeViewChanged',activeViewId:'view:table'});
  const a=reduce(b,{type:'activeViewChanged',activeViewId:'view:board'});
  assert.equal(a.projection,projectionResponse,'ready A survives reversal');
  assert.equal(getWorkspaceSurfaceState(a).projection,projectionResponse);
  assert.equal(getWorkspaceSurfaceState(a).interactionDisabled,false);
  assert.equal(reduce(a,{type:'projectionUpdated',projectionResponse,viewRequestVersion:ready.viewRequestVersion}),a);
  const bAgain=reduce(a,{type:'activeViewChanged',activeViewId:'view:table'});
  const bResponse={...projectionResponse,view:viewsResponse.views[1],projection:{type:'table',rows:[]}};
  assert.equal(reduce(bAgain,{type:'projectionUpdated',projectionResponse:bResponse,viewRequestVersion:b.viewRequestVersion}),bAgain);
});

test('first load keeps loading and a source change never treats the old view as current', async () => {
  const { createInitialWorkspaceAppState,workspaceAppStateReducer:reduce,getWorkspaceSurfaceState }=await importAppStateModule();
  const initial=reduce(createInitialWorkspaceAppState(),{type:'rootSelected',root});
  assert.equal(initial.status,'loading');
  assert.equal(typeof getWorkspaceSurfaceState,'function','surface selector must distinguish initial loading');
  assert.equal(getWorkspaceSurfaceState(initial).projection,null);
  const ready=reduce(initial,{type:'projectionLoaded',root,viewsResponse,projectionResponse,folderRoleTree});
  const switching=reduce(ready,{type:'workspaceActivated',workspaceId:'workspace:other'});
  assert.equal(getWorkspaceSurfaceState(switching).interactionDisabled,true);
  assert.equal(getWorkspaceSurfaceState(switching).projection,projectionResponse);
  assert.equal(reduce(switching,{type:'projectionUpdated',projectionResponse}),switching);
});


test('confirmed mutation invalidates a retained snapshot so reversal must load fresh groups', async () => {
  const {createInitialWorkspaceAppState,workspaceAppStateReducer:reduce,getWorkspaceSurfaceState}=await importAppStateModule();
  const ready=reduce(createInitialWorkspaceAppState(),{type:'projectionLoaded',root,viewsResponse,projectionResponse,folderRoleTree});
  const b=reduce(ready,{type:'activeViewChanged',activeViewId:'view:table'});
  const invalid=reduce(b,{type:'projectionInvalidated'});
  const a=reduce(invalid,{type:'activeViewChanged',activeViewId:'view:board'});
  assert.equal(a.projectionRefreshing,true);
  assert.equal(getWorkspaceSurfaceState(a).interactionDisabled,true);
  assert.equal(reduce(a,{type:'projectionUpdated',projectionResponse,viewRequestVersion:ready.viewRequestVersion}),a);
  const refreshed=reduce(a,{type:'projectionUpdated',projectionResponse,viewRequestVersion:a.viewRequestVersion});
  assert.equal(getWorkspaceSurfaceState(refreshed).interactionDisabled,false);
});


test('source replacement and same-ID full refresh reject the previous projection generation',async()=>{
  const {createInitialWorkspaceAppState,workspaceAppStateReducer:reduce}=await importAppStateModule();
  const ready=reduce(createInitialWorkspaceAppState(),{type:'projectionLoaded',root,viewsResponse,projectionResponse,folderRoleTree});
  const rebound=reduce(ready,{type:'rootSelected',root:{...root,path:'/replacement-source'}});
  assert.equal(reduce(rebound,{type:'projectionLoaded',root,viewsResponse,projectionResponse,folderRoleTree,viewRequestVersion:ready.viewRequestVersion}),rebound);
});


test('workspace intent keeps the outgoing identity and disables data until activation or cancellation', async () => {
  const { createInitialWorkspaceAppState, workspaceAppStateReducer: reduce, getWorkspaceSurfaceState } = await importAppStateModule();
  const ready = reduce(createInitialWorkspaceAppState(), { type: 'projectionLoaded', root, viewsResponse, projectionResponse, folderRoleTree });
  const searched = reduce(ready, { type: 'searchQueryChanged', searchQuery: 'Alpha' });
  const pending = reduce(searched, { type: 'workspaceSwitchStarted' });
  assert.equal(pending.workspaceId, searched.workspaceId);
  assert.equal(pending.root, searched.root);
  assert.equal(pending.views, searched.views);
  assert.equal(pending.activeViewId, searched.activeViewId);
  assert.equal(pending.searchQuery, 'Alpha');
  assert.equal(getWorkspaceSurfaceState(pending).projection, projectionResponse);
  assert.equal(getWorkspaceSurfaceState(pending).viewId, searched.activeViewId);
  assert.equal(getWorkspaceSurfaceState(pending).interactionDisabled, true);
  assert.equal(reduce(pending, { type: 'projectionUpdated', projectionResponse, viewRequestVersion: searched.viewRequestVersion }), pending);
  const cancelled = reduce(pending, { type: 'workspaceSwitchCancelled' });
  assert.equal(getWorkspaceSurfaceState(cancelled).interactionDisabled, false);
  assert.equal(cancelled.projection, projectionResponse);
  assert.equal(cancelled.searchQuery, 'Alpha');
  const loaded = reduce(pending, { type: 'projectionLoaded', root, viewsResponse, projectionResponse, folderRoleTree, replaceWorkspace: true });
  assert.equal(getWorkspaceSurfaceState(loaded).interactionDisabled, false);
});
