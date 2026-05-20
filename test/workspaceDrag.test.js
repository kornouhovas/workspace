import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as ts from "typescript";

async function importDragModule() {
  const source = await readFile(new URL("../src/workspaceDrag.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("reorderWorkspaceIdsForDrag previews moving a dragged workspace before the hovered workspace", async () => {
  const { reorderWorkspaceIdsForDrag } = await importDragModule();

  assert.deepEqual(
    reorderWorkspaceIdsForDrag(["workspace:a", "workspace:b", "workspace:c"], "workspace:c", "workspace:a", "before"),
    ["workspace:c", "workspace:a", "workspace:b"],
  );
});

test("reorderWorkspaceIdsForDrag previews moving a dragged workspace after the hovered workspace", async () => {
  const { reorderWorkspaceIdsForDrag } = await importDragModule();

  assert.deepEqual(
    reorderWorkspaceIdsForDrag(["workspace:a", "workspace:b", "workspace:c"], "workspace:a", "workspace:c", "after"),
    ["workspace:b", "workspace:c", "workspace:a"],
  );
});

test("reorderWorkspaceIdsForDrag keeps the current order for invalid drag targets", async () => {
  const { reorderWorkspaceIdsForDrag } = await importDragModule();
  const order = ["workspace:a", "workspace:b", "workspace:c"];

  assert.deepEqual(reorderWorkspaceIdsForDrag(order, "workspace:a", "workspace:a", "after"), order);
  assert.deepEqual(reorderWorkspaceIdsForDrag(order, "workspace:missing", "workspace:c", "before"), order);
  assert.deepEqual(reorderWorkspaceIdsForDrag(order, "workspace:a", "workspace:missing", "before"), order);
});

test("mergeFixedIdsWithReorderedIds keeps pinned ids aligned during partial-list drag previews", async () => {
  const { mergeFixedIdsWithReorderedIds } = await importDragModule();

  assert.deepEqual(
    mergeFixedIdsWithReorderedIds(
      ["property:name", "property:status", "property:multi", "property:text"],
      ["property:name"],
      ["property:status", "property:multi", "property:text"],
    ),
    ["property:name", "property:status", "property:multi", "property:text"],
  );
  assert.deepEqual(
    mergeFixedIdsWithReorderedIds(
      ["property:name", "property:status", "property:multi", "property:text"],
      ["property:name"],
      ["property:multi", "property:status", "property:text"],
    ),
    ["property:name", "property:multi", "property:status", "property:text"],
  );
});
