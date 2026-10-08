import test from "node:test";
import assert from "node:assert/strict";
import {
  createPaneLayout,
  paneLayoutReducer as reduce,
  readPaneLayouts,
  writePaneLayouts,
} from "../src/workspacePaneLayout.js";
test("obsolete navigation and launcher commands cannot open a right host", () => {
  const state = createPaneLayout();
  for (const action of [
    { type: "rightToggle" }, { type: "rightOpen", id: "launcher" },
    { type: "rightSelect", id: "navigation" }, { type: "rightReopen" },
  ]) assert.equal(reduce(state, action), state);
  assert.equal(state.rightVisible, false);
});
test("split maximize restore close retains ratio and follows focus", () => {
  let s = reduce(createPaneLayout(), { type: "split" });
  s = reduce(s, { type: "resizeSplit", ratio: 0.7 });
  s = reduce(s, { type: "maximize", pane: "project" });
  assert.equal(s.maximized, "project");
  s = reduce(s, { type: "maximize", pane: "project" });
  assert.equal(s.maximized, null);
  assert.equal(s.splitRatio, 0.7);
  s = reduce(s, { type: "closeSplit" });
  assert.equal(s.focused, "workspace");
  assert.equal(s.split, false);
});
test("session round trip validates surviving maximize/focus and validates malformed storage", () => {
  let raw;
  const store = { setItem: (_, value) => (raw = value), getItem: () => raw };
  let s = reduce(createPaneLayout(), { type: "previewProject" });
  s = reduce(s, {
    type: "split",
    tabId: "project:a",
    paneId: "project",
    target: "workspace",
    side: "right",
  });
  s = reduce(s, { type: "maximize", pane: "project" });
  assert.equal(writePaneLayouts(store, { opaque: s }), true);
  const loaded = readPaneLayouts(store).opaque;
  assert.equal(loaded.split, true);
  assert.equal(loaded.rightVisible, true);
  assert.equal(loaded.maximized, "project");
  assert.equal(loaded.focused, "project");
  raw = "{bad";
  assert.deepEqual(readPaneLayouts(store), {});
  raw = JSON.stringify({
    version: 1,
    layouts: {
      a: {
        rightTabs: ["a", "a", 3],
        activeRightTab: "bad",
        rightWidth: 100000,
        sidebarWidth: 0,
        splitRatio: -1,
      },
    },
  });
  const a = readPaneLayouts(store).a;
  assert.equal(a.rightTabs, undefined);
  assert.equal(a.activeRightTab, undefined);
  assert.equal(a.rightWidth, 16384);
  assert.equal(a.sidebarWidth, 240);
  assert.equal(a.splitRatio, 0.2);
  assert.equal(
    writePaneLayouts(
      {
        setItem: () => {
          throw Error();
        },
      },
      {},
    ),
    false,
  );
});
test("persisted invalid focus/maximize recover to surviving leaf without changing content", () => {
  const state = reduce(createPaneLayout(), {
    type: "split",
    target: "workspace",
    paneId: "a",
    tabId: "tab:a",
    side: "right",
  });
  state.focused = "missing";
  state.maximized = "missing";
  const storage = { getItem: () => JSON.stringify({ version: 1, layouts: { opaque: state } }) };
  const loaded = readPaneLayouts(storage).opaque;
  assert.equal(loaded.focused, "workspace");
  assert.equal(loaded.maximized, null);
  assert.deepEqual(loaded.tree, state.tree);
});

test("opening an independent project preview preserves a restored split and its tab identities", () => {
  let state = reduce(createPaneLayout(), { type: "split", tabId: "alpha", paneId: "alpha-pane", target: "workspace", side: "right" });
  state = reduce(state, { type: "maximize", pane: "alpha-pane" });
  let raw;
  const storage = { setItem: (_, value) => { raw = value; }, getItem: () => raw };
  writePaneLayouts(storage, { workspace: state });
  const restored = readPaneLayouts(storage).workspace;
  const preview = reduce(restored, { type: "previewProject" });
  assert.deepEqual(preview.tree, restored.tree);
  assert.equal(preview.split, true);
  assert.equal(preview.rightVisible, true);
  assert.equal(preview.focused, "right");
  assert.equal(preview.maximized, null);
});

