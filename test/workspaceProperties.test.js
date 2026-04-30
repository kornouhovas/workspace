import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultPropertySchemas,
  normalizePropertySchema,
  normalizePropertyValue,
  propertyTypeIds,
} from "../src/workspaceProperties.js";

test("propertyTypeIds lists supported property types in storage order", () => {
  assert.deepEqual(propertyTypeIds, ["text", "number", "date", "select", "multi-select"]);
});

test("createDefaultPropertySchemas returns normalized default property schemas for a workspace", () => {
  assert.deepEqual(createDefaultPropertySchemas("workspace-1"), [
    {
      id: "property:name",
      workspaceId: "workspace-1",
      name: "Name",
      type: "text",
      system: true,
      hidden: false,
      order: 10,
      config: {},
    },
    {
      id: "property:status",
      workspaceId: "workspace-1",
      name: "Status",
      type: "select",
      system: true,
      hidden: false,
      order: 20,
      config: { options: [] },
    },
    {
      id: "property:text",
      workspaceId: "workspace-1",
      name: "Text",
      type: "text",
      system: false,
      hidden: false,
      order: 30,
      config: {},
    },
  ]);
});

test("normalizePropertyValue normalizes text values", () => {
  assert.equal(normalizePropertyValue("text", null), "");
  assert.equal(normalizePropertyValue("text", undefined), "");
  assert.equal(normalizePropertyValue("text", 42), "42");
  assert.equal(normalizePropertyValue("unknown", "Fallback"), "Fallback");
});

test("normalizePropertyValue normalizes number values", () => {
  assert.equal(normalizePropertyValue("number", ""), null);
  assert.equal(normalizePropertyValue("number", "   "), null);
  assert.equal(normalizePropertyValue("number", "12.5"), 12.5);
  assert.equal(normalizePropertyValue("number", 7), 7);
  assert.equal(normalizePropertyValue("number", Number.POSITIVE_INFINITY), null);
  assert.equal(normalizePropertyValue("number", "not a number"), null);
});

test("normalizePropertyValue normalizes date values", () => {
  assert.equal(normalizePropertyValue("date", "2026-04-30"), "2026-04-30");
  assert.equal(normalizePropertyValue("date", "2026-4-30"), null);
  assert.equal(normalizePropertyValue("date", "2026-02-30"), null);
  assert.equal(normalizePropertyValue("date", ""), null);
});

test("normalizePropertyValue normalizes select values", () => {
  assert.equal(normalizePropertyValue("select", "status:done"), "status:done");
  assert.equal(normalizePropertyValue("select", "  status:todo  "), "status:todo");
  assert.equal(normalizePropertyValue("select", ""), null);
  assert.equal(normalizePropertyValue("select", "   "), null);
  assert.equal(normalizePropertyValue("select", 123), null);
});

test("normalizePropertyValue normalizes multi-select values", () => {
  assert.deepEqual(normalizePropertyValue("multi-select", ["a", "", "b", "a", "  b  ", "c"]), ["a", "b", "c"]);
  assert.deepEqual(normalizePropertyValue("multi-select", "a"), ["a"]);
  assert.deepEqual(normalizePropertyValue("multi-select", null), []);
});

test("normalizePropertySchema preserves select config and normalizes options", () => {
  assert.deepEqual(
    normalizePropertySchema({
      id: "property:priority",
      workspaceId: "workspace-1",
      name: "Priority",
      type: "select",
      system: true,
      hidden: true,
      order: 40,
      config: {
        multiple: false,
        options: [
          { id: "high", name: "High", color: "red", order: 20, ignored: true },
          { id: "low", name: "Low" },
        ],
      },
    }),
    {
      id: "property:priority",
      workspaceId: "workspace-1",
      name: "Priority",
      type: "select",
      system: true,
      hidden: true,
      order: 40,
      config: {
        multiple: false,
        options: [
          { id: "high", name: "High", color: "red", order: 20 },
          { id: "low", name: "Low", color: "", order: 20 },
        ],
      },
    },
  );
});

test("normalizePropertySchema falls back unknown types to text", () => {
  assert.deepEqual(normalizePropertySchema({ id: "property:bad", type: "rating", config: { scale: 5 } }), {
    id: "property:bad",
    workspaceId: "",
    name: "",
    type: "text",
    system: false,
    hidden: false,
    order: 0,
    config: { scale: 5 },
  });
});
