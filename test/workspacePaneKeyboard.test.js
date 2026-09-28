import test from "node:test";
import assert from "node:assert/strict";
import { shouldClosePaneOnEscape } from "../src/workspacePaneKeyboard.js";
test("Escape closes exactly the focused leaf among multiple details and respects editor/menu consumption", () => {
  const event = { key: "Escape", defaultPrevented: false, editing: false };
  assert.deepEqual(
    ["a", "b", "right"].filter((id) => shouldClosePaneOnEscape({ ...event, active: id === "b" })),
    ["b"],
  );
  assert.equal(shouldClosePaneOnEscape({ ...event, active: true, editing: true }), false);
  assert.equal(shouldClosePaneOnEscape({ ...event, active: true, defaultPrevented: true }), false);
  assert.equal(shouldClosePaneOnEscape({ ...event, key: "Enter", active: true }), false);
});
test("CmdW belongs to fixedNavigation/primary/detail focus and never closes a different selected project", async () => {
  const { focusedPaneCloseCommand } = await import("../src/workspacePaneKeyboard.js");
  const layout = {
    focused: "right",
    activeRightTab: "navigation",
    tree: {
      type: "split",
      dir: "row",
      sizes: [0.5, 0.5],
      children: [
        { type: "pane", paneId: "workspace", tabId: null },
        { type: "pane", paneId: "a", tabId: "tab:a" },
      ],
    },
  };
  assert.equal(focusedPaneCloseCommand(layout, "tab:a", true), null);
  assert.deepEqual(focusedPaneCloseCommand({ ...layout, focused: "workspace" }, "tab:a", true), {
    kind: "pane",
    id: "workspace",
  });
  assert.deepEqual(focusedPaneCloseCommand({ ...layout, focused: "a" }, "tab:unrelated", true), {
    kind: "projectTab",
    id: "tab:a",
  });
  assert.equal(focusedPaneCloseCommand({ ...layout, focused: "missing" }, "tab:a", true), null);
  assert.deepEqual(
    focusedPaneCloseCommand({ ...layout, activeRightTab: "launcher" }, "tab:a", true),
    { kind: "rightTab", id: "launcher" },
  );
});
