import assert from "node:assert/strict";
import test from "node:test";

import {
  createNextVisiblePropertyIds,
  createPropertyOrder,
} from "../src/workspaceViewVisibility.js";

test("createNextVisiblePropertyIds removes stale property ids when showing a property", () => {
  assert.deepEqual(
    createNextVisiblePropertyIds({
      currentVisiblePropertyIds: [
        "property:name",
        "property:status",
        "property:deleted",
      ],
      fallbackVisiblePropertyIds: ["property:name", "property:status"],
      availablePropertyIds: [
        "property:name",
        "property:status",
        "property:priority",
      ],
      propertyId: "property:priority",
      visible: true,
    }),
    ["property:name", "property:status", "property:priority"],
  );
});

test("createNextVisiblePropertyIds keeps required properties when hiding a property", () => {
  assert.deepEqual(
    createNextVisiblePropertyIds({
      currentVisiblePropertyIds: [
        "property:name",
        "property:status",
        "property:priority",
      ],
      fallbackVisiblePropertyIds: [],
      availablePropertyIds: [
        "property:name",
        "property:status",
        "property:priority",
      ],
      propertyId: "property:status",
      visible: false,
    }),
    ["property:name", "property:status", "property:priority"],
  );
});

test("createPropertyOrder stores stable ten-step ordering", () => {
  assert.deepEqual(
    createPropertyOrder(["property:name", "property:status", "property:priority"]),
    {
      "property:name": 10,
      "property:status": 20,
      "property:priority": 30,
    },
  );
});
