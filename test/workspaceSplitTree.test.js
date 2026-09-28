import test from "node:test";
import assert from "node:assert/strict";
import {
  listWorkspacePanes,
  workspacePane,
  insertWorkspacePane,
  removeWorkspacePane,
  resizeWorkspaceSplit,
  readWorkspaceSplitTree,
  workspaceSplitDrop,
  moveWorkspacePane,
} from "../src/workspaceSplitTree.js";
import { createPaneLayout, paneLayoutReducer as reduce } from "../src/workspacePaneLayout.js";
const pane = (id) => ({ type: "pane", paneId: id, tabId: `tab:${id}` });
const fixture = () =>
  insertWorkspacePane(
    insertWorkspacePane(workspacePane(), "workspace", "right", pane("a")),
    "a",
    "bottom",
    pane("b"),
  );
test("nested vertical split preserves ordered content; middle close collapses with right neighbour focus", () => {
  let tree = fixture();
  assert.equal(tree.dir, "row");
  assert.equal(tree.children[1].dir, "col");
  assert.deepEqual(
    listWorkspacePanes(tree).map((p) => p.paneId),
    ["workspace", "a", "b"],
  );
  let state = { ...createPaneLayout(), tree, focused: "a", split: true };
  state = reduce(state, { type: "closePane", paneId: "a" });
  assert.equal(state.focused, "b");
  assert.deepEqual(
    listWorkspacePanes(state.tree).map((p) => p.paneId),
    ["workspace", "b"],
  );
  assert.equal(state.tree.children[1].type, "pane");
});
test("nested resize changes the addressed pair only; malformed tree rejects duplicate identities", () => {
  const tree = fixture(),
    resized = resizeWorkspaceSplit(tree, [1], 0, 0.9);
  assert.deepEqual(resized.sizes, tree.sizes);
  assert.deepEqual(resized.children[1].sizes, [0.85, 0.15000000000000002]);
  assert.deepEqual(readWorkspaceSplitTree(resized), resized);
  assert.equal(readWorkspaceSplitTree({ ...tree, children: [pane("a"), pane("a")] }), null);
});
test("moving nested existing pane to an edge removes original and center swaps identities", () => {
  const moved = moveWorkspacePane(fixture(), "b", "workspace", "left");
  assert.deepEqual(
    listWorkspacePanes(moved).map((p) => p.paneId),
    ["b", "workspace", "a"],
  );
  assert.equal(listWorkspacePanes(moved).length, 3);
  const swapped = moveWorkspacePane(fixture(), "workspace", "b", "center");
  assert.deepEqual(
    listWorkspacePanes(swapped).map((p) => p.paneId),
    ["b", "a", "workspace"],
  );
  assert.equal(moveWorkspacePane(moved, "b", "b", "right"), moved);
});
test("closing sole project restores Workspace and removes dangling content", () => {
  const state = { ...createPaneLayout(), tree: pane("a"), focused: "a", maximized: "a" };
  const closed = reduce(state, { type: "closePane", paneId: "a" });
  assert.deepEqual(closed.tree, workspacePane());
  assert.equal(closed.focused, "workspace");
  assert.equal(closed.maximized, null);
});
test("pane drop rejects outside/titlebar, distinguishes edge directions and center", () => {
  const rect = { left: 320, top: 0, width: 560, height: 720 };
  assert.equal(workspaceSplitDrop(rect, 310, 500), null);
  assert.equal(workspaceSplitDrop(rect, 600, 20), null);
  for (const [x, y, side] of [
    [340, 80, "left"],
    [870, 700, "right"],
    [600, 80, "top"],
    [600, 700, "bottom"],
    [600, 360, "center"],
  ])
    assert.equal(workspaceSplitDrop(rect, x, y), side);
});
test("eight-pane source limit replaces focused content without increasing leaves", () => {
  let state = createPaneLayout();
  for (let index = 1; index < 8; index++)
    state = reduce(state, {
      type: "split",
      target: "workspace",
      side: "right",
      paneId: `pane:${index}`,
      tabId: `tab:${index}`,
    });
  assert.equal(listWorkspacePanes(state.tree).length, 8);
  state = reduce(state, {
    type: "split",
    target: "pane:4",
    side: "right",
    paneId: "unused:9",
    tabId: "tab:9",
  });
  assert.equal(listWorkspacePanes(state.tree).length, 8);
  assert.equal(listWorkspacePanes(state.tree).find((p) => p.paneId === "pane:4").tabId, "tab:9");
  assert.equal(state.focused, "pane:4");
});
test("Workspace and Settings remain reachable after primary close or content replacement without discarding other leaves", () => {
  let state = { ...createPaneLayout(), tree: fixture(), focused: "workspace", split: true };
  state = reduce(state, { type: "closePane", paneId: "workspace" });
  assert.deepEqual(
    listWorkspacePanes(state.tree).map((p) => p.paneId),
    ["a", "b"],
  );
  state = reduce(state, { type: "showWorkspace" });
  assert.deepEqual(
    listWorkspacePanes(state.tree).map((p) => [p.paneId, p.tabId]),
    [
      ["workspace", null],
      ["b", "tab:b"],
    ],
  );
  assert.equal(state.focused, "workspace");
  state = reduce(state, { type: "replacePane", paneId: "workspace", tabId: "tab:c" });
  state = reduce(state, { type: "showWorkspace" });
  assert.equal(listWorkspacePanes(state.tree)[0].tabId, null);
  assert.equal(listWorkspacePanes(state.tree)[1].tabId, "tab:b");
});
