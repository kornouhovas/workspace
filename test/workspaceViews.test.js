import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultView,
  createViewProjection,
  filterProjectsForView,
  normalizeViewDocument,
  validateViewPatch,
  WorkspaceViewError,
} from "../src/workspaceViews.js";

test("createDefaultView creates Board and Table views with default system properties", () => {
  const board = createDefaultView({
    workspaceId: "workspace:root",
    viewType: "board",
    name: "Board",
    id: "view:board",
    order: 10,
    now: "2026-05-14T00:00:00.000Z",
  });
  const table = createDefaultView({
    workspaceId: "workspace:root",
    viewType: "table",
    name: "",
    id: "view:table",
    order: 20,
    now: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(board.viewType, "board");
  assert.equal(board.name, "Board");
  assert.deepEqual(board.visiblePropertyIds, ["property:name", "property:status"]);
  assert.deepEqual(board.propertyOrder, {
    "property:name": 10,
    "property:status": 20,
  });
  assert.equal(table.viewType, "table");
  assert.equal(table.name, "Table");
  assert.deepEqual(table.visiblePropertyIds, ["property:name", "property:status"]);
});

test("createDefaultView rejects invalid view types", () => {
  assert.throws(
    () => createDefaultView({
      workspaceId: "workspace:root",
      viewType: "calendar",
      id: "view:bad",
      now: "2026-05-14T00:00:00.000Z",
    }),
    (error) => error instanceof WorkspaceViewError && error.code === "INVALID_VIEW_TYPE",
  );
});

test("normalizeViewDocument preserves known fields and visible property order after Name", () => {
  const view = normalizeViewDocument({
    id: "view:board",
    workspaceId: "workspace:root",
    name: "Priority Board",
    viewType: "board",
    order: "40",
    visiblePropertyIds: ["property:priority", "property:name", "property:status", "property:priority"],
    valueVisibility: {
      "property:priority": {
        mode: "include",
        valueIds: ["selectValue:high", "selectValue:medium", "selectValue:high"],
        includeEmpty: false,
      },
    },
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:00.000Z",
  });

  assert.deepEqual(view.visiblePropertyIds, ["property:name", "property:priority", "property:status"]);
  assert.equal(view.order, 40);
  assert.deepEqual(view.valueVisibility["property:priority"], {
    mode: "include",
    valueIds: ["selectValue:high", "selectValue:medium"],
    includeEmpty: false,
  });
});

test("normalizeViewDocument stores text wrap layout as a view setting", () => {
  const view = normalizeViewDocument({
    id: "view:table",
    workspaceId: "workspace:root",
    viewType: "table",
    visiblePropertyIds: ["property:name", "property:status", "property:notes"],
    propertyLayout: {
      "property:notes": {
        wrapContent: true,
      },
      "property:priority": {
        wrapContent: false,
      },
    },
  });

  assert.deepEqual(view.propertyLayout, {
    "property:notes": {
      wrapContent: true,
    },
  });
});

test("validateViewPatch accepts text wrap layout for active text properties", () => {
  assert.doesNotThrow(() => validateViewPatch({
    patch: {
      propertyLayout: {
        "property:notes": {
          wrapContent: true,
        },
      },
    },
    propertyDefinitions: [
      { id: "property:name", type: "text", system: true },
      { id: "property:status", type: "select", system: true },
      { id: "property:notes", type: "text", system: false },
    ],
    selectValues: [],
    statusValues: [{ id: "statusValue:no-status" }],
  }));
});

test("validateViewPatch rejects text wrap layout for non-text properties", () => {
  assert.throws(
    () => validateViewPatch({
      patch: {
        propertyLayout: {
          "property:priority": {
            wrapContent: true,
          },
        },
      },
      propertyDefinitions: [
        { id: "property:name", type: "text", system: true },
        { id: "property:status", type: "select", system: true },
        { id: "property:priority", type: "select", system: false },
      ],
      selectValues: [],
      statusValues: [{ id: "statusValue:no-status" }],
    }),
    (error) => error instanceof WorkspaceViewError && error.code === "INVALID_PROPERTY_REFERENCE",
  );
});

test("validateViewPatch rejects removing the required Name property", () => {
  assert.throws(
    () => validateViewPatch({
      patch: {
        visiblePropertyIds: ["property:status", "property:priority"],
      },
      propertyDefinitions: [
        { id: "property:name", type: "text", system: true },
        { id: "property:status", type: "select", system: true },
        { id: "property:priority", type: "select", system: false },
      ],
      selectValues: [],
      statusValues: [{ id: "statusValue:no-status" }],
    }),
    (error) => error instanceof WorkspaceViewError && error.code === "INVALID_PROPERTY_REFERENCE",
  );
});

test("validateViewPatch allows hiding the system Status property", () => {
  assert.doesNotThrow(() => validateViewPatch({
    patch: {
      visiblePropertyIds: ["property:name", "property:priority"],
      propertyOrder: {
        "property:name": 10,
        "property:priority": 20,
      },
    },
    propertyDefinitions: [
      { id: "property:name", type: "text", system: true },
      { id: "property:status", type: "select", system: true },
      { id: "property:priority", type: "select", system: false },
    ],
    selectValues: [],
    statusValues: [{ id: "statusValue:no-status" }],
  }));
});

test("validateViewPatch rejects propertyOrder keys outside visible properties", () => {
  assert.throws(
    () => validateViewPatch({
      patch: {
        visiblePropertyIds: ["property:name", "property:status"],
        propertyOrder: {
          "property:name": 10,
          "property:status": 20,
          "property:priority": 30,
        },
      },
      propertyDefinitions: [
        { id: "property:name", type: "text", system: true },
        { id: "property:status", type: "select", system: true },
        { id: "property:priority", type: "select", system: false },
      ],
      selectValues: [],
      statusValues: [{ id: "statusValue:no-status" }],
    }),
    (error) => error instanceof WorkspaceViewError && error.code === "INVALID_PROPERTY_REFERENCE",
  );
});

test("validateViewPatch allows propertyOrder-only patches for active custom properties", () => {
  assert.doesNotThrow(() => validateViewPatch({
    patch: {
      propertyOrder: {
        "property:name": 10,
        "property:status": 20,
        "property:priority": 30,
      },
    },
    propertyDefinitions: [
      { id: "property:name", type: "text", system: true },
      { id: "property:status", type: "select", system: true },
      { id: "property:priority", type: "select", system: false },
    ],
    selectValues: [],
    statusValues: [{ id: "statusValue:no-status" }],
  }));
});

test("validateViewPatch rejects propertyOrder keys outside active properties", () => {
  assert.throws(
    () => validateViewPatch({
      patch: {
        propertyOrder: {
          "property:missing": 30,
        },
      },
      propertyDefinitions: [
        { id: "property:name", type: "text", system: true },
        { id: "property:status", type: "select", system: true },
      ],
      selectValues: [],
      statusValues: [{ id: "statusValue:no-status" }],
    }),
    (error) => error instanceof WorkspaceViewError && error.code === "INVALID_PROPERTY_REFERENCE",
  );
});

test("validateViewPatch rejects valueVisibility for non-filterable properties even when empty", () => {
  assert.throws(
    () => validateViewPatch({
      patch: {
        visiblePropertyIds: ["property:name", "property:status", "property:notes"],
        valueVisibility: {
          "property:notes": {
            mode: "include",
            valueIds: [],
            includeEmpty: false,
          },
        },
      },
      propertyDefinitions: [
        { id: "property:name", type: "text", system: true },
        { id: "property:status", type: "select", system: true },
        { id: "property:notes", type: "text", system: false },
      ],
      selectValues: [],
      statusValues: [{ id: "statusValue:no-status" }],
    }),
    (error) => error instanceof WorkspaceViewError && error.code === "INVALID_PROPERTY_REFERENCE",
  );
});

test("filterProjectsForView applies search by Name only and select value filters", () => {
  const view = normalizeViewDocument({
    id: "view:board",
    workspaceId: "workspace:root",
    viewType: "board",
    visiblePropertyIds: ["property:name", "property:status", "property:priority"],
    valueVisibility: {
      "property:priority": {
        mode: "include",
        valueIds: ["selectValue:high"],
        includeEmpty: false,
      },
    },
  });
  const projects = [
    {
      id: "project:alpha",
      name: "Alpha Launch",
      status: { id: "statusValue:active", name: "Active" },
      propertyValues: {
        "property:name": "Alpha Launch",
        "property:status": "statusValue:active",
        "property:priority": "selectValue:high",
        "property:notes": "do not search me",
      },
    },
    {
      id: "project:beta",
      name: "Beta",
      status: { id: "statusValue:active", name: "Active" },
      propertyValues: {
        "property:name": "Beta",
        "property:status": "statusValue:active",
        "property:priority": "selectValue:low",
        "property:notes": "Alpha hidden text",
      },
    },
  ];

  assert.deepEqual(
    filterProjectsForView({ projects, view, searchQuery: "alpha" }).map((project) => project.id),
    ["project:alpha"],
  );
});

test("filterProjectsForView supports system Status filters and No status", () => {
  const view = normalizeViewDocument({
    id: "view:board",
    workspaceId: "workspace:root",
    viewType: "board",
    valueVisibility: {
      "property:status": {
        mode: "include",
        valueIds: ["statusValue:no-status"],
      },
    },
  });

  const projects = [
    {
      id: "project:active",
      name: "Active Project",
      status: { id: "statusValue:active", name: "Active" },
      propertyValues: { "property:status": "statusValue:active" },
    },
    {
      id: "project:none",
      name: "No Status Project",
      status: { id: "statusValue:no-status", name: "No status" },
      propertyValues: { "property:status": "statusValue:no-status" },
    },
  ];

  assert.deepEqual(
    filterProjectsForView({ projects, view }).map((project) => project.id),
    ["project:none"],
  );
});

test("filterProjectsForView treats empty Status filters as no-op even with includeEmpty", () => {
  const view = normalizeViewDocument({
    id: "view:board",
    workspaceId: "workspace:root",
    viewType: "board",
    valueVisibility: {
      "property:status": {
        mode: "include",
        valueIds: [],
        includeEmpty: true,
      },
    },
  });
  const projects = [
    {
      id: "project:active",
      name: "Active Project",
      status: { id: "statusValue:active", name: "Active" },
      propertyValues: {},
    },
    {
      id: "project:none",
      name: "No Status Project",
      status: { id: "statusValue:no-status", name: "No status" },
      propertyValues: {},
    },
  ];

  assert.deepEqual(
    filterProjectsForView({ projects, view }).map((project) => project.id),
    ["project:active", "project:none"],
  );
});

test("createViewProjection returns board columns and table rows from the same filtered project set", () => {
  const visibleProperties = [
    { id: "property:name", name: "Name", type: "text", system: true },
    { id: "property:status", name: "Status", type: "select", system: true },
  ];
  const statusValues = [
    { id: "statusValue:active", name: "Active", relativePath: "Active", source: "folderRole" },
    { id: "statusValue:no-status", name: "No status", relativePath: null, source: "no-status" },
  ];
  const projects = [
    { id: "project:alpha", name: "Alpha", status: statusValues[0], propertyValues: {} },
    { id: "project:none", name: "Loose", status: statusValues[1], propertyValues: {} },
  ];

  const boardView = normalizeViewDocument({ id: "view:board", workspaceId: "workspace:root", viewType: "board" });
  const tableView = normalizeViewDocument({ id: "view:table", workspaceId: "workspace:root", viewType: "table" });

  assert.deepEqual(
    createViewProjection({ view: boardView, projects, visibleProperties, statusValues }).projection.columns.map((column) => [
      column.statusValueId,
      column.projects.map((project) => project.id),
    ]),
    [
      ["statusValue:active", ["project:alpha"]],
      ["statusValue:no-status", ["project:none"]],
    ],
  );
  assert.deepEqual(
    createViewProjection({ view: tableView, projects, visibleProperties, statusValues }).projection.rows.map((row) => row.id),
    ["project:alpha", "project:none"],
  );
});

test("createViewProjection omits empty board columns while value filters are active", () => {
  const statusValues = [
    { id: "statusValue:active", name: "Active", relativePath: "Active", source: "folderRole" },
    { id: "statusValue:done", name: "Done", relativePath: "Done", source: "folderRole" },
  ];
  const projects = [
    {
      id: "project:active",
      name: "Active Project",
      status: statusValues[0],
      propertyValues: { "property:status": "statusValue:active" },
    },
    {
      id: "project:done",
      name: "Done Project",
      status: statusValues[1],
      propertyValues: { "property:status": "statusValue:done" },
    },
  ];
  const boardView = normalizeViewDocument({
    id: "view:board",
    workspaceId: "workspace:root",
    viewType: "board",
    valueVisibility: {
      "property:status": {
        mode: "include",
        valueIds: ["statusValue:done"],
      },
    },
  });

  const response = createViewProjection({ view: boardView, projects, visibleProperties: [], statusValues });

  assert.deepEqual(
    response.projection.columns.map((column) => [
      column.statusValueId,
      column.projects.map((project) => project.id),
    ]),
    [["statusValue:done", ["project:done"]]],
  );
});

test("createViewProjection adds No status column when matching projects have no status", () => {
  const statusValues = [
    { id: "statusValue:active", name: "Active", relativePath: "Active", source: "folderRole" },
  ];
  const projects = [
    { id: "project:none", name: "Loose", status: { id: "statusValue:no-status", name: "No status" }, propertyValues: {} },
  ];
  const boardView = normalizeViewDocument({ id: "view:board", workspaceId: "workspace:root", viewType: "board" });
  const response = createViewProjection({ view: boardView, projects, visibleProperties: [], statusValues });

  assert.deepEqual(response.statusValues.map((statusValue) => statusValue.id), [
    "statusValue:active",
    "statusValue:no-status",
  ]);

  assert.deepEqual(
    response.projection.columns.map((column) => [
      column.statusValueId,
      column.name,
      column.projects.map((project) => project.id),
    ]),
    [
      ["statusValue:active", "Active", []],
      ["statusValue:no-status", "No status", ["project:none"]],
    ],
  );
});
