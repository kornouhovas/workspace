import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultView,
  normalizeViewDocument,
  validateViewPatch,
  WorkspaceViewError,
} from "../src/workspaceViews.js";

test("createDefaultView creates Board and Table views with required system properties", () => {
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

test("normalizeViewDocument preserves known fields and required system properties", () => {
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

  assert.deepEqual(view.visiblePropertyIds, ["property:name", "property:status", "property:priority"]);
  assert.equal(view.order, 40);
  assert.deepEqual(view.valueVisibility["property:priority"], {
    mode: "include",
    valueIds: ["selectValue:high", "selectValue:medium"],
    includeEmpty: false,
  });
});

test("validateViewPatch rejects removal of required system properties", () => {
  assert.throws(
    () => validateViewPatch({
      patch: {
        visiblePropertyIds: ["property:name", "property:priority"],
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
