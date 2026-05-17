import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createFilePropertyStore } from "../src/workspacePropertyStore.js";

test("file property store surfaces corrupt JSON and preserves the file on write attempts", async () => {
  const filePath = join(await mkdtemp(join(tmpdir(), "workspace-property-store-")), "properties.json");
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, "{not json");

  const store = createFilePropertyStore(filePath);

  await assert.rejects(
    store.listProperties("workspace:one"),
    { code: "WORKSPACE_STORAGE_CORRUPT" },
  );
  await assert.rejects(
    store.saveProperty({
      id: "property:one",
      workspaceId: "workspace:one",
      name: "One",
      type: "text",
    }),
    { code: "WORKSPACE_STORAGE_CORRUPT" },
  );
  assert.equal(await readFile(filePath, "utf8"), "{not json");
});
