import test from "node:test";
import assert from "node:assert/strict";
import { duplicateWorkspaceView } from "../src/duplicateWorkspaceView.js";

for (const viewType of ["board", "table"]) {
  test(`duplicates ${viewType} settings, inserts beside source and activates copy`, async () => {
    const source = { id: "source", name: "Original", viewType, visiblePropertyIds: ["name"], hiddenPropertyIds: ["status"], propertyOrder: { name: 10 }, valueVisibility: { status: { valueIds: ["active"] } }, propertyLayout: { text: { wrapContent: true } }, boardLayout: { columnWidth: 480 } };
    const calls = [];
    const client = {
      listViews: async () => ({ activeViewId: "last", views: [source, { id: "last", name: "Original copy" }] }),
      createView: async payload => { calls.push(["create", payload]); return { view: { id: "copy" } }; },
      updateView: async payload => calls.push(["update", payload]),
      reorderViews: async payload => calls.push(["order", payload]),
      setActiveView: async payload => calls.push(["active", payload]),
    };
    assert.equal(await duplicateWorkspaceView(client, "w", "source", "Original copy"), "copy");
    assert.equal(calls[0][1].name, "Original copy 2");
    assert.equal(calls[0][1].viewType, viewType);
    const { id, name, viewType: ignored, ...settings } = source;
    assert.deepEqual(calls[1][1].patch, settings);
    assert.notEqual(calls[1][1].patch.valueVisibility, source.valueVisibility);
    assert.deepEqual(calls[2][1].orderedViewIds, ["source", "copy", "last"]);
    assert.equal(calls[3][1].viewId, "copy");
  });
}

test("failure removes the partial copy and restores the previous active view", async () => {
  const calls = [];
  const client = {
    listViews: async () => ({ activeViewId: "source", views: [{ id: "source", name: "Board", viewType: "board" }] }),
    createView: async () => ({ view: { id: "copy" } }),
    updateView: async () => { throw new Error("save failed"); },
    deleteView: async payload => calls.push(payload.viewId),
    setActiveView: async payload => calls.push(payload.viewId),
  };
  await assert.rejects(duplicateWorkspaceView(client, "w", "source", "Copy"), /save failed/);
  assert.deepEqual(calls, ["copy", "source"]);
});
