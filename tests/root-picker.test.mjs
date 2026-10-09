import assert from "node:assert/strict";
import test from "node:test";
import { createRootPicker } from "../dist/desktop/root-picker.mjs";

test("native root picker requests directories and returns the selected path", async () => {
  const calls = [];
  const pickRoot = createRootPicker({
    showOpenDialog: async (options) => {
      calls.push(options);
      return { canceled: false, filePaths: ["/tmp/Workspace Root"] };
    },
  });
  assert.deepEqual(await pickRoot(), { outcome: "selected", path: "/tmp/Workspace Root" });
  assert.deepEqual(calls, [{ properties: ["openDirectory"], title: "Choose workspace folder" }]);
});

test("native root picker distinguishes cancellation and failures without leaking exception text", async () => {
  assert.deepEqual(await createRootPicker({
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  })(), { outcome: "cancelled" });
  assert.deepEqual(await createRootPicker({
    showOpenDialog: async () => { throw new Error("private platform details"); },
  })(), { outcome: "failed" });
  assert.deepEqual(await createRootPicker({
    showOpenDialog: async () => ({ canceled: false, filePaths: [] }),
  })(), { outcome: "cancelled" });
});
