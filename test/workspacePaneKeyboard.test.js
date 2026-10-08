import test from "node:test";
import assert from "node:assert/strict";
import { consumeDragEscape, shouldClosePaneOnEscape } from "../src/workspacePaneKeyboard.js";
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
test("CmdW closes the focused preview or project and respects split leaf identity", async () => {
  const { focusedPaneCloseCommand } = await import("../src/workspacePaneKeyboard.js");
  const layout = {
    focused: "right",
    rightVisible: true,
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
  assert.deepEqual(focusedPaneCloseCommand(layout, "tab:a", true), { kind: "projectTab", id: "tab:a" });
  assert.deepEqual(focusedPaneCloseCommand(layout, null, false), { kind: "preview" });
  assert.equal(focusedPaneCloseCommand({ ...layout, rightVisible: false }, null, false), null);
  assert.deepEqual(focusedPaneCloseCommand({ ...layout, focused: "workspace" }, "tab:a", true), {
    kind: "pane",
    id: "workspace",
  });
  assert.deepEqual(focusedPaneCloseCommand({ ...layout, focused: "a" }, "tab:unrelated", true), {
    kind: "projectTab",
    id: "tab:a",
  });
  assert.equal(focusedPaneCloseCommand({ ...layout, focused: "missing" }, "tab:a", true), null);
});

test('Escape cancels an active drag without closing preview even when preview listener registered first', () => {
  const window = new EventTarget();
  let dragging = true;
  let previewOpen = true;
  let cancelled = false;
  window.addEventListener('keydown', event => {
    if (shouldClosePaneOnEscape({ key: event.key, defaultPrevented: event.defaultPrevented, editing: false, active: true, dragging })) {
      event.preventDefault(); previewOpen = false;
    }
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dragging) {
      event.preventDefault(); dragging = false; cancelled = true;
    }
  });
  const escape = () => Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' });
  window.dispatchEvent(escape());
  assert.equal(cancelled, true);
  assert.equal(previewOpen, true, 'row/card cancellation owns the first Escape regardless of listener order');
  window.dispatchEvent(escape());
  assert.equal(previewOpen, false, 'normal preview Escape remains available after drag is cancelled');
});


test('capture keeps Escape consumed after document drag cancellation removes active marker before window preview listener', () => {
  const propagation = new EventTarget();
  let dragging = true;
  let previewOpen = true;
  let dragCancelled = false;
  // These represent browser capture → document cancellation → window bubble.
  // The cancellation deliberately does not preventDefault, matching the Board
  // PointerSensor behavior, and removes the marker before the preview handler.
  propagation.addEventListener('keydown', event => consumeDragEscape(event, dragging));
  propagation.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dragging) { dragging = false; dragCancelled = true; }
  });
  propagation.addEventListener('keydown', event => {
    if (shouldClosePaneOnEscape({ key: event.key, defaultPrevented: event.defaultPrevented, editing: false, active: true, dragging })) previewOpen = false;
  });
  const escape = () => Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' });
  const event = escape();
  propagation.dispatchEvent(event);
  assert.equal(dragCancelled, true, 'capture must preserve propagation to cancellation');
  assert.equal(dragging, false);
  assert.equal(event.defaultPrevented, true, 'ownership survives removed DOM marker');
  assert.equal(previewOpen, true);
  propagation.dispatchEvent(escape());
  assert.equal(previewOpen, false, 'a subsequent ordinary Escape remains unchanged');
});
