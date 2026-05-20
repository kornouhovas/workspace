import test from "node:test";
import assert from "node:assert/strict";
import {
  customPropertyTypeIds,
  createDefaultPropertySchemas,
  isSystemPropertyId,
  normalizeProjectPropertyValue,
  normalizePropertyDefinition,
  normalizePropertySchema,
  normalizeSelectValue,
  normalizePropertyValue,
  propertyTypeIds,
  systemPropertyIds,
} from "../src/workspaceProperties.js";

test("propertyTypeIds lists supported property types in storage order", () => {
  assert.deepEqual(propertyTypeIds, ["text", "number", "date", "select", "multi-select"]);
  assert.deepEqual(customPropertyTypeIds, ["text", "number", "date", "select", "multi-select"]);
  assert.deepEqual(systemPropertyIds, ["property:name", "property:status"]);
});

test("isSystemPropertyId recognizes immutable system property ids", () => {
  assert.equal(isSystemPropertyId("property:name"), true);
  assert.equal(isSystemPropertyId("property:status"), true);
  assert.equal(isSystemPropertyId("property:priority"), false);
});

test("createDefaultPropertySchemas returns only system Name and Status schemas for a workspace", () => {
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
  assert.equal(normalizePropertyValue("date", "0001-01-01"), "0001-01-01");
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

test("normalizePropertySchema filters invalid select options", () => {
  assert.deepEqual(
    normalizePropertySchema({
      id: "property:priority",
      name: "Priority",
      type: "multi-select",
      config: {
        options: [
          null,
          {},
          { id: "x" },
          { name: "X" },
          { id: "", name: "Empty id" },
          { id: "empty-name", name: "" },
          { id: "high", name: "High" },
        ],
      },
    }).config.options,
    [{ id: "high", name: "High", color: "", order: 70 }],
  );
});

test("normalizePropertySchema clones nested non-select config objects", () => {
  const config = { display: { width: 200 } };
  const schema = normalizePropertySchema({ id: "property:text", type: "text", config });

  config.display.width = 300;

  assert.deepEqual(schema.config, { display: { width: 200 } });
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

test("normalizePropertyDefinition rejects unsupported custom property types", () => {
  assert.throws(
    () => normalizePropertyDefinition({ id: "property:bad", workspaceId: "workspace-1", name: "Rating", type: "rating" }),
    /Unsupported property type/,
  );
});

test("normalizePropertyDefinition marks system properties immutable but preserves display names", () => {
  assert.deepEqual(
    normalizePropertyDefinition({
      id: "property:name",
      workspaceId: "workspace-1",
      name: "Renamed",
      type: "number",
      hidden: true,
      order: 80,
    }, { now: "2026-05-15T00:00:00.000Z" }),
    {
      id: "property:name",
      workspaceId: "workspace-1",
      name: "Renamed",
      type: "text",
      system: true,
      immutable: true,
      hidden: false,
      order: 10,
      config: {},
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
      deletedAt: null,
    },
  );
});

test("normalizePropertyDefinition normalizes custom properties", () => {
  assert.deepEqual(
    normalizePropertyDefinition({
      id: "property:priority",
      workspaceId: "workspace-1",
      name: "  Priority  ",
      type: "select",
      hidden: true,
      order: "30",
      config: { display: "badge" },
      createdAt: "2026-05-14T00:00:00.000Z",
    }, { now: "2026-05-15T00:00:00.000Z" }),
    {
      id: "property:priority",
      workspaceId: "workspace-1",
      name: "Priority",
      type: "select",
      system: false,
      immutable: false,
      hidden: true,
      order: 30,
      config: { display: "badge", options: [] },
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
      deletedAt: null,
    },
  );
});

test("normalizeSelectValue normalizes select value documents", () => {
  assert.deepEqual(
    normalizeSelectValue({
      id: "selectValue:priority:high",
      workspaceId: "workspace-1",
      propertyId: "property:priority",
      name: "  High  ",
      color: "red",
      hidden: true,
      order: "20",
      createdAt: "2026-05-14T00:00:00.000Z",
    }, { now: "2026-05-15T00:00:00.000Z" }),
    {
      id: "selectValue:priority:high",
      workspaceId: "workspace-1",
      propertyId: "property:priority",
      name: "High",
      color: "red",
      hidden: true,
      order: 20,
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
      deletedAt: null,
    },
  );
});

test("normalizeProjectPropertyValue validates type-specific project values", () => {
  assert.deepEqual(
    normalizeProjectPropertyValue({
      property: { id: "property:budget", type: "number" },
      value: "42.5",
    }),
    { propertyId: "property:budget", type: "number", value: 42.5 },
  );
  assert.deepEqual(
    normalizeProjectPropertyValue({
      property: { id: "property:tags", type: "multi-select" },
      selectValues: [
        { id: "selectValue:tags:design", propertyId: "property:tags" },
        { id: "selectValue:tags:build", propertyId: "property:tags" },
      ],
      value: ["selectValue:tags:design", "selectValue:tags:build", "selectValue:tags:design"],
    }),
    {
      propertyId: "property:tags",
      type: "multi-select",
      value: ["selectValue:tags:design", "selectValue:tags:build"],
    },
  );
});

test("normalizeProjectPropertyValue rejects invalid select references and system properties", () => {
  assert.throws(
    () => normalizeProjectPropertyValue({
      property: { id: "property:priority", type: "select" },
      selectValues: [{ id: "selectValue:priority:high", propertyId: "property:priority" }],
      value: "selectValue:priority:missing",
    }),
    /Select value does not exist/,
  );
  assert.throws(
    () => normalizeProjectPropertyValue({
      property: { id: "property:status", type: "select", system: true },
      value: "statusValue:active",
    }),
    /System property values are derived/,
  );
});
