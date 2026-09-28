import test from "node:test";
import assert from "node:assert/strict";
import {
  createPaneLayout,
  paneLayoutReducer as reduce,
  readPaneLayouts,
  writePaneLayouts,
} from "../src/workspacePaneLayout.js";
test("right tabs deduplicate, close active/inactive/last with neighbour fallback, reopen", () => {
  let s = createPaneLayout();
  for (const id of ["a", "b", "c", "b"]) s = reduce(s, { type: "rightOpen", id });
  assert.deepEqual(s.rightTabs, ["a", "b", "c"]);
  assert.equal(s.activeRightTab, "b");
  s = reduce(s, { type: "rightClose", id: "a" });
  assert.equal(s.activeRightTab, "b");
  s = reduce(s, { type: "rightClose", id: "b" });
  assert.equal(s.activeRightTab, "c");
  s = reduce(s, { type: "rightClose", id: "c" });
  assert.equal(s.activeRightTab, "navigation");
  s = reduce(s, { type: "rightReopen" });
  assert.equal(s.activeRightTab, "c");
  assert.deepEqual(s.rightTabs, ["c"]);
});
test("context close variants and reorder preserve identities", () => {
  let s = createPaneLayout();
  for (const id of ["a", "b", "c", "d"]) s = reduce(s, { type: "rightOpen", id });
  s = reduce(s, { type: "rightReorder", ids: ["c", "b", "c", "missing"] });
  assert.deepEqual(s.rightTabs, ["c", "b", "a", "d"]);
  s = reduce(s, { type: "rightCloseAfter", id: "b" });
  assert.deepEqual(s.rightTabs, ["c", "b"]);
  s = reduce(s, { type: "rightCloseOthers", id: "b" });
  assert.deepEqual(s.rightTabs, ["b"]);
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
  let s = reduce(createPaneLayout(), { type: "rightOpen", id: "tab:a" });
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
  assert.equal(loaded.activeRightTab, "tab:a");
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
  assert.deepEqual(a.rightTabs, ["a"]);
  assert.equal(a.activeRightTab, "navigation");
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
test("empty launcher is deduplicated and excluded from reopen history", () => {
  let s = reduce(createPaneLayout(), { type: "rightOpen", id: "launcher" });
  s = reduce(s, { type: "rightOpen", id: "launcher" });
  assert.deepEqual(s.rightTabs, ["launcher"]);
  s = reduce(s, { type: "rightClose", id: "launcher" });
  assert.deepEqual(s.closedRightTabs, []);
  assert.equal(reduce(s, { type: "rightReopen" }), s);
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
  state = reduce(state, { type: "rightOpen", id: "launcher" });
  state = reduce(state, { type: "maximize", pane: "alpha-pane" });
  let raw;
  const storage = { setItem: (_, value) => { raw = value; }, getItem: () => raw };
  writePaneLayouts(storage, { workspace: state });
  const restored = readPaneLayouts(storage).workspace;
  const preview = reduce(restored, { type: "previewProject" });
  assert.deepEqual(preview.tree, restored.tree);
  assert.equal(preview.split, true);
  assert.equal(preview.rightVisible, true);
  assert.equal(preview.activeRightTab, "navigation");
  assert.equal(preview.focused, "right");
  assert.equal(preview.maximized, null);
  assert.deepEqual(preview.rightTabs, ["launcher"]);
});

test("selecting a saved view hides the right host without discarding split or right tabs", () => {
  let state = reduce(createPaneLayout(), { type: "split", tabId: "alpha", paneId: "alpha-pane", target: "workspace", side: "right" });
  state = reduce(state, { type: "rightOpen", id: "launcher" });
  const next = reduce(state, { type: "selectView" });
  assert.equal(next.rightVisible, false);
  assert.deepEqual(next.tree, state.tree);
  assert.deepEqual(next.rightTabs, state.rightTabs);
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