test("selecting a saved view hides the right preview without discarding split panes", () => {
  let state = reduce(createPaneLayout(), { type: "split", tabId: "alpha", paneId: "alpha-pane", target: "workspace", side: "right" });
  const next = reduce(state, { type: "selectView" });
  assert.equal(next.rightVisible, false);
  assert.deepEqual(next.tree, state.tree);
  let raw;
  const storage = { setItem: (_, value) => { raw = value; }, getItem: () => raw };
  writePaneLayouts(storage, { workspace: next });
  assert.equal(readPaneLayouts(storage).workspace.rightVisible, false);
  assert.equal(reduce(next, { type: "previewProject" }).rightVisible, true);
});

test("right preview width can follow the pointer beyond 640 and survives restart", () => {
  const next = reduce(createPaneLayout(), { type: "resizeRight", width: 1000 });
  assert.equal(next.rightWidth, 1000);
  let raw;
  const storage = { setItem: (_, value) => { raw = value; }, getItem: () => raw };
  writePaneLayouts(storage, { workspace: next });
  assert.equal(readPaneLayouts(storage).workspace.rightWidth, 1000);
});

test("a resized width of 560 is explicit, not the legacy automatic-half sentinel", () => {
  const next = reduce(createPaneLayout(), { type: "resizeRight", width: 560 });
  assert.equal(next.rightWidthManual, true);
  let raw;
  const storage = { setItem: (_, value) => { raw = value; }, getItem: () => raw };
  writePaneLayouts(storage, { workspace: next });
  assert.equal(readPaneLayouts(storage).workspace.rightWidthManual, true);
  const legacy = readPaneLayouts({getItem: () => JSON.stringify({version:1,layouts:{workspace:{rightWidth:560}}})});
  assert.equal(legacy.workspace.rightWidthManual, false);
});

test('shared sidebar width migrates legacy width and changes without mixing pane state', async () => {
  const { readSidebarWidth, writeSidebarWidth } = await import('../src/workspacePaneLayout.js');
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const layouts = { a: { ...createPaneLayout(), sidebarWidth: 390, rightVisible: true }, b: { ...createPaneLayout(), sidebarWidth: 270 } };
  assert.equal(readSidebarWidth(storage, layouts), 390);
  writeSidebarWidth(storage, 420);
  assert.equal(readSidebarWidth(storage, layouts), 420);
  assert.equal(layouts.b.rightVisible, false);
});


test("closing an expanded project cannot leave an empty right host visible", () => {
  let state = reduce(createPaneLayout(), { type: "previewProject" });
  state = reduce(state, { type: "closeSplit" });
  assert.equal(state.rightVisible, false);
  assert.equal(state.focused, "workspace");
  assert.equal(state.maximized, null);
});


test("legacy navigation tabs are ignored without losing preview widths, sidebar or split identities", () => {
  let state = reduce(createPaneLayout(), { type: "split", tabId: "project:a", paneId: "project-pane", target: "workspace", side: "right" });
  state = { ...state, rightWidth: 735, rightWidthManual: true, sidebarWidth: 360, rightTabs: ["launcher"], activeRightTab: "launcher", closedRightTabs: ["old"], maximized: "project-pane" };
  const restored = readPaneLayouts({ getItem: () => JSON.stringify({ version: 1, layouts: { opaque: state } }) }).opaque;
  assert.deepEqual(restored.tree, state.tree);
  assert.equal(restored.rightWidth, 735);
  assert.equal(restored.sidebarWidth, 360);
  assert.equal(restored.maximized, "project-pane");
  assert.equal(restored.rightTabs, undefined);
  assert.equal(restored.activeRightTab, undefined);
  assert.equal(reduce(restored, { type: "previewProject" }).rightVisible, true);
});
