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
  assert.equal(a.rightWidth, 640);
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
